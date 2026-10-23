// The multimeters' beeper with Web Audio: a continuous tone while continuity is detected, and short beeps.
// The AudioContext is created on the first user gesture (browsers do not allow sound before that).

let ctx: AudioContext | null = null;
let osc: OscillatorNode | null = null;
let gan: GainNode | null = null;
let silencio = false;

/** Call from a click or key handler: creates (or resumes) the audio context. */
export function prepararAudio(): void {
  try {
    if (!ctx) {
      const C = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!C) return;
      ctx = new C();
      gan = ctx.createGain();
      gan.gain.value = 0;
      gan.connect(ctx.destination);
      osc = ctx.createOscillator();
      osc.type = 'square';
      osc.frequency.value = 2730;
      osc.connect(gan);
      osc.start();
    }
    if (ctx.state === 'suspended') void ctx.resume();
  } catch {
    ctx = null;
  }
}

export function silenciar(s: boolean): void {
  silencio = s;
  if (s) tono(false);
}

/** Continuous tone on or off. */
export function tono(on: boolean): void {
  if (!ctx || !gan) return;
  const v = on && !silencio && document.visibilityState === 'visible' ? 0.05 : 0;
  gan.gain.setTargetAtTime(v, ctx.currentTime, 0.004);
}

/** A short beep (BeepJack, button feedback). */
export function pitido(ms = 120): void {
  if (!ctx || !gan || silencio) return;
  const t = ctx.currentTime;
  gan.gain.setTargetAtTime(0.05, t, 0.003);
  gan.gain.setTargetAtTime(0, t + ms / 1000, 0.004);
}
