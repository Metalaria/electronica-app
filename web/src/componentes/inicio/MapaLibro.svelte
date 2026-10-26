<script lang="ts">
  // Start page: the book as a map. Every part of every volume is a tile in its block colour, filled from the
  // bottom with the fraction of its sections read (one notch per section at its foot); a finished part is a
  // solid tile with a tick. Pure CSS: nothing to load. A tile opens the part where the reader left it.
  import { onMount } from 'svelte';
  import { app } from '../../lib/estado.svelte';
  import { aprendizaje, cargarAprendizaje } from '../../lib/aprendizaje.svelte';
  import { infoParte, rotuloParte } from '../../lib/datos';
  import { colorBloque } from '../../lib/color';
  import Icono from '../Icono.svelte';

  let { actual = '' }: { actual?: string } = $props();

  const indice = $derived(app.indice!);

  interface Tesela {
    id: string;
    num: string | null;
    nombre: string;
    color: string;
    secciones: boolean[];
    leidas: number;
    anexo: boolean;
  }

  const tomos = $derived.by(() => {
    void aprendizaje.listo;
    return indice.tomos.map((t) => {
      let total = 0;
      let leidas = 0;
      const teselas: Tesela[] = t.partes
        .filter((p) => indice.partes[p])
        .map((id) => {
          const p = infoParte(id)!;
          const l = aprendizaje.leidas[id];
          const secciones = (p.secciones ?? []).map((s) => !!l?.[s.label]);
          const n = secciones.filter(Boolean).length;
          total += secciones.length;
          leidas += n;
          const num = p.num != null && p.num !== '' && (p.tipo === 'capitulo' || p.tipo === 'apendice') ? String(p.num) : null;
          return { id, num, nombre: (p.titulo.split(' — ')[0] ?? p.titulo).trim(), color: colorBloque(p.color), secciones, leidas: n, anexo: num == null };
        });
      return { id: t.id, titulo: t.titulo, teselas, f: total ? leidas / total : 0 };
    });
  });

  const total = $derived.by(() => {
    let s = 0;
    let l = 0;
    for (const t of tomos) for (const x of t.teselas) {
      s += x.secciones.length;
      l += x.leidas;
    }
    return { s, l };
  });

  function etiqueta(x: Tesela): string {
    const base = x.anexo ? x.nombre : `${rotuloParte(x.id)}: ${x.nombre}`;
    if (!x.secciones.length) return base;
    if (x.leidas === x.secciones.length) return `${base}. Leído entero`;
    return `${base}. ${x.leidas} de ${x.secciones.length} secciones leídas`;
  }

  onMount(() => {
    void cargarAprendizaje();
  });
</script>

<section class="mapa" aria-labelledby="tit-mapa">
  <header class="cab">
    <h2 id="tit-mapa">Mapa del libro</h2>
    <p class="resumen">
      {#if aprendizaje.listo}{total.l} de {total.s} secciones leídas{/if}
    </p>
  </header>
  {#if indice.bloques?.length}
    <div class="leyenda" aria-label="Bloques temáticos">
      {#each indice.bloques as b (b.color)}
        <span><i style:background={colorBloque(b.color)}></i>{b.nombre}</span>
      {/each}
    </div>
  {/if}

  {#each tomos as t (t.id)}
    <div class="tomo">
      <div class="tomo-cab">
        <span class="tomo-id">Tomo {t.id}</span>
        <span class="tomo-tit">{t.titulo}</span>
        {#if t.f > 0}<span class="tomo-pct">{Math.round(t.f * 100)} %</span>{/if}
      </div>
      <ul class="teselas">
        {#each t.teselas as x (x.id)}
          {@const f = x.secciones.length ? x.leidas / x.secciones.length : 0}
          {@const completa = x.secciones.length > 0 && x.leidas === x.secciones.length}
          <li>
            <a
              class="tesela"
              class:anexo={x.anexo}
              class:completa
              class:actual={x.id === actual}
              class:empezada={x.leidas > 0}
              href={x.id === 'glosario' ? '#/glosario' : `#/${x.id}`}
              style:--c={x.color}
              style:--f={f}
              data-parte={x.id}
              data-leidas={x.leidas}
              aria-label={etiqueta(x)}
              title={etiqueta(x)}
              aria-current={x.id === actual ? 'true' : undefined}
            >
              <span class="relleno" aria-hidden="true"></span>
              <span class="num" aria-hidden="true">
                {#if x.num != null}{x.num}{:else}<Icono nombre={x.id === 'glosario' ? 'glosario' : 'libro'} tam={17} grosor={2.1} />{/if}
              </span>
              {#if completa}<span class="hecho" aria-hidden="true"><Icono nombre="hecho" tam={14} grosor={3} /></span>{/if}
              <span class="nom" aria-hidden="true">{x.nombre}</span>
              {#if x.secciones.length}
                <span class="muescas" aria-hidden="true">
                  {#each x.secciones as leida, k (k)}<i class:l={leida}></i>{/each}
                </span>
              {/if}
            </a>
          </li>
        {/each}
      </ul>
    </div>
  {/each}
</section>

<style>
  .mapa {
    margin-top: 34px;
  }
  .cab {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    justify-content: space-between;
    gap: 4px 16px;
  }
  h2 {
    margin: 0;
    color: var(--tinta-tenue);
    font-size: 13px;
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }
  .resumen {
    margin: 0;
    color: var(--tinta-tenue);
    font-size: 13.5px;
    font-variant-numeric: tabular-nums;
  }
  .leyenda {
    display: flex;
    flex-wrap: wrap;
    gap: 6px 16px;
    margin: 10px 0 4px;
    color: var(--tinta-suave);
    font-size: 13px;
  }
  .leyenda span {
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }
  .leyenda i {
    width: 11px;
    height: 11px;
    border-radius: 3px;
  }
  .tomo {
    margin-top: 18px;
  }
  .tomo-cab {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 2px 10px;
    margin-bottom: 8px;
  }
  .tomo-id {
    color: var(--tinta-tenue);
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }
  .tomo-tit {
    color: var(--titulos);
    font-family: var(--serif);
    font-size: 17px;
    font-weight: 600;
    line-height: 1.25;
  }
  .tomo-pct {
    color: var(--tinta-tenue);
    font-size: 12.5px;
    font-variant-numeric: tabular-nums;
  }
  .teselas {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(118px, 1fr));
    gap: 8px;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .tesela {
    position: relative;
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 96px;
    padding: 9px 10px 10px;
    overflow: hidden;
    border: 1px solid color-mix(in srgb, var(--c) 28%, var(--linea));
    border-top: 4px solid var(--c);
    border-radius: 10px;
    background: var(--superficie);
    color: var(--tinta);
    text-decoration: none;
    isolation: isolate;
    transition: box-shadow 0.15s, transform 0.15s;
  }
  .tesela:hover {
    box-shadow: var(--sombra);
  }
  /* dark theme: the darkest block colours (navy) need a lighter edge to be seen */
  :global(:root[data-tema='oscuro']) .tesela {
    border-top-color: color-mix(in srgb, var(--c) 70%, #fff 30%);
  }
  @media (prefers-reduced-motion: no-preference) {
    .tesela:hover {
      transform: translateY(-1px);
    }
  }
  .tesela:focus-visible {
    outline: 2px solid var(--c);
    outline-offset: 2px;
  }
  /* sections read: a tint of the block colour rising from the bottom */
  .relleno {
    position: absolute;
    inset: auto 0 0 0;
    z-index: -1;
    height: calc(var(--f) * 100%);
    background: color-mix(in srgb, var(--c) 17%, var(--superficie));
  }
  :global(:root[data-tema='oscuro']) .relleno {
    background: color-mix(in srgb, var(--c) 34%, var(--superficie));
  }
  .num {
    display: flex;
    align-items: center;
    min-height: 26px;
    color: var(--c);
    font-size: 24px;
    font-weight: 700;
    line-height: 1;
    font-variant-numeric: tabular-nums;
    letter-spacing: -0.01em;
  }
  :global(:root[data-tema='oscuro']) .num {
    color: color-mix(in srgb, var(--c) 50%, #fff 50%);
  }
  .nom {
    display: -webkit-box;
    margin-top: 4px;
    overflow: hidden;
    color: var(--tinta-suave);
    font-size: 12.5px;
    font-weight: 600;
    line-height: 1.25;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
  }
  .muescas {
    display: flex;
    gap: 2px;
    margin-top: auto;
    padding-top: 8px;
  }
  .muescas i {
    flex: 1;
    height: 4px;
    border-radius: 2px;
    background: color-mix(in srgb, var(--c) 18%, var(--linea));
  }
  .muescas i.l {
    background: var(--c);
  }
  :global(:root[data-tema='oscuro']) .muescas i.l {
    background: color-mix(in srgb, var(--c) 65%, #fff 35%);
  }
  .anexo {
    border-style: dashed;
    border-top-style: solid;
  }
  .anexo .num {
    color: var(--tinta-tenue);
  }
  /* finished: the solid block colour */
  .completa {
    border-color: var(--c);
    background: var(--c);
  }
  .completa .relleno {
    display: none;
  }
  .completa .num,
  .completa .nom {
    color: #fff;
  }
  .completa .muescas i,
  .completa .muescas i.l {
    background: rgba(255, 255, 255, 0.55);
  }
  :global(:root[data-tema='oscuro']) .completa {
    background: color-mix(in srgb, var(--c) 80%, #fff 20%);
  }
  .hecho {
    position: absolute;
    top: 8px;
    right: 8px;
    display: grid;
    place-items: center;
    width: 22px;
    height: 22px;
    border-radius: 50%;
    background: #fff;
    color: var(--c);
  }
  .actual {
    box-shadow: 0 0 0 2px var(--fondo), 0 0 0 4px var(--c);
  }
  @media (max-width: 599px) {
    .teselas {
      grid-template-columns: repeat(auto-fill, minmax(78px, 1fr));
      gap: 6px;
    }
    .tesela {
      min-height: 84px;
      padding: 7px 7px 8px;
    }
    .num {
      font-size: 20px;
      min-height: 22px;
    }
    .nom {
      font-size: 11.5px;
    }
    .hecho {
      top: 6px;
      right: 6px;
      width: 18px;
      height: 18px;
    }
  }
</style>
