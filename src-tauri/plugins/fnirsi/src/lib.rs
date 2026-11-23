//! The real FNIRSI 2C53T through «stock-link» (see Cargo.toml). Five commands, the same on every platform, called
//! by web/src/lib/fnirsi-real/transporte.ts as `plugin:fnirsi|<command>`:
//!   - `listar`: the instruments connected (USB 1209:0001 whose product string is «2C53T stock-link»; nothing else
//!     is ever listed or opened: 1209:0001 is the shared pid.codes test id, so the name is checked too);
//!   - `abrir`: opens the first one (Android: asks the user's permission first, the system dialog) and starts
//!     reading its reports in the background;
//!   - `enviar { bytes }`: one request, padded to a 64-byte report. Only the link's identification (0x01) and
//!     subscription (0x03) requests are let through; its memory-read request (0x02) is not;
//!   - `leer { espera, maximo }`: the reports received since the last call, one after another (64 bytes each, at
//!     most `maximo` of them), waiting at most `espera` ms for the first one; `perdidos` counts the reports dropped
//!     because the page did not ask in time;
//!   - `cerrar`.
//! The link streams by itself once subscribed (about 6 multimeter frames or 700 oscilloscope reports a second), so
//! unlike the Brymen's cable the reports are read continuously here and queued for the page. The protocol is
//! explained in web/src/lib/fnirsi-real/protocolo.ts. Errors are Spanish sentences for the reader.

use serde::{Deserialize, Serialize};
use tauri::{
    plugin::{Builder, TauriPlugin},
    Manager, Runtime,
};

#[cfg(desktop)]
mod hid;
#[cfg(mobile)]
mod movil;

/// USB ids of the link (pid.codes test id) and the product string that tells it from any other test device.
pub const VID: u16 = 0x1209;
pub const PID: u16 = 0x0001;
pub const PRODUCTO: &str = "2C53T stock-link";
/// Bytes of one report, in either direction (no report id).
pub const INFORME: usize = 64;
/// Longest wait the page may ask for (ms) and most reports returned by one `leer`.
pub const ESPERA_MAXIMA: u32 = 2000;
pub const MAXIMO_INFORMES: u32 = 512;
/// Requests the page may send: identification and subscription.
pub const ORDEN_INFO: u8 = 0x01;
pub const ORDEN_SUSCRIBIR: u8 = 0x03;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Dispositivo {
    /// The USB product string («2C53T stock-link»).
    pub nombre: String,
    /// Where the system has it (diagnostics only; the page never chooses a device by it).
    pub id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Lectura {
    /// Whole reports, 64 bytes each, oldest first.
    pub bytes: Vec<u8>,
    /// Reports dropped since the last call because the queue was full.
    pub perdidos: u32,
}

/// The 64-byte report of a request, or why it may not be sent.
pub fn informe_de(bytes: &[u8]) -> Result<[u8; INFORME], String> {
    if bytes.is_empty() || bytes.len() > INFORME {
        return Err("Petición al FNIRSI de tamaño incorrecto.".into());
    }
    if bytes[0] != ORDEN_INFO && bytes[0] != ORDEN_SUSCRIBIR {
        return Err("La aplicación solo envía al FNIRSI las órdenes de identificación y de suscripción.".into());
    }
    let mut r = [0u8; INFORME];
    r[..bytes.len()].copy_from_slice(bytes);
    Ok(r)
}

/// «2C53T stock-link» and nothing else (the ids alone are the shared test ids).
pub fn es_el_enlace(producto: Option<&str>) -> bool {
    producto.map(|p| p.trim() == PRODUCTO).unwrap_or(false)
}

#[cfg(desktop)]
type Estado = hid::Hid;
#[cfg(mobile)]
type Estado<R> = movil::Movil<R>;

#[cfg(desktop)]
mod comandos {
    use super::*;

    #[tauri::command]
    pub async fn listar<R: Runtime>(app: tauri::AppHandle<R>) -> Result<Vec<Dispositivo>, String> {
        let h = app.state::<Estado>().inner().clone();
        en_hilo(move || h.listar()).await
    }

    #[tauri::command]
    pub async fn abrir<R: Runtime>(app: tauri::AppHandle<R>) -> Result<Dispositivo, String> {
        let h = app.state::<Estado>().inner().clone();
        en_hilo(move || h.abrir()).await
    }

    #[tauri::command]
    pub async fn enviar<R: Runtime>(app: tauri::AppHandle<R>, bytes: Vec<u8>) -> Result<(), String> {
        let h = app.state::<Estado>().inner().clone();
        let informe = informe_de(&bytes)?;
        en_hilo(move || h.enviar(informe)).await
    }

    #[tauri::command]
    pub async fn leer<R: Runtime>(app: tauri::AppHandle<R>, espera: u32, maximo: u32) -> Result<Lectura, String> {
        let h = app.state::<Estado>().inner().clone();
        let espera = espera.min(ESPERA_MAXIMA);
        let maximo = maximo.clamp(1, MAXIMO_INFORMES) as usize;
        en_hilo(move || h.leer(espera, maximo)).await
    }

    #[tauri::command]
    pub async fn cerrar<R: Runtime>(app: tauri::AppHandle<R>) -> Result<(), String> {
        let h = app.state::<Estado>().inner().clone();
        en_hilo(move || {
            h.cerrar();
            Ok(())
        })
        .await
    }

    /// These calls block (a read waits for its timeout, closing waits for the reader thread): never on the async
    /// runtime's threads.
    async fn en_hilo<T: Send + 'static>(f: impl FnOnce() -> Result<T, String> + Send + 'static) -> Result<T, String> {
        tauri::async_runtime::spawn_blocking(f)
            .await
            .map_err(|e| format!("Error interno al hablar con el FNIRSI: {e}"))?
    }
}

#[cfg(mobile)]
mod comandos {
    use super::*;

    #[tauri::command]
    pub async fn listar<R: Runtime>(app: tauri::AppHandle<R>) -> Result<Vec<Dispositivo>, String> {
        app.state::<Estado<R>>().listar().await
    }

    #[tauri::command]
    pub async fn abrir<R: Runtime>(app: tauri::AppHandle<R>) -> Result<Dispositivo, String> {
        app.state::<Estado<R>>().abrir().await
    }

    #[tauri::command]
    pub async fn enviar<R: Runtime>(app: tauri::AppHandle<R>, bytes: Vec<u8>) -> Result<(), String> {
        let informe = informe_de(&bytes)?;
        app.state::<Estado<R>>().enviar(informe.to_vec()).await
    }

    #[tauri::command]
    pub async fn leer<R: Runtime>(app: tauri::AppHandle<R>, espera: u32, maximo: u32) -> Result<Lectura, String> {
        app.state::<Estado<R>>().leer(espera.min(ESPERA_MAXIMA), maximo.clamp(1, MAXIMO_INFORMES)).await
    }

    #[tauri::command]
    pub async fn cerrar<R: Runtime>(app: tauri::AppHandle<R>) -> Result<(), String> {
        app.state::<Estado<R>>().cerrar().await
    }
}

/// The plugin (`fnirsi`): register it with `.plugin(tauri_plugin_fnirsi::init())`.
pub fn init<R: Runtime>() -> TauriPlugin<R> {
    Builder::new("fnirsi")
        .invoke_handler(tauri::generate_handler![
            comandos::listar,
            comandos::abrir,
            comandos::enviar,
            comandos::leer,
            comandos::cerrar
        ])
        .setup(|app, _api| {
            #[cfg(desktop)]
            app.manage(hid::Hid::default());
            #[cfg(mobile)]
            app.manage(movil::iniciar(app, _api)?);
            Ok(())
        })
        .build()
}

#[cfg(test)]
mod pruebas {
    use super::*;

    #[test]
    fn solo_pasan_identificacion_y_suscripcion() {
        let r = informe_de(&[ORDEN_INFO, 7]).unwrap();
        assert_eq!(r.len(), INFORME);
        assert_eq!(&r[..3], &[0x01, 7, 0]);
        assert!(informe_de(&[ORDEN_SUSCRIBIR, 1, 3]).is_ok());
        // the link's memory read (0x02) and anything unknown stay out
        assert!(informe_de(&[0x02, 1, 16, 0, 0, 0x60, 0, 0x08]).is_err());
        assert!(informe_de(&[0x7f]).is_err());
        assert!(informe_de(&[]).is_err());
        assert!(informe_de(&[ORDEN_INFO; INFORME + 1]).is_err());
    }

    #[test]
    fn el_nombre_distingue_el_enlace_de_otros_dispositivos_de_prueba() {
        assert!(es_el_enlace(Some("2C53T stock-link")));
        assert!(es_el_enlace(Some(" 2C53T stock-link ")));
        assert!(!es_el_enlace(Some("Some other pid.codes test device")));
        assert!(!es_el_enlace(Some("")));
        assert!(!es_el_enlace(None));
    }
}
