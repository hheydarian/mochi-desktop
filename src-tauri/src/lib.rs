use tauri::{
    menu::{CheckMenuItem, Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Emitter, Manager,
};

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
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

            // Normalized relative vector (-1.0 to 1.0) pointing towards cursor from window center
            let rel_x = ((pt.x as f64 - center_x) / span_x).clamp(-1.0, 1.0);
            let rel_y = ((pt.y as f64 - center_y) / span_y).clamp(-1.0, 1.0);

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
fn set_settings_open(window: tauri::Window, open: bool) -> Result<(), String> {
    let monitor = window
        .current_monitor()
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "No monitor found".to_string())?;
    let scale = monitor.scale_factor();
    let current_pos = window.outer_position().map_err(|e| e.to_string())?;
    let current_size = window.outer_size().map_err(|e| e.to_string())?;

    let current_logical_w = current_size.width as f64 / scale;

    if open {
        if current_logical_w < 400.0 {
            let new_w = (560.0 * scale) as u32;
            let new_h = (360.0 * scale) as u32;
            let shift_x = (320.0 * scale) as i32;
            let shift_y = (100.0 * scale) as i32;
            let new_x = current_pos.x - shift_x;
            let new_y = current_pos.y - shift_y;

            window
                .set_size(tauri::Size::Physical(tauri::PhysicalSize {
                    width: new_w,
                    height: new_h,
                }))
                .map_err(|e| e.to_string())?;
            window
                .set_position(tauri::Position::Physical(tauri::PhysicalPosition {
                    x: new_x,
                    y: new_y,
                }))
                .map_err(|e| e.to_string())?;
        }
    } else if current_logical_w >= 400.0 {
        let new_w = (240.0 * scale) as u32;
        let new_h = (260.0 * scale) as u32;
        let shift_x = (320.0 * scale) as i32;
        let shift_y = (100.0 * scale) as i32;
        let new_x = current_pos.x + shift_x;
        let new_y = current_pos.y + shift_y;

        window
            .set_size(tauri::Size::Physical(tauri::PhysicalSize {
                width: new_w,
                height: new_h,
            }))
            .map_err(|e| e.to_string())?;
        window
            .set_position(tauri::Position::Physical(tauri::PhysicalPosition {
                x: new_x,
                y: new_y,
            }))
            .map_err(|e| e.to_string())?;
    }

    Ok(())
}

#[tauri::command]
fn reset_window_position(window: tauri::Window) -> Result<(), String> {
    let monitor = window
        .current_monitor()
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "No monitor found".to_string())?;
    let screen_size = monitor.size();
    let scale = monitor.scale_factor();
    let current_size = window.outer_size().map_err(|e| e.to_string())?;

    let margin_x = (4.0 * scale) as i32;
    let margin_y = (4.0 * scale) as i32;
    let x = screen_size.width as i32 - current_size.width as i32 - margin_x;
    let y = screen_size.height as i32 - current_size.height as i32 - margin_y;

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
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            // 1. Position window at bottom-right corner of screen (4px from right, 4px from taskbar)
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

            // 2. Setup System Tray with Right-Click Context Menu
            let show_hide_item = MenuItem::with_id(app, "show_hide", "Show / Hide Mochi", true, None::<&str>)?;
            let always_on_top_item = CheckMenuItem::with_id(app, "always_on_top", "Always on Top", true, true, None::<&str>)?;
            let settings_item = MenuItem::with_id(app, "settings", "Open Settings", true, None::<&str>)?;
            let quit_item = MenuItem::with_id(app, "quit", "Quit Mochi", true, None::<&str>)?;

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
                                        let _ = window.hide();
                                    } else {
                                        let _ = window.show();
                                        let _ = window.set_focus();
                                    }
                                }
                            }
                        }
                        "always_on_top" => {
                            let _ = app.emit("toggle-always-on-top", ());
                        }
                        "settings" => {
                            let _ = app.emit("open-settings", ());
                            if let Some(window) = app.get_webview_window("main") {
                                let _ = window.show();
                                let _ = window.set_focus();
                            }
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
                        }
                    }
                })
                .build(app)?;

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            greet,
            get_global_cursor_position,
            set_window_always_on_top,
            set_window_skip_taskbar,
            set_settings_open,
            reset_window_position,
            quit_app
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
