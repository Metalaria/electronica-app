<script lang="ts">
  // «Fuentes» tab: credits, licences and how the data were obtained and checked.
  import type { DatosMaquina } from './datos';

  let { datos }: { datos: DatosMaquina } = $props();
</script>

<div class="fuentes">
  <section>
    <h3>Créditos y licencias</h3>
    <ul class="lista">
      {#each datos.fuentes as f (f.titulo)}
        <li>
          <p class="titulo"><strong>{f.titulo}</strong></p>
          <p>{f.autor} · <a href={f.url} target="_blank" rel="noopener noreferrer">{f.url.replace(/^https?:\/\//, '')}</a></p>
          <p class="licencia">Licencia: {f.licencia}</p>
          <p class="uso">{f.uso}</p>
        </li>
      {/each}
    </ul>
  </section>

  <section>
    <h3>Sobre el esquema</h3>
    <p>{datos.aviso}</p>
    {#if datos.equivalencias.length}
      <p class="leyenda">
        Citas: <strong>MV4 h.N</strong>, hoja N de los esquemas de la MVS MV4 (1.ª generación, como la placa de la foto);
        <strong>AES h.N</strong>, hoja N de los esquemas «NEOGEO-2» de SNK (AES de 2.ª generación, misma numeración
        U1–U39 que Board-Folk); <strong>MV4F h.N</strong>, MVS MV4F (2.ª generación); <strong>NG Hw-N</strong>, página
        «Hardware-N» de la especificación de SNK. Los documentos no se incluyen en la aplicación.
      </p>
      <div class="tabla">
        <table>
          <thead><tr><th>Placa de la foto (1.ª generación)</th><th>Esquema NEO-AES3-5</th><th>Señales</th><th>Qué cambia</th><th>Fuente</th></tr></thead>
          <tbody>
            {#each datos.equivalencias as e (e.foto + e.esquema)}
              <tr><td>{e.foto}</td><td>{e.esquema}</td><td>{e.senales ?? ''}</td><td>{e.cambios ?? e.nota ?? ''}</td><td class="cita">{e.fuente ?? ''}</td></tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}
  </section>

  <section>
    <h3>Cómo se han obtenido los datos</h3>
    <ul>
      <li>Las hojas se dibujan con la geometría exacta que exporta KiCad (kicad-cli 7, a partir de copias del proyecto convertidas al formato de KiCad 7 sin cambiar el contenido), reducida a polilíneas de 0,01 mm.</li>
      <li>Las redes se calculan a partir de los ficheros .kicad_sch (cables, uniones, etiquetas, símbolos de alimentación, etiquetas jerárquicas y pines de cada símbolo) y se comprueban contra el netlist que exporta KiCad: ningún grupo de cables mezcla dos redes, todas las redes del netlist aparecen y cada cable coincide con un trazo del dibujo.</li>
      <li>Los puntos de la foto se han colocado mirando la foto a resolución completa; cada ficha dice si la marca del chip se lee o si la pieza se identifica por su posición.</li>
      <li>Los patillajes de neogeodev/SVGPinout (sin licencia) solo se han consultado; no se incluyen en la aplicación.</li>
      {#if datos.id === 'neogeo'}<li>Los chips de 1.ª generación (LSPC-A0, PRO-B0, PRO-C0) y su lógica TTL se han comprobado con los esquemas de la MV4; el mapa de memoria, los registros, las interrupciones y el protocolo de sonido, con la especificación de SNK. Las fichas de la foto dicen qué está comprobado y dónde. Esos documentos tienen copyright de SNK: se citan por hoja y página, sin copiarlos.</li>{/if}
    </ul>
  </section>
</div>

<style>
  .fuentes {
    display: grid;
    gap: 16px;
    max-width: 76em;
  }
  h3 {
    margin: 0 0 8px;
    color: var(--titulos);
    font-size: 18px;
  }
  section {
    padding: 14px 16px;
    border-radius: 12px;
    background: var(--superficie);
    box-shadow:
      0 0 0 1px var(--linea),
      var(--sombra);
  }
  .lista {
    margin: 0;
    padding: 0;
    list-style: none;
    display: grid;
    gap: 12px;
  }
  .lista p {
    margin: 0;
  }
  .licencia {
    color: var(--acento);
    font-weight: 600;
  }
  .uso {
    color: var(--tinta-suave);
  }
  a {
    color: var(--acento);
    overflow-wrap: anywhere;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 14px;
  }
  th,
  td {
    padding: 5px 6px;
    border-top: 1px solid var(--linea-suave);
    text-align: left;
    vertical-align: top;
  }
  th {
    color: var(--tinta-suave);
  }
  .leyenda {
    color: var(--tinta-suave);
    font-size: 14px;
  }
  .tabla {
    overflow-x: auto;
  }
  table {
    min-width: 760px;
    table-layout: fixed;
  }
  th:nth-child(1) {
    width: 17%;
  }
  th:nth-child(2) {
    width: 14%;
  }
  th:nth-child(3) {
    width: 35%;
  }
  th:nth-child(4) {
    width: 22%;
  }
  th:nth-child(5) {
    width: 12%;
  }
  .cita {
    white-space: normal !important;
  }
  .cita {
    white-space: nowrap;
    color: var(--tinta-suave);
    font-size: 13px;
  }
</style>
