<script lang="ts">
  // Superposition (book 22.5 and 1.5): two sources of 12 V and 6 V, each with 1 kΩ in series, on a common
  // 2 kΩ load. Each source acting alone (the other replaced by a short circuit) gives 4,80 V and 2,40 V, and
  // the sum is the 7,20 V of the complete circuit. Powers do not add (they go with the square), and with a
  // diode in series with the load the partial results stop adding: the theorem needs a linear circuit.
  import Escena from '../../ui/Escena.svelte';
  import Marco from '../../ui/Marco.svelte';
  import Deslizador from '../../ui/Deslizador.svelte';
  import Selector from '../../ui/Selector.svelte';
  import Interruptor from '../../ui/Interruptor.svelte';
  import { Reloj, Muestreo } from '../../nucleo/reloj.svelte';
  import { txt, txtRico, rr, type Vista } from '../../nucleo/dibujo';
  import { hilo, resistencia, fuente, nodo, masa, diodo } from '../../nucleo/esquema';
  import { paleta } from '../../nucleo/paleta';
  import { si, num } from '../../nucleo/formato';
  import { vDiodo } from '../../nucleo/fisica';
  import { app } from '../../../../lib/estado.svelte';
  import { estatico } from '../nucleo/grafica';
  import { corriente, chapa } from '../nucleo/simbolos';

  const reloj = new Reloj();
  const pal = $derived(paleta(app.tema));

  let V1 = $state(12);
  let V2 = $state(6);
  let Ra = $state(1000);
  let Rb = $state(1000);
  let RL = $state(2000);
  let conDiodo = $state(false);
  let modo = $state<'auto' | 'ambas' | 'v1' | 'v2'>('auto');

  // Diode of the book's netlists (1N4148-like): I_S = 2,5 nA, n = 1,75.
  const IS = 2.5e-9;
  const N = 1.75;

  /** Load current for a node voltage x: R_L alone, or a diode in series with R_L. */
  function iCarga(x: number): number {
    if (!conDiodo) return x / RL;
    if (x <= 0) return -IS;
    let lo = 0;
    let hi = x / RL;
    for (let k = 0; k < 60; k++) {
      const m = (lo + hi) / 2;
      if (vDiodo(m, IS, N) + m * RL > x) hi = m;
      else lo = m;
    }
    return (lo + hi) / 2;
  }

  /** Node voltage with the given source values (a disabled source is a 0 V source: a short circuit). */
  function nodoX(a: number, b: number): number {
    let lo = Math.min(a, b, 0) - 1;
    let hi = Math.max(a, b, 0) + 1;
    for (let k = 0; k < 70; k++) {
      const m = (lo + hi) / 2;
      const f = (a - m) / Ra + (b - m) / Rb - iCarga(m);
      if (f > 0) lo = m;
      else hi = m;
    }
    return (lo + hi) / 2;
  }

  const res = $derived.by(() => {
    void conDiodo;
    const total = nodoX(V1, V2);
    const solo1 = nodoX(V1, 0);
    const solo2 = nodoX(0, V2);
    return { total, solo1, solo2 };
  });

  // Case shown: in automatic mode it cycles every 3,5 s: V₁ alone → V₂ alone → both.
  let tAuto = 0;
  let caso = $state<'ambas' | 'v1' | 'v2'>('v1');
  $effect(() => {
    if (modo !== 'auto') caso = modo;
  });
  // Displayed (eased) bar values.
  const mostrado = { a: 0, b: 0, t: 0 };
  const fases = { a: 0, b: 0, l: 0 };
  let n = $state(0);
  const muestreo = new Muestreo(120);

  function objetivo(): { a: number; b: number; t: number } {
    return {
      a: caso === 'v2' ? 0 : res.solo1,
      b: caso === 'v1' ? 0 : res.solo2,
      t: caso === 'ambas' ? res.total : caso === 'v1' ? res.solo1 : res.solo2,
    };
  }

  function paso(dt: number): void {
    if (modo === 'auto') {
      tAuto += dt;
      const c = Math.floor(tAuto / 3.5) % 3;
      const nuevo = c === 0 ? 'v1' : c === 1 ? 'v2' : 'ambas';
      if (nuevo !== caso) caso = nuevo;
    }
    const o = objetivo();
    const k = 1 - Math.exp(-dt / 0.18);
    mostrado.a += (o.a - mostrado.a) * k;
    mostrado.b += (o.b - mostrado.b) * k;
    mostrado.t += (o.t - mostrado.t) * k;
    const x = o.t;
    const va = caso === 'v2' ? 0 : V1;
    const vb = caso === 'v1' ? 0 : V2;
    const s = 60 / (Math.max(V1, V2, 1) / Math.min(Ra, Rb));
    fases.a += dt * Math.abs((va - x) / Ra) * s;
    fases.b += dt * Math.abs((vb - x) / Rb) * s;
    fases.l += dt * Math.abs(iCarga(x)) * s;
    if (muestreo.toca()) n++;
  }

  function dibujar(v: Vista): void {
    void n;
    const { ctx } = v;
    const p = pal;
    const est = v.estrecho;
    const xA = 60;
    const xX = est ? 300 : 270;
    const xB = est ? 540 : 480;
    const yT = 70;
    const yB = 250;
    const ym = (yT + yB) / 2;
    const on1 = caso !== 'v2';
    const on2 = caso !== 'v1';
    const x = caso === 'ambas' ? res.total : caso === 'v1' ? res.solo1 : res.solo2;

    estatico(v, `sp:${est}:${conDiodo}`, (vv) => {
      hilo(vv, [[xA, yT], [xB, yT]]);
      hilo(vv, [[xA, yB], [xB, yB]]);
      hilo(vv, [[xA, yT], [xA, yB]]);
      hilo(vv, [[xB, yT], [xB, yB]]);
      hilo(vv, [[xX, yT], [xX, yB]]);
      resistencia(vv, xA + 50, yT, xX - 50, yT, { largo: 70, alto: 22 });
      resistencia(vv, xX + 50, yT, xB - 50, yT, { largo: 70, alto: 22 });
      if (conDiodo) {
        diodo(vv, xX, yT + 30, xX, yT + 80, {});
        resistencia(vv, xX, ym + 10, xX, yB - 20, { largo: 56, alto: 20 });
      } else resistencia(vv, xX, ym - 35, xX, ym + 35, { largo: 70, alto: 22 });
      nodo(vv, xX, yT);
      nodo(vv, xX, yB);
      masa(vv, xX, yB + 4);
    });
    // Sources: active, or replaced by a short circuit.
    for (const [xs, on, val, nombre] of [
      [xA, on1, V1, 'V_1'],
      [xB, on2, V2, 'V_2'],
    ] as const) {
      if (on) fuente(v, xs, ym, 24, 'dc', { color: p.acento });
      else {
        ctx.fillStyle = p.fondo;
        ctx.fillRect(xs - 26, ym - 26, 52, 52);
        hilo(v, [[xs, ym - 26], [xs, ym + 26]], p.peligro, 2.4);
      }
      const lado = xs < xX ? 1 : -1;
      txtRico(v, on ? `${nombre} = ${num(val, 1)} V` : `${nombre} anulada`, xs + lado * 14, ym - 46, { tam: 12.5, peso: 700, alin: lado < 0 ? 'right' : 'left', color: on ? p.acento : p.peligro });
      if (!on) txt(v, '(cortocircuito)', xs + lado * 14, ym - 30, { tam: 11.5, alin: lado < 0 ? 'right' : 'left', color: p.peligro });
    }
    if (est) {
      txtRico(v, `R_a ${si(Ra, 'Ω', 3)}`, (xA + xX) / 2, yT - 26, { tam: 12.5, peso: 700 });
      txtRico(v, `R_b ${si(Rb, 'Ω', 3)}`, (xX + xB) / 2, yT - 26, { tam: 12.5, peso: 700 });
    } else {
      txtRico(v, `R_a = ${si(Ra, 'Ω', 3)}`, (xA + xX) / 2, yT - 26, { tam: 12.5, peso: 700 });
      txtRico(v, `R_b = ${si(Rb, 'Ω', 3)}`, (xX + xB) / 2, yT - 26, { tam: 12.5, peso: 700 });
    }
    txtRico(v, `R_L ${si(RL, 'Ω', 3)}`, xX + 22, conDiodo ? ym + 40 : ym, { tam: 12.5, peso: 700, alin: 'left' });
    chapa(v, `V_X = ${num(x, 2)} V`, xX, yT - 52, p.corriente, 13);

    const va = on1 ? V1 : 0;
    const vb = on2 ? V2 : 0;
    corriente(v, [[xA, yB], [xA, yT], [xX, yT]], fases.a, (va - x) / Ra, 46, 10, 1e-7);
    corriente(v, [[xB, yB], [xB, yT], [xX, yT]], fases.b, (vb - x) / Rb, 46, 10, 1e-7);
    corriente(v, [[xX, yT], [xX, yB]], fases.l, iCarga(x), 40, 10, 1e-7);

    // Bars: contribution of each source, their sum and the real total.
    const bx = est ? 70 : 560;
    const by = est ? 330 : 70;
    const bw = est ? 480 : 310;
    const bh = est ? 170 : 220;
    rr(ctx, bx - 14, by - 14, bw + 28, bh + 52, 10);
    ctx.fillStyle = p.panel;
    ctx.fill();
    ctx.strokeStyle = p.linea;
    ctx.lineWidth = 1;
    ctx.stroke();
    txtRico(v, 'Tensión en la carga, V_X', bx, by + 2, { tam: 12, peso: 700, color: p.suave, alin: 'left' });
    const vmax = Math.max(Math.abs(res.solo1) + Math.abs(res.solo2), Math.abs(res.total), 1) * 1.08;
    const filas: [string, number, number, string][] = [
      ['solo V_1', mostrado.a, 0, p.acento],
      ['solo V_2', mostrado.b, 0, p.serie[2]],
      ['suma de las dos', mostrado.a, mostrado.b, p.serie[4]],
      ['circuito completo', mostrado.t, 0, p.corriente],
    ];
    const x0 = bx + (est ? 130 : 120);
    const ancho = bw - (est ? 130 : 120) - 50;
    const alto = (bh - 30) / filas.length;
    filas.forEach(([et, a, b, c], i) => {
      const y = by + 26 + i * alto;
      txtRico(v, et, x0 - 10, y + alto / 2 - 2, { tam: 12, alin: 'right', color: p.suave, peso: 600 });
      const wa = (Math.max(0, a) / vmax) * ancho;
      const wb = (Math.max(0, b) / vmax) * ancho;
      ctx.fillStyle = i === 2 ? p.acento : c;
      ctx.fillRect(x0, y + 6, wa, alto - 14);
      if (i === 2) {
        ctx.fillStyle = p.serie[2];
        ctx.fillRect(x0 + wa, y + 6, wb, alto - 14);
      }
      txt(v, `${num(a + b, 2)} V`, x0 + wa + wb + 6, y + alto / 2 - 2, { tam: 12, alin: 'left', peso: 700 });
    });
    const coincide = Math.abs(res.solo1 + res.solo2 - res.total) < 0.005;
    txt(v, coincide ? '✓ la suma coincide con el circuito completo' : '✗ la suma no coincide: el circuito no es lineal', bx, by + bh + 18, {
      tam: 12.5,
      peso: 700,
      alin: 'left',
      color: coincide ? p.bien : p.peligro,
    });
  }

  const potencias = $derived.by(() => {
    const p1 = (res.solo1 * iCarga(res.solo1)) as number;
    const p2 = (res.solo2 * iCarga(res.solo2)) as number;
    const pt = res.total * iCarga(res.total);
    return { p1, p2, pt };
  });

  const texto = $derived.by(() => {
    const { solo1, solo2, total } = res;
    const lin = !conDiodo;
    return (
      `**Una fuente cada vez:** con V_2 anulada (una fuente de tensión se anula con un cortocircuito) la carga recibe ${num(solo1, 2)} V; con V_1 anulada, ${num(solo2, 2)} V. ` +
      (lin
        ? `Sumadas dan ${num(solo1 + solo2, 2)} V, exactamente los ${num(total, 2)} V del circuito completo: es la definición de linealidad.\n`
        : `Sumadas dan ${num(solo1 + solo2, 2)} V, pero el circuito completo da ${num(total, 2)} V: con el diodo la superposición deja de valer, como predice el libro.\n`) +
      `**Las potencias no se suman:** en la carga hay ${si(potencias.pt, 'W', 3)}, no ${si(potencias.p1, 'W', 3)} + ${si(potencias.p2, 'W', 3)} = ${si(potencias.p1 + potencias.p2, 'W', 3)}. La potencia va con el cuadrado, y el cuadrado no es lineal: se superponen tensiones o corrientes y se eleva al cuadrado después.`
    );
  });

  const lecturas = $derived([
    { e: 'Solo V_1', v: si(res.solo1, 'V', 3), c: pal.acento },
    { e: 'Solo V_2', v: si(res.solo2, 'V', 3), c: pal.serie[2] },
    { e: 'Las dos a la vez', v: si(res.total, 'V', 3), c: pal.corriente },
    { e: 'Potencia real en la carga', v: si(potencias.pt, 'W', 3) },
    { e: 'Suma (errónea) de potencias', v: si(potencias.p1 + potencias.p2, 'W', 3), c: pal.peligro },
  ]);
</script>

<Marco {reloj} {texto} {lecturas} leyenda={['corriente']}>
  {#snippet modos()}
    <Selector
      etiqueta="Fuentes activas"
      bind:valor={modo}
      opciones={[
        { valor: 'auto', texto: 'Una tras otra' },
        { valor: 'v1', texto: 'Solo V_1' },
        { valor: 'v2', texto: 'Solo V_2' },
        { valor: 'ambas', texto: 'Las dos' },
      ]}
    />
  {/snippet}
  {#snippet escena()}
    <Escena {reloj} {paso} {dibujar} dims={(a) => (a < 560 ? [600, 560] : [900, 340])} etiqueta="Dos fuentes sobre una carga: cada una sola y las dos juntas" />
  {/snippet}
  {#snippet controles()}
    <Deslizador etiqueta="V_1" bind:valor={V1} min={0} max={24} paso={0.5} unidad="V" />
    <Deslizador etiqueta="V_2" bind:valor={V2} min={-12} max={24} paso={0.5} unidad="V" />
    <Deslizador etiqueta="R_a" bind:valor={Ra} min={100} max={10000} log unidad="Ω" />
    <Deslizador etiqueta="R_b" bind:valor={Rb} min={100} max={10000} log unidad="Ω" />
    <Deslizador etiqueta="R_L (carga)" bind:valor={RL} min={100} max={20000} log unidad="Ω" />
    <Interruptor etiqueta="Diodo en serie con la carga (no lineal)" bind:valor={conDiodo} />
  {/snippet}
</Marco>
