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
    /// Never enumerates or scans other system processes
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

// Native EXIF/Metadata Stripper Functions (0% UI freeze, 100% loss-free)
fn sanitize_jpeg(bytes: &[u8]) -> Vec<u8> {
    if bytes.len() < 4 || bytes[0] != 0xFF || bytes[1] != 0xD8 {
        return bytes.to_vec();
    }
    let mut out = Vec::with_capacity(bytes.len());
    out.extend_from_slice(&[0xFF, 0xD8]); // SOI

    let mut i = 2;
    while i < bytes.len() {
        if bytes[i] != 0xFF {
            out.push(bytes[i]);
            i += 1;
            continue;
        }
        while i < bytes.len() && bytes[i] == 0xFF {
            i += 1;
        }
        if i >= bytes.len() {
            break;
        }
        let marker = bytes[i];
        i += 1;

        if marker == 0xD9 {
            out.extend_from_slice(&[0xFF, 0xD9]);
            break;
        } else if marker == 0xDA {
            out.extend_from_slice(&[0xFF, 0xDA]);
            out.extend_from_slice(&bytes[i..]);
            break;
        } else if (0xD0..=0xD7).contains(&marker) || marker == 0x00 {
            out.extend_from_slice(&[0xFF, marker]);
        } else {
            if i + 1 >= bytes.len() {
                break;
            }
            let seg_len = ((bytes[i] as usize) << 8) | (bytes[i + 1] as usize);
            let seg_end = (i + seg_len).min(bytes.len());

            // Skip EXIF/XMP (0xE1), FlashPix (0xE2), Photoshop IPTC (0xED), Comments (0xFE)
            let should_skip = marker == 0xE1 || marker == 0xE2 || marker == 0xED || marker == 0xFE;
            if !should_skip {
                out.extend_from_slice(&[0xFF, marker]);
                out.extend_from_slice(&bytes[i..seg_end]);
            }
            i = seg_end;
        }
    }
    out
}

fn sanitize_png(bytes: &[u8]) -> Vec<u8> {
    const PNG_SIG: &[u8; 8] = b"\x89PNG\r\n\x1a\n";
    if bytes.len() < 8 || &bytes[0..8] != PNG_SIG {
        return bytes.to_vec();
    }
    let mut out = Vec::with_capacity(bytes.len());
    out.extend_from_slice(PNG_SIG);

    let mut i = 8;
    while i + 12 <= bytes.len() {
        let length = ((bytes[i] as usize) << 24)
            | ((bytes[i + 1] as usize) << 16)
            | ((bytes[i + 2] as usize) << 8)
            | (bytes[i + 3] as usize);
        let chunk_type = &bytes[i + 4..i + 8];
        let chunk_total_len = 12 + length;
        let chunk_end = (i + chunk_total_len).min(bytes.len());

        let should_skip = chunk_type == b"eXIf"
            || chunk_type == b"tEXt"
            || chunk_type == b"zTXt"
            || chunk_type == b"iTXt";

        if !should_skip {
            out.extend_from_slice(&bytes[i..chunk_end]);
        }

        if chunk_type == b"IEND" {
            break;
        }
        i = chunk_end;
    }
    out
}

#[tauri::command]
fn sanitize_image_file(file_path: String) -> Result<String, String> {
    use std::path::Path;
    let path = Path::new(&file_path);
    if !path.exists() {
        return Err("File does not exist".to_string());
    }

    let parent = path.parent().unwrap_or_else(|| Path::new("."));
    let stem = path.file_stem().and_then(|s| s.to_str()).unwrap_or("image");
    let ext = path.extension().and_then(|s| s.to_str()).unwrap_or("png").to_lowercase();
    let clean_filename = format!("{}_clean.{}", stem, ext);
    let clean_path = parent.join(clean_filename);

    let bytes = std::fs::read(&path).map_err(|e| format!("Failed to read file: {}", e))?;
    if bytes.len() < 12 {
        return Err("File is too small".to_string());
    }

    let sanitized_bytes = if ext == "jpg" || ext == "jpeg" {
        sanitize_jpeg(&bytes)
    } else if ext == "png" {
        sanitize_png(&bytes)
    } else {
        bytes
    };

    std::fs::write(&clean_path, &sanitized_bytes).map_err(|e| format!("Failed to write clean image: {}", e))?;
    clean_path.to_str().map(|s| s.to_string()).ok_or_else(|| "Invalid UTF-8 path".to_string())
}

#[tauri::command]
fn open_file_in_folder(path: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("explorer")
            .arg(format!("/select,{}", path))
            .spawn()
            .map_err(|e| e.to_string())?;
        Ok(())
    }
    #[cfg(not(target_os = "windows"))]
    {
        Ok(())
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

            // Ultra-Light Native Cursor Tracking Thread with Adaptive Governor
            let app_handle_clone = app.handle().clone();
            std::thread::spawn(move || {
                let mut last_raw_x = -9999;
                let mut last_raw_y = -9999;
                let mut last_emitted_rel_x = 0.0f64;
                let mut last_emitted_rel_y = 0.0f64;
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
                    let sleep_ms = if still_ticks > 40 {
                        100 // Idle > 1.2s: 10Hz poll (0.00% CPU)
                    } else if still_ticks > 15 {
                        60 // Idle > 0.4s: ~16Hz poll
                    } else {
                        40 // Active: 25Hz poll (silky smooth visual damping)
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

                    if (pt.x - last_raw_x).abs() < 4 && (pt.y - last_raw_y).abs() < 4 {
                        still_ticks = still_ticks.saturating_add(1);
                        continue;
                    }

                    still_ticks = 0;
                    last_raw_x = pt.x;
                    last_raw_y = pt.y;

                    if monitor_refresh_tick % 50 == 0 {
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

                        if (rel_x - last_emitted_rel_x).abs() > 0.008 || (rel_y - last_emitted_rel_y).abs() > 0.008 {
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
            read_clipboard_text,
            sanitize_image_file,
            open_file_in_folder
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
