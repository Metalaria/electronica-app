<script lang="ts">
  // A problem with changing values: a formula of the book (or an exercise of the book reproduced by it) with
  // other realistic values on every new problem. The answer is read as the exercises do (lib/magnitudes.ts:
  // «4,7 k», «4k7», «0,5 mA», decimal comma or point) and checked against the formula with the item's
  // tolerance; the hints are the book's equation with the paragraph that introduces it and then the set-up
  // with these numbers; the solution is the calculators' «Paso a paso» with the numbers of this variant.
  import { untrack } from 'svelte';
  import '../calculadoras/mates.css';
  import { prepararHtml } from '../../lib/datos';
  import { pasos } from '../calculadoras/mates';
  import PasoAPaso from '../calculadoras/PasoAPaso.svelte';
  import type { ItemNumerico, Pista } from './tipos';
  import type { Comprobacion } from './Practica.svelte';
  import { citaConValores, comprobarPedido, enunciadoDe, pedidoDe, textoPide, variante } from './variantes';
  import { guardarSemilla, semillaDe } from './datos';

  let {
    item,
    final,
    listo = $bindable(false),
    pistas = $bindable(null),
    onenviar,
    semillaFija = null,
  }: {
    item: ItemNumerico;
    final: boolean;
    listo?: boolean;
    pistas?: Pista[] | null;
    onenviar: () => void;
    /** 0.11 (group B): the values of the problem of the day (the same for the whole day; the stored seed is not advanced). */
    semillaFija?: number | null;
  } = $props();

  const semilla = untrack(() => semillaFija ?? semillaDe(item.id));
  const avanzar = (n: number) => {
    if (untrack(() => semillaFija) == null) guardarSemilla(item.id, n);
  };
  const v = untrack(() => variante(item, semilla));
  const f = untrack(() => item.formula);
  const vo = untrack(() => f.vars.find((x) => x.id === item.objetivo)!);
  const sim = (id: string) => f.vars.find((x) => x.id === id)?.sim ?? id;
  const enunciado = untrack(() => (v ? enunciadoDe(item, v) : ''));
  // final QA 1.0: what the field asks and what is accepted, with this variant's values (the same as the exams')
  const pedido = untrack(() => (v ? pedidoDe(item, v) : null));
  const correcto = pedido?.texto ?? '';
  // the field's label: what is asked (a bare symbol reads «R₂ =»; a phrase stands alone)
  const etiquetaSimbolo = untrack(() => !item.ejercicio || !/\s/.test(item.ejercicio.pide.replace(/<[^>]+>/g, '').trim()));

  let escrito = $state('');
  let respondido = $state('');
  const vacio = $derived(!escrito.trim());
  $effect(() => {
    listo = !vacio;
  });

  // Hints: the book's equation with its introduction, then the set-up with these numbers.
  untrack(() => {
    if (!v) return;
    // the formula itself is the first hint: the set-up is the solved form (if any) and the substitution
    const lineas = pasos(f, item.objetivo, v.valores, v.resultado, sim).filter((p) => p.tipo === 'despeje' || p.tipo === 'sustitucion');
    pistas = [
      {
        // (the book's paragraph may quote the book's example values, not this variant's)
        titulo: item.intro?.html && citaConValores(item.intro.html) ? 'La fórmula del libro (el párrafo usa los valores del libro)' : 'La fórmula del libro',
        ec: { svg: f.svg, w: f.w, h: f.h },
        html: item.intro?.html ?? '',
      },
      {
        titulo: 'El planteamiento',
        html: lineas.map((p) => `<div class="p10-linea"><span class="p10-nota">${p.nota ?? ''}</span><span class="mate">${p.html}</span></div>`).join(''),
      },
    ];
  });

  export function comprobar(): Comprobacion {
    if (!v || !pedido) return { bien: false, nula: true, mensaje: 'Este problema no tiene valores válidos.' };
    const r = comprobarPedido(escrito, pedido);
    if (r.tipo === 'vacio') return { bien: false, nula: true, mensaje: 'Escriba el resultado.' };
    if (r.tipo === 'ilegible' || r.tipo === 'unidad') return { bien: false, nula: true, mensaje: r.mensaje };
    respondido = escrito.trim();
    if (r.tipo === 'bien') {
      avanzar(semilla + 1);
      return { bien: true };
    }
    return { bien: false, mensaje: r.mensaje };
  }

  export function reintentar(): void {
    escrito = '';
  }

  $effect(() => {
    if (final) untrack(() => avanzar(semilla + 1));
  });

  function enviar(ev: Event) {
    ev.preventDefault();
    if (!final && !vacio) onenviar();
  }
</script>

<div class="numerico" data-semilla={semilla} data-resultado={pedido?.valor} data-valores={v ? JSON.stringify(v.valores) : undefined}>
  {#if !v || !pedido}
    <p class="aviso">No se pudieron preparar valores para este problema.</p>
  {:else}
    {#if item.ejercicio}
      <p class="origen">Ejercicio {item.ejercicio.num} del libro, con otros valores</p>
      <div class="p10-ej" data-enunciado>{@html prepararHtml(enunciado)}</div>
      <p class="pide" data-pide>{textoPide(item)} <strong>{@html prepararHtml(pedido.nombre)}</strong></p>
    {:else}
      <h2 class="enunciado" data-enunciado>{@html prepararHtml(enunciado)}</h2>
    {/if}
    <form class="campo-num" class:ok={final && respondido && respondido === escrito.trim() && !!escrito} onsubmit={enviar}>
      {#if etiquetaSimbolo}
        <label for={`n10-${item.id}`} class="sim" data-etiqueta-campo>{@html item.ejercicio ? prepararHtml(pedido.nombre) : vo.sim} =</label>
      {:else}
        <label for={`n10-${item.id}`} class="nombre-campo" data-etiqueta-campo>{@html prepararHtml(pedido.nombre)}</label>
      {/if}
      <input
        id={`n10-${item.id}`}
        bind:value={escrito}
        inputmode="decimal"
        autocomplete="off"
        spellcheck="false"
        placeholder="0,0"
        disabled={final}
        data-numero
      />
      {#if vo.unidad}<span class="unidad">{vo.unidad}</span>{/if}
      {#if !final}<button class="comprobar" type="submit" disabled={vacio} data-comprobar>Comprobar</button>{/if}
    </form>
    {#if !final}
      <p class="ayuda">Puede escribir «4,7 k», «4k7», «0,5 mA» o «2,2e-3»: coma o punto decimal, con o sin prefijo.</p>
    {:else}
      <div class="p10-solucion" data-solucion>
        <span class="rot">La solución con estos valores</span>
        <p class="res">
          {#if respondido}Su respuesta: {respondido}{vo.unidad && !/[a-zA-ZΩµ]$/.test(respondido) ? ` ${vo.unidad}` : ''}{' · '}{/if}resultado:
          {#if pedido.serie}
            <strong data-correcto>{correcto}</strong>, el valor {pedido.serie} más cercano a {pedido.calculado?.texto} (solo se acepta ese valor)
          {:else}
            <strong data-correcto>{correcto}</strong> (se acepta ±{Math.round(item.tol * 100)} %)
          {/if}
        </p>
        <PasoAPaso {f} objetivo={item.objetivo} valores={v.valores} resultado={v.resultado} />
      </div>
    {/if}
  {/if}
</div>

<style>
  .numerico {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }
  .origen {
    margin: 0;
    color: var(--tinta-suave);
    font-size: 13px;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }
  .p10-ej {
    color: var(--titulos);
    font-family: var(--serif);
    font-size: 19px;
    line-height: 1.45;
  }
  .pide {
    margin: 0;
    color: var(--tinta);
    font-size: 16px;
  }
  .enunciado {
    margin: 0;
    color: var(--titulos);
    font-family: var(--serif);
    font-size: clamp(21px, 3vw, 25px);
    font-weight: 600;
    line-height: 1.32;
  }
  .campo-num {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 10px;
    min-height: 60px;
  }
  .sim {
    color: var(--tinta);
    font-family: var(--serif);
    font-size: 21px;
    font-style: italic;
  }
  .nombre-campo {
    flex: 1 1 100%;
    color: var(--tinta);
    font-size: 16px;
    font-weight: 600;
  }
  .sim :global(sub) {
    font-style: normal;
    font-size: 0.7em;
  }
  input {
    flex: 1 1 140px;
    min-width: 0;
    height: 56px;
    padding: 0 14px;
    border: 2px solid var(--linea);
    border-radius: 14px;
    background: var(--superficie);
    color: var(--tinta);
    font-size: 20px;
    font-variant-numeric: tabular-nums;
  }
  input:focus {
    border-color: var(--acento);
    /* the app's focus ring (WCAG 2.4.7 / 2.4.11; QA 1.0: a border colour alone was not enough) */
    outline: 2px solid var(--acento);
    outline-offset: 2px;
  }
  .unidad {
    color: var(--tinta);
    font-size: 18px;
    font-weight: 600;
  }
  .comprobar {
    min-height: 56px;
    padding: 0 22px;
    border: 0;
    border-radius: var(--v11-radio-boton);
    background: var(--bloque, var(--acento));
    color: var(--sobre-bloque, var(--sobre-acento));
    font-size: 17px;
    font-weight: 600;
  }
  /* 1.1: the mock-up's grey disabled button, text readable */
  .comprobar:disabled {
    background: var(--v11-inactivo);
    color: var(--v11-sobre-inactivo);
  }
  .ayuda {
    margin: 0;
    color: var(--tinta-suave);
    font-size: 14.5px;
  }
  .res {
    margin: 0;
    color: var(--tinta);
    font-size: 15.5px;
  }
  .aviso {
    color: var(--tinta-suave);
  }
  :global(.p10-linea) {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 4px 0 4px 10px;
    border-left: 3px solid var(--linea);
    overflow-x: auto;
  }
  :global(.p10-linea .mate) {
    font-size: 18px;
  }
  :global(.p10-nota) {
    color: var(--tinta-suave);
    font-family: var(--sans);
    font-size: 12.5px;
  }
</style>
