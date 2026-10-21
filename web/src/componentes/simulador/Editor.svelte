<script lang="ts">
  // Netlist editor: monospace text with line numbers (ngspice reports errors by line). Ctrl/⌘ + Intro runs.
  let {
    texto = $bindable(''),
    alEjecutar,
    marcada = null,
    placeholder = '',
  }: { texto: string; alEjecutar?: () => void; marcada?: number | null; placeholder?: string } = $props();

  let area: HTMLTextAreaElement | undefined = $state();
  let gutter: HTMLDivElement | undefined = $state();
  const lineas = $derived(Math.max(1, texto.split('\n').length));

  function desplazar() {
    if (gutter && area) gutter.scrollTop = area.scrollTop;
  }

  function teclas(ev: KeyboardEvent) {
    if (ev.key === 'Enter' && (ev.ctrlKey || ev.metaKey)) {
      ev.preventDefault();
      alEjecutar?.();
    } else if (ev.key === 'Tab' && !ev.shiftKey && area) {
      // A tab inserts spaces (netlists are column-aligned); Escape then Tab leaves the editor.
      ev.preventDefault();
      const { selectionStart: a, selectionEnd: b } = area;
      texto = texto.slice(0, a) + '  ' + texto.slice(b);
      requestAnimationFrame(() => area?.setSelectionRange(a + 2, a + 2));
    } else if (ev.key === 'Escape') {
      area?.blur();
    }
  }
</script>

<div class="editor">
  <div class="numeros" bind:this={gutter} aria-hidden="true">
    {#each { length: lineas } as _, i (i)}
      <div class:marcada={marcada === i + 1}>{i + 1}</div>
    {/each}
  </div>
  <textarea
    bind:this={area}
    bind:value={texto}
    onscroll={desplazar}
    onkeydown={teclas}
    spellcheck="false"
    autocapitalize="off"
    autocomplete="off"
    wrap="off"
    {placeholder}
    aria-label="Netlist (Ctrl + Intro para simular)"
  ></textarea>
</div>

<style>
  .editor {
    display: flex;
    height: min(60vh, 520px);
    min-height: 220px;
    border: 1px solid var(--linea);
    border-radius: 10px;
    background: var(--codigo-fondo);
    overflow: hidden;
    font-family: var(--mono);
    font-size: 13.5px;
    line-height: 1.5;
  }
  .editor:focus-within {
    border-color: var(--acento-borde);
    box-shadow: 0 0 0 3px var(--acento-suave);
  }
  .numeros {
    flex: none;
    min-width: 3.2em;
    padding: 10px 8px 10px 4px;
    overflow: hidden;
    text-align: right;
    color: var(--tinta-tenue);
    border-right: 1px solid var(--linea-suave);
    user-select: none;
  }
  .numeros .marcada {
    color: var(--c-precaucion);
    font-weight: 700;
  }
  textarea {
    flex: 1;
    min-width: 0;
    padding: 10px 12px;
    border: 0;
    outline: none;
    resize: none;
    background: transparent;
    color: var(--tinta);
    font: inherit;
    line-height: inherit;
    white-space: pre;
    overflow: auto;
    tab-size: 4;
  }
  textarea::placeholder {
    color: var(--tinta-tenue);
  }
</style>
