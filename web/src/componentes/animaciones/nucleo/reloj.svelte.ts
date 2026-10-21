// Play/pause and speed shared by a scene, its controls and its plots.

function prefiereQuieto(): boolean {
  try {
    return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

export class Reloj {
  /** Running (reduced-motion users start paused). */
  play = $state(!prefiereQuieto());
  /** Simulation speed multiplier. */
  velocidad = $state(1);
  /** Incremented by «Reiniciar»; scenes watch it to reset their state. */
  reinicios = $state(0);

  alternar(): void {
    this.play = !this.play;
  }

  reiniciar(): void {
    this.reinicios++;
  }
}

/**
 * Throttle for reactive readouts: physics runs every frame on plain variables, and the values shown in
 * the DOM are copied out at most every `ms` milliseconds.
 */
export class Muestreo {
  private ultimo = -1e9;
  constructor(private ms = 60) {}
  toca(ahora = performance.now()): boolean {
    if (ahora - this.ultimo < this.ms) return false;
    this.ultimo = ahora;
    return true;
  }
}
