// Sound and vibration feedback (0.11): a short, quiet cue for a right answer, a wrong one, a finished lesson, a
// new level, an achievement and a step of a guided breadboard circuit. Each can be switched off on its own in
// «Aa» («Sonidos», «Vibración»; device-only preferences, on by default).
//
// Sounds are synthesised with Web Audio (a few sine/triangle notes with soft envelopes; no audio files). As in
// componentes/instrumentos/audio.ts the AudioContext is created lazily, on the first cue (always inside a tap,
// so the browser allows it); it is suspended again a moment after the last cue, so nothing runs while idle.
// Vibration: tauri-plugin-haptics on Android (the plugin declares the VIBRATE permission), else
// navigator.vibrate where the browser has it; desktop apps have neither and stay silent.

import { usuario } from '../usuario.svelte';
import { enTauri } from '../almacen';

export type Retro = 'acierto' | 'fallo' | 'leccion' | 'nivel' | 'logro' | 'paso';

/** [start (s), frequency (Hz), duration (s), waveform, relative volume, glide to (Hz)?] */
type Nota = [number, number, number, OscillatorType, number, number?];

const SONIDOS: Record<Retro, Nota[]> = {
  // two quick rising notes (E5 → B5)
  acierto: [
    [0, 659.25, 0.12, 'sine', 0.9],
    [0.075, 987.77, 0.18, 'sine', 0.75],
  ],
  // a soft low «bump» that falls a little (never a buzzer)
  fallo: [[0, 207.65, 0.2, 'triangle', 0.9, 174.61]],
  // C major arpeggio, the last note held
  leccion: [
    [0, 523.25, 0.14, 'sine', 0.8],
    [0.09, 659.25, 0.14, 'sine', 0.8],
    [0.18, 783.99, 0.14, 'sine', 0.8],
    [0.27, 1046.5, 0.42, 'sine', 0.75],
    [0.27, 523.25, 0.42, 'triangle', 0.25],
  ],
  // a faster, higher run with a light shimmer on top
  nivel: [
    [0, 392.0, 0.12, 'sine', 0.75],
    [0.07, 523.25, 0.12, 'sine', 0.75],
    [0.14, 659.25, 0.12, 'sine', 0.75],
    [0.21, 783.99, 0.12, 'sine', 0.75],
    [0.28, 1046.5, 0.5, 'sine', 0.8],
    [0.32, 2093.0, 0.4, 'sine', 0.18],
  ],
  // a small bell: fundamental and fifth, then the third
  logro: [
    [0, 1046.5, 0.55, 'sine', 0.6],
    [0, 1567.98, 0.35, 'sine', 0.25],
    [0.13, 1318.51, 0.6, 'sine', 0.5],
  ],
  // a light tick (A5 → D6)
  paso: [
    [0, 880.0, 0.07, 'sine', 0.55],
    [0.05, 1174.66, 0.1, 'sine', 0.45],
  ],
};

/** Vibration patterns (ms on, off, on…) for navigator.vibrate. */
export const VIBRACIONES: Record<Retro, number[]> = {
  acierto: [15],
  fallo: [35, 50, 35],
  leccion: [25, 40, 25, 40, 50],
  nivel: [40, 50, 40, 50, 90],
  logro: [30, 40, 60],
  paso: [12],
};

/** Peak level of every cue: quiet, under speech level on a tablet at mid volume. */
const VOLUMEN = 0.16;

let ctx: AudioContext | null = null;
let salida: GainNode | null = null;
let pausa: ReturnType<typeof setTimeout> | null = null;

function contexto(): AudioContext | null {
  try {
    if (!ctx) {
      const C = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!C) return null;
      ctx = new C();
      salida = ctx.createGain();
      salida.gain.value = VOLUMEN;
      salida.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') void ctx.resume().catch(() => undefined);
    return ctx;
  } catch {
    ctx = null;
    return null;
  }
}

/** Schedules the suspension of the context `ms` after now (nothing runs while idle). */
function suspenderTras(ms: number): void {
  if (pausa) clearTimeout(pausa);
  pausa = setTimeout(() => {
    pausa = null;
    if (ctx?.state === 'running') void ctx.suspend().catch(() => undefined);
  }, ms);
}

/**
 * Call at the start of a tap whose cue comes after something asynchronous (a check that simulates): creates or
 * resumes the context inside the gesture, as the Android WebView requires for audio.
 */
export function prepararSonido(): void {
  if (usuario.prefs.sonido === false || typeof window === 'undefined') return;
  if (contexto()) suspenderTras(8000);
}

/** Plays a cue (if sounds are on and the page is visible). Returns whether it was scheduled. */
export function sonar(tipo: Retro): boolean {
  if (usuario.prefs.sonido === false || typeof document === 'undefined' || document.visibilityState !== 'visible') return false;
  const c = contexto();
  if (!c || !salida) return false;
  const t0 = c.currentTime + 0.01;
  let fin = 0;
  for (const [ini, f, dur, forma, vol, hasta] of SONIDOS[tipo]) {
    const o = c.createOscillator();
    const g = c.createGain();
    const a = t0 + ini;
    o.type = forma;
    o.frequency.setValueAtTime(f, a);
    if (hasta) o.frequency.exponentialRampToValueAtTime(hasta, a + dur);
    g.gain.setValueAtTime(0.0001, a);
    g.gain.exponentialRampToValueAtTime(vol, a + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, a + dur);
    o.connect(g);
    g.connect(salida);
    o.start(a);
    o.stop(a + dur + 0.03);
    // the nodes are released when the oscillator ends
    o.onended = () => {
      o.disconnect();
      g.disconnect();
    };
    fin = Math.max(fin, ini + dur);
  }
  // Suspend the context shortly after the last cue: no audio thread running while idle.
  suspenderTras(Math.round(fin * 1000) + 1200);
  return true;
}

const esAndroidTauri = (): boolean => enTauri() && /Android/i.test(navigator.userAgent);

/** Vibrates (if vibration is on and the device can). Returns whether it was requested. */
export function vibrar(tipo: Retro): boolean {
  if (usuario.prefs.vibracion === false || typeof navigator === 'undefined') return false;
  if (esAndroidTauri()) {
    void import('@tauri-apps/plugin-haptics')
      .then((h) => {
        if (tipo === 'acierto') return h.impactFeedback('light');
        if (tipo === 'paso') return h.selectionFeedback();
        if (tipo === 'fallo') return h.notificationFeedback('error');
        return h.notificationFeedback('success');
      })
      .catch(() => {
        // the plugin is missing (an older build): the WebView's own vibration, if any
        try {
          navigator.vibrate?.(VIBRACIONES[tipo]);
        } catch {
          /* no vibration */
        }
      });
    return true;
  }
  if (typeof navigator.vibrate !== 'function') return false;
  try {
    return navigator.vibrate(VIBRACIONES[tipo]);
  } catch {
    return false;
  }
}

/** Sound and vibration together. */
export function retro(tipo: Retro): void {
  sonar(tipo);
  vibrar(tipo);
}

/** The cue of a learning event (called by eventos.ts → emitir, synchronously, inside the user's gesture). */
export function retroDe(e: { tipo: string; correcta?: boolean; origen?: string }): void {
  switch (e.tipo) {
    case 'respuesta':
      retro(e.correcta ? 'acierto' : 'fallo');
      break;
    case 'leccion-completada':
    case 'circuito-montado':
      retro('leccion');
      break;
    case 'paso-montaje':
      retro('paso');
      break;
  }
}
