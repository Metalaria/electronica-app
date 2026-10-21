<script lang="ts">
  // Piezoelectricity and the quartz resonator (book 19.11, 27.3, 19.3, 19.5): squeezing quartz shifts its
  // positive (Si) and negative (O) charge centres apart and a voltage appears; a voltage deforms it. A thin
  // plate vibrates at a frequency set by its size; electrically it is L₁–C₁–R₁ in series with C₀ in
  // parallel: series resonance f_s, parallel resonance f_p just above, and a Q of tens of thousands.
  import Escena from '../ui/Escena.svelte';
  import Marco from '../ui/Marco.svelte';
  import Deslizador from '../ui/Deslizador.svelte';
  import Selector from '../ui/Selector.svelte';
  import Grafica from '../ui/Grafica.svelte';
  import { Reloj } from '../nucleo/reloj.svelte';
  import { txt, txtRico, fondo, rr, flecha, circulo, brillo, gradCilindro, type Vista } from '../nucleo/dibujo';
  import { hilo, bobina, condensador, resistencia, nodo } from '../nucleo/esquema';
  import { alfa, mezcla, paleta } from '../nucleo/paleta';
  import { si, num } from '../nucleo/formato';
  import { app } from '../../../lib/estado.svelte';

  const reloj = new Reloj();
  const pal = $derived(paleta(app.tema));
  let modo = $state<'piezo' | 'resonador'>('piezo');
  let fuerza = $state(0.6);
  let df = $state(0);

  // 16 MHz crystal model.
  const L1 = 19.8e-3;
  const C1 = 5e-15;
  const R1 = 30;
  const C0 = 3e-12;
  const FS = 1 / (2 * Math.PI * Math.sqrt(L1 * C1));
  const FP = FS * Math.sqrt(1 + C1 / C0);
  const Q = (2 * Math.PI * FS * L1) / R1;
  function zDe(f: number): number {
    const w = 2 * Math.PI * f;
    // Series branch Z1 = R1 + j(wL1 − 1/(wC1)); in parallel with 1/(jwC0).
    const a = R1;
    const b = w * L1 - 1 / (w * C1);
    const c = -1 / (w * C0);
    // Z = Z1·Zc/(Z1 + Zc), Zc = jc.
    const nr = -b * c;
    const ni = a * c;
    const dr = a;
    const di = b + c;
    const d2 = dr * dr + di * di;
    return Math.hypot((nr * dr + ni * di) / d2, (ni * dr - nr * di) / d2);
  }
  const f = $derived(FS + df);
  const Z = $derived(zDe(f));
  const amplitud = $derived(Math.min(1, 1 / Math.sqrt(1 + Math.pow((2 * Q * df) / FS, 2))));

  let t = 0;
  function paso(dt: number): void {
    t += dt;
  }

  function piezo(v: Vista): void {
    const { ctx } = v;
    const p = pal;
    const est = v.estrecho;
    const cx = est ? v.w / 2 : 260;
    const cy = est ? 190 : 200;
    const s = fuerza * (reloj.play ? 0.6 + 0.4 * Math.sin(t * 2.5) : 1);
    // Hexagonal cell: Si (+) and O (−) alternating on a hexagon; compression along y.
    const R = 90;
    const pts: { x: number; y: number; q: number }[] = [];
    for (let k = 0; k < 6; k++) {
      const a = (Math.PI / 3) * k + Math.PI / 6;
      // Compression pushes the atoms on the axis inwards more than the others: the charge centres separate.
      const eje = Math.abs(Math.sin(a)) > 0.99;
      const ry = eje ? 1 - 0.3 * s : 1 - 0.08 * s;
      pts.push({ x: cx + Math.cos(a) * R * (1 + 0.1 * s), y: cy + Math.sin(a) * R * ry, q: k % 2 ? -1 : 1 });
    }
    ctx.strokeStyle = alfa(p.suave, 0.5);
    ctx.lineWidth = 2;
    ctx.beginPath();
    pts.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)));
    ctx.closePath();
    ctx.stroke();
    for (const q of pts) {
      circulo(ctx, q.x, q.y, q.q > 0 ? 16 : 20, q.q > 0 ? mezcla(p.hueco, '#ffffff', 0.3) : mezcla(p.electron, '#ffffff', 0.3), alfa(p.tinta, 0.4), 1);
      txt(v, q.q > 0 ? 'Si⁺' : 'O⁻', q.x, q.y, { tam: 11.5, peso: 800, color: '#ffffff' });
    }
    // Charge centres.
    const cp = pts.filter((q) => q.q > 0).reduce((a, q) => ({ x: a.x + q.x / 3, y: a.y + q.y / 3 }), { x: 0, y: 0 });
    const cn = pts.filter((q) => q.q < 0).reduce((a, q) => ({ x: a.x + q.x / 3, y: a.y + q.y / 3 }), { x: 0, y: 0 });
    circulo(ctx, cp.x, cp.y, 6, p.positivo);
    circulo(ctx, cn.x, cn.y, 6, p.electron);
    if (Math.abs(s) > 0.05) flecha(ctx, cn.x, cn.y, cp.x, cp.y, p.campoE, 2, 8);
    // Electrodes top and bottom, and force arrows.
    const yTop = cy - R * (1 - 0.28 * s) - 30;
    const yBot = cy + R * (1 - 0.28 * s) + 30;
    for (const y of [yTop, yBot]) {
      ctx.fillStyle = gradCilindro(ctx, y - 6, y + 6, p.estano, p.oscuro);
      ctx.fillRect(cx - 120, y - 6, 240, 12);
    }
    if (s > 0.05) {
      flecha(ctx, cx, yTop - 60, cx, yTop - 12, p.tinta, 3, 12);
      flecha(ctx, cx, yBot + 60, cx, yBot + 12, p.tinta, 3, 12);
      txt(v, 'presión', cx + 14, yTop - 44, { tam: 12.5, alin: 'left', peso: 700 });
    }
    // Induced voltage between the electrodes.
    const vq = s * 2.4;
    const nq = Math.round(Math.abs(vq) * 6);
    for (let i = 0; i < nq; i++) {
      const x = cx - 100 + (200 * (i + 0.5)) / nq;
      txt(v, vq > 0 ? '+' : '−', x, yTop + 14, { tam: 12, peso: 900, color: vq > 0 ? p.positivo : p.electron });
      txt(v, vq > 0 ? '−' : '+', x, yBot - 14, { tam: 12, peso: 900, color: vq > 0 ? p.electron : p.positivo });
    }
    const xv = cx + 170;
    hilo(v, [
      [cx + 120, yTop],
      [xv, yTop],
      [xv, cy - 26],
    ]);
    hilo(v, [
      [cx + 120, yBot],
      [xv, yBot],
      [xv, cy + 26],
    ]);
    rr(ctx, xv - 34, cy - 26, 68, 52, 10);
    ctx.fillStyle = p.panel;
    ctx.fill();
    ctx.strokeStyle = p.tinta;
    ctx.stroke();
    txt(v, `${num(vq, 2)} V`, xv, cy, { tam: 15, peso: 800, color: p.acento });
    if (!est) {
      txt(v, 'Efecto directo: deformar → tensión', 540, 120, { tam: 14, peso: 800, alin: 'left' });
      txt(v, 'Efecto inverso: tensión → deformación', 540, 146, { tam: 14, peso: 800, alin: 'left', color: p.suave });
      txt(v, 'Usos: sensores de vibración y presión,', 540, 190, { tam: 12.5, alin: 'left', color: p.suave });
      txt(v, 'encendedores, zumbadores y el cuarzo', 540, 210, { tam: 12.5, alin: 'left', color: p.suave });
      txt(v, 'de todos los relojes.', 540, 230, { tam: 12.5, alin: 'left', color: p.suave });
    }
  }

  function resonador(v: Vista): void {
    const { ctx } = v;
    const p = pal;
    const est = v.estrecho;
    const cx = est ? v.w / 2 : 230;
    const cy = est ? 150 : 190;
    // Quartz plate in thickness-shear vibration (slowed down).
    const a = amplitud * 14 * Math.sin(t * 6);
    const w = 200;
    const h = 60;
    if (amplitud > 0.3) brillo(ctx, cx, cy, 140, p.acento, 0.15 * amplitud);
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(cx - w / 2 - a, cy - h / 2);
    ctx.lineTo(cx + w / 2 - a, cy - h / 2);
    ctx.lineTo(cx + w / 2 + a, cy + h / 2);
    ctx.lineTo(cx - w / 2 + a, cy + h / 2);
    ctx.closePath();
    ctx.fillStyle = alfa(p.cuarzo, 0.9);
    ctx.fill();
    ctx.strokeStyle = alfa(p.suave, 0.6);
    ctx.stroke();
    ctx.restore();
    ctx.fillStyle = gradCilindro(ctx, cy - h / 2 - 6, cy - h / 2, p.estano, p.oscuro);
    ctx.fillRect(cx - 60 - a, cy - h / 2 - 6, 120, 6);
    ctx.fillStyle = gradCilindro(ctx, cy + h / 2, cy + h / 2 + 6, p.estano, p.oscuro);
    ctx.fillRect(cx - 60 + a, cy + h / 2, 120, 6);
    txt(v, 'lámina de cuarzo (corte AT)', cx, cy + h / 2 + 30, { tam: 12.5, color: p.suave });
    txt(v, amplitud > 0.5 ? 'vibrando en resonancia' : 'casi quieta', cx, cy - h / 2 - 26, { tam: 13, peso: 800, color: amplitud > 0.5 ? p.acento : p.suave });
    // Equivalent circuit (BVD).
    const x0 = est ? 120 : 470;
    const y0 = est ? 300 : 110;
    hilo(v, [
      [x0, y0],
      [x0 + 40, y0],
    ]);
    bobina(v, x0 + 40, y0, x0 + 110, y0, { n: 4, largo: 60 });
    condensador(v, x0 + 110, y0, x0 + 140, y0, { placa: 24, sep: 8 });
    resistencia(v, x0 + 140, y0, x0 + 210, y0, { largo: 44, alto: 14 });
    hilo(v, [
      [x0 + 210, y0],
      [x0 + 250, y0],
    ]);
    hilo(v, [
      [x0 + 20, y0],
      [x0 + 20, y0 + 70],
      [x0 + 110, y0 + 70],
    ]);
    condensador(v, x0 + 110, y0 + 70, x0 + 140, y0 + 70, { placa: 24, sep: 8 });
    hilo(v, [
      [x0 + 140, y0 + 70],
      [x0 + 230, y0 + 70],
      [x0 + 230, y0],
    ]);
    nodo(v, x0 + 20, y0);
    nodo(v, x0 + 230, y0);
    txtRico(v, `L_1 ${si(L1, 'H', 3)}`, x0 + 75, y0 - 28, { tam: 12 });
    txtRico(v, `C_1 ${si(C1, 'F', 2)}`, x0 + 125, y0 + 26, { tam: 12 });
    txtRico(v, `R_1 ${R1} Ω`, x0 + 175, y0 - 22, { tam: 12 });
    txtRico(v, `C_0 ${si(C0, 'F', 2)}`, x0 + 125, y0 + 96, { tam: 12 });
    txtRico(v, `f = ${num(f / 1e6, 5)} MHz`, est ? v.w / 2 : x0 + 125, est ? v.h - 40 : y0 + 150, { tam: 15, peso: 800, color: p.acento });
    txtRico(v, `|Z| = ${si(Z, 'Ω', 3)}`, est ? v.w / 2 : x0 + 125, est ? v.h - 16 : y0 + 176, { tam: 14, peso: 800 });
  }

  function dibujar(v: Vista): void {
    void [modo, fuerza, df];
    fondo(v);
    if (modo === 'piezo') piezo(v);
    else resonador(v);
  }

  const curva = $derived.by(() => {
    const xs: number[] = [];
    const ys: number[] = [];
    for (let i = 0; i <= 600; i++) {
      const d = -10e3 + (i / 600) * 30e3;
      xs.push(d);
      ys.push(zDe(FS + d));
    }
    return { xs, ys };
  });

  const texto = $derived(
    modo === 'piezo'
      ? `**Efecto piezoeléctrico:** en el cuarzo los centros de carga positiva (silicio) y negativa (oxígeno) coinciden en reposo. Al comprimirlo, la celda se deforma, los centros se separan y aparece una polarización: entre los electrodos surge una tensión (${num(fuerza * 2.4, 2)} V en esta escala).\n` +
          'Y al revés: una tensión deforma el cristal. Es la base de los zumbadores, de los sensores de vibración y del «canto» de los MLCC de clase 2 en una fuente conmutada.'
      : `**Resonador de cuarzo de 16 MHz:** la lámina vibra mecánicamente a una frecuencia fijada por su espesor. Eléctricamente es L_1–C_1–R_1 en serie (la vibración) con C_0 en paralelo (los electrodos): resonancia serie a f_s = ${num(FS / 1e6, 5)} MHz (|Z| mínima ≈ R_1) y paralelo a f_p = f_s + ${si(FP - FS, 'Hz', 3)}.\n` +
          `El factor de calidad, Q = ${num(Q / 1000, 0)} 000, hace que basten ${si(FS / Q, 'Hz', 2)} de desajuste para que la vibración caiga a la mitad: de ahí su estabilidad como base de tiempo.`,
  );
  const lecturas = $derived(
    modo === 'piezo'
      ? [{ e: 'Tensión inducida (pico)', v: `${num(fuerza * 2.4, 2)} V`, c: pal.acento }]
      : [
          { e: 'f_s', v: `${num(FS / 1e6, 6)} MHz`, c: pal.acento },
          { e: 'f_p − f_s', v: si(FP - FS, 'Hz', 3) },
          { e: 'Factor de calidad Q', v: num(Q, 0) },
          { e: '|Z| a esta frecuencia', v: si(Z, 'Ω', 3) },
        ],
  );
</script>

<Marco {reloj} {texto} {lecturas} leyenda={modo === 'piezo' ? ['campoE'] : []}>
  {#snippet modos()}
    <Selector bind:valor={modo} opciones={[{ valor: 'piezo', texto: 'Efecto piezoeléctrico' }, { valor: 'resonador', texto: 'Resonador de cuarzo' }]} />
  {/snippet}
  {#snippet escena()}
    <Escena {reloj} {paso} {dibujar} dims={(a) => (a < 560 ? [560, 460] : [860, 400])} etiqueta="Cristal piezoeléctrico y resonador de cuarzo" />
  {/snippet}
  {#snippet controles()}
    {#if modo === 'piezo'}
      <Deslizador etiqueta="Presión (compresión / tracción)" bind:valor={fuerza} min={-1} max={1} paso={0.02} formato={(x) => `${num(x * 100, 0)} %`} />
    {:else}
      <Deslizador etiqueta="Desajuste respecto a f_s" bind:valor={df} min={-10000} max={20000} paso={10} unidad="Hz" />
      <div class="atajos">
        <button class="boton" onclick={() => (df = 0)}>f_s</button>
        <button class="boton" onclick={() => (df = FP - FS)}>f_p</button>
      </div>
    {/if}
  {/snippet}
  {#snippet grafica()}
    {#if modo === 'resonador'}
      <Grafica
        titulo="Impedancia del cristal cerca de la resonancia"
        x={{ etiqueta: 'f − f_s', unidad: 'Hz', min: -10e3, max: 20e3 }}
        y={{ etiqueta: '|Z|', unidad: 'Ω', min: 10, max: 1e8, log: true }}
        series={[{ x: curva.xs, y: curva.ys, color: pal.acento }]}
        puntos={[{ x: df, y: Z, color: pal.corriente, etiqueta: si(Z, 'Ω', 3) }]}
      />
    {/if}
  {/snippet}
</Marco>

<style>
  .atajos {
    display: flex;
    gap: 6px;
  }
</style>
