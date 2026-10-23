<script lang="ts">
  // The adjustable parts of the kit (section 15.11): air coils L1 and L2 (spread or squeeze the turns), the
  // trimmers C4A' and C4B', the cores of B1 and B2, the trimmer pots W1, W2 and W3, the «Monitor» bridge and the
  // supply voltage. `solo` restricts the list (a step of the alignment shows only its own controls).
  import type { EstadoKit } from './estado.svelte';
  import { L1, L2, B1_L, B2_L, TRIM_MIN, TRIM_MAX } from './fisica';
  import { fx, conUnidad } from './formato';
  import Deslizador from './ui/Deslizador.svelte';
  import Interruptor from './ui/Interruptor.svelte';

  let { k, solo = null, destacar = [] }: { k: EstadoKit; solo?: string[] | null; destacar?: string[] } = $props();

  const ver = (id: string) => !solo || solo.includes(id);
  const bobina = (l0: number, rel: number) =>
    `${conUnidad((l0 * (1 + rel)) / 1e-6, 4, 'µH')} · ${Math.abs(rel) < 0.004 ? 'como en el esquema' : rel > 0 ? 'espiras más juntas' : 'espiras más separadas'}`;
  const trim = (t: number) => conUnidad((TRIM_MIN + (TRIM_MAX - TRIM_MIN) * t) / 1e-12, 1, 'pF');
  const nucleo = (l0: number, rel: number) => conUnidad((l0 * (1 + rel)) / 1e-6, 2, 'µH');
</script>

<div class="mandos">
  {#if ver('l1')}<Deslizador id="l1" etiqueta="L1 (bobina de RF)" bind:valor={k.c.l1} min={-0.15} max={0.15} paso={0.0005} fino={0.0025} texto={bobina(L1, k.c.l1)} destacado={destacar.includes('l1')} />{/if}
  {#if ver('c4a')}<Deslizador id="c4a" etiqueta="C4A' (presintonía de RF)" bind:valor={k.c.c4a} paso={0.001} fino={0.005} texto={trim(k.c.c4a)} destacado={destacar.includes('c4a')} />{/if}
  {#if ver('l2')}<Deslizador id="l2" etiqueta="L2 (bobina del oscilador)" bind:valor={k.c.l2} min={-0.15} max={0.15} paso={0.0005} fino={0.0025} texto={bobina(L2, k.c.l2)} destacado={destacar.includes('l2')} />{/if}
  {#if ver('c4b')}<Deslizador id="c4b" etiqueta="C4B' (presintonía del oscilador)" bind:valor={k.c.c4b} paso={0.001} fino={0.005} texto={trim(k.c.c4b)} destacado={destacar.includes('c4b')} />{/if}
  {#if ver('b1')}<Deslizador id="b1" etiqueta="B1 (núcleo del transformador de FI)" bind:valor={k.c.b1} min={-0.12} max={0.12} paso={0.0005} fino={0.002} texto={nucleo(B1_L, k.c.b1)} destacado={destacar.includes('b1')} />{/if}
  {#if ver('b2')}<Deslizador id="b2" etiqueta="B2 (núcleo del discriminador)" bind:valor={k.c.b2} min={-0.1} max={0.1} paso={0.0002} fino={0.001} texto={nucleo(B2_L, k.c.b2)} destacado={destacar.includes('b2')} />{/if}
  {#if ver('w1')}<Deslizador id="w1" etiqueta="W1 (polarización del varicap, 20 kΩ)" bind:valor={k.c.w1} paso={0.0005} fino={0.002} texto={`cursor al ${fx(k.c.w1 * 100, 1)} %`} destacado={destacar.includes('w1')} />{/if}
  {#if ver('w3')}<Deslizador id="w3" etiqueta="W3 (VCO del decodificador, 5 kΩ)" bind:valor={k.c.w3} paso={0.0005} fino={0.002} texto={conUnidad(5 * k.c.w3, 2, 'kΩ')} destacado={destacar.includes('w3')} />{/if}
  {#if ver('w2')}<Deslizador id="w2" etiqueta="W2 (sensibilidad del mute, 10 kΩ)" bind:valor={k.c.w2} paso={0.005} fino={0.02} texto={`cursor al ${fx(k.c.w2 * 100, 0)} %`} destacado={destacar.includes('w2')} />{/if}
  {#if ver('monitor') || ver('vcc')}
    <div class="fila">
      {#if ver('monitor')}<Interruptor id="monitor" etiqueta="Puente «Monitor»" si="soldado" no="abierto" bind:activo={k.c.monitor} />{/if}
    </div>
  {/if}
  {#if ver('vcc')}<Deslizador id="vcc" etiqueta="Alimentación en CZ1" bind:valor={k.c.vcc} min={7} max={12.6} paso={0.05} fino={0.1} texto={conUnidad(k.c.vcc, 2, 'V')} ayuda="El manual pide entre 9 y 12 V: con menos cae la sensibilidad." />{/if}
</div>

<style>
  .mandos {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .fila {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    padding: 4px 8px;
  }
</style>
