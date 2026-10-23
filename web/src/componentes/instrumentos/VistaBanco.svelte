<script lang="ts">
  // One bench: a guided practice, a netlist of the catalogue, or the free bench with a circuit chooser.
  import { onMount, untrack } from 'svelte';
  import { Banco } from './banco.svelte.ts';
  import BancoVista from './banco/Banco.svelte';
  import PanelPractica from './practicas/PanelPractica.svelte';
  import { PRACTICAS } from './practicas/practicas';
  import { DIBUJOS } from './practicas/dibujos';
  import { iniciarPractica, varianteDe } from './practicas/aplicar';
  import { CIRCUITOS } from './practicas/circuitos';
  import type { Fuente } from './esquema/Plano.svelte';
  import { esquemaAutomatico } from './esquema/auto';
  import { leerJSON } from '../../lib/datos';
  import type { DatosFigura } from '../figuras-vivas/tipos';
  import { cargarIndiceSpice, cargarNetlist } from '../../simulador/datos.svelte';
  import { precalentarMotor } from '../../simulador/cliente.svelte';
  import { autoHorizontal } from './motor/osciloscopio.ts';
  import type { IndiceSpice } from '../../simulador/tipos';

  let { tipo, id }: { tipo: string; id: string } = $props();

  const b = new Banco();
  const practica = $derived(tipo === 'practica' ? PRACTICAS.find((p) => String(p.n) === id) : undefined);
  let plano = $state<Fuente | null>(null);
  let indice = $state<IndiceSpice | null>(null);
  let error = $state('');

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
    if (!texto) return;
    void esquemaAutomatico(texto).then((e) => {
      if (n === pedido) plano = e ? { tipo: 'auto', svg: e.svg, vista: e.vista, esquema: e.esquema, mapa: e.mapa } : null;
    });
  });

  // ---------------------------------------------------------------- loading
  async function cargarCatalogo(clave: string) {
    error = '';
    indice ??= await cargarIndiceSpice();
    const n = indice?.netlists[clave];
    if (!n) {
      error = `No se encuentra la netlist ${clave}.`;
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
      error = String(e);
    }
  }

  onMount(() => {
    precalentarMotor();
    if (practica) iniciarPractica(b, practica);
    else if (tipo === 'circuito') void cargarCatalogo(id);
    else {
      b.cargar(CIRCUITOS.p1!, 'Divisor de tensión (práctica 1)');
      b.poner('bmRojo', 'out');
      b.poner('bmNegro', '0');
      void cargarIndiceSpice().then((i) => (indice = i));
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
  const titulo = $derived(practica ? `Práctica ${practica.n} · ${practica.titulo}` : b.titulo || 'Banco de pruebas');
</script>

<div class="cabecera">
  <a class="atras" href="#/instrumentos">← Instrumentos</a>
  <h1>{titulo}</h1>
</div>
{#if error}<p class="error">{error}</p>{/if}

<BancoVista {b} {plano}>
  {#snippet lateral()}
    {#if practica}
      <PanelPractica p={practica} {b} />
    {:else}
      <div class="elegir">
        <h3>Circuito en el banco</h3>
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
        {:else}
          <p class="nota">Cargando el catálogo…</p>
        {/if}
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
      </div>
    {/if}
  {/snippet}
</BancoVista>

<style>
  .cabecera {
    padding: 12px 16px 0;
    max-width: 1500px;
    margin: 0 auto;
    font-family: var(--sans);
  }
  .atras {
    font-size: 14px;
    font-weight: 600;
    text-decoration: none;
  }
  h1 {
    margin: 4px 0 0;
    color: var(--titulos);
    font-size: 22px;
    line-height: 1.2;
  }
  .error {
    color: var(--c-precaucion);
    padding: 0 16px;
    font-family: var(--sans);
  }
  .elegir {
    display: grid;
    gap: 10px;
    font-family: var(--sans);
  }
  .elegir h3 {
    margin: 0;
    font-size: 16px;
    color: var(--titulos);
  }
  .elegir label {
    display: grid;
    gap: 3px;
    font-size: 13px;
    color: var(--tinta-suave);
  }
  .elegir label.fila {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .elegir select,
  .elegir input[type='text'] {
    min-height: 38px;
    border: 1px solid var(--linea);
    border-radius: 8px;
    background: var(--superficie);
    padding: 0 8px;
    font-size: 14px;
  }
  .lista {
    max-height: 240px;
    overflow: auto;
    margin: 0;
    padding: 0 0 0 4px;
    list-style: none;
    font-size: 14px;
  }
  .lista a {
    display: block;
    padding: 7px 4px;
    border-bottom: 1px solid var(--linea-suave);
    text-decoration: none;
  }
  .nota {
    color: var(--tinta-suave);
    font-size: 13px;
  }
</style>
