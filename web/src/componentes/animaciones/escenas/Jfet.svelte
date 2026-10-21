<script lang="ts">
  // N-channel JFET (book 7.3, «la familia FET completa»): the channel exists without gate voltage; reverse
  // voltage on the P⁺ gate junctions widens their depletion regions and narrows the channel until it closes
  // at V_P. Shockley's law: I_D = I_DSS·(1 − V_GS/V_P)² in saturation (I_DSS = 10 mA, V_P = −4 V).
  import Escena from '../ui/Escena.svelte';
  import Marco from '../ui/Marco.svelte';
  import Deslizador from '../ui/Deslizador.svelte';
  import Grafica from '../ui/Grafica.svelte';
  import { Reloj } from '../nucleo/reloj.svelte';
  import { txt, txtRico, fondo, electrones, azar, limitar, iones, flecha, type Vista } from '../nucleo/dibujo';
  import { alfa, paleta } from '../nucleo/paleta';
  import { si, num } from '../nucleo/formato';
  import { app } from '../../../lib/estado.svelte';

  const reloj = new Reloj();
  const pal = $derived(paleta(app.tema));
  const IDSS = 10e-3;
  const VP = -4;
  let vgs = $state(-1);
  let vds = $state(6);

  function idDe(g: number, d: number): number {
    if (g <= VP) return 0;
    const vsat = g - VP;
    const dd = Math.max(0, d);
    if (dd >= vsat) return IDSS * (1 - g / VP) ** 2 * (1 + 0.01 * dd);
    return IDSS * (2 * (1 - g / VP) * (dd / -VP) - (dd / VP) ** 2) * (1 + 0.01 * dd);
  }
  const id = $derived(idDe(vgs, vds));
  const sat = $derived(vgs > VP && vds >= vgs - VP);

  const rnd = azar(91);
  const els = Array.from({ length: 60 }, () => ({ u: rnd(), w: rnd(), s: 0.6 + rnd() * 0.8 }));
  let fase = 0;
  function paso(dt: number): void {
    fase += dt * limitar(id * 40, 0.02, 0.6);
  }

  function dibujar(v: Vista): void {
    void [vgs, vds];
    const { ctx } = v;
    const p = pal;
    fondo(v);
    const est = v.estrecho;
    const x0 = 60;
    const x1 = v.w - 60;
    const yc = est ? 230 : 200;
    const H = 150;
    const y0 = yc - H / 2;
    const y1 = yc + H / 2;
    const gx0 = x0 + (x1 - x0) * 0.3;
    const gx1 = x0 + (x1 - x0) * 0.7;
    // Channel (N) bar.
    ctx.fillStyle = p.siN;
    ctx.fillRect(x0, y0, x1 - x0, H);
    // Depletion half-width at position u along the gate: ∝ √(V_bi − V_GS + V(u)), closes at V_P.
    const vbi = 0.7;
    const prof = (u: number) => {
      const vloc = Math.min(Math.max(0, vds), Math.max(0, vgs - VP)) * u;
      const vr = vbi - vgs + vloc;
      return (H / 2) * Math.min(1, Math.sqrt(Math.max(0, vr) / (vbi - VP)));
    };
    ctx.fillStyle = alfa(p.agotamiento, 0.95);
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(gx0 - 10, yc + s * (H / 2));
      for (let k = 0; k <= 30; k++) {
        const u = k / 30;
        ctx.lineTo(gx0 + u * (gx1 - gx0), yc + s * (H / 2 - prof(u)));
      }
      ctx.lineTo(gx1 + 10, yc + s * (H / 2));
      ctx.closePath();
      ctx.fill();
    }
    // Uncovered donor ions in the depletion regions.
    const ionesV: { x: number; y: number }[] = [];
    for (let k = 0; k < 40; k++) {
      const u = (k % 10) / 10 + 0.05;
      const fila = Math.floor(k / 10);
      const d = prof(u);
      const yy = (fila + 0.5) / 2;
      if (d > 10) ionesV.push({ x: gx0 + u * (gx1 - gx0), y: fila < 2 ? y0 + yy * d : y1 - (yy - 1) * d });
    }
    iones(ctx, ionesV, 7, 1, p, 0.85);
    // Gates (P⁺) top and bottom.
    ctx.fillStyle = p.siPfuerte;
    ctx.fillRect(gx0, y0 - 26, gx1 - gx0, 26);
    ctx.fillRect(gx0, y1, gx1 - gx0, 26);
    txt(v, 'puerta P⁺', (gx0 + gx1) / 2, y0 - 13, { tam: 12.5, peso: 800, color: p.hueco });
    txt(v, 'puerta P⁺', (gx0 + gx1) / 2, y1 + 13, { tam: 12.5, peso: 800, color: p.hueco });
    // Electrons flowing source → drain through the open part of the channel.
    const pts: { x: number; y: number }[] = [];
    for (const e of els) {
      const u = (e.u + fase * e.s) % 1;
      const x = x0 + 8 + u * (x1 - x0 - 16);
      let mitad = H / 2 - 6;
      if (x > gx0 && x < gx1) mitad = Math.max(0, H / 2 - prof((x - gx0) / (gx1 - gx0)) - 4);
      if (mitad <= 0 && !(sat && x > gx0)) continue;
      pts.push({ x, y: yc + (e.w - 0.5) * 2 * Math.max(mitad, 2) });
    }
    electrones(ctx, pts, 3.4, p);
    // Terminals.
    ctx.fillStyle = p.aluminio;
    ctx.fillRect(x0 - 14, y0, 14, H);
    ctx.fillRect(x1, y0, 14, H);
    txt(v, 'S', x0 - 7, y0 - 14, { tam: 15, peso: 800 });
    txt(v, 'D', x1 + 7, y0 - 14, { tam: 15, peso: 800 });
    txt(v, 'G', gx1 + 24, y0 - 14, { tam: 15, peso: 800 });
    txt(v, 'canal N', x0 + 40, yc, { tam: 13, peso: 800, color: p.electron });
    flecha(ctx, x0 + 80, y1 + 46, x1 - 80, y1 + 46, alfa(p.electron, 0.8), 2, 9, [5, 4]);
    txt(v, 'electrones de la fuente al drenador', (x0 + x1) / 2, y1 + 64, { tam: 12, color: p.electron, peso: 700 });
    txtRico(v, `V_GS = ${num(vgs, 2)} V`, est ? 110 : 140, 30, { tam: 15, peso: 800, color: p.acento });
    txtRico(v, `V_DS = ${num(vds, 1)} V`, v.w / 2, 30, { tam: 15, peso: 800, color: p.acento });
    txtRico(v, `I_D = ${si(id, 'A', 3)}`, est ? v.w - 110 : v.w - 140, 30, { tam: 15, peso: 800, color: p.corriente });
  }

  const curvas = $derived.by(() => {
    const res: { x: number[]; y: number[] }[] = [];
    for (const g of [0, -0.5, -1, -1.5, -2, -2.5, -3]) {
      const xs: number[] = [];
      const ys: number[] = [];
      for (let k = 0; k <= 80; k++) {
        const x = (k / 80) * 12;
        xs.push(x);
        ys.push(idDe(g, x));
      }
      res.push({ x: xs, y: ys });
    }
    return res;
  });

  const texto = $derived(
    (vgs <= VP
      ? `**Canal cerrado:** con V_GS = ${num(vgs, 2)} V, por debajo de V_P = ${VP} V, las dos zonas de agotamiento se tocan y no circula corriente.`
      : `El canal N existe sin tensión de puerta: el JFET conduce de forma natural (I_DSS = ${si(IDSS, 'A', 2)}). La puerta es una **unión PN en inversa**: cuanto más negativa, más se ensanchan sus zonas de agotamiento y más se estrecha el canal.`) +
      '\n' +
      (vgs > VP
        ? sat
          ? `Con V_DS = ${num(vds, 1)} V el canal se estrangula junto al drenador (saturación): I_D = I_DSS·(1 − V_GS/V_P)² = ${si(id, 'A', 3)}, casi independiente de V_DS.`
          : `Con V_DS pequeña el canal es una resistencia controlada por la puerta: I_D = ${si(id, 'A', 3)}.`
        : '') +
      ' Su puerta no tiene óxido que perforar: fuga picoamperios, es robusta frente a la estática y su ruido es excelente.',
  );
  const lecturas = $derived([
    { e: 'I_D', v: si(id, 'A', 3), c: pal.corriente },
    { e: 'Región', v: vgs <= VP ? 'corte' : sat ? 'saturación' : 'óhmica' },
    { e: 'V_DS de estrangulamiento', v: vgs > VP ? `${num(vgs - VP, 2)} V` : '—' },
  ]);
</script>

<Marco {reloj} {texto} {lecturas} leyenda={['electron', 'ionD']}>
  {#snippet escena()}
    <Escena {reloj} {paso} {dibujar} dims={(a) => (a < 560 ? [560, 400] : [900, 360])} etiqueta="JFET de canal N con sus zonas de agotamiento" />
  {/snippet}
  {#snippet controles()}
    <Deslizador etiqueta="Tensión de puerta V_GS" bind:valor={vgs} min={-5} max={0} paso={0.05} unidad="V" />
    <Deslizador etiqueta="Tensión de drenador V_DS" bind:valor={vds} min={0} max={12} paso={0.1} unidad="V" />
  {/snippet}
  {#snippet grafica()}
    <Grafica
      titulo="Curvas de salida (I_DSS = 10 mA, V_P = −4 V)"
      x={{ etiqueta: 'V_DS', unidad: 'V', min: 0, max: 12 }}
      y={{ etiqueta: 'I_D', unidad: 'A', min: 0, max: 0.012 }}
      series={curvas.map((c) => ({ x: c.x, y: c.y, color: pal.tenue, ancho: 1.3 }))}
      puntos={[{ x: vds, y: id, color: pal.corriente, etiqueta: si(id, 'A', 3) }]}
    />
  {/snippet}
</Marco>
