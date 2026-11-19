//! 1.3: the real Brymen BM869s through its BU-86X USB cable (see Cargo.toml). Four commands, the same on every
//! platform, called by web/src/lib/brymen-real/transporte.ts as `plugin:brymen|<command>`:
//!   - `listar`: the BU-86X cables connected (VID 0x0820, PID 0x0001; nothing else is ever listed or opened);
//!   - `abrir`: opens the first one (Android: asks the user's permission first, the system dialog);
//!   - `leer { espera }`: sends the meter's request (00 86 66, report 0) and returns the bytes of the reply (24 when
//!     the meter answers: three 8-byte reports), waiting at most `espera` ms per report; fewer or none when it
//!     does not answer (meter off, cable not on its back);
//!   - `cerrar`.
//! The protocol (libsigrok src/serial_hid_bu86x.c and src/dmm/bm86x.c) is explained in protocolo.ts. Errors are
//! Spanish sentences for the reader.

use serde::{Deserialize, Serialize};
use tauri::{
    plugin::{Builder, TauriPlugin},
    Manager, Runtime,
};

#[cfg(desktop)]
mod hid;
#[cfg(mobile)]
mod movil;

/// USB ids of the BU-86X cable.
pub const VID: u16 = 0x0820;
pub const PID: u16 = 0x0001;
/// The request's payload (after the report id 0).
pub const PETICION: [u8; 3] = [0x00, 0x86, 0x66];
/// Bytes of one packet of the meter.
pub const PAQUETE: usize = 24;
/// Longest wait per report the page may ask for (ms).
pub const ESPERA_MAXIMA: u32 = 2000;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Dispositivo {
    /// What the cable says it is («BU-86X», or the USB product string).
    pub nombre: String,
    /// Where the system has it (diagnostics only; the page never chooses a device by it).
    pub id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Lectura {
    pub bytes: Vec<u8>,
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
    pub async fn leer<R: Runtime>(app: tauri::AppHandle<R>, espera: u32) -> Result<Lectura, String> {
        let h = app.state::<Estado>().inner().clone();
        let espera = espera.clamp(1, ESPERA_MAXIMA);
        en_hilo(move || h.leer(espera).map(|bytes| Lectura { bytes })).await
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

    /// hidapi calls block (a read waits for its timeout): never on the async runtime's threads.
    async fn en_hilo<T: Send + 'static>(f: impl FnOnce() -> Result<T, String> + Send + 'static) -> Result<T, String> {
        tauri::async_runtime::spawn_blocking(f)
            .await
            .map_err(|e| format!("Error interno al hablar con el cable del Brymen: {e}"))?
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
    pub async fn leer<R: Runtime>(app: tauri::AppHandle<R>, espera: u32) -> Result<Lectura, String> {
        app.state::<Estado<R>>().leer(espera.clamp(1, ESPERA_MAXIMA)).await
    }

    #[tauri::command]
    pub async fn cerrar<R: Runtime>(app: tauri::AppHandle<R>) -> Result<(), String> {
        app.state::<Estado<R>>().cerrar().await
    }
}

/// The plugin (`brymen`): register it with `.plugin(tauri_plugin_brymen::init())`.
pub fn init<R: Runtime>() -> TauriPlugin<R> {
    Builder::new("brymen")
        .invoke_handler(tauri::generate_handler![comandos::listar, comandos::abrir, comandos::leer, comandos::cerrar])
        .setup(|app, _api| {
            #[cfg(desktop)]
            app.manage(hid::Hid::default());
            #[cfg(mobile)]
            app.manage(movil::iniciar(app, _api)?);
            Ok(())
        })
        .build()
}
