<script lang="ts">
  // Readouts of «Un fotograma»: where the frame is (line, dot, phase), the access of every bus at this instant
  // (address in hexadecimal and bit by bit, data, read or write, who answers), the CPU registers and the signals.
  import type { FotoEstado, Reproductor } from './reproductor';
  import type { Adaptador } from './tipos';

  let { rep, ad, foto }: { rep: Reproductor; ad: Adaptador; foto: FotoEstado } = $props();

  const tr = $derived(rep.traza);
  const hex = (v: number, bits: number) => v.toString(16).toUpperCase().padStart(Math.ceil(bits / 4), '0');
  const bin = (v: number, bits: number) => v.toString(2).padStart(bits, '0').replace(/(\d{4})(?=\d)/g, '$1 ');
  const tiempo = $derived.by(() => {
    const s = (foto.t - rep.seg.t0) / tr.m.reloj.hz;
    return s < 1e-3 ? `${(s * 1e6).toFixed(2).replace('.', ',')} µs` : `${(s * 1e3).toFixed(3).replace('.', ',')} ms`;
  });
  const explicaFase = $derived(ad.fases?.[foto.fase] ?? '');

  function queEs(f: number): string {
    if (f & 8) return 'DMA';
    if (f & 2) return 'código de operación';
    if (f & 64) return 'operando';
    if (f & 16) return 'vector';
    if (f & 4) return f & 32 ? 'interno' : 'fantasma';
    return f & 1 ? 'escritura' : 'lectura';
  }
</script>

<section class="lecturas" aria-label="Lecturas">
  <div class="donde">
    <p><strong>Línea {foto.linea}</strong>, punto {foto.punto} · {tiempo} desde el inicio del tramo</p>
    <p class="fase" data-prueba="fase">{foto.faseTitulo}</p>
    {#if explicaFase}<p class="nota">{explicaFase}</p>{/if}
  </div>

  {#each tr.buses as b (b.def.id)}
    {@const a = foto.accesos.find((x) => x.bus === b.def.id)}
    <div class="bus" class:quieto={!a}>
      <p class="titulo">{b.def.titulo}</p>
      {#if a}
        <p class="valor">
          <span class="rw" class:w={!!(a.ev.f & 1)}>{a.ev.f & 1 ? 'Escritura' : 'Lectura'}</span>
          <code class="dir" title={bin(a.ev.a, b.def.anchoDir)}>${hex(a.ev.a, b.def.anchoDir)}</code>
          <code>{a.ev.f & 1 ? '←' : '→'} ${hex(a.ev.d, b.def.anchoDato)}</code>
        </p>
        <p class="bits"><code>{bin(a.ev.a, b.def.anchoDir)}</code> · <code>{bin(a.ev.d, b.def.anchoDato)}</code></p>
        <p class="nota">{a.tipo ?? queEs(a.ev.f)} · {a.chip}{a.ev.f & 32 ? ' · dentro del chip, no sale a la placa' : ''}</p>
      {:else}
        <p class="nota">Sin acceso en este instante.</p>
      {/if}
    </div>
  {/each}

  <div class="regs" aria-label="Registros de la CPU">
    {#each foto.regs as r (r.nombre)}
      <span><small>{r.nombre}</small><code>{hex(r.valor, r.valor > 0xff || r.nombre === 'SP' ? 16 : 8)}</code></span>
    {/each}
  </div>

  <div class="senales" aria-label="Señales">
    {#each foto.senales.filter((_s, k) => tr.senales[k]?.t.length) as s (s.id)}
      <span class:activa={s.activa} title={s.titulo}>{s.titulo}: {s.nivel}</span>
    {/each}
  </div>
</section>

<style>
  .lecturas {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 8px;
    font-size: 14px;
    font-variant-numeric: tabular-nums;
  }
  p {
    margin: 0;
  }
  .donde {
    display: grid;
    gap: 2px;
  }
  .fase {
    color: var(--acento);
    font-weight: 700;
  }
  .nota {
    color: var(--tinta-suave);
    font-size: 13px;
    line-height: 1.35;
  }
  .bus {
    display: grid;
    gap: 2px;
    padding: 8px 10px;
    border: 1px solid var(--linea);
    border-radius: 12px;
    background: var(--superficie);
  }
  .bus.quieto {
    opacity: 0.7;
  }
  .titulo {
    font-weight: 700;
  }
  .valor {
    display: flex;
    flex-wrap: wrap;
    gap: 4px 10px;
    align-items: baseline;
  }
  .dir {
    font-size: 16px;
    font-weight: 700;
  }
  .rw {
    color: #1f6fd1;
    font-weight: 700;
  }
  .rw.w {
    color: #8a3fd1;
  }
  .bits {
    overflow-x: auto;
    color: var(--tinta-suave);
    font-size: 12.5px;
    white-space: nowrap;
  }
  .regs {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .regs span {
    display: inline-flex;
    gap: 4px;
    align-items: baseline;
    padding: 2px 8px;
    border-radius: 8px;
    background: var(--superficie-2);
  }
  .regs small {
    color: var(--tinta-suave);
    font-weight: 700;
  }
  .senales {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }
  .senales span {
    padding: 2px 8px;
    border-radius: 999px;
    background: var(--superficie-2);
    color: var(--tinta-suave);
    font-size: 12.5px;
  }
  .senales span.activa {
    background: var(--acento);
    color: #fff;
    font-weight: 700;
  }
  code {
    font-family: 'Source Code Pro', ui-monospace, monospace;
  }
</style>
