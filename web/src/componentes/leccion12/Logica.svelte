<script lang="ts">
  // 1.2 widget «logica» (GUIA §11.2): a living logic circuit. The drawing is laid out by lib/leccion12/digital/plano.ts
  // and simulated by lib/leccion12/digital/logica.ts: tap a switch (or its button), give the clock a pulse, and every
  // wire takes the colour of its level (1 red and thick, 0 blue and thin, with its «1»/«0» written at the source),
  // the LEDs light. A timing diagram under it (`cronograma`) moves the circuit to the moment of its cursor; a truth
  // table (`tabla`) marks the row of the switches. In a prediction the LEDs say «?» and the switches stay put; in fault
  // finding the wires are neutral (the probe tells the levels) and a tap on a wire measures it; in a design the
  // circuit drawn is the reader's.
  import './digital12.css';
  import type { EstadoTarjeta } from '../../lib/leccion11/motor';
  import { textoPlano } from '../../lib/leccion11/texto';
  import type { Tarjeta } from '../../lib/leccion11/tipos';
  import { circuitoSecuencial, cronograma, entradasTabla, iniciar, leer, NOMBRE_PIEZA, poner, pulso, relojDe, sondear, tablaVerdad, type EstadoLogico, type Nivel, type PiezaLogica } from '../../lib/leccion12/digital/logica';
  import { circuitoEnUso, falloEnUso } from '../../lib/leccion12/digital/motor-digital';
  import { planoDe, type PiezaPlano } from '../../lib/leccion12/digital/plano';
  import type { ActividadDigital, EstadoActividadDigital, EstadoWidget12, WidgetLogica } from '../../lib/leccion12/digital/tipos';
  import TextoSvg from '../leccion11/TextoSvg.svelte';
  import TextoVivo from '../leccion11/TextoVivo.svelte';
  import Cronograma from './Cronograma.svelte';
  import TablaVerdad from './TablaVerdad.svelte';

  let {
    t,
    w,
    e,
    oculto,
    prefijo,
    cambiar,
  }: {
    t: Tarjeta;
    w: WidgetLogica;
    e: EstadoTarjeta;
    oculto: boolean;
    prefijo: string;
    cambiar: (c: Partial<EstadoTarjeta>) => void;
  } = $props();

  const valor = (id: string) => id;
  const a = $derived(t.actividad as ActividadDigital | undefined);
  const ea = $derived(e.actividad as EstadoActividadDigital | undefined);
  const averia = $derived(a?.tipo === 'averia-logica' && ea?.tipo === 'averia-logica' ? { a, ea } : null);
  const c = $derived(circuitoEnUso(w, a, ea));
  const fallo = $derived(falloEnUso(a, ea));
  const plano = $derived(planoDe(c));
  const w12 = $derived<EstadoWidget12>(e.widget12 ?? { zona: null, niveles: Object.fromEntries(w.circuito.entradas.map((x) => [x.id, x.valor])), logica: null, pulsos: 0, tramo: 0 });
  const secuencial = $derived(circuitoSecuencial(c));
  const reloj = $derived(relojDe(c));
  const cron = $derived(w.cronograma ? cronograma(c, w.cronograma.ciclos, w.cronograma.estimulo, fallo) : null);
  const tramo = $derived(Math.min(w12.tramo, (cron?.tramos.length ?? 1) - 1));
  const estado = $derived.by((): EstadoLogico => {
    if (cron) return { senales: cron.tramos[tramo] ?? {}, internos: {}, relojes: {}, estable: cron.estable };
    if (secuencial && w12.logica) return w12.logica;
    return iniciar(c, fallo, w12.niveles);
  });
  // a drawing card hides the signal it asks for until it is answered
  const senalOculta = $derived(a?.tipo === 'dibujar-digital' && !e.resuelta && !e.cerrada ? (c.salidas.find((s) => s.id === a.senal)?.de ?? a.senal) : null);
  const neutros = $derived(oculto || !!averia);
  const bloqueadas = $derived((oculto && t.tipo !== 'tabla') || !!cron);
  const nivel = (s: string): Nivel => leer(estado, s);
  const verNivel = (s: string) => !neutros && s !== senalOculta;
  const claseHilo = (s: string) => (verNivel(s) ? (nivel(s) ? 'uno' : 'cero') : 'neutro');

  function guardar(cambios: Partial<EstadoWidget12>, movido?: string) {
    const c2: Partial<EstadoTarjeta> = { widget12: { ...w12, ...cambios } };
    if (movido && !e.movidos.includes(movido)) c2.movidos = [...e.movidos, movido];
    cambiar(c2);
  }
  function conmutar(id: string) {
    if (bloqueadas) return;
    const v: Nivel = w12.niveles[id] === 1 ? 0 : 1;
    const niveles = { ...w12.niveles, [id]: v };
    guardar({ niveles, logica: secuencial ? poner(c, estado, { [id]: v }, fallo) : null }, id);
  }
  function darPulso() {
    if (bloqueadas || !reloj) return;
    guardar({ logica: pulso(c, estado, reloj, fallo), pulsos: w12.pulsos + 1 }, reloj);
  }
  function reiniciar() {
    guardar({ logica: null, pulsos: 0, niveles: Object.fromEntries(c.entradas.map((x) => [x.id, x.valor])) });
  }
  function moverTramo(k: number) {
    guardar({ tramo: k }, 'tramo');
  }

  // fault finding: a tap on a wire measures it (the activity panel lists the points for the keyboard)
  const sinMedidas = $derived(!!averia && averia.a.pasos != null && averia.ea.medidas.length >= averia.a.pasos);
  function sondearSenal(senal: string) {
    if (!averia || sinMedidas || e.resuelta) return;
    const p = averia.a.puntos.find((q) => 'senal' in q.punto && q.punto.senal === senal);
    if (!p) return;
    const lectura = sondear(c, estado, p.punto, fallo);
    cambiar({ actividad: { ...averia.ea, medidas: [...averia.ea.medidas, { niveles: { ...w12.niveles }, punto: p.id, lectura }] } });
  }

  // the truth table under the circuit
  const tabla = $derived.by(() => {
    if (!w.tabla || secuencial) return null;
    const tv = tablaVerdad(c);
    const ent = entradasTabla(c);
    let actual = 0;
    ent.forEach((id, k) => (actual |= (w12.niveles[id] ?? 0) << (ent.length - 1 - k)));
    return { tv, actual };
  });

  // shapes
  const INVERTIDAS = new Set(['nand', 'nor', 'not', 'xnor']);
  function cuerpo(p: PiezaPlano): string {
    const x0 = p.x + 8;
    const inv = INVERTIDAS.has(p.tipo);
    const x1 = p.x + p.w - (inv ? 12 : 4);
    const y0 = p.y + 2;
    const y1 = p.y + p.h - 2;
    const ym = (y0 + y1) / 2;
    const r = (y1 - y0) / 2;
    switch (p.tipo) {
      case 'and':
      case 'nand':
        return `M${x0},${y0}H${x1 - r}A${r},${r} 0 0 1 ${x1 - r},${y1}H${x0}Z`;
      case 'or':
      case 'nor':
      case 'xor':
      case 'xnor': {
        const xi = x0 + (p.tipo.startsWith('x') ? 5 : 0);
        return `M${xi},${y0}Q${xi + (x1 - xi) * 0.62},${y0} ${x1},${ym}Q${xi + (x1 - xi) * 0.62},${y1} ${xi},${y1}Q${xi + 9},${ym} ${xi},${y0}Z`;
      }
      case 'not':
      case 'buf':
        return `M${x0},${y0 + 4}L${x1},${ym}L${x0},${y1 - 4}Z`;
      default:
        return `M${p.x + 6},${p.y}H${p.x + p.w - 6}V${p.y + p.h}H${p.x + 6}Z`;
    }
  }
  const esPuerta = (p: PiezaPlano) => ['and', 'or', 'not', 'nand', 'nor', 'xor', 'xnor', 'buf'].includes(p.tipo);
  const pieza = (id: string): PiezaLogica => c.piezas.find((q) => q.id === id)!;
  const titulo = (p: PiezaPlano) => {
    const q = pieza(p.id);
    if (q.rotulo) return textoPlano(q.rotulo);
    return { d: 'D', jk: 'JK', t: 'T', contador: 'CTR', mux: 'MUX', decodificador: 'DEC' }[p.tipo as string] ?? '';
  };
  const etiquetaPuerta = (p: PiezaPlano) => (pieza(p.id).rotulo ? textoPlano(pieza(p.id).rotulo) : '');

  // for screen readers: what the circuit is, and the LEDs now
  const descripcion = $derived(
    `Circuito lógico. ${c.piezas.map((p) => `${p.rotulo ? textoPlano(p.rotulo) + ', ' : ''}${NOMBRE_PIEZA[p.tipo]}${p.rotulo ? '' : ` ${p.id}`}, con ${p.entradas.join(' y ')}`).join('; ')}. ${c.salidas.map((s) => `LED ${textoPlano(s.rotulo)} conectado a ${s.de}`).join('; ')}.`,
  );
  const leds = $derived(c.salidas.map((s) => `${textoPlano(s.rotulo)} ${oculto || s.de === senalOculta ? 'oculto' : nivel(s.de) ? 'encendido (1)' : 'apagado (0)'}`).join(', '));
  const filasCron = $derived(
    w.cronograma && cron
      ? w.cronograma.senales.map((s) => {
          const sal = c.salidas.find((q) => q.id === s);
          const sig = sal?.de ?? s;
          const ent = c.entradas.find((q) => q.id === s);
          return { id: s, rotulo: sal?.rotulo ?? ent?.rotulo ?? [{ t: 'txt' as const, s }], niveles: (oculto && !ent) || sig === senalOculta ? null : cron.tramos.map((x) => (x[sig] ?? 0) as Nivel) };
        })
      : [],
  );
</script>

<div class="d12 d12-logica" class:averia={!!averia} data-logica data-modo={averia ? 'averia' : a?.tipo === 'diseno-logico' ? 'diseno' : oculto ? 'oculto' : 'vivo'}>
  {#if w.dibujo !== false}
    <div class="d12-circuito">
      <svg viewBox={`0 0 ${plano.ancho} ${plano.alto}`} style:max-width={`${Math.max(plano.ancho * 1.6, 240)}px`} role="img" aria-label={descripcion} data-plano>
        <!-- wires (in fault finding a wider transparent stroke takes the probe's tap) -->
        {#each plano.hilos as h, k (k)}
          <polyline class={`d12-hilo ${claseHilo(h.senal)}`} points={h.puntos.map((p) => p.join(',')).join(' ')} data-hilo={h.senal} data-nivel={verNivel(h.senal) ? nivel(h.senal) : 'oculto'} />
          {#if averia}
            <polyline class="d12-toque" points={h.puntos.map((p) => p.join(',')).join(' ')} onclick={() => sondearSenal(h.senal)} data-sondear={h.senal} role="presentation" />
          {/if}
        {/each}
        {#each plano.uniones as u, k (k)}<circle class={`d12-union ${claseHilo(u.senal)}`} cx={u.x} cy={u.y} r="3" />{/each}
        {#each plano.constantes as k, i (i)}
          <line class="d12-hilo neutro" x1={k.x - 12} x2={k.x} y1={k.y} y2={k.y} /><text class="d12-const" x={k.x - 14} y={k.y + 4} text-anchor="end">{k.nivel}</text>
        {/each}
        <!-- switches and the clock -->
        {#each plano.entradas as en (en.id)}
          {@const x = c.entradas.find((q) => q.id === en.id)!}
          <g class="d12-interruptor" class:bloqueado={bloqueadas} onclick={() => (x.reloj ? darPulso() : conmutar(en.id))} role="presentation" data-interruptor={en.id}>
            <rect x={en.x} y={en.y} width={en.w} height={en.h} rx="6" />
            <text x={en.x + 6} y={en.y + 18}><TextoSvg t={x.rotulo} /></text>
            {#if x.reloj}
              <path class="d12-simbolo-reloj" d={`M${en.x + en.w - 18},${en.y + 20}h4v-10h4v10h4`} />
            {:else}
              <text class="d12-nivel-int" x={en.x + en.w - 6} y={en.y + 18} text-anchor="end">{nivel(en.id)}</text>
            {/if}
          </g>
          {#if verNivel(en.id)}<text class="d12-nivel" x={en.pin[0] + 3} y={en.pin[1] - 4}>{nivel(en.id)}</text>{/if}
        {/each}
        <!-- pieces -->
        {#each plano.piezas as p (p.id)}
          <g class="d12-pieza" data-pieza={p.id}>
            {#each p.pinesE as pe, k (k)}<line class="d12-patilla" x1={pe.x} x2={p.x + (esPuerta(p) ? 10 : 6)} y1={pe.y} y2={pe.y} />{/each}
            <path class="d12-cuerpo" d={cuerpo(p)} />
            {#if p.tipo === 'xor' || p.tipo === 'xnor'}<path class="d12-cuerpo-linea" d={`M${p.x + 8},${p.y + 2}Q${p.x + 17},${p.y + p.h / 2} ${p.x + 8},${p.y + p.h - 2}`} />{/if}
            {#if INVERTIDAS.has(p.tipo)}<circle class="d12-burbuja" cx={p.x + p.w - 8} cy={p.y + p.h / 2} r="4" />{/if}
            {#each p.pinesS as ps (ps.senal)}
              <line class="d12-patilla" x1={esPuerta(p) ? p.x + p.w - (INVERTIDAS.has(p.tipo) ? 4 : 4) : p.x + p.w - 6} x2={ps.x} y1={ps.y} y2={ps.y} />
              {#if ps.nombre}<text class="d12-pin" x={p.x + p.w - 9} y={ps.y + 4} text-anchor="end">{ps.nombre}</text>{/if}
              {#if verNivel(ps.senal)}<text class="d12-nivel" x={ps.x + 3} y={ps.y - 4}>{nivel(ps.senal)}</text>{/if}
            {/each}
            {#if esPuerta(p)}
              {#if etiquetaPuerta(p)}<text class="d12-pin" x={p.x + p.w / 2 - 4} y={p.y - 3} text-anchor="middle">{etiquetaPuerta(p)}</text>{/if}
            {:else}
              <text class="d12-titulo" x={p.x + p.w / 2} y={p.y + p.h / 2 + 4} text-anchor="middle">{titulo(p)}</text>
              {#each p.pinesE as pe, k (k)}
                {#if pe.nombre === 'CLK'}
                  <path class="d12-cuerpo-linea" d={`M${p.x + 6},${pe.y - 5}l6,5l-6,5`} />
                {:else}
                  <text class="d12-pin" x={p.x + 9} y={pe.y + 4}>{pe.nombre}</text>
                {/if}
              {/each}
            {/if}
          </g>
        {/each}
        <!-- LEDs -->
        {#each plano.salidas as s (s.id)}
          {@const sal = c.salidas.find((q) => q.id === s.id)!}
          {@const escondido = oculto || sal.de === senalOculta}
          <g class="d12-led" class:encendido={!escondido && nivel(sal.de) === 1} class:escondido data-led={s.id} data-encendido={escondido ? 'oculto' : nivel(sal.de) ? 'si' : 'no'}>
            <circle cx={s.x} cy={s.y} r="10" />
            <text class="d12-led-texto" x={s.x} y={s.y + 4} text-anchor="middle">{escondido ? '?' : nivel(sal.de)}</text>
            <text x={s.x} y={s.y - 14} text-anchor="middle"><TextoSvg t={sal.rotulo} /></text>
          </g>
        {/each}
      </svg>
    </div>
    <p class="a12-solo-lector" aria-live="polite" data-leds>{leds}</p>

    {#if !cron}
      <div class="a12-fila d12-entradas" role="group" aria-label="Entradas del circuito">
        {#each c.entradas as x (x.id)}
          {#if x.reloj}
            <button type="button" class="a12-boton" onclick={darPulso} aria-disabled={bloqueadas} data-pulso>Pulso de reloj {#if w12.pulsos}<span class="a12-suave">({w12.pulsos})</span>{/if}</button>
          {:else}
            <button type="button" class="a12-boton d12-int" aria-pressed={w12.niveles[x.id] === 1} aria-disabled={bloqueadas} onclick={() => conmutar(x.id)} data-boton-entrada={x.id}
              ><TextoVivo texto={x.rotulo} {valor} /> = {w12.niveles[x.id] ?? 0}</button
            >
          {/if}
        {/each}
        {#if secuencial && (w12.pulsos || w12.logica)}<button type="button" class="a12-boton" onclick={reiniciar} data-reiniciar>Reiniciar</button>{/if}
      </div>
    {/if}
  {/if}

  {#if cron && w.cronograma}
    <Cronograma filas={filasCron} {tramo} {prefijo} mover={moverTramo} />
  {/if}
  {#if tabla}
    <TablaVerdad entradas={tabla.tv.entradas} salidas={c.salidas.map((s) => ({ id: s.id, rotulo: s.rotulo }))} filas={tabla.tv.filas.map((f) => ({ e: f.e, s: oculto ? null : f.s }))} actual={tabla.actual} />
  {/if}
</div>
