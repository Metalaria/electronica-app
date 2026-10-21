<script lang="ts">
  // Metallised film capacitor and self-healing (book 3.4.3 and 3.10): if the plastic film is punctured, the arc
  // vaporises the very thin metal layer around the spot, isolating the defect; the capacitor loses a tiny
  // fraction of its capacitance and keeps working.
  import { untrack } from 'svelte';
  import Escena from '../ui/Escena.svelte';
  import Marco from '../ui/Marco.svelte';
  import Deslizador from '../ui/Deslizador.svelte';
  import Selector from '../ui/Selector.svelte';
  import { Reloj, Muestreo } from '../nucleo/reloj.svelte';
  import { txt, fondo, rr, brillo, azar, circulo, tarjeta, gradCilindroX, type Vista } from '../nucleo/dibujo';
  import { alfa, mezcla, paleta } from '../nucleo/paleta';
  import { si, num } from '../nucleo/formato';
  import { app } from '../../../lib/estado.svelte';

  const reloj = new Reloj();
  const pal = $derived(paleta(app.tema));
  let V = $state(460);
  let film = $state<'pp' | 'pet'>('pp');
  const VN = 400;
  const C0 = 1e-6;

  interface Agujero {
    x: number;
    y: number;
    r: number;
    t: number;
  }
  let agujeros: Agujero[] = [];
  let cuenta = $state(0);
  let perdida = $state(0);
  const rnd = azar(21);
  const debiles = Array.from({ length: 40 }, () => ({ x: rnd(), y: rnd(), umbral: 0.85 + rnd() * 0.6 }));
  const muestreo = new Muestreo(200);
  let t = 0;

  function perforar(x?: number, y?: number): void {
    const d = debiles[Math.floor(rnd() * debiles.length)]!;
    agujeros.push({ x: x ?? d.x, y: y ?? d.y, r: 0, t: 0 });
    cuenta++;
  }
  $effect(() => {
    if (reloj.reinicios > 0)
      untrack(() => {
        agujeros = [];
        cuenta = 0;
        perdida = 0;
      });
  });

  let primera = true;
  function paso(dt: number): void {
    t += dt;
    if (primera && t > 0.8) {
      primera = false;
      perforar(0.35, 0.45);
    }
    // Breakdown probability grows steeply above the rated voltage.
    const s = V / VN;
    const tasa = s < 0.8 ? 0 : 0.6 * Math.pow((s - 0.8) / 0.4, 3);
    if (rnd() < tasa * dt) {
      const candidatos = debiles.filter((d) => d.umbral < s * 1.1);
      const d = candidatos[Math.floor(rnd() * candidatos.length)];
      if (d) perforar(d.x + (rnd() - 0.5) * 0.04, d.y + (rnd() - 0.5) * 0.04);
    }
    for (const a of agujeros) {
      a.t += dt;
      a.r = Math.min(1, a.t / 0.25);
    }
    if (muestreo.toca()) perdida = agujeros.length * 2.5e-5;
  }

  function dibujar(v: Vista): void {
    void [V, film, cuenta];
    const { ctx } = v;
    const p = pal;
    fondo(v);
    const est = v.estrecho;
    // Boxed film capacitor, cut open to show the winding.
    const bx = est ? 30 : 40;
    const by = est ? 40 : 70;
    const bw = est ? 210 : 260;
    const bh = est ? 160 : 230;
    rr(ctx, bx, by, bw, bh, 8);
    ctx.fillStyle = mezcla('#d7b23c', p.fondo, 0.1);
    ctx.fill();
    txt(v, `1 µF ${VN} V`, bx + bw / 2, by + 24, { tam: 14, peso: 800, color: '#5a4300' });
    txt(v, film === 'pp' ? 'MKP (polipropileno)' : 'MKT (poliéster)', bx + bw / 2, by + 44, { tam: 11.5, peso: 700, color: '#5a4300' });
    // Flat winding seen from the side.
    const wx0 = bx + 22;
    const wx1 = bx + bw - 22;
    const wy0 = by + 64;
    const wy1 = by + bh - 16;
    for (let k = 0; k < 14; k++) {
      const y = wy0 + ((wy1 - wy0) * k) / 14;
      ctx.fillStyle = k % 2 ? alfa('#9ecde0', 0.8) : alfa('#c6ccd3', 0.95);
      ctx.fillRect(wx0 + (k % 2 ? 8 : 0), y, wx1 - wx0 - 8, (wy1 - wy0) / 14 - 1);
    }
    ctx.fillStyle = gradCilindroX(ctx, wx0 - 10, wx0, p.estano, p.oscuro);
    ctx.fillRect(wx0 - 10, wy0, 10, wy1 - wy0);
    ctx.fillStyle = gradCilindroX(ctx, wx1, wx1 + 10, p.estano, p.oscuro);
    ctx.fillRect(wx1, wy0, 10, wy1 - wy0);
    txt(v, 'láminas enrolladas', bx + bw / 2, by + bh + 18, { tam: 12, color: p.suave });
    txt(v, 'y contactos de metal proyectado', bx + bw / 2, by + bh + 36, { tam: 12, color: p.suave });

    // Zoom: metallised film seen from above.
    const zx = est ? 20 : 330;
    const zy = est ? 250 : 30;
    const zw = est ? v.w - 40 : v.w - 350;
    const zh = est ? v.h - 270 : v.h - 60;
    tarjeta(v, zx, zy, zw, zh, 'Ampliación: metalización de unos 30 nm sobre el plástico');
    const ix = zx + 14;
    const iy = zy + 30;
    const iw = zw - 28;
    const ih = zh - 44;
    ctx.fillStyle = film === 'pp' ? alfa('#a9d4e6', 0.7) : alfa('#e2c79a', 0.7);
    ctx.fillRect(ix, iy, iw, ih);
    ctx.save();
    ctx.beginPath();
    ctx.rect(ix, iy, iw, ih);
    ctx.clip();
    // Metal layer with a fine grain.
    const gm = ctx.createLinearGradient(ix, iy, ix + iw, iy + ih);
    gm.addColorStop(0, '#b9c0c8');
    gm.addColorStop(0.5, '#e3e7eb');
    gm.addColorStop(1, '#aab2bb');
    ctx.fillStyle = gm;
    ctx.fillRect(ix, iy, iw - 26, ih);
    // Cleared holes (dielectric visible) and arcs.
    for (const a of agujeros) {
      const x = ix + a.x * (iw - 26);
      const y = iy + a.y * ih;
      const r = 6 + 16 * a.r;
      circulo(ctx, x, y, r, film === 'pp' ? '#b9dcea' : '#ead6b0');
      ctx.strokeStyle = alfa('#5c5f63', 0.6);
      ctx.lineWidth = 1.5;
      ctx.stroke();
      if (a.t < 0.45) {
        brillo(ctx, x, y, 40 * (1 - a.t / 0.45) + 10, '#9fd0ff', 0.95 * (1 - a.t / 0.45));
        brillo(ctx, x, y, 14, '#ffffff', 1 - a.t / 0.45);
      }
      circulo(ctx, x, y, 2, '#3a3a3a');
    }
    // Weak points (latent defects).
    for (const d of debiles) {
      const x = ix + d.x * (iw - 26);
      const y = iy + d.y * ih;
      circulo(ctx, x, y, 1.6, alfa('#5a5a5a', 0.35));
    }
    ctx.restore();
    // Margin (non-metallised edge) note.
    txt(v, 'margen sin metal', ix + iw - 13, iy + ih / 2, { tam: 11, color: p.suave, rot: -Math.PI / 2 });
    const s = V / VN;
    if (s > 0.8) txt(v, s > 1 ? 'Sobretensión: perforaciones frecuentes' : 'Cerca de la tensión nominal', zx + zw / 2, zy + zh - 10, { tam: 12.5, peso: 800, color: s > 1 ? p.peligro : p.aviso });
  }

  const texto = $derived(
    `**Película metalizada:** el dieléctrico es una lámina de ${film === 'pp' ? 'polipropileno (pérdidas muy bajas, la elección para audio, resonantes y potencia)' : 'poliéster (más capacidad por volumen, pérdidas algo mayores)'} y los electrodos son una capa metálica de unas decenas de nanómetros depositada sobre ella.\n` +
      `Si el plástico se perfora en un punto débil, el arco **vaporiza la metalización** alrededor y aísla el defecto: el condensador pierde una fracción ínfima de capacidad y sigue funcionando. ` +
      (cuenta > 0 ? `Lleva ${cuenta} autorregeneraciones y ha perdido un ${num(perdida * 100, 3)} %.` : 'Pruebe a subir la tensión por encima de la nominal o a provocar una perforación.') +
      ' Es la razón de su fiabilidad como condensador de red (clase X).',
  );
  const lecturas = $derived([
    { e: 'Capacidad', v: si(C0 * (1 - perdida), 'F', 5), c: pal.acento },
    { e: 'Autorregeneraciones', v: String(cuenta) },
    { e: 'Tensión / nominal', v: `${num((V / VN) * 100, 0)} %`, c: V > VN ? pal.peligro : pal.tinta },
  ]);
</script>

<Marco {reloj} {texto} {lecturas}>
  {#snippet escena()}
    <Escena {reloj} {paso} {dibujar} dims={(a) => (a < 560 ? [560, 600] : [900, 380])} etiqueta="Condensador de película metalizada autorregenerándose" />
  {/snippet}
  {#snippet controles()}
    <Selector etiqueta="Plástico" bind:valor={film} opciones={[{ valor: 'pp', texto: 'Polipropileno' }, { valor: 'pet', texto: 'Poliéster' }]} />
    <Deslizador etiqueta="Tensión aplicada" bind:valor={V} min={0} max={600} paso={5} unidad="V" formato={(x) => `${num(x, 0)} V`} />
    <button class="boton" onclick={() => perforar()}>Provocar una perforación</button>
  {/snippet}
</Marco>
