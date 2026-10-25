<script lang="ts">
  // LED (book 5.5, 44.1 and 44.2): in a direct band-gap semiconductor the recombination of an electron with a
  // hole releases a photon whose energy is the band gap: λ = 1240 nm·eV / E_g. Book table: infrared 1,4 eV,
  // red 1,9 eV, green 2,3 eV, blue 2,7 eV; silicon (indirect gap) gives heat, not light.
  import { compartir3d } from '../../tres/compartir.svelte';
  import Escena from '../ui/Escena.svelte';
  import Marco from '../ui/Marco.svelte';
  import Deslizador from '../ui/Deslizador.svelte';
  import Selector from '../ui/Selector.svelte';
  import Grafica from '../ui/Grafica.svelte';
  import { Reloj } from '../nucleo/reloj.svelte';
  import { txt, txtRico, fondo, foton, brillo, electrones, huecos, tarjeta, azar, flecha, type Vista } from '../nucleo/dibujo';
  import { fuente, hilo, resistencia, diodo } from '../nucleo/esquema';
  import { alfa, mezcla, paleta, colorLongitudOnda } from '../nucleo/paleta';
  import { si, num } from '../nucleo/formato';
  import { vt } from '../nucleo/fisica';
  import { app } from '../../../lib/estado.svelte';

  const reloj = new Reloj();
  const pal = $derived(paleta(app.tema));

  const MATERIALES = {
    ir: { nombre: 'Infrarrojo (GaAs)', eg: 1.4, vf: 1.3, directo: true },
    rojo: { nombre: 'Rojo (AlGaInP)', eg: 1.9, vf: 2.0, directo: true },
    verde: { nombre: 'Verde (InGaN)', eg: 2.3, vf: 2.7, directo: true },
    azul: { nombre: 'Azul (InGaN)', eg: 2.7, vf: 3.1, directo: true },
    si: { nombre: 'Silicio', eg: 1.12, vf: 0.7, directo: false },
  } as const;
  type Mat = keyof typeof MATERIALES;
  let mat = $state<Mat>('rojo');
  let I = $state(0.02);
  const VCC = 5;

  const m = $derived(MATERIALES[mat]);
  const lambda = $derived(1240 / m.eg);
  const color = $derived(m.directo ? colorLongitudOnda(lambda) : '#888888');
  const vfDe = (mm: (typeof MATERIALES)[Mat], i: number) => (i <= 0 ? 0 : Math.max(0, mm.vf + 2 * vt() * Math.log(i / 0.02) + 2 * (i - 0.02)));
  const vf = $derived(vfDe(m, I));
  const R = $derived(I > 0 ? Math.max(0, (VCC - vf) / I) : Infinity);

  const rnd = azar(41);
  interface Ev {
    t: number;
    y: number;
    a: number;
  }
  let eventos: Ev[] = [];
  let acum = 0;
  let t = 0;
  function paso(dt: number): void {
    t += dt;
    acum += dt * Math.min(12, I * 500);
    while (acum >= 1) {
      acum -= 1;
      eventos.push({ t: 0, y: rnd(), a: -Math.PI / 2 + (rnd() - 0.5) * 1.4 });
    }
    for (const e of eventos) e.t += dt;
    eventos = eventos.filter((e) => e.t < 1.6);
  }

  function dibujarLed(v: Vista, cx: number, cy: number, s: number): void {
    const { ctx } = v;
    const p = pal;
    const k = Math.min(1, I / 0.02);
    // Light glow.
    if (m.directo && I > 0) brillo(ctx, cx, cy - s * 0.4, s * 1.5, mat === 'ir' ? '#7a1f2a' : color, 0.15 + 0.35 * k);
    // Leads.
    ctx.fillStyle = p.estano;
    ctx.fillRect(cx - s * 0.32, cy + s * 0.55, 5, s * 1.3);
    ctx.fillRect(cx + s * 0.28, cy + s * 0.55, 5, s * 1.1);
    // Epoxy dome.
    ctx.beginPath();
    ctx.moveTo(cx - s * 0.55, cy + s * 0.6);
    ctx.lineTo(cx - s * 0.55, cy - s * 0.4);
    ctx.arc(cx, cy - s * 0.4, s * 0.55, Math.PI, 0);
    ctx.lineTo(cx + s * 0.55, cy + s * 0.6);
    ctx.lineTo(cx + s * 0.62, cy + s * 0.6);
    ctx.lineTo(cx + s * 0.62, cy + s * 0.68);
    ctx.lineTo(cx - s * 0.62, cy + s * 0.68);
    ctx.lineTo(cx - s * 0.62, cy + s * 0.6);
    ctx.closePath();
    ctx.fillStyle = alfa(m.directo ? mezcla(color, '#ffffff', 0.55) : '#dddddd', m.directo ? 0.35 + 0.35 * k : 0.4);
    ctx.fill();
    ctx.strokeStyle = alfa(p.suave, 0.6);
    ctx.lineWidth = 1.2;
    ctx.stroke();
    // Anvil (cathode) with the reflector cup and the die; post (anode) with the bond wire.
    ctx.fillStyle = p.aluminio;
    ctx.fillRect(cx + s * 0.05, cy + s * 0.05, s * 0.28, s * 0.5);
    ctx.beginPath();
    ctx.moveTo(cx + s * 0.02, cy + s * 0.05);
    ctx.lineTo(cx + s * 0.36, cy + s * 0.05);
    ctx.lineTo(cx + s * 0.3, cy + s * 0.18);
    ctx.lineTo(cx + s * 0.08, cy + s * 0.18);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = m.directo && I > 0 ? mezcla(color, '#ffffff', 0.4) : '#444';
    ctx.fillRect(cx + s * 0.14, cy + s * 0.0, s * 0.1, s * 0.06);
    ctx.fillStyle = p.aluminio;
    ctx.fillRect(cx - s * 0.32, cy + s * 0.1, s * 0.16, s * 0.45);
    ctx.strokeStyle = '#d4af37';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(cx - s * 0.22, cy + s * 0.1);
    ctx.quadraticCurveTo(cx - s * 0.05, cy - s * 0.2, cx + s * 0.18, cy + s * 0.0);
    ctx.stroke();
    // Photons leaving the dome.
    if (m.directo)
      for (const e of eventos) {
        const d = e.t * s * 1.4;
        const x = cx + Math.cos(e.a) * d;
        const y = cy - s * 0.1 + Math.sin(e.a) * d;
        if (d > s * 0.3) foton(ctx, x, y, e.a, mat === 'ir' ? '#8a2a35' : color, 22, 3.5, Math.max(0, 1 - e.t / 1.6));
      }
    txt(v, mat === 'ir' ? 'invisible al ojo' : '', cx, cy - s * 1.5, { tam: 12, color: p.suave });
    txt(v, 'ánodo (+)', cx - s * 0.3, cy + s * 2.0, { tam: 11.5, color: p.suave });
    txt(v, 'cátodo', cx + s * 0.3, cy + s * 1.8, { tam: 11.5, color: p.suave, alin: 'left' });
  }

  function dibujarBandas(v: Vista, x0: number, y0: number, w: number, h: number): void {
    const { ctx } = v;
    const p = pal;
    tarjeta(v, x0, y0, w, h, 'Diagrama de bandas en directa');
    const ix0 = x0 + 24;
    const ix1 = x0 + w - 24;
    const xm = (ix0 + ix1) / 2;
    const egPx = 26 + m.eg * 30;
    const escalon = 30;
    const yC = y0 + 70;
    const yCP = yC;
    const yCN = yC + escalon;
    const banda = (yp: number, yn: number, c: string) => {
      ctx.strokeStyle = c;
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(ix0, yp);
      ctx.lineTo(xm - 20, yp);
      ctx.bezierCurveTo(xm, yp, xm, yn, xm + 20, yn);
      ctx.lineTo(ix1, yn);
      ctx.stroke();
    };
    banda(yCP, yCN, p.electron);
    banda(yCP + egPx, yCN + egPx, p.hueco);
    txtRico(v, 'E_C', ix1, yCN - 10, { tam: 11.5, alin: 'right', color: p.electron });
    txtRico(v, 'E_V', ix0, yCP + egPx + 14, { tam: 11.5, alin: 'left', color: p.hueco });
    txt(v, 'P', ix0 + 10, y0 + h - 14, { tam: 13, peso: 800, color: p.hueco });
    txt(v, 'N', ix1 - 10, y0 + h - 14, { tam: 13, peso: 800, color: p.electron });
    // Gap arrow.
    flecha(ctx, ix1 - 30, yCN + 2, ix1 - 30, yCN + egPx - 2, p.suave, 1.4, 7);
    flecha(ctx, ix1 - 30, yCN + egPx - 2, ix1 - 30, yCN + 2, p.suave, 1.4, 7);
    txtRico(v, `E_g = ${num(m.eg, 2)} eV`, ix1 - 38, yCN + egPx / 2, { tam: 13, alin: 'right', peso: 800 });
    // Static populations: electrons in the N conduction band, holes in the P valence band.
    const es: { x: number; y: number }[] = [];
    const hs: { x: number; y: number }[] = [];
    for (let k2 = 0; k2 < 7; k2++) {
      es.push({ x: xm + 40 + k2 * ((ix1 - xm - 50) / 7), y: yCN + 7 });
      hs.push({ x: ix0 + 70 + k2 * ((xm - ix0 - 90) / 7), y: yCP + egPx - 7 });
    }
    electrones(ctx, es, 3.4, p);
    huecos(ctx, hs, 3.4, p);
    // Recombination events: an electron crosses into P and drops across the gap.
    for (const e of eventos) {
      const u = e.t;
      const xr = xm - 30 - e.y * 70;
      if (u < 0.5) {
        const x = xm + 60 - (60 + 30 + e.y * 70) * (u / 0.5);
        const y = x > xm ? yCN + 7 : yCP + 7;
        electrones(ctx, [{ x, y }], 3.4, p);
      } else if (u < 0.75) {
        const f = (u - 0.5) / 0.25;
        electrones(ctx, [{ x: xr, y: yCP + 7 + (egPx - 14) * f }], 3.4, p);
      } else if (u < 1.6) {
        const f = (u - 0.75) / 0.85;
        if (m.directo) foton(ctx, xr + 16 + f * 60, yCP + egPx / 2 - f * 40, -0.6, mat === 'ir' ? '#8a2a35' : color, 26, 4, 1 - f);
        else brillo(ctx, xr, yCP + egPx - 7, 16 + f * 10, p.calor, 0.6 * (1 - f));
      }
    }
    txt(v, m.directo ? `fotón de ${num(lambda, 0)} nm` : 'banda indirecta: sale calor, no luz', xm, y0 + h - 14, {
      tam: 12.5,
      peso: 800,
      color: m.directo ? (mat === 'ir' ? p.suave : mezcla(color, p.tinta, 0.35)) : p.calor,
    });
  }

  function dibujar(v: Vista): void {
    void [mat, I];
    fondo(v);
    const est = v.estrecho;
    if (est) {
      dibujarLed(v, 140, 150, 80);
      dibujarCircuito(v, 290, 70);
      dibujarBandas(v, 20, 330, v.w - 40, v.h - 340);
    } else {
      dibujarLed(v, 140, 170, 90);
      dibujarCircuito(v, 270, 70);
      dibujarBandas(v, 470, 30, v.w - 490, v.h - 60);
    }
  }

  function dibujarCircuito(v: Vista, x0: number, y0: number): void {
    const p = pal;
    const xs = x0 + 20;
    const xd = x0 + 150;
    const y1 = y0 + 200;
    fuente(v, xs, (y0 + y1) / 2, 20, 'dc', { rotulo: '5 V', lado: -1 });
    hilo(v, [
      [xs, (y0 + y1) / 2 - 20],
      [xs, y0],
      [xs + 30, y0],
    ]);
    resistencia(v, xs + 30, y0, xd - 10, y0, { largo: 54 });
    hilo(v, [
      [xd - 10, y0],
      [xd, y0],
      [xd, y0 + 70],
    ]);
    diodo(v, xd, y0 + 70, xd, y0 + 120, { tipo: 'led', luz: m.directo ? color : undefined, conduce: m.directo ? Math.min(1, I / 0.02) : 0 });
    hilo(v, [
      [xd, y0 + 120],
      [xd, y1],
      [xs, y1],
      [xs, (y0 + y1) / 2 + 20],
    ]);
    txtRico(v, `R = ${Number.isFinite(R) ? si(R, 'Ω', 3) : '∞'}`, (xs + xd) / 2 + 10, y0 - 22, { tam: 13, peso: 700 });
    txtRico(v, `V_f = ${num(vf, 2)} V`, xd - 18, y0 + 150, { tam: 13, peso: 700, alin: 'right', color: p.acento });
    txtRico(v, `I = ${si(I, 'A', 3)}`, xd - 18, y0 + 172, { tam: 13, peso: 700, alin: 'right', color: p.corriente });
  }

  const curvas = $derived.by(() => {
    const res: { x: number[]; y: number[]; c: string; n: string }[] = [];
    for (const k of ['ir', 'rojo', 'verde', 'azul'] as const) {
      const mm = MATERIALES[k];
      const xs: number[] = [];
      const ys: number[] = [];
      for (let q = 1; q <= 60; q++) {
        const i = (q / 60) * 0.03;
        xs.push(vfDe(mm, i));
        ys.push(i);
      }
      res.push({ x: xs, y: ys, c: k === 'ir' ? '#8a2a35' : colorLongitudOnda(1240 / mm.eg), n: k === 'ir' ? 'IR' : k });
    }
    return res;
  });

  const texto = $derived.by(() => {
    if (!m.directo)
      return (
        '**Silicio:** su banda prohibida es **indirecta**: el electrón no puede caer directamente al hueco emitiendo un fotón, y la energía se va como vibración de la red, es decir, calor.\n' +
        'Esa es la razón física de que no existan LED de silicio y se fabriquen con compuestos III-V.'
      );
    return (
      `**${m.nombre}:** en directa, los electrones del lado N cruzan y se recombinan con los huecos del P. En un semiconductor de banda directa la energía sale como un **fotón** de E = E_g = ${num(m.eg, 1)} eV, es decir, λ = 1240/E_g = ${num(lambda, 0)} nm.\n` +
      `Por eso la tensión directa depende del color: ${num(vf, 2)} V a ${si(I, 'A', 2)}. Desde 5 V, R = (5 − V_f)/I = ${Number.isFinite(R) ? si(R, 'Ω', 3) : '∞'}; el brillo es proporcional a la corriente, no a la tensión.`
    );
  });
  const lecturas = $derived([
    { e: 'Longitud de onda', v: m.directo ? `${num(lambda, 0)} nm` : '—', c: m.directo ? color : undefined },
    { e: 'Energía del fotón', v: `${num(m.eg, 2)} eV` },
    { e: 'Tensión directa', v: `${num(vf, 2)} V` },
    { e: 'Resistencia serie', v: Number.isFinite(R) ? si(R, 'Ω', 3) : '∞' },
    { e: 'Potencia en R', v: si(I * I * (Number.isFinite(R) ? R : 0), 'W', 3) },
  ]);

  // 3D view of the page (componentes/tres): the model follows these controls.
  compartir3d(() => ({ mat, I }));
</script>

<Marco {reloj} {texto} {lecturas} leyenda={['electron', 'hueco', 'foton', 'calor']}>
  {#snippet modos()}
    <Selector
      bind:valor={mat}
      opciones={(Object.keys(MATERIALES) as Mat[]).map((k) => ({
        valor: k,
        texto: k === 'ir' ? 'Infrarrojo' : k === 'si' ? 'Silicio' : k[0]!.toUpperCase() + k.slice(1),
        color: k === 'si' ? '#888888' : k === 'ir' ? '#8a2a35' : colorLongitudOnda(1240 / MATERIALES[k].eg),
      }))}
    />
  {/snippet}
  {#snippet escena()}
    <Escena {reloj} {paso} {dibujar} dims={(a) => (a < 560 ? [560, 620] : [900, 400])} etiqueta="LED emitiendo fotones y su diagrama de bandas" />
  {/snippet}
  {#snippet controles()}
    <Deslizador etiqueta="Corriente del LED" bind:valor={I} min={0} max={0.03} paso={0.0005} unidad="A" />
  {/snippet}
  {#snippet grafica()}
    <Grafica
      titulo="Curvas I-V de los LED"
      x={{ etiqueta: 'V_f', unidad: 'V', min: 0, max: 4 }}
      y={{ etiqueta: 'I', unidad: 'A', min: 0, max: 0.03 }}
      series={curvas.map((c) => ({ x: c.x, y: c.y, color: c.c }))}
      puntos={[{ x: vf, y: I, color: pal.corriente, etiqueta: `${num(vf, 2)} V` }]}
    />
  {/snippet}
</Marco>
