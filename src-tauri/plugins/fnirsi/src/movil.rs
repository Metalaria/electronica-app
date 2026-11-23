//! Android transport: the Kotlin class es.gonzalomejias.fnirsi.FnirsiPlugin (android/), which uses
//! android.hardware.usb (UsbManager, the user's permission, the HID interface's two interrupt endpoints). The
//! Android WebView has no WebHID. iOS has no USB host for this instrument: the commands say so.

use serde::de::DeserializeOwned;
use serde::Serialize;
use tauri::plugin::{mobile::PluginInvokeError, PluginApi, PluginHandle};
use tauri::{AppHandle, Runtime};

use crate::{Dispositivo, Lectura};

pub struct Movil<R: Runtime>(#[allow(dead_code)] Option<PluginHandle<R>>);

pub fn iniciar<R: Runtime, C: DeserializeOwned>(_app: &AppHandle<R>, api: PluginApi<R, C>) -> Result<Movil<R>, Box<dyn std::error::Error>> {
    #[cfg(target_os = "android")]
    let h = Some(api.register_android_plugin("es.gonzalomejias.fnirsi", "FnirsiPlugin")?);
    #[cfg(not(target_os = "android"))]
    let h = {
        let _ = api;
        None
    };
    Ok(Movil(h))
}

#[derive(Serialize)]
struct Envio {
    bytes: Vec<u8>,
}

#[derive(Serialize)]
struct Espera {
    espera: u32,
    maximo: u32,
}

#[derive(serde::Deserialize)]
struct Lista {
    dispositivos: Vec<Dispositivo>,
}

fn texto(e: PluginInvokeError) -> String {
    match e {
        // (the Kotlin side rejects with a Spanish sentence)
        PluginInvokeError::InvokeRejected(r) => r.message.unwrap_or_else(|| "El FNIRSI no respondió.".into()),
        otro => format!("Error interno al hablar con el FNIRSI: {otro}"),
    }
}

impl<R: Runtime> Movil<R> {
    async fn llamar<T: DeserializeOwned>(&self, orden: &str, datos: impl Serialize) -> Result<T, String> {
        let Some(h) = &self.0 else {
            return Err("Este dispositivo no puede leer el FNIRSI.".into());
        };
        h.run_mobile_plugin_async(orden, datos).await.map_err(texto)
    }

    pub async fn listar(&self) -> Result<Vec<Dispositivo>, String> {
        self.llamar::<Lista>("listar", ()).await.map(|l| l.dispositivos)
    }

    pub async fn abrir(&self) -> Result<Dispositivo, String> {
        self.llamar("abrir", ()).await
    }

    pub async fn enviar(&self, bytes: Vec<u8>) -> Result<(), String> {
        self.llamar::<serde_json::Value>("enviar", Envio { bytes }).await.map(|_| ())
    }

    pub async fn leer(&self, espera: u32, maximo: u32) -> Result<Lectura, String> {
        self.llamar("leer", Espera { espera, maximo }).await
    }

    pub async fn cerrar(&self) -> Result<(), String> {
        self.llamar::<serde_json::Value>("cerrar", ()).await.map(|_| ())
    }
}
