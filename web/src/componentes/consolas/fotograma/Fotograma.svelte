<script lang="ts">
  // «Un fotograma» tab (0.9): how one pixel of one frame comes to exist, in numbered steps. Each step lights the
  // chips and wires of the console's «Arquitectura» diagram that take part (pulses flow in the direction of the
  // signal, labels carry the values), marks the same chips on the board photo and advances a small example screen.
  // Controls: «Anterior», «Siguiente», the segmented bar (each segment jumps to its step), «Reproducir» / «Pausa»
  // (a pause long enough to read each step) and the keys ← →. The step lives in the URL
  // (#/consolas/<maquina>/fotograma/<paso>, 1-based) and is replaced, not pushed, so Back leaves the tab.
  import { tick, untrack } from 'svelte';
  import ArrowLeft from '@lucide/svelte/icons/arrow-left';
  import ArrowRight from '@lucide/svelte/icons/arrow-right';
  import Pause from '@lucide/svelte/icons/pause';
  import Play from '@lucide/svelte/icons/play';
  import RotateCcw from '@lucide/svelte/icons/rotate-ccw';
  import { app } from '../../../lib/estado.svelte';
  import { tonoBloque } from '../../../lib/color';
  import { hayCapas, ruta } from '../../../lib/ruta.svelte';
  import PieAcciones from '../../pregunta/PieAcciones.svelte';
  import type { Conexion, Maquina } from '../arquitectura/diagrama';
  import { cargarArquitectura } from '../arquitectura/maquinas';
  import type { DatosMaquina } from '../datos';
  import { enlace, leerAncla } from '../estado.svelte';
  import DiagramaPaso from './DiagramaPaso.svelte';
  import Pantalla from './Pantalla.svelte';
  import PlacaPaso from './PlacaPaso.svelte';
  import { cargarFotograma } from './maquinas';
  import type { FotogramaMaquina } from './tipos';

  let { datos }: { datos: DatosMaquina } = $props();

  let fm = $state<FotogramaMaquina | null>(null);
  let arq = $state<Maquina | null>(null);
  let error = $state('');
  let actual = $state(0);
  let reproduciendo = $state(false);
  let titulo: HTMLElement | undefined = $state();
  let tarjetaPaso: HTMLElement | undefined = $state();

  const total = $derived(fm?.pasos.length ?? 0);
  const paso = $derived(fm ? fm.pasos[Math.min(actual, total - 1)]! : null);
  const tono = $derived(tonoBloque(app.indice?.partes['cap37']?.color ?? 'A6552B', app.tema));

  /** Board diagram (the machine's default variant: PAL on the Mega Drive and the SNES, as their boards). */
  const diagramaPlaca = $derived(arq ? (arq.diagramaDe && arq.variantes?.[0] ? arq.diagramaDe(arq.variantes[0].id) : arq.diagrama) : null);
  const diagrama = $derived(arq && paso?.capa === 'interior' && arq.interior ? arq.interior.diagrama : diagramaPlaca);
  const conexiones = $derived(diagrama && fm ? [...diagrama.conexiones, ...(fm.extra ?? [])] : []);
  const bloquesPlaca = $derived(
    diagramaPlaca && paso ? diagramaPlaca.bloques.filter((b) => (paso.placa ?? (paso.capa === 'interior' ? [] : paso.bloques)).includes(b.id)) : [],
  );

  const CLASE_INTERNA = 'interno';
  /** «What travels»: every lit wire with a value, then the values that do not travel on a drawn wire. */
  const valores = $derived.by(() => {
    if (!paso) return [];
    const r: { nombre: string; valor: string; clase: string }[] = [];
    for (const s of paso.senales) {
      if (s.valor === undefined) continue;
      const c: Conexion | undefined = conexiones.find((x) => x.id === s.id);
      r.push({ nombre: s.nombre ?? c?.etiqueta ?? s.id, valor: s.valor, clase: c?.clase ?? CLASE_INTERNA });
    }
    for (const [nombre, valor] of paso.internos ?? []) r.push({ nombre, valor, clase: CLASE_INTERNA });
    return r;
  });

  // ------------------------------------------------------------------ loading and the URL

  $effect(() => {
    const id = datos.id;
    let vivo = true;
    Promise.all([cargarFotograma(id), cargarArquitectura(id)])
      .then(([f, a]) => {
        if (!vivo) return;
        fm = f;
        arq = a;
        const p = untrack(() => leerAncla(ruta.ancla).paso);
        ir(p ? p - 1 : 0, false);
      })
      .catch((e: unknown) => {
        if (vivo) error = e instanceof Error ? e.message : String(e);
      });
    return () => {
      vivo = false;
    };
  });

  // Back, forward or an edited URL: the step follows it.
  let vistaN = untrack(() => ruta.n);
  $effect(() => {
    const n = ruta.n;
    if (n === vistaN || !fm) return;
    vistaN = n;
    const a = untrack(() => leerAncla(ruta.ancla));
    if (a.pestana === 'fotograma' && a.maquina === datos.id && a.paso) ir(a.paso - 1, false);
  });

  async function ir(i: number, enfocar = true): Promise<void> {
    if (!fm) return;
    actual = Math.max(0, Math.min(i, total - 1));
    const h = `${enlace(datos.id, 'fotograma')}/${actual + 1}`;
    if (location.hash !== h) history.replaceState(history.state, '', h);
    if (enfocar) {
      await tick();
      titulo?.focus({ preventScroll: true });
      const r = tarjetaPaso?.getBoundingClientRect();
      if (r && (r.top < 0 || r.top > innerHeight * 0.6)) tarjetaPaso?.scrollIntoView({ block: 'start', behavior: 'instant' });
    }
  }

  function siguiente(): void {
    if (actual >= total - 1) {
      reproduciendo = false;
      void ir(0);
    } else void ir(actual + 1);
  }

  function anterior(): void {
    if (actual > 0) void ir(actual - 1);
  }

  // ------------------------------------------------------------------ autoplay

  /** Time to read a step: 4,5 s plus 55 ms per character, between 7 and 20 s. */
  const duracion = $derived(paso ? Math.min(20000, Math.max(7000, 4500 + 55 * (paso.titulo.length + paso.texto.length))) : 8000);

  $effect(() => {
    if (!reproduciendo || !fm) return;
    void actual;
    const t = setTimeout(() => {
      if (actual >= total - 1) reproduciendo = false;
      else void ir(actual + 1, false);
    }, duracion);
    return () => clearTimeout(t);
  });

  function alternar(): void {
    if (!reproduciendo && actual >= total - 1) void ir(0, false);
    reproduciendo = !reproduciendo;
  }

  function teclas(ev: KeyboardEvent): void {
    if (ev.ctrlKey || ev.metaKey || ev.altKey || ev.shiftKey || !fm) return;
    if (app.figura || app.buscador || hayCapas() || document.querySelector('[aria-modal="true"]')) return;
    const t = ev.target as HTMLElement | null;
    if (t?.closest('input, textarea, select, [contenteditable="true"], [role="slider"]')) return;
    if (ev.key === 'ArrowRight') {
      if (actual >= total - 1) return;
      ev.preventDefault();
      void ir(actual + 1);
    } else if (ev.key === 'ArrowLeft') {
      if (actual === 0) return;
      ev.preventDefault();
      anterior();
    }
  }

  // hook for the end-to-end tests (tests/fotograma09.spec.ts)
  $effect(() => {
    if (!fm || !paso) return;
    (globalThis as unknown as { __epaFotograma?: unknown }).__epaFotograma = {
      maquina: datos.id,
      total,
      paso: actual + 1,
      capa: paso.capa ?? 'placa',
      bloques: [...paso.bloques],
      senales: paso.senales.map((s) => s.id),
      reproduciendo,
      duracion,
    };
  });
</script>

<svelte:window onkeydown={teclas} />

<section
  class="fotograma"
  style:--bloque={tono.relleno}
  style:--sobre-bloque={tono.sobre}
  style:--bloque-texto={tono.texto}
  style:--bloque-tinte={tono.tinte}
  data-fotograma={datos.id}
  data-paso={actual + 1}
>
  {#if error}
    <div class="aviso"><p>No se pudieron cargar los pasos: {error}</p></div>
  {:else if !fm || !arq || !paso || !diagrama}
    <div class="cargando">Cargando…</div>
  {:else}
    <header class="cabecera">
      <p class="entrada">{fm.entrada} <span class="aviso-ejemplo">Los valores son un ejemplo coherente de principio a fin: no se emula ningún juego.</span></p>
      <div class="progreso">
        <div class="segmentos" role="group" aria-label="Pasos">
          {#each fm.pasos as p, i (i)}
            <button
              type="button"
              class="seg"
              class:hecho={i < actual}
              class:actual={i === actual}
              aria-label={`Paso ${i + 1}: ${p.titulo}`}
              aria-current={i === actual ? 'step' : undefined}
              onclick={() => ir(i)}
            >
              <span class="barra">
                {#if i === actual && reproduciendo}<span class="carga" style:--dur={`${duracion}ms`}></span>{/if}
              </span>
            </button>
          {/each}
        </div>
        <span class="cuenta" aria-live="polite" data-cuenta>{actual + 1}/{total}</span>
      </div>
    </header>

    <div class="rejilla">
      <article class="t09-tarjeta t09-sombra tarjeta-paso" bind:this={tarjetaPaso} aria-labelledby="fotograma-titulo">
        {#key actual}
          <span class="etiqueta">Paso {actual + 1} · {paso.fase}</span>
          <h2 id="fotograma-titulo" bind:this={titulo} tabindex="-1">{paso.titulo}</h2>
          <p class="texto">{paso.texto}</p>
          {#if valores.length}
            <div class="viaja">
              <span class="t09-rotulo">Lo que viaja</span>
              <dl>
                {#each valores as v, k (k)}
                  <div class="valor" data-clase={v.clase}>
                    <dt>{v.nombre}</dt>
                    <dd>{v.valor}</dd>
                  </div>
                {/each}
              </dl>
            </div>
          {/if}
        {/key}
      </article>

      <section class="t09-tarjeta tarjeta-diagrama" aria-label="Diagrama de bloques">
        <div class="cab-diagrama">
          <span class="t09-rotulo">{paso.capa === 'interior' && arq.interior ? arq.interior.titulo : 'Diagrama de bloques'}</span>
          <span class="leyenda">
            <i class="flecha" aria-hidden="true"></i> sentido de la señal
          </span>
        </div>
        <DiagramaPaso {diagrama} extra={fm.extra} {paso} etiqueta={`Diagrama de bloques de la ${datos.titulo}: ${paso.titulo}`} />
      </section>

      <section class="t09-tarjeta tarjeta-pantalla" aria-label="Pantalla de ejemplo">
        <Pantalla ejemplo={fm.ejemplo} etapa={paso.pantalla} nota={paso.nota} />
      </section>

      <section class="t09-tarjeta tarjeta-placa" aria-label="En la placa">
        <PlacaPaso {datos} bloques={bloquesPlaca} />
      </section>
    </div>

    <PieAcciones>
      <button type="button" class="accion corta" onclick={anterior} disabled={actual === 0} data-anterior>
        <ArrowLeft size={20} strokeWidth={2.2} aria-hidden="true" /> Anterior
      </button>
      <button type="button" class="accion corta" onclick={alternar} aria-label={reproduciendo ? 'Pausa' : 'Reproducir'} data-reproducir={reproduciendo ? 'si' : 'no'}>
        {#if reproduciendo}
          <Pause size={20} strokeWidth={2.2} aria-hidden="true" /> <span class="txt">Pausa</span>
        {:else}
          <Play size={20} strokeWidth={2.2} aria-hidden="true" /> <span class="txt">Reproducir</span>
        {/if}
      </button>
      <button type="button" class="accion primaria" onclick={siguiente} data-siguiente>
        {#if actual >= total - 1}
          <RotateCcw size={20} strokeWidth={2.2} aria-hidden="true" /> Desde el principio
        {:else}
          Siguiente <ArrowRight size={20} strokeWidth={2.2} aria-hidden="true" />
        {/if}
      </button>
    </PieAcciones>
  {/if}
</section>

<style>
  .fotograma {
    --pie-abajo: var(--hueco-inferior);
    --pad-pie: 0px;
    display: grid;
    gap: 16px;
    min-width: 0;
    font-family: var(--sans);
  }
  .cabecera {
    display: grid;
    gap: 12px;
  }
  .entrada {
    max-width: 62em;
    margin: 0;
    color: var(--tinta);
    font-size: 16px;
    line-height: 1.45;
  }
  .aviso-ejemplo {
    color: var(--tinta-suave);
  }
  .progreso {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .segmentos {
    display: flex;
    flex: 1;
    gap: 5px;
    min-width: 0;
  }
  .seg {
    flex: 1;
    min-width: 0;
    height: 32px;
    padding: 0;
    border: 0;
    background: transparent;
    cursor: pointer;
  }
  .seg .barra {
    position: relative;
    display: block;
    height: 8px;
    border-radius: 4px;
    background: var(--linea);
    overflow: hidden;
    transition: background 0.2s;
  }
  .seg.hecho .barra {
    background: var(--bloque);
  }
  .seg.actual .barra {
    background: var(--ambar-relleno);
  }
  .seg:hover .barra {
    filter: brightness(1.1);
  }
  .seg:focus-visible {
    outline: 2px solid var(--acento);
    outline-offset: 2px;
    border-radius: 4px;
  }
  /* autoplay: the current segment fills up until the next step */
  .carga {
    position: absolute;
    inset: 0;
    background: var(--bloque);
    transform-origin: left;
    animation: llenar var(--dur) linear forwards;
  }
  @keyframes llenar {
    from {
      transform: scaleX(0);
    }
    to {
      transform: scaleX(1);
    }
  }
  .cuenta {
    flex-shrink: 0;
    color: var(--tinta-suave);
    font-size: 15px;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }

  .rejilla {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    grid-template-areas: 'paso' 'diagrama' 'pantalla' 'placa';
    gap: 16px;
    align-items: start;
  }
  .tarjeta-paso {
    grid-area: paso;
    display: grid;
    gap: 10px;
    align-content: start;
  }
  .tarjeta-diagrama {
    grid-area: diagrama;
    display: grid;
    gap: 10px;
    padding: 12px;
  }
  .tarjeta-pantalla {
    grid-area: pantalla;
  }
  .tarjeta-placa {
    grid-area: placa;
  }
  @media (min-width: 700px) {
    .rejilla {
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
      grid-template-areas: 'paso paso' 'diagrama diagrama' 'pantalla placa';
    }
  }
  @media (min-width: 1100px) {
    .rejilla {
      grid-template-columns: minmax(0, 1.7fr) minmax(320px, 1fr);
      grid-template-areas: 'diagrama paso' 'diagrama pantalla' 'placa pantalla';
    }
  }
  .etiqueta {
    color: var(--bloque-texto);
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }
  h2 {
    margin: 0;
    color: var(--titulos);
    font-family: var(--serif);
    font-size: clamp(22px, 3.2vw, 26px);
    font-weight: 700;
    line-height: 1.2;
    text-wrap: balance;
  }
  h2:focus {
    outline: none;
  }
  .texto {
    margin: 0;
    font-family: var(--serif);
    font-size: 18px;
    line-height: 1.55;
    overflow-wrap: break-word;
  }
  .viaja {
    display: grid;
    gap: 8px;
    margin-top: 4px;
  }
  dl {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin: 0;
  }
  .valor {
    display: inline-flex;
    align-items: baseline;
    gap: 8px;
    max-width: 100%;
    padding: 5px 10px;
    border: 1px solid var(--linea);
    border-left: 4px solid var(--c, var(--tinta-tenue));
    border-radius: 8px;
    background: var(--superficie-2);
  }
  .valor[data-clase='bus'] {
    --c: #2e6ea6;
  }
  .valor[data-clase='dato'] {
    --c: #0f8b8d;
  }
  .valor[data-clase='control'] {
    --c: #7a4fd0;
  }
  .valor[data-clase='seleccion'] {
    --c: #c62828;
  }
  .valor[data-clase='reloj'] {
    --c: #1f8a4c;
  }
  .valor[data-clase='interrupcion'] {
    --c: #c77700;
  }
  dt {
    color: var(--tinta-suave);
    font-size: 14px;
    font-weight: 700;
    overflow-wrap: anywhere;
  }
  dd {
    margin: 0;
    color: var(--tinta);
    font-family: var(--mono);
    font-size: 14px;
    overflow-wrap: anywhere;
  }
  .cab-diagrama {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    justify-content: space-between;
    gap: 4px 12px;
    padding: 4px 4px 0;
  }
  .leyenda {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    color: var(--tinta-suave);
    font-size: 13px;
  }
  .flecha {
    width: 26px;
    height: 0;
    border-top: 3px dashed var(--tinta-suave);
    position: relative;
  }
  .flecha::after {
    content: '';
    position: absolute;
    right: -2px;
    top: -6px;
    border: 4.5px solid transparent;
    border-left: 7px solid var(--tinta-suave);
  }
  .cargando,
  .aviso {
    padding: 30px;
    color: var(--tinta-suave);
  }
  @media (max-width: 440px) {
    .txt {
      display: none;
    }
  }
</style>
