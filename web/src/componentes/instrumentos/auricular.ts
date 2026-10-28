// The earphone (0.10): plays what motor/escucha.ts prepared through Web Audio. Chain: buffer source (looped
// for a periodic signal) → gain (volume, as a signal tracer's: 0 dB = 1 V peak drives the limiter fully)
// → soft limiter (tanh wave shaper: loud signals are squashed, never clipped hard) → output level → an
// analyser (its level, for the level meter and the tests) → speakers. The AudioContext is created or resumed
// only from a user gesture (Android and every browser require it), and everything stops when the view is
// left or hidden.

import type { Sonido } from './motor/escucha.ts';

/** Volts at 0 dB that reach the limiter's knee. */
const SENSIBILIDAD = 0.5;
const SALIDA = 0.45;

class Auricular {
  private ctx: AudioContext | null = null;
  private fuente: AudioBufferSourceNode | null = null;
  private entrada: GainNode | null = null;
  private analizador: AnalyserNode | null = null;
  private db = 0;
  /** Playing now. */
  sonando = false;

  /** From a click or tap: creates (or resumes) the audio context. False when there is no Web Audio. */
  preparar(): boolean {
    try {
      if (!this.ctx) {
        const C = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!C) return false;
        const ctx = new C();
        const entrada = ctx.createGain();
        const limitador = ctx.createWaveShaper();
        const n = 2048;
        const curva = new Float32Array(n);
        for (let i = 0; i < n; i++) {
          const x = (i / (n - 1)) * 2 - 1;
          curva[i] = Math.tanh(2.5 * x) / Math.tanh(2.5);
        }
        limitador.curve = curva;
        limitador.oversample = '2x';
        const salida = ctx.createGain();
        salida.gain.value = SALIDA;
        const analizador = ctx.createAnalyser();
        analizador.fftSize = 2048;
        entrada.connect(limitador).connect(salida).connect(analizador).connect(ctx.destination);
        this.ctx = ctx;
        this.entrada = entrada;
        this.analizador = analizador;
        this.aplicarVolumen();
      }
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return true;
    } catch {
      this.ctx = null;
      return false;
    }
  }

  /** Audio sample rate (48 kHz before the context exists). */
  get tasa(): number {
    return this.ctx?.sampleRate ?? 48000;
  }

  get disponible(): boolean {
    return !!this.ctx;
  }

  /** Volume in dB (−20 … +40). */
  volumen(db: number): void {
    this.db = db;
    this.aplicarVolumen();
  }

  private aplicarVolumen(): void {
    if (!this.ctx || !this.entrada) return;
    const g = Math.pow(10, this.db / 20) * (1 / (2 * SENSIBILIDAD));
    this.entrada.gain.setTargetAtTime(g, this.ctx.currentTime, 0.02);
  }

  /** Plays samples (V) made at `tasa` Hz; a loop until stopped, or once. */
  tocar(s: Sonido, tasa = this.tasa): void {
    if (!this.ctx || !this.entrada || !s.muestras.length) return;
    this.quitarFuente();
    const buf = this.ctx.createBuffer(1, s.muestras.length, tasa);
    buf.copyToChannel(s.muestras as Float32Array<ArrayBuffer>, 0);
    const f = this.ctx.createBufferSource();
    f.buffer = buf;
    f.loop = s.bucle;
    f.connect(this.entrada);
    f.onended = () => {
      if (this.fuente === f) {
        this.fuente = null;
        this.sonando = false;
      }
    };
    f.start();
    this.fuente = f;
    this.sonando = true;
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  private quitarFuente(): void {
    if (!this.fuente) return;
    try {
      this.fuente.onended = null;
      this.fuente.stop();
    } catch {
      /* already stopped */
    }
    this.fuente.disconnect();
    this.fuente = null;
  }

  /** Silence (the context stays, suspended, for the next gesture). */
  parar(): void {
    this.quitarFuente();
    this.sonando = false;
    if (this.ctx && this.ctx.state === 'running') void this.ctx.suspend();
  }

  /** RMS level at the output (0 … 1): the level meter, and the tests. */
  nivel(): number {
    // (a suspended context keeps its last buffer in the analyser: silence is silence)
    if (!this.analizador || !this.sonando || this.ctx?.state !== 'running') return 0;
    const d = new Float32Array(this.analizador.fftSize);
    this.analizador.getFloatTimeDomainData(d);
    let s = 0;
    for (const v of d) s += v * v;
    return Math.sqrt(s / d.length);
  }
}

export const auricular = new Auricular();

if (typeof window !== 'undefined') (window as unknown as { __epaAuricular?: Auricular }).__epaAuricular = auricular;
