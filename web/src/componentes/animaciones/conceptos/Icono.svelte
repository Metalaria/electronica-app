<script lang="ts">
  // Small glyph for each concept animation (gallery cards and the reader's menu), in the style of ui/Simbolo.
  import type { IconoConcepto } from './catalogo';

  let { s, tam = 120 }: { s: IconoConcepto; tam?: number } = $props();
</script>

<svg
  class="simbolo"
  viewBox="0 0 120 64"
  width={tam}
  height={(tam * 64) / 120}
  fill="none"
  stroke="currentColor"
  stroke-width="2.4"
  stroke-linecap="round"
  stroke-linejoin="round"
  aria-hidden="true"
>
  {#if s === 'campo'}
    <circle cx="34" cy="32" r="9" fill="var(--sb-p)" /><path d="M30 32h8M34 28v8" stroke-width="2" />
    <circle cx="86" cy="32" r="9" fill="var(--sb-n)" /><path d="M82 32h8" stroke-width="2" />
    <path d="M43 32h34M42 26q18-14 36 0M42 38q18 14 36 0M38 23q22-30 44 0M38 41q22 30 44 0" stroke="var(--c)" stroke-width="1.6" />
  {:else if s === 'induccion'}
    <path d="M40 14v36M46 14v36M52 14v36M58 14v36" stroke-width="2" /><path d="M36 50h26" />
    <rect x="72" y="24" width="38" height="16" rx="2" fill="var(--sb-p)" /><path d="M91 24v16" />
    <path d="M8 32h22M24 27l6 5-6 5" stroke="var(--c)" stroke-width="2" />
  {:else if s === 'kirchhoff'}
    <rect x="18" y="10" width="84" height="44" rx="2" /><rect x="52" y="4" width="16" height="12" fill="var(--sb-cuerpo)" />
    <rect x="96" y="26" width="12" height="16" fill="var(--sb-cuerpo)" /><circle cx="18" cy="32" r="8" fill="var(--superficie)" />
    <path d="M30 44q30 6 60-12" stroke="var(--c)" stroke-width="2" /><path d="M90 32l-8 0 4 7z" fill="var(--c)" stroke="none" />
  {:else if s === 'thevenin'}
    <circle cx="22" cy="32" r="10" /><path d="M22 22V10h18M22 42v12h76" /><rect x="40" y="4" width="24" height="12" fill="var(--sb-cuerpo)" />
    <path d="M64 10h34v12M98 42v12" /><rect x="92" y="22" width="12" height="20" fill="var(--sb-cuerpo)" stroke="var(--c)" />
    <path d="M18 32h8M22 28v8" stroke-width="1.8" />
  {:else if s === 'superposicion'}
    <path d="M6 44q14-30 28 0t28 0" stroke="var(--c)" stroke-width="2" opacity=".6" /><path d="M6 44q14-12 28 0t28 0" stroke-width="2" opacity=".6" />
    <path d="M66 32h10M71 27v10" stroke-width="2.6" /><path d="M84 44q8-40 16 0t16 0" stroke="var(--c)" />
  {:else if s === 'potencia-max'}
    <path d="M10 56h100M10 56V6" stroke-width="1.6" /><path d="M14 54Q30 10 50 12T110 40" stroke="var(--c)" />
    <path d="M44 56V12" stroke-dasharray="3 4" stroke-width="1.6" /><circle cx="44" cy="12" r="3.6" fill="var(--c)" stroke="none" />
  {:else if s === 'fasor'}
    <circle cx="30" cy="32" r="22" stroke-width="1.4" opacity=".5" /><path d="M30 32l16-15" stroke="var(--c)" stroke-width="3" />
    <path d="M46 17h18" stroke-dasharray="3 3" stroke-width="1.4" /><path d="M58 32q10-30 20 0t20 0t20 0" />
  {:else if s === 'impedancia'}
    <path d="M18 52h70" stroke-width="2.6" /><path d="M88 52V14" stroke="var(--c)" stroke-width="2.6" /><path d="M18 52L88 14" stroke-width="3" />
    <path d="M34 52a18 18 0 0 0-3-10" stroke-width="1.6" /><text x="40" y="47" font-size="11" fill="currentColor" stroke="none" font-weight="700">φ</text>
  {:else if s === 'transitorio'}
    <path d="M8 56h106M8 56V6" stroke-width="1.4" /><path d="M8 54C20 54 22 6 34 10s8 30 18 28 8-14 16-12 30 4 46 4" stroke="var(--c)" />
    <path d="M8 26h106" stroke-dasharray="3 4" stroke-width="1.4" />
  {:else if s === 'resonancia'}
    <path d="M8 56h106" stroke-width="1.4" /><path d="M8 54Q50 52 56 8T112 54" stroke="var(--c)" /><path d="M8 54Q50 50 58 30T112 52" opacity=".55" />
    <path d="M48 24h20" stroke-width="1.6" /><path d="M48 20v8M68 20v8" stroke-width="1.4" />
  {:else if s === 'potencia-ac'}
    <path d="M16 54h68" stroke-width="2.6" /><path d="M84 54V18" stroke="var(--c)" stroke-width="2.6" /><path d="M16 54L84 18" stroke-width="3" />
    <text x="40" y="64" font-size="10" fill="currentColor" stroke="none" font-weight="700">P</text><text x="88" y="40" font-size="10" fill="var(--c)" stroke="none" font-weight="700">Q</text>
    <text x="38" y="30" font-size="10" fill="currentColor" stroke="none" font-weight="700">S</text>
  {:else if s === 'fourier'}
    <path d="M6 46V18h18v28h18V18h18v28h18V18h18v28h16" stroke-width="1.6" opacity=".5" />
    <path d="M6 44c2-30 6-24 9-26s5 0 9 0 3 30 6 28 5 0 9 0 5-28 9-28 5 0 9 0 3 28 6 28 5 0 9 0 5-28 9-28 6 0 9 0 3 28 6 28 6 0 10 0" stroke="var(--c)" />
  {:else if s === 'fft'}
    <path d="M8 56h106" stroke-width="1.4" /><path d="M18 56V10M40 56V30M62 56V40M84 56V46M106 56V50" stroke="var(--c)" stroke-width="5" />
  {:else if s === 'muestreo'}
    <path d="M6 32q14-26 28 0t28 0t28 0t28 0" stroke-width="1.6" opacity=".55" />
    <path d="M6 32Q34 60 62 32T118 32" stroke="var(--c)" stroke-dasharray="4 3" stroke-width="1.8" />
    <circle cx="6" cy="32" r="3.4" fill="var(--c)" stroke="none" /><circle cx="25" cy="15" r="3.4" fill="var(--c)" stroke="none" /><circle cx="44" cy="47" r="3.4" fill="var(--c)" stroke="none" />
    <circle cx="62" cy="32" r="3.4" fill="var(--c)" stroke="none" /><circle cx="81" cy="15" r="3.4" fill="var(--c)" stroke="none" /><circle cx="100" cy="47" r="3.4" fill="var(--c)" stroke="none" />
  {:else if s === 'cuantizacion'}
    <path d="M10 54Q50 54 64 32T112 8" stroke-width="1.6" opacity=".55" />
    <path d="M10 54h18v-4h12v-6h10v-8h10v-8h10v-8h12v-6h14v-4h16" stroke="var(--c)" />
  {:else if s === 'modulacion'}
    <path d="M6 32c4-4 4 4 8 0s4 4 8 0" stroke-width="1.2" opacity=".5" />
    <path d="M6 32l3-10 3 20 3-24 3 28 3-30 3 32 3-30 3 28 3-24 3 20 3-14 3 8 3-4 3 6 3-10 3 18 3-24 3 30 3-32 3 32 3-30 3 26 3-20 3 12 3-6 3 4 3-6 3 10 3-14" stroke="var(--c)" stroke-width="1.6" />
  {:else if s === 'mezclador'}
    <circle cx="60" cy="32" r="14" fill="var(--sb-cuerpo)" /><path d="M50 22l20 20M70 22l-20 20" stroke-width="2" />
    <path d="M6 32h40M74 32h40M60 46v14" /><path d="M8 26q4-8 8 0t8 0t8 0" stroke="var(--c)" stroke-width="1.6" /><path d="M86 26q8-10 16 0" stroke="var(--c)" stroke-width="1.6" />
  {:else if s === 'convolucion'}
    <path d="M6 54h108" stroke-width="1.4" /><path d="M14 54V20h24v34" opacity=".55" /><path d="M48 54l0-34 30 34" stroke="var(--c)" />
    <path d="M86 54Q96 10 112 54" stroke-width="1.8" />
  {:else if s === 'realimentacion'}
    <path d="M36 12v40l34-20z" /><path d="M8 24h28M70 32h40M92 32v24H24V40h12" stroke="var(--c)" stroke-width="2" />
    <circle cx="16" cy="24" r="0" /><text x="50" y="62" font-size="11" fill="var(--c)" stroke="none" font-weight="700">β</text>
  {:else if s === 'margen'}
    <path d="M8 32h106" stroke-width="1.2" opacity=".5" /><path d="M8 32c10-30 14-30 22 0s10 22 18 0 8-12 14 0 6 6 10 0 4-3 8 0" stroke="var(--c)" />
    <path d="M8 22h106" stroke-dasharray="3 4" stroke-width="1.2" />
  {:else if s === 'bode'}
    <path d="M8 6v52h106" stroke-width="1.4" /><path d="M8 16h38l66 34" stroke="var(--c)" stroke-dasharray="5 3" />
    <path d="M8 16h26q14 0 20 6t58 30" /><circle cx="46" cy="16" r="3.4" fill="var(--c)" stroke="none" />
  {:else if s === 'oscilador'}
    <path d="M6 32c2-1 3 1 5 0s3-2 5 0 3 3 5 0 4-5 6 0 4 8 7 0 4-12 7 0 5 16 8 0 5-20 8 0 5 22 8 0 5-22 8 0 5 22 8 0 5-22 8 0 5 22 8 0 5-22 8 0" stroke="var(--c)" stroke-width="2" />
    <path d="M6 10v44" stroke-width="1.2" opacity=".5" />
  {:else if s === 'ruido'}
    <path d="M6 34l4-8 3 12 4-16 3 10 4-4 3 14 4-20 3 8 4 6 3-12 4 18 3-10 4-6 3 16 4-14 3 6 4 4 3-16 4 20 3-8 4-8 3 12 4-2 3-10 4 14 3-6 4 8 3-12 4 4" stroke="var(--c)" stroke-width="1.6" />
  {:else if s === 'histeresis'}
    <path d="M14 50h40V14h52" stroke="var(--c)" /><path d="M106 14H66v36H14" opacity=".55" /><path d="M54 30v6M66 26v6" stroke-width="1.4" />
  {:else if s === 'pid'}
    <path d="M8 56h106M8 40h106" stroke-width="1.2" opacity=".5" /><path d="M8 56c10 0 12-34 22-34s10 26 20 22 10-10 18-6 12 4 46 2" stroke="var(--c)" />
  {:else if s === 'fuente'}
    <path d="M6 18c6-14 10-14 16 0s10 14 16 0" stroke-width="1.6" opacity=".55" /><path d="M44 22l8-8M44 14l8 8" stroke-width="1.6" />
    <path d="M58 40c4-14 8-14 12-2 4-12 8-12 12 2 4-14 8-14 12 2" stroke="var(--c)" stroke-width="1.6" /><path d="M58 16h56" stroke="var(--c)" stroke-width="2.4" />
  {:else if s === 'conmutada'}
    <path d="M6 50h14V14h10v36h14V14h10v36h14V14h10v36h14" stroke-width="1.4" opacity=".55" />
    <path d="M6 40l14-18 24 18 10-18 24 18 10-18 24 18" stroke="var(--c)" stroke-width="2.2" />
  {:else if s === 'pwm'}
    <path d="M6 50h10V14h20v36h10V14h30v36h6V14h34v36" stroke-width="1.8" /><path d="M6 34c30-14 70-14 108-20" stroke="var(--c)" stroke-width="2.2" />
  {:else if s === 'niveles'}
    <rect x="14" y="6" width="34" height="18" fill="var(--sb-n)" stroke="none" /><rect x="14" y="40" width="34" height="18" fill="var(--sb-p)" stroke="none" />
    <path d="M14 6h34v52H14z" stroke-width="1.6" /><path d="M58 50h12l4-36h40" stroke="var(--c)" />
  {:else if s === 'glitch'}
    <path d="M6 48h30V18h76" stroke-width="1.8" opacity=".55" /><path d="M6 18h44v30h6V18h4v30h52" stroke="var(--c)" stroke-width="2.2" />
  {:else if s === 'metaestabilidad'}
    <path d="M6 54h24v-4" stroke-width="1.4" /><path d="M30 32c20 0 30 0 40-22h44" stroke="var(--c)" /><path d="M30 32c26 0 34 0 44 22h40" stroke="var(--c)" opacity=".55" />
    <path d="M30 32c24 0 30 0 34 6" stroke-width="1.6" />
  {:else if s === 'reflexion'}
    <path d="M6 40h96" stroke-width="2" /><path d="M6 46h96" stroke-width="2" /><rect x="102" y="34" width="12" height="18" fill="var(--sb-cuerpo)" />
    <path d="M16 36l8-20h12l8 20" stroke="var(--c)" /><path d="M86 36l-6-12h-8l-6 12" stroke="var(--c)" opacity=".55" /><path d="M52 14h20M64 9l8 5-8 5" stroke-width="1.6" />
  {:else if s === 'estacionaria'}
    <path d="M6 32q14-26 28 0t28 0t28 0t28 0" stroke="var(--c)" /><path d="M6 32q14 26 28 0t28 0t28 0t28 0" stroke="var(--c)" opacity=".5" />
    <path d="M6 32h112" stroke-width="1.2" opacity=".5" />
  {:else if s === 'smith'}
    <circle cx="60" cy="32" r="28" /><path d="M32 32h56" stroke-width="1.4" /><circle cx="74" cy="32" r="14" stroke-width="1.4" />
    <path d="M88 32a28 28 0 0 0-28-28" stroke-width="1.4" opacity=".6" /><path d="M88 32a28 28 0 0 1-28 28" stroke-width="1.4" opacity=".6" />
    <path d="M60 32L74 18" stroke="var(--c)" stroke-width="2.6" /><circle cx="74" cy="18" r="3.4" fill="var(--c)" stroke="none" />
  {:else if s === 'antena'}
    <path d="M60 6v22M60 36v22" stroke-width="3.4" /><path d="M56 30h8M56 34h8" stroke-width="1.6" />
    <path d="M44 22a20 20 0 0 0 0 20M34 14a32 32 0 0 0 0 36M76 22a20 20 0 0 1 0 20M86 14a32 32 0 0 1 0 36" stroke="var(--c)" stroke-width="1.8" />
  {:else if s === 'pelicular'}
    <circle cx="60" cy="32" r="26" fill="var(--sb-cuerpo)" /><circle cx="60" cy="32" r="26" stroke="var(--c)" stroke-width="7" opacity=".7" />
    <circle cx="60" cy="32" r="18" stroke-width="1.2" stroke-dasharray="3 3" />
  {/if}
</svg>

<style>
  .simbolo {
    --c: var(--acento);
    --sb-cuerpo: color-mix(in srgb, var(--c) 12%, var(--superficie));
    --sb-p: color-mix(in srgb, #d63a2f 18%, var(--superficie));
    --sb-n: color-mix(in srgb, #2468d6 18%, var(--superficie));
    display: block;
    overflow: visible;
  }
</style>
