<script lang="ts">
  // «Práctica inteligente» (0.11, group B; #/practicar, #/practicar/<parte>, #/practicar/<parte>/<seccion>): about
  // ten items chosen for the reader by lib/aprendizaje/seleccion.ts — weak and decaying concepts first, a little
  // review of what is mastered, some new material of the current course in order — with every kind of item the app
  // has: «Aprender haciendo» practice, Repaso questions, self-checked exercises, due glossary flashcards and (1.1) the
  // predictions, questions and challenges of the hand-authored lessons (leccion11/TarjetaPractica.svelte). One per
  // screen with the usual components (they emit the learning events: XP, mastery). The end screen says what
  // improved: each concept's mastery before and after.
  import { onMount, untrack } from 'svelte';
  import ArrowRight from '@lucide/svelte/icons/arrow-right';
  import Brain from '@lucide/svelte/icons/brain';
  import Check from '@lucide/svelte/icons/check';
  import { app } from '../../lib/estado.svelte';
  import { tonoBloque } from '../../lib/color';
  import { rotuloParte } from '../../lib/datos';
  import { registrarActividad } from '../../lib/progreso-diario.svelte';
  import { escuchar } from '../../lib/aprendizaje/eventos';
  import { cargarDominio, dominioDe, esperarDominio, instantanea } from '../../lib/aprendizaje/dominio.svelte';
  import { NOMBRE_NIVEL_DOMINIO, nivelDominio, porcentaje } from '../../lib/aprendizaje/dominio';
  import { cargarProgresoXp, xpDesde } from '../../lib/aprendizaje/progreso.svelte';
  import { cargarRepaso, registrarRespuesta } from '../repaso/estado.svelte';
  import type { Calificacion } from '../repaso/srs';
  import Practica, { type RespuestaPractica } from '../practica/Practica.svelte';
  import Pregunta, { referenciaDe, type Respuesta } from '../pregunta/Pregunta.svelte';
  import CabeceraPasos from '../pregunta/CabeceraPasos.svelte';
  import PieAcciones from '../pregunta/PieAcciones.svelte';
  import TarjetaEjercicio from '../aprender/TarjetaEjercicio.svelte';
  import MedidorDominio from '../dominio/MedidorDominio.svelte';
  import TarjetaSesion from './TarjetaSesion.svelte';
  import TarjetaPractica from '../leccion11/TarjetaPractica.svelte';
  import { NOMBRE_MOTIVO, prepararSesion, tituloConcepto, type Sesion } from './sesion';

  let { alcance = '' }: { alcance?: string } = $props();

  interface Resultado {
    bien: boolean;
    /** Right at the first attempt without help. */
    primera: boolean;
    saltado?: boolean;
  }

  let fase = $state<'preparando' | 'intro' | 'items' | 'fin' | 'vacio' | 'error'>('preparando');
  let sesion = $state.raw<Sesion | null>(null);
  let k = $state(0);
  let resultados = $state<(Resultado | null)[]>([]);
  let finalP = $state(false);
  let error = $state('');
  let titulo: HTMLElement | undefined = $state();
  let inicio = $state(Date.now());
  let antes = $state<Record<string, number>>({});
  let despues = $state<Record<string, number> | null>(null);

  const item = $derived(fase === 'items' && sesion ? (sesion.items[k] ?? null) : null);
  const n = $derived(sesion?.items.length ?? 0);
  const res = $derived(resultados[k] ?? null);
  const listo = $derived(!!res || (item?.tipo === 'practica' && finalP));
  const tono = $derived(tonoBloque(app.indice?.partes[item?.parte ?? sesion?.alcance?.parte ?? '']?.color, app.tema));
  const enfoque = $derived(sesion?.alcance ? (sesion.alcance.label ? tituloConcepto(`${sesion.alcance.parte}/${sesion.alcance.label}`) : rotuloParte(sesion.alcance.parte)) : '');
  const cuentas = $derived.by(() => {
    const r: Record<string, number> = {};
    for (const it of sesion?.items ?? []) r[it.motivo] = (r[it.motivo] ?? 0) + 1;
    return r;
  });
  const conceptosIntro = $derived.by(() => {
    const vistos = new Map<string, { clave: string; motivo: string; n: number }>();
    for (const it of sesion?.items ?? []) {
      const v = vistos.get(it.concepto);
      if (v) v.n++;
      else vistos.set(it.concepto, { clave: it.concepto, motivo: it.motivo, n: 1 });
    }
    // by why they are there: weakest first, as the plan chose them (the items themselves start with a warm-up)
    const PESO: Record<string, number> = { foco: 0, debil: 1, repasar: 2, nuevo: 3, dominado: 4 };
    return [...vistos.values()].sort((a, b) => (PESO[a.motivo] ?? 9) - (PESO[b.motivo] ?? 9));
  });

  const CUENTA_MOTIVO: Record<string, [string, string]> = {
    debil: ['para reforzar', 'para reforzar'],
    repasar: ['para repasar', 'para repasar'],
    foco: ['de esta sección', 'de esta sección'],
    nuevo: ['nuevo', 'nuevos'],
    dominado: ['repaso rápido', 'repasos rápidos'],
  };

  function semilla(): number {
    const w = window as unknown as { __epaSemillaPractica?: number };
    return (w.__epaSemillaPractica ?? Date.now()) >>> 0;
  }

  async function preparar() {
    fase = 'preparando';
    error = '';
    try {
      const s = await prepararSesion(untrack(() => alcance), semilla());
      sesion = s;
      resultados = s.items.map(() => null);
      k = 0;
      despues = null;
      fase = s.items.length ? 'intro' : 'vacio';
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
      fase = 'error';
    }
  }

  /**
   * The second tap of a quick double tap (`detail` 2) lands on whatever the first one put under the finger — the
   * next item's «Saltar», or an option of the first question — and is ignored (as the lesson's «Continuar»).
   */
  const repetido = (e?: MouseEvent) => !!e && e.detail > 1;
  let raiz: HTMLElement | undefined = $state();
  // ...also when it lands on another control (an option of the question that «Empezar» or «Continuar» just put
  // there): a repeated click on a different element than the previous click is dropped before it reaches it.
  $effect(() => {
    const el = raiz;
    if (!el) return;
    const control = (t: EventTarget | null) => (t instanceof Element ? (t.closest('button, a, input, select, textarea, label, [role]') ?? t) : t);
    let previo: EventTarget | null = null;
    const filtrar = (e: MouseEvent) => {
      const c = control(e.target);
      if (e.detail > 1 && previo && c !== previo) {
        e.stopPropagation();
        e.preventDefault();
        return;
      }
      previo = c;
    };
    el.addEventListener('click', filtrar, true);
    return () => el.removeEventListener('click', filtrar, true);
  });

  function empezar(e?: MouseEvent) {
    if (!sesion || repetido(e)) return;
    antes = instantanea(sesion.conceptos);
    inicio = Date.now();
    fase = 'items';
    arriba();
  }

  function arriba() {
    window.scrollTo({ top: 0, behavior: 'instant' });
    queueMicrotask(() => titulo?.focus({ preventScroll: true }));
  }

  function anotar(r: Resultado) {
    if (resultados[k]) {
      // a later right check of an exercise makes it solved (not «at the first attempt»)
      if (r.bien && !resultados[k]!.bien) resultados[k] = { ...resultados[k]!, bien: true };
      return;
    }
    resultados[k] = r;
  }

  function responderPractica(r: RespuestaPractica) {
    anotar({ bien: r.bien, primera: r.bien && r.intentos === 1 });
    // a practice item counts for the daily goal as a Repaso answer (as in Repaso's «Practicar»)
    registrarActividad('pregunta');
  }

  function responderPregunta(r: Respuesta) {
    const it = item;
    anotar({ bien: r.bien, primera: r.bien });
    // the same bookkeeping as the Repaso quizzes: daily goal, «Repasar fallos»
    if (it?.pregunta) registrarRespuesta(it.pregunta.id, it.parte, r.bien);
  }

  function responderTarjeta(c: Calificacion) {
    anotar({ bien: c > 1, primera: c >= 3 });
  }

  function responderLeccion11(r: { bien: boolean; primera: boolean }) {
    // a lesson card counts for the daily goal as the lesson's own answers do (once per item)
    if (!resultados[k]) registrarActividad('pregunta');
    anotar(r);
  }

  // a self-checked exercise reports its checks as learning events: the first one is the session's answer
  $effect(() => {
    const it = item;
    if (!it || it.tipo !== 'ejercicio') return;
    return escuchar((e) => {
      if (e.tipo !== 'respuesta' || e.clase !== 'ejercicio' || e.id !== it.id) return;
      untrack(() => anotar({ bien: e.correcta, primera: e.correcta && e.pistas === 0 }));
    });
  });

  function saltar(e?: MouseEvent) {
    if (repetido(e)) return;
    if (!resultados[k]) resultados[k] = { bien: false, primera: false, saltado: true };
    siguiente();
  }

  function siguiente(e?: MouseEvent) {
    if (repetido(e)) return;
    finalP = false;
    if (k + 1 < n) {
      k++;
      arriba();
    } else terminar();
  }

  async function terminar() {
    const s = sesion;
    fase = 'fin';
    arriba();
    try {
      await esperarDominio();
    } catch (e) {
      // the summary never stays on «Calculando…»: it shows what the records have
      console.warn('No se pudo esperar al dominio', e);
    }
    // (another session may have started meanwhile)
    if (s && sesion === s && fase === 'fin') despues = instantanea(s.conceptos);
  }

  const aciertos = $derived(resultados.filter((r) => r?.primera).length);
  const resueltos = $derived(resultados.filter((r) => r?.bien).length);
  const respondidos = $derived(resultados.filter((r) => r && !r.saltado).length);
  const xp = $derived(fase === 'fin' ? xpDesde(inicio) : 0);
  const mejoras = $derived.by(() => {
    if (!sesion || !despues) return [];
    return sesion.conceptos
      .map((c) => ({ clave: c, antes: antes[c] ?? 0, despues: despues![c] ?? 0, d: dominioDe(c) }))
      // a concept still without evidence (all its items skipped) has nothing to say
      .filter((m) => m.antes > 0 || m.despues > 0)
      .sort((a, b) => b.despues - b.antes - (a.despues - a.antes));
  });
  const subieron = $derived(mejoras.filter((m) => m.despues - m.antes > 0.005).length);

  onMount(() => {
    void cargarDominio();
    void cargarProgresoXp();
    void cargarRepaso();
    void preparar();
  });
</script>

<svelte:head><title>Práctica inteligente · Electrónica Práctica Avanzada</title></svelte:head>

<div class="practicar" bind:this={raiz} data-sesion data-fase={fase} data-alcance={alcance} style:--bloque={tono.relleno} style:--sobre-bloque={tono.sobre} style:--c09={tono.relleno} style:--sobre09={tono.sobre}>
  {#if fase === 'preparando'}
    <div class="cargando" aria-live="polite"><span class="punto"></span> Eligiendo los ejercicios…</div>
  {:else if fase === 'error'}
    <section class="t09-tarjeta t09-grande intro">
      <h1 bind:this={titulo} tabindex="-1">No se pudo preparar la práctica</h1>
      <p class="error" role="alert">{error}</p>
      <div class="botones"><button type="button" class="t09-boton" onclick={preparar}>Reintentar</button></div>
    </section>
  {:else if fase === 'vacio'}
    <section class="t09-tarjeta t09-grande intro" data-sesion-vacia>
      <h1 bind:this={titulo} tabindex="-1">Nada que practicar aquí</h1>
      {#if sesion?.incompleta}
        <p class="aviso-red" role="alert">Sin conexión no se han podido cargar los ejercicios. Compruebe la conexión y vuelva a intentarlo.</p>
      {:else}
        <p>{enfoque ? `${enfoque} no tiene prácticas ni preguntas que se puedan responder en la aplicación.` : 'No hay ejercicios disponibles ahora mismo.'}</p>
      {/if}
      {#if sesion?.incompleta}<div class="botones"><button type="button" class="t09-boton" onclick={preparar}>Reintentar</button></div>{/if}
      <div class="botones"><a class="t09-boton" href="#/practicar">Práctica para mí</a><a class="enlace" href="#/">Volver al inicio</a></div>
    </section>
  {:else if fase === 'intro' && sesion}
    <section class="t09-tarjeta t09-grande t09-banda intro" data-intro-sesion>
      <span class="icono" aria-hidden="true"><Brain size={30} /></span>
      <h1 bind:this={titulo} tabindex="-1">{enfoque ? `Practicar ${enfoque}` : 'Práctica inteligente'}</h1>
      <p>
        {#if !enfoque && cuentas.nuevo === n}
          {n} {n === 1 ? 'ejercicio' : 'ejercicios'} para empezar su curso por el principio. Según responda, las próximas prácticas volverán sobre lo que más
          le cueste y lo que empiece a olvidar.
        {:else}
          {n} {n === 1 ? 'ejercicio elegido' : 'ejercicios elegidos'} para usted{#if !enfoque}: primero lo que más le cuesta y lo que empieza a olvidar,
            un poco de repaso de lo que domina y algo nuevo de su curso{/if}.
        {/if}
      </p>
      {#if sesion.incompleta}
        <!-- offline: some of the chapter's exercises did not come (0.11 final QA) -->
        <div class="aviso-red" role="alert" data-sesion-incompleta>
          <p>Sin conexión no se han podido cargar todos los ejercicios: esta sesión tiene menos de los que tendría.</p>
          <button type="button" class="enlace toque-44" onclick={preparar}>Reintentar</button>
        </div>
      {/if}
      <ul class="motivos" aria-label="Qué hay en la sesión">
        {#each ['debil', 'repasar', 'foco', 'nuevo', 'dominado'] as m (m)}
          {#if cuentas[m]}<li data-motivo={m}><strong>{cuentas[m]}</strong> {CUENTA_MOTIVO[m]![cuentas[m] === 1 ? 0 : 1]}</li>{/if}
        {/each}
      </ul>
      <ul class="conceptos">
        {#each conceptosIntro as c (c.clave)}
          {@const d = dominioDe(c.clave)}
          <li data-concepto={c.clave}>
            <MedidorDominio nivel={d.nivel} valor={d.valor} repasar={d.repasar} />
            <span class="nom">{tituloConcepto(c.clave)}</span>
            <span class="por">{NOMBRE_MOTIVO[c.motivo as keyof typeof NOMBRE_MOTIVO]}</span>
          </li>
        {/each}
      </ul>
      <div class="botones">
        <button type="button" class="t09-boton" onclick={empezar} data-empezar-sesion>Empezar <ArrowRight size={20} aria-hidden="true" /></button>
        <a class="enlace" href="#/progreso/dominio">Ver su dominio</a>
      </div>
    </section>
  {:else if fase === 'items' && item}
    <div class="juego">
      <CabeceraPasos
        total={n}
        actual={k}
        contexto={enfoque ? `Practicar ${enfoque}` : 'Práctica inteligente'}
        descripcion={`Ejercicio ${k + 1} de ${n}`}
        cerrar={() => (location.hash = '#/')}
        etiquetaCerrar="Salir de la práctica"
      />
      <div class="cuerpo" data-item={item.id} data-item-tipo={item.tipo} data-motivo={item.motivo} data-concepto={item.concepto}>
        <h1 class="solo-lector" bind:this={titulo} tabindex="-1">Ejercicio {k + 1} de {n}</h1>
        <p class="por-que"><span class="chip">{NOMBRE_MOTIVO[item.motivo]}</span> <span class="donde">{rotuloParte(item.parte)} · {item.titulo}</span></p>
        {#key k}
          {#if item.practica}
            <Practica item={item.practica} origen="inteligente" respuesta={null} onresponder={responderPractica} bind:final={finalP} />
          {:else if item.pregunta}
            <Pregunta pregunta={item.pregunta} parte={item.parte} orden={item.orden} respuesta={null} onresponder={responderPregunta} origen="inteligente" etiqueta="Pregunta de repaso" />
          {:else if item.tipo === 'ejercicio'}
            <TarjetaEjercicio label={item.id} />
          {:else if item.tarjeta}
            <TarjetaSesion tarjeta={item.tarjeta} onresponder={responderTarjeta} />
          {:else if item.leccion11}
            <TarjetaPractica leccion={item.leccion11.leccion} k={item.leccion11.k} prefijo={`ps11-${k}`} onresponder={responderLeccion11} />
          {/if}
        {/key}
      </div>
      <PieAcciones>
        {#if item.pregunta && res}
          {@const ref = referenciaDe(item.pregunta, item.parte)}
          <a class="accion" href={ref.href}>{ref.ver}</a>
        {:else if !listo}
          <button type="button" class="accion corta" onclick={saltar} data-saltar>Saltar</button>
        {/if}
        <button type="button" class="accion primaria" onclick={siguiente} disabled={!listo} data-continuar>
          {k + 1 < n ? 'Continuar' : 'Ver el resultado'}
          <ArrowRight size={20} strokeWidth={2.2} aria-hidden="true" />
        </button>
      </PieAcciones>
    </div>
  {:else if fase === 'fin' && sesion}
    <section class="fin" data-fin-sesion data-aciertos={aciertos} data-subieron={subieron}>
      <span class="sello" aria-hidden="true"><Check size={34} strokeWidth={3} /></span>
      <h1 bind:this={titulo} tabindex="-1">Práctica terminada</h1>
      <ul class="cifras">
        <li><strong>{aciertos} de {n}</strong> a la primera</li>
        {#if resueltos > aciertos}<li><strong>{resueltos}</strong> {resueltos === 1 ? 'resuelto' : 'resueltos'} en total</li>{/if}
        {#if xp}<li class="xp" data-xp-sesion={xp}><strong>+{xp}</strong> XP</li>{/if}
      </ul>
      {#if respondidos}
        <h2>Lo que ha mejorado</h2>
        {#if !despues}
          <p class="nota">Calculando su dominio…</p>
        {:else}
          <ul class="mejoras">
            {#each mejoras as m (m.clave)}
              {@const delta = m.despues - m.antes}
              <li data-mejora={m.clave} data-delta={delta.toFixed(3)}>
                <MedidorDominio nivel={m.d.nivel} valor={m.d.valor} repasar={m.d.repasar} />
                <span class="nom">{tituloConcepto(m.clave)}</span>
                <span class="cambio" class:sube={delta > 0.005} class:baja={delta < -0.005}>
                  {porcentaje(m.antes)} → {porcentaje(m.despues)}
                  {#if nivelDominio(m.antes, m.antes > 0) !== m.d.nivel && delta > 0.005}<span class="nivel">· {NOMBRE_NIVEL_DOMINIO[m.d.nivel].toLowerCase()}</span>{/if}
                </span>
              </li>
            {/each}
          </ul>
          <p class="nota">
            {subieron ? `Ha mejorado en ${subieron === 1 ? 'un concepto' : `${subieron} conceptos`}.` : 'Su dominio se mantiene: los fallos de hoy son lo que la próxima práctica le traerá de nuevo.'}
            El dominio se calcula con sus aciertos a la primera, los repasos espaciados y lo que se olvida con el tiempo.
          </p>
        {/if}
      {/if}
      <div class="botones">
        <button type="button" class="t09-boton" onclick={preparar} data-otra-sesion>Otra práctica</button>
        <a class="t09-boton t09-contorno" href="#/progreso/dominio" data-ver-dominio>Ver su dominio</a>
        <a class="enlace" href="#/">Volver al inicio</a>
      </div>
    </section>
  {/if}
</div>

<style>
  .practicar {
    max-width: 640px;
    margin: 0 auto;
    padding: 24px 24px 64px;
    font-family: var(--sans);
  }
  @media (max-width: 600px) {
    .practicar {
      padding: 16px 16px 48px;
    }
  }
  .practicar[data-fase='items'] {
    padding-top: 0;
    padding-bottom: 0;
  }
  .juego {
    --pad-pie: 0px;
    --pie-abajo: var(--hueco-inferior);
  }
  .cuerpo {
    display: flex;
    flex-direction: column;
    gap: 14px;
    padding: 20px 0 28px;
  }
  h1 {
    margin: 0;
    color: var(--titulos);
    font-family: var(--titular);
    font-size: clamp(24px, 3.4vw, 30px);
    line-height: 1.2;
  }
  h1:focus {
    outline: none;
  }
  h2 {
    margin: 12px 0 0;
    color: var(--titulos);
    font-size: 18px;
  }
  .intro {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .intro p {
    margin: 0;
    color: var(--tinta);
    font-size: 16.5px;
    line-height: 1.5;
  }
  .icono {
    display: grid;
    place-items: center;
    width: 56px;
    height: 56px;
    border-radius: 16px;
    background: var(--acento-tinte);
    color: var(--acento);
  }
  .motivos {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .motivos li {
    padding: 4px 12px;
    border-radius: 999px;
    background: var(--superficie-2);
    color: var(--tinta-suave);
    font-size: 14.5px;
  }
  .motivos strong {
    color: var(--tinta);
  }
  .conceptos,
  .mejoras {
    display: flex;
    flex-direction: column;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .conceptos li,
  .mejoras li {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 4px 10px;
    padding: 9px 0;
    border-top: 1px solid var(--linea-suave);
    font-size: 15px;
  }
  .nom {
    flex: 1 1 12em;
    min-width: 0;
    color: var(--tinta);
  }
  .por,
  .cambio {
    color: var(--tinta-suave);
    font-size: 14px;
    white-space: nowrap;
  }
  .cambio {
    font-variant-numeric: tabular-nums;
  }
  .cambio.sube {
    color: color-mix(in srgb, var(--c-ejemplo) 72%, var(--tinta));
    font-weight: 700;
  }
  .cambio.baja {
    color: color-mix(in srgb, var(--c-precaucion) 72%, var(--tinta));
  }
  .nivel {
    font-weight: 600;
  }
  .por-que {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px 10px;
    margin: 0;
    font-size: 14px;
  }
  .chip {
    padding: 3px 10px;
    border-radius: 999px;
    background: var(--acento-tinte);
    color: var(--acento);
    font-weight: 700;
  }
  :global(:root[data-tema='oscuro']) .chip {
    color: var(--titulos);
  }
  .donde {
    color: var(--tinta-suave);
  }
  .botones {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 10px 16px;
    margin-top: 6px;
  }
  .enlace {
    display: inline-flex;
    align-items: center;
    min-height: 44px;
    color: var(--acento);
    font-weight: 600;
  }
  .error {
    color: color-mix(in srgb, var(--c-precaucion) 75%, var(--tinta));
  }
  .aviso-red {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 4px 12px;
    margin: 0 0 12px;
    padding: 8px 12px;
    border-left: 4px solid var(--c-precaucion);
    border-radius: 8px;
    background: var(--fondo);
    color: color-mix(in srgb, var(--c-precaucion) 75%, var(--tinta));
  }
  .aviso-red p {
    margin: 0;
  }
  .fin {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .fin .sello {
    display: grid;
    place-items: center;
    width: 68px;
    height: 68px;
    border-radius: 50%;
    background: var(--bloque, var(--acento));
    color: var(--sobre-bloque, var(--sobre-acento));
  }
  .cifras {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .cifras li {
    padding: 8px 14px;
    border-radius: 999px;
    background: var(--superficie-2);
    color: var(--tinta-suave);
    font-size: 15px;
  }
  .cifras strong {
    color: var(--tinta);
  }
  .cifras .xp strong {
    color: color-mix(in srgb, var(--ambar) 85%, var(--tinta));
  }
  .nota {
    margin: 0;
    color: var(--tinta-suave);
    font-size: 14.5px;
    line-height: 1.5;
  }
  .cargando {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    padding: 30vh 20px;
    color: var(--tinta-suave);
  }
  .punto {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: var(--acento);
    animation: latido 1s ease-in-out infinite;
  }
  @keyframes latido {
    50% {
      opacity: 0.25;
      transform: scale(0.7);
    }
  }
</style>
