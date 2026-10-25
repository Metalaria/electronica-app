<script lang="ts">
  // Propagation delay and glitches (book 28.3, 9.7, 28.8): every gate takes a few nanoseconds (8 ns in HC, 3 in
  // AC), and when one signal reaches a gate along two paths of different delay the output gives a spurious
  // pulse during the transition. The book's experiment: an XOR fed with a signal and with the same signal
  // through two inverters — in theory always 0, on the oscilloscope a pulse on every edge as wide as the two
  // inverters (about 6 ns with fast gates, 15 ns with a 74HC04). Second case: F = A·B + Ā·C, whose static
  // hazard disappears with the consensus term B·C. A counter clocked by F counts every glitch as an edge.
  // Simulated on a 0,05 ns grid with transport delays.
  import Escena from '../../ui/Escena.svelte';
  import Marco from '../../ui/Marco.svelte';
  import Deslizador from '../../ui/Deslizador.svelte';
  import Selector from '../../ui/Selector.svelte';
  import Interruptor from '../../ui/Interruptor.svelte';
  import { Reloj, Muestreo } from '../../nucleo/reloj.svelte';
  import { txt, txtRico, rr, type Vista } from '../../nucleo/dibujo';
  import { alfa, paleta } from '../../nucleo/paleta';
  import { si, num } from '../../nucleo/formato';
  import { app } from '../../../../lib/estado.svelte';
  import { estatico, X, type Ejes } from '../nucleo/grafica';

  const reloj = new Reloj();
  const pal = $derived(paleta(app.tema));

  let modo = $state<'xor' | 'riesgo'>('xor');
  let tInv = $state(3);
  let tPuerta = $state(3);
  let consenso = $state(false);
  const TW = 160; // ns
  const DT = 0.05;
  const N = Math.round(TW / DT) + 1;

  interface Senal {
    nombre: string;
    v: Uint8Array;
  }

  const sim = $derived.by((): Senal[] => {
    const A = new Uint8Array(N);
    for (let k = 0; k < N; k++) {
      const t = k * DT;
      A[k] = t >= 30 && t < 110 ? 1 : 0;
    }
    const ret = (x: Uint8Array, d: number) => {
      const r = new Uint8Array(N);
      const s = Math.round(d / DT);
      for (let k = 0; k < N; k++) r[k] = x[Math.max(0, k - s)]!;
      return r;
    };
    const op = (a: Uint8Array, b: Uint8Array, f: (x: number, y: number) => number, d: number) => {
      const r = new Uint8Array(N);
      for (let k = 0; k < N; k++) r[k] = f(a[k]!, b[k]!);
      return ret(r, d);
    };
    const not = (a: Uint8Array, d: number) => op(a, a, (x) => 1 - x, d);
    if (modo === 'xor') {
      const n1 = not(A, tInv);
      const n2 = not(n1, tInv);
      const F = op(A, n2, (x, y) => x ^ y, tPuerta);
      return [
        { nombre: 'A', v: A },
        { nombre: 'Ā (1.er inversor)', v: n1 },
        { nombre: 'A retrasada (2.º)', v: n2 },
        { nombre: 'F = A ⊕ A retrasada', v: F },
      ];
    }
    const uno = new Uint8Array(N).fill(1);
    const nA = not(A, tInv);
    const x1 = op(A, uno, (x, y) => x & y, tPuerta);
    const x2 = op(nA, uno, (x, y) => x & y, tPuerta);
    const x3 = op(uno, uno, (x, y) => x & y, tPuerta);
    let o = op(x1, x2, (x, y) => x | y, 0);
    if (consenso) o = op(o, x3, (x, y) => x | y, 0);
    const F = ret(o, tPuerta);
    return [
      { nombre: 'A', v: A },
      { nombre: 'Ā', v: nA },
      { nombre: 'A·B', v: x1 },
      { nombre: 'Ā·C', v: x2 },
      { nombre: 'F = A·B + Ā·C', v: F },
    ];
  });

  /** Spurious pulses of F (rising edges after the first stable level) and their widths. */
  const pulsos = $derived.by(() => {
    const F = sim[sim.length - 1]!.v;
    const r: { t0: number; ancho: number }[] = [];
    for (let k = 1; k < N; k++)
      if (F[k] !== F[k - 1]) {
        let j = k;
        while (j < N && F[j] === F[k]) j++;
        const ancho = (j - k) * DT;
        if (ancho < 40 && j < N) r.push({ t0: k * DT, ancho });
        k = j - 1;
      }
    return r;
  });

  // The time cursor sweeps the 160 ns window in 7 s; the counter clocked by F counts its rising edges.
  let u = 0;
  let cuenta = 0;
  let prevF = 0;
  let n = $state(0);
  const muestreo = new Muestreo(60);
  $effect(() => {
    void [modo, consenso, reloj.reinicios];
    cuenta = 0;
  });
  function paso(dt: number): void {
    u += dt / 7;
    if (u >= 1) u -= 1;
    const F = sim[sim.length - 1]!.v;
    const f = F[Math.min(N - 1, Math.floor(u * (N - 1)))]!;
    if (f && !prevF) cuenta = (cuenta + 1) % 16;
    prevF = f;
    if (muestreo.toca()) n++;
  }

  function dibujar(v: Vista): void {
    void n;
    const { ctx } = v;
    const p = pal;
    const est = v.estrecho;
    const k = Math.min(N - 1, Math.floor(u * (N - 1)));
    const val = (s: Senal) => s.v[k]!;
    const col = (b: number) => (b ? p.peligro : p.electron);
    // Schematic (top).
    const box = (x: number, y: number, w: number, h: number, et: string, salida: number) => {
      rr(ctx, x, y, w, h, 6);
      ctx.fillStyle = p.panel;
      ctx.fill();
      ctx.strokeStyle = p.tinta;
      ctx.lineWidth = 2;
      ctx.stroke();
      txt(v, et, x + w / 2, y + h / 2, { tam: 14, peso: 800 });
      ctx.fillStyle = col(salida);
      ctx.beginPath();
      ctx.arc(x + w + 6, y + h / 2, 4, 0, Math.PI * 2);
      ctx.fill();
    };
    const wire = (pts: [number, number][], b: number) => {
      ctx.strokeStyle = col(b);
      ctx.lineWidth = 3;
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(pts[0]![0], pts[0]![1]);
      for (const q of pts.slice(1)) ctx.lineTo(q[0], q[1]);
      ctx.stroke();
    };
    const lanes = sim.length;
    const eT: Ejes = est
      ? { x: 130, y: 210, w: 440, h: lanes * 46, x0: 0, x1: TW, y0: 0, y1: 1 }
      : { x: 560, y: 40, w: 310, h: lanes * 52, x0: 0, x1: TW, y0: 0, y1: 1 };
    estatico(v, `gl:${est}:${modo}:${consenso}`, (vv) => {
      const c = vv.ctx;
      c.strokeStyle = p.rejilla;
      c.lineWidth = 1;
      c.beginPath();
      for (let t = 0; t <= TW; t += 20) {
        c.moveTo(X(eT, t), eT.y - 6);
        c.lineTo(X(eT, t), eT.y + eT.h);
      }
      c.stroke();
      for (let t = 0; t <= TW; t += 40) txt(vv, `${t} ns`, X(eT, t), eT.y + eT.h + 12, { tam: 10.5, color: p.suave });
      // Phone: names left of the lanes. Wide: above each lane inside the diagram (left of it they ran into the
      // counter).
      if (est) sim.forEach((s, i) => txtRico(vv, s.nombre, eT.x - 8, eT.y + i * (eT.h / lanes) + eT.h / lanes / 2, { tam: 11, peso: 700, color: p.suave, alin: 'right' }));
      else sim.forEach((s, i) => txtRico(vv, s.nombre, eT.x + 3, eT.y + i * (eT.h / lanes) + 4, { tam: 10.5, peso: 700, color: p.suave, alin: 'left' }));
    });
    const s = sim;
    if (modo === 'xor') {
      const y0 = 100;
      wire([[20, y0], [60, y0], [60, 60], [330, 60], [330, y0 - 12], [350, y0 - 12]], val(s[0]!));
      wire([[60, y0], [100, y0]], val(s[0]!));
      box(100, y0 - 22, 60, 44, '1', val(s[1]!));
      wire([[170, y0], [200, y0]], val(s[1]!));
      box(200, y0 - 22, 60, 44, '1', val(s[2]!));
      wire([[270, y0], [330, y0], [330, y0 + 12], [350, y0 + 12]], val(s[2]!));
      box(350, y0 - 30, 64, 60, '=1', val(s[3]!));
      wire([[420, y0], [460, y0]], val(s[3]!));
      txt(v, 'A', 14, y0, { tam: 13, peso: 800, alin: 'right' });
    } else {
      const yA = 60;
      const yB = 140;
      wire([[20, yA], [210, yA]], val(s[0]!));
      wire([[40, yA], [40, yB + 10], [70, yB + 10]], val(s[0]!));
      box(70, yB - 12, 56, 44, '1', val(s[1]!));
      wire([[132, yB + 10], [210, yB + 10]], val(s[1]!));
      box(210, yA - 26, 60, 52, '&', val(s[2]!));
      box(210, yB - 16, 60, 52, '&', val(s[3]!));
      txt(v, 'B = 1', 205, yA + 16, { tam: 11, color: p.suave, alin: 'right' });
      txt(v, 'C = 1', 205, yB + 28, { tam: 11, color: p.suave, alin: 'right' });
      wire([[276, yA], [320, yA], [320, 90], [340, 90]], val(s[2]!));
      wire([[276, yB + 10], [320, yB + 10], [320, 112], [340, 112]], val(s[3]!));
      box(340, 70, 64, 64, '≥1', val(s[4]!));
      wire([[410, 102], [460, 102]], val(s[4]!));
      if (consenso) txt(v, '+ B·C', 372, 150, { tam: 12, peso: 800, color: p.bien });
      txt(v, 'A', 14, yA, { tam: 13, peso: 800, alin: 'right' });
    }
    // Counter clocked by F.
    const cx = est ? 480 : 470;
    rr(ctx, cx, 70, est ? 100 : 74, 60, 8);
    ctx.fillStyle = p.panel;
    ctx.fill();
    ctx.strokeStyle = p.tinta;
    ctx.stroke();
    txt(v, 'contador', cx + (est ? 50 : 37), 86, { tam: 11, color: p.suave });
    txt(v, cuenta.toString(2).padStart(4, '0'), cx + (est ? 50 : 37), 110, { tam: 16, peso: 800, color: p.acento });

    // Timing diagram.
    const lh = eT.h / lanes;
    s.forEach((sg, i) => {
      const yb = eT.y + i * lh + lh * 0.78;
      const yh = eT.y + i * lh + lh * 0.22;
      ctx.strokeStyle = i === lanes - 1 ? p.acento : p.tinta;
      ctx.lineWidth = i === lanes - 1 ? 2.4 : 1.8;
      ctx.beginPath();
      let prev = sg.v[0]!;
      ctx.moveTo(X(eT, 0), prev ? yh : yb);
      for (let j = 1; j < N; j++) {
        const b = sg.v[j]!;
        if (b !== prev) {
          const x = X(eT, j * DT);
          ctx.lineTo(x, prev ? yh : yb);
          ctx.lineTo(x, b ? yh : yb);
          prev = b;
        }
      }
      ctx.lineTo(X(eT, TW), prev ? yh : yb);
      ctx.stroke();
    });
    for (const pu of pulsos) {
      ctx.fillStyle = alfa(p.peligro, 0.15);
      ctx.fillRect(X(eT, pu.t0) - 2, eT.y + (lanes - 1) * lh, X(eT, pu.t0 + pu.ancho) - X(eT, pu.t0) + 4, lh);
    }
    ctx.strokeStyle = alfa(p.tinta, 0.5);
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(X(eT, u * TW), eT.y - 6);
    ctx.lineTo(X(eT, u * TW), eT.y + eT.h);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  const texto = $derived.by(() => {
    const np = pulsos.length;
    const ancho = np ? pulsos[0]!.ancho : 0;
    if (modo === 'xor')
      return (
        `**En teoría F = A ⊕ A = 0 siempre.** Pero la segunda entrada llega por dos inversores, ${num(2 * tInv, 1)} ns más tarde, y durante ese tiempo las dos entradas difieren: en cada flanco de A sale un **pulso de ${num(ancho, 1)} ns**. Es el experimento de la sección 28.3: unos 6 ns con puertas rápidas, unos 15 ns con un 74HC04 (unos 8 ns por puerta en HC, 3 en AC).\n` +
        `Con una salida que enciende un LED no importa. Con una que hace de reloj, **un glitch es un flanco y cuenta**: mira el contador. Por eso en diseño síncrono las salidas combinacionales solo se leen con el reloj, cuando ya se han asentado.`
      );
    return (
      `**F = A·B + Ā·C** con B = C = 1 vale 1 tanto si A es 0 como si es 1. Pero al bajar A, el término A·B cae antes de que Ā·C suba (le falta el retardo del inversor, ${num(tInv, 1)} ns), y F baja un instante: ${np ? `un pulso de ${num(ancho, 1)} ns` : 'aquí no'}. Es un azar estático.\n` +
      (consenso
        ? 'El **término de consenso** B·C (redundante en el álgebra) mantiene F a 1 durante la transición: el glitch desaparece.'
        : 'Añadir el término de consenso B·C, que el álgebra considera redundante, lo elimina: el álgebra describe el estado estable, el circuito también tiene un camino entre estados.')
    );
  });

  const lecturas = $derived([
    { e: 'Pulsos espurios en F', v: String(pulsos.length), c: pulsos.length ? pal.peligro : pal.bien },
    { e: 'Anchura del pulso', v: pulsos.length ? si(pulsos[0]!.ancho * 1e-9, 's', 2) : '—' },
    { e: 'Camino más largo', v: si((modo === 'xor' ? 2 * tInv + tPuerta : tInv + 2 * tPuerta) * 1e-9, 's', 2) },
  ]);
</script>

<Marco {reloj} {texto} {lecturas}>
  {#snippet modos()}
    <Selector
      bind:valor={modo}
      opciones={[
        { valor: 'xor', texto: 'XOR con retardo (28.3)' },
        { valor: 'riesgo', texto: 'Dos caminos: A·B + Ā·C' },
      ]}
    />
  {/snippet}
  {#snippet escena()}
    <Escena {reloj} {paso} {dibujar} dims={(a) => (a < 560 ? [600, 460] : [900, 330])} etiqueta="Puertas lógicas con retardo de propagación y el glitch que producen" />
  {/snippet}
  {#snippet controles()}
    <Deslizador etiqueta="Retardo de cada inversor" bind:valor={tInv} min={0.5} max={15} paso={0.5} formato={(x) => `${num(x, 1)} ns`} />
    <Deslizador etiqueta="Retardo de las demás puertas" bind:valor={tPuerta} min={0.5} max={15} paso={0.5} formato={(x) => `${num(x, 1)} ns`} />
    {#if modo === 'riesgo'}<Interruptor etiqueta="Añadir el término de consenso B·C" bind:valor={consenso} />{/if}
    <button class="boton" onclick={() => ((tInv = 7.5), (tPuerta = 8))}>74HC04 a 5 V</button>
  {/snippet}
</Marco>
