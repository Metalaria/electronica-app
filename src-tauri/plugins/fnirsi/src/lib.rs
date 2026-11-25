//! The real FNIRSI 2C53T through «stock-link» (see Cargo.toml). Five commands, the same on every platform, called
//! by web/src/lib/fnirsi-real/transporte.ts as `plugin:fnirsi|<command>`:
//!   - `listar`: the instruments connected (USB 1209:0001 whose product string is «2C53T stock-link»; nothing else
//!     is ever listed or opened: 1209:0001 is the shared pid.codes test id, so the name is checked too);
//!   - `abrir`: opens the first one (Android: asks the user's permission first, the system dialog) and starts
//!     reading its reports in the background;
//!   - `enviar { bytes }`: one request, padded to a 64-byte report. Only the link's identification (0x01) and
//!     subscription (0x03) requests are let through, and, since 2.1 (the owner's decision of 2026-11-25, link patch 4),
//!     the generator's custom wave (0x04: at most 28 samples inside its 100-position table) and a memory read (0x02)
//!     only inside that table (200 bytes from 0x20000F5A), to check a wave that was sent. Anything else is refused;
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
/// Requests the page may send: identification and subscription; the custom wave and the read of its table (2.1).
pub const ORDEN_INFO: u8 = 0x01;
pub const ORDEN_LEER: u8 = 0x02;
pub const ORDEN_SUSCRIBIR: u8 = 0x03;
pub const ORDEN_ONDA: u8 = 0x04;
/// The generator's custom wave: samples per request and positions in its table.
pub const MUESTRAS_ONDA: u32 = 28;
pub const POSICIONES_ONDA: u32 = 100;
/// Bytes one read may take, and the only memory it may read: the wave table (100 samples of 2 bytes).
pub const LARGO_LECTURA: u32 = 56;
pub const DIR_TABLA_ONDA: u32 = 0x2000_0F5A;
pub const LARGO_TABLA_ONDA: u32 = 200;
/// What the page is told when a request is refused.
pub const RECHAZO: &str = "La aplicación solo envía al FNIRSI las órdenes de identificación y de suscripción, la onda a medida del generador y la lectura de su tabla.";

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
    if !permitida(bytes) {
        return Err(RECHAZO.into());
    }
    let mut r = [0u8; INFORME];
    r[..bytes.len()].copy_from_slice(bytes);
    Ok(r)
}

/// Little-endian u32 at bytes[4..8] (the position of a wave request, the address of a read); None when short.
fn u32_en(bytes: &[u8]) -> Option<u32> {
    let b = bytes.get(4..8)?;
    Some(u32::from_le_bytes([b[0], b[1], b[2], b[3]]))
}

/// The requests the page may send (web/src/lib/fnirsi-real/protocolo.ts: [0] order, [1] sequence, [2] argument,
/// [4..8] little-endian position or address):
///   - 0x01 identification and 0x03 subscription;
///   - 0x04 custom wave: [2] samples from 1 to 28, position + samples ≤ 100;
///   - 0x02 read, only of the wave table: [2] bytes from 1 to 56, address ≥ 0x20000F5A, address + bytes ≤ 0x20000F5A
///     + 200.
/// Checked arithmetic: an address near 2³² cannot wrap into the window.
pub fn permitida(bytes: &[u8]) -> bool {
    let Some(&orden) = bytes.first() else { return false };
    match orden {
        ORDEN_INFO | ORDEN_SUSCRIBIR => true,
        ORDEN_ONDA => {
            let n = match bytes.get(2) {
                Some(&n) => n as u32,
                None => return false,
            };
            let Some(posicion) = u32_en(bytes) else { return false };
            (1..=MUESTRAS_ONDA).contains(&n) && posicion.checked_add(n).is_some_and(|fin| fin <= POSICIONES_ONDA)
        }
        ORDEN_LEER => {
            let n = match bytes.get(2) {
                Some(&n) => n as u32,
                None => return false,
            };
            let Some(dir) = u32_en(bytes) else { return false };
            (1..=LARGO_LECTURA).contains(&n)
                && dir >= DIR_TABLA_ONDA
                && dir.checked_add(n).is_some_and(|fin| fin <= DIR_TABLA_ONDA + LARGO_TABLA_ONDA)
        }
        _ => false,
    }
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
    fn pasan_identificacion_y_suscripcion() {
        let r = informe_de(&[ORDEN_INFO, 7]).unwrap();
        assert_eq!(r.len(), INFORME);
        assert_eq!(&r[..3], &[0x01, 7, 0]);
        assert!(informe_de(&[ORDEN_SUSCRIBIR, 1, 3]).is_ok());
        assert!(informe_de(&[0x7f]).is_err());
        assert!(informe_de(&[]).is_err());
        assert!(informe_de(&[ORDEN_INFO; INFORME + 1]).is_err());
    }

    /// A request with its argument at [2] and a little-endian u32 at [4..8].
    fn peticion(orden: u8, argumento: u8, x: u32) -> Vec<u8> {
        let mut v = vec![orden, 1, argumento, 0];
        v.extend_from_slice(&x.to_le_bytes());
        v
    }

    #[test]
    fn la_onda_pasa_dentro_de_su_tabla_y_nada_mas() {
        // samples per request: 0 and 29 out, 1 and 28 in
        assert!(informe_de(&peticion(ORDEN_ONDA, 0, 0)).is_err());
        assert!(informe_de(&peticion(ORDEN_ONDA, 1, 0)).is_ok());
        assert!(informe_de(&peticion(ORDEN_ONDA, 28, 0)).is_ok());
        assert!(informe_de(&peticion(ORDEN_ONDA, 29, 0)).is_err());
        // the last position: 72 + 28 = 100 in, 73 + 28 out; 99 + 1 in, 100 + 1 out
        assert!(informe_de(&peticion(ORDEN_ONDA, 28, 72)).is_ok());
        assert!(informe_de(&peticion(ORDEN_ONDA, 28, 73)).is_err());
        assert!(informe_de(&peticion(ORDEN_ONDA, 1, 99)).is_ok());
        assert!(informe_de(&peticion(ORDEN_ONDA, 1, 100)).is_err());
        // a position that would wrap around 2^32 does not
        assert!(informe_de(&peticion(ORDEN_ONDA, 28, u32::MAX)).is_err());
        assert!(informe_de(&peticion(ORDEN_ONDA, 1, u32::MAX - 27)).is_err());
        // a request too short to carry its position
        assert!(informe_de(&[ORDEN_ONDA, 1, 1, 0, 0]).is_err());
        assert!(informe_de(&[ORDEN_ONDA]).is_err());
        // a whole wave request, samples and all, keeps its bytes
        let mut v = peticion(ORDEN_ONDA, 28, 72);
        v.extend((0..56).map(|k| k as u8));
        let r = informe_de(&v).unwrap();
        assert_eq!(&r[..], &v[..]);
    }

    #[test]
    fn la_lectura_pasa_solo_dentro_de_la_tabla_de_la_onda() {
        let fin = DIR_TABLA_ONDA + LARGO_TABLA_ONDA;
        // bytes per read: 0 and 57 out, 1 and 56 in
        assert!(informe_de(&peticion(ORDEN_LEER, 0, DIR_TABLA_ONDA)).is_err());
        assert!(informe_de(&peticion(ORDEN_LEER, 1, DIR_TABLA_ONDA)).is_ok());
        assert!(informe_de(&peticion(ORDEN_LEER, 56, DIR_TABLA_ONDA)).is_ok());
        assert!(informe_de(&peticion(ORDEN_LEER, 57, DIR_TABLA_ONDA)).is_err());
        // one byte below the table, and its last bytes
        assert!(informe_de(&peticion(ORDEN_LEER, 1, DIR_TABLA_ONDA - 1)).is_err());
        assert!(informe_de(&peticion(ORDEN_LEER, 56, fin - 56)).is_ok());
        assert!(informe_de(&peticion(ORDEN_LEER, 56, fin - 55)).is_err());
        assert!(informe_de(&peticion(ORDEN_LEER, 1, fin - 1)).is_ok());
        assert!(informe_de(&peticion(ORDEN_LEER, 1, fin)).is_err());
        // what the link reads elsewhere (the oscilloscope's state, the generator's settings) stays out
        assert!(informe_de(&peticion(ORDEN_LEER, 16, 0x2000_0208)).is_err());
        assert!(informe_de(&peticion(ORDEN_LEER, 10, 0x2000_0F50)).is_err());
        assert!(informe_de(&[0x02, 1, 16, 0, 0, 0x60, 0, 0x08]).is_err());
        // an address that would wrap around 2^32 does not
        assert!(informe_de(&peticion(ORDEN_LEER, 56, u32::MAX)).is_err());
        assert!(informe_de(&peticion(ORDEN_LEER, 1, u32::MAX)).is_err());
        assert!(informe_de(&[ORDEN_LEER, 1, 1, 0, 0x5a, 0x0f]).is_err());
    }

    #[test]
    fn ninguna_otra_orden_pasa() {
        for orden in 0u8..=255 {
            if matches!(orden, ORDEN_INFO | ORDEN_SUSCRIBIR | ORDEN_ONDA | ORDEN_LEER) {
                continue;
            }
            // even with arguments that a wave or a read would accept
            assert!(informe_de(&peticion(orden, 1, 0)).is_err(), "orden {orden:#04x}");
            assert!(informe_de(&peticion(orden, 1, DIR_TABLA_ONDA)).is_err(), "orden {orden:#04x}");
            assert_eq!(informe_de(&[orden]).unwrap_err(), RECHAZO);
        }
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
