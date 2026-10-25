<script lang="ts">
  // Panel of the selection: a part (reference, value, package, function from the project README with the
  // book section that explains it, schematic symbol, pads and their nets), a net (pads, DC voltage) or a pad.
  import { app } from '../../lib/estado.svelte';
  import { prepararSalto } from '../../lib/ruta.svelte';
  import type { CapaHoja } from '../consolas/datos';
  import type { Dibujo } from '../consolas/esquema/dibujo';
  import { clasePieza, formatoTension, mm, PAD_NPTH, PAD_PTH, type DatosPlaca } from './datos';
  import type { Seleccion, Vista } from './estado';
  import { dePad, deRed, padsDeRed, type Resuelta } from './seleccion';
  import Simbolo from './Simbolo.svelte';

  let {
    datos,
    res,
    vista,
    esquema = null,
    oscuro,
    elegir,
    irA,
  }: {
    datos: DatosPlaca;
    res: Resuelta;
    vista: Vista;
    esquema?: { dibujo: Dibujo; capa: CapaHoja } | null;
    oscuro: boolean;
    elegir: (s: Seleccion | null, enfocar?: boolean) => void;
    irA: (v: Vista, s: Seleccion | null) => void;
  } = $props();

  const huella = $derived(res.huella !== null ? datos.huellas[res.huella]! : null);
  const red = $derived(res.red !== null ? datos.redes[res.red]! : null);
  const pad = $derived(res.pad !== null ? datos.pads[res.pad]! : null);
  const padsHuella = $derived.by(() => {
    if (!huella) return [] as number[];
    const [a, n] = huella.pads;
    return Array.from({ length: n }, (_, i) => a + i);
  });
  const padsRed = $derived(res.red !== null && !huella ? padsDeRed(datos, res.red) : []);
  const bloque = $derived(huella?.b ? datos.esquema.bloques.find((b) => b.nombre === huella!.b) : null);

  function seccion(label: string): { href: string; texto: string } | null {
    const r = app.refs[label];
    if (!r) return null;
    const tipo = r.tipo === 'fig' ? 'Figura' : r.tipo === 'sec' ? 'Sección' : 'Apartado';
    return { href: `#/${r.parte}/${label}`, texto: `${tipo} ${r.num}` };
  }

  function salto(): void {
    prepararSalto({ texto: 'Volver a la placa' });
  }

  function nombreRed(i: number): string {
    return i >= 0 ? datos.redes[i]!.n : 'sin red';
  }

  const ORIGEN_V: Record<string, string> = {
    anotacion: 'anotada en el esquema del proyecto',
    simulacion: 'punto de trabajo simulado con los modelos SPICE del proyecto',
  };
  const VISTAS_IR: { v: Vista; t: string }[] = [
    { v: '3d', t: 'Ver en 3D' },
    { v: 'placa', t: 'Ver en 2D' },
    { v: 'esquema', t: 'Ver en el esquema' },
  ];
  const sel = $derived<Seleccion | null>(
    pad && huella ? { tipo: 'pad', id: `${huella.r}.${pad[1]}` } : huella ? { tipo: 'huella', id: huella.r } : red ? { tipo: 'red', id: red.n } : null,
  );
</script>

<div class="ficha" aria-live="polite">
  {#if !huella && !red}
    <div class="vacia">
      <p><strong>Toca un componente, un pad, una pista o una red</strong> para ver qué es, su función, su símbolo y sus conexiones.</p>
      <p class="tenue">{datos.huellas.filter((h) => h.t !== 'mec').length} componentes · {datos.redes.filter((r) => r.p >= 2).length} redes · placa de {mm(datos.placa.ancho, 1)} × {mm(datos.placa.alto, 1)} mm, {datos.placa.capas.length} capas de cobre</p>
    </div>
  {:else}
    {#if huella}
      <header>
        <div class="ref">{huella.r}{#if pad}<span class="pin">.{pad[1]}</span>{/if}</div>
        <div class="valor">{huella.v}</div>
        <button type="button" class="cerrar" aria-label="Quitar la selección" onclick={() => elegir(null)}>×</button>
      </header>
      <p class="clase">{clasePieza(huella)} · {huella.l.replace(/_/g, ' ')}{#if huella.lado === 'B'} · cara inferior{/if}{#if huella.dnp} · <strong>sin montar</strong>{/if}</p>
      {#if huella.mpn}<p class="mpn">{huella.mpn}</p>{/if}
      <p class="funcion">{huella.f}</p>
      <p class="origen">
        {huella.fo === 'readme' ? 'Del README del proyecto' : 'Deducido de sus conexiones en la placa'}{#if huella.fr && seccion(huella.fr)}
          · <a href={seccion(huella.fr)!.href} onclick={salto}>Lo explica la {seccion(huella.fr)!.texto.toLowerCase()}</a>{/if}
      </p>
      {#if bloque}
        <p class="bloque">
          Bloque «{bloque.nombre}» del esquema{#if bloque.refs.length}: {#each bloque.refs as l, i (l)}{#if seccion(l)}{i ? ', ' : ' '}<a href={seccion(l)!.href} onclick={salto}>{seccion(l)!.texto.toLowerCase()}</a>{/if}{/each}{/if}
        </p>
      {/if}
      {#if esquema && huella.t !== 'mec'}
        <Simbolo dibujo={esquema.dibujo} capa={esquema.capa} refe={huella.r} red={res.red} {oscuro} />
      {/if}
      {#if pad}
        <div class="pad">
          <h3>Pad {pad[1]}{#if pad[13]} · {pad[13]}{/if}</h3>
          <p>
            {pad[11] & PAD_NPTH ? 'Taladro sin metalizar' : pad[11] & PAD_PTH ? 'Pad pasante metalizado' : 'Pad SMD'} · {mm(pad[5])} × {mm(pad[6])} mm{#if pad[9]} · taladro {mm(pad[9])} mm{/if}
          </p>
          {#if pad[12] >= 0}
            <button type="button" class="red" onclick={() => elegir(deRed(datos, pad[12]), false)}>Red {nombreRed(pad[12])}{#if datos.redes[pad[12]]?.v} · {formatoTension(datos.redes[pad[12]]!.v!.v)}{/if}</button>
          {/if}
        </div>
      {/if}
      {#if padsHuella.length && huella.t !== 'mec'}
        <h3>Pads y redes</h3>
        <ul class="pads">
          {#each padsHuella as i (i)}
            {@const p = datos.pads[i]!}
            <li>
              <button type="button" aria-pressed={res.pad === i} onclick={() => elegir(dePad(datos, i), false)}>
                <span class="n">{p[1]}</span><span class="fn">{p[13]}</span><span class="rn">{nombreRed(p[12])}</span>
              </button>
            </li>
          {/each}
        </ul>
      {/if}
    {:else if red}
      <header>
        <div class="ref">{red.n}</div>
        <button type="button" class="cerrar" aria-label="Quitar la selección" onclick={() => elegir(null)}>×</button>
      </header>
      <p class="clase">Red · {red.p} pads</p>
      {#if red.v}
        <p class="tension"><strong>{formatoTension(red.v.v)}</strong> — {red.v.texto ? `${red.v.texto}, ` : ''}{ORIGEN_V[red.v.origen]}{#if red.v.origen === 'simulacion' && datos.simulacion}{' '}({datos.simulacion.titulo}){/if}.</p>
      {/if}
      <h3>Pads de la red</h3>
      <ul class="pads">
        {#each padsRed as i (i)}
          {@const p = datos.pads[i]!}
          <li>
            <button type="button" onclick={() => elegir(dePad(datos, i), false)}>
              <span class="n">{datos.huellas[p[0]]!.r}.{p[1]}</span><span class="fn">{p[13]}</span><span class="rn">{datos.huellas[p[0]]!.v}</span>
            </button>
          </li>
        {/each}
      </ul>
    {/if}
    <div class="ir">
      {#each VISTAS_IR as x (x.v)}
        {#if x.v !== vista}
          <button type="button" onclick={() => irA(x.v, sel)}>{x.t}</button>
        {/if}
      {/each}
    </div>
  {/if}
</div>

<style>
  .ficha {
    display: grid;
    gap: 8px;
    align-content: start;
    font-size: 15px;
  }
  .vacia p {
    margin: 0 0 8px;
  }
  .tenue,
  .origen,
  .clase,
  .mpn,
  .bloque {
    margin: 0;
    color: var(--tinta-suave);
    font-size: 13px;
  }
  header {
    display: flex;
    align-items: baseline;
    gap: 10px;
  }
  .ref {
    color: var(--titulos);
    font-size: 24px;
    font-weight: 800;
  }
  .pin {
    color: var(--acento);
  }
  .valor {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    font-size: 17px;
    font-weight: 600;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .cerrar {
    min-width: 44px;
    min-height: 44px;
    border: 0;
    border-radius: 10px;
    background: var(--superficie-2);
    color: var(--tinta);
    font-size: 22px;
    cursor: pointer;
  }
  .funcion {
    margin: 0;
    line-height: 1.45;
  }
  .tension {
    margin: 0;
  }
  h3 {
    margin: 6px 0 0;
    color: var(--titulos);
    font-size: 14px;
  }
  .pads {
    display: grid;
    gap: 2px;
    max-height: 280px;
    margin: 0;
    padding: 0;
    overflow: auto;
    list-style: none;
  }
  .pads button {
    display: grid;
    grid-template-columns: 4.2em 1fr auto;
    gap: 8px;
    width: 100%;
    min-height: 36px;
    padding: 4px 8px;
    border: 0;
    border-radius: 8px;
    background: transparent;
    color: var(--tinta);
    font: inherit;
    font-size: 14px;
    text-align: left;
    cursor: pointer;
  }
  .pads button:hover,
  .pads button[aria-pressed='true'] {
    background: var(--acento-tinte);
  }
  .pads .n {
    font-weight: 700;
  }
  .pads .fn {
    color: var(--tinta-suave);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .pads .rn {
    font-family: var(--mono, monospace);
    font-size: 13px;
  }
  .pad {
    padding: 8px 10px;
    border-radius: 10px;
    background: var(--superficie-2);
  }
  .pad p {
    margin: 2px 0 6px;
    font-size: 13px;
  }
  .red {
    min-height: 36px;
    padding: 0 12px;
    border: 1px solid var(--acento-borde);
    border-radius: 999px;
    background: var(--acento-tinte);
    color: var(--acento);
    font: inherit;
    font-weight: 700;
    cursor: pointer;
  }
  .ir {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: 4px;
  }
  .ir button {
    min-height: 40px;
    padding: 0 14px;
    border: 1px solid var(--linea);
    border-radius: 999px;
    background: var(--superficie);
    color: var(--acento);
    font: inherit;
    font-size: 14px;
    font-weight: 700;
    cursor: pointer;
  }
  @media (pointer: coarse) {
    .pads button,
    .red,
    .ir button {
      min-height: 44px;
    }
  }
</style>
