<script lang="ts">
  // Flashcard session of the chosen deck: term → definition (or the reverse), four answers.
  // Keys: space/Intro shows the answer; then 1–4 (space = Bien); Ctrl/⌘ Z undoes the last answer.
  // Touch: tap the card to turn it; swipe right = Bien, left = Otra vez.
  import { onMount, tick } from 'svelte';
  import Undo2 from '@lucide/svelte/icons/undo-2';
  import { infoParte, prepararHtml, rutaDeRef, textoPlano, obtenerRefs, rotuloParte } from '../../lib/datos';
  import Icono from '../Icono.svelte';
  import { cargarBaraja, tarjetasDe, type Baraja, type Tarjeta } from './datos';
  import { recuento, siguiente } from './cola';
  import { previsiones, textoEspera, type Calificacion } from './srs';
  import { calificar, deshacer, nuevasHoy, repaso, type Deshacer } from './estado.svelte';

  let baraja = $state<Baraja | null>(null);
  let error = $state('');
  let actual = $state<Tarjeta | null>(null);
  let volteada = $state(false);
  let respondidas = $state(0);
  let ultimo = $state<(Deshacer & { tarjeta: Tarjeta; respondidasAntes: number; c: Calificacion }) | null>(null);
  let ahora = $state(Date.now());
  const resumen = $state({ 1: 0, 2: 0, 3: 0, 4: 0 } as Record<Calificacion, number>);
  let carta: HTMLElement | undefined = $state();

  const mazo = $derived(baraja?.mazos.find((m) => m.id === repaso.ajustes.mazo) ?? baraja?.mazos[0] ?? null);
  const tarjetas = $derived(baraja && mazo ? tarjetasDe(baraja, mazo.id, repaso.ajustes.inversas) : []);
  const cuota = $derived(Math.max(0, repaso.ajustes.nuevasDia - nuevasHoy(ahora)));
  const cuenta = $derived(recuento(tarjetas, repaso.tarjetas, ahora, cuota));
  const estado = $derived(actual ? repaso.tarjetas[actual.id] : undefined);
  const esperas = $derived(actual ? previsiones(estado, ahora, actual.id) : null);
  const tipo = $derived(!estado ? 'nueva' : estado.e === 'r' ? 'repaso' : 'aprendiendo');

  function elegir(evitar: string | null = null) {
    ahora = Date.now();
    actual = siguiente(tarjetas, repaso.tarjetas, ahora, cuota, respondidas, evitar);
    volteada = false;
  }

  onMount(() => {
    cargarBaraja()
      .then((b) => {
        baraja = b;
        elegir();
      })
      .catch((e: unknown) => (error = e instanceof Error ? e.message : String(e)));
    // Learning cards come back after their step: look again every 15 s when the queue is empty.
    const t = setInterval(() => {
      if (!actual && baraja) elegir();
      else ahora = Date.now();
    }, 15_000);
    return () => clearInterval(t);
  });

  async function voltear() {
    if (!actual || volteada) return;
    volteada = true;
    await tick();
    carta?.querySelector<HTMLElement>('.reverso')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  function responder(c: Calificacion) {
    if (!actual || !volteada) return;
    const d = calificar(actual.id, c);
    ultimo = { ...d, tarjeta: actual, respondidasAntes: respondidas, c };
    resumen[c]++;
    respondidas++;
    const id = actual.id;
    elegir(id);
  }

  function anular() {
    if (!ultimo) return;
    deshacer(ultimo);
    resumen[ultimo.c]--;
    respondidas = ultimo.respondidasAntes;
    actual = ultimo.tarjeta;
    volteada = true;
    ultimo = null;
    ahora = Date.now();
  }

  function teclas(ev: KeyboardEvent) {
    if (ev.altKey) return;
    const campo = (ev.target as HTMLElement | null)?.closest?.('input, textarea, select, [contenteditable="true"]');
    if (campo) return;
    if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'z') {
      if (ultimo) {
        ev.preventDefault();
        anular();
      }
      return;
    }
    if (ev.ctrlKey || ev.metaKey) return;
    if (!actual) return;
    if (!volteada && (ev.key === ' ' || ev.key === 'Enter')) {
      ev.preventDefault();
      void voltear();
    } else if (volteada && /^[1-4]$/.test(ev.key)) {
      ev.preventDefault();
      responder(Number(ev.key) as Calificacion);
    } else if (volteada && ev.key === ' ') {
      ev.preventDefault();
      responder(3);
    }
  }

  // ------------------------------------------------------------------ swipe
  let inicio: { x: number; y: number; id: number } | null = null;
  let dx = $state(0);
  let arrastrando = $state(false);
  const UMBRAL = 90;

  function abajo(ev: PointerEvent) {
    if (ev.pointerType === 'mouse' || !volteada) return;
    if ((ev.target as Element).closest('a, button')) return;
    inicio = { x: ev.clientX, y: ev.clientY, id: ev.pointerId };
  }
  function mover(ev: PointerEvent) {
    if (!inicio || ev.pointerId !== inicio.id) return;
    const x = ev.clientX - inicio.x;
    const y = ev.clientY - inicio.y;
    if (!arrastrando) {
      if (Math.abs(x) < 12 || Math.abs(x) < Math.abs(y) * 1.4) {
        if (Math.abs(y) > 16) inicio = null; // vertical: let the page scroll
        return;
      }
      arrastrando = true;
      carta?.setPointerCapture(ev.pointerId);
    }
    dx = x;
  }
  function arriba(ev: PointerEvent) {
    if (!inicio || ev.pointerId !== inicio.id) return;
    const x = dx;
    inicio = null;
    arrastrando = false;
    dx = 0;
    if (x > UMBRAL) responder(3);
    else if (x < -UMBRAL) responder(1);
  }
  function cancelar() {
    inicio = null;
    arrastrando = false;
    dx = 0;
  }

  function clicCarta(ev: MouseEvent) {
    if ((ev.target as Element).closest('a, button')) return;
    void voltear();
  }

  function enlaceVer(label: string): { href: string; texto: string } | null {
    const href = rutaDeRef(label);
    const r = obtenerRefs()[label];
    if (!href || !r) return null;
    const sec = r.tipo === 'sec' ? infoParte(r.parte)?.secciones?.find((x) => x.label === label) : undefined;
    return { href, texto: `${r.tipo === 'fig' ? 'Figura ' : r.tipo === 'tab' ? 'Tabla ' : ''}${r.num}${sec ? ` ${sec.titulo}` : ''}` };
  }

  const BOTONES: { c: Calificacion; nombre: string; clase: string }[] = [
    { c: 1, nombre: 'Otra vez', clase: 'otra' },
    { c: 2, nombre: 'Difícil', clase: 'dificil' },
    { c: 3, nombre: 'Bien', clase: 'bien' },
    { c: 4, nombre: 'Fácil', clase: 'facil' },
  ];
  const totalHoy = $derived(resumen[1] + resumen[2] + resumen[3] + resumen[4]);
</script>

<svelte:window onkeydown={teclas} />

<header class="rp-cab cab">
  <a class="rp-volver" href="#/repaso"><Icono nombre="chevron-izq" tam={18} /> Repaso</a>
  <div class="titulo">
    <h1 class="rp-titulo">Tarjetas</h1>
    {#if mazo}<p class="rp-sub">{mazo.nombre}</p>{/if}
  </div>
  {#if baraja}
    <p class="cuenta" aria-label="Pendientes hoy" data-cuenta>
      <span class="c-nueva" class:actual={tipo === 'nueva'} title="Nuevas">{cuenta.nuevas}</span>
      <span class="c-aprende" class:actual={tipo === 'aprendiendo'} title="Aprendiendo">{cuenta.aprendiendo}</span>
      <span class="c-repaso" class:actual={tipo === 'repaso'} title="Repaso">{cuenta.repaso}</span>
    </p>
  {/if}
</header>

{#if error}
  <p>No se pudo cargar el glosario: {error}</p>
{:else if !baraja}
  <p class="rp-sub">Preparando las tarjetas…</p>
{:else if !actual}
  <div class="fin rp-caja" data-fin>
    <h2>Hecho por hoy</h2>
    {#if totalHoy}
      <p>
        {totalHoy} respuestas en esta sesión: {resumen[1]} «Otra vez», {resumen[2]} «Difícil», {resumen[3]} «Bien» y {resumen[4]} «Fácil».
      </p>
    {:else}
      <p>No queda nada pendiente en este mazo.</p>
    {/if}
    {#if cuenta.proxima}
      <p>Hay tarjetas en aprendizaje que vuelven dentro de {textoEspera(cuenta.proxima - ahora)}; esta página las mostrará entonces.</p>
    {/if}
    <div class="acc">
      <a class="boton primario" href="#/repaso">Volver al repaso</a>
      {#if ultimo}<button class="boton" onclick={anular}><Undo2 size={18} aria-hidden="true" /> Deshacer</button>{/if}
    </div>
  </div>
{:else}
  {@const e = actual.entrada}
  {@const termino = e.termino_html ? prepararHtml(e.termino_html) : prepararHtml(e.termino)}
  <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
  <div
    class="carta rp-caja"
    class:volteada
    class:arrastrando
    bind:this={carta}
    style:--dx={`${dx}px`}
    onclick={clicCarta}
    onpointerdown={abajo}
    onpointermove={mover}
    onpointerup={arriba}
    onpointercancel={cancelar}
    data-tarjeta={actual.id}
    aria-live="polite"
  >
    {#if arrastrando}
      <span class="sello" class:otra={dx < 0} class:bien={dx > 0} style:opacity={Math.min(1, Math.abs(dx) / UMBRAL)}>
        {dx < 0 ? 'Otra vez' : 'Bien'}
      </span>
    {/if}
    <div class="chips">
      <span class="chip {tipo}">{tipo === 'nueva' ? 'Nueva' : tipo === 'repaso' ? 'Repaso' : 'Aprendiendo'}</span>
      {#if actual.inversa}<span class="chip">Inversa</span>{/if}
      {#each actual.partes.slice(0, 2) as p (p)}<span class="chip suave">{rotuloParte(p)}</span>{/each}
    </div>

    <div class="anverso">
      {#if actual.inversa}
        <p class="pista">¿Qué término es?</p>
        <div class="definicion">{@html prepararHtml(e.html)}</div>
      {:else}
        <p class="termino">{@html termino}</p>
      {/if}
    </div>

    {#if volteada}
      <div class="reverso" data-reverso>
        {#if actual.inversa}
          <p class="termino">{@html termino}</p>
        {:else}
          <div class="definicion">{@html prepararHtml(e.html)}</div>
        {/if}
        {#if e.ver?.length}
          <p class="ver">
            En el libro:
            {#each e.ver as v (v)}
              {@const l = enlaceVer(v)}
              {#if l}<a href={l.href} title={textoPlano(e.termino)}>→ {l.texto}</a>{/if}
            {/each}
          </p>
        {/if}
      </div>
    {:else}
      <p class="toca">Toque la tarjeta<span class="o-tecla"> o pulse <kbd>espacio</kbd></span> para ver la respuesta</p>
    {/if}
  </div>

  <div class="mandos">
    {#if !volteada}
      <button class="boton primario mostrar" onclick={voltear} data-mostrar>Mostrar la respuesta</button>
    {:else if esperas}
      <div class="notas" role="group" aria-label="¿Cómo la recordaba?">
        {#each BOTONES as b (b.c)}
          <button class="nota {b.clase}" onclick={() => responder(b.c)} data-calificar={b.c}>
            <span class="nom">{b.nombre}</span>
            <span class="esp">{esperas[b.c]}</span>
            <kbd>{b.c}</kbd>
          </button>
        {/each}
      </div>
    {/if}
    <div class="ayuda">
      {#if ultimo}<button class="boton deshacer" onclick={anular} data-deshacer><Undo2 size={17} aria-hidden="true" /> Deshacer</button>{/if}
      <span>En pantalla táctil: deslice a la derecha para «Bien» y a la izquierda para «Otra vez».</span>
    </div>
  </div>
{/if}

<style>
  .cab {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-end;
    gap: 6px 16px;
  }
  .cab .rp-volver {
    flex-basis: 100%;
  }
  .titulo {
    flex: 1;
    min-width: 0;
  }
  .cuenta {
    display: flex;
    gap: 12px;
    margin: 0;
    font-size: 18px;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }
  .cuenta span.actual {
    text-decoration: underline;
    text-underline-offset: 4px;
    text-decoration-thickness: 2px;
  }
  .c-nueva {
    color: var(--c-nota);
  }
  .c-aprende {
    color: var(--c-precaucion);
  }
  .c-repaso {
    color: var(--c-ejemplo);
  }
  .carta {
    position: relative;
    min-height: 300px;
    padding: 18px clamp(18px, 4vw, 36px) 26px;
    touch-action: pan-y;
    transform: translateX(var(--dx)) rotate(calc(var(--dx) / 40));
    transition: transform 0.25s ease;
    user-select: none;
    -webkit-user-select: none;
    cursor: pointer;
  }
  .carta.volteada {
    cursor: default;
    user-select: text;
    -webkit-user-select: text;
  }
  .carta.arrastrando {
    transition: none;
  }
  .sello {
    position: absolute;
    top: 18px;
    right: 18px;
    padding: 4px 12px;
    border: 2px solid currentColor;
    border-radius: 8px;
    font-size: 18px;
    font-weight: 800;
    text-transform: uppercase;
  }
  .sello.otra {
    right: auto;
    left: 18px;
    color: var(--c-precaucion);
  }
  .sello.bien {
    color: var(--c-ejemplo);
  }
  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .chip {
    padding: 2px 9px;
    border-radius: 999px;
    background: var(--superficie-2);
    color: var(--tinta-suave);
    font-size: 12.5px;
    font-weight: 700;
  }
  .chip.nueva {
    background: color-mix(in srgb, var(--c-nota) 16%, transparent);
    color: var(--c-nota);
  }
  .chip.aprendiendo {
    background: color-mix(in srgb, var(--c-precaucion) 14%, transparent);
    color: var(--c-precaucion);
  }
  .chip.repaso {
    background: color-mix(in srgb, var(--c-ejemplo) 15%, transparent);
    color: var(--c-ejemplo);
  }
  .chip.suave {
    font-weight: 600;
  }
  .anverso {
    display: grid;
    place-items: center;
    min-height: 150px;
    padding: 18px 0;
    text-align: center;
  }
  .termino {
    margin: 0;
    color: var(--titulos);
    font-family: var(--serif);
    font-size: clamp(26px, 4.4vw, 36px);
    font-weight: 700;
    line-height: 1.2;
  }
  .pista {
    margin: 0 0 10px;
    color: var(--tinta-suave);
    font-size: 14px;
    font-weight: 600;
  }
  .definicion {
    color: var(--tinta);
    font-family: var(--serif);
    font-size: clamp(18px, 2.4vw, 21px);
    line-height: 1.5;
  }
  .reverso {
    padding-top: 18px;
    border-top: 1px dashed var(--linea);
    text-align: center;
    animation: entrar 0.2s ease;
  }
  .reverso .termino {
    font-size: clamp(24px, 4vw, 32px);
  }
  @keyframes entrar {
    from {
      opacity: 0;
      transform: translateY(6px);
    }
  }
  .ver {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    align-items: center;
    gap: 4px 6px;
    margin: 16px 0 0;
    color: var(--tinta-suave);
    font-size: 14.5px;
  }
  .ver a {
    display: inline-flex;
    align-items: center;
    min-height: 44px;
    padding: 0 10px;
    border-radius: 8px;
    font-weight: 600;
    text-decoration: none;
  }
  .ver a:hover {
    background: var(--hover);
  }
  .toca {
    margin: 0;
    color: var(--tinta-tenue);
    font-size: 14px;
    text-align: center;
  }
  .mandos {
    margin-top: 14px;
  }
  .mostrar {
    width: 100%;
    justify-content: center;
    min-height: 52px;
    font-size: 17px;
  }
  .notas {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 8px;
  }
  .nota {
    display: grid;
    grid-template-areas: 'nom tecla' 'esp tecla';
    grid-template-columns: 1fr auto;
    align-items: center;
    gap: 0 6px;
    min-height: 60px;
    padding: 6px 12px;
    border: 1px solid var(--linea);
    border-top: 4px solid var(--c);
    border-radius: 12px;
    background: var(--superficie);
    color: var(--tinta);
    text-align: left;
  }
  .nota:hover {
    background: var(--superficie-2);
  }
  .nota .nom {
    grid-area: nom;
    font-size: 16px;
    font-weight: 700;
  }
  .nota .esp {
    grid-area: esp;
    color: var(--tinta-suave);
    font-size: 13.5px;
    font-variant-numeric: tabular-nums;
  }
  .nota kbd {
    grid-area: tecla;
  }
  .otra {
    --c: var(--c-precaucion);
  }
  .dificil {
    --c: var(--c-importante);
  }
  .bien {
    --c: var(--c-ejemplo);
  }
  .facil {
    --c: var(--c-nota);
  }
  .ayuda {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px 14px;
    margin-top: 12px;
    color: var(--tinta-tenue);
    font-size: 13.5px;
  }
  .fin {
    padding: 24px;
  }
  .fin h2 {
    margin: 0 0 8px;
    color: var(--titulos);
  }
  .fin .acc {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 16px;
  }
  @media (max-width: 560px) {
    .notas {
      grid-template-columns: 1fr 1fr;
    }
    .nota kbd {
      display: none;
    }
  }
  @media (hover: none) {
    .nota kbd,
    .o-tecla {
      display: none;
    }
  }
</style>
