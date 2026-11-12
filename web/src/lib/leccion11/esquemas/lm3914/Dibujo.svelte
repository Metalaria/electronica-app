<script lang="ts">
  // Schematic «lm3914» (esquema.ts): the input source on the left, over the top into the chip's SIG pin; R_ref from the
  // REF pin, under the chip, to ground. Inside the chip, the ten-resistor chain from V_LO (bottom) to V_HI (top), and a
  // comparator at each tap: its − input from the tap, its + input from the buffered input's bus (the taps cross the bus
  // without joining it; the chip's inside is drawn in thin lines). The ten outputs to the right, each into its LED
  // from the V_LED rail, lit as the netlist decides (esquema.ts encendidos). No current particles (the outputs are
  // current sinks).
  import type { PropsDibujo } from '../dibujos';
  import D from '../kit/D.svelte';
  import Et from '../kit/Et.svelte';
  import Lienzo from '../kit/Lienzo.svelte';
  import Pila from '../kit/Pila.svelte';
  import R from '../kit/R.svelte';
  import { encendidos } from './esquema';
  let { c, descripcion }: PropsDibujo = $props();
  const luz = $derived(encendidos(c));
  // the chain's nodes are 24 units apart, from y = 274 (V_LO) up to y = 34 (V_HI); comparator k sits at node k + 1
  const yc = (k: number) => 250 - 24 * k;
  const cadena = $derived.by(() => {
    let s = 'M150 274';
    for (let j = 0; j < 10; j++) {
      const y0 = 274 - 24 * j;
      s += ` L155 ${y0 - 4} L145 ${y0 - 8} L155 ${y0 - 12} L145 ${y0 - 16} L150 ${y0 - 20} V${y0 - 24}`;
    }
    return s;
  });
</script>

<Lienzo {descripcion} ancho={430} alto={380}>
  <!-- the chip -->
  <rect class="pieza" x="110" y="24" width="150" height="268" rx="4"></rect>
  <Et x={258} y={308} t={`LM3914 · ${c.cerrado('barra') ? 'barra' : 'punto'}`} peq ancla="end" />
  <!-- input: the source, over the top into SIG, down the bus -->
  <Pila x={40} y1={360} y2={200} pieza="entrada" nodos={['0', 'in']} />
  <!-- (the input's label right of its source, clear of the wire up and of the chip, also enlarged on a phone) -->
  <Et x={60} y={236} t={c.val('entrada')} peq />
  <path class="hilo" d="M40 200 V10 H172 V24" data-red="in"></path>
  <Et x={180} y={20} t="SIG" peq />
  <path class="hilo fino" d="M172 24 V246"></path>
  <!-- R_ref from REF, under the chip, to ground -->
  <R x1={130} y1={292} x2={130} y2={360} color="azul" pieza="rref" />
  <Et x={142} y={332} t={c.simT('rref')} color="azul" peq />
  <Et x={142} y={352} t={c.val('rref')} color="azul" peq />
  <Et x={116} y={286} t="REF" peq />
  <!-- the chain and its ends -->
  <path class="pieza fina" d={cadena}></path>
  <Et x={104} y={40} t={c.tiene('vhi') ? c.val('vhi') : c.val('vref')} peq ancla="end" />
  <Et x={158} y={286} t={c.tiene('vlo') ? c.val('vlo') : '0 V'} peq />
  {#each luz as on, k (k)}
    <!-- comparator k: the tap into its − input, the bus into its + input, its output to the LED -->
    <path class="hilo fino" d={`M150 ${yc(k)} H160 V${yc(k) + 4} H192 M172 ${yc(k) - 4} H192 M210 ${yc(k)} H260`}></path>
    <path class={`pieza fina${on ? ' naranja' : ''}`} d={`M192 ${yc(k) - 9} V${yc(k) + 9} L210 ${yc(k)} Z`}></path>
    <path class="hilo" d={`M260 ${yc(k)} H272`}></path>
    <D x1={350} y1={yc(k)} x2={272} y2={yc(k)} variante="led" color={on ? 'naranja' : 'tinta'} brillo={on ? 1 : 0} pieza={k === 0 ? 'vf' : undefined} />
  {/each}
  <!-- the LEDs' supply -->
  <path class="hilo" d="M350 34 V250 M350 34 H400"></path>
  <Pila x={400} y1={360} y2={34} pieza="vled" nodos={['0', 'vl']} />
  <Et x={408} y={200} t={c.val('vled')} peq />
  <path class="hilo" d="M400 360 H40" data-red="0"></path>
</Lienzo>
