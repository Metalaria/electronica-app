<script lang="ts">
  // «Fuentes» tab: credits, licences and how the data were obtained and checked.
  import { htmlKicad, type DatosMaquina } from './datos';
  import PlacaFuentes from './placa/PlacaFuentes.svelte';

  let { datos }: { datos: DatosMaquina } = $props();

  // Full licence texts (nonSNES, GPL-3.0) are fetched only when the reader opens them.
  const textos = $state<Record<string, string>>({});
  function abrirTexto(ruta: string, e: Event): void {
    if (!(e.currentTarget as HTMLDetailsElement).open || textos[ruta]) return;
    textos[ruta] = 'Cargando…';
    fetch(ruta)
      .then((r) => (r.ok ? r.text() : Promise.reject(new Error(String(r.status)))))
      .then((t) => (textos[ruta] = t))
      .catch((err: unknown) => (textos[ruta] = `No se pudo cargar el texto (${String(err)}).`));
  }
  const cabecera = $derived(datos.equivalencias_cabecera ?? ['Placa de la foto (1.ª generación)', 'Esquema NEO-AES3-5', 'Señales', 'Qué cambia', 'Fuente']);
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
          {#if f.texto}
            {@const ruta = f.texto}
            <details class="texto-licencia" ontoggle={(e) => abrirTexto(ruta, e)}>
              <summary>Texto completo de la licencia</summary>
              <pre>{textos[ruta] ?? ''}</pre>
            </details>
          {/if}
        </li>
      {/each}
    </ul>
  </section>

  <PlacaFuentes maquina={datos.id} />

  {#await import('./fotograma/FotogramaFuentes.svelte') then m}<m.default maquina={datos.id} />{/await}

  {#if datos.revisiones?.length}
    <section>
      <h3>Qué revisión muestra cada vista</h3>
      <div class="tabla">
        <table class="revisiones">
          <thead><tr><th>Vista</th><th>Placa o revisión</th><th>Fuente</th></tr></thead>
          <tbody>
            {#each datos.revisiones as r (r.vista)}<tr><td><strong>{r.vista}</strong></td><td>{r.revision}</td><td class="cita">{r.fuente}</td></tr>{/each}
          </tbody>
        </table>
      </div>
    </section>
  {/if}

  <section>
    <h3>Sobre el esquema</h3>
    <p>{datos.aviso}</p>
    {#if datos.equivalencias.length}
      {#if datos.citas}
        <p class="leyenda">{datos.citas}</p>
      {:else}
        <p class="leyenda">
          Citas: <strong>MV4 h.N</strong>, hoja N de los esquemas de la MVS MV4 (1.ª generación, como la placa de la foto);
          <strong>AES h.N</strong>, hoja N de los esquemas «NEOGEO-2» de SNK (AES de 2.ª generación, misma numeración
          U1–U39 que Board-Folk); <strong>MV4F h.N</strong>, MVS MV4F (2.ª generación); <strong>NG Hw-N</strong>, página
          «Hardware-N» de la especificación de SNK. Los documentos no se incluyen en la aplicación.
        </p>
      {/if}
      <div class="tabla">
        <table>
          <thead><tr>{#each cabecera as c (c)}<th>{c}</th>{/each}</tr></thead>
          <tbody>
            {#each datos.equivalencias as e (e.foto + e.esquema)}
              <tr><td>{e.foto}</td><td>{e.esquema}</td><td>{e.senales ?? ''}</td><td>{e.cambios ?? e.nota ?? ''}</td><td class="cita">{e.fuente ?? ''}</td></tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}
  </section>

  {#if datos.notas?.length}
    <section>
      <h3>{datos.id === 'sms' ? 'Lecturas dudosas o deducidas de la transcripción' : 'Notas de la reconstrucción'}</h3>
      <ul class="notas">
        {#each datos.notas as n, i (i)}
          <li><strong>{n.ref}{n.pin && n.pin !== '?' ? `.${n.pin}` : ''}</strong>: {@html htmlKicad(n.texto)}</li>
        {/each}
      </ul>
    </section>
  {/if}

  <section>
    <h3>Cómo se han obtenido los datos</h3>
    <ul>
      {#if datos.id === 'sms'}<li>El esquema del Master System II no existe en KiCad: se ha transcrito a mano de las tres hojas escaneadas del manual de Sega (componentes, valores, números y nombres de pin, conexiones por cable y por nombre de bus) y se ha generado un KiCad limpio con una etiqueta de red en cada pin. La transcripción comprueba que cada chip tiene todas sus patillas (Z80 40, VDP 64, 315-5237 48, memorias 28, CXA1145 24, ranura 50) y que ninguna red tiene un solo pin.</li>{/if}
      {#if datos.id === 'gbc'}<li>El esquema de la CGB-CPU-04 solo se publica como PDF: el dibujo es el del PDF y las redes salen de sus trazos (cables verdes, puntos de unión, patillas de cada símbolo) unidas por los nombres que KiCad guarda en las ventanas emergentes de cada cable y de cada símbolo. Se ha comprobado con la recreación opengbc (tabla de arriba).</li>{/if}
      {#if datos.id === 'megadrive'}<li>Las huellas de la PCB de stonedDiscord se han llevado a las dos fotos, así que cualquier componente del esquema se puede señalar aunque no tenga recuadro. En la VA6 de EE. UU., hecha de frente, basta una escala (5,32 px/mm) y un desplazamiento. La VA6.8 PAL está fotografiada en ángulo: se ha ajustado una homografía con una corrección cuadrática a 18 puntos (taladros de montaje y patas de los chips), con un error de unos 10 px que llega a 20 en el borde izquierdo.</li>{/if}
      {#if datos.id === 'snes'}<li>Las fotos no llevan recuadros dibujados a mano: cada recuadro es la huella de su pieza en la PCB de nonSNES llevada a la foto con un ajuste afín a las vías y taladros que se ven en ella (792 en la cara de componentes, con un error mediano de 1,6 px en el escaneo original de 300 ppp; 44 en la de soldadura, 3,1 px). Así cualquier componente del esquema se puede señalar en la foto de su cara.</li>{/if}
      {#if datos.id === 'gb'}<li>Las pistas resaltadas sobre el escaneo son el dibujo por redes de Gekkio (un trazo relleno por red, en la cuadrícula del escaneo), reducido a la resolución de la foto.</li>{/if}
      {#if datos.id !== 'gbc'}<li>Las hojas se dibujan con la geometría exacta que exporta KiCad (kicad-cli 7, a partir de copias del proyecto convertidas al formato de KiCad 7 sin cambiar el contenido), reducida a polilíneas de 0,01 mm.</li>
      <li>Las redes se calculan a partir de los ficheros .kicad_sch (cables, uniones, etiquetas, símbolos de alimentación, etiquetas jerárquicas y pines de cada símbolo) y se comprueban contra el netlist que exporta KiCad: ningún grupo de cables mezcla dos redes, todas las redes del netlist aparecen y cada cable coincide con un trazo del dibujo.</li>{/if}
      {#if datos.id !== 'snes'}<li>Los puntos de la foto se han colocado mirando la foto a resolución completa; cada ficha dice si la marca del chip se lee o si la pieza se identifica por su posición.</li>{/if}
      {#if datos.id === 'neogeo'}<li>Los patillajes de neogeodev/SVGPinout (sin licencia) solo se han consultado; no se incluyen en la aplicación.</li>{/if}
      {#if datos.id === 'neogeo'}<li>Los chips de 1.ª generación (LSPC-A0, PRO-B0, PRO-C0) y su lógica TTL se han comprobado con los esquemas de la MV4; el mapa de memoria, los registros, las interrupciones y el protocolo de sonido, con la especificación de SNK. Las fichas de la foto dicen qué está comprobado y dónde. Esos documentos tienen copyright de SNK: se citan por hoja y página, sin copiarlos.</li>{/if}
    </ul>
  </section>
</div>

<style>
  .fuentes {
    display: grid;
    /* minmax(0, …): the wide tables scroll inside .tabla instead of widening the page */
    grid-template-columns: minmax(0, 1fr);
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
  .texto-licencia summary {
    min-height: 32px;
    color: var(--acento);
    font-weight: 600;
    cursor: pointer;
  }
  .texto-licencia pre {
    max-height: 22em;
    margin: 6px 0 0;
    padding: 10px 12px;
    overflow: auto;
    border-radius: 8px;
    background: var(--superficie-2);
    color: var(--tinta);
    font-size: 12px;
    line-height: 1.45;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
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
  .notas {
    margin: 0;
    padding-left: 1.2em;
    display: grid;
    gap: 4px;
  }
  .notas :global(.sobre) {
    text-decoration: overline;
  }
  table.revisiones {
    min-width: 520px;
  }
  table.revisiones th:nth-child(1) {
    width: 16%;
  }
  table.revisiones th:nth-child(2) {
    width: 56%;
  }
  table.revisiones th:nth-child(3) {
    width: 28%;
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
