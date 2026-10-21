<script lang="ts">
  // NTC, PTC and LDR (book 2.6, 19.5, 44.3): resistances that change with temperature or light, in a
  // divider. NTC: R = R₂₅·e^(B(1/T − 1/T₂₅)); switching PTC: abrupt rise above its switch temperature;
  // LDR: R = R₁₀·(E/10 lx)^(−γ).
  import Escena from '../ui/Escena.svelte';
  import Marco from '../ui/Marco.svelte';
  import Deslizador from '../ui/Deslizador.svelte';
  import Selector from '../ui/Selector.svelte';
  import Grafica from '../ui/Grafica.svelte';
  import { Reloj } from '../nucleo/reloj.svelte';
  import { txt, txtRico, fondo, rr, circulo, electrones, brillo, foton, azar, type Vista } from '../nucleo/dibujo';
  import { resistencia, hilo, fuente, masa, nodo } from '../nucleo/esquema';
  import { alfa, mezcla, paleta, colorCalor } from '../nucleo/paleta';
  import { ntc, ptc, ldr } from '../nucleo/fisica';
  import { si, num } from '../nucleo/formato';
  import { app } from '../../../lib/estado.svelte';

  type Tipo = 'ntc' | 'ptc' | 'ldr';
  const reloj = new Reloj();
  const pal = $derived(paleta(app.tema));
  let tipo = $state<Tipo>('ntc');
  let T = $state(25);
  let lux = $state(100);
  const RFIJA = 10e3;
  const VCC = 5;

  const R = $derived(tipo === 'ntc' ? ntc(T) : tipo === 'ptc' ? ptc(T) : ldr(lux));
  const rFija = $derived(tipo === 'ptc' ? 100 : RFIJA);
  const vout = $derived((VCC * R) / (R + rFija));
  const I = $derived(VCC / (R + rFija));

  // Particles inside the component.
  const rnd = azar(5);
  const part = Array.from({ length: 80 }, () => ({ u: rnd(), w: rnd(), s: 0.6 + rnd() * 0.8, f: rnd() * 6 }));
  const fotones = Array.from({ length: 14 }, () => ({ x: rnd(), t: rnd() * 2 }));
  let t = 0;
  let fase = 0;
  function paso(dt: number): void {
    t += dt;
    fase += dt * Math.min(0.5, 0.05 + I * 120);
  }

  function numPortadores(): number {
    if (tipo === 'ntc') return Math.round(Math.min(80, 6 + 30 * Math.sqrt(10e3 / R)));
    if (tipo === 'ldr') return Math.round(Math.min(80, 3 + 40 * Math.pow(20e3 / R, 0.6)));
    return 40;
  }

  function dibujarComponente(v: Vista, cx: number, cy: number, s: number): void {
    const { ctx } = v;
    const p = pal;
    const n = numPortadores();
    if (tipo === 'ldr') {
      // Light source and photons.
      const k = Math.log10(lux * 10) / 6;
      brillo(ctx, cx, cy - s * 1.7, s * 1.2 * (0.3 + k), '#ffd23f', 0.15 + 0.6 * k);
      circulo(ctx, cx, cy - s * 1.7, 18, mezcla('#ffd23f', p.fondo, 1 - Math.min(1, k + 0.1)), p.suave, 1.5);
      const nf = Math.round(14 * Math.min(1, k));
      for (let i = 0; i < nf; i++) {
        const f = fotones[i]!;
        const u = (f.t + t * 0.8) % 1;
        const x = cx + (f.x - 0.5) * s * 1.6;
        const y = cy - s * 1.5 + u * s * 1.3;
        foton(ctx, x, y, Math.PI / 2, '#e6a800', 22, 3.5, Math.sin(Math.PI * u));
      }
      // Ceramic disc with the CdS serpentine between interdigitated electrodes.
      circulo(ctx, cx, cy, s, p.ceramica, p.ceramicaSombra, 2);
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, s * 0.92, 0, Math.PI * 2);
      ctx.clip();
      ctx.fillStyle = mezcla('#d7a23a', '#7a4a10', 0.35);
      ctx.fillRect(cx - s, cy - s, 2 * s, 2 * s);
      const filas = 7;
      const h = (s * 1.7) / filas;
      for (let i = 0; i < filas; i++) {
        const y = cy - s * 0.85 + i * h;
        ctx.fillStyle = mezcla(p.estano, '#ffffff', 0.15);
        const izq = i % 2 === 0;
        ctx.fillRect(izq ? cx - s : cx - s * 0.75, y + h * 0.15, s * 1.75, h * 0.4);
      }
      ctx.restore();
      const pts: { x: number; y: number }[] = [];
      for (let i = 0; i < n; i++) {
        const q = part[i]!;
        const fila = Math.floor(q.u * filas);
        const y = cy - s * 0.85 + fila * h + h * 0.8;
        const xx = ((q.w + fase * q.s) % 1) * 1.6 - 0.8;
        if (Math.hypot(xx * s, y - cy) < s * 0.88) pts.push({ x: cx + xx * s, y });
      }
      electrones(ctx, pts, 3, p);
      txt(v, 'CdS entre electrodos en peine', cx, cy + s + 22, { tam: 12, color: p.suave });
      return;
    }
    // Environment temperature halo.
    brillo(ctx, cx, cy, s * 2.2, colorCalor((T + 20) / 170), 0.35);
    if (tipo === 'ntc') {
      // Epoxy bead on two leads.
      ctx.fillStyle = p.estano;
      ctx.fillRect(cx - s * 0.25 - 2, cy, 4, s * 1.9);
      ctx.fillRect(cx + s * 0.25 - 2, cy, 4, s * 1.9);
      const g = ctx.createRadialGradient(cx - s * 0.3, cy - s * 0.3, 2, cx, cy, s);
      g.addColorStop(0, mezcla('#3a4f7a', '#ffffff', 0.35));
      g.addColorStop(1, '#22304d');
      ctx.beginPath();
      ctx.ellipse(cx, cy, s * 0.85, s * 0.95, 0, 0, Math.PI * 2);
      ctx.fillStyle = g;
      ctx.fill();
      // Oxide body inside (cut-away window).
      rr(ctx, cx - s * 0.55, cy - s * 0.45, s * 1.1, s * 0.9, 8);
      ctx.fillStyle = mezcla(p.carbon, '#4b3a2a', 0.4);
      ctx.fill();
      const pts: { x: number; y: number }[] = [];
      for (let i = 0; i < n; i++) {
        const q = part[i]!;
        const xx = ((q.w + fase * q.s) % 1) * 1.0 - 0.5;
        pts.push({ x: cx + xx * s * 1.05, y: cy - s * 0.38 + q.u * s * 0.76 + Math.sin(t * 6 + q.f) * 2 });
      }
      electrones(ctx, pts, 3, p);
      if (!v.estrecho) txt(v, 'óxidos semiconductores', cx + s * 1.1, cy + s * 0.9, { tam: 12, color: p.suave, alin: 'left' });
    } else {
      // PTC: ceramic grains with barriers at the boundaries.
      const rr0 = s * 1.05;
      circulo(ctx, cx, cy, rr0, mezcla('#9a8f84', p.fondo, 0.2), p.suave, 2);
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, rr0 * 0.94, 0, Math.PI * 2);
      ctx.clip();
      const barrera = Math.min(1, Math.log10(R / 80) / 3);
      const celda = s * 0.42;
      ctx.lineWidth = 2 + 6 * barrera;
      ctx.strokeStyle = alfa(p.peligro, 0.25 + 0.7 * barrera);
      for (let gx = -3; gx <= 3; gx++)
        for (let gy = -3; gy <= 3; gy++) {
          const x = cx + gx * celda + (gy % 2) * celda * 0.5;
          const y = cy + gy * celda * 0.86;
          ctx.beginPath();
          for (let k = 0; k < 6; k++) {
            const a = (Math.PI / 3) * k + Math.PI / 6;
            const px = x + Math.cos(a) * celda * 0.56;
            const py = y + Math.sin(a) * celda * 0.56;
            if (k === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
          }
          ctx.closePath();
          ctx.stroke();
        }
      // Electrons: free crossing when cold, bouncing inside grains when the barriers rise.
      const pts: { x: number; y: number }[] = [];
      for (let i = 0; i < n; i++) {
        const q = part[i]!;
        const libre = 1 - barrera;
        const xx = (((q.w + fase * q.s * libre * 3) % 1) - 0.5) * 2 * rr0;
        const osc = Math.sin(t * 5 * q.s + q.f) * celda * 0.25 * barrera;
        pts.push({ x: cx + xx + osc, y: cy + (q.u - 0.5) * 1.8 * rr0 });
      }
      electrones(ctx, pts, 3, p);
      ctx.restore();
      txt(v, 'granos de BaTiO₃ y sus fronteras', cx, cy + rr0 + 20, { tam: 12, color: p.suave });
    }
  }

  function dibujarDivisor(v: Vista, x0: number, y0: number, alto: number): void {
    const p = pal;
    const xf = x0;
    const xr = x0 + 110;
    const yTop = y0;
    const yBot = y0 + alto;
    const ym = (yTop + yBot) / 2;
    fuente(v, xf, ym, 20, 'dc', { rotulo: `${VCC} V` });
    hilo(v, [
      [xf, ym - 20],
      [xf, yTop],
      [xr, yTop],
    ]);
    hilo(v, [
      [xf, ym + 20],
      [xf, yBot],
      [xr, yBot],
    ]);
    masa(v, xr, yBot);
    resistencia(v, xr, yTop, xr, ym, { largo: 56, alto: 20 });
    txtRico(v, si(rFija, 'Ω', 2), xr + 16, (yTop + ym) / 2, { alin: 'left', tam: 13 });
    resistencia(v, xr, ym, xr, yBot, { largo: 56, alto: 20, relleno: alfa(p.acento, 0.2) });
    // Sensor marks: diagonal line with the symbol of the physical quantity.
    const { ctx } = v;
    ctx.strokeStyle = p.tinta;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(xr - 22, (ym + yBot) / 2 + 26);
    ctx.lineTo(xr - 12, (ym + yBot) / 2 + 26);
    ctx.lineTo(xr + 18, (ym + yBot) / 2 - 26);
    ctx.stroke();
    txt(v, tipo === 'ldr' ? '☀' : tipo === 'ntc' ? '−t°' : '+t°', xr + 26, (ym + yBot) / 2 - 28, { tam: 12, peso: 700, alin: 'left' });
    txtRico(v, si(R, 'Ω', 3), xr + 16, (ym + yBot) / 2 + 4, { alin: 'left', tam: 14, peso: 800, color: p.acento });
    nodo(v, xr, ym);
    hilo(v, [
      [xr, ym],
      [xr + 70, ym],
    ]);
    txtRico(v, `V_out = ${num(vout, 2)} V`, xr + 76, ym, { alin: 'left', tam: 15, peso: 800, color: p.acento });
  }

  function dibujar(v: Vista): void {
    void [tipo, T, lux];
    fondo(v);
    const p = pal;
    if (v.estrecho) {
      dibujarComponente(v, v.w / 2, 190, 86);
      dibujarDivisor(v, 120, 360, 180);
    } else {
      dibujarComponente(v, 250, 230, 104);
      dibujarDivisor(v, 560, 90, 280);
    }
    const s = tipo === 'ldr' ? `iluminación: ${si(lux, 'lx', 3)}` : `temperatura: ${num(T, 0)} °C`;
    txt(v, s, v.estrecho ? v.w / 2 : 250, v.estrecho ? 40 : 34, { tam: 15, peso: 700, color: p.tinta });
  }

  const curva = $derived.by(() => {
    const xs: number[] = [];
    const ys: number[] = [];
    if (tipo === 'ldr') {
      for (let k = 0; k <= 120; k++) {
        const e = 0.1 * Math.pow(10, (6 * k) / 120);
        xs.push(e);
        ys.push(ldr(e));
      }
    } else
      for (let tt = -20; tt <= 160; tt += 1) {
        xs.push(tt);
        ys.push(tipo === 'ntc' ? ntc(tt) : ptc(tt));
      }
    return { xs, ys };
  });

  const texto = $derived.by(() => {
    if (tipo === 'ntc')
      return (
        `**NTC:** al calentarse, el óxido semiconductor libera más portadores y su resistencia **baja**, de forma marcadamente no lineal (B = 3 950 K): a ${num(T, 0)} °C vale ${si(R, 'Ω', 3)} frente a 10 kΩ a 25 °C.\n` +
        'Sirve para medir temperatura y para limitar la corriente de irrupción; pero si el equipo se reconecta enseguida, la NTC sigue caliente y ya no limita nada.'
      );
    if (tipo === 'ptc')
      return (
        `**PTC conmutadora:** por debajo de su temperatura de conmutación (unos 120 °C) apenas cambia; por encima, las barreras en las fronteras de grano se disparan y la resistencia sube varios órdenes: ahora ${si(R, 'Ω', 3)}.\n` +
        'Es el principio del fusible rearmable: ante una sobrecorriente se calienta, limita la corriente y se rearma al enfriarse (sin volver exactamente a su valor original).'
      );
    return (
      `**LDR:** cada fotón absorbido en el sulfuro de cadmio libera portadores, y la resistencia cae con la luz: ${si(R, 'Ω', 3)} con ${si(lux, 'lx', 3)}.\n` +
      'Es barata y sensible, pero muy lenta, tiene memoria de la iluminación previa y contiene cadmio, restringido por RoHS.'
    );
  });

  const lecturas = $derived([
    { e: 'Resistencia', v: si(R, 'Ω', 3), c: pal.acento },
    { e: 'V_out', v: `${num(vout, 2)} V` },
    { e: 'Corriente', v: si(I, 'A', 3) },
    ...(tipo === 'ntc' ? [{ e: 'Sensibilidad', v: `${num((-3950 / (T + 273.15) ** 2) * 100, 2)} %/°C` }] : []),
  ]);
</script>

<Marco {reloj} {texto} {lecturas} leyenda={tipo === 'ldr' ? ['electron', 'foton'] : ['electron', 'calor']}>
  {#snippet modos()}
    <Selector
      bind:valor={tipo}
      opciones={[
        { valor: 'ntc', texto: 'NTC' },
        { valor: 'ptc', texto: 'PTC' },
        { valor: 'ldr', texto: 'LDR' },
      ]}
    />
  {/snippet}
  {#snippet escena()}
    <Escena {reloj} {paso} {dibujar} dims={(a) => (a < 560 ? [560, 600] : [900, 440])} etiqueta="Sensor resistivo y divisor de tensión" />
  {/snippet}
  {#snippet controles()}
    {#if tipo === 'ldr'}
      <Deslizador etiqueta="Iluminación" bind:valor={lux} min={0.1} max={100000} log unidad="lx" />
      <p class="nota">Referencias: 1 lx penumbra · 300 lx oficina · 100 000 lx sol directo.</p>
    {:else}
      <Deslizador etiqueta="Temperatura" bind:valor={T} min={-20} max={160} paso={1} formato={(x) => `${num(x, 0)} °C`} />
    {/if}
  {/snippet}
  {#snippet grafica()}
    <Grafica
      titulo={tipo === 'ldr' ? 'Resistencia frente a la iluminación' : 'Resistencia frente a la temperatura'}
      x={tipo === 'ldr' ? { etiqueta: 'E', unidad: 'lx', min: 0.1, max: 1e5, log: true } : { etiqueta: 'T', unidad: '°C', min: -20, max: 160 }}
      y={{ etiqueta: 'R', unidad: 'Ω', min: tipo === 'ptc' ? 10 : 100, max: tipo === 'ptc' ? 1e7 : 2e6, log: true }}
      series={[{ x: curva.xs, y: curva.ys, color: pal.acento }]}
      puntos={[{ x: tipo === 'ldr' ? lux : T, y: R, color: pal.corriente, etiqueta: si(R, 'Ω', 3) }]}
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
