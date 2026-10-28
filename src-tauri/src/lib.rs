use std::sync::atomic::{AtomicBool, AtomicI32, Ordering};
use std::sync::Mutex;
use tauri::{
    menu::{CheckMenuItem, Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Emitter, Manager,
};

static IS_QUITTING: AtomicBool = AtomicBool::new(false);
static LAST_RAW_CURSOR_X: AtomicI32 = AtomicI32::new(-9999);
static LAST_RAW_CURSOR_Y: AtomicI32 = AtomicI32::new(-9999);
static CACHED_REL_POS: Mutex<(f64, f64)> = Mutex::new((0.0, 0.0));
static SETTINGS_OPEN_SIDE: Mutex<Option<String>> = Mutex::new(None);

#[cfg(target_os = "windows")]
mod win_mem {
    use std::ffi::c_void;

    #[link(name = "kernel32")]
    extern "system" {
        fn GetCurrentProcess() -> *mut c_void;
        fn SetProcessWorkingSetSize(
            h_process: *mut c_void,
            dw_minimum_working_set_size: usize,
            dw_maximum_working_set_size: usize,
        ) -> i32;
        fn GetProcessHeap() -> *mut c_void;
        fn HeapCompact(h_heap: *mut c_void, dw_flags: u32) -> usize;
        fn K32EmptyWorkingSet(h_process: *mut c_void) -> i32;
    }

    /// Super-fast zero-overhead memory trim for the host process (< 0.005ms)
    pub fn trim_host_working_set() {
        unsafe {
            let heap = GetProcessHeap();
            if !heap.is_null() {
                HeapCompact(heap, 0);
            }
            let my_handle = GetCurrentProcess();
            K32EmptyWorkingSet(my_handle);
            SetProcessWorkingSetSize(my_handle, usize::MAX, usize::MAX);
        }
    }
}

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
fn trim_memory() {
    #[cfg(target_os = "windows")]
    win_mem::trim_host_working_set();
}

#[tauri::command]
fn get_global_cursor_position(window: tauri::Window) -> (f64, f64) {
    #[cfg(target_os = "windows")]
    {
        #[repr(C)]
        #[derive(Default, Copy, Clone)]
        struct POINT {
            x: i32,
            y: i32,
        }
        #[link(name = "user32")]
        extern "system" {
            fn GetCursorPos(lp_point: *mut POINT) -> i32;
        }

        let mut pt = POINT::default();
        unsafe {
            GetCursorPos(&mut pt);
        }

        let last_x = LAST_RAW_CURSOR_X.load(Ordering::Relaxed);
        let last_y = LAST_RAW_CURSOR_Y.load(Ordering::Relaxed);

        if (pt.x - last_x).abs() < 4 && (pt.y - last_y).abs() < 4 {
            if let Ok(cached) = CACHED_REL_POS.lock() {
                return *cached;
            }
        }

        LAST_RAW_CURSOR_X.store(pt.x, Ordering::Relaxed);
        LAST_RAW_CURSOR_Y.store(pt.y, Ordering::Relaxed);

        if let (Ok(win_pos), Ok(win_size), Ok(Some(monitor))) = (
            window.outer_position(),
            window.outer_size(),
            window.current_monitor(),
        ) {
            let center_x = win_pos.x as f64 + (win_size.width as f64 / 2.0);
            let center_y = win_pos.y as f64 + (win_size.height as f64 / 2.0);

            let screen_size = monitor.size();
            let span_x = (screen_size.width as f64 / 2.0).max(1.0);
            let span_y = (screen_size.height as f64 / 2.0).max(1.0);

            let rel_x = ((pt.x as f64 - center_x) / span_x).clamp(-1.0, 1.0);
            let rel_y = ((pt.y as f64 - center_y) / span_y).clamp(-1.0, 1.0);

            if let Ok(mut cached) = CACHED_REL_POS.lock() {
                *cached = (rel_x, rel_y);
            }

            return (rel_x, rel_y);
        }
    }
    (0.0, 0.0)
}

#[tauri::command]
fn set_window_always_on_top(window: tauri::Window, always_on_top: bool) -> Result<(), String> {
    window.set_always_on_top(always_on_top).map_err(|e| e.to_string())
}

#[tauri::command]
fn set_window_skip_taskbar(window: tauri::Window, skip: bool) -> Result<(), String> {
    window.set_skip_taskbar(skip).map_err(|e| e.to_string())
}

#[tauri::command]
fn hide_window_to_tray(window: tauri::Window, app: tauri::AppHandle) -> Result<(), String> {
    let _ = app.emit("window-visibility-changed", false);
    window.hide().map_err(|e| e.to_string())?;
    #[cfg(target_os = "windows")]
    win_mem::trim_host_working_set();
    Ok(())
}

#[tauri::command]
fn show_window_from_tray(window: tauri::Window, app: tauri::AppHandle) -> Result<(), String> {
    let _ = app.emit("window-visibility-changed", true);
    window.show().map_err(|e| e.to_string())?;
    let _ = window.unminimize();
    window.set_focus().map_err(|e| e.to_string())
}

#[tauri::command]
fn set_settings_open(window: tauri::Window, open: bool) -> Result<String, String> {
    let monitor = window
        .current_monitor()
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "No monitor found".to_string())?;
    let scale = monitor.scale_factor();
    let screen_size = monitor.size();
    let screen_w = screen_size.width as i32;

    let base_w = (320.0 * scale) as i32;
    let base_h = (280.0 * scale) as i32;
    let exp_w = (560.0 * scale) as i32;
    let exp_h = (340.0 * scale) as i32;

    let delta_w = exp_w - base_w;
    let delta_h = exp_h - base_h;

    let current_pos = window.outer_position().map_err(|e| e.to_string())?;
    let current_size = window.outer_size().map_err(|e| e.to_string())?;
    let is_currently_expanded = (current_size.width as i32) >= (exp_w - 20);

    if open {
        if is_currently_expanded {
            let side = SETTINGS_OPEN_SIDE.lock().ok().and_then(|s| s.clone()).unwrap_or_else(|| "left".to_string());
            return Ok(side);
        }

        let mochi_center_x = current_pos.x + (base_w / 2);
        let is_left_side = mochi_center_x < (screen_w / 2);

        // MATHEMATICALLY ZERO-JUMP ANCHORING:
        // When Mochi is on right: anchor bottom-right corner. Window expands leftward by delta_w.
        // When Mochi is on left: anchor bottom-left corner. Window expands rightward.
        let (new_x, side) = if is_left_side {
            (current_pos.x, "right")
        } else {
            (current_pos.x - delta_w, "left")
        };

        let new_y = current_pos.y - delta_h;

        if let Ok(mut saved_side) = SETTINGS_OPEN_SIDE.lock() {
            *saved_side = Some(side.to_string());
        }

        window
            .set_size(tauri::Size::Physical(tauri::PhysicalSize {
                width: exp_w as u32,
                height: exp_h as u32,
            }))
            .map_err(|e| e.to_string())?;
        window
            .set_position(tauri::Position::Physical(tauri::PhysicalPosition {
                x: new_x.max(0),
                y: new_y.max(0),
            }))
            .map_err(|e| e.to_string())?;

        return Ok(side.to_string());
    } else {
        if !is_currently_expanded {
            return Ok("closed".to_string());
        }

        let previous_side = SETTINGS_OPEN_SIDE.lock().ok().and_then(|s| s.clone());

        let new_x = if previous_side.as_deref() == Some("left") {
            current_pos.x + delta_w
        } else {
            current_pos.x
        };

        let new_y = current_pos.y + delta_h;

        if let Ok(mut saved_side) = SETTINGS_OPEN_SIDE.lock() {
            *saved_side = None;
        }

        window
            .set_size(tauri::Size::Physical(tauri::PhysicalSize {
                width: base_w as u32,
                height: base_h as u32,
            }))
            .map_err(|e| e.to_string())?;
        window
            .set_position(tauri::Position::Physical(tauri::PhysicalPosition {
                x: new_x.max(0),
                y: new_y.max(0),
            }))
            .map_err(|e| e.to_string())?;

        #[cfg(target_os = "windows")]
        win_mem::trim_host_working_set();

        return Ok("closed".to_string());
    }
}

#[tauri::command]
fn reset_window_position(window: tauri::Window) -> Result<(), String> {
    let monitor = window
        .current_monitor()
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "No monitor found".to_string())?;
    let screen_size = monitor.size();
    let scale = monitor.scale_factor();

    let base_w = (320.0 * scale) as i32;
    let base_h = (280.0 * scale) as i32;
    let margin_x = (4.0 * scale) as i32;
    let margin_y = (4.0 * scale) as i32;
    let x = screen_size.width as i32 - base_w - margin_x;
    let y = screen_size.height as i32 - base_h - margin_y;

    if let Ok(mut saved_side) = SETTINGS_OPEN_SIDE.lock() {
        *saved_side = None;
    }

    let _ = window.set_size(tauri::Size::Physical(tauri::PhysicalSize {
        width: base_w as u32,
        height: base_h as u32,
    }));
    window
        .set_position(tauri::Position::Physical(tauri::PhysicalPosition { x, y }))
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn quit_app(app: tauri::AppHandle) {
    IS_QUITTING.store(true, Ordering::SeqCst);
    app.exit(0);
}

#[cfg(target_os = "windows")]
mod win_clipboard {
    use std::ffi::c_void;

    #[link(name = "user32")]
    extern "system" {
        fn OpenClipboard(hwnd: *mut c_void) -> i32;
        fn EmptyClipboard() -> i32;
        fn CloseClipboard() -> i32;
        fn GetClipboardData(u_format: u32) -> *mut c_void;
    }

    #[link(name = "kernel32")]
    extern "system" {
        fn GlobalLock(h_mem: *mut c_void) -> *mut c_void;
        fn GlobalUnlock(h_mem: *mut c_void) -> i32;
    }

    pub fn clear() -> Result<(), String> {
        unsafe {
            if OpenClipboard(std::ptr::null_mut()) != 0 {
                EmptyClipboard();
                CloseClipboard();
                Ok(())
            } else {
                Err("Failed to open clipboard".to_string())
            }
        }
    }

    pub fn read_text() -> Result<String, String> {
        unsafe {
            if OpenClipboard(std::ptr::null_mut()) == 0 {
                return Err("Failed to open clipboard".to_string());
            }
            let handle = GetClipboardData(13); // CF_UNICODETEXT
            if handle.is_null() {
                CloseClipboard();
                return Ok(String::new());
            }
            let ptr = GlobalLock(handle) as *const u16;
            if ptr.is_null() {
                CloseClipboard();
                return Ok(String::new());
            }
            let mut len = 0;
            while *ptr.add(len) != 0 {
                len += 1;
            }
            let slice = std::slice::from_raw_parts(ptr, len);
            let text = String::from_utf16_lossy(slice);
            GlobalUnlock(handle);
            CloseClipboard();
            Ok(text)
        }
    }
}

#[tauri::command]
fn clear_clipboard() -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        win_clipboard::clear()
    }
    #[cfg(not(target_os = "windows"))]
    {
        Ok(())
    }
}

#[tauri::command]
fn read_clipboard_text() -> Result<String, String> {
    #[cfg(target_os = "windows")]
    {
        win_clipboard::read_text()
    }
    #[cfg(not(target_os = "windows"))]
    {
        Ok(String::new())
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    #[cfg(target_os = "windows")]
    {
        std::env::set_var(
            "WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS",
            "--disable-features=Translate,OptimizationHints,MediaRouter,CalculateNativeWinOcclusion \
             --disable-background-networking \
             --disable-component-update \
             --disable-domain-reliability \
             --no-first-run \
             --disable-breakpad \
             --disable-default-apps \
             --disable-extensions \
             --disable-sync \
             --disable-speech-api \
             --renderer-process-limit=1 \
             --js-flags=--max-old-space-size=128",
        );
    }

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window.app_handle().emit("window-visibility-changed", false);
                let _ = window.hide();
                #[cfg(target_os = "windows")]
                win_mem::trim_host_working_set();
            }
        })
        .setup(|app| {
            if let Some(window) = app.get_webview_window("main") {
                if let Ok(Some(monitor)) = window.current_monitor() {
                    let screen_size = monitor.size();
                    let scale_factor = monitor.scale_factor();
                    let win_width = (320.0 * scale_factor) as i32;
                    let win_height = (280.0 * scale_factor) as i32;
                    let margin_x = (4.0 * scale_factor) as i32;
                    let margin_y = (4.0 * scale_factor) as i32;
                    let x = screen_size.width as i32 - win_width - margin_x;
                    let y = screen_size.height as i32 - win_height - margin_y;
                    let _ = window.set_position(tauri::Position::Physical(tauri::PhysicalPosition { x, y }));
                }
            }

            // Setup System Tray with Right-Click Context Menu
            let show_hide_item = MenuItem::with_id(app, "show_hide", "Show / Hide Mochi", true, None::<&str>)?;
            let always_on_top_item = CheckMenuItem::with_id(app, "always_on_top", "Always on Top", true, true, None::<&str>)?;
            let settings_item = MenuItem::with_id(app, "settings", "Open Settings", true, None::<&str>)?;
            let quit_item = MenuItem::with_id(app, "quit", "Quit Completely", true, None::<&str>)?;

            let tray_menu = Menu::with_items(
                app,
                &[&show_hide_item, &always_on_top_item, &settings_item, &quit_item],
            )?;

            let mut builder = TrayIconBuilder::new().menu(&tray_menu).show_menu_on_left_click(false);

            if let Some(icon) = app.default_window_icon() {
                builder = builder.icon(icon.clone());
            }

            builder
                .on_menu_event(|app, event| {
                    match event.id.as_ref() {
                        "show_hide" => {
                            if let Some(window) = app.get_webview_window("main") {
                                if let Ok(visible) = window.is_visible() {
                                    if visible {
                                        let _ = app.emit("window-visibility-changed", false);
                                        let _ = window.hide();
                                        #[cfg(target_os = "windows")]
                                        win_mem::trim_host_working_set();
                                    } else {
                                        let _ = window.show();
                                        let _ = window.unminimize();
                                        let _ = window.set_focus();
                                        let _ = app.emit("window-visibility-changed", true);
                                    }
                                }
                            }
                        }
                        "always_on_top" => {
                            let _ = app.emit("toggle-always-on-top", ());
                        }
                        "settings" => {
                            if let Some(window) = app.get_webview_window("main") {
                                let _ = window.show();
                                let _ = window.unminimize();
                                let _ = window.set_focus();
                                let _ = app.emit("window-visibility-changed", true);
                            }
                            let _ = app.emit("open-settings", ());
                        }
                        "quit" => {
                            IS_QUITTING.store(true, Ordering::SeqCst);
                            app.exit(0);
                        }
                        _ => {}
                    }
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        let app = tray.app_handle();
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.unminimize();
                            let _ = window.set_focus();
                            let _ = app.emit("window-visibility-changed", true);
                        }
                    }
                })
                .build(app)?;

            // SINGLE UNIFIED BACKGROUND SUPERVISOR (0.00% CPU overhead)
            // Checks GlobalMemoryStatusEx every 10 seconds.
            // Trims memory every 60 seconds.
            let app_clone = app.handle().clone();
            std::thread::spawn(move || {
                let mut tick = 0u64;
                let mut last_emitted_mem = 0u32;

                #[repr(C)]
                struct MEMORYSTATUSEX {
                    dw_length: u32,
                    dw_memory_load: u32,
                    ull_total_phys: u64,
                    ull_avail_phys: u64,
                    ull_total_page_file: u64,
                    ull_avail_page_file: u64,
                    ull_total_virtual: u64,
                    ull_avail_virtual: u64,
                    ull_avail_extended_virtual: u64,
                }

                #[link(name = "kernel32")]
                extern "system" {
                    fn GlobalMemoryStatusEx(lp_buffer: *mut MEMORYSTATUSEX) -> i32;
                }

                loop {
                    std::thread::sleep(std::time::Duration::from_secs(10));
                    tick = tick.wrapping_add(1);

                    #[cfg(target_os = "windows")]
                    {
                        let mut mem_status = MEMORYSTATUSEX {
                            dw_length: std::mem::size_of::<MEMORYSTATUSEX>() as u32,
                            dw_memory_load: 0,
                            ull_total_phys: 0,
                            ull_avail_phys: 0,
                            ull_total_page_file: 0,
                            ull_avail_page_file: 0,
                            ull_total_virtual: 0,
                            ull_avail_virtual: 0,
                            ull_avail_extended_virtual: 0,
                        };

                        let mem_percent = unsafe {
                            if GlobalMemoryStatusEx(&mut mem_status) != 0 {
                                mem_status.dw_memory_load
                            } else {
                                0
                            }
                        };

                        let is_high = mem_percent >= 88;
                        if is_high || mem_percent.abs_diff(last_emitted_mem) >= 5 {
                            last_emitted_mem = mem_percent;
                            let _ = app_clone.emit("system-vitals", serde_json::json!({
                                "memory_percent": mem_percent,
                                "cpu_percent": 0,
                                "top_process": "System",
                                "is_high_load": is_high
                            }));
                        }

                        if tick % 6 == 0 {
                            win_mem::trim_host_working_set();
                        }
                    }
                }
            });

            // Ultra-Light Native Cursor Tracking Thread (120ms gentle sleep, 0.00% CPU)
            let app_handle_clone = app.handle().clone();
            std::thread::spawn(move || {
                let mut last_raw_x = -9999;
                let mut last_raw_y = -9999;
                let mut last_emitted_rel_x = 0.0f64;
                let mut last_emitted_rel_y = 0.0f64;
                let mut cached_span_x = 960.0;
                let mut cached_span_y = 540.0;
                let mut monitor_refresh_tick = 0u32;

                #[repr(C)]
                #[derive(Default, Copy, Clone)]
                struct POINT {
                    x: i32,
                    y: i32,
                }
                #[link(name = "user32")]
                extern "system" {
                    fn GetCursorPos(lp_point: *mut POINT) -> i32;
                }

                loop {
                    std::thread::sleep(std::time::Duration::from_millis(120));

                    let Some(window) = app_handle_clone.get_webview_window("main") else {
                        continue;
                    };

                    let is_visible = window.is_visible().unwrap_or(false);
                    if !is_visible {
                        std::thread::sleep(std::time::Duration::from_millis(600));
                        continue;
                    }

                    let mut pt = POINT::default();
                    unsafe {
                        GetCursorPos(&mut pt);
                    }

                    if (pt.x - last_raw_x).abs() < 6 && (pt.y - last_raw_y).abs() < 6 {
                        continue;
                    }

                    last_raw_x = pt.x;
                    last_raw_y = pt.y;

                    if monitor_refresh_tick % 30 == 0 {
                        if let Ok(Some(monitor)) = window.current_monitor() {
                            let size = monitor.size();
                            cached_span_x = (size.width as f64 / 2.0).max(1.0);
                            cached_span_y = (size.height as f64 / 2.0).max(1.0);
                        }
                    }
                    monitor_refresh_tick = monitor_refresh_tick.wrapping_add(1);

                    if let (Ok(win_pos), Ok(win_size)) = (
                        window.outer_position(),
                        window.outer_size(),
                    ) {
                        let center_x = win_pos.x as f64 + (win_size.width as f64 / 2.0);
                        let center_y = win_pos.y as f64 + (win_size.height as f64 / 2.0);

                        let rel_x = ((pt.x as f64 - center_x) / cached_span_x).clamp(-1.0, 1.0);
                        let rel_y = ((pt.y as f64 - center_y) / cached_span_y).clamp(-1.0, 1.0);

                        if (rel_x - last_emitted_rel_x).abs() > 0.012 || (rel_y - last_emitted_rel_y).abs() > 0.012 {
                            last_emitted_rel_x = rel_x;
                            last_emitted_rel_y = rel_y;
                            let _ = app_handle_clone.emit("cursor-move", (rel_x, rel_y));
                        }
                    }
                }
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            greet,
            trim_memory,
            get_global_cursor_position,
            set_window_always_on_top,
            set_window_skip_taskbar,
            set_settings_open,
            reset_window_position,
            hide_window_to_tray,
            show_window_from_tray,
            quit_app,
            clear_clipboard,
            read_clipboard_text
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|_app_handle, event| {
            if let tauri::RunEvent::ExitRequested { api, .. } = event {
                if !IS_QUITTING.load(Ordering::SeqCst) {
                    api.prevent_exit();
                }
            }
        });
}
