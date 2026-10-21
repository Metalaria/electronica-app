<script lang="ts">
  // Parallel plates (book 3.1): charge accumulates, the field appears in the dielectric, the dielectric
  // polarises. C = ε₀·ε_r·A/d, Q = C·V, E = V/d, energy ½·C·V². Book table: 1 cm², 10 µm → 88,5 pF in air.
  import { untrack } from 'svelte';
  import Escena from '../ui/Escena.svelte';
  import Marco from '../ui/Marco.svelte';
  import Deslizador from '../ui/Deslizador.svelte';
  import Selector from '../ui/Selector.svelte';
  import Interruptor from '../ui/Interruptor.svelte';
  import Grafica from '../ui/Grafica.svelte';
  import { Reloj, Muestreo } from '../nucleo/reloj.svelte';
  import { txt, txtRico, fondo, flecha, Camino, electronesEnCamino, corrienteEnCamino, type Vista } from '../nucleo/dibujo';
  import { bateria, interruptor, hilo } from '../nucleo/esquema';
  import { alfa, mezcla, paleta } from '../nucleo/paleta';
  import { EPS0 } from '../nucleo/fisica';
  import { si, num } from '../nucleo/formato';
  import { app } from '../../../lib/estado.svelte';

  const reloj = new Reloj();
  const pal = $derived(paleta(app.tema));

  const DIELECTRICOS = [
    { valor: 1, texto: 'Aire (1)' },
    { valor: 3.5, texto: 'Poliéster (3,5)' },
    { valor: 1000, texto: 'X7R (1 000)' },
    { valor: 4000, texto: 'Y5V (4 000)' },
  ];
  let V = $state(10);
  let d = $state(10e-6);
  let A = $state(1e-4);
  let er = $state(3.5);
  let conectado = $state(true);

  const C = $derived((EPS0 * er * A) / d);

  // Charge on the plates, seen in slow motion: it follows C·V while connected and stays when disconnected
  // (then the voltage V_c = Q/C changes if the geometry changes).
  let qa = 0;
  let qMostrada = $state(0);
  let fase = 0;
  let flujo = 0;
  const muestreo = new Muestreo(80);
  $effect(() => {
    if (reloj.reinicios > 0) untrack(() => (qa = 0));
  });

  function paso(dt: number): void {
    const objetivo = conectado ? C * V : qa;
    const dq = (objetivo - qa) * (1 - Math.exp(-dt / 0.9));
    qa += dq;
    // Relative current for the moving electrons (positive: charging).
    flujo = Math.max(-1, Math.min(1, (dq / Math.max(dt, 1e-6)) / Math.max(C * 20, 1e-15) / 0.6));
    fase += flujo * 160 * dt;
    if (muestreo.toca()) qMostrada = qa;
  }
  const Vc = $derived(C > 0 ? qMostrada / C : 0);

  // Dipoles of the dielectric.
  const dipolos = Array.from({ length: 48 }, (_, i) => ({ i, a0: ((i * 2.399) % (Math.PI * 2)) - Math.PI }));

  function dibujar(v: Vista): void {
    void [V, d, A, er, conectado];
    const { ctx } = v;
    const p = pal;
    fondo(v);
    const est = v.estrecho;
    const cx = est ? v.w / 2 + 20 : v.w * 0.56;
    // Plate geometry: separation and size grow with d and A (logarithmic, for display).
    const ancho = (est ? 190 : 300) * (0.6 + 0.4 * Math.sqrt(A / 4e-4));
    const sep = 70 + 110 * Math.log10(d / 1e-6) / Math.log10(10);
    const yTop = (est ? 300 : 230) - sep / 2;
    const yBot = yTop + sep;
    const prof = 36;
    const x0 = cx - ancho / 2;
    const x1 = cx + ancho / 2;

    // Dielectric volume.
    if (er > 1) {
      const col = er >= 1000 ? mezcla(p.ceramica, '#c9b48a', 0.25) : mezcla(p.cuarzo, '#9fc6a0', 0.3);
      ctx.fillStyle = alfa(col, 0.85);
      ctx.beginPath();
      ctx.moveTo(x0, yTop + 6);
      ctx.lineTo(x0 + prof, yTop - prof + 6);
      ctx.lineTo(x1 + prof, yTop - prof + 6);
      ctx.lineTo(x1 + prof, yBot - prof - 6);
      ctx.lineTo(x1, yBot - 6);
      ctx.lineTo(x0, yBot - 6);
      ctx.closePath();
      ctx.fill();
    }
    // Field lines (density ∝ E = V/d).
    const vc = qa / C;
    const E = vc / d;
    const qv = Math.min(1, Math.max(0, qa / Math.max(C * 20, 1e-18)) * 2);
    const densidad = Math.min(1, E / 2e6);
    const nLineas = Math.round(3 + 14 * densidad);
    for (let k = 0; k < nLineas; k++) {
      const x = x0 + 14 + ((ancho - 28) * (k + 0.5)) / nLineas;
      flecha(ctx, x, yTop + 10, x, yBot - 10, alfa(p.campoE, 0.25 + 0.6 * densidad), 1.6, 8);
    }
    // Dipoles align with the field: alignment (ε_r − 1)/ε_r.
    if (er > 1) {
      const alin = ((er - 1) / er) * qv;
      const filas = 4;
      const cols = 12;
      for (const dp of dipolos) {
        const fx = (dp.i % cols) + 0.5;
        const fy = Math.floor(dp.i / cols) + 0.5;
        const x = x0 + 10 + ((ancho - 20) * fx) / cols;
        const y = yTop + 12 + ((sep - 24) * fy) / filas;
        // Angle measured from the downward field direction.
        const a = dp.a0 * (1 - alin) + Math.sin(v.t * 3 + dp.i) * 0.15 * (1 - alin);
        const L = 9;
        const dx = Math.sin(a) * L;
        const dy = Math.cos(a) * L;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(-a);
        ctx.beginPath();
        ctx.ellipse(0, 0, 4.5, L, 0, 0, Math.PI * 2);
        ctx.fillStyle = alfa(p.panel, 0.9);
        ctx.fill();
        ctx.strokeStyle = alfa(p.suave, 0.7);
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.restore();
        // − end towards the + plate (up), + end towards the − plate (down).
        txt(v, '−', x - dx * 0.6, y - dy * 0.6, { tam: 9, peso: 800, color: p.electron });
        txt(v, '+', x + dx * 0.6, y + dy * 0.6, { tam: 9, peso: 800, color: p.hueco });
      }
    }
    // Plates (metal slabs in perspective).
    const placa = (y: number) => {
      ctx.beginPath();
      ctx.moveTo(x0, y);
      ctx.lineTo(x0 + prof, y - prof);
      ctx.lineTo(x1 + prof, y - prof);
      ctx.lineTo(x1, y);
      ctx.closePath();
      ctx.fillStyle = mezcla(p.aluminio, '#ffffff', 0.35);
      ctx.fill();
      ctx.fillStyle = p.aluminio;
      ctx.fillRect(x0, y, ancho, 8);
      ctx.beginPath();
      ctx.moveTo(x1, y);
      ctx.lineTo(x1 + prof, y - prof);
      ctx.lineTo(x1 + prof, y - prof + 8);
      ctx.lineTo(x1, y + 8);
      ctx.closePath();
      ctx.fillStyle = mezcla(p.aluminio, '#000000', 0.2);
      ctx.fill();
    };
    placa(yTop - 8);
    placa(yBot);
    // Free charges (count ∝ log Q for display).
    const nCargas = qa > 1e-15 ? Math.round(Math.min(26, 2 + 3.4 * Math.log10(Math.max(1, (qa * 1e12) / 5)))) : 0;
    for (let k = 0; k < nCargas; k++) {
      const x = x0 + 12 + ((ancho - 24) * (k + 0.5)) / nCargas;
      txt(v, '+', x, yTop - 2, { tam: 13, peso: 800, color: p.positivo });
      ctx.fillStyle = p.electron;
      ctx.beginPath();
      ctx.arc(x, yBot + 4, 3.6, 0, Math.PI * 2);
      ctx.fill();
    }

    // Circuit: battery and switch on the left.
    const xb = est ? 60 : x0 - 150;
    const circuito = new Camino([
      [cx, yTop - 8],
      [cx, yTop - 60],
      [xb, yTop - 60],
      [xb, yBot + 60],
      [cx, yBot + 60],
      [cx, yBot + 8],
    ]);
    hilo(v, [
      [cx, yTop - 8],
      [cx, yTop - 60],
      [xb + 50, yTop - 60],
    ]);
    interruptor(v, xb + 50, yTop - 60, xb, yTop - 60, conectado ? 1 : 0);
    hilo(v, [
      [xb, yTop - 60],
      [xb, (yTop + yBot) / 2 - 24],
    ]);
    bateria(v, xb, (yTop + yBot) / 2 - 24, xb, (yTop + yBot) / 2 + 24, {});
    hilo(v, [
      [xb, (yTop + yBot) / 2 + 24],
      [xb, yBot + 60],
      [cx, yBot + 60],
      [cx, yBot + 8],
    ]);
    txtRico(v, `${num(V, 1)} V`, est ? xb + 24 : xb - 22, (yTop + yBot) / 2, { alin: est ? 'left' : 'right', tam: 14, peso: 700, color: p.acento });
    const k = Math.min(1, Math.abs(flujo) * 3);
    if (conectado && k > 0.03) {
      electronesEnCamino(ctx, circuito, -fase, 20, 3.4, p, k);
      corrienteEnCamino(ctx, circuito, fase * 0.6, 110, p, 11, k);
    }
    // Labels.
    txtRico(v, `+Q = ${si(qa, 'C', 3)}`, x1 + prof + 12, yTop - 20, { alin: 'left', tam: 13.5, peso: 700, color: p.positivo });
    txtRico(v, `−Q`, x1 + prof + 12, yBot - 6, { alin: 'left', tam: 13.5, peso: 700, color: p.electron });
    txtRico(v, `d = ${si(d, 'm', 2)}`, x1 + prof + 12, (yTop + yBot) / 2 - 8, { alin: 'left', tam: 13, color: p.suave });
    txtRico(v, `E = ${si(E, 'V/m', 3)}`, x1 + prof + 12, (yTop + yBot) / 2 + 14, { alin: 'left', tam: 13, peso: 700, color: p.campoE });
    txtRico(v, `C = ε_0·ε_r·A/d = ${si(C, 'F', 3)}`, est ? v.w / 2 : cx, v.h - 26, { tam: 16, peso: 800, color: p.acento, fondo: alfa(p.acento, 0.1) });
  }

  const energia = $derived(0.5 * C * Vc * Vc);
  const texto = $derived(
    (conectado
      ? `Al cerrar el interruptor, la pila arranca electrones de la placa superior y los empuja a la inferior: una queda con +Q y la otra con −Q (la carga total sigue siendo cero). `
      : `Desconectado, la carga se queda en las placas: el condensador sigue cargado (ahora a ${num(Vc, 2)} V) y el campo sigue ahí. `) +
      `Q = C·V = ${si(qMostrada, 'C', 3)}.\n` +
      (er > 1
        ? `El dieléctrico se **polariza**: sus moléculas se orientan contra el campo y lo debilitan por dentro, de modo que a la misma tensión cabe ${num(er, er < 10 ? 1 : 0)} veces más carga que con aire. `
        : 'Con aire no hay nada que polarizar: ε_r = 1. ') +
      `La energía, ½·C·V² = ${si(energia, 'J', 3)}, está en el campo del dieléctrico, no en las placas.`,
  );

  const lecturas = $derived([
    { e: 'Capacidad C', v: si(C, 'F', 3), c: pal.acento },
    { e: 'Carga Q', v: si(qMostrada, 'C', 3) },
    { e: 'Tensión entre placas', v: `${num(Vc, 2)} V` },
    { e: 'Campo E = V/d', v: si(Vc / d, 'V/m', 3), c: pal.campoE },
    { e: 'Energía ½·C·V²', v: si(energia, 'J', 3) },
  ]);
</script>

<Marco {reloj} {texto} {lecturas} leyenda={['electron', 'corriente', 'campoE']}>
  {#snippet escena()}
    <Escena {reloj} {paso} {dibujar} dims={(a) => (a < 560 ? [560, 600] : [900, 470])} etiqueta="Condensador de placas paralelas cargándose" />
  {/snippet}
  {#snippet controles()}
    <Interruptor etiqueta="Interruptor cerrado (conectado a la pila)" bind:valor={conectado} />
    <Deslizador etiqueta="Tensión de la pila V" bind:valor={V} min={0} max={20} paso={0.5} unidad="V" />
    <Selector etiqueta="Dieléctrico (ε_r)" bind:valor={er} opciones={DIELECTRICOS} />
    <Deslizador etiqueta="Separación d" bind:valor={d} min={1e-6} max={100e-6} log unidad="m" />
    <Deslizador etiqueta="Área A" bind:valor={A} min={0.25e-4} max={4e-4} paso={0.25e-4} formato={(x) => `${num(x * 1e4, 2)} cm²`} />
  {/snippet}
  {#snippet grafica()}
    <Grafica
      titulo="Carga frente a tensión: la pendiente es C"
      x={{ etiqueta: 'V', unidad: 'V', min: 0, max: 20 }}
      y={{ etiqueta: 'Q', unidad: 'C', min: 0, max: Math.max(C * 20, 1e-12) }}
      series={[{ x: [0, 20], y: [0, C * 20], color: pal.acento }]}
      puntos={[{ x: Vc, y: qMostrada, color: pal.positivo, etiqueta: si(qMostrada, 'C', 3) }]}
    />
  {/snippet}
</Marco>
