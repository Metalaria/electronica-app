<script lang="ts">
  // How resistors are built (book 2.2): carbon film and metal film with their helical trim, wirewound,
  // and SMD thick film, drawn in cut-away with the electrons following the resistive path.
  import Escena from '../ui/Escena.svelte';
  import Marco from '../ui/Marco.svelte';
  import Deslizador from '../ui/Deslizador.svelte';
  import Selector from '../ui/Selector.svelte';
  import Interruptor from '../ui/Interruptor.svelte';
  import { Reloj } from '../nucleo/reloj.svelte';
  import { txt, fondo, etiqueta, gradCilindro, gradCilindroX, rr, electrones, brillo, type Vista } from '../nucleo/dibujo';
  import { pata } from '../nucleo/piezas';
  import { alfa, mezcla, paleta } from '../nucleo/paleta';
  import { si, num } from '../nucleo/formato';
  import { COLORES, bandasDe, indiceMultiplicador } from '../nucleo/fisica';
  import { app } from '../../../lib/estado.svelte';

  type Tipo = 'carbon' | 'metal' | 'bobinada' | 'smd';
  const reloj = new Reloj();
  const pal = $derived(paleta(app.tema));

  let tipo = $state<Tipo>('carbon');
  let corte = $state(0.55);
  let vueltas = $state(6);
  let campo = $state(true);

  // Resistance of the trimmed film: path length N·π·D, width L/N → N²·π·D/L squares of the film.
  const D = 2.3e-3;
  const LONG = 6e-3;
  const rCuadro = $derived(tipo === 'metal' ? 50 : 100);
  const cuadros = $derived((vueltas * vueltas * Math.PI * D) / LONG);
  const rValor = $derived(rCuadro * cuadros);

  const DATOS: Record<Tipo, { tol: string; tcr: string; pot: string; ruido: string }> = {
    carbon: { tol: '±5 %', tcr: '±250 ppm/°C', pot: '0,25 – 2 W', ruido: 'moderado' },
    metal: { tol: '±0,1 – 1 %', tcr: '±50 – 100 ppm/°C', pot: '0,125 – 1 W', ruido: 'muy bajo' },
    bobinada: { tol: '±0,1 – 5 %', tcr: '±20 ppm/°C', pot: '1 W – kW', ruido: 'muy bajo' },
    smd: { tol: '±1 – 5 %', tcr: '±100 – 200 ppm/°C', pot: '0,063 – 0,25 W', ruido: 'moderado' },
  };

  let t = 0;
  function paso(dt: number): void {
    t += dt;
  }

  function bandas(valor: number, cinco: boolean): string[] {
    const b = bandasDe(valor, cinco ? 3 : 2);
    if (!b) return [];
    const cs = b.digitos.map((d) => COLORES[d]!.color);
    cs.push(COLORES[indiceMultiplicador(b.mult)]!.color);
    cs.push(cinco ? COLORES[1]!.color : COLORES[10]!.color);
    return cs;
  }

  // ------------------------------------------------------------------ axial film resistor

  function axial(v: Vista, metal: boolean): void {
    const { ctx } = v;
    const p = pal;
    const est = v.estrecho;
    const yc = est ? 240 : 200;
    const R = est ? 68 : 78;
    const xa = v.w * 0.2;
    const xb = v.w * 0.8;
    const capW = (xb - xa) * 0.13;
    const xc0 = xa + capW * 0.6;
    const xc1 = xb - capW * 0.6;
    const rCore = R * 0.74;
    const rFilm = R * 0.78;
    const cutX = xa + (xb - xa) * corte;

    pata(ctx, 14, xa + 8, yc, 7, p);
    pata(ctx, xb - 8, v.w - 14, yc, 7, p);

    // Ceramic core.
    ctx.fillStyle = gradCilindro(ctx, yc - rCore, yc + rCore, p.ceramica, p.oscuro);
    ctx.fillRect(xc0, yc - rCore, xc1 - xc0, 2 * rCore);
    // Film with the helical groove.
    const film = metal ? p.peliculaMetal : p.carbon;
    const fx0 = xa + capW * 0.9;
    const fx1 = xb - capW * 0.9;
    ctx.save();
    ctx.beginPath();
    ctx.rect(fx0, yc - rFilm - 1, fx1 - fx0, 2 * rFilm + 2);
    ctx.clip();
    ctx.fillStyle = gradCilindro(ctx, yc - rFilm, yc + rFilm, film, p.oscuro);
    ctx.fillRect(fx0, yc - rFilm, fx1 - fx0, 2 * rFilm);
    if (metal) {
      // Metallic sheen.
      const g = ctx.createLinearGradient(fx0, 0, fx1, 0);
      for (let k = 0; k <= 8; k++) g.addColorStop(k / 8, `rgba(255,255,255,${k % 2 ? 0.12 : 0})`);
      ctx.fillStyle = g;
      ctx.fillRect(fx0, yc - rFilm, fx1 - fx0, 2 * rFilm);
    }
    const paso = (fx1 - fx0) / vueltas;
    ctx.strokeStyle = gradCilindro(ctx, yc - rFilm, yc + rFilm, p.ceramica, p.oscuro);
    ctx.lineWidth = Math.max(3, paso * 0.16);
    ctx.lineCap = 'butt';
    for (let k = -1; k <= vueltas + 1; k++) {
      ctx.beginPath();
      for (let j = 0; j <= 20; j++) {
        const th = -Math.PI / 2 + (Math.PI * j) / 20;
        const x = fx0 + k * paso + (paso * (th + Math.PI / 2)) / (2 * Math.PI);
        const y = yc + rFilm * Math.sin(th);
        if (j === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    // Electrons along the film strip (front half only), drifting from right to left.
    const pts: { x: number; y: number }[] = [];
    const nPorVuelta = 9;
    const total = vueltas * nPorVuelta;
    for (let i = 0; i < total; i++) {
      const u = (((i / nPorVuelta - t * 0.55) % vueltas) + vueltas) % vueltas;
      const th = ((u % 1) * 2 * Math.PI) - Math.PI;
      if (Math.cos(th) < 0.05) continue;
      const x = fx0 + u * paso + paso * 0.5;
      const y = yc + rFilm * Math.sin(th);
      if (x < cutX - 4) pts.push({ x, y });
    }
    electrones(ctx, pts, 3.4, p);
    ctx.restore();

    // End caps.
    for (const [x0, x1] of [
      [xa, xa + capW],
      [xb - capW, xb],
    ] as const) {
      rr(ctx, x0, yc - R * 0.86, x1 - x0, R * 1.72, 6);
      ctx.fillStyle = gradCilindro(ctx, yc - R * 0.86, yc + R * 0.86, p.estano, p.oscuro);
      ctx.fill();
    }

    // Lacquer coating with the colour bands, removed left of the cut.
    const laca = metal ? p.lacaAzul : p.laca;
    if (cutX < xb) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(cutX, yc - R - 4, xb - cutX + 4, 2 * R + 8);
      ctx.clip();
      rr(ctx, xa - 2, yc - R, xb - xa + 4, 2 * R, R * 0.9);
      ctx.fillStyle = gradCilindro(ctx, yc - R, yc + R, laca, p.oscuro);
      ctx.fill();
      const cs = metal ? bandas(rValor, true) : bandas(rValor, false);
      const pos = metal ? [0.2, 0.31, 0.42, 0.53, 0.78] : [0.22, 0.34, 0.46, 0.76];
      cs.forEach((c, i) => {
        const x = xa + (xb - xa) * pos[i]!;
        ctx.fillStyle = gradCilindro(ctx, yc - R, yc + R, c, p.oscuro);
        ctx.fillRect(x - 7, yc - R, 14, 2 * R);
      });
      // Cut edge.
      ctx.fillStyle = mezcla(laca, '#000000', 0.25);
      ctx.beginPath();
      ctx.ellipse(cutX, yc, 6, R, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Labels.
    const yA = yc - R - (est ? 44 : 40);
    const yB = yc + R + (est ? 40 : 36);
    etiqueta(v, metal ? 'película de NiCr' : 'película de carbón', fx0 + paso * 0.6 - 16, yA, fx0 + paso * 0.6, yc - rFilm * 0.6, { alin: 'right' });
    etiqueta(v, 'corte helicoidal', fx0 + paso * 2.2 + 16, yA, fx0 + paso * 2.2, yc - rFilm * 0.3, { alin: 'left' });
    etiqueta(v, 'núcleo cerámico', fx0 + paso * 1.25 + 20, yB, fx0 + paso * 1.25, yc + rFilm * 0.7, { alin: 'left' });
    etiqueta(v, 'casquillo', xa + capW * 0.5 - 10, yB, xa + capW * 0.5, yc + R * 0.7, { alin: 'right' });
    if (cutX < xb - 40) etiqueta(v, metal ? 'laca (azul: película metálica)' : 'laca protectora', Math.min(xb - 10, cutX + 70), yB + (est ? 30 : 0), Math.min(xb - 20, cutX + 50), yc + R * 0.8, { alin: est ? 'right' : 'left' });
    txt(v, `R = ${si(rValor, 'Ω', 3)} con ${vueltas} vueltas`, v.w / 2, v.h - 26, {
      tam: 15,
      peso: 700,
      color: p.acento,
      fondo: alfa(p.acento, 0.1),
    });
  }

  // ------------------------------------------------------------------ wirewound

  function bobinada(v: Vista): void {
    const { ctx } = v;
    const p = pal;
    const est = v.estrecho;
    const yc = est ? 250 : 210;
    const R = est ? 66 : 64;
    const xa = v.w * 0.18;
    const xb = v.w * 0.82;
    const rCore = R * 0.7;
    const nv = 16;
    const cutX = xa + (xb - xa) * corte;
    pata(ctx, 14, xa + 10, yc, 8, p);
    pata(ctx, xb - 10, v.w - 14, yc, 8, p);
    // Magnetic field of the winding (parasitic inductance).
    if (campo) {
      ctx.save();
      ctx.strokeStyle = alfa(p.campoB, 0.5);
      ctx.lineWidth = 1.6;
      ctx.setLineDash([6, 5]);
      ctx.lineDashOffset = -t * 30;
      for (let k = 1; k <= 3; k++) {
        const ry = R + 18 * k;
        ctx.beginPath();
        ctx.ellipse((xa + xb) / 2, yc, (xb - xa) / 2 + 20 * k, ry, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
    }
    ctx.fillStyle = gradCilindro(ctx, yc - rCore, yc + rCore, p.ceramica, p.oscuro);
    ctx.fillRect(xa + 20, yc - rCore, xb - xa - 40, 2 * rCore);
    // Wire turns (front half).
    const x0 = xa + 34;
    const x1 = xb - 34;
    const paso = (x1 - x0) / nv;
    for (let k = 0; k < nv; k++) {
      ctx.beginPath();
      for (let j = 0; j <= 18; j++) {
        const th = -Math.PI / 2 + (Math.PI * j) / 18;
        const x = x0 + k * paso + (paso * (th + Math.PI / 2)) / (2 * Math.PI);
        const y = yc + (rCore + 3) * Math.sin(th);
        if (j === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = mezcla(p.cobre, '#8d8d8d', 0.55);
      ctx.lineWidth = 6;
      ctx.lineCap = 'round';
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.lineWidth = 1.6;
      ctx.stroke();
    }
    const pts: { x: number; y: number }[] = [];
    for (let i = 0; i < nv * 4; i++) {
      const u = (((i / 4 - t * 1.1) % nv) + nv) % nv;
      const th = ((u % 1) * 2 * Math.PI) - Math.PI;
      if (Math.cos(th) < 0.1) continue;
      const x = x0 + u * paso + paso * 0.5;
      if (x < cutX) pts.push({ x, y: yc + (rCore + 3) * Math.sin(th) });
    }
    electrones(ctx, pts, 3.2, p);
    // Caps and vitreous enamel coating, cut away.
    for (const [c0, c1] of [
      [xa, xa + 26],
      [xb - 26, xb],
    ] as const) {
      rr(ctx, c0, yc - R * 0.92, c1 - c0, R * 1.84, 5);
      ctx.fillStyle = gradCilindro(ctx, yc - R, yc + R, p.estano, p.oscuro);
      ctx.fill();
    }
    if (cutX < xb) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(cutX, yc - R - 2, xb - cutX, 2 * R + 4);
      ctx.clip();
      rr(ctx, xa + 22, yc - R, xb - xa - 44, 2 * R, 18);
      ctx.fillStyle = gradCilindro(ctx, yc - R, yc + R, '#3f7f5a', p.oscuro);
      ctx.fill();
      txt(v, '5 W 10 Ω', Math.max(cutX + 50, (xa + xb) / 2 + 60), yc, { tam: 15, peso: 700, color: 'rgba(255,255,255,0.85)' });
      ctx.restore();
    }
    const yA = yc - R - (est ? 70 : 50);
    etiqueta(v, 'hilo resistivo (nicromo)', x0 + paso * 2.5, yA, x0 + paso * 2.3, yc - rCore * 0.7);
    etiqueta(v, 'núcleo cerámico', x0 + paso * 1, yc + R + (est ? 64 : 50), x0 + paso * 1.2, yc + rCore * 0.5);
    if (cutX < xb - 60) etiqueta(v, 'esmalte vítreo', Math.min(v.w - 30, cutX + 110), yA + (est ? 34 : 0), Math.min(xb - 40, cutX + 50), yc - R * 0.7);
    if (campo) txt(v, 'campo magnético del bobinado → inductancia parásita', v.w / 2, v.h - 22, { tam: 13, peso: 700, color: p.campoB });
  }

  // ------------------------------------------------------------------ SMD thick film

  function smd(v: Vista): void {
    const { ctx } = v;
    const p = pal;
    const est = v.estrecho;
    const w = v.w;
    // Top view (laser-trimmed film) and cross-section.
    const tx0 = w * 0.2;
    const tx1 = w * 0.8;
    const ty0 = est ? 70 : 50;
    const ty1 = ty0 + (est ? 170 : 140);
    txt(v, 'Vista superior (sin el recubrimiento)', tx0, ty0 - 16, { tam: 13, alin: 'left', color: p.suave, peso: 700 });
    rr(ctx, tx0, ty0, tx1 - tx0, ty1 - ty0, 4);
    ctx.fillStyle = p.ceramica;
    ctx.fill();
    // Terminations.
    for (const [a, b] of [
      [tx0, tx0 + (tx1 - tx0) * 0.16],
      [tx1 - (tx1 - tx0) * 0.16, tx1],
    ] as const) {
      ctx.fillStyle = gradCilindroX(ctx, a, b, p.estano, p.oscuro);
      ctx.fillRect(a, ty0, b - a, ty1 - ty0);
    }
    const fx0 = tx0 + (tx1 - tx0) * 0.12;
    const fx1 = tx1 - (tx1 - tx0) * 0.12;
    const fy0 = ty0 + 14;
    const fy1 = ty1 - 14;
    ctx.fillStyle = mezcla(p.carbon, '#1f2a1f', 0.2);
    ctx.fillRect(fx0, fy0, fx1 - fx0, fy1 - fy0);
    // L-cut by the laser.
    const cx = fx0 + (fx1 - fx0) * 0.55;
    const cy = fy0 + (fy1 - fy0) * (0.35 + 0.4 * corte);
    ctx.fillStyle = p.ceramica;
    ctx.fillRect(cx - 3, cy, 6, fy1 - cy);
    ctx.fillRect(cx - 3, cy - 3, (fx1 - fx0) * 0.18, 6);
    brillo(ctx, cx + (fx1 - fx0) * 0.18, cy, 12, '#ff3b1f', 0.5 + 0.3 * Math.sin(t * 9));
    // Electrons following streamlines that squeeze over the cut.
    const pts: { x: number; y: number }[] = [];
    const lineas = 7;
    for (let l = 0; l < lineas; l++) {
      const y0 = fy0 + ((l + 0.5) * (fy1 - fy0)) / lineas;
      const yPaso = fy0 + ((l + 0.5) * (cy - fy0 - 4)) / lineas;
      for (let k = 0; k < 9; k++) {
        const u = (((k / 9 - t * 0.22) % 1) + 1) % 1;
        const x = fx0 + u * (fx1 - fx0);
        const d = (x - cx) / ((fx1 - fx0) * 0.22);
        const peso = Math.exp(-d * d);
        pts.push({ x, y: y0 + (yPaso - y0) * peso });
      }
    }
    electrones(ctx, pts, 3, p);
    etiqueta(v, 'corte láser en L', cx + 40, ty1 + (est ? 22 : 18), cx, Math.min(fy1 - 4, cy + 20), { alin: 'left' });
    etiqueta(v, 'capa gruesa (RuO₂)', fx0 + 10, ty0 - (est ? 40 : 16), fx0 + 30, fy0 + 10, { alin: 'left' });

    // Cross-section.
    const sx0 = w * 0.16;
    const sx1 = w * 0.84;
    const sy = ty1 + (est ? 110 : 96);
    const h = est ? 120 : 96;
    txt(v, 'Sección', sx0, sy - 18, { tam: 13, alin: 'left', color: p.suave, peso: 700 });
    const sub0 = sy + h * 0.42;
    const sub1 = sy + h;
    const wTerm = (sx1 - sx0) * 0.12;
    ctx.fillStyle = gradCilindro(ctx, sub0, sub1, p.ceramica, p.oscuro);
    ctx.fillRect(sx0 + wTerm * 0.3, sub0, sx1 - sx0 - wTerm * 0.6, sub1 - sub0);
    ctx.fillStyle = p.carbon;
    ctx.fillRect(sx0 + wTerm * 0.6, sub0 - h * 0.1, sx1 - sx0 - wTerm * 1.2, h * 0.1);
    ctx.fillStyle = mezcla('#22442e', p.fondo, p.oscuro ? 0.1 : 0);
    rr(ctx, sx0 + wTerm * 1.1, sub0 - h * 0.34, sx1 - sx0 - wTerm * 2.2, h * 0.25, 6);
    ctx.fill();
    txt(v, '822', (sx0 + sx1) / 2, sub0 - h * 0.21, { tam: 14, peso: 700, color: '#e8efe6' });
    for (const lado of [0, 1]) {
      const x0 = lado ? sx1 - wTerm : sx0;
      const capas: [string, number][] = [
        ['#c9cdd2', 0],
        ['#8f969e', 0.25],
        ['#dfe3e6', 0.5],
      ];
      for (const [c, k] of capas.reverse()) {
        const ins = k * 6;
        rr(ctx, x0 + (lado ? 0 : ins), sub0 - h * 0.16 + ins, wTerm - ins, h * 0.76 - ins * 2, 4);
        ctx.fillStyle = c;
        ctx.fill();
      }
    }
    etiqueta(v, 'sustrato de alúmina', sx0 + wTerm * 2, sub1 + (est ? 30 : 22), sx0 + wTerm * 2.4, sub1 - h * 0.2, { alin: 'left' });
    etiqueta(v, 'vidrio + epoxi', (sx0 + sx1) / 2 + 60, sy - (est ? 26 : 14), (sx0 + sx1) / 2 + 40, sub0 - h * 0.3, { alin: 'left' });
    etiqueta(v, 'terminación Ag / Ni / Sn', sx1 - wTerm, sub1 + (est ? 30 : 22), sx1 - wTerm * 0.4, sub1 - h * 0.3, { alin: 'right' });
  }

  function dibujar(v: Vista): void {
    void [tipo, corte, vueltas, campo];
    fondo(v);
    if (tipo === 'carbon' || tipo === 'metal') axial(v, tipo === 'metal');
    else if (tipo === 'bobinada') bobinada(v);
    else smd(v);
  }

  const texto = $derived.by(() => {
    if (tipo === 'carbon')
      return (
        '**Película de carbón:** una fina capa de carbón depositada sobre un cilindro cerámico. El valor se ajusta con un **corte helicoidal** que convierte la película en una cinta larga y estrecha: con N vueltas, el camino tiene unos N²·π·D/L cuadros.\n' +
        `Con ${vueltas} vueltas y 100 Ω por cuadro salen ${si(rValor, 'Ω', 3)}. Tolerancia típica ±5 % y TCR de ±250 ppm/°C: la resistencia «de uso general».`
      );
    if (tipo === 'metal')
      return (
        '**Película metálica:** la misma construcción con una aleación de níquel-cromo. Tolerancia de ±0,1 a ±1 %, TCR de ±50 a ±100 ppm/°C y muy poco ruido de exceso.\n' +
        'Se reconoce por el cuerpo azul claro y las **cinco bandas**; es la obligada en las entradas de amplificadores de bajo ruido.'
      );
    if (tipo === 'bobinada')
      return (
        '**Bobinada:** un hilo resistivo (nicromo, 64 veces más resistivo que el cobre) enrollado sobre un núcleo cerámico y cubierto de esmalte. Soporta de 1 W a varios kilovatios con excelente estabilidad (±20 ppm/°C).\n' +
        'Su precio es la **inductancia del bobinado**: cada espira suma su campo, y por eso no sirve en alta frecuencia.'
      );
    return (
      '**SMD de capa gruesa:** una pasta de óxido de rutenio serigrafiada sobre alúmina y cocida; un **láser** recorta la capa en L hasta que la resistencia medida llega al valor, y los electrones tienen que rodear el corte.\n' +
      'El código del tamaño da las dimensiones en centésimas de pulgada (0805 = 0,08 × 0,05″); el marcado «822» es 82 × 10² Ω = 8,2 kΩ.'
    );
  });

  const lecturas = $derived([
    { e: 'Tolerancia', v: DATOS[tipo].tol },
    { e: 'Coeficiente de temperatura', v: DATOS[tipo].tcr },
    { e: 'Potencia habitual', v: DATOS[tipo].pot },
    { e: 'Ruido de exceso', v: DATOS[tipo].ruido },
    ...(tipo === 'carbon' || tipo === 'metal'
      ? [
          { e: 'Cuadros del camino', v: num(cuadros, 1) },
          { e: 'Resistencia', v: si(rValor, 'Ω', 3), c: pal.acento },
        ]
      : []),
  ]);
</script>

<Marco {reloj} {texto} {lecturas} leyenda={['electron']}>
  {#snippet modos()}
    <Selector
      bind:valor={tipo}
      opciones={[
        { valor: 'carbon', texto: 'Película de carbón' },
        { valor: 'metal', texto: 'Película metálica' },
        { valor: 'bobinada', texto: 'Bobinada' },
        { valor: 'smd', texto: 'SMD capa gruesa' },
      ]}
    />
  {/snippet}
  {#snippet escena()}
    <Escena {reloj} {paso} {dibujar} dims={(a) => (a < 560 ? [560, 560] : [900, 440])} etiqueta="Construcción de una resistencia en corte" />
  {/snippet}
  {#snippet controles()}
    <Deslizador etiqueta={tipo === 'smd' ? 'Profundidad del corte láser' : 'Retirar el recubrimiento'} bind:valor={corte} min={0} max={1} paso={0.01} formato={(x) => `${Math.round(x * 100)} %`} />
    {#if tipo === 'carbon' || tipo === 'metal'}
      <Deslizador etiqueta="Vueltas del corte helicoidal" bind:valor={vueltas} min={2} max={12} paso={1} formato={(x) => String(x)} />
    {/if}
    {#if tipo === 'bobinada'}
      <Interruptor etiqueta="Mostrar el campo magnético" bind:valor={campo} />
    {/if}
  {/snippet}
</Marco>
