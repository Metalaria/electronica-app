<script lang="ts">
  // Start page (0.9): the book as a path of chapters. The volume being read is open: one node per part —
  // done (every section read: a tick on the block colour), current («Estás aquí · 5.2», tinted card), pending
  // (its number on a pale disc) — joined by a line that takes the block colour where the reading has passed.
  // The other volumes are rows with their block colours as chips; a tap opens their path below. Replaces the
  // 0.8 mosaic («Mapa del libro»). Pure CSS: nothing to load.
  import { onMount } from 'svelte';
  import { app } from '../../lib/estado.svelte';
  import { aprendizaje, cargarAprendizaje } from '../../lib/aprendizaje.svelte';
  import { infoParte, rotuloParte } from '../../lib/datos';
  import { tonoBloque, type TonoBloque } from '../../lib/color';
  import { corto, hrefParte } from '../../lib/navegacion.svelte';
  import Icono from '../Icono.svelte';
  import Rotulo from '../ui09/Rotulo.svelte';

  let { actual = '', seccion = '' }: { actual?: string; seccion?: string } = $props();

  interface Nodo {
    id: string;
    num: string | null;
    nombre: string;
    tono: TonoBloque;
    secciones: number;
    leidas: number;
    estado: 'hecho' | 'actual' | 'pendiente';
  }

  const indice = $derived(app.indice!);

  const tomos = $derived.by(() => {
    void aprendizaje.listo;
    return indice.tomos.map((t) => {
      const nodos: Nodo[] = t.partes
        .filter((id) => indice.partes[id])
        .map((id) => {
          const p = infoParte(id)!;
          const l = aprendizaje.leidas[id];
          const secs = p.secciones ?? [];
          const leidas = secs.filter((s) => l?.[s.label]).length;
          const num = p.num != null && p.num !== '' && (p.tipo === 'capitulo' || p.tipo === 'apendice') ? String(p.num) : null;
          const hecho = secs.length > 0 && leidas === secs.length;
          return {
            id,
            num,
            nombre: corto(p.titulo).trim(),
            tono: tonoBloque(p.color, app.tema),
            secciones: secs.length,
            leidas,
            estado: id === actual ? 'actual' : hecho ? 'hecho' : 'pendiente',
          } satisfies Nodo;
        });
      const colores = [...new Set(t.partes.map((id) => indice.partes[id]?.color).filter((c): c is string => !!c))];
      return {
        id: t.id,
        titulo: t.titulo,
        nodos,
        hechas: nodos.filter((n) => n.secciones > 0 && n.leidas === n.secciones).length,
        conSecciones: nodos.filter((n) => n.secciones > 0).length,
        tonos: colores.map((c) => tonoBloque(c, app.tema)),
      };
    });
  });

  /** The volume of the part being read (or the first). */
  const tomoActual = $derived(tomos.find((t) => t.nodos.some((n) => n.id === actual)) ?? tomos[0]);
  const tonoTomo = $derived(tomoActual?.tonos[0] ?? tonoBloque(null, app.tema));

  // volumes opened by the reader on this visit
  let abiertos = $state<Record<string, boolean>>({});

  function sub(n: Nodo): string {
    if (!n.secciones) return 'Para consultar';
    if (n.leidas === n.secciones) return `${n.secciones} ${n.secciones === 1 ? 'sección' : 'secciones'} · leído`;
    if (n.leidas) return `${n.leidas} de ${n.secciones} secciones leídas`;
    return `${n.secciones} ${n.secciones === 1 ? 'sección' : 'secciones'}`;
  }

  function etiqueta(n: Nodo): string {
    const base = n.num != null ? `${rotuloParte(n.id)}: ${n.nombre}` : n.nombre;
    const aqui = n.estado === 'actual' ? '. Estás aquí' : '';
    if (!n.secciones) return base + aqui;
    if (n.leidas === n.secciones) return `${base}. Leído entero${aqui}`;
    return `${base}. ${n.leidas} de ${n.secciones} secciones leídas${aqui}`;
  }

  onMount(() => {
    void cargarAprendizaje();
  });
</script>

{#snippet camino(nodos: Nodo[])}
  <ol class="camino">
    {#each nodos as n, i (n.id)}
      {@const ultimo = i === nodos.length - 1}
      <li class="nodo-fila {n.estado}" style:--c09={n.tono.relleno} style:--sobre09={n.tono.sobre} style:--tinte09={n.tono.tinte} style:--texto09={n.tono.texto}>
        <a
          class="nodo"
          href={hrefParte(n.id)}
          data-parte={n.id}
          data-leidas={n.leidas}
          data-estado={n.estado}
          aria-label={etiqueta(n)}
          aria-current={n.estado === 'actual' ? 'step' : undefined}
        >
          <span class="eje" aria-hidden="true">
            <span class="disco">
              {#if n.estado === 'hecho'}
                <Icono nombre="hecho" tam={24} grosor={3} />
              {:else if n.num != null}
                {n.num}
              {:else}
                <Icono nombre={n.id === 'glosario' ? 'glosario' : 'libro'} tam={21} grosor={2.1} />
              {/if}
            </span>
            <span class="linea" class:oculta={ultimo} class:pasada={n.estado === 'hecho'}></span>
          </span>
          <span class="texto" aria-hidden="true">
            <span class="cuadro">
              {#if n.estado === 'actual'}<span class="aqui">Estás aquí{seccion ? ` · ${seccion}` : ''}</span>{/if}
              <span class="nom">{n.nombre}</span>
              <span class="sub">{sub(n)}</span>
            </span>
          </span>
        </a>
      </li>
    {/each}
  </ol>
{/snippet}

{#if tomoActual}
  <section class="camino-libro" aria-labelledby="tit-camino">
    <div class="cab">
      <Rotulo color={tonoTomo.texto}>
        Tomo {tomoActual.id} · {tomoActual.hechas} de {tomoActual.conSecciones}
        {tomoActual.conSecciones === 1 ? 'parte leída' : 'partes leídas'}
      </Rotulo>
      <h2 id="tit-camino">{tomoActual.titulo}</h2>
    </div>
    {@render camino(tomoActual.nodos)}

    <div class="otros">
      {#each tomos.filter((t) => t.id !== tomoActual.id) as t (t.id)}
        {@const abierto = !!abiertos[t.id]}
        <div class="otro" class:abierto>
          <button
            type="button"
            class="tomo-fila"
            aria-expanded={abierto}
            aria-controls={`camino-tomo-${t.id}`}
            data-tomo={t.id}
            onclick={() => (abiertos[t.id] = !abierto)}
          >
            <span class="chips" aria-hidden="true">
              {#each t.tonos as tono (tono.relleno)}<span style:background={tono.relleno}></span>{/each}
            </span>
            <span class="tomo-txt">
              <span class="tomo-id">Tomo {t.id}{t.hechas ? ` · ${t.hechas} de ${t.conSecciones} leídas` : ''}</span>
              <span class="tomo-tit">{t.titulo}</span>
            </span>
            <span class="flecha" aria-hidden="true"><Icono nombre="chevron" tam={20} grosor={2} /></span>
          </button>
          {#if abierto}
            <div class="desplegado" id={`camino-tomo-${t.id}`}>
              {@render camino(t.nodos)}
            </div>
          {/if}
        </div>
      {/each}
    </div>
  </section>
{/if}

<style>
  .camino-libro {
    display: flex;
    flex-direction: column;
    gap: 16px;
    min-width: 0;
  }
  .cab {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  h2 {
    margin: 0;
    color: var(--titulos);
    font-family: var(--serif);
    font-size: 21px;
    font-weight: 600;
    line-height: 1.3;
    text-wrap: balance;
  }

  .camino {
    display: flex;
    flex-direction: column;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .nodo {
    display: flex;
    align-items: stretch;
    gap: 14px;
    color: var(--tinta);
    text-decoration: none;
    -webkit-tap-highlight-color: transparent;
  }
  .nodo:focus-visible {
    outline: none;
  }
  .nodo:focus-visible .disco {
    outline: 2px solid var(--acento);
    outline-offset: 3px;
  }
  .eje {
    display: flex;
    flex: none;
    flex-direction: column;
    align-items: center;
    width: 52px;
  }
  .disco {
    display: grid;
    flex: none;
    place-items: center;
    width: 52px;
    height: 52px;
    border: 3px solid var(--linea);
    border-radius: 50%;
    background: var(--superficie-2);
    color: var(--tinta-suave);
    font-family: var(--serif);
    font-size: 20px;
    font-weight: 700;
    line-height: 1;
    transition: transform 0.15s;
  }
  .hecho .disco {
    border-color: var(--c09);
    background: var(--c09);
    color: var(--sobre09);
  }
  .actual .disco {
    border-color: var(--c09);
    background: var(--superficie);
    color: var(--texto09);
  }
  .nodo:hover .disco {
    transform: scale(1.05);
  }
  .linea {
    flex: 1;
    width: 4px;
    min-height: 18px;
    border-radius: 2px;
    background: var(--linea);
  }
  .linea.pasada {
    background: var(--c09);
  }
  .linea.oculta {
    visibility: hidden;
  }
  .texto {
    flex: 1;
    min-width: 0;
    padding: 6px 0 18px;
  }
  .cuadro {
    display: flex;
    flex-direction: column;
    gap: 3px;
    border-radius: var(--radio-tarjeta-p);
  }
  .actual .cuadro {
    padding: 12px 14px;
    border: 1px solid var(--c09);
    background: var(--tinte09);
  }
  .aqui {
    align-self: flex-start;
    padding: 3px 8px;
    border-radius: 999px;
    background: var(--c09);
    color: var(--sobre09);
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }
  .nom {
    color: var(--tinta);
    font-size: 16px;
    font-weight: 600;
    line-height: 1.3;
  }
  .nodo:hover .nom {
    text-decoration: underline;
    text-decoration-thickness: 1px;
    text-underline-offset: 3px;
  }
  .sub {
    color: var(--tinta-suave);
    font-size: 14px;
  }
  /* on the tinted card the soft ink falls just under 4.5:1 */
  .actual .sub {
    color: var(--tinta);
  }

  .otros {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .tomo-fila {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
    min-height: 56px;
    padding: 12px 16px;
    border: 1px solid var(--linea);
    border-radius: var(--radio-tarjeta-p);
    background: var(--superficie);
    color: var(--tinta);
    font-family: inherit;
    text-align: left;
    transition: border-color 0.15s, box-shadow 0.15s;
  }
  .tomo-fila:hover {
    border-color: var(--acento-borde);
    box-shadow: var(--sombra);
  }
  .chips {
    display: flex;
    flex: none;
    gap: 4px;
  }
  .chips span {
    width: 10px;
    height: 28px;
    border-radius: 3px;
  }
  .tomo-txt {
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }
  .tomo-id {
    color: var(--tinta-suave);
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }
  .tomo-tit {
    font-size: 15px;
    font-weight: 600;
    line-height: 1.3;
  }
  .flecha {
    display: grid;
    flex: none;
    color: var(--tinta-suave);
    transition: transform 0.2s;
  }
  .abierto .flecha {
    transform: rotate(90deg);
  }
  .desplegado {
    padding: 16px 0 0 4px;
  }
</style>
