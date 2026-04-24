//! OpenDesign Studio — Tauri 2 desktop shell entry point.
//!
//! The shell is intentionally thin: it loads the Next.js Studio origin
//! (either dev at `http://127.0.0.1:3005` or whatever `OPENDESIGN_STUDIO_URL`
//! is set to at build / runtime) and installs a minimal native menu.

use tauri::{
    menu::{AboutMetadata, Menu, MenuItem, PredefinedMenuItem, Submenu},
    webview::WebviewWindowBuilder,
    AppHandle, Manager, Url, WebviewUrl, WindowEvent,
};

/// Default origin used when `OPENDESIGN_STUDIO_URL` is not set.
const DEFAULT_STUDIO_URL: &str = "http://127.0.0.1:3005";

/// Resolve the Studio origin from the environment, falling back to the dev default.
fn studio_url() -> String {
    std::env::var("OPENDESIGN_STUDIO_URL").unwrap_or_else(|_| DEFAULT_STUDIO_URL.to_string())
}

/// Build the native application menu.
///
/// File        — New Window, Close Window, Quit
/// Edit        — Cut / Copy / Paste / Select All
/// View        — Reload, Force Reload, Toggle Dev Tools, Toggle Full Screen
/// Window      — Minimize, Zoom
/// Help        — Learn More (links to the repo)
fn build_menu(app: &AppHandle) -> tauri::Result<Menu<tauri::Wry>> {
    // ----- File -----
    let new_window = MenuItem::with_id(app, "file:new_window", "New Window", true, Some("CmdOrCtrl+N"))?;
    let close_window = MenuItem::with_id(app, "file:close_window", "Close Window", true, Some("CmdOrCtrl+W"))?;
    let quit = PredefinedMenuItem::quit(app, None)?;

    let file_menu = Submenu::with_items(
        app,
        "File",
        true,
        &[
            &new_window,
            &close_window,
            &PredefinedMenuItem::separator(app)?,
            &quit,
        ],
    )?;

    // ----- Edit -----
    let edit_menu = Submenu::with_items(
        app,
        "Edit",
        true,
        &[
            &PredefinedMenuItem::undo(app, None)?,
            &PredefinedMenuItem::redo(app, None)?,
            &PredefinedMenuItem::separator(app)?,
            &PredefinedMenuItem::cut(app, None)?,
            &PredefinedMenuItem::copy(app, None)?,
            &PredefinedMenuItem::paste(app, None)?,
            &PredefinedMenuItem::select_all(app, None)?,
        ],
    )?;

    // ----- View -----
    let reload = MenuItem::with_id(app, "view:reload", "Reload", true, Some("CmdOrCtrl+R"))?;
    let force_reload = MenuItem::with_id(
        app,
        "view:force_reload",
        "Force Reload",
        true,
        Some("CmdOrCtrl+Shift+R"),
    )?;
    let toggle_devtools = MenuItem::with_id(
        app,
        "view:toggle_devtools",
        "Toggle Developer Tools",
        true,
        Some("Alt+CmdOrCtrl+I"),
    )?;
    let toggle_fullscreen = MenuItem::with_id(
        app,
        "view:toggle_fullscreen",
        "Toggle Full Screen",
        true,
        Some("Ctrl+CmdOrCtrl+F"),
    )?;

    let view_menu = Submenu::with_items(
        app,
        "View",
        true,
        &[&reload, &force_reload, &PredefinedMenuItem::separator(app)?, &toggle_devtools, &toggle_fullscreen],
    )?;

    // ----- Window -----
    let window_menu = Submenu::with_items(
        app,
        "Window",
        true,
        &[
            &PredefinedMenuItem::minimize(app, None)?,
            &PredefinedMenuItem::maximize(app, None)?,
        ],
    )?;

    // ----- Help -----
    let learn_more = MenuItem::with_id(app, "help:learn_more", "Learn More", true, None::<&str>)?;
    let about = PredefinedMenuItem::about(app, Some("About OpenDesign Studio"), Some(AboutMetadata::default()))?;

    let help_menu = Submenu::with_items(app, "Help", true, &[&learn_more, &about])?;

    Menu::with_items(app, &[&file_menu, &edit_menu, &view_menu, &window_menu, &help_menu])
}

/// Handle menu clicks.
fn handle_menu_event(app: &AppHandle, event_id: &str) {
    match event_id {
        "file:new_window" => {
            if let Err(err) = open_new_window(app) {
                eprintln!("[opendesign-studio] failed to open new window: {err}");
            }
        }
        "file:close_window" => {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.close();
            }
        }
        "view:reload" | "view:force_reload" => {
            if let Some(window) = app.get_webview_window("main") {
                if let Ok(url) = Url::parse(&studio_url()) {
                    let _ = window.navigate(url);
                }
            }
        }
        "view:toggle_devtools" => {
            #[cfg(any(debug_assertions, feature = "devtools"))]
            if let Some(window) = app.get_webview_window("main") {
                if window.is_devtools_open() {
                    window.close_devtools();
                } else {
                    window.open_devtools();
                }
            }
        }
        "view:toggle_fullscreen" => {
            if let Some(window) = app.get_webview_window("main") {
                let is_full = window.is_fullscreen().unwrap_or(false);
                let _ = window.set_fullscreen(!is_full);
            }
        }
        "help:learn_more" => {
            let _ = tauri_plugin_opener::open_url("https://github.com/opendesign/opendesign", None::<&str>);
        }
        _ => {}
    }
}

/// Open an additional window pointed at the Studio origin.
fn open_new_window(app: &AppHandle) -> tauri::Result<()> {
    let url = studio_url();
    let parsed = Url::parse(&url).map_err(|_| tauri::Error::InvalidWebviewUrl("invalid studio URL"))?;
    let label = format!("secondary-{}", app.webview_windows().len());

    WebviewWindowBuilder::new(app, &label, WebviewUrl::External(parsed))
        .title("OpenDesign Studio")
        .inner_size(1440.0, 900.0)
        .min_inner_size(1024.0, 720.0)
        .center()
        .build()?;

    Ok(())
}

/// Entry point invoked by `main.rs`.
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let handle = app.handle().clone();
            let menu = build_menu(&handle)?;
            app.set_menu(menu)?;

            // On macOS we route menu clicks through the global app handler.
            app.on_menu_event(move |app, event| {
                handle_menu_event(app, event.id().as_ref());
            });

            // If `OPENDESIGN_STUDIO_URL` is set, navigate the main window to it
            // so that production builds and alternate dev targets work without
            // rebuilding `tauri.conf.json`.
            if let Ok(custom_url) = std::env::var("OPENDESIGN_STUDIO_URL") {
                if let Some(window) = app.get_webview_window("main") {
                    if let Ok(parsed) = Url::parse(&custom_url) {
                        let _ = window.navigate(parsed);
                    }
                }
            }

            Ok(())
        })
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { .. } = event {
                // Default close behaviour; hook retained for future use (confirm-on-quit, etc.).
                let _ = window.label();
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running OpenDesign Studio");
}
