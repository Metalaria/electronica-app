<script lang="ts">
  // Electric field and potential (book 1.1, 3.1, 4.1): two point charges (draggable) with their field lines and
  // equipotentials, computed from Coulomb's law (E = k·q/r², V = k·q/r). A positive test charge drifts along the
  // field (as in a resistive medium, v ∝ E): its potential falls, and the work done by the field is q·(V_A − V_B)
  // — the voltage is the energy per unit charge, V = W/Q. A second mode shows the parallel-plate capacitor:
  // uniform field E = V/d between the plates.
  import { untrack } from 'svelte';
  import Escena, { type EventoPuntero } from '../../ui/Escena.svelte';
  import Marco from '../../ui/Marco.svelte';
  import Deslizador from '../../ui/Deslizador.svelte';
  import Selector from '../../ui/Selector.svelte';
  import { Reloj, Muestreo } from '../../nucleo/reloj.svelte';
  import { txt, circulo, flecha, punta, type Vista } from '../../nucleo/dibujo';
  import { alfa, paleta } from '../../nucleo/paleta';
  import { si, num } from '../../nucleo/formato';
  import { app } from '../../../../lib/estado.svelte';
  import { estatico } from '../nucleo/grafica';

  const reloj = new Reloj();
  const pal = $derived(paleta(app.tema));

  const K = 8.9875e9;
  const ESC = 0.001; // metres per logical unit (1 unit = 1 mm)
  let modo = $state<'cargas' | 'placas'>('cargas');
  let q1 = $state(1e-9);
  let q2 = $state(-1e-9);
  let Vplacas = $state(12);
  let cargas = $state([
    { x: 200, y: 200 },
    { x: 400, y: 200 },
  ]);
  const QT = 1e-12; // test charge, 1 pC

  // Plates: at y = 70 (+V) and y = 330 (0 V), from x = 80 to 520.
  const P = { y0: 80, y1: 320, x0: 80, x1: 520 };

  function campo(x: number, y: number): { ex: number; ey: number; v: number } {
    if (modo === 'placas') {
      const d = (P.y1 - P.y0) * ESC;
      const dentro = x >= P.x0 && x <= P.x1;
      const E = dentro ? Vplacas / d : 0;
      const yy = Math.min(P.y1, Math.max(P.y0, y));
      return { ex: 0, ey: E, v: Vplacas * (1 - (yy - P.y0) / (P.y1 - P.y0)) };
    }
    let ex = 0;
    let ey = 0;
    let v = 0;
    const qs = [q1, q2];
    cargas.forEach((c, i) => {
      const dx = (x - c.x) * ESC;
      const dy = (y - c.y) * ESC;
      const r2 = Math.max(dx * dx + dy * dy, (8 * ESC) ** 2);
      const r = Math.sqrt(r2);
      const q = qs[i]!;
      ex += (K * q * dx) / (r2 * r);
      ey += (K * q * dy) / (r2 * r);
      v += (K * q) / r;
    });
    return { ex, ey, v };
  }

  // Test charge.
  let tx = 300;
  let ty = 120;
  let vInicio = 0;
  let n = $state(0);
  const muestreo = new Muestreo(60);
  let lecturaV = $state(0);
  let lecturaE = $state(0);
  let trabajo = $state(0);
  function colocar(x: number, y: number): void {
    tx = x;
    ty = y;
    vInicio = campo(x, y).v;
  }
  $effect(() => {
    void [modo, reloj.reinicios];
    untrack(() => {
      if (modo === 'placas') colocar(300, P.y0 + 20);
      else colocar(300, 110);
    });
  });
  function paso(dt: number): void {
    if (!arrastre) {
      const e = campo(tx, ty);
      const m = Math.hypot(e.ex, e.ey);
      if (m > 1) {
        // Drift speed grows with the field (square root, saturating) so both modes look alive.
        const ref = modo === 'placas' ? Vplacas / ((P.y1 - P.y0) * ESC) : (K * 1e-9) / 0.01;
        const vel = 40 * Math.min(3, Math.sqrt(m / ref));
        tx += (e.ex / m) * vel * dt;
        ty += (e.ey / m) * vel * dt;
      }
      const cerca = modo === 'cargas' && cargas.some((c, i) => [q1, q2][i]! < 0 && Math.hypot(tx - c.x, ty - c.y) < 14);
      if (cerca || tx < 0 || tx > 600 || ty < 0 || ty > 420 || (modo === 'placas' && ty >= P.y1 - 2)) {
        if (modo === 'placas') colocar(150 + ((tx * 7) % 300), P.y0 + 10);
        else colocar(300, 110);
      }
    }
    if (muestreo.toca()) {
      const e = campo(tx, ty);
      lecturaV = e.v;
      lecturaE = Math.hypot(e.ex, e.ey);
      trabajo = QT * (vInicio - e.v);
      n++;
    }
  }

  let arrastre: 'test' | 0 | 1 | null = null;
  function puntero(ev: EventoPuntero): boolean | void {
    if (ev.tipo === 'abajo') {
      if (Math.hypot(ev.x - tx, ev.y - ty) < 26) arrastre = 'test';
      else if (modo === 'cargas') {
        const i = cargas.findIndex((c) => Math.hypot(ev.x - c.x, ev.y - c.y) < 30);
        arrastre = i >= 0 ? (i as 0 | 1) : null;
      }
      if (arrastre === null) {
        colocar(ev.x, ev.y);
        return;
      }
      return true;
    }
    if (ev.tipo === 'mover' && arrastre !== null) {
      const x = Math.min(590, Math.max(10, ev.x));
      const y = Math.min(410, Math.max(10, ev.y));
      if (arrastre === 'test') colocar(x, y);
      else cargas[arrastre] = { x, y };
    }
    if (ev.tipo === 'arriba') arrastre = null;
  }

  /** Equipotentials by marching squares on a coarse grid, as line segments. */
  function equipotenciales(niveles: number[]): { nivel: number; seg: number[] }[] {
    const nx = 60;
    const ny = 42;
    const w = 600 / nx;
    const h = 420 / ny;
    const V = new Float64Array((nx + 1) * (ny + 1));
    for (let j = 0; j <= ny; j++) for (let i = 0; i <= nx; i++) V[j * (nx + 1) + i] = campo(i * w, j * h).v;
    return niveles.map((L) => {
      const seg: number[] = [];
      for (let j = 0; j < ny; j++)
        for (let i = 0; i < nx; i++) {
          const a = V[j * (nx + 1) + i]! - L;
          const b = V[j * (nx + 1) + i + 1]! - L;
          const c = V[(j + 1) * (nx + 1) + i + 1]! - L;
          const d = V[(j + 1) * (nx + 1) + i]! - L;
          const pts: [number, number][] = [];
          const cruza = (p: number, q: number, x0: number, y0: number, x1: number, y1: number) => {
            if (p < 0 !== q < 0) {
              const t = p / (p - q);
              pts.push([x0 + (x1 - x0) * t, y0 + (y1 - y0) * t]);
            }
          };
          const X0 = i * w;
          const Y0 = j * h;
          cruza(a, b, X0, Y0, X0 + w, Y0);
          cruza(b, c, X0 + w, Y0, X0 + w, Y0 + h);
          cruza(c, d, X0 + w, Y0 + h, X0, Y0 + h);
          cruza(d, a, X0, Y0 + h, X0, Y0);
          if (pts.length >= 2) seg.push(pts[0]![0], pts[0]![1], pts[1]![0], pts[1]![1]);
          if (pts.length === 4) seg.push(pts[2]![0], pts[2]![1], pts[3]![0], pts[3]![1]);
        }
      return { nivel: L, seg };
    });
  }

  /** Field lines starting around the positive charge(s), integrated along E. */
  function lineas(): [number, number][][] {
    const r: [number, number][][] = [];
    const qs = [q1, q2];
    cargas.forEach((c, i) => {
      const q = qs[i]!;
      if (q === 0) return;
      const sg = q > 0 ? 1 : -1;
      const nl = Math.round(10 + 6 * Math.min(2, Math.abs(q) / 1e-9));
      for (let k = 0; k < nl; k++) {
        const a = (2 * Math.PI * (k + 0.5)) / nl;
        let x = c.x + 12 * Math.cos(a);
        let y = c.y + 12 * Math.sin(a);
        const pts: [number, number][] = [[x, y]];
        for (let s = 0; s < 260; s++) {
          const e = campo(x, y);
          const m = Math.hypot(e.ex, e.ey) || 1;
          x += (sg * 3 * e.ex) / m;
          y += (sg * 3 * e.ey) / m;
          pts.push([x, y]);
          if (x < -10 || x > 610 || y < -10 || y > 430) break;
          if (cargas.some((cc, j) => j !== i && Math.hypot(x - cc.x, y - cc.y) < 10)) break;
        }
        r.push(sg > 0 ? pts : pts.reverse());
      }
    });
    return r;
  }

  function dibujar(v: Vista): void {
    void n;
    const { ctx } = v;
    const p = pal;
    const clave = modo === 'placas' ? `pl:${Vplacas}` : `cq:${q1}:${q2}:${cargas.map((c) => `${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(';')}`;
    estatico(v, `cp:${clave}`, (vv) => {
      const c = vv.ctx;
      if (modo === 'placas') {
        // Equipotentials: horizontal lines every V/6; field lines: vertical arrows.
        for (let k = 1; k < 6; k++) {
          const y = P.y0 + ((P.y1 - P.y0) * k) / 6;
          c.strokeStyle = alfa(p.serie[4], 0.55);
          c.lineWidth = 1.4;
          c.setLineDash([5, 4]);
          c.beginPath();
          c.moveTo(P.x0, y);
          c.lineTo(P.x1, y);
          c.stroke();
          c.setLineDash([]);
          txt(vv, `${num(Vplacas * (1 - k / 6), 1)} V`, P.x1 + 8, y, { tam: 10.5, color: p.serie[4], alin: 'left' });
        }
        for (let x = P.x0 + 30; x < P.x1; x += 55) flecha(c, x, P.y0 + 6, x, P.y1 - 6, alfa(p.campoE, 0.7), 1.6, 9);
        c.fillStyle = p.positivo;
        c.fillRect(P.x0, P.y0 - 10, P.x1 - P.x0, 10);
        c.fillStyle = p.tinta;
        c.fillRect(P.x0, P.y1, P.x1 - P.x0, 10);
        txt(vv, `+${num(Vplacas, 1)} V`, P.x0 - 8, P.y0 - 5, { tam: 12, peso: 800, color: p.positivo, alin: 'right' });
        txt(vv, '0 V', P.x0 - 8, P.y1 + 5, { tam: 12, peso: 800, alin: 'right' });
        return;
      }
      // Potential scale: that of each charge at 30 mm.
      const vs = [q1, q2].map((q) => (K * q) / (30 * ESC));
      const vmax = Math.max(...vs.map(Math.abs), 1);
      const niveles: number[] = [];
      for (const f of [-0.8, -0.5, -0.3, -0.15, -0.06, 0, 0.06, 0.15, 0.3, 0.5, 0.8]) niveles.push(f * vmax);
      for (const eq of equipotenciales(niveles)) {
        c.strokeStyle = alfa(eq.nivel > 0 ? p.positivo : eq.nivel < 0 ? p.electron : p.tinta, 0.45);
        c.lineWidth = 1.3;
        c.setLineDash([4, 3]);
        c.beginPath();
        for (let k = 0; k < eq.seg.length; k += 4) {
          c.moveTo(eq.seg[k]!, eq.seg[k + 1]!);
          c.lineTo(eq.seg[k + 2]!, eq.seg[k + 3]!);
        }
        c.stroke();
        c.setLineDash([]);
      }
      for (const l of lineas()) {
        c.strokeStyle = alfa(p.campoE, 0.75);
        c.lineWidth = 1.5;
        c.beginPath();
        l.forEach(([x, y], k) => (k ? c.lineTo(x, y) : c.moveTo(x, y)));
        c.stroke();
        const m = l[Math.floor(l.length / 2)];
        const m2 = l[Math.floor(l.length / 2) + 1];
        if (m && m2) punta(c, m[0], m[1], Math.atan2(m2[1] - m[1], m2[0] - m[0]), p.campoE, 8);
      }
    });
    if (modo === 'cargas') {
      cargas.forEach((c, i) => {
        const q = [q1, q2][i]!;
        circulo(ctx, c.x, c.y, 16, q >= 0 ? p.positivo : p.electron, p.fondo, 2);
        txt(v, q >= 0 ? '+' : '−', c.x, c.y, { tam: 18, peso: 800, color: '#fff' });
        txt(v, `${num(q * 1e9, 1)} nC`, c.x, c.y + 30, { tam: 11.5, peso: 700, color: p.suave });
      });
    }
    // Test charge and its E vector.
    const e = campo(tx, ty);
    const m = Math.hypot(e.ex, e.ey);
    if (m > 1) flecha(ctx, tx, ty, tx + (e.ex / m) * 36, ty + (e.ey / m) * 36, p.campoE, 2.4, 9);
    circulo(ctx, tx, ty, 9, p.corriente, p.fondo, 2);
    txt(v, '+q', tx, ty - 18, { tam: 11.5, peso: 800, color: p.corriente });
  }

  const texto = $derived.by(() => {
    void n;
    return (
      (modo === 'cargas'
        ? `**Campo y potencial de dos cargas** (arrástralas): las líneas de campo (verdes) salen de la positiva y mueren en la negativa; las equipotenciales (discontinuas) las cortan siempre en ángulo recto. `
        : `**Placas paralelas** (sección 3.1): entre ellas el campo es uniforme, E = V/d = ${si(Vplacas / ((P.y1 - P.y0) * ESC), 'V/m', 3)}, y el potencial baja en línea recta de una placa a otra. `) +
      `La carga de prueba (+1 pC, arrástrala o toca para soltarla en otro sitio) se mueve a favor del campo, de potencial alto a bajo: ahora está a ${si(lecturaV, 'V', 3)} con E = ${si(lecturaE, 'V/m', 3)}.\n` +
      `**La tensión es energía por unidad de carga** (V = W/Q): desde donde se soltó, el campo ha hecho un trabajo q·(V_A − V_B) = ${si(trabajo, 'J', 3)}. La tensión entre dos puntos no depende del camino, y por eso es una magnitud relativa: se mide siempre respecto a una referencia.`
    );
  });

  const lecturas = $derived.by(() => {
    void n;
    return [
      { e: 'Potencial en la carga de prueba', v: si(lecturaV, 'V', 3), c: pal.corriente },
      { e: 'Campo |E|', v: si(lecturaE, 'V/m', 3), c: pal.campoE },
      { e: 'Trabajo del campo', v: si(trabajo, 'J', 3) },
    ];
  });
</script>

<Marco {reloj} {texto} {lecturas} leyenda={['campoE']}>
  {#snippet modos()}
    <Selector
      bind:valor={modo}
      opciones={[
        { valor: 'cargas', texto: 'Dos cargas' },
        { valor: 'placas', texto: 'Placas paralelas' },
      ]}
    />
  {/snippet}
  {#snippet escena()}
    <Escena {reloj} {paso} {dibujar} {puntero} dims={() => [600, 420]} etiqueta="Líneas de campo y equipotenciales con una carga de prueba que se mueve" />
  {/snippet}
  {#snippet controles()}
    {#if modo === 'cargas'}
      <Deslizador etiqueta="Carga 1" bind:valor={q1} min={-3e-9} max={3e-9} paso={0.1e-9} formato={(x) => `${num(x * 1e9, 1)} nC`} />
      <Deslizador etiqueta="Carga 2" bind:valor={q2} min={-3e-9} max={3e-9} paso={0.1e-9} formato={(x) => `${num(x * 1e9, 1)} nC`} />
    {:else}
      <Deslizador etiqueta="Tensión entre placas" bind:valor={Vplacas} min={1} max={24} paso={0.5} unidad="V" />
    {/if}
  {/snippet}
</Marco>
