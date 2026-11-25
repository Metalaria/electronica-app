<script lang="ts">
  // «Progreso y logros» (0.11, #/progreso): the level with its bar and the XP (counting up), the streak, a few
  // counters, the latest XP and every achievement — the unlocked ones in colour with their date, the locked ones
  // greyed with how to get them and, for counters, how far the reader is. 2.1: the system of the sheet (36 px title,
  // sections 48 px apart, no boxes: the level and the streak as figures, the mastery as a hairline row), and the
  // reading and exercise progress that the start page showed until 2.0 (aprender/ProgresoInicio.svelte).
  import { onMount } from 'svelte';
  import { ruta } from '../../lib/ruta.svelte';
  import { progresoXp, cargarProgresoXp, historialXp, revisarLogros } from '../../lib/aprendizaje/progreso.svelte';
  import { progresoDiario } from '../../lib/progreso-diario.svelte';
  import { LOGROS, type Logro } from '../../lib/aprendizaje/logros';
  import { nombreNivel } from '../../lib/aprendizaje/niveles';
  import ContadorXp from './ContadorXp.svelte';
  import Medalla from './Medalla.svelte';
  import Icono from '../Icono.svelte';
  import ProgresoInicio from '../aprender/ProgresoInicio.svelte';
  // 0.11 group B: the mastery per concept, summarised, with the way into «Dominio»
  import { cargarDominio, conceptosConDominio, estadoDominio } from '../../lib/aprendizaje/dominio.svelte';

  const p = progresoXp;
  const s = $derived(p.estadisticas);
  const nivel = $derived(p.nivel);
  const historial = $derived(historialXp(6));
  const conseguidos = $derived(LOGROS.filter((l) => p.logros[l.id]).length);

  // 2.1: the last seven days of the streak (today last), the row the start page showed until 2.0
  const LETRAS = ['D', 'L', 'M', 'X', 'J', 'V', 'S'];
  const NOMBRES = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  const dias = $derived(
    progresoDiario.ultimosDias.map((d, i) => {
      const dia = new Date(`${d.fecha}T12:00:00`).getDay();
      const hoy = i === progresoDiario.ultimosDias.length - 1;
      return { ...d, hoy, letra: LETRAS[dia] ?? '', nombre: hoy ? 'hoy' : (NOMBRES[dia] ?? '') };
    }),
  );

  // The ring: circumference of r = 42.
  const C = 2 * Math.PI * 42;

  const fecha = (t: number) => new Date(t).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
  const hora = (t: number) => {
    const d = new Date(t);
    const hoy = new Date();
    const mismo = d.toDateString() === hoy.toDateString();
    return mismo ? `hoy, ${d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}` : d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
  };

  function progresoDe(l: Logro): [number, number] {
    return l.progreso(s);
  }

  const dominio = $derived.by(() => {
    if (!estadoDominio.listo) return null;
    const cs = conceptosConDominio();
    return {
      total: cs.length,
      dominados: cs.filter((c) => c.nivel === 'dominado').length,
      competentes: cs.filter((c) => c.nivel === 'competente').length,
      repasar: cs.filter((c) => c.repasar).length,
    };
  });

  onMount(() => {
    void cargarDominio();
    window.scrollTo({ top: ruta.y ?? 0, behavior: 'instant' });
    void cargarProgresoXp()
      .then(() => revisarLogros(true))
      .catch((e: unknown) => console.warn('No se pudieron revisar los logros', e));
  });
</script>

<svelte:head><title>Progreso y logros · Electrónica Práctica Avanzada</title></svelte:head>

<div class="progreso pagina21 secciones21" data-pagina-progreso>
  <header class="cabeza21">
    <h1 class="titulo21">Progreso y logros</h1>
    <p class="nota21">Cada lección, práctica, ejercicio y montaje suma XP. Con los XP se sube de nivel.</p>
  </header>

  <div class="columnas">
    <section class="nivel" aria-labelledby="tit-nivel" data-nivel={nivel.nivel} data-xp={p.total}>
      <div class="anillo">
        <svg width="112" height="112" viewBox="0 0 100 100" aria-hidden="true">
          <circle cx="50" cy="50" r="42" fill="none" stroke="var(--linea)" stroke-width="8" />
          <circle
            class="arco"
            cx="50"
            cy="50"
            r="42"
            fill="none"
            stroke="var(--ambar-relleno)"
            stroke-width="8"
            stroke-linecap="round"
            stroke-dasharray={C}
            stroke-dashoffset={C * (1 - nivel.fraccion)}
            transform="rotate(-90 50 50)"
          />
        </svg>
        <span class="num"><small>Nivel</small>{nivel.nivel}</span>
      </div>
      <div class="datos">
        <h2 id="tit-nivel">{nivel.nombre}</h2>
        <p class="total"><strong><ContadorXp valor={p.total} /></strong> XP</p>
        <div class="barra" aria-hidden="true"><span style:transform={`scaleX(${nivel.fraccion})`}></span></div>
        <p class="falta">
          Faltan <strong>{nivel.falta.toLocaleString('es-ES')} XP</strong> para el nivel {nivel.nivel + 1} · {nombreNivel(nivel.nivel + 1)}
        </p>
        {#if p.hoy}<p class="hoy" data-xp-hoy={p.hoy}>Hoy: +{p.hoy} XP</p>{/if}
      </div>
    </section>

    <section class="racha" aria-labelledby="tit-racha-p">
      <div class="cifra">
        <svg width="30" height="30" viewBox="0 0 24 24" aria-hidden="true"
          ><path
            d="M12 2.5c.6 3.2 4.8 5.6 4.8 10.4A4.8 4.8 0 0 1 12 17.7a4.8 4.8 0 0 1-4.8-4.8c0-2.2 1.2-3.6 2.3-4.8.3 1.6 1.1 2.6 2.1 3 0-2.9.1-5.8.4-8.6z"
            fill="var(--ambar-relleno)"
          /></svg
        >
        <h2 id="tit-racha-p">{progresoDiario.racha} {progresoDiario.racha === 1 ? 'día' : 'días'} de racha</h2>
      </div>
      <ol class="semana" aria-label="Últimos siete días" data-semana-racha>
        {#each dias as d (d.fecha)}
          <li class:hecho={d.cumplido} class:hoy={d.hoy} aria-label={`${d.nombre}: ${d.cumplido ? 'objetivo cumplido' : 'sin cumplir'}`}>
            <span class="punto" aria-hidden="true">
              {#if d.cumplido}<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"
                  ><path d="M5 12.5l4.5 4.5L19 7.5" /></svg
                >{/if}
            </span>
            <span class="letra" aria-hidden="true">{d.letra}</span>
          </li>
        {/each}
      </ol>
      <ul class="cuentas">
        <li><strong>{s.rachaMax}</strong> la racha más larga</li>
        <li><strong>{s.diasObjetivo}</strong> {s.diasObjetivo === 1 ? 'día' : 'días'} con el objetivo cumplido</li>
        <li><strong>{s.lecciones}</strong> {s.lecciones === 1 ? 'lección completada' : 'lecciones completadas'}</li>
        <li><strong>{s.aciertos}</strong> {s.aciertos === 1 ? 'pregunta acertada' : 'preguntas acertadas'}</li>
        <li><strong>{s.ejercicios}</strong> {s.ejercicios === 1 ? 'ejercicio resuelto' : 'ejercicios resueltos'}</li>
        <li><strong>{s.circuitos.length}</strong> {s.circuitos.length === 1 ? 'circuito montado' : 'circuitos montados'}</li>
      </ul>
      <a class="boton cursos" href="#/cursos"><Icono nombre="cursos" tam={18} /> Ver los cursos</a>
    </section>
  </div>

  <section class="seccion21 dominio-resumen" aria-labelledby="tit-dominio-p" data-resumen-dominio={dominio?.total ?? ''}>
    <h2 class="etiqueta21" id="tit-dominio-p">Dominio por conceptos</h2>
    <ul class="filas21">
      <li>
        <a class="fila21" href="#/progreso/dominio" data-ir-dominio>
          <span class="fila21-texto">
            <span class="fila21-titulo">Ver el dominio</span>
            <span class="fila21-sub">
              {#if !dominio}Calculando…{:else if !dominio.total}Aún sin respuestas que medir: cada práctica y pregunta cuenta.{:else}{dominio.total}
                {dominio.total === 1 ? 'sección practicada' : 'secciones practicadas'} · {dominio.dominados} {dominio.dominados === 1 ? 'dominada' : 'dominadas'}{#if dominio.repasar}
                  · {dominio.repasar} para repasar{/if}{/if}
            </span>
          </span>
          <span class="fila21-fin" aria-hidden="true"><Icono nombre="chevron" tam={20} grosor={2} /></span>
        </a>
      </li>
    </ul>
  </section>

  <ProgresoInicio />

  {#if historial.length}
    <section class="seccion21 ultimos" aria-labelledby="tit-ultimos">
      <h2 class="etiqueta21" id="tit-ultimos">Últimos XP</h2>
      <ul>
        {#each historial as h (h.id)}
          <li><span class="x">+{h.x}</span><span class="que">{h.texto}</span><span class="cuando">{hora(h.t)}</span></li>
        {/each}
      </ul>
    </section>
  {/if}

  <section class="seccion21 logros" aria-labelledby="tit-logros">
    <div class="cab-logros">
      <h2 class="subtitulo21" id="tit-logros">Logros</h2>
      <span class="cuenta" data-logros-conseguidos={conseguidos}>{conseguidos} de {LOGROS.length}</span>
    </div>
    <ul class="rejilla">
      {#each LOGROS as l (l.id)}
        {@const t = p.logros[l.id]}
        {@const [n, de] = progresoDe(l)}
        <li class="logro" class:bloqueado={!t} data-logro={l.id} data-estado={t ? 'conseguido' : 'bloqueado'}>
          <Medalla logro={l.id} desbloqueado={!!t} tam={52} />
          <div class="txt">
            <h3>{l.nombre}</h3>
            <p>{l.como}</p>
            {#if t}
              <span class="cuando">Conseguido el {fecha(t)}</span>
            {:else if de > 1}
              <span class="avance" aria-label={`${n} de ${de}`}>
                <span class="mini" aria-hidden="true"><span style:transform={`scaleX(${n / de})`}></span></span>
                <span>{n} de {de}</span>
              </span>
            {/if}
          </div>
        </li>
      {/each}
    </ul>
  </section>
</div>

<style>
  .progreso {
    font-family: var(--v11-texto);
  }
  .columnas {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-start;
    gap: 48px;
  }
  .columnas > * {
    flex: 1 1 330px;
  }
  .nivel {
    display: flex;
    align-items: center;
    gap: 20px;
  }
  .anillo {
    position: relative;
    flex: none;
    width: 112px;
    height: 112px;
  }
  .arco {
    transition: stroke-dashoffset 0.9s ease-out;
  }
  .num {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    color: var(--titulos);
    font-family: var(--titular);
    font-size: 36px;
    font-weight: 700;
    line-height: 1;
  }
  .num small {
    color: var(--tinta-suave);
    font-family: var(--sans);
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }
  .datos {
    display: flex;
    flex-direction: column;
    gap: 6px;
    min-width: 0;
    flex: 1;
  }
  .nivel h2,
  .racha h2 {
    margin: 0;
    color: var(--v11-tinta);
    font-family: var(--v11-titular);
    font-size: var(--t21-seccion);
    font-weight: 600;
    line-height: 1.2;
  }
  .total {
    margin: 0;
    color: var(--tinta-suave);
    font-size: 16px;
  }
  .total strong {
    color: var(--tinta);
    font-size: 22px;
  }
  .barra,
  .mini {
    display: block;
    height: 10px;
    overflow: hidden;
    border-radius: 999px;
    background: var(--linea);
  }
  .barra span,
  .mini span {
    display: block;
    height: 100%;
    border-radius: inherit;
    background: var(--ambar-relleno);
    transform-origin: left center;
    transition: transform 0.9s ease-out;
  }
  .falta,
  .hoy {
    margin: 0;
    color: var(--tinta-suave);
    font-size: 14.5px;
    line-height: 1.4;
  }
  .falta strong {
    color: var(--tinta);
  }
  .hoy {
    color: var(--ambar);
    font-weight: 700;
  }
  .racha {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .cifra {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  /* the last seven days (2.1, from the 0.9 start page): a ring per day, filled once its goal was met */
  .semana {
    display: flex;
    gap: 12px;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .semana li {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
  }
  .punto {
    display: grid;
    place-items: center;
    width: 22px;
    height: 22px;
    border: 2px solid var(--v11-linea);
    border-radius: 50%;
    color: var(--sobre-ambar);
  }
  .semana .hoy .punto,
  .semana .hecho .punto {
    border-color: var(--ambar-relleno);
  }
  .semana .hecho .punto {
    background: var(--ambar-relleno);
  }
  .letra {
    color: var(--v11-tinta-suave);
    font-size: 12px;
  }
  .semana .hoy .letra {
    color: var(--v11-tinta);
    font-weight: 700;
  }
  .cuentas {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px 16px;
    margin: 0;
    padding: 0;
    list-style: none;
    color: var(--tinta-suave);
    font-size: 14.5px;
    line-height: 1.3;
  }
  .cuentas strong {
    display: block;
    color: var(--tinta);
    font-family: var(--titular);
    font-size: 22px;
  }
  .cursos {
    align-self: flex-start;
  }
  .ultimos ul {
    display: flex;
    flex-direction: column;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .ultimos li {
    display: flex;
    align-items: baseline;
    gap: 12px;
    padding: 12px 0;
    border-bottom: 1px solid var(--v11-linea);
    font-size: 15px;
  }
  .ultimos .x {
    min-width: 3.2em;
    color: var(--ambar);
    font-weight: 800;
    font-variant-numeric: tabular-nums;
  }
  .ultimos .que {
    flex: 1;
    min-width: 0;
    color: var(--tinta);
  }
  .ultimos .cuando {
    color: var(--tinta-suave);
    font-size: 13.5px;
  }
  .cab-logros {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 12px;
  }
  .cab-logros .cuenta {
    color: var(--tinta-suave);
    font-size: 15px;
    font-weight: 600;
  }
  .rejilla {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
    gap: 8px 24px;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .logro {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 12px;
    border-radius: 14px;
    background: var(--v11-panel);
  }
  /* 2.1: no boxes — only the achievements already won keep a tint */
  .logro.bloqueado {
    background: transparent;
  }
  .logro .txt {
    display: flex;
    flex-direction: column;
    gap: 3px;
    min-width: 0;
  }
  .logro h3 {
    margin: 0;
    color: var(--titulos);
    font-size: 16px;
    line-height: 1.25;
  }
  .logro.bloqueado h3 {
    color: var(--tinta-suave);
  }
  .logro p {
    margin: 0;
    color: var(--tinta-suave);
    font-size: 14px;
    line-height: 1.35;
  }
  .logro .cuando {
    /* (2.1 close-out: on the panel's tint the example colour fell to 4.28:1 in the light theme; the system's «right» text
       colour is made for tints) */
    color: var(--v11-bien-texto);
    font-size: 13px;
    font-weight: 600;
  }
  .avance {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 2px;
    color: var(--tinta-suave);
    font-size: 13px;
    font-variant-numeric: tabular-nums;
  }
  .avance .mini {
    width: 90px;
    height: 6px;
  }
  @media (max-width: 420px) {
    .nivel {
      gap: 14px;
    }
    .anillo,
    .anillo svg {
      width: 92px;
      height: 92px;
    }
    .num {
      font-size: 30px;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .arco,
    .barra span,
    .mini span {
      transition: none;
    }
  }
</style>
