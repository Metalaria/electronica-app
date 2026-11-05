// Daily study reminder (0.11, Android only): a local notification every day at the time chosen in «Aa»
// (default 20:00) that opens the problem of the day (group B: #/problema, the text promises it). It uses tauri-plugin-notification: the Android library schedules it
// with AlarmManager (inexact, allowed while idle: no exact-alarm permission is needed, so it may arrive a few
// minutes late) and re-arms it after each delivery and after a reboot. Android 13+ asks for the notification
// permission the first time the reader turns the reminder on.
//
// Desktop apps and browsers have no reminder («Aa» shows «Solo en Android»).
// The notification is sent with `invoke('plugin:notification|notify')` rather than the package's
// sendNotification (which goes through the plugin's window.Notification shim and reports nothing back), so a
// failure reaches the settings panel.
//
// Since 0.12 it carries the app's own small monochrome icon (ICONO_RECORDATORIO, a vector drawable that
// web/scripts/android-preparar.mjs copies from src-tauri/recursos-android into the generated Android project)
// instead of Android's generic «i». It is set per notification, not as plugins.notification.icon in
// tauri.conf.json: the plugin's Rust side takes no configuration, and an object there stops the app at start-up.
// A reminder scheduled by 0.11 (stored without an icon) is scheduled again once (key «recordatorio-icono»).

import { invoke } from '@tauri-apps/api/core';
import { enTauri, obtenerAlmacen } from '../almacen';
import { usuario } from '../usuario.svelte';

export const ID_RECORDATORIO = 20110;
export const HORA_DEFECTO = '20:00';
export const TITULO_RECORDATORIO = 'Electrónica Práctica Avanzada';
export const TEXTO_RECORDATORIO = 'Unos minutos con la electrónica: le espera el problema del día.';
/** Where a tap on the reminder leads: the problem of the day it announces. */
export const RUTA_RECORDATORIO = '#/problema';
/** Name of the drawable resource of the notification's small icon (src-tauri/recursos-android/drawable). */
export const ICONO_RECORDATORIO = 'ic_stat_epa';
/** Per-device mark: the pending reminder was scheduled with ICONO_RECORDATORIO (not synchronised). */
const CLAVE_ICONO = 'recordatorio-icono';

/** The reminder exists only in the Android app. */
export function recordatorioDisponible(): boolean {
  return typeof window !== 'undefined' && enTauri() && /Android/i.test(navigator.userAgent);
}

/** «20:00» → { hour: 20, minute: 0 }, or null. */
export function leerHora(h: string): { hour: number; minute: number } | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(h.trim());
  if (!m) return null;
  const hour = Number(m[1]);
  const minute = Number(m[2]);
  return hour <= 23 && minute <= 59 ? { hour, minute } : null;
}

export type ResultadoRecordatorio = 'programado' | 'denegado' | 'no-disponible' | 'error';

async function permiso(pedir: boolean): Promise<boolean> {
  const concedido = await invoke<boolean | null>('plugin:notification|is_permission_granted');
  if (concedido) return true;
  if (!pedir) return false;
  const r = await invoke<string>('plugin:notification|request_permission');
  return r === 'granted';
}

async function programar(hora: string): Promise<void> {
  const h = leerHora(hora) ?? leerHora(HORA_DEFECTO)!;
  const { Schedule, cancel } = await import('@tauri-apps/plugin-notification');
  // one reminder only: the previous one (another time) goes first
  await cancel([ID_RECORDATORIO]).catch(() => undefined);
  await invoke('plugin:notification|notify', {
    options: {
      id: ID_RECORDATORIO,
      title: TITULO_RECORDATORIO,
      body: TEXTO_RECORDATORIO,
      // every day when the clock reads hh:mm; allowed in Doze, re-armed by the plugin after each delivery
      schedule: Schedule.interval({ hour: h.hour, minute: h.minute }, true),
      autoCancel: true,
      icon: ICONO_RECORDATORIO,
      extra: { ruta: RUTA_RECORDATORIO },
    },
  });
  await (await obtenerAlmacen()).escribir(CLAVE_ICONO, 1).catch(() => undefined);
}

/**
 * Turns the reminder on at `hora` (asking for the permission if needed) or off. The caller stores the
 * preference only when the result is «programado» (or when turning it off).
 */
export async function aplicarRecordatorio(activo: boolean, hora: string): Promise<ResultadoRecordatorio> {
  if (!recordatorioDisponible()) return 'no-disponible';
  try {
    if (!activo) {
      const { cancel } = await import('@tauri-apps/plugin-notification');
      await cancel([ID_RECORDATORIO]);
      return 'programado';
    }
    if (!(await permiso(true))) return 'denegado';
    await programar(hora);
    escucharToque();
    return 'programado';
  } catch (e) {
    console.warn('No se pudo programar el recordatorio', e);
    return 'error';
  }
}

let escuchando = false;

/** A tap on the reminder opens the problem of the day (when the app was in the background). */
function escucharToque(): void {
  if (escuchando) return;
  escuchando = true;
  void import('@tauri-apps/plugin-notification')
    .then(({ onAction }) =>
      onAction(() => {
        location.hash = RUTA_RECORDATORIO;
      }),
    )
    .catch(() => {
      escuchando = false;
    });
}

/**
 * At start-up (idle time, Android only): if the reminder is on but not pending (the app was reinstalled, the
 * permission was withdrawn and given back…), schedule it again without asking anything.
 */
export async function comprobarRecordatorio(): Promise<void> {
  const r = usuario.prefs.recordatorio;
  if (!r?.activo || !recordatorioDisponible()) return;
  try {
    if (!(await permiso(false))) return;
    const { pending } = await import('@tauri-apps/plugin-notification');
    const pendientes = await pending();
    const conIcono = (await (await obtenerAlmacen()).leer<number>(CLAVE_ICONO)) === 1;
    if (!pendientes.some((p) => p.id === ID_RECORDATORIO) || !conIcono) await programar(r.hora);
    escucharToque();
  } catch (e) {
    console.warn('No se pudo comprobar el recordatorio', e);
  }
}
