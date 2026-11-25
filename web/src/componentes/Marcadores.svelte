<script lang="ts">
  import { onMount } from 'svelte';
  import { app } from '../lib/estado.svelte';
  import { ruta, recordarScroll } from '../lib/ruta.svelte';
  import { usuario, quitarMarcador, quitarNota } from '../lib/usuario.svelte';
  import { infoParte, numeroImpreso, ordenLectura, rotuloParte } from '../lib/datos';
  import { colorBloque } from '../lib/color';
  import Icono from './Icono.svelte';
  import Insignia from './Insignia.svelte';
  import Pestanas21 from './sistema21/Pestanas21.svelte';

  type Filtro = 'todo' | 'marcadores' | 'notas';
  let filtro = $state<Filtro>('todo');

  interface Fila {
    label: string;
    num: string;
    titulo: string;
    marcador: boolean;
    nota: string | null;
    t: number;
  }

  const grupos = $derived.by(() => {
    const orden = ordenLectura();
    const porParte = new Map<string, Map<string, Fila>>();
    const anadir = (parte: string, label: string, num: string, titulo: string, t: number) => {
      let m = porParte.get(parte);
      if (!m) porParte.set(parte, (m = new Map()));
      let f = m.get(label);
      // (review 11a: the printed number as the book prints it now — an expansion can renumber what was marked)
      if (!f) m.set(label, (f = { label, num: numeroImpreso(label, num), titulo, marcador: false, nota: null, t }));
      f.t = Math.max(f.t, t);
      return f;
    };
    if (filtro !== 'notas')
      for (const m of Object.values(usuario.marcadores)) anadir(m.parte, m.label, m.num, m.titulo, m.t).marcador = true;
    if (filtro !== 'marcadores')
      for (const n of Object.values(usuario.notas)) anadir(n.parte, n.label, n.num, n.titulo, n.t).nota = n.texto;
    return [...porParte.entries()]
      .sort((a, b) => idx(orden, a[0]) - idx(orden, b[0]))
      .map(([parte, filas]) => {
        const secs = infoParte(parte)?.secciones ?? [];
        const pos = (l: string) => {
          const i = secs.findIndex((s) => s.label === l);
          return i < 0 ? 1e9 : i;
        };
        return { parte, filas: [...filas.values()].sort((a, b) => pos(a.label) - pos(b.label)) };
      });
  });

  function idx(orden: string[], p: string): number {
    const i = orden.indexOf(p);
    return i < 0 ? 1e9 : i;
  }

  const nMarcadores = $derived(Object.keys(usuario.marcadores).length);
  const nNotas = $derived(Object.keys(usuario.notas).length);

  function fecha(t: number): string {
    return new Date(t).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  onMount(() => {
    app.seccion = null;
    window.scrollTo({ top: ruta.y ?? 0, behavior: 'instant' });
    const desplazar = () => recordarScroll();
    window.addEventListener('scroll', desplazar, { passive: true });
    return () => window.removeEventListener('scroll', desplazar);
  });
</script>

<svelte:head><title>Marcadores y notas · Electrónica Práctica Avanzada</title></svelte:head>

<div class="marcadores">
  <header>
    <h1>Marcadores y notas</h1>
    <p>Las secciones que ha marcado y sus notas personales, en el orden del libro.</p>
  </header>
  <!-- 2.1: the system's underline tabs (componentes/sistema21) -->
  <Pestanas21
    etiqueta="Mostrar"
    clase="filtros"
    items={[
      { id: 'todo', texto: 'Todo' },
      { id: 'marcadores', texto: 'Marcadores', cuenta: nMarcadores, etiqueta: `Marcadores (${nMarcadores})` },
      { id: 'notas', texto: 'Notas', cuenta: nNotas, etiqueta: `Notas (${nNotas})` },
    ]}
    actual={filtro}
    onelegir={(id) => (filtro = id as Filtro)}
  />

  {#if !grupos.length}
    <div class="vacio">
      <div class="ic"><Icono nombre={filtro === 'notas' ? 'nota' : 'marcador'} tam={30} grosor={1.6} /></div>
      <h2>
        {filtro === 'notas' ? 'Todavía no hay notas' : filtro === 'marcadores' ? 'Todavía no hay marcadores' : 'Todavía no hay marcadores ni notas'}
      </h2>
      <p>
        Junto al título de cada sección hay dos botones: <Icono nombre="marcador" tam={15} /> para marcarla y
        <Icono nombre="nota" tam={15} /> para escribir una nota. Aparecerán aquí.
      </p>
    </div>
  {:else}
    {#each grupos as g (g.parte)}
      {@const info = infoParte(g.parte)}
      <section class="grupo" style:--c={colorBloque(info?.color)}>
        <h2>
          <Insignia parte={g.parte} />
          <span>{rotuloParte(g.parte)}{info?.num != null ? ` · ${(info?.titulo ?? '').split(' — ')[0]}` : ''}</span>
        </h2>
        <ul>
          {#each g.filas as f (f.label)}
            <li>
              <div class="fila">
                <a href={`#/${g.parte}/${f.label}`}>
                  <span class="n">{f.num}</span>
                  <span class="t">{f.titulo}</span>
                </a>
                <span class="fecha">{fecha(f.t)}</span>
                {#if f.marcador}
                  <button class="boton-icono" aria-label="Quitar el marcador de {f.num}" title="Quitar marcador" onclick={() => quitarMarcador(f.label)}
                    ><Icono nombre="marcador-lleno" tam={18} /></button
                  >
                {:else}
                  <span class="hueco" aria-hidden="true"></span>
                {/if}
              </div>
              {#if f.nota}
                <div class="nota">
                  <p>{f.nota}</p>
                  <div class="acc">
                    <a class="boton" href={`#/${g.parte}/${f.label}`}><Icono nombre="editar" tam={15} /> Editar en la sección</a>
                    <button class="boton" onclick={() => quitarNota(f.label)}><Icono nombre="borrar" tam={15} /> Borrar</button>
                  </div>
                </div>
              {/if}
            </li>
          {/each}
        </ul>
      </section>
    {/each}
  {/if}
</div>

<style>
  .marcadores {
    max-width: 860px;
    margin: 0 auto;
    padding: 0 clamp(16px, 4vw, 40px) 64px;
    font-family: var(--sans);
  }
  header {
    padding: var(--e21-4) 0 0;
  }
  h1 {
    margin: 0;
    color: var(--v11-tinta);
    font-family: var(--titular);
    font-size: var(--t21-pagina);
    font-weight: 600;
    letter-spacing: -0.01em;
    line-height: 1.15;
  }
  header p {
    margin: var(--e21-1) 0 0;
    color: var(--v11-tinta-suave);
    font-size: var(--t21-secundario);
  }
  .marcadores :global(.filtros) {
    margin-top: var(--e21-3);
  }

  .vacio {
    max-width: 30em;
    margin: 56px auto;
    color: var(--tinta-suave);
    text-align: center;
  }
  .vacio .ic {
    display: inline-grid;
    place-items: center;
    width: 64px;
    height: 64px;
    border-radius: 50%;
    background: var(--superficie-2);
    color: var(--tinta-tenue);
  }
  .vacio h2 {
    margin: 16px 0 6px;
    color: var(--tinta);
    font-size: 19px;
  }
  .vacio p {
    margin: 0;
    font-size: 15.5px;
    line-height: 1.5;
  }
  .vacio p :global(svg) {
    vertical-align: -2px;
  }

  .grupo {
    margin-top: var(--e21-4);
  }
  .grupo h2 {
    display: flex;
    align-items: center;
    gap: 10px;
    margin: 0 0 8px;
    color: var(--tinta);
    font-size: 16px;
    font-weight: 700;
  }
  /* 2.1: rows with hairlines, no box around them */
  ul {
    margin: 0;
    padding: 0;
    border-top: 1px solid var(--v11-linea);
    list-style: none;
  }
  li {
    border-bottom: 1px solid var(--v11-linea);
  }
  .fila {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 4px 6px 4px 4px;
  }
  .fila a {
    display: flex;
    flex: 1;
    gap: 10px;
    min-width: 0;
    min-height: 44px;
    align-items: center;
    padding: 4px 10px;
    border-radius: 8px;
    color: var(--tinta);
    font-size: 15.5px;
    text-decoration: none;
  }
  .fila a:hover {
    background: var(--hover);
  }
  .n {
    flex: none;
    min-width: 2.6em;
    color: var(--c);
    font-weight: 700;
  }
  :global(:root[data-tema='oscuro']) .n {
    color: var(--acento);
  }
  .t {
    flex: 1;
    line-height: 1.3;
  }
  .fecha {
    flex: none;
    color: var(--tinta-tenue);
    font-size: 13px;
  }
  .fila .boton-icono {
    color: var(--c);
  }
  :global(:root[data-tema='oscuro']) .fila .boton-icono {
    color: var(--acento);
  }
  .hueco {
    flex: none;
    width: 40px;
  }
  .nota {
    margin: 0 14px 12px 14px;
    padding: 10px 12px;
    border: 1px solid var(--nota-personal-borde);
    border-radius: 8px;
    background: var(--nota-personal);
  }
  .nota p {
    margin: 0;
    color: var(--tinta);
    font-size: 15px;
    line-height: 1.5;
    white-space: pre-wrap;
  }
  .nota .acc {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: 10px;
  }
  .nota .boton {
    min-height: 32px;
    font-size: 13.5px;
  }
  /* touch screens: «Editar en la sección» and «Borrar» of a note (32 px; 0.11 final QA, once there are notes) */
  @media (pointer: coarse) {
    .nota .boton {
      min-height: 44px;
    }
  }
  @media (max-width: 520px) {
    .fecha {
      display: none;
    }
  }
</style>
