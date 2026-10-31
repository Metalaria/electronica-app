<script lang="ts">
  // The first-use tour of the breadboard (0.11): three short cards — the parts tray, wires from hole to hole,
  // «Simular» — each next to what it talks about. It never blocks the board (only the card takes taps), moves
  // on by itself when the user does what it says, and is not shown again once closed
  // (localStorage `epa:protoboard-recorrido`).
  import { untrack } from 'svelte';
  import type { Protoboard } from './estado.svelte';

  let { pb }: { pb: Protoboard } = $props();

  const CLAVE = 'epa:protoboard-recorrido';
  function visto(): boolean {
    try {
      return localStorage.getItem(CLAVE) === '1';
    } catch {
      return true;
    }
  }
  let paso = $state(visto() ? -1 : 0);
  function cerrar() {
    paso = -1;
    try {
      localStorage.setItem(CLAVE, '1');
    } catch {
      /* private mode: shown again next time */
    }
  }
  function siguiente() {
    if (paso >= 2) cerrar();
    else paso++;
  }

  // Doing what a card says moves on.
  let piezas = untrack(() => pb.doc.piezas.length);
  let cables = untrack(() => pb.doc.cables.length);
  $effect(() => {
    void pb.version;
    const np = pb.doc.piezas.length;
    const nc = pb.doc.cables.length;
    if (paso === 0 && np > piezas) paso = 1;
    else if (paso === 1 && nc > cables) paso = 2;
    piezas = np;
    cables = nc;
  });
  $effect(() => {
    if ((pb.guia || pb.leccion) && paso >= 0) cerrar();
  });

  const TEXTOS = [
    { titulo: 'Las piezas', texto: 'Arrastre una pieza de la bandeja hasta la placa: verá en verde los agujeros donde caerán sus patas. También puede tocarla y luego tocar la placa.' },
    { titulo: 'Los cables', texto: 'Toque un agujero libre y después otro: el cable los une. Dos dedos mueven y acercan la placa. Qué agujeros están unidos por dentro lo enseña «Monta este circuito» → «La protoboard por dentro».' },
    { titulo: 'A probarlo', texto: '«Simular» resuelve el circuito tal como está montado: los LED se encienden. ¿Primera vez? «Monta este circuito» le guía paso a paso.' },
  ];
</script>

{#if paso >= 0}
  <div class="recorrido" class:p0={paso === 0} class:p1={paso === 1} class:p2={paso === 2} role="dialog" aria-modal="false" aria-labelledby="recorrido-titulo">
    <p class="cuenta">{paso + 1} de 3</p>
    <h2 id="recorrido-titulo">{TEXTOS[paso]!.titulo}</h2>
    <p>{TEXTOS[paso]!.texto}</p>
    <div class="botones">
      <button type="button" class="enlace" onclick={cerrar}>Saltar</button>
      <button type="button" class="boton primario" onclick={siguiente}>{paso < 2 ? 'Siguiente' : 'Entendido'}</button>
    </div>
  </div>
{/if}

<style>
  .recorrido {
    position: absolute;
    z-index: 20;
    left: 50%;
    width: min(360px, calc(100% - 24px));
    transform: translateX(-50%);
    padding: 12px 14px 10px;
    border: 1px solid var(--acento-borde);
    border-radius: var(--radio-tarjeta-p);
    background: var(--superficie);
    box-shadow: var(--sombra-alta);
    font-family: var(--sans);
  }
  /* Next to what each card talks about: the tray (bottom), the board (middle), «Simular» (top). */
  .p0 {
    bottom: 12px;
  }
  .p0::after,
  .p2::before {
    content: '';
    position: absolute;
    left: calc(50% - 8px);
    width: 16px;
    height: 16px;
    background: var(--superficie);
    border: 1px solid var(--acento-borde);
    transform: rotate(45deg);
  }
  .p0::after {
    bottom: -9px;
    border-top: 0;
    border-left: 0;
  }
  .p1 {
    top: 40%;
  }
  .p2 {
    top: 12px;
    left: auto;
    right: 12px;
    transform: none;
  }
  .p2::before {
    top: -9px;
    left: auto;
    right: 40px;
    border-bottom: 0;
    border-right: 0;
  }
  .cuenta {
    margin: 0;
    color: var(--acento);
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }
  h2 {
    margin: 2px 0 4px;
    color: var(--titulos);
    font-size: 17px;
  }
  p {
    margin: 0;
    color: var(--tinta);
    font-size: 14px;
    line-height: 1.4;
  }
  .botones {
    display: flex;
    justify-content: flex-end;
    align-items: center;
    gap: 12px;
    margin-top: 10px;
  }
  .botones .boton {
    min-height: 44px;
    padding: 0 18px;
  }
  .enlace {
    min-height: 44px;
    padding: 0 6px;
    border: 0;
    background: none;
    color: var(--tinta-suave);
    font: 600 14px var(--sans);
  }
</style>
