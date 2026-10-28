<script lang="ts">
  // «Practicar» of a chapter or appendix in Repaso (#/repaso/practica/<parte>): every practice item generated
  // for it (also those the lessons leave out), in book order, one per screen, with the result at the end.
  // Each first answer counts for the daily goal, as Repaso's answers do.
  import { onMount, tick } from 'svelte';
  import ArrowRight from '@lucide/svelte/icons/arrow-right';
  import { infoParte, rotuloParte } from '../../lib/datos';
  import { tonoBloque } from '../../lib/color';
  import { app } from '../../lib/estado.svelte';
  import { registrarActividad } from '../../lib/progreso-diario.svelte';
  import CabeceraPasos from '../pregunta/CabeceraPasos.svelte';
  import PieAcciones from '../pregunta/PieAcciones.svelte';
  import Practica, { type RespuestaPractica } from './Practica.svelte';
  import type { ItemPractica } from './tipos';
  import { cargarPractica, NOMBRE_TIPO } from './datos';

  let { parte }: { parte: string } = $props();

  let items = $state.raw<ItemPractica[] | null>(null);
  let respuestas = $state<(RespuestaPractica | null)[]>([]);
  let k = $state(0);
  let final = $state(false);
  let titulo: HTMLElement | undefined = $state();

  const info = $derived(infoParte(parte));
  const tono = $derived(tonoBloque(info?.color, app.tema));
  const n = $derived(items?.length ?? 0);
  const item = $derived(items && k < n ? items[k]! : null);
  const aciertos = $derived(respuestas.filter((r) => r?.bien && r.intentos === 1).length);

  onMount(() => {
    void cargarPractica(parte).then((d) => {
      items = d?.items ?? [];
      respuestas = (d?.items ?? []).map(() => null);
    });
  });

  function responder(r: RespuestaPractica) {
    respuestas[k] = r;
    registrarActividad('pregunta');
  }

  async function ir(i: number) {
    k = Math.max(0, Math.min(i, n));
    final = false;
    window.scrollTo({ top: 0, behavior: 'instant' });
    await tick();
    titulo?.focus({ preventScroll: true });
  }
</script>

<div class="practica-parte" style:--bloque={tono.relleno} style:--sobre-bloque={tono.sobre} style:--bloque-texto={tono.texto} data-practica-parte={parte}>
  {#if items === null}
    <p class="aviso">Cargando la práctica…</p>
  {:else if !items.length}
    <p class="aviso">Este capítulo no tiene práctica todavía. <a href="#/repaso">Volver al repaso</a></p>
  {:else}
    <CabeceraPasos total={n} actual={k} contexto={`Practicar · ${rotuloParte(parte)} · ${(info?.titulo ?? '').split(' — ')[0]}`} descripcion={item ? `Práctica ${k + 1} de ${n}` : 'Práctica terminada'} cerrar="#/repaso" etiquetaCerrar="Volver al repaso" />
    <main class="cuerpo">
      <div class="columna">
        {#if item}
          {#key item.id}
            <h1 class="solo-lector" bind:this={titulo} tabindex="-1">Práctica {k + 1} de {n}: {NOMBRE_TIPO[item.tipo]}</h1>
            <Practica {item} respuesta={respuestas[k]} onresponder={responder} bind:final />
          {/key}
        {:else}
          <section class="resultado" data-resultado>
            <h1 bind:this={titulo} tabindex="-1">Práctica terminada</h1>
            <p><strong>{aciertos} de {n}</strong> a la primera.</p>
            <a class="volver" href="#/repaso">Volver al repaso</a>
          </section>
        {/if}
      </div>
    </main>
    {#if item}
      <PieAcciones>
        {#if final}
          <button type="button" class="accion corta" onclick={() => ir(k - 1)} disabled={k === 0} data-atras>Atrás</button>
        {:else}
          <button type="button" class="accion corta" onclick={() => ir(k + 1)} data-saltar>Saltar</button>
        {/if}
        <button type="button" class="accion primaria" disabled={!final} onclick={() => ir(k + 1)} data-continuar>
          Continuar <ArrowRight size={20} strokeWidth={2.2} aria-hidden="true" />
        </button>
      </PieAcciones>
    {/if}
  {/if}
</div>

<style>
  .practica-parte {
    --pie-abajo: var(--hueco-inferior);
    max-width: 640px;
    margin: 0 auto;
    font-family: var(--sans);
  }
  .cuerpo {
    padding: 24px 0 28px;
  }
  .columna {
    display: flex;
    flex-direction: column;
    gap: 20px;
  }
  .resultado {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    padding: 40px 0;
    text-align: center;
  }
  .resultado h1 {
    margin: 0;
    font-family: var(--serif);
    font-size: 28px;
  }
  .volver {
    min-height: 44px;
    display: inline-flex;
    align-items: center;
    font-weight: 600;
  }
  .aviso {
    padding: 30vh 0;
    color: var(--tinta-suave);
    text-align: center;
  }
</style>
