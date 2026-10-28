<script lang="ts">
  // «Ver en protoboard»: the circuit of a schematic placed automatically on a breadboard, full screen, as a
  // sandbox. Everything can be changed and simulated; closing it (the button or «Atrás») returns to the
  // schematic untouched. «Guardar como montaje propio» keeps a copy in «Mis montajes».
  import { onMount } from 'svelte';
  import X from '@lucide/svelte/icons/x';
  import Save from '@lucide/svelte/icons/save';
  import { cerrarProtoboard, type FuenteProtoboard } from '../../lib/protoboard.svelte';
  import { navegarDesdeCapa } from '../../lib/ruta.svelte';
  import { cargarDatos } from '../figuras-vivas/carga.svelte';
  import { circuitoDeDocumento, circuitoDeEsquema, circuitoDeNetlist } from './fuentes.ts';
  import { colocarCircuito } from './colocacion.ts';
  import { verificarMontaje } from './verificar.ts';
  import { guardarMontaje } from './circuitos.svelte';
  import { Protoboard as EstadoProtoboard } from './estado.svelte';
  import type { CircuitoFuente } from './tipos.ts';
  import Protoboard from './Protoboard.svelte';

  let { fuente }: { fuente: FuenteProtoboard } = $props();

  const pb = new EstadoProtoboard();
  let fase = $state<'cargando' | 'listo' | 'error'>('cargando');
  let error = $state('');
  let notas = $state<string[]>([]);
  let guardado = $state<string | null>(null);

  async function preparar(): Promise<void> {
    const f = fuente;
    let c: CircuitoFuente;
    if (f.tipo === 'netlist') c = await circuitoDeNetlist(f.texto, f.origen, f.refs ?? []);
    else if (f.tipo === 'documento') c = circuitoDeDocumento(f.doc, { tipo: 'editor' });
    else {
      const d = await cargarDatos(f.ruta);
      const esq = d.esquemas?.[f.indice];
      if (!esq) throw new Error('La figura no tiene ese esquema.');
      c = circuitoDeEsquema(esq, f.titulo, f.label);
    }
    c.titulo = f.titulo || c.titulo;
    // Let the «Colocando…» message paint before the placement (tens to hundreds of ms).
    await new Promise((r) => setTimeout(r, 30));
    const r = colocarCircuito(c);
    const problemas = verificarMontaje(r.doc);
    notas = problemas.length ? [...r.notas, `La colocación automática no ha podido reproducir todo el esquema (${problemas.slice(0, 2).join('; ')}).`] : r.notas;
    pb.cargar(r.doc);
    fase = 'listo';
  }

  onMount(() => {
    document.documentElement.classList.add('bloqueado');
    preparar().catch((e: unknown) => {
      error = e instanceof Error ? e.message : String(e);
      fase = 'error';
    });
    return () => document.documentElement.classList.remove('bloqueado');
  });

  async function guardar() {
    const doc = JSON.parse(JSON.stringify($state.snapshot(pb.doc))) as typeof pb.doc;
    doc.origen = { tipo: 'propio' };
    const nombre = (doc.titulo || 'Montaje').replace(/^Protoboard · /, '');
    guardado = await guardarMontaje(nombre, doc);
  }

  /** Moves the view to the body, out of any containment of the page. */
  function aCuerpo(nodo: HTMLElement) {
    document.body.appendChild(nodo);
    return {
      destroy() {
        nodo.remove();
      },
    };
  }
</script>

<div class="capa-protoboard" use:aCuerpo role="dialog" aria-modal="true" aria-label={`Protoboard: ${fuente.titulo}`}>
  {#if fase === 'listo'}
    <Protoboard {pb} pantallaCompleta>
      {#snippet cabecera()}
        <header class="cab">
          <div class="tit">
            <h2>Protoboard <span>· {fuente.titulo}</span></h2>
            <p>
              {#if guardado}Guardado en «Mis montajes». <button type="button" class="enlace" onclick={() => navegarDesdeCapa(`#/protoboard/${guardado}`)}>Abrirlo</button>{:else}{notas.join(' ')} Es una prueba: al cerrar, el esquema queda como estaba.{/if}
            </p>
          </div>
          <button type="button" class="boton" onclick={guardar} disabled={!!guardado} title="Guardar una copia en «Mis montajes»"><Save size={16} /><span class="largo">Guardar como montaje propio</span><span class="corto">Guardar</span></button>
          <button type="button" class="cerrar" aria-label="Cerrar y volver al esquema" title="Cerrar y volver al esquema" onclick={cerrarProtoboard}><X size={22} /></button>
        </header>
      {/snippet}
    </Protoboard>
  {:else}
    <header class="cab">
      <div class="tit"><h2>Protoboard <span>· {fuente.titulo}</span></h2></div>
      <button type="button" class="cerrar" aria-label="Cerrar y volver al esquema" onclick={cerrarProtoboard}><X size={22} /></button>
    </header>
    {#if fase === 'cargando'}
      <p class="espera" aria-live="polite"><span class="punto"></span> Colocando el circuito en la protoboard…</p>
    {:else}
      <div class="fallo" role="alert">
        <p><strong>No se ha podido montar este circuito en una protoboard.</strong></p>
        <p>{error}</p>
        <button type="button" class="boton" onclick={cerrarProtoboard}>Volver al esquema</button>
      </div>
    {/if}
  {/if}
</div>

<style>
  .capa-protoboard {
    position: fixed;
    inset: 0;
    z-index: 60;
    display: flex;
    flex-direction: column;
    height: 100dvh;
    background: var(--fondo);
    color: var(--tinta);
  }
  .capa-protoboard > :global(.protoboard) {
    flex: 1;
    min-height: 0;
  }
  .cab {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: calc(6px + env(safe-area-inset-top)) 8px 6px 14px;
    border-bottom: 1px solid var(--linea);
    background: var(--superficie);
    font-family: var(--sans);
  }
  .tit {
    flex: 1;
    min-width: 0;
  }
  h2 {
    margin: 0;
    overflow: hidden;
    color: var(--titulos);
    font-size: 17px;
    line-height: 1.25;
    white-space: nowrap;
    text-overflow: ellipsis;
  }
  h2 span {
    color: var(--tinta-suave);
    font-weight: 600;
  }
  .tit p {
    margin: 2px 0 0;
    color: var(--tinta-tenue);
    font-size: 12.5px;
    line-height: 1.3;
  }
  .cerrar {
    display: grid;
    flex: none;
    place-items: center;
    width: 44px;
    height: 44px;
    border: 0;
    border-radius: 12px;
    background: var(--hover);
    color: var(--tinta);
  }
  .corto {
    display: none;
  }
  @media (max-width: 640px) {
    .largo {
      display: none;
    }
    .corto {
      display: inline;
    }
    .tit p {
      display: -webkit-box;
      -webkit-line-clamp: 2;
      line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
  }
  .enlace {
    padding: 0;
    border: 0;
    background: none;
    color: var(--acento);
    font: inherit;
    font-weight: 600;
    text-decoration: underline;
  }
  .espera,
  .fallo {
    margin: 40px auto;
    max-width: 34em;
    padding: 0 20px;
    font-family: var(--sans);
    text-align: center;
    color: var(--tinta-suave);
  }
  .punto {
    display: inline-block;
    width: 9px;
    height: 9px;
    border-radius: 50%;
    background: var(--acento);
    animation: latido 1s infinite ease-in-out;
  }
  @keyframes latido {
    50% {
      opacity: 0.25;
    }
  }
</style>
