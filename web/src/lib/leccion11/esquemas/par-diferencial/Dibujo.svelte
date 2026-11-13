<script lang="ts">
  // Schematic «par-diferencial» (esquema.ts): Q₁ on the left and Q₂ mirrored on the right, R_C from the +V_CC rail to
  // each collector (the outputs v_c1, v_c2 on the sides), the emitters joined over the tail — R_EE, or the current
  // source with r_o beside it — down to the −V_EE terminal; each base from its source.
  import type { PropsDibujo } from '../dibujos';
  import Et from '../kit/Et.svelte';
  import Flujo from '../kit/Flujo.svelte';
  import FuenteCA from '../kit/FuenteCA.svelte';
  import FuenteI from '../kit/FuenteI.svelte';
  import Lienzo from '../kit/Lienzo.svelte';
  import Npn from '../kit/Npn.svelte';
  import Pila from '../kit/Pila.svelte';
  import R from '../kit/R.svelte';
  let { c, dur, descripcion }: PropsDibujo = $props();
  const senal = $derived((c.tiene('ad') || c.tiene('acm')) && c.p('f') > 0);
  const fuenteI = $derived(c.tiene('icola'));
  const sub = (s: string, i: string) => [{ t: 'txt' as const, s }, { t: 'sub' as const, s: i }];
</script>

<Lienzo {descripcion} ancho={460} alto={320}>
  <Flujo d="M182 30 V220 H230 V280" {dur} medidor="vcm1" />
  <Flujo d="M278 30 V220 H230 V280" {dur} medidor="vcm2" />
  <path class="hilo" d="M182 30 H278" data-red="vcc"></path>
  <circle class="borne" cx="230" cy="30" r="5"></circle>
  <Et x={230} y={18} t={`+${c.val('vcc')}`} ancla="middle" peq />
  <R x1={182} y1={30} x2={182} y2={110} color="naranja" pieza="rc" />
  <Et x={168} y={66} t={sub('R', 'C1')} ancla="end" color="naranja" />
  <Et x={168} y={84} t={c.val('rc')} ancla="end" color="naranja" peq />
  <R x1={278} y1={30} x2={278} y2={110} color="naranja" />
  <Et x={292} y={66} t={sub('R', 'C2')} color="naranja" />
  <Et x={292} y={84} t={c.tiene('drc') && c.p('drc') ? `${c.val('rc')} · (1 + ${c.val('drc')})` : c.val('rc')} color="naranja" peq />
  <path class="hilo" d="M182 110 H110" data-red="c1"></path>
  <circle class="borne" cx="110" cy="110" r="5"></circle>
  <Et x={110} y={94} t={sub('v', 'c1')} ancla="middle" />
  <path class="hilo" d="M278 110 H350" data-red="c2"></path>
  <circle class="borne" cx="350" cy="110" r="5"></circle>
  <Et x={350} y={94} t={sub('v', 'c2')} ancla="middle" />
  <Npn x={170} y={150} />
  <Npn x={290} y={150} espejo />
  <Et x={230} y={156} t={`β ${c.val('beta')}`} ancla="middle" peq />
  <path class="hilo" d="M182 190 V220 H278 V190" data-red="e"></path>
  <circle class="nodo" cx={fuenteI && c.tiene('ro') ? 215 : 230} cy="220" r="4.5" data-red="e"></circle>
  {#if fuenteI}
    <FuenteI x={215} y1={220} y2={280} pieza="icola" nodos={['e', 'vee']} />
    <Et x={193} y={246} t="I" ancla="end" color="verde" />
    <Et x={193} y={264} t={c.val('icola')} ancla="end" color="verde" peq />
    {#if c.tiene('ro')}
      <circle class="nodo" cx="250" cy="220" r="4.5" data-red="e"></circle>
      <R x1={250} y1={220} x2={250} y2={280} color="verde" pieza="ro" />
      <Et x={264} y={246} t={c.simT('ro')} color="verde" />
      <Et x={264} y={264} t={c.val('ro')} color="verde" peq />
      <path class="hilo" d="M215 280 H250" data-red="vee"></path>
    {/if}
  {:else}
    <R x1={230} y1={220} x2={230} y2={280} color="verde" pieza="ree" />
    <Et x={244} y={246} t={c.simT('ree')} color="verde" />
    <Et x={244} y={264} t={c.val('ree')} color="verde" peq />
  {/if}
  <circle class="borne" cx={fuenteI ? 215 : 230} cy="280" r="5"></circle>
  <Et x={fuenteI ? 201 : 244} y={286} t={`−${c.val('vee')}`} ancla={fuenteI ? 'end' : 'start'} peq />
  {#if senal}
    <FuenteCA x={60} y1={300} y2={150} pieza="v1" nodos={['0', 'b1']} />
    <FuenteCA x={400} y1={300} y2={150} pieza="v2" nodos={['0', 'b2']} />
  {:else}
    <Pila x={60} y1={300} y2={150} pieza="v1" nodos={['0', 'b1']} />
    <Pila x={400} y1={300} y2={150} pieza="v2" nodos={['0', 'b2']} />
  {/if}
  <path class="hilo" d="M60 150 H136" data-red="b1"></path>
  <path class="hilo" d="M400 150 H324" data-red="b2"></path>
  <Et x={84} y={206} t={sub('v', '1')} color="azul" />
  <Et x={84} y={224} t={c.val('v1')} color="azul" peq />
  <Et x={376} y={206} t={sub('v', '2')} ancla="end" color="azul" />
  <Et x={376} y={224} t={c.val('v2')} ancla="end" color="azul" peq />
  {#if senal && c.tiene('ad')}
    <Et x={84} y={242} t={`+ ${c.val('ad')}/2`} color="azul" peq />
    <Et x={376} y={242} t={`− ${c.val('ad')}/2`} ancla="end" color="azul" peq />
  {/if}
  {#if senal && c.tiene('acm')}
    <Et x={84} y={260} t={`+ ${c.val('acm')} común`} color="azul" peq />
    <Et x={376} y={260} t={`+ ${c.val('acm')} común`} ancla="end" color="azul" peq />
  {/if}
  <path class="hilo" d="M60 300 H400" data-red="0"></path>
</Lienzo>
