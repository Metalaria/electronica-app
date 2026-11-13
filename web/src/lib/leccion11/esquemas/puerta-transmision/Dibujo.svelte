<script lang="ts">
  // Schematic «puerta-transmision» (esquema.ts): the input source on the left to the top wire, the NMOS and the PMOS
  // side by side between the top (input) and the bottom (output) wires, each gate to a terminal that shows its level
  // (a tap on either toggles «ctrl»), the load R_L from the output to ground.
  import type { PropsDibujo } from '../dibujos';
  import Et from '../kit/Et.svelte';
  import Flujo from '../kit/Flujo.svelte';
  import Lienzo from '../kit/Lienzo.svelte';
  import Mosfet from '../kit/Mosfet.svelte';
  import Pila from '../kit/Pila.svelte';
  import R from '../kit/R.svelte';
  let { c, dur, descripcion }: PropsDibujo = $props();
  const on = $derived(c.cerrado('ctrl'));
</script>

<Lienzo {descripcion} ancho={440} alto={280}>
  <Flujo d="M40 260 V60 H192 V200 H380 V260 Z" {dur} medidor="vmi" />
  <Pila x={40} y1={260} y2={60} pieza="entrada" nodos={['0', 'in']} />
  <Et x={56} y={160} t={[{ t: 'txt', s: 'V' }, { t: 'sub', s: 'in' }]} />
  <Et x={56} y={178} t={c.val('entrada')} peq />
  <path class="hilo" d="M40 60 H312 V90 M192 60 V90" data-red="a"></path>
  <circle class="nodo" cx="192" cy="60" r="4.5" data-red="a"></circle>
  <Mosfet x={180} y={130} color="azul" />
  <Mosfet x={300} y={130} canal="p" color="verde" />
  <path class="hilo" d="M192 170 V200 M312 170 V200 H380" data-red="o"></path>
  <path class="hilo" d="M192 200 H312" data-red="o"></path>
  <circle class="nodo" cx="312" cy="200" r="4.5" data-red="o"></circle>
  <g data-pieza={c.tiene('ctrl') ? 'ctrl' : undefined}>
    <circle class="borne" cx="141" cy="130" r="5"></circle>
    <circle class="borne" cx="261" cy="130" r="5"></circle>
  </g>
  <Et x={130} y={118} t={on ? c.val('vdd') : '0 V'} ancla="end" color="azul" peq />
  <Et x={130} y={150} t="NMOS" ancla="end" color="azul" peq />
  <Et x={250} y={154} t={on ? '0 V' : c.val('vdd')} ancla="end" color="verde" peq />
  <Et x={250} y={110} t="PMOS" ancla="end" color="verde" peq />
  <R x1={380} y1={200} x2={380} y2={260} color="naranja" pieza="carga" />
  <Et x={394} y={226} t={c.simT('carga')} color="naranja" />
  <Et x={394} y={244} t={c.val('carga')} color="naranja" peq />
  <circle class="borne" cx="380" cy="200" r="5"></circle>
  <Et x={380} y={186} t={[{ t: 'txt', s: 'v' }, { t: 'sub', s: 'out' }]} ancla="middle" />
  <path class="hilo" d="M40 260 H380" data-red="0"></path>
</Lienzo>
