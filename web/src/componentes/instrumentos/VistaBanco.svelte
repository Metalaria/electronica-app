<script lang="ts">
  // One bench: a guided practice, a netlist of the catalogue, or the free bench with a circuit chooser.
  import { onMount, untrack } from 'svelte';
  import { Banco } from './banco.svelte.ts';
  import BancoVista from './banco/Banco.svelte';
  import PanelPractica from './practicas/PanelPractica.svelte';
  import PanelLaboratorio, { type ControlLab } from './practicas/PanelLaboratorio.svelte';
  import { laboratorioDe } from './practicas/laboratorios';
  import { iniciarLaboratorio } from './practicas/laboratorio';
  import { PRACTICAS } from './practicas/practicas';
  import { DIBUJOS } from './practicas/dibujos';
  import { iniciarPractica, varianteDe } from './practicas/aplicar';
  import { CIRCUITOS } from './practicas/circuitos';
  import type { Fuente } from './esquema/Plano.svelte';
  import { esquemaAutomatico } from './esquema/auto';
  import { leerJSON } from '../../lib/datos';
  import type { DatosFigura } from '../figuras-vivas/tipos';
  import { cargarIndiceSpice, cargarNetlist, spice } from '../../simulador/datos.svelte';
  import ErrorCarga from '../ErrorCarga.svelte';
  import { precalentarMotor } from '../../simulador/cliente.svelte';
  import { autoHorizontal } from './motor/osciloscopio.ts';
  import type { IndiceSpice } from '../../simulador/tipos';
  import { circuitoEditor, type CircuitoEditor } from './editor';
  import { tamanoDibujo } from '../figuras-vivas/circuito/proporciones';
  // 1.3 (averias13): the real Brymen in the free bench too (no practice loaded), small, with the same component
  import BrymenReal from './practicas/BrymenReal.svelte';
  import FnirsiReal from './practicas/FnirsiReal.svelte';
  // the recorder of the two real instruments and the FNIRSI–Brymen comparison (folded until opened)
  import RegistroReal from './practicas/RegistroReal.svelte';
  import { simuladoFnirsi } from './practicas/fnirsi-simulado';
  import { brymenReal } from '../../lib/brymen-real/conexion.svelte';
  import { fnirsiReal } from '../../lib/fnirsi-real/conexion.svelte';

  let { tipo, id }: { tipo: string; id: string } = $props();

  const b = new Banco();
  // 1.1: «laboratorio» is the same practice as a guided lab (its bench starts with the instruments not set up)
  const practica = $derived(tipo === 'practica' || tipo === 'laboratorio' ? PRACTICAS.find((p) => String(p.n) === id) : undefined);
  const laboratorio = $derived(tipo === 'laboratorio' && practica ? laboratorioDe(practica.n) : undefined);
  // (2.1: outside the practices the phone opens on the Brymen, as in the mock-up)
  // svelte-ignore state_referenced_locally
  const control = $state<ControlLab>({ guiaBm: null, guiaFn: null, pestana: tipo === 'practica' || tipo === 'laboratorio' ? 'fnirsi' : 'brymen', barra: null });
  /** undefined until the drawing is decided (Banco keeps its place meanwhile). */
  let plano = $state<Fuente | null | undefined>(undefined);
  let indice = $state<IndiceSpice | null>(null);
  let error = $state('');
  /** The circuit or the catalogue did not arrive (no network): «Reintentar». */
  let errorRed = $state(false);
  let errorTexto = $state<unknown>(null);
  /** A circuit of the schematic editor (#/instrumentos/editor, 0.10). */
  let deEditor = $state<CircuitoEditor | null>(null);

  // ---------------------------------------------------------------- drawing of the circuit on the bench
  const figuras = new Map<string, Promise<DatosFigura | null>>();
  function figura(num: string) {
    let p = figuras.get(num);
    if (!p) {
      p = leerJSON<DatosFigura>(`datos/${num}.json`).catch(() => null);
      figuras.set(num, p);
    }
    return p;
  }

  let pedido = 0;
  $effect(() => {
    const p = practica;
    const variante = b.variante;
    const texto = b.texto;
    const n = ++pedido;
    if (p) {
      const v = varianteDe(p, variante);
      if (v.dibujo && DIBUJOS[v.dibujo]) {
        plano = { tipo: 'propio', esquema: DIBUJOS[v.dibujo]! };
        return;
      }
      if (v.figura) {
        const fig = v.figura;
        void figura(fig.num).then((d) => {
          if (n !== pedido) return;
          const e = d?.esquemas?.[0];
          plano = e ? { tipo: 'figura', svg: `fig/${fig.num}.svg`, vista: [0, 0, d!.lienzo.svg.ancho, d!.lienzo.svg.alto], esquema: e, mapa: fig.mapa } : null;
        });
        return;
      }
    }
    if (!texto) {
      // the free bench with no circuit has nothing to draw (said only if none arrives at once: the last circuit used is
      // reloaded in a moment, and the notice flashed before it); a circuit still loading keeps its place
      if (tipo === 'libre')
        setTimeout(() => {
          if (n === pedido) plano = null;
        }, 400);
      return;
    }
    if (deEditor?.plano) {
      plano = deEditor.plano;
      return;
    }
    void esquemaAutomatico(texto).then((e) => {
      if (n === pedido) plano = e ? { tipo: 'auto', svg: e.svg, vista: e.vista, esquema: e.esquema, mapa: e.mapa } : null;
    });
  });

  // ---------------------------------------------------------------- loading
  async function cargarCatalogo(clave: string) {
    error = '';
    errorRed = false;
    indice ??= await cargarIndiceSpice();
    const n = indice?.netlists[clave];
    if (!n) {
      // no network is not a missing netlist: «Reintentar» instead of a dead end
      if (spice.fallo) errorRed = true;
      else error = `No se encuentra la netlist ${clave}.`;
      return;
    }
    try {
      const texto = await cargarNetlist(n);
      b.cargar(texto, n.titulo || n.nombre);
      b.variante = '';
      b.fuenteGenerador = null;
      // Oscilloscope probe on the first node that is not ground, multimeter across it.
      const nodo = b.circuito.nodos.find((x) => /out|sal|o1|vo/i.test(x)) ?? b.circuito.nodos[b.circuito.nodos.length - 1] ?? null;
      b.poner('ch1', nodo);
      b.poner('bmRojo', nodo);
      b.poner('bmNegro', '0');
      const f = b.fnirsi;
      f.elegirModo('osc');
      const fs = b.circuito.variables.map((v) => v.frecuencia).filter((x): x is number => !!x && x > 0);
      if (fs.length) f.sDiv = autoHorizontal(Math.min(...fs));
      else if (b.circuito.tran) f.sDiv = autoHorizontal(12 / b.circuito.tran.fin);
    } catch (e) {
      errorRed = true;
      errorTexto = e;
    }
  }

  /** The catalogue of the free bench, again after a failed load. */
  function cargarLista() {
    void cargarIndiceSpice().then((i) => (indice = i));
  }

  onMount(() => {
    precalentarMotor();
    if (practica && laboratorio) iniciarLaboratorio(b, practica, laboratorio);
    else if (practica) iniciarPractica(b, practica);
    else if (tipo === 'circuito') void cargarCatalogo(id);
    else if (tipo === 'editor') {
      const c = circuitoEditor();
      if (!c) {
        error = 'No hay ningún circuito del editor que medir: abra el editor y pulse «Medir».';
        return;
      }
      deEditor = c;
      b.cargar(c.texto, c.titulo, { dinamico: true });
      b.arranque = true;
      b.poner('bmNegro', '0');
    }
    else {
      b.cargar(CIRCUITOS.p1!, 'Divisor de tensión (práctica 1)');
      b.poner('bmRojo', 'out');
      b.poner('bmNegro', '0');
      cargarLista();
    }
  });

  // Outside the practices, the oscilloscope starts with AUTO once the first result arrives.
  let autoHecho = false;
  $effect(() => {
    if (b.version > 0 && !autoHecho && !practica) {
      autoHecho = true;
      untrack(() => b.fnirsi.pulsarAuto(b.entradasOsc().entradas, b.plan.fBase));
    }
  });

  // ---------------------------------------------------------------- free bench: chooser
  let capitulo = $state('cap22');
  const lista = $derived(indice?.capitulos.find((c) => c.parte === capitulo)?.netlists ?? []);
  /** The simulated Brymen's reading, next to the real one's (as in a practice). */
  const simuladoBm = $derived.by(() => {
    void b.tic;
    const l = b.brymen.pantalla.principal;
    return l && b.vigente ? (l.ol ? 'OL' : `${l.texto.replace('-', '−').replace('.', ',')} ${l.unidad}`) : null;
  });
  /** 1.4: the simulated FNIRSI's values, next to the real one's. */
  const simuladoFn = $derived.by(() => {
    void b.tic;
    return simuladoFnirsi(b);
  });
  // 2.1: the title block of the bench (Banco.svelte draws it): the short line above and the name.
  const antetitulo = $derived(laboratorio && practica ? `Laboratorio ${practica.n}` : practica ? `Práctica ${practica.n}` : deEditor ? 'Medir el circuito del editor' : 'Banco');
  const titulo = $derived(practica ? practica.titulo : b.titulo || 'Banco de pruebas');

  // 2.1: «Cambiar de circuito» and «Usar un aparato real» open their panel under the title (one at a time); the real
  // instruments' panel starts open when one of them is already connected.
  const hayReal = brymenReal.disponible || fnirsiReal.disponible;
  let abierto = $state<'circuito' | 'real' | null>(brymenReal.estado !== 'desconectado' || fnirsiReal.estado !== 'desconectado' ? 'real' : null);
  function abrir(q: 'circuito' | 'real') {
    abierto = abierto === q ? null : q;
    if (q === 'circuito' && !indice) cargarLista();
  }
</script>

<!-- 0.12 QA: a book circuit's drawing size is known beforehand (its place is kept exactly) -->
<BancoVista
  {b}
  {plano}
  {titulo}
  {antetitulo}
  volver={deEditor ? { href: deEditor.volver, texto: '← Editor' } : null}
  tamano={tipo === 'circuito' ? tamanoDibujo(id, 'banco') : undefined}
  guiaBm={control.guiaBm}
  guiaFn={control.guiaFn}
  bind:pestana={control.pestana}
  lateralArriba={!!(practica && laboratorio)}
  barra={practica && laboratorio ? control.barra : null}
  acciones={practica ? undefined : accionesBanco}
  extra={!practica && (deEditor || abierto) ? extraBanco : undefined}
  plegables={practica ? undefined : plegablesBanco}
  lateral={practica ? lateralPractica : undefined}
/>
{#if error}<p class="error">{error}</p>{/if}
{#if errorRed}<div class="error-red"><ErrorCarga titulo="No se pudo cargar el circuito." error={errorTexto} reintentar={() => void cargarCatalogo(id)} /></div>{/if}

{#snippet lateralPractica()}
  {#if practica && laboratorio}
    <PanelLaboratorio p={practica} lab={laboratorio} {b} {control} />
  {:else if practica}
    <PanelPractica p={practica} {b} />
  {/if}
{/snippet}

{#snippet accionesBanco()}
  {#if !deEditor}
    <button type="button" class="boton" aria-expanded={abierto === 'circuito'} aria-controls="banco-elegir" onclick={() => abrir('circuito')} data-cambiar-circuito>Cambiar de circuito</button>
  {/if}
  {#if hayReal}
    <button type="button" class="boton" aria-expanded={abierto === 'real'} aria-controls="banco-real" onclick={() => abrir('real')} data-usar-aparato-real>Usar un aparato real</button>
  {/if}
{/snippet}

{#snippet extraBanco()}
  {#if deEditor}
    <p class="nota">El circuito es el del editor tal como estaba al pulsar «Medir»; los cambios se hacen allí. Elija una punta en «Puntas puestas» y toque un nodo del dibujo para ponerla.</p>
  {/if}
  {#if abierto === 'circuito' && !deEditor}
    <section class="elegir" id="banco-elegir" aria-labelledby="banco-elegir-titulo">
      <h2 class="etiqueta21" id="banco-elegir-titulo">Cambiar de circuito</h2>
      {#if indice}
        <label
          >Capítulo
          <select bind:value={capitulo}>
            {#each indice.capitulos as c (c.parte)}<option value={c.parte}>{c.num ? `${c.num}. ` : ''}{c.titulo}</option>{/each}
          </select>
        </label>
        <ul class="lista">
          {#each lista as k (k)}
            {@const n = indice.netlists[k]}
            {#if n && n.motor.estado !== 'no-disponible' && !n.motor.pesada}
              <li><a href={`#/instrumentos/circuito/${k}`}>{n.titulo || n.nombre}</a></li>
            {/if}
          {/each}
        </ul>
      {:else if spice.fallo}
        <ErrorCarga titulo="No se pudo cargar el catálogo de circuitos." reintentar={cargarLista} />
      {:else}
        <p class="nota">Cargando el catálogo…</p>
      {/if}
    </section>
  {/if}
  {#if abierto === 'real'}
    <section class="elegir" id="banco-real" aria-labelledby="banco-real-titulo">
      <h2 class="etiqueta21" id="banco-real-titulo">Aparatos reales</h2>
      <BrymenReal compacto simulado={simuladoBm} sinConectar="Sin conectar: el banco usa el Brymen simulado." />
      <FnirsiReal compacto simulado={simuladoFn} sinConectar="Sin conectar: el banco usa el FNIRSI simulado (el real necesita su firmware con el enlace USB)." />
    </section>
  {/if}
{/snippet}

{#snippet plegablesBanco()}
  <RegistroReal />
  <details class="plegable21" data-plegable="diagnostico">
    <summary>Diagnóstico</summary>
    <div class="plegable21-cuerpo ajustes">
      <label
        >Fuente que excita el generador DDS
        <select value={b.fuenteGenerador ?? ''} onchange={(e) => (b.fuenteGenerador = (e.currentTarget as HTMLSelectElement).value || null)}>
          <option value="">Ninguna (las fuentes de la netlist)</option>
          {#each b.circuito.fuentesV as f (f)}<option value={f}>{f}</option>{/each}
        </select>
      </label>
      <label
        >Tiempo de asentamiento antes de medir (s)
        <input type="text" inputmode="decimal" value={String(b.asentamiento).replace('.', ',')} onchange={(e) => { const v = Number((e.currentTarget as HTMLInputElement).value.replace(',', '.')); if (Number.isFinite(v) && v >= 0) b.asentamiento = v; }} />
      </label>
      <label class="fila"><input type="checkbox" bind:checked={b.dinamico} /> Simular en el tiempo aunque no haya fuentes variables (osciladores)</label>
      {#if b.datos}<p class="nota">Última simulación: {b.datos.ms} ms.</p>{/if}
    </div>
  </details>
{/snippet}

<style>
  .error {
    color: var(--v11-mal-texto);
    padding: 0 var(--e21-margen);
    font-family: var(--sans);
  }
  .error-red {
    padding: 0 var(--e21-margen);
  }
  .elegir,
  .ajustes {
    display: grid;
    /* 1.0 (reflow at 320–360 px): a <select> is as wide as its longest option; the column may shrink */
    grid-template-columns: minmax(0, 1fr);
    gap: 12px;
    max-width: 720px;
    font-family: var(--sans);
  }
  .elegir label,
  .ajustes label {
    display: grid;
    gap: 4px;
    font-size: 13px;
    color: var(--v11-tinta-suave);
  }
  .ajustes label.fila {
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: 44px;
    font-size: 15px;
  }
  .elegir select,
  .ajustes select,
  .ajustes input[type='text'] {
    min-width: 0;
    max-width: 100%;
    min-height: 44px;
    border: 1px solid var(--v11-linea);
    border-radius: 12px;
    background: transparent;
    color: var(--v11-tinta);
    padding: 0 10px;
    font-size: 15px;
  }
  .lista {
    max-height: 280px;
    overflow: auto;
    margin: 0;
    padding: 0;
    list-style: none;
    font-size: 15px;
  }
  .lista a {
    display: flex;
    align-items: center;
    min-height: 44px;
    border-bottom: 1px solid var(--v11-linea);
    text-decoration: none;
  }
  .nota {
    margin: 0;
    color: var(--v11-tinta-suave);
    font-size: 15px;
  }
</style>
