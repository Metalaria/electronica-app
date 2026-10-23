<script lang="ts">
  // Kirchhoff's laws on a two-mesh circuit (book 1.3, 0.2 and 22.4): mesh currents solved from KVL, branch
  // currents as moving arrows, KCL at the top node, and a walker that goes round a loop drawing the potential
  // profile: it rises in the sources and drops I·R in each resistor, and returns to where it started.
  // Book examples: 12 V with 4 Ω, 6 Ω shared and 3 Ω (I₁ = 2 A, I₂ = 1,333 A; sec. 0.2) and 4, 8, 4 Ω
  // (1,8 A and 1,2 A; sec. 22.4).
  import Escena from '../../ui/Escena.svelte';
  import Marco from '../../ui/Marco.svelte';
  import Deslizador from '../../ui/Deslizador.svelte';
  import Selector from '../../ui/Selector.svelte';
  import Interruptor from '../../ui/Interruptor.svelte';
  import { Reloj, Muestreo } from '../../nucleo/reloj.svelte';
  import { txt, txtRico, Camino, corrienteEnCamino, circulo, flecha, rr, type Vista } from '../../nucleo/dibujo';
  import { hilo, resistencia, fuente, nodo, masa } from '../../nucleo/esquema';
  import { alfa, paleta } from '../../nucleo/paleta';
  import { si, num } from '../../nucleo/formato';
  import { app } from '../../../../lib/estado.svelte';
  import { estatico, panel, curva, punto, guia, type Ejes } from '../nucleo/grafica';

  const reloj = new Reloj();
  const pal = $derived(paleta(app.tema));

  let V1 = $state(12);
  let V2 = $state(5);
  let conV2 = $state(false);
  let R1 = $state(4);
  let R2 = $state(6);
  let R3 = $state(3);
  let lazo = $state<'m1' | 'm2' | 'ext'>('m1');
  let ejemplo = $state<'0.2' | '22.4' | 'libre'>('0.2');

  function aplicar(e: '0.2' | '22.4' | 'libre'): void {
    if (e === '0.2') {
      V1 = 12;
      R1 = 4;
      R2 = 6;
      R3 = 3;
      conV2 = false;
    } else if (e === '22.4') {
      V1 = 12;
      R1 = 4;
      R2 = 8;
      R3 = 4;
      conV2 = false;
    }
  }
  $effect(() => aplicar(ejemplo));
  // Any manual change leaves the book example.
  $effect(() => {
    const ok02 = V1 === 12 && R1 === 4 && R2 === 6 && R3 === 3 && !conV2;
    const ok224 = V1 === 12 && R1 === 4 && R2 === 8 && R3 === 4 && !conV2;
    if (ejemplo === '0.2' && !ok02) ejemplo = 'libre';
    else if (ejemplo === '22.4' && !ok224) ejemplo = 'libre';
  });

  // Mesh analysis (both mesh currents clockwise): [R1+R2, −R2; −R2, R2+R3]·[I1; I2] = [V1; −V2].
  const sol = $derived.by(() => {
    const v2 = conV2 ? V2 : 0;
    const a = R1 + R2;
    const b = -R2;
    const d = R2 + R3;
    const det = a * d - b * b;
    const I1 = (V1 * d - b * -v2) / det;
    const I2 = (a * -v2 - b * V1) / det;
    const vA = V1 - R1 * I1; // top node, the bottom rail is ground
    return { I1, I2, IR2: I1 - I2, vA, v2, vTR: vA - R3 * I2 };
  });

  // Geometry (logical units) for the two layouts.
  function geo(est: boolean) {
    return est
      ? { xL: 120, xM: 320, xR: 520, yT: 90, yB: 290 }
      : { xL: 110, xM: 280, xR: 450, yT: 80, yB: 310 };
  }

  // One element of a loop: from point a to b, potential change `dv` spread over [u0, u1] of the segment.
  interface Tramo {
    a: [number, number];
    b: [number, number];
    dv: number;
    nombre: string;
  }

  function recorrido(est: boolean): Tramo[] {
    const g = geo(est);
    const { I1, I2, IR2, v2 } = sol;
    const TL: [number, number] = [g.xL, g.yT];
    const TM: [number, number] = [g.xM, g.yT];
    const TR: [number, number] = [g.xR, g.yT];
    const BL: [number, number] = [g.xL, g.yB];
    const BM: [number, number] = [g.xM, g.yB];
    const BR: [number, number] = [g.xR, g.yB];
    const m1: Tramo[] = [
      { a: BL, b: TL, dv: V1, nombre: `+${num(V1, 2)} V en V_1` },
      { a: TL, b: TM, dv: -R1 * I1, nombre: `${num(-R1 * I1, 2)} V en R_1` },
      { a: TM, b: BM, dv: -R2 * IR2, nombre: `${num(-R2 * IR2, 2)} V en R_2` },
      { a: BM, b: BL, dv: 0, nombre: '' },
    ];
    const m2: Tramo[] = [
      { a: BM, b: TM, dv: R2 * IR2, nombre: `${num(R2 * IR2, 2)} V en R_2` },
      { a: TM, b: TR, dv: -R3 * I2, nombre: `${num(-R3 * I2, 2)} V en R_3` },
      { a: TR, b: BR, dv: -v2, nombre: conV2 ? `${num(-v2, 2)} V en V_2` : '' },
      { a: BR, b: BM, dv: 0, nombre: '' },
    ];
    const ext: Tramo[] = [
      { a: BL, b: TL, dv: V1, nombre: `+${num(V1, 2)} V en V_1` },
      { a: TL, b: TM, dv: -R1 * I1, nombre: `${num(-R1 * I1, 2)} V en R_1` },
      { a: TM, b: TR, dv: -R3 * I2, nombre: `${num(-R3 * I2, 2)} V en R_3` },
      { a: TR, b: BR, dv: -v2, nombre: conV2 ? `${num(-v2, 2)} V en V_2` : '' },
      { a: BR, b: BL, dv: 0, nombre: '' },
    ];
    return lazo === 'm1' ? m1 : lazo === 'm2' ? m2 : ext;
  }

  // Walker position along the loop (0–1) and arrow phases of each branch.
  let u = 0;
  const fases = { r1: 0, r2: 0, r3: 0, v2: 0, bl: 0, br: 0 };
  let uMostrada = $state(0);
  const muestreo = new Muestreo(80);

  $effect(() => {
    if (reloj.reinicios >= 0) u = 0;
  });

  function paso(dt: number): void {
    u = (u + dt / 7) % 1;
    const { I1, I2, IR2 } = sol;
    const imax = Math.max(Math.abs(I1), Math.abs(I2), Math.abs(IR2), 1e-9);
    const k = 70 / imax;
    fases.r1 += dt * Math.abs(I1) * k;
    fases.r2 += dt * Math.abs(IR2) * k;
    fases.r3 += dt * Math.abs(I2) * k;
    fases.v2 += dt * Math.abs(I2) * k;
    fases.bl += dt * Math.abs(I1) * k;
    fases.br += dt * Math.abs(I2) * k;
    if (muestreo.toca()) uMostrada = u;
  }

  /** Point at fraction s of the loop and the potential there. */
  function enLazo(tr: Tramo[], s: number): { x: number; y: number; v: number; i: number } {
    const L = tr.map((t) => Math.hypot(t.b[0] - t.a[0], t.b[1] - t.a[1]));
    const tot = L.reduce((a, b) => a + b, 0);
    let d = s * tot;
    let v = 0;
    for (let i = 0; i < tr.length; i++) {
      const t = tr[i]!;
      if (d <= L[i]! || i === tr.length - 1) {
        const f = Math.min(1, d / L[i]!);
        // The change happens in the middle 40 % of the segment (where the symbol is drawn).
        const g = Math.min(1, Math.max(0, (f - 0.3) / 0.4));
        return { x: t.a[0] + (t.b[0] - t.a[0]) * f, y: t.a[1] + (t.b[1] - t.a[1]) * f, v: v + t.dv * g, i };
      }
      d -= L[i]!;
      v += t.dv;
    }
    return { x: 0, y: 0, v: 0, i: 0 };
  }

  function perfil(tr: Tramo[]): { s: number[]; v: number[] } {
    const s: number[] = [];
    const vv: number[] = [];
    for (let k = 0; k <= 400; k++) {
      const p = enLazo(tr, k / 400);
      s.push(k / 400);
      vv.push(p.v);
    }
    return { s, v: vv };
  }

  // The potential profile only changes with the circuit and the loop: computed once per change.
  const perfilEstrecho = $derived(perfil(recorrido(true)));
  const perfilAncho = $derived(perfil(recorrido(false)));

  function dibujar(v: Vista): void {
    const { ctx } = v;
    const p = pal;
    const est = v.estrecho;
    const g = geo(est);
    const { I1, I2, IR2, vA, vTR } = sol;
    const tr = recorrido(est);
    const pf = est ? perfilEstrecho : perfilAncho;
    const vmax = Math.max(V1, conV2 ? Math.abs(V2) : 0, Math.abs(vA), 1);
    const e: Ejes = est
      ? { x: 60, y: 370, w: 510, h: 160, x0: 0, x1: 1, y0: -0.15 * vmax, y1: vmax * 1.15 }
      : { x: 560, y: 90, w: 310, h: 250, x0: 0, x1: 1, y0: -0.15 * vmax, y1: vmax * 1.15 };

    estatico(v, `k:${est}:${conV2}:${lazo}:${e.y1.toFixed(3)}`, (vv) => {
      hilo(vv, [[g.xL, g.yB], [g.xR, g.yB]]);
      hilo(vv, [[g.xL, g.yT], [g.xR, g.yT]]);
      hilo(vv, [[g.xL, g.yT], [g.xL, (g.yT + g.yB) / 2 - 30]]);
      hilo(vv, [[g.xL, (g.yT + g.yB) / 2 + 30], [g.xL, g.yB]]);
      hilo(vv, [[g.xM, g.yT], [g.xM, g.yB]]);
      hilo(vv, [[g.xR, g.yT], [g.xR, g.yB]]);
      masa(vv, g.xM, g.yB + 4);
      panel(vv, e, { titulo: 'Potencial a lo largo del lazo', uy: 'V', marcasX: [], sinX: true, etY: 'V', cero: true });
    });

    // Components over the wires (they cover the wire under the symbol).
    const ym = (g.yT + g.yB) / 2;
    fuente(v, g.xL, ym, 26, 'dc', { rotulo: `V_1 = ${num(V1, 1)} V`, lado: -1 });
    resistencia(v, g.xL + 50, g.yT, g.xM - 50, g.yT, { largo: 70, alto: 22, relleno: p.fondo });
    resistencia(v, g.xM, ym - 50, g.xM, ym + 50, { largo: 70, alto: 22, relleno: p.fondo });
    resistencia(v, g.xM + 50, g.yT, g.xR - 50, g.yT, { largo: 70, alto: 22, relleno: p.fondo });
    if (conV2) fuente(v, g.xR, ym, 26, 'dc', { rotulo: `V_2 = ${num(V2, 1)} V`, lado: 1 });
    txtRico(v, `R_1 = ${num(R1, 1)} Ω`, (g.xL + g.xM) / 2, g.yT - 28, { tam: 13, peso: 700 });
    txtRico(v, 'R_2', g.xM + 20, ym - 9, { tam: 13, peso: 700, alin: 'left' });
    txt(v, `${num(R2, 1)} Ω`, g.xM + 20, ym + 9, { tam: 13, peso: 700, alin: 'left' });
    txtRico(v, `R_3 = ${num(R3, 1)} Ω`, (g.xM + g.xR) / 2, g.yT - 28, { tam: 13, peso: 700 });
    nodo(v, g.xM, g.yT);
    nodo(v, g.xM, g.yB);

    // Mesh currents: circular arrows in each window.
    for (const [cx, I, et] of [
      [(g.xL + g.xM) / 2, I1, 'I_1'],
      [(g.xM + g.xR) / 2 + 14, I2, 'I_2'],
    ] as const) {
      const r = 34;
      ctx.save();
      ctx.strokeStyle = alfa(p.acento, 0.55);
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      const horario = I >= 0;
      ctx.arc(cx, ym, r, -2.6, 1.9);
      ctx.stroke();
      ctx.restore();
      const a = horario ? 1.9 : -2.6;
      const px = cx + r * Math.cos(a);
      const py = ym + r * Math.sin(a);
      const t = horario ? a + Math.PI / 2 : a - Math.PI / 2;
      flecha(ctx, px - Math.cos(t) * 2, py - Math.sin(t) * 2, px + Math.cos(t) * 8, py + Math.sin(t) * 8, alfa(p.acento, 0.8), 1.8, 9);
      txtRico(v, `${et} = ${si(Math.abs(I), 'A', 3)}`, cx, ym + 2, { tam: 12.5, peso: 700, color: p.acento });
    }

    // Branch currents (conventional, amber) moving along each wire; reversed when negative.
    const rama = (pts: [number, number][], fase: number, I: number) => {
      if (Math.abs(I) < 1e-6) return;
      const c = new Camino(I >= 0 ? pts : [...pts].reverse());
      corrienteEnCamino(ctx, c, fase, 46, p, 10, 0.95);
    };
    rama([[g.xL, g.yT], [g.xM, g.yT]], fases.r1, I1);
    rama([[g.xM, g.yT], [g.xM, g.yB]], fases.r2, IR2);
    rama([[g.xM, g.yT], [g.xR, g.yT]], fases.r3, I2);
    rama([[g.xR, g.yT], [g.xR, g.yB]], fases.v2, I2);
    rama([[g.xM, g.yB], [g.xL, g.yB], [g.xL, g.yT]], fases.bl, I1);
    rama([[g.xR, g.yB], [g.xM, g.yB]], fases.br, I2);

    // KCL at the top node.
    txtRico(v, `A: ${num(I1, 3)} = ${num(I2, 3)} + ${num(IR2, 3)} A`, g.xM, g.yT - 52, {
      tam: 12.5,
      peso: 700,
      color: p.corriente,
      fondo: alfa(p.corriente, p.oscuro ? 0.16 : 0.1),
    });
    txt(v, `${num(vA, 2)} V`, g.xM + 8, g.yT + 16, { tam: 12, alin: 'left', color: p.suave });
    txt(v, '0 V', g.xM + 18, g.yB + 16, { tam: 12, alin: 'left', color: p.suave });
    if (conV2 || Math.abs(vTR) > 1e-9) txt(v, `${num(vTR, 2)} V`, g.xR - 8, g.yT + 16, { tam: 12, alin: 'right', color: p.suave });

    // The walker and its loop.
    ctx.save();
    ctx.strokeStyle = alfa(p.serie[4], 0.35);
    ctx.lineWidth = 7;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(tr[0]!.a[0], tr[0]!.a[1]);
    for (const t of tr) ctx.lineTo(t.b[0], t.b[1]);
    ctx.stroke();
    ctx.restore();
    const w = enLazo(tr, u);
    circulo(ctx, w.x, w.y, 8, p.serie[4], p.fondo, 2);
    const vW = w.v;
    const tramoAct = tr[w.i]!;

    // Potential profile.
    curva(ctx, e, pf.s, pf.v, p.serie[4], 2.4);
    guia(ctx, e, 'x', u, alfa(p.serie[4], 0.6), 1.2);
    punto(ctx, e, u, vW, p.serie[4], 5.5, p.fondo);
    const ex = est ? e.x + e.w / 2 : e.x + e.w / 2;
    rr(ctx, ex - 120, e.y + e.h + 24, 240, 26, 13);
    ctx.fillStyle = alfa(p.serie[4], p.oscuro ? 0.2 : 0.1);
    ctx.fill();
    txtRico(v, tramoAct.nombre || 'cable: 0 V', ex, e.y + e.h + 37, { tam: 12.5, peso: 700, color: p.serie[4] });
    txtRico(v, `Σ en el lazo = ${num(tr.reduce((a, t) => a + t.dv, 0), 3)} V`, ex, e.y + e.h + 64, { tam: 12.5, peso: 700 });
  }

  const texto = $derived.by(() => {
    const { I1, I2, IR2 } = sol;
    const tr = recorrido(false);
    const terms = tr
      .filter((t) => t.nombre)
      .map((t) => `${t.dv >= 0 ? '+' : '−'}${num(Math.abs(t.dv), 2)} V`)
      .join(' ');
    const nombreLazo = lazo === 'm1' ? 'la malla 1' : lazo === 'm2' ? 'la malla 2' : 'el lazo exterior';
    const pf = V1 * I1 + (conV2 ? -V2 * I2 : 0);
    const pr = R1 * I1 * I1 + R2 * IR2 * IR2 + R3 * I2 * I2;
    return (
      `**Ley de tensiones:** recorriendo ${nombreLazo} y volviendo al punto de partida, las subidas de las fuentes igualan las caídas I·R: ${terms} = 0. Si no fuera cero, se sacaría energía de la nada dando vueltas al circuito.\n` +
      `**Ley de corrientes:** en el nodo A entra I_1 = ${si(I1, 'A', 4)} y sale lo mismo, I_2 = ${si(I2, 'A', 4)} por R_3 más ${si(IR2, 'A', 4)} por R_2: por la resistencia compartida circula la diferencia de las dos corrientes de malla.\n` +
      `Comprobación del libro, el balance de potencias: las fuentes entregan ${si(pf, 'W', 4)} y las resistencias disipan ${si(pr, 'W', 4)}.`
    );
  });

  const lecturas = $derived([
    { e: 'I_1 (malla 1)', v: si(sol.I1, 'A', 4), c: pal.acento },
    { e: 'I_2 (malla 2)', v: si(sol.I2, 'A', 4), c: pal.acento },
    { e: 'Corriente en R_2', v: si(sol.IR2, 'A', 4), c: pal.corriente },
    { e: 'Tensión del nodo A', v: si(sol.vA, 'V', 4) },
    { e: 'Potencial del caminante', v: si(enLazo(recorrido(false), uMostrada).v, 'V', 3), c: pal.serie[4] },
  ]);
</script>

<Marco {reloj} {texto} {lecturas} leyenda={['corriente']}>
  {#snippet modos()}
    <Selector
      etiqueta="Lazo que recorre el caminante"
      bind:valor={lazo}
      opciones={[
        { valor: 'm1', texto: 'Malla 1' },
        { valor: 'm2', texto: 'Malla 2' },
        { valor: 'ext', texto: 'Lazo exterior' },
      ]}
    />
  {/snippet}
  {#snippet escena()}
    <Escena {reloj} {paso} {dibujar} dims={(a) => (a < 560 ? [600, 620] : [900, 420])} etiqueta="Circuito de dos mallas con sus corrientes y el potencial a lo largo de un lazo" />
  {/snippet}
  {#snippet controles()}
    <Selector
      etiqueta="Ejemplo"
      bind:valor={ejemplo}
      opciones={[
        { valor: '0.2', texto: 'Sección 0.2' },
        { valor: '22.4', texto: 'Sección 22.4' },
        { valor: 'libre', texto: 'Libre' },
      ]}
    />
    <Deslizador etiqueta="V_1" bind:valor={V1} min={0} max={24} paso={0.5} unidad="V" />
    <Deslizador etiqueta="R_1" bind:valor={R1} min={1} max={20} paso={1} unidad="Ω" />
    <Deslizador etiqueta="R_2 (compartida)" bind:valor={R2} min={1} max={20} paso={1} unidad="Ω" />
    <Deslizador etiqueta="R_3" bind:valor={R3} min={1} max={20} paso={1} unidad="Ω" />
    <Interruptor etiqueta="Segunda fuente V_2 en la malla 2" bind:valor={conV2} />
    {#if conV2}<Deslizador etiqueta="V_2" bind:valor={V2} min={-12} max={12} paso={0.5} unidad="V" />{/if}
  {/snippet}
</Marco>
