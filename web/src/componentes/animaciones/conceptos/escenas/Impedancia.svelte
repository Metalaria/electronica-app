<script lang="ts">
  // Impedance of a series RC, RL or RLC (book 0.9 and 23.4): Z = R + j(ωL − 1/(ωC)) drawn as a triangle whose
  // sides, times the current, are the voltage phasors V_R, V_L, V_C. Book example: 1 kΩ and 100 nF at 1 kHz →
  // X_C = 1592 Ω, |Z| = 1880 Ω, −57,9°, 0,532 mA with 1 V rms; with L = 10 mH, X_L = 62,83 Ω.
  // The sinusoids are shown in slow motion (one period every 3 s).
  import Escena from '../../ui/Escena.svelte';
  import Marco from '../../ui/Marco.svelte';
  import Deslizador from '../../ui/Deslizador.svelte';
  import Selector from '../../ui/Selector.svelte';
  import { Reloj, Muestreo } from '../../nucleo/reloj.svelte';
  import { txt, txtRico, flecha, type Vista } from '../../nucleo/dibujo';
  import { hilo, resistencia, condensador, bobina, fuente } from '../../nucleo/esquema';
  import { alfa, paleta } from '../../nucleo/paleta';
  import { si, num } from '../../nucleo/formato';
  import { app } from '../../../../lib/estado.svelte';
  import { estatico, panel, curva, guia, type Ejes } from '../nucleo/grafica';
  import { corriente } from '../nucleo/simbolos';

  const reloj = new Reloj();
  const pal = $derived(paleta(app.tema));

  let tipo = $state<'rc' | 'rl' | 'rlc'>('rc');
  let R = $state(1000);
  let C = $state(100e-9);
  let L = $state(10e-3);
  let f = $state(1000);
  const VEF = 1;

  const z = $derived.by(() => {
    const w = 2 * Math.PI * f;
    const XL = tipo === 'rc' ? 0 : w * L;
    const XC = tipo === 'rl' ? 0 : 1 / (w * C);
    const X = XL - XC;
    const Zm = Math.hypot(R, X);
    const fi = Math.atan2(X, R);
    const I = VEF / Zm;
    return { XL, XC, X, Zm, fi, I };
  });

  const PER = 3;
  let th = 0;
  let fase = 0;
  let n = $state(0);
  const muestreo = new Muestreo(80);
  function paso(dt: number): void {
    th = (th + (2 * Math.PI * dt) / PER) % (2 * Math.PI);
    fase += dt * 50 * Math.abs(Math.cos(th - z.fi));
    if (muestreo.toca()) n++;
  }

  function dibujar(v: Vista): void {
    void n;
    const { ctx } = v;
    const p = pal;
    const est = v.estrecho;
    const { XL, XC, X, Zm, fi, I } = z;
    // Circuit (top left).
    const x0 = 50;
    const x1 = est ? 310 : 330;
    const yT = 40;
    const yB = 170;
    const ym = (yT + yB) / 2;
    const e: Ejes = est
      ? { x: 70, y: 450, w: 500, h: 130, x0: 0, x1: 2, y0: -1.5, y1: 1.5 }
      : { x: 420, y: 230, w: 450, h: 140, x0: 0, x1: 2, y0: -1.5, y1: 1.5 };
    estatico(v, `z:${est}:${tipo}`, (vv) => {
      hilo(vv, [[x0, yT], [x1, yT], [x1, yB], [x0, yB], [x0, yT]]);
      panel(vv, e, { titulo: 'v(t) e i(t) normalizadas (cámara lenta)', sinX: true, sinY: true, cero: true });
    });
    fuente(v, x0, ym, 22, 'ac');
    txt(v, '1 V ef.', x0 + 30, ym, { tam: 12, alin: 'left', color: p.suave });
    const comps: string[] = tipo === 'rc' ? ['R', 'C'] : tipo === 'rl' ? ['R', 'L'] : ['R', 'L', 'C'];
    const xs = comps.map((_, i) => x0 + 60 + ((x1 - x0 - 60) * (i + 0.5)) / comps.length);
    comps.forEach((c, i) => {
      const xc = xs[i]!;
      if (c === 'R') resistencia(v, xc - 30, yT, xc + 30, yT, { largo: 46, alto: 16 });
      if (c === 'L') bobina(v, xc - 30, yT, xc + 30, yT, { largo: 46 });
      if (c === 'C') condensador(v, xc - 30, yT, xc + 30, yT, { placa: 24 });
      const val = c === 'R' ? si(R, 'Ω', 3) : c === 'L' ? si(L, 'H', 3) : si(C, 'F', 3);
      // Three parts on a phone: the middle one's value under the wire (side by side they overlapped).
      txtRico(v, `${c} ${val}`, xc, est && comps.length === 3 && i === 1 ? yT + 24 : yT - 20, { tam: 12, peso: 700, max: ((x1 - x0 - 60) / comps.length) * (est && comps.length === 3 ? 2 : 1) - 8 });
    });
    // Current direction follows i(t) (slow motion).
    const iInst = Math.cos(th - fi);
    corriente(v, [[x0, yB], [x0, yT], [x1, yT], [x1, yB], [x0, yB]], fase * Math.sign(iInst), iInst, 46, 10, 0.05);

    // Impedance triangle / voltage phasors (bottom left).
    // Same scale on both axes, so that the angle drawn is the true φ.
    const arriba = Math.max(XL, X, 0);
    const abajo = Math.min(X, 0);
    const alto = est ? 185 : 150;
    const escala = Math.min((est ? 300 : 190) / R, alto / Math.max(arriba - abajo, 1e-9));
    // Room on the left for the φ label.
    const ox = 110;
    const oy = (est ? 235 : 225) + arriba * escala + (alto - (arriba - abajo) * escala) / 2;
    const sx = (val: number) => ox + val * escala;
    const sy = (val: number) => oy - val * escala;
    flecha(ctx, ox, oy, sx(R), oy, p.serie[0], 3, 12);
    if (XL > 0) flecha(ctx, sx(R), oy, sx(R), sy(XL), p.serie[2], 2.4, 11);
    if (XC > 0) flecha(ctx, XL > 0 ? sx(R) + 10 : sx(R), XL > 0 ? sy(XL) : oy, XL > 0 ? sx(R) + 10 : sx(R), XL > 0 ? sy(XL - XC) : sy(-XC), p.serie[1], 2.4, 11);
    flecha(ctx, ox, oy, sx(R), sy(X), p.acento, 3.2, 13);
    txtRico(v, `R = ${si(R, 'Ω', 3)}`, (ox + sx(R)) / 2, oy + (X < 0 ? -14 : 16), { tam: 12, peso: 700, color: p.serie[0] });
    if (XL > 0) txtRico(v, `X_L = ${si(XL, 'Ω', 3)}`, sx(R) + 8, sy(XL / 2), { tam: 12, peso: 700, color: p.serie[2], alin: 'left' });
    if (XC > 0) txtRico(v, `X_C = ${si(XC, 'Ω', 3)}`, sx(R) + 18, sy((XL > 0 ? XL - XC / 2 : -XC / 2)), { tam: 12, peso: 700, color: p.serie[1], alin: 'left' });
    // Outside the triangle, next to the middle of the hypotenuse; φ to the left of the origin.
    txtRico(v, `|Z| = ${si(Zm, 'Ω', 3)}`, (ox + sx(R)) / 2 - 10, (oy + sy(X)) / 2 + (X > 0 ? -12 : 12), { tam: 12.5, peso: 800, color: p.acento, alin: 'right' });
    txtRico(v, `φ = ${num((fi * 180) / Math.PI, 1)}°`, ox - 8, oy, { tam: 12, peso: 700, color: p.acento, alin: 'right' });
    txt(v, est ? 'Triángulo de impedancia (× I = tensiones)' : 'Triángulo de impedancia; multiplicado por I, las tensiones', 20, est ? 198 : 196, { tam: 12, peso: 700, color: p.suave, alin: 'left' });

    // Time traces.
    const N = 160;
    const xsT = new Float64Array(N + 1);
    const yv = new Float64Array(N + 1);
    const yi = new Float64Array(N + 1);
    for (let i = 0; i <= N; i++) {
      const tt = (2 * i) / N;
      xsT[i] = tt;
      yv[i] = Math.cos(th - 2 * Math.PI * tt);
      yi[i] = Math.cos(th - 2 * Math.PI * tt - fi);
    }
    curva(ctx, e, xsT, yv, p.acento, 2.4);
    curva(ctx, e, xsT, yi, p.corriente, 2.2);
    guia(ctx, e, 'x', 0, alfa(p.tinta, 0.3));
    txtRico(v, 'v', e.x + e.w - 30, e.y + 12, { tam: 12.5, peso: 800, color: p.acento });
    txtRico(v, 'i', e.x + e.w - 14, e.y + 12, { tam: 12.5, peso: 800, color: p.corriente });

    // Phasor readouts (right top on wide).
    if (!est) {
      const tx = 430;
      let ty = 50;
      const fila = (s: string, c: string) => {
        txtRico(v, s, tx, ty, { tam: 13, peso: 700, color: c, alin: 'left' });
        ty += 24;
      };
      fila(`I = ${si(I, 'A', 3)} ∠ ${num((-fi * 180) / Math.PI, 1)}°`, p.corriente);
      fila(`V_R = I·R = ${si(I * R, 'V', 3)}`, p.serie[0]);
      if (XL > 0) fila(`V_L = I·X_L = ${si(I * XL, 'V', 3)}`, p.serie[2]);
      if (XC > 0) fila(`V_C = I·X_C = ${si(I * XC, 'V', 3)}`, p.serie[1]);
      fila(`suma aritmética ${si(I * (R + XL + XC), 'V', 3)} ≠ 1 V`, p.peligro);
      fila(`√(V_R² + (V_L − V_C)²) = ${num(I * Zm, 3)} V`, p.acento);
    }
  }

  const texto = $derived.by(() => {
    const { XL, XC, Zm, fi, I } = z;
    const deg = (fi * 180) / Math.PI;
    const caracter = Math.abs(deg) < 1 ? 'resistivo' : deg > 0 ? 'inductivo: la tensión adelanta a la corriente' : 'capacitivo: la corriente adelanta a la tensión';
    return (
      `**Z = R + j(X_L − X_C)** a ${si(f, 'Hz', 3)}: ` +
      (tipo !== 'rl' ? `X_C = 1/(2π·f·C) = ${si(XC, 'Ω', 4)}` : '') +
      (tipo === 'rlc' ? ', ' : '') +
      (tipo !== 'rc' ? `X_L = 2π·f·L = ${si(XL, 'Ω', 4)}` : '') +
      `; |Z| = ${si(Zm, 'Ω', 4)} con ${num(deg, 1)}°, carácter ${caracter}.\n` +
      `Con 1 V eficaz circulan ${si(I, 'A', 3)}. Las tensiones sobre cada elemento son los lados del triángulo multiplicados por I: están en cuadratura y se suman como catetos, no como números.` +
      (tipo === 'rlc' ? ` X_L y X_C se restan: cuando se igualan, el circuito es puramente resistivo (resonancia, a ${si(1 / (2 * Math.PI * Math.sqrt(L * C)), 'Hz', 3)}).` : '')
    );
  });

  const lecturas = $derived([
    { e: '|Z|', v: si(z.Zm, 'Ω', 4), c: pal.acento },
    { e: 'Ángulo φ', v: `${num((z.fi * 180) / Math.PI, 1)}°`, c: pal.acento },
    { e: 'Corriente (1 V ef.)', v: si(z.I, 'A', 3), c: pal.corriente },
    { e: 'V_R', v: si(z.I * R, 'V', 3), c: pal.serie[0] },
    ...(tipo !== 'rc' ? [{ e: 'V_L', v: si(z.I * z.XL, 'V', 3), c: pal.serie[2] }] : []),
    ...(tipo !== 'rl' ? [{ e: 'V_C', v: si(z.I * z.XC, 'V', 3), c: pal.serie[1] }] : []),
  ]);
</script>

<Marco {reloj} {texto} {lecturas} leyenda={['corriente']}>
  {#snippet modos()}
    <Selector
      bind:valor={tipo}
      opciones={[
        { valor: 'rc', texto: 'RC serie' },
        { valor: 'rl', texto: 'RL serie' },
        { valor: 'rlc', texto: 'RLC serie' },
      ]}
    />
  {/snippet}
  {#snippet escena()}
    <Escena {reloj} {paso} {dibujar} dims={(a) => (a < 560 ? [600, 610] : [900, 400])} etiqueta="Impedancia compleja de un circuito serie y sus tensiones en cuadratura" />
  {/snippet}
  {#snippet controles()}
    <Deslizador etiqueta="Frecuencia f" bind:valor={f} min={10} max={1e6} log unidad="Hz" />
    <Deslizador etiqueta="R" bind:valor={R} min={10} max={100e3} log unidad="Ω" />
    {#if tipo !== 'rc'}<Deslizador etiqueta="L" bind:valor={L} min={10e-6} max={1} log unidad="H" />{/if}
    {#if tipo !== 'rl'}<Deslizador etiqueta="C" bind:valor={C} min={100e-12} max={100e-6} log unidad="F" />{/if}
  {/snippet}
</Marco>
