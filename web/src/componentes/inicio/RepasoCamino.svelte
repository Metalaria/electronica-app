<script lang="ts">
  // Start page (1.0; 2.1 a row of «Para hoy también»): the spaced review of the course paths — the completed (or
  // passed) lessons whose mastery says they are fading (dominio: retention under 0,7), the row linking to the first one
  // to review (#/practicar/<parte>/<label>); with nothing due now, a row «Próximo repaso hoy · …» (→ the courses) when
  // the next one falls due later today. Hidden otherwise (the dates are on the course pages). Read-only: lessons,
  // courses and mastery as the app keeps them.
  import { onMount } from 'svelte';
  import Fila from './Fila.svelte';
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

{#if resumen?.due.length}
  <Fila
    href={enlace(resumen.due[0]!)}
    titulo="Repaso de sus lecciones"
    detalle={`${resumen.due.length === 1 ? 'Una lección' : `${resumen.due.length} lecciones`} para repasar hoy · ${tituloConcepto(resumen.due[0]!)}`}
    aviso
    clase="repaso-camino"
    data-repaso-camino={resumen.due.length}
  />
{:else if resumen?.proximo && cuandoRepaso(resumen.proximo.t, ahora) === 'hoy'}
  <Fila
    href="#/cursos"
    titulo="Repaso de sus lecciones"
    detalle={`Al día. Próximo repaso hoy · ${tituloConcepto(resumen.proximo.clave)}`}
    clase="repaso-camino"
    data-repaso-camino={0}
  />
{/if}
