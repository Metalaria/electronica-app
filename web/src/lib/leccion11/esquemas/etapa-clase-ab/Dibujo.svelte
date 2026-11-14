<script lang="ts">
  // Schematic «etapa-clase-ab» (esquema.ts): the +V rail on top with the bias source I_B down to the base node of Q₁;
  // the V_BE multiplier (Q₃, R₁ and R₂ on its left) from there down to the base node of Q₂, with the bridge switch
  // beside it; Q₁ (NPN) and Q₂ (PNP) on the right, their emitter resistors meeting at the output and the load R_L to
  // ground; the driver source at the bottom left, on the base of Q₂; Q₂'s collector to the −V terminal.
  import type { PropsDibujo } from '../dibujos';
  import Entrada from '../kit/Entrada.svelte';
  import Et from '../kit/Et.svelte';
  import EtiquetasAO from '../kit/EtiquetasAO.svelte';
  import Flujo from '../kit/Flujo.svelte';
  import FuenteI from '../kit/FuenteI.svelte';
  import Interruptor from '../kit/Interruptor.svelte';
  import Lienzo from '../kit/Lienzo.svelte';
  import Npn from '../kit/Npn.svelte';
  import R from '../kit/R.svelte';
  let { c, dur, descripcion }: PropsDibujo = $props();
  const puente = $derived(c.tiene('puente') && c.cerrado('puente'));
  const sub = (s: string, i: string) => [{ t: 'txt' as const, s }, { t: 'sub' as const, s: i }];
</script>

<Lienzo {descripcion} ancho={460} alto={390}>
  <Flujo d="M276 20 V340" {dur} medidor="vc1" />
  <Flujo d="M276 200 H390 V380" {dur} medidor="vl" />
  <!-- +V rail, the bias source and the base node of Q₁ -->
  <path class="hilo" d="M150 20 H276" data-red="vcc"></path>
  <circle class="borne" cx="213" cy="20" r="5"></circle>
  <!-- (below the rail, right of the terminal: above it the label rose out of the drawing's top edge) -->
  <Et x={221} y={40} t={`+${c.val('vcc')}`} peq />
  <FuenteI x={150} y1={20} y2={100} pieza="ib" nodos={['vcc', 'b1']} />
  <Et x={174} y={56} t={sub('I', 'B')} color="azul" />
  <Et x={174} y={74} t={c.val('ib')} color="azul" peq />
  <path class="hilo" d="M100 100 H230" data-red="b1"></path>
  <circle class="nodo" cx="150" cy="100" r="4.5" data-red="b1"></circle>
  <!-- the V_BE multiplier -->
  <R x1={100} y1={100} x2={100} y2={200} color="azul" pieza="r1" />
  <Et x={86} y={146} t={c.simT('r1')} ancla="end" color="azul" />
  <Et x={86} y={164} t={c.val('r1')} ancla="end" color="azul" peq />
  <path class="hilo" d="M100 200 H104" data-red="bm"></path>
  <circle class="nodo" cx="100" cy="200" r="4.5" data-red="bm"></circle>
  <R x1={100} y1={200} x2={100} y2={300} color="azul" pieza="r2" />
  <Et x={86} y={246} t={c.simT('r2')} ancla="end" color="azul" />
  <Et x={86} y={264} t={c.val('r2')} ancla="end" color="azul" peq />
  <Npn x={138} y={200} />
  <path class="hilo" d="M150 100 V160" data-red="b1"></path>
  <path class="hilo" d="M150 240 V300" data-red="b2"></path>
  <Et x={124} y={176} t={sub('Q', '3')} ancla="end" peq />
  {#if c.tiene('puente')}
    <circle class="nodo" cx="200" cy="100" r="4.5" data-red="b1"></circle>
    <path class="hilo" d="M200 100 V170" data-red="b1"></path>
    <Interruptor x1={200} y1={170} x2={200} y2={230} cerrado={puente} color="azul" pieza="puente" />
    <path class="hilo" d="M200 230 V300" data-red="b2"></path>
    <circle class="nodo" cx="200" cy="300" r="4.5" data-red="b2"></circle>
  {/if}
  <!-- the driver on the base of Q₂ -->
  <path class="hilo" d="M40 300 H230" data-red="b2"></path>
  <circle class="nodo" cx="150" cy="300" r="4.5" data-red="b2"></circle>
  <Entrada {c} x={40} y1={380} y2={300} nodo="b2" />
  <EtiquetasAO {c} x={62} y={326} />
  <!-- the output pair -->
  <Npn x={264} y={100} />
  <path class="hilo" d="M276 20 V60" data-red="vcc"></path>
  <Et x={292} y={92} t={sub('Q', '1')} peq />
  <R x1={276} y1={140} x2={276} y2={200} color="verde" pieza="re" />
  <Et x={290} y={176} t={c.rot('re')} color="verde" peq />
  <path class="hilo" d="M276 200 H390" data-red="out"></path>
  <circle class="nodo" cx="276" cy="200" r="4.5" data-red="out"></circle>
  <Et x={340} y={190} t={sub('v', 'o')} ancla="middle" />
  <R x1={276} y1={200} x2={276} y2={260} color="verde" pieza={c.tiene('re2') ? 're2' : undefined} />
  <Et x={290} y={234} t={c.tiene('re2') ? c.rot('re2') : c.rot('re')} color="verde" peq />
  <Npn x={264} y={300} pnp />
  <Et x={292} y={318} t={sub('Q', '2')} peq />
  <circle class="borne" cx="276" cy="345" r="5"></circle>
  <Et x={290} y={350} t={`−${c.val('vcc')}`} peq />
  <R x1={390} y1={200} x2={390} y2={380} color="naranja" pieza="carga" />
  <Et x={404} y={286} t={c.simT('carga')} color="naranja" />
  <Et x={404} y={304} t={c.val('carga')} color="naranja" peq />
  <Et x={292} y={122} t={`β ${c.val('beta')}`} peq />
  <path class="hilo" d="M40 380 H390" data-red="0"></path>
</Lienzo>
