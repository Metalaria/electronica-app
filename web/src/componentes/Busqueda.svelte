<script lang="ts">
  import { desplazable } from '../lib/desplazable';
  import { tick, untrack } from 'svelte';
  import { app } from '../lib/estado.svelte';
  import { navegarDesdeCapa, ruta } from '../lib/ruta.svelte';
  import { buscar, fragmento, prepararBuscador, type Resultado } from '../lib/buscador';
  import { buscarLugares, prepararLugares, type Lugar, type TipoLugar } from '../lib/lugares';
  import { infoParte, rotuloParte } from '../lib/datos';
  import { colorBloque } from '../lib/color';
  import { cerrarBuscador } from '../lib/acciones';
  import Icono from './Icono.svelte';
  import Insignia from './Insignia.svelte';
  import MiniaturaLibro from './miniaturas/MiniaturaLibro.svelte';
  import InsigniaNuevo from './aprender/InsigniaNuevo.svelte';

  let consulta = $state('');
  let resultados = $state<Resultado[]>([]);
  /** 2.1: the app's tools and places that match (lib/lugares.ts), listed before the book's results. */
  let lugares = $state<Lugar[]>([]);
  /** How many options there are: the places, then the book's results (one index for the keyboard). */
  const total = $derived(lugares.length + resultados.length);
  let sel = $state(0);
  let preparando = $state(false);
  let buscado = $state('');
  let campo: HTMLInputElement | undefined = $state();
  let lista: HTMLElement | undefined = $state();
  let turno = 0;

  // 1.0 accessibility pass: closed without going anywhere (Esc, «Cerrar», the backdrop, «Atrás»), the focus goes back
  // to what had it before (it fell to <body>); a result chosen changes the route, and the router moves the focus there.
  $effect(() => {
    if (!app.buscador) return;
    const antes = untrack(() => (document.activeElement instanceof HTMLElement && document.activeElement !== document.body ? document.activeElement : null));
    const n = untrack(() => ruta.n);
    return () => {
      requestAnimationFrame(() => {
        const a = document.activeElement;
        if (ruta.n === n && antes?.isConnected && (!a || a === document.body)) antes.focus({ preventScroll: true });
      });
    };
  });

  // Focus and select the query every time the search opens.
  $effect(() => {
    if (!app.buscador) return;
    if (app.buscarTexto) {
      consulta = app.buscarTexto;
      app.buscarTexto = '';
    }
    tick().then(() => {
      campo?.focus();
      campo?.select();
    });
    preparando = true;
    void prepararLugares().then(() => {
      // the projects and the calculators arrived: search again what is typed
      if (consulta.trim()) lugares = buscarLugares(consulta);
    });
    prepararBuscador()
      .catch(() => undefined)
      .finally(() => (preparando = false));
  });

  // Debounced search.
  $effect(() => {
    const q = consulta;
    if (!app.buscador) return;
    const mio = ++turno;
    const t = setTimeout(async () => {
      const l = q.trim() ? buscarLugares(q) : [];
      const r = q.trim() ? await buscar(q).catch(() => [] as Resultado[]) : [];
      if (mio !== turno) return;
      lugares = l;
      resultados = r;
      buscado = q.trim();
      sel = 0;
      lista?.scrollTo({ top: 0 });
    }, 90);
    return () => clearTimeout(t);
  });

  function href(r: Resultado): string {
    const d = r.doc;
    return d.parte === 'glosario' ? `#/glosario/${encodeURIComponent(d.id)}` : `#/${d.parte}/${encodeURIComponent(d.id)}`;
  }

  function ir(r: Resultado | undefined) {
    if (!r) return;
    const s = app.seccion;
    navegarDesdeCapa(href(r), { texto: s ? `Volver a ${s.num}` : 'Volver' });
  }

  function irLugar(l: Lugar | undefined) {
    if (!l) return;
    const s = app.seccion;
    navegarDesdeCapa(l.href, { texto: s ? `Volver a ${s.num}` : 'Volver' });
  }

  /** The option at an index of the one list (places first). */
  function abrir(k: number) {
    if (k < lugares.length) irLugar(lugares[k]);
    else ir(resultados[k - lugares.length]);
  }

  function clicLugar(ev: MouseEvent, l: Lugar) {
    if (ev.ctrlKey || ev.metaKey || ev.shiftKey) return;
    ev.preventDefault();
    irLugar(l);
  }

  const ICONO_LUGAR: Record<TipoLugar, 'simulador' | 'instrumentos' | 'consolas' | 'placa' | 'calculadora'> = {
    seccion: 'simulador',
    instrumento: 'instrumentos',
    consola: 'consolas',
    proyecto: 'placa',
    calculadora: 'calculadora',
  };

  function teclas(ev: KeyboardEvent) {
    if (ev.key === 'ArrowDown') {
      ev.preventDefault();
      sel = Math.min(total - 1, sel + 1);
      visible();
    } else if (ev.key === 'ArrowUp') {
      ev.preventDefault();
      sel = Math.max(0, sel - 1);
      visible();
    } else if (ev.key === 'Enter') {
      ev.preventDefault();
      abrir(sel);
    } else if (ev.key === 'Escape') {
      ev.preventDefault();
      cerrarBuscador();
    }
  }

  function visible() {
    tick().then(() => lista?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' }));
  }

  function clic(ev: MouseEvent, r: Resultado) {
    if (ev.ctrlKey || ev.metaKey || ev.shiftKey) return;
    ev.preventDefault();
    ir(r);
  }

  function etiqueta(r: Resultado): string {
    const p = infoParte(r.doc.parte);
    if (r.doc.parte === 'glosario') return 'Glosario';
    if (!p) return r.doc.parte;
    const t = p.titulo.split(' — ')[0] ?? p.titulo;
    return p.num != null ? `${rotuloParte(r.doc.parte)} · ${t}` : t;
  }
</script>

{#if app.buscador}
  <div class="capa" role="presentation" onclick={(e) => e.target === e.currentTarget && cerrarBuscador()}>
    <div class="panel" role="dialog" aria-modal="true" aria-label="Buscar en el libro">
      <div class="campo">
        <Icono nombre="buscar" tam={20} />
        <input
          bind:this={campo}
          bind:value={consulta}
          type="search"
          enterkeyhint="search"
          placeholder="Buscar en el libro…"
          aria-label="Buscar en el libro"
          aria-controls="resultados"
          aria-activedescendant={total ? `res-${sel}` : undefined}
          autocomplete="off"
          spellcheck="false"
          onkeydown={teclas}
        />
        {#if consulta}
          <button class="limpiar" aria-label="Borrar la búsqueda" onclick={() => { consulta = ''; campo?.focus(); }}><Icono nombre="x" tam={16} /></button>
        {/if}
        <button class="cerrar" onclick={cerrarBuscador}>{app.movil ? 'Cerrar' : 'Esc'}</button>
      </div>

      <!-- the results scroll and their links stay out of the tab order (the field drives them): the box itself
           takes the focus while it overflows so the keyboard can scroll it (axe «scrollable-region-focusable», 0.11 QA) -->
      <div class="cuerpo" bind:this={lista} data-miniaturas-raiz use:desplazable={{ nombre: 'Resultados de la búsqueda', vertical: true }}>
        {#if !consulta.trim()}
          <div class="ayuda">
            <p><strong>Busque en todo el libro:</strong> secciones de todos los capítulos y términos del glosario.</p>
            <p><strong>Y en la aplicación:</strong> sus partes, los instrumentos, las consolas, las calculadoras y los proyectos (<em>osciloscopio</em>, <em>saturn</em>, <em>protoboard</em>).</p>
            <ul>
              <li>No importan las tildes ni las mayúsculas: <em>tension zener</em> encuentra «tensión Zener».</li>
              <li>Basta el comienzo de las palabras: <em>rectif</em> encuentra «rectificador».</li>
              <li>Tolera pequeñas erratas en palabras largas.</li>
            </ul>
            {#if preparando}<p class="estado">Preparando el índice de búsqueda…</p>{/if}
          </div>
        {:else if !total && buscado === consulta.trim()}
          <p class="nada">Sin resultados para «{consulta.trim()}».</p>
        {:else}
          <div id="resultados" role="listbox" aria-label="Resultados">
          {#if lugares.length}
            <ul role="group" aria-label="En la aplicación" class="lugares">
              {#each lugares as l, k (l.id)}
                <li role="none">
                  <a
                    id={`res-${k}`}
                    role="option"
                    aria-selected={k === sel}
                    tabindex="-1"
                    href={l.href}
                    data-lugar={l.id}
                    onclick={(e) => clicLugar(e, l)}
                    onmousemove={() => (sel = k)}
                  >
                    <span class="ins icono-lugar" aria-hidden="true"><Icono nombre={l.tipo === 'seccion' ? 'chevron' : ICONO_LUGAR[l.tipo]} tam={18} /></span>
                    <span class="txt">
                      <span class="tit">{l.titulo}</span>
                      <span class="donde">{l.donde}</span>
                    </span>
                  </a>
                </li>
              {/each}
            </ul>
          {/if}
          {#if resultados.length}
          <ul role="group" aria-label="En el libro">
            {#each resultados as r, j (r.doc.id)}
              {@const k = j + lugares.length}
              {@const p = infoParte(r.doc.parte)}
              <!-- the option is the link itself (an option holding a link nested two controls: axe, 0.11 QA); the
                   focus stays in the field, which points at it with aria-activedescendant -->
              <li role="none">
                <a
                  id={`res-${k}`}
                  role="option"
                  aria-selected={k === sel}
                  tabindex="-1"
                  href={href(r)}
                  onclick={(e) => clic(e, r)}
                  onmousemove={() => (sel = k)}
                  style:--c={colorBloque(p?.color)}
                >
                  <span class="ins"><Insignia parte={r.doc.parte} /></span>
                  <span class="txt">
                    <span class="tit">{@html fragmento(r.doc.titulo, r.terminos, 400)}</span>
                    <span class="donde">{etiqueta(r)}{#if r.doc.ampliacion} <InsigniaNuevo compacta titulo="Contenido nuevo de la aplicación: estará en la próxima edición del libro" />{/if}</span>
                    <span class="frag">{@html fragmento(r.doc.texto, r.terminos)}</span>
                  </span>
                  <MiniaturaLibro clave={r.doc.id} icono={r.doc.parte === 'glosario' ? 'termino' : 'seccion'} />
                </a>
              </li>
            {/each}
          </ul>
          {/if}
          </div>
        {/if}
      </div>
      {#if total && !app.movil}
        <div class="pie">
          <span><kbd>↑</kbd><kbd>↓</kbd> elegir</span>
          <span><kbd>↵</kbd> abrir</span>
          <span><kbd>Esc</kbd> cerrar</span>
          <span class="total">{total}{resultados.length === 60 ? '+' : ''} resultados</span>
        </div>
      {/if}
    </div>
  </div>
{/if}

<style>
  .capa {
    position: fixed;
    inset: 0;
    z-index: 50;
    display: flex;
    align-items: flex-start;
    justify-content: center;
    padding: 9vh 16px 16px;
    background: var(--scrim);
    animation: aparecer 0.15s ease-out;
    font-family: var(--sans);
  }
  @keyframes aparecer {
    from {
      opacity: 0;
    }
  }
  .panel {
    display: flex;
    flex-direction: column;
    width: min(700px, 100%);
    max-height: 78vh;
    border: 1px solid var(--linea);
    border-radius: 16px;
    background: var(--superficie);
    box-shadow: var(--sombra-alta);
    overflow: hidden;
    animation: bajar 0.16s ease-out;
  }
  @keyframes bajar {
    from {
      transform: translateY(-8px);
    }
  }
  .campo {
    display: flex;
    flex: none;
    align-items: center;
    gap: 10px;
    height: 58px;
    padding: 0 12px 0 18px;
    border-bottom: 1px solid var(--linea);
    color: var(--tinta-tenue);
  }
  .campo:focus-within {
    /* the app's focus ring, inside (the field spans the dialog's top edge; QA 1.0, WCAG 2.4.7 / 2.4.11) */
    outline: 2px solid var(--v11-foco);
    outline-offset: -2px;
  }
  .campo input {
    flex: 1;
    min-width: 0;
    height: 100%;
    border: 0;
    outline: 0;
    background: none;
    color: var(--tinta);
    font-size: 18px;
  }
  .campo input::-webkit-search-cancel-button {
    display: none;
  }
  .limpiar {
    display: grid;
    place-items: center;
    width: 28px;
    height: 28px;
    border: 0;
    border-radius: 50%;
    background: var(--superficie-2);
    color: var(--tinta-suave);
  }
  .cerrar {
    min-height: 30px;
    padding: 0 10px;
    border: 1px solid var(--linea);
    border-radius: 7px;
    background: none;
    color: var(--tinta-suave);
    font-size: 13px;
    font-weight: 600;
  }
  .cuerpo {
    flex: 1;
    overflow-y: auto;
    overscroll-behavior: contain;
  }
  .ayuda {
    padding: 18px 22px 22px;
    color: var(--tinta-suave);
    font-size: 15px;
    line-height: 1.5;
  }
  .ayuda p {
    margin: 0 0 8px;
  }
  .ayuda ul {
    margin: 0;
    padding-left: 1.2em;
  }
  .ayuda li {
    margin: 4px 0;
  }
  .ayuda em {
    color: var(--tinta);
    font-style: normal;
    font-weight: 600;
  }
  .estado {
    margin-top: 12px !important;
    color: var(--tinta-tenue);
    font-size: 13.5px;
  }
  .nada {
    margin: 0;
    padding: 34px 20px;
    color: var(--tinta-suave);
    text-align: center;
  }
  [role='listbox'] {
    padding: 6px;
  }
  ul[role='group'] {
    margin: 0;
    padding: 0;
    list-style: none;
  }
  /* 2.1: the app's places, compact rows above the book's results, a hairline under them */
  ul.lugares {
    margin-bottom: 6px;
    padding-bottom: 6px;
    border-bottom: 1px solid var(--v11-linea);
  }
  ul.lugares a {
    align-items: center;
    padding-top: 8px;
    padding-bottom: 8px;
  }
  .icono-lugar {
    display: grid;
    place-items: center;
    height: 34px;
    border-radius: 10px;
    background: var(--v11-azul-tinte);
    color: var(--v11-azul);
  }
  li a {
    /* The figure of the section (or its circuit, or the term's symbol) on the right, at a fixed size. */
    --mini-w: 88px;
    --mini-h: 66px;
    --mini-fondo: var(--superficie-2);
    display: flex;
    gap: 12px;
    padding: 11px 12px;
    border-radius: 10px;
    color: var(--tinta);
    text-decoration: none;
  }
  a[aria-selected='true'] {
    background: var(--v11-azul-tinte);
    box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--v11-azul) 45%, transparent);
  }
  .ins {
    flex: none;
    width: 34px;
    padding-top: 1px;
  }
  .txt {
    display: flex;
    flex: 1;
    flex-direction: column;
    min-width: 0;
  }
  .tit {
    font-size: 16px;
    font-weight: 700;
    line-height: 1.3;
  }
  .donde {
    margin-top: 1px;
    color: var(--tinta-tenue);
    font-size: 13px;
  }
  .frag {
    display: -webkit-box;
    margin-top: 5px;
    overflow: hidden;
    color: var(--tinta-suave);
    font-family: var(--serif);
    font-size: 14.5px;
    line-height: 1.45;
    -webkit-line-clamp: 3;
    line-clamp: 3;
    -webkit-box-orient: vertical;
  }
  .pie {
    display: flex;
    flex: none;
    gap: 16px;
    padding: 9px 16px;
    border-top: 1px solid var(--linea);
    color: var(--tinta-tenue);
    font-size: 12.5px;
  }
  .pie .total {
    margin-left: auto;
  }
  kbd {
    display: inline-block;
    min-width: 20px;
    margin-right: 3px;
    padding: 0 4px;
    border: 1px solid var(--linea);
    border-radius: 4px;
    font-family: var(--sans);
    font-size: 11.5px;
    text-align: center;
  }
  @media (max-width: 640px) {
    li a {
      --mini-w: 72px;
      --mini-h: 54px;
      gap: 10px;
      padding: 10px 8px;
    }
    .capa {
      padding: 0;
      background: var(--superficie);
    }
    .panel {
      width: 100%;
      max-height: none;
      height: 100%;
      border: 0;
      border-radius: 0;
      box-shadow: none;
      padding-top: env(safe-area-inset-top);
    }
  }
</style>
