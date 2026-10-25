<script lang="ts">
  // Potentiometer, rheostat and trimmer (book 2.11): the wiper splits the track; linear (B) or logarithmic
  // (A) law, and the load that bends the law (10 kΩ at 50 % with a 10 kΩ load gives 40 %, not 50 %).
  import { compartir3d } from '../../tres/compartir.svelte';
  import Escena from '../ui/Escena.svelte';
  import Marco from '../ui/Marco.svelte';
  import Deslizador from '../ui/Deslizador.svelte';
  import Selector from '../ui/Selector.svelte';
  import Interruptor from '../ui/Interruptor.svelte';
  import Grafica from '../ui/Grafica.svelte';
  import { Reloj } from '../nucleo/reloj.svelte';
  import type { EventoPuntero } from '../ui/Escena.svelte';
  import { txt, txtRico, fondo, rr, circulo, electrones, gradCilindro, type Vista } from '../nucleo/dibujo';
  import { resistencia, hilo, fuente, masa, nodo, lampara } from '../nucleo/esquema';
  import { alfa, mezcla, paleta } from '../nucleo/paleta';
  import { si, num, pct } from '../nucleo/formato';
  import { app } from '../../../lib/estado.svelte';

  type Modo = 'pot' | 'reostato' | 'trimmer';
  const reloj = new Reloj();
  const pal = $derived(paleta(app.tema));

  let modo = $state<Modo>('pot');
  let x = $state(0.5);
  let ley = $state<'B' | 'A'>('B');
  let carga = $state(0);
  let barrido = $state(false);
  const RP = 10e3;
  const VIN = 10;
  const B = 81;

  const fLey = (u: number) => (ley === 'A' ? (Math.pow(B, u) - 1) / (B - 1) : u);
  const f = $derived(fLey(x));
  const rBaja = $derived(Math.max(f * RP, 0.01));
  const rAlta = $derived(Math.max((1 - f) * RP, 0.01));
  const paralelo = (a: number, b: number) => (b > 0 ? (a * b) / (a + b) : a);
  const vout = $derived(modo === 'reostato' ? 0 : (VIN * paralelo(rBaja, carga)) / (rAlta + paralelo(rBaja, carga)));
  const RLAMP = 470;
  const iReo = $derived(VIN / (rBaja + RLAMP));
  const iPista = $derived(modo === 'reostato' ? iReo : VIN / (rAlta + paralelo(rBaja, carga)));

  let fase = 0;
  let t = 0;
  function paso(dt: number): void {
    t += dt;
    if (barrido) x = 0.5 - 0.5 * Math.cos(t * 0.6);
    fase += dt * Math.min(120, 30 + iPista * 4000);
  }

  // Rotary track geometry (270° arc).
  const A0 = (225 * Math.PI) / 180;
  const ARCO = (270 * Math.PI) / 180;
  let geom = { cx: 0, cy: 0, r: 0, lin: false, tx0: 0, tx1: 0, ty: 0 };

  function anguloDe(u: number): number {
    return A0 - u * ARCO;
  }

  function dibujarRotativo(v: Vista, cx: number, cy: number, r: number): void {
    const { ctx } = v;
    const p = pal;
    // Body.
    const g = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.3, r * 0.2, cx, cy, r * 1.3);
    g.addColorStop(0, mezcla(p.plastico, '#ffffff', 0.25));
    g.addColorStop(1, p.plastico);
    circulo(ctx, cx, cy, r * 1.28, undefined);
    ctx.fillStyle = g;
    ctx.fill();
    // Track (carbon) with the part between wiper and terminal 1 highlighted.
    ctx.lineCap = 'butt';
    ctx.lineWidth = r * 0.2;
    ctx.strokeStyle = p.carbon;
    ctx.beginPath();
    ctx.arc(cx, cy, r, -A0, -A0 + ARCO, false);
    ctx.stroke();
    ctx.lineWidth = r * 0.07;
    ctx.strokeStyle = alfa(p.acento, 0.85);
    ctx.beginPath();
    ctx.arc(cx, cy, r, -A0, -anguloDe(x), false);
    ctx.stroke();
    // Electrons along the track (conventional current from terminal 3 to 1; electrons from 1 to 3).
    const pts: { x: number; y: number }[] = [];
    const n = 26;
    for (let k = 0; k < n; k++) {
      const u = (((k / n + fase * 0.0016) % 1) + 1) % 1;
      if (modo === 'reostato' && u > x) continue;
      const a = anguloDe(u);
      pts.push({ x: cx + r * Math.cos(a), y: cy - r * Math.sin(a) });
    }
    electrones(ctx, pts, 3.4, p);
    // Terminals.
    const term = (u: number, nombre: string) => {
      const a = anguloDe(u);
      const tx = cx + r * Math.cos(a);
      const ty = cy - r * Math.sin(a);
      ctx.fillStyle = gradCilindro(ctx, ty - 6, ty + 30, p.estano, p.oscuro);
      ctx.fillRect(tx - 6, ty, 12, r * 1.5 - (ty - cy));
      txt(v, nombre, tx, cy + r * 1.6, { tam: 14, peso: 800 });
    };
    term(0, '1');
    term(1, '3');
    ctx.fillStyle = gradCilindro(ctx, cy, cy + r * 1.5, p.estano, p.oscuro);
    ctx.fillRect(cx - 6, cy + r * 0.6, 12, r * 0.9);
    txt(v, '2', cx, cy + r * 1.6, { tam: 14, peso: 800 });
    // Wiper arm and knob.
    const a = anguloDe(x);
    const wx = cx + r * Math.cos(a);
    const wy = cy - r * Math.sin(a);
    ctx.strokeStyle = p.estano;
    ctx.lineWidth = 7;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(wx, wy);
    ctx.stroke();
    circulo(ctx, wx, wy, 7, mezcla(p.cobreClaro, '#ffffff', 0.3), p.cobre, 2);
    const gk = ctx.createRadialGradient(cx - r * 0.15, cy - r * 0.15, 2, cx, cy, r * 0.55);
    gk.addColorStop(0, '#e9ecef');
    gk.addColorStop(1, '#8d959e');
    circulo(ctx, cx, cy, r * 0.5, undefined);
    ctx.fillStyle = gk;
    ctx.fill();
    ctx.strokeStyle = p.tinta;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * r * 0.12, cy - Math.sin(a) * r * 0.12);
    ctx.lineTo(cx + Math.cos(a) * r * 0.46, cy - Math.sin(a) * r * 0.46);
    ctx.stroke();
    txt(v, ley === 'A' ? 'A10K' : 'B10K', cx + r * 0.62, cy + r * 0.72, { tam: 12, peso: 700, color: '#dfe5ea' });
    geom = { cx, cy, r, lin: false, tx0: 0, tx1: 0, ty: 0 };
  }

  function dibujarTrimmer(v: Vista, cx: number, cy: number, ancho: number): void {
    const { ctx } = v;
    const p = pal;
    const tx0 = cx - ancho / 2;
    const tx1 = cx + ancho / 2;
    const h = ancho * 0.36;
    rr(ctx, tx0 - 16, cy - h / 2, ancho + 32, h, 6);
    ctx.fillStyle = gradCilindro(ctx, cy - h / 2, cy + h / 2, '#3d6fb5', p.oscuro);
    ctx.fill();
    // Resistive track (cermet) and lead screw.
    ctx.fillStyle = mezcla(p.carbon, '#5a3b2a', 0.3);
    ctx.fillRect(tx0, cy + h * 0.08, ancho, h * 0.16);
    ctx.fillStyle = gradCilindro(ctx, cy - h * 0.3, cy - h * 0.1, p.estano, p.oscuro);
    ctx.fillRect(tx0 - 10, cy - h * 0.3, ancho + 20, h * 0.2);
    ctx.strokeStyle = alfa('#000000', 0.25);
    ctx.lineWidth = 1.2;
    for (let xx = tx0 - 8; xx < tx1 + 10; xx += 6) {
      ctx.beginPath();
      ctx.moveTo(xx, cy - h * 0.3);
      ctx.lineTo(xx + 3, cy - h * 0.1);
      ctx.stroke();
    }
    // Screw head with slot, rotating 25 turns over the travel.
    const sx = tx1 + 24;
    circulo(ctx, sx, cy - h * 0.2, 13, '#c9ced4', p.tinta, 1.5);
    const giro = x * 25 * Math.PI * 2;
    ctx.strokeStyle = p.tinta;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(sx - Math.cos(giro) * 9, cy - h * 0.2 - Math.sin(giro) * 9);
    ctx.lineTo(sx + Math.cos(giro) * 9, cy - h * 0.2 + Math.sin(giro) * 9);
    ctx.stroke();
    // Wiper carriage.
    const wx = tx0 + x * ancho;
    rr(ctx, wx - 10, cy - h * 0.36, 20, h * 0.62, 3);
    ctx.fillStyle = mezcla(p.cobreClaro, '#ffffff', 0.2);
    ctx.fill();
    ctx.strokeStyle = p.cobre;
    ctx.stroke();
    const pts: { x: number; y: number }[] = [];
    for (let k = 0; k < 18; k++) {
      const u = (((k / 18 + fase * 0.0016) % 1) + 1) % 1;
      pts.push({ x: tx0 + u * ancho, y: cy + h * 0.16 });
    }
    electrones(ctx, pts, 3, p);
    for (const [xx, n] of [
      [tx0 - 6, '1'],
      [cx, '2'],
      [tx1 + 6, '3'],
    ] as const) {
      ctx.fillStyle = gradCilindro(ctx, 0, 1, p.estano, p.oscuro);
      ctx.fillStyle = p.estano;
      ctx.fillRect(xx - 4, cy + h / 2, 8, 40);
      txt(v, n, xx, cy + h / 2 + 56, { tam: 14, peso: 800 });
    }
    txt(v, 'trimmer multivuelta: 25 vueltas de tornillo', cx, cy - h / 2 - 24, { tam: 13, color: p.suave });
    geom = { cx, cy, r: 0, lin: true, tx0, tx1, ty: cy };
  }

  function dibujarEsquema(v: Vista, x0: number, y0: number, alto: number): void {
    const p = pal;
    const xs = x0;
    const xp = x0 + 110;
    const yTop = y0;
    const yBot = y0 + alto;
    fuente(v, xs, (yTop + yBot) / 2, 22, 'dc', { rotulo: `${VIN} V`, lado: -1 });
    hilo(v, [
      [xs, (yTop + yBot) / 2 - 22],
      [xs, yTop],
      [xp, yTop],
      [xp, yTop + 20],
    ]);
    hilo(v, [
      [xs, (yTop + yBot) / 2 + 22],
      [xs, yBot],
      [xp, yBot],
    ]);
    masa(v, xp, yBot);
    const ya = yTop + 20;
    const yb = yBot - 20;
    hilo(v, [
      [xp, yb],
      [xp, yBot],
    ]);
    const yw = ya + (1 - f) * (yb - ya);
    // Track split: upper part (3–2) and lower part (2–1).
    resistencia(v, xp, ya, xp, yb, { largo: yb - ya, alto: 22 });
    const { ctx } = v;
    ctx.fillStyle = alfa(p.acento, 0.25);
    ctx.fillRect(xp - 10, yw, 20, yb - yw);
    txt(v, '3', xp + 18, ya + 4, { tam: 12, color: p.suave });
    txt(v, '1', xp + 18, yb - 4, { tam: 12, color: p.suave });
    // Wiper arrow.
    ctx.fillStyle = p.tinta;
    ctx.beginPath();
    ctx.moveTo(xp + 12, yw);
    ctx.lineTo(xp + 24, yw - 6);
    ctx.lineTo(xp + 24, yw + 6);
    ctx.closePath();
    ctx.fill();
    if (modo === 'reostato') {
      hilo(v, [
        [xp + 24, yw],
        [xp + 70, yw],
        [xp + 70, ya - 8],
        [xp, ya - 8],
      ]);
      lampara(v, xp + 70, yb, xp + 70, yBot, Math.min(1, iReo / 0.021));
      hilo(v, [
        [xp + 70, ya + 30],
        [xp + 70, yb],
      ]);
      txtRico(v, `I = ${si(iReo, 'A', 3)}`, xp + 90, (ya + yb) / 2, { alin: 'left', tam: 14, peso: 700, color: p.corriente });
      return;
    }
    hilo(v, [
      [xp + 24, yw],
      [xp + 90, yw],
    ]);
    nodo(v, xp + 90, yw);
    if (carga > 0) {
      hilo(v, [
        [xp + 90, yw],
        [xp + 150, yw],
        [xp + 150, yw + 20],
      ]);
      resistencia(v, xp + 150, yw + 20, xp + 150, yBot - 4, { largo: Math.min(60, yBot - yw - 30), alto: 20 });
      hilo(v, [
        [xp + 150, yBot - 4],
        [xp + 150, yBot],
        [xp, yBot],
      ]);
      txtRico(v, `R_L = ${si(carga, 'Ω', 2)}`, xp + 166, (yw + yBot) / 2, { alin: 'left', tam: 13 });
    }
    txtRico(v, `V_out = ${num(vout, 2)} V`, xp + 96, yw - 18, { alin: 'left', tam: 15, peso: 800, color: p.acento });
  }

  function dibujar(v: Vista): void {
    void [modo, x, ley, carga];
    fondo(v);
    const est = v.estrecho;
    if (est) {
      if (modo === 'trimmer') dibujarTrimmer(v, v.w / 2, 140, 300);
      else dibujarRotativo(v, v.w / 2, 160, 96);
      dibujarEsquema(v, 120, 330, 190);
    } else {
      if (modo === 'trimmer') dibujarTrimmer(v, 250, 210, 300);
      else dibujarRotativo(v, 250, 200, 118);
      dibujarEsquema(v, 560, 70, 300);
    }
    const p = pal;
    txt(v, `posición del cursor: ${pct(x, 0)}`, est ? v.w / 2 : 250, v.h - 22, { tam: 13, color: p.suave });
  }

  function puntero(e: EventoPuntero): boolean | void {
    const g = geom;
    if (g.lin) {
      if (e.tipo === 'abajo' && Math.abs(e.y - g.ty) > 60) return;
      x = Math.min(1, Math.max(0, (e.x - g.tx0) / (g.tx1 - g.tx0)));
      return true;
    }
    const dx = e.x - g.cx;
    const dy = g.cy - e.y;
    if (e.tipo === 'abajo' && Math.hypot(dx, dy) > g.r * 1.4) return;
    let a = Math.atan2(dy, dx);
    let u = (A0 - a) / ARCO;
    if (u < -0.05) u += (2 * Math.PI) / ARCO;
    if (u > 1.1) {
      a = a - 2 * Math.PI;
      u = (A0 - a) / ARCO;
    }
    x = Math.min(1, Math.max(0, u));
    barrido = false;
    return true;
  }

  const curvas = $derived.by(() => {
    const xs: number[] = [];
    const sin: number[] = [];
    const con: number[] = [];
    for (let k = 0; k <= 100; k++) {
      const u = k / 100;
      const ff = fLey(u);
      xs.push(u * 100);
      sin.push(ff);
      const lo = Math.max(ff * RP, 0.01);
      const hi = Math.max((1 - ff) * RP, 0.01);
      con.push(carga > 0 ? paralelo(lo, carga) / (hi + paralelo(lo, carga)) : ff);
    }
    return { xs, sin, con };
  });

  const texto = $derived.by(() => {
    if (modo === 'reostato')
      return (
        `**Reóstato:** solo se usan el cursor y un extremo, y la pista es una resistencia variable de ${si(rBaja, 'Ω', 3)} en serie con la lámpara: ${si(iReo, 'A', 3)}.\n` +
        'Si el cursor pierde contacto, el circuito se abre por completo; por eso se suele unir el cursor al otro extremo.'
      );
    const base =
      modo === 'trimmer'
        ? '**Trimmer:** el tornillo mueve el cursor por una pista recta de cermet; con 25 vueltas para todo el recorrido el ajuste es muy fino, pero está pensado para ajustarse una vez.\n'
        : `**Potenciómetro (ley ${ley === 'A' ? 'logarítmica A' : 'lineal B'}):** el cursor divide la pista en dos y la salida es la fracción ${pct(f, 1)} de la entrada${ley === 'A' ? ', que crece despacio al principio y deprisa al final, como pide el oído' : ''}.\n`;
    if (carga > 0)
      return (
        base +
        `Con ${si(carga, 'Ω', 2)} de carga la salida cae a ${num(vout, 2)} V en lugar de ${num(VIN * f, 2)} V: la carga queda en paralelo con la parte baja. ${carga >= 10 * RP ? 'Con una carga diez veces mayor que el potenciómetro el error es pequeño.' : 'La regla es que la carga sea al menos diez veces el valor del potenciómetro.'}`
      );
    return base + `Sin carga, V_out = ${num(vout, 2)} V, y la fracción no depende del valor total de la pista.`;
  });

  const lecturas = $derived(
    modo === 'reostato'
      ? [
          { e: 'Resistencia usada', v: si(rBaja, 'Ω', 3) },
          { e: 'Corriente', v: si(iReo, 'A', 3), c: pal.corriente },
        ]
      : [
          { e: 'V_out', v: `${num(vout, 3)} V`, c: pal.acento },
          { e: 'Fracción de la ley', v: pct(f, 1) },
          { e: 'Parte baja (2–1)', v: si(rBaja, 'Ω', 3) },
          { e: 'Parte alta (3–2)', v: si(rAlta, 'Ω', 3) },
          { e: 'R de salida', v: si(paralelo(rBaja, rAlta), 'Ω', 3) },
        ],
  );

  // 3D view of the page (componentes/tres): the model follows these controls.
  compartir3d(() => ({ modo, x, ley }));
</script>

<Marco {reloj} {texto} {lecturas} leyenda={['electron']}>
  {#snippet modos()}
    <Selector
      bind:valor={modo}
      opciones={[
        { valor: 'pot', texto: 'Potenciómetro' },
        { valor: 'reostato', texto: 'Reóstato' },
        { valor: 'trimmer', texto: 'Trimmer' },
      ]}
    />
  {/snippet}
  {#snippet escena()}
    <Escena {reloj} {paso} {dibujar} {puntero} dims={(a) => (a < 560 ? [560, 580] : [900, 440])} etiqueta="Potenciómetro con su cursor y el circuito divisor" />
  {/snippet}
  {#snippet controles()}
    <Deslizador etiqueta="Posición del cursor" bind:valor={x} min={0} max={1} paso={0.005} formato={(u) => pct(u, 0)} />
    <Interruptor etiqueta="Barrido automático" bind:valor={barrido} />
    {#if modo !== 'reostato'}
      <Selector etiqueta="Ley" bind:valor={ley} opciones={[{ valor: 'B', texto: 'Lineal (B)' }, { valor: 'A', texto: 'Logarítmica (A)' }]} />
      <Selector
        etiqueta="Carga en la salida"
        bind:valor={carga}
        opciones={[
          { valor: 0, texto: 'Sin carga' },
          { valor: 100e3, texto: '100 kΩ' },
          { valor: 10e3, texto: '10 kΩ' },
          { valor: 1e3, texto: '1 kΩ' },
        ]}
      />
    {/if}
  {/snippet}
  {#snippet grafica()}
    {#if modo !== 'reostato'}
      <Grafica
        titulo="Salida frente al giro"
        x={{ etiqueta: 'giro', unidad: '%', min: 0, max: 100 }}
        y={{ etiqueta: 'V_out/V_in', unidad: '', min: 0, max: 1 }}
        series={[
          { x: curvas.xs, y: curvas.sin, color: pal.tenue, discontinua: true, nombre: 'sin carga' },
          { x: curvas.xs, y: curvas.con, color: pal.acento, nombre: carga ? `con ${si(carga, 'Ω', 2)}` : 'ley' },
        ]}
        puntos={[{ x: x * 100, y: vout / VIN, color: pal.corriente }]}
      />
    {/if}
  {/snippet}
</Marco>
