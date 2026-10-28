<script lang="ts">
  // Properties of the selection: designator, value (Spanish engineering notation, checked as it is typed),
  // model, source waveform; or the circuit's title when nothing is selected.
  import { formatoCorto } from '../grafica/formato.ts';
  import { tipoDe, ES_CONEXION, type Campo } from './catalogo.ts';
  import { definidos, modelosDe } from './modelos.ts';
  import type { EdicionPropiedades } from './estado.svelte';
  import { leerValor } from './valores.ts';
  import RotateCw from '@lucide/svelte/icons/rotate-cw';
  import FlipHorizontal from '@lucide/svelte/icons/flip-horizontal-2';
  import Trash from '@lucide/svelte/icons/trash-2';
  import CopyPlus from '@lucide/svelte/icons/copy-plus';

  let { ed }: { ed: EdicionPropiedades } = $props();

  const c = $derived(ed.unico);
  const tipo = $derived(c ? tipoDe(c) : null);
  const cable = $derived(ed.sel.length === 1 && !c ? ed.doc.cables.find((w) => w.id === ed.sel[0]) : undefined);
  const redCable = $derived(cable ? ed.con.redes[ed.con.redDeCable.get(cable.id) ?? -1]?.nombre : undefined);

  /** Text being typed per field (validated live, written to the document on change). */
  let borrador = $state<Record<string, string>>({});
  $effect(() => {
    void c?.id;
    borrador = {};
  });

  function texto(k: string): string {
    return borrador[k] ?? c?.campos[k] ?? '';
  }

  function aviso(f: Campo): string {
    if (f.tipo !== 'valor') return '';
    const t = texto(f.id);
    const l = leerValor(t, f.unidad ?? '', { vacio: !!f.opcional });
    if (!l.ok) return l.error;
    return '';
  }

  function lectura(f: Campo): string {
    if (f.tipo !== 'valor') return '';
    const l = leerValor(texto(f.id), f.unidad ?? '', { vacio: true });
    if (!l.ok || l.v == null) return '';
    return f.unidad === '%' ? `${String(l.v).replace('.', ',')} %` : `= ${formatoCorto(l.v, f.unidad ?? '')}`;
  }

  function guardar(k: string) {
    if (!c || borrador[k] == null) return;
    ed.cambiarCampo(c.id, k, borrador[k]!.trim());
    const { [k]: _, ...resto } = borrador;
    void _;
    borrador = resto;
  }

  function modelos(f: Campo): [string, string][] {
    const lib = f.familia ? modelosDe(f.familia).map((m) => [m.nombre, m.descripcion] as [string, string]) : [];
    const propios = [...definidos(ed.doc.directivas)].filter((n) => !lib.some(([x]) => x.toLowerCase() === n)).map((n) => [n, `${n} (de las directivas)`] as [string, string]);
    const actual = c?.campos[f.id] ?? '';
    const todos = [...lib, ...propios];
    if (actual && !todos.some(([x]) => x.toLowerCase() === actual.toLowerCase())) todos.push([actual, `${actual} (no definido)`]);
    return todos;
  }

  let nombre = $state('');
  $effect(() => {
    nombre = c?.nombre ?? '';
  });
  const nombreRepetido = $derived(
    !!c && !!nombre.trim() && ed.doc.componentes.some((x) => x.id !== c.id && x.nombre.trim().toUpperCase() === nombre.trim().toUpperCase()),
  );

  function teclaIntro(ev: KeyboardEvent, fn: () => void) {
    if (ev.key === 'Enter' && !(ev.target instanceof HTMLTextAreaElement)) {
      ev.preventDefault();
      fn();
      (ev.target as HTMLElement).blur();
    }
  }

  const pinesSueltos = $derived.by(() => {
    if (!c) return [];
    return ed.nl.avisos.filter((a) => a.id === c.id).map((a) => a.texto);
  });
  const errores = $derived(c ? ed.nl.errores.filter((a) => a.id === c.id).map((a) => a.texto) : []);
</script>

<section class="propiedades" aria-label="Propiedades">
  {#if c && tipo}
    <header>
      <h3>{tipo.nombre}</h3>
      <div class="acciones">
        <button type="button" class="boton-icono" title="Girar 90° (R)" aria-label="Girar" onclick={() => ed.transformar([c.id], 'girar')}><RotateCw size={18} /></button>
        <button type="button" class="boton-icono" title="Reflejar (X)" aria-label="Reflejar" onclick={() => ed.transformar([c.id], 'reflejar')}><FlipHorizontal size={18} /></button>
        <button type="button" class="boton-icono" title="Duplicar (Ctrl D)" aria-label="Duplicar" onclick={() => ed.duplicar()}><CopyPlus size={18} /></button>
        <button type="button" class="boton-icono" title="Borrar (Supr)" aria-label="Borrar" onclick={() => ed.borrar()}><Trash size={18} /></button>
      </div>
    </header>
    {#if !ES_CONEXION.has(c.tipo)}
      <label class="campo">
        <span>Nombre</span>
        <input
          type="text"
          name="nombre"
          bind:value={nombre}
          autocomplete="off"
          spellcheck="false"
          onchange={() => nombre.trim() && ed.renombrar(c.id, nombre.trim())}
          onkeydown={(e) => teclaIntro(e, () => nombre.trim() && ed.renombrar(c.id, nombre.trim()))}
        />
        {#if nombreRepetido}<small class="mal">Ya hay otro componente con ese nombre.</small>{/if}
      </label>
    {/if}
    {#each tipo.campos as f (f.id)}
      {#if !f.si || f.si(c)}
        <label class="campo">
          <span>{f.etiqueta}{#if f.unidad && f.unidad !== '%' && f.tipo === 'valor'}<em>&nbsp;({f.unidad || 'sin unidad'})</em>{/if}</span>
          {#if f.tipo === 'opcion'}
            <select name={f.id} value={c.campos[f.id] ?? f.opciones?.[0]?.[0]} onchange={(e) => ed.cambiarCampo(c.id, f.id, (e.currentTarget as HTMLSelectElement).value)}>
              {#each f.opciones ?? [] as [v, t] (v)}<option value={v}>{t}</option>{/each}
            </select>
          {:else if f.tipo === 'modelo'}
            <select name={f.id} value={c.campos[f.id] ?? ''} onchange={(e) => ed.cambiarCampo(c.id, f.id, (e.currentTarget as HTMLSelectElement).value)}>
              {#each modelos(f) as [v, t] (v)}<option value={v}>{t}</option>{/each}
            </select>
          {:else if f.tipo === 'pwl' || (f.tipo === 'texto' && (f.id === 'resto' || f.id === 'spec'))}
            <textarea
              name={f.id}
              rows="3"
              spellcheck="false"
              value={texto(f.id)}
              oninput={(e) => (borrador[f.id] = (e.currentTarget as HTMLTextAreaElement).value)}
              onchange={() => guardar(f.id)}
            ></textarea>
          {:else}
            <input
              type="text"
              name={f.id}
              inputmode={f.tipo === 'valor' ? 'decimal' : 'text'}
              autocomplete="off"
              spellcheck="false"
              placeholder={f.opcional ? 'opcional' : ''}
              value={texto(f.id)}
              class:invalido={!!aviso(f)}
              oninput={(e) => (borrador[f.id] = (e.currentTarget as HTMLInputElement).value)}
              onchange={() => guardar(f.id)}
              onkeydown={(e) => teclaIntro(e, () => guardar(f.id))}
            />
          {/if}
          {#if aviso(f)}<small class="mal">{aviso(f)}</small>{:else if lectura(f)}<small>{lectura(f)}</small>{:else if f.ayuda}<small>{f.ayuda}</small>{/if}
        </label>
      {/if}
    {/each}
    {#if c.tipo === 'GEN'}
      <p class="nota">Componente importado de la netlist: su línea SPICE se conserva tal cual; solo cambian los nodos al recablearlo.</p>
    {/if}
    {#each errores as e, i (i)}<p class="mal">{e}</p>{/each}
    {#each pinesSueltos as e, i (i)}<p class="nota aviso">{e}</p>{/each}
  {:else if cable}
    <header><h3>Cable</h3>
      <div class="acciones"><button type="button" class="boton-icono" title="Borrar (Supr)" aria-label="Borrar" onclick={() => ed.borrar()}><Trash size={18} /></button></div>
    </header>
    <p class="nota">Pertenece a la red <code>{redCable ?? '—'}</code>{redCable === '0' ? ' (masa)' : ''}. Para darle otro nombre, conecte una etiqueta de red.</p>
  {:else if ed.sel.length > 1}
    <header>
      <h3>{ed.sel.length} elementos</h3>
      <div class="acciones">
        <button type="button" class="boton-icono" title="Girar 90° (R)" aria-label="Girar" onclick={() => ed.transformar(ed.sel, 'girar')}><RotateCw size={18} /></button>
        <button type="button" class="boton-icono" title="Reflejar (X)" aria-label="Reflejar" onclick={() => ed.transformar(ed.sel, 'reflejar')}><FlipHorizontal size={18} /></button>
        <button type="button" class="boton-icono" title="Duplicar (Ctrl D)" aria-label="Duplicar" onclick={() => ed.duplicar()}><CopyPlus size={18} /></button>
        <button type="button" class="boton-icono" title="Borrar (Supr)" aria-label="Borrar" onclick={() => ed.borrar()}><Trash size={18} /></button>
      </div>
    </header>
    <p class="nota">Arrástrelos para moverlos juntos; los cables conectados los siguen.</p>
  {:else}
    <header><h3>Circuito</h3></header>
    <label class="campo">
      <span>Título</span>
      <input type="text" name="titulo" value={ed.doc.titulo} onchange={(e) => {
        const v = (e.currentTarget as HTMLInputElement).value;
        ed.cambiar(() => (ed.doc.titulo = v));
      }} />
    </label>
    <p class="nota">
      {ed.doc.componentes.filter((x) => !ES_CONEXION.has(x.tipo)).length} componentes, {ed.doc.cables.length} cables, {ed.con.redes.length} nodos.
      Seleccione un componente para ver y cambiar sus valores.
    </p>
  {/if}
</section>

<style>
  .propiedades {
    display: grid;
    gap: 10px;
    align-content: start;
    font-family: var(--sans);
  }
  header {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 2px 6px;
    min-height: 40px;
  }
  h3 {
    margin: 0;
    font-size: 15px;
    color: var(--titulos);
  }
  .acciones {
    display: flex;
    gap: 2px;
  }
  .acciones :global(.boton-icono) {
    width: 40px;
    height: 44px;
  }
  .campo {
    display: grid;
    gap: 3px;
    font-size: 13px;
    color: var(--tinta-suave);
  }
  .campo em {
    font-style: normal;
    color: var(--tinta-tenue);
  }
  input,
  select,
  textarea {
    box-sizing: border-box;
    width: 100%;
    min-height: 40px;
    padding: 6px 10px;
    border: 1px solid var(--linea);
    border-radius: 9px;
    background: var(--superficie);
    color: var(--tinta);
    font: 15px var(--sans);
  }
  textarea {
    font-family: var(--mono);
    font-size: 13px;
    resize: vertical;
  }
  input.invalido {
    border-color: var(--c-precaucion);
  }
  small {
    font-size: 12.5px;
    color: var(--tinta-tenue);
  }
  .mal {
    color: var(--c-precaucion);
    margin: 0;
    font-size: 13px;
  }
  .nota {
    margin: 0;
    font-size: 13px;
    line-height: 1.45;
    color: var(--tinta-suave);
  }
  .nota.aviso {
    color: var(--c-importante);
  }
  code {
    font-family: var(--mono);
  }
</style>
