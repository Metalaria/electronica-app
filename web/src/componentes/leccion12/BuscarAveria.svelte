<script lang="ts">
  // 1.2 «Busque la avería»: the card's circuit has one hidden fault (the widget above already draws the faulty board).
  // The reader probes points with a virtual multimeter — each new point costs one of the allowed measurements, and a
  // point with a waveform shows it on a small oscilloscope —, then names the faulty part (and, if asked, what is
  // wrong with it) and checks. A wrong suspect is explained from the reader's own measurements. Once found, another
  // board with another fault can be tried (not reported again).
  import { compilarModelo, formatear, type Valores } from '../../lib/leccion11/modelo';
  import type { EstadoTarjeta } from '../../lib/leccion11/motor';
  import { textoPlano } from '../../lib/leccion11/texto';
  import { leerUnidades } from '../../lib/habla-matematicas';
  import type { Leccion11, Tarjeta } from '../../lib/leccion11/tipos';
  import { lecturas, tiposDe } from '../../lib/leccion12/averia';
  import { otraAveria } from '../../lib/leccion12/motor12';
  import { semillaNueva } from '../../lib/leccion12/azar';
  import type { Averia, EstadoAveria } from '../../lib/leccion12/tipos';
  import TextoVivo from '../leccion11/TextoVivo.svelte';

  let {
    leccion,
    t,
    a,
    e,
    ea,
    efectivos,
    prefijo,
    valor,
    cambiar,
  }: {
    leccion: Leccion11;
    t: Tarjeta;
    a: Averia;
    e: EstadoTarjeta;
    ea: EstadoAveria;
    efectivos: Valores;
    prefijo: string;
    valor: (id: string) => string;
    cambiar: (c: Partial<EstadoTarjeta>) => void;
  } = $props();

  const mc = $derived(compilarModelo(leccion.modelo));
  const real = $derived(a.fallos[ea.fallo]!);
  const leido = $derived(lecturas(mc, a, efectivos, real));
  const ultima = $derived(ea.medidas[ea.medidas.length - 1] ?? null);
  const quedan = $derived(a.pasos - ea.medidas.length);
  const bloqueado = $derived(e.comprobado || e.resuelta);
  const tipos = $derived(tiposDe(a));
  const sonda = (id: string) => a.sondas.find((s) => s.id === id)!;
  const lectura = (id: string) => formatear(mc.magnitud(sonda(id).valor), leido[id]);
  const unidad = (id: string) => mc.magnitud(sonda(id).valor)?.unidad ?? '';
  const modo = (u: string) => (u === 'V' ? 'V⎓' : u === 'A' ? 'A⎓' : u === 'Ω' ? 'Ω' : u);

  function medir(id: string) {
    if (ea.medidas.includes(id)) {
      // measured already: shown again for free
      cambiar({ actividad: { ...ea, medidas: [...ea.medidas.filter((x) => x !== id), id] } });
      return;
    }
    if (quedan <= 0) return;
    cambiar({ actividad: { ...ea, medidas: [...ea.medidas, id] }, comprobado: false, bien: null });
  }

  function elegir(id: string) {
    if (bloqueado || ea.descartados.includes(id)) return;
    cambiar({ actividad: { ...ea, sospechoso: id } });
  }

  function elegirTipo(id: string) {
    if (bloqueado) return;
    cambiar({ actividad: { ...ea, tipoElegido: id } });
  }

  function otra() {
    // (azar: a fresh draw each time; fija: the next fault of the list)
    const semilla = a.eleccion === 'azar' ? semillaNueva() : undefined;
    cambiar({ actividad: otraAveria(a, t.id, ea, semilla), comprobado: false, bien: null });
  }

  // the oscilloscope trace of a point that has one (with the fault)
  function traza(id: string): string {
    const cv = sonda(id).curva;
    if (!cv) return '';
    const r = mc.evaluar({ ...efectivos, ...a.sano, ...real.con });
    const f = mc.funcion(cv.expr);
    const pts: string[] = [];
    for (let k = 0; k <= 120; k++) {
      const x = cv.x.min + ((cv.x.max - cv.x.min) * k) / 120;
      const y = f({ ...r, [cv.x.id]: x });
      const py = 56 - ((Math.max(cv.y.min, Math.min(cv.y.max, y)) - cv.y.min) / (cv.y.max - cv.y.min)) * 52;
      pts.push(`${(4 + (k / 120) * 192).toFixed(1)},${py.toFixed(1)}`);
    }
    return pts.join(' ');
  }
</script>

<div class="a12 averia" data-averia data-ronda={ea.ronda}>
  <div class="instrumento">
    <div class="a12-ficha pantalla" aria-live="polite" data-multimetro>
      <span class="a12-suave">{ultima ? `Multímetro en ${textoPlano(sonda(ultima).rotulo)} · ${modo(unidad(ultima))}` : 'Multímetro'}</span>
      <strong data-lectura-multimetro aria-hidden="true">{ultima ? lectura(ultima) : '— — —'}</strong>
      <span class="a12-solo-lector">{ultima ? leerUnidades(lectura(ultima)) : 'sin medir'}</span>
    </div>
    {#if ultima && sonda(ultima).curva}
      {@const cv = sonda(ultima).curva!}
      <svg class="osc" viewBox="0 0 200 60" role="img" aria-label={`Osciloscopio en ${textoPlano(sonda(ultima).rotulo)}`} data-osciloscopio>
        <rect x="2" y="2" width="196" height="56" rx="4" class="osc-fondo" />
        <line x1="4" x2="196" y1={56 - ((0 - cv.y.min) / (cv.y.max - cv.y.min)) * 52} y2={56 - ((0 - cv.y.min) / (cv.y.max - cv.y.min)) * 52} class="osc-cero" />
        <polyline points={traza(ultima)} class="osc-traza" />
      </svg>
    {/if}
  </div>
  <p class="a12-suave" data-quedan={quedan}>Medidas: {ea.medidas.length} de {a.pasos}{quedan <= 0 ? ' (ya no quedan: decida)' : ''}.</p>
  <div class="a12-fila" role="group" aria-label="Puntos de medida">
    {#each a.sondas as s (s.id)}
      {@const hecha = ea.medidas.includes(s.id)}
      <button type="button" class="a12-boton" aria-pressed={ultima === s.id} aria-disabled={!hecha && quedan <= 0} onclick={() => medir(s.id)} data-sonda={s.id}>
        <TextoVivo texto={s.rotulo} {valor} />{#if hecha}<span class="leido">· {lectura(s.id)}</span>{/if}
      </button>
    {/each}
  </div>

  <fieldset class="grupo">
    <legend>¿Qué pieza está mal?</legend>
    <div class="a12-fila">
      {#each a.sospechosos as s (s.id)}
        {@const fuera = ea.descartados.includes(s.id)}
        <button type="button" class={`a12-boton ${fuera ? 'mal' : e.resuelta && s.id === real.pieza ? 'bien' : ''}`} aria-pressed={ea.sospechoso === s.id} aria-disabled={bloqueado || fuera} onclick={() => elegir(s.id)} data-sospechoso={s.id}>
          <TextoVivo texto={s.rotulo} {valor} />{#if fuera}<span class="a12-solo-lector"> (descartada)</span>{/if}
        </button>
      {/each}
    </div>
  </fieldset>
  {#if a.preguntarTipo}
    <fieldset class="grupo">
      <legend>¿Qué le pasa?</legend>
      <div class="a12-fila">
        {#each tipos as x (x.id)}
          <button type="button" class="a12-boton" aria-pressed={ea.tipoElegido === x.id} aria-disabled={bloqueado} onclick={() => elegirTipo(x.id)} data-tipo-averia={x.id}>{x.nombre}</button>
        {/each}
      </div>
    </fieldset>
  {/if}
  {#if e.resuelta && e.bien}
    <button type="button" class="a12-boton" onclick={otra} data-otra-averia id={`${prefijo}-otra`}>Otra placa con otra avería</button>
  {/if}
</div>

<style>
  .instrumento {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    align-items: stretch;
  }
  .pantalla {
    flex: 1 1 12em;
  }
  .pantalla strong {
    font-size: 26px;
  }
  .osc {
    flex: 1 1 12em;
    max-width: 260px;
  }
  .osc-fondo {
    fill: var(--v11-fondo);
    stroke: var(--v11-linea);
  }
  .osc-cero {
    stroke: var(--v11-linea);
    stroke-dasharray: 3 3;
  }
  .osc-traza {
    fill: none;
    stroke: var(--v11-verde);
    stroke-width: 2;
  }
  .leido {
    font-variant-numeric: tabular-nums;
    font-weight: 500;
  }
  .grupo {
    /* (a fieldset is as wide as its content by default: at 360 px that widened the whole card) */
    min-inline-size: 0;
    margin: 0;
    padding: 0;
    border: 0;
  }
  legend {
    margin-bottom: 6px;
    padding: 0;
    font-weight: 600;
  }
</style>
