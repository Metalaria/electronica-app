<script lang="ts" module>
  import type { Snippet } from 'svelte';
  import type { GuiaBrymen, GuiaFnirsi } from '../guia';

  /** What the lab panel controls on the bench around it (VistaBanco passes it to both). */
  export interface ControlLab {
    guiaBm: GuiaBrymen | null;
    guiaFn: GuiaFnirsi | null;
    pestana: 'brymen' | 'fnirsi';
    /** The step's compact bar, which the bench sticks to the bottom of the window on narrow screens. */
    barra: Snippet | null;
  }
</script>

<script lang="ts">
  // 1.1 «Laboratorio guiado» (#/instrumentos/laboratorio/<n>): one practice of printed chapter 21 done step by step
  // with the simulated instruments. Each step says what to do on the bench; «Comprobar» checks the instruments'
  // state and the typed reading against the simulation (laboratorio.ts evaluarPaso), with the hint of the first
  // mistake; «Mostrar dónde» lights the control on the instrument (a hint: half XP), «Hágalo por mí» does it (no XP).
  // Every step is a learning event (`respuesta`, origin `laboratorio`, id `cap22-lab<n>-<step>`: XP `pr:` once, like a
  // lesson card); the steps done and their readings are stored (lib/laboratorio.svelte.ts). The summary compares the
  // readings with the book's expected values (practicas.ts `comprobaciones`). Keyboard: every control is a native
  // button or input; the cursors, which the instrument only lets drag, have sliders here; the oscilloscope's screen
  // (a canvas) is read out in text under the step.
  import { onMount, tick, untrack } from 'svelte';
  import type { Banco } from '../banco.svelte.ts';
  import type { Practica } from './tipos';
  import type { Laboratorio, PasoLab, Veredicto } from './laboratorio';
  import { evaluarPaso, hacerPaso, idPaso, iniciarLaboratorio, pasoPendiente, prepararPaso, textoTolerancia } from './laboratorio';
  import { leer } from '../../../lib/magnitudes';
  import { formatoSI } from '../../grafica/formato.ts';
  import { prepararSalto } from '../../../lib/ruta.svelte';
  import { emitir } from '../../../lib/aprendizaje/eventos';
  import { registrarActividad } from '../../../lib/progreso-diario.svelte';
  import { anotarAyudaLaboratorio, anotarPasoLaboratorio, cargarLaboratorio, registroLab } from '../../../lib/laboratorio.svelte';
  import { pasoDaXp } from '../../../lib/laboratorio';
  import { cursorFrecuencia } from '../fnirsi/dibujo';
  import { FN_DMM_LISTA } from '../fnirsi/logica.svelte.ts';

  let { p, lab, b, control }: { p: Practica; lab: Laboratorio; b: Banco; control: ControlLab } = $props();

  const ids = $derived(lab.pasos.map((x) => x.id));
  const registro = $derived(registroLab(lab.n));
  const hechos = $derived(registro?.h ?? []);
  /** Step on screen; lab.pasos.length = the summary. */
  let actual = $state(0);
  let escrito = $state('');
  let veredicto = $state<Veredicto | null>(null);
  let guardando = $state(false);
  let errorGuardar = $state('');
  let aviso = $state('');
  /** This visit: attempts, hints shown, help used and rounds closed per step. */
  const visita = $state<Record<string, { intentos: number; guia: boolean; ayuda: boolean; cerrado: boolean }>>({});
  let titulo = $state<HTMLElement | null>(null);

  const paso = $derived<PasoLab | null>(lab.pasos[actual] ?? null);
  const v = (id: string) => (visita[id] ??= { intentos: 0, guia: false, ayuda: false, cerrado: false });

  // Review 11c: «Repetir el laboratorio» walks the steps again although they are all done; where that walk is goes to
  // sessionStorage (a per-tab convenience, like the editor's hand-over), so a reload continues it instead of jumping
  // back to the summary. Not progress: nothing of the lab's record changes.
  const CLAVE_REPASO = 'epa:laboratorio-repaso';
  let repitiendo = $state(false);
  function leerRepaso(): number | null {
    try {
      const o = JSON.parse(sessionStorage.getItem(CLAVE_REPASO) ?? 'null') as { n?: unknown; paso?: unknown } | null;
      return o && o.n === lab.n && Number.isInteger(o.paso) && (o.paso as number) >= 0 && (o.paso as number) < lab.pasos.length ? (o.paso as number) : null;
    } catch {
      return null;
    }
  }
  function guardarRepaso(paso: number | null) {
    try {
      if (paso === null) sessionStorage.removeItem(CLAVE_REPASO);
      else sessionStorage.setItem(CLAVE_REPASO, JSON.stringify({ n: lab.n, paso }));
    } catch {
      // (private mode or storage blocked: the walk just does not survive a reload)
    }
  }

  onMount(() => {
    void cargarLaboratorio().then(() =>
      untrack(() => {
        // resume at the first step not done (or where a repeat was), with the bench as the earlier steps left it
        const rep = leerRepaso();
        if (rep !== null) repitiendo = true;
        const k = rep ?? pasoPendiente(lab, registroLab(lab.n)?.h ?? []);
        if (k > 0) {
          for (let i = 0; i < Math.min(k, lab.pasos.length); i++) {
            const x = lab.pasos[i]!;
            prepararPaso(b, p, x);
            if (typeof x.hazlo !== 'function') hacerPaso(b, p, x);
          }
          aviso = k < lab.pasos.length ? `${rep !== null ? 'Repaso del laboratorio. ' : ''}Continúa en el paso ${k + 1}: el banco está como lo dejaron los pasos anteriores.` : '';
        }
        irA(k, false);
      }),
    );
  });

  function irA(i: number, enfocar = true) {
    actual = Math.max(0, Math.min(lab.pasos.length, i));
    escrito = '';
    veredicto = null;
    errorGuardar = '';
    control.guiaBm = null;
    control.guiaFn = null;
    if (repitiendo) {
      if (actual >= lab.pasos.length) repitiendo = false;
      guardarRepaso(repitiendo ? actual : null);
    }
    const x = lab.pasos[actual];
    if (x) {
      // (a repeat sets up each step again, as the first time: its variant, the supply)
      if (!hechos.includes(x.id) || repitiendo) prepararPaso(b, p, x);
      if (x.guia?.instrumento) control.pestana = x.guia.instrumento;
    }
    if (enfocar) void tick().then(() => titulo?.focus());
  }

  function mostrarDonde() {
    if (!paso) return;
    v(paso.id).guia = true;
    control.guiaBm = paso.guia?.bm ?? null;
    control.guiaFn = paso.guia?.fn ?? null;
    if (paso.guia?.instrumento) control.pestana = paso.guia.instrumento;
  }

  function cerrarRonda(x: PasoLab, correcta: boolean, intento: number, pistas: number) {
    const e = v(x.id);
    if (e.cerrado || hechos.includes(x.id)) return;
    const final = correcta || intento >= 2;
    emitir({ tipo: 'respuesta', id: idPaso(lab.n, x.id), clase: 'practica', origen: 'laboratorio', correcta, intento, pistas, final, parte: 'cap22', seccion: p.label, subtipo: 'laboratorio' });
    if (final) {
      e.cerrado = true;
      registrarActividad('pregunta');
    }
  }

  // Review 11c: a «Hágalo por mí» that places the cursors on the trace AND changes the time base (lab 5 «fase») is
  // computed first on the screen as it was (in seconds, laboratorios.ts), then once more on the first acquisition at
  // the new base, so the cursors sit on the crossings of the trace the reader then sees.
  let refinar = $state.raw<{ id: string; dt: number; desde: unknown } | null>(null);
  $effect(() => {
    const c = b.fnirsi.captura;
    const r = refinar;
    if (!r || !c || c === r.desde || !b.vigente || Math.abs(c.dt - r.dt) > 1e-6 * r.dt) return;
    untrack(() => {
      refinar = null;
      if (paso?.id === r.id && typeof paso.hazlo === 'function') aplicarCursores(paso);
    });
  });
  function aplicarCursores(x: PasoLab) {
    hacerPaso(b, p, x);
  }

  function hagalo() {
    if (!paso) return;
    const e = v(paso.id);
    const base = b.fnirsi.sDiv;
    const dtAntes = b.fnirsi.captura?.dt ?? 0;
    const desde = b.fnirsi.captura;
    hacerPaso(b, p, paso);
    refinar = typeof paso.hazlo === 'function' && b.fnirsi.sDiv !== base && dtAntes > 0 ? { id: paso.id, dt: (dtAntes * b.fnirsi.sDiv) / base, desde } : null;
    if (!e.ayuda) {
      e.ayuda = true;
      // done for the reader: the round closes without XP (as a lesson card answered with the solution)
      cerrarRonda(paso, false, Math.max(2, e.intentos + 1), 1);
    }
    // (review 11a: kept with the lab's record, so that neither a later visit nor another device gives this step XP)
    void anotarAyudaLaboratorio(lab.n, paso.id).catch(() => undefined);
    veredicto = null;
  }

  async function comprobar() {
    if (!paso) return;
    const x = paso;
    const r = evaluarPaso(x, b, escrito);
    veredicto = r;
    if (r.estado === 'espera') return;
    const e = v(x.id);
    e.intentos++;
    // (review 11a: a step «Hágalo por mí» did on this or another device closes its round without XP)
    if (!e.ayuda && !pasoDaXp(registroLab(lab.n), x.id)) {
      e.ayuda = true;
      cerrarRonda(x, false, Math.max(2, e.intentos), 1);
    }
    if (!e.ayuda) cerrarRonda(x, r.estado === 'bien', e.intentos, e.guia ? 1 : 0);
    if (r.estado !== 'bien' || hechos.includes(x.id)) return;
    const leida = x.lectura ? leer(escrito, x.lectura.unidad) : null;
    guardando = true;
    try {
      await anotarPasoLaboratorio(lab.n, x.id, leida && !('error' in leida) ? leida.valor : null, ids);
      errorGuardar = '';
    } catch {
      errorGuardar = 'No se ha podido guardar el avance en este dispositivo; se volverá a intentar.';
    } finally {
      guardando = false;
    }
  }

  // A check made while the bench was simulating a change waits for the new reading and runs again by itself.
  $effect(() => {
    void b.tic;
    if (veredicto?.estado === 'espera' && b.vigente) untrack(() => void comprobar());
  });

  function repetir() {
    repitiendo = true;
    iniciarLaboratorio(b, p, lab);
    for (const k of Object.keys(visita)) delete visita[k];
    aviso = 'El banco ha vuelto al principio. Lo que ya hizo sigue guardado.';
    irA(0);
  }

  // ---------------------------------------------------------------- the step's bar on narrow screens
  // Review 11c: on a phone the instruments are long; while the step's own buttons are out of view, a compact bar
  // stuck to the bottom of the window keeps the step, the reading and «Comprobar» at hand (and the hint of a failed
  // check), so the learner reads the step and works the instrument without scrolling back and forth. Wide screens
  // hide it (the step sits next to the instruments there).
  let acciones = $state<HTMLElement | null>(null);
  let accionesVisibles = $state(true);
  $effect(() => {
    const el = acciones;
    if (!el || typeof IntersectionObserver === 'undefined') {
      accionesVisibles = true;
      return;
    }
    const o = new IntersectionObserver((es) => (accionesVisibles = es.some((x) => x.isIntersecting)));
    o.observe(el);
    return () => o.disconnect();
  });
  $effect(() => {
    control.barra = barraPaso;
    return () => {
      if (control.barra === barraPaso) control.barra = null;
    };
  });
  const tituloPlano = $derived((paso?.titulo ?? '').replace(/<[^>]+>/g, ''));
  function verPaso() {
    titulo?.focus();
    titulo?.scrollIntoView({ block: 'start' });
  }

  // ---------------------------------------------------------------- the table of noted points (practice 9)
  let avisoTabla = $state('');
  function anotar() {
    if (!p.tabla) return;
    const r = p.tabla.anotar(b);
    if (typeof r === 'string') {
      avisoTabla = r;
      return;
    }
    avisoTabla = '';
    b.anotaciones = [...b.anotaciones, r];
  }

  // ---------------------------------------------------------------- the cursors by keyboard
  const lim = $derived(b.fnirsi.cursores === 'tension' && b.fnirsi.mates !== 'fft1' && b.fnirsi.mates !== 'fft2' ? 4 : 6);
  function moverCursor(cual: 'a' | 'b', valor: number) {
    const d = Math.max(-lim, Math.min(lim, Math.round(valor * 25) / 25));
    b.fnirsi.cur = { ...b.fnirsi.cur, [cual]: d };
  }
  function textoCursor(cual: 'a' | 'b'): string {
    const l = b.fnirsi.lecturaCursores();
    if (!l) return '';
    return formatoSI(cual === 'a' ? l.a : l.b, l.unidad, 4);
  }

  // ---------------------------------------------------------------- the oscilloscope's screen, in words
  const fmt = (x: number | null | undefined, u: string, c = 4) => (x === null || x === undefined || !Number.isFinite(x) ? '—' : formatoSI(x, u, c));
  const pantalla = $derived.by((): string[] => {
    void b.tic;
    const f = b.fnirsi;
    if (!f.encendido) return ['Apagado.'];
    if (f.modo === 'dmm') return [`Multímetro, ${FN_DMM_LISTA[f.fnDmm]?.nombre ?? ''}: ${f.textoDmm || '—'}`];
    if (f.modo === 'gen') return [`Generador: ${f.dds.forma}, ${fmt(f.dds.frecuencia, 'Hz')}, ${fmt(f.dds.amplitud, 'V', 3)}, salida ${f.dds.salida ? 'activada' : 'desactivada'}.`];
    const r: string[] = [];
    const fft = f.mates === 'fft1' || f.mates === 'fft2';
    f.canales.forEach((c, k) => {
      if (!c.on) return;
      let t = `CH${k + 1}: ${fmt(c.vDiv, 'V', 3)}/div, ${c.menuX10 ? '×10' : '×1'}, ${c.ac ? 'AC' : 'DC'}${c.invertir ? ', invertido' : ''}`;
      if (f.captura?.recortado[k]) t += ', la señal se sale de la pantalla';
      if (f.prm && !fft) {
        const m = f.medidas(k);
        if (m) t += `. Frec ${fmt(m.f, 'Hz')}, Vpp ${fmt(m.vpp, 'V')}, Vef ${fmt(m.vrms, 'V')}, Vmed ${fmt(m.vmedia, 'V')}, Vmáx ${fmt(m.vmax, 'V')}, Vmín ${fmt(m.vmin, 'V')}, ciclo ${m.ciclo === null ? '—' : `${m.ciclo.toFixed(1).replace('.', ',')} %`}`;
      }
      r.push(t + '.');
    });
    r.push(`Base de tiempos ${fmt(f.sDiv, 's', 3)}/div; disparo ${f.disparo.modo}, CH${f.disparo.fuente + 1}, flanco de ${f.disparo.subida ? 'subida' : 'bajada'}, nivel ${fmt(f.disparo.nivel, 'V', 3)}${f.run ? '' : ' (STOP)'}.`);
    if (fft) {
      const e = f.espectro();
      const nivel = (fr: number) => {
        if (!e) return '—';
        const k = Math.round(fr / (e.f[1]! - e.f[0]!));
        const d = e.db[Math.max(0, Math.min(e.db.length - 1, k))];
        return d === undefined ? '—' : `${d.toFixed(1).replace('.', ',')} dBV`;
      };
      r.push(`FFT de CH${f.mates === 'fft1' ? 1 : 2}, 10 dB/div.${f.cursores !== 'no' ? ` Cursor A: ${fmt(cursorFrecuencia(f, f.cur.a), 'Hz')} ${nivel(cursorFrecuencia(f, f.cur.a))}; B: ${fmt(cursorFrecuencia(f, f.cur.b), 'Hz')} ${nivel(cursorFrecuencia(f, f.cur.b))}.` : ''}`);
    } else if (f.cursores !== 'no') {
      const l = f.lecturaCursores();
      if (l) r.push(`Cursores de ${f.cursores === 'tiempo' ? 'tiempo' : 'tensión'}: A ${fmt(l.a, l.unidad)}, B ${fmt(l.b, l.unidad)}, Δ ${fmt(l.delta, l.unidad)}${l.inversa ? `, 1/Δt ${fmt(l.inversa, 'Hz')}` : ''}.`);
    }
    if (f.xy) r.push('Pantalla en X-Y.');
    return r;
  });

  // ---------------------------------------------------------------- summary
  const resumen = $derived(
    lab.pasos
      .filter((x) => x.lectura?.libro)
      .map((x) => {
        const c = p.comprobaciones.find((y) => y.id === x.lectura!.libro)!;
        const tol = c.tol.abs ?? Math.abs(c.esperado) * (c.tol.rel ?? 0.01);
        const suya = registro?.l[x.id]?.[0] ?? null;
        return { x, c, tol, suya, ok: suya === null ? null : Math.abs(suya - c.esperado) <= tol };
      }),
  );
  const dentro = $derived(resumen.filter((r) => r.ok).length);
  const siguiente = $derived(lab.n < 12 ? lab.n + 1 : null);

  function volverLibro() {
    prepararSalto({ texto: `Volver al laboratorio ${lab.n}` });
  }
</script>

{#snippet barraPaso()}
  {#if paso && !accionesVisibles}
    <div class="barra-paso" role="group" aria-label="Paso en curso" data-barra-paso>
      <button type="button" class="ir-paso" onclick={verPaso}>
        <span class="n">Paso {actual + 1} de {lab.pasos.length}</span> <span class="t">{tituloPlano}</span>
      </button>
      <div class="fila-barra">
        {#if paso.lectura}
          <input
            type="text"
            inputmode="decimal"
            autocomplete="off"
            aria-label={`Lectura: ${paso.lectura.que.replace(/<[^>]+>/g, '')}${paso.lectura.unidad ? ` (en ${paso.lectura.unidad})` : ''}`}
            placeholder={paso.lectura.unidad ? `Lectura (${paso.lectura.unidad})` : 'Lectura'}
            bind:value={escrito}
            onkeydown={(ev) => ev.key === 'Enter' && void comprobar()}
            data-lectura-barra
          />
        {/if}
        {#if veredicto?.estado === 'bien' || hechos.includes(paso.id)}
          <button type="button" class="primario" onclick={() => irA(actual + 1)} data-continuar-barra>{actual + 1 < lab.pasos.length ? 'Continuar' : 'Ver el resumen'}</button>
        {:else}
          <button type="button" class="primario" onclick={() => void comprobar()} disabled={guardando} data-comprobar-barra>Comprobar</button>
        {/if}
      </div>
      {#if veredicto && veredicto.estado !== 'bien'}
        <p class="pista-barra">{@html veredicto.pista}</p>
      {:else if veredicto?.estado === 'bien'}
        <p class="pista-barra bien">Correcto.</p>
      {/if}
    </div>
  {/if}
{/snippet}

<section class="lab" aria-labelledby="lab-titulo" data-laboratorio={lab.n}>
  <header>
    <p class="etiqueta">Laboratorio guiado · Práctica {lab.n}</p>
    <h2 id="lab-titulo">{p.titulo}</h2>
    <p class="objetivo">{@html p.objetivo}</p>
    <p class="enlaces">
      <a href={`#/cap22/${p.label}`} onclick={volverLibro}>Leer en el libro</a>
      <a href={`#/instrumentos/practica/${lab.n}`}>Práctica libre</a>
    </p>
  </header>

  <ol class="segmentos" aria-label="Pasos del laboratorio">
    {#each lab.pasos as x, i (x.id)}
      {@const hecho = hechos.includes(x.id)}
      <li>
        <button
          type="button"
          class="seg"
          class:hecho
          class:actual={i === actual}
          aria-current={i === actual ? 'step' : undefined}
          disabled={!hecho && i !== actual && i !== pasoPendiente(lab, hechos)}
          onclick={() => irA(i)}
          aria-label={`Paso ${i + 1}: ${x.titulo.replace(/<[^>]+>/g, '')}${hecho ? ', hecho' : ''}`}
        ></button>
      </li>
    {/each}
  </ol>
  {#if aviso}<p class="aviso" role="status">{aviso}</p>{/if}

  {#if paso}
    {@const e = visita[paso.id]}
    <article class="paso" data-paso={paso.id}>
      <p class="etiqueta">Paso {actual + 1} de {lab.pasos.length}{hechos.includes(paso.id) ? ' · hecho' : ''}</p>
      <h3 tabindex="-1" bind:this={titulo}>{@html paso.titulo}</h3>
      <p class="texto">{@html paso.texto}</p>

      {#if paso.cursores && b.fnirsi.cursores !== 'no'}
        <fieldset class="cursores">
          <legend>Cursores con el teclado (el instrumento solo deja arrastrarlos)</legend>
          {#each ['a', 'b'] as const as c (c)}
            <label>
              <span>Cursor {c.toUpperCase()} <output>{textoCursor(c)}</output></span>
              <input
                type="range"
                min={-lim}
                max={lim}
                step="0.04"
                value={b.fnirsi.cur[c]}
                aria-valuetext={`${textoCursor(c)} (${String(b.fnirsi.cur[c]).replace('.', ',')} divisiones)`}
                oninput={(ev) => moverCursor(c, Number((ev.currentTarget as HTMLInputElement).value))}
                data-cursor={c}
              />
            </label>
          {/each}
        </fieldset>
      {/if}

      {#if paso.tabla && p.tabla}
        <div class="tabla-lab">
          <button type="button" class="secundario" onclick={anotar} data-anotar>Anotar punto</button>
          {#if b.anotaciones.length}<button type="button" class="enlace" onclick={() => (b.anotaciones = [])}>Borrar la tabla</button>{/if}
          {#if avisoTabla}<p class="nota" role="status">{avisoTabla}</p>{/if}
          {#if b.anotaciones.length}
            <div class="envoltura">
              <table>
                <thead><tr>{#each p.tabla.columnas as c (c.id)}<th scope="col">{@html c.nombre}</th>{/each}</tr></thead>
                <tbody>
                  {#each [...b.anotaciones].sort((x, y) => (x.f ?? 0) - (y.f ?? 0)) as fila, i (i)}
                    <tr>{#each p.tabla.columnas as c (c.id)}<td>{fmt(fila[c.id], c.unidad)}</td>{/each}</tr>
                  {/each}
                </tbody>
              </table>
            </div>
          {/if}
        </div>
      {/if}

      {#if paso.lectura}
        <label class="campo-lectura">
          <span>¿Qué marca el instrumento? Escriba {@html paso.lectura.que}{paso.lectura.unidad ? ` (en ${paso.lectura.unidad})` : ''}</span>
          <input type="text" inputmode="decimal" autocomplete="off" bind:value={escrito} onkeydown={(ev) => ev.key === 'Enter' && void comprobar()} data-lectura />
        </label>
      {/if}

      <div class="acciones" bind:this={acciones}>
        <button type="button" class="primario" onclick={() => void comprobar()} disabled={guardando} data-comprobar>Comprobar</button>
        <button type="button" class="secundario" onclick={mostrarDonde} disabled={!paso.guia?.bm && !paso.guia?.fn} data-donde>Mostrar dónde</button>
        <button type="button" class="secundario" onclick={hagalo} data-hagalo>Hágalo por mí</button>
      </div>

      <div class="veredicto" aria-live="polite">
        {#if veredicto?.estado === 'bien'}
          <div class="banner bien" data-veredicto="bien">
            <strong>Correcto</strong>
            {#if paso.lectura && veredicto.lectura !== null}<p>El instrumento marca {fmt(veredicto.lectura, paso.lectura.unidad)}; se admite {textoTolerancia(paso.lectura)}.</p>{/if}
            {#if e?.ayuda}<p>Hecho con ayuda: este paso no da XP.</p>{/if}
          </div>
        {:else if veredicto}
          <div class="banner mal" data-veredicto={veredicto.estado}>
            <strong>{veredicto.estado === 'espera' ? 'Un momento' : 'Todavía no'}</strong>
            <p>{@html veredicto.pista}</p>
          </div>
        {/if}
        {#if errorGuardar}<p class="nota">{errorGuardar}</p>{/if}
      </div>
      {#if veredicto?.estado === 'bien' || hechos.includes(paso.id)}
        <button type="button" class="primario continuar" onclick={() => irA(actual + 1)} data-continuar>{actual + 1 < lab.pasos.length ? 'Continuar' : 'Ver el resumen'}</button>
      {/if}

      <details class="pantalla" open={paso.guia?.instrumento === 'fnirsi'}>
        <summary>Lo que muestra la pantalla del FNIRSI</summary>
        <ul>{#each pantalla as linea, i (i)}<li>{linea}</li>{/each}</ul>
      </details>
    </article>
  {:else}
    <article class="resumen" data-resumen>
      <p class="etiqueta">Resumen</p>
      <h3 tabindex="-1" bind:this={titulo}>{hechos.length >= lab.pasos.length ? 'Laboratorio completado' : 'Su avance'}</h3>
      {#if resumen.length}
        <p>{dentro} de {resumen.length} lecturas dentro de lo que espera el libro.</p>
        <div class="envoltura">
          <table>
            <thead><tr><th scope="col">Magnitud</th><th scope="col">Su lectura</th><th scope="col">El libro</th><th scope="col">¿Dentro?</th></tr></thead>
            <tbody>
              {#each resumen as r (r.x.id)}
                <tr data-id={r.c.id} class={r.ok === null ? '' : r.ok ? 'si' : 'no'}>
                  <td>{@html r.c.que}</td>
                  <td>{r.suya === null ? '—' : fmt(r.suya, r.c.unidad)}</td>
                  <td>{fmt(r.c.esperado, r.c.unidad)} ± {fmt(r.tol, r.c.unidad, 2)}<span class="cita">{@html r.c.libro}</span></td>
                  <td>{r.ok === null ? 'Sin lectura' : r.ok ? 'Sí' : 'No: la diferencia es el resultado interesante'}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {/if}
      <p class="leccion">{@html p.leccion}</p>
      <div class="acciones">
        {#if siguiente}<a class="boton-v11 primario" href={`#/instrumentos/laboratorio/${siguiente}`}>Laboratorio {siguiente}</a>{/if}
        <button type="button" class="secundario" onclick={repetir} data-repetir>Repetir el laboratorio</button>
        <a class="boton-v11 secundario" href={`#/cap22/${p.label}`} onclick={volverLibro}>Volver al libro</a>
      </div>
    </article>
  {/if}
</section>

<style>
  .lab {
    display: grid;
    /* the column may shrink below its content's width (360 px screens) */
    grid-template-columns: minmax(0, 1fr);
    gap: 14px;
    overflow-wrap: anywhere;
    color: var(--v11-tinta);
    font-family: var(--v11-texto);
    font-size: 15px;
    line-height: 1.5;
  }
  header {
    display: grid;
    gap: 4px;
  }
  .etiqueta {
    margin: 0;
    color: var(--v11-tinta-suave);
    font-size: 12.5px;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }
  h2,
  h3 {
    margin: 0;
    font-family: var(--v11-titular);
    color: var(--v11-tinta);
    line-height: 1.2;
  }
  h2 {
    font-size: 20px;
  }
  h3 {
    font-size: 18px;
  }
  /* the step's heading takes the focus at each step (tabindex -1, not a control): no ring (fix12, as app.css) */
  h3:focus,
  h3:focus-visible {
    outline: none;
  }
  .objetivo,
  .texto,
  .leccion {
    margin: 0;
  }
  .enlaces {
    display: flex;
    flex-wrap: wrap;
    gap: 4px 16px;
    margin: 0;
  }
  .enlaces a {
    display: inline-flex;
    align-items: center;
    min-height: 44px;
    color: var(--v11-azul);
    font-weight: 600;
  }
  .segmentos {
    display: flex;
    gap: 5px;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .segmentos li {
    flex: 1;
    display: flex;
  }
  .seg {
    flex: 1;
    min-height: 44px;
    padding: 0;
    border: 0;
    background: transparent;
    cursor: pointer;
    position: relative;
  }
  .seg::after {
    content: '';
    position: absolute;
    inset: 18px 0;
    border-radius: 4px;
    background: var(--v11-pendiente);
  }
  .seg.hecho::after {
    background: var(--v11-hecho);
  }
  .seg.actual::after {
    background: var(--v11-actual);
    inset: 16px 0;
  }
  .seg:disabled {
    cursor: default;
  }
  .seg:focus-visible {
    outline: 3px solid var(--v11-foco);
    outline-offset: 1px;
    border-radius: 6px;
  }
  .aviso,
  .nota {
    margin: 0;
    color: var(--v11-tinta-suave);
    font-size: 14px;
  }
  .paso,
  .resumen {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 12px;
    padding: 16px;
    border: 1px solid var(--v11-linea);
    border-radius: var(--v11-radio-tarjeta);
    background: var(--v11-fondo);
    box-shadow: var(--v11-sombra);
  }
  .cursores {
    display: grid;
    gap: 8px;
    min-width: 0;
    margin: 0;
    padding: 10px 12px;
    border: 1px solid var(--v11-linea);
    border-radius: var(--v11-radio-panel);
    background: var(--v11-panel);
  }
  .cursores legend {
    padding: 0 4px;
    color: var(--v11-tinta-suave);
    font-size: 13px;
  }
  .cursores label {
    display: grid;
    gap: 2px;
    font-size: 14px;
  }
  .cursores span {
    display: flex;
    justify-content: space-between;
    gap: 8px;
  }
  .cursores input {
    width: 100%;
    min-height: 44px;
    accent-color: var(--v11-azul);
  }
  /* (not «.lectura»: that is the reading pane's global class — estilos/lectura.css —, whose padding, size and width
     had indented the question, enlarged it and pushed the field past the card at 360 px; review 11c) */
  .campo-lectura {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 6px;
    font-weight: 600;
  }
  .campo-lectura input {
    box-sizing: border-box;
    width: 100%;
    min-width: 0;
    min-height: 48px;
    padding: 0 12px;
    border: 2px solid var(--v11-borde);
    border-radius: var(--v11-radio-opcion);
    background: var(--v11-fondo);
    color: var(--v11-tinta);
    font: 500 17px var(--v11-texto);
  }
  .campo-lectura input:focus-visible,
  .primario:focus-visible,
  .secundario:focus-visible,
  .enlace:focus-visible,
  .enlaces a:focus-visible {
    outline: 3px solid var(--v11-foco);
    outline-offset: 2px;
  }
  .acciones {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .primario,
  .secundario {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 48px;
    padding: 0 18px;
    border-radius: var(--v11-radio-boton);
    font: 600 16px var(--v11-texto);
    text-decoration: none;
    cursor: pointer;
  }
  .primario {
    border: 0;
    background: var(--v11-azul);
    color: var(--v11-sobre-azul);
  }
  .primario:hover:not(:disabled) {
    background: var(--v11-azul-hover);
  }
  .primario:disabled {
    background: var(--v11-inactivo);
    color: var(--v11-sobre-inactivo);
  }
  .secundario {
    border: 2px solid var(--v11-borde);
    background: var(--v11-fondo);
    color: var(--v11-tinta);
  }
  .secundario:disabled {
    color: var(--v11-sobre-inactivo);
    border-color: var(--v11-linea);
    cursor: default;
  }
  .continuar {
    width: 100%;
  }
  .enlace {
    min-height: 44px;
    border: 0;
    background: none;
    color: var(--v11-azul);
    font: 600 14px var(--v11-texto);
    text-decoration: underline;
    cursor: pointer;
  }
  .banner {
    display: grid;
    gap: 4px;
    padding: 12px 14px;
    border-radius: 14px;
    font-size: 14.5px;
  }
  .banner p {
    margin: 0;
  }
  .banner.bien {
    background: var(--v11-bien-tinte);
    color: var(--v11-bien-texto);
  }
  .banner.mal {
    background: var(--v11-mal-tinte);
    color: var(--v11-mal-texto);
  }
  .pantalla {
    border-top: 1px solid var(--v11-linea);
    padding-top: 8px;
    font-size: 14px;
  }
  .pantalla summary {
    min-height: 44px;
    display: flex;
    align-items: center;
    color: var(--v11-tinta);
    font-weight: 600;
    cursor: pointer;
  }
  .pantalla ul {
    margin: 4px 0 0;
    padding-left: 18px;
    color: var(--v11-tinta);
  }
  /* (not «.tabla»: the reading pane's global class adds a 1,5 em margin) */
  .tabla-lab {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
  }
  .envoltura {
    width: 100%;
    overflow-x: auto;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 14px;
  }
  th,
  td {
    padding: 6px 8px;
    border-bottom: 1px solid var(--v11-linea);
    text-align: left;
    vertical-align: top;
  }
  th {
    color: var(--v11-tinta-suave);
    font-weight: 600;
  }
  tr.si td:last-child {
    color: var(--v11-bien-texto);
    font-weight: 600;
  }
  tr.no td:last-child {
    color: var(--v11-mal-texto);
    font-weight: 600;
  }
  .cita {
    display: block;
    color: var(--v11-tinta-suave);
    font-size: 13px;
  }
  .barra-paso {
    position: sticky;
    bottom: var(--hueco-inferior, 0px);
    z-index: 6;
    display: grid;
    gap: 6px;
    margin: 0 -4px;
    padding: 8px 12px 10px;
    border: 1px solid var(--v11-linea);
    border-radius: var(--v11-radio-panel);
    background: var(--v11-fondo);
    box-shadow: var(--v11-sombra);
    color: var(--v11-tinta);
    font-family: var(--v11-texto);
    font-size: 14px;
    line-height: 1.4;
  }
  /* the keyboard is up: the tab bar is hidden (Pestanas.svelte), the bar goes down to the keyboard */
  :global(html:has(input:not([type='range'], [type='checkbox'], [type='radio'], [type='button']):focus, textarea:focus)) .barra-paso {
    bottom: 0;
  }
  .ir-paso {
    display: flex;
    gap: 6px;
    align-items: center;
    min-height: 44px;
    min-width: 0;
    padding: 0;
    border: 0;
    background: none;
    color: var(--v11-tinta);
    font: 600 14.5px var(--v11-texto);
    text-align: left;
    cursor: pointer;
  }
  .ir-paso .n {
    flex: none;
    color: var(--v11-azul);
  }
  .ir-paso .t {
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }
  .ir-paso:focus-visible {
    outline: 3px solid var(--v11-foco);
    outline-offset: 2px;
    border-radius: 6px;
  }
  .fila-barra {
    display: flex;
    gap: 8px;
  }
  .fila-barra input {
    box-sizing: border-box;
    flex: 1 1 0;
    width: 100%;
    min-width: 0;
    min-height: 44px;
    padding: 0 10px;
    border: 2px solid var(--v11-borde);
    border-radius: var(--v11-radio-opcion);
    background: var(--v11-fondo);
    color: var(--v11-tinta);
    font: 500 16px var(--v11-texto);
  }
  .fila-barra input:focus-visible {
    outline: 3px solid var(--v11-foco);
    outline-offset: 2px;
  }
  .fila-barra .primario {
    flex: 0 0 auto;
    min-height: 44px;
  }
  .fila-barra .primario:only-child {
    flex: 1 1 auto;
  }
  .pista-barra {
    max-height: 4.2em;
    margin: 0;
    overflow-y: auto;
    color: var(--v11-mal-texto);
  }
  .pista-barra.bien {
    color: var(--v11-bien-texto);
    font-weight: 600;
  }
  /* wide screens: the step sits next to the instruments, no bar */
  @container (min-width: 940px) {
    .barra-paso {
      display: none;
    }
  }
  @media (prefers-reduced-motion: no-preference) {
    .seg::after {
      transition: background 0.3s;
    }
  }
</style>
