<script lang="ts">
  // «Explore» row of a live schematic inside a lesson (0.11, group B), Brilliant-style: one value to move, one
  // quantity to watch, and a short prompt («Mueva R2: ¿qué le pasa a la tensión en Vsal?»). Moving the slider
  // re-simulates the figure's own circuit with the existing machinery (resimular.ts → the simulator's single
  // ngspice worker) and the figure updates in place: wire colours, flowing charges, readouts.
  //   - What to move and watch: the book-derived practice items of the section about this very drawing when
  //     there are any (the slider item's part and quantity; else the prediction's quantity with ANOTHER part, so
  //     exploring does not give the prediction away), otherwise a designated resistor and a labelled node.
  //   - Light on the tablet: nothing runs until the reader moves the slider; runs are debounced (250 ms, at once
  //     on release) and only while the figure is on screen and the page visible (a move made off screen runs
  //     when the figure comes back); no animation of its own, no WebGL.
  import RotateCcw from '@lucide/svelte/icons/rotate-ccw';
  import Sparkles from '@lucide/svelte/icons/sparkles';
  import { untrack } from 'svelte';
  import type { EstadoEsquema } from './modelo.svelte';
  import type { Elemento, ResultadoOp } from '../tipos';
  import { parametros, resimular, restaurar, type ParametroEsquema } from './resimular';
  import { nombreElemento, textoEtiqueta } from './textos';
  import { si } from '../formato';
  import Valor from './Valor.svelte';

  let {
    est,
    ruta,
    indice,
    parte,
    visible,
  }: {
    est: EstadoEsquema;
    /** `datos/NAME.json` of the figure. */
    ruta: string;
    /** Index of this drawing in the figure. */
    indice: number;
    /** The lesson's part (its practice items say what is worth exploring). */
    parte: string;
    /** On screen and the page visible. */
    visible: boolean;
  } = $props();

  interface Observable {
    k: 'nodo' | 'corriente' | 'tension';
    id: string;
    /** HTML: «la tensión en V<sub>sal</sub>». */
    nombre: string;
    unidad: 'V' | 'A';
  }

  const ESPERA_MS = 250;

  /** «R2» → «R<sub>2</sub>»; «$V_{out}$» → «V<sub>out</sub>». */
  function conSubindice(t: string): string {
    const limpio = t.replace(/\$|\\mathrm|\\,|[{}]/g, '');
    const m = /^([A-Za-z])_?([A-Za-z0-9]+)$/.exec(limpio);
    if (m) return `${m[1]}<sub>${m[2]}</sub>`;
    return textoEtiqueta(t).replace(/&/g, '&amp;').replace(/</g, '&lt;');
  }

  function nombreParte(e: Elemento): string {
    if (e.designador && /^[A-Za-z]{1,2}[A-Za-z0-9]{0,3}$/.test(e.designador) && e.designador.length > 1) return conSubindice(e.designador);
    const base = nombreElemento(e).toLowerCase();
    return e.valor_texto ? `la ${base} de ${e.valor_texto}` : `la ${base}`;
  }

  function leer(op: ResultadoOp | null | undefined, o: Observable): number | null {
    if (!op) return null;
    if (o.k === 'nodo') return op.nodos[o.id] ?? null;
    const e = op.elementos[o.id];
    if (!e) return null;
    return (o.k === 'corriente' ? e.corriente : e.tension) ?? null;
  }

  // ---------------------------------------------------------------- what to move and what to watch
  const lista = $derived(parametros(est, nombreElemento).filter((p) => !p.id.includes(':') && p.e12));
  let elegido = $state<string | null>(null);
  let observa = $state<Observable | null>(null);
  /** Names (HTML) of the parts that come from a practice item. */
  let nombres = $state<Record<string, string>>({});
  let listo = $state(false);

  /** A labelled node that is not a supply (its book voltage is not a source's), else the part's own current. */
  function observableDefecto(p: ParametroEsquema): Observable {
    const op = est.esq.simulacion?.op;
    const fuentes = est.esq.elementos.filter((e) => ['V', 'BAT', 'RAIL', 'V?'].includes(e.rol) && e.valor != null).map((e) => Math.abs(e.valor!));
    for (const n of est.esq.nodos) {
      if (n.tierra || !n.etiquetas?.length) continue;
      const v = op?.nodos[n.id];
      if (v == null || !Number.isFinite(v) || Math.abs(v) < 1e-6) continue;
      if (fuentes.some((f) => Math.abs(Math.abs(v) - f) <= 0.01 * f)) continue;
      return { k: 'nodo', id: n.id, nombre: `la tensión en ${conSubindice(n.etiquetas[0]!)}`, unidad: 'V' };
    }
    return { k: 'corriente', id: p.elemento.id, nombre: `la corriente por ${nombreParte(p.elemento)}`, unidad: 'A' };
  }

  $effect(() => {
    const ps = lista;
    if (!ps.length || untrack(() => listo)) return;
    let vivo = true;
    (async () => {
      let desliza: { cambio: { id: string; nombre: string }; observa: Observable } | null = null;
      let predice: { cambio: { id: string; nombre: string }; observa: Observable } | null = null;
      try {
        const { cargarPractica } = await import('../../practica/datos');
        const d = await cargarPractica(parte);
        for (const it of d?.items ?? []) {
          if ((it.tipo !== 'deslizador' && it.tipo !== 'prediccion') || it.fuente.k !== 'figura') continue;
          if (it.fuente.datos !== ruta || it.fuente.esquema !== indice) continue;
          const x = { cambio: it.cambio, observa: { k: it.observa.k, id: it.observa.id, nombre: it.observa.nombre, unidad: it.observa.unidad } };
          if (it.tipo === 'deslizador') desliza ??= x;
          else predice ??= x;
        }
      } catch {
        /* no practice data: the defaults below */
      }
      if (!vivo) return;
      const n: Record<string, string> = {};
      for (const x of [desliza, predice]) if (x) n[x.cambio.id] = x.cambio.nombre;
      let p: ParametroEsquema | undefined;
      let o: Observable | null = null;
      if (desliza) {
        p = ps.find((q) => q.id === desliza.cambio.id);
        o = desliza.observa;
      }
      if (!p && predice) {
        // another part than the prediction's (the prediction comes later in the lesson)
        p = ps.find((q) => q.id !== predice.cambio.id && q.elemento.rol === 'R') ?? ps.find((q) => q.id !== predice.cambio.id);
        o = predice.observa;
        if (!p) p = ps.find((q) => q.id === predice.cambio.id);
      }
      p ??= ps.find((q) => q.elemento.rol === 'R' && q.elemento.designador) ?? ps[0]!;
      nombres = n;
      elegido = p.id;
      observa = o ?? observableDefecto(p);
      listo = true;
    })();
    return () => {
      vivo = false;
    };
  });

  const param = $derived(lista.find((p) => p.id === elegido) ?? null);
  const nombre = $derived(param ? (nombres[param.id] ?? nombreParte(param.elemento)) : '');
  const valor = $derived(param ? (est.cambios[param.id] ?? param.original) : 0);
  const cambiado = $derived(!!param && Math.abs(valor - param.original) > Math.abs(param.original) * 1e-9);

  // ---------------------------------------------------------------- the reading
  const libro = $derived(observa ? leer(est.esq.simulacion?.op, observa) : null);
  const ahora = $derived(observa ? leer(est.op, observa) : null);
  /** The result shown belongs to the value on the slider (not to a run still on its way). */
  const alDia = $derived(est.estadoSim === 'ok' || (!cambiado && est.estadoSim === 'libro'));
  const sentido = $derived.by((): 'sube' | 'baja' | 'igual' | null => {
    if (!cambiado || libro == null || ahora == null || !alDia) return null;
    const piso = observa?.unidad === 'V' ? 1e-6 : 1e-9;
    const d = ahora - libro;
    if (Math.abs(d) <= Math.max(piso, 0.01 * Math.max(Math.abs(libro), Math.abs(ahora)))) return 'igual';
    return Math.abs(ahora) > Math.abs(libro) ? 'sube' : 'baja';
  });
  const cambioPct = $derived(libro && ahora != null && Math.abs(libro) > 0 ? Math.round(((Math.abs(ahora) - Math.abs(libro)) / Math.abs(libro)) * 100) : null);

  // ---------------------------------------------------------------- runs
  let espera: ReturnType<typeof setTimeout> | null = null;
  let pendiente = $state(false);
  let simulaciones = $state(0);

  function contar() {
    simulaciones++;
    const w = window as unknown as { __epaExplora?: { simulaciones: number } };
    w.__epaExplora ??= { simulaciones: 0 };
    w.__epaExplora.simulaciones++;
  }

  function correr() {
    if (espera) clearTimeout(espera);
    espera = null;
    if (!visible) {
      // off screen or hidden: run when the figure is seen again
      pendiente = true;
      return;
    }
    pendiente = false;
    contar();
    void resimular(est);
  }

  function mover(v: number) {
    if (!param) return;
    est.cambios = { ...est.cambios, [param.id]: v };
    if (espera) clearTimeout(espera);
    espera = setTimeout(correr, ESPERA_MS);
  }

  $effect(() => {
    if (visible && untrack(() => pendiente)) untrack(correr);
    if (!visible && espera) {
      clearTimeout(espera);
      espera = null;
      pendiente = true;
    }
  });

  $effect(() => () => {
    if (espera) clearTimeout(espera);
  });

  function elegir(id: string) {
    if (id === elegido) return;
    if (Object.keys(est.cambios).length) restaurar(est);
    pendiente = false;
    elegido = id;
    const p = lista.find((q) => q.id === id);
    // the quantity watched stays when it is a node; a part's own current follows the part
    if (p && observa?.k !== 'nodo') observa = observableDefecto(p);
  }

  function libroDeNuevo() {
    if (espera) clearTimeout(espera);
    espera = null;
    pendiente = false;
    restaurar(est);
  }

  const opciones = $derived(lista.length > 1 && lista.length <= 6 ? lista : []);
  const VERBO = { sube: 'sube', baja: 'baja', igual: 'apenas cambia' } as const;
</script>

{#if !listo}
  <div class="explora-reserva" aria-hidden="true"></div>
{:else if param && observa}
  <section class="explora" aria-label="Explore el circuito" data-explora={param.id} data-observa={`${observa.k}:${observa.id}`} data-simulaciones={simulaciones} data-pendiente={pendiente ? 1 : 0}>
    <p class="ex-reto">
      <span class="ex-icono" aria-hidden="true"><Sparkles size={16} /></span>
      <span>Mueva {@html nombre}: ¿qué le pasa a {@html observa.nombre}?</span>
    </p>
    {#if opciones.length}
      <div class="ex-chips" role="group" aria-label="Componente que se cambia">
        {#each opciones as p (p.id)}
          <button type="button" class="ex-chip" aria-pressed={p.id === elegido} onclick={() => elegir(p.id)}>{@html nombres[p.id] ?? nombreParte(p.elemento)}</button>
        {/each}
      </div>
    {/if}
    <Valor p={param} {valor} alMover={mover} alSoltar={correr} />
    <div class="ex-lectura" aria-live="polite" data-lectura={ahora ?? ''} data-sentido={sentido ?? ''}>
      {#if ahora != null && libro != null}
        <span class="ex-que">{@html observa.nombre.replace(/^la /, '')}</span>
        <strong class="ex-cifra" class:ex-cambia={cambiado && alDia}>{si(alDia ? ahora : libro, observa.unidad, 3)}</strong>
        {#if cambiado && alDia}
          <span class="ex-libro">libro: {si(libro, observa.unidad, 3)}</span>
          {#if sentido && sentido !== 'igual' && cambioPct != null}<span class="ex-delta" class:ex-baja={sentido === 'baja'}>{sentido === 'sube' ? '▲' : '▼'} {Math.abs(cambioPct)} %</span>{/if}
        {:else if cambiado && est.estadoSim === 'simulando'}
          <span class="ex-libro">simulando…</span>
        {/if}
      {/if}
    </div>
    {#if sentido}
      <p class="ex-conclusion" data-conclusion>
        Con {@html nombre} = {si(valor, param.unidad, 3)} (en el libro, {si(param.original, param.unidad, 3)}), {@html observa.nombre} {VERBO[sentido]}{#if sentido !== 'igual'}: de {si(libro!, observa.unidad, 3)} a {si(ahora!, observa.unidad, 3)}{/if}.
      </p>
    {:else if est.estadoSim === 'error' && est.mensaje}
      <p class="ex-conclusion ex-error" role="status">{est.mensaje}</p>
    {/if}
    {#if cambiado}
      <button type="button" class="ex-restaurar" onclick={libroDeNuevo} data-explora-libro><RotateCcw size={15} aria-hidden="true" /> Valores del libro</button>
    {/if}
  </section>
{/if}

<style>
  .explora-reserva {
    max-width: 46em;
    min-height: var(--alto-explora, 204px);
    margin: 0.6em auto 0;
  }
  .explora {
    min-height: var(--alto-explora, 204px);
    align-content: start;
    display: grid;
    gap: 10px;
    max-width: 46em;
    margin: 0.6em auto 0;
    padding: 14px 16px;
    border: 1px solid var(--acento-borde);
    border-radius: var(--radio-tarjeta-p);
    background: var(--acento-tinte);
    color: var(--tinta);
    font-family: var(--sans);
    font-size: 15px;
    text-align: left;
  }
  .ex-reto {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    margin: 0;
    font-weight: 600;
    line-height: 1.35;
  }
  .ex-icono {
    display: grid;
    flex: none;
    place-items: center;
    width: 26px;
    height: 26px;
    margin-top: -2px;
    border-radius: 50%;
    background: var(--acento);
    color: var(--sobre-acento);
  }
  .ex-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .ex-chip {
    min-width: 44px;
    min-height: 36px;
    padding: 4px 12px;
    border: 1px solid var(--acento-borde);
    border-radius: 999px;
    background: var(--superficie);
    color: var(--tinta);
    font: inherit;
    font-size: 14px;
  }
  .ex-chip[aria-pressed='true'] {
    border-color: var(--acento);
    background: var(--acento);
    color: var(--sobre-acento);
  }
  @media (pointer: coarse) {
    .ex-chip {
      min-height: 44px;
    }
  }
  .ex-lectura {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 4px 10px;
    min-height: 1.6em;
  }
  .ex-que {
    color: var(--tinta-suave);
  }
  .ex-que::first-letter {
    text-transform: uppercase;
  }
  .ex-cifra {
    font-size: 20px;
    font-variant-numeric: tabular-nums;
  }
  .ex-cifra.ex-cambia {
    color: var(--titulos);
  }
  .ex-libro {
    color: var(--tinta-suave);
    font-size: 14px;
  }
  .ex-delta {
    padding: 1px 8px;
    border-radius: 999px;
    background: color-mix(in srgb, var(--c-ejemplo) 16%, transparent);
    color: color-mix(in srgb, var(--c-ejemplo) 70%, var(--tinta));
    font-size: 13.5px;
    font-weight: 700;
  }
  .ex-delta.ex-baja {
    background: color-mix(in srgb, var(--c-precaucion) 14%, transparent);
    color: color-mix(in srgb, var(--c-precaucion) 70%, var(--tinta));
  }
  .ex-conclusion {
    margin: 0;
    line-height: 1.45;
  }
  .ex-conclusion.ex-error {
    color: color-mix(in srgb, var(--c-precaucion) 70%, var(--tinta));
  }
  .ex-restaurar {
    display: inline-flex;
    align-items: center;
    justify-self: start;
    gap: 6px;
    min-height: 44px;
    padding: 0 4px;
    border: 0;
    background: none;
    color: var(--acento);
    font: inherit;
    font-size: 14.5px;
    font-weight: 600;
  }
</style>
