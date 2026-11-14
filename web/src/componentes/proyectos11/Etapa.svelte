<script lang="ts">
  // 1.1 «Proyectos por etapas»: one stage (#/etapas/<parte>/<n>). The stage's circuit is a saved circuit of «Mis
  // circuitos» (circuito.ts) that the reader designs here — one field per design value, written into the drawing — or in
  // the editor («Abrir en el editor»: any change of values or parts); «Comprobar» simulates that drawing with the stage's
  // measurements (lib/proyectos11/comprobar.ts) and lists each condition of the book's specification with what was
  // measured and, when it fails, what to change. Each simulated check is a learning event (`respuesta`, origin
  // `proyecto`, id `proy-<stage>`: XP `pr:` once, never after the reference design was shown); the record
  // (lib/proyectos11/registro.ts) keeps the first pass and the values of the latest one.
  import Check from '@lucide/svelte/icons/check';
  import X from '@lucide/svelte/icons/x';
  import { onMount, tick } from 'svelte';
  import { app } from '../../lib/estado.svelte';
  import { conNumerosImpresos, infoParte } from '../../lib/datos';
  import { confirmar } from '../../lib/confirmar';
  import { emitir } from '../../lib/aprendizaje/eventos';
  import { registrarActividad } from '../../lib/progreso-diario.svelte';
  import { biblioteca, actualizar } from '../editor/circuitos.svelte';
  import { conectividad } from '../editor/conectividad';
  import { svgDocumento } from '../editor/svg';
  import type { DocumentoEsquema } from '../editor/tipos';
  import { comprobarEtapa, conValor, leerComponente, plano, textoEnDibujo, textoMedida, type ResultadoEtapa } from '../../lib/proyectos11/comprobar';
  import { anotarComprobacionEtapa, anotarSolucionEtapa, cargarProyectos, registroEtapa } from '../../lib/proyectos11/estado.svelte';
  import { idEvento, etapaDaXp } from '../../lib/proyectos11/registro';
  import type { Etapa, Proyecto } from '../../lib/proyectos11/tipos';
  import { asegurarCircuito, restaurarCircuito } from './circuito';

  let { proyecto, etapa }: { proyecto: Proyecto; etapa: Etapa } = $props();

  let id = $state<string | null>(null);
  let errorCarga = $state('');
  let textos = $state<Record<string, string>>({});
  let erroresCampo = $state<Record<string, string>>({});
  let simulando = $state(false);
  let resultado = $state.raw<ResultadoEtapa | null>(null);
  let anuncio = $state('');
  let verReferencia = $state(false);
  let titulo: HTMLHeadingElement | undefined = $state();

  const registro = $derived(registroEtapa(etapa.id));
  const guardado = $derived(id ? biblioteca.circuitos[id] : undefined);
  const doc = $derived(guardado && !guardado.borrado ? guardado.doc : null);
  const siguiente = $derived(proyecto.etapas.find((e) => e.n === etapa.n + 1));
  const hecha = $derived(!!registro?.h);
  /** The reference design is offered after two simulated checks that failed, or once the stage is passed. */
  const ofrecerReferencia = $derived(hecha || (registro?.n ?? 0) >= 2);

  const dibujo = $derived.by(() => {
    if (!doc) return '';
    try {
      return svgDocumento(doc, conectividad(doc), { paleta: 'tema' }).svg;
    } catch {
      return '';
    }
  });

  function leerTextos(d: DocumentoEsquema) {
    const t: Record<string, string> = {};
    for (const c of etapa.componentes) t[c.id] = textoEnDibujo(c, d) ?? '';
    textos = t;
    erroresCampo = {};
  }

  onMount(() => {
    void cargarProyectos();
    void asegurarCircuito(proyecto, etapa)
      .then((c) => {
        id = c;
        const g = biblioteca.circuitos[c];
        if (g) leerTextos($state.snapshot(g.doc) as DocumentoEsquema);
      })
      .catch((e) => (errorCarga = e instanceof Error ? e.message : String(e)));
    void tick().then(() => titulo?.focus());
  });

  const actual = (): DocumentoEsquema | null => (doc ? ($state.snapshot(doc) as DocumentoEsquema) : null);

  /** A field left (or Enter): its value goes into the drawing when it reads well; else it says why. */
  async function escribirCampo(cid: string) {
    const c = etapa.componentes.find((x) => x.id === cid)!;
    const d = actual();
    if (!d || !id) return;
    const t = textos[cid] ?? '';
    if (!t.trim()) {
      erroresCampo[cid] = `Escriba el valor de ${plano(c.nombre)}.`;
      return;
    }
    const l = leerComponente(c, t);
    if (!l.ok) {
      erroresCampo[cid] = l.mensaje;
      return;
    }
    erroresCampo[cid] = '';
    if (textoEnDibujo(c, d) !== textoEnDibujo(c, conValor(d, c, l.v))) await actualizar(id, conValor(d, c, l.v));
  }

  async function comprobar() {
    if (simulando || !id) return;
    let d = actual();
    if (!d) return;
    // every field as typed goes into the drawing first (a field still being edited too)
    for (const c of etapa.componentes) {
      const t = textos[c.id] ?? '';
      const l = leerComponente(c, t);
      if (!t.trim() || !l.ok) {
        erroresCampo[c.id] = !t.trim() ? `Escriba el valor de ${plano(c.nombre)}.` : (l as { mensaje: string }).mensaje;
        anuncio = erroresCampo[c.id]!;
        document.getElementById(`campo-${etapa.id}-${c.id}`)?.focus();
        return;
      }
      erroresCampo[c.id] = '';
      d = conValor(d, c, l.v);
    }
    await actualizar(id, d);
    simulando = true;
    anuncio = 'Simulando el circuito…';
    resultado = null;
    try {
      const { medirDiseno } = await import('../../lib/simular-diseno');
      const r = await comprobarEtapa(etapa, d, medirDiseno);
      resultado = r;
      if (r.tipo === 'ilegible') {
        anuncio = r.mensaje;
        return;
      }
      const antes = registroEtapa(etapa.id);
      const conXp = etapaDaXp(antes);
      const bien = r.tipo === 'bien';
      await anotarComprobacionEtapa(etapa.id, bien, r.valores ?? {}, r.medidas ?? {}).catch(() => undefined);
      if (conXp)
        emitir({
          tipo: 'respuesta',
          id: idEvento(etapa.id),
          clase: 'practica',
          origen: 'proyecto',
          correcta: bien,
          intento: (antes?.n ?? 0) + 1,
          pistas: 0,
          final: bien,
          parte: proyecto.parte,
          seccion: etapa.secciones[0]!,
          subtipo: 'proyecto',
        });
      if (bien && conXp) registrarActividad('pregunta');
      const fallos = r.condiciones.filter((c) => !c.ok).length;
      anuncio = bien ? 'Etapa superada: el circuito cumple todo lo que pide el libro.' : `Aún no: ${fallos === 1 ? 'una condición no se cumple' : `${fallos} condiciones no se cumplen`}. Debajo, qué cambiar.`;
    } finally {
      simulando = false;
    }
  }

  /**
   * Review 11c: seeing the reference design is what «Usar estos valores» gave away: from then on the stage gives no
   * XP, also when the values are typed by hand (that had still given the full XP). Asked first, as the button is.
   */
  async function mostrarReferencia() {
    if (!hecha && !registro?.s) {
      if (!(await confirmar({ titulo: '¿Ver el diseño de referencia?', mensaje: 'Después de verlo, esta etapa ya no dará XP (tampoco si escribe esos valores a mano).', aceptar: 'Ver el diseño' }))) return;
      await anotarSolucionEtapa(etapa.id).catch(() => undefined);
    }
    verReferencia = true;
  }

  async function usarReferencia() {
    if (!id) return;
    if (!hecha && !registro?.s && !(await confirmar({ titulo: '¿Usar el diseño de referencia?', mensaje: 'Sus valores se sustituyen por los de referencia y esta etapa ya no dará XP.', aceptar: 'Usar el diseño' }))) return;
    let d = actual();
    if (!d) return;
    for (const c of etapa.componentes) {
      const l = leerComponente(c, c.referencia);
      if (l.ok) d = conValor(d, c, l.v);
    }
    if (!hecha) await anotarSolucionEtapa(etapa.id).catch(() => undefined);
    await actualizar(id, d);
    leerTextos(d);
    resultado = null;
    anuncio = 'Valores de referencia puestos en el circuito. Pulse «Comprobar» para simularlo.';
  }

  async function restaurar() {
    if (!id) return;
    if (!(await confirmar({ titulo: '¿Restaurar el circuito de la etapa?', mensaje: 'Vuelve a dibujarse el circuito de partida; se pierden los cambios hechos en él (lo ya superado se conserva).', aceptar: 'Restaurar' }))) return;
    await restaurarCircuito(proyecto, etapa, id);
    const g = biblioteca.circuitos[id];
    if (g) leerTextos($state.snapshot(g.doc) as DocumentoEsquema);
    resultado = null;
    anuncio = 'Circuito de partida restaurado.';
  }

  const numSeccion = (label: string) => app.refs[label]?.num ?? '';
  const tituloSeccion = (parte: string, label: string) => infoParte(parte)?.secciones?.find((s) => s.label === label)?.titulo ?? '';
  const leccion = $derived(etapa.leccion ? { parte: etapa.leccion.split('/')[0]!, label: etapa.leccion.split('/')[1]! } : null);
  const valorReferencia = (c: (typeof etapa.componentes)[number]) => {
    const l = leerComponente(c, c.referencia);
    return l.ok ? textoMedida(l.v, c.unidad) : c.referencia;
  };
  const seriesTexto = (s: string[]) => (s.length ? `Serie ${s.join(' o ')}` : 'Valor libre');
</script>

<article class="etapa" data-etapa={etapa.id} data-hecha={hecha ? '' : undefined}>
  <header>
    <p class="etiqueta">{proyecto.titulo} · Etapa {etapa.n} de {proyecto.etapas.length}</p>
    <!-- (1.1 restyle QA: the stage page had no h1; the stage title is the page heading) -->
    <h1 tabindex="-1" bind:this={titulo}>{@html etapa.titulo}</h1>
    <ol class="segmentos" aria-label="Etapas del proyecto">
      {#each proyecto.etapas as e (e.id)}
        {@const r = registroEtapa(e.id)}
        <li>
          <a
            class="seg"
            class:hecho={!!r?.h}
            class:actual={e.id === etapa.id}
            href={`#/etapas/${proyecto.parte}/${e.n}`}
            aria-current={e.id === etapa.id ? 'step' : undefined}
            aria-label={`Etapa ${e.n}: ${plano(e.titulo)} — ${r?.h ? 'superada' : e.id === etapa.id ? 'la actual' : 'pendiente'}`}
          ></a>
        </li>
      {/each}
    </ol>
    <p class="objetivo">{@html etapa.objetivo}</p>
  </header>

  <section class="tarjeta" aria-labelledby={`espec-${etapa.id}`}>
    <h2 id={`espec-${etapa.id}`}>Lo que pide el libro</h2>
    <ul class="espec">
      {#each etapa.especificacion as l, k (k)}<li>{@html conNumerosImpresos(l)}</li>{/each}
    </ul>
    <p class="enlaces">
      {#each etapa.secciones as s (s)}
        <a href={`#/${proyecto.parte}/${s}`}>Sección {numSeccion(s)}{tituloSeccion(proyecto.parte, s) ? `: ${tituloSeccion(proyecto.parte, s)}` : ''}</a>
      {/each}
      {#if leccion}
        <a href={`#/leccion/${leccion.parte}/${encodeURIComponent(leccion.label)}`} data-leccion-etapa>Lección {numSeccion(leccion.label)}{tituloSeccion(leccion.parte, leccion.label) ? `: ${tituloSeccion(leccion.parte, leccion.label)}` : ''}</a>
      {/if}
    </p>
  </section>

  <section class="tarjeta" aria-labelledby={`diseno-${etapa.id}`}>
    <h2 id={`diseno-${etapa.id}`}>Su diseño</h2>
    {#if errorCarga}
      <p class="aviso" role="alert">{errorCarga}</p>
    {:else if !doc}
      <p class="aviso">Preparando el circuito de la etapa…</p>
    {:else}
      {#if dibujo}
        <figure class="dibujo">
          <div class="lienzo" role="img" aria-label={`Esquema de la etapa ${etapa.n}, con los valores actuales: ${etapa.componentes.map((c) => `${plano(c.nombre)} = ${textoEnDibujo(c, doc) ?? '—'}`).join(', ')}.`}>
            {@html dibujo}
          </div>
          <figcaption>{@html conNumerosImpresos(etapa.modelo)}</figcaption>
        </figure>
      {/if}
      <div class="campos">
        {#each etapa.componentes as c (c.id)}
          {@const fid = `campo-${etapa.id}-${c.id}`}
          <div class="campo">
            <label for={fid}>{@html c.nombre}</label>
            <input
              id={fid}
              type="text"
              inputmode="text"
              autocomplete="off"
              spellcheck="false"
              bind:value={textos[c.id]}
              onchange={() => void escribirCampo(c.id)}
              onkeydown={(ev) => {
                if (ev.key === 'Enter') {
                  ev.preventDefault();
                  void comprobar();
                }
              }}
              aria-invalid={erroresCampo[c.id] ? 'true' : undefined}
              aria-describedby={`${fid}-d${erroresCampo[c.id] ? ` ${fid}-e` : ''}`}
              data-componente={c.id}
            />
            <span class="desc" id={`${fid}-d`}>{@html c.papel} {seriesTexto(c.series)}{c.unidad === 'V' ? ', en voltios' : ''}.</span>
            {#if erroresCampo[c.id]}<span class="error" id={`${fid}-e`}>{erroresCampo[c.id]}</span>{/if}
          </div>
        {/each}
      </div>
      <div class="acciones">
        <button class="primario" type="button" onclick={() => void comprobar()} aria-disabled={simulando ? 'true' : undefined} data-comprobar-etapa>
          {simulando ? 'Simulando…' : 'Comprobar'}
        </button>
        <a class="secundario" href={`#/editor/${id}`} data-editor-etapa>Abrir en el editor</a>
        <button class="enlace" type="button" onclick={() => void restaurar()}>Restaurar la etapa</button>
      </div>
      <p class="nota">En el editor puede cambiar valores y también piezas o conexiones (y verlo en la protoboard); «Comprobar» simula el esquema tal como esté.</p>
    {/if}
    <p class="vivo" role="status" aria-live="polite" data-anuncio>{anuncio}</p>
  </section>

  {#if resultado && resultado.tipo !== 'ilegible'}
    <section class="tarjeta" class:bien={resultado.tipo === 'bien'} aria-labelledby={`res-${etapa.id}`} data-resultado={resultado.tipo}>
      <h2 id={`res-${etapa.id}`}>{resultado.tipo === 'bien' ? 'Etapa superada' : 'Resultado de la simulación'}</h2>
      <ul class="condiciones">
        {#each resultado.condiciones as c (c.medida)}
          <li class:ok={c.ok} data-condicion={c.medida} data-ok={c.ok ? '' : undefined}>
            <span class="icono" aria-hidden="true">{#if c.ok}<Check size={18} strokeWidth={3} />{:else}<X size={18} strokeWidth={3} />{/if}</span>
            <span class="txt">
              <span class="solo-lector">{c.ok ? 'Cumple: ' : 'No cumple: '}</span>
              <strong>{@html c.nombre}</strong>: {c.leido} <span class="pide">(se pide {@html c.texto})</span>
              {#if !c.ok && c.pista}<span class="pista">Qué cambiar: {@html c.pista}.</span>{/if}
            </span>
          </li>
        {/each}
      </ul>
      {#if resultado.informativas.length}
        <p class="nota">Medido también: {#each resultado.informativas as m, k (k)}{k ? '; ' : ''}{@html m.nombre} = {m.leido}{/each}.</p>
      {/if}
      {#if resultado.tipo === 'bien'}
        {#if siguiente}
          <a class="primario continuar" href={`#/etapas/${proyecto.parte}/${siguiente.n}`} data-siguiente-etapa>Siguiente etapa: {@html siguiente.titulo}</a>
        {:else}
          <a class="primario continuar" href={`#/etapas/${proyecto.parte}`}>Ver el proyecto completo</a>
        {/if}
      {/if}
    </section>
  {:else if resultado}
    <p class="aviso" role="alert" data-ilegible>{resultado.mensaje}</p>
  {/if}

  {#if ofrecerReferencia && doc}
    <section class="tarjeta" aria-labelledby={`ref-${etapa.id}`}>
      <h2 id={`ref-${etapa.id}`}>Diseño de referencia</h2>
      {#if !verReferencia}
        <button class="secundario" type="button" onclick={() => void mostrarReferencia()} aria-expanded="false" data-ver-referencia>Ver el diseño de referencia</button>
      {:else}
        <ul class="referencia">
          {#each etapa.componentes as c (c.id)}
            <li>{@html c.nombre} = {valorReferencia(c)} <span class="pide">({c.delLibro ? 'del libro' : 'un diseño que cumple: el libro da el requisito, no el valor'})</span></li>
          {/each}
        </ul>
        <button class="secundario" type="button" onclick={() => void usarReferencia()} data-usar-referencia>Usar estos valores</button>
      {/if}
    </section>
  {/if}
</article>

<style>
  .etapa {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 14px;
    max-width: 760px;
    margin: 0 auto;
    overflow-wrap: anywhere;
    color: var(--v11-tinta);
    font-family: var(--v11-texto);
    font-size: 15px;
    line-height: 1.5;
  }
  header {
    display: grid;
    gap: 6px;
  }
  .etiqueta {
    margin: 0;
    color: var(--v11-tinta-suave);
    font-size: 12.5px;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }
  h1,
  h2 {
    margin: 0;
    font-family: var(--v11-titular);
    color: var(--v11-tinta);
    line-height: 1.2;
  }
  h1 {
    font-size: 22px;
  }
  h2 {
    font-size: 18px;
  }
  /* the heading takes the focus when a stage opens (tabindex -1, not a control): no ring (fix12, as app.css) */
  h1:focus,
  h1:focus-visible {
    outline: none;
  }
  .objetivo,
  .nota,
  .aviso,
  .vivo {
    margin: 0;
  }
  .nota,
  .vivo,
  figcaption {
    color: var(--v11-tinta-suave);
    font-size: 14px;
  }
  .vivo:empty {
    display: none;
  }
  .aviso {
    padding: 10px 12px;
    border-radius: var(--v11-radio-panel);
    background: var(--v11-mal-tinte);
    color: var(--v11-mal-texto);
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
    inset: 16px 0;
    background: var(--v11-actual);
  }
  .seg:focus-visible {
    outline: 3px solid var(--v11-foco);
    outline-offset: 1px;
    border-radius: 6px;
  }
  .tarjeta {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 12px;
    margin: 0;
    padding: 16px;
    border: 1px solid var(--v11-linea);
    border-radius: var(--v11-radio-tarjeta);
    background: var(--v11-fondo);
    box-shadow: var(--v11-sombra);
  }
  .tarjeta.bien {
    border: 2px solid var(--v11-bien);
  }
  .espec,
  .referencia {
    display: grid;
    gap: 6px;
    margin: 0;
    padding-left: 20px;
  }
  .enlaces {
    display: flex;
    flex-wrap: wrap;
    gap: 0 16px;
    margin: 0;
  }
  .enlaces a {
    display: inline-flex;
    align-items: center;
    min-height: 44px;
    color: var(--v11-azul);
    font-weight: 600;
  }
  .dibujo {
    display: grid;
    gap: 6px;
    margin: 0;
  }
  .lienzo {
    overflow-x: auto;
    padding: 8px;
    border: 1px solid var(--v11-linea);
    border-radius: var(--v11-radio-panel);
    background: var(--superficie, var(--v11-fondo));
  }
  .lienzo :global(svg) {
    display: block;
    max-width: 100%;
    height: auto;
    margin: 0 auto;
  }
  .campos {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 200px), 1fr));
    gap: 12px;
  }
  .campo {
    display: grid;
    gap: 4px;
    align-content: start;
  }
  .campo label {
    font-weight: 600;
  }
  .campo input {
    min-height: 48px;
    min-width: 0;
    padding: 0 12px;
    border: 2px solid var(--v11-borde);
    border-radius: var(--v11-radio-opcion);
    background: var(--v11-fondo);
    color: var(--v11-tinta);
    font: 500 17px var(--v11-texto);
  }
  .campo input[aria-invalid='true'] {
    border-color: var(--v11-mal);
  }
  .desc {
    color: var(--v11-tinta-suave);
    font-size: 13px;
  }
  .error {
    color: var(--v11-mal-texto);
    font-size: 14px;
    font-weight: 600;
  }
  .acciones {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
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
    text-align: center;
    text-decoration: none;
    cursor: pointer;
  }
  .primario {
    border: 0;
    background: var(--v11-azul);
    color: var(--v11-sobre-azul);
  }
  .primario:hover {
    background: var(--v11-azul-hover);
  }
  .primario[aria-disabled='true'] {
    background: var(--v11-inactivo);
    color: var(--v11-sobre-inactivo);
    cursor: progress;
  }
  .secundario {
    border: 2px solid var(--v11-borde);
    background: var(--v11-fondo);
    color: var(--v11-tinta);
    justify-self: start;
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
  .campo input:focus-visible,
  .primario:focus-visible,
  .secundario:focus-visible,
  .enlace:focus-visible,
  .enlaces a:focus-visible {
    outline: 3px solid var(--v11-foco);
    outline-offset: 2px;
  }
  .condiciones {
    display: grid;
    gap: 10px;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .condiciones li {
    display: grid;
    grid-template-columns: 26px minmax(0, 1fr);
    gap: 8px;
    align-items: start;
  }
  .icono {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 26px;
    height: 26px;
    border-radius: 50%;
    background: var(--v11-mal-tinte);
    color: var(--v11-mal-texto);
  }
  .ok .icono {
    background: var(--v11-bien-tinte);
    color: var(--v11-bien-texto);
  }
  .pide {
    color: var(--v11-tinta-suave);
  }
  .pista {
    display: block;
    margin-top: 2px;
  }
  .solo-lector {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
    white-space: nowrap;
  }
</style>
