<script lang="ts">
  // Quiz of one chapter or appendix (#/repaso/test/<parte>).
  import { infoParte, rotuloParte } from '../../lib/datos';
  import Icono from '../Icono.svelte';
  import Cuestionario from './Cuestionario.svelte';
  import { cargarCuestionario } from './datos';
  import { registrarTest, repaso } from './estado.svelte';

  let { parte }: { parte: string } = $props();

  const info = $derived(infoParte(parte));
  const titulo = $derived((info?.titulo ?? parte).split(' — ')[0]);
  const previo = $derived(repaso.tests[parte]);

  async function cargar() {
    const c = await cargarCuestionario(parte);
    return c.preguntas.map((p) => ({ parte, p }));
  }
</script>

<header class="rp-cab">
  <a class="rp-volver" href="#/repaso"><Icono nombre="chevron-izq" tam={18} /> Repaso</a>
  <h1 class="rp-titulo">Test · {rotuloParte(parte)}</h1>
  <p class="rp-sub">
    {titulo}
    {#if previo} · mejor resultado {Math.round(previo.mejor * 100)} % en {previo.intentos} {previo.intentos === 1 ? 'intento' : 'intentos'}{/if}
  </p>
</header>

<Cuestionario clave={`test:${parte}`} {cargar} alTerminar={(a, t) => registrarTest(parte, a, t)} />
