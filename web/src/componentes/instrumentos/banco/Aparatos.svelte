<script lang="ts">
  // The two instruments of a bench, with what each one is reading under it: side by side when the
  // surrounding container (`container-type: inline-size`) is 640 px or wider, as tabs otherwise. Shared by
  // the bench page, the breadboard and the editor (0.10).
  import type { Banco } from '../banco.svelte.ts';
  import BrymenVista from '../brymen/Brymen.svelte';
  import FnirsiVista from '../fnirsi/Fnirsi.svelte';
  import { formatoSI } from '../../grafica';
  import { BM_POSICIONES } from '../motor/dmm.ts';
  import { FN_DMM_LISTA } from '../fnirsi/logica.svelte.ts';
  import type { GuiaBrymen, GuiaFnirsi } from '../guia';
  import { brymenReal } from '../../../lib/brymen-real/conexion.svelte';
  import { inferirPosicion, claveInferida } from '../brymen/sigueReal';
  import { fnirsiReal } from '../../../lib/fnirsi-real/conexion.svelte';
  import { modoQueSigue, funcionQueSigue } from '../fnirsi/sigueReal';

  let {
    b,
    alAuto,
    pestana = $bindable('fnirsi'),
    guiaBm = null,
    guiaFn = null,
    pestanas = true,
  }: {
    b: Banco;
    alAuto: () => void;
    pestana?: 'brymen' | 'fnirsi';
    guiaBm?: GuiaBrymen | null;
    guiaFn?: GuiaFnirsi | null;
    /** 2.1: the own Brymen/FNIRSI tabs on narrow screens (the bench page draws its own segmented control instead). */
    pestanas?: boolean;
  } = $props();
  let ayuda = $state<'brymen' | 'fnirsi' | null>(null);

  // 2.1: the caption is one line under each instrument: «Brymen BM869s · 3,2060 V ± 840 µV según su manual».
  const infoOsc = $derived.by(() => {
    const f = b.fnirsi;
    const W = 12 * f.sDiv;
    const fs = Math.min(250e6, 1000 / W);
    return `FNIRSI 2C53T · ${formatoSI(fs, 'S/s', 3)}, sin alias hasta ${formatoSI(fs / 2, 'Hz', 3)}`;
  });
  // 2.2: what the keys of the drawn FNIRSI have set, for the tests (tests/recorridos22-fnirsi-menu.spec.ts)
  const teclasFnirsi = $derived.by(() => {
    const f = b.fnirsi;
    const c = f.canales;
    return JSON.stringify({
      menu: f.menu,
      item: f.item,
      flechas: f.modoFlechas,
      nivelGen: f.nivelGen,
      itemGen: f.itemGen,
      forma: f.dds.forma,
      frecuencia: f.dds.frecuencia,
      hold: f.holdDmm,
      run: f.run,
      sDiv: f.sDiv,
      vDiv: [c[0]!.vDiv, c[1]!.vDiv],
      pos: [c[0]!.pos, c[1]!.pos],
      hpos: f.hpos,
      nivel: f.disparo.nivel,
      fuente: f.disparo.fuente,
      activo: f.activo,
    });
  });
  const infoBm = $derived.by(() => {
    void b.tic;
    const l = b.brymen.pantalla.principal;
    if (!l || l.valor === null) return '';
    const inc = l.incertidumbre;
    const base = l.unidad.replace(/^[kMmµn](?=[VAΩFHS])/, '');
    return `Brymen BM869s · ${l.texto.replace('.', ',')} ${l.unidad}${inc !== null ? ` ± ${formatoSI(inc, base, 2)} según su manual` : ''}`;
  });

  // ---------------------------------------------------------------- 2.1: the drawn selector follows the real Brymen
  // With the real BM869s connected, the drawn meter's selector turns to the function the real one is measuring
  // (brymen/sigueReal.ts infers it from the reading). Only when the inferred function changes: a hand on the drawn dial
  // is not fought every frame. No reading (OFF, silent cable) leaves the dial where it was. Nothing is sent to the meter.
  const inferida = $derived(brymenReal.estado === 'conectado' ? inferirPosicion(brymenReal.lectura) : null);
  const claveReal = $derived(claveInferida(inferida));
  let ultimaClave = '';
  $effect(() => {
    const k = claveReal;
    const x = inferida;
    if (!k || !x || x.pos < 0) return;
    if (k === ultimaClave) return;
    ultimaClave = k;
    b.brymen.seguir(x.pos, x.sub);
  });
  $effect(() => {
    // a new connection follows its first reading again
    if (brymenReal.estado !== 'conectado') ultimaClave = '';
  });

  // ---------------------------------------------------------------- 2.1: the drawn FNIRSI follows the real one's mode
  // With the link's status stream (patch 3) the drawn 2C53T switches to the real one's mode (oscilloscope, multimeter,
  // generator) when it changes; without it the drawing is left alone and one line says why (fnirsi/sigueReal.ts).
  // Read-only: only what the link already reports is used.
  const sigueFn = $derived(modoQueSigue(fnirsiReal.estado, fnirsiReal.info?.estadoEnFlujo ?? null, fnirsiReal.modoFlujo));
  let ultimoModo = '';
  $effect(() => {
    const m = sigueFn.modo;
    if (!m) {
      if (fnirsiReal.estado === 'desconectado' || fnirsiReal.estado === 'error') ultimoModo = '';
      return;
    }
    if (m === ultimoModo) return;
    ultimoModo = m;
    if (b.fnirsi.modo !== m) b.fnirsi.elegirModo(m);
  });
  // 2.1 (25-11): in multimeter mode, also its function, from the multimeter state every frame carries (menu entry,
  // function, variant: lib/fnirsi-real/multimetro.ts). Only when it changes, as the Brymen's dial.
  const menuReal = $derived(fnirsiReal.estado === 'conectado' && fnirsiReal.multimetro ? fnirsiReal.multimetro.menu : null);
  const sigueFuncion = $derived(funcionQueSigue(menuReal));
  let ultimaFuncion = '';
  $effect(() => {
    const k = menuReal ? `${menuReal.entrada}:${menuReal.funcion}` : '';
    const id = sigueFuncion.id;
    if (!k) {
      if (fnirsiReal.estado !== 'conectado' && fnirsiReal.estado !== 'reconectando') ultimaFuncion = '';
      return;
    }
    if (k === ultimaFuncion) return;
    ultimaFuncion = k;
    if (id) b.fnirsi.elegirFuncionDmm(id);
  });
</script>

<div class="aparatos">
  {#if pestanas}<div class="pestanas" role="tablist" aria-label="Instrumentos">
    <button role="tab" aria-selected={pestana === 'brymen'} onclick={() => (pestana = 'brymen')}>Brymen BM869s</button>
    <button role="tab" aria-selected={pestana === 'fnirsi'} onclick={() => (pestana = 'fnirsi')}>FNIRSI 2C53T</button>
  </div>{/if}
  <div class="par">
    <figure class="instrumento brymen" class:oculto={pestana !== 'brymen'} data-recorrido="brymen" data-posicion-brymen={b.brymen.posicion.id} data-sub-brymen={b.brymen.sub}>
      <BrymenVista m={b.brymen} guia={guiaBm} />
      <figcaption data-recorrido="brymen-pie">
        {infoBm || 'Brymen BM869s · 50 000 cuentas · 10 MΩ'}
        {#if inferida}<span class="sigue-real" data-sigue-real={BM_POSICIONES[inferida.pos]?.id}>Selector como el de su Brymen{inferida.dudosa ? `: ${inferida.dudosa}` : '.'}</span>{/if}
        <button type="button" class="ayuda-boton" aria-expanded={ayuda === 'brymen'} aria-label="Ayuda del Brymen" onclick={() => (ayuda = ayuda === 'brymen' ? null : 'brymen')}>?</button>
      {#if ayuda === 'brymen'}
        <div class="ayuda">
          <p><strong>Selector:</strong> gírelo (arrastre o toque una posición) a lo que quiere medir: V⎓ continua, V∿ alterna, Ω resistencia (SELECT pasa a continuidad), ⊣⊢ capacidad o diodo, A mA y µA corriente.</p>
          <p><strong>Bornes:</strong> la punta negra siempre en COM; la roja en ΩV para tensión, resistencia y capacidad, en mA µA hasta 0,44 A y en A hasta 10 A (toque un borne para pasarla).</p>
          <p><strong>Tensión</strong> en paralelo (las puntas en los dos puntos); <strong>corriente</strong> en serie (abra el circuito y ciérrelo con el polímetro); <strong>resistencia</strong> sin alimentación.</p>
          <p><strong>Botones:</strong> SELECT cambia la función, RANGE fija el rango (mantenido, vuelve a AUTO), Δ relativo, HOLD congela, REC máximo/mínimo/media, CREST picos.</p>
        </div>
      {/if}
      </figcaption>
    </figure>
    <figure
      class="instrumento fnirsi"
      class:oculto={pestana !== 'fnirsi'}
      data-recorrido="fnirsi"
      data-modo-fnirsi={b.fnirsi.modo}
      data-funcion-dibujada={FN_DMM_LISTA[b.fnirsi.fnDmm]?.id}
      data-teclas-fnirsi={teclasFnirsi}
    >
      <FnirsiVista f={b.fnirsi} {alAuto} guia={guiaFn} />
      <figcaption>
        {b.fnirsi.modo === 'osc' ? infoOsc : b.fnirsi.modo === 'gen' ? 'FNIRSI 2C53T · generador DDS: 1 Hz … 50 kHz, 0,1 … 3 V (de 0 a la amplitud)' : 'FNIRSI 2C53T · multímetro de 19 999 cuentas'}
        {#if sigueFn.texto}<span class="sigue-real" data-sigue-real-fnirsi={sigueFn.modo ?? 'no'}>{sigueFn.texto}</span>{/if}
        {#if sigueFuncion.texto}<span class="sigue-real" data-sigue-funcion-fnirsi>{sigueFuncion.texto}</span>{/if}
        <button type="button" class="ayuda-boton" aria-expanded={ayuda === 'fnirsi'} aria-label="Ayuda del FNIRSI" onclick={() => (ayuda = ayuda === 'fnirsi' ? null : 'fnirsi')}>?</button>
      {#if ayuda === 'fnirsi'}
        <div class="ayuda">
          <p><strong>MENU</strong>, mantenida un segundo, elige osciloscopio, multímetro o generador (◄ ► marcan el modo y la tecla azul entra); el botón rojo lo enciende.</p>
          <p><strong>Muestreo:</strong> 1 000 puntos en las 12 divisiones de la pantalla ({formatoSI(12 * b.fnirsi.sDiv, 's', 3)} ahora); una señal más rápida que la mitad de ese muestreo se ve con alias.</p>
          <p><strong>Osciloscopio:</strong> la pinza de masa a la masa del circuito y la punta de la sonda en el punto. <strong>AUTO</strong> ajusta base de tiempos, V/div y disparo; las flechas los cambian a mano (◄► tiempo, ▲▼ tensión del canal activo) y SELECT cambia lo que hacen: posición horizontal y de CH1 con el nivel de disparo, o posición horizontal y nivel de disparo. TRIGGER el disparo, PRM muestra frecuencia, periodo, Vpp y media, MENU las funciones (Math, cursores, X-Y) y la tecla azul, RUN/STOP, congela.</p>
          <!-- 2.1 (owner, 25-11): the real 2C53T's arrows have a mode SELECT changes, which the link does not carry -->
          <p data-ayuda-select><strong>En su FNIRSI real:</strong> si las flechas no cambian la base de tiempos, pulse SELECT.</p>
          <p><strong>CH1 / CH2:</strong> encienden el canal y abren su menú: acoplamiento, ×1/×10 (debe coincidir con el conmutador de la sonda), invertir.</p>
          <p><strong>Multímetro:</strong> ◄ ► cambian la función, MOVE pasa la tensión de continua a alterna, AUTO vuelve a Automático y la tecla azul retiene el valor (HOLD).</p>
          <p><strong>Generador:</strong> forma, frecuencia y amplitud (de 0 a la amplitud); sus dos puntas alimentan el circuito. ▲ ▼ eligen la forma; la tecla azul entra en los ajustes y, otra vez, edita la línea marcada; MENU vuelve atrás.</p>
        </div>
      {/if}
      </figcaption>
    </figure>
  </div>
</div>

<style>
  /* 2.1: the drawings are those of 2.0, untouched; around them only a one-line caption (15 px, soft) and the «?». The
     instruments' height follows the window (--alto-aparato, set by the bench page), their widths from their ratios
     (Brymen 300 × 640, FNIRSI 340 × 660). */
  .aparatos {
    min-width: 0;
  }
  .pestanas {
    display: flex;
    gap: 6px;
    margin-bottom: 8px;
  }
  .pestanas button {
    flex: 1;
    min-height: 48px;
    border: 1px solid var(--v11-linea);
    border-radius: 12px;
    background: transparent;
    color: var(--v11-tinta-suave);
    font-family: var(--sans);
    font-size: 15px;
    font-weight: 500;
  }
  .pestanas button[aria-selected='true'] {
    border-color: var(--v11-azul);
    color: var(--v11-tinta);
    background: var(--v11-azul-tinte);
    font-weight: 600;
  }
  .par {
    display: flex;
    gap: 32px;
    align-items: flex-start;
    justify-content: center;
  }
  .instrumento {
    margin: 0;
    min-width: 0;
  }
  .instrumento.brymen {
    flex: 0 1 min(300px, calc(var(--alto-aparato, 620px) * 300 / 640));
  }
  .instrumento.fnirsi {
    flex: 0 1 min(360px, calc(var(--alto-aparato, 620px) * 340 / 660));
  }
  .oculto {
    display: none;
  }
  .ayuda-boton {
    width: 28px;
    height: 28px;
    margin-left: 4px;
    border: 1px solid var(--v11-linea);
    border-radius: 50%;
    background: transparent;
    color: var(--v11-azul);
    font: 600 13px var(--sans);
    vertical-align: middle;
  }
  .ayuda {
    margin-top: 8px;
    text-align: left;
    padding: 12px 14px;
    border-radius: 12px;
    background: var(--v11-panel);
    font-family: var(--sans);
    font-size: 15px;
    line-height: 1.45;
    color: var(--v11-tinta);
  }
  .ayuda p {
    margin: 0 0 8px;
  }
  figcaption {
    margin-top: 12px;
    font-family: var(--sans);
    font-size: 15px;
    color: var(--v11-tinta-suave);
    text-align: left;
    line-height: 1.4;
  }
  .sigue-real {
    display: block;
    margin-top: 4px;
    font-size: 13px;
  }

  /* Two instruments side by side as soon as they fit; the tabs only on narrow screens. */
  @container (min-width: 640px) {
    .pestanas {
      display: none;
    }
    .oculto {
      display: block;
    }
  }
</style>
