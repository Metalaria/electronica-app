<script lang="ts">
  // «Arquitectura» tab: block diagram animated from the timed scenarios, with play/pause, single step, a
  // scrubber, address decoding and the logic analyser.
  import Play from '@lucide/svelte/icons/play';
  import Pause from '@lucide/svelte/icons/pause';
  import SkipBack from '@lucide/svelte/icons/skip-back';
  import SkipForward from '@lucide/svelte/icons/skip-forward';
  import ZoomIn from '@lucide/svelte/icons/zoom-in';
  import ZoomOut from '@lucide/svelte/icons/zoom-out';
  import Maximize from '@lucide/svelte/icons/maximize';
  import Escena from '../../animaciones/ui/Escena.svelte';
  import { Reloj } from '../../animaciones/nucleo/reloj.svelte';
  import type { Vista } from '../../animaciones/nucleo/dibujo';
  import type { EventoPuntero } from '../../animaciones/ui/Escena.svelte';
  import { NES } from './nes';
  import { NEOGEO } from './neogeo';
  import { dibujarDiagrama, bloqueEn } from './dibujo';
  import { factor, hex, muestrear, tiempo, type Escenario } from './modelo';
  import type { Decodificacion, Opciones } from './diagrama';
  import Analizador from './Analizador.svelte';
  import type { DatosMaquina } from '../datos';
  import type { Seleccion } from '../estado.svelte';

  let {
    datos,
    sel,
    seleccionar,
    irA,
  }: {
    datos: DatosMaquina;
    sel: Seleccion | null;
    seleccionar: (s: Seleccion | null) => void;
    irA: (pestana: 'foto' | 'esquema', s: Seleccion) => void;
  } = $props();

  const maquina = $derived(datos.id === 'nes' ? NES : NEOGEO);
  let escenarioId = $state('bus');
  let opciones: Opciones = $state({});
  let ts = $state(0);
  const reloj = new Reloj();
  reloj.play = false;
  let velocidad = $state(1);
  let analizador: Analizador | undefined = $state();

  const escenario: Escenario = $derived.by(() => {
    const def = maquina.escenarios.find((s) => s.id === escenarioId) ?? maquina.escenarios[0]!;
    return def.crear({ ...opciones });
  });
  let ids: string[] = $state([]);
  let escenarioPrevio: Escenario | null = null;
  $effect(() => {
    if (escenario !== escenarioPrevio) {
      const mismoTipo = escenarioPrevio?.id === escenario.id;
      escenarioPrevio = escenario;
      if (!mismoTipo) ids = [...escenario.defecto];
      ts = escenario.ventana?.[0] ?? 0;
    }
  });
  $effect(() => {
    reloj.velocidad = velocidad;
  });

  const muestra = $derived(muestrear(escenario, ts));
  const elegido = $derived.by((): string | null => {
    if (!sel) return null;
    if (sel.tipo === 'bloque') return sel.id;
    if (sel.tipo === 'foto') return datos.hotspots.find((h) => h.id === sel.id)?.bloque ?? null;
    if (sel.tipo === 'componente') {
      const b = maquina.diagrama.bloques.find((x) => x.esquema?.includes(sel.id));
      return b?.id ?? datos.hotspots.find((h) => h.esquema.includes(sel.id))?.bloque ?? null;
    }
    return null;
  });

  // ------------------------------------------------------------------ address decoding

  let dirTexto = $state('');
  let escritura = $state(false);
  let deco: Decodificacion | null = $state(null);
  $effect(() => {
    // default address per machine
    dirTexto = maquina.id === 'nes' ? '2002' : '320000';
    deco = null;
  });

  function decodificar(): void {
    const limpio = dirTexto.replace(/^\$|^0x/i, '').trim();
    const n = parseInt(limpio, 16);
    if (!/^[0-9a-f]+$/i.test(limpio) || Number.isNaN(n)) return;
    const max = maquina.digitos === 4 ? 0xffff : 0xffffff;
    const dir = Math.min(max, n);
    dirTexto = dir.toString(16).toUpperCase().padStart(maquina.digitos, '0');
    deco = maquina.decodificar(dir, escritura);
    opciones = { ...opciones, dir: dirTexto, escritura: escritura ? '1' : '0' };
    escenarioId = 'decodificar';
    reloj.play = true;
  }

  function ejemplo(dir: number, w: boolean): void {
    dirTexto = dir.toString(16).toUpperCase().padStart(maquina.digitos, '0');
    escritura = w;
    decodificar();
  }

  // ------------------------------------------------------------------ time

  function paso(dt: number): void {
    ts += dt * escenario.realPorSegundo;
    if (ts >= escenario.duracion) ts = 0;
  }

  function saltar(dir: 1 | -1): void {
    reloj.play = false;
    const m = escenario.marcas;
    const eps = escenario.duracion * 1e-9;
    if (dir > 0) ts = m.find((x) => x > ts + eps) ?? escenario.duracion;
    else ts = [...m].reverse().find((x) => x < ts - eps) ?? 0;
  }

  const VELOCIDADES = [0.1, 0.25, 0.5, 1, 2, 5, 10, 50, 200];
  const nombreVel = (v: number) => `${String(v).replace('.', ',')}×`;
  const realPorPantalla = $derived(escenario.realPorSegundo * velocidad);

  // ------------------------------------------------------------------ drawing and pointer

  function dibujar(v: Vista): void {
    dibujarDiagrama(v, maquina.diagrama, escenario, muestra, elegido, deco && escenarioId === 'decodificar' ? deco.bloque : null, reloj.play);
  }

  function puntero(e: EventoPuntero): boolean | void {
    if (e.tipo !== 'abajo') return;
    const b = bloqueEn(maquina.diagrama, e.x, e.y);
    seleccionar(b ? { tipo: 'bloque', id: b.id } : null);
  }

  const bloque = $derived(elegido ? maquina.diagrama.bloques.find((b) => b.id === elegido) ?? null : null);
  const opcionesVisibles = $derived(maquina.opciones.filter((o) => o.escenarios.includes(escenarioId)));
  const nombresPista = $derived(escenario.pistas.map((p) => ({ id: p.id, nombre: p.nombre, ayuda: p.ayuda })));

  function alternarPista(id: string): void {
    ids = ids.includes(id) ? ids.filter((x) => x !== id) : escenario.pistas.map((p) => p.id).filter((x) => x === id || ids.includes(x));
  }
</script>

<div class="arquitectura">
  <div class="escenarios" role="tablist" aria-label="Escenario">
    {#each maquina.escenarios as s (s.id)}
      <button type="button" role="tab" aria-selected={s.id === escenarioId} class:activo={s.id === escenarioId} onclick={() => (escenarioId = s.id)}>{s.titulo}</button>
    {/each}
  </div>
  <p class="descripcion">{escenario.descripcion}</p>

  <div class="rejilla">
    <div class="principal">
      <p class="desliza">Desliza el diagrama a los lados para verlo entero.</p>
      <div class="desplazable">
        <div class="diagrama">
          <Escena {dibujar} {paso} {reloj} dims={() => [maquina.diagrama.ancho, maquina.diagrama.alto]} etiqueta={`Diagrama de bloques de la ${datos.titulo}`} {puntero} />
        </div>
      </div>

      <div class="controles">
        <div class="botones">
          <button type="button" class="boton-icono" aria-label="Paso atrás" title="Paso atrás" onclick={() => saltar(-1)}><SkipBack size={18} /></button>
          <button type="button" class="play" aria-label={reloj.play ? 'Pausar' : 'Reproducir'} onclick={() => reloj.alternar()}>
            {#if reloj.play}<Pause size={18} strokeWidth={2.2} />{:else}<Play size={18} strokeWidth={2.2} />{/if}
          </button>
          <button type="button" class="boton-icono" aria-label="Paso adelante" title="Paso adelante" onclick={() => saltar(1)}><SkipForward size={18} /></button>
          <label class="vel">
            <span class="solo-lector">Velocidad</span>
            <select bind:value={velocidad} aria-label="Velocidad">
              {#each VELOCIDADES as v (v)}<option value={v}>{nombreVel(v)}</option>{/each}
            </select>
          </label>
        </div>
        <input
          class="barra-tiempo"
          type="range"
          min="0"
          max="1"
          step="0.0005"
          value={ts / escenario.duracion}
          aria-label="Instante"
          oninput={(e) => {
            reloj.play = false;
            ts = Number((e.currentTarget as HTMLInputElement).value) * escenario.duracion;
          }}
        />
        <div class="lecturas">
          <span><strong>t = {tiempo(ts, 4)}</strong> de {tiempo(escenario.duracion, 3)}</span>
          <span class="factor" title="Cuánto se ha ralentizado el tiempo real">Cámara lenta {factor(realPorPantalla)}: 1 s en pantalla = {tiempo(realPorPantalla, 3)} reales</span>
        </div>
      </div>

      <div class="paso" aria-live="polite">{muestra.paso?.texto ?? ' '}</div>

      {#if opcionesVisibles.length}
        <div class="opciones">
          {#each opcionesVisibles as o (o.id)}
            <label>
              <span>{o.titulo}</span>
              <select value={opciones[o.id] ?? o.valores[0]!.v} onchange={(e) => (opciones = { ...opciones, [o.id]: (e.currentTarget as HTMLSelectElement).value })}>
                {#each o.valores as v (v.v)}<option value={v.v}>{v.texto}</option>{/each}
              </select>
            </label>
          {/each}
        </div>
      {/if}

      <section class="analizador-caja">
        <div class="cab-analizador">
          <h3>Analizador lógico</h3>
          <span class="zoom">
            <button type="button" class="boton-icono" aria-label="Alejar el cronograma" onclick={() => analizador?.zoom(1.6)}><ZoomOut size={18} /></button>
            <button type="button" class="boton-icono" aria-label="Acercar el cronograma" onclick={() => analizador?.zoom(1 / 1.6)}><ZoomIn size={18} /></button>
            <button type="button" class="boton-icono" aria-label="Ver todo el cronograma" onclick={() => analizador?.todo()}><Maximize size={17} /></button>
          </span>
        </div>
        <Analizador bind:this={analizador} {escenario} t={ts} {ids} alMover={(x) => {
          reloj.play = false;
          ts = x;
        }} />
        <div class="senales" aria-label="Señales del cronograma">
          {#each nombresPista as p (p.id)}
            <button type="button" class:activo={ids.includes(p.id)} title={p.ayuda ?? p.nombre} aria-pressed={ids.includes(p.id)} onclick={() => alternarPista(p.id)}>{p.nombre}</button>
          {/each}
        </div>
        <details class="fidelidad">
          <summary>Fidelidad de la temporización</summary>
          <p>{escenario.fidelidad}</p>
        </details>
      </section>
    </div>

    <aside class="lateral">
      <section class="ficha decodificador">
        <h3>Decodificar una dirección</h3>
        <form
          onsubmit={(e) => {
            e.preventDefault();
            decodificar();
          }}
        >
          <label class="dir">
            <span>$</span>
            <input type="text" inputmode="text" autocomplete="off" spellcheck="false" maxlength={maquina.digitos} bind:value={dirTexto} aria-label="Dirección en hexadecimal" />
          </label>
          <select bind:value={escritura} aria-label="Lectura o escritura">
            <option value={false}>Lectura</option>
            <option value={true}>Escritura</option>
          </select>
          <button type="submit" class="accion">Decodificar</button>
        </form>
        <div class="ejemplos">
          {#each maquina.ejemplos as x (x.dir + String(x.escritura))}
            <button type="button" onclick={() => ejemplo(x.dir, x.escritura)}>{hex(x.dir, maquina.digitos)} <small>{x.texto}</small></button>
          {/each}
        </div>
        {#if deco}
          <div class="resultado" data-seleccion={deco.seleccion ?? ''}>
            <p class="zona">{hex(deco.direccion, maquina.digitos)} ({deco.escritura ? 'escritura' : 'lectura'}): <strong>{deco.zona}</strong></p>
            <p class="sel">Selección activa: <strong>{deco.seleccion ?? 'ninguna'}</strong>{#if deco.espejo && deco.espejo !== hex(deco.direccion, maquina.digitos)} · equivale a {deco.espejo}{/if}</p>
            <p>{deco.texto}</p>
            <table>
              <tbody>
                {#each deco.tabla as f (f.etiqueta)}
                  <tr class:activa={f.activa}><td>{f.etiqueta}</td><td>{f.valor}</td></tr>
                {/each}
              </tbody>
            </table>
          </div>
        {/if}
      </section>

      <section class="ficha">
        {#if bloque}
          <p class="tipo">Bloque</p>
          <h3>{bloque.titulo}</h3>
          <p class="pieza">{bloque.sub}</p>
          <p>{bloque.info}</p>
          <div class="acciones">
            {#if bloque.foto}<button type="button" class="accion" onclick={() => irA('foto', { tipo: 'foto', id: bloque.foto! })}>Ver en la foto</button>{/if}
            {#if bloque.esquema?.length}<button type="button" class="accion" onclick={() => irA('esquema', { tipo: 'componente', id: bloque.esquema![0]! })}>Ver en el esquema</button>{/if}
          </div>
        {:else}
          <p class="tipo">Diagrama</p>
          <p>Toca un bloque para ver qué hace y saltar a la foto o al esquema. Las líneas se iluminan cuando su señal está activa: azul, direcciones; verde azulado, datos; rojo, selecciones de chip; verde, relojes; ámbar, interrupciones.</p>
        {/if}
      </section>
    </aside>
  </div>
</div>

<style>
  .arquitectura {
    display: grid;
    gap: 10px;
  }
  .escenarios {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .escenarios button,
  .senales button,
  .ejemplos button {
    min-height: 34px;
    padding: 3px 12px;
    border: 1px solid var(--linea);
    border-radius: 999px;
    background: var(--superficie);
    color: var(--tinta);
    font: inherit;
    font-size: 14px;
    cursor: pointer;
  }
  .escenarios button.activo,
  .senales button.activo {
    border-color: var(--acento);
    background: var(--acento-tinte);
    color: var(--acento);
    font-weight: 700;
  }
  .descripcion {
    margin: 0;
    color: var(--tinta-suave);
  }
  .rejilla {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 330px;
    gap: 12px;
    align-items: start;
  }
  .principal {
    display: grid;
    gap: 10px;
    min-width: 0;
  }
  .desliza {
    display: none;
    margin: 0;
    color: var(--tinta-suave);
    font-size: 13.5px;
  }
  @media (max-width: 760px) {
    .desliza {
      display: block;
    }
  }
  .desplazable {
    overflow-x: auto;
    border-radius: 14px;
  }
  .diagrama {
    min-width: 720px;
  }
  .desplazable :global(canvas) {
    touch-action: pan-x pan-y;
  }
  .controles {
    display: grid;
    gap: 6px;
  }
  .botones {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .play {
    display: inline-grid;
    place-items: center;
    width: 42px;
    height: 42px;
    border: 0;
    border-radius: 50%;
    background: var(--banda);
    color: #fff;
    box-shadow: var(--sombra);
    cursor: pointer;
  }
  select,
  input[type='text'] {
    height: 38px;
    padding: 0 8px;
    border: 1px solid var(--linea);
    border-radius: 10px;
    background: var(--superficie);
    color: var(--tinta);
    font: inherit;
    font-size: 15px;
  }
  .barra-tiempo {
    width: 100%;
    accent-color: var(--acento);
  }
  .lecturas {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    gap: 4px 12px;
    font-size: 14px;
    font-variant-numeric: tabular-nums;
  }
  .factor {
    color: var(--tinta-suave);
  }
  .paso {
    min-height: 3.2em;
    padding: 8px 12px;
    border-left: 4px solid var(--acento);
    border-radius: 0 10px 10px 0;
    background: var(--acento-tinte);
    font-size: 15px;
  }
  .opciones {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
  }
  .opciones label {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-weight: 600;
  }
  .cab-analizador {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 6px;
  }
  .cab-analizador h3,
  .ficha h3 {
    margin: 0;
    color: var(--titulos);
    font-size: 17px;
  }
  .zoom {
    display: inline-flex;
    gap: 4px;
  }
  .senales {
    display: flex;
    flex-wrap: wrap;
    gap: 5px;
    margin-top: 8px;
  }
  .senales button {
    min-height: 30px;
    font-size: 13px;
  }
  .fidelidad {
    margin-top: 8px;
    color: var(--tinta-suave);
    font-size: 14px;
  }
  .fidelidad summary {
    min-height: 30px;
    cursor: pointer;
    font-weight: 700;
    color: var(--tinta);
  }
  .lateral {
    display: grid;
    gap: 12px;
  }
  .ficha {
    padding: 14px;
    border-radius: 12px;
    background: var(--superficie);
    box-shadow:
      0 0 0 1px var(--linea),
      var(--sombra);
    font-size: 14.5px;
  }
  .tipo {
    margin: 0;
    color: var(--tinta-tenue);
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }
  .pieza {
    margin: 2px 0 6px;
    color: var(--acento);
    font-weight: 600;
  }
  form {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin: 8px 0;
  }
  .dir {
    display: inline-flex;
    align-items: center;
    gap: 2px;
    font-family: var(--mono);
    font-weight: 700;
  }
  .dir input {
    width: 8.5ch;
    font-family: var(--mono);
    text-transform: uppercase;
  }
  .accion {
    min-height: 38px;
    padding: 4px 13px;
    border: 1px solid var(--acento-borde);
    border-radius: 999px;
    background: var(--acento-tinte);
    color: var(--acento);
    font: inherit;
    font-size: 14px;
    font-weight: 700;
    cursor: pointer;
  }
  .ejemplos {
    display: flex;
    flex-wrap: wrap;
    gap: 5px;
  }
  .ejemplos button {
    font-family: var(--mono);
    font-size: 13px;
  }
  .ejemplos small {
    font-family: var(--sans);
    color: var(--tinta-suave);
  }
  .resultado {
    margin-top: 10px;
  }
  .resultado p {
    margin: 0 0 6px;
  }
  .zona strong,
  .sel strong {
    color: var(--acento);
  }
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 13px;
  }
  td {
    padding: 3px 5px;
    border-top: 1px solid var(--linea-suave);
    vertical-align: top;
  }
  tr.activa td {
    background: var(--acento-tinte);
    color: var(--acento);
    font-weight: 700;
  }
  .acciones {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  /* The diagram needs the width: the panels go below it except on very wide screens. */
  @media (max-width: 1499px) {
    .rejilla {
      grid-template-columns: minmax(0, 1fr);
    }
    .lateral {
      grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
      align-items: start;
    }
  }
  @media (pointer: coarse) {
    .escenarios button,
    .senales button,
    .ejemplos button,
    .accion,
    select,
    input[type='text'] {
      min-height: 44px;
    }
    .botones :global(.boton-icono),
    .zoom :global(.boton-icono),
    .play {
      width: 44px;
      height: 44px;
    }
  }
</style>
