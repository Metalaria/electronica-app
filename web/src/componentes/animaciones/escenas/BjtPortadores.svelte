<script lang="ts">
  // Inside the bipolar transistor (book 6.1, 6.2, fig. 6.1, 25.4): the forward-biased base-emitter junction
  // injects carriers into a thin base; almost all of them cross it and the reverse-biased base-collector
  // junction sweeps them into the collector. I_C = I_S·e^(V_BE/V_T); the few that recombine in the base are
  // the base current, I_B = I_C/β. A base twice as thick quadruples the recombination (β falls ~4×).
  import { compartir3d } from '../../tres/compartir.svelte';
  import { untrack } from 'svelte';
  import Escena from '../ui/Escena.svelte';
  import Marco from '../ui/Marco.svelte';
  import Deslizador from '../ui/Deslizador.svelte';
  import Selector from '../ui/Selector.svelte';
  import Grafica from '../ui/Grafica.svelte';
  import { Reloj, Muestreo } from '../nucleo/reloj.svelte';
  import { txt, txtRico, fondo, flecha, electrones, huecos, brillo, azar, limitar, type Vista } from '../nucleo/dibujo';
  import { alfa, mezcla, paleta } from '../nucleo/paleta';
  import { vt } from '../nucleo/fisica';
  import { si, num, pct } from '../nucleo/formato';
  import { app } from '../../../lib/estado.svelte';

  const reloj = new Reloj();
  const pal = $derived(paleta(app.tema));
  let tipo = $state<'npn' | 'pnp'>('npn');
  let vbe = $state(0.65);
  let ancho = $state(1);
  const IS = 1e-14;
  const beta = $derived(100 / (ancho * ancho));
  const IC = $derived(IS * Math.exp(vbe / vt()));
  const IB = $derived(IC / beta);
  const IE = $derived(IC + IB);

  interface P {
    x: number;
    y: number;
    vx: number;
    vy: number;
    modo: 0 | 1 | 2 | 3; // 0 majority in emitter, 1 crossing the base, 2 swept into the collector, 3 meeting
    t: number;
    mx: number;
    my: number;
  }
  let ps: P[] = [];
  let baseH: { x: number; y: number; vx: number; vy: number; modo: 0 | 1; t: number; mx: number; my: number }[] = [];
  let flashes: { x: number; y: number; t: number }[] = [];
  const rnd = azar(71);
  let G = { y0: 0, y1: 0, xE: 0, xB0: 0, xB1: 0, xC: 0, x0: 0, x1: 0 };
  let clave = '';
  let llegan = 0;
  let recombinan = 0;
  let cuenta = $state({ llegan: 0, recombinan: 0 });
  const muestreo = new Muestreo(200);
  let acum = 0;

  function reiniciar(): void {
    ps = [];
    baseH = [];
    flashes = [];
    llegan = 0;
    recombinan = 0;
    for (let k = 0; k < 40; k++) ps.push({ x: G.x0 + 8 + rnd() * (G.xB0 - G.x0 - 20), y: G.y0 + 8 + rnd() * (G.y1 - G.y0 - 16), vx: 0, vy: 0, modo: 0, t: 0, mx: 0, my: 0 });
    for (let k = 0; k < 12; k++) baseH.push({ x: G.xB0 + 6 + rnd() * (G.xB1 - G.xB0 - 12), y: G.y0 + 8 + rnd() * (G.y1 - G.y0 - 16), vx: 0, vy: 0, modo: 0, t: 0, mx: 0, my: 0 });
  }
  $effect(() => {
    void tipo;
    if (reloj.reinicios >= 0) untrack(() => (clave = ''));
  });

  function paso(dt: number): void {
    if (!ps.length) return;
    const g = G;
    const tasa = vbe < 0.45 ? 0 : limitar(8 * Math.log10(IC / 1e-7), 0, 40);
    acum += tasa * dt;
    while (acum >= 1) {
      acum -= 1;
      // The emitter carrier closest to the junction is injected into the base.
      let mejor: P | null = null;
      for (const p of ps) if (p.modo === 0 && (!mejor || p.x > mejor.x)) mejor = p;
      if (mejor) {
        mejor.modo = 1;
        mejor.t = 0;
        mejor.vx = 60;
        // Replacement entering from the emitter contact.
        ps.push({ x: g.x0 + 4, y: g.y0 + 8 + rnd() * (g.y1 - g.y0 - 16), vx: 50, vy: 0, modo: 0, t: 0, mx: 0, my: 0 });
      }
    }
    const amort = Math.exp(-dt / 0.25);
    const raiz = Math.sqrt(dt);
    const vivos: P[] = [];
    for (const p of ps) {
      p.t += dt;
      if (p.modo === 3) {
        p.x += (p.mx - p.x) * Math.min(1, dt * 8);
        p.y += (p.my - p.y) * Math.min(1, dt * 8);
        if (p.t > 0.3) {
          flashes.push({ x: p.mx, y: p.my, t: 0 });
          continue;
        }
        vivos.push(p);
        continue;
      }
      if (p.modo === 2) {
        p.vx = Math.min(320, p.vx + 900 * dt);
        p.x += p.vx * dt;
        if (p.x > g.x1 - 4) {
          llegan++;
          continue;
        }
        vivos.push(p);
        continue;
      }
      p.vx = p.vx * amort + (rnd() - 0.5) * 900 * raiz;
      p.vy = p.vy * amort + (rnd() - 0.5) * 900 * raiz;
      if (p.modo === 0) {
        if (p.x > g.xB0 - 8) p.vx -= 2400 * dt;
        p.x = limitar(p.x + p.vx * dt, g.x0 + 4, g.xB0 - 4);
      } else {
        // Diffusion across the base with a small drift; probability 1/(β+1) of recombining on the way.
        p.vx += 120 * dt;
        p.x += p.vx * dt;
        if (p.x < g.xB0 + 2) p.vx = Math.abs(p.vx);
        if (p.t < dt * 1.5 && rnd() < 1 / (beta + 1)) {
          const h = baseH.find((q) => q.modo === 0);
          if (h) {
            p.modo = 3;
            p.t = 0;
            p.mx = (p.x + h.x) / 2 + 10;
            p.my = (p.y + h.y) / 2;
            h.modo = 1;
            h.t = 0;
            h.mx = p.mx;
            h.my = p.my;
            recombinan++;
          }
        }
        if (p.x > g.xB1) {
          p.modo = 2;
          p.vx = 120;
        }
      }
      p.y = limitar(p.y + p.vy * dt, g.y0 + 5, g.y1 - 5);
      vivos.push(p);
    }
    ps = vivos;
    for (const h of baseH) {
      h.t += dt;
      if (h.modo === 1) {
        h.x += (h.mx - h.x) * Math.min(1, dt * 8);
        h.y += (h.my - h.y) * Math.min(1, dt * 8);
        if (h.t > 0.3) {
          // Recombined: the base contact supplies a new one (that is the base current).
          h.modo = 0;
          h.x = (g.xB0 + g.xB1) / 2;
          h.y = g.y0 + 6;
          h.vy = 80;
        }
        continue;
      }
      h.vx = h.vx * amort + (rnd() - 0.5) * 500 * raiz;
      h.vy = h.vy * amort + (rnd() - 0.5) * 500 * raiz;
      h.x = limitar(h.x + h.vx * dt, g.xB0 + 4, g.xB1 - 4);
      h.y = limitar(h.y + h.vy * dt, g.y0 + 5, g.y1 - 5);
    }
    for (const f of flashes) f.t += dt;
    flashes = flashes.filter((f) => f.t < 0.6);
    if (muestreo.toca()) cuenta = { llegan, recombinan };
  }

  function dibujar(v: Vista): void {
    void [tipo, vbe, ancho];
    const { ctx } = v;
    const p = pal;
    fondo(v);
    const est = v.estrecho;
    const x0 = est ? 70 : 110;
    const x1 = v.w - (est ? 70 : 110);
    const y0 = est ? 150 : 120;
    const y1 = est ? 360 : 310;
    const xB0 = x0 + (x1 - x0) * 0.32;
    const xB1 = xB0 + 34 * ancho;
    const k = `${x0},${x1},${y0},${y1},${xB1},${tipo}`;
    G = { y0, y1, xE: x0, xB0, xB1, xC: x1, x0, x1 };
    if (k !== clave) {
      clave = k;
      reiniciar();
    }
    const npn = tipo === 'npn';
    // Regions: for the PNP the carriers are holes and the regions swap type.
    const colE = npn ? p.siNfuerte : p.siPfuerte;
    const colB = npn ? p.siP : p.siN;
    const colC = npn ? p.siN : p.siP;
    ctx.fillStyle = colE;
    ctx.fillRect(x0, y0, xB0 - x0, y1 - y0);
    ctx.fillStyle = colB;
    ctx.fillRect(xB0, y0, xB1 - xB0, y1 - y0);
    ctx.fillStyle = colC;
    ctx.fillRect(xB1, y0, x1 - xB1, y1 - y0);
    // Depletion regions: thin (forward) at B-E, wide (reverse) at B-C, mostly in the collector.
    ctx.fillStyle = alfa(p.agotamiento, 0.85);
    ctx.fillRect(xB0 - 3, y0, 7, y1 - y0);
    ctx.fillRect(xB1 - 4, y0, 46, y1 - y0);
    for (let q = 0; q < 3; q++) {
      const yy = y0 + ((y1 - y0) * (q + 0.5)) / 3;
      if (npn) flecha(ctx, xB1 + 40, yy, xB1 - 2, yy, alfa(p.campoE, 0.8), 1.8, 8);
      else flecha(ctx, xB1 - 2, yy, xB1 + 40, yy, alfa(p.campoE, 0.8), 1.8, 8);
    }
    ctx.strokeStyle = mezcla(p.linea, p.tinta, 0.2);
    ctx.lineWidth = 1.2;
    ctx.strokeRect(x0, y0, x1 - x0, y1 - y0);
    // Contacts.
    ctx.fillStyle = p.aluminio;
    ctx.fillRect(x0 - 14, y0, 14, y1 - y0);
    ctx.fillRect(x1, y0, 14, y1 - y0);
    ctx.fillRect(xB0 + 2, y0 - 12, xB1 - xB0 - 4, 12);
    txt(v, `emisor (${npn ? 'N⁺' : 'P⁺'}, muy dopado)`, (x0 + xB0) / 2, y1 + 20, { tam: 12.5, peso: 700, color: p.suave });
    txt(v, `base (${npn ? 'P' : 'N'})`, (xB0 + xB1) / 2, y1 + 40, { tam: 12.5, peso: 700, color: p.suave });
    txt(v, `colector (${npn ? 'N' : 'P'})`, (xB1 + x1) / 2 + 20, y1 + 20, { tam: 12.5, peso: 700, color: p.suave });
    // Carriers: main carriers (electrons for NPN, holes for PNP), and the base's majority of the other type.
    const principales = ps;
    const deBase = baseH;
    if (npn) {
      electrones(ctx, principales, 4, p);
      huecos(ctx, deBase, 4, p);
    } else {
      huecos(ctx, principales, 4, p);
      electrones(ctx, deBase, 4, p);
    }
    for (const f of flashes) brillo(ctx, f.x, f.y, 18 + f.t * 20, p.calor, 0.7 * (1 - f.t / 0.6));
    // Terminal currents (conventional): NPN: I_C and I_B in, I_E out. PNP: the opposite.
    const yA = (y0 + y1) / 2;
    const s = npn ? 1 : -1;
    const kk = Math.min(1, 0.25 + Math.log10(Math.max(IC, 1e-9) / 1e-6) / 4);
    if (vbe > 0.45) {
      if (s > 0) {
        flecha(ctx, x1 + 70, yA, x1 + 20, yA, alfa(p.corriente, kk), 3, 12);
        flecha(ctx, x0 - 20, yA, x0 - 70, yA, alfa(p.corriente, kk), 3, 12);
        flecha(ctx, (xB0 + xB1) / 2, y0 - 70, (xB0 + xB1) / 2, y0 - 18, alfa(p.corriente, kk * 0.7), 2, 9);
      } else {
        flecha(ctx, x1 + 20, yA, x1 + 70, yA, alfa(p.corriente, kk), 3, 12);
        flecha(ctx, x0 - 70, yA, x0 - 20, yA, alfa(p.corriente, kk), 3, 12);
        flecha(ctx, (xB0 + xB1) / 2, y0 - 18, (xB0 + xB1) / 2, y0 - 70, alfa(p.corriente, kk * 0.7), 2, 9);
      }
    }
    if (est) {
      const o = { tam: 13, peso: 800, color: p.corriente } as const;
      txtRico(v, 'I_E', x0 / 2, yA - 46, o);
      txt(v, si(IE, 'A', 3), x0 / 2, yA - 26, o);
      txtRico(v, 'I_C', (x1 + v.w) / 2, yA - 46, o);
      txt(v, si(IC, 'A', 3), (x1 + v.w) / 2, yA - 26, o);
    } else {
      txtRico(v, `I_E = ${si(IE, 'A', 3)}`, x0 - 8, yA - 26, { tam: 13.5, peso: 800, color: p.corriente, alin: 'right' });
      txtRico(v, `I_C = ${si(IC, 'A', 3)}`, x1 + 10, yA - 26, { tam: 13.5, peso: 800, color: p.corriente, alin: 'left' });
    }
    txtRico(v, `I_B = ${si(IB, 'A', 3)}`, (xB0 + xB1) / 2 + 12, y0 - 60, { tam: 13.5, peso: 800, color: p.corriente, alin: 'left' });
    txtRico(v, `V_BE = ${num(npn ? vbe : -vbe, 3)} V`, est ? v.w / 2 : x0 + 80, est ? 36 : 40, { tam: 15, peso: 800, color: p.acento });
    txtRico(v, `β = ${num(beta, beta < 10 ? 1 : 0)}`, est ? v.w / 2 : x1 - 80, est ? 64 : 40, { tam: 15, peso: 800, color: p.acento });
  }

  const curva = $derived.by(() => {
    const xs: number[] = [];
    const c: number[] = [];
    const b: number[] = [];
    for (let q = 0; q <= 120; q++) {
      const x = 0.4 + (q / 120) * 0.4;
      xs.push(x);
      c.push(IS * Math.exp(x / vt()));
      b.push((IS * Math.exp(x / vt())) / beta);
    }
    return { xs, c, b };
  });

  const texto = $derived.by(() => {
    const port = tipo === 'npn' ? 'electrones' : 'huecos';
    if (vbe < 0.45)
      return `**Corte:** con V_BE = ${num(vbe, 2)} V la unión base-emisor apenas inyecta: solo circulan fugas de nanoamperios. El transistor es un interruptor abierto.`;
    return (
      `**Activa:** la unión base-emisor en directa **inyecta** ${port} en la base. La base es tan delgada que casi todos la atraviesan sin recombinarse, y el campo de la unión base-colector, en inversa, los **barre** al colector: I_C = I_S·exp(V_BE/V_T) = ${si(IC, 'A', 3)}.\n` +
      `Solo 1 de cada ${num(beta + 1, 0)} se recombina en la base; reponer esos es la corriente de base, I_B = I_C/β = ${si(IB, 'A', 3)}. ` +
      (ancho > 1.3 ? `Con la base ${num(ancho, 1)} veces más gruesa, β cae a ${num(beta, 0)}: la ganancia mide lo bien hecha que está la base.` : 'Cada 59,5 mV más de V_BE multiplican I_C por diez.')
    );
  });
  const lecturas = $derived([
    { e: 'I_C', v: si(IC, 'A', 3), c: pal.corriente },
    { e: 'I_B', v: si(IB, 'A', 3) },
    { e: 'β = I_C/I_B', v: num(beta, beta < 10 ? 1 : 0), c: pal.acento },
    { e: 'α = I_C/I_E', v: num(beta / (beta + 1), 4) },
    { e: 'Llegan al colector', v: cuenta.llegan + cuenta.recombinan > 0 ? pct(cuenta.llegan / (cuenta.llegan + cuenta.recombinan), 1) : '—' },
  ]);

  // 3D view of the page (componentes/tres): the model follows these controls.
  compartir3d(() => ({ tipo }));
</script>

<Marco {reloj} {texto} {lecturas} leyenda={tipo === 'npn' ? ['electron', 'hueco', 'corriente', 'campoE', 'recombinacion'] : ['hueco', 'electron', 'corriente', 'campoE', 'recombinacion']}>
  {#snippet modos()}
    <Selector bind:valor={tipo} opciones={[{ valor: 'npn', texto: 'NPN' }, { valor: 'pnp', texto: 'PNP' }]} />
  {/snippet}
  {#snippet escena()}
    <Escena {reloj} {paso} {dibujar} dims={(a) => (a < 560 ? [560, 420] : [900, 380])} etiqueta="Transistor bipolar: portadores del emisor al colector" />
  {/snippet}
  {#snippet controles()}
    <Deslizador etiqueta={tipo === 'npn' ? 'Tensión base-emisor V_BE' : 'Tensión emisor-base V_EB'} bind:valor={vbe} min={0.3} max={0.8} paso={0.005} unidad="V" formato={(x) => `${num(x, 3)} V`} />
    <Deslizador etiqueta="Grosor de la base (relativo)" bind:valor={ancho} min={0.7} max={3} paso={0.05} formato={(x) => `${num(x, 2)}×`} />
  {/snippet}
  {#snippet grafica()}
    <Grafica
      titulo="Corrientes frente a V_BE (escala logarítmica)"
      x={{ etiqueta: 'V_BE', unidad: 'V', min: 0.4, max: 0.8 }}
      y={{ etiqueta: 'I', unidad: 'A', min: 1e-9, max: 1, log: true }}
      series={[
        { x: curva.xs, y: curva.c, color: pal.corriente, nombre: 'I_C' },
        { x: curva.xs, y: curva.b, color: pal.acento, nombre: 'I_B' },
      ]}
      puntos={[{ x: vbe, y: IC, color: pal.corriente, etiqueta: si(IC, 'A', 3) }]}
    />
  {/snippet}
</Marco>
