<script lang="ts">
  // Answer panel of one exercise or problem: a field per requested quantity (SI prefixes, units, decimal
  // comma), «Comprobar» with per-field feedback, progressive hints, «Ver solución», and the attempt
  // state saved on the device. Answers that cannot be checked automatically get «comparar con la solución»
  // and a self-assessment.
  import type { ItemEjercicio } from '../../lib/ejercicios.svelte';
  import { NOMBRE_CLASE } from '../../lib/ejercicios.svelte';
  import { comprobar, type Veredicto } from '../../lib/magnitudes';
  import {
    aprendizaje,
    autoevaluar,
    registrarIntento,
    reiniciarEjercicio,
    usarPista,
    verSolucion,
  } from '../../lib/aprendizaje.svelte';
  import Icono from '../Icono.svelte';
  import OtrosValores from '../practica/OtrosValores.svelte';

  let {
    label,
    item,
    solucionVisible = false,
    alVerSolucion,
    sinSolucion = false,
  }: {
    label: string;
    item: ItemEjercicio;
    solucionVisible?: boolean;
    /** Shows (or hides) the book's solution. */
    alVerSolucion?: (ver: boolean) => void;
    sinSolucion?: boolean;
  } = $props();

  const estado = $derived(aprendizaje.ejercicios[label]);
  const auto = $derived(item.modo === 'auto' && item.respuestas.length > 0);

  let valores = $state<Record<string, string>>({});
  let veredictos = $state<Record<string, Veredicto>>({});
  let iniciado = '';

  // Restore the last values typed (once per item).
  $effect(() => {
    if (iniciado === label || !aprendizaje.listo) return;
    iniciado = label;
    const e = aprendizaje.ejercicios[label];
    valores = { ...(e?.valores ?? {}) };
    veredictos = {};
    if (e?.valores) {
      for (const r of item.respuestas) {
        const v = e.valores[r.id];
        if (v) veredictos[r.id] = comprobar(v, r, r.alternativas);
      }
    }
  });

  const pistasVistas = $derived(Math.min(item.pistas.length, estado?.pistas ?? 0));
  const idBase = $derived(`cmp-${label.replace(/[^\w-]/g, '_')}`);

  function comprobarTodo(ev: SubmitEvent) {
    ev.preventDefault();
    const nuevos: Record<string, Veredicto> = {};
    let legibles = 0;
    const bien: string[] = [];
    for (const r of item.respuestas) {
      const v = comprobar(valores[r.id] ?? '', r, r.alternativas);
      nuevos[r.id] = v;
      if (v.tipo === 'bien' || v.tipo === 'cerca' || v.tipo === 'mal') legibles++;
      if (v.tipo === 'bien') bien.push(r.id);
    }
    veredictos = nuevos;
    // Only a check with something readable counts as an attempt.
    if (legibles === 0) return;
    const completo = bien.length === item.respuestas.length;
    registrarIntento(label, $state.snapshot(valores), bien, completo);
  }

  function pista() {
    if (pistasVistas < item.pistas.length) usarPista(label, pistasVistas + 1);
    else mostrarSolucion();
  }

  function mostrarSolucion() {
    if (!solucionVisible) verSolucion(label);
    alVerSolucion?.(!solucionVisible);
  }

  function reiniciar() {
    reiniciarEjercicio(label);
    valores = {};
    veredictos = {};
  }

  const resumenEstado = $derived.by(() => {
    if (!estado) return '';
    const partes: string[] = [];
    if (estado.resuelto) {
      if (estado.intentos <= 1 && !estado.pistas && !estado.solucion) partes.push('Resuelto a la primera');
      else if (estado.solucion) partes.push('Resuelto después de ver la solución');
      else if (estado.pistas) partes.push(`Resuelto con ${estado.pistas === 1 ? 'una pista' : `${estado.pistas} pistas`}`);
      else partes.push('Resuelto');
    } else if (estado.fallos) partes.push('Pendiente de acertar');
    if (estado.intentos) partes.push(`${estado.intentos} ${estado.intentos === 1 ? 'intento' : 'intentos'}`);
    return partes.join(' · ');
  });

  const ICONO: Record<string, string> = { bien: '✓', cerca: '≈', mal: '✗', unidad: '?', ilegible: '?' };
</script>

<div class="comprobador" class:resuelto={estado?.resuelto} data-label={label}>
  {#if auto}
    <form onsubmit={comprobarTodo} novalidate>
      <div class="campos">
        {#each item.respuestas as r (r.id)}
          {@const v = veredictos[r.id]}
          <div class="campo" data-r={r.id}>
            <label class="nombre" for={`${idBase}-${r.id}`}>{@html r.nombre}</label>
            <span class="entrada" class:conunidad={!!r.unidad}>
              <input
                id={`${idBase}-${r.id}`}
                type="text"
                inputmode="text"
                autocomplete="off"
                autocapitalize="off"
                spellcheck="false"
                enterkeyhint="done"
                placeholder={r.unidad ? 'p. ej. 4,7 k' : 'valor'}
                aria-describedby={v && v.tipo !== 'vacio' ? `${idBase}-${r.id}-fb` : undefined}
                aria-invalid={v?.tipo === 'mal' ? 'true' : undefined}
                bind:value={valores[r.id]}
                oninput={() => delete veredictos[r.id]}
              />
              {#if r.unidad}<span class="u" aria-hidden="true">{r.unidad}</span>{/if}
            </span>
            {#if v && v.tipo !== 'vacio'}
              <p class="fb fb-{v.tipo}" id={`${idBase}-${r.id}-fb`} aria-live="polite">
                <span class="ic" aria-hidden="true">{ICONO[v.tipo]}</span>
                {#if v.tipo === 'bien'}
                  <span>Correcto{v.nota ? ` (${v.nota})` : ''}: {v.texto}.</span>
                {:else}
                  <span>{v.mensaje}</span>
                {/if}
              </p>
            {/if}
          </div>
        {/each}
      </div>
      {#if item.otras?.length}
        <p class="otras">
          <strong>También se pide</strong>, para comparar con la solución:
          {#each item.otras as o, k (k)}{@html o.texto}{k < item.otras.length - 1 ? '; ' : '.'}{/each}
        </p>
      {/if}
      <div class="acciones">
        <button type="submit" class="boton primario">
          <Icono nombre="hecho" tam={17} /> Comprobar
        </button>
        {@render botones()}
      </div>
    </form>
  {:else}
    <p class="comparar">
      {#if item.clase === 'sin-solucion'}
        El libro no trae la solución de este ejercicio.
      {:else}
        <span class="clase">{NOMBRE_CLASE[item.clase]}</span>
        Resuélvalo por escrito y compare con la solución.
        {#if item.otras?.length}
          Se pide: {#each item.otras as o, k (k)}{@html o.texto}{k < item.otras.length - 1 ? '; ' : '.'}{/each}
        {/if}
      {/if}
    </p>
    <div class="acciones">
      {@render botones()}
    </div>
    {#if solucionVisible && item.clase !== 'sin-solucion'}
      <div class="autoevaluacion" role="group" aria-label="Autoevaluación">
        <span>¿Lo tenía bien?</span>
        <button class="boton" class:elegido={estado?.resuelto} onclick={() => autoevaluar(label, true)}>
          <Icono nombre="hecho" tam={16} /> Sí
        </button>
        <button class="boton" class:elegido={!!estado && !estado.resuelto && estado.fallos > 0} onclick={() => autoevaluar(label, false)}>
          <Icono nombre="x" tam={16} /> No
        </button>
      </div>
    {/if}
  {/if}

  {#if pistasVistas > 0}
    <ol class="pistas" aria-live="polite">
      {#each item.pistas.slice(0, pistasVistas) as p, k (k)}
        <li><span class="pn">Pista {k + 1}</span> {@html p}</li>
      {/each}
    </ol>
  {/if}

  {#if item.nota}
    <p class="nota-ej">{@html item.nota}</p>
  {/if}
  {#if item.errata}
    <p class="errata"><strong>Aviso:</strong> {@html item.errata}</p>
  {/if}

  <OtrosValores {label} parte={item.parte} />

  {#if resumenEstado}
    <p class="estado">
      {#if estado?.resuelto}<span class="ok" aria-hidden="true">✓</span>{/if}
      <span>{resumenEstado}</span>
      <button type="button" class="reiniciar" onclick={reiniciar}>Reiniciar</button>
    </p>
  {/if}
</div>

{#snippet botones()}
  {#if item.pistas.length}
    <button type="button" class="boton" onclick={pista} aria-label={pistasVistas < item.pistas.length ? `Pista ${pistasVistas + 1} de ${item.pistas.length}` : 'Ver la solución'}>
      <Icono nombre="pista" tam={17} />
      {pistasVistas < item.pistas.length ? `Pista ${pistasVistas + 1}/${item.pistas.length}` : 'Solución'}
    </button>
  {/if}
  {#if !sinSolucion}
    <button type="button" class="boton" aria-expanded={solucionVisible} onclick={mostrarSolucion}>
      <Icono nombre={solucionVisible ? 'ocultar' : 'ver'} tam={17} />
      {solucionVisible ? 'Ocultar solución' : 'Ver solución'}
    </button>
  {/if}
{/snippet}

<style>
  .comprobador {
    margin: 0.2em 0 0.9em;
    padding: 12px 14px 10px;
    border: 1px solid var(--linea);
    border-radius: 10px;
    background: var(--superficie);
    font-family: var(--sans);
    font-size: 15.5px;
    line-height: 1.4;
  }
  .comprobador.resuelto {
    border-color: color-mix(in srgb, var(--c-ejemplo) 55%, var(--linea));
  }
  .campos {
    display: grid;
    gap: 10px;
  }
  .campo {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(150px, 210px);
    align-items: center;
    gap: 4px 12px;
  }
  .nombre {
    color: var(--tinta);
    font-weight: 600;
  }
  .nombre :global(sub) {
    font-size: 0.75em;
  }
  .entrada {
    position: relative;
    display: flex;
    align-items: center;
  }
  input {
    width: 100%;
    min-height: 44px;
    padding: 0 12px;
    border: 1px solid var(--linea);
    border-radius: 8px;
    background: var(--fondo);
    color: var(--tinta);
    font-family: var(--sans);
    font-size: 16.5px;
    font-variant-numeric: tabular-nums;
  }
  .conunidad input {
    padding-right: 3.2em;
  }
  input:focus-visible {
    outline: 2px solid var(--acento);
    outline-offset: 0;
    border-color: transparent;
  }
  input[aria-invalid='true'] {
    border-color: var(--c-precaucion);
  }
  .u {
    position: absolute;
    right: 12px;
    color: var(--tinta-tenue);
    font-size: 15px;
    pointer-events: none;
  }
  .fb {
    grid-column: 1 / -1;
    display: flex;
    gap: 7px;
    margin: 0;
    padding: 6px 10px;
    border-radius: 7px;
    font-size: 14.5px;
    animation: aparecer 0.16s ease-out;
  }
  .fb .ic {
    flex: none;
    font-weight: 700;
  }
  .fb-bien {
    background: rgb(from var(--c-ejemplo) r g b / 0.13);
    color: var(--tinta);
  }
  .fb-bien .ic {
    color: var(--c-ejemplo);
  }
  .fb-cerca {
    background: rgb(from var(--c-importante) r g b / 0.15);
  }
  .fb-cerca .ic {
    color: var(--c-importante);
  }
  .fb-mal,
  .fb-unidad,
  .fb-ilegible {
    background: rgb(from var(--c-precaucion) r g b / 0.11);
  }
  .fb-mal .ic,
  .fb-unidad .ic,
  .fb-ilegible .ic {
    color: var(--c-precaucion);
  }
  @keyframes aparecer {
    from {
      opacity: 0;
      transform: translateY(-2px);
    }
  }
  .otras,
  .comparar {
    margin: 10px 0 0;
    color: var(--tinta-suave);
    font-size: 14.5px;
  }
  .comparar {
    margin-top: 0;
  }
  .clase {
    display: inline-block;
    margin-right: 6px;
    padding: 0 8px;
    border-radius: 999px;
    background: var(--acento-tinte);
    color: var(--acento);
    font-size: 12.5px;
    font-weight: 700;
    letter-spacing: 0.03em;
    line-height: 22px;
    text-transform: uppercase;
  }
  .acciones,
  .autoevaluacion {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
    margin-top: 12px;
  }
  .acciones :global(.boton),
  .autoevaluacion .boton {
    min-height: 44px;
  }
  .autoevaluacion span {
    color: var(--tinta-suave);
    font-weight: 600;
  }
  .autoevaluacion .elegido {
    border-color: var(--acento);
    background: var(--acento-tinte);
  }
  .pistas {
    display: grid;
    gap: 6px;
    margin: 12px 0 0;
    padding: 0;
    list-style: none;
  }
  .pistas li {
    padding: 8px 12px;
    border-left: 3px solid var(--c-tarjeta);
    border-radius: 3px 8px 8px 3px;
    background: var(--tarjeta-fondo);
    font-size: 15px;
    animation: aparecer 0.18s ease-out;
  }
  .pn {
    margin-right: 4px;
    color: var(--c-tarjeta-texto);
    font-weight: 700;
  }
  .nota-ej {
    margin: 10px 0 0;
    color: var(--tinta-tenue);
    font-size: 13.5px;
  }
  .errata {
    margin: 10px 0 0;
    padding: 6px 10px;
    border-radius: 7px;
    background: rgb(from var(--c-importante) r g b / 0.12);
    font-size: 14px;
  }
  .estado {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;
    margin: 10px 0 0;
    color: var(--tinta-tenue);
    font-size: 13.5px;
  }
  .estado .ok {
    color: var(--c-ejemplo);
    font-weight: 700;
  }
  .reiniciar {
    min-height: 44px;
    margin-left: auto;
    padding: 0 10px;
    border: 0;
    border-radius: 6px;
    background: none;
    color: var(--tinta-tenue);
    font-size: 13.5px;
    text-decoration: underline;
    text-underline-offset: 2px;
  }
  .reiniciar:hover {
    color: var(--tinta);
  }
  @media (max-width: 520px) {
    .campo {
      grid-template-columns: 1fr;
    }
    .comprobador {
      padding: 10px 12px 8px;
    }
  }
</style>
