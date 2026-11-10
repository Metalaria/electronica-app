//! Tauri shell of the reader. All the logic lives in the web front end; the native side
//! only provides the window and the persistent key-value store for the reader's
//! personal data (positions, bookmarks, notes and preferences), the opener that shows
//! the release page of a new version in the system browser, and (0.12) the backup export
//! and import: two commands of its own that show the system's save/open dialog and write
//! or read only the file chosen there (see `fichero` below). On Android (and iOS) it also registers haptics
//! (vibration feedback) and notifications (the daily reminder, 0.11). On desktop (0.12)
//! it keeps a single running instance and provides the signed automatic updates
//! (updater) and the relaunch after installing one (process).
//! In 1.1 it opens the book's QR links, epa://leccion/<parte>/<label> (deep-link plugin, module `enlaces`).
//! In 1.0 a panic of the native side is written, before the process ends, to a small file in the
//! app's log folder (`fallos`), which the front end reads once at the next start into its local
//! «Informe de fallos» (no new permission: one command of its own, no file path from the page).

#[cfg(desktop)]
use tauri::Manager;

/// Native failures for the front end's «Informe de fallos» (1.0). A panic hook appends one line (time in ms,
/// tab, message and location) to `fallos-nativos.log` in the app's log folder before the process aborts
/// (`panic = "abort"` in release); `fallos_nativos` returns what is there and empties it, so each failure reaches
/// the report once. Bounded: at 64 kB the file starts again. The path never comes from the page.
mod fallos {
    use std::io::Write;
    use std::path::PathBuf;
    use std::sync::OnceLock;
    use tauri::{AppHandle, Manager, Runtime};

    static FICHERO: OnceLock<PathBuf> = OnceLock::new();
    const MAX_BYTES: u64 = 64 * 1024;

    pub fn instalar<R: Runtime>(app: &AppHandle<R>) {
        let Ok(dir) = app.path().app_log_dir() else { return };
        if std::fs::create_dir_all(&dir).is_err() {
            return;
        }
        let _ = FICHERO.set(dir.join("fallos-nativos.log"));
        let previo = std::panic::take_hook();
        std::panic::set_hook(Box::new(move |info| {
            anotar(&linea_panico(info));
            previo(info);
        }));
    }

    /// One line for a panic: its message and where it happened (no newlines, at most 600 characters).
    pub(crate) fn linea_panico(info: &std::panic::PanicHookInfo<'_>) -> String {
        let mensaje = info
            .payload()
            .downcast_ref::<&str>()
            .map(|s| s.to_string())
            .or_else(|| info.payload().downcast_ref::<String>().cloned())
            .unwrap_or_else(|| "pánico sin mensaje".into());
        let donde = info.location().map(|l| format!(" ({}:{})", l.file(), l.line())).unwrap_or_default();
        limpiar(&format!("pánico: {mensaje}{donde}"))
    }

    pub(crate) fn limpiar(texto: &str) -> String {
        texto.replace(['\n', '\r', '\t'], " ").chars().take(600).collect()
    }

    fn anotar(texto: &str) {
        // Never panics itself (a panic inside the hook would abort without a trace).
        let Some(ruta) = FICHERO.get() else { return };
        if std::fs::metadata(ruta).map(|m| m.len() > MAX_BYTES).unwrap_or(false) {
            let _ = std::fs::remove_file(ruta);
        }
        let ms = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d| d.as_millis()).unwrap_or(0);
        if let Ok(mut f) = std::fs::OpenOptions::new().create(true).append(true).open(ruta) {
            let _ = writeln!(f, "{ms}\t{texto}");
            let _ = f.flush();
        }
    }

    /// The native failures recorded since the last call (lines «ms<TAB>text»), and the file emptied.
    #[tauri::command]
    pub fn fallos_nativos() -> String {
        let Some(ruta) = FICHERO.get() else { return String::new() };
        let texto = std::fs::read_to_string(ruta).unwrap_or_default();
        if !texto.is_empty() {
            let _ = std::fs::remove_file(ruta);
        }
        texto
    }
}

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

    /// The bytes to write: `texto` as UTF-8, or (1.0, the «modo docente» PDF) the bytes `texto` encodes in base64.
    /// The 50 MB cap applies to the decoded bytes (checked on the encoded length first, so nothing huge is decoded).
    /// Review 10c: the file types the webview may ask for are a whitelist — the backup (JSON) and the teacher-mode PDF —
    /// with the dialog's name fixed here (the webview's name is not shown). Anything else is refused before the dialog
    /// opens. `None`: no filter asked (the backup's call of 0.12).
    pub(crate) fn filtro_permitido(filtro: &Option<(String, Vec<String>)>) -> Result<Option<(&'static str, &'static str)>, String> {
        let Some((_, extensiones)) = filtro else {
            return Ok(None);
        };
        let ext: Vec<String> = extensiones.iter().map(|e| e.trim().trim_start_matches('.').to_ascii_lowercase()).collect();
        match ext.as_slice() {
            [e] if e == "json" => Ok(Some(("Copia de seguridad (JSON)", "json"))),
            [e] if e == "pdf" => Ok(Some(("Documento PDF", "pdf"))),
            _ => Err("Ese tipo de fichero no se puede guardar desde la aplicación.".into()),
        }
    }

    /// The proposed file name with the filter's extension: kept when it already has it (any case), else the last
    /// extension (if any) replaced by it, or it added (review 10f).
    pub(crate) fn nombre_con_extension(nombre: &str, ext: &str) -> String {
        let limpio = nombre.trim();
        let base = if limpio.is_empty() { "documento" } else { limpio };
        if base.to_ascii_lowercase().ends_with(&format!(".{ext}")) {
            return base.to_string();
        }
        let sin = match base.rfind('.') {
            Some(i) if i > 0 && !base[i + 1..].is_empty() && !base[i + 1..].contains(' ') && base.len() - i <= 6 => &base[..i],
            _ => base,
        };
        format!("{sin}.{ext}")
    }

    pub(crate) fn contenido(texto: String, base64: bool) -> Result<Vec<u8>, String> {
        if !base64 {
            return Ok(texto.into_bytes());
        }
        use base64::Engine;
        if (texto.len() as u64) / 4 * 3 > MAXIMO {
            return Err("El fichero ocupa más de 50 MB: no se ha guardado.".into());
        }
        let bytes = base64::engine::general_purpose::STANDARD
            .decode(texto.as_bytes())
            .map_err(|e| format!("El contenido del fichero no es válido: {e}"))?;
        if bytes.len() as u64 > MAXIMO {
            return Err("El fichero ocupa más de 50 MB: no se ha guardado.".into());
        }
        Ok(bytes)
    }

    /// Shows «Guardar como» with `nombre` proposed and writes `texto` there. `false`: the reader cancelled.
    /// 1.0: `base64` (optional) — `texto` is binary content in base64 (a PDF); `filtro` (optional) — the dialog's
    /// file type, name and extensions (desktop: the filter; Android: the MIME type of the create-document picker,
    /// from the first extension). Without them it is the backup's call of 0.12 (JSON filter on desktop, none on
    /// Android). The path still comes only from the dialog: nothing the webview sends chooses where to write.
    #[tauri::command]
    pub async fn guardar_fichero_elegido<R: Runtime>(
        app: AppHandle<R>,
        nombre: String,
        texto: String,
        base64: Option<bool>,
        filtro: Option<(String, Vec<String>)>,
    ) -> Result<bool, String> {
        let bytes = contenido(texto, base64.unwrap_or(false))?;
        let permitido = filtro_permitido(&filtro)?;
        // (review 10f: the proposed name ends with the filter's extension — a PDF is never offered as «x.json» or «x»)
        let nombre = match permitido {
            Some((_, ext)) => nombre_con_extension(&nombre, ext),
            None => nombre,
        };
        let dialogo = app.dialog().file().set_file_name(nombre);
        let dialogo = match permitido {
            Some((tipo, ext)) => dialogo.add_filter(tipo, &[ext]),
            #[cfg(desktop)]
            None => dialogo.add_filter("Copia de seguridad (JSON)", &["json"]),
            #[cfg(not(desktop))]
            None => dialogo,
        };
        #[cfg(desktop)]
        let dialogo = con_ventana(&app, dialogo);
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
            f.write_all(&bytes)
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

/// The book's QR links (1.1): `epa://leccion/<parte>/<label>`. The deep-link plugin registers the scheme (the
/// bundler reads `plugins.deep-link` of tauri.conf.json) and gives the links: at a cold start (`get_current`: the
/// command line on Windows/Linux, the launching intent on Android), and later (`on_open_url`: macOS «open URL»
/// events, Android new intents, and — through the single-instance callback, `handle_cli_arguments` — a second launch
/// on Windows/Linux). The last one is kept here and the page is told (`epa-enlace`); it takes it with
/// `enlace_pendiente`, once (a reload of the page does not open it again). Here only a light check (our scheme,
/// printable ASCII, short); the page validates the link strictly and only ever turns it into one of its own hash
/// routes (web/src/lib/enlaces.ts): no URL from outside is ever navigated to.
mod enlaces {
    use std::sync::atomic::{AtomicBool, Ordering};
    use std::sync::Mutex;
    use tauri::{AppHandle, Emitter, Manager, Runtime};
    use tauri_plugin_deep_link::DeepLinkExt;

    /// Longer than any real link (web/src/lib/enlaces.ts LONGITUD_MAXIMA).
    const LONGITUD_MAXIMA: usize = 120;

    #[derive(Default)]
    pub struct Pendiente {
        enlace: Mutex<Option<String>>,
        /// The page has asked once (after that, the cold-start link is not read again).
        preguntado: AtomicBool,
    }

    /// A link that may be ours: the scheme `epa://`, printable ASCII only, at most LONGITUD_MAXIMA bytes.
    pub(crate) fn aceptable(url: &str) -> bool {
        url.len() <= LONGITUD_MAXIMA
            && url.get(..6).is_some_and(|p| p.eq_ignore_ascii_case("epa://"))
            && url.bytes().all(|b| b.is_ascii_graphic())
    }

    fn guardar<R: Runtime>(app: &AppHandle<R>, url: &str) -> bool {
        if !aceptable(url) {
            return false;
        }
        let Some(p) = app.try_state::<Pendiente>() else { return false };
        // (a poisoned lock — a panic elsewhere while holding it — still holds a usable value)
        *p.enlace.lock().unwrap_or_else(|e| e.into_inner()) = Some(url.to_string());
        true
    }

    /// A link that arrived while the app runs: kept, the page told, the window brought forward (desktop).
    fn recibir<R: Runtime>(app: &AppHandle<R>, url: &str) {
        if !guardar(app, url) {
            return;
        }
        let _ = app.emit("epa-enlace", ());
        #[cfg(desktop)]
        if let Some(w) = app.get_webview_window("main") {
            let _ = w.unminimize();
            let _ = w.show();
            let _ = w.set_focus();
        }
    }

    pub fn instalar<R: Runtime>(app: &AppHandle<R>) {
        app.manage(Pendiente::default());
        let h = app.clone();
        app.deep_link().on_open_url(move |ev| {
            for u in ev.urls() {
                recibir(&h, u.as_str());
            }
        });
        if let Ok(Some(urls)) = app.deep_link().get_current() {
            if let Some(u) = urls.iter().find(|u| aceptable(u.as_str())) {
                guardar(app, u.as_str());
            }
        }
    }

    /// Desktop: the arguments of a second launch (the single-instance callback): a link among them is delivered
    /// (`on_open_url`) as if the system had opened it here.
    #[cfg(desktop)]
    pub fn segunda_instancia<R: Runtime>(app: &AppHandle<R>, args: &[String]) {
        app.deep_link().handle_cli_arguments(args.iter());
    }

    /// The link to open, taken once; none when there is none.
    #[tauri::command]
    pub fn enlace_pendiente<R: Runtime>(app: AppHandle<R>) -> Option<String> {
        let p = app.try_state::<Pendiente>()?;
        let tomado = p.enlace.lock().unwrap_or_else(|e| e.into_inner()).take();
        let primera = !p.preguntado.swap(true, Ordering::SeqCst);
        if tomado.is_some() || !primera {
            return tomado;
        }
        // (Android: the launching intent can reach the plugin only once the page has loaded, after `instalar`)
        app.deep_link()
            .get_current()
            .ok()
            .flatten()
            .and_then(|urls| urls.into_iter().map(|u| u.to_string()).find(|u| aceptable(u)))
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default();
    // Must be the first plugin: a second launch (double click on the icon while the app is open)
    // exits right away and focuses the window of the running instance instead, so two processes
    // never write lector.json at the same time.
    #[cfg(desktop)]
    let builder = builder.plugin(tauri_plugin_single_instance::init(|app, args, _cwd| {
        if let Some(window) = app.get_webview_window("main") {
            let _ = window.unminimize();
            let _ = window.show();
            let _ = window.set_focus();
        }
        // 1.1: a book QR link opened while the app runs (Windows/Linux start a second process with it)
        enlaces::segunda_instancia(app, &args);
    }));
    // dialog and fs are used only from Rust (module `fichero`): the webview has no permission for either
    let builder = builder
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        // 1.1: the book's QR links (module `enlaces`)
        .plugin(tauri_plugin_deep_link::init())
        .invoke_handler(tauri::generate_handler![
            fichero::guardar_fichero_elegido,
            fichero::abrir_fichero_elegido,
            fallos::fallos_nativos,
            enlaces::enlace_pendiente
        ])
        .setup(|app| {
            fallos::instalar(app.handle());
            enlaces::instalar(app.handle());
            Ok(())
        });
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

#[cfg(test)]
mod pruebas {
    use super::fichero::{contenido, filtro_permitido, nombre_con_extension};
    use super::fallos::limpiar;
    use super::enlaces::aceptable;

    #[test]
    fn solo_enlaces_epa_cortos_y_ascii() {
        assert!(aceptable("epa://leccion/cap01/sec-1.4"));
        assert!(aceptable("EPA://leccion/apA/sec-A.1"));
        // (review 11c: the expansions' new chapters, whose part is not cap<NN>)
        assert!(aceptable("epa://leccion/cap-new-maquinas/sec-new-maquinas.1"));
        assert!(!aceptable("https://example.com/"));
        assert!(!aceptable("epa:/leccion"));
        assert!(!aceptable("epa://leccion/cap01/sec 1.4"));
        assert!(!aceptable("epa://lección/cap01"));
        assert!(!aceptable(&format!("epa://leccion/{}", "a".repeat(200))));
        assert!(!aceptable(""));
    }

    #[test]
    fn linea_de_fallo_sin_saltos_y_acotada() {
        assert_eq!(limpiar("uno\ndos\rtres\tcuatro"), "uno dos tres cuatro");
        assert_eq!(limpiar(&"x".repeat(900)).chars().count(), 600);
    }

    #[test]
    fn texto_tal_cual_y_base64_decodificado() {
        assert_eq!(contenido("{\"a\":1}".into(), false).unwrap(), b"{\"a\":1}".to_vec());
        assert_eq!(contenido("JVBERi0xLjcK/w==".into(), true).unwrap(), b"%PDF-1.7\n\xff".to_vec());
        assert!(contenido("no es base64!".into(), true).is_err());
    }

    #[test]
    fn solo_json_y_pdf() {
        assert_eq!(filtro_permitido(&None).unwrap(), None);
        let f = |n: &str, e: &[&str]| Some((n.to_string(), e.iter().map(|x| x.to_string()).collect::<Vec<_>>()));
        assert_eq!(filtro_permitido(&f("Documento PDF", &["pdf"])).unwrap(), Some(("Documento PDF", "pdf")));
        assert_eq!(filtro_permitido(&f("lo que sea", &[".PDF"])).unwrap(), Some(("Documento PDF", "pdf")));
        assert_eq!(filtro_permitido(&f("Copia", &["json"])).unwrap(), Some(("Copia de seguridad (JSON)", "json")));
        assert!(filtro_permitido(&f("Programa", &["exe"])).is_err());
        assert!(filtro_permitido(&f("Varios", &["pdf", "exe"])).is_err());
        assert!(filtro_permitido(&f("Nada", &[])).is_err());
        assert!(filtro_permitido(&f("Todo", &["*"])).is_err());
    }

    #[test]
    fn el_nombre_lleva_la_extension_del_filtro() {
        assert_eq!(nombre_con_extension("Examen — variante A.pdf", "pdf"), "Examen — variante A.pdf");
        assert_eq!(nombre_con_extension("Examen.PDF", "pdf"), "Examen.PDF");
        assert_eq!(nombre_con_extension("examen.json", "pdf"), "examen.pdf");
        assert_eq!(nombre_con_extension("examen", "pdf"), "examen.pdf");
        assert_eq!(nombre_con_extension("Tema 5.3 diodos", "pdf"), "Tema 5.3 diodos.pdf");
        assert_eq!(nombre_con_extension("   ", "json"), "documento.json");
        assert_eq!(nombre_con_extension(".pdf", "pdf"), ".pdf");
    }
}
