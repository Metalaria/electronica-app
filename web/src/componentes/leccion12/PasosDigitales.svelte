<script lang="ts">
  // 1.2 (motor12c) the step panels on a «figura» or «logica» widget (GUIA §11.3–§11.7), under the widget:
  //   tocar            what is chosen on the figure (the touch itself is on the figure or its list of zones);
  //   tabla            the truth table to fill, cell by cell;
  //   averia-logica    the logic probe: switches set on the circuit, a point chosen (a tap on a wire, or the list
  //                    here), its reading (HIGH, LOW or no level), the log, the suspects and «Otra placa»;
  //   diseno-logico    the gates of the reader's design (type and inputs from lists), the LED's wire, the count;
  //   dibujar-digital  the level of the signal in every slot of the timing diagram, set with a tap or the keyboard.
  import './digital12.css';
  import type { EstadoTarjeta } from '../../lib/leccion11/motor';
  import { textoPlano } from '../../lib/leccion11/texto';
  import type { Tarjeta } from '../../lib/leccion11/tipos';
  import { semillaNueva } from '../../lib/leccion12/azar';
  import { filaEntradas, iniciar, sondear, type Lectura, type Nivel, type TipoPuerta } from '../../lib/leccion12/digital/logica';
  import { falloEnUso, NOMBRE_FALLO_LOGICO, ondaDe, otraAveriaLogica } from '../../lib/leccion12/digital/motor-digital';
  import type { ActividadDigital, EstadoActividadDigital, EstadoWidget12, WidgetFigura, WidgetLogica } from '../../lib/leccion12/digital/tipos';
  import TextoVivo from '../leccion11/TextoVivo.svelte';
  import TablaVerdad from './TablaVerdad.svelte';

  let {
    t,
    a,
    e,
    ea,
    prefijo,
    cambiar,
  }: {
    t: Tarjeta;
    a: ActividadDigital;
    e: EstadoTarjeta;
    ea: EstadoActividadDigital;
    prefijo: string;
    cambiar: (c: Partial<EstadoTarjeta>) => void;
  } = $props();

  const valor = (id: string) => id;
  const bloqueado = $derived(e.comprobado || e.resuelta);
  const wl = $derived(t.widget?.tipo === 'logica' ? (t.widget as WidgetLogica) : null);
  const wf = $derived(t.widget?.tipo === 'figura' ? (t.widget as WidgetFigura) : null);
  const w12 = $derived<EstadoWidget12>(e.widget12 ?? { zona: null, niveles: {}, logica: null, pulsos: 0, tramo: 0 });
  const NOMBRE_PUERTA: Record<TipoPuerta, string> = { and: 'AND', or: 'OR', not: 'NOT', nand: 'NAND', nor: 'NOR', xor: 'XOR', xnor: 'XNOR', buf: 'Búfer' };
  const lecturaTexto = (x: Lectura) => (x === 'aire' ? 'sin nivel (al aire)' : x === 1 ? 'ALTO (1)' : 'BAJO (0)');

  // ---- fault finding
  let elegido = $state('');
  const punto = $derived(elegido || (a.tipo === 'averia-logica' ? (a.puntos[0]?.id ?? '') : ''));
  function medir() {
    if (ea.tipo !== 'averia-logica' || a.tipo !== 'averia-logica' || !wl) return;
    const p = a.puntos.find((q) => q.id === punto) ?? a.puntos[0];
    if (!p || (a.pasos != null && ea.medidas.length >= a.pasos)) return;
    const f = falloEnUso(a, ea);
    const lectura = sondear(wl.circuito, iniciar(wl.circuito, f, w12.niveles), p.punto, f);
    cambiar({ actividad: { ...ea, medidas: [...ea.medidas, { niveles: { ...w12.niveles }, punto: p.id, lectura }] } });
  }
  function otra() {
    if (ea.tipo !== 'averia-logica' || a.tipo !== 'averia-logica' || !wl) return;
    cambiar({
      actividad: otraAveriaLogica(t, a, ea, a.eleccion === 'azar' ? semillaNueva() : undefined),
      comprobado: false,
      bien: null,
      widget12: { ...w12, niveles: Object.fromEntries(wl.circuito.entradas.map((x) => [x.id, x.valor])) },
    });
  }

  // ---- design
  function senalesDisponibles(k: number): { id: string; nombre: string }[] {
    if (!wl) return [];
    return [...wl.circuito.entradas.filter((x) => !x.reloj).map((x) => ({ id: x.id, nombre: textoPlano(x.rotulo) })), ...Array.from({ length: k }, (_, j) => ({ id: `p${j + 1}`, nombre: `P${j + 1}` }))];
  }
  function cambiarDiseno(c: Partial<Extract<EstadoActividadDigital, { tipo: 'diseno-logico' }>>) {
    if (ea.tipo !== 'diseno-logico') return;
    cambiar({ actividad: { ...ea, ...c }, comprobado: false, bien: null });
  }
  function anadir() {
    if (ea.tipo !== 'diseno-logico' || a.tipo !== 'diseno-logico' || ea.puertas.length >= a.maxPuertas) return;
    const tipo = a.permitidas[0]!;
    const s = senalesDisponibles(ea.puertas.length).map((x) => x.id);
    const entradas = tipo === 'not' || tipo === 'buf' ? [s[0]!] : [s[0]!, s[1] ?? s[0]!];
    const k = ea.puertas.length + 1;
    cambiarDiseno({ puertas: [...ea.puertas, { tipo, entradas }], salida: `p${k}` });
  }
  function quitar(k: number) {
    if (ea.tipo !== 'diseno-logico') return;
    // (the gates after it lose the reference: their inputs that read it go to the first input)
    const id = `p${k + 1}`;
    const primera = senalesDisponibles(0)[0]?.id ?? '0';
    const renombrar = (r: string) => {
      const m = /^p(\d+)$/.exec(r);
      if (!m) return r;
      const j = Number(m[1]);
      return j === k + 1 ? primera : j > k + 1 ? `p${j - 1}` : r;
    };
    const puertas = ea.puertas.filter((_, j) => j !== k).map((p) => ({ ...p, entradas: p.entradas.map(renombrar) }));
    const salida = ea.salida === id ? (puertas.length ? `p${puertas.length}` : null) : ea.salida ? renombrar(ea.salida) : null;
    cambiarDiseno({ puertas, salida });
  }
  function tipoPuerta(k: number, tipo: TipoPuerta) {
    if (ea.tipo !== 'diseno-logico') return;
    const s = senalesDisponibles(k).map((x) => x.id);
    const p = ea.puertas[k]!;
    const una = tipo === 'not' || tipo === 'buf';
    const entradas = una ? [p.entradas[0] ?? s[0]!] : [p.entradas[0] ?? s[0]!, p.entradas[1] ?? p.entradas[0] ?? s[0]!];
    cambiarDiseno({ puertas: ea.puertas.map((q, j) => (j === k ? { tipo, entradas } : q)) });
  }
  function entradaPuerta(k: number, i: number, r: string) {
    if (ea.tipo !== 'diseno-logico') return;
    cambiarDiseno({ puertas: ea.puertas.map((q, j) => (j === k ? { ...q, entradas: q.entradas.map((x, m) => (m === i ? r : x)) } : q)) });
  }

  // ---- digital drawing
  const n = $derived(a.tipo === 'dibujar-digital' ? a.esperado.length : 0);
  let tramo = $state(0);
  function ponerNivel(k: number, v: Nivel) {
    if (ea.tipo !== 'dibujar-digital' || bloqueado) return;
    cambiar({ actividad: { ...ea, niveles: ea.niveles.map((x, j) => (j === k ? v : x)), mal: ea.mal.filter((j) => j !== k) } });
  }
  function teclaDibujo(ev: KeyboardEvent) {
    if (ea.tipo !== 'dibujar-digital') return;
    if (ev.key === 'ArrowRight') tramo = Math.min(n - 1, tramo + 1);
    else if (ev.key === 'ArrowLeft') tramo = Math.max(0, tramo - 1);
    else if (ev.key === 'ArrowUp' || ev.key === '1') ponerNivel(tramo, 1);
    else if (ev.key === 'ArrowDown' || ev.key === '0') ponerNivel(tramo, 0);
    else if (ev.key === ' ' || ev.key === 'Enter') ponerNivel(tramo, ea.niveles[tramo] === 1 ? 0 : 1);
    else if (ev.key === 'Home') tramo = 0;
    else if (ev.key === 'End') tramo = n - 1;
    else return;
    ev.preventDefault();
  }
  // a drag paints the level of the first slot touched
  let pintando: Nivel | null = null;
  function tramoDe(ev: PointerEvent): number {
    const r = (ev.currentTarget as SVGElement).getBoundingClientRect();
    const x = ((ev.clientX - r.left) / r.width) * (46 + n * 26 + 8) - 46;
    return Math.max(0, Math.min(n - 1, Math.floor(x / 26)));
  }
  function abajoDibujo(ev: PointerEvent) {
    if (ea.tipo !== 'dibujar-digital' || bloqueado) return;
    const k = tramoDe(ev);
    const r = (ev.currentTarget as SVGElement).getBoundingClientRect();
    const v: Nivel = ev.clientY - r.top < r.height / 2 ? 1 : 0;
    pintando = v;
    tramo = k;
    (ev.currentTarget as SVGElement).setPointerCapture?.(ev.pointerId);
    ponerNivel(k, v);
  }
  function moverDibujo(ev: PointerEvent) {
    if (pintando == null) return;
    const k = tramoDe(ev);
    if (ea.tipo === 'dibujar-digital' && ea.niveles[k] !== pintando) ponerNivel(k, pintando);
  }
  const ondaDibujada = $derived.by(() => {
    if (ea.tipo !== 'dibujar-digital') return '';
    let d = '';
    let abierto = false;
    ea.niveles.forEach((v, k) => {
      if (v === null) {
        abierto = false;
        return;
      }
      const y = v ? 6 : 22;
      d += abierto ? `V${y}H${46 + (k + 1) * 26}` : `M${46 + k * 26},${y}H${46 + (k + 1) * 26}`;
      abierto = true;
    });
    return d;
  });
  const correcta = $derived(a.tipo === 'dibujar-digital' && wl && (e.resuelta || e.cerrada) ? ondaDe(wl, a.senal) : null);
</script>

{#if a.tipo === 'tocar' && ea.tipo === 'tocar' && wf}
  <div class="a12" data-paso-tocar>
    <p aria-live="polite" data-elegidas={ea.elegidas.join(' ')}>
      {#if ea.elegidas.length}
        {a.todas ? 'Ha elegido: ' : 'Ha elegido '}{ea.elegidas.map((z) => textoPlano(wf.zonas.find((q) => q.id === z)?.rotulo)).join(', ')}.
      {:else}
        <span class="a12-suave">{a.todas ? 'Toque todas las que respondan; vuelva a tocar una para quitarla.' : 'Toque la zona que responde (en la figura o en la lista).'}</span>
      {/if}
    </p>
  </div>
{:else if a.tipo === 'tabla' && ea.tipo === 'tabla'}
  <div class="a12" data-paso-tabla>
    <TablaVerdad
      entradas={a.entradas}
      salidas={a.salidas}
      filas={a.esperado.map((_, r) => ({ e: filaEntradas(a.entradas.length, r), s: null }))}
      celdas={ea.celdas}
      mal={ea.mal}
      {bloqueado}
      poner={(r, k, v) => cambiar({ actividad: { ...ea, celdas: ea.celdas.map((f, j) => (j === r ? f.map((x, m) => (m === k ? v : x)) : f)), mal: ea.mal.filter((j) => j !== r) } })}
    />
  </div>
{:else if a.tipo === 'averia-logica' && ea.tipo === 'averia-logica' && wl}
  {@const ultima = ea.medidas[ea.medidas.length - 1] ?? null}
  {@const quedan = a.pasos == null ? null : a.pasos - ea.medidas.length}
  <div class="a12" data-paso-averia-logica data-ronda={ea.ronda}>
    <div class="a12-ficha d12-sonda" aria-live="polite" data-sonda-logica>
      <span class={`luz ${ultima ? (ultima.lectura === 1 ? 'alto' : ultima.lectura === 0 ? 'bajo' : '') : ''}`} aria-hidden="true"></span>
      <span>
        <span class="a12-suave">Sonda lógica{ultima ? ` en ${textoPlano(a.puntos.find((p) => p.id === ultima.punto)?.rotulo)}` : ''}</span><br />
        <strong data-lectura-sonda>{ultima ? lecturaTexto(ultima.lectura) : '—'}</strong>
      </span>
    </div>
    <div class="a12-fila">
      <label class="a12-suave" for={`${prefijo}-punto`}>Punto</label>
      <select class="d12-select" id={`${prefijo}-punto`} value={punto} onchange={(ev) => (elegido = (ev.currentTarget as HTMLSelectElement).value)} data-punto>
        {#each a.puntos as p (p.id)}<option value={p.id}>{textoPlano(p.rotulo)}</option>{/each}
      </select>
      <button type="button" class="a12-boton" onclick={medir} aria-disabled={quedan != null && quedan <= 0} data-medir>Medir</button>
    </div>
    <p class="a12-suave">Toque también un cable del circuito para medirlo. {quedan == null ? '' : `Quedan ${Math.max(0, quedan)} medidas.`}</p>
    {#if ea.medidas.length}
      <ol class="d12-medidas" data-medidas>
        {#each ea.medidas.slice(-6) as m, k (k)}
          <li>{Object.entries(m.niveles).map(([x, v]) => `${x} = ${v}`).join(', ')} · {textoPlano(a.puntos.find((p) => p.id === m.punto)?.rotulo)}: <strong>{lecturaTexto(m.lectura)}</strong></li>
        {/each}
      </ol>
    {/if}
    <fieldset class="d12-grupo">
      <legend>¿Qué pieza está mal?</legend>
      <div class="a12-fila">
        {#each a.sospechosos as s (s.id)}
          {@const fuera = ea.descartados.includes(s.id)}
          {@const real = a.fallos[ea.fallo]!}
          <button type="button" class={`a12-boton ${fuera ? 'mal' : e.resuelta && s.id === real.pieza ? 'bien' : ''}`} aria-pressed={ea.sospechoso === s.id} aria-disabled={bloqueado || fuera} onclick={() => !bloqueado && !fuera && cambiar({ actividad: { ...ea, sospechoso: s.id } })} data-sospechoso={s.id}>
            <TextoVivo texto={s.rotulo} {valor} />{#if fuera}<span class="a12-solo-lector"> (descartada)</span>{/if}
          </button>
        {/each}
      </div>
    </fieldset>
    {#if a.preguntarTipo}
      <fieldset class="d12-grupo">
        <legend>¿Qué le pasa?</legend>
        <div class="a12-fila">
          {#each [...new Set(a.fallos.map((f) => f.tipo))] as x (x)}
            <button type="button" class="a12-boton" aria-pressed={ea.tipoElegido === x} aria-disabled={bloqueado} onclick={() => !bloqueado && cambiar({ actividad: { ...ea, tipoElegido: x } })} data-tipo-averia={x}>{NOMBRE_FALLO_LOGICO[x]}</button>
          {/each}
        </div>
      </fieldset>
    {/if}
    {#if e.resuelta && e.bien}
      <button type="button" class="a12-boton" onclick={otra} data-otra-averia>Otra placa con otra avería</button>
    {/if}
  </div>
{:else if a.tipo === 'diseno-logico' && ea.tipo === 'diseno-logico'}
  <div class="a12" data-paso-diseno-logico>
    <p class="a12-suave" data-cuenta-puertas={ea.puertas.length}>Puertas: {ea.puertas.length} (de {a.permitidas.map((p) => NOMBRE_PUERTA[p]).join(', ')}; como mucho {a.maxPuertas}).</p>
    <ol class="d12-puertas">
      {#each ea.puertas as p, k (k)}
        <li data-puerta={k + 1}>
          <strong>P{k + 1}</strong>
          <select class="d12-select" aria-label={`Tipo de la puerta P${k + 1}`} value={p.tipo} disabled={bloqueado} onchange={(ev) => tipoPuerta(k, (ev.currentTarget as HTMLSelectElement).value as TipoPuerta)} data-tipo-puerta>
            {#each a.permitidas as x (x)}<option value={x}>{NOMBRE_PUERTA[x]}</option>{/each}
          </select>
          {#each p.entradas as r, i (i)}
            <select class="d12-select" aria-label={`Entrada ${i + 1} de P${k + 1}`} value={r} disabled={bloqueado} onchange={(ev) => entradaPuerta(k, i, (ev.currentTarget as HTMLSelectElement).value)} data-entrada-puerta={i + 1}>
              {#each senalesDisponibles(k) as s (s.id)}<option value={s.id}>{s.nombre}</option>{/each}
            </select>
          {/each}
          <button type="button" class="a12-boton" aria-label={`Quitar P${k + 1}`} disabled={bloqueado} onclick={() => quitar(k)} data-quitar>×</button>
        </li>
      {/each}
    </ol>
    <div class="a12-fila">
      <button type="button" class="a12-boton" onclick={anadir} disabled={bloqueado || ea.puertas.length >= a.maxPuertas} data-anadir-puerta>Añadir puerta</button>
      <label class="a12-suave" for={`${prefijo}-led`}>LED {a.salida} a</label>
      <select class="d12-select" id={`${prefijo}-led`} value={ea.salida ?? ''} disabled={bloqueado} onchange={(ev) => cambiarDiseno({ salida: (ev.currentTarget as HTMLSelectElement).value || null })} data-salida-diseno>
        <option value="">—</option>
        {#each senalesDisponibles(ea.puertas.length) as s (s.id)}<option value={s.id}>{s.nombre}</option>{/each}
      </select>
    </div>
    <p class="a12-suave">Cambie las entradas del circuito para probar su diseño antes de comprobarlo.</p>
  </div>
{:else if a.tipo === 'dibujar-digital' && ea.tipo === 'dibujar-digital'}
  <div class="a12" data-paso-dibujar-digital>
    <p class="a12-suave">Toque arriba (1) o abajo (0) en cada tramo, o arrastre. Con el teclado: ← → eligen el tramo; ↑ ↓ (o 1 y 0) ponen el nivel.</p>
    <!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
    <svg
      class="d12-dibujo"
      viewBox={`0 0 ${46 + n * 26 + 8} 30`}
      role="application"
      tabindex="0"
      aria-label={`Dibujo de ${textoPlano(a.rotulo)}: tramo ${tramo + 1} de ${n} (ciclo ${Math.floor(tramo / 2) + 1}, reloj ${tramo % 2 ? 'alto' : 'bajo'}), ${ea.niveles[tramo] === null ? 'sin dibujar' : `nivel ${ea.niveles[tramo]}`}${ea.mal.includes(tramo) ? ', mal' : ''}`}
      onkeydown={teclaDibujo}
      onpointerdown={abajoDibujo}
      onpointermove={moverDibujo}
      onpointerup={() => (pintando = null)}
      onpointercancel={() => (pintando = null)}
      data-dibujo-digital
    >
      <text x="4" y="19" class="d12-etq-dibujo">{textoPlano(a.rotulo)}</text>
      {#each Array.from({ length: n }, (_, k) => k) as k (k)}
        <rect class={`d12-celda-dibujo ${ea.mal.includes(k) ? 'd12-tramo-mal' : ''}`} x={46 + k * 26} y="1" width="26" height="28" data-tramo-dibujo={k} />
        {#if k % 2 === 1}<line class="d12-flanco" x1={46 + k * 26} x2={46 + k * 26} y1="0" y2="30" />{/if}
      {/each}
      <rect class="d12-cursor" x={46 + tramo * 26} y="1" width="26" height="28" />
      {#if correcta}<path class="d12-onda" d={correcta.map((v, k) => `${k ? 'V' : 'M46,'}${v ? 6 : 22}H${46 + (k + 1) * 26}`).join('')} data-onda-correcta />{/if}
      <path class="d12-onda dibujada" d={ondaDibujada} />
    </svg>
  </div>
{/if}

<style>
  .d12-grupo {
    min-inline-size: 0;
    margin: 0;
    padding: 0;
    border: 0;
  }
  legend {
    margin-bottom: 6px;
    padding: 0;
    font-weight: 600;
  }
  .d12-dibujo {
    display: block;
    width: 100%;
    height: auto;
    max-height: 120px;
    touch-action: none;
    cursor: crosshair;
    border-radius: 10px;
    background: var(--v11-fondo);
  }
  .d12-dibujo:focus-visible {
    outline: 3px solid var(--v11-foco);
    outline-offset: 2px;
  }
  .d12-celda-dibujo {
    fill: transparent;
  }
  .d12-etq-dibujo {
    fill: var(--v11-tinta);
    font: 600 11px var(--v11-texto);
  }
</style>
