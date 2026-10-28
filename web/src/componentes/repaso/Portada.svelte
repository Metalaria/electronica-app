<script lang="ts">
  // Home of the «Repaso» page: today's flashcards (deck, counts, settings, streak) and the quizzes.
  import { onMount } from 'svelte';
  import Layers from '@lucide/svelte/icons/layers';
  import Flame from '@lucide/svelte/icons/flame';
  import ListChecks from '@lucide/svelte/icons/list-checks';
  import Shuffle from '@lucide/svelte/icons/shuffle';
  import RotateCcw from '@lucide/svelte/icons/rotate-ccw';
  import Hand from '@lucide/svelte/icons/hand';
  import { cargarIndicePractica } from '../practica/datos';
  import type { IndicePractica } from '../practica/tipos';
  import { obtenerIndice } from '../../lib/datos';
  import { colorBloque } from '../../lib/color';
  import Insignia from '../Insignia.svelte';
  import Icono from '../Icono.svelte';
  import { cargarBaraja, cargarIndiceRepaso, tarjetasDe, type Baraja, type IndiceRepaso } from './datos';
  import { recuento } from './cola';
  import { aprendida, claveDia, madura } from './srs';
  import { NUEVAS_DIA_MAX, nuevasHoy, ponerAjustes, racha, reiniciarTarjetas, repaso } from './estado.svelte';

  let baraja = $state<Baraja | null>(null);
  let indiceTests = $state<IndiceRepaso | null>(null);
  let indicePractica = $state.raw<IndicePractica | null>(null);
  let error = $state('');
  let ahora = $state(Date.now());

  onMount(() => {
    cargarBaraja()
      .then((b) => (baraja = b))
      .catch((e: unknown) => (error = e instanceof Error ? e.message : String(e)));
    void cargarIndiceRepaso().then((i) => (indiceTests = i));
    void cargarIndicePractica().then((i) => (indicePractica = i));
    const t = setInterval(() => (ahora = Date.now()), 60_000);
    return () => clearInterval(t);
  });

  const mazo = $derived(baraja?.mazos.find((m) => m.id === repaso.ajustes.mazo) ?? baraja?.mazos[0] ?? null);
  const tarjetas = $derived(baraja && mazo ? tarjetasDe(baraja, mazo.id, repaso.ajustes.inversas) : []);
  const cuota = $derived(Math.max(0, repaso.ajustes.nuevasDia - nuevasHoy(ahora)));
  const hoy = $derived(recuento(tarjetas, repaso.tarjetas, ahora, cuota));
  const pendientes = $derived(hoy.nuevas + hoy.aprendiendo + hoy.repaso);

  const estadisticas = $derived.by(() => {
    let aprendidas = 0;
    let maduras = 0;
    let vistas = 0;
    for (const t of tarjetas) {
      const s = repaso.tarjetas[t.id];
      if (s) vistas++;
      if (aprendida(s)) aprendidas++;
      if (madura(s)) maduras++;
    }
    return { aprendidas, maduras, vistas, total: tarjetas.length };
  });
  const diasRacha = $derived(racha(ahora));
  const respondidasHoy = $derived(repaso.diario[claveDia(ahora)]?.r ?? 0);

  // Last 28 days of activity.
  const actividad = $derived.by(() => {
    const dias: { clave: string; r: number; etiqueta: string }[] = [];
    for (let k = 27; k >= 0; k--) {
      const d = new Date(ahora);
      d.setDate(d.getDate() - k);
      const clave = claveDia(d.getTime());
      const r = repaso.diario[clave]?.r ?? 0;
      dias.push({ clave, r, etiqueta: `${d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}: ${r} respuestas` });
    }
    const max = Math.max(1, ...dias.map((d) => d.r));
    return dias.map((d) => ({ ...d, nivel: d.r === 0 ? 0 : Math.ceil((d.r / max) * 4) }));
  });

  const grupos = [
    { id: 'todo', nombre: 'General' },
    { id: 'tomo', nombre: 'Por tomo' },
    { id: 'tema', nombre: 'Por tema' },
    { id: 'capitulo', nombre: 'Por capítulo o apéndice' },
  ] as const;

  // Quizzes grouped by volume.
  const testsPorTomo = $derived.by(() => {
    if (!indiceTests) return [];
    const ind = obtenerIndice();
    return ind.tomos
      .map((t) => ({ tomo: t, partes: indiceTests!.partes.filter((p) => (p.tomo ?? '') === t.id && p.tipo === 'capitulo') }))
      .concat([{ tomo: { id: '', titulo: 'Apéndices', partes: [] }, partes: indiceTests.partes.filter((p) => p.tipo === 'apendice') }])
      .filter((g) => g.partes.length);
  });
  const nFallos = $derived(Object.keys(repaso.fallos).length);

  function pct(x: number): string {
    return `${Math.round(x * 100)} %`;
  }

  let confirmar = $state(false);
</script>

<header class="rp-cab">
  <h1 class="rp-titulo">Repaso</h1>
  <p class="rp-sub">Tarjetas del glosario con repetición espaciada y tests de cada capítulo, con las palabras del libro.</p>
</header>

<section class="bloque" aria-labelledby="tit-tarjetas">
  <h2 id="tit-tarjetas"><Layers size={20} aria-hidden="true" /> Tarjetas del glosario</h2>

  {#if error}
    <p class="aviso">No se pudo cargar el glosario: {error}</p>
  {:else if !baraja || !mazo}
    <p class="aviso">Preparando las tarjetas…</p>
  {:else}
    <div class="cifras" data-cifras>
      <div class="cifra principal">
        <span class="valor" data-para-hoy>{pendientes}</span>
        <span class="nombre">para hoy</span>
        <span class="detalle"
          ><b class="c-nueva">{hoy.nuevas}</b> nuevas · <b class="c-aprende">{hoy.aprendiendo}</b> aprendiendo ·
          <b class="c-repaso">{hoy.repaso}</b> repaso</span
        >
      </div>
      <div class="cifra">
        <span class="valor" data-aprendidas>{estadisticas.aprendidas}</span>
        <span class="nombre">aprendidas</span>
        <span class="detalle">de {estadisticas.total} · {estadisticas.maduras} maduras</span>
      </div>
      <div class="cifra">
        <span class="valor"><Flame size={22} aria-hidden="true" class={diasRacha ? 'llama' : ''} /> {diasRacha}</span>
        <span class="nombre">{diasRacha === 1 ? 'día seguido' : 'días seguidos'}</span>
        <span class="detalle">{respondidasHoy} respuestas hoy</span>
      </div>
    </div>

    <div class="mazo rp-caja">
      <label class="campo">
        <span>Mazo</span>
        <select value={mazo.id} onchange={(e) => ponerAjustes({ mazo: (e.currentTarget as HTMLSelectElement).value })} data-mazo>
          {#each grupos as g (g.id)}
            <optgroup label={g.nombre}>
              {#each baraja.mazos.filter((m) => m.grupo === g.id) as m (m.id)}
                <option value={m.id}>{m.nombre} ({m.ids.size})</option>
              {/each}
            </optgroup>
          {/each}
        </select>
      </label>
      <a class="t09-boton empezar" href="#/repaso/tarjetas" aria-disabled={pendientes === 0 ? 'true' : undefined} data-empezar>
        {pendientes ? `Empezar · ${pendientes}` : 'Nada pendiente hoy'}
      </a>
    </div>

    <div class="ajustes">
      <div class="campo-num">
        <span id="lab-nuevas">Nuevas al día</span>
        <div class="paso" role="group" aria-labelledby="lab-nuevas">
          <button class="boton-icono" aria-label="Menos nuevas al día" onclick={() => ponerAjustes({ nuevasDia: repaso.ajustes.nuevasDia - 5 })} disabled={repaso.ajustes.nuevasDia <= 0}>−</button>
          <output data-nuevas-dia>{repaso.ajustes.nuevasDia}</output>
          <button class="boton-icono" aria-label="Más nuevas al día" onclick={() => ponerAjustes({ nuevasDia: repaso.ajustes.nuevasDia + 5 })} disabled={repaso.ajustes.nuevasDia >= NUEVAS_DIA_MAX}>+</button>
        </div>
      </div>
      <label class="interruptor">
        <input type="checkbox" checked={repaso.ajustes.inversas} onchange={(e) => ponerAjustes({ inversas: (e.currentTarget as HTMLInputElement).checked })} />
        <span>Tarjetas inversas <small>(de la definición al término)</small></span>
      </label>
    </div>

    <div class="actividad" aria-label="Actividad de las últimas cuatro semanas">
      <span class="act-tit">Últimas 4 semanas</span>
      <div class="celdas">
        {#each actividad as d (d.clave)}
          <span class="celda n{d.nivel}" title={d.etiqueta}></span>
        {/each}
      </div>
    </div>
  {/if}
</section>

<section class="bloque" aria-labelledby="tit-tests">
  <h2 id="tit-tests"><ListChecks size={20} aria-hidden="true" /> Tests por capítulo</h2>
  {#if !indiceTests}
    <p class="aviso">Cargando los tests…</p>
  {:else if !indiceTests.partes.length}
    <p class="aviso">Todavía no hay tests generados (<code>contenido/repaso.py</code>).</p>
  {:else}
    <p class="rp-sub">{indiceTests.total} preguntas en {indiceTests.partes.length} capítulos y apéndices. Cada una cita el pasaje del libro del que sale.</p>
    <div class="acciones">
      <a class="boton" href="#/repaso/examen"><Shuffle size={18} aria-hidden="true" /> Examen mixto</a>
      <a class="boton" href="#/repaso/repasar" aria-disabled={nFallos ? undefined : 'true'} data-repasar
        ><RotateCcw size={18} aria-hidden="true" /> Repasar fallos <span class="cuenta">{nFallos}</span></a
      >
    </div>
    {#each testsPorTomo as g (g.tomo.id)}
      <h3 class="tomo">{g.tomo.id ? `Tomo ${g.tomo.id} · ${g.tomo.titulo}` : g.tomo.titulo}</h3>
      <ul class="lista rp-caja">
        {#each g.partes as p (p.parte)}
          {@const r = repaso.tests[p.parte]}
          <li style:--c={colorBloque(p.color)}>
            <a href={`#/repaso/test/${p.parte}`} data-test={p.parte}>
              <Insignia parte={p.parte} />
              <span class="t">{p.titulo.split(' — ')[0]}</span>
              <span class="n">{p.preguntas} preguntas</span>
              <span class="nota" class:vacia={!r}>
                {#if r}<span class="barra"><span style:width={pct(r.mejor)}></span></span>{pct(r.mejor)}{:else}—{/if}
              </span>
              <Icono nombre="chevron" tam={16} />
            </a>
          </li>
        {/each}
      </ul>
    {/each}
  {/if}
</section>

{#if indicePractica && indicePractica.partes.length}
  {@const ind = obtenerIndice()}
  <section class="bloque" aria-labelledby="tit-practica" data-practicar>
    <h2 id="tit-practica"><Hand size={20} aria-hidden="true" /> Aprender haciendo</h2>
    <p class="rp-sub">Predicciones comprobadas con el simulador, problemas con valores nuevos en cada intento, esquemas, montajes en la protoboard y parejas del glosario, sacados de cada capítulo.</p>
    <ul class="practicas">
      {#each indicePractica.partes as p (p)}
        {@const info = ind.partes[p]}
        <li style:--c={colorBloque(info?.color)}>
          <a href={`#/repaso/practica/${p}`} data-practica-enlace={p}>
            <Insignia parte={p} />
            <span class="t">{(info?.titulo ?? p).split(' — ')[0]}</span>
            <span class="n">{indicePractica.porParte?.[p] ?? ''}</span>
          </a>
        </li>
      {/each}
    </ul>
  </section>
{/if}

{#if baraja}
  <section class="bloque pie">
    {#if confirmar}
      <p>¿Borrar el progreso de todas las tarjetas? Los resultados de los tests se conservan.</p>
      <button class="boton" onclick={() => { reiniciarTarjetas(); confirmar = false; }}>Sí, empezar de cero</button>
      <button class="boton" onclick={() => (confirmar = false)}>Cancelar</button>
    {:else}
      <button class="boton discreto" onclick={() => (confirmar = true)}>Reiniciar las tarjetas…</button>
    {/if}
  </section>
{/if}

<style>
  .bloque {
    margin-top: 22px;
  }
  /* 0.9 look (componentes/ui09): serif headings, 18 px cards, the big primary button */
  h2 {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 0 0 12px;
    color: var(--titulos);
    font-family: var(--serif);
    font-size: 21px;
    font-weight: 600;
  }
  .aviso {
    color: var(--tinta-suave);
  }
  .cifras {
    display: grid;
    grid-template-columns: 1.6fr 1fr 1fr;
    gap: 10px;
  }
  .cifra {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 16px;
    border: 1px solid var(--linea);
    border-radius: var(--radio-tarjeta);
    background: var(--superficie);
  }
  .cifra.principal {
    border-color: var(--acento-borde);
    background: var(--acento-tinte);
  }
  .valor {
    display: flex;
    align-items: center;
    gap: 6px;
    color: var(--titulos);
    font-size: 34px;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    line-height: 1.1;
  }
  .valor :global(.llama) {
    color: var(--c-importante);
  }
  .nombre {
    color: var(--tinta);
    font-size: 15px;
    font-weight: 600;
  }
  .detalle {
    color: var(--tinta-suave);
    font-size: 13.5px;
  }
  .detalle b {
    font-variant-numeric: tabular-nums;
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
  .mazo {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-end;
    gap: 12px;
    margin-top: 12px;
    padding: 14px;
  }
  .campo {
    display: flex;
    flex: 1 1 300px;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
    color: var(--tinta-suave);
    font-size: 13.5px;
    font-weight: 600;
  }
  select {
    width: 100%;
    min-height: 44px;
    padding: 0 10px;
    border: 1px solid var(--linea);
    border-radius: 10px;
    background: var(--fondo);
    color: var(--tinta);
    font-size: 15.5px;
  }
  .empezar {
    flex: 0 0 auto;
    justify-content: center;
    min-width: 200px;
  }
  a[aria-disabled='true'] {
    opacity: 0.55;
    pointer-events: none;
  }
  .ajustes {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 10px 28px;
    margin-top: 12px;
    color: var(--tinta);
    font-size: 15px;
  }
  .campo-num {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .paso {
    display: inline-flex;
    align-items: center;
    border: 1px solid var(--linea);
    border-radius: 999px;
    background: var(--superficie);
  }
  .paso .boton-icono {
    width: 44px;
    height: 44px;
    border-radius: 999px;
    font-size: 20px;
  }
  .paso .boton-icono:disabled {
    opacity: 0.35;
    cursor: default;
  }
  output {
    min-width: 2.2em;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    text-align: center;
  }
  .interruptor {
    display: flex;
    align-items: center;
    gap: 10px;
    min-height: 44px;
    cursor: pointer;
  }
  .interruptor input {
    width: 22px;
    height: 22px;
    accent-color: var(--banda);
  }
  .interruptor small {
    color: var(--tinta-suave);
    font-size: 13.5px;
  }
  .actividad {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px 14px;
    margin-top: 10px;
  }
  .act-tit {
    color: var(--tinta-suave);
    font-size: 13.5px;
  }
  .celdas {
    display: grid;
    grid-template-columns: repeat(28, 1fr);
    flex: 1 1 280px;
    gap: 3px;
    max-width: 520px;
  }
  .celda {
    aspect-ratio: 1;
    border-radius: 3px;
    background: var(--linea-suave);
  }
  .celda.n1 {
    background: color-mix(in srgb, var(--c-ejemplo) 30%, var(--superficie));
  }
  .celda.n2 {
    background: color-mix(in srgb, var(--c-ejemplo) 52%, var(--superficie));
  }
  .celda.n3 {
    background: color-mix(in srgb, var(--c-ejemplo) 75%, var(--superficie));
  }
  .celda.n4 {
    background: var(--c-ejemplo);
  }
  .acciones {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin: 12px 0 6px;
  }
  .cuenta {
    min-width: 1.6em;
    padding: 0 6px;
    border-radius: 999px;
    background: var(--superficie-2);
    color: var(--tinta-suave);
    font-size: 13px;
    text-align: center;
  }
  h3.tomo {
    margin: 22px 0 8px;
    color: var(--tinta-suave);
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }
  .lista {
    margin: 0;
    padding: 0;
    list-style: none;
    overflow: hidden;
  }
  .lista li + li {
    border-top: 1px solid var(--linea-suave);
  }
  .lista a {
    display: flex;
    align-items: center;
    gap: 12px;
    min-height: 52px;
    padding: 6px 12px;
    color: var(--tinta);
    text-decoration: none;
  }
  .lista a:hover {
    background: var(--hover);
  }
  .lista .t {
    flex: 1;
    min-width: 0;
    font-size: 15.5px;
    line-height: 1.3;
  }
  .lista .n {
    flex: none;
    color: var(--tinta-suave);
    font-size: 13.5px;
  }
  .lista .nota {
    display: flex;
    flex: none;
    align-items: center;
    gap: 6px;
    width: 104px;
    color: var(--tinta);
    font-size: 13.5px;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    justify-content: flex-end;
  }
  .lista .nota.vacia {
    color: var(--tinta-suave);
  }
  .barra {
    width: 52px;
    height: 6px;
    border-radius: 3px;
    background: var(--linea-suave);
    overflow: hidden;
  }
  .barra span {
    display: block;
    height: 100%;
    background: var(--c-ejemplo);
  }
  .lista a > :global(svg) {
    flex: none;
    color: var(--tinta-suave);
  }
  .pie {
    margin-top: 36px;
    color: var(--tinta-suave);
  }
  .pie p {
    margin: 0 0 8px;
  }
  .discreto {
    border-color: transparent;
    background: transparent;
    color: var(--tinta-suave);
  }
  @media (max-width: 640px) {
    .cifras {
      grid-template-columns: 1fr 1fr;
    }
    .cifra.principal {
      grid-column: 1 / -1;
    }
    .lista .n {
      display: none;
    }
    .lista .nota {
      width: auto;
    }
    .empezar {
      flex: 1 1 100%;
    }
  }
  .practicas {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(230px, 1fr));
    gap: 8px;
    margin: 12px 0 0;
    padding: 0;
    list-style: none;
  }
  .practicas a {
    display: flex;
    align-items: center;
    gap: 10px;
    min-height: 48px;
    padding: 6px 12px 6px 6px;
    border: 1px solid var(--linea);
    border-left: 4px solid var(--c);
    border-radius: 12px;
    background: var(--superficie);
    color: var(--tinta);
    text-decoration: none;
  }
  .practicas a:hover {
    background: var(--hover);
  }
  .practicas .t {
    flex: 1;
    min-width: 0;
    font-size: 14.5px;
    line-height: 1.25;
  }
  .practicas .n {
    color: var(--tinta-suave);
    font-size: 13px;
    font-variant-numeric: tabular-nums;
  }
</style>
