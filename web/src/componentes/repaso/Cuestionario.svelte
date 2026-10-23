<script lang="ts" module>
  import type { Pregunta } from './datos';

  export interface Item {
    parte: string;
    p: Pregunta;
  }

  interface Respuesta {
    /** Option chosen (index into the shuffled order) or the number typed. */
    elegida: number | null;
    texto: string;
    bien: boolean;
  }

  interface Sesion {
    items: Item[];
    /** Shuffled option order of each question. */
    ordenes: number[][];
    k: number;
    respuestas: (Respuesta | null)[];
    terminado: boolean;
    registrado: boolean;
  }

  // Running quizzes survive a visit to the book («Leer en el libro» and Back).
  const sesiones = new Map<string, Sesion>();

  export function olvidarSesion(clave: string): void {
    sesiones.delete(clave);
  }
</script>

<script lang="ts">
  // One question at a time, immediate feedback with the book's explanation and quote, score at the end.
  // Keys: 1–5 or A–E choose; Intro/espacio goes on after answering.
  import { onMount, tick } from 'svelte';
  import CircleCheck from '@lucide/svelte/icons/circle-check';
  import CircleX from '@lucide/svelte/icons/circle-x';
  import { prepararHtml, rotuloParte, rutaDeRef } from '../../lib/datos';
  import { barajar, leerNumero, numeroCorrecto, type PreguntaNumero } from './datos';
  import { registrarRespuesta } from './estado.svelte';
  import Icono from '../Icono.svelte';

  let {
    clave,
    cargar,
    alTerminar,
    mostrarParte = false,
    volverA = '#/repaso',
  }: {
    clave: string;
    cargar: () => Promise<Item[]>;
    alTerminar?: (aciertos: number, total: number) => void;
    mostrarParte?: boolean;
    volverA?: string;
  } = $props();

  let sesion = $state<Sesion | null>(null);
  let error = $state('');
  let escrito = $state('');
  let campo: HTMLInputElement | undefined = $state();
  let siguienteBtn: HTMLButtonElement | undefined = $state();
  let aviso = $state('');

  function nueva(items: Item[]): Sesion {
    return {
      items,
      ordenes: items.map((it) => (it.p.tipo === 'opcion' ? barajar(it.p.opciones.map((_, k) => k)) : [])),
      k: 0,
      respuestas: items.map(() => null),
      terminado: false,
      registrado: false,
    };
  }

  async function empezar(forzar = false) {
    error = '';
    const previa = sesiones.get(clave);
    if (previa && !forzar) {
      sesion = previa;
      return;
    }
    try {
      const items = await cargar();
      const s = nueva(barajar(items));
      sesiones.set(clave, s);
      sesion = s;
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    }
  }

  onMount(() => {
    void empezar();
  });

  const item = $derived(sesion && !sesion.terminado ? sesion.items[sesion.k] : null);
  const resp = $derived(sesion && item ? sesion.respuestas[sesion.k] : null);
  const total = $derived(sesion?.items.length ?? 0);
  const aciertos = $derived(sesion ? sesion.respuestas.filter((r) => r?.bien).length : 0);
  const contestadas = $derived(sesion ? sesion.respuestas.filter((r) => r).length : 0);

  function guardarSesion() {
    if (sesion) sesiones.set(clave, sesion);
  }

  async function contestar(r: Respuesta) {
    if (!sesion || !item || resp) return;
    sesion.respuestas[sesion.k] = r;
    registrarRespuesta(item.p.id, item.parte, r.bien);
    guardarSesion();
    await tick();
    siguienteBtn?.focus({ preventScroll: true });
    document.querySelector('.cuestionario .respuesta')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  function elegir(pos: number) {
    if (!sesion || !item || item.p.tipo !== 'opcion') return;
    const original = sesion.ordenes[sesion.k]![pos]!;
    void contestar({ elegida: pos, texto: '', bien: original === item.p.correcta });
  }

  function comprobar(ev?: Event) {
    ev?.preventDefault();
    if (!item || item.p.tipo !== 'numero') return;
    const v = leerNumero(escrito);
    if (v == null) {
      aviso = 'Escriba un número (con coma o punto decimal).';
      return;
    }
    aviso = '';
    void contestar({ elegida: null, texto: escrito.trim(), bien: numeroCorrecto(item.p, v) });
  }

  async function avanzar() {
    if (!sesion || !resp) return;
    escrito = '';
    aviso = '';
    if (sesion.k + 1 < total) {
      sesion.k++;
    } else {
      sesion.terminado = true;
      if (!sesion.registrado) {
        sesion.registrado = true;
        alTerminar?.(sesion.respuestas.filter((r) => r?.bien).length, total);
      }
    }
    guardarSesion();
    window.scrollTo({ top: 0, behavior: 'instant' });
    await tick();
    if (item?.p.tipo === 'numero') campo?.focus({ preventScroll: true });
  }

  function teclas(ev: KeyboardEvent) {
    if (ev.ctrlKey || ev.metaKey || ev.altKey || !item) return;
    const enCampo = (ev.target as HTMLElement | null)?.closest?.('input, textarea, select');
    if (resp) {
      if ((ev.key === 'Enter' || ev.key === ' ') && !(ev.target as HTMLElement | null)?.closest?.('a, button')) {
        ev.preventDefault();
        void avanzar();
      }
      return;
    }
    if (enCampo || item.p.tipo !== 'opcion') return;
    const n = item.p.opciones.length;
    let pos = -1;
    if (/^[1-9]$/.test(ev.key)) pos = Number(ev.key) - 1;
    else if (/^[a-eA-E]$/.test(ev.key)) pos = ev.key.toLowerCase().charCodeAt(0) - 97;
    if (pos >= 0 && pos < n) {
      ev.preventDefault();
      elegir(pos);
    }
  }

  function formatoNumero(p: PreguntaNumero): string {
    return `${p.valor_texto}${p.unidad ? ` ${p.unidad}` : ''}`;
  }

  function referencia(it: Item): { href: string | null; texto: string } {
    const p = it.p;
    const href = rutaDeRef(p.ref) ?? `#/${it.parte}/${encodeURIComponent(p.ref)}`;
    const texto = p.ref_num ? `${p.ref_tipo} ${p.ref_num}` : `${p.ref_tipo} «${p.ref_titulo ?? ''}»`;
    return { href, texto };
  }

  const LETRAS = 'ABCDE';
  const fallos = $derived(sesion ? sesion.items.map((it, k) => ({ it, r: sesion!.respuestas[k] })).filter((x) => x.r && !x.r.bien) : []);
</script>

<svelte:window onkeydown={teclas} />

<div class="cuestionario">
  {#if error}
    <p class="rp-sub">No se pudieron cargar las preguntas: {error}</p>
  {:else if !sesion}
    <p class="rp-sub">Cargando las preguntas…</p>
  {:else if sesion.terminado}
    {@const nota = total ? aciertos / total : 0}
    <section class="final rp-caja" data-final data-aciertos={aciertos} data-total={total}>
      <div class="marcador" style:--p={nota}>
        <span class="grande">{aciertos}<small>/{total}</small></span>
        <span>{Math.round(nota * 100)} % de aciertos</span>
      </div>
      <p class="veredicto">
        {nota === 1 ? 'Todas bien.' : nota >= 0.8 ? 'Muy bien: repase solo lo que ha fallado.' : nota >= 0.5 ? 'Bien encaminado: conviene releer las secciones de los fallos.' : 'Conviene volver a leer el capítulo antes de repetir el test.'}
      </p>
      {#if fallos.length}
        <h3>Para repasar</h3>
        <ul class="fallos">
          {#each fallos as f (f.it.p.id)}
            {@const ref = referencia(f.it)}
            <li>
              <span class="enun">{@html prepararHtml(f.it.p.enunciado)}</span>
              <a href={ref.href}>{ref.texto} →</a>
            </li>
          {/each}
        </ul>
        <p class="nota-fallos">Quedan en «Repasar fallos» hasta que los acierte.</p>
      {/if}
      <div class="acc">
        <button class="boton primario" onclick={() => empezar(true)} data-repetir>Repetir</button>
        <a class="boton" href={volverA}>Volver</a>
      </div>
    </section>
  {:else if item}
    {@const p = item.p}
    <div class="progreso" aria-label={`Pregunta ${sesion.k + 1} de ${total}`}>
      <span class="paso">Pregunta {sesion.k + 1} de {total}</span>
      <span class="aciertos">{aciertos} de {contestadas} bien</span>
      <span class="barra"><span style:width={`${((sesion.k + (resp ? 1 : 0)) / total) * 100}%`}></span></span>
    </div>

    <section class="pregunta rp-caja" data-pregunta={p.id}>
      {#if mostrarParte}<p class="de">{rotuloParte(item.parte)}</p>{/if}
      <h2 class="enunciado">{@html prepararHtml(p.enunciado)}</h2>

      {#if p.tipo === 'opcion'}
        <ol class="opciones" role="list">
          {#each sesion.ordenes[sesion.k] ?? [] as original, pos (original)}
            {@const elegida = resp?.elegida === pos}
            {@const correcta = original === p.correcta}
            <li>
              <button
                class="opcion"
                class:correcta={resp && correcta}
                class:mal={resp && elegida && !correcta}
                class:apagada={resp && !elegida && !correcta}
                disabled={!!resp}
                aria-pressed={resp ? elegida : undefined}
                onclick={() => elegir(pos)}
                data-opcion={pos}
                data-correcta={resp ? correcta : undefined}
              >
                <span class="letra">{LETRAS[pos]}</span>
                <span class="txt">{@html prepararHtml(p.opciones[original])}</span>
                {#if resp && correcta}<CircleCheck size={22} aria-label="Correcta" />{:else if resp && elegida}<CircleX size={22} aria-label="Su respuesta" />{/if}
              </button>
            </li>
          {/each}
        </ol>
      {:else}
        <form class="numero" onsubmit={comprobar}>
          <label class="solo-lector" for="resp-num">Respuesta</label>
          <input
            id="resp-num"
            bind:this={campo}
            bind:value={escrito}
            inputmode="decimal"
            autocomplete="off"
            spellcheck="false"
            placeholder="0,0"
            disabled={!!resp}
            class:correcta={resp?.bien}
            class:mal={resp && !resp.bien}
            data-numero
          />
          {#if p.unidad}<span class="unidad">{p.unidad}</span>{/if}
          {#if !resp}<button class="boton primario" type="submit" data-comprobar>Comprobar</button>{/if}
        </form>
        {#if aviso}<p class="aviso-num" role="alert">{aviso}</p>{/if}
      {/if}

      {#if resp}
        {@const ref = referencia(item)}
        <div class="respuesta" class:bien={resp.bien} role="status" data-feedback={resp.bien ? 'bien' : 'mal'}>
          <p class="veredicto-q">
            {#if resp.bien}<CircleCheck size={20} aria-hidden="true" /> Correcto{:else}<CircleX size={20} aria-hidden="true" /> No es correcto{/if}
            {#if p.tipo === 'numero'}<span class="sol">· el libro da {formatoNumero(p)}{p.tolerancia ? ` (se acepta ±${Math.round(p.tolerancia * 100)} %)` : ''}</span>{/if}
          </p>
          <p class="explicacion">{@html prepararHtml(p.explicacion)}</p>
          <blockquote>
            <p>«{p.cita}»</p>
            <footer><a href={ref.href}><Icono nombre="libro" tam={16} /> {ref.texto} · Leer en el libro</a></footer>
          </blockquote>
        </div>
      {/if}
    </section>

    {#if resp}
      <div class="seguir">
        <button class="boton primario" bind:this={siguienteBtn} onclick={avanzar} data-siguiente>
          {sesion.k + 1 < total ? 'Siguiente' : 'Ver el resultado'} <Icono nombre="chevron" tam={16} />
        </button>
        <span class="tecla"><kbd>Intro</kbd></span>
      </div>
    {/if}
  {/if}
</div>

<style>
  .progreso {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px 14px;
    margin-bottom: 10px;
    color: var(--tinta-suave);
    font-size: 14px;
    font-variant-numeric: tabular-nums;
  }
  .paso {
    color: var(--tinta);
    font-weight: 700;
  }
  .barra {
    flex: 1 1 100%;
    height: 6px;
    border-radius: 3px;
    background: var(--linea-suave);
    overflow: hidden;
  }
  .barra span {
    display: block;
    height: 100%;
    background: var(--acento);
    transition: width 0.25s ease;
  }
  .pregunta {
    padding: clamp(16px, 3.5vw, 28px);
  }
  .de {
    margin: 0 0 6px;
    color: var(--acento);
    font-size: 13.5px;
    font-weight: 700;
  }
  .enunciado {
    margin: 0 0 18px;
    color: var(--tinta);
    font-family: var(--serif);
    font-size: clamp(19px, 2.4vw, 22px);
    font-weight: 600;
    line-height: 1.4;
  }
  .opciones {
    display: grid;
    gap: 8px;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .opcion {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
    min-height: 52px;
    padding: 10px 14px;
    border: 1.5px solid var(--linea);
    border-radius: 12px;
    background: var(--fondo);
    color: var(--tinta);
    font-size: 16.5px;
    line-height: 1.4;
    text-align: left;
    transition: border-color 0.15s, background 0.15s;
  }
  .opcion:not(:disabled):hover {
    border-color: var(--acento-borde);
    background: var(--acento-tinte);
  }
  .opcion:disabled {
    cursor: default;
  }
  .letra {
    display: grid;
    flex: none;
    place-items: center;
    width: 30px;
    height: 30px;
    border-radius: 8px;
    background: var(--superficie-2);
    color: var(--tinta-suave);
    font-size: 14px;
    font-weight: 700;
  }
  .txt {
    flex: 1;
  }
  .opcion.correcta {
    border-color: var(--c-ejemplo);
    background: color-mix(in srgb, var(--c-ejemplo) 11%, var(--fondo));
    color: var(--tinta);
  }
  .opcion.correcta .letra {
    background: var(--c-ejemplo);
    color: #fff;
  }
  .opcion.correcta :global(svg) {
    color: var(--c-ejemplo);
  }
  .opcion.mal {
    border-color: var(--c-precaucion);
    background: color-mix(in srgb, var(--c-precaucion) 10%, var(--fondo));
  }
  .opcion.mal .letra {
    background: var(--c-precaucion);
    color: #fff;
  }
  .opcion.mal :global(svg) {
    color: var(--c-precaucion);
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
  .numero input {
    width: 11em;
    min-height: 48px;
    padding: 0 14px;
    border: 1.5px solid var(--linea);
    border-radius: 12px;
    background: var(--fondo);
    color: var(--tinta);
    font-size: 19px;
    font-variant-numeric: tabular-nums;
  }
  .numero input:focus {
    border-color: var(--acento);
    outline: none;
  }
  .numero input.correcta {
    border-color: var(--c-ejemplo);
  }
  .numero input.mal {
    border-color: var(--c-precaucion);
  }
  .unidad {
    color: var(--tinta);
    font-size: 18px;
    font-weight: 600;
  }
  .aviso-num {
    margin: 8px 0 0;
    color: var(--c-precaucion);
    font-size: 14.5px;
  }
  .respuesta {
    margin-top: 18px;
    padding: 14px 16px;
    border-left: 4px solid var(--c-precaucion);
    border-radius: 0 10px 10px 0;
    background: color-mix(in srgb, var(--c-precaucion) 7%, var(--superficie));
    animation: entrar 0.2s ease;
  }
  .respuesta.bien {
    border-left-color: var(--c-ejemplo);
    background: color-mix(in srgb, var(--c-ejemplo) 7%, var(--superficie));
  }
  @keyframes entrar {
    from {
      opacity: 0;
      transform: translateY(4px);
    }
  }
  .veredicto-q {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;
    margin: 0 0 6px;
    color: var(--c-precaucion);
    font-size: 16.5px;
    font-weight: 700;
  }
  .respuesta.bien .veredicto-q {
    color: var(--c-ejemplo);
  }
  .sol {
    color: var(--tinta);
    font-weight: 600;
  }
  .explicacion {
    margin: 0;
    color: var(--tinta);
    font-family: var(--serif);
    font-size: 17px;
    line-height: 1.5;
  }
  blockquote {
    margin: 12px 0 0;
    padding: 0 0 0 14px;
    border-left: 2px solid var(--linea);
    color: var(--tinta-suave);
  }
  blockquote p {
    margin: 0;
    font-family: var(--serif);
    font-size: 15.5px;
    font-style: italic;
    line-height: 1.5;
  }
  blockquote footer a {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    min-height: 44px;
    font-size: 14.5px;
    font-weight: 600;
    text-decoration: none;
  }
  .seguir {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 10px;
    margin-top: 14px;
  }
  .seguir .boton {
    min-width: 180px;
    justify-content: center;
  }
  .tecla {
    color: var(--tinta-tenue);
  }
  .final {
    padding: clamp(18px, 4vw, 32px);
  }
  .marcador {
    display: flex;
    flex-direction: column;
    gap: 2px;
    color: var(--tinta-suave);
    font-size: 15px;
  }
  .grande {
    color: var(--titulos);
    font-size: 54px;
    font-weight: 800;
    font-variant-numeric: tabular-nums;
    line-height: 1;
  }
  .grande small {
    color: var(--tinta-tenue);
    font-size: 0.5em;
    font-weight: 600;
  }
  .veredicto {
    margin: 12px 0 0;
    color: var(--tinta);
    font-size: 17px;
  }
  .final h3 {
    margin: 22px 0 8px;
    color: var(--tinta);
    font-size: 16px;
  }
  .fallos {
    display: grid;
    gap: 6px;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .fallos li {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 4px 12px;
    padding: 8px 12px;
    border-radius: 10px;
    background: var(--superficie-2);
  }
  .fallos .enun {
    flex: 1 1 320px;
    font-size: 15px;
  }
  .fallos a {
    display: inline-flex;
    align-items: center;
    min-height: 44px;
    font-size: 14.5px;
    font-weight: 600;
    text-decoration: none;
  }
  .nota-fallos {
    margin: 8px 0 0;
    color: var(--tinta-suave);
    font-size: 14px;
  }
  .final .acc {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 20px;
  }
  @media (hover: none) {
    .tecla {
      display: none;
    }
  }
  @media (max-width: 560px) {
    .seguir .boton {
      flex: 1;
    }
  }
</style>
