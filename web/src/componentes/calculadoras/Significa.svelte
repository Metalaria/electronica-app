<script lang="ts">
  // «Qué significa»: the book's own explanation of the formula (quotes checked against its section by
  // contenido/formulas_enriquecer.py) and where to go from here: the section, the animation, the simulator
  // and the exercises that use it.
  import type { Formula } from './tipos';
  import { enlacesDe, COMPONENTES, CONCEPTOS_ANIMADOS } from '../animaciones/coleccion';
  import { rutaDeRef, prepararHtml } from '../../lib/datos';
  import { app } from '../../lib/estado.svelte';
  import Icono from '../Icono.svelte';

  let { f }: { f: Formula } = $props();

  const TITULOS: Record<string, string> = {
    significa: 'Qué significa',
    aplica: 'Cuándo vale',
    valores: 'Valores típicos',
    error: 'Error frecuente',
  };

  /** Animations of the family, when the formula's section has none of its own. */
  const POR_FAMILIA: Record<string, string[]> = {
    leyes: ['resistencia-ohm', 'resistencia-potencia'], redes: ['thevenin-norton', 'kirchhoff'], transitorios: ['rc-carga'],
    alterna: ['fasores', 'impedancia'], resonancia: ['resonancia', 'transitorio-rlc'], filtros: ['bode-polos-ceros'],
    decibelios: ['bode-polos-ceros'], diodos: ['diodo-polarizacion', 'rectificador'], bjt: ['bjt-curvas'],
    mosfet: ['mosfet-curvas', 'pwm'], opamp: ['opamp', 'realimentacion'], osciladores: ['oscilador', 'pid'],
    fuentes: ['fuente-lineal', 'conmutadas'], magnetismo: ['transformador', 'bobina-lenz'], ruido: ['ruido'],
    digital: ['muestreo-aliasing', 'cuantizacion'], rf: ['reflexiones', 'adaptacion-smith'], termica: ['resistencia-potencia'],
  };

  const animaciones = $derived.by(() => {
    const vistos = new Set<string>();
    const out: { titulo: string; href: string; propia: boolean }[] = [];
    for (const lab of [f.sub, f.seccion.label, f.explicacion?.ref]) {
      if (!lab) continue;
      for (const e of enlacesDe(lab)) {
        if (vistos.has(e.href)) continue;
        vistos.add(e.href);
        out.push({ titulo: e.entrada.titulo, href: e.href, propia: true });
      }
    }
    if (!out.length) {
      for (const id of POR_FAMILIA[f.familia ?? ''] ?? []) {
        for (const col of [COMPONENTES, CONCEPTOS_ANIMADOS]) {
          const e = col.lista.find((x) => x.id === id);
          if (e && id in col.cargadores) out.push({ titulo: e.titulo, href: `#/${col.ruta}/${id}`, propia: false });
        }
      }
    }
    return out.slice(0, 3);
  });

  const ejercicios = $derived(
    (f.ejercicios ?? []).map((l) => {
      const r = app.refs[l];
      const tipo = r?.tipo === 'prob' ? 'Problema' : 'Ejercicio';
      return { href: rutaDeRef(l), texto: `${tipo} ${r?.num ?? l}` };
    }).filter((e) => e.href),
  );

  const enlaceSeccion = $derived(rutaDeRef(f.explicacion?.ref ?? f.sub ?? f.seccion.label) ?? rutaDeRef(f.seccion.label));
</script>

<div class="significa">
  {#if f.explicacion}
    <dl>
      {#each f.explicacion.partes as p (p.k)}
        <div class="parte {p.k}">
          <dt>{TITULOS[p.k]}</dt>
          <dd>{@html prepararHtml(p.html)}</dd>
        </div>
      {/each}
    </dl>
    <p class="fuente">Del libro, sección <a href={enlaceSeccion ?? undefined}>{f.explicacion.ref_num}</a>; las frases entre comillas son literales.</p>
  {:else if f.nota}
    <p class="nota-libro">{@html prepararHtml(f.nota)}</p>
  {/if}

  <nav class="enlaces" aria-label="Más sobre esta fórmula">
    <a class="enlace" href={enlaceSeccion ?? undefined}><Icono nombre="libro" tam={16} /> Leer la sección {f.seccion.num}</a>
    {#each animaciones as a (a.href)}
      <a class="enlace" href={a.href}><Icono nombre="componentes" tam={16} /> {a.propia ? 'Animación' : 'Animación relacionada'}: {a.titulo}</a>
    {/each}
    {#each (f.simulador ?? []).slice(0, 2) as n (n.k)}
      <a class="enlace" href="#/simulador/{n.k}"><Icono nombre="simulador" tam={16} /> Simular: {n.t}</a>
    {/each}
    {#each ejercicios as e (e.href)}
      <a class="enlace" href={e.href}><Icono nombre="ejercicios" tam={16} /> {e.texto}</a>
    {/each}
  </nav>
</div>

<style>
  dl {
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .parte {
    padding-left: 12px;
    border-left: 3px solid var(--acento-borde);
  }
  .parte.error {
    border-left-color: var(--c-precaucion);
  }
  .parte.aplica {
    border-left-color: var(--c-importante);
  }
  .parte.valores {
    border-left-color: var(--c-ejemplo);
  }
  dt {
    color: var(--tinta-suave);
    font-size: 12.5px;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }
  dd {
    margin: 2px 0 0;
    font-family: var(--serif);
    font-size: 16px;
    line-height: 1.5;
  }
  dd :global(sub),
  .nota-libro :global(sub) {
    font-size: 0.75em;
  }
  .fuente,
  .nota-libro {
    margin: 10px 0 0;
    color: var(--tinta-tenue);
    font-size: 13px;
  }
  .nota-libro {
    color: var(--tinta-suave);
    font-size: 14px;
  }
  .enlaces {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: 12px;
  }
  .enlace {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    min-height: 44px;
    padding: 0 12px;
    border: 1px solid var(--linea);
    border-radius: 999px;
    background: var(--superficie);
    color: var(--acento);
    font-size: 14px;
    text-decoration: none;
  }
  .enlace:hover {
    background: var(--acento-tinte);
  }
</style>
