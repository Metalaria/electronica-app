<script lang="ts">
  // SCR and TRIAC (book 10.1): four layers PNPN equivalent to a PNP and an NPN that feed each other's base.
  // A gate pulse closes the loop (gain > 1) and the device stays on until the current falls below the holding
  // current, which in AC happens at every zero crossing. Phase control: firing at angle α each half cycle.
  import Escena from '../ui/Escena.svelte';
  import Marco from '../ui/Marco.svelte';
  import Deslizador from '../ui/Deslizador.svelte';
  import Selector from '../ui/Selector.svelte';
  import Grafica from '../ui/Grafica.svelte';
  import { Reloj, Muestreo } from '../nucleo/reloj.svelte';
  import { txt, fondo, rr, flecha, brillo, electrones, huecos, Camino, electronesEnCamino, corrienteEnCamino, type Vista } from '../nucleo/dibujo';
  import { hilo, fuente, lampara } from '../nucleo/esquema';
  import { alfa, paleta } from '../nucleo/paleta';
  import { si, num, pct } from '../nucleo/formato';
  import { app } from '../../../lib/estado.svelte';

  const reloj = new Reloj();
  const pal = $derived(paleta(app.tema));
  let tipo = $state<'scr' | 'triac'>('scr');
  let alfaDeg = $state(90);
  const VP = 230 * Math.SQRT2;
  const RL = 100;

  const a = $derived((alfaDeg * Math.PI) / 180);
  // Fraction of the full-wave power delivered (resistive load).
  const fraccionMedia = $derived(1 - a / Math.PI + Math.sin(2 * a) / (2 * Math.PI));
  const fraccion = $derived(tipo === 'scr' ? fraccionMedia / 2 : fraccionMedia);
  const pMax = (230 * 230) / RL;

  const PERIODO = 3;
  let fase = 0;
  let t = 0;
  let faseM = $state(0);
  const muestreo = new Muestreo(40);
  function conduceEn(th: number): boolean {
    const x = ((th % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
    if (x < Math.PI) return x >= a;
    return tipo === 'triac' && x - Math.PI >= a;
  }
  function paso(dt: number): void {
    t += dt;
    fase += dt * 60;
    if (muestreo.toca()) faseM = ((t / PERIODO) % 1) * 2 * Math.PI;
  }

  function dibujar(v: Vista): void {
    void [tipo, alfaDeg];
    const { ctx } = v;
    const p = pal;
    fondo(v);
    const est = v.estrecho;
    const th = ((t / PERIODO) % 1) * 2 * Math.PI;
    const s = Math.sin(th);
    const on = conduceEn(th);
    const vl = on ? VP * s : 0;
    const k = Math.min(1, Math.abs(vl) / VP);
    // Instant of the gate pulse (shortly after α in each half cycle).
    const x = th % Math.PI;
    const pulso = x >= a && x < a + 0.15 && (th < Math.PI || tipo === 'triac');
    // Four-layer structure (anode on top).
    const sx = est ? 100 : 150;
    const sy0 = 60;
    const capa = 52;
    const w = 120;
    const capas = tipo === 'scr' ? ['P', 'N', 'P', 'N'] : ['P/N', 'N', 'P', 'N/P'];
    capas.forEach((c, i) => {
      ctx.fillStyle = c.startsWith('P') && c.length === 1 ? p.siP : c === 'N' ? p.siN : alfa(p.siP, 0.6);
      ctx.fillRect(sx - w / 2, sy0 + i * capa, w, capa);
      if (c.length > 1) {
        ctx.fillStyle = p.siN;
        ctx.fillRect(sx, sy0 + i * capa, w / 2, capa);
      }
      txt(v, c, sx - w / 2 - 14, sy0 + i * capa + capa / 2, { tam: 14, peso: 800, color: c.startsWith('P') ? p.hueco : p.electron, alin: 'right' });
    });
    ctx.strokeStyle = p.linea;
    ctx.strokeRect(sx - w / 2, sy0, w, capa * 4);
    ctx.fillStyle = p.aluminio;
    ctx.fillRect(sx - w / 2, sy0 - 10, w, 10);
    ctx.fillRect(sx - w / 2, sy0 + capa * 4, w, 10);
    ctx.fillRect(sx + w / 2, sy0 + capa * 2 + 10, 20, 10);
    txt(v, tipo === 'scr' ? 'ánodo' : 'MT2', sx, sy0 - 22, { tam: 13, peso: 800 });
    txt(v, tipo === 'scr' ? 'cátodo' : 'MT1', sx, sy0 + capa * 4 + 26, { tam: 13, peso: 800 });
    txt(v, 'puerta', sx + w / 2 + 26, sy0 + capa * 2 + 15, { tam: 13, peso: 800, alin: 'left', color: pulso ? p.corriente : p.tinta });
    if (pulso) {
      brillo(ctx, sx + w / 2, sy0 + capa * 2.3, 40, p.corriente, 0.6);
      flecha(ctx, sx + w / 2 + 70, sy0 + capa * 2 + 15, sx + w / 2 + 22, sy0 + capa * 2 + 15, p.corriente, 3, 12);
    }
    // Carriers flowing through all four layers while on.
    if (on) {
      const n = Math.round(6 + 14 * k);
      const es: { x: number; y: number }[] = [];
      const hs: { x: number; y: number }[] = [];
      for (let i = 0; i < n; i++) {
        const u = (i / n + fase * 0.004) % 1;
        const xx = sx - w / 2 + 14 + ((i * 37) % (w - 28));
        const abajo = s > 0;
        es.push({ x: xx, y: abajo ? sy0 + capa * 4 - u * capa * 4 : sy0 + u * capa * 4 });
        hs.push({ x: xx + 9, y: abajo ? sy0 + u * capa * 4 : sy0 + capa * 4 - u * capa * 4 });
      }
      electrones(ctx, es, 3.4, p);
      huecos(ctx, hs, 3.4, p);
      txt(v, 'enclavado: el lazo PNP–NPN se sostiene solo', sx, sy0 + capa * 4 + 50, { tam: 12.5, peso: 800, color: p.bien });
    } else txt(v, Math.abs(s) < 0.05 ? 'cruce por cero: se apaga' : 'bloqueando', sx, sy0 + capa * 4 + 50, { tam: 12.5, peso: 800, color: p.suave });

    // Circuit: mains, lamp and the device.
    const cx0 = est ? 310 : 380;
    const cx1 = est ? 500 : 560;
    const cy0 = 70;
    const cy1 = 290;
    fuente(v, cx0, (cy0 + cy1) / 2, 24, 'ac', { rotulo: '230 V', lado: est ? 1 : -1 });
    hilo(v, [
      [cx0, (cy0 + cy1) / 2 - 24],
      [cx0, cy0],
      [cx1, cy0],
      [cx1, cy0 + 40],
    ]);
    lampara(v, cx1, cy0 + 40, cx1, cy0 + 100, k);
    hilo(v, [
      [cx1, cy0 + 100],
      [cx1, cy1],
      [cx0, cy1],
      [cx0, (cy0 + cy1) / 2 + 24],
    ]);
    rr(ctx, cx1 - 18, cy1 - 70, 36, 50, 6);
    ctx.fillStyle = on ? alfa(p.corriente, 0.3) : p.panel;
    ctx.fill();
    ctx.strokeStyle = p.tinta;
    ctx.stroke();
    txt(v, tipo === 'scr' ? 'SCR' : 'TRIAC', cx1, cy1 - 45, { tam: 11.5, peso: 800 });
    if (on && k > 0.03) {
      const c = new Camino([
        [cx0, (cy0 + cy1) / 2 - 24],
        [cx0, cy0],
        [cx1, cy0],
        [cx1, cy1],
        [cx0, cy1],
        [cx0, (cy0 + cy1) / 2 + 24],
      ]);
      const dir = s > 0 ? 1 : -1;
      electronesEnCamino(ctx, c, -dir * fase, 22, 3.2, p, k);
      corrienteEnCamino(ctx, c, dir * fase * 0.6, 120, p, 11, k);
    }
    // Phase indicator.
    if (!est) {
      const ox = 640;
      const oy = 180;
      const R = 70;
      ctx.strokeStyle = alfa(p.suave, 0.4);
      ctx.beginPath();
      ctx.arc(ox, oy, R, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = alfa(p.corriente, 0.18);
      ctx.beginPath();
      ctx.moveTo(ox, oy);
      ctx.arc(ox, oy, R, -Math.PI, -a, false);
      ctx.closePath();
      ctx.fill();
      if (tipo === 'triac') {
        ctx.beginPath();
        ctx.moveTo(ox, oy);
        ctx.arc(ox, oy, R, 0, Math.PI - a, false);
        ctx.closePath();
        ctx.fill();
      }
      flecha(ctx, ox, oy, ox + Math.cos(th) * R * 0.95, oy - Math.sin(th) * R * 0.95, p.acento, 2.4, 10);
      txt(v, `α = ${num(alfaDeg, 0)}°`, ox, oy + R + 22, { tam: 14, peso: 800, color: p.acento });
      txt(v, 'zona de conducción', ox, oy - R - 16, { tam: 12, color: p.corriente, peso: 700 });
    }
  }

  const ondas = $derived.by(() => {
    const xs: number[] = [];
    const red: number[] = [];
    const carga: number[] = [];
    for (let i = 0; i <= 400; i++) {
      const th = (i / 400) * 4 * Math.PI;
      xs.push((th / (2 * Math.PI)) * 0.02);
      red.push(VP * Math.sin(th));
      carga.push(conduceEn(th) ? VP * Math.sin(th) : 0);
    }
    return { xs, red, carga };
  });

  const texto = $derived(
    (tipo === 'scr'
      ? '**SCR:** cuatro capas PNPN, equivalentes a un PNP y un NPN que se alimentan mutuamente la base. Un pulso de puerta cierra el lazo y el SCR se queda encendido aunque el pulso desaparezca; se apaga solo cuando la corriente cae por debajo de la de mantenimiento, en el cruce por cero.'
      : '**TRIAC:** equivale a dos SCR en antiparalelo en la misma pastilla: conduce en los dos sentidos y se dispara en cada semiciclo.') +
      `\nCon disparo a α = ${num(alfaDeg, 0)}° llega a la lámpara el ${pct(fraccion, 0)} de la potencia (${si(fraccion * pMax, 'W', 3)} de ${si(pMax, 'W', 3)}). Apenas disipa, pero el corte brusco en mitad de la onda genera armónicos e interferencias.`,
  );
  const lecturas = $derived([
    { e: 'Ángulo de disparo α', v: `${num(alfaDeg, 0)}°`, c: pal.acento },
    { e: 'Potencia en la carga', v: si(fraccion * pMax, 'W', 3), c: pal.corriente },
    { e: 'Fracción de la potencia', v: pct(fraccion, 0) },
    { e: 'Estado', v: conduceEn(faseM) ? 'conduce' : 'bloquea' },
  ]);
</script>

<Marco {reloj} {texto} {lecturas} leyenda={['electron', 'hueco', 'corriente']}>
  {#snippet modos()}
    <Selector bind:valor={tipo} opciones={[{ valor: 'scr', texto: 'SCR' }, { valor: 'triac', texto: 'TRIAC' }]} />
  {/snippet}
  {#snippet escena()}
    <Escena {reloj} {paso} {dibujar} dims={(a2) => (a2 < 560 ? [560, 400] : [760, 380])} etiqueta="Tiristor con control por ángulo de fase" />
  {/snippet}
  {#snippet controles()}
    <Deslizador etiqueta="Ángulo de disparo α" bind:valor={alfaDeg} min={5} max={175} paso={1} formato={(x) => `${num(x, 0)}°`} />
  {/snippet}
  {#snippet grafica()}
    <Grafica
      titulo="Tensión de red y tensión en la lámpara"
      x={{ etiqueta: 't', unidad: 's', min: 0, max: 0.04 }}
      y={{ etiqueta: 'v', unidad: 'V', min: -340, max: 340 }}
      series={[
        { x: ondas.xs, y: ondas.red, color: pal.tenue, ancho: 1.4, discontinua: true, nombre: 'red' },
        { x: ondas.xs, y: ondas.carga, color: pal.corriente, ancho: 2.6, nombre: 'lámpara' },
      ]}
    />
  {/snippet}
</Marco>
