<script lang="ts" module>
  // The filter survives leaving the glossary, so «Volver al glosario» finds it as it was.
  let filtroGuardado = '';
</script>

<script lang="ts">
  import { onMount, tick, untrack } from 'svelte';
  import type { EntradaGlosario, Parte } from '../lib/tipos';
  import { app } from '../lib/estado.svelte';
  import { ruta, prepararSalto, recordarScroll, volver } from '../lib/ruta.svelte';
  import {
    cargarBusqueda,
    cargarGlosario,
    cargarParte,
    idGlosario,
    infoParte,
    letraDe,
    normalizar,
    prepararHtml,
    rutaDeRef,
    textoPlano,
  } from '../lib/datos';
  import { colorBloque } from '../lib/color';
  import Icono from './Icono.svelte';

  interface Entrada extends EntradaGlosario {
    id: string;
    letra: string;
    plano: string;
    buscable: string;
  }

  let entradas = $state<Entrada[]>([]);
  let intro = $state('');
  let error = $state('');
  let filtro = $state(filtroGuardado);
  $effect(() => {
    filtroGuardado = filtro;
  });
  let barra: HTMLElement | undefined = $state();

  const titulo = $derived(infoParte('glosario')?.titulo ?? 'Glosario');
  const color = $derived(infoParte('glosario')?.color ?? '8A1F3D');

  const filtradas = $derived.by(() => {
    const palabras = normalizar(filtro).split(/\s+/).filter(Boolean);
    if (!palabras.length) return entradas;
    return entradas.filter((e) => palabras.every((p) => e.buscable.includes(p)));
  });

  const grupos = $derived.by(() => {
    const g: { letra: string; entradas: Entrada[] }[] = [];
    for (const e of filtradas) {
      const ultimo = g[g.length - 1];
      if (ultimo && ultimo.letra === e.letra) ultimo.entradas.push(e);
      else g.push({ letra: e.letra, entradas: [e] });
    }
    return g;
  });

  const ALFABETO = ['#', ...'ABCDEFGHIJKLMN'.split(''), 'Ñ', ...'OPQRSTUVWXYZ'.split('')];
  const presentes = $derived(new Set(grupos.map((g) => g.letra)));

  function ir(letra: string) {
    const el = document.getElementById(`letra-${letra}`);
    if (!el) return;
    const y = el.getBoundingClientRect().top + window.scrollY - desfase();
    window.scrollTo({ top: y, behavior: 'smooth' });
  }

  function desfase(): number {
    const b = (document.querySelector('header.barra') as HTMLElement | null)?.offsetHeight ?? 56;
    return b + (barra?.offsetHeight ?? 0) + 6;
  }

  function nombreRef(clave: string): { texto: string; titulo: string; color: string } {
    const r = app.refs[clave];
    if (!r) return { texto: clave.replace(/^[a-z]+-/, ''), titulo: '', color: '1A3A5C' };
    const p = infoParte(r.parte);
    const s = p?.secciones?.find((x) => x.num === r.num);
    return {
      texto: r.num,
      titulo: s ? `${s.num} ${s.titulo}` : (p?.titulo ?? ''),
      color: p?.color ?? '1A3A5C',
    };
  }

  function clicRef() {
    prepararSalto({ texto: 'Volver al glosario' });
  }

  async function posicionar() {
    await tick();
    if (ruta.y != null) {
      window.scrollTo({ top: ruta.y, behavior: 'instant' });
      return;
    }
    if (ruta.ancla) {
      let el = document.getElementById(ruta.ancla);
      if (!el) {
        // A search document id that is not the app's own id: match it by title.
        const docs = await cargarBusqueda().catch(() => []);
        const d = docs.find((x) => x.id === ruta.ancla);
        if (d) {
          const t = normalizar(d.titulo);
          const e = entradas.find((x) => normalizar(x.plano) === t);
          if (e) el = document.getElementById(e.id);
        }
      }
      if (el) {
        filtro = '';
        await tick();
        const y = el.getBoundingClientRect().top + window.scrollY - desfase();
        window.scrollTo({ top: y, behavior: 'instant' });
        el.classList.add('destello');
        setTimeout(() => el?.classList.remove('destello'), 2600);
        return;
      }
    }
    window.scrollTo({ top: 0, behavior: 'instant' });
  }

  onMount(() => {
    app.seccion = null;
    Promise.all([cargarGlosario(), cargarParte('glosario').catch(() => null as Parte | null)])
      .then(([g, parte]) => {
        const usados = new Map<string, number>();
        entradas = g.map((e) => {
          let id = e.id || idGlosario(e.termino);
          const n = usados.get(id) ?? 0;
          usados.set(id, n + 1);
          if (n) id += `-${n + 1}`;
          const plano = textoPlano(e.termino);
          return { ...e, id, letra: letraDe(e.termino), plano, buscable: normalizar(plano + ' ' + textoPlano(e.html)) };
        });
        const p = parte?.bloques.find((b) => b.t === 'p');
        intro = p && p.t === 'p' ? p.html : '';
      })
      .catch((e: unknown) => (error = e instanceof Error ? e.message : String(e)));
    const desplazar = () => recordarScroll();
    window.addEventListener('scroll', desplazar, { passive: true });
    return () => window.removeEventListener('scroll', desplazar);
  });

  $effect(() => {
    if (!entradas.length) return;
    void ruta.n;
    untrack(() => {
      if (ruta.vista === 'glosario') void posicionar();
    });
  });
</script>

<svelte:head><title>{titulo} · Electrónica Práctica Avanzada</title></svelte:head>

<div class="glosario" style:--banda={colorBloque(color)}>
  <header class="cab">
    <h1>{titulo}</h1>
    {#if intro}<p>{@html prepararHtml(intro)}</p>{/if}
  </header>

  <div class="herramientas" bind:this={barra}>
    <label class="filtro">
      <Icono nombre="buscar" tam={18} />
      <input
        type="search"
        placeholder="Filtrar términos…"
        bind:value={filtro}
        aria-label="Filtrar los términos del glosario"
        autocomplete="off"
        spellcheck="false"
      />
      <span class="cuenta">{filtradas.length} {filtradas.length === 1 ? 'término' : 'términos'}</span>
    </label>
    <nav class="letras" aria-label="Letras">
      {#each ALFABETO as l (l)}
        <button disabled={!presentes.has(l)} onclick={() => ir(l)} aria-label={l === '#' ? 'Números y símbolos' : `Letra ${l}`}>{l}</button>
      {/each}
    </nav>
  </div>

  {#if error}
    <p class="vacio">No se pudo cargar el glosario: {error}</p>
  {:else if entradas.length && !filtradas.length}
    <p class="vacio">Ningún término coincide con «{filtro}».</p>
  {/if}

  <div class="lista texto-libro">
    {#each grupos as g (g.letra)}
      <section id={`letra-${g.letra}`} class="grupo">
        <h2 class="letra">{g.letra}</h2>
        <dl>
          {#each g.entradas as e (e.id)}
            <div class="entrada" id={e.id}>
              <dt>{@html prepararHtml(e.termino_html || e.termino)}</dt>
              <dd>
                {@html prepararHtml(e.html)}
                {#if e.ver.length}
                  <span class="ver">
                    {#each e.ver as clave (clave)}
                      {@const r = nombreRef(clave)}
                      {@const href = rutaDeRef(clave)}
                      {#if href}
                        <a class="chip" {href} title={r.titulo} style:--c={colorBloque(r.color)} onclick={clicRef}
                          >→ {r.texto}</a
                        >
                      {:else}
                        <span class="chip muerto">→ {r.texto}</span>
                      {/if}
                    {/each}
                  </span>
                {/if}
              </dd>
            </div>
          {/each}
        </dl>
      </section>
    {/each}
  </div>
</div>

{#if ruta.desde}
  <button class="volver" onclick={volver}><Icono nombre="volver" tam={18} /> {ruta.desde.texto}</button>
{/if}

<style>
  .glosario {
    --pad: clamp(16px, 4vw, 40px);
    max-width: calc(46em + 2 * var(--pad));
    margin: 0 auto;
    padding: 0 var(--pad) 64px;
    font-size: var(--tam);
  }
  .cab {
    margin: 0 calc(-1 * var(--pad));
    padding: clamp(28px, 6vw, 44px) var(--pad) 26px;
    background: var(--banda);
    color: #fff;
    font-family: var(--sans);
  }
  @media (min-width: 760px) {
    .cab {
      margin: 28px 0 0;
      border-radius: 14px;
    }
  }
  h1 {
    margin: 0;
    font-size: clamp(27px, 4.4vw, 38px);
    font-weight: 700;
    line-height: 1.12;
    letter-spacing: -0.01em;
  }
  .cab p {
    max-width: 40em;
    margin: 10px 0 0;
    color: rgba(255, 255, 255, 0.86);
    font-size: 16px;
    line-height: 1.45;
  }

  .herramientas {
    position: sticky;
    top: calc(var(--alto-barra) + env(safe-area-inset-top));
    z-index: 5;
    margin: 0 calc(-1 * var(--pad));
    padding: 12px var(--pad) 8px;
    background: var(--fondo);
    border-bottom: 1px solid var(--linea-suave);
    font-family: var(--sans);
  }
  .filtro {
    display: flex;
    align-items: center;
    gap: 10px;
    height: 44px;
    padding: 0 14px;
    border: 1px solid var(--linea);
    border-radius: 12px;
    background: var(--superficie);
    color: var(--tinta-tenue);
  }
  .filtro:focus-within {
    border-color: var(--acento);
  }
  .filtro input {
    flex: 1;
    min-width: 0;
    border: 0;
    outline: 0;
    background: none;
    color: var(--tinta);
    font-size: 16px;
  }
  .cuenta {
    flex: none;
    font-size: 13px;
  }
  .letras {
    display: flex;
    gap: 2px;
    margin-top: 8px;
    overflow-x: auto;
    scrollbar-width: none;
  }
  .letras::-webkit-scrollbar {
    display: none;
  }
  .letras button {
    flex: 1 0 auto;
    min-width: 26px;
    height: 32px;
    padding: 0 4px;
    border: 0;
    border-radius: 7px;
    background: none;
    color: var(--acento);
    font-size: 14.5px;
    font-weight: 700;
  }
  .letras button:hover:not(:disabled) {
    background: var(--acento-tinte);
  }
  .letras button:disabled {
    color: var(--linea);
    cursor: default;
  }

  .vacio {
    margin: 32px 0;
    color: var(--tinta-suave);
    font-family: var(--sans);
    text-align: center;
  }
  .grupo {
    margin-top: 24px;
  }
  .letra {
    margin: 0 0 4px;
    padding-bottom: 4px;
    border-bottom: 1.5px solid var(--acento);
    color: var(--acento);
    font-family: var(--sans);
    font-size: 1.5em;
    font-weight: 700;
  }
  dl {
    margin: 0;
  }
  .entrada {
    padding: 12px 8px 12px;
    border-bottom: 1px solid var(--linea-suave);
    border-radius: 6px;
  }
  dt {
    margin: 0 0 3px;
    color: var(--titulos);
    font-family: var(--sans);
    font-size: 1.02em;
    font-weight: 700;
  }
  dd {
    margin: 0;
    line-height: 1.55;
  }
  .ver {
    display: inline-flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-left: 6px;
    vertical-align: 1px;
  }
  .chip {
    display: inline-flex;
    align-items: center;
    min-height: 26px;
    padding: 0 9px;
    border: 1px solid var(--linea);
    border-radius: 999px;
    background: var(--superficie);
    color: var(--c);
    font-family: var(--sans);
    font-size: 0.78em;
    font-weight: 700;
    text-decoration: none;
    white-space: nowrap;
  }
  :global(:root[data-tema='oscuro']) .chip {
    color: var(--acento);
  }
  .chip:hover {
    border-color: var(--c);
  }
  .chip.muerto {
    color: var(--tinta-tenue);
  }

  .volver {
    position: fixed;
    left: 50%;
    bottom: calc(18px + env(safe-area-inset-bottom));
    z-index: 25;
    display: inline-flex;
    align-items: center;
    gap: 8px;
    min-height: 44px;
    padding: 0 18px 0 14px;
    border: 0;
    border-radius: 999px;
    background: var(--titulos);
    color: var(--fondo);
    box-shadow: var(--sombra-alta);
    font-family: var(--sans);
    font-size: 15px;
    font-weight: 600;
    transform: translateX(-50%);
  }
  :global(.app:not(.movil)) .volver {
    left: calc(50% + var(--ancho-lateral) / 2);
  }
</style>
