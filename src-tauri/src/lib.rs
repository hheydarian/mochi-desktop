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
        fn SetProcessWorkingSetSize(
            h_process: *mut c_void,
            dw_minimum_working_set_size: usize,
            dw_maximum_working_set_size: usize,
        ) -> i32;
        fn CreateToolhelp32Snapshot(dw_flags: u32, th32_process_id: u32) -> *mut c_void;
        fn Process32FirstW(h_snapshot: *mut c_void, lppe: *mut PROCESSENTRY32W) -> i32;
        fn Process32NextW(h_snapshot: *mut c_void, lppe: *mut PROCESSENTRY32W) -> i32;
        fn OpenProcess(dw_desired_access: u32, b_inherit_handle: i32, dw_process_id: u32) -> *mut c_void;
        fn CloseHandle(h_object: *mut c_void) -> i32;
        fn GetProcessHeap() -> *mut c_void;
        fn HeapCompact(h_heap: *mut c_void, dw_flags: u32) -> usize;
        fn K32EmptyWorkingSet(h_process: *mut c_void) -> i32;
    }

    /// Trims memory working set of Mochi and ALL descendant WebView2 helper processes
    /// Discovers parent-child-grandchild trees (browser, renderer, GPU, utilities)
    pub fn trim_all_working_sets() {
        unsafe {
            let my_pid = GetCurrentProcessId();
            let my_handle = GetCurrentProcess();

            // 1. Compact host default heap to coalesce and release committed blocks
            let heap = GetProcessHeap();
            if !heap.is_null() {
                HeapCompact(heap, 0);
            }

            // 2. Aggressively empty host process working set (sub-1MB physical footprint)
            K32EmptyWorkingSet(my_handle);
            SetProcessWorkingSetSize(my_handle, usize::MAX, usize::MAX);

            // 3. Discover all descendants (child, grandchild e.g. WebView2 browser, renderer, GPU)
            let snapshot = CreateToolhelp32Snapshot(0x00000002, 0); // TH32CS_SNAPPROCESS
            if !snapshot.is_null() && snapshot as isize != -1 {
                let mut all_entries = Vec::with_capacity(128);
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
                        all_entries.push((entry.th32_process_id, entry.th32_parent_process_id));
                        if Process32NextW(snapshot, &mut entry) == 0 {
                            break;
                        }
                    }
                }
                CloseHandle(snapshot);

                // Recursively collect all descendant PIDs
                let mut descendant_pids = std::collections::HashSet::new();
                descendant_pids.insert(my_pid);

                let mut added = true;
                while added {
                    added = false;
                    for &(pid, parent_pid) in &all_entries {
                        if descendant_pids.contains(&parent_pid) && !descendant_pids.contains(&pid) {
                            descendant_pids.insert(pid);
                            added = true;
                        }
                    }
                }

                // Trim each child and grandchild process safely with SetProcessWorkingSetSize
                // Note: We do NOT force K32EmptyWorkingSet on child GPU/renderer processes to prevent D3D11 swapchain loss
                for pid in descendant_pids {
                    if pid == my_pid {
                        continue;
                    }
                    // PROCESS_SET_QUOTA (0x0100) | PROCESS_QUERY_LIMITED_INFORMATION (0x1000)
                    let child_handle = OpenProcess(0x0100 | 0x1000, 0, pid);
                    if !child_handle.is_null() {
                        SetProcessWorkingSetSize(child_handle, usize::MAX, usize::MAX);
                        CloseHandle(child_handle);
                    }
                }
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

// Base64 encode helper
fn base64_encode(data: &[u8]) -> String {
    const TABLE: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let mut result = String::with_capacity((data.len() + 2) / 3 * 4);
    for chunk in data.chunks(3) {
        let b0 = chunk[0];
        let b1 = if chunk.len() > 1 { chunk[1] } else { 0 };
        let b2 = if chunk.len() > 2 { chunk[2] } else { 0 };

        result.push(TABLE[(b0 >> 2) as usize] as char);
        result.push(TABLE[(((b0 & 0x03) << 4) | (b1 >> 4)) as usize] as char);
        if chunk.len() > 1 {
            result.push(TABLE[(((b1 & 0x0F) << 2) | (b2 >> 6)) as usize] as char);
        } else {
            result.push('=');
        }
        if chunk.len() > 2 {
            result.push(TABLE[(b2 & 0x3F) as usize] as char);
        } else {
            result.push('=');
        }
    }
    result
}

// Base64 decode helper
fn base64_decode(input: &str) -> Result<Vec<u8>, String> {
    const TABLE: [i8; 256] = {
        let mut t = [-1i8; 256];
        let chars = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
        let mut i = 0;
        while i < 64 {
            t[chars[i] as usize] = i as i8;
            i += 1;
        }
        t
    };

    let bytes = input.as_bytes();
    let mut out = Vec::with_capacity(bytes.len() * 3 / 4);
    let mut buf = 0u32;
    let mut bits = 0u32;

    for &b in bytes {
        if b == b'=' || b == b'\r' || b == b'\n' || b == b' ' {
            continue;
        }
        let val = TABLE[b as usize];
        if val < 0 {
            continue;
        }
        buf = (buf << 6) | (val as u32);
        bits += 6;
        if bits >= 8 {
            bits -= 8;
            out.push((buf >> bits) as u8);
        }
    }
    Ok(out)
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
            // CF_UNICODETEXT = 13
            let handle = GetClipboardData(13);
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

#[cfg(target_os = "windows")]
mod frustration_monitor {
    use std::time::{Duration, Instant};
    use tauri::Emitter;

    #[link(name = "user32")]
    extern "system" {
        fn GetAsyncKeyState(v_key: i32) -> i16;
    }

    pub fn start_monitor(app_handle: tauri::AppHandle) {
        std::thread::spawn(move || {
            let mut backspace_times: Vec<Instant> = Vec::with_capacity(20);
            let mut was_down = false;
            let mut last_event_time = Instant::now() - Duration::from_secs(300);

            loop {
                std::thread::sleep(Duration::from_millis(40));

                // VK_BACK = 0x08
                let state = unsafe { GetAsyncKeyState(0x08) };
                let is_down = (state as u16 & 0x8000) != 0;

                if is_down && !was_down {
                    let now = Instant::now();
                    backspace_times.push(now);

                    // Retain presses within last 4.0 seconds
                    backspace_times.retain(|&t| now.duration_since(t) <= Duration::from_millis(4000));

                    // Trigger if > 10 bursts within 4 seconds and at least 2 minutes cooldown
                    if backspace_times.len() >= 10 && now.duration_since(last_event_time) > Duration::from_secs(120) {
                        last_event_time = now;
                        backspace_times.clear();
                        let _ = app_handle.emit("user-frustrated", ());
                    }
                }
                was_down = is_down;
            }
        });
    }
}

#[cfg(target_os = "windows")]
mod system_vitals {
    use std::ffi::c_void;
    use std::time::Duration;
    use serde::Serialize;
    use tauri::Emitter;

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

    #[repr(C)]
    #[derive(Default, Copy, Clone)]
    struct FILETIME {
        dw_low_date_time: u32,
        dw_high_date_time: u32,
    }

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

    #[repr(C)]
    struct PROCESS_MEMORY_COUNTERS {
        cb: u32,
        page_fault_count: u32,
        peak_working_set_size: usize,
        working_set_size: usize,
        quota_peak_paged_pool_usage: usize,
        quota_paged_pool_usage: usize,
        quota_peak_non_paged_pool_usage: usize,
        quota_non_paged_pool_usage: usize,
        pagefile_usage: usize,
        peak_pagefile_usage: usize,
    }

    #[link(name = "kernel32")]
    extern "system" {
        fn GlobalMemoryStatusEx(lp_buffer: *mut MEMORYSTATUSEX) -> i32;
        fn GetSystemTimes(lp_idle_time: *mut FILETIME, lp_kernel_time: *mut FILETIME, lp_user_time: *mut FILETIME) -> i32;
        fn CreateToolhelp32Snapshot(dw_flags: u32, th32_process_id: u32) -> *mut c_void;
        fn Process32FirstW(h_snapshot: *mut c_void, lppe: *mut PROCESSENTRY32W) -> i32;
        fn Process32NextW(h_snapshot: *mut c_void, lppe: *mut PROCESSENTRY32W) -> i32;
        fn OpenProcess(dw_desired_access: u32, b_inherit_handle: i32, dw_process_id: u32) -> *mut c_void;
        fn CloseHandle(h_object: *mut c_void) -> i32;
        fn K32GetProcessMemoryInfo(h_process: *mut c_void, ppsmst: *mut PROCESS_MEMORY_COUNTERS, cb: u32) -> i32;
    }

    #[derive(Serialize, Clone)]
    pub struct VitalsPayload {
        pub memory_percent: u32,
        pub cpu_percent: u32,
        pub top_process: String,
    }

    fn filetime_to_u64(ft: &FILETIME) -> u64 {
        ((ft.dw_high_date_time as u64) << 32) | (ft.dw_low_date_time as u64)
    }

    pub fn start_monitor(app_handle: tauri::AppHandle) {
        std::thread::spawn(move || {
            let mut prev_idle = FILETIME::default();
            let mut prev_kernel = FILETIME::default();
            let mut prev_user = FILETIME::default();

            unsafe {
                GetSystemTimes(&mut prev_idle, &mut prev_kernel, &mut prev_user);
            }

            loop {
                std::thread::sleep(Duration::from_secs(4));

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

                let mut idle = FILETIME::default();
                let mut kernel = FILETIME::default();
                let mut user = FILETIME::default();
                let mut cpu_percent = 0u32;

                unsafe {
                    if GetSystemTimes(&mut idle, &mut kernel, &mut user) != 0 {
                        let idle_diff = filetime_to_u64(&idle).saturating_sub(filetime_to_u64(&prev_idle));
                        let kernel_diff = filetime_to_u64(&kernel).saturating_sub(filetime_to_u64(&prev_kernel));
                        let user_diff = filetime_to_u64(&user).saturating_sub(filetime_to_u64(&prev_user));
                        let total_diff = kernel_diff + user_diff;

                        if total_diff > 0 {
                            let busy_diff = total_diff.saturating_sub(idle_diff);
                            cpu_percent = ((busy_diff * 100) / total_diff).min(100) as u32;
                        }

                        prev_idle = idle;
                        prev_kernel = kernel;
                        prev_user = user;
                    }
                }

                let mut top_proc_name = String::from("System");
                let mut max_ws = 0usize;

                unsafe {
                    let snapshot = CreateToolhelp32Snapshot(0x00000002, 0);
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
                                if entry.th32_process_id > 4 {
                                    let h_proc = OpenProcess(0x1000, 0, entry.th32_process_id);
                                    if !h_proc.is_null() {
                                        let mut pmc = PROCESS_MEMORY_COUNTERS {
                                            cb: std::mem::size_of::<PROCESS_MEMORY_COUNTERS>() as u32,
                                            page_fault_count: 0,
                                            peak_working_set_size: 0,
                                            working_set_size: 0,
                                            quota_peak_paged_pool_usage: 0,
                                            quota_paged_pool_usage: 0,
                                            quota_peak_non_paged_pool_usage: 0,
                                            quota_non_paged_pool_usage: 0,
                                            pagefile_usage: 0,
                                            peak_pagefile_usage: 0,
                                        };
                                        if K32GetProcessMemoryInfo(h_proc, &mut pmc, pmc.cb) != 0 {
                                            if pmc.working_set_size > max_ws {
                                                max_ws = pmc.working_set_size;
                                                let mut len = 0;
                                                while len < entry.sz_exe_file.len() && entry.sz_exe_file[len] != 0 {
                                                    len += 1;
                                                }
                                                top_proc_name = String::from_utf16_lossy(&entry.sz_exe_file[..len]);
                                            }
                                        }
                                        CloseHandle(h_proc);
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

                let payload = VitalsPayload {
                    memory_percent: mem_percent,
                    cpu_percent,
                    top_process: top_proc_name,
                };

                let _ = app_handle.emit("system-vitals", payload);
            }
        });
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

#[tauri::command]
fn read_image_base64(file_path: String) -> Result<String, String> {
    let bytes = std::fs::read(&file_path).map_err(|e| format!("Failed to read file: {}", e))?;
    Ok(base64_encode(&bytes))
}

#[tauri::command]
fn save_sanitized_image(original_path: String, base64_data: String) -> Result<String, String> {
    use std::path::Path;
    let path = Path::new(&original_path);
    let parent = path.parent().unwrap_or_else(|| Path::new("."));
    let stem = path.file_stem().and_then(|s| s.to_str()).unwrap_or("image");
    let ext = path.extension().and_then(|s| s.to_str()).unwrap_or("png");

    let clean_filename = format!("{}_clean.{}", stem, ext);
    let clean_path = parent.join(clean_filename);

    let clean_base64 = if let Some(idx) = base64_data.find(',') {
        &base64_data[idx + 1..]
    } else {
        &base64_data
    };

    let bytes = base64_decode(clean_base64).map_err(|e| format!("Decode failed: {}", e))?;
    std::fs::write(&clean_path, &bytes).map_err(|e| format!("Failed to write file: {}", e))?;

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
    // Ultra-Low RAM & Low-Power Chromium Tuning for WebView2:
    // Disables background telemetry/sync while preserving WebGL stability and preventing V8 heap runaway
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

            // Long-Term Memory Supervisor Thread:
            // Safe initial trim at 6 seconds (after WebGL models & shaders are fully loaded),
            // followed by periodic working-set purging every 45s regardless of user activity!
            std::thread::spawn(|| {
                std::thread::sleep(std::time::Duration::from_secs(6));
                #[cfg(target_os = "windows")]
                win_mem::trim_all_working_sets();

                loop {
                    std::thread::sleep(std::time::Duration::from_secs(45));
                    #[cfg(target_os = "windows")]
                    win_mem::trim_all_working_sets();
                }
            });

            // Ultra-Light Native Cursor Tracking Thread with Adaptive Governor:
            // Sinks CPU wakeups to 0.00% when mouse is idle and eliminates redundant IPC flooding!
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
                        90 // Idle > 1.2s: 11Hz poll (0.00% CPU)
                    } else if still_ticks > 15 {
                        50 // Idle > 0.4s: 20Hz poll
                    } else {
                        35 // Active movement: ~28Hz poll (smooth 60fps damped head tracking)
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
                        continue;
                    }

                    // Movement detected!
                    still_ticks = 0;
                    last_raw_x = pt.x;
                    last_raw_y = pt.y;

                    // Refresh monitor dimensions only once every 60 ticks (~2s)
                    if monitor_refresh_tick % 60 == 0 {
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

                        // Only emit IPC if relative cursor angle changed noticeably (> 0.006)
                        // Eliminates 80% of redundant IPC traffic while maintaining fluid visual tracking
                        if (rel_x - last_emitted_rel_x).abs() > 0.006 || (rel_y - last_emitted_rel_y).abs() > 0.006 {
                            last_emitted_rel_x = rel_x;
                            last_emitted_rel_y = rel_y;
                            let _ = app_handle_clone.emit("cursor-move", (rel_x, rel_y));
                        }
                    }
                }
            });

            // Start Frustration & System Vitals Monitors
            #[cfg(target_os = "windows")]
            frustration_monitor::start_monitor(app.handle().clone());

            #[cfg(target_os = "windows")]
            system_vitals::start_monitor(app.handle().clone());

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
            read_image_base64,
            save_sanitized_image,
            open_file_in_folder
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
