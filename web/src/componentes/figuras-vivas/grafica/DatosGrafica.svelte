<script lang="ts">
  // The curves of a figure redrawn with the app's plot component (full-screen view, «Datos» tab): real zoom
  // and pan, A/B cursors, the data table. One plot per plotting box and y axis; values in SI units so the
  // component picks the prefixes.
  import { Grafica, PlotLink, type Axis, type Series } from '../../grafica';
  import { nombreEje } from '../formato';
  import type { DatosFigura, EjeDatos } from '../tipos';
  import type { Grupo } from './lectura';

  let { datos, grupos }: { datos: DatosFigura; grupos: Grupo[] } = $props();

  function eje(e: EjeDatos, defecto: string): { axis: Axis; f: number } {
    const f = e.factor_si ?? 1;
    const unit = e.factor_si != null && e.unidad_si ? e.unidad_si : '';
    const extra = e.factor_si == null && e.unidad ? ` (${e.unidad})` : '';
    const scale = e.escala === 'log' ? 'log' : 'linear';
    const [a, b] = e.lim;
    return {
      axis: { label: (nombreEje(e) || defecto) + extra, unit, scale, min: Math.min(a, b) * f, max: Math.max(a, b) * f },
      f,
    };
  }

  const paneles = $derived.by(() => {
    const res: { clave: string; titulo: string; x: Axis; y: Axis; series: Series[]; link: PlotLink }[] = [];
    grupos.forEach((g, n) => {
      const link = new PlotLink();
      const ex = eje(g.ejeX, 'x');
      for (const j of g.ejes) {
        const ej = datos.ejes[j]!;
        if (!ej.y) continue;
        const ey = eje(ej.y, 'y');
        const usados = new Set<string>();
        const series: Series[] = [];
        for (const s of g.series) {
          if (s.ejes !== j || s.tipo !== 'curva') continue;
          let name = s.nombre || 'curva';
          for (let k = 2; usados.has(name); k++) name = `${s.nombre} (${k})`;
          usados.add(name);
          const x = new Float64Array(s.x.length);
          const y = new Float64Array(s.y.length);
          for (let i = 0; i < x.length; i++) {
            x[i] = s.x[i]! * ex.f;
            y[i] = s.y[i]! * ey.f;
          }
          series.push({ name, unit: ey.axis.unit, x, y, color: s.color });
        }
        if (!series.length) continue;
        res.push({
          clave: `${g.principal}-${j}`,
          titulo: ej.titulo || (grupos.length > 1 ? `Gráfica ${n + 1}` : ''),
          x: ex.axis,
          y: ey.axis,
          series,
          link,
        });
      }
    });
    return res;
  });
</script>

<div class="datos-fv">
  {#each paneles as p (p.clave)}
    <Grafica series={p.series} xAxis={p.x} yAxis={p.y} link={p.link} title={p.titulo} height={300} animate={false} />
  {:else}
    <p>Esta figura no tiene curvas que redibujar.</p>
  {/each}
</div>

<style>
  .datos-fv {
    display: grid;
    gap: 22px;
    max-width: 1100px;
    margin: 0 auto;
  }
</style>
