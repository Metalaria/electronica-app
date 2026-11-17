<script lang="ts">
  // 1.2.1 (piloto121) «Lea y escriba»: the reader types the value read on the live widget (the multimeter, a reading,
  // the graph) with its unit, as people write it («4,25 W», «3k6», «150 m»); «Comprobar» checks it against the model
  // (lib/leccion12/hacer/motor-hacer.ts), and a wrong one can be read again and corrected.
  import type { EstadoTarjeta } from '../../lib/leccion11/motor';
  import { leerEstimacion } from '../../lib/leccion12/prediccion';
  // (motor121: a whole number in hexadecimal or binary)
  import { leerEntero } from '../../lib/leccion12/hacer/motor-hacer';
  import type { EstadoLeer, Leer } from '../../lib/leccion12/hacer/tipos';
  import TextoVivo from '../leccion11/TextoVivo.svelte';

  let { a, e, ea, prefijo, valor, cambiar }: { a: Leer; e: EstadoTarjeta; ea: EstadoLeer; prefijo: string; valor: (id: string) => string; cambiar: (c: Partial<EstadoTarjeta>) => void } = $props();
  const id = $derived(`${prefijo}-leido`);
  const malo = $derived(ea.texto.trim() !== '' && ea.valor == null);
  const base = $derived(a.base === 16 ? 'hexadecimal' : a.base === 2 ? 'binario' : '');

  function escribir(texto: string) {
    if (e.resuelta) return;
    const v = a.base ? (leerEntero(texto, a.base) ?? NaN) : leerEstimacion(texto, a.unidad);
    cambiar({ actividad: { ...ea, texto, valor: Number.isFinite(v) ? v : null }, comprobado: false, bien: null });
  }
</script>

<div class="a12 leer" data-leer>
  <label for={id} class="rotulo"><TextoVivo texto={a.rotulo} {valor} /></label>
  <div class="campo">
    <input
      {id}
      type="text"
      inputmode={a.base ? 'text' : 'decimal'}
      autocomplete="off"
      spellcheck="false"
      value={ea.texto}
      readonly={e.resuelta}
      aria-invalid={malo ? 'true' : undefined}
      aria-describedby={`${id}-ayuda`}
      oninput={(ev) => escribir((ev.currentTarget as HTMLInputElement).value)}
      data-valor-leido
    />
    <span class="unidad" aria-hidden="true">{base ? (a.base === 16 ? 'hex' : 'bin') : a.unidad}</span>
  </div>
  <p class="a12-suave" id={`${id}-ayuda`}>
    {#if base}{malo ? `No se entiende como ${base}: ${a.base === 16 ? 'cifras 0–9 y letras A–F' : 'solo ceros y unos'}.` : `Escríbalo en ${base}: ${a.base === 16 ? '«3F», «0x3F» o «3Fh»' : '«0011 1111» o «0b00111111»'}.`}{:else}{malo ? 'No se entiende como valor: escriba una cifra y, si quiere, su prefijo («3,6 m»).' : `Escriba lo que marca, en ${a.unidad || 'su unidad'}; vale con prefijo («k», «m», «µ»).`}{/if}
  </p>
</div>

<style>
  .leer {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .rotulo {
    font-weight: 600;
  }
  .campo {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  input {
    flex: 1;
    min-width: 0;
    min-height: 48px;
    padding: 0 12px;
    border: 1.5px solid var(--v11-borde);
    border-radius: 12px;
    background: var(--v11-fondo);
    color: var(--v11-tinta);
    font: 600 18px var(--v11-texto);
  }
  input:focus-visible {
    outline: 3px solid var(--v11-foco);
    outline-offset: 2px;
  }
  .unidad {
    font-weight: 700;
  }
  p {
    margin: 0;
  }
</style>
