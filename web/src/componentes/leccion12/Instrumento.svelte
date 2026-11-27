<script lang="ts">
  // 1.2.1 (piloto121): the panel of a live circuit's instrument (GUIA §13.1) — a multimeter (its display, V⎓ or A⎓,
  // and where its probes are) or an oscilloscope probe. The reader taps the drawing (CircuitoVivo's targets) or uses
  // these native selects, which are the keyboard's and the screen reader's way to the same placements. The reading is
  // the schematic's own DC solution with the card's values (lib/leccion12/hacer/medir.ts), announced politely once it
  // settles. The placement lives in the card's state (EstadoTarjeta.medida).
  import { textoPlano } from '../../lib/leccion11/texto';
  import type { SolucionCC } from '../../lib/leccion12/cc';
  import { lectura, unidadMedida } from '../../lib/leccion12/hacer/medir';
  import { formatoLectura } from '../../lib/leccion12/hacer/motor-hacer';
  import type { EstadoMedida, Instrumento } from '../../lib/leccion12/hacer/tipos';
  import { leerUnidades } from '../../lib/habla-matematicas';

  let {
    i,
    m,
    solucion,
    midiendo = false,
    promedio = false,
    prefijo,
    bloqueado = false,
    cambiar,
  }: {
    i: Instrumento;
    m: EstadoMedida;
    solucion: SolucionCC | null;
    /** motor121: the reading comes from the app's ngspice and it is running. */
    midiendo?: boolean;
    /** motor121: a circuit that changes with time: the meter shows the average over the graph's window. */
    promedio?: boolean;
    prefijo: string;
    /** The answer is checked right: the placement stays as it is. */
    bloqueado?: boolean;
    cambiar: (m: EstadoMedida) => void;
  } = $props();

  const valor = $derived(lectura(i, m, solucion));
  const completa = $derived(m.modo === 'A' ? !!m.rama : !!m.roja && !!m.negra);
  const display = $derived(midiendo && completa && valor == null ? 'midiendo…' : formatoLectura(unidadMedida(m), valor));
  const nombre = (lista: { id: string; rotulo: import('../../lib/leccion11/tipos').Texto }[], id: string) => textoPlano(lista.find((p) => p.id === id)?.rotulo) || id;
  let hablado = $state('');
  $effect(() => {
    const t = valor == null ? '' : `El multímetro marca ${leerUnidades(display)}${promedio ? ' de media' : ''}`;
    const id = setTimeout(() => (hablado = t), 600);
    return () => clearTimeout(id);
  });

  function poner(c: Partial<EstadoMedida>) {
    if (bloqueado) return;
    cambiar({ ...m, ...c });
  }
  const consejo = $derived(
    i.tipo === 'osciloscopio'
      ? m.roja
        ? ''
        : 'Toque un punto del circuito para poner la sonda.'
      : m.modo === 'A'
        ? m.rama
          ? ''
          : 'Toque una rama del circuito para abrirla y meter el amperímetro.'
        : m.activa === 'negra'
          ? 'Toque dónde poner la punta negra (COM).'
          : !m.roja
            ? 'Toque un punto del circuito para la punta roja. Para mover la negra, arrástrela o tóquela primero.'
            : !m.negra
              ? 'Toque un punto del circuito para la punta negra (COM).'
              : '',
  );
</script>

<div class="a12 instrumento" data-instrumento={i.tipo} data-modo-actual={m.modo}>
  {#if i.tipo === 'multimetro'}
    <div class="pantalla" data-lectura-instrumento={valor == null ? '' : String(valor)}>
      <span class="a12-suave">Multímetro{m.modo === 'A' ? ' · A⎓' : ' · V⎓'}{promedio ? ' · media' : ''}</span>
      <strong data-display-instrumento>{display}</strong>
    </div>
    {#if i.modos.length > 1}
      <div class="modos" role="group" aria-label="Modo del multímetro">
        <button type="button" class="a12-boton" aria-pressed={m.modo === 'V'} disabled={bloqueado} onclick={() => poner({ modo: 'V' })} data-modo="V">Voltios (V⎓)</button>
        <button type="button" class="a12-boton" aria-pressed={m.modo === 'A'} disabled={bloqueado} onclick={() => poner({ modo: 'A' })} data-modo="A">Amperios (A⎓)</button>
      </div>
    {/if}
    {#if m.modo === 'V'}
      <div class="puntas">
        <label class="punta">
          <span><span class="bola roja" aria-hidden="true"></span>Punta roja</span>
          <select id={`${prefijo}-roja`} value={m.roja ?? ''} disabled={bloqueado} onchange={(ev) => poner({ roja: (ev.currentTarget as HTMLSelectElement).value || null, activa: 'negra' })} data-punta-roja>
            <option value="">Sin poner</option>
            {#each i.puntos as p (p.id)}<option value={p.id}>{textoPlano(p.rotulo)}</option>{/each}
          </select>
        </label>
        <label class="punta">
          <span><span class="bola negra" aria-hidden="true"></span>Punta negra (COM)</span>
          <select id={`${prefijo}-negra`} value={m.negra ?? ''} disabled={bloqueado} onchange={(ev) => poner({ negra: (ev.currentTarget as HTMLSelectElement).value || null, activa: 'roja' })} data-punta-negra>
            <option value="">Sin poner</option>
            {#each i.puntos as p (p.id)}<option value={p.id}>{textoPlano(p.rotulo)}</option>{/each}
          </select>
        </label>
      </div>
    {:else}
      <label class="punta">
        <span><span class="bola rama" aria-hidden="true"></span>Amperímetro en</span>
        <select id={`${prefijo}-rama`} value={m.rama ?? ''} disabled={bloqueado} onchange={(ev) => poner({ rama: (ev.currentTarget as HTMLSelectElement).value || null })} data-rama-amperimetro>
          <option value="">Sin poner</option>
          {#each i.ramas as b (b.id)}<option value={b.id}>{textoPlano(b.rotulo)}</option>{/each}
        </select>
      </label>
    {/if}
  {:else}
    <label class="punta">
      <span><span class="bola roja" aria-hidden="true"></span>Sonda del osciloscopio en</span>
      <select id={`${prefijo}-sonda`} value={m.roja ?? ''} disabled={bloqueado} onchange={(ev) => poner({ roja: (ev.currentTarget as HTMLSelectElement).value || null })} data-sonda-osciloscopio>
        <option value="">Sin poner</option>
        {#each i.puntos as p (p.id)}<option value={p.id}>{textoPlano(p.rotulo)}</option>{/each}
      </select>
    </label>
    {#if m.roja}<p class="a12-suave" data-sonda-en>La pantalla enseña la señal en «{nombre(i.puntos, m.roja)}».</p>{/if}
  {/if}
  {#if consejo}<p class="a12-suave consejo" data-consejo-instrumento>{consejo}</p>{/if}
  <div class="solo-lector" aria-live="polite">{hablado}</div>
</div>

<style>
  .instrumento {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .pantalla {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 8px;
    padding: 10px 14px;
    border-radius: 12px;
    background: var(--v11-tinta);
    color: var(--v11-fondo);
  }
  .pantalla .a12-suave {
    color: var(--v11-fondo);
    opacity: 0.85;
  }
  .pantalla strong {
    font: 700 24px var(--v11-mono, monospace);
    font-variant-numeric: tabular-nums;
  }
  .modos {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .modos .a12-boton[aria-pressed='true'] {
    border-color: var(--v11-azul);
    background: var(--v11-azul-tinte);
  }
  .puntas {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: 8px;
  }
  .punta {
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-size: 14px;
    font-weight: 600;
  }
  .punta select {
    min-height: 48px;
    max-width: 100%;
    padding: 0 8px;
    border: 1.5px solid var(--v11-borde);
    border-radius: 10px;
    background: var(--v11-fondo);
    color: var(--v11-tinta);
    font: 500 15px var(--v11-texto);
  }
  .punta select:focus-visible {
    outline: 3px solid var(--v11-foco);
    outline-offset: 2px;
  }
  .bola {
    display: inline-block;
    width: 12px;
    height: 12px;
    margin-right: 6px;
    border-radius: 50%;
    vertical-align: -1px;
  }
  .bola.roja {
    background: #b3261e;
  }
  .bola.negra {
    background: #1d1d1f;
    box-shadow: 0 0 0 1.5px var(--v11-fondo), 0 0 0 3px var(--v11-tinta-suave);
  }
  .bola.rama {
    background: var(--v11-azul);
  }
  .consejo {
    margin: 0;
  }
  .solo-lector {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }
</style>
