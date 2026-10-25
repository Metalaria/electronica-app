<script lang="ts">
  // Power, heating and derating (book 2.8): P = V²/R becomes body temperature T = T_a + θ·P, with the
  // book's 0,25 W resistor rated at 70 °C and derated linearly to 0 W at 155 °C (θ = 340 °C/W).
  import { compartir3d } from '../../tres/compartir.svelte';
  import { untrack } from 'svelte';
  import Escena from '../ui/Escena.svelte';
  import Marco from '../ui/Marco.svelte';
  import Deslizador from '../ui/Deslizador.svelte';
  import Selector from '../ui/Selector.svelte';
  import Grafica from '../ui/Grafica.svelte';
  import { Reloj, Muestreo } from '../nucleo/reloj.svelte';
  import { txt, txtRico, fondo, rr, brillo, azar, type Vista } from '../nucleo/dibujo';
  import { resistenciaAxial, ondasCalor, pata } from '../nucleo/piezas';
  import { alfa, mezcla, paleta, colorTemperatura, colorCalor } from '../nucleo/paleta';
  import { COLORES, bandasDe, indiceMultiplicador } from '../nucleo/fisica';
  import { si, num, pct } from '../nucleo/formato';
  import { app } from '../../../lib/estado.svelte';

  const reloj = new Reloj();
  const pal = $derived(paleta(app.tema));

  let V = $state(5);
  let R = $state(100);
  let Ta = $state(25);
  const PN = 0.25;
  const TREF = 70;
  const TMAX = 155;
  const THETA = (TMAX - TREF) / PN;

  const P = $derived((V * V) / R);
  const I = $derived(V / R);
  const pMax = (ta: number) => (ta <= TREF ? PN : ta >= TMAX ? 0 : (PN * (TMAX - ta)) / (TMAX - TREF));
  const objetivo = $derived(Ta + THETA * P);
  const uso = $derived(P / Math.max(pMax(Ta), 1e-9));

  // Body temperature follows the target with a thermal time constant.
  let tc = 25;
  let tcMostrada = $state(25);
  let t = 0;
  const muestreo = new Muestreo(100);
  let primera = true;
  const humo: { x: number; y: number; t: number }[] = [];
  const rnd = azar(11);

  $effect(() => {
    if (reloj.reinicios > 0) untrack(() => (tc = Ta));
  });

  function paso(dt: number): void {
    if (primera) {
      tc = objetivo;
      primera = false;
    }
    t += dt;
    tc += (objetivo - tc) * (1 - Math.exp(-dt / 5));
    if (tc > 320 && rnd() < dt * 8 * Math.min(1, (tc - 320) / 300)) humo.push({ x: 0, y: 0, t: 0 });
    for (const h of humo) h.t += dt;
    while (humo.length && humo[0]!.t > 3) humo.shift();
    if (muestreo.toca()) tcMostrada = tc;
  }

  function bandas(valor: number): string[] {
    const b = bandasDe(valor, 2);
    if (!b) return [];
    return [...b.digitos.map((d) => COLORES[d]!.color), COLORES[indiceMultiplicador(b.mult)]!.color, COLORES[10]!.color];
  }

  function dibujar(v: Vista): void {
    const { ctx } = v;
    const p = pal;
    void [V, R, Ta];
    const temp = reloj.play ? tc : objetivo;
    fondo(v);
    const est = v.estrecho;
    const yPcb = est ? 380 : 330;
    // PCB.
    rr(ctx, 30, yPcb, v.w - 60, 40, 6);
    ctx.fillStyle = p.oscuro ? '#1f4a35' : '#2f6b4c';
    ctx.fill();
    ctx.fillStyle = alfa('#d9b44a', 0.85);
    ctx.fillRect(v.w * 0.18, yPcb + 6, 40, 8);
    ctx.fillRect(v.w * 0.82 - 40, yPcb + 6, 40, 8);
    // Leads bent down to the board.
    const yc = yPcb - (est ? 120 : 100);
    const x0 = v.w * 0.3;
    const x1 = v.w * 0.7;
    const r = est ? 48 : 40;
    for (const [xa, xb] of [
      [v.w * 0.18 + 20, x0],
      [x1, v.w * 0.82 - 20],
    ] as const) {
      pata(ctx, xa, xb, yc, 6, p);
      const xv = xa < x0 ? xa : xb;
      ctx.fillStyle = p.estano;
      ctx.fillRect(xv - 3, yc, 6, yPcb + 8 - yc);
    }
    // Hot body: glow, colour and heat waves.
    const k = Math.min(1, Math.max(0, (temp - Ta) / 200));
    if (temp > 45) brillo(ctx, (x0 + x1) / 2, yc, (x1 - x0) * 0.75, temp > 300 ? '#ff5a1f' : p.calor, Math.min(0.55, 0.08 + 0.45 * k));
    const base = colorTemperatura(p.laca, temp);
    resistenciaAxial(ctx, p, {
      x0,
      x1,
      yc,
      r,
      cuerpo: base,
      bandas: bandas(R).map((c, i) => ({ f: [0.24, 0.36, 0.48, 0.78][i]!, color: temp > 420 ? mezcla(c, base, 0.75) : c })),
    });
    if (temp > 420) brillo(ctx, (x0 + x1) / 2, yc, (x1 - x0) * 0.45, '#ff8a1e', Math.min(0.7, (temp - 420) / 500));
    ondasCalor(ctx, x0 + 10, x1 - 10, yc - r - 6, k, t, p.calor);
    for (const h of humo) {
      const yy = yc - r - 20 - h.t * 50;
      const xx = (x0 + x1) / 2 + Math.sin(h.t * 2 + h.x) * 20 * h.t;
      brillo(ctx, xx, yy, 18 + h.t * 16, p.oscuro ? '#9aa0a6' : '#5f6368', 0.35 * (1 - h.t / 3));
    }

    // Thermometer.
    const tx = v.w - (est ? 54 : 70);
    const ty0 = est ? 60 : 40;
    const ty1 = yPcb - 30;
    rr(ctx, tx - 9, ty0, 18, ty1 - ty0, 9);
    ctx.fillStyle = p.panel;
    ctx.fill();
    ctx.strokeStyle = p.linea;
    ctx.stroke();
    const fr = Math.min(1, Math.max(0, temp / 600));
    const yT = ty1 - 8 - fr * (ty1 - ty0 - 16);
    rr(ctx, tx - 5, yT, 10, ty1 - 4 - yT, 5);
    ctx.fillStyle = colorCalor(fr * 1.4);
    ctx.fill();
    for (const [val, nombre] of [
      [TMAX, '155 °C máx.'],
      [100, '100 °C'],
      [25, '25 °C'],
    ] as const) {
      const yy = ty1 - 8 - (val / 600) * (ty1 - ty0 - 16);
      ctx.strokeStyle = val === TMAX ? p.peligro : p.suave;
      ctx.beginPath();
      ctx.moveTo(tx - 14, yy);
      ctx.lineTo(tx - 9, yy);
      ctx.stroke();
      txt(v, nombre, tx - 18, yy, { tam: 11, alin: 'right', color: val === TMAX ? p.peligro : p.suave });
    }
    txt(v, `${num(temp, 0)} °C`, tx, ty0 - 14, { tam: 15, peso: 800, color: temp > TMAX ? p.peligro : p.tinta });

    // Values.
    txtRico(v, `P = V²/R = ${si(P, 'W', 3)}`, est ? 40 : 60, est ? 40 : 46, { alin: 'left', tam: 16, peso: 800, color: p.calor });
    txtRico(v, `I = ${si(I, 'A', 3)}   ·   T_a = ${num(Ta, 0)} °C`, est ? 40 : 60, est ? 68 : 74, { alin: 'left', tam: 13.5, color: p.suave });
    txt(v, `Resistencia de ${si(PN, 'W', 2)} (película de carbón), ${si(R, 'Ω', 3)}`, (x0 + x1) / 2, yPcb + 62, { tam: 13, color: p.suave });
    if (temp > TMAX) txt(v, temp > 420 ? '¡Se está quemando!' : 'Por encima de su temperatura máxima', (x0 + x1) / 2, yc - r - (est ? 90 : 76), { tam: 15, peso: 800, color: p.peligro });
  }

  const curva = $derived.by(() => {
    const xs: number[] = [];
    const ys: number[] = [];
    for (let ta = 0; ta <= 170; ta += 1) {
      xs.push(ta);
      ys.push(pMax(ta));
    }
    return { xs, ys, mitad: ys.map((y) => y / 2) };
  });

  const texto = $derived.by(() => {
    const base = `La resistencia convierte ${si(P, 'W', 3)} en calor y su cuerpo se estabiliza a unos ${num(objetivo, 0)} °C: ${num(Ta, 0)} °C de ambiente más ${num(THETA, 0)} °C por vatio.\n`;
    if (uso <= 0.5) return base + `Usa el ${pct(uso, 0)} de lo que admite a ${num(Ta, 0)} °C: dentro de la regla sensata de no pasar del 50 %, con poca deriva y larga vida.`;
    if (uso <= 1)
      return base + `Usa el ${pct(uso, 0)} de lo admisible: está dentro de la curva, pero caliente; su valor deriva según su TCR y calienta lo que tenga al lado.`;
    return (
      base +
      `Pide el ${pct(uso, 0)} de lo que admite a esta temperatura ambiente: está **por encima de la curva de derating** y se degradará (cambia de valor o se abre). Hace falta más potencia nominal o repartirla entre varias.`
    );
  });

  const lecturas = $derived([
    { e: 'Potencia', v: si(P, 'W', 3), c: pal.calor },
    { e: 'Admisible a T_a', v: si(pMax(Ta), 'W', 3) },
    { e: 'Uso', v: pct(uso, 0), c: uso > 1 ? pal.peligro : uso > 0.5 ? pal.aviso : pal.bien },
    { e: 'Temperatura del cuerpo', v: `${num(tcMostrada, 0)} °C` },
    { e: 'Corriente', v: si(I, 'A', 3) },
  ]);

  // 3D view of the page (componentes/tres): the model follows these controls.
  compartir3d(() => ({ R }));
</script>

<Marco {reloj} {texto} {lecturas} leyenda={['calor']}>
  {#snippet escena()}
    <Escena {reloj} {paso} {dibujar} dims={(a) => (a < 560 ? [560, 500] : [900, 420])} etiqueta="Resistencia que se calienta al disipar potencia" />
  {/snippet}
  {#snippet controles()}
    <Deslizador etiqueta="Tensión V" bind:valor={V} min={0} max={40} paso={0.1} unidad="V" />
    <Selector
      etiqueta="Resistencia R"
      bind:valor={R}
      opciones={[47, 100, 220, 470, 1000].map((x) => ({ valor: x, texto: si(x, 'Ω', 2).replace(',0', '') }))}
    />
    <Deslizador etiqueta="Temperatura ambiente T_a" bind:valor={Ta} min={0} max={150} paso={1} formato={(x) => `${num(x, 0)} °C`} />
  {/snippet}
  {#snippet grafica()}
    <Grafica
      titulo="Curva de derating (0,25 W a 70 °C)"
      x={{ etiqueta: 'T_a', unidad: '°C', min: 0, max: 170 }}
      y={{ etiqueta: 'P', unidad: 'W', min: 0, max: 0.4 }}
      series={[
        { x: curva.xs, y: curva.ys, color: pal.acento, nombre: 'máxima' },
        { x: curva.xs, y: curva.mitad, color: pal.bien, discontinua: true, nombre: '50 %' },
      ]}
      puntos={[{ x: Ta, y: Math.min(P, 0.4), color: uso > 1 ? pal.peligro : pal.calor, etiqueta: si(P, 'W', 3) }]}
    />
  {/snippet}
</Marco>
