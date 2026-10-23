<script lang="ts">
  // Logic levels and noise margins (book 9.2, 9.7, 9.8, C.3): what an output guarantees (V_OH min, V_OL max)
  // against what an input demands (V_IH, V_IL). Margins: CMOS HC at 5 V → 4,4 − 3,5 = 0,9 V high and
  // 1,5 − 0,33 = 1,17 V low; TTL 0,4 V both; TTL into HC → −1,1 V: incompatible. A 3,3 V output (V_OH = 3,2 V)
  // passes a TTL/HCT input (2,0 V) and falls in the forbidden zone of HC (3,5 V). A bit stream at the
  // worst-case output levels crosses a noisy line and the receiver decides each bit; errors are counted.
  import Escena from '../../ui/Escena.svelte';
  import Marco from '../../ui/Marco.svelte';
  import Deslizador from '../../ui/Deslizador.svelte';
  import Selector from '../../ui/Selector.svelte';
  import { Reloj, Muestreo } from '../../nucleo/reloj.svelte';
  import { txt, txtRico, rr, flecha, type Vista } from '../../nucleo/dibujo';
  import { alfa, paleta } from '../../nucleo/paleta';
  import { si, num } from '../../nucleo/formato';
  import { app } from '../../../../lib/estado.svelte';
  import { estatico, panel, curva, guia, X, Y, type Ejes } from '../nucleo/grafica';
  import { generadorRuido } from '../nucleo/senal';

  const reloj = new Reloj();
  const pal = $derived(paleta(app.tema));

  type Fam = 'ttl' | 'hc' | 'hct' | 'lv33';
  const SALIDAS: Record<Fam, { nombre: string; vcc: number; voh: number; vol: number }> = {
    ttl: { nombre: 'TTL 74LS', vcc: 5, voh: 2.4, vol: 0.4 },
    hc: { nombre: 'CMOS 74HC (5 V)', vcc: 5, voh: 4.4, vol: 0.33 },
    hct: { nombre: 'CMOS 74HCT (5 V)', vcc: 5, voh: 4.4, vol: 0.33 },
    lv33: { nombre: 'LVCMOS 3,3 V', vcc: 3.3, voh: 3.2, vol: 0.1 },
  };
  const ENTRADAS: Record<Fam, { nombre: string; vih: number; vil: number }> = {
    ttl: { nombre: 'TTL 74LS', vih: 2.0, vil: 0.8 },
    hc: { nombre: 'CMOS 74HC (5 V)', vih: 3.5, vil: 1.5 },
    hct: { nombre: 'CMOS 74HCT (5 V)', vih: 2.0, vil: 0.8 },
    lv33: { nombre: 'LVCMOS 3,3 V', vih: 2.0, vil: 0.8 },
  };
  let tx = $state<Fam>('hc');
  let rx = $state<Fam>('hc');
  let ruido = $state(0.3); // rms volts

  const s = $derived(SALIDAS[tx]);
  const e = $derived(ENTRADAS[rx]);
  const nmh = $derived(s.voh - e.vih);
  const nml = $derived(e.vil - s.vol);

  // Bit stream: one bit every 0,35 s on screen, 8 samples per bit with independent noise.
  const bits = (() => {
    const r: number[] = [];
    let x = 0x5a3c;
    for (let i = 0; i < 4096; i++) {
      x = (x * 1103515245 + 12345) & 0x7fffffff;
      r.push((x >> 16) & 1);
    }
    return r;
  })();
  const ruidoTabla = (() => {
    const g = generadorRuido(5);
    const t = new Float64Array(8 * 4096);
    for (let i = 0; i < t.length; i++) t[i] = g();
    return t;
  })();
  let pos = 0;
  let errores = 0;
  let total = 0;
  let ultimoBit = -1;
  let n = $state(0);
  const muestreo = new Muestreo(80);
  $effect(() => {
    void [tx, rx, ruido, reloj.reinicios];
    errores = 0;
    total = 0;
  });

  /** Received level at sample k: worst-case output level plus noise. */
  function nivel(k: number): number {
    const b = bits[Math.floor(k / 8) % 4096]!;
    return (b ? s.voh : s.vol) + ruido * ruidoTabla[k % ruidoTabla.length]!;
  }
  /** Receiver decision: 1, 0, or undefined (forbidden zone: the gate may read either). */
  function decide(v: number): 0 | 1 | null {
    return v >= e.vih ? 1 : v <= e.vil ? 0 : null;
  }

  function paso(dt: number): void {
    pos += dt / 0.35;
    const b = Math.floor(pos) - 1;
    if (b > ultimoBit) {
      for (let k = ultimoBit + 1; k <= b; k++) {
        // The receiver samples in the middle of each bit.
        const d = decide(nivel(k * 8 + 4));
        total++;
        if (d !== bits[k % 4096]) errores++;
      }
      ultimoBit = b;
    }
    if (muestreo.toca()) n++;
  }

  function dibujar(v: Vista): void {
    void n;
    const { ctx } = v;
    const p = pal;
    const est = v.estrecho;
    // Level diagram.
    const top = 40;
    const bot = est ? 250 : 330;
    const vy = (val: number) => bot - ((bot - top) * val) / 5.5;
    const xo = 70;
    const xi = est ? 300 : 300;
    const anc = 110;
    const eT: Ejes = est ? { x: 60, y: 310, w: 510, h: 170, x0: 0, x1: 16, y0: -1, y1: 6 } : { x: 470, y: 40, w: 400, h: 290, x0: 0, x1: 16, y0: -1, y1: 6 };
    estatico(v, `nl:${est}:${tx}:${rx}`, (vv) => {
      const c = vv.ctx;
      // Output bands.
      c.fillStyle = alfa(p.bien, 0.18);
      c.fillRect(xo, vy(s.vcc), anc, vy(s.voh) - vy(s.vcc));
      c.fillRect(xo, vy(s.vol), anc, vy(0) - vy(s.vol));
      c.fillStyle = alfa(p.tinta, 0.06);
      c.fillRect(xo, vy(s.voh), anc, vy(s.vol) - vy(s.voh));
      // Input bands.
      c.fillStyle = alfa(p.acento, 0.18);
      c.fillRect(xi, vy(5.5), anc, vy(e.vih) - vy(5.5));
      c.fillRect(xi, vy(e.vil), anc, vy(0) - vy(e.vil));
      c.fillStyle = alfa(p.peligro, 0.18);
      c.fillRect(xi, vy(e.vih), anc, vy(e.vil) - vy(e.vih));
      c.strokeStyle = p.linea;
      c.strokeRect(xo, vy(5.5), anc, vy(0) - vy(5.5));
      c.strokeRect(xi, vy(5.5), anc, vy(0) - vy(5.5));
      for (let k = 0; k <= 5; k++) txt(vv, `${k} V`, xo - 8, vy(k), { tam: 10.5, color: p.suave, alin: 'right' });
      txt(vv, 'salida garantiza', xo + anc / 2, top - 14, { tam: 11.5, peso: 700, color: p.suave });
      txt(vv, 'entrada exige', xi + anc / 2, top - 14, { tam: 11.5, peso: 700, color: p.suave });
      txtRico(vv, `V_OH ≥ ${num(s.voh, 2)}`, xo + anc / 2, vy(s.voh) + 10, { tam: 11, peso: 700, color: p.bien });
      txtRico(vv, `V_OL ≤ ${num(s.vol, 2)}`, xo + anc / 2, vy(s.vol) - 9, { tam: 11, peso: 700, color: p.bien });
      txtRico(vv, `V_IH = ${num(e.vih, 2)}`, xi + anc / 2, vy(e.vih) - 9, { tam: 11, peso: 700, color: p.acento });
      txtRico(vv, `V_IL = ${num(e.vil, 2)}`, xi + anc / 2, vy(e.vil) + 10, { tam: 11, peso: 700, color: p.acento });
      txt(vv, 'prohibida', xi + anc / 2, (vy(e.vih) + vy(e.vil)) / 2, { tam: 11, peso: 700, color: p.peligro });
      panel(vv, eT, { titulo: 'Línea con ruido y decisión del receptor', sinX: true, uy: 'V', marcasY: [0, 1, 2, 3, 4, 5] });
      guia(c, eT, 'y', e.vih, alfa(p.acento, 0.8), 1.4);
      guia(c, eT, 'y', e.vil, alfa(p.acento, 0.8), 1.4);
      c.fillStyle = alfa(p.peligro, 0.08);
      c.fillRect(eT.x, Y(eT, e.vih), eT.w, Y(eT, e.vil) - Y(eT, e.vih));
    });
    // Margins.
    const mx = (xo + anc + xi) / 2;
    for (const [a, b, m, et] of [
      [s.voh, e.vih, nmh, 'NM_H'],
      [e.vil, s.vol, nml, 'NM_L'],
    ] as const) {
      const c = m >= 0 ? p.bien : p.peligro;
      ctx.strokeStyle = alfa(c, 0.5);
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(xo + anc, vy(a));
      ctx.lineTo(xi, vy(a));
      ctx.moveTo(xo + anc, vy(b));
      ctx.lineTo(xi, vy(b));
      ctx.stroke();
      ctx.setLineDash([]);
      if (Math.abs(vy(a) - vy(b)) > 8) flecha(ctx, mx, vy(a), mx, vy(b), c, 2, 8);
      rr(ctx, mx - 34, (vy(a) + vy(b)) / 2 - 10, 68, 20, 10);
      ctx.fillStyle = p.panel;
      ctx.fill();
      txtRico(v, `${et} ${num(m, 2)} V`, mx, (vy(a) + vy(b)) / 2, { tam: 11, peso: 800, color: c });
    }
    // Time trace: the last 16 bits.
    const k0 = Math.floor(pos * 8) - 16 * 8;
    const xs = new Float64Array(16 * 8);
    const ys = new Float64Array(16 * 8);
    for (let i = 0; i < 16 * 8; i++) {
      xs[i] = i / 8;
      ys[i] = nivel(Math.max(0, k0 + i));
    }
    curva(ctx, eT, xs, ys, p.serie[4], 1.6);
    // Decisions (middle of each complete bit).
    const b0 = Math.floor(k0 / 8);
    const frac = (k0 / 8) - b0;
    for (let j = 1; j < 16; j++) {
      const bit = b0 + j;
      if (bit < 0) continue;
      const vm = nivel(bit * 8 + 4);
      const d = decide(vm);
      const ok = d === bits[bit % 4096];
      const x = X(eT, j - frac + 0.5);
      txt(v, d === null ? '?' : String(d), x, eT.y + eT.h - 12, { tam: 13, peso: 800, color: ok ? p.bien : p.peligro });
    }
  }

  const texto = $derived.by(() => {
    const comp = nmh >= 0 && nml >= 0;
    return (
      `**Márgenes de ruido** de ${s.nombre} atacando ${e.nombre}: en alto V_OH − V_IH = ${num(s.voh, 2)} − ${num(e.vih, 2)} = ${num(nmh, 2)} V; en bajo V_IL − V_OL = ${num(e.vil, 2)} − ${num(s.vol, 2)} = ${num(nml, 2)} V. ` +
      (comp
        ? `Es el colchón que el ruido puede comerse sin provocar un error: con ${si(ruido, 'V', 2)} eficaces de ruido, los picos (unas 3 veces el eficaz) ${3 * ruido < Math.min(nmh, nml) ? 'no llegan a la zona prohibida' : 'ya se meten en la zona prohibida y aparecen errores'}.`
        : `**Margen negativo:** la salida no garantiza lo que la entrada exige. No es que falle a veces: el fabricante no garantiza nada${tx === 'lv33' && rx === 'hc' ? ' (3,3 V contra HC: la figura 9.9)' : tx === 'ttl' && rx === 'hc' ? ' (TTL contra HC: −1,1 V, por eso existe la HCT)' : ''}.`) +
      `\nEl receptor decide en el centro de cada bit: por encima de V_IH lee 1, por debajo de V_IL lee 0, y en medio («?») puede leer cualquier cosa.`
    );
  });

  const lecturas = $derived.by(() => {
    void n;
    return [
      { e: 'Margen alto NM_H', v: si(nmh, 'V', 3), c: nmh >= 0 ? pal.bien : pal.peligro },
      { e: 'Margen bajo NM_L', v: si(nml, 'V', 3), c: nml >= 0 ? pal.bien : pal.peligro },
      { e: 'Bits erróneos', v: `${errores} de ${total}`, c: errores ? pal.peligro : pal.bien },
    ];
  });
</script>

<Marco {reloj} {texto} {lecturas}>
  {#snippet modos()}
    <div class="familias">
      <Selector etiqueta="Salida (emisor)" bind:valor={tx} opciones={(Object.keys(SALIDAS) as Fam[]).map((k) => ({ valor: k, texto: SALIDAS[k].nombre }))} />
      <Selector etiqueta="Entrada (receptor)" bind:valor={rx} opciones={(Object.keys(ENTRADAS) as Fam[]).map((k) => ({ valor: k, texto: ENTRADAS[k].nombre }))} />
    </div>
  {/snippet}
  {#snippet escena()}
    <Escena {reloj} {paso} {dibujar} dims={(a) => (a < 560 ? [600, 500] : [900, 380])} etiqueta="Niveles lógicos de salida y de entrada, márgenes de ruido y bits recibidos con ruido" />
  {/snippet}
  {#snippet controles()}
    <Deslizador etiqueta="Ruido en la línea (eficaz)" bind:valor={ruido} min={0} max={1.2} paso={0.01} unidad="V" />
    <div class="botones">
      <button class="boton" onclick={() => ((tx = 'lv33'), (rx = 'hc'))}>3,3 V → HC (figura 9.9)</button>
      <button class="boton" onclick={() => ((tx = 'lv33'), (rx = 'hct'))}>3,3 V → HCT</button>
      <button class="boton" onclick={() => ((tx = 'ttl'), (rx = 'hc'))}>TTL → HC</button>
    </div>
  {/snippet}
</Marco>

<style>
  .familias {
    display: grid;
    gap: 10px;
  }
  .botones {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
</style>
