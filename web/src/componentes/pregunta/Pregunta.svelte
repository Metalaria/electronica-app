<script lang="ts" module>
  import type { Pregunta } from '../repaso/datos';
  import { rutaDeRef } from '../../lib/datos';

  /** An answer: the option chosen (position in the order shown) or the number typed. */
  export interface Respuesta {
    elegida: number | null;
    texto: string;
    bien: boolean;
  }

  const ARTICULO: Record<string, string> = { Sección: 'la', Problema: 'el', Apartado: 'el', Ejercicio: 'el', Figura: 'la', Tabla: 'la' };

  /** Where the question comes from: «Sección 5.2», and the link «Ver la sección 5.2». */
  export function referenciaDe(p: Pregunta, parte: string): { href: string; nombre: string; ver: string } {
    const href = rutaDeRef(p.ref) ?? `#/${parte}/${encodeURIComponent(p.ref)}`;
    const nombre = p.ref_num ? `${p.ref_tipo} ${p.ref_num}` : p.ref_titulo ? `${p.ref_tipo} «${p.ref_titulo}»` : p.ref_tipo;
    const ver = p.ref_num ? `Ver ${ARTICULO[p.ref_tipo] ?? 'la'} ${p.ref_tipo.toLowerCase()} ${p.ref_num}` : 'Ver en el libro';
    return { href, nombre, ver };
  }
</script>

<script lang="ts">
  // One Repaso question as in the 0.9 mockup (Pregunta.dc.html): A–D options or a number with its unit,
  // immediate feedback with icons and words (never colour alone), the explanation, the book's figure next to
  // the quote when there is a reliable one, the quote «Del libro · Sección X» and «Probar otra vez».
  // Shared by the lessons (componentes/leccion) and Repaso's tests, exams and review of mistakes.
  //
  // The caller keeps the first answer (`respuesta`, what counts) and renders the footer («Ver la sección»,
  // «Continuar»); «Probar otra vez» only clears what is on show (`mostrada`), never the recorded answer.
  // Keys: 1–4 or A–D choose an option.
  import { tick, untrack } from 'svelte';
  import Check from '@lucide/svelte/icons/check';
  import X from '@lucide/svelte/icons/x';
  import ZoomIn from '@lucide/svelte/icons/zoom-in';
  import type { BFigura } from '../../lib/tipos';
  import { prepararHtml, textoPlano, url } from '../../lib/datos';
  import { abrirFigura } from '../../lib/acciones';
  import { leerNumero, numeroCorrecto } from '../repaso/datos';
  import { figuraDeCita } from './figura';

  let {
    pregunta,
    parte,
    orden,
    respuesta = null,
    onresponder,
    etiqueta = 'Pregunta',
    rotulo = '',
    mostrada = $bindable(null),
  }: {
    pregunta: Pregunta;
    parte: string;
    /** Order of the options on screen (indices into pregunta.opciones); the book's order by default. */
    orden?: number[];
    /** The first answer, kept by the caller: shown again when the question is revisited. */
    respuesta?: Respuesta | null;
    /** Called once, with the first answer. */
    onresponder?: (r: Respuesta) => void;
    etiqueta?: string;
    /** Small line above the statement (the chapter, in mixed exams). */
    rotulo?: string;
    /** The answer on show (null while choosing). */
    mostrada?: Respuesta | null;
  } = $props();

  const LETRAS = 'ABCDE';
  const p = $derived(pregunta);
  const posiciones = $derived(p.tipo === 'opcion' ? (orden ?? p.opciones.map((_, k) => k)) : []);
  const ref = $derived(referenciaDe(p, parte));

  // A revisited question shows its recorded answer.
  mostrada = untrack(() => respuesta);

  let escrito = $state(untrack(() => (respuesta && p.tipo === 'numero' ? respuesta.texto : '')));
  let aviso = $state('');
  let tarjeta: HTMLElement | undefined = $state();
  let figura = $state<BFigura | null>(null);

  // The figure is looked up only once the explanation is on show (it loads the part).
  $effect(() => {
    if (!mostrada) return;
    const q = p;
    let vivo = true;
    void figuraDeCita(parte, q.ref, q.cita).then((f) => {
      if (vivo) figura = f;
    });
    return () => {
      vivo = false;
    };
  });

  async function contestar(r: Respuesta) {
    if (mostrada) return;
    mostrada = r;
    if (!respuesta) onresponder?.(r);
    await tick();
    tarjeta?.scrollIntoView({ block: 'nearest', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
  }

  function elegir(pos: number) {
    if (p.tipo !== 'opcion' || mostrada) return;
    const original = posiciones[pos];
    if (original == null) return;
    void contestar({ elegida: pos, texto: '', bien: original === p.correcta });
  }

  function comprobar(ev: Event) {
    ev.preventDefault();
    if (p.tipo !== 'numero' || mostrada) return;
    const v = leerNumero(escrito);
    if (v == null) {
      aviso = 'Escriba un número (con coma o punto decimal).';
      return;
    }
    aviso = '';
    void contestar({ elegida: null, texto: escrito.trim(), bien: numeroCorrecto(p, v) });
  }

  let campo: HTMLInputElement | undefined = $state();
  let raiz: HTMLElement | undefined = $state();

  async function reintentar() {
    mostrada = null;
    escrito = '';
    figura = null;
    await tick();
    if (p.tipo === 'numero') campo?.focus();
    else raiz?.querySelector<HTMLButtonElement>('button.opcion')?.focus();
  }

  function teclas(ev: KeyboardEvent) {
    if (mostrada || p.tipo !== 'opcion' || ev.ctrlKey || ev.metaKey || ev.altKey) return;
    const t = ev.target as HTMLElement | null;
    if (t?.closest?.('input, textarea, select, [contenteditable="true"], [role="slider"]')) return;
    if (document.querySelector('[aria-modal="true"]')) return;
    let pos = -1;
    if (/^[1-9]$/.test(ev.key)) pos = Number(ev.key) - 1;
    else if (/^[a-eA-E]$/.test(ev.key)) pos = ev.key.toLowerCase().charCodeAt(0) - 97;
    if (pos >= 0 && pos < posiciones.length) {
      ev.preventDefault();
      elegir(pos);
    }
  }

  function formato(): string {
    return p.tipo === 'numero' ? `${p.valor_texto}${p.unidad ? ` ${p.unidad}` : ''}` : '';
  }

  function abrir(f: BFigura) {
    abrirFigura({ src: url(f.src), num: f.num, pie: f.pie, credito: f.credito, alt: (f.num ? `Figura ${f.num}: ` : '') + textoPlano(f.pie) });
  }
</script>

<svelte:window onkeydown={teclas} />

<div class="pregunta09" data-pregunta={p.id} bind:this={raiz}>
  <div class="cab">
    {#if rotulo}<p class="rotulo">{rotulo}</p>{/if}
    <span class="etiqueta">{etiqueta}</span>
    <h2 class="enunciado">{@html prepararHtml(p.enunciado)}</h2>
  </div>

  {#if p.tipo === 'opcion'}
    <ol class="opciones" role="list">
      {#each posiciones as original, pos (original)}
        {@const elegida = mostrada?.elegida === pos}
        {@const correcta = original === p.correcta}
        {@const ok = !!mostrada && correcta}
        {@const mal = !!mostrada && elegida && !correcta}
        <li>
          <button
            class="opcion"
            class:ok
            class:mal
            class:apagada={!!mostrada && !ok && !mal}
            disabled={!!mostrada}
            aria-pressed={mostrada ? elegida : undefined}
            onclick={() => elegir(pos)}
            data-opcion={pos}
            data-correcta={mostrada ? correcta : undefined}
          >
            <span class="letra">
              {#if ok}<Check size={18} strokeWidth={3} aria-hidden="true" />{:else if mal}<X size={18} strokeWidth={3} aria-hidden="true" />{:else}{LETRAS[pos]}{/if}
            </span>
            <span class="txt">{@html prepararHtml(p.tipo === 'opcion' ? p.opciones[original] : '')}</span>
            {#if ok}<span class="marca">Correcta</span>{:else if mal}<span class="marca">Tu respuesta</span>{/if}
          </button>
        </li>
      {/each}
    </ol>
  {:else}
    <form class="numero" class:ok={mostrada?.bien} class:mal={mostrada && !mostrada.bien} onsubmit={comprobar}>
      <label class="solo-lector" for={`num-${p.id}`}>Respuesta{p.unidad ? ` en ${p.unidad}` : ''}</label>
      <div class="campo">
        {#if mostrada}
          <span class="icono-num" aria-hidden="true">{#if mostrada.bien}<Check size={18} strokeWidth={3} />{:else}<X size={18} strokeWidth={3} />{/if}</span>
        {/if}
        <input
          id={`num-${p.id}`}
          bind:this={campo}
          bind:value={escrito}
          inputmode="decimal"
          autocomplete="off"
          spellcheck="false"
          placeholder="0,0"
          disabled={!!mostrada}
          aria-invalid={mostrada ? !mostrada.bien : undefined}
          data-numero
        />
        {#if p.unidad}<span class="unidad">{p.unidad}</span>{/if}
      </div>
      {#if !mostrada}<button class="comprobar" type="submit" data-comprobar>Comprobar</button>{/if}
    </form>
    {#if aviso}<p class="aviso" role="alert">{aviso}</p>{/if}
  {/if}

  {#if !mostrada}
    <p class="ayuda">{p.tipo === 'opcion' ? 'Toca una respuesta: verás al momento si es correcta y por qué.' : 'Escribe el resultado (coma o punto decimal) y comprueba: verás al momento si es correcto y por qué.'}</p>
  {:else}
    <section class="respuesta" class:bien={mostrada.bien} bind:this={tarjeta} role="status" data-feedback={mostrada.bien ? 'bien' : 'mal'}>
      <div class="veredicto">
        <span class="sello" aria-hidden="true">{#if mostrada.bien}<Check size={18} strokeWidth={3} />{:else}<X size={18} strokeWidth={3} />{/if}</span>
        <h3>{mostrada.bien ? '¡Correcto!' : 'No es correcto'}</h3>
      </div>
      {#if p.tipo === 'numero'}
        <p class="sol">
          {mostrada.texto ? `Tu respuesta: ${mostrada.texto}${p.unidad ? ` ${p.unidad}` : ''} · ` : ''}el libro da <strong>{formato()}</strong>{p.tolerancia ? ` (se acepta ±${Math.round(p.tolerancia * 100)} %)` : ''}
        </p>
      {/if}
      <p class="explicacion">{@html prepararHtml(p.explicacion)}</p>
      {#if figura}
        {@const f = figura}
        <figure class="figura-cita">
          <button type="button" class="placa" onclick={() => abrir(f)} aria-label={`Ampliar la figura ${f.num ?? ''}`}>
            <img src={url(f.src)} alt={(f.num ? `Figura ${f.num}: ` : '') + textoPlano(f.pie)} decoding="async" draggable="false" />
            <span class="lupa" aria-hidden="true"><ZoomIn size={16} /></span>
          </button>
          {#if f.pie || f.num}
            <figcaption>{#if f.num}<strong>Figura {f.num}.</strong>{/if} {@html prepararHtml(f.pie)}</figcaption>
          {/if}
        </figure>
      {/if}
      <blockquote>
        <span class="de">Del libro · {ref.nombre}</span>
        <p>«{p.cita}»</p>
      </blockquote>
      <button type="button" class="otra-vez" onclick={reintentar} data-reintentar>Probar otra vez</button>
    </section>
  {/if}
</div>

<style>
  .pregunta09 {
    /* verdict colours of the mockup; sepia derived from its page and card colours */
    --ok: #1e7a45;
    --ok-tinte: #e6f3eb;
    --mal: #b03a1e;
    --mal-tinte: #fbece6;
    --sobre-veredicto: #ffffff;
    display: flex;
    flex-direction: column;
    gap: 18px;
    font-family: var(--sans);
  }
  :global(:root[data-tema='sepia']) .pregunta09 {
    --ok: #1c7442;
    --ok-tinte: #dfe4d1;
    --mal: #b03a1e;
    --mal-tinte: #f1ddcc;
  }
  :global(:root[data-tema='oscuro']) .pregunta09 {
    --ok: #5dbb85;
    --ok-tinte: #17291f;
    --mal: #ec8a68;
    --mal-tinte: #33221c;
    --sobre-veredicto: #10161d;
  }
  .cab {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .rotulo {
    margin: 0;
    color: var(--tinta-suave);
    font-size: 14px;
    font-weight: 600;
  }
  .etiqueta {
    color: var(--bloque, var(--titulos));
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }
  .enunciado {
    margin: 0;
    color: var(--titulos);
    font-family: var(--serif);
    font-size: clamp(23px, 3.2vw, 27px);
    font-weight: 600;
    line-height: 1.3;
    text-wrap: pretty;
  }
  .opciones {
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .opcion {
    display: flex;
    align-items: center;
    gap: 14px;
    width: 100%;
    min-height: 60px;
    padding: 12px 14px;
    border: 2px solid var(--linea);
    border-radius: 14px;
    background: var(--superficie);
    color: var(--tinta);
    font-size: 16px;
    line-height: 1.35;
    text-align: left;
    transition:
      border-color 0.15s,
      background 0.15s;
  }
  .opcion:not(:disabled):hover {
    border-color: var(--acento-borde);
    background: var(--acento-tinte);
  }
  .opcion:disabled {
    cursor: default;
  }
  .letra {
    display: flex;
    flex-shrink: 0;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border-radius: 9px;
    background: var(--superficie-2);
    color: var(--tinta);
    font-size: 15px;
    font-weight: 700;
  }
  .txt {
    flex: 1;
    min-width: 0;
  }
  .marca {
    flex-shrink: 0;
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }
  .opcion.ok {
    border-color: var(--ok);
    background: var(--ok-tinte);
  }
  .opcion.ok .letra {
    background: var(--ok);
    color: var(--sobre-veredicto);
  }
  .opcion.ok .marca {
    color: var(--ok);
  }
  .opcion.mal {
    border-color: var(--mal);
    background: var(--mal-tinte);
  }
  .opcion.mal .letra {
    background: var(--mal);
    color: var(--sobre-veredicto);
  }
  .opcion.mal .marca {
    color: var(--mal);
  }
  .opcion.apagada {
    opacity: 0.6;
  }

  .numero {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 10px;
  }
  .campo {
    display: flex;
    flex: 1 1 220px;
    align-items: center;
    gap: 10px;
    min-height: 60px;
    padding: 0 14px;
    border: 2px solid var(--linea);
    border-radius: 14px;
    background: var(--superficie);
  }
  .campo:focus-within {
    border-color: var(--acento);
  }
  .numero input {
    flex: 1;
    min-width: 0;
    height: 56px;
    padding: 0;
    border: 0;
    outline: none;
    background: transparent;
    color: var(--tinta);
    font-size: 20px;
    font-variant-numeric: tabular-nums;
  }
  .unidad {
    color: var(--tinta);
    font-size: 18px;
    font-weight: 600;
  }
  .icono-num {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    flex-shrink: 0;
    border-radius: 9px;
    color: var(--sobre-veredicto);
  }
  .numero.ok .campo {
    border-color: var(--ok);
    background: var(--ok-tinte);
  }
  .numero.ok .icono-num {
    background: var(--ok);
  }
  .numero.mal .campo {
    border-color: var(--mal);
    background: var(--mal-tinte);
  }
  .numero.mal .icono-num {
    background: var(--mal);
  }
  .comprobar {
    min-height: 60px;
    padding: 0 24px;
    border: 0;
    border-radius: 14px;
    background: var(--bloque, var(--titulos));
    color: var(--sobre-bloque, var(--fondo));
    font-size: 17px;
    font-weight: 700;
  }
  .aviso {
    margin: -8px 0 0;
    color: var(--mal);
    font-size: 15px;
  }
  .ayuda {
    margin: 0;
    color: var(--tinta-suave);
    font-size: 15px;
  }

  .respuesta {
    display: flex;
    flex-direction: column;
    gap: 14px;
    padding: 18px;
    border: 1px solid var(--linea);
    border-top: 5px solid var(--mal);
    border-radius: 18px;
    background: var(--superficie);
    box-shadow: var(--sombra);
    scroll-margin-bottom: 120px;
    animation: entrar 0.2s ease;
  }
  .respuesta.bien {
    border-top-color: var(--ok);
  }
  @keyframes entrar {
    from {
      opacity: 0;
      transform: translateY(4px);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .respuesta {
      animation: none;
    }
  }
  .veredicto {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .sello {
    display: flex;
    flex-shrink: 0;
    align-items: center;
    justify-content: center;
    width: 34px;
    height: 34px;
    border-radius: 50%;
    background: var(--mal);
    color: var(--sobre-veredicto);
  }
  .bien .sello {
    background: var(--ok);
  }
  .veredicto h3 {
    margin: 0;
    color: var(--mal);
    font-size: 19px;
    font-weight: 700;
  }
  .bien .veredicto h3 {
    color: var(--ok);
  }
  .sol {
    margin: 0;
    color: var(--tinta);
    font-size: 16px;
  }
  .explicacion {
    margin: 0;
    color: var(--tinta);
    font-family: var(--serif);
    font-size: 17px;
    line-height: 1.6;
  }
  .figura-cita {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin: 0;
  }
  .placa {
    position: relative;
    display: block;
    width: 100%;
    padding: 12px;
    border: 1px solid var(--linea);
    border-radius: 12px;
    background: var(--placa);
    cursor: zoom-in;
  }
  .placa img {
    display: block;
    width: 100%;
    max-height: 340px;
    height: auto;
    object-fit: contain;
    filter: var(--placa-filtro);
  }
  .lupa {
    position: absolute;
    right: 8px;
    bottom: 8px;
    display: grid;
    place-items: center;
    width: 30px;
    height: 30px;
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.85);
    color: #333;
  }
  figcaption {
    color: var(--tinta-suave);
    font-size: 14px;
    line-height: 1.45;
  }
  figcaption strong {
    color: var(--tinta);
  }
  blockquote {
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin: 0;
    padding: 12px 14px;
    border-radius: 12px;
    background: var(--superficie-2);
  }
  .de {
    color: var(--tinta-suave);
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }
  blockquote p {
    margin: 0;
    color: var(--tinta);
    font-family: var(--serif);
    font-size: 16px;
    line-height: 1.5;
  }
  .otra-vez {
    align-self: flex-start;
    min-height: 44px;
    padding: 0 4px;
    border: 0;
    background: transparent;
    color: var(--acento);
    font-size: 15px;
    font-weight: 600;
  }
  .otra-vez:hover {
    text-decoration: underline;
  }
</style>
