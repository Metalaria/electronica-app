<script lang="ts">
  // 1.1: the mark of a new exercise that the book does not have yet (contenido/ejercicios_nuevos11/): the app shows it
  // now and it goes into the book's next edition. Plain text (never colour alone), amber tokens of the three themes
  // (text ≥ 4.5:1 on its tint, border ≥ 3:1).
  // 1.1: also the mark of what a book expansion adds (contenido/ampliaciones11/: sections, a chapter, problems,
  // exercises, review questions, netlists), with `titulo` saying what it is.
  let {
    compacta = false,
    titulo = 'Ejercicio de la aplicación: estará en la próxima edición del libro',
  }: { compacta?: boolean; titulo?: string } = $props();
</script>

<span class="insignia-nuevo" class:compacta data-nuevo title={titulo}>Aún no en el libro</span>

<style>
  .insignia-nuevo {
    display: inline-flex;
    align-items: center;
    padding: 2px 9px;
    border: 1px solid var(--ambar);
    border-radius: 999px;
    background: var(--ambar-tinte);
    color: var(--ambar);
    font-family: var(--sans);
    font-size: 13px;
    font-weight: 700;
    line-height: 1.4;
    white-space: nowrap;
  }
  .compacta {
    padding: 0 7px;
    font-size: 12px;
  }
</style>
