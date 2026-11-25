<script lang="ts">
  // 2.1 start page, «Seguir» (the approved mock-up Inicio.png / InicioMovil.png): one card with the chapter, the section
  // (title), its progress bar and count, «Continuar» (primary) and a quiet second way in, and on wide screens the small
  // visual of the section. What it continues (componentes/inicio/destino.svelte.ts): the lesson left half-way («2 de 11
  // pasos», the quiet way is «Leer la sección»), else the part read last at its section («3 de 22 secciones leídas»,
  // the quiet way is «Estudiar 5.3 por pasos»), else «Empezar» the first chapter. Under the card, the other parts read
  // recently («También leyendo», 0.9). The figure: the one of that section the reader passed last, else its first,
  // else the part's first — the only image the start page loads.
  import type { BFigura, Bloque } from '../../lib/tipos';
  import { app } from '../../lib/estado.svelte';
  import { usuario } from '../../lib/usuario.svelte';
  import { aprendizaje } from '../../lib/aprendizaje.svelte';
  import { cargarParte, rotuloParte, textoPlano, url } from '../../lib/datos';
  import { hrefParte } from '../../lib/navegacion.svelte';
  import { rutaLeccion } from '../../lib/lecciones.svelte';
  import { destinoActual } from './destino.svelte';

  const d = $derived(destinoActual());
  const pos = $derived(d?.tipo === 'lectura' ? usuario.posiciones[d.parte] : undefined);

  // the chapter's sections (reading mode)
  const secciones = $derived(d?.info.secciones ?? []);
  const leidas = $derived.by(() => {
    const l = d ? aprendizaje.leidas[d.parte] : undefined;
    return secciones.filter((s) => l?.[s.label]).length;
  });

  /** «2 de 11 pasos», «3 de 22 secciones leídas», and the bar's fraction (null: no bar). */
  const avance = $derived.by((): { texto: string; f: number | null } => {
    if (!d) return { texto: '', f: null };
    if (d.tipo === 'leccion' && d.pasos > 0) return { texto: `${d.paso} de ${d.pasos} ${d.pasos === 1 ? 'paso' : 'pasos'}`, f: d.paso / d.pasos };
    if (d.tipo === 'lectura' && secciones.length) return { texto: `${leidas} de ${secciones.length} ${secciones.length === 1 ? 'sección leída' : 'secciones leídas'}`, f: leidas / secciones.length };
    if (secciones.length) return { texto: `${secciones.length} ${secciones.length === 1 ? 'sección' : 'secciones'}`, f: null };
    return { texto: '', f: null };
  });

  /** The quiet second way in: the section in the book (from a lesson), or the section as a lesson (from reading). */
  const otra = $derived.by((): { href: string; texto: string; clase: string } | null => {
    if (!d?.seccion || d.parte === 'glosario') return null;
    if (d.tipo === 'leccion') return { href: `#/${d.parte}/${encodeURIComponent(d.seccion.label)}`, texto: 'Leer la sección', clase: 'leer' };
    return { href: rutaLeccion(d.parte, d.seccion.label), texto: `Estudiar ${d.seccion.num ?? 'la sección'} por pasos`, clase: 'por-pasos' };
  });

  // other parts read recently (0.9 «También leyendo»)
  const recientes = $derived(
    Object.entries(usuario.posiciones)
      .filter(([id]) => app.indice?.partes[id] && id !== d?.parte)
      .sort((a, b) => b[1].t - a[1].t)
      .slice(0, 3)
      .map(([id, p]) => {
        const sec = app.indice!.partes[id]!.secciones?.find((s) => s.label === p.sec);
        return { id, texto: `${rotuloParte(id)}${sec ? ` · ${sec.num ?? ''} ${sec.titulo}` : ''}`.replace(/\s+/g, ' ') };
      }),
  );

  let figura = $state<BFigura | null>(null);

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
      })
      .catch(() => {});
    return () => {
      vivo = false;
    };
  });
</script>

{#if d}
  <section class="seccion21 seguir-bloque" aria-labelledby="tit-seguir-rotulo">
    <h2 class="etiqueta21" id="tit-seguir-rotulo">Seguir</h2>
    <div class="seguir" class:con-imagen={!!figura} data-parte={d.parte} data-seccion={d.seccion?.label ?? ''} data-tipo={d.tipo}>
      <div class="textos">
        <p class="capitulo">{d.capitulo}</p>
        <h3 id="tit-seguir">
          {#if d.seccion}{#if d.seccion.num}<span class="num">{d.seccion.num}</span>{/if} {d.seccion.titulo}{:else}{d.capitulo}{/if}
        </h3>
        {#if avance.f !== null}
          <div class="barra" role="progressbar" aria-label={avance.texto} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(avance.f * 100)}>
            <span style:width={`${Math.max(0, Math.min(1, avance.f)) * 100}%`}></span>
          </div>
        {/if}
        {#if avance.texto}<p class="det">{avance.texto}</p>{/if}
        <div class="acciones">
          <a class="boton primario continuar" href={d.href} data-continuar-inicio
            >{d.tipo === 'empezar' ? 'Empezar' : 'Continuar'}<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"
              ><path d="M5 12h14M13 6l6 6-6 6" /></svg
            ></a
          >
          {#if otra}<a class="boton fantasma {otra.clase}" href={otra.href}>{otra.texto}</a>{/if}
        </div>
      </div>
      {#if figura}
        <div class="imagen" class:vectorial={/\.svg$/i.test(figura.src)}>
          <img
            src={url(figura.src)}
            alt={`Figura ${figura.num ?? ''}: ${textoPlano(figura.pie)}`}
            width={Math.round(figura.svg_vista?.[2] ?? figura.img_tam?.[0] ?? 0) || undefined}
            height={Math.round(figura.svg_vista?.[3] ?? figura.img_tam?.[1] ?? 0) || undefined}
            decoding="async"
            draggable="false"
          />
        </div>
      {/if}
    </div>
    {#if recientes.length}
      <p class="tambien" data-tambien-leyendo>
        <span>También leyendo:</span>
        {#each recientes as r, i (r.id)}{#if i}<span aria-hidden="true"> · </span>{/if}<a href={hrefParte(r.id)}>{r.texto}</a>{/each}
      </p>
    {/if}
  </section>
{/if}

<style>
  .seguir {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 28px;
    align-items: center;
    padding: 28px;
    border-radius: var(--v11-radio-tarjeta);
    background: var(--v11-panel);
  }
  .textos {
    display: flex;
    flex-direction: column;
    gap: 10px;
    min-width: 0;
  }
  .capitulo,
  .det {
    margin: 0;
    color: var(--v11-tinta-suave);
    font-size: 15px;
    line-height: 1.35;
  }
  h3 {
    margin: 0;
    color: var(--v11-tinta);
    font: 600 30px/1.2 var(--v11-titular);
    text-wrap: balance;
  }
  .num {
    font-variant-numeric: tabular-nums;
  }
  .barra {
    height: 6px;
    margin-top: 8px;
    overflow: hidden;
    border-radius: 3px;
    background: var(--v11-linea);
  }
  .barra span {
    display: block;
    height: 100%;
    border-radius: 3px;
    background: var(--v11-azul);
  }
  .acciones {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 12px;
    margin-top: 12px;
  }
  .tambien a:focus-visible {
    outline: 3px solid var(--v11-foco);
    outline-offset: 2px;
  }
  .imagen {
    display: none;
    place-items: center;
    height: 150px;
    padding: 12px;
    overflow: hidden;
    border-radius: 14px;
    background: var(--superficie-2);
  }
  .imagen.vectorial {
    background: var(--placa);
  }
  .imagen img {
    display: block;
    max-width: 100%;
    /* (a percentage of an auto grid row does not bind: the tile's inner height) */
    max-height: 126px;
    width: auto;
    height: auto;
    object-fit: contain;
  }
  .imagen.vectorial img {
    filter: var(--placa-filtro);
  }
  .tambien {
    margin: 0;
    color: var(--v11-tinta-suave);
    font-size: 15px;
    line-height: 1.5;
  }
  .tambien a {
    color: var(--v11-azul);
    text-decoration: none;
  }
  .tambien a:hover {
    text-decoration: underline;
  }

  /* wide: the section's visual beside the text (the mock-up's 220 px tile) */
  @container inicio (min-width: 600px) {
    .seguir.con-imagen {
      grid-template-columns: minmax(0, 1fr) 220px;
    }
    .imagen {
      display: grid;
    }
  }
  /* phone (InicioMovil.png): smaller card and title, «Continuar» across the card */
  @container inicio (max-width: 599px) {
    .seguir {
      padding: 20px;
    }
    h3 {
      font-size: 24px;
    }
    .capitulo,
    .det {
      font-size: 14px;
    }
    .barra {
      margin-top: 4px;
    }
    .acciones {
      flex-direction: column;
      align-items: stretch;
      gap: 4px;
      margin-top: 8px;
    }
  }
</style>
