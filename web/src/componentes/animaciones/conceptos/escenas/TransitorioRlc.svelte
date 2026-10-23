<script lang="ts">
  // Second-order step response (book 23.3, 23.1, 0.8, 0.10): a series RLC connected to a DC source. The
  // damping factor ζ = (R/2)·√(C/L) decides the shape: overdamped (two exponentials), critical (the fastest
  // without overshoot) or underdamped (overshoot e^(−πζ/√(1−ζ²)), 53 % with ζ = 0,2). The complete response is
  // the forced one (the source) plus the natural one (the circuit), and the energy goes back and forth between
  // C (½·C·v²) and L (½·L·i²) while R burns it. Book examples: 10 Ω, 1 mH, 1 µF (ζ = 0,158, f₀ = 5,03 kHz) and
  // 220 Ω, 10 mH, 1 µF (ζ = 1,1). The poles of L·s² + R·s + 1/C = 0 are shown in the s plane.
  import Escena from '../../ui/Escena.svelte';
  import Marco from '../../ui/Marco.svelte';
  import Deslizador from '../../ui/Deslizador.svelte';
  import Selector from '../../ui/Selector.svelte';
  import { Reloj, Muestreo } from '../../nucleo/reloj.svelte';
  import { txt, txtRico, type Vista } from '../../nucleo/dibujo';
  import { hilo, resistencia, condensador, bobina, bateria, interruptor } from '../../nucleo/esquema';
  import { alfa, paleta } from '../../nucleo/paleta';
  import { si, num, pct } from '../../nucleo/formato';
  import { app } from '../../../../lib/estado.svelte';
  import { estatico, panel, curva, guia, punto, X, Y, type Ejes } from '../nucleo/grafica';
  import { corriente, barra } from '../nucleo/simbolos';

  const reloj = new Reloj();
  const pal = $derived(paleta(app.tema));

  let R = $state(10);
  let L = $state(1e-3);
  let C = $state(1e-6);
  const V = 5;
  let ejemplo = $state<'0.8' | '23.2' | '23.5' | 'critico' | 'libre'>('0.8');

  $effect(() => {
    if (ejemplo === '0.8') {
      R = 10;
      L = 1e-3;
      C = 1e-6;
    } else if (ejemplo === '23.2') {
      R = 220;
      L = 10e-3;
      C = 1e-6;
    } else if (ejemplo === '23.5') {
      L = 1e-3;
      C = 1e-6;
      R = 0.4 * Math.sqrt(L / C); // ζ = 0,2
    } else if (ejemplo === 'critico') {
      L = 1e-3;
      C = 1e-6;
      R = 2 * Math.sqrt(L / C);
    }
  });

  // Moving a slider leaves the book example.
  $effect(() => {
    const ref: Record<string, [number, number, number]> = {
      '0.8': [10, 1e-3, 1e-6],
      '23.2': [220, 10e-3, 1e-6],
      '23.5': [0.4 * Math.sqrt(1e-3 / 1e-6), 1e-3, 1e-6],
      critico: [2 * Math.sqrt(1e-3 / 1e-6), 1e-3, 1e-6],
    };
    const r = ref[ejemplo];
    if (r && (Math.abs(R / r[0] - 1) > 1e-9 || Math.abs(L / r[1] - 1) > 1e-9 || Math.abs(C / r[2] - 1) > 1e-9)) ejemplo = 'libre';
  });

  const m = $derived.by(() => {
    const w0 = 1 / Math.sqrt(L * C);
    const zeta = (R / 2) * Math.sqrt(C / L);
    const a = zeta * w0;
    let s1: [number, number];
    let s2: [number, number];
    if (zeta < 1) {
      const wd = w0 * Math.sqrt(1 - zeta * zeta);
      s1 = [-a, wd];
      s2 = [-a, -wd];
    } else {
      const r = w0 * Math.sqrt(zeta * zeta - 1);
      s1 = [-a + r, 0];
      s2 = [-a - r, 0];
    }
    // Time span: until the slowest mode has decayed to ~0,3 %, at most 12 natural periods.
    const lento = Math.min(Math.abs(s1[0]), Math.abs(s2[0]));
    const T = Math.min(6 / lento, (12 * 2 * Math.PI) / w0, 60 / w0 + 6 / lento);
    return { w0, zeta, a, s1, s2, T };
  });

  /** v_C(t) and i(t) for a step V at t = 0 from rest. */
  function resp(t: number): { vc: number; i: number } {
    const { w0, zeta, a, s1, s2 } = m;
    if (t <= 0) return { vc: 0, i: 0 };
    if (Math.abs(zeta - 1) < 1e-6) {
      const ex = Math.exp(-a * t);
      return { vc: V * (1 - ex * (1 + a * t)), i: (V / L) * t * ex };
    }
    if (zeta < 1) {
      const wd = s1[1];
      const ex = Math.exp(-a * t);
      return { vc: V * (1 - ex * (Math.cos(wd * t) + (a / wd) * Math.sin(wd * t))), i: (V / (L * wd)) * ex * Math.sin(wd * t) };
    }
    const p1 = s1[0];
    const p2 = s2[0];
    const e1 = Math.exp(p1 * t);
    const e2 = Math.exp(p2 * t);
    void w0;
    return { vc: V * (1 + (p2 * e1 - p1 * e2) / (p1 - p2)), i: C * V * ((p1 * p2) / (p1 - p2)) * (e1 - e2) };
  }

  // Animation: the time cursor sweeps the span in 6 s, waits 1,5 s and the switch closes again.
  const BARRIDO = 6;
  let tc = 0;
  let fase = 0;
  let calor = 0;
  let n = $state(0);
  const muestreo = new Muestreo(80);
  $effect(() => {
    void [R, L, C];
    tc = 0;
    calor = 0;
  });
  $effect(() => {
    if (reloj.reinicios >= 0) {
      tc = 0;
      calor = 0;
    }
  });
  function paso(dt: number): void {
    const antes = tc;
    tc += dt;
    if (tc > BARRIDO + 1.5) {
      tc = 0;
      calor = 0;
    }
    const t0 = (Math.min(antes, BARRIDO) / BARRIDO) * m.T;
    const t1 = (Math.min(tc, BARRIDO) / BARRIDO) * m.T;
    if (t1 > t0) {
      // Joule heat by the trapezoid rule over the real-time interval.
      const i0 = resp(t0).i;
      const i1 = resp(t1).i;
      calor += ((i0 * i0 + i1 * i1) / 2) * R * (t1 - t0);
    }
    const { i } = resp(t1);
    fase += (dt * Math.abs(i) * 60) / Math.max(V / Math.max(R, Math.sqrt(L / C)), 1e-9);
    if (muestreo.toca()) n++;
  }

  const curvas = $derived.by(() => {
    const N = 400;
    const t = new Float64Array(N + 1);
    const vc = new Float64Array(N + 1);
    const nat = new Float64Array(N + 1);
    const ii = new Float64Array(N + 1);
    let imax = 1e-12;
    for (let k = 0; k <= N; k++) {
      const tt = (k / N) * m.T;
      const r = resp(tt);
      t[k] = tt;
      vc[k] = r.vc;
      nat[k] = r.vc - V;
      ii[k] = r.i;
      imax = Math.max(imax, Math.abs(r.i));
    }
    let vmax = V;
    for (const x of vc) vmax = Math.max(vmax, x);
    return { t, vc, nat, ii, imax, vmax };
  });

  function dibujar(v: Vista): void {
    void n;
    const { ctx } = v;
    const p = pal;
    const est = v.estrecho;
    const tAhora = (Math.min(tc, BARRIDO) / BARRIDO) * m.T;
    const r = resp(tAhora);
    const cv = curvas;
    const eV: Ejes = est
      ? { x: 66, y: 325, w: 500, h: 150, x0: 0, x1: m.T, y0: -V * 1.05, y1: Math.max(cv.vmax, V) * 1.08 }
      : { x: 450, y: 40, w: 420, h: 200, x0: 0, x1: m.T, y0: -V * 1.05, y1: Math.max(cv.vmax, V) * 1.08 };
    const eI: Ejes = est
      ? { x: 66, y: 530, w: 500, h: 90, x0: 0, x1: m.T, y0: -cv.imax * 1.1, y1: cv.imax * 1.1 }
      : { x: 450, y: 290, w: 420, h: 120, x0: 0, x1: m.T, y0: -cv.imax * 1.1, y1: cv.imax * 1.1 };
    // s plane: poles relative to ω₀.
    const sp = est ? { x: 400, y: 30, w: 170, h: 150 } : { x: 110, y: 300, w: 200, h: 130 };
    const ePol: Ejes = { ...sp, x0: -3, x1: 0.5, y0: -1.3, y1: 1.3 };
    estatico(v, `tr:${est}:${m.T}:${eV.y1}:${eI.y1}`, (vv) => {
      panel(vv, eV, { titulo: 'v_C(t) = forzada + natural', ux: 's', uy: 'V', cero: true });
      panel(vv, eI, { titulo: 'i(t)', ux: 's', uy: 'A', cero: true });
      panel(vv, ePol, { titulo: est ? 'Polos (÷ω_0)' : 'Polos en el plano s (÷ω_0)', sinX: true, sinY: true, cero: true, marcasX: [-3, -2, -1, 0], marcasY: [-1, 0, 1] });
      txt(vv, 'σ', ePol.x + ePol.w - 6, Y(ePol, 0) - 9, { tam: 11.5, color: p.suave, alin: 'right' });
      txt(vv, 'jω', X(ePol, 0) + 5, ePol.y + 8, { tam: 11.5, color: p.suave, alin: 'left' });
      // Circuit wires.
      hilo(vv, [[40, 50], [330, 50], [330, 170], [40, 170], [40, 50]]);
    });
    // Circuit.
    bateria(v, 40, 125, 40, 95, {});
    txt(v, `${V} V`, 58, 110, { tam: 12, color: p.suave, alin: 'left' });
    interruptor(v, 60, 50, 110, 50, tc > 0.02 ? 1 : 0);
    resistencia(v, 125, 50, 195, 50, { largo: 50, alto: 16 });
    bobina(v, 210, 50, 290, 50, { largo: 56 });
    condensador(v, 330, 95, 330, 125, { placa: 34 });
    txtRico(v, `R ${si(R, 'Ω', 3)}`, 160, 28, { tam: 12, peso: 700 });
    txtRico(v, `L ${si(L, 'H', 3)}`, 250, 28, { tam: 12, peso: 700 });
    txtRico(v, `C ${si(C, 'F', 3)}`, 322, 145, { tam: 12, peso: 700, alin: 'right' });
    corriente(v, [[40, 170], [40, 50], [330, 50], [330, 170], [40, 170]], fase, r.i, 44, 10, cv.imax * 0.02);
    // Plate charge.
    const qn = Math.round(Math.min(10, Math.abs(r.vc / V) * 6));
    for (let k2 = 0; k2 < qn; k2++) {
      const xx = 314 + (32 * (k2 + 0.5)) / qn;
      txt(v, r.vc >= 0 ? '+' : '−', xx, 86, { tam: 10, peso: 800, color: p.positivo });
    }
    // Energy bars.
    const eC = 0.5 * C * r.vc * r.vc;
    const eL = 0.5 * L * r.i * r.i;
    const eTot = Math.max(0.5 * C * cv.vmax * cv.vmax, 0.5 * C * V * V * 2, 1e-15);
    const by = 200;
    const bw = est ? 260 : 300;
    txt(v, 'Energía', 40, by, { tam: 12, peso: 700, color: p.suave, alin: 'left' });
    const filas: [string, number, string][] = [
      ['½·C·v²', eC, p.serie[1]],
      ['½·L·i²', eL, p.serie[2]],
      ['calor en R', calor, p.calor],
    ];
    filas.forEach(([et, val, c], k2) => {
      const y = by + 14 + k2 * 22;
      txtRico(v, et, 40 + 74, y + 7, { tam: 11.5, alin: 'right', color: p.suave });
      barra(v, 40 + 82, y, bw - 82, 14, val / eTot, c);
      txt(v, si(val, 'J', 3), 40 + bw + 6, y + 7, { tam: 11.5, alin: 'left', peso: 700, color: c });
    });

    // Plots.
    curva(ctx, eV, [0, m.T], [V, V], alfa(p.tinta, 0.5), 1.4, [6, 4]);
    curva(ctx, eV, cv.t, cv.nat, alfa(p.serie[4], 0.8), 1.6, [3, 3]);
    curva(ctx, eV, cv.t, cv.vc, p.serie[1], 2.4);
    curva(ctx, eI, cv.t, cv.ii, p.corriente, 2.2);
    guia(ctx, eV, 'x', tAhora, alfa(p.tinta, 0.4));
    guia(ctx, eI, 'x', tAhora, alfa(p.tinta, 0.4));
    punto(ctx, eV, tAhora, r.vc, p.serie[1], 5, p.fondo);
    punto(ctx, eI, tAhora, r.i, p.corriente, 5, p.fondo);
    txtRico(v, 'forzada V', eV.x + eV.w - 4, Y(eV, V) - 9, { tam: 11.5, color: p.suave, alin: 'right' });
    txtRico(v, 'natural', eV.x + eV.w - 4, Y(eV, -V * 0.15) + 12, { tam: 11.5, color: p.serie[4], alin: 'right' });
    // Poles.
    for (const s of [m.s1, m.s2]) {
      const sx = X(ePol, s[0] / m.w0);
      const sy = Y(ePol, s[1] / m.w0);
      if (sx < ePol.x - 4) {
        txt(v, '← polo lejano', ePol.x + 4, sy, { tam: 11, color: p.peligro, alin: 'left' });
        continue;
      }
      ctx.strokeStyle = p.peligro;
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(sx - 6, sy - 6);
      ctx.lineTo(sx + 6, sy + 6);
      ctx.moveTo(sx - 6, sy + 6);
      ctx.lineTo(sx + 6, sy - 6);
      ctx.stroke();
    }
  }

  const sobre = $derived(m.zeta < 1 ? Math.exp((-Math.PI * m.zeta) / Math.sqrt(1 - m.zeta * m.zeta)) : 0);

  const texto = $derived.by(() => {
    const z = m.zeta;
    const caso =
      Math.abs(z - 1) < 0.01
        ? '**Amortiguamiento crítico** (ζ = 1): lo más rápido sin pasarse.'
        : z > 1
          ? `**Sobreamortiguado** (ζ = ${num(z, 3)} > 1): dos exponenciales reales, sin oscilación y lento.`
          : `**Subamortiguado** (ζ = ${num(z, 3)} < 1): oscila a ${si(m.s1[1] / (2 * Math.PI), 'Hz', 3)} amortiguándose; sobreimpulso e^{−πζ/√(1−ζ²)} = ${pct(sobre, 1)}.`;
    return (
      `${caso} ζ = (R/2)·√(C/L) y ω_0 = 1/√(LC) = ${si(m.w0, 'rad/s', 3)} (f_0 = ${si(m.w0 / (2 * Math.PI), 'Hz', 3)}); Q = 1/(2ζ) = ${num(1 / (2 * z), 2)}.\n` +
      `La respuesta completa es la **forzada** (los ${V} V de la fuente) más la **natural** (lo que el circuito hace por sí mismo, que siempre se extingue). La energía va y viene entre el condensador y la bobina; la resistencia la gasta en cada ida y vuelta.\n` +
      `Los polos (raíces de L·s² + R·s + 1/C = 0) están ${z < 1 ? 'fuera del eje real: hay oscilación' : 'sobre el eje real: no hay oscilación'}, y en el semiplano izquierdo: la respuesta natural decae.`
    );
  });

  const lecturas = $derived([
    { e: 'ζ', v: num(m.zeta, 3), c: pal.acento },
    { e: 'Q = 1/(2ζ)', v: num(1 / (2 * m.zeta), 2) },
    { e: 'f_0', v: si(m.w0 / (2 * Math.PI), 'Hz', 3) },
    { e: 'Sobreimpulso', v: m.zeta < 1 ? pct(sobre, 1) : '0 %', c: pal.serie[1] },
    { e: 'Corriente máxima', v: si(curvas.imax, 'A', 3), c: pal.corriente },
  ]);
</script>

<Marco {reloj} {texto} {lecturas} leyenda={['corriente']}>
  {#snippet escena()}
    <Escena {reloj} {paso} {dibujar} dims={(a) => (a < 560 ? [600, 650] : [900, 450])} etiqueta="Respuesta al escalón de un circuito RLC serie" />
  {/snippet}
  {#snippet controles()}
    <Selector
      etiqueta="Ejemplo"
      bind:valor={ejemplo}
      opciones={[
        { valor: '0.8', texto: 'Sección 0.8 (ζ = 0,158)' },
        { valor: '23.5', texto: 'Figura 23.5 (ζ = 0,2)' },
        { valor: 'critico', texto: 'Crítico (ζ = 1)' },
        { valor: '23.2', texto: 'Ejercicio 23.2 (ζ = 1,1)' },
        { valor: 'libre', texto: 'Libre' },
      ]}
    />
    <Deslizador etiqueta="R" bind:valor={R} min={1} max={1000} log unidad="Ω" />
    <Deslizador etiqueta="L" bind:valor={L} min={100e-6} max={100e-3} log unidad="H" />
    <Deslizador etiqueta="C" bind:valor={C} min={10e-9} max={100e-6} log unidad="F" />
  {/snippet}
</Marco>
