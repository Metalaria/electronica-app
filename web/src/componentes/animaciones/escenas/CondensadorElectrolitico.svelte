<script lang="ts">
  // Electrolytic capacitors (book 3.4.2, 3.4.4, 3.8): the rolled aluminium foils, the anodic oxide that is the
  // dielectric (about 1,4 nm per volt of forming voltage), the liquid electrolyte as cathode; what reverse
  // polarity does (the oxide dissolves, leakage and gas grow, the vent opens); tantalum and polymer.
  import { untrack } from 'svelte';
  import Escena from '../ui/Escena.svelte';
  import Marco from '../ui/Marco.svelte';
  import Deslizador from '../ui/Deslizador.svelte';
  import Selector from '../ui/Selector.svelte';
  import Grafica from '../ui/Grafica.svelte';
  import { Reloj, Muestreo } from '../nucleo/reloj.svelte';
  import { txt, fondo, rr, gradCilindroX, tarjeta, brillo, azar, circulo, type Vista } from '../nucleo/dibujo';
  import { alfa, mezcla, paleta } from '../nucleo/paleta';
  import { si, num } from '../nucleo/formato';
  import { app } from '../../../lib/estado.svelte';

  type Modo = 'aluminio' | 'inverso' | 'tantalo' | 'polimero';
  const reloj = new Reloj();
  const pal = $derived(paleta(app.tema));
  let modo = $state<Modo>('aluminio');
  let vf = $state(35);
  let vinv = $state(6);

  const espesor = $derived(1.4e-9 * vf);

  // Reverse polarity: the oxide is consumed, leakage and temperature grow, gas builds pressure.
  let oxido = 1;
  let presion = 0;
  let temperatura = 25;
  let ventila = false;
  let tiempo = 0;
  let serie = $state.raw<{ t: number[]; i: number[] }>({ t: [], i: [] });
  let estado = $state({ i: 0, T: 25, p: 0, ventila: false });
  const muestreo = new Muestreo(120);
  const rnd = azar(4);
  const burbujas: { x: number; y: number; r: number }[] = [];
  const iones = Array.from({ length: 60 }, () => ({ u: rnd(), w: rnd(), s: rnd() < 0.5 ? 1 : -1, f: rnd() * 6 }));

  function reiniciarInverso(): void {
    oxido = 1;
    presion = 0;
    temperatura = 25;
    ventila = false;
    tiempo = 0;
    burbujas.length = 0;
    serie = { t: [], i: [] };
  }
  $effect(() => {
    void modo;
    if (reloj.reinicios >= 0) untrack(reiniciarInverso);
  });

  let t = 0;
  function paso(dt: number): void {
    t += dt;
    if (modo !== 'inverso') return;
    tiempo += dt;
    const fuga = 1e-6 * Math.exp((1 - oxido) * 9) * (vinv / 6);
    oxido = Math.max(0.02, oxido - dt * 0.02 * vinv * (0.3 + fuga * 2e3));
    const pot = fuga * vinv;
    temperatura += (25 + pot * 900 - temperatura) * dt * 0.25;
    if (!ventila) presion = Math.min(1.2, presion + dt * fuga * 40);
    if (presion >= 1) ventila = true;
    if (ventila) presion = Math.max(0, presion - dt * 0.5);
    if (rnd() < dt * Math.min(30, fuga * 2e4)) burbujas.push({ x: rnd(), y: 1, r: 2 + rnd() * 4 });
    for (const b of burbujas) b.y -= dt * 0.25;
    while (burbujas.length && burbujas[0]!.y < 0) burbujas.shift();
    if (muestreo.toca()) {
      serie = { t: [...serie.t, tiempo].slice(-300), i: [...serie.i, fuga].slice(-300) };
      estado = { i: fuga, T: temperatura, p: presion, ventila };
    }
  }

  function lata(v: Vista, cx: number, cy: number, w: number, h: number): void {
    const { ctx } = v;
    const p = pal;
    const abombado = modo === 'inverso' ? Math.min(1, presion) * 10 : 0;
    // Leads.
    ctx.fillStyle = p.estano;
    ctx.fillRect(cx - w * 0.22 - 2, cy + h / 2, 4, 54);
    ctx.fillRect(cx + w * 0.22 - 2, cy + h / 2, 4, 40);
    rr(ctx, cx - w / 2, cy - h / 2, w, h, 10);
    ctx.fillStyle = gradCilindroX(ctx, cx - w / 2, cx + w / 2, modo === 'polimero' ? '#5b2a6e' : '#20406e', p.oscuro);
    ctx.fill();
    // Negative stripe.
    ctx.fillStyle = alfa('#dfe6ef', 0.85);
    ctx.fillRect(cx + w / 2 - w * 0.3, cy - h / 2 + 6, w * 0.2, h - 12);
    for (let k = 0; k < 4; k++) txt(v, '−', cx + w / 2 - w * 0.2, cy - h / 2 + 30 + k * (h - 50) / 3, { tam: 16, peso: 800, color: '#20406e' });
    // Top with the vent scoring, bulging under pressure.
    ctx.fillStyle = mezcla(p.aluminio, '#ffffff', 0.25);
    ctx.beginPath();
    ctx.ellipse(cx, cy - h / 2, w / 2, 10, 0, Math.PI, 0);
    ctx.quadraticCurveTo(cx, cy - h / 2 - abombado * 2.2, cx - w / 2, cy - h / 2);
    ctx.fill();
    ctx.strokeStyle = alfa('#000000', 0.35);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cx - 12, cy - h / 2 - 2 - abombado);
    ctx.lineTo(cx + 12, cy - h / 2 - 2 - abombado);
    ctx.moveTo(cx, cy - h / 2 - 8 - abombado);
    ctx.lineTo(cx, cy - h / 2 + 4 - abombado);
    ctx.stroke();
    if (modo === 'inverso' && ventila) {
      for (let k = 0; k < 6; k++) brillo(ctx, cx + Math.sin(t * 3 + k) * 18, cy - h / 2 - 30 - k * 14 - ((t * 30) % 14), 22, p.oscuro ? '#aab' : '#888', 0.3);
      txt(v, '¡válvula abierta!', cx, cy - h / 2 - 110, { tam: 14, peso: 800, color: p.peligro });
    }
    if (modo === 'inverso' && temperatura > 40) brillo(ctx, cx, cy, w * 1.2, p.calor, Math.min(0.5, (temperatura - 40) / 120));
    txt(v, '+', cx - w * 0.22, cy + h / 2 + 70, { tam: 16, peso: 800, color: p.positivo });
    txt(v, '−', cx + w * 0.22, cy + h / 2 + 56, { tam: 16, peso: 800 });
  }

  function rollo(v: Vista, cx: number, cy: number, r: number): void {
    const { ctx } = v;
    const p = pal;
    // Spiral of two foils with paper in between (cross-section of the roll).
    const vueltas = 6;
    const dibujarEspiral = (desfase: number, color: string, ancho: number) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = ancho;
      ctx.beginPath();
      for (let k = 0; k <= 360; k++) {
        const a = (k / 360) * vueltas * Math.PI * 2;
        const rr2 = r * 0.12 + ((r * 0.86) * (a + desfase)) / (vueltas * Math.PI * 2);
        const x = cx + Math.cos(a) * rr2;
        const y = cy + Math.sin(a) * rr2;
        if (k === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    };
    circulo(ctx, cx, cy, r, mezcla(p.electrolito, p.fondo, 0.5));
    dibujarEspiral(0, mezcla('#d8dde2', '#ffffff', 0.2), 3);
    dibujarEspiral(Math.PI, '#7d858e', 3);
    circulo(ctx, cx, cy, r, undefined, p.aluminio, 3);
    txt(v, 'sección del rollo', cx, cy + r + 18, { tam: 12, color: p.suave });
  }

  function capas(v: Vista, x0: number, y0: number, w: number, h: number): void {
    const { ctx } = v;
    const p = pal;
    tarjeta(v, x0, y0, w, h, modo === 'tantalo' ? 'Ampliación: pastilla sinterizada' : 'Ampliación: las capas (micras)');
    const ix0 = x0 + 14;
    const ix1 = x0 + w - 14;
    const iy0 = y0 + 34;
    const iy1 = y0 + h - 34;
    if (modo === 'tantalo') {
      // Porous tantalum grains, each with a Ta₂O₅ skin, pores filled with MnO₂.
      ctx.fillStyle = mezcla('#2b2b2b', p.fondo, 0.15);
      ctx.fillRect(ix0, iy0, ix1 - ix0, iy1 - iy0);
      const r2 = 15;
      for (let gy = iy0 + r2; gy < iy1; gy += r2 * 1.7)
        for (let gx = ix0 + r2 + ((gy / (r2 * 1.7)) % 2) * r2 * 0.8; gx < ix1 - 6; gx += r2 * 1.9) {
          circulo(ctx, gx, gy, r2, mezcla('#7f8a99', '#ffffff', 0.15), '#e0c341', 3);
        }
      ctx.fillStyle = alfa(p.panel, 0.9);
      ctx.fillRect(ix0, iy1 - 2, ix1 - ix0, 28);
      txt(v, 'granos de Ta (ánodo, +) · Ta₂O₅ (amarillo, dieléctrico) · MnO₂ (cátodo)', (ix0 + ix1) / 2, iy1 + 12, { tam: 11.5, color: p.suave });
      return;
    }
    const wA = (ix1 - ix0) * 0.22;
    const wC = (ix1 - ix0) * 0.12;
    const xa = ix0 + wA;
    const xc = ix1 - wC;
    // Anode foil with etched tunnels.
    ctx.fillStyle = mezcla('#cfd5db', p.fondo, 0.1);
    ctx.fillRect(ix0, iy0, wA, iy1 - iy0);
    const ox = Math.max(2, Math.min(12, (modo === 'inverso' ? oxido : 1) * (espesor / 49e-9) * 8));
    // Electrolyte or polymer.
    ctx.fillStyle = modo === 'polimero' ? mezcla('#3a2a6b', p.fondo, 0.25) : mezcla(p.electrolito, p.fondo, 0.35);
    ctx.fillRect(xa, iy0, xc - xa, iy1 - iy0);
    // Paper fibres.
    if (modo !== 'polimero') {
      ctx.strokeStyle = alfa('#a88a52', 0.45);
      ctx.lineWidth = 1;
      for (let k = 0; k < 14; k++) {
        const x = xa + 30 + ((xc - xa - 40) * k) / 14;
        ctx.beginPath();
        ctx.moveTo(x, iy0);
        ctx.bezierCurveTo(x + 10, iy0 + (iy1 - iy0) * 0.3, x - 10, iy0 + (iy1 - iy0) * 0.7, x + 4, iy1);
        ctx.stroke();
      }
    }
    // Tunnels (etching multiplies the area) with the oxide lining.
    const tun = 6;
    for (let k = 0; k < tun; k++) {
      const y = iy0 + ((iy1 - iy0) * (k + 0.5)) / tun;
      ctx.fillStyle = modo === 'polimero' ? mezcla('#3a2a6b', p.fondo, 0.25) : mezcla(p.electrolito, p.fondo, 0.35);
      ctx.fillRect(xa - wA * 0.55, y - 5, wA * 0.55, 10);
      ctx.strokeStyle = '#e0c341';
      ctx.lineWidth = ox * 0.6;
      ctx.strokeRect(xa - wA * 0.55, y - 5, wA * 0.55 + 2, 10);
    }
    ctx.fillStyle = '#e0c341';
    ctx.fillRect(xa - ox / 2, iy0, ox, iy1 - iy0);
    // Cathode foil.
    ctx.fillStyle = '#8b939c';
    ctx.fillRect(xc, iy0, wC, iy1 - iy0);
    // Ions / charges.
    const pol = modo === 'inverso' ? -1 : 1;
    for (const io of iones) {
      const libre = Math.sin(t * 2 + io.f) * 4;
      let x = xa + 10 + io.u * (xc - xa - 20);
      // Anions gather on the oxide when the anode is positive.
      if (io.s < 0 && pol > 0 && io.w < 0.6) x = xa + ox + 6 + io.u * 10;
      const y = iy0 + 6 + io.w * (iy1 - iy0 - 12) + libre;
      circulo(ctx, x, y, 3.4, io.s > 0 ? alfa(p.hueco, 0.8) : alfa('#21a09a', 0.85));
    }
    if (pol > 0)
      for (let k = 0; k < 9; k++) txt(v, '+', xa - ox - 8, iy0 + 12 + ((iy1 - iy0 - 24) * k) / 8, { tam: 11, peso: 800, color: p.positivo });
    for (const b of burbujas) circulo(ctx, xa + 20 + b.x * (xc - xa - 40), iy0 + b.y * (iy1 - iy0), b.r, alfa('#ffffff', 0.5), alfa(p.suave, 0.6), 1);
    // Labels.
    txt(v, 'ánodo Al', ix0 + wA / 2 - 8, iy1 + 14, { tam: 11.5, color: p.suave });
    txt(v, 'óxido (dieléctrico)', xa + 8, iy0 + 12, { tam: 11.5, color: '#9a7b0c', peso: 800, alin: 'left', fondo: alfa(p.panel, 0.85) });
    txt(v, modo === 'polimero' ? 'polímero conductor' : 'electrolito + papel', (xa + xc) / 2, iy1 + 14, { tam: 11.5, color: p.suave });
    txt(v, 'cátodo', xc + wC / 2, iy1 + 14, { tam: 11.5, color: p.suave });
  }

  function dibujar(v: Vista): void {
    void [modo, vf, vinv];
    fondo(v);
    const est = v.estrecho;
    const p = pal;
    if (modo === 'tantalo') {
      // Dipped tantalum bead with the + marking.
      const { ctx } = v;
      const cx = est ? v.w / 2 : 170;
      const cy = est ? 120 : 180;
      ctx.fillStyle = p.estano;
      ctx.fillRect(cx - 18, cy + 40, 4, 80);
      ctx.fillRect(cx + 14, cy + 40, 4, 80);
      ctx.beginPath();
      ctx.ellipse(cx, cy, 52, 62, 0, 0, Math.PI * 2);
      const g = ctx.createRadialGradient(cx - 18, cy - 22, 4, cx, cy, 70);
      g.addColorStop(0, '#f4c84a');
      g.addColorStop(1, '#b07b12');
      ctx.fillStyle = g;
      ctx.fill();
      txt(v, '+', cx - 22, cy - 18, { tam: 22, peso: 900, color: '#6b3d00' });
      txt(v, '22', cx + 6, cy + 2, { tam: 16, peso: 800, color: '#6b3d00' });
      txt(v, '16 V', cx + 6, cy + 22, { tam: 12, peso: 700, color: '#6b3d00' });
      txt(v, 'el tántalo marca el POSITIVO', cx, cy + 140, { tam: 12.5, peso: 700, color: p.positivo });
    } else {
      lata(v, est ? v.w * 0.27 : 100, est ? 140 : 180, est ? 96 : 104, est ? 170 : 200);
      rollo(v, est ? v.w * 0.72 : 305, est ? 140 : 180, est ? 84 : 92);
    }
    if (est) capas(v, 20, 300, v.w - 40, v.h - 320);
    else capas(v, 420, 30, v.w - 440, v.h - 60);
  }

  const texto = $derived.by(() => {
    if (modo === 'aluminio')
      return (
        `**Electrolítico de aluminio:** dos láminas enrolladas con papel empapado en electrolito. El dieléctrico es una capa de **óxido de aluminio** crecida electroquímicamente: unos 1,4 nm por voltio de formación, ${si(espesor, 'm', 2)} con ${num(vf, 0)} V. El ataque químico de la lámina multiplica su área, y por eso caben miles de microfaradios.\n` +
        'El cátodo de verdad es el **electrolito**; la segunda lámina solo lo conecta. De ahí la polaridad: el óxido solo existe sobre el ánodo.'
      );
    if (modo === 'inverso')
      return (
        `**Polaridad invertida (${num(vinv, 0)} V):** el óxido se disuelve, la fuga crece, el electrolito se calienta y genera gas. ${estado.ventila ? 'La presión ha abierto la **válvula** marcada en la tapa: el condensador está destruido.' : `Fuga ${si(estado.i, 'A', 2)}, ${num(estado.T, 0)} °C: la tapa empieza a abombarse.`}\n` +
        'Un electrolítico invertido puede reventar expulsando electrolito caliente: la banda con «−» marca el terminal negativo.'
      );
    if (modo === 'tantalo')
      return (
        '**Tántalo:** una pastilla sinterizada de polvo de tántalo (área enorme), cubierta de pentóxido de tántalo y rellena de dióxido de manganeso. Gran capacidad en poco volumen y buena estabilidad.\n' +
        'Pero falla **en cortocircuito** y a menudo de forma incendiaria, y no tolera sobretensiones ni picos de irrupción: se usa a la mitad de su tensión nominal. Ojo: la marca indica el positivo.'
      );
    return (
      '**Polímero conductor:** el electrolito líquido se sustituye por un polímero sólido conductor. La ESR baja a 5–20 mΩ, no se seca con los años y su fallo es benigno.\n' +
      'Es el sustituto moderno de los electrolíticos en las salidas de las fuentes conmutadas, donde la ESR manda más que la capacidad.'
    );
  });

  const lecturas = $derived(
    modo === 'inverso'
      ? [
          { e: 'Fuga', v: si(estado.i, 'A', 2), c: pal.peligro },
          { e: 'Temperatura', v: `${num(estado.T, 0)} °C` },
          { e: 'Presión interna', v: estado.ventila ? 'válvula abierta' : `${num(estado.p * 100, 0)} %` },
        ]
      : modo === 'tantalo'
        ? [
            { e: 'Derating de tensión', v: '50 %' },
            { e: 'Modo de fallo', v: 'cortocircuito', c: pal.peligro },
          ]
        : [
            { e: 'Espesor del óxido', v: si(espesor, 'm', 2), c: pal.acento },
            { e: 'ESR típica', v: modo === 'polimero' ? '5 – 20 mΩ' : '0,5 – 2 Ω' },
            { e: 'Vida', v: modo === 'polimero' ? 'sin secado' : 'mitad cada +10 °C' },
          ],
  );
</script>

<Marco {reloj} {texto} {lecturas} leyenda={['calor']}>
  {#snippet modos()}
    <Selector
      bind:valor={modo}
      opciones={[
        { valor: 'aluminio', texto: 'Aluminio' },
        { valor: 'inverso', texto: 'Al revés' },
        { valor: 'tantalo', texto: 'Tántalo' },
        { valor: 'polimero', texto: 'Polímero' },
      ]}
    />
  {/snippet}
  {#snippet escena()}
    <Escena {reloj} {paso} {dibujar} dims={(a) => (a < 560 ? [560, 620] : [900, 420])} etiqueta="Condensador electrolítico por dentro" />
  {/snippet}
  {#snippet controles()}
    {#if modo === 'aluminio' || modo === 'polimero'}
      <Deslizador etiqueta="Tensión de formación del óxido" bind:valor={vf} min={6} max={450} paso={1} unidad="V" formato={(x) => `${num(x, 0)} V`} />
    {:else if modo === 'inverso'}
      <Deslizador etiqueta="Tensión inversa aplicada" bind:valor={vinv} min={1} max={16} paso={0.5} unidad="V" />
      <p class="nota">Pulse «Reiniciar» para empezar con un condensador nuevo.</p>
    {/if}
  {/snippet}
  {#snippet grafica()}
    {#if modo === 'inverso'}
      <Grafica
        titulo="Corriente de fuga con la polaridad invertida"
        x={{ etiqueta: 't', unidad: 's', min: 0, max: Math.max(10, serie.t[serie.t.length - 1] ?? 10) }}
        y={{ etiqueta: 'I_fuga', unidad: 'A', min: 1e-7, max: 1, log: true }}
        series={[{ x: serie.t, y: serie.i, color: pal.peligro }]}
      />
    {/if}
  {/snippet}
</Marco>

<style>
  .nota {
    margin: 0;
    font-size: 13px;
    color: var(--tinta-suave);
  }
</style>
