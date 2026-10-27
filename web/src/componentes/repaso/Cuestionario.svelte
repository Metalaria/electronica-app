<script lang="ts" module>
  import type { Pregunta as DatosPregunta } from './datos';

  export interface Item {
    parte: string;
    p: DatosPregunta;
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
  // One question at a time with the shared question component (componentes/pregunta, 0.9 mockup): immediate
  // feedback with the book's explanation, figure and quote; score at the end. Only the first answer to each
  // question counts («Probar otra vez» is for learning). Keys: 1–4 or A–D choose; Intro goes on after answering.
  import { onMount, tick } from 'svelte';
  import ArrowRight from '@lucide/svelte/icons/arrow-right';
  import { infoParte, prepararHtml, rotuloParte, rutaDeRef } from '../../lib/datos';
  import { tonoBloque } from '../../lib/color';
  import { app } from '../../lib/estado.svelte';
  import { barajar } from './datos';
  import { registrarRespuesta } from './estado.svelte';
  import Pregunta, { referenciaDe } from '../pregunta/Pregunta.svelte';
  import PieAcciones from '../pregunta/PieAcciones.svelte';
  import CabeceraPasos from '../pregunta/CabeceraPasos.svelte';

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
  let siguienteBtn: HTMLButtonElement | undefined = $state();

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
  }

  async function avanzar() {
    if (!sesion || !resp) return;
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
    document.querySelector<HTMLInputElement>('.cuestionario [data-numero]')?.focus({ preventScroll: true });
  }

  function teclas(ev: KeyboardEvent) {
    if (ev.ctrlKey || ev.metaKey || ev.altKey || !item || !resp) return;
    if (document.querySelector('[aria-modal="true"]')) return;
    if ((ev.key === 'Enter' || ev.key === ' ') && !(ev.target as HTMLElement | null)?.closest?.('a, button, input, textarea, select')) {
      ev.preventDefault();
      void avanzar();
    }
  }

  function referencia(it: Item): { href: string | null; texto: string } {
    const p = it.p;
    const href = rutaDeRef(p.ref) ?? `#/${it.parte}/${encodeURIComponent(p.ref)}`;
    const texto = p.ref_num ? `${p.ref_tipo} ${p.ref_num}` : `${p.ref_tipo} «${p.ref_titulo ?? ''}»`;
    return { href, texto };
  }

  /** «Repaso · Capítulo 5 · Diodos». */
  function contexto(it: Item): string {
    const titulo = (infoParte(it.parte)?.titulo ?? '').split(' — ')[0];
    return `Repaso · ${rotuloParte(it.parte)}${titulo && titulo !== rotuloParte(it.parte) ? ` · ${titulo}` : ''}`;
  }

  const tono = $derived(tonoBloque(item ? infoParte(item.parte)?.color : null, app.tema));

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
    {@const ref = referenciaDe(p, item.parte)}
    <div class="juego" style:--bloque={tono.relleno} style:--sobre-bloque={tono.sobre}>
      <div class="progreso">
        <span class="solo-lector">Pregunta {sesion.k + 1} de {total}</span>
        <CabeceraPasos
          {total}
          actual={sesion.k}
          contexto={`${contexto(item)} · ${aciertos} de ${contestadas} bien`}
          descripcion={`Pregunta ${sesion.k + 1} de ${total}`}
          cerrar={volverA}
          etiquetaCerrar="Cerrar el test"
        />
      </div>

      <div class="cuerpo">
        {#key `${sesion.k}:${p.id}`}
          <Pregunta
            pregunta={p}
            parte={item.parte}
            orden={sesion.ordenes[sesion.k]}
            respuesta={resp}
            onresponder={contestar}
            rotulo={mostrarParte ? rotuloParte(item.parte) : ''}
          />
        {/key}
      </div>

      <PieAcciones>
        <a class="accion" href={ref.href} data-ver-seccion>{ref.ver}</a>
        <button class="accion primaria" bind:this={siguienteBtn} onclick={avanzar} disabled={!resp} data-siguiente>
          {sesion.k + 1 < total ? 'Continuar' : 'Ver el resultado'} <ArrowRight size={20} strokeWidth={2.2} aria-hidden="true" />
        </button>
      </PieAcciones>
    </div>
  {/if}
</div>

<style>
  .juego {
    --pad-pie: 0px;
    --pie-abajo: var(--hueco-inferior);
    max-width: 640px;
    margin: 0 auto;
  }
  .cuerpo {
    padding: 24px 0 28px;
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
</style>
