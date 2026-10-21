<script lang="ts">
  // Small schematic-style glyph for each animation (gallery cards and the reader's menu).
  import type { Simbolo } from '../catalogo';

  let { s, tam = 120 }: { s: Simbolo; tam?: number } = $props();
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
  {#if s === 'resistencia' || s === 'colores'}
    <path d="M6 32h22M92 32h22" />
    <rect x="28" y="20" width="64" height="24" rx="10" fill="var(--sb-cuerpo)" />
    {#if s === 'colores'}
      <rect x="38" y="20" width="6" height="24" fill="#f5d119" stroke="none" />
      <rect x="49" y="20" width="6" height="24" fill="#8441b5" stroke="none" />
      <rect x="60" y="20" width="6" height="24" fill="#d0281f" stroke="none" />
      <rect x="77" y="20" width="5" height="24" fill="#c9a227" stroke="none" />
    {:else}
      <path d="M40 22v20M50 22v20M60 22v20M78 22v20" stroke="var(--c)" stroke-width="5" />
    {/if}
    <rect x="28" y="20" width="64" height="24" rx="10" />
  {:else if s === 'ohm'}
    <path d="M6 22h108M6 42h108" stroke-width="1.6" opacity=".55" />
    <circle cx="26" cy="32" r="3.4" fill="var(--c)" stroke="none" /><circle cx="48" cy="28" r="3.4" fill="var(--c)" stroke="none" />
    <circle cx="70" cy="35" r="3.4" fill="var(--c)" stroke="none" /><circle cx="92" cy="30" r="3.4" fill="var(--c)" stroke="none" />
    <path d="M30 51h60" /><path d="M30 51l7-4M30 51l7 4" />
    <path d="M36 14h4M58 14h4M80 14h4" stroke-width="5" opacity=".35" />
  {:else if s === 'calor'}
    <path d="M6 40h28M86 40h28" /><rect x="34" y="31" width="52" height="18" rx="2" fill="var(--sb-calor)" />
    <path d="M46 24q-5-5 0-10t0-10M60 24q-5-5 0-10t0-10M74 24q-5-5 0-10t0-10" stroke="var(--c)" stroke-width="2" />
  {:else if s === 'potenciometro'}
    <path d="M6 40h30M84 40h30" /><rect x="36" y="31" width="48" height="18" rx="2" />
    <path d="M60 8v19" /><path d="M60 29l-5-8h10z" fill="currentColor" />
    <path d="M38 58l44-36" stroke="var(--c)" stroke-width="2" /><path d="M82 22l-8 1 3 5z" fill="var(--c)" stroke="var(--c)" stroke-width="1" />
  {:else if s === 'ntc'}
    <path d="M6 32h30M84 32h30" /><rect x="36" y="23" width="48" height="18" rx="2" />
    <path d="M32 52l12-8h40l10-30" stroke="var(--c)" stroke-width="2" />
    <text x="96" y="58" font-size="12" fill="var(--c)" stroke="none" font-weight="700">−t°</text>
  {:else if s === 'condensador' || s === 'super'}
    <path d="M6 32h44M70 32h44" /><path d="M50 12v40M70 12v40" stroke-width="4" />
    <path d="M42 18h-6M39 15v6" stroke="var(--c)" stroke-width="2" /><path d="M78 18h6" stroke="var(--c)" stroke-width="2" />
    {#if s === 'super'}
      <circle cx="56" cy="20" r="2.6" fill="var(--c)" stroke="none" /><circle cx="56" cy="32" r="2.6" fill="var(--c)" stroke="none" /><circle cx="56" cy="44" r="2.6" fill="var(--c)" stroke="none" />
      <circle cx="64" cy="26" r="2.6" stroke="var(--c)" stroke-width="1.6" /><circle cx="64" cy="38" r="2.6" stroke="var(--c)" stroke-width="1.6" />
    {:else}
      <path d="M53 22h14M53 32h14M53 42h14" stroke="var(--c)" stroke-width="1.6" />
    {/if}
  {:else if s === 'mlcc'}
    <rect x="22" y="14" width="76" height="36" rx="3" fill="var(--sb-cuerpo)" />
    <path d="M22 14v36M98 14v36" stroke-width="8" stroke="var(--sb-metal)" />
    <path d="M24 21h62M34 28h62M24 35h62M34 42h62" stroke="var(--c)" stroke-width="2" />
  {:else if s === 'electrolitico'}
    <rect x="34" y="8" width="52" height="46" rx="6" fill="var(--sb-cuerpo)" />
    <rect x="72" y="8" width="10" height="46" fill="var(--c)" stroke="none" opacity=".75" />
    <path d="M74 20h6M74 30h6M74 40h6" stroke="#fff" stroke-width="2" />
    <rect x="34" y="8" width="52" height="46" rx="6" /><path d="M48 54v8M72 54v8" />
  {:else if s === 'pelicula'}
    <path d="M60 32m-4 0a4 4 0 1 1 8 0a8 8 0 1 1 -16 0a12 12 0 1 1 24 0a16 16 0 1 1 -32 0a20 20 0 1 1 40 0" stroke="var(--c)" stroke-width="2" />
    <path d="M6 32h14M100 32h14" />
  {:else if s === 'rc'}
    <path d="M10 54h100M14 54V8" stroke-width="1.6" opacity=".6" />
    <path d="M14 54C30 22 50 14 108 12" stroke="var(--c)" stroke-width="2.8" />
    <path d="M36 54V27" stroke-dasharray="3 3" stroke-width="1.4" />
  {:else if s === 'alterna'}
    <path d="M8 32h104" stroke-width="1.4" opacity=".55" />
    <path d="M8 32c8-30 22-30 30 0s22 30 30 0 22-30 30 0" />
    <path d="M8 6c8 0 14 22 22 26s22 30 30 0 22-30 30 0 12 26 20 26" stroke="var(--c)" stroke-width="2" transform="translate(-8 0)" />
  {:else if s === 'esr'}
    <path d="M10 54h100M14 54V8" stroke-width="1.6" opacity=".6" />
    <path d="M18 10L60 48L104 10" stroke="var(--c)" stroke-width="2.8" />
    <circle cx="60" cy="48" r="3.4" fill="var(--c)" stroke="none" />
  {:else if s === 'bobina' || s === 'nucleo'}
    {#if s === 'nucleo'}
      <circle cx="60" cy="32" r="24" stroke="var(--sb-metal)" stroke-width="10" />
      <path d="M44 14l6 8M52 10l3 9M62 9l-1 9M72 12l-4 8" stroke="var(--c)" stroke-width="2.2" />
    {:else}
      <path d="M6 40h18M96 40h18" />
      <path d="M24 40a9 9 0 0 1 18 0a9 9 0 0 1 18 0a9 9 0 0 1 18 0a9 9 0 0 1 18 0" />
      <path d="M30 18c10-12 50-12 60 0" stroke="var(--c)" stroke-width="2" /><path d="M90 18l-7 0 4-6" stroke="var(--c)" stroke-width="2" />
    {/if}
  {:else if s === 'transformador'}
    <path d="M30 8a6 6 0 0 1 0 12a6 6 0 0 1 0 12a6 6 0 0 1 0 12a6 6 0 0 1 0 12" />
    <path d="M90 8a6 6 0 0 0 0 12a6 6 0 0 0 0 12a6 6 0 0 0 0 12a6 6 0 0 0 0 12" />
    <path d="M56 6v52M64 6v52" stroke="var(--c)" stroke-width="2.6" /><path d="M6 8h24M6 56h24M90 8h24M90 56h24" />
  {:else if s === 'rele'}
    <rect x="10" y="20" width="30" height="24" rx="2" /><path d="M10 26l30 12" />
    <path d="M25 8v12M25 44v12" /><path d="M48 32h8" stroke-dasharray="3 3" stroke="var(--c)" />
    <path d="M64 46l40-14" stroke="var(--c)" stroke-width="2.8" /><circle cx="64" cy="46" r="3" /><circle cx="106" cy="46" r="3" /><path d="M64 49v10M106 49v10" />
  {:else if s === 'union'}
    <rect x="12" y="12" width="96" height="40" rx="3" />
    <rect x="12" y="12" width="44" height="40" fill="var(--sb-p)" stroke="none" /><rect x="64" y="12" width="44" height="40" fill="var(--sb-n)" stroke="none" />
    <rect x="12" y="12" width="96" height="40" rx="3" />
    <circle cx="26" cy="24" r="3.5" stroke="#d63a2f" stroke-width="1.8" /><circle cx="38" cy="40" r="3.5" stroke="#d63a2f" stroke-width="1.8" />
    <circle cx="82" cy="24" r="3.5" fill="#2468d6" stroke="none" /><circle cx="96" cy="40" r="3.5" fill="#2468d6" stroke="none" />
    <path d="M70 32H50" stroke="var(--c)" stroke-width="2" /><path d="M50 32l6-4v8z" fill="var(--c)" stroke="none" />
  {:else if s === 'diodo' || s === 'zener' || s === 'led' || s === 'fotodiodo' || s === 'schottky'}
    <path d="M6 36h40M74 36h40" /><path d="M46 22v28l28-14z" fill={s === 'led' ? 'var(--c)' : 'none'} fill-opacity=".25" />
    {#if s === 'zener'}<path d="M68 20l6 2v28l6 2" />{:else if s === 'schottky'}<path d="M80 18h-6v36h-6" /><path d="M80 18v5M68 54v-5" />{:else}<path d="M74 22v28" />{/if}
    {#if s === 'led'}<path d="M64 14l10-10M74 18l10-10" stroke="var(--c)" stroke-width="2" /><path d="M74 4h-6l6 6zM84 8h-6l6 6z" fill="var(--c)" stroke="var(--c)" stroke-width="1" />{/if}
    {#if s === 'fotodiodo'}<path d="M92 6L76 18M100 14L84 26" stroke="var(--c)" stroke-width="2" /><path d="M76 18l2-6 4 4zM84 26l2-6 4 4z" fill="var(--c)" stroke="var(--c)" stroke-width="1" />{/if}
  {:else if s === 'puente'}
    <path d="M60 6L88 32L60 58L32 32Z" stroke-width="1.6" opacity=".55" />
    <path d="M40 14l8 2 -2 8zM74 14l8 2 -2 8zM40 50l8-2 -2-8zM74 50l8-2 -2-8z" fill="var(--c)" stroke="var(--c)" stroke-width="1.4" />
    <path d="M6 32h26M88 32h26" />
  {:else if s === 'npn'}
    <circle cx="66" cy="32" r="24" stroke-width="1.8" /><path d="M16 32h34M50 18v28" /><path d="M50 26l20-14v-8M50 38l20 14v8" />
    <path d="M70 52l-9-1 4-7z" fill="var(--c)" stroke="var(--c)" stroke-width="1" />
  {:else if s === 'curvas' || s === 'mosfet-curvas'}
    <path d="M10 56h100M14 56V6" stroke-width="1.6" opacity=".6" />
    {#if s === 'curvas'}
      <path d="M14 56q6-12 14-12h80M14 56q6-20 16-22h78M14 56q8-30 18-32h76" />
    {:else}
      <path d="M14 56q12-14 24-14h70M14 56q18-28 36-28h58M14 56q22-40 48-42h46" />
    {/if}
    <path d="M24 10l82 44" stroke="var(--c)" stroke-width="2" /><circle cx="62" cy="30.5" r="4" fill="var(--c)" stroke="none" />
  {:else if s === 'nmos' || s === 'cmos'}
    {#if s === 'cmos'}
      <path d="M30 10l40 22-40 22z" /><circle cx="75" cy="32" r="5" stroke="var(--c)" /><path d="M6 32h24M80 32h34" />
    {:else}
      <path d="M14 46h28M42 16v30" /><path d="M50 12v8M50 28v8M50 44v8" stroke-width="3.2" />
      <path d="M50 16h28V4M50 48h28v12M50 32h28v28" /><path d="M58 32l8-4v8z" fill="var(--c)" stroke="var(--c)" stroke-width="1" />
    {/if}
  {:else if s === 'puerta'}
    <path d="M10 56h100M14 56V6" stroke-width="1.6" opacity=".6" />
    <path d="M14 56L40 30H72L106 8" stroke="var(--c)" stroke-width="2.8" />
  {:else if s === 'jfet'}
    <path d="M14 44h30" /><path d="M44 12v40" stroke-width="3" /><path d="M44 18h30V6M44 46h30v12" />
    <path d="M44 44l-8-4v8z" fill="var(--c)" stroke="var(--c)" stroke-width="1" transform="rotate(180 40 44)" />
  {:else if s === 'scr'}
    <path d="M6 30h40M74 30h40" /><path d="M46 16v28l28-14z" /><path d="M74 16v28" />
    <path d="M70 34l12 22h8" stroke="var(--c)" stroke-width="2.4" />
  {:else if s === 'fusible'}
    <path d="M6 32h24M90 32h24" /><rect x="30" y="22" width="60" height="20" rx="3" />
    <path d="M30 32h22M62 32h28" stroke="var(--c)" stroke-width="2.4" /><path d="M54 28l6 8" stroke="var(--c)" />
  {:else if s === 'varistor'}
    <path d="M6 32h30M84 32h30" /><rect x="36" y="23" width="48" height="18" rx="2" />
    <path d="M32 54h10l36-44h10" stroke="var(--c)" stroke-width="2" /><text x="88" y="60" font-size="11" fill="var(--c)" stroke="none" font-weight="700">U</text>
  {:else if s === 'opto'}
    <rect x="8" y="6" width="104" height="52" rx="6" stroke-width="1.6" stroke-dasharray="4 3" />
    <path d="M22 18v28M14 24h16l-8 14z" /><path d="M14 38h16" />
    <path d="M58 22v20" stroke="var(--c)" /><path d="M62 28l6-3M62 36l6 3" stroke="var(--c)" stroke-width="1.6" />
    <path d="M36 28l12 0M36 36l12 0" stroke="var(--c)" stroke-width="1.6" /><path d="M48 28l-4-2v4zM48 36l-4-2v4z" fill="var(--c)" stroke="var(--c)" stroke-width="1" />
    <path d="M78 16v32" stroke-width="3" /><path d="M78 26l16-10v-6M78 38l16 10v6" />
  {:else if s === 'cristal'}
    <path d="M6 32h34M80 32h34" /><path d="M40 14v36M80 14v36" stroke-width="3" />
    <rect x="48" y="18" width="24" height="28" rx="1" fill="var(--sb-cuerpo)" />
    <path d="M44 10c2-4 4-4 6 0M70 10c2-4 4-4 6 0" stroke="var(--c)" stroke-width="2" />
  {:else if s === 'hall'}
    <rect x="22" y="18" width="76" height="28" rx="3" fill="var(--sb-cuerpo)" />
    <path d="M30 6v10M50 6v10M70 6v10M90 6v10" stroke="var(--c)" stroke-width="2" /><path d="M30 16l-3-5h6zM50 16l-3-5h6zM70 16l-3-5h6zM90 16l-3-5h6z" fill="var(--c)" stroke="var(--c)" stroke-width="1" />
    <path d="M6 32h16M98 32h16M60 46v14" />
  {:else if s === 'opamp'}
    <path d="M30 6v52l54-26z" /><path d="M8 20h22M8 44h22M84 32h28" /><path d="M36 20h6M36 44h6M39 41v6" stroke-width="2" />
    <path d="M98 32V58H20V44" stroke="var(--c)" stroke-width="2" />
  {/if}
</svg>

<style>
  .simbolo {
    --c: var(--acento);
    --sb-cuerpo: color-mix(in srgb, var(--c) 12%, var(--superficie));
    --sb-calor: color-mix(in srgb, #e8590c 30%, var(--superficie));
    --sb-metal: color-mix(in srgb, var(--tinta-suave) 45%, var(--superficie));
    --sb-p: color-mix(in srgb, #d63a2f 16%, var(--superficie));
    --sb-n: color-mix(in srgb, #2468d6 16%, var(--superficie));
    display: block;
    overflow: visible;
  }
</style>
