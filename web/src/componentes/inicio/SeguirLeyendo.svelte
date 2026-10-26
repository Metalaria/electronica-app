<script lang="ts">
  // Start page: «Seguir leyendo», the part read last at the section where the reader left it, with a figure of
  // that section (the one the reader passed last, else its first, else the chapter's first). The only figure
  // the start page loads. Without any reading yet: «Empezar a leer» with the first chapter.
  import type { BFigura, Bloque } from '../../lib/tipos';
  import { usuario } from '../../lib/usuario.svelte';
  import { aprendizaje } from '../../lib/aprendizaje.svelte';
  import { cargarParte, infoParte, ordenLectura, rotuloParte, textoPlano, url } from '../../lib/datos';
  import { colorBloque } from '../../lib/color';
  import Icono from '../Icono.svelte';
  import Insignia from '../Insignia.svelte';

  const ultima = $derived.by(() => {
    let mejor: { id: string; t: number } | null = null;
    for (const [id, p] of Object.entries(usuario.posiciones)) if (infoParte(id) && (!mejor || p.t > mejor.t)) mejor = { id, t: p.t };
    return mejor;
  });
  const empezar = $derived(!ultima);
  const id = $derived(ultima?.id ?? ordenLectura().find((p) => infoParte(p)?.tipo === 'capitulo') ?? ordenLectura()[0] ?? '');
  const info = $derived(infoParte(id));
  const pos = $derived(ultima ? usuario.posiciones[ultima.id] : undefined);
  const seccion = $derived(info?.secciones?.find((s) => s.label === pos?.sec) ?? (empezar ? info?.secciones?.[0] : undefined));
  const fraccion = $derived.by(() => {
    const secs = info?.secciones ?? [];
    const l = aprendizaje.leidas[id];
    if (!secs.length || !l) return 0;
    return secs.filter((s) => l[s.label]).length / secs.length;
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
    const parte = id;
    const label = seccion?.label;
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

  function hace(t: number): string {
    const s = (Date.now() - t) / 1000;
    if (s < 90) return 'hace un momento';
    if (s < 3600) return `hace ${Math.round(s / 60)} min`;
    if (s < 86400) return `hace ${Math.round(s / 3600)} h`;
    const d = Math.round(s / 86400);
    return d === 1 ? 'ayer' : `hace ${d} días`;
  }

  const corto = (t: string | undefined) => (t ?? '').split(' — ')[0] ?? '';
  const href = $derived(empezar && seccion ? `#/${id}/${seccion.label}` : id === 'glosario' ? '#/glosario' : `#/${id}`);
</script>

{#if info}
  <a class="seguir" {href} style:--c={colorBloque(info.color)} data-parte={id} data-seccion={seccion?.label ?? ''}>
    <span class="imagen" class:vacia={cargada && !figura} class:vectorial={!!figura && /\.svg$/i.test(figura.src)}>
      {#if figura}
        <img src={url(figura.src)} alt={`Figura ${figura.num ?? ''}: ${textoPlano(figura.pie)}`} decoding="async" draggable="false" />
      {:else if cargada}
        <Insignia parte={id} grande />
      {/if}
    </span>
    <span class="texto">
      <span class="sobre">{empezar ? 'Empezar a leer' : 'Seguir leyendo'}</span>
      <span class="parte"><Insignia parte={id} /> {rotuloParte(id)}{#if pos}{` · ${hace(pos.t)}`}{/if}</span>
      <span class="tit">{corto(info.titulo)}</span>
      {#if seccion}<span class="sec"><b>{seccion.num ?? ''}</b> {seccion.titulo}</span>{/if}
      {#if figura?.num}<span class="fig">Figura {figura.num}</span>{/if}
      <span class="pie">
        {#if !empezar}
          <span class="barra" aria-hidden="true"><span style:width={`${Math.round(fraccion * 100)}%`}></span></span>
          <span class="pct">{Math.round(fraccion * 100)} % del capítulo</span>
        {/if}
        <span class="ir">{empezar ? 'Empezar' : 'Continuar'} <Icono nombre="chevron" tam={17} /></span>
      </span>
    </span>
  </a>
{/if}

<style>
  .seguir {
    display: grid;
    grid-template-columns: minmax(0, 1.08fr) minmax(0, 1fr);
    min-height: 236px;
    overflow: hidden;
    border: 1px solid var(--linea);
    border-radius: 14px;
    background: var(--superficie);
    color: var(--tinta);
    text-decoration: none;
    transition: box-shadow 0.15s, border-color 0.15s;
  }
  .seguir:hover {
    border-color: color-mix(in srgb, var(--c) 45%, var(--linea));
    box-shadow: var(--sombra);
  }
  .imagen {
    display: grid;
    place-items: center;
    min-height: 0;
    padding: 14px;
    border-right: 1px solid var(--linea-suave);
    background: var(--superficie-2);
  }
  .imagen.vectorial {
    background: var(--placa);
  }
  .imagen img {
    display: block;
    width: 100%;
    height: 100%;
    max-height: 250px;
    object-fit: contain;
  }
  .imagen.vectorial img {
    filter: var(--placa-filtro);
  }
  .texto {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
    padding: 18px 20px 16px;
    border-top: 4px solid var(--c);
  }
  .sobre {
    color: var(--tinta-tenue);
    font-size: 13px;
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }
  .parte {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 6px;
    color: var(--tinta-suave);
    font-size: 14px;
  }
  .tit {
    margin-top: 2px;
    color: var(--titulos);
    font-family: var(--serif);
    font-size: clamp(21px, 2.4vw, 26px);
    font-weight: 700;
    line-height: 1.15;
    text-wrap: balance;
  }
  .sec {
    color: var(--tinta);
    font-size: 15.5px;
    line-height: 1.35;
  }
  .sec b {
    margin-right: 4px;
    color: var(--acento);
  }
  .fig {
    color: var(--tinta-tenue);
    font-size: 13px;
  }
  .pie {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px 12px;
    margin-top: auto;
    padding-top: 12px;
  }
  .barra {
    flex: 1 1 120px;
    height: 4px;
    border-radius: 2px;
    background: var(--linea-suave);
    overflow: hidden;
  }
  .barra span {
    display: block;
    height: 100%;
    background: var(--c);
  }
  :global(:root[data-tema='oscuro']) .barra span {
    background: color-mix(in srgb, var(--c) 70%, #fff 30%);
  }
  .pct {
    color: var(--tinta-tenue);
    font-size: 13px;
    font-variant-numeric: tabular-nums;
  }
  .ir {
    display: inline-flex;
    align-items: center;
    gap: 2px;
    margin-left: auto;
    color: var(--acento);
    font-size: 15px;
    font-weight: 700;
  }
  @media (max-width: 640px) {
    .seguir {
      grid-template-columns: 1fr;
    }
    .imagen {
      height: 190px;
      border-right: 0;
      border-bottom: 1px solid var(--linea-suave);
    }
    .imagen img {
      max-height: 162px;
    }
  }
</style>
