<script lang="ts">
  // 1.1: the fields of an open design question (lib/diseno-ejercicio.ts): one value per component, with its series and
  // range, and — once «Comprobar» has simulated these very values — what the simulation measured. The panel owns the
  // stored answer; changing a value drops the old measurements, so the next check simulates again.
  import { formatoValor } from '../calculadoras/unidades';
  import { escribirDiseno, leerDiseno, textoCondiciones, valoresDiseno } from '../../lib/diseno-ejercicio';
  import type { PDiseno } from '../../lib/preguntas-ejercicio';

  let {
    p,
    valor = '',
    id,
    descrito,
    alCambiar,
    simulando = false,
  }: {
    p: PDiseno;
    valor?: string;
    id: string;
    /** id of the verdict line, when there is one (aria-describedby). */
    descrito?: string;
    alCambiar: (valor: string) => void;
    simulando?: boolean;
  } = $props();

  const leido = $derived(leerDiseno(valor, p.componentes.length));
  const vigente = $derived.by(() => {
    const m = leido.medicion;
    const v = valoresDiseno(p, leido.textos);
    if (!m || !v.ok) return null;
    return v.valores.every((x, i) => Math.abs(x - m.valores[i]!) <= 1e-9 * Math.abs(x)) ? m : null;
  });
  const t = (v: number, u: string) => formatoValor(v, u, 3, true);

  function poner(i: number, texto: string) {
    const textos = [...leido.textos];
    textos[i] = texto;
    alCambiar(escribirDiseno(textos));
  }
</script>

<fieldset class="diseno" aria-describedby={descrito}>
  <legend>{@html p.enunciado}</legend>
  <div class="campos-d">
    {#each p.componentes as c, i (c.id)}
      <span class="campo-d">
        <label for={`${id}-${c.id}`}>{@html c.nombre}</label>
        <span class="entrada">
          <input
            id={`${id}-${c.id}`}
            type="text"
            autocomplete="off"
            autocapitalize="off"
            spellcheck="false"
            placeholder={c.unidad === 'F' ? 'p. ej. 47 n' : c.unidad === 'H' ? 'p. ej. 10 m' : 'p. ej. 3,3 k'}
            aria-describedby={`${id}-${c.id}-ayuda`}
            value={leido.textos[i] ?? ''}
            oninput={(ev) => poner(i, (ev.currentTarget as HTMLInputElement).value)}
            data-componente={c.id}
          />
          <span class="u" aria-hidden="true">{c.unidad}</span>
        </span>
        <span class="ayuda" id={`${id}-${c.id}-ayuda`}>{c.serie}, de {t(c.min, c.unidad)} a {t(c.max, c.unidad)}</span>
      </span>
    {/each}
  </div>
  <p class="como">
    Al comprobar (o al entregar un examen), la aplicación simula el circuito con estos valores y mide que cumpla
    {@html textoCondiciones(p)}. Vale cualquier diseño que lo consiga.
  </p>
  {#if simulando}
    <p class="estado-d" role="status" data-simulando>Simulando el circuito…</p>
  {:else if vigente}
    <p class="estado-d" data-medido>
      Simulado:
      {#each p.medidas as m, k (m.id)}
        {k ? '; ' : ''}{@html m.nombre} = {Number.isFinite(vigente.medidas[m.id] ?? Number.NaN) ? t(vigente.medidas[m.id]!, m.unidad) : 'fuera del barrido'}
      {/each}.
    </p>
  {/if}
</fieldset>

<style>
  .diseno {
    min-width: 0;
    margin: 0;
    padding: 0;
    border: 0;
  }
  legend {
    margin-bottom: 6px;
    padding: 0;
    color: var(--tinta);
    font-weight: 600;
  }
  .campos-d {
    display: flex;
    flex-wrap: wrap;
    gap: 10px 18px;
  }
  .campo-d {
    display: grid;
    grid-template-columns: auto 1fr;
    align-items: center;
    gap: 2px 8px;
  }
  .campo-d label {
    font-weight: 700;
  }
  .entrada {
    display: inline-flex;
    align-items: center;
    gap: 4px;
  }
  .entrada input {
    width: 8.5em;
    min-height: 44px;
    padding: 0 10px;
    border: 1px solid var(--acento-borde);
    border-radius: 10px;
    background: var(--superficie);
    color: var(--tinta);
    font: inherit;
  }
  .u {
    color: var(--tinta-suave);
  }
  .ayuda {
    grid-column: 2;
    color: var(--tinta-tenue);
    font-size: 13px;
  }
  .como,
  .estado-d {
    margin: 8px 0 0;
    color: var(--tinta-suave);
    font-size: 14px;
  }
  .estado-d {
    color: var(--tinta);
  }
</style>
