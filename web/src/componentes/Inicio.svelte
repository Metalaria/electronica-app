<script lang="ts">
  import { onMount } from 'svelte';
  import { app } from '../lib/estado.svelte';
  import { ruta } from '../lib/ruta.svelte';
  import { usuario } from '../lib/usuario.svelte';
  import { infoParte, rotuloParte } from '../lib/datos';
  import { colorBloque } from '../lib/color';
  import { abrirBuscador } from '../lib/acciones';
  import Icono from './Icono.svelte';
  import Insignia from './Insignia.svelte';

  const indice = $derived(app.indice!);
  const capitulos = $derived(Object.values(indice.partes).filter((p) => p.tipo === 'capitulo').length);
  const apendices = $derived(Object.values(indice.partes).filter((p) => p.tipo === 'apendice').length);

  const recientes = $derived(
    Object.entries(usuario.posiciones)
      .filter(([id]) => indice.partes[id])
      .sort((a, b) => b[1].t - a[1].t)
      .slice(0, 3)
      .map(([id, pos]) => {
        const info = indice.partes[id]!;
        const sec = info.secciones?.find((s) => s.label === pos.sec);
        return { id, pos, info, sec };
      }),
  );
  const totalPersonal = $derived(Object.keys(usuario.marcadores).length + Object.keys(usuario.notas).length);

  function corto(t: string): string {
    return t.split(' — ')[0] ?? t;
  }

  function hace(t: number): string {
    const s = (Date.now() - t) / 1000;
    if (s < 90) return 'hace un momento';
    if (s < 3600) return `hace ${Math.round(s / 60)} min`;
    if (s < 86400) return `hace ${Math.round(s / 3600)} h`;
    const d = Math.round(s / 86400);
    return d === 1 ? 'ayer' : `hace ${d} días`;
  }

  onMount(() => {
    window.scrollTo({ top: ruta.y ?? 0, behavior: 'instant' });
  });
</script>

<svelte:head><title>Electrónica Práctica Avanzada</title></svelte:head>

<div class="inicio">
  <section class="portada">
    {#if indice.bloques?.length}
      <div class="espectro" aria-hidden="true">
        {#each indice.bloques as b (b.color)}<span style:background={colorBloque(b.color)}></span>{/each}
      </div>
    {/if}
    <p class="sobre">Gonzalo Mejías</p>
    <h1>Electrónica Práctica Avanzada</h1>
    <p class="datos">
      Edición {indice.edicion} · {indice.tomos.length}
      {indice.tomos.length === 1 ? 'tomo' : 'tomos'} · {capitulos} capítulos{apendices ? ` · ${apendices} apéndices` : ''}
    </p>
    {#if app.modo === 'muestra'}
      <p class="muestra">
        Se está mostrando el <strong>contenido de muestra</strong>. Para ver el libro completo, genere
        <code>web/public/libro/</code> con <code>python3 contenido/generar.py</code>.
      </p>
    {/if}
    <div class="acciones">
      <button class="boton" onclick={abrirBuscador}><Icono nombre="buscar" tam={17} /> Buscar</button>
      <a class="boton" href="#/glosario"><Icono nombre="glosario" tam={17} /> Glosario</a>
      <a class="boton" href="#/marcadores"
        ><Icono nombre="marcador" tam={17} /> Marcadores y notas{#if totalPersonal}<span class="cuenta">{totalPersonal}</span>{/if}</a
      >
    </div>
  </section>

  {#if recientes.length}
    <section class="bloque">
      <h2>Continuar leyendo</h2>
      <div class="recientes">
        {#each recientes as r, k (r.id)}
          <a class="reciente" class:principal={k === 0} href={`#/${r.id}`} style:--c={colorBloque(r.info.color)}>
            <Insignia parte={r.id} grande />
            <span class="txt">
              <span class="rot">{rotuloParte(r.id)} · {hace(r.pos.t)}</span>
              <span class="tit">{corto(r.info.titulo)}</span>
              {#if r.sec}<span class="sec">{r.sec.num} {r.sec.titulo}</span>{/if}
              <span class="barra-prog"><span style:width={`${Math.round((r.pos.f ?? 0) * 100)}%`}></span></span>
            </span>
            <Icono nombre="chevron" tam={18} />
          </a>
        {/each}
      </div>
    </section>
  {/if}

  <section class="bloque">
    <h2>Índice</h2>
    <div class="tomos">
      {#each indice.tomos as t (t.id)}
        <div class="tomo">
          <div class="tomo-cab">
            <span class="tomo-id">Tomo {t.id}</span>
            <span class="tomo-tit">{t.titulo}</span>
          </div>
          <ul>
            {#each t.partes.filter((p) => indice.partes[p]) as id (id)}
              {@const p = infoParte(id)!}
              <li>
                <a href={id === 'glosario' ? '#/glosario' : `#/${id}`} style:--c={colorBloque(p.color)} title={p.titulo}>
                  <Insignia parte={id} />
                  <span class="nom">{corto(p.titulo)}</span>
                  {#if usuario.posiciones[id]}
                    <span class="leido" title="Leído en parte" style:--f={usuario.posiciones[id]?.f ?? 0}></span>
                  {/if}
                </a>
              </li>
            {/each}
          </ul>
        </div>
      {/each}
    </div>
  </section>

  {#if indice.bloques?.length}
    <section class="bloque leyenda" aria-label="Bloques temáticos">
      {#each indice.bloques as b (b.color)}
        <span><i style:background={colorBloque(b.color)}></i>{b.nombre}</span>
      {/each}
    </section>
  {/if}
</div>

<style>
  .inicio {
    max-width: 1080px;
    margin: 0 auto;
    padding: 0 clamp(16px, 4vw, 40px) 64px;
    font-family: var(--sans);
  }
  .portada {
    padding: clamp(36px, 7vw, 72px) 0 28px;
    border-bottom: 1px solid var(--linea);
  }
  .espectro {
    display: flex;
    gap: 4px;
    width: min(260px, 60%);
    margin-bottom: 22px;
  }
  .espectro span {
    flex: 1;
    height: 6px;
    border-radius: 3px;
  }
  .sobre {
    margin: 0 0 10px;
    color: var(--tinta-tenue);
    font-size: 13px;
    font-weight: 700;
    letter-spacing: 0.14em;
    text-transform: uppercase;
  }
  h1 {
    margin: 0;
    color: var(--titulos);
    font-family: var(--serif);
    font-size: clamp(36px, 6.4vw, 60px);
    font-weight: 700;
    line-height: 1.04;
    letter-spacing: -0.02em;
    text-wrap: balance;
  }
  .datos {
    margin: 14px 0 0;
    color: var(--tinta-suave);
    font-size: 16.5px;
  }
  .muestra {
    max-width: 44em;
    margin: 18px 0 0;
    padding: 10px 14px;
    border: 1px solid var(--c-importante);
    border-radius: 10px;
    background: rgb(from var(--c-importante) r g b / var(--alfa-caja));
    color: var(--tinta);
    font-size: 14.5px;
    line-height: 1.45;
  }
  .muestra code {
    font-family: var(--mono);
    font-size: 0.9em;
  }
  .acciones {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 24px;
  }
  .acciones .boton {
    min-height: 40px;
  }
  .cuenta {
    min-width: 20px;
    padding: 0 6px;
    border-radius: 999px;
    background: var(--linea);
    color: var(--tinta-suave);
    font-size: 12px;
    line-height: 19px;
    text-align: center;
  }

  .bloque {
    margin-top: 34px;
  }
  h2 {
    margin: 0 0 14px;
    color: var(--tinta-tenue);
    font-size: 13px;
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }

  .recientes {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(290px, 1fr));
    gap: 12px;
  }
  .reciente {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 16px;
    border: 1px solid var(--linea);
    border-left: 4px solid var(--c);
    border-radius: 12px;
    background: var(--superficie);
    color: var(--tinta-tenue);
    text-decoration: none;
    transition: box-shadow 0.15s, border-color 0.15s;
  }
  .reciente:hover {
    box-shadow: var(--sombra);
  }
  .txt {
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }
  .rot {
    color: var(--tinta-tenue);
    font-size: 13px;
  }
  .tit {
    color: var(--tinta);
    font-size: 17px;
    font-weight: 700;
    line-height: 1.25;
  }
  .sec {
    overflow: hidden;
    color: var(--tinta-suave);
    font-size: 14px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .barra-prog {
    height: 3px;
    margin-top: 8px;
    border-radius: 2px;
    background: var(--linea-suave);
    overflow: hidden;
  }
  .barra-prog span {
    display: block;
    height: 100%;
    background: var(--c);
  }

  .tomos {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
    gap: 16px;
    align-items: start;
  }
  .tomo {
    padding: 6px 6px 8px;
    border: 1px solid var(--linea);
    border-radius: 14px;
    background: var(--superficie);
  }
  .tomo-cab {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 10px 10px 8px;
  }
  .tomo-id {
    color: var(--tinta-tenue);
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }
  .tomo-tit {
    color: var(--titulos);
    font-family: var(--serif);
    font-size: 18px;
    font-weight: 600;
    line-height: 1.25;
  }
  ul {
    margin: 0;
    padding: 0;
    list-style: none;
  }
  li a {
    display: flex;
    align-items: center;
    gap: 10px;
    min-height: 40px;
    padding: 6px 8px;
    border-radius: 8px;
    color: var(--tinta);
    font-size: 15px;
    line-height: 1.25;
    text-decoration: none;
  }
  li a:hover {
    background: var(--hover);
  }
  .nom {
    flex: 1;
  }
  .leido {
    flex: none;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: conic-gradient(var(--c) calc(var(--f) * 360deg), var(--linea) 0);
    -webkit-mask: radial-gradient(circle, transparent 4px, #000 4.5px);
    mask: radial-gradient(circle, transparent 4px, #000 4.5px);
  }

  .leyenda {
    display: flex;
    flex-wrap: wrap;
    gap: 8px 18px;
    color: var(--tinta-suave);
    font-size: 13.5px;
  }
  .leyenda span {
    display: inline-flex;
    align-items: center;
    gap: 7px;
  }
  .leyenda i {
    width: 12px;
    height: 12px;
    border-radius: 3px;
  }
</style>
