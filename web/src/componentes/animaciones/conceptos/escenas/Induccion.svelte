<script lang="ts">
  // Magnetic field and Faraday's law (book 4.1, 4.3, 1.1): a magnet (dipole m = 1 A·m², a small neodymium
  // magnet) moving through a coil of N turns and radius 15 mm. The flux of a dipole through a coaxial loop is
  // Φ(z) = µ₀·m·R²/(2·(R² + z²)^(3/2)), and the coil develops v = −N·dΦ/dt: only while the flux changes, with the
  // sign that opposes the change (Lenz). Second mode: the field of a straight wire, B = µ₀·I/(2π·r), in circles
  // around it (right-hand rule), shown with compasses.
  import Escena, { type EventoPuntero } from '../../ui/Escena.svelte';
  import Marco from '../../ui/Marco.svelte';
  import Deslizador from '../../ui/Deslizador.svelte';
  import Selector from '../../ui/Selector.svelte';
  import Interruptor from '../../ui/Interruptor.svelte';
  import { Reloj, Muestreo } from '../../nucleo/reloj.svelte';
  import { txt, txtRico, rr, circulo, flecha, type Vista } from '../../nucleo/dibujo';
  import { alfa, paleta } from '../../nucleo/paleta';
  import { si, num } from '../../nucleo/formato';
  import { app } from '../../../../lib/estado.svelte';
  import { estatico, panel, curva, guia, type Ejes } from '../nucleo/grafica';

  const reloj = new Reloj();
  const pal = $derived(paleta(app.tema));

  const MU0 = 4e-7 * Math.PI;
  const M = 1; // A·m²
  const RB = 0.015; // coil radius (m)
  let modo = $state<'faraday' | 'hilo'>('faraday');
  let N = $state(200);
  let vel = $state(0.4); // peak speed (m/s)
  let auto = $state(true);
  let I = $state(10);

  // Magnet position z (m) relative to the coil centre; sinusoidal motion of ±60 mm.
  const AMP = 0.06;
  let z = -AMP;
  let zPrev = -AMP;
  let fase = -Math.PI / 2;
  const HIST = 400;
  const hPhi = new Float64Array(HIST);
  const hV = new Float64Array(HIST);
  let ih = 0;
  let acumH = 0;
  let centro = { x: 300, y: 210 };
  let emf = 0;
  let n = $state(0);
  const muestreo = new Muestreo(50);
  let emfMostrada = $state(0);
  let phiMostrado = $state(0);

  function dFlujo(zz: number): number {
    return (-3 * MU0 * M * RB * RB * zz) / (2 * (RB * RB + zz * zz) ** 2.5);
  }
  let vArr = 0;

  function flujo(zz: number): number {
    return (MU0 * M * RB * RB) / (2 * (RB * RB + zz * zz) ** 1.5);
  }

  function paso(dt: number): void {
    if (modo === 'faraday') {
      if (auto && !arrastre) {
        // ω chosen so that the peak speed is «vel»: v_max = A·ω.
        fase += (dt * vel) / AMP;
        z = AMP * Math.sin(fase);
      }
      // v = −N·dΦ/dt = −N·(dΦ/dz)·(dz/dt): exact speed when the magnet moves by itself, a smoothed
      // estimate (time constant 50 ms) when it is dragged.
      let vz: number;
      if (auto && !arrastre) vz = vel * Math.cos(fase);
      else {
        const inst = dt > 0 ? (z - zPrev) / dt : 0;
        vArr += (inst - vArr) * (1 - Math.exp(-dt / 0.05));
        vz = vArr;
      }
      emf = -N * dFlujo(z) * vz;
      zPrev = z;
      // History at a fixed 60 samples per second, whatever the frame rate.
      acumH += dt;
      while (acumH >= 1 / 60) {
        acumH -= 1 / 60;
        hPhi[ih % HIST] = flujo(z) * N;
        hV[ih % HIST] = emf;
        ih++;
      }
    }
    if (muestreo.toca()) {
      emfMostrada = emf;
      phiMostrado = flujo(z) * N;
      n++;
    }
  }

  let arrastre = false;
  let geo = { x0: 0, k: 1 };
  let sonda = $state({ x: 420, y: 140 });
  let arrastreSonda = false;
  function puntero(ev: EventoPuntero): boolean | void {
    if (modo === 'hilo') {
      if (ev.tipo === 'abajo') arrastreSonda = true;
      if (arrastreSonda && ev.tipo !== 'arriba') sonda = { x: ev.x, y: ev.y };
      if (ev.tipo === 'arriba') arrastreSonda = false;
      return arrastreSonda;
    }
    if (ev.tipo === 'abajo' && ev.y < 260) {
      arrastre = true;
      auto = false;
    }
    if (arrastre && ev.tipo === 'mover') z = Math.max(-0.1, Math.min(0.1, (ev.x - geo.x0) / geo.k));
    if (ev.tipo === 'arriba') arrastre = false;
    return arrastre;
  }

  function dibujar(v: Vista): void {
    void n;
    const { ctx } = v;
    const p = pal;
    const est = v.estrecho;
    if (modo === 'hilo') {
      dibujarHilo(v);
      return;
    }
    const x0 = 300;
    const y0 = 140;
    const k = 1800; // logical units per metre
    geo = { x0, k };
    const eP: Ejes = est ? { x: 60, y: 290, w: 510, h: 100, x0: 0, x1: HIST, y0: 0, y1: flujo(0) * N * 1.15 } : { x: 60, y: 290, w: 380, h: 110, x0: 0, x1: HIST, y0: 0, y1: flujo(0) * N * 1.15 };
    const vmax = Math.max(0.05, (N * flujo(0) * vel) / RB * 0.8);
    const eV: Ejes = est ? { x: 60, y: 430, w: 510, h: 100, x0: 0, x1: HIST, y0: -vmax, y1: vmax } : { x: 490, y: 290, w: 380, h: 110, x0: 0, x1: HIST, y0: -vmax, y1: vmax };
    estatico(v, `in:${est}:${N}:${vmax.toFixed(4)}`, (vv) => {
      panel(vv, eP, { titulo: 'Flujo enlazado N·Φ', sinX: true, uy: 'Wb' });
      panel(vv, eV, { titulo: 'Tensión inducida v = −N·dΦ/dt', sinX: true, uy: 'V', cero: true });
    });
    // Field lines of the magnet (dipole: r = C·sen²θ around its centre).
    const mx = x0 + z * k;
    for (const C of [30, 55, 90, 140, 210]) {
      for (const s of [1, -1]) {
        ctx.strokeStyle = alfa(p.campoB, 0.45);
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        for (let i = 0; i <= 80; i++) {
          const th = 0.05 + ((Math.PI - 0.1) * i) / 80;
          const r = C * Math.sin(th) ** 2;
          const x = mx + r * Math.cos(th);
          const y = y0 - s * r * Math.sin(th);
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
    }
    // Coil (cross-section of its turns) and induced current direction.
    const cw = 60;
    const ch = RB * k * 2;
    const nv = 8;
    for (let i = 0; i < nv; i++) {
      const xx = x0 - cw / 2 + (cw * (i + 0.5)) / nv;
      circulo(ctx, xx, y0 - ch / 2, 5, p.cobre, p.tinta, 1);
      circulo(ctx, xx, y0 + ch / 2, 5, p.cobre, p.tinta, 1);
      const sgn = Math.sign(emf);
      if (Math.abs(emf) > vmax * 0.05) {
        // Dot (out of the page) / cross (into the page).
        const top = sgn > 0;
        ctx.fillStyle = p.corriente;
        ctx.beginPath();
        ctx.arc(xx, y0 - ch / 2, 1.8, 0, Math.PI * 2);
        if (!top) ctx.arc(xx, y0 + ch / 2, 1.8, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // Magnet.
    rr(ctx, mx - 40, y0 - 13, 40, 26, 3);
    ctx.fillStyle = p.peligro;
    ctx.fill();
    rr(ctx, mx, y0 - 13, 40, 26, 3);
    ctx.fillStyle = p.electron;
    ctx.fill();
    txt(v, 'S', mx - 20, y0, { tam: 14, peso: 800, color: '#fff' });
    txt(v, 'N', mx + 20, y0, { tam: 14, peso: 800, color: '#fff' });
    txt(v, 'arrastra el imán', mx, y0 + 30, { tam: 10.5, color: p.suave });
    // Galvanometer.
    const gx = est ? 520 : 760;
    const gy = 90;
    ctx.beginPath();
    ctx.arc(gx, gy, 48, Math.PI, 0);
    ctx.fillStyle = p.panel;
    ctx.fill();
    ctx.strokeStyle = p.tinta;
    ctx.lineWidth = 2;
    ctx.stroke();
    const ang = -Math.PI / 2 + Math.max(-1.2, Math.min(1.2, (emf / vmax) * 1.2));
    flecha(ctx, gx, gy, gx + 42 * Math.cos(ang), gy + 42 * Math.sin(ang), p.corriente, 2.4, 8);
    txt(v, si(emfMostrada, 'V', 3), gx, gy + 16, { tam: 12.5, peso: 800, color: p.corriente });
    // Traces.
    const cnt = Math.min(ih, HIST);
    const xs = new Float64Array(cnt);
    const yp = new Float64Array(cnt);
    const yv = new Float64Array(cnt);
    for (let i = 0; i < cnt; i++) {
      const j = (ih - cnt + i + HIST) % HIST;
      xs[i] = HIST - cnt + i;
      yp[i] = hPhi[j]!;
      yv[i] = hV[j]!;
    }
    curva(ctx, eP, xs, yp, p.campoB, 2.2);
    curva(ctx, eV, xs, yv, p.corriente, 2.2);
    guia(ctx, eV, 'x', HIST - 1, alfa(p.tinta, 0.3));
  }

  function dibujarHilo(v: Vista): void {
    const { ctx } = v;
    const p = pal;
    const cx = v.w / 2;
    const cy = v.h / 2;
    centro = { x: cx, y: cy };
    estatico(v, `hilo:${I > 0}:${v.w}`, (vv) => {
      const c = vv.ctx;
      for (const r of [40, 80, 130, 190]) {
        c.strokeStyle = alfa(p.campoB, 0.4);
        c.lineWidth = 1.4;
        c.beginPath();
        c.arc(cx, cy, r, 0, Math.PI * 2);
        c.stroke();
      }
    });
    // Compasses on a grid: needle along B (counter-clockwise for current out of the page).
    const sg = I >= 0 ? 1 : -1;
    for (let gx = 40; gx < v.w; gx += 56)
      for (let gy = 30; gy < v.h; gy += 56) {
        const dx = gx - cx;
        const dy = gy - cy;
        const r = Math.hypot(dx, dy);
        if (r < 30) continue;
        const a = Math.atan2(dy, dx) - (sg * Math.PI) / 2;
        const l = 14;
        ctx.strokeStyle = alfa(p.tinta, 0.35);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(gx, gy, l + 3, 0, Math.PI * 2);
        ctx.stroke();
        flecha(ctx, gx - l * Math.cos(a), gy - l * Math.sin(a), gx + l * Math.cos(a), gy + l * Math.sin(a), p.campoB, 2, 7);
      }
    circulo(ctx, cx, cy, 16, p.cobre, p.tinta, 2);
    if (I >= 0) circulo(ctx, cx, cy, 4, p.tinta);
    else {
      ctx.strokeStyle = p.tinta;
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(cx - 7, cy - 7);
      ctx.lineTo(cx + 7, cy + 7);
      ctx.moveTo(cx - 7, cy + 7);
      ctx.lineTo(cx + 7, cy - 7);
      ctx.stroke();
    }
    txt(v, I >= 0 ? 'corriente hacia fuera' : 'corriente hacia dentro', cx, cy + 32, { tam: 11.5, peso: 700, color: p.suave });
    // Probe.
    const r = Math.hypot(sonda.x - cx, sonda.y - cy) / 1000; // 1 unit = 1 mm
    const B = (MU0 * Math.abs(I)) / (2 * Math.PI * Math.max(r, 0.003));
    circulo(ctx, sonda.x, sonda.y, 7, p.corriente, p.fondo, 2);
    txtRico(v, `B = ${si(B, 'T', 3)} a ${si(r, 'm', 2)}`, sonda.x, sonda.y - 18, { tam: 12.5, peso: 800, color: p.corriente, fondo: alfa(p.panel, 0.9) });
  }

  const texto = $derived.by(() => {
    void n;
    if (modo === 'hilo') {
      const r = Math.hypot(sonda.x - centro.x, sonda.y - centro.y) / 1000;
      return (
        `**Toda corriente crea un campo magnético a su alrededor.** El de un hilo recto forma círculos (regla de la mano derecha: el pulgar en el sentido de la corriente, los dedos dan el del campo) y vale B = µ_0·I/(2π·r): con ${num(Math.abs(I), 1)} A, a ${si(r, 'm', 2)} son ${si((MU0 * Math.abs(I)) / (2 * Math.PI * Math.max(r, 0.003)), 'T', 3)} (el campo terrestre ronda los 50 µT). Arrastra la sonda.\n` +
        'Si la corriente cambia, el campo cambia, y un campo variable induce tensión en cualquier espira que lo abrace: es la ley de Faraday (el otro modo).'
      );
    }
    return (
      `**Ley de Faraday:** la bobina de ${N} espiras solo genera tensión mientras el flujo que la atraviesa **cambia**: v = −N·dΦ/dt = ${si(emfMostrada, 'V', 3)} ahora, con N·Φ = ${si(phiMostrado, 'Wb', 3)}. Con el imán quieto, aunque esté dentro, no hay tensión.\n` +
      `**Lenz:** el signo es el que se opone al cambio: al acercarse el imán la corriente inducida crea un campo que lo repele; al alejarse, uno que lo atrae. Moverlo más deprisa da más tensión (más dΦ/dt), y más espiras también. Un weber por segundo induce un voltio por espira.`
    );
  });

  const lecturas = $derived.by(() => {
    void n;
    if (modo === 'hilo') return [{ e: 'Corriente', v: si(I, 'A', 3), c: pal.corriente }];
    return [
      { e: 'Tensión inducida', v: si(emfMostrada, 'V', 3), c: pal.corriente },
      { e: 'Flujo enlazado N·Φ', v: si(phiMostrado, 'Wb', 3), c: pal.campoB },
      { e: 'Posición del imán', v: si(z, 'm', 2) },
    ];
  });
</script>

<Marco {reloj} {texto} {lecturas} leyenda={['campoB', 'corriente']}>
  {#snippet modos()}
    <Selector
      bind:valor={modo}
      opciones={[
        { valor: 'faraday', texto: 'Imán y bobina (Faraday)' },
        { valor: 'hilo', texto: 'Campo de un hilo' },
      ]}
    />
  {/snippet}
  {#snippet escena()}
    <Escena {reloj} {paso} {dibujar} {puntero} dims={(a) => (a < 560 ? [600, 560] : [900, 420])} etiqueta="Imán que atraviesa una bobina y la tensión que induce, o el campo de un hilo con corriente" />
  {/snippet}
  {#snippet controles()}
    {#if modo === 'faraday'}
      <Interruptor etiqueta="Mover el imán solo" bind:valor={auto} />
      <Deslizador etiqueta="Velocidad máxima del imán" bind:valor={vel} min={0.05} max={2} paso={0.05} unidad="m/s" />
      <Deslizador etiqueta="Espiras N" bind:valor={N} min={10} max={1000} log formato={(x) => String(Math.round(x))} />
    {:else}
      <Deslizador etiqueta="Corriente I" bind:valor={I} min={-50} max={50} paso={0.5} unidad="A" />
    {/if}
  {/snippet}
</Marco>
