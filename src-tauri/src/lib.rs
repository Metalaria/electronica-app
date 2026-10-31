//! Tauri shell of the reader. All the logic lives in the web front end; the native side
//! only provides the window and the persistent key-value store for the reader's
//! personal data (positions, bookmarks, notes and preferences) and the opener that shows
//! the release page of a new version in the system browser. On Android (and iOS) it also
//! registers haptics (vibration feedback) and notifications (the daily reminder, 0.11).

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_opener::init());
    // The mobile plugins are target-specific dependencies (see Cargo.toml).
    #[cfg(any(target_os = "android", target_os = "ios"))]
    let builder = builder
        .plugin(tauri_plugin_haptics::init())
        .plugin(tauri_plugin_notification::init());
    builder
        .run(tauri::generate_context!())
        .expect("error while running the application");
}
