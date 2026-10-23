<script lang="ts">
  // The linear power supply of project II (book 49.5–49.7, 5.6, 8.4): transformer secondary, bridge and filter
  // capacitor simulated with ngspice (the book's netlist cap50/rectificador.cir: 0,05 Ω, power-bridge diodes,
  // constant-current load), then a linear regulator with 2,5 V of dropout. Book case: 18 V rms, 5000 µF, 1 A →
  // about 23 V with 2 V of ripple (C = I/(f·ΔV)); with the mains at −10 % the valley must still clear the
  // dropout, and at low output voltage the regulator burns (V_in − V_out)·I: its Achilles' heel.
  import Escena from '../../ui/Escena.svelte';
  import Marco from '../../ui/Marco.svelte';
  import Deslizador from '../../ui/Deslizador.svelte';
  import Selector from '../../ui/Selector.svelte';
  import { Reloj, Muestreo } from '../../nucleo/reloj.svelte';
  import { txt, txtRico, rr, brillo, type Vista } from '../../nucleo/dibujo';
  import { alfa, paleta } from '../../nucleo/paleta';
  import { si, num } from '../../nucleo/formato';
  import { app } from '../../../../lib/estado.svelte';
  import { estatico, panel, curva, guia, area, punto, type Ejes } from '../nucleo/grafica';
  import { transitorio, ventanaUniforme } from '../nucleo/spice';

  const reloj = new Reloj();
  const pal = $derived(paleta(app.tema));

  let Vsec = $state(18);
  let Cuf = $state(5000);
  let I = $state(1);
  let Vset = $state(12);
  let red = $state<'baja' | 'nominal' | 'alta'>('nominal');
  const DROP = 2.5;
  const N = 400;

  const fRed = $derived(red === 'baja' ? 0.9 : red === 'alta' ? 1.1 : 1);
  const netlist = $derived(
    [
      '* Rectificador en puente con condensador de filtro y carga de corriente constante (sección 49.5)',
      '.model DPTE D(Is=63n Rs=10m N=1.7 Cjo=50p)',
      `V1 a b SIN(0 ${(Vsec * fRed * Math.SQRT2).toFixed(4)} 50)`,
      'R1 a a1 0.05',
      'Vm a1 a2 0',
      'D1 a2 p DPTE',
      'D2 b p DPTE',
      'D3 0 a2 DPTE',
      'D4 0 b DPTE',
      `C1 p 0 ${Cuf}u`,
      `I1 p 0 PWL(0 0 40m 0 80m ${I.toFixed(4)})`,
      'RH b 0 10k',
      '.tran 20u 300m 0 20u',
      '.save v(p) v(a) v(b) i(vm)',
      '.end',
    ].join('\n'),
  );

  let res = $state.raw<{ vc: Float64Array; ia: Float64Array; vs: Float64Array } | null>(null);
  let estado = $state<'simulando' | 'ok' | 'error'>('simulando');
  let mensaje = $state('');
  let ms = $state(0);
  let temporizador: ReturnType<typeof setTimeout> | null = null;
  $effect(() => {
    const texto = netlist;
    if (temporizador) clearTimeout(temporizador);
    estado = 'simulando';
    temporizador = setTimeout(async () => {
      try {
        const r = await transitorio(texto);
        if (!r) return;
        const t = r.vec.get('time')!;
        const vp = r.vec.get('v(p)')!;
        const va = r.vec.get('v(a)')!;
        const vb = r.vec.get('v(b)')!;
        const ib = [...r.vec.entries()].find(([k]) => k.includes('vm'))?.[1];
        if (!t || !vp || !va || !vb || !ib) throw new Error('faltan vectores en el resultado');
        const vs = new Float64Array(t.length);
        for (let i = 0; i < t.length; i++) vs[i] = Math.abs(va[i]! - vb[i]!);
        res = { vc: ventanaUniforme(t, vp, 0.26, 0.3, N), ia: ventanaUniforme(t, ib, 0.26, 0.3, N), vs: ventanaUniforme(t, vs, 0.26, 0.3, N) };
        ms = r.ms;
        estado = 'ok';
      } catch (e) {
        estado = 'error';
        mensaje = e instanceof Error ? e.message : String(e);
      }
    }, 250);
    return () => {
      if (temporizador) clearTimeout(temporizador);
    };
  });

  const medidas = $derived.by(() => {
    if (!res) return null;
    let min = 1e9;
    let max = -1e9;
    let media = 0;
    let pReg = 0;
    let ipk = 0;
    const vo = new Float64Array(N);
    for (let i = 0; i < N; i++) {
      const v = res.vc[i]!;
      min = Math.min(min, v);
      max = Math.max(max, v);
      media += v / N;
      vo[i] = Math.max(0, Math.min(Vset, v - DROP));
      pReg += ((v - vo[i]!) * I) / N;
      ipk = Math.max(ipk, Math.abs(res.ia[i]!));
    }
    return { min, max, media, rizado: max - min, vo, pReg, ipk, cae: min - DROP < Vset };
  });

  let u = 0;
  let n = $state(0);
  const muestreo = new Muestreo(60);
  function paso(dt: number): void {
    u = (u + dt / 4) % 1;
    if (muestreo.toca()) n++;
  }

  function dibujar(v: Vista): void {
    void n;
    const { ctx } = v;
    const p = pal;
    const est = v.estrecho;
    const vmax = Math.max(Vsec * 1.1 * Math.SQRT2 + 2, 10);
    const eV: Ejes = est ? { x: 60, y: 150, w: 510, h: 210, x0: 0, x1: 40e-3, y0: 0, y1: vmax } : { x: 60, y: 140, w: 520, h: 200, x0: 0, x1: 40e-3, y0: 0, y1: vmax };
    const eI: Ejes = est ? { x: 60, y: 425, w: 510, h: 90, x0: 0, x1: 40e-3, y0: 0, y1: Math.max(5, (medidas?.ipk ?? 5) * 1.1) } : { x: 620, y: 140, w: 250, h: 200, x0: 0, x1: 40e-3, y0: 0, y1: Math.max(5, (medidas?.ipk ?? 5) * 1.1) };
    estatico(v, `fl:${est}:${vmax}:${eI.y1}`, (vv) => {
      panel(vv, eV, { titulo: 'Secundario rectificado, condensador y salida regulada', ux: 's', uy: 'V' });
      panel(vv, eI, { titulo: 'Corriente del secundario (pulsos)', ux: 's', uy: 'A' });
    });
    // Block chain with live values.
    const bloques: [string, string][] = [
      ['Transformador', `${num(Vsec * fRed, 1)} V ef.`],
      ['Puente + C', medidas ? `${num(medidas.media, 1)} V` : '…'],
      ['Regulador', medidas ? `${si(medidas.pReg, 'W', 2)}` : '…'],
      ['Carga', `${num(Vset, 1)} V · ${si(I, 'A', 2)}`],
    ];
    const bw = est ? 125 : 190;
    const gap = (v.w - 60 - 4 * bw) / 3;
    bloques.forEach(([t, val], k) => {
      const x = 30 + k * (bw + gap);
      const calor = k === 2 && medidas ? Math.min(1, medidas.pReg / 20) : 0;
      if (calor > 0.05) brillo(ctx, x + bw / 2, 60, 70, p.calor, 0.6 * calor);
      rr(ctx, x, 30, bw, 60, 10);
      ctx.fillStyle = k === 2 && medidas?.cae ? alfa(p.peligro, 0.15) : p.panel;
      ctx.fill();
      ctx.strokeStyle = p.linea;
      ctx.lineWidth = 1.2;
      ctx.stroke();
      txt(v, t, x + bw / 2, 50, { tam: 12, peso: 700, color: p.suave });
      txt(v, val, x + bw / 2, 72, { tam: 13.5, peso: 800, color: k === 2 ? p.calor : p.tinta });
      if (k < 3) {
        ctx.fillStyle = p.tenue;
        ctx.beginPath();
        ctx.moveTo(x + bw + gap / 2 + 5, 60);
        ctx.lineTo(x + bw + gap / 2 - 4, 54);
        ctx.lineTo(x + bw + gap / 2 - 4, 66);
        ctx.fill();
      }
    });
    if (!res || !medidas) {
      txt(v, estado === 'error' ? `No se pudo simular: ${mensaje}` : 'Simulando con ngspice…', eV.x + eV.w / 2, eV.y + eV.h / 2, { tam: 14, peso: 700, color: estado === 'error' ? p.peligro : p.suave });
      return;
    }
    const xs = new Float64Array(N);
    for (let i = 0; i < N; i++) xs[i] = (40e-3 * i) / (N - 1);
    curva(ctx, eV, xs, res.vs, alfa(p.tinta, 0.4), 1.4, [4, 3]);
    area(ctx, eV, xs, res.vc, alfa(p.acento, 0.08), medidas.vo[0]!);
    curva(ctx, eV, xs, res.vc, p.acento, 2.2);
    curva(ctx, eV, xs, medidas.vo, medidas.cae ? p.peligro : p.bien, 2.4);
    guia(ctx, eV, 'y', Vset + DROP, alfa(p.peligro, 0.5));
    txtRico(v, `V_out + caída mínima (${num(DROP, 1)} V)`, eV.x + eV.w - 4, eV.y + eV.h * 0 + 14, { tam: 11, color: p.peligro, alin: 'right' });
    const ia = new Float64Array(N);
    for (let i = 0; i < N; i++) ia[i] = Math.abs(res.ia[i]!);
    curva(ctx, eI, xs, ia, p.corriente, 2);
    const k = Math.floor(u * (N - 1));
    guia(ctx, eV, 'x', xs[k]!, alfa(p.tinta, 0.35));
    guia(ctx, eI, 'x', xs[k]!, alfa(p.tinta, 0.35));
    punto(ctx, eV, xs[k]!, res.vc[k]!, p.acento, 5, p.fondo);
    punto(ctx, eI, xs[k]!, ia[k]!, p.corriente, 5, p.fondo);
  }

  const texto = $derived.by(() => {
    const m = medidas;
    if (!m) return estado === 'error' ? `No se pudo simular el rectificador: ${mensaje}` : 'Simulando el rectificador con ngspice (la primera vez se descarga el motor, unos 6 MB)…';
    const cFormula = (I / (100 * Math.max(m.rizado, 1e-3))) * 1e6;
    return (
      `**Rectificar y filtrar** (simulado con ngspice): ${num(Vsec * fRed, 1)} V eficaces dan ${num(m.max, 1)} V de pico en el condensador, que cae a ${num(m.min, 1)} V antes de la siguiente recarga: rizado de ${num(m.rizado, 2)} V a 100 Hz (la fórmula C = I/(f·ΔV) pediría ${num(cFormula, 0)} µF para ese rizado). La corriente del secundario llega en **pulsos** de ${si(m.ipk, 'A', 2)} junto a los picos, mucho mayores que la media de ${si(I, 'A', 2)}.\n` +
      (m.cae
        ? `**El regulador se queda sin margen:** el valle (${num(m.min, 1)} V) no supera V_out + ${num(DROP, 1)} V y el rizado pasa a la salida. Con la red al −10 % es el caso que hay que comprobar.`
        : `El regulador absorbe la diferencia: la salida es una línea plana de ${num(Vset, 1)} V, y a cambio disipa (V_in − V_out)·I = ${si(m.pReg, 'W', 2)}. Bajar la tensión de salida no baja esa cuenta: el lineal quema lo que sobra, y esa es su debilidad.`)
    );
  });

  const lecturas = $derived([
    { e: 'Tensión media en C', v: medidas ? si(medidas.media, 'V', 3) : '…', c: pal.acento },
    { e: 'Rizado pico a pico', v: medidas ? si(medidas.rizado, 'V', 3) : '…' },
    { e: 'Valle', v: medidas ? si(medidas.min, 'V', 3) : '…' },
    { e: 'Pico de corriente', v: medidas ? si(medidas.ipk, 'A', 3) : '…', c: pal.corriente },
    { e: 'Disipación del regulador', v: medidas ? si(medidas.pReg, 'W', 3) : '…', c: pal.calor },
    { e: 'Simulación', v: estado === 'ok' ? `${num(ms, 0)} ms` : estado === 'error' ? 'error' : '…' },
  ]);
</script>

<Marco {reloj} {texto} {lecturas} leyenda={['corriente', 'calor']}>
  {#snippet modos()}
    <Selector
      etiqueta="Tensión de red"
      bind:valor={red}
      opciones={[
        { valor: 'baja', texto: '−10 %' },
        { valor: 'nominal', texto: 'Nominal' },
        { valor: 'alta', texto: '+10 %' },
      ]}
    />
  {/snippet}
  {#snippet escena()}
    <Escena {reloj} {paso} {dibujar} dims={(a) => (a < 560 ? [600, 540] : [900, 380])} etiqueta="Fuente lineal: rectificador, condensador de filtro y regulador" />
  {/snippet}
  {#snippet controles()}
    <Deslizador etiqueta="Secundario" bind:valor={Vsec} min={9} max={30} paso={0.5} formato={(x) => `${num(x, 1)} V ef.`} />
    <Deslizador etiqueta="Condensador de filtro" bind:valor={Cuf} min={470} max={22000} log formato={(x) => `${num(x, 0)} µF`} />
    <Deslizador etiqueta="Corriente de carga" bind:valor={I} min={0.05} max={3} paso={0.05} unidad="A" />
    <Deslizador etiqueta="Tensión de salida" bind:valor={Vset} min={1.25} max={30} paso={0.25} unidad="V" />
    <button class="boton" onclick={() => ((Vsec = 18), (Cuf = 5000), (I = 1), (Vset = 12), (red = 'nominal'))}>Caso de la sección 49.5</button>
  {/snippet}
</Marco>
