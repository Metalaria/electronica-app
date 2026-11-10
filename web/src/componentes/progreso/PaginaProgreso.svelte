<script lang="ts">
  // «Progreso y logros» (0.11, #/progreso): the level with its bar and the XP (counting up), the streak, a few
  // counters, the latest XP and every achievement — the unlocked ones in colour with their date, the locked ones
  // greyed with how to get them and, for counters, how far the reader is.
  import { onMount } from 'svelte';
  import { ruta } from '../../lib/ruta.svelte';
  import { progresoXp, cargarProgresoXp, historialXp, revisarLogros } from '../../lib/aprendizaje/progreso.svelte';
  import { progresoDiario } from '../../lib/progreso-diario.svelte';
  import { LOGROS, type Logro } from '../../lib/aprendizaje/logros';
  import { nombreNivel } from '../../lib/aprendizaje/niveles';
  import ContadorXp from './ContadorXp.svelte';
  import Medalla from './Medalla.svelte';
  import Rotulo from '../ui09/Rotulo.svelte';
  import Icono from '../Icono.svelte';
  // 0.11 group B: the mastery per concept, summarised, with the way into «Dominio»
  import { cargarDominio, conceptosConDominio, estadoDominio } from '../../lib/aprendizaje/dominio.svelte';
  import Gauge from '@lucide/svelte/icons/gauge';

  const p = progresoXp;
  const s = $derived(p.estadisticas);
  const nivel = $derived(p.nivel);
  const historial = $derived(historialXp(6));
  const conseguidos = $derived(LOGROS.filter((l) => p.logros[l.id]).length);

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

<div class="progreso" data-pagina-progreso>
  <header class="cab">
    <h1>Progreso y logros</h1>
    <p>Cada lección, práctica, ejercicio y montaje suma XP. Con los XP se sube de nivel.</p>
  </header>

  <div class="columnas">
    <section class="t09-tarjeta t09-grande nivel" aria-labelledby="tit-nivel" data-nivel={nivel.nivel} data-xp={p.total}>
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

    <section class="t09-tarjeta t09-grande racha" aria-labelledby="tit-racha-p">
      <div class="cifra">
        <svg width="30" height="30" viewBox="0 0 24 24" aria-hidden="true"
          ><path
            d="M12 2.5c.6 3.2 4.8 5.6 4.8 10.4A4.8 4.8 0 0 1 12 17.7a4.8 4.8 0 0 1-4.8-4.8c0-2.2 1.2-3.6 2.3-4.8.3 1.6 1.1 2.6 2.1 3 0-2.9.1-5.8.4-8.6z"
            fill="var(--ambar-relleno)"
          /></svg
        >
        <h2 id="tit-racha-p">{progresoDiario.racha} {progresoDiario.racha === 1 ? 'día' : 'días'} de racha</h2>
      </div>
      <ul class="cuentas">
        <li><strong>{s.rachaMax}</strong> la racha más larga</li>
        <li><strong>{s.diasObjetivo}</strong> {s.diasObjetivo === 1 ? 'día' : 'días'} con el objetivo cumplido</li>
        <li><strong>{s.lecciones}</strong> {s.lecciones === 1 ? 'lección completada' : 'lecciones completadas'}</li>
        <li><strong>{s.aciertos}</strong> {s.aciertos === 1 ? 'pregunta acertada' : 'preguntas acertadas'}</li>
        <li><strong>{s.ejercicios}</strong> {s.ejercicios === 1 ? 'ejercicio resuelto' : 'ejercicios resueltos'}</li>
        <li><strong>{s.circuitos.length}</strong> {s.circuitos.length === 1 ? 'circuito montado' : 'circuitos montados'}</li>
      </ul>
      <a class="t09-boton t09-contorno cursos" href="#/cursos"><Icono nombre="cursos" tam={18} /> Ver los cursos</a>
    </section>
  </div>

  <section class="t09-tarjeta dominio-resumen" aria-labelledby="tit-dominio-p" data-resumen-dominio={dominio?.total ?? ''}>
    <span class="icono-dominio" aria-hidden="true"><Gauge size={26} /></span>
    <div class="txt-dominio">
      <h2 id="tit-dominio-p">Dominio por conceptos</h2>
      <p>
        {#if !dominio}Calculando…{:else if !dominio.total}Aún sin respuestas que medir: cada práctica y pregunta cuenta.{:else}{dominio.total}
          {dominio.total === 1 ? 'sección practicada' : 'secciones practicadas'} · {dominio.dominados} {dominio.dominados === 1 ? 'dominada' : 'dominadas'}{#if dominio.repasar}
            · {dominio.repasar} para repasar{/if}{/if}
      </p>
    </div>
    <a class="t09-boton t09-contorno" href="#/progreso/dominio" data-ir-dominio>Ver el dominio</a>
  </section>

  {#if historial.length}
    <section class="ultimos" aria-labelledby="tit-ultimos">
      <Rotulo etiqueta="h2" id="tit-ultimos">Últimos XP</Rotulo>
      <ul>
        {#each historial as h (h.id)}
          <li><span class="x">+{h.x}</span><span class="que">{h.texto}</span><span class="cuando">{hora(h.t)}</span></li>
        {/each}
      </ul>
    </section>
  {/if}

  <section class="logros" aria-labelledby="tit-logros">
    <div class="cab-logros">
      <h2 id="tit-logros">Logros</h2>
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
  .dominio-resumen {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 12px 16px;
  }
  .icono-dominio {
    display: grid;
    flex: none;
    place-items: center;
    width: 48px;
    height: 48px;
    border-radius: 12px;
    background: var(--acento-tinte);
    color: var(--acento);
  }
  .txt-dominio {
    flex: 1 1 16em;
    min-width: 0;
  }
  .txt-dominio h2 {
    margin: 0;
    color: var(--tinta);
    font-size: 17px;
  }
  .txt-dominio p {
    margin: 2px 0 0;
    color: var(--tinta-suave);
    font-size: 14.5px;
  }
  .progreso {
    display: flex;
    flex-direction: column;
    gap: 24px;
    max-width: 1120px;
    margin: 0 auto;
    padding: 32px 32px 64px;
    font-family: var(--sans);
  }
  @media (max-width: 600px) {
    .progreso {
      padding: 16px 16px 48px;
    }
  }
  .cab h1 {
    margin: 0;
    color: var(--titulos);
    font-family: var(--titular);
    font-size: 30px;
    line-height: 1.2;
  }
  .cab p {
    margin: 6px 0 0;
    color: var(--tinta-suave);
    font-size: 16px;
  }
  .columnas {
    display: flex;
    flex-wrap: wrap;
    gap: 24px;
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
  h2 {
    margin: 0;
    color: var(--titulos);
    font-family: var(--titular);
    font-size: 24px;
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
    margin: 8px 0 0;
    padding: 0;
    list-style: none;
    border: 1px solid var(--linea);
    border-radius: var(--radio-tarjeta-p);
    background: var(--superficie);
  }
  .ultimos li {
    display: flex;
    align-items: baseline;
    gap: 12px;
    padding: 10px 14px;
    font-size: 15px;
  }
  .ultimos li + li {
    border-top: 1px solid var(--linea-suave);
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
    gap: 12px;
    margin: 12px 0 0;
    padding: 0;
    list-style: none;
  }
  .logro {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 12px;
    border: 1px solid var(--linea);
    border-radius: var(--radio-tarjeta-p);
    background: var(--superficie);
  }
  .logro.bloqueado {
    background: var(--fondo);
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
    color: var(--c-ejemplo);
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
