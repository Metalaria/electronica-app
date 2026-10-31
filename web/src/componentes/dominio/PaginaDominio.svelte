<script lang="ts">
  // «Dominio» (0.11, group B; #/progreso/dominio): the mastery of every concept (book section) the reader has
  // practised — the weakest first with «Practicar esto», the ones being forgotten with «Repasar», and the mastery of
  // each course and its chapters (sections without anything to answer do not count).
  import { onMount } from 'svelte';
  import ArrowRight from '@lucide/svelte/icons/arrow-right';
  import { app } from '../../lib/estado.svelte';
  import { ruta } from '../../lib/ruta.svelte';
  import { rotuloParte } from '../../lib/datos';
  import { corto } from '../../lib/navegacion.svelte';
  import { CURSOS } from '../../lib/aprendizaje/cursos';
  import { cargarDominio, conceptosConDominio, dominioDeClaves, estadoDominio } from '../../lib/aprendizaje/dominio.svelte';
  import { NOMBRE_NIVEL_DOMINIO, porcentaje } from '../../lib/aprendizaje/dominio';
  import { cargarPracticables, conceptosPracticables, tituloConcepto } from '../../lib/aprendizaje/catalogo';
  import Rotulo from '../ui09/Rotulo.svelte';
  import MedidorDominio from './MedidorDominio.svelte';
  import BarraDominio from './BarraDominio.svelte';

  let practicables = $state(false);
  let abierto = $state<string | null>(null);

  const conceptos = $derived(estadoDominio.listo ? conceptosConDominio() : []);
  const debiles = $derived(
    conceptos
      .filter((c) => c.valor < 0.6 && !c.repasar)
      .sort((a, b) => a.valor - b.valor || a.ultima - b.ultima)
      .slice(0, 8),
  );
  const repasar = $derived(
    conceptos
      .filter((c) => c.repasar)
      .sort((a, b) => a.retencion - b.retencion)
      .slice(0, 6),
  );
  const cuenta = $derived.by(() => {
    const r = { dominado: 0, competente: 0, familiarizado: 0, intentado: 0 };
    for (const c of conceptos) if (c.nivel !== 'nuevo') r[c.nivel]++;
    return r;
  });
  const cursos = $derived(
    practicables
      ? CURSOS.map((c) => {
          const claves = c.partes.flatMap((p) => conceptosPracticables(p));
          return { c, a: dominioDeClaves(claves) };
        })
      : [],
  );

  const enlace = (clave: string) => `#/practicar/${clave.split('/').map(encodeURIComponent).join('/')}`;
  const capitulo = (clave: string) => {
    const p = clave.slice(0, clave.indexOf('/'));
    return `${rotuloParte(p)} · ${corto(app.indice?.partes[p]?.titulo ?? '')}`;
  };
  const hace = (t: number) => {
    const d = Math.round((Date.now() - t) / 86_400_000);
    return d <= 0 ? 'hoy' : d === 1 ? 'ayer' : `hace ${d} días`;
  };

  onMount(() => {
    window.scrollTo({ top: ruta.y ?? 0, behavior: 'instant' });
    void cargarDominio();
    void cargarPracticables().then(() => (practicables = true));
  });
</script>

<svelte:head><title>Dominio · Electrónica Práctica Avanzada</title></svelte:head>

<div class="dominio" data-pagina-dominio data-conceptos={conceptos.length}>
  <header class="cab">
    <h1>Dominio por conceptos</h1>
    <p>
      Cada sección del libro es un concepto. Su dominio sube con los aciertos, sobre todo a la primera y en días distintos, y baja poco a poco si
      no se repasa.
    </p>
  </header>

  <section class="t09-tarjeta t09-grande resumen" aria-labelledby="tit-resumen-dominio">
    <h2 id="tit-resumen-dominio" class="solo-lector">Resumen</h2>
    {#if !estadoDominio.listo}
      <p class="nota">Calculando…</p>
    {:else if !conceptos.length}
      <p class="vacio" data-dominio-vacio>
        Todavía no hay respuestas con las que medir su dominio. Responda las prácticas y preguntas de las lecciones, o empiece una práctica inteligente:
        cada respuesta cuenta.
      </p>
    {:else}
      <ul class="niveles">
        {#each ['dominado', 'competente', 'familiarizado', 'intentado'] as const as n (n)}
          <li data-cuenta-nivel={n}>
            <MedidorDominio nivel={n} valor={n === 'dominado' ? 0.9 : n === 'competente' ? 0.7 : n === 'familiarizado' ? 0.5 : 0.2} tam="normal" />
            <strong>{cuenta[n]}</strong>
            <span>{NOMBRE_NIVEL_DOMINIO[n].toLowerCase()}{cuenta[n] === 1 ? '' : 's'}</span>
          </li>
        {/each}
      </ul>
      {#if repasar.length}<p class="nota">{repasar.length === 1 ? 'Un concepto empieza' : `${repasar.length} conceptos empiezan`} a olvidarse: conviene repasar.</p>{/if}
    {/if}
    <a class="t09-boton" href="#/practicar" data-practica-inteligente>Práctica inteligente <ArrowRight size={20} aria-hidden="true" /></a>
  </section>

  {#if debiles.length}
    <section class="lista" aria-labelledby="tit-debiles">
      <Rotulo etiqueta="h2" id="tit-debiles">Lo que más le cuesta</Rotulo>
      <ul>
        {#each debiles as d (d.clave)}
          <li data-concepto-debil={d.clave}>
            <div class="info">
              <span class="nom">{tituloConcepto(d.clave)}</span>
              <span class="det">{capitulo(d.clave)} · {porcentaje(d.valor)} · {d.items} {d.items === 1 ? 'ejercicio' : 'ejercicios'}</span>
              <MedidorDominio nivel={d.nivel} valor={d.valor} repasar={d.repasar} texto />
            </div>
            <a class="t09-boton t09-contorno" href={enlace(d.clave)} data-practicar-esto>Practicar esto</a>
          </li>
        {/each}
      </ul>
    </section>
  {/if}

  {#if repasar.length}
    <section class="lista" aria-labelledby="tit-repasar">
      <Rotulo etiqueta="h2" id="tit-repasar">Para repasar</Rotulo>
      <ul>
        {#each repasar as d (d.clave)}
          <li data-concepto-repasar={d.clave}>
            <div class="info">
              <span class="nom">{tituloConcepto(d.clave)}</span>
              <span class="det">{capitulo(d.clave)} · practicado {hace(d.ultima)} · recuerdo {porcentaje(d.retencion)}</span>
              <MedidorDominio nivel={d.nivel} valor={d.valor} repasar texto />
            </div>
            <a class="t09-boton t09-contorno" href={enlace(d.clave)} data-practicar-esto>Repasar</a>
          </li>
        {/each}
      </ul>
    </section>
  {/if}

  <section class="cursos" aria-labelledby="tit-cursos-dominio">
    <Rotulo etiqueta="h2" id="tit-cursos-dominio">Por cursos</Rotulo>
    {#if !practicables}
      <p class="nota">Contando las secciones…</p>
    {:else}
      <ul>
        {#each cursos as { c, a } (c.id)}
          <li class="curso" data-dominio-curso={c.id}>
            <button type="button" class="fila" aria-expanded={abierto === c.id} onclick={() => (abierto = abierto === c.id ? null : c.id)}>
              <span class="nom">{c.nombre}</span>
              <span class="pct">{porcentaje(a.valor)}</span>
            </button>
            <BarraDominio {a} />
            {#if abierto === c.id}
              <ul class="capitulos">
                {#each c.partes as p (p)}
                  {@const ac = dominioDeClaves(conceptosPracticables(p))}
                  {#if ac.total}
                    <li data-dominio-capitulo={p}>
                      <span class="nom">{rotuloParte(p)} · {corto(app.indice?.partes[p]?.titulo ?? '')}</span>
                      <BarraDominio a={ac} />
                      <a class="mini" href={`#/practicar/${p}`}>Practicar el capítulo</a>
                    </li>
                  {/if}
                {/each}
              </ul>
            {/if}
          </li>
        {/each}
      </ul>
    {/if}
  </section>
</div>

<style>
  .dominio {
    display: flex;
    flex-direction: column;
    gap: 24px;
    max-width: 880px;
    margin: 0 auto;
    padding: 32px 32px 64px;
    font-family: var(--sans);
  }
  @media (max-width: 600px) {
    .dominio {
      padding: 16px 16px 48px;
    }
  }
  .cab h1 {
    margin: 0;
    color: var(--titulos);
    font-family: var(--serif);
    font-size: 30px;
    line-height: 1.15;
  }
  .cab p {
    max-width: 44em;
    margin: 6px 0 0;
    color: var(--tinta-suave);
    font-size: 16px;
    line-height: 1.5;
  }
  .resumen {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 14px;
  }
  .niveles {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
    gap: 10px 18px;
    width: 100%;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .niveles li {
    display: flex;
    align-items: center;
    gap: 8px;
    color: var(--tinta-suave);
    font-size: 15px;
  }
  .niveles strong {
    color: var(--tinta);
    font-size: 20px;
  }
  .vacio,
  .nota {
    margin: 0;
    color: var(--tinta-suave);
    font-size: 15px;
    line-height: 1.5;
  }
  .lista ul,
  .cursos > ul,
  .capitulos {
    margin: 8px 0 0;
    padding: 0;
    list-style: none;
  }
  .lista li {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 8px 16px;
    padding: 12px 0;
    border-top: 1px solid var(--linea-suave);
  }
  .info {
    display: flex;
    flex: 1 1 18em;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
  }
  .nom {
    color: var(--tinta);
    font-size: 16px;
    font-weight: 600;
  }
  .det {
    color: var(--tinta-suave);
    font-size: 14px;
  }
  .lista :global(.t09-boton) {
    flex: none;
  }
  .curso {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 10px 0 14px;
    border-top: 1px solid var(--linea-suave);
  }
  .fila {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    min-height: 44px;
    padding: 0;
    border: 0;
    background: none;
    color: var(--tinta);
    font: inherit;
    text-align: left;
  }
  .fila .nom::after {
    content: ' ▾';
    color: var(--tinta-suave);
    font-size: 13px;
  }
  .fila[aria-expanded='true'] .nom::after {
    content: ' ▴';
  }
  .pct {
    color: var(--tinta-suave);
    font-size: 15px;
    font-variant-numeric: tabular-nums;
  }
  .capitulos {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding-left: 12px;
    border-left: 3px solid var(--linea);
  }
  .capitulos li {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .capitulos .nom {
    font-size: 15px;
    font-weight: 600;
  }
  .mini {
    display: inline-flex;
    align-items: center;
    align-self: flex-start;
    min-height: 44px;
    color: var(--acento);
    font-size: 14px;
    font-weight: 600;
  }
</style>
