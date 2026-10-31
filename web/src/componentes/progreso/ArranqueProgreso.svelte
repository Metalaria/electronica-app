<script lang="ts">
  // Mounted once by App.svelte (0.11). Two small jobs that cost nothing until needed:
  //   - the celebrations (Celebraciones.svelte, its own chunk) are mounted on the first «+N XP», level or achievement;
  //   - with the daily reminder on (Android), once the reader is up and the browser idle, it checks that the
  //     notification is still scheduled (recordatorio.ts, its own chunk).
  import { app } from '../../lib/estado.svelte';
  import { usuario } from '../../lib/usuario.svelte';
  import { avisos } from '../../lib/aprendizaje/avisos.svelte';

  let comprobado = false;

  $effect(() => {
    if (comprobado || !app.cargado || !usuario.listo || !usuario.prefs.recordatorio?.activo) return;
    comprobado = true;
    const ir = () => void import('../../lib/aprendizaje/recordatorio').then((m) => m.comprobarRecordatorio());
    if ('requestIdleCallback' in window) window.requestIdleCallback(ir, { timeout: 6000 });
    else setTimeout(ir, 2500);
  });
</script>

{#if avisos.usado}
  {#await import('./Celebraciones.svelte') then m}
    <m.default />
  {/await}
{/if}
