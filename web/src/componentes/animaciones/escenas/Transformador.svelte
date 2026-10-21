<script lang="ts">
  // Transformer (book 4.6): the alternating primary current creates a flux in the common core that induces
  // the secondary voltage; V₁/V₂ = N₁/N₂ and, ideally, I₁/I₂ = N₂/N₁ (power is conserved).
  import Escena from '../ui/Escena.svelte';
  import Marco from '../ui/Marco.svelte';
  import Deslizador from '../ui/Deslizador.svelte';
  import Grafica from '../ui/Grafica.svelte';
  import { Reloj } from '../nucleo/reloj.svelte';
  import { txt, txtRico, fondo, rr, Camino, electronesEnCamino, flecha, type Vista } from '../nucleo/dibujo';
  import { fuente, hilo, lampara } from '../nucleo/esquema';
  import { alfa, mezcla, paleta } from '../nucleo/paleta';
  import { si, num } from '../nucleo/formato';
  import { app } from '../../../lib/estado.svelte';

  const reloj = new Reloj();
  const pal = $derived(paleta(app.tema));

  let N1 = $state(1000);
  let N2 = $state(52);
  let RL = $state(12);
  const V1 = 230;
  const V2 = $derived((V1 * N2) / N1);
  const I2 = $derived(V2 / RL);
  const I1 = $derived((I2 * N2) / N1);

  const PERIODO = 2.5;
  let fase = 0;
  function paso(dt: number): void {
    fase += (dt / PERIODO) * Math.PI * 2;
  }

  function bobinado(v: Vista, x: number, y0: number, y1: number, n: number, ancho: number, color: string): void {
    const { ctx } = v;
    const paso = (y1 - y0) / n;
    for (let k = 0; k < n; k++) {
      const y = y0 + paso * (k + 0.5);
      ctx.strokeStyle = color;
      ctx.lineWidth = Math.max(2.5, Math.min(7, paso * 0.7));
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(x - ancho / 2, y + paso * 0.2);
      ctx.lineTo(x + ancho / 2, y - paso * 0.2);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.3)';
      ctx.lineWidth = 1.2;
      ctx.stroke();
    }
  }

  function dibujar(v: Vista): void {
    void [N1, N2, RL];
    const { ctx } = v;
    const p = pal;
    fondo(v);
    const est = v.estrecho;
    const s = Math.sin(fase);
    const cx = v.w / 2;
    const cw = est ? 260 : 300;
    const ch = est ? 220 : 240;
    const cy = est ? 190 : 200;
    const brazo = 46;
    const x0 = cx - cw / 2;
    const x1 = cx + cw / 2;
    const y0 = cy - ch / 2;
    const y1 = cy + ch / 2;
    // Laminated core.
    ctx.fillStyle = mezcla(p.hierro, p.fondo, 0.1);
    rr(ctx, x0, y0, cw, ch, 6);
    ctx.fill();
    ctx.fillStyle = p.fondo;
    ctx.fillRect(x0 + brazo, y0 + brazo, cw - 2 * brazo, ch - 2 * brazo);
    ctx.strokeStyle = alfa('#000000', 0.12);
    ctx.lineWidth = 1;
    for (let k = 4; k < brazo; k += 6) {
      ctx.strokeRect(x0 + k / 2, y0 + k / 2, cw - k, ch - k);
    }
    // Flux circulating (direction and density follow the sine).
    ctx.save();
    ctx.strokeStyle = alfa(p.campoB, 0.25 + 0.7 * Math.abs(s));
    ctx.lineWidth = 2.2;
    ctx.setLineDash([10, 8]);
    ctx.lineDashOffset = -Math.cos(fase) * 60;
    const m = brazo / 2;
    ctx.strokeRect(x0 + m, y0 + m, cw - 2 * m, ch - 2 * m);
    ctx.restore();
    const dir = s >= 0 ? 1 : -1;
    if (Math.abs(s) > 0.15) {
      flecha(ctx, cx - 30 * dir, y0 + m, cx + 30 * dir, y0 + m, p.campoB, 2.6, 12);
      txt(v, 'Φ', cx, y0 + m - 20, { tam: 16, peso: 800, color: p.campoB });
    }
    // Windings: number of drawn turns ∝ N (log-compressed).
    const n1 = Math.round(Math.min(22, 4 + 6 * Math.log10(N1 / 10)));
    const n2 = Math.round(Math.min(22, 2 + 6 * Math.log10(N2 / 10)));
    bobinado(v, x0 + brazo / 2, y0 + brazo + 6, y1 - brazo - 6, Math.max(2, n1), brazo + 22, p.cobre);
    bobinado(v, x1 - brazo / 2, y0 + brazo + 6, y1 - brazo - 6, Math.max(2, n2), brazo + 22, mezcla(p.cobre, '#c03030', 0.3));
    txtRico(v, `N_1 = ${N1}`, x0 + brazo / 2, y1 + 22, { tam: 14, peso: 800 });
    txtRico(v, `N_2 = ${N2}`, x1 - brazo / 2, y1 + 22, { tam: 14, peso: 800 });
    // Primary circuit (AC source) and secondary load (lamp).
    const xs = est ? 40 : x0 - 140;
    const xl = est ? v.w - 40 : x1 + 140;
    const ya = y0 + brazo + 6;
    const yb = y1 - brazo - 6;
    fuente(v, xs, cy, 24, 'ac', { rotulo: est ? '' : `${V1} V`, lado: -1 });
    hilo(v, [
      [xs, cy - 24],
      [xs, ya],
      [x0 + brazo / 2 - 30, ya],
    ]);
    hilo(v, [
      [xs, cy + 24],
      [xs, yb],
      [x0 + brazo / 2 - 30, yb],
    ]);
    hilo(v, [
      [x1 - brazo / 2 + 30, ya],
      [xl, ya],
      [xl, cy - 20],
    ]);
    hilo(v, [
      [x1 - brazo / 2 + 30, yb],
      [xl, yb],
      [xl, cy + 20],
    ]);
    const brilloL = Math.min(1, (V2 * I2) / 30) * (0.55 + 0.45 * Math.abs(s));
    lampara(v, xl, cy - 20, xl, cy + 20, brilloL);
    // Electrons oscillating in both circuits (amplitude ∝ current, with the transformer's ratio).
    const prim = new Camino([
      [xs, cy - 24],
      [xs, ya],
      [x0, ya],
    ]);
    const sec = new Camino([
      [x1, ya],
      [xl, ya],
      [xl, cy - 20],
    ]);
    electronesEnCamino(ctx, prim, 20 - Math.cos(fase) * Math.min(18, 4 + I1 * 30), 20, 3.2, p, 0.85);
    electronesEnCamino(ctx, sec, 20 + Math.cos(fase) * Math.min(18, 4 + I2 * 4), 20, 3.2, p, 0.85);
    txtRico(v, `V_1 = ${si(V1 * s * Math.SQRT2, 'V', 3)}`, xs + (est ? 30 : 0), y0 - 4, { tam: 13, peso: 700, color: p.serie[0], alin: est ? 'left' : 'center' });
    txtRico(v, `V_2 = ${si(V2 * s * Math.SQRT2, 'V', 3)}`, xl - (est ? 30 : 0), y0 - 4, { tam: 13, peso: 700, color: p.hueco, alin: est ? 'right' : 'center' });
    txtRico(v, `relación N_1/N_2 = ${num(N1 / N2, 2)}`, cx, v.h - 22, { tam: 15, peso: 800, color: p.acento, fondo: alfa(p.acento, 0.1) });
  }

  const ondas = $derived.by(() => {
    const xs: number[] = [];
    const a: number[] = [];
    const b: number[] = [];
    for (let k = 0; k <= 200; k++) {
      const t = (k / 200) * 0.04;
      xs.push(t);
      a.push(V1 * Math.SQRT2 * Math.sin(2 * Math.PI * 50 * t));
      b.push(V2 * Math.SQRT2 * Math.sin(2 * Math.PI * 50 * t));
    }
    return { xs, a, b };
  });

  const texto = $derived(
    `La corriente alterna del primario crea en el núcleo un **flujo variable** que atraviesa también el secundario y en cada una de sus espiras induce la misma tensión que en una del primario. Por eso V_1/V_2 = N_1/N_2: con ${N1} y ${N2} espiras, ${V1} V eficaces se convierten en ${num(V2, 1)} V.\n` +
      `La potencia se conserva (idealmente): ${num(V2, 1)} V × ${si(I2, 'A', 3)} en el secundario exigen ${si(I1, 'A', 3)} en el primario. ` +
      (N2 < N1 ? 'Reductor: menos tensión, más corriente disponible.' : 'Elevador: más tensión, menos corriente.'),
  );
  const lecturas = $derived([
    { e: 'V_2 eficaz', v: si(V2, 'V', 3), c: pal.hueco },
    { e: 'I_2 = V_2/R_L', v: si(I2, 'A', 3) },
    { e: 'I_1 = I_2·N_2/N_1', v: si(I1, 'A', 3) },
    { e: 'Potencia', v: si(V2 * I2, 'W', 3) },
    { e: 'Pico del secundario', v: si(V2 * Math.SQRT2, 'V', 3) },
  ]);
</script>

<Marco {reloj} {texto} {lecturas} leyenda={['electron', 'campoB']}>
  {#snippet escena()}
    <Escena {reloj} {paso} {dibujar} dims={(a) => (a < 560 ? [560, 420] : [900, 420])} etiqueta="Transformador con su flujo en el núcleo" />
  {/snippet}
  {#snippet controles()}
    <Deslizador etiqueta="Espiras del primario N_1" bind:valor={N1} min={100} max={2000} paso={10} formato={(x) => String(x)} />
    <Deslizador etiqueta="Espiras del secundario N_2" bind:valor={N2} min={10} max={2000} paso={1} formato={(x) => String(x)} />
    <Deslizador etiqueta="Carga R_L" bind:valor={RL} min={1} max={1000} log unidad="Ω" />
  {/snippet}
  {#snippet grafica()}
    <Grafica
      titulo="Tensiones del primario y del secundario (50 Hz)"
      x={{ etiqueta: 't', unidad: 's', min: 0, max: 0.04 }}
      y={{ etiqueta: 'v', unidad: 'V', min: -Math.max(340, V2 * 1.5), max: Math.max(340, V2 * 1.5) }}
      series={[
        { x: ondas.xs, y: ondas.a, color: pal.serie[0], nombre: 'v_1' },
        { x: ondas.xs, y: ondas.b, color: pal.hueco, nombre: 'v_2' },
      ]}
    />
  {/snippet}
</Marco>
