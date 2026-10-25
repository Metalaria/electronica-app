<script lang="ts">
  // How the channel forms (book 7.1, 7.2, figs. 7.1–7.2, 25.5, 25.6, 7.9): positive gate voltage first repels
  // the holes (depletion with fixed acceptor ions), then attracts electrons until the surface inverts at V_th;
  // V_DS tapers the channel and pinches it off at the drain when V_DS = V_GS − V_th. Square law with λ,
  // k = 0,5 A/V², V_th = 2 V. With the drain below the source, the body diode conducts.
  import { compartir3d } from '../../tres/compartir.svelte';
  import { untrack } from 'svelte';
  import Escena from '../ui/Escena.svelte';
  import Marco from '../ui/Marco.svelte';
  import Deslizador from '../ui/Deslizador.svelte';
  import Selector from '../ui/Selector.svelte';
  import Grafica from '../ui/Grafica.svelte';
  import { Reloj } from '../nucleo/reloj.svelte';
  import { txt, txtRico, fondo, electrones, huecos, iones, brillo, azar, limitar, flecha, type Vista } from '../nucleo/dibujo';
  import { alfa, mezcla, paleta } from '../nucleo/paleta';
  import { mosfet, MOS_LIBRO, shockley } from '../nucleo/fisica';
  import { si, num } from '../nucleo/formato';
  import { app } from '../../../lib/estado.svelte';

  const reloj = new Reloj();
  const pal = $derived(paleta(app.tema));
  let tipo = $state<'n' | 'p'>('n');
  let vgs = $state(4);
  let vds = $state(3);
  const VTH = MOS_LIBRO.vth;

  const vov = $derived(vgs - VTH);
  const r = $derived(mosfet(vgs, vds));
  const iDiodo = $derived(vds < 0 ? -Math.min(5, shockley(-vds, 1e-12, 1.2)) : 0);
  const id = $derived(vds >= 0 ? r.id : iDiodo);
  const region = $derived(vds < -0.3 ? 'diodo' : r.region);

  const rnd = azar(81);
  const huecosSub = Array.from({ length: 70 }, () => ({ x: rnd(), y: rnd(), vx: 0, vy: 0 }));
  const ionesSub = Array.from({ length: 120 }, () => ({ x: rnd(), y: rnd() }));
  const canal = Array.from({ length: 60 }, () => ({ u: rnd(), w: rnd(), s: 0.6 + rnd() * 0.8 }));
  const diodoEv: { t: number; y: number }[] = [];
  let t = 0;
  let fase = 0;
  let acum = 0;
  function paso(dt: number): void {
    t += dt;
    fase += dt * limitar(0.08 + Math.abs(id) * 0.6, 0, 1.2);
    for (const h of huecosSub) {
      h.vx = h.vx * 0.9 + (rnd() - 0.5) * 0.02;
      h.vy = h.vy * 0.9 + (rnd() - 0.5) * 0.02;
      h.x = limitar(h.x + h.vx * dt * 6, 0, 1);
      h.y = limitar(h.y + h.vy * dt * 6, 0, 1);
    }
    if (region === 'diodo') {
      acum += dt * Math.min(14, Math.abs(iDiodo) * 20 + 1);
      while (acum >= 1) {
        acum -= 1;
        diodoEv.push({ t: 0, y: rnd() });
      }
    }
    for (const e of diodoEv) e.t += dt;
    while (diodoEv.length && diodoEv[0]!.t > 1) diodoEv.shift();
  }
  $effect(() => {
    void tipo;
    untrack(() => (diodoEv.length = 0));
  });

  function dibujar(v: Vista): void {
    void [tipo, vgs, vds];
    const { ctx } = v;
    const p = pal;
    fondo(v);
    const est = v.estrecho;
    const npos = tipo === 'n';
    const s = (x: number) => (npos ? x : -x);
    const x0 = 40;
    const x1 = v.w - 40;
    const ySup = est ? 190 : 170;
    const yInf = v.h - (est ? 40 : 30);
    const W = x1 - x0;
    const xS0 = x0 + W * 0.08;
    const xS1 = x0 + W * 0.3;
    const xD0 = x0 + W * 0.7;
    const xD1 = x0 + W * 0.92;
    const hPozo = 64;
    // Substrate and wells.
    ctx.fillStyle = npos ? p.siP : p.siN;
    ctx.fillRect(x0, ySup, W, yInf - ySup);
    // Depletion under the gate: grows like √V_GS up to the threshold, then stays.
    const prof = vgs > 0.05 ? 70 * Math.sqrt(Math.min(vgs, VTH) / VTH) : 0;
    if (prof > 1) {
      ctx.fillStyle = alfa(p.agotamiento, 0.9);
      ctx.beginPath();
      ctx.moveTo(xS1 - 10, ySup);
      ctx.lineTo(xD0 + 10, ySup);
      ctx.lineTo(xD0 + 10, ySup + prof * 0.7);
      ctx.quadraticCurveTo((xS1 + xD0) / 2, ySup + prof * 1.15, xS1 - 10, ySup + prof * 0.7);
      ctx.closePath();
      ctx.fill();
    }
    // Fixed ions under the gate (uncovered acceptors for N-channel).
    const ionesVis = ionesSub
      .map((q) => ({ x: xS1 + q.x * (xD0 - xS1), y: ySup + 6 + q.y * prof }))
      .filter((q) => q.y < ySup + prof * 0.9 && prof > 4);
    iones(ctx, ionesVis, 7, npos ? -1 : 1, p, 0.9);
    // Majority carriers of the substrate, pushed out of the depletion region.
    // Mobile majority carriers are absent from the depletion region and from the wells.
    const sub = huecosSub
      .map((h) => ({ x: x0 + 8 + h.x * (W - 16), y: ySup + 8 + h.y * (yInf - ySup - 16) }))
      .filter((q) => {
        const bajo = q.x > xS1 - 14 && q.x < xD0 + 14 && q.y < ySup + prof + 8;
        const enPozo = ((q.x > xS0 - 6 && q.x < xS1 + 6) || (q.x > xD0 - 6 && q.x < xD1 + 6)) && q.y < ySup + hPozo + 8;
        return !bajo && !enPozo;
      });
    if (npos) huecos(ctx, sub, 3.6, p);
    else electrones(ctx, sub, 3.6, p);
    // Source and drain wells.
    for (const [a, b] of [
      [xS0, xS1],
      [xD0, xD1],
    ] as const) {
      ctx.fillStyle = npos ? p.siNfuerte : p.siPfuerte;
      ctx.beginPath();
      ctx.moveTo(a, ySup);
      ctx.lineTo(a, ySup + hPozo - 14);
      ctx.quadraticCurveTo(a, ySup + hPozo, a + 14, ySup + hPozo);
      ctx.lineTo(b - 14, ySup + hPozo);
      ctx.quadraticCurveTo(b, ySup + hPozo, b, ySup + hPozo - 14);
      ctx.lineTo(b, ySup);
      ctx.closePath();
      ctx.fill();
      const pts: { x: number; y: number }[] = [];
      for (let k = 0; k < 14; k++) pts.push({ x: a + 12 + ((k * 37) % (b - a - 24)), y: ySup + 10 + ((k * 23) % (hPozo - 24)) });
      if (npos) electrones(ctx, pts, 3.4, p);
      else huecos(ctx, pts, 3.4, p);
    }
    txt(v, npos ? 'N⁺' : 'P⁺', xS0 + 18, ySup + hPozo - 12, { tam: 13, peso: 800, color: npos ? p.electron : p.hueco });
    txt(v, npos ? 'N⁺' : 'P⁺', xD1 - 18, ySup + hPozo - 12, { tam: 13, peso: 800, color: npos ? p.electron : p.hueco });
    txt(v, npos ? 'sustrato P' : 'sustrato N', x0 + 70, yInf - 16, { tam: 13, peso: 800, color: npos ? p.hueco : p.electron });
    // Inversion channel: thickness ∝ local overdrive, tapering towards the drain; pinched off in saturation.
    const L = xD0 - xS1;
    const vdsEf = Math.max(0, vds);
    const pinch = vov > 0 && vdsEf >= vov;
    if (vov > 0) {
      const espesor = (u: number) => {
        const vloc = Math.min(vdsEf, vov) * (1 - Math.sqrt(1 - u * (pinch ? 0.999 : Math.min(vdsEf / vov, 0.999) * 1)));
        return Math.max(0, 5 + 14 * (vov - vloc) / 4);
      };
      const fin = pinch ? 0.86 : 1;
      ctx.fillStyle = alfa(npos ? p.electron : p.hueco, 0.28);
      ctx.beginPath();
      ctx.moveTo(xS1 - 6, ySup);
      for (let k = 0; k <= 30; k++) {
        const u = (k / 30) * fin;
        ctx.lineTo(xS1 + u * L, ySup + espesor(u) * (pinch && u > fin - 0.12 ? (fin - u) / 0.12 : 1));
      }
      ctx.lineTo(xS1 + fin * L, ySup);
      ctx.closePath();
      ctx.fill();
      // Carriers flowing in the channel (source → drain for electrons).
      const pts: { x: number; y: number }[] = [];
      const n = Math.round(limitar(14 + vov * 12, 0, 60));
      for (let k = 0; k < n; k++) {
        const q = canal[k]!;
        const u = (q.u + fase * q.s * (vdsEf > 0.01 ? 1 : 0.05)) % 1;
        const x = xS1 - 4 + u * (L + 8);
        let y = ySup + 2 + q.w * espesor(Math.min(u, fin));
        if (pinch && u > fin) y = ySup + 4 + q.w * 10 + (u - fin) * 30;
        pts.push({ x, y });
      }
      if (npos) electrones(ctx, pts, 3.2, p);
      else huecos(ctx, pts, 3.2, p);
      if (pinch) {
        const xp = xS1 + fin * L;
        txt(v, 'estrangulamiento', xp, ySup + prof + 26, { tam: 12, peso: 800, color: p.peligro, fondo: alfa(p.fondo, 0.85) });
        flecha(ctx, xp, ySup + prof + 14, xp, ySup + 10, p.peligro, 1.6, 7);
      }
    }
    // Body diode: substrate (tied to source) to drain junction in forward bias.
    if (region === 'diodo') {
      for (const e of diodoEv) {
        const x = xD0 + 20 + e.y * (xD1 - xD0 - 40);
        const y = ySup + hPozo + 4 + e.t * 40;
        brillo(ctx, x, ySup + hPozo, 14, p.calor, 0.5 * (1 - e.t));
        if (npos) electrones(ctx, [{ x, y }], 3.4, p);
        else huecos(ctx, [{ x, y }], 3.4, p);
      }
      txt(v, 'diodo de cuerpo conduciendo', (xD0 + xD1) / 2, ySup + hPozo + 70, { tam: 12.5, peso: 800, color: p.calor });
    }
    // Oxide, gate and contacts.
    const yOx = ySup - 14;
    ctx.fillStyle = p.oxido;
    ctx.fillRect(xS1 - 12, yOx, L + 24, 14);
    const gGate = ctx.createLinearGradient(0, yOx - 34, 0, yOx);
    gGate.addColorStop(0, mezcla(p.polisilicio, '#ffffff', 0.25));
    gGate.addColorStop(1, p.polisilicio);
    ctx.fillStyle = gGate;
    ctx.fillRect(xS1 - 12, yOx - 34, L + 24, 34);
    // Gate charge.
    const nq = Math.round(Math.min(16, Math.abs(vgs) * 2.6));
    for (let k = 0; k < nq; k++) txt(v, npos ? '+' : '−', xS1 + ((L * (k + 0.5)) / nq), yOx - 17, { tam: 13, peso: 900, color: npos ? '#ffd2cc' : '#cfe0ff' });
    for (const [a, b, n] of [
      [xS0 + 20, xS1 - 30, 'S'],
      [xD0 + 30, xD1 - 20, 'D'],
    ] as const) {
      ctx.fillStyle = p.aluminio;
      ctx.fillRect(a, ySup - 26, b - a, 26);
      txt(v, n, (a + b) / 2, ySup - 40, { tam: 16, peso: 800 });
    }
    txt(v, 'G', (xS1 + xD0) / 2, yOx - 50, { tam: 16, peso: 800 });
    if (!est) txt(v, 'óxido (10–50 nm)', xD0 + 16, yOx + 2, { tam: 11.5, alin: 'left', color: mezcla(p.oxido, p.tinta, 0.6), peso: 700 });
    // Voltages.
    txtRico(v, `V_GS = ${num(s(vgs), 2)} V`, est ? 110 : 150, est ? 40 : 34, { tam: 15, peso: 800, color: p.acento });
    txtRico(v, `V_DS = ${num(s(vds), 2)} V`, est ? v.w - 110 : v.w - 150, est ? 40 : 34, { tam: 15, peso: 800, color: p.acento });
    txtRico(v, `I_D = ${si(s(id), 'A', 3)}`, v.w / 2, est ? 72 : 34, { tam: 15, peso: 800, color: p.corriente });
  }

  const curvas = $derived.by(() => {
    const res: { x: number[]; y: number[] }[] = [];
    for (const g of [2.5, 3, 3.5, 4, 5, 6]) {
      const xs: number[] = [];
      const ys: number[] = [];
      for (let k = 0; k <= 80; k++) {
        const x = (k / 80) * 8;
        xs.push(x);
        ys.push(mosfet(g, x).id);
      }
      res.push({ x: xs, y: ys });
    }
    const fx: number[] = [];
    const fy: number[] = [];
    for (let k = 0; k <= 40; k++) {
      const ov = (k / 40) * 4;
      fx.push(ov);
      fy.push(0.5 * MOS_LIBRO.k * ov * ov);
    }
    return { res, fx, fy };
  });

  const texto = $derived.by(() => {
    const port = tipo === 'n' ? 'electrones' : 'huecos';
    const may = tipo === 'n' ? 'huecos' : 'electrones';
    if (region === 'diodo')
      return `**Diodo de cuerpo:** el sustrato está unido a la fuente, y con el drenador ${num(Math.abs(vds), 2)} V por ${tipo === 'n' ? 'debajo' : 'encima'} de ella la unión sustrato-drenador queda en directa: conduce ${si(Math.abs(iDiodo), 'A', 3)} aunque la puerta esté apagada. Un MOSFET discreto no bloquea en los dos sentidos.`;
    if (vgs < 0.05) return `Sin tensión de puerta no hay canal: entre fuente y drenador hay dos uniones opuestas y no circula corriente.`;
    if (vov <= 0)
      return `**Agotamiento:** la puerta y el sustrato forman un condensador. Con ${num(vgs, 2)} V, el campo **repele los ${may}** de la superficie y deja al descubierto los iones fijos, pero aún no hay ${port} suficientes: por debajo de V_th = ${VTH} V no hay canal (solo una corriente de subumbral minúscula).`;
    const base = `**Inversión:** por encima de V_th = ${VTH} V la puerta atrae tantos ${port} que la superficie cambia de tipo y forma un **canal** entre fuente y drenador (V_ov = ${num(vov, 2)} V).\n`;
    if (r.region === 'ohmica')
      return base + `**Región óhmica:** con V_DS = ${num(vds, 2)} V < V_ov el canal es una resistencia controlada por la puerta, más fino junto al drenador: I_D = ${si(id, 'A', 3)}, R_DS ≈ ${si(1 / (MOS_LIBRO.k * vov), 'Ω', 3)}.`;
    return base + `**Saturación:** V_DS ≥ V_GS − V_th: el canal se **estrangula** junto al drenador y la corriente ya casi no depende de V_DS: I_D = ½·k·V_ov²·(1 + λ·V_DS) = ${si(id, 'A', 3)}.`;
  });
  const lecturas = $derived([
    { e: 'Región', v: region === 'diodo' ? 'diodo de cuerpo' : region === 'ohmica' ? 'óhmica' : region === 'saturacion' ? 'saturación' : 'corte', c: pal.acento },
    { e: 'I_D', v: si(id, 'A', 3), c: pal.corriente },
    { e: 'V_ov = V_GS − V_th', v: `${num(vov, 2)} V` },
    { e: 'V_DS de estrangulamiento', v: vov > 0 ? `${num(vov, 2)} V` : '—' },
  ]);

  // 3D view of the page (componentes/tres): the model follows these controls.
  compartir3d(() => ({ tipo }));
</script>

<Marco {reloj} {texto} {lecturas} leyenda={tipo === 'n' ? ['electron', 'hueco', 'ionA'] : ['hueco', 'electron', 'ionD']}>
  {#snippet modos()}
    <Selector bind:valor={tipo} opciones={[{ valor: 'n', texto: 'Canal N' }, { valor: 'p', texto: 'Canal P' }]} />
  {/snippet}
  {#snippet escena()}
    <Escena {reloj} {paso} {dibujar} dims={(a) => (a < 560 ? [560, 470] : [900, 420])} etiqueta="Corte de un MOSFET con la formación del canal" />
  {/snippet}
  {#snippet controles()}
    <Deslizador etiqueta={tipo === 'n' ? 'Tensión de puerta V_GS' : 'Tensión de puerta |V_GS|'} bind:valor={vgs} min={0} max={6} paso={0.05} unidad="V" />
    <Deslizador etiqueta={tipo === 'n' ? 'Tensión de drenador V_DS' : 'Tensión de drenador |V_DS|'} bind:valor={vds} min={-1} max={8} paso={0.05} unidad="V" />
  {/snippet}
  {#snippet grafica()}
    <Grafica
      titulo="Curvas de salida (k = 0,5 A/V², V_th = 2 V)"
      x={{ etiqueta: '|V_DS|', unidad: 'V', min: 0, max: 8 }}
      y={{ etiqueta: '|I_D|', unidad: 'A', min: 0, max: 4.5 }}
      series={[
        ...curvas.res.map((c) => ({ x: c.x, y: c.y, color: pal.tenue, ancho: 1.3 })),
        { x: curvas.fx, y: curvas.fy, color: pal.hueco, discontinua: true, nombre: 'V_DS = V_ov' },
      ]}
      puntos={vds >= 0 ? [{ x: vds, y: id, color: pal.corriente, etiqueta: si(id, 'A', 3) }] : []}
    />
  {/snippet}
</Marco>
