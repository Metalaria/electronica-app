<script lang="ts">
  // Questions answered wrong, until they are answered right (#/repaso/repasar[/<parte>]).
  import { rotuloParte } from '../../lib/datos';
  import Icono from '../Icono.svelte';
  import Cuestionario from './Cuestionario.svelte';
  import { cargarCuestionario } from './datos';
  import { repaso } from './estado.svelte';

  let { parte = '' }: { parte?: string } = $props();

  // The list as it was when the page opened (answers remove items from the stored list).
  const ids = Object.entries(repaso.fallos)
    .filter(([, f]) => !parte || f.parte === parte)
    .map(([id, f]) => ({ id, parte: f.parte }));

  async function cargar() {
    const partes = [...new Set(ids.map((x) => x.parte))];
    const datos = await Promise.all(partes.map((p) => cargarCuestionario(p).catch(() => null)));
    const quiero = new Set(ids.map((x) => x.id));
    return datos.flatMap((c) => (c ? c.preguntas.filter((p) => quiero.has(p.id)).map((p) => ({ parte: c.parte, p })) : []));
  }
</script>

<header class="rp-cab">
  <a class="rp-volver" href="#/repaso"><Icono nombre="chevron-izq" tam={18} /> Repaso</a>
  <h1 class="rp-titulo">Repasar fallos{parte ? ` · ${rotuloParte(parte)}` : ''}</h1>
  <p class="rp-sub">Las preguntas que ha fallado en los tests. Cada acierto la quita de la lista.</p>
</header>

{#if !ids.length}
  <div class="rp-caja vacio">
    <p>No hay fallos pendientes. Cuando falle una pregunta en un test aparecerá aquí.</p>
    <a class="boton primario" href="#/repaso">Volver al repaso</a>
  </div>
{:else}
  <Cuestionario clave={`repasar:${parte}:${ids.map((x) => x.id).join(',')}`} {cargar} mostrarParte />
{/if}

<style>
  .vacio {
    padding: 22px;
  }
  .vacio p {
    margin: 0 0 14px;
  }
</style>
