<script lang="ts" module>
  import type { FamiliaLogro, IconoLogro } from '../../lib/aprendizaje/logros';

  // Glyphs drawn for the badges (24 × 24, stroked in white; `relleno` ones are filled).
  const GLIFOS: Record<IconoLogro, { d: string; relleno?: boolean }> = {
    libro: { d: 'M12 6.5C10.5 5.3 8.3 4.8 4.5 5v12.5c3.8-.2 6 .3 7.5 1.5 1.5-1.2 3.7-1.7 7.5-1.5V5c-3.8-.2-6 .3-7.5 1.5zM12 6.5V19' },
    libros: { d: 'M4.5 5h3.5v14H4.5zM10 5h3.5v14H10zM15.6 5.7l3-.8 3 12.4-3 .8z' },
    birrete: { d: 'M2.5 9.5L12 5l9.5 4.5L12 14zM6.5 11.5V16c3 2 8 2 11 0v-4.5M21.5 9.5V15' },
    check: { d: 'M5 12.5l4.5 4.5L19 7.5' },
    diana: { d: 'M12 3a9 9 0 1 0 0 18 9 9 0 1 0 0-18zM12 7.5a4.5 4.5 0 1 0 0 9 4.5 4.5 0 1 0 0-9zM12 11.3a.7.7 0 1 0 0 1.4.7.7 0 1 0 0-1.4z' },
    rayo: { d: 'M13.5 2.5L5 13.5h6.5l-1 8 8.5-11h-6.5z' },
    llama: {
      d: 'M12 2.5c.6 3.2 4.8 5.6 4.8 10.4A4.8 4.8 0 0 1 12 17.7a4.8 4.8 0 0 1-4.8-4.8c0-2.2 1.2-3.6 2.3-4.8.3 1.6 1.1 2.6 2.1 3 0-2.9.1-5.8.4-8.6z',
      relleno: true,
    },
    calendario: { d: 'M4.5 6.5h15v13h-15zM4.5 10.5h15M8.5 4v4M15.5 4v4M8.5 14.8l2 2 4-4' },
    lapiz: { d: 'M4 20l1-4.5L15.5 5a2 2 0 0 1 3 0l.5.5a2 2 0 0 1 0 3L8.5 19zM13.5 7l3.5 3.5' },
    protoboard: { d: 'M3.5 6.5h17v11h-17zM7 10h.01M10.3 10h.01M13.7 10h.01M17 10h.01M7 14h.01M10.3 14h.01M13.7 14h.01M17 14h.01' },
    onda: { d: 'M2.5 12c1.6-5 3.2-5 4.75 0s3.15 5 4.75 0 3.2-5 4.75 0 3.15 5 4.75 0' },
    trofeo: { d: 'M8 4.5h8v5a4 4 0 0 1-8 0zM8 6.5H5a3 3 0 0 0 3 4M16 6.5h3a3 3 0 0 1-3 4M12 13.5V17M8.5 20.5h7M10 17h4v3.5h-4z' },
    brujula: { d: 'M12 3a9 9 0 1 0 0 18 9 9 0 1 0 0-18zM15.5 8.5l-2 5-5 2 2-5z' },
    estrella: { d: 'M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z' },
    sol: { d: 'M12 8a4 4 0 1 0 0 8 4 4 0 1 0 0-8zM12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4' },
    luna: { d: 'M19 14.5A7.5 7.5 0 0 1 9.5 5a7.5 7.5 0 1 0 9.5 9.5z' },
    gafas: { d: 'M3 14a3.5 3.5 0 1 0 7 0 3.5 3.5 0 1 0-7 0zM14 14a3.5 3.5 0 1 0 7 0 3.5 3.5 0 1 0-7 0zM10 13.5c1.3-1 2.7-1 4 0M3.4 12.5L5.5 6.5M20.6 12.5L18.5 6.5' },
    mapa: { d: 'M3.5 6.5l5.5-2 6 2 5.5-2v13l-5.5 2-6-2-5.5 2zM9 4.5v13M15 6.5v13' },
    medalla: { d: 'M8 3h3l1 4.5M16 3h-3l-1 4.5M12 9a5.5 5.5 0 1 0 0 11 5.5 5.5 0 1 0 0-11zM12 11.8l1 2h2.1l-1.7 1.3.6 2.1-2-1.3-2 1.3.6-2.1-1.7-1.3H11z' },
  };

  /** Badge colours by family: white glyphs on them reach ≥ 3:1 (graphics). */
  export const COLOR_FAMILIA: Record<FamiliaLogro, string> = {
    lecciones: '#2e6ea6',
    preguntas: '#1e7a45',
    ejercicios: '#7d3c98',
    taller: '#0f6f5c',
    constancia: '#b35a09',
    cursos: '#1a3a5c',
    nivel: '#8a6d0b',
  };
</script>

<script lang="ts">
  // An achievement's badge (0.11): a coloured disc with a white glyph when unlocked; a grey disc with the glyph
  // in the faint ink and a small padlock when locked. Decorative: the name goes next to it as text.
  import { LOGRO } from '../../lib/aprendizaje/logros';

  let { logro, desbloqueado = false, tam = 56 }: { logro: string; desbloqueado?: boolean; tam?: number } = $props();

  const l = $derived(LOGRO.get(logro));
  const g = $derived(GLIFOS[l?.icono ?? 'medalla']);
  const color = $derived(COLOR_FAMILIA[l?.familia ?? 'nivel']);
</script>

<svg class="medalla" class:bloqueada={!desbloqueado} width={tam} height={tam} viewBox="0 0 64 64" aria-hidden="true" data-medalla={logro}>
  <circle cx="32" cy="32" r="29" fill={desbloqueado ? color : 'var(--superficie-2)'} stroke={desbloqueado ? 'none' : 'var(--linea)'} stroke-width="2" />
  <circle cx="32" cy="32" r="24" fill="none" stroke={desbloqueado ? 'rgba(255,255,255,0.35)' : 'var(--linea)'} stroke-width="1.5" stroke-dasharray={desbloqueado ? 'none' : '3 3'} />
  <g transform="translate(18 18) scale(1.1667)">
    <path
      d={g.d}
      fill={g.relleno ? (desbloqueado ? '#fff' : 'var(--tinta-tenue)') : 'none'}
      stroke={desbloqueado ? '#fff' : 'var(--tinta-tenue)'}
      stroke-width={g.relleno ? 0 : 1.9}
      stroke-linecap="round"
      stroke-linejoin="round"
    />
  </g>
  {#if !desbloqueado}
    <g transform="translate(43 42)">
      <circle cx="8" cy="8" r="9.5" fill="var(--superficie)" stroke="var(--linea)" stroke-width="1.5" />
      <path d="M4.8 7.5h6.4v5.2H4.8zM6 7.5V5.8a2 2 0 0 1 4 0v1.7" fill="none" stroke="var(--tinta-tenue)" stroke-width="1.5" stroke-linejoin="round" />
    </g>
  {/if}
</svg>

<style>
  .medalla {
    flex: none;
    display: block;
  }
</style>
