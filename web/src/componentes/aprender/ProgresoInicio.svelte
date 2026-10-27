<script lang="ts">
  // Start page: how much of the book has been read, chapters in progress (reading and exercises solved),
  // and the way into the exercises and the review of the failed ones.
  import { onMount } from 'svelte';
  import { app } from '../../lib/estado.svelte';
  import { rotuloParte } from '../../lib/datos';
  import { tonoBloque } from '../../lib/color';
  import { cargarEjercicios, ejercicios } from '../../lib/ejercicios.svelte';
  import { aprendizaje, cargarAprendizaje, estadoDe } from '../../lib/aprendizaje.svelte';
  import Icono from '../Icono.svelte';
  import Insignia from '../Insignia.svelte';

  const indice = $derived(app.indice!);

  const lectura = $derived.by(() => {
    let total = 0;
    let leidas = 0;
    const enCurso: { id: string; f: number; t: number }[] = [];
    if (!aprendizaje.listo) return { total, leidas, enCurso };
    for (const [id, p] of Object.entries(indice.partes)) {
      const secs = p.secciones ?? [];
      total += secs.length;
      const l = aprendizaje.leidas[id];
      if (!l || !secs.length) continue;
      let n = 0;
      let t = 0;
      for (const s of secs) {
        const ts = l[s.label];
        if (ts) {
          n++;
          t = Math.max(t, ts);
        }
      }
      leidas += n;
      if (n) enCurso.push({ id, f: n / secs.length, t });
    }
    enCurso.sort((a, b) => b.t - a.t);
    return { total, leidas, enCurso };
  });

  const ej = $derived.by(() => {
    const d = ejercicios.datos;
    const porParte: Record<string, { total: number; resueltos: number }> = {};
    let total = 0;
    let resueltos = 0;
    let fallados = 0;
    if (!d || !aprendizaje.listo) return { total, resueltos, fallados, porParte };
    for (const c of d.capitulos) {
      let r = 0;
      for (const l of c.items) {
        const e = estadoDe(l);
        if (e === 'resuelto') r++;
        else if (e === 'fallado') fallados++;
      }
      porParte[c.parte] = { total: c.items.length, resueltos: r };
      total += c.items.length;
      resueltos += r;
    }
    return { total, resueltos, fallados, porParte };
  });

  // chapters in progress: some reading or some exercise done, not everything; the most recent first
  const capitulos = $derived.by(() => {
    const vistos = new Set<string>();
    const lista: { id: string; f: number }[] = [];
    for (const c of lectura.enCurso) {
      const e = ej.porParte[c.id];
      if (c.f >= 1 && (!e || e.resueltos >= e.total)) continue;
      vistos.add(c.id);
      lista.push({ id: c.id, f: c.f });
    }
    for (const [id, e] of Object.entries(ej.porParte)) {
      if (!vistos.has(id) && e.resueltos > 0 && e.resueltos < e.total) lista.push({ id, f: 0 });
    }
    return lista.slice(0, 6);
  });

  function corto(t: string | undefined): string {
    return (t ?? '').split(' — ')[0] ?? '';
  }

  const pct = (x: number) => `${Math.round(x * 100)} %`;

  onMount(() => {
    void cargarAprendizaje();
    void cargarEjercicios();
  });
</script>

{#if aprendizaje.listo}
  <section class="bloque progreso-inicio" aria-label="Progreso">
    <h2>Progreso</h2>
    <div class="resumen">
      <div class="dato">
        <span class="cifra">{pct(lectura.total ? lectura.leidas / lectura.total : 0)}</span>
        <span class="txt">del libro leído <span class="det">({lectura.leidas} de {lectura.total} secciones)</span></span>
        <span class="barra" aria-hidden="true"><span style:width={`${(lectura.leidas / Math.max(1, lectura.total)) * 100}%`}></span></span>
      </div>
      <a class="dato enlace" href="#/ejercicios">
        <span class="cifra">{ej.resueltos}<small>{` / ${ej.total || '…'}`}</small></span>
        <span class="txt">ejercicios y problemas resueltos</span>
        <span class="barra" aria-hidden="true"><span style:width={`${(ej.resueltos / Math.max(1, ej.total)) * 100}%`}></span></span>
      </a>
      {#if ej.fallados}
        <a class="boton repasar" href="#/ejercicios/repaso"><Icono nombre="repaso" tam={17} /> Repasar {ej.fallados} fallados</a>
      {/if}
    </div>

    {#if capitulos.length}
      <h3>Capítulos en curso</h3>
      <ul class="en-curso">
        {#each capitulos as c (c.id)}
          {@const info = indice.partes[c.id]}
          {@const e = ej.porParte[c.id]}
          <li>
            <a href={c.id === 'glosario' ? '#/glosario' : `#/${c.id}`} style:--c={tonoBloque(info?.color, app.tema).relleno}>
              <Insignia parte={c.id} />
              <span class="cuerpo">
                <span class="nom">{rotuloParte(c.id)} · {corto(info?.titulo)}</span>
                <span class="barra" aria-hidden="true"><span style:width={`${c.f * 100}%`}></span></span>
                <span class="det">
                  {pct(c.f)} leído{#if e}{` · ${e.resueltos}/${e.total} ejercicios`}{/if}
                </span>
              </span>
            </a>
          </li>
        {/each}
      </ul>
    {/if}
  </section>
{/if}

<style>
  /* 0.9: the start page's card look (componentes/ui09) */
  .bloque {
    margin-top: 8px;
  }
  h2 {
    margin: 0 0 14px;
    color: var(--tinta-suave);
    font-size: 13px;
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }
  h3 {
    margin: 22px 0 10px;
    color: var(--tinta-suave);
    font-size: 15px;
    font-weight: 700;
  }
  .resumen {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
    align-items: stretch;
    gap: 12px;
  }
  .dato {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 16px;
    border: 1px solid var(--linea);
    border-radius: var(--radio-tarjeta);
    background: var(--superficie);
    color: var(--tinta);
    text-decoration: none;
  }
  .enlace:hover {
    box-shadow: var(--sombra);
  }
  .cifra {
    color: var(--titulos);
    font-size: 28px;
    font-weight: 700;
    line-height: 1.1;
    font-variant-numeric: tabular-nums;
  }
  .cifra small {
    color: var(--tinta-suave);
    font-size: 17px;
    font-weight: 600;
  }
  .txt {
    color: var(--tinta-suave);
    font-size: 14.5px;
  }
  .det {
    color: var(--tinta-suave);
    font-size: 13px;
  }
  .barra {
    display: block;
    height: 5px;
    margin-top: 6px;
    border-radius: 3px;
    background: var(--linea-suave);
    overflow: hidden;
  }
  .barra span {
    display: block;
    height: 100%;
    background: var(--c-ejemplo);
  }
  .repasar {
    align-self: center;
    justify-self: start;
    min-height: 44px;
  }
  .en-curso {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(290px, 1fr));
    gap: 10px;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .en-curso a {
    display: flex;
    align-items: center;
    gap: 12px;
    min-height: 56px;
    padding: 10px 14px;
    border: 1px solid var(--linea);
    border-left: 4px solid var(--c);
    border-radius: var(--radio-tarjeta-p);
    background: var(--superficie);
    color: var(--tinta);
    text-decoration: none;
  }
  .en-curso a:hover {
    box-shadow: var(--sombra);
  }
  .cuerpo {
    display: flex;
    flex: 1;
    flex-direction: column;
    min-width: 0;
  }
  .nom {
    overflow: hidden;
    font-size: 15px;
    font-weight: 600;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .en-curso .barra span {
    background: var(--c);
  }
  .en-curso .det {
    margin-top: 4px;
  }
</style>
