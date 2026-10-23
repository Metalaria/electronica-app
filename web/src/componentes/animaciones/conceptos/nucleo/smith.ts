// Smith chart: grid drawing and the mapping between normalised impedance z = Z/Z₀ and Γ = (z − 1)/(z + 1).

import type { Vista } from '../../nucleo/dibujo';
import { txt } from '../../nucleo/dibujo';
import { alfa } from '../../nucleo/paleta';
import { c, div, suma, resta, type C } from './complejo';

export function gamma(z: C): C {
  return div(resta(z, c(1)), suma(z, c(1)));
}

export function zDeGamma(g: C): C {
  return div(suma(c(1), g), resta(c(1), g));
}

export interface Carta {
  cx: number;
  cy: number;
  R: number;
}

/** Γ → canvas point (upper half inductive, as in the book). */
export function aPunto(k: Carta, g: C): [number, number] {
  return [k.cx + g.re * k.R, k.cy - g.im * k.R];
}

/** Grid: resistance circles, reactance arcs, the real axis and a few labels. */
export function cartaSmith(v: Vista, k: Carta): void {
  const { ctx, pal } = v;
  ctx.save();
  ctx.beginPath();
  ctx.arc(k.cx, k.cy, k.R, 0, Math.PI * 2);
  ctx.fillStyle = pal.panel;
  ctx.fill();
  ctx.clip();
  ctx.strokeStyle = alfa(pal.tinta, 0.18);
  ctx.lineWidth = 1;
  // Constant-r circles: centre (r/(1+r), 0), radius 1/(1+r).
  for (const r of [0.2, 0.5, 1, 2, 5]) {
    ctx.beginPath();
    ctx.arc(k.cx + (k.R * r) / (1 + r), k.cy, k.R / (1 + r), 0, Math.PI * 2);
    ctx.stroke();
  }
  // Constant-x arcs: centre (1, 1/x), radius 1/|x|.
  for (const x of [0.2, 0.5, 1, 2, 5]) {
    for (const s of [1, -1]) {
      ctx.beginPath();
      ctx.arc(k.cx + k.R, k.cy - (s * k.R) / x, k.R / x, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
  ctx.beginPath();
  ctx.moveTo(k.cx - k.R, k.cy);
  ctx.lineTo(k.cx + k.R, k.cy);
  ctx.stroke();
  ctx.restore();
  ctx.strokeStyle = alfa(pal.tinta, 0.6);
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(k.cx, k.cy, k.R, 0, Math.PI * 2);
  ctx.stroke();
  for (const r of [0.2, 0.5, 1, 2, 5]) {
    const [x] = aPunto(k, gamma(c(r)));
    txt(v, String(r).replace('.', ','), x + 2, k.cy + 8, { tam: 9.5, color: pal.suave, alin: 'left' });
  }
  txt(v, 'corto', k.cx - k.R + 2, k.cy - 9, { tam: 9.5, color: pal.suave, alin: 'left' });
  txt(v, 'abierto', k.cx + k.R - 2, k.cy - 9, { tam: 9.5, color: pal.suave, alin: 'right' });
  txt(v, 'inductiva', k.cx, k.cy - k.R * 0.62, { tam: 10, color: pal.suave });
  txt(v, 'capacitiva', k.cx, k.cy + k.R * 0.62, { tam: 10, color: pal.suave });
}
