<script lang="ts">
  // 1.1 schematic kit: the moving current along a path (one lap every `dur` seconds; still with reduced motion).
  let { d, dur }: { d: string; dur: number } = $props();
</script>

<path class="flujo" {d} style:animation-duration={`${dur.toFixed(2)}s`}></path>
