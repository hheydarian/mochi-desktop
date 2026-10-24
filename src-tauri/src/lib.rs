use std::sync::atomic::{AtomicI32, Ordering};
use std::sync::Mutex;
use tauri::{
    menu::{CheckMenuItem, Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Emitter, Manager,
};

static LAST_RAW_CURSOR_X: AtomicI32 = AtomicI32::new(-9999);
static LAST_RAW_CURSOR_Y: AtomicI32 = AtomicI32::new(-9999);
static CACHED_REL_POS: Mutex<(f64, f64)> = Mutex::new((0.0, 0.0));
static SETTINGS_OPEN_SIDE: Mutex<Option<String>> = Mutex::new(None);

#[cfg(target_os = "windows")]
mod win_mem {
    use std::ffi::c_void;

    #[repr(C)]
    struct PROCESSENTRY32W {
        dw_size: u32,
        cnt_usage: u32,
        th32_process_id: u32,
        th32_default_heap_id: usize,
        th32_module_id: u32,
        cnt_threads: u32,
        th32_parent_process_id: u32,
        pc_pri_class_base: i32,
        dw_flags: u32,
        sz_exe_file: [u16; 260],
    }

    #[link(name = "kernel32")]
    extern "system" {
        fn GetCurrentProcess() -> *mut c_void;
        fn GetCurrentProcessId() -> u32;
        fn SetProcessWorkingSetSize(h_process: *mut c_void, dw_minimum_working_set_size: usize, dw_maximum_working_set_size: usize) -> i32;
        fn CreateToolhelp32Snapshot(dw_flags: u32, th32_process_id: u32) -> *mut c_void;
        fn Process32FirstW(h_snapshot: *mut c_void, lppe: *mut PROCESSENTRY32W) -> i32;
        fn Process32NextW(h_snapshot: *mut c_void, lppe: *mut PROCESSENTRY32W) -> i32;
        fn OpenProcess(dw_desired_access: u32, b_inherit_handle: i32, dw_process_id: u32) -> *mut c_void;
        fn CloseHandle(h_object: *mut c_void) -> i32;
    }

    /// Trims memory working set of Mochi and all child WebView2 helper processes
    pub fn trim_all_working_sets() {
        unsafe {
            let my_pid = GetCurrentProcessId();
            let my_handle = GetCurrentProcess();
            // Trim our own working set
            SetProcessWorkingSetSize(my_handle, usize::MAX, usize::MAX);

            // Also trim any child processes (msedgewebview2.exe, conhost.exe)
            let snapshot = CreateToolhelp32Snapshot(0x00000002, 0); // TH32CS_SNAPPROCESS
            if !snapshot.is_null() && snapshot as isize != -1 {
                let mut entry = PROCESSENTRY32W {
                    dw_size: std::mem::size_of::<PROCESSENTRY32W>() as u32,
                    cnt_usage: 0,
                    th32_process_id: 0,
                    th32_default_heap_id: 0,
                    th32_module_id: 0,
                    cnt_threads: 0,
                    th32_parent_process_id: 0,
                    pc_pri_class_base: 0,
                    dw_flags: 0,
                    sz_exe_file: [0; 260],
                };

                if Process32FirstW(snapshot, &mut entry) != 0 {
                    loop {
                        if entry.th32_parent_process_id == my_pid {
                            // PROCESS_SET_QUOTA (0x0100) | PROCESS_QUERY_LIMITED_INFORMATION (0x1000)
                            let child_handle = OpenProcess(0x0100 | 0x1000, 0, entry.th32_process_id);
                            if !child_handle.is_null() {
                                SetProcessWorkingSetSize(child_handle, usize::MAX, usize::MAX);
                                CloseHandle(child_handle);
                            }
                        }
                        if Process32NextW(snapshot, &mut entry) == 0 {
                            break;
                        }
                    }
                }
                CloseHandle(snapshot);
            }
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
    win_mem::trim_all_working_sets();
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

        // Deadzone Filtering: if cursor hasn't moved beyond 3 pixels, return cached relative position
        let last_x = LAST_RAW_CURSOR_X.load(Ordering::Relaxed);
        let last_y = LAST_RAW_CURSOR_Y.load(Ordering::Relaxed);

        if (pt.x - last_x).abs() < 3 && (pt.y - last_y).abs() < 3 {
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
    win_mem::trim_all_working_sets();
    Ok(())
}

#[tauri::command]
fn show_window_from_tray(window: tauri::Window, app: tauri::AppHandle) -> Result<(), String> {
    let _ = app.emit("window-visibility-changed", true);
    window.show().map_err(|e| e.to_string())?;
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
    let screen_h = screen_size.height as i32;

    let current_pos = window.outer_position().map_err(|e| e.to_string())?;
    let current_size = window.outer_size().map_err(|e| e.to_string())?;
    let current_logical_w = current_size.width as f64 / scale;

    if open {
        let new_w = (560.0 * scale) as i32;
        let new_h = (360.0 * scale) as i32;
        let shift_w = (320.0 * scale) as i32;
        let shift_h = (100.0 * scale) as i32;

        let mochi_center_x = current_pos.x + (current_size.width as i32 / 2);
        let is_left_side = mochi_center_x < (screen_w / 2);

        let (mut new_x, side) = if is_left_side {
            // Mochi is on left side of monitor -> open panel to the RIGHT of Mochi
            (current_pos.x, "right")
        } else {
            // Mochi is on right side of monitor -> open panel to the LEFT of Mochi
            (current_pos.x - shift_w, "left")
        };

        let mut new_y = current_pos.y - shift_h;

        // Mandatory Clamping: window MUST never clip beyond any screen edge
        let min_x = (12.0 * scale) as i32;
        let max_x = (screen_w - new_w - (12.0 * scale) as i32).max(min_x);
        new_x = new_x.clamp(min_x, max_x);

        let min_y = (12.0 * scale) as i32;
        let max_y = (screen_h - new_h - (48.0 * scale) as i32).max(min_y);
        new_y = new_y.clamp(min_y, max_y);

        if let Ok(mut saved_side) = SETTINGS_OPEN_SIDE.lock() {
            *saved_side = Some(side.to_string());
        }

        window
            .set_size(tauri::Size::Physical(tauri::PhysicalSize {
                width: new_w as u32,
                height: new_h as u32,
            }))
            .map_err(|e| e.to_string())?;
        window
            .set_position(tauri::Position::Physical(tauri::PhysicalPosition {
                x: new_x,
                y: new_y,
            }))
            .map_err(|e| e.to_string())?;

        return Ok(side.to_string());
    } else {
        // Collapsing back to normal 240x260
        let new_w = (240.0 * scale) as i32;
        let new_h = (260.0 * scale) as i32;
        let shift_w = (320.0 * scale) as i32;
        let shift_h = (100.0 * scale) as i32;

        let previous_side = SETTINGS_OPEN_SIDE.lock().ok().and_then(|s| s.clone());

        let mut new_x = if current_logical_w >= 400.0 {
            if previous_side.as_deref() == Some("left") {
                current_pos.x + shift_w
            } else {
                current_pos.x
            }
        } else {
            current_pos.x
        };

        let mut new_y = if current_logical_w >= 400.0 {
            current_pos.y + shift_h
        } else {
            current_pos.y
        };

        // Clamp collapsed window within screen bounds
        let min_x = (4.0 * scale) as i32;
        let max_x = (screen_w - new_w - (4.0 * scale) as i32).max(min_x);
        new_x = new_x.clamp(min_x, max_x);

        let min_y = (4.0 * scale) as i32;
        let max_y = (screen_h - new_h - (4.0 * scale) as i32).max(min_y);
        new_y = new_y.clamp(min_y, max_y);

        if let Ok(mut saved_side) = SETTINGS_OPEN_SIDE.lock() {
            *saved_side = None;
        }

        window
            .set_size(tauri::Size::Physical(tauri::PhysicalSize {
                width: new_w as u32,
                height: new_h as u32,
            }))
            .map_err(|e| e.to_string())?;
        window
            .set_position(tauri::Position::Physical(tauri::PhysicalPosition {
                x: new_x,
                y: new_y,
            }))
            .map_err(|e| e.to_string())?;

        #[cfg(target_os = "windows")]
        win_mem::trim_all_working_sets();

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

    // Reset size to 240x260 if expanded
    let new_w = (240.0 * scale) as i32;
    let new_h = (260.0 * scale) as i32;
    let margin_x = (4.0 * scale) as i32;
    let margin_y = (4.0 * scale) as i32;
    let x = screen_size.width as i32 - new_w - margin_x;
    let y = screen_size.height as i32 - new_h - margin_y;

    if let Ok(mut saved_side) = SETTINGS_OPEN_SIDE.lock() {
        *saved_side = None;
    }

    let _ = window.set_size(tauri::Size::Physical(tauri::PhysicalSize {
        width: new_w as u32,
        height: new_h as u32,
    }));
    window
        .set_position(tauri::Position::Physical(tauri::PhysicalPosition { x, y }))
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn quit_app(app: tauri::AppHandle) {
    app.exit(0);
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Ultra-Low RAM & Low-Power Chromium Tuning for WebView2:
    // Disables unused services, caps renderer processes, and sets tight V8 memory limits
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
             --js-flags=--max-old-space-size=64",
        );
    }

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .on_window_event(|window, event| {
            // Intercept window close request -> Hide to System Tray instead of killing app process!
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window.app_handle().emit("window-visibility-changed", false);
                let _ = window.hide();
                #[cfg(target_os = "windows")]
                win_mem::trim_all_working_sets();
            }
        })
        .setup(|app| {
            // Position window initially at bottom-right corner of screen (4px margin from right & taskbar)
            if let Some(window) = app.get_webview_window("main") {
                if let Ok(Some(monitor)) = window.current_monitor() {
                    let screen_size = monitor.size();
                    let scale_factor = monitor.scale_factor();
                    let win_width = (240.0 * scale_factor) as i32;
                    let win_height = (260.0 * scale_factor) as i32;
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
                                        win_mem::trim_all_working_sets();
                                    } else {
                                        let _ = window.show();
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
                                let _ = window.set_focus();
                                let _ = app.emit("window-visibility-changed", true);
                            }
                            let _ = app.emit("open-settings", ());
                        }
                        "quit" => {
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
                            let _ = window.set_focus();
                            let _ = app.emit("window-visibility-changed", true);
                        }
                    }
                })
                .build(app)?;

            // Initial memory trim after 3 seconds of startup
            std::thread::spawn(|| {
                std::thread::sleep(std::time::Duration::from_secs(3));
                #[cfg(target_os = "windows")]
                win_mem::trim_all_working_sets();
            });

            // Ultra-Light Native Cursor Tracking Thread with Adaptive Governor:
            // Sinks CPU wakeups to 0.00% when mouse is idle!
            let app_handle_clone = app.handle().clone();
            std::thread::spawn(move || {
                let mut last_raw_x = -9999;
                let mut last_raw_y = -9999;
                let mut cached_span_x = 960.0;
                let mut cached_span_y = 540.0;
                let mut monitor_refresh_tick = 0u32;
                let mut still_ticks = 0u32;

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
                    let sleep_ms = if still_ticks > 60 {
                        100 // Idle for > 1.5s: 10Hz poll (0.00% CPU)
                    } else if still_ticks > 20 {
                        50  // Idle for > 0.5s: 20Hz poll
                    } else {
                        25  // Active movement: 40Hz poll for instant head tracking
                    };

                    std::thread::sleep(std::time::Duration::from_millis(sleep_ms));

                    let Some(window) = app_handle_clone.get_webview_window("main") else {
                        continue;
                    };

                    let is_visible = window.is_visible().unwrap_or(false);
                    if !is_visible {
                        std::thread::sleep(std::time::Duration::from_millis(500));
                        continue;
                    }

                    let mut pt = POINT::default();
                    unsafe {
                        GetCursorPos(&mut pt);
                    }

                    // Deadzone check: if cursor moved < 4px, treat as still
                    if (pt.x - last_raw_x).abs() < 4 && (pt.y - last_raw_y).abs() < 4 {
                        still_ticks = still_ticks.saturating_add(1);

                        // Periodically trim memory every 30s of stillness
                        if still_ticks % 300 == 0 {
                            #[cfg(target_os = "windows")]
                            win_mem::trim_all_working_sets();
                        }
                        continue;
                    }

                    // Movement detected!
                    still_ticks = 0;
                    last_raw_x = pt.x;
                    last_raw_y = pt.y;

                    // Refresh monitor dimensions only once every 80 ticks (~2s)
                    if monitor_refresh_tick % 80 == 0 {
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

                        let _ = app_handle_clone.emit("cursor-move", (rel_x, rel_y));
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
            quit_app
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
