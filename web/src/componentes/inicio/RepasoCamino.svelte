<script lang="ts">
  // Start page (1.0): the spaced review of the course paths — the completed (or passed) lessons whose mastery says they
  // are fading (dominio: retention under 0,7), the first one to review with «Repasar» (#/practicar/<parte>/<label>), and
  // when the next one falls due. Read-only: lessons, courses and mastery as the app keeps them. Hidden until a lesson
  // with answers has been completed.
  import EnlaceGuia from '../guia/EnlaceGuia.svelte';
  import { onMount } from 'svelte';
  import RotateCcw from '@lucide/svelte/icons/rotate-ccw';
  import BotonPrincipal from '../ui09/BotonPrincipal.svelte';
  import { cargarLecciones, progresoLecciones } from '../../lib/lecciones.svelte';
  import { cargarCursos, estadoCursos } from '../../lib/aprendizaje/cursos-estado.svelte';
  import { cargarDominio, dominioDe, estadoDominio } from '../../lib/aprendizaje/dominio.svelte';
  import { tituloConcepto } from '../../lib/aprendizaje/catalogo';
  import { cuandoRepaso, repasoDe } from '../../lib/aprendizaje/camino';
  import { ahoraMinuto } from '../../lib/aprendizaje/minuto.svelte';

  // review 10d: what is due changes as time passes, not only when the start page is opened again
  const ahora = $derived(ahoraMinuto());

  const resumen = $derived.by(() => {
    if (!estadoDominio.listo) return null;
    void estadoDominio.version;
    const claves = new Set<string>();
    for (const [k, v] of Object.entries(progresoLecciones.secciones)) if (v?.c) claves.add(k);
    for (const k of Object.keys(estadoCursos.superadas)) claves.add(k);
    const ahoraDue: { clave: string; r: number }[] = [];
    let proximo: { clave: string; t: number } | null = null;
    for (const clave of claves) {
      const d = dominioDe(clave);
      const r = repasoDe(d, ahora);
      if (r.k === 'ahora') ahoraDue.push({ clave, r: d.retencion });
      else if (r.k === 'fecha' && (!proximo || r.t < proximo.t)) proximo = { clave, t: r.t };
    }
    ahoraDue.sort((a, b) => a.r - b.r || a.clave.localeCompare(b.clave));
    return { due: ahoraDue.map((x) => x.clave), proximo };
  });

  const enlace = (clave: string) => `#/practicar/${clave.split('/').map(encodeURIComponent).join('/')}`;

  onMount(() => {
    const ir = () => {
      void cargarLecciones();
      void cargarCursos();
      void cargarDominio();
    };
    if ('requestIdleCallback' in window) {
      const id = window.requestIdleCallback(ir, { timeout: 1500 });
      return () => window.cancelIdleCallback(id);
    }
    const t = setTimeout(ir, 400);
    return () => clearTimeout(t);
  });
</script>

{#if resumen && (resumen.due.length || resumen.proximo)}
  <section class="t09-tarjeta repaso-camino" aria-labelledby="tit-repaso-camino" data-repaso-camino={resumen.due.length}>
    <div class="fila">
      <span class="icono" aria-hidden="true"><RotateCcw size={24} /></span>
      <div class="textos">
        <h2 id="tit-repaso-camino">Repaso de sus lecciones</h2>
        {#if resumen.due.length}
          <span class="rep">{resumen.due.length === 1 ? 'Una lección para repasar hoy' : `${resumen.due.length} lecciones para repasar hoy`}</span>
          <span class="det">Primero: {tituloConcepto(resumen.due[0]!)}</span>
        {:else if resumen.proximo}
          <span class="det">Al día. Próximo repaso {cuandoRepaso(resumen.proximo.t, ahora)}: {tituloConcepto(resumen.proximo.clave)}</span>
        {/if}
      </div>
      {#if resumen.due.length}<BotonPrincipal href={enlace(resumen.due[0]!)} contorno>Repasar</BotonPrincipal>{/if}
    </div>
    <div class="pie-repaso">
      <a class="cursos" href="#/cursos">Ver el camino de sus cursos</a>
      <!-- 1.0: how the spaced review works, in the user guide -->
      <EnlaceGuia seccion="repaso" apartado="repaso-espaciado" />
    </div>
  </section>
{/if}

<style>
  .fila {
    display: flex;
    align-items: center;
    gap: 14px;
  }
  .icono {
    display: grid;
    flex: none;
    place-items: center;
    width: 48px;
    height: 48px;
    border-radius: 12px;
    background: var(--acento-tinte);
    color: var(--acento);
  }
  .textos {
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }
  h2 {
    margin: 0;
    color: var(--tinta);
    font-size: 16px;
    font-weight: 600;
  }
  .det {
    color: var(--tinta-suave);
    font-size: 14px;
  }
  .rep {
    color: color-mix(in srgb, var(--ambar) 80%, var(--tinta));
    font-size: 14px;
    font-weight: 600;
  }
  .fila :global(.t09-boton) {
    flex: none;
  }
  .pie-repaso {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0 20px;
    margin: 6px 0 -10px 62px;
  }
  .cursos {
    display: flex;
    align-items: center;
    min-height: var(--toque);
    color: var(--acento);
    font-size: 14px;
    font-weight: 600;
    text-decoration: none;
  }
  .cursos:hover {
    text-decoration: underline;
  }
</style>
