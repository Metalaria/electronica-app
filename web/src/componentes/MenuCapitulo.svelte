<script lang="ts">
  // The breadcrumb's menu: the chapter's sections (current one marked, read ones ticked) and the chapters
  // before and after. An overlay of the history, so «Atrás» closes it.
  import { onMount, tick } from 'svelte';
  import { app } from '../lib/estado.svelte';
  import { abrirCapa, cerrarCapa, navegarDesdeCapa } from '../lib/ruta.svelte';
  import { usuario } from '../lib/usuario.svelte';
  import { aprendizaje } from '../lib/aprendizaje.svelte';
  import { infoParte, rotuloParte, tomoDe } from '../lib/datos';
  import { colorBloque } from '../lib/color';
  import { corto, hrefParte, hrefSeccion, parteVecina } from '../lib/navegacion.svelte';
  import Icono from './Icono.svelte';
  import Insignia from './Insignia.svelte';

  let { parte, ancla, onCerrar }: { parte: string; ancla: HTMLElement; onCerrar: () => void } = $props();

  let panel: HTMLElement | undefined = $state();
  let cerrado = false;
  let izquierda = $state(8);

  const info = $derived(infoParte(parte));
  const secciones = $derived(info?.secciones ?? []);
  const actual = $derived(app.seccion?.parte === parte ? app.seccion.label : '');
  const anterior = $derived(parteVecina(parte, -1));
  const siguiente = $derived(parteVecina(parte, 1));
  const tomo = $derived.by(() => {
    const t = tomoDe(parte);
    return t ? app.indice?.tomos.find((x) => x.id === t) : undefined;
  });

  function cerrar() {
    if (!cerrado) cerrarCapa('menu-capitulo');
  }

  function ir(ev: MouseEvent) {
    const a = (ev.target as Element).closest('a');
    const href = a?.getAttribute('href');
    if (!href?.startsWith('#') || ev.ctrlKey || ev.metaKey || ev.shiftKey || ev.button !== 0) return;
    ev.preventDefault();
    navegarDesdeCapa(href);
  }

  function teclas(ev: KeyboardEvent) {
    if (ev.key === 'Escape') {
      ev.preventDefault();
      cerrar();
      ancla.focus();
      return;
    }
    if (ev.key !== 'ArrowDown' && ev.key !== 'ArrowUp') return;
    const lista = Array.from(panel?.querySelectorAll<HTMLElement>('a') ?? []);
    const k = lista.indexOf(document.activeElement as HTMLElement);
    ev.preventDefault();
    lista[Math.max(0, Math.min(lista.length - 1, k + (ev.key === 'ArrowDown' ? 1 : -1)))]?.focus();
  }

  onMount(() => {
    abrirCapa('menu-capitulo', () => {
      cerrado = true;
      onCerrar();
    });
    if (!app.movil) izquierda = Math.max(8, Math.min(ancla.getBoundingClientRect().left - 8, window.innerWidth - 448));
    const fuera = (ev: PointerEvent) => {
      const t = ev.target as Node;
      if (panel?.contains(t) || ancla.contains(t)) return;
      cerrar();
    };
    document.addEventListener('pointerdown', fuera, true);
    void tick().then(() => {
      const el = panel?.querySelector<HTMLElement>('a.activa') ?? panel?.querySelector<HTMLElement>('.secciones a');
      const caja = panel?.querySelector<HTMLElement>('.secciones');
      if (el && caja) caja.scrollTop = el.offsetTop - caja.clientHeight * 0.35;
      el?.focus({ preventScroll: true });
    });
    return () => {
      document.removeEventListener('pointerdown', fuera, true);
      if (!cerrado) {
        cerrado = true;
        cerrarCapa('menu-capitulo');
      }
    };
  });
</script>

{#if app.movil}
  <button class="velo" aria-label="Cerrar" tabindex="-1" onclick={cerrar}></button>
{/if}

<!-- svelte-ignore a11y_click_events_have_key_events -->
<div
  class="menu-cap"
  class:movil={app.movil}
  role="dialog"
  tabindex="-1"
  aria-label={`Secciones de ${rotuloParte(parte)}`}
  bind:this={panel}
  style:left={app.movil ? undefined : `${izquierda}px`}
  style:--c={colorBloque(info?.color)}
  onclick={ir}
  onkeydown={teclas}
>
  <div class="cab">
    <Insignia {parte} />
    <div class="cab-texto">
      <span class="rotulo">{rotuloParte(parte)}{#if tomo}{' · '}Tomo {tomo.id}{/if}</span>
      <strong>{corto(info?.titulo ?? '')}</strong>
    </div>
  </div>

  <ul class="secciones">
    <li>
      <a href={info?.label ? `${hrefParte(parte)}/${info.label}` : hrefParte(parte)} class="inicio-cap">
        <span class="sn"><Icono nombre="arriba" tam={14} /></span>
        <span class="st">Comienzo {info?.tipo === 'apendice' ? 'del apéndice' : info?.tipo === 'capitulo' ? 'del capítulo' : ''}</span>
      </a>
    </li>
    {#each secciones as s (s.label)}
      {@const activa = actual === s.label}
      <li>
        <a href={hrefSeccion(parte, s.label)} class:activa aria-current={activa ? 'location' : undefined}>
          <span class="sn">{s.num ?? ''}</span>
          <span class="st">{s.titulo}</span>
          {#if usuario.marcadores[s.label]}<span class="pin"><Icono nombre="marcador-lleno" tam={12} /></span>{/if}
          {#if aprendizaje.leidas[parte]?.[s.label]}<span class="pin hecha" title="Leída"><Icono nombre="hecho" tam={14} grosor={2.4} /></span>{/if}
        </a>
      </li>
    {/each}
  </ul>

  <div class="vecinos">
    {#if anterior}
      <a href={hrefParte(anterior)} class="vecino" title={infoParte(anterior)?.titulo}>
        <Icono nombre="chevron-izq" tam={16} />
        <span><small>Anterior</small>{rotuloParte(anterior)}</span>
      </a>
    {:else}<span></span>{/if}
    {#if siguiente}
      <a href={hrefParte(siguiente)} class="vecino sig" title={infoParte(siguiente)?.titulo}>
        <span><small>Siguiente</small>{rotuloParte(siguiente)}</span>
        <Icono nombre="chevron" tam={16} />
      </a>
    {/if}
  </div>
</div>

<style>
  .menu-cap {
    position: fixed;
    top: calc(var(--alto-barra) + env(safe-area-inset-top) + 4px);
    z-index: 41;
    display: flex;
    flex-direction: column;
    width: min(440px, calc(100vw - 16px));
    max-height: calc(100dvh - var(--alto-barra) - env(safe-area-inset-top) - 24px);
    border: 1px solid var(--linea);
    border-radius: 14px;
    background: var(--superficie);
    box-shadow: var(--sombra-alta);
    font-family: var(--sans);
    overflow: hidden;
    animation: entrar 0.14s ease-out;
  }
  .menu-cap:focus {
    outline: none;
  }
  .menu-cap.movil {
    right: 8px;
    left: 8px;
    width: auto;
    max-height: calc(100dvh - var(--alto-barra) - env(safe-area-inset-top) - var(--hueco-inferior) - 20px);
  }
  @keyframes entrar {
    from {
      opacity: 0;
      transform: translateY(-4px);
    }
  }
  .velo {
    position: fixed;
    inset: 0;
    z-index: 40;
    border: 0;
    background: var(--scrim);
    animation: aparecer 0.18s ease;
  }
  @keyframes aparecer {
    from {
      opacity: 0;
    }
  }
  .cab {
    display: flex;
    flex: none;
    align-items: center;
    gap: 12px;
    padding: 14px 16px 12px;
    border-bottom: 1px solid var(--linea-suave);
  }
  .cab-texto {
    display: flex;
    flex-direction: column;
    min-width: 0;
    line-height: 1.25;
  }
  .rotulo {
    color: var(--tinta-tenue);
    font-size: 12.5px;
    font-weight: 600;
  }
  .cab strong {
    color: var(--tinta);
    font-size: 16px;
  }
  ul {
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .secciones {
    position: relative;
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    overscroll-behavior: contain;
    padding: 6px;
    scrollbar-width: thin;
  }
  .secciones a {
    position: relative;
    display: flex;
    align-items: baseline;
    gap: 10px;
    min-height: 40px;
    padding: 9px 10px;
    border-radius: 8px;
    color: var(--tinta);
    font-size: 14.5px;
    line-height: 1.3;
    text-decoration: none;
  }
  .secciones a:hover,
  .secciones a:focus-visible {
    background: var(--hover);
  }
  .secciones a.activa {
    background: var(--acento-tinte);
    font-weight: 600;
  }
  .secciones a.activa::before {
    content: '';
    position: absolute;
    top: 8px;
    bottom: 8px;
    left: 0;
    width: 3.5px;
    border-radius: 2px;
    background: var(--acento);
  }
  .inicio-cap {
    color: var(--tinta-suave) !important;
  }
  .sn {
    flex: none;
    display: inline-flex;
    justify-content: flex-start;
    min-width: 2.6em;
    color: var(--acento);
    font-weight: 600;
    font-variant-numeric: tabular-nums;
  }
  .st {
    flex: 1;
  }
  .pin {
    flex: none;
    align-self: center;
    display: inline-grid;
    color: var(--acento);
  }
  .pin.hecha {
    color: var(--c-ejemplo);
  }
  .vecinos {
    display: grid;
    flex: none;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
    padding: 10px;
    border-top: 1px solid var(--linea-suave);
    background: var(--superficie-2);
  }
  .vecino {
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: 48px;
    padding: 6px 12px;
    border: 1px solid var(--linea);
    border-radius: 10px;
    background: var(--superficie);
    color: var(--tinta);
    font-size: 14.5px;
    font-weight: 600;
    text-decoration: none;
  }
  .vecino:hover {
    border-color: var(--acento-borde);
  }
  .vecino span {
    display: flex;
    flex-direction: column;
    line-height: 1.2;
  }
  .vecino small {
    color: var(--tinta-tenue);
    font-size: 11.5px;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }
  .vecino.sig {
    grid-column: 2;
    justify-content: flex-end;
    text-align: right;
  }
  .vecino :global(svg) {
    flex: none;
    color: var(--tinta-tenue);
  }
  @media (pointer: coarse) {
    .secciones a {
      min-height: 46px;
    }
  }
</style>
