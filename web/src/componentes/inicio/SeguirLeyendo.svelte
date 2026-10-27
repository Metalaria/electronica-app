<script lang="ts">
  // Start page (0.9): «Seguir leyendo». The lesson to continue (step bar, «Paso 4 de 7 · unos 6 minutos»,
  // «Continuar» → the lesson), else the part read last at its section (one segment per section of the chapter,
  // the read ones filled; «Continuar» resumes the stored position), else «Empezar a leer» the first chapter.
  // Shows one figure of that section: the one the reader passed last, else its first, else the part's first;
  // the only image the start page loads.
  import type { BFigura, Bloque } from '../../lib/tipos';
  import { app } from '../../lib/estado.svelte';
  import { usuario } from '../../lib/usuario.svelte';
  import { aprendizaje } from '../../lib/aprendizaje.svelte';
  import { cargarParte, textoPlano, url } from '../../lib/datos';
  import { tonoBloque } from '../../lib/color';
  import { rutaLeccion } from '../../lib/lecciones.svelte';
  import { destinoActual } from './destino.svelte';
  import Tarjeta from '../ui09/Tarjeta.svelte';
  import Rotulo from '../ui09/Rotulo.svelte';
  import BarraSegmentos from '../ui09/BarraSegmentos.svelte';
  import BotonPrincipal from '../ui09/BotonPrincipal.svelte';

  const d = $derived(destinoActual());
  const tono = $derived(tonoBloque(d?.info.color, app.tema));
  const pos = $derived(d?.tipo === 'lectura' ? usuario.posiciones[d.parte] : undefined);

  // the chapter's sections as segments (reading mode)
  const secciones = $derived(d?.info.secciones ?? []);
  const leidas = $derived.by(() => {
    const l = d ? aprendizaje.leidas[d.parte] : undefined;
    return new Set(secciones.flatMap((s, i) => (l?.[s.label] ? [i] : [])));
  });
  const indiceSeccion = $derived(d?.seccion ? secciones.findIndex((s) => s.label === d.seccion!.label) : -1);

  const progreso = $derived.by(() => {
    if (!d) return '';
    if (d.tipo === 'leccion') {
      const quedan = Math.max(1, d.pasos - d.paso);
      const min = Math.max(1, Math.round(quedan * 1.5));
      return `Paso ${d.paso + 1} de ${d.pasos} · unos ${min} ${min === 1 ? 'minuto' : 'minutos'}`;
    }
    if (!secciones.length) return '';
    return `${leidas.size} de ${secciones.length} secciones leídas`;
  });

  let figura = $state<BFigura | null>(null);
  let cargada = $state(false);

  function figuras(bs: Bloque[], desde: number, out: { f: BFigura; top: number }[], top: number | null = null): void {
    bs.forEach((b, i) => {
      const t = top ?? desde + i;
      if (b.t === 'figura') out.push({ f: b, top: t });
      else if (b.t === 'caja' || b.t === 'deduccion' || b.t === 'tarjeta') figuras(b.bloques, desde, out, t);
    });
  }

  $effect(() => {
    const parte = d?.parte;
    const label = d?.seccion?.label;
    const b = pos?.b ?? 0;
    figura = null;
    cargada = false;
    if (!parte) return;
    let vivo = true;
    cargarParte(parte)
      .then((p) => {
        if (!vivo) return;
        const todas: { f: BFigura; top: number }[] = [];
        figuras(p.bloques, 0, todas);
        // the section's range of top-level blocks
        let ini = label ? p.bloques.findIndex((x) => x.t === 'h2' && x.label === label) : -1;
        if (ini < 0) for (let k = Math.min(b, p.bloques.length - 1); k >= 0; k--) if (p.bloques[k]!.t === 'h2') { ini = k; break; }
        let fin = p.bloques.length;
        if (ini >= 0) for (let k = ini + 1; k < p.bloques.length; k++) if (p.bloques[k]!.t === 'h2') { fin = k; break; }
        const enSeccion = ini >= 0 ? todas.filter((x) => x.top > ini && x.top < fin) : [];
        const pasada = enSeccion.filter((x) => x.top <= b).pop();
        figura = (pasada ?? enSeccion[0] ?? todas[0])?.f ?? null;
        cargada = true;
      })
      .catch(() => {
        if (vivo) cargada = true;
      });
    return () => {
      vivo = false;
    };
  });
</script>

{#if d}
  <Tarjeta
    banda={tono.relleno}
    grande
    sombra
    clase="seguir"
    aria-labelledby="tit-seguir"
    data-parte={d.parte}
    data-seccion={d.seccion?.label ?? ''}
    data-tipo={d.tipo}
  >
    <div class="cab">
      <Rotulo color={tono.texto}>{d.tipo === 'empezar' ? 'Empezar a leer' : d.tipo === 'leccion' ? 'Seguir la lección' : 'Seguir leyendo'}</Rotulo>
      <span class="capitulo">{d.capitulo}</span>
    </div>
    <h2 id="tit-seguir">
      {#if d.seccion}{#if d.seccion.num}<span class="num">{d.seccion.num}</span>{/if} {d.seccion.titulo}{:else}{d.capitulo}{/if}
    </h2>

    <div class="imagen" class:vacia={cargada && !figura} class:vectorial={!!figura && /\.svg$/i.test(figura.src)}>
      {#if figura}
        <img src={url(figura.src)} alt={`Figura ${figura.num ?? ''}: ${textoPlano(figura.pie)}`} decoding="async" draggable="false" />
      {/if}
    </div>

    {#if d.tipo === 'leccion' && d.pasos > 0}
      <div class="progreso">
        <BarraSegmentos total={d.pasos} hechos={d.paso} actual={d.paso} color={tono.relleno} />
        <span class="det">{progreso}</span>
      </div>
    {:else if d.tipo === 'lectura' && secciones.length}
      <div class="progreso">
        <BarraSegmentos total={secciones.length} hechos={leidas} actual={indiceSeccion} color={tono.relleno} />
        <span class="det">{progreso}</span>
      </div>
    {/if}

    <BotonPrincipal href={d.href} color={tono.relleno} sobre={tono.sobre} ancho flecha clase="continuar">
      {d.tipo === 'empezar' ? 'Empezar' : 'Continuar'}
    </BotonPrincipal>
    {#if d.tipo !== 'leccion' && d.seccion && d.parte !== 'glosario'}
      <a class="por-pasos" href={rutaLeccion(d.parte, d.seccion.label)}>Estudiar {d.seccion.num ?? 'la sección'} por pasos</a>
    {/if}
  </Tarjeta>
{/if}

<style>
  :global(.t09-tarjeta.seguir) {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }
  .cab {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 4px 8px;
  }
  .capitulo {
    color: var(--tinta-suave);
    font-size: 13px;
  }
  h2 {
    margin: 0;
    color: var(--titulos);
    font-family: var(--serif);
    font-size: 22px;
    font-weight: 600;
    line-height: 1.25;
    text-wrap: balance;
  }
  .num {
    font-variant-numeric: tabular-nums;
  }
  .imagen {
    display: grid;
    place-items: center;
    height: 132px;
    padding: 8px;
    overflow: hidden;
    border: 1px solid var(--linea);
    border-radius: 10px;
    background: var(--superficie-2);
  }
  .imagen.vectorial {
    background: var(--placa);
  }
  .imagen.vacia {
    display: none;
  }
  .imagen img {
    display: block;
    max-width: 100%;
    max-height: 100%;
    object-fit: contain;
  }
  .imagen.vectorial img {
    filter: var(--placa-filtro);
  }
  .progreso {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .det {
    color: var(--tinta-suave);
    font-size: 14px;
  }
  .por-pasos {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: var(--toque);
    margin: -6px 0 -8px;
    color: var(--acento);
    font-size: 15px;
    font-weight: 600;
    text-decoration: none;
  }
  .por-pasos:hover {
    text-decoration: underline;
  }
</style>
