<script lang="ts">
  // 1.2 «Diseñe»: the reader picks component values (the widget's E-series controls) to meet a spec with its
  // tolerance; «Comprobar» checks the nominal design and the same design with the parts' tolerances (every corner, or
  // seeded Monte Carlo boards). The report: the spec band, the nominal value and the spread of the boards, and how
  // many meet it. Computed with the lesson's model (checked against the app's ngspice by the generator).
  import { compilarModelo, formatear, type Valores } from '../../lib/leccion11/modelo';
  import type { EstadoTarjeta } from '../../lib/leccion11/motor';
  import type { Leccion11, Tarjeta } from '../../lib/leccion11/tipos';
  import { analizarDiseno } from '../../lib/leccion12/tolerancias';
  import type { Diseno } from '../../lib/leccion12/tipos';

  let { leccion, t, a, e, efectivos }: { leccion: Leccion11; t: Tarjeta; a: Diseno; e: EstadoTarjeta; efectivos: Valores } = $props();

  const mc = $derived(compilarModelo(leccion.modelo));
  const conds = $derived(t.condiciones ?? []);
  const inf = $derived(e.comprobado ? analizarDiseno(mc, a, conds, efectivos) : null);
  const c0 = $derived(conds[0]);
  const mag = $derived(c0 ? mc.magnitud(c0.valor) : null);
  const tolTexto = $derived(
    Object.entries(a.tolerancias)
      .map(([k, v]) => `${leccion.modelo.valores[k]?.nombre ?? k} ± ${formatear({ sim: [], nombre: '', unidad: '%', cifras: 2, recortar: true }, v * 100)}`)
      .join('; '),
  );
  const exige = $derived(a.exigir === 'nominal' ? 'el valor nominal' : a.exigir === 'todas' ? `todas las ${a.metodo === 'esquinas' ? 'esquinas' : 'placas'}` : `al menos el ${Math.round(a.exigir * 100)} % de las placas`);
  // the drawing's scale: the band, the nominal and the spread, with some room
  const escala = $derived.by(() => {
    if (!inf || !c0) return null;
    const rg = inf.rangos[0]!;
    const xs = [rg.min, rg.max, rg.nominal, c0.min ?? rg.min, c0.max ?? rg.max].filter(Number.isFinite);
    let lo = Math.min(...xs);
    let hi = Math.max(...xs);
    const m = (hi - lo || Math.abs(hi) || 1) * 0.15;
    lo -= m;
    hi += m;
    return { lo, hi, x: (v: number) => 10 + ((v - lo) / (hi - lo)) * 340 };
  });
</script>

<div class="a12 diseno" data-diseno>
  <p class="a12-suave">Tolerancias de las piezas: {tolTexto}. Para aprobar: {exige} dentro de la especificación.</p>
  {#if inf && escala && c0}
    {@const rg = inf.rangos[0]!}
    <svg viewBox="0 0 360 64" role="img" aria-label={`Especificación de ${formatear(mag, c0.min ?? rg.min)} a ${formatear(mag, c0.max ?? rg.max)}. Nominal ${formatear(mag, rg.nominal)}. Con las tolerancias, de ${formatear(mag, rg.min)} a ${formatear(mag, rg.max)}.`} data-informe-grafico>
      <rect x={escala.x(c0.min ?? escala.lo)} y="8" width={Math.max(2, escala.x(c0.max ?? escala.hi) - escala.x(c0.min ?? escala.lo))} height="28" rx="4" class="banda" />
      <line x1={escala.x(rg.min)} x2={escala.x(rg.max)} y1="22" y2="22" class="dispersion" />
      {#each inf.muestra as v, k (k)}
        <circle cx={escala.x(v)} cy={14 + (k % 5) * 4} r="1.8" class="placa" />
      {/each}
      <line x1={escala.x(rg.nominal)} x2={escala.x(rg.nominal)} y1="4" y2="40" class="nominal" />
      <text x={escala.x(c0.min ?? escala.lo)} y="56" text-anchor="middle">{formatear(mag, c0.min ?? escala.lo)}</text>
      <text x={escala.x(c0.max ?? escala.hi)} y="56" text-anchor="middle">{formatear(mag, c0.max ?? escala.hi)}</text>
    </svg>
    <table class="tabla" data-informe>
      <caption class="a12-solo-lector">Informe del diseño</caption>
      <tbody>
        <tr><th scope="row">Nominal</th><td class={inf.nominal ? 'a12-ok' : 'a12-no'}>{formatear(mag, rg.nominal)} · {inf.nominal ? 'cumple' : 'no cumple'}</td></tr>
        <tr><th scope="row">Con tolerancias</th><td>de {formatear(mag, rg.min)} a {formatear(mag, rg.max)}</td></tr>
        <tr><th scope="row">{a.metodo === 'esquinas' ? 'Esquinas que cumplen' : 'Placas que cumplen'}</th><td class={inf.cumplen === inf.placas ? 'a12-ok' : 'a12-no'} data-cumplen={inf.cumplen}>{inf.cumplen} de {inf.placas}</td></tr>
        <tr><th scope="row">Veredicto</th><td class={inf.pasa ? 'a12-ok' : 'a12-no'} data-pasa={inf.pasa ? 'si' : 'no'}>{inf.pasa ? 'Aprobado' : 'No aprobado'}</td></tr>
      </tbody>
    </table>
    <p class="a12-suave">Calculado con el modelo de la lección, el mismo que se ha comprobado con ngspice.</p>
  {:else}
    <p class="a12-suave">Elija los valores y pulse «Comprobar»: se prueba el diseño nominal y {a.metodo === 'esquinas' ? 'cada combinación de los extremos de las tolerancias' : `${a.muestras} placas con piezas al azar dentro de su tolerancia`}.</p>
  {/if}
</div>

<style>
  svg {
    width: 100%;
    height: auto;
  }
  .banda {
    fill: var(--v11-bien-tinte);
    stroke: var(--v11-bien);
    stroke-width: 1.5;
  }
  .dispersion {
    stroke: var(--v11-naranja);
    stroke-width: 3;
  }
  .placa {
    fill: var(--v11-naranja);
  }
  .nominal {
    stroke: var(--v11-tinta);
    stroke-width: 3;
  }
  .tabla {
    border-collapse: collapse;
    font-size: 14px;
  }
  .tabla th {
    padding: 4px 12px 4px 0;
    color: var(--v11-tinta-suave);
    font-weight: 600;
    text-align: left;
  }
  .tabla td {
    padding: 4px 0;
    font-variant-numeric: tabular-nums;
  }
</style>
