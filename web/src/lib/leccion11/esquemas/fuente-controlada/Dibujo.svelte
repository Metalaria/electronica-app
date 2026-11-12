<script lang="ts">
  // Schematic «fuente-controlada» (esquema.ts): the input port on the left (the control voltage v between its two
  // terminals), the dependent source and its output resistance in the dashed box (in parallel with a VCCS, in series
  // with a VCVS), the output terminals, the switch and the load on the right.
  import type { Texto } from '../../tipos';
  import type { PropsDibujo } from '../dibujos';
  import Et from '../kit/Et.svelte';
  import Flujo from '../kit/Flujo.svelte';
  import FuenteDep from '../kit/FuenteDep.svelte';
  import Interruptor from '../kit/Interruptor.svelte';
  import Lienzo from '../kit/Lienzo.svelte';
  import Pila from '../kit/Pila.svelte';
  import R from '../kit/R.svelte';
  let { c, dur, descripcion }: PropsDibujo = $props();
  const cerrado = $derived(c.cerrado('interruptor'));
  const vccs = $derived(c.tiene('gm'));
  const k = $derived(vccs ? 'gm' : 'av');
  // «g_m · v» or «A_v · v»: the source's law
  const ley = $derived<Texto>([...c.simT(k), { t: 'txt', s: ' · ' }, ...c.simT('control')]);
</script>

<Lienzo {descripcion} ancho={470} alto={250}>
  {#if vccs}
    <Flujo d={cerrado ? 'M150 230 V50 H410 V230 Z' : 'M150 230 V50 H240 V230 Z'} {dur} medidor={cerrado ? 'vcarga' : 'vr'} />
  {:else if cerrado}
    <Flujo d="M150 230 V50 H410 V230 Z" {dur} medidor="vcarga" />
  {/if}
  <!-- the input port: v between its terminals -->
  <Pila x={40} y1={230} y2={50} pieza="control" nodos={['0', 'c']} />
  <Et x={62} y={136} t={c.simT('control')} />
  <Et x={62} y={156} t={c.val('control')} peq />
  <path class="hilo" d="M40 50 H90" data-red="c"></path>
  <circle class="borne" cx="90" cy="50" r="5"></circle>
  <circle class="borne" cx="90" cy="230" r="5"></circle>
  <!-- the controlled source and its output resistance (the dashed box) -->
  <rect class="cuerpo" x="112" y="18" width="194" height="226" rx="10" stroke-dasharray="6 5"></rect>
  <FuenteDep x={150} y1={230} y2={50} tipo={vccs ? 'corriente' : 'tension'} color="naranja" pieza={k} nodos={['0', vccs ? 's' : 'e']} />
  <Et x={176} y={136} t={ley} color="naranja" />
  <Et x={176} y={156} t={c.val(k)} color="naranja" peq />
  {#if vccs}
    <path class="hilo" d="M150 50 H335" data-red="s"></path>
    <circle class="nodo" cx="240" cy="50" r="4.5" data-red="s"></circle>
    <circle class="nodo" cx="240" cy="230" r="4.5" data-red="0"></circle>
    <R x1={240} y1={50} x2={240} y2={230} color="azul" pieza="ro" />
    <Et x={254} y={136} t={c.simT('ro')} color="azul" />
    <Et x={254} y={156} t={c.val('ro')} color="azul" peq />
  {:else}
    <path class="hilo" d="M150 50 H170" data-red="e"></path>
    {#if c.tiene('ro')}
      <R x1={170} y1={50} x2={290} y2={50} color="azul" pieza="ro" />
      <Et x={230} y={84} t={c.rot('ro')} ancla="middle" color="azul" />
    {:else}
      <path class="hilo" d="M170 50 H290" data-red="e"></path>
    {/if}
    <path class="hilo" d="M290 50 H335" data-red="s"></path>
  {/if}
  <path class="hilo" d="M40 230 H410" data-red="0"></path>
  <circle class="borne" cx="320" cy="50" r="5"></circle>
  <circle class="borne" cx="320" cy="230" r="5"></circle>
  {#if c.tiene('interruptor')}
    <Interruptor x1={335} y1={50} x2={385} y2={50} {cerrado} color="verde" pieza="interruptor" />
  {:else}
    <path class="hilo" d="M335 50 H385" data-red="s"></path>
  {/if}
  <path class="hilo" d="M385 50 H410" data-red={cerrado ? 's' : undefined}></path>
  <R x1={410} y1={50} x2={410} y2={230} color="verde" fantasma={!cerrado} pieza="carga" />
  {#if cerrado}
    <Et x={424} y={136} t={c.simT('carga')} color="verde" />
    <Et x={424} y={156} t={c.val('carga')} color="verde" peq />
  {/if}
</Lienzo>
