<script lang="ts">
  // What was checked when the data were generated (contenido/proyectos_kicad.py) and what does not agree
  // between the PCB, the schematic, the bill of materials, the README and the book: candidates for the errata.
  import { app } from '../../lib/estado.svelte';
  import type { DatosPlaca, IndiceProyectos, Proyecto } from './datos';
  import { mm } from './datos';

  let { datos, proyecto, indice }: { datos: DatosPlaca; proyecto: Proyecto; indice: IndiceProyectos } = $props();

  const erratas = $derived(indice.erratas.filter((e) => e.placa === datos.id || e.placa === proyecto.id));
  const figura = $derived(app.refs[proyecto.figura]);
  const ICONO = { ok: '✓', aviso: '!', error: '×' } as const;
</script>

<div class="comp">
  <section>
    <h2>Comprobaciones de esta placa</h2>
    <ul class="lista">
      {#each datos.comprobaciones as c, i (i)}
        <li class={c.tipo}>
          <span class="i" aria-label={c.tipo === 'ok' ? 'Correcto' : c.tipo === 'aviso' ? 'Aviso' : 'Error'}>{ICONO[c.tipo]}</span>
          <div>
            {c.texto}
            {#if c.detalle?.length}
              <ul class="detalle">{#each c.detalle as d (d)}<li>{d}</li>{/each}</ul>
            {/if}
          </div>
        </li>
      {/each}
    </ul>
  </section>

  {#if erratas.length}
    <section>
      <h2>Posibles erratas para la próxima edición</h2>
      <ul class="lista">
        {#each erratas as e, i (i)}
          <li class="aviso"><span class="i">!</span><div>{e.texto}</div></li>
        {/each}
      </ul>
    </section>
  {/if}

  <section>
    <h2>Fabricación</h2>
    <dl>
      <dt>Placa</dt><dd>{mm(datos.placa.ancho, 2)} × {mm(datos.placa.alto, 2)} mm, {datos.placa.capas.length} capas de cobre de {datos.placa.cobre_um} µm, FR-4 de {String(datos.placa.grosor).replace('.', ',')} mm</dd>
      <dt>Máscara</dt><dd>{datos.placa.mascara} ({datos.placa.mascara_fuente})</dd>
      <dt>Serigrafía</dt><dd>{datos.placa.serigrafia}</dd>
      <dt>Acabado</dt><dd>{datos.placa.acabado ?? 'no indicado (se muestra estañado HASL)'}</dd>
      <dt>Apilado</dt><dd>{datos.placa.apilado}</dd>
      <dt>README</dt><dd>«{datos.placa.fabricacion}»</dd>
    </dl>
  </section>

  <section>
    <h2>Fuentes</h2>
    <p>
      Proyecto KiCad 7 de <code>{proyecto.carpeta}</code> (<code>{datos.archivo}</code>, su esquema, su lista de materiales y su README), del
      material complementario del libro{#if figura}, figura <a href={`#/${figura.parte}/${proyecto.figura}`}>{figura.num}</a>{/if}. La
      lista de redes del esquema se ha exportado con <code>kicad-cli sch export netlist</code>, el dibujo del esquema con
      <code>kicad-cli sch export svg</code> y la serigrafía con <code>kicad-cli pcb export svg</code>; el cobre, los pads, las vías y los
      planos salen del propio <code>.kicad_pcb</code>. La función de cada componente es la del README del proyecto o, si no la cita, la
      que se deduce de sus conexiones.
    </p>
  </section>
</div>

<style>
  .comp {
    display: grid;
    gap: 18px;
    max-width: 920px;
    padding: 6px 0 20px;
  }
  h2 {
    margin: 0 0 8px;
    color: var(--titulos);
    font-size: 18px;
  }
  .lista {
    display: grid;
    gap: 6px;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .lista > li {
    display: grid;
    grid-template-columns: 26px 1fr;
    gap: 8px;
    align-items: start;
    padding: 8px 10px;
    border-radius: 10px;
    background: var(--superficie-2);
    font-size: 14px;
  }
  .i {
    display: inline-grid;
    place-items: center;
    width: 22px;
    height: 22px;
    border-radius: 50%;
    color: #fff;
    font-weight: 800;
    font-size: 13px;
  }
  .ok .i {
    background: #2e7d32;
  }
  .aviso .i {
    background: #b26a00;
  }
  .error .i {
    background: #c62828;
  }
  .detalle {
    margin: 4px 0 0;
    padding-left: 18px;
    color: var(--tinta-suave);
    font-size: 13px;
  }
  dl {
    display: grid;
    grid-template-columns: max-content 1fr;
    gap: 4px 14px;
    margin: 0;
    font-size: 14px;
  }
  dt {
    color: var(--tinta-suave);
    font-weight: 700;
  }
  dd {
    margin: 0;
  }
  p {
    font-size: 14px;
    line-height: 1.5;
  }
</style>
