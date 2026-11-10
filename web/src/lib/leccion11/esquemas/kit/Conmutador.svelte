<script lang="ts">
  // 1.1 schematic kit: the two-way switch of a charge/discharge circuit — common terminal at (150, 50); «carga» joins
  // it to the source's top (40, 50), «descarga» to a wire down to the bottom one (110, 230).
  let { carga }: { carga: boolean } = $props();
</script>

<path class="hilo" d="M40 50 H95 M110 92 V230"></path>
<path class="pieza" d={carga ? 'M150 50 L101 50' : 'M150 50 L114 88'}></path>
<circle class="borne" cx="101" cy="50" r="4"></circle>
<circle class="borne" cx="110" cy="92" r="4"></circle>
<circle class="nodo" cx="150" cy="50" r="4"></circle>
<text x="98" y="36" class="et peq" text-anchor="middle">carga</text>
<text x="104" y="122" class="et peq" text-anchor="end">descarga</text>
