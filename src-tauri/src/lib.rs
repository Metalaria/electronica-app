//! Tauri shell of the reader. All the logic lives in the web front end; the native side
//! only provides the window and the persistent key-value store for the reader's
//! personal data (positions, bookmarks, notes and preferences).

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::new().build())
        .run(tauri::generate_context!())
        .expect("error while running the application");
}
