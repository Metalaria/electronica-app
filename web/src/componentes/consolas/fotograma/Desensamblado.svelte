<script lang="ts">
  // Disassembly of «Un fotograma»: the instructions the CPU actually ran around the current one (from the trace,
  // loops included), the Spanish explanation of the current one and its bus cycles one by one, the current cycle
  // highlighted: where the CPU reads the game's code (the opcode fetch from the cartridge ROM) and what each
  // following cycle does.
  import type { FotoEstado, Reproductor } from './reproductor';
  import type { Adaptador } from './tipos';

  let { rep, ad, foto, alMover }: { rep: Reproductor; ad: Adaptador; foto: FotoEstado; alMover: () => void } = $props();

  const tr = $derived(rep.traza);
  const des = $derived(ad.cpus[tr.m.cpus[0]!.id]!);
  const leer = (a: number) => tr.leer(a);
  const h4 = (v: number) => v.toString(16).toUpperCase().padStart(4, '0');
  const h2 = (v: number) => v.toString(16).toUpperCase().padStart(2, '0');

  interface Fila {
    j: number;
    pc: number;
    texto: string;
    etiqueta: string;
    tipo: number;
  }

  const filas = $derived.by((): Fila[] => {
    const ins = tr.ins;
    const out: Fila[] = [];
    const ii = foto.ins;
    for (let j = Math.max(0, ii - 4); j <= Math.min(ins.t.length - 1, ii + 6); j++) {
      if (ins.t[j]! < rep.seg.t0 || ins.t[j]! > rep.seg.t1) continue;
      const pc = ins.pc[j]!;
      const k = ins.k ? ins.k[j]! : 0;
      const texto = k === 1 ? 'NMI' : k === 2 ? 'Interrupción' : k === 3 ? 'RESET' : des.instruccion(leer, pc, tr.m.programa.etiquetas).texto;
      out.push({ j, pc, texto, etiqueta: tr.m.programa.etiquetas[h4(pc)] ?? '', tipo: k });
    }
    return out;
  });

  const actual = $derived.by(() => {
    const ii = foto.ins;
    if (ii < 0) return null;
    const ins = tr.ins;
    const k = ins.k ? ins.k[ii]! : 0;
    const pc = ins.pc[ii]!;
    const d = des.instruccion(leer, pc, tr.m.programa.etiquetas);
    let explicacion = tr.m.programa.explicaciones[h4(pc)] ?? d.explicacion;
    let texto = d.texto;
    if (k === 1) {
      texto = 'NMI';
      explicacion = 'La PPU ha bajado /NMI: en vez de leer la siguiente instrucción, la CPU guarda PC y P en la pila y lee el vector de $FFFA–$FFFB.';
    } else if (k === 2) {
      texto = 'Interrupción';
      explicacion = 'Hay una interrupción pedida y permitida: la CPU guarda PC en la pila y salta a su vector.';
    } else if (k === 3) {
      texto = 'RESET';
      explicacion = 'Tras soltar /RST la CPU hace tres lecturas de pila sin escribir y lee el vector de reset en $FFFC–$FFFD.';
    }
    const linea = tr.m.programa.lineas?.[h4(pc)];
    // its bus cycles
    const c0 = ins.ciclo[ii]!;
    const c1 = ii + 1 < ins.t.length ? ins.ciclo[ii + 1]! : c0 + 8;
    const b = tr.buses.find((x) => x.def.id === tr.m.cpus[0]!.id)!;
    const ciclos = [];
    for (let c = c0; c < c1 && c < b.t.length && c < c0 + 40; c++) {
      const f = b.f[c]!;
      const que =
        f & 8 ? 'DMA' : f & 2 ? 'código de operación' : f & 64 ? 'operando' : f & 16 ? 'vector' : f & 4 ? (f & 32 ? 'ciclo interno' : 'lectura fantasma') : f & 1 ? 'escritura' : 'lectura';
      ciclos.push({ c, t: b.t[c]!, escritura: !!(f & 1), dir: b.a[c]!, dato: b.d[c]!, chip: b.def.chips[b.c[c]!]?.titulo ?? '', que, interno: !!(f & 32) });
    }
    return { pc, texto, explicacion, linea, ciclos, etiqueta: tr.m.programa.etiquetas[h4(pc)] ?? '' };
  });

  function ir(t: number): void {
    rep.jugando = false;
    rep.irA(t);
    alMover();
  }
</script>

<section class="desensamblado" aria-label="Instrucciones">
  {#if actual}
    <div class="actual">
      <p class="cabeza">
        <code class="dir">${h4(actual.pc)}</code>
        <code class="ins" data-prueba="instruccion">{actual.texto}</code>
        {#if actual.etiqueta}<span class="etq">{actual.etiqueta}</span>{/if}
      </p>
      <p class="explicacion" data-prueba="explicacion">{actual.explicacion}</p>
      {#if actual.linea}<p class="fuente" title="Línea {actual.linea[0]} del fuente"><code>{actual.linea[1]}</code></p>{/if}
      <ol class="ciclos" aria-label="Ciclos de bus de esta instrucción">
        {#each actual.ciclos as c, n (c.c)}
          {@const ahora = foto.t >= c.t && foto.t < c.t + rep.unidadesCiclo}
          <li class:ahora class:interno={c.interno}>
            <button type="button" onclick={() => ir(c.t)}>
              <span class="n">{n + 1}</span>
              <span class="rw" class:w={c.escritura}>{c.interno ? '·' : c.escritura ? 'E' : 'L'}</span>
              <code>${h4(c.dir)}</code>
              <code>{c.escritura ? '←' : '→'} ${h2(c.dato)}</code>
              <span class="que">{c.que}{c.interno ? '' : ` · ${c.chip}`}</span>
            </button>
          </li>
        {/each}
      </ol>
    </div>
  {:else}
    <p class="vacio">Aún no ha empezado ninguna instrucción.</p>
  {/if}
  <ol class="lista" aria-label="Instrucciones ejecutadas alrededor de la actual">
    {#each filas as f (f.j)}
      <li class:cur={f.j === foto.ins} class:int={f.tipo !== 0}>
        <button type="button" onclick={() => ir(tr.ins.t[f.j]!)}>
          <code class="dir">{f.tipo ? '' : '$' + h4(f.pc)}</code>
          <code>{f.texto}</code>
          {#if f.etiqueta}<span class="etq">{f.etiqueta}</span>{/if}
        </button>
      </li>
    {/each}
  </ol>
</section>

<style>
  .desensamblado {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 8px;
    min-width: 0;
  }
  .actual {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    min-width: 0;
    gap: 6px;
    padding: 10px 12px;
    border-left: 4px solid var(--acento);
    border-radius: 0 12px 12px 0;
    background: var(--acento-tinte);
  }
  .cabeza {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 4px 10px;
    margin: 0;
  }
  .ins {
    font-size: 17px;
    font-weight: 700;
  }
  .dir {
    color: var(--tinta-suave);
  }
  .etq {
    color: var(--acento);
    font-size: 13px;
    font-weight: 700;
  }
  .explicacion {
    margin: 0;
    line-height: 1.4;
  }
  .fuente {
    margin: 0;
    overflow-x: auto;
    color: var(--tinta-suave);
    font-size: 12.5px;
    white-space: pre;
  }
  ol {
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .ciclos {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 2px;
  }
  .ciclos button,
  .lista button {
    display: flex;
    align-items: baseline;
    gap: 8px;
    width: 100%;
    min-height: 30px;
    padding: 2px 8px;
    border: 0;
    border-radius: 8px;
    background: transparent;
    color: var(--tinta);
    font: inherit;
    font-size: 13.5px;
    text-align: left;
    white-space: nowrap;
    overflow: hidden;
    cursor: pointer;
  }
  .ciclos button code,
  .lista button code {
    flex: none;
  }
  .ciclos li.ahora button {
    background: var(--superficie);
    box-shadow: var(--sombra);
    font-weight: 700;
  }
  .ciclos li.interno button {
    color: var(--tinta-suave);
  }
  .n {
    width: 1.4em;
    color: var(--tinta-suave);
    text-align: right;
  }
  .rw {
    width: 1.2em;
    font-weight: 700;
    color: #1f6fd1;
  }
  .rw.w {
    color: #8a3fd1;
  }
  .que {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    color: var(--tinta-suave);
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .lista {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 1px;
    padding: 4px;
    border: 1px solid var(--linea);
    border-radius: 12px;
    background: var(--superficie);
  }
  .lista li.cur button {
    background: var(--acento-tinte);
    color: var(--acento);
    font-weight: 700;
  }
  .lista li.int button {
    color: #d62d20;
  }
  .vacio {
    margin: 0;
    color: var(--tinta-suave);
  }
  code {
    font-family: 'Source Code Pro', ui-monospace, monospace;
  }
</style>
