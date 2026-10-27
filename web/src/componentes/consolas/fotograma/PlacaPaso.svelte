<script lang="ts">
  // «Un fotograma»: the step on the real board. The photo of the «Foto» tab, framed on the parts that take part in
  // the step (the hotspots of the lit diagram blocks), with the rest dimmed. The photo that shows most of those
  // parts is used (the main one on a tie). Parts that are not on any photo are simply not marked.
  import { untrack } from 'svelte';
  import { enlace } from '../estado.svelte';
  import { fotosDe, type DatosMaquina, type FotoExtra, type Hotspot } from '../datos';
  import type { Bloque } from '../arquitectura/diagrama';

  let { datos, bloques }: { datos: DatosMaquina; bloques: Bloque[] } = $props();

  const uid = $props.id();
  const fotos = $derived(fotosDe(datos));

  function delBloque(f: FotoExtra, b: Bloque): Hotspot[] {
    return f.hotspots.filter((h) => h.id === b.foto || (h.bloque === b.id && h.esquema.some((r) => b.esquema?.includes(r))));
  }

  const eleccion = $derived.by(() => {
    let mejor: { foto: FotoExtra; marcas: Hotspot[]; n: number } | null = null;
    for (const f of fotos) {
      const marcas: Hotspot[] = [];
      let n = 0;
      for (const b of bloques) {
        const hs = delBloque(f, b);
        if (hs.length) n++;
        for (const h of hs) if (!marcas.includes(h)) marcas.push(h);
      }
      if (!mejor || n > mejor.n) mejor = { foto: f, marcas, n };
    }
    return mejor;
  });

  const foto = $derived(eleccion?.foto ?? fotos[0]!);
  const marcas = $derived(eleccion?.marcas ?? []);
  const cajas = $derived(marcas.flatMap((h) => h.cajas));

  type Caja = [number, number, number, number];

  function encuadre(): Caja {
    const W = foto.ancho;
    const H = foto.alto;
    if (!cajas.length) return [0, 0, W, H];
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    for (const [a, b, c, d] of cajas) {
      x0 = Math.min(x0, a);
      y0 = Math.min(y0, b);
      x1 = Math.max(x1, c);
      y1 = Math.max(y1, d);
    }
    const r = W / H;
    let w = Math.max((x1 - x0) * 1.35, (y1 - y0) * 1.35 * r, W * 0.42);
    let h = w / r;
    if (w > W) {
      w = W;
      h = H;
    }
    const x = Math.min(Math.max((x0 + x1) / 2 - w / 2, 0), W - w);
    const y = Math.min(Math.max((y0 + y1) / 2 - h / 2, 0), H - h);
    return [x, y, w, h];
  }

  let vista = $state<Caja>([0, 0, 1, 1]);
  let raf = 0;
  let fotoPrevia = '';
  $effect(() => {
    const destino = encuadre();
    const nueva = foto.src !== fotoPrevia;
    fotoPrevia = foto.src;
    const reducido = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    cancelAnimationFrame(raf);
    if (nueva || reducido) {
      vista = destino;
      return;
    }
    const desde = untrack(() => [...vista]) as Caja;
    const t0 = performance.now();
    const paso = (t: number) => {
      const k = Math.min(1, (t - t0) / 420);
      const e = k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2;
      vista = desde.map((v, i) => v + (destino[i]! - v) * e) as Caja;
      if (k < 1) raf = requestAnimationFrame(paso);
    };
    raf = requestAnimationFrame(paso);
    return () => cancelAnimationFrame(raf);
  });

  const nombre = (h: Hotspot) => (h.esquema[0] && h.esquema[0] !== h.nombre ? `${h.esquema.join(', ')} · ${h.nombre}` : h.nombre);
</script>

<div class="placa-paso">
  <div class="cab">
    <span class="t09-rotulo">En la placa</span>
    <span class="cual">{foto.titulo}</span>
  </div>
  <svg viewBox={vista.map((v) => v.toFixed(1)).join(' ')} style:aspect-ratio={`${foto.ancho} / ${foto.alto}`} role="img" aria-label={`Foto de la placa ${datos.placa}${marcas.length ? `: ${marcas.map((h) => h.nombre).join(', ')}` : ''}`}>
    <defs>
      <mask id={`${uid}-hueco`}>
        <rect x="0" y="0" width={foto.ancho} height={foto.alto} fill="#fff" />
        {#each cajas as [a, b, c, d], k (k)}<rect x={a - 6} y={b - 6} width={c - a + 12} height={d - b + 12} rx="10" fill="#000" />{/each}
      </mask>
    </defs>
    <image href={foto.src} x="0" y="0" width={foto.ancho} height={foto.alto} />
    {#if cajas.length}
      <rect class="velo" x="0" y="0" width={foto.ancho} height={foto.alto} mask={`url(#${uid}-hueco)`} />
    {/if}
    {#each cajas as [a, b, c, d], k (k)}
      <rect class="marca" x={a - 6} y={b - 6} width={c - a + 12} height={d - b + 12} rx="10" data-marca />
    {/each}
  </svg>
  {#if marcas.length}
    <ul class="piezas">
      {#each marcas as h (h.id)}
        <li><a href={enlace(datos.id, 'foto', { tipo: 'foto', id: h.id })}>{nombre(h)}</a></li>
      {/each}
    </ul>
  {:else}
    <p class="nada">Lo que pasa en este paso ocurre dentro de un chip o en una pieza que no sale en la foto.</p>
  {/if}
</div>

<style>
  .placa-paso {
    display: grid;
    gap: 10px;
    min-width: 0;
  }
  .cab {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    justify-content: space-between;
    gap: 4px 12px;
  }
  .cual {
    min-width: 0;
    color: var(--tinta-suave);
    font-size: 14px;
    font-weight: 600;
  }
  svg {
    display: block;
    width: 100%;
    height: auto;
    border-radius: 12px;
    background: var(--placa);
  }
  image {
    filter: var(--placa-filtro);
  }
  .velo {
    fill: #000;
    fill-opacity: 0.55;
  }
  .marca {
    fill: none;
    stroke: var(--ambar-relleno);
    stroke-width: 6;
    animation: latir 1.6s ease-in-out infinite;
  }
  @keyframes latir {
    50% {
      stroke-opacity: 0.45;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .marca {
      animation: none;
    }
  }
  .piezas {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .piezas a {
    display: inline-flex;
    align-items: center;
    min-height: 34px;
    max-width: 100%;
    padding: 4px 12px;
    border: 1px solid var(--linea);
    border-radius: 999px;
    background: var(--superficie);
    color: var(--tinta);
    font-size: 14px;
    font-weight: 600;
    line-height: 1.25;
    text-decoration: none;
    overflow-wrap: anywhere;
  }
  .piezas a:hover {
    border-color: var(--acento-borde);
    color: var(--acento);
  }
  .nada {
    margin: 0;
    color: var(--tinta-suave);
    font-size: 15px;
  }
</style>
