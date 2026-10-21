<script lang="ts">
  // Where resistance comes from (book 2.1): electrons accelerated by the field between collisions with
  // the vibrating lattice; their average drift is proportional to the field, hence I = V/R. A hotter metal
  // vibrates more, collides more and resists more (+3 900 ppm/°C for copper).
  import { untrack } from 'svelte';
  import Escena from '../ui/Escena.svelte';
  import Marco from '../ui/Marco.svelte';
  import Deslizador from '../ui/Deslizador.svelte';
  import Grafica from '../ui/Grafica.svelte';
  import { Reloj, Muestreo } from '../nucleo/reloj.svelte';
  import { txt, txtRico, fondo, rr, flecha, brillo, electrones, azar, circulo, sprite, type Vista } from '../nucleo/dibujo';
  import { resistencia, bateria, hilo } from '../nucleo/esquema';
  import { alfa, mezcla, paleta } from '../nucleo/paleta';
  import { si, num } from '../nucleo/formato';
  import { app } from '../../../lib/estado.svelte';

  const reloj = new Reloj();
  const pal = $derived(paleta(app.tema));

  let V = $state(6);
  let T = $state(20);
  const R0 = 10;
  const ALFA = 0.0039;
  const R = $derived(R0 * (1 + ALFA * (T - 20)));
  const I = $derived(V / R);

  // Lattice and electrons (logical coordinates of the zoomed conductor).
  interface Ion {
    x: number;
    y: number;
    fx: number;
    fy: number;
    golpe: number;
  }
  interface El {
    x: number;
    y: number;
    vx: number;
    vy: number;
    prox: number;
  }
  let iones: Ion[] = [];
  let els: El[] = [];
  let caja = { x0: 0, x1: 0, y0: 0, y1: 0 };
  let claveCaja = '';
  const rnd = azar(3);
  let choques = 0;
  let tasa = $state(0);
  const muestreo = new Muestreo(500);
  let ventana = 0;

  function preparar(x0: number, x1: number, y0: number, y1: number): void {
    const clave = `${x0},${x1},${y0},${y1}`;
    if (clave === claveCaja) return;
    claveCaja = clave;
    caja = { x0, x1, y0, y1 };
    iones = [];
    const sx = 56;
    const sy = 46;
    for (let y = y0 + sy / 2; y < y1; y += sy)
      for (let x = x0 + sx / 2 + (((y - y0) / sy) % 2 ? sx / 2 : 0); x < x1 - 10; x += sx)
        iones.push({ x, y, fx: rnd() * 6.28, fy: rnd() * 6.28, golpe: 0 });
    els = [];
    for (let k = 0; k < 70; k++) els.push({ x: x0 + rnd() * (x1 - x0), y: y0 + rnd() * (y1 - y0), vx: 0, vy: 0, prox: rnd() * 0.2 });
    for (const e of els) dispersar(e);
  }

  function dispersar(e: El): void {
    // Thermal speed grows with √T; the direction after a collision is random.
    const vt = 150 * Math.sqrt((T + 273) / 293);
    const a = rnd() * Math.PI * 2;
    e.vx = Math.cos(a) * vt;
    e.vy = Math.sin(a) * vt;
  }

  $effect(() => {
    if (reloj.reinicios > 0) untrack(() => (claveCaja = ''));
  });

  function paso(dt: number): void {
    if (!iones.length) return;
    // Collision rate ∝ R (more lattice vibration → more scattering); acceleration ∝ V.
    // Drift = a/Γ ∝ V/R: the picture obeys Ohm's law by construction.
    const gamma = 7 * (R / R0);
    const a = -((V * 7) / (R / R0)) * gamma; // towards the left (+ terminal)
    const { x0, x1, y0, y1 } = caja;
    for (const e of els) {
      e.vx += a * dt;
      e.x += e.vx * dt;
      e.y += e.vy * dt;
      e.prox -= dt;
      if (e.prox <= 0) {
        e.prox = -Math.log(1 - rnd()) / gamma;
        // Flash the nearest ion: the energy gained from the field becomes lattice vibration (heat).
        let mejor: Ion | null = null;
        let d = 1e9;
        for (const io of iones) {
          const dd = Math.abs(io.x - e.x) + Math.abs(io.y - e.y);
          if (dd < d) {
            d = dd;
            mejor = io;
          }
        }
        if (mejor && d < 70) mejor.golpe = Math.min(1, mejor.golpe + 0.35 + Math.min(0.6, V / 20));
        dispersar(e);
        choques++;
      }
      if (e.y < y0 + 4) {
        e.y = y0 + 4;
        e.vy = Math.abs(e.vy);
      } else if (e.y > y1 - 4) {
        e.y = y1 - 4;
        e.vy = -Math.abs(e.vy);
      }
      // Electrons leaving on the left re-enter on the right (the circuit closes the loop).
      if (e.x < x0) e.x += x1 - x0;
      else if (e.x > x1) e.x -= x1 - x0;
    }
    for (const io of iones) {
      io.fx += dt * 23;
      io.fy += dt * 19;
      io.golpe = Math.max(0, io.golpe - dt * 2.2);
    }
    ventana += dt;
    if (muestreo.toca()) {
      tasa = ventana > 0 ? choques / ventana : 0;
      choques = 0;
      ventana = 0;
    }
  }

  function dibujar(v: Vista): void {
    const { ctx } = v;
    const p = pal;
    void [V, T];
    fondo(v);
    const est = v.estrecho;
    // Circuit at the top: battery, resistor (zoomed below).
    const yC = est ? 70 : 56;
    const xL = v.w * 0.2;
    const xR = v.w * 0.8;
    const xm = v.w / 2;
    hilo(v, [
      [xL, yC + 34],
      [xL, yC],
      [xm - 40, yC],
    ]);
    hilo(v, [
      [xm + 40, yC],
      [xR, yC],
      [xR, yC + 34],
    ]);
    const calor = Math.min(1, (V * I) / 15);
    resistencia(v, xm - 40, yC, xm + 40, yC, { largo: 64, alto: 22, relleno: mezcla(p.fondo, p.calor, calor * 0.6) });
    bateria(v, xL, yC + 34, xL, yC + 80, {});
    hilo(v, [
      [xL, yC + 80],
      [xL, yC + 96],
      [xR, yC + 96],
      [xR, yC + 34],
    ]);
    txtRico(v, `V = ${num(V, 1)} V`, xL - 18, yC + 57, { alin: 'right', tam: 14, peso: 700, color: p.acento });
    txtRico(v, `R = ${num(R, 2)} Ω`, xm, yC - 24, { tam: 14, peso: 700 });
    flecha(ctx, xm + 52, yC - 12, xm + 92, yC - 12, p.corriente, 2.2, 9);
    txtRico(v, `I = ${si(I, 'A', 3)}`, xm + 98, yC - 12, { alin: 'left', tam: 14, peso: 700, color: p.corriente });

    // Zoomed conductor.
    const x0 = 40;
    const x1 = v.w - 40;
    const y0 = yC + 140;
    const y1 = v.h - (est ? 90 : 54);
    preparar(x0, x1, y0, y1);
    ctx.strokeStyle = alfa(p.suave, 0.5);
    ctx.setLineDash([4, 4]);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(xm - 40, yC + 12);
    ctx.lineTo(x0, y0);
    ctx.moveTo(xm + 40, yC + 12);
    ctx.lineTo(x1, y0);
    ctx.stroke();
    ctx.setLineDash([]);
    rr(ctx, x0, y0, x1 - x0, y1 - y0, 10);
    const gr = ctx.createLinearGradient(0, y0, 0, y1);
    gr.addColorStop(0, mezcla(p.cobreClaro, p.fondo, 0.72));
    gr.addColorStop(1, mezcla(p.cobre, p.fondo, 0.72));
    ctx.fillStyle = gr;
    ctx.fill();
    ctx.strokeStyle = alfa(p.cobre, 0.6);
    ctx.stroke();
    txt(v, '+', x0 + 14, y0 + 16, { tam: 18, peso: 800, color: p.positivo });
    txt(v, '−', x1 - 14, y0 + 16, { tam: 18, peso: 800 });

    // Lattice ions vibrating (amplitude ∝ √T), glowing when hit.
    const amp = 2.2 * Math.sqrt((T + 273) / 293) + (T > 100 ? (T - 100) / 90 : 0);
    ctx.save();
    ctx.beginPath();
    ctx.rect(x0, y0, x1 - x0, y1 - y0);
    ctx.clip();
    for (const io of iones) {
      const x = io.x + Math.sin(io.fx) * amp;
      const y = io.y + Math.cos(io.fy) * amp;
      if (io.golpe > 0.02) brillo(ctx, x, y, 24, p.calor, 0.55 * io.golpe);
      sprite(v, 'ion-cobre', 13, x, y, (c) => {
        const g = c.createRadialGradient(-4, -4, 1, 0, 0, 13);
        g.addColorStop(0, mezcla(p.cobreClaro, '#ffffff', 0.4));
        g.addColorStop(1, p.cobre);
        circulo(c, 0, 0, 12, undefined);
        c.fillStyle = g;
        c.fill();
        c.font = v.fuente(12, 700);
        c.textAlign = 'center';
        c.textBaseline = 'middle';
        c.fillStyle = 'rgba(255,255,255,0.9)';
        c.fillText('+', 0, 0.5);
      });
    }
    electrones(ctx, els, 4.2, p);
    ctx.restore();

    // Field and drift arrows.
    const ya = y1 + (est ? 30 : 26);
    flecha(ctx, x1 - 20, ya, x1 - 160, ya, p.campoE, 2.2, 10);
    txt(v, 'campo E', x1 - 170, ya, { alin: 'right', tam: 13, peso: 700, color: p.campoE });
    flecha(ctx, x0 + 20, ya, x0 + 110, ya, p.corriente, 2.6, 11);
    txt(v, 'I', x0 + 120, ya, { alin: 'left', tam: 14, peso: 800, color: p.corriente });
    const yd = est ? ya + 32 : ya;
    const xd = est ? x1 - 20 : (x0 + x1) / 2 + 60;
    flecha(ctx, xd, yd, xd - 80, yd, p.electron, 2, 9, [5, 4]);
    txt(v, 'deriva de los electrones', xd - 90, yd, { alin: 'right', tam: 13, peso: 700, color: p.electron });
  }

  // Real drift velocity in a copper wire of 0,5 mm² at this current: v = I/(n·q·A).
  const vDeriva = $derived(I / (8.5e28 * 1.602e-19 * 0.5e-6));

  const texto = $derived(
    `Los electrones libres se mueven al azar a gran velocidad y **chocan continuamente con la red**; el campo los acelera un poco entre choque y choque, y en cada choque ceden lo ganado como vibración de la red: calor.\n` +
      `El resultado es una deriva lenta proporcional al campo: con ${num(V, 1)} V y ${num(R, 2)} Ω circulan ${si(I, 'A', 3)}. ` +
      (T > 60
        ? `A ${num(T, 0)} °C la red vibra más, hay más choques y la resistencia ha subido un ${num((R / R0 - 1) * 100, 0)} %.`
        : T < 0
          ? `En frío la red vibra menos y la resistencia baja (${num((R / R0 - 1) * 100, 0)} %).`
          : 'Con un metal más caliente habría más choques y más resistencia.'),
  );

  const lecturas = $derived([
    { e: 'Corriente I = V/R', v: si(I, 'A', 3), c: pal.corriente },
    { e: 'Resistencia R(T)', v: si(R, 'Ω', 3) },
    { e: 'Potencia P = V·I', v: si(V * I, 'W', 3), c: pal.calor },
    { e: 'Deriva real en Cu de 0,5 mm²', v: si(vDeriva, 'm/s', 2) },
    { e: 'Choques por segundo (escena)', v: num(tasa, 0) },
  ]);

  const recta = $derived({ x: [0, 12], y: [0, 12 / R] });
</script>

<Marco {reloj} {texto} {lecturas} leyenda={['electron', 'corriente', 'campoE', 'calor']}>
  {#snippet escena()}
    <Escena {reloj} {paso} {dibujar} dims={(a) => (a < 560 ? [560, 600] : [900, 470])} etiqueta="Electrones derivando entre choques con la red cristalina" />
  {/snippet}
  {#snippet controles()}
    <Deslizador etiqueta="Tensión V" bind:valor={V} min={0} max={12} paso={0.1} unidad="V" />
    <Deslizador etiqueta="Temperatura del conductor" bind:valor={T} min={-50} max={300} paso={1} unidad="°C" formato={(x) => `${num(x, 0)} °C`} />
  {/snippet}
  {#snippet grafica()}
    <Grafica
      titulo="Ley de Ohm: I frente a V"
      x={{ etiqueta: 'V', unidad: 'V', min: 0, max: 12 }}
      y={{ etiqueta: 'I', unidad: 'A', min: 0, max: 1.6 }}
      series={[
        { x: [0, 12], y: [0, 1.2], color: pal.tenue, discontinua: true, nombre: '20 °C' },
        { x: recta.x, y: recta.y, color: pal.acento, nombre: `${num(T, 0)} °C` },
      ]}
      puntos={[{ x: V, y: I, color: pal.corriente, etiqueta: si(I, 'A', 3) }]}
    />
  {/snippet}
</Marco>
