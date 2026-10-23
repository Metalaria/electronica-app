<script lang="ts" module>
  // Kept while the app is open, so Back from the book returns to the running exam.
  const eleccion = $state({ partes: [] as string[], cuantas: 20, ronda: 0, enCurso: false });
</script>

<script lang="ts">
  // Mixed exam (#/repaso/examen): questions drawn at random from the chosen chapters.
  import { onMount } from 'svelte';
  import { obtenerIndice } from '../../lib/datos';
  import Insignia from '../Insignia.svelte';
  import Icono from '../Icono.svelte';
  import Cuestionario, { olvidarSesion } from './Cuestionario.svelte';
  import { barajar, cargarCuestionario, cargarIndiceRepaso, type IndiceRepaso } from './datos';
  import { registrarExamen, repaso } from './estado.svelte';

  let indice = $state<IndiceRepaso | null>(null);
  onMount(() => {
    void cargarIndiceRepaso().then((i) => (indice = i));
  });

  const grupos = $derived.by(() => {
    if (!indice) return [];
    const tomos = obtenerIndice().tomos;
    const caps = tomos
      .map((t) => ({ id: t.id, nombre: `Tomo ${t.id}`, partes: indice!.partes.filter((p) => p.tomo === t.id && p.tipo === 'capitulo') }))
      .filter((g) => g.partes.length);
    const aps = indice.partes.filter((p) => p.tipo === 'apendice');
    return aps.length ? [...caps, { id: 'ap', nombre: 'Apéndices', partes: aps }] : caps;
  });
  const disponibles = $derived(
    indice ? indice.partes.filter((p) => eleccion.partes.includes(p.parte)).reduce((s, p) => s + p.preguntas, 0) : 0,
  );

  function alternar(parte: string) {
    eleccion.partes = eleccion.partes.includes(parte) ? eleccion.partes.filter((p) => p !== parte) : [...eleccion.partes, parte];
  }
  function alternarGrupo(partes: string[]) {
    const todas = partes.every((p) => eleccion.partes.includes(p));
    eleccion.partes = todas ? eleccion.partes.filter((p) => !partes.includes(p)) : [...new Set([...eleccion.partes, ...partes])];
  }

  function empezar() {
    if (!disponibles) return;
    olvidarSesion(`examen:${eleccion.ronda}`);
    eleccion.ronda++;
    eleccion.enCurso = true;
  }

  async function cargar() {
    const partes = [...eleccion.partes];
    const datos = await Promise.all(partes.map((p) => cargarCuestionario(p)));
    const todas = datos.flatMap((c) => c.preguntas.map((p) => ({ parte: c.parte, p })));
    // Spread the questions over the chapters: round-robin over each chapter's shuffled list.
    const colas = datos.map((c) => barajar(c.preguntas.map((p) => ({ parte: c.parte, p }))));
    const elegidas: typeof todas = [];
    for (let k = 0; elegidas.length < Math.min(eleccion.cuantas, todas.length); k++) {
      for (const cola of colas) {
        const x = cola[k];
        if (x && elegidas.length < eleccion.cuantas) elegidas.push(x);
      }
    }
    return elegidas;
  }

  const ultimos = $derived(repaso.examenes.slice(0, 5));
</script>

<header class="rp-cab">
  <a class="rp-volver" href="#/repaso" onclick={() => (eleccion.enCurso = false)}><Icono nombre="chevron-izq" tam={18} /> Repaso</a>
  <h1 class="rp-titulo">Examen mixto</h1>
  <p class="rp-sub">Preguntas al azar de los capítulos que elija, repartidas entre todos ellos.</p>
</header>

{#if eleccion.enCurso && eleccion.partes.length}
  {#key eleccion.ronda}
    <Cuestionario
      clave={`examen:${eleccion.ronda}`}
      {cargar}
      mostrarParte
      volverA="#/repaso/examen"
      alTerminar={(a, t) => registrarExamen([...eleccion.partes], a, t)}
    />
  {/key}
  <p class="otro"><button class="boton" onclick={() => (eleccion.enCurso = false)}>Elegir otros capítulos</button></p>
{:else if !indice}
  <p class="rp-sub">Cargando…</p>
{:else}
  <div class="eleccion">
    {#each grupos as g (g.id)}
      {@const ids = g.partes.map((p) => p.parte)}
      <fieldset>
        <legend>
          <button class="todo" onclick={() => alternarGrupo(ids)} aria-pressed={ids.every((p) => eleccion.partes.includes(p))}>
            {g.nombre}
          </button>
        </legend>
        <div class="chips">
          {#each g.partes as p (p.parte)}
            <button
              class="chip"
              aria-pressed={eleccion.partes.includes(p.parte)}
              onclick={() => alternar(p.parte)}
              title={p.titulo}
              data-elegir={p.parte}
            >
              <Insignia parte={p.parte} />
              <span>{p.titulo.split(' — ')[0]}</span>
            </button>
          {/each}
        </div>
      </fieldset>
    {/each}
  </div>

  <div class="barra-examen rp-caja">
    <div class="cuantas" role="group" aria-label="Número de preguntas">
      {#each [10, 20, 40, 60] as n (n)}
        <button class="boton" aria-pressed={eleccion.cuantas === n} onclick={() => (eleccion.cuantas = n)}>{n}</button>
      {/each}
    </div>
    <span class="info">{eleccion.partes.length} {eleccion.partes.length === 1 ? 'elegido' : 'elegidos'} · {disponibles} {disponibles === 1 ? 'pregunta disponible' : 'preguntas disponibles'}</span>
    <button class="boton primario" disabled={!disponibles} onclick={empezar} data-empezar-examen>Empezar el examen</button>
  </div>

  {#if ultimos.length}
    <h2 class="hist">Últimos exámenes</h2>
    <ul class="historial">
      {#each ultimos as e (e.t)}
        <li>
          <span>{new Date(e.t).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}</span>
          <span>{e.partes.length} {e.partes.length === 1 ? 'capítulo' : 'capítulos'}</span>
          <strong>{e.aciertos}/{e.total} · {Math.round((e.aciertos / e.total) * 100)} %</strong>
        </li>
      {/each}
    </ul>
  {/if}
{/if}

<style>
  .eleccion {
    display: grid;
    gap: 14px;
  }
  fieldset {
    margin: 0;
    padding: 0;
    border: 0;
  }
  legend {
    padding: 0;
  }
  .todo {
    min-height: 44px;
    padding: 0 4px;
    border: 0;
    background: none;
    color: var(--tinta-suave);
    font-size: 13px;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }
  .todo[aria-pressed='true'] {
    color: var(--acento);
  }
  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .chip {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    max-width: 100%;
    min-height: 44px;
    padding: 0 12px 0 8px;
    border: 1.5px solid var(--linea);
    border-radius: 999px;
    background: var(--superficie);
    color: var(--tinta);
    font-size: 14.5px;
  }
  .chip span:last-child {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .chip[aria-pressed='true'] {
    border-color: var(--acento);
    background: var(--acento-tinte);
    font-weight: 600;
  }
  .barra-examen {
    position: sticky;
    bottom: calc(10px + var(--hueco-inferior));
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 10px 14px;
    margin-top: 18px;
    padding: 12px;
  }
  .cuantas {
    display: flex;
    gap: 4px;
  }
  .cuantas .boton {
    min-width: 52px;
    justify-content: center;
    padding: 0 10px;
  }
  .cuantas .boton[aria-pressed='true'] {
    border-color: var(--titulos);
    background: var(--titulos);
    color: var(--fondo);
  }
  .info {
    flex: 1;
    color: var(--tinta-suave);
    font-size: 14px;
  }
  .hist {
    margin: 28px 0 8px;
    color: var(--tinta);
    font-size: 16px;
  }
  .historial {
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .historial li {
    display: flex;
    gap: 14px;
    padding: 8px 0;
    border-bottom: 1px solid var(--linea-suave);
    color: var(--tinta-suave);
    font-size: 15px;
  }
  .historial strong {
    margin-left: auto;
    color: var(--tinta);
  }
  .otro {
    margin-top: 24px;
  }
  @media (max-width: 560px) {
    .barra-examen .primario {
      flex: 1 1 100%;
      justify-content: center;
    }
  }
</style>
