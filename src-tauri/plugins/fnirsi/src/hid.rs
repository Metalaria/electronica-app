//! Desktop transport (Windows, macOS, Linux): the link through hidapi. WKWebView (macOS) has no WebHID and
//! WebView2 does not offer it to the app, so the instrument is read here and only its bytes reach the page.
//!
//! One thread owns the open device: it sends the queued requests (output reports through the interrupt OUT
//! endpoint, which is what hidapi's write uses when the interface has one; the link does not implement SET_REPORT)
//! and reads input reports with a short timeout into a bounded queue that `leer` empties. Reading only when the
//! page asks would not do: the operating system keeps a few dozen input reports per device, and the oscilloscope
//! stream fills that in a few hundredths of a second.

use std::collections::VecDeque;
use std::sync::mpsc::{self, Receiver, RecvTimeoutError, Sender, TryRecvError};
use std::sync::{Arc, Condvar, Mutex, MutexGuard};
use std::thread::JoinHandle;
use std::time::Duration;

use hidapi::{HidApi, HidDevice};

use crate::{es_el_enlace, Dispositivo, Lectura, INFORME, PID, VID};

/// Reports kept for the page (about five seconds of the oscilloscope stream). When it fills, the queue is emptied
/// whole: half a record is of no use to the page, which waits for the next record's header anyway.
const COLA_MAXIMA: usize = 4096;
/// How long one read waits (ms): it bounds the delay of a request and of closing.
const ESPERA_LECTURA_MS: i32 = 10;
/// How long `enviar` waits for the thread to send the report.
const ESPERA_ENVIO: Duration = Duration::from_millis(1500);

const PERDIDO: &str = "Se ha perdido la conexión con el FNIRSI: ¿ha cambiado de modo, se ha apagado o se ha desenchufado?";

enum Orden {
    Enviar([u8; INFORME], Sender<Result<(), String>>),
    Cerrar,
}

#[derive(Default)]
struct Compartido {
    cola: VecDeque<[u8; INFORME]>,
    perdidos: u32,
    /// Set by the thread when the device is gone; the thread has ended.
    error: Option<String>,
}

type Canal = Arc<(Mutex<Compartido>, Condvar)>;

struct Abierto {
    d: Dispositivo,
    ordenes: Sender<Orden>,
    canal: Canal,
    hilo: Option<JoinHandle<()>>,
}

#[derive(Default)]
struct Interno {
    api: Option<HidApi>,
    abierto: Option<Abierto>,
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

fn bloquear(c: &Canal) -> MutexGuard<'_, Compartido> {
    // (every field is replaced whole: a panic while holding the lock cannot leave it half-written)
    c.0.lock().unwrap_or_else(|e| e.into_inner())
}

/// Adds one report to the queue; a full queue is emptied first and its reports counted as lost.
fn encolar(c: &mut Compartido, informe: [u8; INFORME]) {
    if c.cola.len() >= COLA_MAXIMA {
        c.perdidos = c.perdidos.saturating_add(c.cola.len() as u32);
        c.cola.clear();
    }
    c.cola.push_back(informe);
}

/// Takes at most `maximo` reports out of the queue, oldest first.
fn vaciar(c: &mut Compartido, maximo: usize) -> Lectura {
    let n = c.cola.len().min(maximo);
    let mut bytes = Vec::with_capacity(n * INFORME);
    for informe in c.cola.drain(..n) {
        bytes.extend_from_slice(&informe);
    }
    let perdidos = c.perdidos;
    c.perdidos = 0;
    Lectura { bytes, perdidos }
}

/// The thread that owns the device until it is told to close or the device goes away.
fn atender(dev: HidDevice, ordenes: Receiver<Orden>, canal: Canal) {
    let terminar = |texto: String| {
        let mut c = bloquear(&canal);
        c.error = Some(texto);
        canal.1.notify_all();
    };
    let mut buf = [0u8; INFORME + 1];
    loop {
        loop {
            match ordenes.try_recv() {
                Ok(Orden::Enviar(informe, respuesta)) => {
                    // hidapi's buffers start with the report id (0: the link has no numbered reports)
                    let mut salida = [0u8; INFORME + 1];
                    salida[1..].copy_from_slice(&informe);
                    match dev.write(&salida) {
                        Ok(_) => {
                            let _ = respuesta.send(Ok(()));
                        }
                        Err(e) => {
                            let texto = format!("{PERDIDO}{}", detalle(e));
                            let _ = respuesta.send(Err(texto.clone()));
                            terminar(texto);
                            return;
                        }
                    }
                }
                Ok(Orden::Cerrar) | Err(TryRecvError::Disconnected) => return,
                Err(TryRecvError::Empty) => break,
            }
        }
        match dev.read_timeout(&mut buf, ESPERA_LECTURA_MS) {
            Ok(0) => {}
            Ok(n) if n == INFORME => {
                let mut informe = [0u8; INFORME];
                informe.copy_from_slice(&buf[..INFORME]);
                let mut c = bloquear(&canal);
                encolar(&mut c, informe);
                canal.1.notify_all();
            }
            // (a report of another size is not the link's: ignored)
            Ok(_) => {}
            Err(e) => {
                terminar(format!("{PERDIDO}{}", detalle(e)));
                return;
            }
        }
    }
}

impl Interno {
    fn api(&mut self) -> Result<&mut HidApi, String> {
        if self.api.is_none() {
            let api = HidApi::new().map_err(|e| format!("No se pudo usar el USB del equipo para buscar el FNIRSI{}.", detalle(e)))?;
            self.api = Some(api);
        }
        let api = self.api.as_mut().expect("just set");
        api.refresh_devices().map_err(|e| format!("No se pudo recorrer los dispositivos USB{}.", detalle(e)))?;
        Ok(api)
    }

    fn enlaces(&mut self) -> Result<Vec<(std::ffi::CString, Dispositivo)>, String> {
        let api = self.api()?;
        let mut v: Vec<_> = api
            .device_list()
            .filter(|d| d.vendor_id() == VID && d.product_id() == PID && es_el_enlace(d.product_string()))
            .map(|d| {
                let nombre = d.product_string().unwrap_or(crate::PRODUCTO).trim().to_string();
                let ruta = d.path().to_owned();
                let id = ruta.to_string_lossy().into_owned();
                (ruta, Dispositivo { nombre, id })
            })
            .collect();
        v.dedup_by(|a, b| a.1.id == b.1.id);
        Ok(v)
    }

    /// Stops the thread and forgets the device.
    fn soltar(&mut self) {
        if let Some(mut a) = self.abierto.take() {
            let _ = a.ordenes.send(Orden::Cerrar);
            if let Some(h) = a.hilo.take() {
                let _ = h.join();
            }
        }
    }
}

impl Hid {
    fn bloqueo(&self) -> MutexGuard<'_, Interno> {
        self.0.lock().unwrap_or_else(|e| e.into_inner())
    }

    pub fn listar(&self) -> Result<Vec<Dispositivo>, String> {
        Ok(self.bloqueo().enlaces()?.into_iter().map(|(_, d)| d).collect())
    }

    pub fn abrir(&self) -> Result<Dispositivo, String> {
        let mut s = self.bloqueo();
        if let Some(a) = &s.abierto {
            if bloquear(&a.canal).error.is_none() {
                return Ok(a.d.clone());
            }
        }
        // (a link that went away — the instrument changed mode — is reopened from scratch)
        s.soltar();
        let Some((ruta, d)) = s.enlaces()?.into_iter().next() else {
            return Err("No se encuentra el FNIRSI 2C53T: compruebe que está enchufado, encendido en multímetro, osciloscopio o generador (no en «USB Sharing») y que lleva el firmware con el enlace (USB 1209:0001, «2C53T stock-link»).".into());
        };
        let dev = s
            .api()?
            .open_path(&ruta)
            .map_err(|e| format!("El FNIRSI está enchufado, pero no se pudo abrir: ¿lo está usando otro programa?{}", detalle(e)))?;
        let (ordenes, recibidas) = mpsc::channel();
        let canal: Canal = Arc::new((Mutex::new(Compartido::default()), Condvar::new()));
        let canal_hilo = canal.clone();
        let hilo = std::thread::Builder::new()
            .name("fnirsi-usb".into())
            .spawn(move || atender(dev, recibidas, canal_hilo))
            .map_err(|e| format!("No se pudo empezar a leer el FNIRSI{}.", detalle(e)))?;
        s.abierto = Some(Abierto { d: d.clone(), ordenes, canal, hilo: Some(hilo) });
        Ok(d)
    }

    pub fn cerrar(&self) {
        self.bloqueo().soltar();
    }

    pub fn enviar(&self, informe: [u8; INFORME]) -> Result<(), String> {
        let (respuesta, espera) = mpsc::channel();
        {
            let s = self.bloqueo();
            let Some(a) = &s.abierto else {
                return Err("El FNIRSI no está abierto.".into());
            };
            if let Some(e) = &bloquear(&a.canal).error {
                return Err(e.clone());
            }
            a.ordenes.send(Orden::Enviar(informe, respuesta)).map_err(|_| PERDIDO.to_string())?;
        }
        match espera.recv_timeout(ESPERA_ENVIO) {
            Ok(r) => r,
            Err(RecvTimeoutError::Timeout) => Err("El FNIRSI no acepta la petición: ¿está ocupado o colgado? Desenchúfelo y vuelva a enchufarlo.".into()),
            Err(RecvTimeoutError::Disconnected) => Err(PERDIDO.into()),
        }
    }

    /// The reports received since the last call (at most `maximo`), waiting at most `espera` ms for the first one.
    pub fn leer(&self, espera: u32, maximo: usize) -> Result<Lectura, String> {
        let canal = {
            let s = self.bloqueo();
            let Some(a) = &s.abierto else {
                return Err("El FNIRSI no está abierto.".into());
            };
            a.canal.clone()
        };
        let mut c = bloquear(&canal);
        if c.cola.is_empty() && c.error.is_none() && espera > 0 {
            let (g, _) = canal
                .1
                .wait_timeout_while(c, Duration::from_millis(espera as u64), |c| c.cola.is_empty() && c.error.is_none())
                .unwrap_or_else(|e| e.into_inner());
            c = g;
        }
        if c.cola.is_empty() {
            if let Some(e) = &c.error {
                return Err(e.clone());
            }
        }
        Ok(vaciar(&mut c, maximo))
    }
}

#[cfg(test)]
mod pruebas {
    use super::*;

    #[test]
    fn sin_abrir_da_errores_claros() {
        let h = Hid::default();
        assert_eq!(h.leer(10, 8).unwrap_err(), "El FNIRSI no está abierto.");
        assert_eq!(h.enviar([0u8; INFORME]).unwrap_err(), "El FNIRSI no está abierto.");
        h.cerrar();
    }

    #[test]
    fn la_cola_entrega_informes_enteros_en_orden() {
        let mut c = Compartido::default();
        for k in 0..5u8 {
            encolar(&mut c, [k; INFORME]);
        }
        let l = vaciar(&mut c, 3);
        assert_eq!(l.bytes.len(), 3 * INFORME);
        assert_eq!((l.bytes[0], l.bytes[INFORME], l.bytes[2 * INFORME]), (0, 1, 2));
        assert_eq!(l.perdidos, 0);
        let l = vaciar(&mut c, 3);
        assert_eq!(l.bytes.len(), 2 * INFORME);
        assert_eq!(l.bytes[0], 3);
        assert!(vaciar(&mut c, 3).bytes.is_empty());
    }

    #[test]
    fn una_cola_llena_se_vacia_entera_y_cuenta_lo_perdido() {
        let mut c = Compartido::default();
        for _ in 0..COLA_MAXIMA {
            encolar(&mut c, [1; INFORME]);
        }
        encolar(&mut c, [2; INFORME]);
        let l = vaciar(&mut c, 8);
        assert_eq!(l.perdidos, COLA_MAXIMA as u32);
        assert_eq!(l.bytes.len(), INFORME);
        assert_eq!(l.bytes[0], 2);
        // the count is given once
        assert_eq!(vaciar(&mut c, 8).perdidos, 0);
    }
}
