<script lang="ts">
  // Schottky versus PN (book 5.5 and 5.7): a metal on N silicon makes a lower barrier (0,15–0,45 V instead
  // of ~0,7 V) and, above all, there is no minority-carrier injection: only electrons, majority on both
  // sides, carry the current. The PN diode stores injected charge that must be pulled out before it can
  // block: the reverse-recovery current. The Schottky only has to charge its junction capacitance.
  import { untrack } from 'svelte';
  import Escena from '../ui/Escena.svelte';
  import Marco from '../ui/Marco.svelte';
  import Deslizador from '../ui/Deslizador.svelte';
  import Grafica from '../ui/Grafica.svelte';
  import { Reloj, Muestreo } from '../nucleo/reloj.svelte';
  import { txt, txtRico, fondo, electrones, huecos, azar, tarjeta, type Vista } from '../nucleo/dibujo';
  import { mezcla, paleta } from '../nucleo/paleta';
  import { vDiodo, shockley } from '../nucleo/fisica';
  import { si, num } from '../nucleo/formato';
  import { app } from '../../../lib/estado.svelte';

  const reloj = new Reloj();
  const pal = $derived(paleta(app.tema));
  let Iop = $state(1);
  const IS_PN = 1e-9;
  const IS_SCH = 2e-5;
  const N_PN = 1.6;
  const N_SCH = 1.05;
  const RS = 0.05;
  const vfPN = $derived(vDiodo(Iop, IS_PN, N_PN) + Iop * RS);
  const vfSch = $derived(vDiodo(Iop, IS_SCH, N_SCH) + Iop * RS);

  // Switching: forward I_F for half a period, then a reverse voltage; the PN diode must remove its stored
  // charge Q = I_F·τ (τ = 3 µs here, slowed 1·10⁶ times: 1 µs ↔ 1 s).
  const TAU = 3;
  const PERIODO = 16;
  let t = 0;
  let q = 0;
  let iPN = 0;
  let iSch = 0;
  let tt: number[] = [];
  let a: number[] = [];
  let b: number[] = [];
  let serie = $state.raw<{ t: number[]; pn: number[]; sch: number[] }>({ t: [], pn: [], sch: [] });
  const muestreo = new Muestreo(60);
  const rnd = azar(61);
  const almacen = Array.from({ length: 60 }, () => ({ x: rnd(), y: rnd() }));
  const libres = Array.from({ length: 40 }, () => ({ x: rnd(), y: rnd(), s: 0.5 + rnd() }));
  let fase = 0;

  $effect(() => {
    if (reloj.reinicios >= 0)
      untrack(() => {
        t = 0;
        q = 0;
        tt = [];
        a = [];
        b = [];
      });
  });

  function paso(dt: number): void {
    t += dt;
    const ciclo = t % PERIODO;
    const directa = ciclo < PERIODO / 2;
    const IF = Iop;
    const IR = -Iop; // reverse current limited by the circuit during recovery
    if (directa) {
      q += (IF * TAU - q) * (1 - Math.exp(-dt / TAU));
      iPN = IF;
      iSch = IF;
    } else {
      // Storage phase: constant reverse current until the charge is gone, then exponential tail.
      if (q > 0) {
        q = Math.max(0, q + IR * dt);
        iPN = q > 0 ? IR : 0;
      } else iPN = iPN * Math.exp(-dt / 0.4);
      // The Schottky only sees a brief capacitive spike.
      iSch = ciclo - PERIODO / 2 < 0.15 ? IR * 0.15 : 0;
    }
    fase += dt * 40 * (directa ? 1 : -1);
    if (ciclo < dt) {
      tt = [];
      a = [];
      b = [];
    }
    tt.push(ciclo * 1e-6);
    a.push(iPN);
    b.push(iSch);
    if (muestreo.toca()) serie = { t: tt.slice(), pn: a.slice(), sch: b.slice() };
  }

  function panel(v: Vista, x0: number, y0: number, w: number, h: number, pn: boolean): void {
    const { ctx } = v;
    const p = pal;
    tarjeta(v, x0, y0, w, h, pn ? 'Diodo PN de silicio' : 'Diodo Schottky (metal + N)');
    const ix0 = x0 + 16;
    const ix1 = x0 + w - 16;
    const iy0 = y0 + 34;
    const iy1 = y0 + h - 46;
    const xj = ix0 + (ix1 - ix0) * 0.38;
    // Regions.
    ctx.fillStyle = pn ? p.siP : mezcla(p.aluminio, '#ffffff', 0.25);
    ctx.fillRect(ix0, iy0, xj - ix0, iy1 - iy0);
    ctx.fillStyle = p.siN;
    ctx.fillRect(xj, iy0, ix1 - xj, iy1 - iy0);
    txt(v, pn ? 'P' : 'metal', (ix0 + xj) / 2, iy0 + 14, { tam: 13, peso: 800, color: pn ? p.hueco : p.suave });
    txt(v, 'N', (xj + ix1) / 2, iy0 + 14, { tam: 13, peso: 800, color: p.electron });
    const i = pn ? iPN : iSch;
    // Majority electrons drifting (towards the left in forward conduction).
    const pts: { x: number; y: number }[] = [];
    for (const l of libres) {
      const u = (((l.x - (fase * l.s * Math.min(1, Math.abs(i))) / 400) % 1) + 1) % 1;
      const x = pn ? xj + u * (ix1 - xj) : ix0 + u * (ix1 - ix0);
      pts.push({ x, y: iy0 + 24 + l.y * (iy1 - iy0 - 30) });
    }
    electrones(ctx, pts, 3.2, p);
    if (pn) {
      // Stored minority holes in N near the junction (∝ q).
      const n = Math.round((q / (Math.max(Iop, 0.01) * TAU)) * almacen.length);
      const hs: { x: number; y: number }[] = [];
      for (let k = 0; k < n; k++) {
        const s = almacen[k]!;
        hs.push({ x: xj + 6 + Math.pow(s.x, 2) * (ix1 - xj) * 0.55, y: iy0 + 24 + s.y * (iy1 - iy0 - 30) });
      }
      huecos(ctx, hs, 3.4, p);
      const hp: { x: number; y: number }[] = [];
      for (let k = 0; k < 18; k++) hp.push({ x: ix0 + 10 + (k % 6) * ((xj - ix0 - 20) / 6), y: iy0 + 30 + Math.floor(k / 6) * ((iy1 - iy0 - 40) / 3) });
      huecos(ctx, hp, 3.4, p);
      txt(v, n > 0 ? `carga almacenada: ${n} huecos en N` : 'sin carga almacenada', (ix0 + ix1) / 2, iy1 + 16, { tam: 12, peso: 700, color: n > 0 ? p.hueco : p.suave });
    } else txt(v, 'solo electrones: nada que evacuar', (ix0 + ix1) / 2, iy1 + 16, { tam: 12, peso: 700, color: p.bien });
    const col = i < -0.01 ? p.peligro : p.corriente;
    txtRico(v, `i = ${si(i, 'A', 2)}`, (ix0 + ix1) / 2, iy1 + 34, { tam: 13.5, peso: 800, color: col });
  }

  function dibujar(v: Vista): void {
    void Iop;
    fondo(v);
    const est = v.estrecho;
    const p = pal;
    const ciclo = t % PERIODO;
    const directa = ciclo < PERIODO / 2;
    txt(v, directa ? 'Fase: polarización directa (conduce)' : 'Fase: tensión inversa (debe bloquear)', v.w / 2, 24, {
      tam: 15,
      peso: 800,
      color: directa ? p.corriente : p.peligro,
    });
    if (est) {
      panel(v, 20, 50, v.w - 40, (v.h - 70) / 2 - 6, true);
      panel(v, 20, 50 + (v.h - 70) / 2 + 6, v.w - 40, (v.h - 70) / 2 - 6, false);
    } else {
      panel(v, 20, 50, v.w / 2 - 30, v.h - 70, true);
      panel(v, v.w / 2 + 10, 50, v.w / 2 - 30, v.h - 70, false);
    }
  }

  const curvas = $derived.by(() => {
    const xs: number[] = [];
    const pn: number[] = [];
    const sc: number[] = [];
    for (let k = 0; k <= 200; k++) {
      const vv = (k / 200) * 1.2;
      xs.push(vv);
      pn.push(shockley(vv, IS_PN, N_PN));
      sc.push(shockley(vv, IS_SCH, N_SCH));
    }
    return { xs, pn, sc };
  });

  const texto = $derived(
    `**Caída en conducción:** a ${si(Iop, 'A', 2)}, el PN cae ${num(vfPN, 2)} V y el Schottky ${num(vfSch, 2)} V: la barrera metal-semiconductor es más baja, y a 1 A eso ahorra medio vatio.\n` +
      '**Al conmutar:** el PN ha inyectado huecos en su lado N, que tienen que salir antes de que pueda bloquear; mientras salen circula una **corriente inversa** (recuperación inversa). El Schottky no inyecta minoritarios: solo carga su pequeña capacidad. A cambio, fuga más en inversa y aguanta menos tensión.',
  );
  const lecturas = $derived([
    { e: 'V_F del PN', v: `${num(vfPN, 3)} V` },
    { e: 'V_F del Schottky', v: `${num(vfSch, 3)} V`, c: pal.bien },
    { e: 'Ahorro de potencia', v: si((vfPN - vfSch) * Iop, 'W', 2) },
  ]);
</script>

<Marco {reloj} {texto} {lecturas} leyenda={['electron', 'hueco', 'corriente']}>
  {#snippet escena()}
    <Escena {reloj} {paso} {dibujar} dims={(a) => (a < 560 ? [560, 620] : [900, 380])} etiqueta="Diodo PN y Schottky conmutando" />
  {/snippet}
  {#snippet controles()}
    <Deslizador etiqueta="Corriente directa" bind:valor={Iop} min={0.01} max={3} log unidad="A" />
    <p class="nota">Conmutación en cámara lenta: 1 µs del circuito dura 1 s en pantalla (vida de los minoritarios del PN: 3 µs).</p>
  {/snippet}
  {#snippet grafica()}
    <Grafica
      titulo="Corriente al pasar de directa a inversa"
      x={{ etiqueta: 't', unidad: 's', min: 0, max: PERIODO * 1e-6 }}
      y={{ etiqueta: 'i', unidad: 'A', min: -Iop * 1.2, max: Iop * 1.2 }}
      series={[
        { x: serie.t, y: serie.pn, color: pal.hueco, nombre: 'PN' },
        { x: serie.t, y: serie.sch, color: pal.bien, nombre: 'Schottky' },
      ]}
      lineas={[{ x: (PERIODO / 2) * 1e-6, etiqueta: 'se invierte', color: pal.suave }]}
    />
    <div style="height: 12px"></div>
    <Grafica
      titulo="Curvas en directa"
      x={{ etiqueta: 'V_F', unidad: 'V', min: 0, max: 1.2 }}
      y={{ etiqueta: 'I_F', unidad: 'A', min: 0, max: 3 }}
      series={[
        { x: curvas.xs, y: curvas.pn, color: pal.hueco, nombre: 'PN' },
        { x: curvas.xs, y: curvas.sc, color: pal.bien, nombre: 'Schottky' },
      ]}
      puntos={[
        { x: vfPN, y: Iop, color: pal.hueco },
        { x: vfSch, y: Iop, color: pal.bien },
      ]}
    />
  {/snippet}
</Marco>

<style>
  .nota {
    margin: 0;
    font-size: 13px;
    color: var(--tinta-suave);
  }
</style>
