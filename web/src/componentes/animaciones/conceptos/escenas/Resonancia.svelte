<script lang="ts">
  // Resonance and Q (book 1.7, 23.6, 23.7): series RLC driven by 1 V, or parallel RLC (tank) driven by 1 mA.
  // At f₀ = 1/(2π√(LC)) the reactances cancel; the bandwidth is f₀/Q and, in the series circuit, V_L and V_C
  // are Q times the applied voltage. Book example: L = 100 µH, C = 100 pF, R = 10 Ω → f₀ ≈ 1,59 MHz, Q = 100,
  // bandwidth ≈ 16 kHz, and a station 9 kHz away only falls about 3,6 dB.
  import Escena from '../../ui/Escena.svelte';
  import Marco from '../../ui/Marco.svelte';
  import Deslizador from '../../ui/Deslizador.svelte';
  import Selector from '../../ui/Selector.svelte';
  import Interruptor from '../../ui/Interruptor.svelte';
  import { Reloj, Muestreo } from '../../nucleo/reloj.svelte';
  import { txt, txtRico, flecha, type Vista } from '../../nucleo/dibujo';
  import { alfa, paleta } from '../../nucleo/paleta';
  import { si, num } from '../../nucleo/formato';
  import { app } from '../../../../lib/estado.svelte';
  import { estatico, panel, curva, guia, punto, X, Y, type Ejes } from '../nucleo/grafica';
  import { dB } from '../nucleo/senal';

  const reloj = new Reloj();
  const pal = $derived(paleta(app.tema));

  let tipo = $state<'serie' | 'paralelo'>('serie');
  let L = $state(100e-6);
  let C = $state(100e-12);
  let R = $state(10);
  let Rp = $state(100e3);
  let barrer = $state(true);
  let fRel = $state(1); // f / f₀

  const f0 = $derived(1 / (2 * Math.PI * Math.sqrt(L * C)));
  const Q = $derived(tipo === 'serie' ? Math.sqrt(L / C) / R : Rp / Math.sqrt(L / C));
  const BW = $derived(f0 / Q);
  const rango = $derived(Math.min(0.9, 5 / Q));

  function resp(f: number): { mod: number; fi: number; re: number; im: number } {
    const w = 2 * Math.PI * f;
    if (tipo === 'serie') {
      // Current for 1 V: 1/Z.
      const x = w * L - 1 / (w * C);
      const d = R * R + x * x;
      return { mod: 1 / Math.sqrt(d), fi: -Math.atan2(x, R), re: R / d, im: -x / d };
    }
    // Impedance of the tank (voltage for 1 A; scaled to 1 mA in the readouts).
    const b = w * C - 1 / (w * L);
    const g = 1 / Rp;
    const d = g * g + b * b;
    return { mod: 1 / Math.sqrt(d), fi: -Math.atan2(b, g), re: g / d, im: -b / d };
  }

  let fase = 0;
  let th = 0;
  let n = $state(0);
  const muestreo = new Muestreo(60);
  function paso(dt: number): void {
    if (barrer) {
      fase += dt / 10;
      fRel = 1 + rango * 0.95 * Math.sin(2 * Math.PI * fase);
    }
    th = (th + (2 * Math.PI * dt) / 2.5) % (2 * Math.PI);
    if (muestreo.toca()) n++;
  }

  const curvaF = $derived.by(() => {
    const N = 400;
    const xs = new Float64Array(N + 1);
    const ys = new Float64Array(N + 1);
    for (let k = 0; k <= N; k++) {
      const fr = 1 - rango + (2 * rango * k) / N;
      xs[k] = fr * f0;
      ys[k] = resp(fr * f0).mod;
    }
    return { xs, ys };
  });

  function dibujar(v: Vista): void {
    void n;
    const { ctx } = v;
    const p = pal;
    const est = v.estrecho;
    const f = fRel * f0;
    const r = resp(f);
    const pico = resp(f0).mod;
    const e: Ejes = est
      ? { x: 70, y: 40, w: 500, h: 220, x0: f0 * (1 - rango), x1: f0 * (1 + rango), y0: 0, y1: pico * 1.1 }
      : { x: 70, y: 40, w: 470, h: 290, x0: f0 * (1 - rango), x1: f0 * (1 + rango), y0: 0, y1: pico * 1.1 };
    const serie = tipo === 'serie';
    estatico(v, `rs:${est}:${tipo}:${f0}:${Q}:${pico}`, (vv) => {
      panel(vv, e, {
        titulo: serie ? 'Corriente con 1 V aplicado' : 'Impedancia del tanque |Z|',
        ux: 'Hz',
        uy: serie ? 'A' : 'Ω',
        etX: 'f',
      });
      // −3 dB band.
      const c = vv.ctx;
      c.fillStyle = alfa(p.acento, 0.08);
      c.fillRect(X(e, f0 - BW / 2), e.y, X(e, f0 + BW / 2) - X(e, f0 - BW / 2), e.h);
    });
    curva(ctx, e, curvaF.xs, curvaF.ys, p.acento, 2.6);
    guia(ctx, e, 'y', pico / Math.SQRT2, alfa(p.acento, 0.5));
    guia(ctx, e, 'x', f0, alfa(p.tinta, 0.35));
    txt(v, `−3 dB · BW = ${si(BW, 'Hz', 3)}`, X(e, f0 + BW / 2) + 6, Y(e, pico / Math.SQRT2) - 10, { tam: 11.5, color: p.acento, alin: 'left', peso: 700 });
    // The book's neighbour station 9 kHz away.
    if (Math.abs(f0 - 1.5915e6) < 2e4 && 9e3 < f0 * rango) {
      const fv = f0 + 9e3;
      guia(ctx, e, 'x', fv, alfa(p.peligro, 0.6));
      txt(v, `emisora a +9 kHz: ${num(dB(resp(fv).mod / pico), 1)} dB`, X(e, fv) + 4, e.y + 14, { tam: 11.5, color: p.peligro, alin: 'left', peso: 700 });
    }
    punto(ctx, e, f, r.mod, p.corriente, 6.5, p.fondo);
    guia(ctx, e, 'x', f, alfa(p.corriente, 0.5), 1.2, [2, 3]);

    // Phasor diagram at the present frequency (series: V_R, V_L, V_C for 1 V; parallel: I_R, I_L, I_C for 1 mA).
    const cx = est ? 300 : 720;
    const cy = est ? 440 : 200;
    const Rad = est ? 115 : 125;
    const w = 2 * Math.PI * f;
    let comps: { nombre: string; re: number; im: number; color: string }[];
    if (serie) {
      const I = { re: r.re, im: r.im };
      const vR = { re: I.re * R, im: I.im * R };
      const vL = { re: -I.im * w * L, im: I.re * w * L };
      const vC = { re: I.im / (w * C), im: -I.re / (w * C) };
      comps = [
        { nombre: 'V_R', ...vR, color: p.serie[0] },
        { nombre: 'V_L', ...vL, color: p.serie[2] },
        { nombre: 'V_C', ...vC, color: p.serie[1] },
        { nombre: 'V', re: 1, im: 0, color: p.acento },
      ];
    } else {
      const Vt = { re: r.re, im: r.im };
      comps = [
        { nombre: 'I_R', re: Vt.re / Rp, im: Vt.im / Rp, color: p.serie[0] },
        { nombre: 'I_C', re: -Vt.im * w * C, im: Vt.re * w * C, color: p.serie[1] },
        { nombre: 'I_L', re: Vt.im / (w * L), im: -Vt.re / (w * L), color: p.serie[2] },
        { nombre: 'I', re: 1, im: 0, color: p.acento },
      ];
    }
    const mmax = Math.max(...comps.map((c) => Math.hypot(c.re, c.im)));
    const k = Rad / mmax;
    ctx.strokeStyle = p.rejilla;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(cx, cy, Rad, 0, Math.PI * 2);
    ctx.stroke();
    const rot = th;
    for (const c of comps) {
      const a = Math.atan2(c.im, c.re) + rot;
      const m = Math.hypot(c.re, c.im) * k;
      flecha(ctx, cx, cy, cx + m * Math.cos(a), cy - m * Math.sin(a), c.color, c.nombre.length === 1 ? 3.2 : 2.4, 11);
      txtRico(v, c.nombre, cx + (m + 14) * Math.cos(a), cy - (m + 14) * Math.sin(a), { tam: 12, peso: 800, color: c.color });
    }
    txt(v, serie ? 'Tensiones (1 V aplicado)' : 'Corrientes (1 mA inyectado)', cx, cy - Rad - 32, { tam: 12, peso: 700, color: p.suave });
  }

  const lect = $derived.by(() => {
    const f = fRel * f0;
    const r = resp(f);
    const w = 2 * Math.PI * f;
    if (tipo === 'serie') return { f, prim: r.mod, vL: r.mod * w * L, vC: r.mod / (w * C) };
    return { f, prim: r.mod, vL: r.mod / (w * L), vC: r.mod * w * C };
  });

  const texto = $derived.by(() => {
    const atn = dB(lect.prim / resp(f0).mod);
    if (tipo === 'serie')
      return (
        `**Resonancia serie:** a f_0 = 1/(2π√(LC)) = ${si(f0, 'Hz', 3)} las reactancias se cancelan y solo queda R: la corriente es máxima, V/R = ${si(1 / R, 'A', 3)}. Q = √(L/C)/R = ${num(Q, 1)} y el ancho de banda f_0/Q = ${si(BW, 'Hz', 3)}.\n` +
        `Ahora, a ${si(lect.f, 'Hz', 4)} (${num(atn, 1)} dB): V_L = ${si(lect.vL, 'V', 3)} y V_C = ${si(lect.vC, 'V', 3)} con solo 1 V aplicado. En resonancia son Q veces la tensión de entrada y casi se anulan entre sí: la **sobretensión** que hay que prever en los componentes.`
      );
    return (
      `**Resonancia paralelo (tanque):** a f_0 = ${si(f0, 'Hz', 3)} las corrientes de L y C son iguales y opuestas y circulan entre ellas; desde fuera solo se ve R_p: la impedancia es máxima, ${si(Rp, 'Ω', 3)}. Q = R_p/√(L/C) = ${num(Q, 1)}, ancho de banda ${si(BW, 'Hz', 3)}.\n` +
      `Ahora, a ${si(lect.f, 'Hz', 4)} (${num(atn, 1)} dB): con 1 mA inyectado, por L circulan ${si(lect.vL * 1e-3, 'A', 3)} y por C ${si(lect.vC * 1e-3, 'A', 3)}. Es el circuito de sintonía del oscilador y de la FI de un receptor.`
    );
  });

  const lecturas = $derived([
    { e: 'f_0', v: si(f0, 'Hz', 4), c: pal.acento },
    { e: 'Q', v: num(Q, 1), c: pal.acento },
    { e: 'Ancho de banda', v: si(BW, 'Hz', 3) },
    { e: 'Frecuencia actual', v: si(lect.f, 'Hz', 4), c: pal.corriente },
    { e: tipo === 'serie' ? 'Corriente' : 'Tensión (1 mA)', v: tipo === 'serie' ? si(lect.prim, 'A', 3) : si(lect.prim * 1e-3, 'V', 3), c: pal.corriente },
    { e: 'Respuesta relativa', v: `${num(dB(lect.prim / resp(f0).mod), 1)} dB` },
  ]);
</script>

<Marco {reloj} {texto} {lecturas}>
  {#snippet modos()}
    <Selector
      bind:valor={tipo}
      opciones={[
        { valor: 'serie', texto: 'RLC serie' },
        { valor: 'paralelo', texto: 'RLC paralelo (tanque)' },
      ]}
    />
  {/snippet}
  {#snippet escena()}
    <Escena {reloj} {paso} {dibujar} dims={(a) => (a < 560 ? [600, 570] : [900, 380])} etiqueta="Curva de resonancia con su ancho de banda y el diagrama fasorial a la frecuencia actual" />
  {/snippet}
  {#snippet controles()}
    <Interruptor etiqueta="Barrer la frecuencia" bind:valor={barrer} />
    <Deslizador etiqueta="Frecuencia (f/f_0)" bind:valor={fRel} min={1 - rango} max={1 + rango} paso={rango / 500} formato={(x) => si(x * f0, 'Hz', 4)} desactivado={barrer} />
    <Deslizador etiqueta="L" bind:valor={L} min={1e-6} max={10e-3} log unidad="H" />
    <Deslizador etiqueta="C" bind:valor={C} min={10e-12} max={10e-9} log unidad="F" />
    {#if tipo === 'serie'}
      <Deslizador etiqueta="R (serie)" bind:valor={R} min={0.5} max={1000} log unidad="Ω" />
    {:else}
      <Deslizador etiqueta="R_p (paralelo)" bind:valor={Rp} min={1e3} max={1e6} log unidad="Ω" />
    {/if}
  {/snippet}
</Marco>
