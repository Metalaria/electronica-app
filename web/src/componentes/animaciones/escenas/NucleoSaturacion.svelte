<script lang="ts">
  // Core saturation and the air gap (book 4.10, fig. 4.16): a ferrite toroid, µ_r = 2000, 6 cm magnetic
  // length, 1 cm², 50 turns, B_sat = 0,35 T: 10,5 mH saturating at 167 mA. With a 0,5 mm gap: 0,59 mH and
  // 2,95 A, eighteen times more energy. Domains align with the field until there are none left to align.
  import Escena from '../ui/Escena.svelte';
  import Marco from '../ui/Marco.svelte';
  import Deslizador from '../ui/Deslizador.svelte';
  import Selector from '../ui/Selector.svelte';
  import Grafica from '../ui/Grafica.svelte';
  import { Reloj } from '../nucleo/reloj.svelte';
  import { txt, txtRico, fondo, flecha, brillo, azar, type Vista } from '../nucleo/dibujo';
  import { alfa, mezcla, paleta } from '../nucleo/paleta';
  import { MU0 } from '../nucleo/fisica';
  import { si, num, pct } from '../nucleo/formato';
  import { app } from '../../../lib/estado.svelte';

  const reloj = new Reloj();
  const pal = $derived(paleta(app.tema));
  const MUR = 2000;
  const LE = 0.06;
  const AREA = 1e-4;
  const NV = 50;
  const BSAT = 0.35;

  let gap = $state(0);
  let I = $state(0.12);

  const mueff = (g: number) => LE / (LE / MUR + g);
  const L0 = (g: number) => (MU0 * mueff(g) * NV * NV * AREA) / LE;
  const iSat = (g: number) => (BSAT * LE) / (MU0 * mueff(g) * NV);
  const B = (i: number, g: number) => BSAT * Math.tanh((MU0 * mueff(g) * NV * i) / LE / BSAT);
  const Linc = (i: number, g: number) => L0(g) * Math.pow(1 / Math.cosh((MU0 * mueff(g) * NV * i) / LE / BSAT), 2);
  // Stored energy ∫ i·dλ with λ = N·A·B(i).
  function energia(i: number, g: number): number {
    let e = 0;
    const n = 200;
    for (let k = 0; k < n; k++) {
      const a = (i * k) / n;
      const b = (i * (k + 1)) / n;
      e += ((a + b) / 2) * NV * AREA * (B(b, g) - B(a, g));
    }
    return e;
  }

  const b = $derived(B(I, gap));
  const frac = $derived(b / BSAT);
  const Li = $derived(Linc(I, gap));
  const W = $derived(energia(I, gap));

  const rnd = azar(17);
  const dominios = Array.from({ length: 90 }, (_, k) => ({ a: (k / 90) * Math.PI * 2, r: rnd(), o: rnd() * Math.PI * 2, u: rnd() }));
  let t = 0;
  function paso(dt: number): void {
    t += dt;
  }

  function dibujar(v: Vista): void {
    void [gap, I];
    const { ctx } = v;
    const p = pal;
    fondo(v);
    const est = v.estrecho;
    const cx = est ? v.w / 2 : 260;
    const cy = est ? 210 : 210;
    const R1 = est ? 150 : 160;
    const R0 = R1 * 0.62;
    const rm = (R1 + R0) / 2;
    const huecoAng = gap > 0 ? 0.1 : 0;
    // Core ring (with a slot for the gap at the right).
    ctx.beginPath();
    ctx.arc(cx, cy, R1, huecoAng / 2, Math.PI * 2 - huecoAng / 2);
    ctx.arc(cx, cy, R0, Math.PI * 2 - huecoAng / 2, huecoAng / 2, true);
    ctx.closePath();
    const g = ctx.createRadialGradient(cx, cy, R0, cx, cy, R1);
    g.addColorStop(0, mezcla(p.ferrita, '#000000', 0.2));
    g.addColorStop(0.5, mezcla(p.ferrita, '#ffffff', 0.2));
    g.addColorStop(1, mezcla(p.ferrita, '#000000', 0.2));
    ctx.fillStyle = g;
    ctx.fill();
    // Domains: aligned fraction follows B/B_sat (they turn tangent, in the direction of the flux).
    for (const d of dominios) {
      if (gap > 0 && Math.abs(Math.atan2(Math.sin(d.a), Math.cos(d.a))) < huecoAng) continue;
      const r = R0 + 10 + d.r * (R1 - R0 - 20);
      const x = cx + Math.cos(d.a) * r;
      const y = cy + Math.sin(d.a) * r;
      const tangente = d.a + Math.PI / 2;
      const alineado = d.u < frac;
      const a = alineado ? tangente : d.o + Math.sin(t * 1.5 + d.o) * 0.3;
      const L = 10;
      flecha(ctx, x - Math.cos(a) * L, y - Math.sin(a) * L, x + Math.cos(a) * L, y + Math.sin(a) * L, alineado ? '#ffd166' : alfa('#d5dbe2', 0.85), 2.2, 7);
    }
    // Flux lines circulating in the core.
    const nl = Math.round(1 + 5 * frac);
    ctx.save();
    ctx.strokeStyle = alfa(p.campoB, 0.85);
    ctx.lineWidth = 1.6;
    ctx.setLineDash([8, 7]);
    ctx.lineDashOffset = -t * 40 * Math.min(1, I * 3 + 0.2);
    for (let k = 0; k < nl; k++) {
      const r = R0 + ((R1 - R0) * (k + 1)) / (nl + 1);
      ctx.beginPath();
      ctx.arc(cx, cy, r, huecoAng / 2 + 0.02, Math.PI * 2 - huecoAng / 2 - 0.02);
      ctx.stroke();
    }
    ctx.restore();
    // Gap: fringing flux and the energy stored there.
    if (gap > 0) {
      const gx = cx + rm;
      brillo(ctx, gx, cy, 34 + 30 * frac, p.campoB, 0.25 + 0.5 * frac);
      ctx.strokeStyle = alfa(p.campoB, 0.7);
      ctx.lineWidth = 1.4;
      for (let k = -2; k <= 2; k++) {
        ctx.beginPath();
        ctx.moveTo(gx + 10, cy - 12 + k * 6);
        ctx.quadraticCurveTo(gx + 18 + Math.abs(k) * 8, cy + k * 8, gx + 10, cy + 12 + k * 6);
        ctx.stroke();
      }
      txt(v, 'entrehierro 0,5 mm', gx + 34, cy - 30, { tam: 12.5, peso: 700, alin: 'left', color: p.campoB });
      txt(v, 'aquí se guarda la energía', gx + 34, cy - 12, { tam: 12, alin: 'left', color: p.suave });
    }
    // Winding (50 turns, drawn as ~16 across the ring at the left).
    for (let k = 0; k < 16; k++) {
      const a = Math.PI * 0.62 + (k / 15) * Math.PI * 0.76;
      const x0 = cx + Math.cos(a) * (R0 - 6);
      const y0 = cy + Math.sin(a) * (R0 - 6);
      const x1 = cx + Math.cos(a) * (R1 + 6);
      const y1 = cy + Math.sin(a) * (R1 + 6);
      ctx.strokeStyle = p.cobre;
      ctx.lineWidth = 4.5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.lineWidth = 1.4;
      ctx.stroke();
    }
    txtRico(v, `I = ${si(I, 'A', 3)}`, cx, cy - 14, { tam: 15, peso: 800, color: p.corriente });
    txtRico(v, `B = ${num(b, 3)} T`, cx, cy + 10, { tam: 15, peso: 800, color: p.campoB });
    txtRico(v, `${pct(frac, 0)} de B_{sat}`, cx, cy + 32, { tam: 12, color: p.suave });
    if (frac > 0.9) txt(v, 'SATURADO: L se desploma', cx, cy + R1 + 26, { tam: 15, peso: 800, color: p.peligro });
    if (!est) {
      txt(v, 'dominios alineados', 560, 70, { tam: 13, alin: 'left', peso: 700, color: '#d4a017' });
      txt(v, 'dominios libres', 560, 92, { tam: 13, alin: 'left', peso: 700, color: p.suave });
    }
  }

  const curvas = $derived.by(() => {
    const xs: number[] = [];
    const s0: number[] = [];
    const s1: number[] = [];
    for (let k = 0; k <= 200; k++) {
      const i = (k / 200) * 4;
      xs.push(i);
      s0.push(B(i, 0));
      s1.push(B(i, 0.5e-3));
    }
    return { xs, s0, s1 };
  });

  const texto = $derived.by(() => {
    const isat = iSat(gap);
    const base = gap
      ? `**Con entrehierro de 0,5 mm:** medio milímetro de aire «pesa» como un metro de ferrita y domina el circuito magnético. L baja a ${si(L0(gap), 'H', 2)}, pero la corriente de saturación sube a ${si(isat, 'A', 3)}: se puede guardar unas 18 veces más energía, y casi toda está en el hueco.\n`
      : `**Sin entrehierro:** con µ_r = 2000 y 50 espiras, L = ${si(L0(0), 'H', 3)}, pero el núcleo satura (0,35 T) con solo ${si(isat, 'A', 3)}. Mucha inductancia y casi ninguna energía.\n`;
    return (
      base +
      (frac > 0.9
        ? `Con ${si(I, 'A', 3)} casi todos los dominios están ya alineados: el material no da más, la inductancia incremental cae a ${si(Li, 'H', 2)} y la corriente se dispara. En una fuente conmutada, eso destruye el transistor.`
        : `Con ${si(I, 'A', 3)}, B = ${num(b, 3)} T y la bobina guarda ${si(W, 'J', 3)}.`)
    );
  });

  const lecturas = $derived([
    { e: 'B en el núcleo', v: `${num(b, 3)} T`, c: pal.campoB },
    { e: 'L incremental', v: si(Li, 'H', 3), c: frac > 0.9 ? pal.peligro : pal.tinta },
    { e: 'Corriente de saturación', v: si(iSat(gap), 'A', 3) },
    { e: 'Energía almacenada', v: si(W, 'J', 3) },
  ]);
</script>

<Marco {reloj} {texto} {lecturas} leyenda={['campoB']}>
  {#snippet modos()}
    <Selector bind:valor={gap} opciones={[{ valor: 0, texto: 'Sin entrehierro' }, { valor: 0.5e-3, texto: 'Con entrehierro de 0,5 mm' }]} />
  {/snippet}
  {#snippet escena()}
    <Escena {reloj} {paso} {dibujar} dims={(a) => (a < 560 ? [560, 450] : [760, 420])} etiqueta="Núcleo toroidal con dominios magnéticos alineándose" />
  {/snippet}
  {#snippet controles()}
    <Deslizador etiqueta="Corriente I" bind:valor={I} min={0} max={4} paso={0.005} unidad="A" />
    <div class="atajos">
      <button class="boton" onclick={() => (I = 0.167)}>167 mA</button>
      <button class="boton" onclick={() => (I = 2.95)}>2,95 A</button>
    </div>
  {/snippet}
  {#snippet grafica()}
    <Grafica
      titulo="Densidad de flujo frente a la corriente"
      x={{ etiqueta: 'I', unidad: 'A', min: 0, max: 4 }}
      y={{ etiqueta: 'B', unidad: 'T', min: 0, max: 0.4 }}
      series={[
        { x: curvas.xs, y: curvas.s0, color: pal.hueco, nombre: 'sin entrehierro', alfa: gap ? 0.45 : 1 },
        { x: curvas.xs, y: curvas.s1, color: pal.acento, nombre: 'con 0,5 mm', alfa: gap ? 1 : 0.45 },
      ]}
      lineas={[{ y: BSAT, etiqueta: 'B_sat = 0,35 T', color: pal.peligro }]}
      puntos={[{ x: I, y: b, color: pal.corriente, etiqueta: `${num(b, 3)} T` }]}
    />
  {/snippet}
</Marco>

<style>
  .atajos {
    display: flex;
    gap: 6px;
    margin-top: -6px;
  }
  .atajos .boton {
    min-height: 30px;
    font-size: 13px;
  }
</style>
