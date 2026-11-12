<script lang="ts">
  // 1.2 schematic kit (esquemas12): the labels of an op-amp schematic, one under another from (x, y): the input's
  // (`ao` false: the DC value, or the signal's amplitude and frequency) or the amplifier's (`ao`: its saturation, A₀,
  // GBW and slew rate, those the widget gives).
  import Et from './Et.svelte';
  import type { ContextoDibujo } from '../tipos';
  import type { Texto } from '../../tipos';
  let { c, x, y, ao = false, ancla = 'start' }: { c: ContextoDibujo; x: number; y: number; ao?: boolean; ancla?: 'start' | 'middle' | 'end' } = $props();
  const lineas = $derived.by((): (string | Texto)[] => {
    if (!ao) return c.tiene('amplitud') && c.tiene('f') && c.p('f') > 0 ? [`${c.val('amplitud')} pico`, c.val('f'), ...(c.p('entrada') ? [`+ ${c.val('entrada')}`] : [])] : [c.val('entrada')];
    const out: (string | Texto)[] = [];
    if (c.tiene('vsat')) out.push(c.tiene('vsatneg') ? `${c.val('vsatneg')} … ${c.val('vsat')}` : `± ${c.val('vsat')}`);
    if (c.tiene('a0')) out.push([{ t: 'txt', s: 'A' }, { t: 'sub', s: '0' }, { t: 'txt', s: ` ${c.val('a0')}` }]);
    if (c.tiene('gbw')) out.push(`GBW ${c.val('gbw')}`);
    if (c.tiene('sr')) out.push(`SR ${c.val('sr')}`);
    return out;
  });
</script>

{#each lineas as t, k (k)}<Et {x} y={y + 18 * k} {t} color={ao ? 'verde' : 'tinta'} peq {ancla} />{/each}
