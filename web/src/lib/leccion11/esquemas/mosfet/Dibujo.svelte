<script lang="ts">
  // Schematic «mosfet» (esquema.ts): the gate source and R_G on the left (R_GS down from the gate node), the MOSFET in
  // the middle with its body diode, R_D up to the V_DD rail, R_S (or a wire) down to ground, V_DD on the right. With an
  // inductive load (esquemas12b) the coil L sits under R_D, everything below it 40 units lower, and the freewheel
  // diode (with its switch) runs from the drain node up to the rail on the right of the transistor.
  import type { PropsDibujo } from '../dibujos';
  import D from '../kit/D.svelte';
  import Et from '../kit/Et.svelte';
  import Flujo from '../kit/Flujo.svelte';
  import Interruptor from '../kit/Interruptor.svelte';
  import L from '../kit/L.svelte';
  import Lienzo from '../kit/Lienzo.svelte';
  import Mosfet from '../kit/Mosfet.svelte';
  import Pila from '../kit/Pila.svelte';
  import R from '../kit/R.svelte';
  let { c, dur, descripcion }: PropsDibujo = $props();
  const pwm = $derived(c.tiene('f'));
  const bobina = $derived(c.tiene('l'));
  // everything from the drain down moves 40 units with the coil
  const dy = $derived(bobina ? 40 : 0);
  const yg = $derived(140 + dy);
  const ym = $derived(240 + dy);
  const yd = $derived(100 + dy);
</script>

<Lienzo {descripcion} ancho={400} alto={260 + dy}>
  <Flujo d={`M352 ${ym} V30 H222 V${ym} Z`} {dur} />
  <Pila x={40} y1={ym} y2={yg} pieza="entrada" nodos={['0', 'in']} />
  <Et x={2} y={yg - 12} t={c.val('entrada')} />
  {#if pwm}
    <!-- the PWM's pulses, left of the gate source -->
    <path class="hilo fino" d={`M3 ${yg + 78} h4 v-12 h6 v12 h6 v-12 h6 v12 h2`}></path>
    <Et x={2} y={yg + 96} t={c.val('f')} peq />
  {/if}
  {#if c.tiene('rg')}
    <path class="hilo" d={`M40 ${yg} H66`} data-red="in"></path>
    <R x1={66} y1={yg} x2={150} y2={yg} color="azul" pieza="rg" />
    <Et x={108} y={yg - 20} t={c.rot('rg')} ancla="middle" color="azul" peq />
    <path class="hilo" d={`M150 ${yg} H176`} data-red="g"></path>
  {:else}
    <path class="hilo" d={`M40 ${yg} H176`} data-red="in"></path>
  {/if}
  {#if c.tiene('rgs')}
    <circle class="nodo" cx="162" cy={yg} r="4.5"></circle>
    <R x1={162} y1={yg} x2={162} y2={ym} color="azul" pieza="rgs" />
    <Et x={150} y={yg + 56} t={c.rot('rgs')} ancla="end" color="azul" peq />
  {/if}
  <Mosfet x={210} y={yg} diodo />
  <Et x={205} y={72 + dy} t={`k ${c.val('k')}`} ancla="end" peq />
  <Et x={205} y={92 + dy} t={[{ t: 'txt', s: 'V' }, { t: 'sub', s: 'th' }, { t: 'txt', s: ` ${c.val('vth')}` }]} ancla="end" peq />
  {#if c.tiene('bv')}
    <Et x={276} y={yg + 30} t={`BV ${c.val('bv')}`} peq />
  {/if}
  {#if bobina}
    <R x1={222} y1={30} x2={222} y2={84} color="naranja" pieza="rd" />
    <Et x={236} y={60} t={c.rot('rd')} color="naranja" peq />
    <L x1={222} y1={84} x2={222} y2={yd} color="naranja" pieza="l" />
    <Et x={236} y={116} t={c.rot('l')} color="naranja" peq />
    {#if c.tiene('vf')}
      <!-- the freewheel diode: anode on the drain node, cathode on the rail, its switch above it -->
      <circle class="nodo" cx="222" cy={yd} r="4.5"></circle>
      <path class="hilo" d={`M222 ${yd} H286 V${yd - 8}`}></path>
      <D x1={286} y1={yd - 8} x2={286} y2={92} color="verde" pieza="vf" />
      <Interruptor x1={286} y1={92} x2={286} y2={38} cerrado={c.cerrado('rueda')} color="verde" pieza="rueda" />
      <path class="hilo" d="M286 38 V30"></path>
      <circle class="nodo" cx="286" cy="30" r="4.5"></circle>
      <!-- (left of the V_DD source's lead, also with the labels a phone enlarges) -->
      <Et x={298} y={120} t={c.val('vf')} color="verde" peq />
    {/if}
  {:else}
    <R x1={222} y1={30} x2={222} y2={100} color="naranja" pieza="rd" />
    <Et x={236} y={64} t={c.rot('rd')} color="naranja" peq />
  {/if}
  {#if c.tiene('rs')}
    <R x1={222} y1={yg + 40} x2={222} y2={ym} color="verde" pieza="rs" />
    <Et x={236} y={yg + 74} t={c.rot('rs')} color="verde" peq />
  {:else}
    <path class="hilo" d={`M222 ${yg + 40} V${ym}`}></path>
  {/if}
  <path class="hilo" d="M222 30 H352" data-red="vdd"></path>
  <path class="hilo" d={`M352 ${ym} H40`} data-red="0"></path>
  <Pila x={352} y1={ym} y2={30} pieza="vdd" nodos={['0', 'vdd']} />
  <Et x={366} y={150 + dy / 2} t={c.val('vdd')} peq />
</Lienzo>
