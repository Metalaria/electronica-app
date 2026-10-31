<script lang="ts">
  // «Monta este circuito» (0.11), what the user sees: the step card above the bench (progress, what to do now,
  // why the last part went where it did, and what is wrong with the last thing put, with its fix), the
  // chooser of circuits (the five built-in ones and, from a schematic, that very circuit) and the end
  // (a small celebration once the simulation proves it works).
  import { untrack } from 'svelte';
  import type { Protoboard } from './estado.svelte';
  import type { DocumentoProtoboard } from './tipos.ts';
  import type { PasoGuia, PlanGuia } from './guia.ts';
  import { planDeMontaje, planPorId } from './guia.ts';
  import { GUIADOS } from './guiados.ts';
  import { empezarGuia } from './guia.svelte.ts';
  import { empezarLeccion, terminarLeccion } from './leccion.svelte.ts';
  import { leccionVista } from './leccion.ts';
  import { svgMiniaturaMontaje } from './miniatura.ts';
  import { pulsar } from './pulsar.ts';
  import { emitir } from '../../lib/aprendizaje/eventos';
  import Check from '@lucide/svelte/icons/check';
  import X from '@lucide/svelte/icons/x';
  import Wand from '@lucide/svelte/icons/wand-sparkles';
  import Lightbulb from '@lucide/svelte/icons/lightbulb';

  let {
    pb,
    parte = 'banda',
    eligiendo = $bindable(false),
    alGuardar,
    alQuedarse,
    alSimular = () => {},
  }: {
    pb: Protoboard;
    /** «banda»: the step card above the bench (with the chooser and the end); «respuesta»: the answer at its foot. */
    parte?: 'banda' | 'respuesta';
    /** The chooser is open. */
    eligiendo?: boolean;
    /** «Guardar en Mis montajes» at the end (the «Protoboard» page). */
    alGuardar?: () => void;
    /**
     * The guide ends keeping its board («Guardar en Mis montajes», «Seguir con esta placa»): called before the guide is
     * closed, with the board the guide replaced, so the page can keep its saved montage or draft as they were.
     */
    alQuedarse?: (anterior: DocumentoProtoboard, guardar: boolean) => void;
    alSimular?: () => void;
  } = $props();

  const guia = $derived(pb.guia);
  const libro = $derived.by(() => {
    const d = pb.docInicial();
    return d && d.origen?.tipo !== 'propio' && d.piezas.length ? d : null;
  });

  /** The first guided run starts with «La protoboard por dentro» (once; it can be skipped). */
  function empezar(plan: PlanGuia) {
    eligiendo = false;
    if (!leccionVista()) empezarLeccion(pb, plan);
    else empezarGuia(pb, plan);
    inicio = performance.now();
  }

  function empezarId(id: string) {
    const p = id === 'libro' && libro ? planDeMontaje(libro, libro.titulo) : planPorId(id);
    if (p) empezar(p);
  }

  /** Leaves the guide: back to the board as it was, or keeping what was built (`guardar`: to save it as a montage). */
  function salir(quedarse = false, guardar = false) {
    if (pb.leccion) terminarLeccion(pb, false);
    const g = guia;
    if (!g) return;
    if (quedarse) alQuedarse?.(g.anterior, guardar);
    pb.guia = null;
    if (!quedarse) pb.cargar(g.anterior, false);
  }

  // The «why» of the step just done stays until the next one is done.
  let hechosAntes: boolean[] = [];
  let inicio = 0;
  let segundos = $state(0);
  $effect(() => {
    const g = guia;
    if (!g) {
      hechosAntes = [];
      return;
    }
    const h = g.estado.hechos;
    untrack(() => {
      const nuevo = h.findIndex((x, i) => x && !hechosAntes[i]);
      const fin = g.estado.actual >= g.plan.pasos.length && !g.celebrado;
      if (nuevo >= 0 && hechosAntes.length && parte === 'banda') {
        g.ultimo = g.plan.pasos[nuevo] ?? null;
        g.versionUltimo = pb.version;
        // 0.11 learning event (a light tick); the last one is the celebration's instead
        if (!fin) emitir({ tipo: 'paso-montaje', circuito: g.plan.id, paso: nuevo, total: g.plan.pasos.length });
      }
      hechosAntes = [...h];
      if (fin) {
        g.celebrado = true;
        segundos = Math.round((performance.now() - inicio) / 1000);
        emitir({ tipo: 'circuito-montado', circuito: g.plan.id });
      }
    });
  });

  const paso = $derived(guia?.paso ?? null);
  const error = $derived(guia?.estado.error ?? null);
  // (shown until the next change of the board)
  const porQue = $derived(guia?.ultimo && guia.ultimo !== paso && pb.version === guia.versionUltimo ? guia.ultimo : null);

  function arreglar() {
    const e = error;
    if (!e) return;
    if (e.arreglo === 'voltear') pb.transformar([e.id], 'reflejar');
    else if (e.arreglo === 'quitar') pb.borrar([e.id]);
    else pb.sel = [e.id];
  }

  const etiquetaPaso = (p: PasoGuia) => (p.tipo === 'pieza' ? p.pieza.comp.nombre : p.tipo === 'cable' ? 'Cable' : 'Simular');
  const minis = new Map<string, string>();
  const miniatura = (id: string): string => {
    const hecha = minis.get(id);
    if (hecha != null) return hecha;
    const p = planPorId(id);
    const url = (p ? svgMiniaturaMontaje(p.objetivo) : null) ?? '';
    minis.set(id, url);
    return url;
  };
  const miniLibro = $derived(libro ? svgMiniaturaMontaje(libro) : null);
</script>

{#if guia && parte === 'respuesta' && !guia.celebrado}
  <!-- The answer to the last move, at the foot of the bench (as Brilliant does): what is wrong and its fix, or why the part just put goes there. -->
  {#if error}
    <div class="respuesta mal" role="alert">
      <p>{error.texto}</p>
      <button type="button" class="boton" use:pulsar={arreglar}>{error.arreglo === 'voltear' ? 'Voltear' : error.arreglo === 'quitar' ? 'Quitarlo' : 'Elegirla'}</button>
    </div>
  {:else if porQue}
    <div class="respuesta bien" role="status">
      <span class="ok"><Check size={15} aria-hidden="true" /></span>
      <p><b>{etiquetaPaso(porQue)}: ¡bien!</b> {porQue.porQue}</p>
      <button type="button" class="cerrar" aria-label="Cerrar" onclick={() => guia && (guia.ultimo = null)}><X size={16} /></button>
    </div>
  {/if}
{:else if guia && parte === 'banda'}
  <section class="guia" aria-label={`Monta este circuito: ${guia.plan.titulo}`} data-paso={guia.estado.actual}>
    <div class="fila">
      <div class="progreso" role="progressbar" aria-valuemin={0} aria-valuemax={guia.plan.pasos.length} aria-valuenow={guia.estado.hechos.filter(Boolean).length} aria-label="Pasos hechos">
        {#each guia.plan.pasos as p, i (i)}
          <span class="punto" class:hecho={guia.estado.hechos[i]} class:actual={i === guia.estado.actual} title={etiquetaPaso(p)}></span>
        {/each}
      </div>
      <span class="cuenta">Paso {Math.min(guia.estado.actual + 1, guia.plan.pasos.length)} de {guia.plan.pasos.length} · {guia.plan.titulo}</span>
      {#if paso?.tipo === 'simular' && !guia.celebrado}
        <button type="button" class="boton primario mini" onclick={alSimular}>Simular</button>
      {:else if paso}
        <button type="button" class="boton suave" onclick={() => guia.hacerPaso()}><Wand size={15} aria-hidden="true" /> Hazlo por mí</button>
      {/if}
      <button type="button" class="salir" onclick={() => salir()} aria-label="Salir de la guía y volver a la placa de antes" title="Salir de la guía"><X size={18} /></button>
    </div>
    {#if paso}
      <p class="ahora" aria-live="polite">{paso.texto}</p>
    {/if}
  </section>

  {#if guia.celebrado}
    <div class="fiesta" role="dialog" aria-modal="false" aria-labelledby="fiesta-titulo">
      <div class="confeti" aria-hidden="true">{#each Array.from({ length: 18 }) as _, i (i)}<i style:--k={i}></i>{/each}</div>
      <div class="tarjeta">
        <p class="icono" aria-hidden="true"><Lightbulb size={30} /></p>
        <h2 id="fiesta-titulo">¡Funciona!</h2>
        <p>{guia.plan.final}</p>
        <p class="datos">{guia.total} pasos{segundos ? ` en ${segundos < 90 ? `${segundos} s` : `${Math.round(segundos / 60)} min`}` : ''}.</p>
        <div class="botones">
          {#if alGuardar && guia.plan.id !== 'libro'}<button type="button" class="boton primario" onclick={() => { salir(true, true); alGuardar?.(); }}>Guardar en «Mis montajes»</button>{/if}
          <!-- (another guide starts from the board before this one: «Salir» of the next guide brings that back) -->
          <button type="button" class="boton" onclick={() => { salir(); eligiendo = true; }}>Otro circuito</button>
          <button type="button" class="boton" onclick={() => salir(true)}>Seguir con esta placa</button>
        </div>
      </div>
    </div>
  {/if}
{/if}

{#if eligiendo && parte === 'banda'}
  <div class="velo" role="presentation" onclick={() => (eligiendo = false)}></div>
  <div class="elegir" role="dialog" aria-modal="true" aria-labelledby="elegir-titulo">
    <header>
      <h2 id="elegir-titulo">Monta este circuito</h2>
      <button type="button" class="salir" aria-label="Cerrar" onclick={() => (eligiendo = false)}><X size={20} /></button>
    </header>
    <p class="nota">Paso a paso: dónde va cada pieza y cada cable, por qué, y al final se simula para ver que funciona.{#if pb.guia} La guía actual se cerrará.{/if}</p>
    <ul>
      <li>
        <button type="button" class="opcion" data-guiado="leccion" onclick={() => { salir(); eligiendo = false; empezarLeccion(pb, planPorId('led')); inicio = performance.now(); }}>
          <span class="cero" aria-hidden="true">0</span>
          <span><b>La protoboard por dentro</b><small>Qué agujeros están unidos: tiras, canal central y carriles. Dos minutos, tocando la placa.</small></span>
        </button>
      </li>
      {#if libro && miniLibro}
        <li>
          <button type="button" class="opcion" data-guiado="libro" onclick={() => { salir(); empezarId('libro'); }}>
            <img src={miniLibro} alt="" />
            <span><b>Este circuito</b><small>{libro.titulo.replace(/^Protoboard · /, '')}: móntelo usted pieza a pieza.</small></span>
          </button>
        </li>
      {/if}
      {#each GUIADOS as g (g.id)}
        <li>
          <button type="button" class="opcion" data-guiado={g.id} onclick={() => { salir(); empezarId(g.id); }}>
            <img src={miniatura(g.id)} alt="" />
            <span><b>{g.titulo}</b><small>{g.resumen}</small></span>
          </button>
        </li>
      {/each}
    </ul>
  </div>
{/if}

<style>
  .guia {
    flex: none;
    padding: 8px 12px 10px;
    border-bottom: 1px solid var(--linea);
    background: linear-gradient(var(--ambar-tinte), var(--superficie));
    font-family: var(--sans);
  }
  .fila {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .progreso {
    display: flex;
    gap: 4px;
  }
  .punto {
    width: 18px;
    height: 6px;
    border-radius: 3px;
    background: var(--linea);
    transition: background 0.3s;
  }
  .punto.hecho {
    background: var(--c-ejemplo);
  }
  .punto.actual {
    background: var(--ambar-relleno);
  }
  .cuenta {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    color: var(--tinta-suave);
    font-size: 12.5px;
    font-weight: 600;
    white-space: nowrap;
    text-overflow: ellipsis;
  }
  .salir {
    display: grid;
    flex: none;
    place-items: center;
    width: 44px;
    height: 44px;
    border: 0;
    border-radius: 10px;
    background: var(--hover);
    color: var(--tinta);
  }
  .ahora {
    margin: 6px 0 0;
    color: var(--tinta);
    font-size: 16px;
    font-weight: 700;
    line-height: 1.3;
  }
  .boton.mini {
    min-height: 44px;
    padding: 0 14px;
  }
  .respuesta {
    position: absolute;
    left: 8px;
    right: 8px;
    bottom: 8px;
    z-index: 7;
    display: flex;
    align-items: center;
    gap: 10px;
    max-width: 680px;
    margin: 0 auto;
    padding: 10px 10px 10px 12px;
    border-radius: 14px;
    box-shadow: var(--sombra-alta);
    font-family: var(--sans);
    animation: aparece-abajo 0.25s ease-out;
  }
  @keyframes aparece-abajo {
    from {
      transform: translateY(12px);
      opacity: 0;
    }
  }
  .respuesta p {
    flex: 1;
    margin: 0;
    font-size: 14px;
    line-height: 1.4;
  }
  .respuesta.bien {
    border: 1px solid color-mix(in srgb, var(--c-ejemplo) 45%, transparent);
    background: color-mix(in srgb, var(--c-ejemplo) 10%, var(--superficie));
  }
  .respuesta.mal {
    border: 1px solid color-mix(in srgb, var(--c-precaucion) 45%, transparent);
    border-left: 5px solid var(--c-precaucion);
    background: color-mix(in srgb, var(--c-precaucion) 8%, var(--superficie));
    animation: sacude 0.35s ease-in-out;
  }
  .respuesta .cerrar {
    display: grid;
    flex: none;
    place-items: center;
    width: 44px;
    height: 44px;
    border: 0;
    border-radius: 50%;
    background: transparent;
    color: var(--tinta-suave);
  }
  .ok {
    display: grid;
    flex: none;
    place-items: center;
    width: 24px;
    height: 24px;
    border-radius: 50%;
    background: var(--c-ejemplo);
    color: #fff;
    animation: aparece 0.35s ease-out;
  }
  @keyframes aparece {
    from {
      transform: scale(0.4);
      opacity: 0;
    }
  }
  @keyframes sacude {
    25% {
      transform: translateX(-4px);
    }
    75% {
      transform: translateX(4px);
    }
  }
  .boton.suave {
    flex: none;
    min-height: 44px;
    padding: 0 8px;
    border-color: transparent;
    background: transparent;
    color: var(--acento);
    font-size: 13.5px;
  }
  @media (max-width: 520px) {
    .ahora {
      font-size: 14.5px;
    }
    .respuesta p {
      font-size: 13.5px;
    }
    .cuenta {
      font-size: 12px;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .ok,
    .respuesta {
      animation: none;
    }
  }

  /* ---------------------------------------------------------------- the end */
  .fiesta {
    position: absolute;
    inset: 0;
    z-index: 30;
    display: grid;
    place-items: center;
    padding: 16px;
    background: color-mix(in srgb, var(--scrim) 60%, transparent);
    font-family: var(--sans);
  }
  .tarjeta {
    position: relative;
    max-width: 420px;
    padding: 22px 22px 18px;
    border-radius: var(--radio-tarjeta);
    background: var(--superficie);
    box-shadow: var(--sombra-alta);
    text-align: center;
    animation: sube 0.4s cubic-bezier(0.2, 1.3, 0.5, 1);
  }
  @keyframes sube {
    from {
      transform: translateY(20px) scale(0.92);
      opacity: 0;
    }
  }
  .icono {
    display: inline-grid;
    place-items: center;
    width: 56px;
    height: 56px;
    margin: 0;
    border-radius: 50%;
    background: #ffe680;
    color: #8f5b08;
    box-shadow: 0 0 0 8px rgba(255, 230, 128, 0.35);
  }
  .tarjeta h2 {
    margin: 10px 0 4px;
    color: var(--titulos);
    font-size: 24px;
  }
  .tarjeta p {
    margin: 4px 0;
    font-size: 15px;
    line-height: 1.4;
  }
  .datos {
    color: var(--tinta-suave);
    font-size: 13px !important;
  }
  .botones {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 8px;
    margin-top: 14px;
  }
  .confeti {
    position: absolute;
    inset: 0;
    overflow: hidden;
    pointer-events: none;
  }
  .confeti i {
    position: absolute;
    top: -12px;
    left: calc(5% + var(--k) * 5.2%);
    width: 8px;
    height: 12px;
    border-radius: 2px;
    background: hsl(calc(var(--k) * 47deg) 80% 58%);
    animation: cae calc(1.6s + var(--k) * 0.07s) ease-in calc(var(--k) * 0.04s) both;
  }
  @keyframes cae {
    to {
      transform: translateY(110vh) rotate(calc(var(--k) * 70deg + 200deg));
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .confeti {
      display: none;
    }
    .tarjeta {
      animation: none;
    }
  }

  /* ---------------------------------------------------------------- the chooser */
  .velo {
    position: fixed;
    inset: 0;
    z-index: 70;
    background: var(--scrim);
  }
  .elegir {
    position: fixed;
    left: 50%;
    top: 50%;
    z-index: 71;
    width: min(520px, calc(100vw - 24px));
    max-height: calc(100dvh - 48px);
    overflow: auto;
    transform: translate(-50%, -50%);
    padding: 14px 16px 16px;
    border-radius: var(--radio-tarjeta);
    background: var(--superficie);
    box-shadow: var(--sombra-alta);
    font-family: var(--sans);
  }
  .elegir header {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .elegir h2 {
    flex: 1;
    margin: 0;
    color: var(--titulos);
    font-size: 20px;
  }
  .nota {
    margin: 6px 0 10px;
    color: var(--tinta-suave);
    font-size: 14px;
    line-height: 1.4;
  }
  .elegir ul {
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
    padding: 8px;
    border: 1px solid var(--linea);
    border-radius: var(--radio-tarjeta-p);
    background: var(--fondo);
    color: var(--tinta);
    font-family: var(--sans);
    text-align: left;
  }
  .opcion:hover {
    border-color: var(--acento-borde);
    box-shadow: var(--sombra);
  }
  .opcion img {
    flex: none;
    width: 104px;
    height: 64px;
    border-radius: 10px;
    background: #f4f2ec;
    object-fit: contain;
  }
  .cero {
    display: grid !important;
    flex: none;
    place-items: center;
    width: 104px;
    height: 64px;
    border-radius: 10px;
    background: var(--acento-tinte);
    color: var(--acento);
    font-size: 30px;
    font-weight: 700;
  }
  .opcion span {
    display: grid;
    gap: 2px;
    min-width: 0;
  }
  .opcion b {
    font-size: 15.5px;
  }
  .opcion small {
    color: var(--tinta-suave);
    font-size: 13px;
    line-height: 1.35;
  }
</style>
