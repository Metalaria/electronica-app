<script lang="ts">
  // Numbered section heading with the reader's bookmark and personal note.
  import { tick } from 'svelte';
  import type { BH2 } from '../lib/tipos';
  import { prepararHtml, textoPlano } from '../lib/datos';
  import { usuario, alternarMarcador, guardarNota, LARGO_NOTA } from '../lib/usuario.svelte';
  import Icono from './Icono.svelte';
  import BotonSimular from './BotonSimular.svelte';
  import VerAnimacion from './animaciones/VerAnimacion.svelte';
  import VerEn3D from './tres/VerEn3D.svelte';
  import VerPractica from './instrumentos/VerPractica.svelte';
  import VerKit from './fm7303/VerKit.svelte';
  import VerPlaca from './proyectos/VerPlaca.svelte';
  import MarcaLeida from './aprender/MarcaLeida.svelte';

  let { bloque, parte, indice }: { bloque: BH2; parte: string; indice?: number } = $props();

  const label = $derived(bloque.label ?? '');
  const titulo = $derived(textoPlano(bloque.html));
  const datos = $derived({ parte, label, num: bloque.num ?? '', titulo });
  const marcado = $derived(!!label && label in usuario.marcadores);
  const nota = $derived(label ? usuario.notas[label] : undefined);

  let editando = $state(false);
  let borrador = $state('');
  let area: HTMLTextAreaElement | undefined = $state();

  async function editar() {
    borrador = nota?.texto ?? '';
    editando = true;
    await tick();
    area?.focus();
  }

  function guardar() {
    guardarNota(datos, borrador);
    editando = false;
  }

  function teclas(ev: KeyboardEvent) {
    if (ev.key === 'Escape') {
      ev.stopPropagation();
      editando = false;
    } else if (ev.key === 'Enter' && (ev.ctrlKey || ev.metaKey)) {
      guardar();
    }
  }
</script>

<div class="seccion-cab" data-b={indice}>
  <div class="fila">
    <h2 id={label || undefined}>
      {#if bloque.num}<span class="num">{bloque.num}</span>{/if}{@html prepararHtml(bloque.html)}
    </h2>
    {#if label}
      <div class="herramientas">
        <BotonSimular {label} compacto />
        <VerAnimacion {label} compacto />
        <VerEn3D {label} compacto />
        <VerPractica {label} compacto />
        <VerKit {label} compacto />
        <VerPlaca {label} compacto />
        <MarcaLeida {parte} {label} />
        <button
          class="boton-icono"
          aria-pressed={!!nota || editando}
          aria-label={nota ? 'Editar la nota de esta sección' : 'Añadir una nota a esta sección'}
          title={nota ? 'Editar nota' : 'Añadir nota'}
          onclick={editar}><Icono nombre="nota" tam={19} /></button
        >
        <button
          class="boton-icono"
          aria-pressed={marcado}
          aria-label={marcado ? 'Quitar el marcador' : 'Marcar esta sección'}
          title={marcado ? 'Quitar marcador' : 'Marcar sección'}
          onclick={() => alternarMarcador(datos)}
          ><Icono nombre={marcado ? 'marcador-lleno' : 'marcador'} tam={19} /></button
        >
      </div>
    {/if}
  </div>
</div>

{#if editando}
  <div class="nota-personal">
    <div class="cab">Nota personal · {bloque.num}</div>
    <textarea
      bind:this={area}
      bind:value={borrador}
      maxlength={LARGO_NOTA}
      placeholder="Escriba aquí su nota sobre esta sección…"
      aria-label="Nota personal"
      onkeydown={teclas}
    ></textarea>
    <div class="botones">
      <span class="cuenta">{borrador.length} / {LARGO_NOTA}</span>
      <button class="boton" onclick={() => (editando = false)}>Cancelar</button>
      <button class="boton primario" onclick={guardar}>Guardar</button>
    </div>
  </div>
{:else if nota}
  <div class="nota-personal">
    <div class="cab">
      <Icono nombre="nota" tam={15} /> Nota personal
      <span class="acc">
        <button class="boton-icono" aria-label="Editar la nota" onclick={editar}><Icono nombre="editar" tam={16} /></button>
        <button class="boton-icono" aria-label="Borrar la nota" onclick={() => guardarNota(datos, '')}
          ><Icono nombre="borrar" tam={16} /></button
        >
      </span>
    </div>
    <div class="texto">{nota.texto}</div>
  </div>
{/if}
