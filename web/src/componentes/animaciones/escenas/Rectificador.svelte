<script lang="ts">
  // Rectifiers (book 5.6): half wave, centre-tapped full wave and bridge, with the diodes that conduct in each
  // half cycle and the filter capacitor that charges in short current pulses at the peaks. Book numbers:
  // 12 V rms → 16,97 V peak; after a bridge (two drops of 0,7 V) 15,57 V.
  import { compartir3d } from '../../tres/compartir.svelte';
  import Escena from '../ui/Escena.svelte';
  import Marco from '../ui/Marco.svelte';
  import Deslizador from '../ui/Deslizador.svelte';
  import Selector from '../ui/Selector.svelte';
  import Grafica from '../ui/Grafica.svelte';
  import { Reloj } from '../nucleo/reloj.svelte';
  import { txt, txtRico, fondo, rr, Camino, electronesEnCamino, corrienteEnCamino, circulo, type Vista } from '../nucleo/dibujo';
  import { fuente, hilo, diodo, resistencia, condensador, nodo } from '../nucleo/esquema';
  import { alfa, paleta } from '../nucleo/paleta';
  import { si, num } from '../nucleo/formato';
  import { app } from '../../../lib/estado.svelte';

  type Tipo = 'media' | 'toma' | 'puente';
  const reloj = new Reloj();
  const pal = $derived(paleta(app.tema));
  let tipo = $state<Tipo>('puente');
  let RL = $state(220);
  let C = $state(0);
  const VRMS = 12;
  const VP = VRMS * Math.SQRT2;
  const F = 50;
  const VD = 0.7;

  const nd = $derived(tipo === 'puente' ? 2 : 1);
  const N = 400;
  // Steady-state waveforms over two periods (simulated over six).
  const ondas = $derived.by(() => {
    const T = 1 / F;
    const dt = T / 200;
    let vo = 0;
    const ts: number[] = [];
    const vs: number[] = [];
    const vos: number[] = [];
    const ids: number[] = [];
    for (let k = 0; k < 1200 + N; k++) {
      const t = k * dt;
      const s = VP * Math.sin(2 * Math.PI * F * t);
      const rect = tipo === 'media' ? Math.max(0, s) : Math.abs(s);
      const disponible = rect - nd * VD;
      let id = 0;
      if (C > 0) {
        if (disponible > vo) {
          const nuevo = disponible;
          id = nuevo / RL + (C * (nuevo - vo)) / dt;
          vo = nuevo;
        } else vo = vo * Math.exp(-dt / (RL * C));
      } else {
        vo = Math.max(0, disponible);
        id = vo / RL;
      }
      if (k >= 1200) {
        ts.push((k - 1200) * dt);
        vs.push(s);
        vos.push(vo);
        ids.push(id);
      }
    }
    return { ts, vs, vos, ids };
  });
  const vmax = $derived(Math.max(...ondas.vos));
  const vmin = $derived(Math.min(...ondas.vos.slice(N / 4)));
  const vmed = $derived(ondas.vos.reduce((a, b) => a + b, 0) / ondas.vos.length);
  const ipico = $derived(Math.max(...ondas.ids));

  let idx = 0;
  let fase = 0;
  const VISUAL = 3; // seconds on screen per mains period
  let tv = 0;
  function paso(dt: number): void {
    tv += dt;
    idx = Math.floor(((tv / VISUAL) % 2) * (N / 2)) % N;
    const i = ondas.ids[idx] ?? 0;
    fase += dt * Math.min(120, 20 + i * 200);
  }

  function dibujar(v: Vista): void {
    void [tipo, RL, C];
    const { ctx } = v;
    const p = pal;
    fondo(v);
    const est = v.estrecho;
    const s = ondas.vs[idx] ?? 0;
    const vo = ondas.vos[idx] ?? 0;
    const id = ondas.ids[idx] ?? 0;
    const pos = s >= 0;
    const kI = Math.min(1, id / Math.max(ipico, 1e-6) + (id > 1e-4 ? 0.15 : 0));
    const xs = est ? 60 : 80;
    const yT = 70;
    const yB = est ? 290 : 310;
    const ym = (yT + yB) / 2;
    const xo = est ? 400 : 520;
    let lazo: Camino | null = null;
    const conduce = (on: boolean) => (on && id > 1e-4 ? Math.min(1, 0.4 + kI) : 0);

    if (tipo === 'media' || tipo === 'puente') {
      fuente(v, xs, ym, 26, 'ac', { rotulo: '12 V', lado: -1 });
      txt(v, pos ? '+' : '−', xs + 30, ym - 34, { tam: 15, peso: 800, color: pos ? p.positivo : p.tinta });
    }
    if (tipo === 'media') {
      const xd = xs + 140;
      hilo(v, [
        [xs, ym - 26],
        [xs, yT],
        [xd - 20, yT],
      ]);
      diodo(v, xd - 20, yT, xd + 20, yT, { conduce: conduce(pos) });
      hilo(v, [
        [xd + 20, yT],
        [xo, yT],
      ]);
      hilo(v, [
        [xs, ym + 26],
        [xs, yB],
        [xo, yB],
      ]);
      lazo = new Camino([
        [xs, ym - 26],
        [xs, yT],
        [xo, yT],
        [xo, yB],
        [xs, yB],
        [xs, ym + 26],
      ]);
      txt(v, 'D', xd, yT - 24, { tam: 13, peso: 700 });
    } else if (tipo === 'puente') {
      const xd = xs + 190;
      const h = 70;
      const L: [number, number] = [xd - h, ym];
      const R: [number, number] = [xd + h, ym];
      const T: [number, number] = [xd, ym - h];
      const B: [number, number] = [xd, ym + h];
      hilo(v, [
        [xs, ym - 26],
        [xs, yT - 10],
        [L[0] - 30, yT - 10],
        [L[0] - 30, ym],
        L,
      ]);
      hilo(v, [
        [xs, ym + 26],
        [xs, yB + 10],
        [R[0] + 30, yB + 10],
        [R[0] + 30, ym],
        R,
      ]);
      const sobre = (a: [number, number], b: [number, number], f: number): [number, number] => [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
      const dio = (a: [number, number], b: [number, number], on: boolean, n: string) => {
        const p1 = sobre(a, b, 0.3);
        const p2 = sobre(a, b, 0.7);
        hilo(v, [a, p1]);
        hilo(v, [p2, b]);
        diodo(v, p1[0], p1[1], p2[0], p2[1], { conduce: conduce(on), tam: 16 });
        const m = sobre(a, b, 0.5);
        txt(v, n, m[0] + (m[0] < xd ? -16 : 16), m[1] + (m[1] < ym ? -12 : 12), { tam: 12, peso: 700, color: on && id > 1e-4 ? p.corriente : p.suave });
      };
      dio(L, T, pos, 'D1');
      dio(R, T, !pos, 'D2');
      dio(B, L, !pos, 'D3');
      dio(B, R, pos, 'D4');
      for (const q of [L, R, T, B]) nodo(v, q[0], q[1]);
      hilo(v, [T, [T[0], yT], [xo, yT]]);
      hilo(v, [B, [B[0], yB], [xo, yB]]);
      lazo = pos
        ? new Camino([[xs, ym - 26], [xs, yT - 10], [L[0] - 30, yT - 10], [L[0] - 30, ym], L, T, [T[0], yT], [xo, yT], [xo, yB], [B[0], yB], B, R, [R[0] + 30, ym], [R[0] + 30, yB + 10], [xs, yB + 10], [xs, ym + 26]])
        : new Camino([[xs, ym + 26], [xs, yB + 10], [R[0] + 30, yB + 10], [R[0] + 30, ym], R, T, [T[0], yT], [xo, yT], [xo, yB], [B[0], yB], B, L, [L[0] - 30, ym], [L[0] - 30, yT - 10], [xs, yT - 10], [xs, ym - 26]]);
    } else {
      // Centre-tapped secondary: two sources in series with the tap to the output return.
      fuente(v, xs, ym - 60, 22, 'ac', { rotulo: '12 V', lado: -1 });
      fuente(v, xs, ym + 60, 22, 'ac', { rotulo: '12 V', lado: -1 });
      hilo(v, [
        [xs, ym - 38],
        [xs, ym + 38],
      ]);
      nodo(v, xs, ym);
      const xd = xs + 150;
      hilo(v, [
        [xs, ym - 82],
        [xs, yT],
        [xd - 20, yT],
      ]);
      diodo(v, xd - 20, yT, xd + 20, yT, { conduce: conduce(pos) });
      hilo(v, [
        [xs, ym + 82],
        [xs, yB + 10],
        [xd - 20, yB + 10],
      ]);
      diodo(v, xd - 20, yB + 10, xd + 20, yB + 10, { conduce: conduce(!pos) });
      hilo(v, [
        [xd + 20, yB + 10],
        [xd + 60, yB + 10],
        [xd + 60, yT],
      ]);
      hilo(v, [
        [xd + 20, yT],
        [xo, yT],
      ]);
      hilo(v, [
        [xs, ym],
        [xd - 50, ym],
        [xd - 50, yB - 20],
        [xo, yB - 20],
        [xo, yB - 20],
      ]);
      txt(v, 'D1', xd, yT - 22, { tam: 12, peso: 700 });
      txt(v, 'D2', xd, yB + 32, { tam: 12, peso: 700 });
      txt(v, 'toma media', xs + 14, ym, { tam: 11.5, alin: 'left', color: p.suave });
      lazo = pos
        ? new Camino([[xs, ym - 82], [xs, yT], [xo, yT], [xo, yB - 20], [xd - 50, yB - 20], [xd - 50, ym], [xs, ym], [xs, ym - 38]])
        : new Camino([[xs, ym + 82], [xs, yB + 10], [xd + 60, yB + 10], [xd + 60, yT], [xo, yT], [xo, yB - 20], [xd - 50, yB - 20], [xd - 50, ym], [xs, ym], [xs, ym + 38]]);
    }
    // Load and capacitor.
    const yLb = tipo === 'toma' ? yB - 20 : yB;
    nodo(v, xo, yT);
    if (C > 0) {
      hilo(v, [
        [xo, yT],
        [xo, ym - 10],
      ]);
      condensador(v, xo, ym - 10, xo, ym + 10, { polarizado: true, placa: 34 });
      hilo(v, [
        [xo, ym + 10],
        [xo, yLb],
      ]);
      txtRico(v, `${si(C, 'F', 2)}`, xo - 24, ym, { alin: 'right', tam: 12.5 });
    } else
      hilo(v, [
        [xo, yT],
        [xo, yLb],
      ]);
    const xr = xo + (est ? 70 : 90);
    hilo(v, [
      [xo, yT],
      [xr, yT],
      [xr, ym - 28],
    ]);
    resistencia(v, xr, ym - 28, xr, ym + 28, { largo: 52 });
    hilo(v, [
      [xr, ym + 28],
      [xr, yLb],
      [xo, yLb],
    ]);
    if (est) {
      txtRico(v, 'R_L', xr + 14, ym - 9, { alin: 'left', tam: 12.5 });
      txt(v, si(RL, 'Ω', 3), xr + 14, ym + 9, { alin: 'left', tam: 12.5 });
    } else txtRico(v, `R_L ${si(RL, 'Ω', 3)}`, xr + 16, ym, { alin: 'left', tam: 12.5 });
    txtRico(v, `v_out = ${num(vo, 2)} V`, (xo + xr) / 2, yT - 24, { tam: 15, peso: 800, color: p.acento });
    if (lazo && id > 1e-4) {
      electronesEnCamino(ctx, lazo, -fase, 22, 3.2, p, kI);
      corrienteEnCamino(ctx, lazo, fase * 0.6, 130, p, 11, kI);
    }
    // Mini scope with the cursor.
    if (!est) {
      const sx0 = xr + 110;
      const sx1 = v.w - 20;
      const sy0 = 60;
      const sy1 = 320;
      rr(ctx, sx0, sy0, sx1 - sx0, sy1 - sy0, 10);
      ctx.fillStyle = p.panel;
      ctx.fill();
      ctx.strokeStyle = p.linea;
      ctx.stroke();
      const X = (k: number) => sx0 + 8 + (k / (N - 1)) * (sx1 - sx0 - 16);
      const Y = (val: number) => (sy0 + sy1) / 2 - (val / 19) * ((sy1 - sy0) / 2 - 10);
      const trazar = (arr: number[], c: string, w: number) => {
        ctx.strokeStyle = c;
        ctx.lineWidth = w;
        ctx.beginPath();
        arr.forEach((val, k) => (k ? ctx.lineTo(X(k), Y(val)) : ctx.moveTo(X(k), Y(val))));
        ctx.stroke();
      };
      trazar(ondas.vs, alfa(p.tenue, 0.8), 1.5);
      trazar(ondas.vos, p.acento, 2.4);
      ctx.strokeStyle = alfa(p.tinta, 0.4);
      ctx.beginPath();
      ctx.moveTo(X(idx), sy0 + 6);
      ctx.lineTo(X(idx), sy1 - 6);
      ctx.stroke();
      circulo(ctx, X(idx), Y(vo), 4.5, p.acento);
      txt(v, 'v_sec', sx0 + 10, sy0 + 14, { tam: 11.5, alin: 'left', color: p.tenue, peso: 700 });
      txt(v, 'v_out', sx0 + 60, sy0 + 14, { tam: 11.5, alin: 'left', color: p.acento, peso: 700 });
    }
    txt(v, pos ? 'semiciclo positivo' : 'semiciclo negativo', est ? v.w / 2 : (xs + xo) / 2, v.h - 20, { tam: 14, peso: 800, color: pos ? p.positivo : p.electron });
  }

  const texto = $derived.by(() => {
    const base =
      tipo === 'media'
        ? `**Media onda:** un solo diodo deja pasar el semiciclo positivo y bloquea el negativo. Desperdicia la mitad y el rizado es de 50 Hz.`
        : tipo === 'toma'
          ? `**Toma media:** cada mitad del secundario alimenta la carga en un semiciclo, a través de su diodo; solo hay una caída de diodo, a costa de bobinar el doble.`
          : `**Puente:** en el semiciclo positivo conducen D1 y D4; en el negativo, D2 y D3. La corriente atraviesa la carga siempre en el mismo sentido, pagando dos caídas de diodo: ${num(VP, 2)} − 1,4 = ${num(VP - 1.4, 2)} V de pico.`;
    const filtro =
      C > 0
        ? ` Con ${si(C, 'F', 2)} el condensador se carga al pico y alimenta la carga entre picos: rizado de ${num(vmax - vmin, 2)} V. Los diodos solo conducen en **pulsos cortos** de hasta ${si(ipico, 'A', 2)}, varias veces la corriente media.`
        : ` Sin condensador la salida es una continua pulsante de valor medio ${num(vmed, 2)} V.`;
    return base + '\n' + filtro.trim();
  });
  const lecturas = $derived([
    { e: 'Pico de salida', v: `${num(vmax, 2)} V`, c: pal.acento },
    { e: 'Valor medio', v: `${num(vmed, 2)} V` },
    { e: 'Rizado', v: C > 0 ? `${num(vmax - vmin, 2)} V` : '—' },
    { e: 'Pico de corriente por diodo', v: si(ipico, 'A', 3), c: pal.corriente },
    { e: 'Frecuencia del rizado', v: tipo === 'media' ? '50 Hz' : '100 Hz' },
  ]);

  // 3D view of the page (componentes/tres): the model follows these controls.
  compartir3d(() => ({ tipo }));
</script>

<Marco {reloj} {texto} {lecturas} leyenda={['electron', 'corriente']}>
  {#snippet modos()}
    <Selector
      bind:valor={tipo}
      opciones={[
        { valor: 'media', texto: 'Media onda' },
        { valor: 'toma', texto: 'Toma media' },
        { valor: 'puente', texto: 'Puente' },
      ]}
    />
  {/snippet}
  {#snippet escena()}
    <Escena {reloj} {paso} {dibujar} dims={(a) => (a < 560 ? [560, 380] : [1000, 380])} etiqueta="Rectificador con los diodos que conducen en cada semiciclo" />
  {/snippet}
  {#snippet controles()}
    <Selector
      etiqueta="Condensador de filtro"
      bind:valor={C}
      opciones={[
        { valor: 0, texto: 'Sin filtro' },
        { valor: 470e-6, texto: '470 µF' },
        { valor: 2200e-6, texto: '2 200 µF' },
      ]}
    />
    <Deslizador etiqueta="Carga R_L" bind:valor={RL} min={22} max={2200} log unidad="Ω" />
  {/snippet}
  {#snippet grafica()}
    <Grafica
      titulo="Tensión del secundario y de salida (dos periodos de 50 Hz)"
      x={{ etiqueta: 't', unidad: 's', min: 0, max: 0.04 }}
      y={{ etiqueta: 'v', unidad: 'V', min: -18, max: 18 }}
      series={[
        { x: ondas.ts, y: ondas.vs, color: pal.tenue, ancho: 1.5, nombre: 'secundario' },
        { x: ondas.ts, y: ondas.vos, color: pal.acento, ancho: 2.6, nombre: 'salida' },
      ]}
    />
  {/snippet}
</Marco>
