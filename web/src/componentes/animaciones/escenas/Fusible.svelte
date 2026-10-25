<script lang="ts">
  // Fuse and resettable PTC (book 10.3 and 2.6): the fuse element heats by I²·R; with an overload its
  // temperature reaches the melting point after a time that falls roughly as 1/I² (the I²t of the fuse), the
  // wire opens and an arc may form. The polymer PTC instead jumps to a high resistance, limits the current,
  // and resets when the fault is removed and it cools.
  import { compartir3d } from '../../tres/compartir.svelte';
  import { untrack } from 'svelte';
  import Escena from '../ui/Escena.svelte';
  import Marco from '../ui/Marco.svelte';
  import Deslizador from '../ui/Deslizador.svelte';
  import Selector from '../ui/Selector.svelte';
  import Grafica from '../ui/Grafica.svelte';
  import { Reloj, Muestreo } from '../nucleo/reloj.svelte';
  import { txt, txtRico, fondo, rr, brillo, gradCilindro, Camino, electronesEnCamino, corrienteEnCamino, type Vista } from '../nucleo/dibujo';
  import { hilo, fuente, resistencia } from '../nucleo/esquema';
  import { alfa, mezcla, paleta, colorTemperatura } from '../nucleo/paleta';
  import { si, num } from '../nucleo/formato';
  import { app } from '../../../lib/estado.svelte';

  const reloj = new Reloj();
  const pal = $derived(paleta(app.tema));
  let tipo = $state<'fusible' | 'ptc'>('fusible');
  let RL = $state(24);
  const V = 12;
  const IN = 1;
  const TA = 25;
  const TM = 420;
  const THETA_R = 217; // °C per A² of the element at its own resistance
  const TAU = 1.2;

  // State.
  let T = TA;
  let fundido = false;
  let arco = 0;
  let tiempo = 0;
  let tt: number[] = [];
  let TT: number[] = [];
  let serie = $state.raw<{ t: number[]; T: number[] }>({ t: [], T: [] });
  let estado = $state({ T: TA, I: 0, fundido: false, rptc: 0.1 });
  const muestreo = new Muestreo(80);

  function rPTC(temp: number): number {
    // Polymer PTC: ~0,1 Ω cold, switching sharply around 125 °C.
    return 0.1 * (1 + Math.pow(Math.max(0, temp - 60) / 65, 14) * 400);
  }
  function corriente(): number {
    if (tipo === 'fusible') return fundido ? 0 : V / (RL + 0.05);
    return V / (RL + rPTC(T));
  }

  function reponer(): void {
    T = TA;
    fundido = false;
    arco = 0;
    tiempo = 0;
    tt = [];
    TT = [];
  }
  $effect(() => {
    void tipo;
    if (reloj.reinicios >= 0) untrack(reponer);
  });
  $effect(() => {
    void RL;
    untrack(() => {
      tiempo = 0;
      tt = [];
      TT = [];
    });
  });

  function paso(dt: number): void {
    tiempo += dt;
    const sub = 10;
    for (let k = 0; k < sub; k++) {
      const h = dt / sub;
      const I = corriente();
      const potencia = tipo === 'fusible' ? THETA_R * I * I : (I * I * rPTC(T)) * 60;
      T += ((TA + potencia - T) / TAU) * h;
      if (tipo === 'fusible' && !fundido && T >= TM) {
        fundido = true;
        arco = 1;
      }
    }
    arco = Math.max(0, arco - dt * 1.8);
    if (fundido) T += (TA - T) * dt * 0.8;
    if (tiempo < 20) {
      tt.push(tiempo);
      TT.push(T);
    }
    if (muestreo.toca()) {
      serie = { t: tt.slice(), T: TT.slice() };
      estado = { T, I: corriente(), fundido, rptc: rPTC(T) };
    }
  }

  function dibujar(v: Vista): void {
    void [tipo, RL];
    const { ctx } = v;
    const p = pal;
    fondo(v);
    const est = v.estrecho;
    const I = corriente();
    // Big component view.
    const cx = v.w / 2;
    const cy = est ? 130 : 120;
    if (tipo === 'fusible') {
      const L = est ? 360 : 440;
      const R = 34;
      const x0 = cx - L / 2;
      const x1 = cx + L / 2;
      // Glass tube.
      rr(ctx, x0 + 40, cy - R, L - 80, 2 * R, 10);
      ctx.fillStyle = alfa(p.cuarzo, 0.35);
      ctx.fill();
      ctx.strokeStyle = alfa(p.suave, 0.5);
      ctx.stroke();
      // End caps.
      for (const xa of [x0, x1 - 52]) {
        rr(ctx, xa, cy - R - 4, 52, 2 * R + 8, 6);
        ctx.fillStyle = gradCilindro(ctx, cy - R, cy + R, p.estano, p.oscuro);
        ctx.fill();
      }
      // Element with a notch, glowing with temperature.
      const col = colorTemperatura(mezcla(p.estano, '#9aa3ab', 0.4), T);
      if (T > 150) brillo(ctx, cx, cy, 80, '#ff7a1f', Math.min(0.6, (T - 150) / 400));
      ctx.strokeStyle = col;
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      if (!fundido) {
        ctx.beginPath();
        ctx.moveTo(x0 + 52, cy);
        ctx.lineTo(cx - 8, cy);
        ctx.lineTo(cx, cy - 3);
        ctx.lineTo(cx + 8, cy);
        ctx.lineTo(x1 - 52, cy);
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.moveTo(x0 + 52, cy);
        ctx.lineTo(cx - 30, cy + 4);
        ctx.moveTo(cx + 30, cy + 4);
        ctx.lineTo(x1 - 52, cy);
        ctx.stroke();
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.arc(cx - 30, cy + 6, 4, 0, Math.PI * 2);
        ctx.arc(cx + 30, cy + 6, 4, 0, Math.PI * 2);
        ctx.fill();
        if (arco > 0.02) {
          brillo(ctx, cx, cy, 60, '#bfe3ff', arco);
          brillo(ctx, cx, cy, 20, '#ffffff', arco);
        }
        txt(v, '¡fundido!', cx, cy - R - 22, { tam: 15, peso: 800, color: p.peligro });
      }
      txt(v, `fusible de ${si(IN, 'A', 1)} · se funde a unos ${TM} °C`, cx, cy + R + 22, { tam: 12.5, color: p.suave });
    } else {
      // Polymer PTC disc: carbon particles in a polymer that expands and breaks the paths when hot.
      const R = 56;
      const exp = Math.min(1, Math.max(0, (T - 90) / 50));
      if (T > 80) brillo(ctx, cx, cy, 100, p.calor, Math.min(0.4, (T - 80) / 150));
      rr(ctx, cx - R * 1.6, cy - R, R * 3.2, R * 2, 18);
      ctx.fillStyle = mezcla('#e6b800', p.fondo, 0.2);
      ctx.fill();
      for (let i = 0; i < 46; i++) {
        const fx = ((i * 0.618) % 1) - 0.5;
        const fy = ((i * 0.382 + 0.1) % 1) - 0.5;
        ctx.fillStyle = '#2b2b2b';
        ctx.beginPath();
        ctx.arc(cx + fx * R * 2.8 * (1 + exp * 0.25), cy + fy * R * 1.6 * (1 + exp * 0.25), 4, 0, Math.PI * 2);
        ctx.fill();
      }
      if (exp < 0.6) {
        ctx.strokeStyle = alfa('#2b2b2b', 0.6 * (1 - exp));
        ctx.lineWidth = 3;
        for (let r2 = -1; r2 <= 1; r2++) {
          ctx.beginPath();
          ctx.moveTo(cx - R * 1.5, cy + r2 * 22);
          ctx.lineTo(cx + R * 1.5, cy + r2 * 22);
          ctx.stroke();
        }
      }
      txt(v, exp > 0.5 ? 'caliente: el polímero se dilata y separa las partículas' : 'frío: las partículas de carbón forman caminos', cx, cy + R + 22, {
        tam: 12.5,
        color: exp > 0.5 ? p.calor : p.suave,
        peso: 700,
      });
    }
    // Circuit underneath.
    const y0 = est ? 260 : 230;
    const y1 = v.h - 30;
    const xa = cx - 170;
    const xb = cx + 170;
    fuente(v, xa, (y0 + y1) / 2, 22, 'dc', { rotulo: `${V} V`, lado: -1 });
    hilo(v, [
      [xa, (y0 + y1) / 2 - 22],
      [xa, y0],
      [cx - 40, y0],
    ]);
    rr(ctx, cx - 40, y0 - 10, 80, 20, 4);
    ctx.fillStyle = fundido ? alfa(p.peligro, 0.2) : p.panel;
    ctx.fill();
    ctx.strokeStyle = p.tinta;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx - 40, y0);
    ctx.lineTo(cx + 40, y0);
    ctx.stroke();
    hilo(v, [
      [cx + 40, y0],
      [xb, y0],
      [xb, (y0 + y1) / 2 - 26],
    ]);
    resistencia(v, xb, (y0 + y1) / 2 - 26, xb, (y0 + y1) / 2 + 26, { largo: 46 });
    hilo(v, [
      [xb, (y0 + y1) / 2 + 26],
      [xb, y1],
      [xa, y1],
      [xa, (y0 + y1) / 2 + 22],
    ]);
    txtRico(v, RL < 0.5 ? 'cortocircuito' : `carga ${si(RL, 'Ω', 2)}`, xb + 16, (y0 + y1) / 2, { alin: 'left', tam: 13 });
    // Inside the loop, under the fuse (above it, the PTC's caption needs the room).
    txtRico(v, `I = ${si(I, 'A', 3)}`, cx, y0 + 28, { tam: 14, peso: 800, color: p.corriente });
    if (I > 0.01) {
      const c = new Camino([
        [xa, (y0 + y1) / 2 - 22],
        [xa, y0],
        [xb, y0],
        [xb, y1],
        [xa, y1],
        [xa, (y0 + y1) / 2 + 22],
      ]);
      const k = Math.min(1, I / 3);
      electronesEnCamino(ctx, c, -tiempo * 80, 22, 3.2, p, Math.max(0.2, k));
      corrienteEnCamino(ctx, c, tiempo * 50, 120, p, 11, Math.max(0.2, k));
    }
  }

  const texto = $derived.by(() => {
    const I = V / RL;
    if (tipo === 'fusible')
      return (
        `**Fusible:** el elemento se calienta por I²·R. Con ${si(I, 'A', 3)} (${num(I / IN, 1)} veces la nominal) ` +
        (I <= 1.05 * IN
          ? 'se estabiliza por debajo de su punto de fusión: puede conducir indefinidamente.'
          : 'su temperatura sube hasta fundirse; cuanto mayor es la sobrecorriente, antes funde (el tiempo baja aproximadamente como 1/I²).') +
        '\nAl abrirse puede formarse un arco que el fusible debe extinguir: por eso importan su poder de corte y su tensión nominal. Pulse «Reiniciar» para reponerlo.'
      );
    return (
      `**PTC rearmable:** de unos 0,1 Ω en frío, ante una sobrecorriente se calienta, el polímero se dilata y separa las partículas de carbón, y su resistencia salta a decenas de ohmios: ahora ${si(estado.rptc, 'Ω', 2)}, limitando la corriente a ${si(estado.I, 'A', 3)}.\n` +
      'Se rearma sola al retirar la falta y enfriarse, pero no vuelve exactamente a su valor original.'
    );
  });
  const lecturas = $derived([
    { e: 'Corriente', v: si(estado.I, 'A', 3), c: pal.corriente },
    { e: 'Temperatura del elemento', v: `${num(estado.T, 0)} °C` },
    tipo === 'fusible' ? { e: 'Estado', v: estado.fundido ? 'fundido' : 'conduce', c: estado.fundido ? pal.peligro : pal.bien } : { e: 'Resistencia de la PTC', v: si(estado.rptc, 'Ω', 2) },
  ]);

  // 3D view of the page (componentes/tres): the model follows these controls.
  compartir3d(() => ({ tipo, fundido: estado.fundido }));
</script>

<Marco {reloj} {texto} {lecturas} leyenda={['electron', 'corriente', 'calor']}>
  {#snippet modos()}
    <Selector bind:valor={tipo} opciones={[{ valor: 'fusible', texto: 'Fusible' }, { valor: 'ptc', texto: 'PTC rearmable' }]} />
  {/snippet}
  {#snippet escena()}
    <Escena {reloj} {paso} {dibujar} dims={(a) => (a < 560 ? [560, 460] : [760, 420])} etiqueta="Fusible y PTC ante una sobrecorriente" />
  {/snippet}
  {#snippet controles()}
    <Selector
      etiqueta="Carga"
      bind:valor={RL}
      opciones={[
        { valor: 24, texto: '24 Ω (0,5 A)' },
        { valor: 12, texto: '12 Ω (1 A)' },
        { valor: 6, texto: '6 Ω (2 A)' },
        { valor: 2, texto: '2 Ω (6 A)' },
        { valor: 0.2, texto: 'Corto' },
      ]}
    />
    <Deslizador etiqueta="Carga (ajuste fino)" bind:valor={RL} min={0.2} max={48} log unidad="Ω" />
  {/snippet}
  {#snippet grafica()}
    <Grafica
      titulo="Temperatura del elemento desde el último cambio"
      x={{ etiqueta: 't', unidad: 's', min: 0, max: 20 }}
      y={{ etiqueta: 'T', unidad: '°C', min: 0, max: 500 }}
      series={[{ x: serie.t, y: serie.T, color: pal.calor }]}
      lineas={tipo === 'fusible' ? [{ y: TM, etiqueta: 'fusión', color: pal.peligro }] : [{ y: 125, etiqueta: 'disparo', color: pal.peligro }]}
    />
  {/snippet}
</Marco>
