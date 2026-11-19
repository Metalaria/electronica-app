//! Desktop transport (Windows, macOS, Linux): the BU-86X through hidapi. WKWebView (macOS) has no WebHID and
//! WebView2 does not offer it to the app, so the cable is read here and only its bytes reach the page.
//!
//! The exchange is sigrok's (libsigrok src/serial_hid_bu86x.c, hid_write of {0, 0x00, 0x86, 0x66} then hid_read
//! of 8-byte reports): the request goes as an output report; if the system refuses it (a cable whose report
//! descriptor has no output report), as a feature report, which is what the older libsigrok driver
//! (0.4.0, brymen-bm86x/protocol.c: SET_REPORT, wValue 0x0300) sent. The one that worked is kept for the session.

use std::sync::{Arc, Mutex};

use hidapi::{HidApi, HidDevice};

use crate::{Dispositivo, PAQUETE, PETICION, PID, VID};

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
enum Envio {
    Salida,
    Caracteristica,
}

#[derive(Default)]
struct Interno {
    api: Option<HidApi>,
    abierto: Option<(HidDevice, Dispositivo)>,
    envio: Option<Envio>,
}

#[derive(Clone, Default)]
pub struct Hid(Arc<Mutex<Interno>>);

fn detalle(e: impl std::fmt::Display) -> String {
    let t = e.to_string();
    if t.trim().is_empty() {
        String::new()
    } else {
        format!(" (detalle del sistema: {})", t.trim())
    }
}

impl Interno {
    fn api(&mut self) -> Result<&mut HidApi, String> {
        if self.api.is_none() {
            let api = HidApi::new().map_err(|e| format!("No se pudo usar el USB del equipo para buscar el cable{}.", detalle(e)))?;
            self.api = Some(api);
        }
        let api = self.api.as_mut().expect("just set");
        api.refresh_devices().map_err(|e| format!("No se pudo recorrer los dispositivos USB{}.", detalle(e)))?;
        Ok(api)
    }

    fn cables(&mut self) -> Result<Vec<(std::ffi::CString, Dispositivo, i32)>, String> {
        let api = self.api()?;
        let mut v: Vec<_> = api
            .device_list()
            .filter(|d| d.vendor_id() == VID && d.product_id() == PID)
            .map(|d| {
                let nombre = d.product_string().filter(|s| !s.trim().is_empty()).unwrap_or("BU-86X").trim().to_string();
                let ruta = d.path().to_owned();
                let id = ruta.to_string_lossy().into_owned();
                (ruta, Dispositivo { nombre, id }, d.interface_number())
            })
            .collect();
        // (Windows can list one entry per HID collection: interface 0 first, as the old driver claimed interface 0)
        v.sort_by_key(|(_, _, i)| if *i <= 0 { 0 } else { 1 });
        v.dedup_by(|a, b| a.1.id == b.1.id);
        Ok(v)
    }
}

impl Hid {
    fn bloqueo(&self) -> std::sync::MutexGuard<'_, Interno> {
        // (a panic while holding it cannot leave the hidapi state half-written: every field is replaced whole)
        self.0.lock().unwrap_or_else(|e| e.into_inner())
    }

    pub fn listar(&self) -> Result<Vec<Dispositivo>, String> {
        Ok(self.bloqueo().cables()?.into_iter().map(|(_, d, _)| d).collect())
    }

    pub fn abrir(&self) -> Result<Dispositivo, String> {
        let mut s = self.bloqueo();
        if let Some((_, d)) = &s.abierto {
            return Ok(d.clone());
        }
        let cables = s.cables()?;
        let Some((ruta, d, _)) = cables.into_iter().next() else {
            return Err("No se encuentra el cable BU-86X: compruebe que está enchufado al ordenador (USB 0820:0001).".into());
        };
        let dev = s
            .api()?
            .open_path(&ruta)
            .map_err(|e| format!("El cable BU-86X está enchufado, pero no se pudo abrir: ¿lo está usando otro programa (el de Brymen, sigrok)?{}", detalle(e)))?;
        // (reads with a timeout, never a blocking read that would hold the lock)
        let _ = dev.set_blocking_mode(false);
        s.abierto = Some((dev, d.clone()));
        s.envio = None;
        Ok(d)
    }

    pub fn cerrar(&self) {
        let mut s = self.bloqueo();
        s.abierto = None;
        s.envio = None;
    }

    /// Sends the request and returns what came back within `espera` ms per report (at most one packet).
    pub fn leer(&self, espera: u32) -> Result<Vec<u8>, String> {
        let mut s = self.bloqueo();
        let envio = s.envio;
        let Some((dev, _)) = s.abierto.as_ref() else {
            return Err("El cable del Brymen no está abierto.".into());
        };
        let perdido = |e: hidapi::HidError| format!("Se ha perdido la conexión con el cable del Brymen: ¿se ha desenchufado?{}", detalle(e));
        // hidapi's buffers start with the report id (0: the cable has no numbered reports)
        let mut pet = [0u8; 4];
        pet[1..].copy_from_slice(&PETICION);
        let usado = match envio {
            Some(Envio::Salida) => dev.write(&pet).map(|_| Envio::Salida).map_err(perdido)?,
            Some(Envio::Caracteristica) => dev.send_feature_report(&pet).map(|_| Envio::Caracteristica).map_err(perdido)?,
            None => match dev.write(&pet) {
                Ok(_) => Envio::Salida,
                Err(e1) => match dev.send_feature_report(&pet) {
                    Ok(_) => Envio::Caracteristica,
                    Err(e2) => return Err(format!("El cable BU-86X no acepta la petición de lectura{}{}", detalle(e1), detalle(e2))),
                },
            },
        };
        let mut recibido = Vec::with_capacity(PAQUETE);
        let mut buf = [0u8; 64];
        while recibido.len() < PAQUETE {
            let n = dev.read_timeout(&mut buf, espera as i32).map_err(perdido)?;
            if n == 0 {
                break;
            }
            recibido.extend_from_slice(&buf[..n.min(buf.len())]);
        }
        s.envio = Some(usado);
        Ok(recibido)
    }
}

#[cfg(test)]
mod pruebas {
    use super::*;

    #[test]
    fn leer_sin_abrir_da_un_error_claro() {
        let h = Hid::default();
        assert_eq!(h.leer(10).unwrap_err(), "El cable del Brymen no está abierto.");
        h.cerrar();
    }

    #[test]
    fn la_peticion_es_la_de_sigrok() {
        let mut pet = [0u8; 4];
        pet[1..].copy_from_slice(&PETICION);
        assert_eq!(pet, [0x00, 0x00, 0x86, 0x66]);
    }
}
