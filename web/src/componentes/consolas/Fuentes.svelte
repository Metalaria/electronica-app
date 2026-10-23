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
      <table>
        <thead><tr><th>Placa de la foto (1.ª generación)</th><th>Esquema NEO-AES3-5</th><th>Nota</th></tr></thead>
        <tbody>
          {#each datos.equivalencias as e (e.foto)}
            <tr><td>{e.foto}</td><td>{e.esquema}</td><td>{e.nota}</td></tr>
          {/each}
        </tbody>
      </table>
    {/if}
  </section>

  <section>
    <h3>Cómo se han obtenido los datos</h3>
    <ul>
      <li>Las hojas se dibujan con la geometría exacta que exporta KiCad (kicad-cli 7, a partir de copias del proyecto convertidas al formato de KiCad 7 sin cambiar el contenido), reducida a polilíneas de 0,01 mm.</li>
      <li>Las redes se calculan a partir de los ficheros .kicad_sch (cables, uniones, etiquetas, símbolos de alimentación, etiquetas jerárquicas y pines de cada símbolo) y se comprueban contra el netlist que exporta KiCad: ningún grupo de cables mezcla dos redes, todas las redes del netlist aparecen y cada cable coincide con un trazo del dibujo.</li>
      <li>Los puntos de la foto se han colocado mirando la foto a resolución completa; cada ficha dice si la marca del chip se lee o si la pieza se identifica por su posición.</li>
      <li>Los patillajes de neogeodev/SVGPinout (sin licencia) solo se han consultado; no se incluyen en la aplicación.</li>
    </ul>
  </section>
</div>

<style>
  .fuentes {
    display: grid;
    gap: 16px;
    max-width: 60em;
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
  @media (max-width: 599px) {
    table {
      display: block;
      overflow-x: auto;
    }
  }
</style>
