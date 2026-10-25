<script lang="ts">
  // A real capacitor is C + ESR + ESL in series (book 3.5, fig. 3.8): |Z| falls as a capacitor, bottoms out
  // at the ESR at f_SRF = 1/(2π·√(ESL·C)) and rises as an inductor above it. Presets are the book's table.
  import { compartir3d } from '../../tres/compartir.svelte';
  import Escena from '../ui/Escena.svelte';
  import Marco from '../ui/Marco.svelte';
  import Deslizador from '../ui/Deslizador.svelte';
  import Selector from '../ui/Selector.svelte';
  import Grafica from '../ui/Grafica.svelte';
  import { Reloj } from '../nucleo/reloj.svelte';
  import { txt, txtRico, fondo, rr, gradCilindroX, gradCilindro, Camino, electronesEnCamino, brillo, type Vista } from '../nucleo/dibujo';
  import { hilo, resistencia, condensador, bobina, terminal } from '../nucleo/esquema';
  import { alfa, paleta } from '../nucleo/paleta';
  import { si, num } from '../nucleo/formato';
  import { app } from '../../../lib/estado.svelte';

  const reloj = new Reloj();
  const pal = $derived(paleta(app.tema));

  const TIPOS = [
    { id: 'elec', nombre: 'Electrolítico 100 µF', C: 100e-6, L: 10e-9, R: 0.2 },
    { id: 'mlcc', nombre: 'Cerámico 100 nF (0805)', C: 100e-9, L: 1.5e-9, R: 0.02 },
    { id: 'rf', nombre: 'Cerámico 100 pF (0603)', C: 100e-12, L: 0.8e-9, R: 0.05 },
  ] as const;
  type Id = (typeof TIPOS)[number]['id'];
  let tipo = $state<Id>('elec');
  let f = $state(1e3);
  const T = $derived(TIPOS.find((x) => x.id === tipo)!);

  const XC = $derived(1 / (2 * Math.PI * f * T.C));
  const XL = $derived(2 * Math.PI * f * T.L);
  const Z = $derived(Math.hypot(T.R, XL - XC));
  const srf = $derived(1 / (2 * Math.PI * Math.sqrt(T.L * T.C)));
  const domina = $derived(XC > 2 * Math.max(XL, T.R) ? 'C' : XL > 2 * Math.max(XC, T.R) ? 'L' : 'R');

  let fase = 0;
  function paso(dt: number): void {
    fase += dt * Math.PI * 2 * 0.6;
  }

  function dibujarFisico(v: Vista, cx: number, cy: number): void {
    const { ctx } = v;
    const p = pal;
    if (tipo === 'elec') {
      const w = 64;
      const h = 96;
      rr(ctx, cx - w / 2, cy - h / 2, w, h, 8);
      ctx.fillStyle = gradCilindroX(ctx, cx - w / 2, cx + w / 2, '#2c4f86', p.oscuro);
      ctx.fill();
      ctx.fillStyle = alfa('#d9e2ee', 0.8);
      ctx.fillRect(cx + w / 2 - 18, cy - h / 2 + 4, 12, h - 8);
      txt(v, '−', cx + w / 2 - 12, cy, { tam: 14, peso: 800, color: '#2c4f86' });
      ctx.fillStyle = p.estano;
      ctx.fillRect(cx - 14, cy + h / 2, 4, 26);
      ctx.fillRect(cx + 10, cy + h / 2, 4, 26);
    } else {
      const w = tipo === 'mlcc' ? 92 : 70;
      const h = tipo === 'mlcc' ? 46 : 36;
      ctx.fillStyle = gradCilindro(ctx, cy - h / 2, cy + h / 2, '#b89b6e', p.oscuro);
      ctx.fillRect(cx - w / 2, cy - h / 2, w, h);
      ctx.fillStyle = gradCilindro(ctx, cy - h / 2, cy + h / 2, p.estano, p.oscuro);
      ctx.fillRect(cx - w / 2 - 4, cy - h / 2 - 2, 18, h + 4);
      ctx.fillRect(cx + w / 2 - 14, cy - h / 2 - 2, 18, h + 4);
    }
    txt(v, T.nombre, cx, cy + 86, { tam: 12.5, peso: 700, color: p.suave });
  }

  function dibujar(v: Vista): void {
    void [tipo, f];
    const { ctx } = v;
    const p = pal;
    fondo(v);
    const est = v.estrecho;
    dibujarFisico(v, est ? v.w / 2 : 110, est ? 90 : 160);
    txt(v, '=', est ? v.w / 2 : 220, est ? 190 : 160, { tam: 30, peso: 300, color: p.suave });
    // Series model.
    const y = est ? 250 : 160;
    const xa = est ? 40 : 270;
    const xb = est ? v.w - 40 : v.w - 40;
    const seg = (xb - xa) / 3;
    const x1 = xa + seg;
    const x2 = xa + 2 * seg;
    terminal(v, xa, y);
    terminal(v, xb, y);
    const brilloDe = (x: number) => Math.min(1, Math.max(0, Math.log10(x / Math.max(Z, 1e-12)) + 1));
    const kC = brilloDe(XC);
    const kL = brilloDe(XL);
    const kR = brilloDe(T.R);
    const cxC = xa + seg / 2;
    const cxR = x1 + seg / 2;
    const cxL = x2 + seg / 2;
    if (domina === 'C') brillo(ctx, cxC, y, 60, p.acento, 0.35);
    if (domina === 'R') brillo(ctx, cxR, y, 60, p.calor, 0.35);
    if (domina === 'L') brillo(ctx, cxL, y, 60, p.campoB, 0.35);
    hilo(v, [
      [xa, y],
      [cxC - 10, y],
    ]);
    condensador(v, cxC - 10, y, cxC + 10, y, { color: kC > 0.6 ? p.acento : p.tinta });
    hilo(v, [
      [cxC + 10, y],
      [cxR - 30, y],
    ]);
    resistencia(v, cxR - 30, y, cxR + 30, y, { largo: 50, relleno: alfa(p.calor, 0.15 + 0.5 * kR) });
    hilo(v, [
      [cxR + 30, y],
      [cxL - 30, y],
    ]);
    bobina(v, cxL - 30, y, cxL + 30, y, { largo: 54, color: kL > 0.6 ? p.campoB : p.tinta });
    hilo(v, [
      [cxL + 30, y],
      [xb, y],
    ]);
    txtRico(v, `C = ${si(T.C, 'F', 2)}`, cxC, y - 40, { tam: 13, peso: 700, color: p.acento });
    txtRico(v, `ESR = ${si(T.R, 'Ω', 2)}`, cxR, y - 40, { tam: 13, peso: 700, color: p.calor });
    txtRico(v, `ESL = ${si(T.L, 'H', 2)}`, cxL, y - 40, { tam: 13, peso: 700, color: p.campoB });
    // Electrons oscillating with an amplitude that grows when |Z| is small.
    const cam = new Camino([
      [xa, y],
      [xb, y],
    ]);
    const amp = Math.min(30, 4 + 26 * Math.max(0, 1 - Math.log10(Math.max(Z, 0.01) / 0.01) / 6));
    electronesEnCamino(ctx, cam, Math.sin(fase) * amp + 10, 26, 3.2, p, 0.85);

    // Bars of each reactance (log scale) and the result.
    const bx0 = est ? 40 : 270;
    const bx1 = est ? v.w - 40 : v.w - 40;
    const by = est ? 330 : 250;
    const largo = (x: number) => ((Math.log10(Math.max(x, 1e-3)) + 3) / 9) * (bx1 - bx0 - 150);
    const barras: [string, number, string][] = [
      ['X_C = 1/(2πfC)', XC, p.acento],
      ['X_L = 2πf·ESL', XL, p.campoB],
      ['ESR', T.R, p.calor],
      ['|Z| total', Z, p.tinta],
    ];
    barras.forEach(([n, val, c], i) => {
      const yy = by + i * 28;
      txtRico(v, n, bx0, yy, { alin: 'left', tam: 12.5, color: p.suave });
      rr(ctx, bx0 + 120, yy - 7, Math.max(2, largo(val)), 14, 7);
      ctx.fillStyle = alfa(c, i === 3 ? 0.9 : 0.7);
      ctx.fill();
      txt(v, si(val, 'Ω', 3), bx0 + 128 + Math.max(2, largo(val)), yy, { alin: 'left', tam: 12.5, peso: 700, color: c });
    });
    const estado = domina === 'C' ? 'Se comporta como un condensador' : domina === 'L' ? 'Por encima de la autorresonancia: es una bobina' : 'Cerca de la autorresonancia: solo queda la ESR';
    txt(v, estado, est ? v.w / 2 : (bx0 + bx1) / 2, v.h - 22, {
      tam: 15,
      peso: 800,
      color: domina === 'C' ? p.acento : domina === 'L' ? p.campoB : p.calor,
      fondo: alfa(domina === 'C' ? p.acento : domina === 'L' ? p.campoB : p.calor, 0.1),
    });
  }

  const curva = $derived.by(() => {
    const xs: number[] = [];
    const z: number[] = [];
    const c: number[] = [];
    const l: number[] = [];
    for (let k = 0; k <= 240; k++) {
      const ff = 1e3 * Math.pow(10, (6 * k) / 240);
      xs.push(ff);
      const xc = 1 / (2 * Math.PI * ff * T.C);
      const xl = 2 * Math.PI * ff * T.L;
      c.push(xc);
      l.push(xl);
      z.push(Math.hypot(T.R, xl - xc));
    }
    return { xs, z, c, l };
  });

  const texto = $derived(
    `Un condensador real es **C, ESR y ESL en serie**. A ${si(f, 'Hz', 3)}: X_C = ${si(XC, 'Ω', 3)}, X_L = ${si(XL, 'Ω', 3)}, |Z| = ${si(Z, 'Ω', 3)}.\n` +
      (domina === 'C'
        ? `Domina la capacidad y la impedancia cae con la frecuencia. Su mínimo, igual a la ESR, llega en la autorresonancia, f_SRF = ${si(srf, 'Hz', 3)}.`
        : domina === 'L'
          ? `Por encima de f_SRF = ${si(srf, 'Hz', 3)} la inductancia de las láminas y los terminales manda: la impedancia sube con la frecuencia y el «condensador» ya no desacopla. Por eso se ponen varios de valores distintos en paralelo.`
          : `Estamos en la autorresonancia (${si(srf, 'Hz', 3)}): X_C y X_L se anulan entre sí y solo queda la ESR, ${si(T.R, 'Ω', 2)}.`),
  );

  const lecturas = $derived([
    { e: 'Autorresonancia f_SRF', v: si(srf, 'Hz', 3), c: pal.acento },
    { e: '|Z| a esta frecuencia', v: si(Z, 'Ω', 3) },
    { e: 'Impedancia mínima (ESR)', v: si(T.R, 'Ω', 2) },
    { e: 'Fase', v: `${num((Math.atan2(XL - XC, T.R) * 180) / Math.PI, 0)}°` },
  ]);

  // 3D view of the page (componentes/tres): the model follows these controls.
  compartir3d(() => ({ tipo }));
</script>

<Marco {reloj} {texto} {lecturas} leyenda={['electron']}>
  {#snippet modos()}
    <Selector bind:valor={tipo} opciones={TIPOS.map((x) => ({ valor: x.id, texto: x.nombre }))} />
  {/snippet}
  {#snippet escena()}
    <Escena {reloj} {paso} {dibujar} dims={(a) => (a < 560 ? [560, 520] : [900, 400])} etiqueta="Modelo de un condensador real con ESR y ESL" />
  {/snippet}
  {#snippet controles()}
    <Deslizador etiqueta="Frecuencia f" bind:valor={f} min={1e3} max={1e9} log unidad="Hz" />
    <div class="atajos">
      <button class="boton" onclick={() => (f = srf)}>Ir a la autorresonancia</button>
    </div>
  {/snippet}
  {#snippet grafica()}
    <Grafica
      titulo="Impedancia frente a la frecuencia"
      x={{ etiqueta: 'f', unidad: 'Hz', min: 1e3, max: 1e9, log: true }}
      y={{ etiqueta: '|Z|', unidad: 'Ω', min: 1e-3, max: 1e5, log: true }}
      series={[
        { x: curva.xs, y: curva.c, color: pal.acento, discontinua: true, ancho: 1.3, nombre: 'X_C' },
        { x: curva.xs, y: curva.l, color: pal.campoB, discontinua: true, ancho: 1.3, nombre: 'X_L' },
        { x: curva.xs, y: curva.z, color: pal.tinta, ancho: 2.6, nombre: '|Z|' },
      ]}
      lineas={[{ x: srf, etiqueta: 'f_SRF', color: pal.calor }]}
      puntos={[{ x: f, y: Z, color: pal.corriente, etiqueta: si(Z, 'Ω', 3) }]}
    />
  {/snippet}
</Marco>

<style>
  .atajos {
    display: flex;
    gap: 6px;
  }
</style>
