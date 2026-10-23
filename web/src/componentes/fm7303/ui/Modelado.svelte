<script lang="ts">
  // Marks a value or signal that the app models or synthesises (not a number of the book).
  let { texto = 'modelado', nota = '' }: { texto?: string; nota?: string } = $props();
</script>

<span class="modelado" title={nota || 'Calculado por el modelo de la aplicación, no tomado del libro'}>{texto}</span>

<style>
  .modelado {
    display: inline-block;
    padding: 1px 7px;
    border: 1px dashed var(--tinta-tenue);
    border-radius: 999px;
    color: var(--tinta-suave);
    font-family: var(--sans);
    font-size: 11.5px;
    font-weight: 600;
    line-height: 1.5;
    white-space: nowrap;
  }
</style>
