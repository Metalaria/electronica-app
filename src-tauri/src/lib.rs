//! Tauri shell of the reader. All the logic lives in the web front end; the native side
//! only provides the window and the persistent key-value store for the reader's
//! personal data (positions, bookmarks, notes and preferences), the opener that shows
//! the release page of a new version in the system browser, and (0.12) the backup export
//! and import: two commands of its own that show the system's save/open dialog and write
//! or read only the file chosen there (see `fichero` below). On Android (and iOS) it also registers haptics
//! (vibration feedback) and notifications (the daily reminder, 0.11). On desktop (0.12)
//! it keeps a single running instance and provides the signed automatic updates
//! (updater) and the relaunch after installing one (process).

#[cfg(desktop)]
use tauri::Manager;

/// The backup file the reader chooses in the system dialog (0.12). The front end gets no file-system or dialog
/// permission at all: tauri-plugin-fs 2.7.1 opens any `file://` (or, on Android, `content://`) URL without
/// checking its scope (commands.rs `resolve_file`), so `fs:allow-write-text-file` would let the webview write
/// anywhere. Here the path comes only from the dialog, in Rust, and is never seen by the webview. The dialog runs
/// through its blocking API on a blocking thread, never on the main thread. On Android the dialog gives a
/// `content://` URI (Storage Access Framework), which the fs plugin's `Fs::open` resolves through the content
/// resolver; on desktop it is a path.
mod fichero {
    use std::io::{Read, Write};
    use tauri::{AppHandle, Runtime};
    use tauri_plugin_dialog::{DialogExt, FilePath};
    use tauri_plugin_fs::{FsExt, OpenOptions};

    /// A backup bigger than this is not one of ours (they are a few MB at most).
    const MAXIMO: u64 = 50 * 1024 * 1024;

    #[derive(serde::Serialize)]
    pub struct Elegido {
        nombre: String,
        texto: String,
    }

    /// Decodes `%XX` escapes of a URI segment (invalid ones are kept as they are).
    fn sin_escapes(s: &str) -> String {
        let b = s.as_bytes();
        let mut out = Vec::with_capacity(b.len());
        let mut i = 0;
        let hex = |c: u8| (c as char).to_digit(16).map(|d| d as u8);
        while i < b.len() {
            if b[i] == b'%' && i + 2 < b.len() {
                if let (Some(alto), Some(bajo)) = (hex(b[i + 1]), hex(b[i + 2])) {
                    out.push(alto * 16 + bajo);
                    i += 3;
                    continue;
                }
            }
            out.push(b[i]);
            i += 1;
        }
        String::from_utf8_lossy(&out).into_owned()
    }

    /// The chosen file's name, for the import's heading. Android gives a `content://` URI whose last segment is a
    /// document id (`primary:Download/copia.json`, `msf:1000`), not the name, and neither the dialog nor the fs plugin
    /// exposes the provider's display name: empty there (the front end shows a neutral text).
    fn nombre_de(ruta: &FilePath) -> String {
        match ruta {
            FilePath::Path(p) => p.file_name().map(|n| n.to_string_lossy().into_owned()).unwrap_or_default(),
            FilePath::Url(u) if u.scheme() == "file" => u
                .path_segments()
                .and_then(|mut s| s.next_back().map(sin_escapes))
                .unwrap_or_default(),
            FilePath::Url(_) => String::new(),
        }
    }

    /// Desktop: the dialog is modal to the app's window (no second dialog behind it, no clicks on the page meanwhile).
    #[cfg(desktop)]
    fn con_ventana<R: Runtime>(app: &AppHandle<R>, d: tauri_plugin_dialog::FileDialogBuilder<R>) -> tauri_plugin_dialog::FileDialogBuilder<R> {
        use tauri::Manager;
        match app.get_webview_window("main") {
            Some(w) => d.set_parent(&w),
            None => d,
        }
    }

    async fn en_hilo<T: Send + 'static>(f: impl FnOnce() -> T + Send + 'static) -> Result<T, String> {
        tauri::async_runtime::spawn_blocking(f)
            .await
            .map_err(|e| format!("No se pudo abrir el diálogo: {e}"))
    }

    /// Shows «Guardar como» with `nombre` proposed and writes `texto` there. `false`: the reader cancelled.
    #[tauri::command]
    pub async fn guardar_fichero_elegido<R: Runtime>(app: AppHandle<R>, nombre: String, texto: String) -> Result<bool, String> {
        let dialogo = app.dialog().file().set_file_name(nombre);
        #[cfg(desktop)]
        let dialogo = con_ventana(&app, dialogo.add_filter("Copia de seguridad (JSON)", &["json"]));
        let Some(ruta) = en_hilo(move || dialogo.blocking_save_file()).await? else {
            return Ok(false);
        };
        en_hilo(move || -> Result<bool, String> {
            let mut opciones = OpenOptions::new();
            opciones.read(false).write(true).create(true).truncate(true);
            let mut f = app
                .fs()
                .open(ruta, opciones)
                .map_err(|e| format!("No se pudo crear el fichero: {e}"))?;
            f.write_all(texto.as_bytes())
                .and_then(|_| f.flush())
                .map_err(|e| format!("No se pudo escribir el fichero: {e}"))?;
            Ok(true)
        })
        .await?
    }

    /// Shows «Abrir» and returns the chosen file's name and text; `None`: the reader cancelled.
    #[tauri::command]
    pub async fn abrir_fichero_elegido<R: Runtime>(app: AppHandle<R>) -> Result<Option<Elegido>, String> {
        let dialogo = app.dialog().file();
        // (Android: no filter, a document provider may give a .json file another MIME type)
        #[cfg(desktop)]
        let dialogo = con_ventana(&app, dialogo.add_filter("Copia de seguridad (JSON)", &["json"]));
        let Some(ruta) = en_hilo(move || dialogo.blocking_pick_file()).await? else {
            return Ok(None);
        };
        en_hilo(move || -> Result<Option<Elegido>, String> {
            let nombre = nombre_de(&ruta);
            let mut opciones = OpenOptions::new();
            opciones.read(true);
            let f = app
                .fs()
                .open(ruta, opciones)
                .map_err(|e| format!("No se pudo abrir el fichero: {e}"))?;
            let mut bytes = Vec::new();
            f.take(MAXIMO + 1)
                .read_to_end(&mut bytes)
                .map_err(|e| format!("No se pudo leer el fichero: {e}"))?;
            if bytes.len() as u64 > MAXIMO {
                return Err("El fichero ocupa más de 50 MB: no es una copia de seguridad de la aplicación.".into());
            }
            let texto = String::from_utf8(bytes)
                .map_err(|_| "El fichero no es texto (UTF-8): no es una copia de seguridad de la aplicación.".to_string())?;
            Ok(Some(Elegido { nombre, texto }))
        })
        .await?
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default();
    // Must be the first plugin: a second launch (double click on the icon while the app is open)
    // exits right away and focuses the window of the running instance instead, so two processes
    // never write lector.json at the same time.
    #[cfg(desktop)]
    let builder = builder.plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
        if let Some(window) = app.get_webview_window("main") {
            let _ = window.unminimize();
            let _ = window.show();
            let _ = window.set_focus();
        }
    }));
    // dialog and fs are used only from Rust (module `fichero`): the webview has no permission for either
    let builder = builder
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![
            fichero::guardar_fichero_elegido,
            fichero::abrir_fichero_elegido
        ]);
    // The desktop and mobile plugins are target-specific dependencies (see Cargo.toml).
    #[cfg(desktop)]
    let builder = builder
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init());
    #[cfg(any(target_os = "android", target_os = "ios"))]
    let builder = builder
        .plugin(tauri_plugin_haptics::init())
        .plugin(tauri_plugin_notification::init());
    builder
        .run(tauri::generate_context!())
        .expect("error while running the application");
}
