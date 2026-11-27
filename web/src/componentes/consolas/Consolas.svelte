<script lang="ts">
  // «Consolas» view: eleven mainboards in three linked views (photo, architecture, schematic) plus sources, the boards,
  // «Un fotograma» and «Busque la avería». Route: #/consolas/<maquina>/<pestana>[/<seleccion>] (see estado.svelte.ts).
  // 2.1 (mock-up Consola.png): the machine's name and board as the page title, with a button that opens the eleven
  // machines in a menu (instead of 2.0's two-row box); no paragraph under the title (it moved to «Fuentes»); the
  // views as the system's underline tabs. What each view shows is unchanged.
  import { abrirEncima } from '../../lib/encima';
  import { untrack } from 'svelte';
  import { numeroImpreso } from '../../lib/datos';
  import { ruta } from '../../lib/ruta.svelte';
  import { cargarMaquina, tieneEsquema, type DatosMaquina, type IdMaquina } from './datos';
  import { enlace, leerAncla, PESTANAS, type Pestana, type Seleccion } from './estado.svelte';
  import { cargarArquitectura, tieneArquitectura } from './arquitectura/maquinas';
  import { tieneFotograma } from './fotograma/maquinas';
  import ErrorCarga from '../ErrorCarga.svelte';
  import Foto from './Foto.svelte';
  import Fuentes from './Fuentes.svelte';
  import { tienePlaca } from './placa/datos';
  import { averiasDe } from '../../lib/averias-placa/definiciones';
  import Pestanas21 from '../sistema21/Pestanas21.svelte';

  const actual = $derived(leerAncla(ruta.ancla));
  let sel: Seleccion | null = $state(null);
  let datos: DatosMaquina | null = $state(null);
  let error = $state('');

  // The route sets the selection; later changes inside a tab only replace the URL.
  $effect(() => {
    void ruta.n;
    const s = actual.sel;
    untrack(() => (sel = s));
  });

  /** «Reintentar» after a failed load: the data again, and the tab's parts that come on demand. */
  let intento = $state(0);

  $effect(() => {
    const id = actual.maquina;
    void intento;
    let vivo = true;
    error = '';
    cargarMaquina(id)
      .then((d) => {
        if (vivo) datos = d;
      })
      .catch((e: unknown) => {
        if (vivo) error = e instanceof Error ? e.message : String(e);
      });
    return () => {
      vivo = false;
    };
  });

  function seleccionar(s: Seleccion | null): void {
    sel = s;
    history.replaceState(history.state, '', enlace(actual.maquina, actual.pestana, s));
  }

  function irA(pestana: Pestana, s: Seleccion): void {
    location.hash = enlace(actual.maquina, pestana, s);
  }

  function href(maquina: IdMaquina, pestana: Pestana): string {
    return enlace(maquina, pestana, null);
  }

  // «Placa en 3D / 2D» only for the machines with a board
  // «Busque la avería» (1.3) only for the machines with a fault of their lesson placed on their board
  // (2.0) «Arquitectura» and «Un fotograma» only for the machines with a model (the frame's steps need both)
  const disponible = (m: IdMaquina, p: Pestana) =>
    p === 'placa3d' || p === 'placa2d'
      ? tienePlaca(m)
      : p === 'averia'
        ? averiasDe(m).length > 0
        : p === 'arquitectura'
          ? tieneArquitectura(m)
          : p === 'fotograma'
            ? tieneFotograma(m) && tieneArquitectura(m)
            : p === 'esquema'
              ? tieneEsquema(m) // (2.0) the GameCube has none
              : true;
  const pestanas = $derived(PESTANAS.filter((p) => disponible(actual.maquina, p.id)));
  const pestana = $derived(pestanas.some((p) => p.id === actual.pestana) ? actual.pestana : 'foto');

  const MAQUINAS: { id: IdMaquina; titulo: string; placa: string }[] = [
    { id: 'nes', titulo: 'NES', placa: 'NES-CPU-07 · 1987' },
    { id: 'neogeo', titulo: 'Neo Geo AES', placa: 'NEO-AES · 1990' },
    { id: 'sms', titulo: 'Master System II', placa: '171-5922A · 1990' },
    { id: 'megadrive', titulo: 'Mega Drive', placa: 'Modelo 1 VA6.8 PAL · 1993' },
    { id: 'gb', titulo: 'Game Boy', placa: 'DMG-CPU-05/06 · 1989' },
    { id: 'gbc', titulo: 'Game Boy Color', placa: 'CGB-CPU-04 · 1999' },
    { id: 'snes', titulo: 'Super Nintendo', placa: 'SNSP-CPU-01 PAL · 1992' },
    { id: 'n64', titulo: 'Nintendo 64', placa: 'NUS-CPU-03 NTSC · 1996-97' }, // (2.1) ConsoleArtisan's N64 Repair Reference: «NUS-CPU-01 to -04 (1996 to 1997)»,
    { id: 'ps1', titulo: 'PlayStation', placa: 'PU-18 · 1997' }, // (2.1) psdevwiki «Motherboards»: PU-18 «May 1997 - April 1998»,
    { id: 'gamecube', titulo: 'GameCube', placa: 'DOL-CPU(P)-01 PAL · 2002' },
    { id: 'saturn', titulo: 'Sega Saturn', placa: 'VA0.5 NTSC-J · 1994' }, // (cierre20) the Japanese HST-3200 board of Sega's schematic, dated 1994
  ];
  const maquina = $derived(MAQUINAS.find((m) => m.id === actual.maquina) ?? MAQUINAS[0]!);

  // ------------------------------------------------------------------ 2.1: the machine menu
  let menu = $state(false);
  let raizMenu: HTMLElement | undefined = $state();
  let botonMenu: HTMLButtonElement | undefined = $state();
  // closed by a route change, a tap outside it and Escape (focus back on its button)
  $effect(() => {
    void ruta.n;
    untrack(() => (menu = false));
  });
  $effect(() => {
    if (!menu) return;
    // 2.2: on top of the page, the system's back closes it first (lib/encima.ts)
    const quitar = abrirEncima('menu-consolas', () => (menu = false));
    const fuera = (ev: PointerEvent) => {
      if (raizMenu && !raizMenu.contains(ev.target as Node)) menu = false;
    };
    const tecla = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') {
        menu = false;
        botonMenu?.focus();
      }
    };
    document.addEventListener('pointerdown', fuera, true);
    document.addEventListener('keydown', tecla);
    return () => {
      untrack(quitar);
      document.removeEventListener('pointerdown', fuera, true);
      document.removeEventListener('keydown', tecla);
    };
  });
  const vistas = $derived(pestanas.map((p) => ({ id: p.id, texto: p.titulo, href: enlace(actual.maquina, p.id, sel) })));
</script>

<svelte:head><title>Consolas · Electrónica Práctica Avanzada</title></svelte:head>

<div class="consolas">
  <header class="cabeza" bind:this={raizMenu}>
    <h1 class="titulo">
      <button type="button" class="elegir" bind:this={botonMenu} aria-expanded={menu} aria-controls="menu-consolas" onclick={() => (menu = !menu)} data-elegir-consola>
        <span class="nombre">{maquina.titulo}</span>
        <span class="placa">{maquina.placa}</span>
        <span class="flecha" aria-hidden="true"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 9l6 6 6-6" /></svg></span>
        <span class="solo-lector">: elegir otra consola</span>
      </button>
    </h1>
    {#if menu}
      <nav class="menu" id="menu-consolas" aria-label="Consola">
        <ul>
          {#each MAQUINAS as m (m.id)}
            <li>
              <a href={href(m.id, disponible(m.id, actual.pestana) ? actual.pestana : 'foto')} aria-current={actual.maquina === m.id ? 'page' : undefined}>
                <strong>{m.titulo}</strong><small>{m.placa}</small>
              </a>
            </li>
          {/each}
        </ul>
      </nav>
    {/if}
  </header>

  <!-- (2.2: the views' row, lit by the «Consolas» tutorial, lib/recorridos-pasos.ts) -->
  <div class="vistas" data-recorrido="consola-vistas"><Pestanas21 etiqueta="Vista" items={vistas} actual={pestana} /></div>
  {#if !tieneEsquema(actual.maquina)}
    <!-- (2.0) a machine with no schematic says so where the others show «Esquema» and «Busque la avería» -->
    <p class="sin-esquema" data-testid="sin-esquema">
      Esta consola no tiene «Esquema» ni «Busque la avería»: no existe ningún esquema de su placa. Lo que se sabe de ella sale de
      las fotos y de las fuentes: <a href={enlace(actual.maquina, 'fuentes', null)}>vea por qué y qué tensiones se pueden medir</a>.
    </p>
  {/if}

  {#if error}
    <ErrorCarga titulo="No se pudieron cargar los datos de la consola." {error} reintentar={() => intento++} />
  {:else if !datos || datos.id !== actual.maquina}
    <div class="cargando">Cargando…</div>
  {:else if pestana === 'foto'}
    <Foto {datos} {sel} {seleccionar} {irA} />
  {:else if pestana === 'arquitectura'}
    {#key intento}
      {#await Promise.all([import('./arquitectura/Arquitectura.svelte'), cargarArquitectura(datos.id)])}
        <div class="cargando">Cargando…</div>
      {:then [m, maquina]}
        {#key datos.id}<m.default {datos} {maquina} {sel} {seleccionar} {irA} />{/key}
      {:catch e}
        <ErrorCarga titulo="No se pudo abrir la arquitectura." error={e} reintentar={() => intento++} />
      {/await}
    {/key}
  {:else if pestana === 'fotograma'}
    <!-- «Un fotograma»: how one pixel of a frame comes to exist, step by step, loaded only when the tab opens. -->
    {#await import('./fotograma/Fotograma.svelte')}
      <div class="cargando">Cargando…</div>
    {:then m}
      {#key datos.id}<m.default {datos} />{/key}
    {:catch e}
      <ErrorCarga titulo="No se pudo abrir «Un fotograma»." error={e} />
    {/await}
  {:else if pestana === 'esquema'}
    {#await import('./esquema/Esquema.svelte') then m}
      {#key datos.id}<m.default {datos} {sel} {seleccionar} {irA} />{/key}
    {:catch e}
      <ErrorCarga titulo="No se pudo abrir el esquema." error={e} />
    {/await}
  {:else if pestana === 'placa3d' || pestana === 'placa2d'}
    <!-- The mainboard in the «Proyectos KiCad» viewer (contenido/consolas_pcb.py), loaded on demand. -->
    {#await import('./placa/PlacaConsola.svelte')}
      <div class="cargando">Cargando…</div>
    {:then m}
      {#key datos.id}<m.default {datos} vista={pestana === 'placa3d' ? '3d' : '2d'} {sel} {seleccionar} {irA} />{/key}
    {:catch e}
      <ErrorCarga titulo="No se pudo abrir la placa." error={e} />
    {/await}
  {:else if pestana === 'averia'}
    <!-- 1.3: the meter on the board with a hidden fault of the console's lesson (loaded on demand) -->
    {#await import('./averia/BusqueAveria.svelte')}
      <div class="cargando">Cargando…</div>
    {:then m}
      {#key `${datos.id}:${actual.averia ?? ''}`}<m.default maquina={datos.id} averia={actual.averia ?? undefined} />{/key}
    {:catch e}
      <ErrorCarga titulo="No se pudo abrir «Busque la avería»." error={e} />
    {/await}
  {:else}
    <!-- 2.1: the page's introduction, which sat under the title in 2.0 -->
    <p class="presentacion">Las placas base de las figuras {numeroImpreso('fig-37.16', '37.16')} y {numeroImpreso('fig-37.22', '37.22')} y las de las demás consolas: foto interactiva, arquitectura animada, esquema real y la placa en 3D (la del Master System II, reconstruida a partir de sus fotos).</p>
    <Fuentes {datos} />
  {/if}
</div>

<style>
  .consolas {
    max-width: 1500px;
    margin: 0 auto;
    padding: var(--e21-3) var(--e21-margen) var(--e21-6);
    display: grid;
    gap: var(--e21-3);
  }
  .cabeza {
    position: relative;
  }
  .vistas {
    min-width: 0;
  }
  .titulo {
    margin: 0;
    font: inherit;
  }
  /* the title is the machine menu's button: name (Space Grotesk), its board, a chevron */
  .elegir {
    display: inline-flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 4px 14px;
    max-width: 100%;
    padding: 0;
    border: 0;
    background: none;
    color: var(--v11-tinta);
    text-align: left;
    cursor: pointer;
  }
  .elegir .nombre {
    font-family: var(--v11-titular);
    font-size: var(--t21-pagina);
    font-weight: 600;
    letter-spacing: -0.01em;
    line-height: 1.15;
  }
  .elegir .placa {
    color: var(--v11-tinta-suave);
    font-family: var(--v11-texto);
    font-size: 15px;
    font-weight: 400;
  }
  .elegir .flecha {
    display: inline-grid;
    place-items: center;
    width: 48px;
    height: 48px;
    border-radius: 12px;
    background: var(--v11-panel);
    color: var(--v11-tinta-suave);
    transition: transform 0.15s;
  }
  .elegir[aria-expanded='true'] .flecha {
    transform: rotate(180deg);
  }
  .elegir:hover .flecha {
    color: var(--v11-azul);
  }
  @media (max-width: 599px) {
    /* the phone: name and chevron on one line, the board under them */
    .elegir .placa {
      order: 3;
      flex-basis: 100%;
    }
  }
  .elegir:focus-visible {
    outline: 2px solid var(--v11-foco);
    outline-offset: 4px;
    border-radius: 12px;
  }
  .solo-lector {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }
  .menu {
    position: absolute;
    z-index: 30;
    top: calc(100% + 8px);
    left: 0;
    width: min(360px, 100%);
    max-height: min(70vh, 640px);
    overflow-y: auto;
    padding: 8px;
    border: 1px solid var(--v11-linea);
    border-radius: 14px;
    background: var(--v11-fondo);
    box-shadow: var(--v11-sombra);
  }
  .menu ul {
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .menu a {
    display: grid;
    gap: 2px;
    min-height: 48px;
    padding: 8px 12px;
    border-radius: 10px;
    color: var(--v11-tinta);
    text-decoration: none;
    line-height: 1.25;
  }
  .menu a:hover {
    background: var(--v11-panel);
  }
  .menu a[aria-current='page'] {
    background: var(--v11-azul-tinte);
  }
  .menu a[aria-current='page'] strong {
    color: var(--v11-azul);
  }
  .menu strong {
    font-weight: 600;
    font-size: 16px;
  }
  .menu small {
    color: var(--v11-tinta-suave);
    font-size: 14px;
  }
  .sin-esquema,
  .presentacion {
    margin: 0;
    color: var(--v11-tinta-suave);
    font-size: 15px;
    line-height: 1.45;
  }
  .presentacion {
    max-width: 72ch;
  }
  .cargando {
    padding: 30px;
    color: var(--v11-tinta-suave);
  }
  /* «Cargando…» only when it takes a while: a quick load flashed it for a few frames (0.11 QA) */
  .cargando {
    animation: aparecer-tarde 0.2s ease 0.3s both;
  }
  @keyframes aparecer-tarde {
    from {
      opacity: 0;
    }
  }
</style>
