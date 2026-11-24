// The recorder of the real instruments, one for the whole app: while a panel shows it or a record is under way it
// takes each reading the two connections (the real Brymen's and the real FNIRSI's) publish, as they publish it, and
// hands it to the bookkeeping (nucleo.ts). A clock ten times a second is kept only to notice that a reading has
// gone stale. (At first the clock did all the work; with the browser's window behind another one the browser slows
// every clock to once a second, and a real record lost five of every six readings of the FNIRSI for as long.) The record goes on when the reader leaves the bench; it stops with «Detener», when
// a series is full, or when the page is closed (nothing is saved: the reader saves it as a file).
//
// The bookkeeping's data are plain objects (tens of thousands of samples are not made reactive): `version` is what
// the page watches to look at them again.

import { untrack } from 'svelte';
import { brymenReal } from '../brymen-real/conexion.svelte';
import { fnirsiReal } from '../fnirsi-real/conexion.svelte';
import { migaAccion } from '../informe-fallos';
import { NucleoRegistro, type Fuentes } from './nucleo.ts';
import type { InstrumentoReal } from './registro.ts';

/** How often the clock looks (what it is for: a connection that stops publishing publishes nothing to notice). */
const PASO_MS = 100;

const FUENTES: Fuentes = {
  brymen: (ahora) => {
    const lectura = brymenReal.vigente(ahora);
    return lectura ? { lectura, hora: brymenReal.hora } : null;
  },
  fnirsi: (ahora) => {
    const lectura = fnirsiReal.modo === 'multimetro' ? fnirsiReal.multimetroVigente(ahora) : null;
    return lectura ? { lectura, hora: fnirsiReal.horaMultimetro } : null;
  },
};

class RegistradorReal {
  readonly nucleo = new NucleoRegistro();
  /** Bumped whenever the bookkeeping changed. */
  version = $state(0);

  private paneles = 0;
  private reloj: ReturnType<typeof setInterval> | null = null;
  /** Ends the watch on what the connections publish. */
  private dejarDeMirar: (() => void) | null = null;

  /** A panel is showing the recorder: it is kept up to date until the function returned is called. */
  mostrar(): () => void {
    this.paneles++;
    this.ajustar();
    let hecho = false;
    return () => {
      if (hecho) return;
      hecho = true;
      this.paneles--;
      this.ajustar();
    };
  }

  iniciar(): boolean {
    migaAccion('registro real: iniciar');
    const ok = this.nucleo.iniciar(Date.now());
    this.cambio();
    return ok;
  }

  detener(): void {
    migaAccion('registro real: detener');
    this.nucleo.detener();
    this.cambio();
  }

  reiniciarCifras(): void {
    migaAccion('registro real: reiniciar cifras');
    this.nucleo.reiniciarCifras();
    this.cambio();
  }

  borrar(): void {
    migaAccion('registro real: borrar');
    this.nucleo.borrar();
    this.cambio();
  }

  retener(i: InstrumentoReal): void {
    this.nucleo.retener(i);
    this.cambio();
  }

  soltar(i: InstrumentoReal): void {
    this.nucleo.soltar(i);
    this.cambio();
  }

  anotar(): void {
    migaAccion('registro real: anotar comparación');
    this.nucleo.anotar(Date.now());
    this.cambio();
  }

  vaciarTabla(): void {
    this.nucleo.vaciarTabla();
    this.cambio();
  }

  private cambio(): void {
    this.version++;
    this.ajustar();
  }

  private ajustar(): void {
    const hace = this.paneles > 0 || this.nucleo.grabando;
    if (hace && !this.reloj) {
      this.reloj = setInterval(() => this.paso(), PASO_MS);
      // each new reading as it is published (the times are what changes with every one of them)
      this.dejarDeMirar = $effect.root(() => {
        $effect(() => {
          void brymenReal.hora;
          void fnirsiReal.horaMultimetro;
          untrack(() => this.paso());
        });
      });
    } else if (!hace && this.reloj) {
      clearInterval(this.reloj);
      this.reloj = null;
      this.dejarDeMirar?.();
      this.dejarDeMirar = null;
    }
  }

  private paso(): void {
    const grababa = this.nucleo.grabando;
    if (this.nucleo.paso(FUENTES, Date.now()) || grababa !== this.nucleo.grabando) this.version++;
    // (a record that stopped by itself with no panel showing: nothing left to look at)
    if (grababa && !this.nucleo.grabando) this.ajustar();
  }
}

export const registradorReal = new RegistradorReal();
