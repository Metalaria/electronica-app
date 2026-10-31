// Device profiles of the QA harness: the owner's Xiaomi Pad 6 (Android WebView, 800×1280 CSS px portrait,
// devicePixelRatio 2.5), a phone and a desktop window. Each profile has a theme; the tablet visits every route.
import type { PlaywrightTestOptions } from '@playwright/test';

export type IdPerfil = 'tableta' | 'telefono' | 'escritorio' | 'apaisada' | 'movil360' | 'partida600' | 'partida700' | 'letra-grande' | 'sepia' | 'zoom200';

export interface Perfil {
  id: IdPerfil;
  nombre: string;
  tactil: boolean;
  /** Theme the profile runs with (prefers-color-scheme; the app's default theme is «auto»). */
  tema: 'claro' | 'oscuro';
  /** Fraction of the routes it visits (1 = all); the quick mode samples further. */
  fraccion: number;
  uso: Partial<PlaywrightTestOptions>;
  /** The reader's preferences stored before the app starts (localStorage «epa:prefs»): theme, text size. */
  prefs?: { tema?: 'auto' | 'claro' | 'sepia' | 'oscuro'; tam?: number };
}

// The UA of the app's WebView on the Xiaomi Pad 6 (model 23043RP34G, Android 14).
const UA_TABLETA =
  'Mozilla/5.0 (Linux; Android 14; 23043RP34G Build/UKQ1.230804.001; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/129.0.6668.100 Safari/537.36';
const UA_TELEFONO =
  'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.6668.100 Mobile Safari/537.36';

export const PERFILES: Perfil[] = [
  {
    id: 'tableta',
    nombre: 'Tableta 800×1280 (Xiaomi Pad 6, WebView de Android)',
    tactil: true,
    tema: 'claro',
    fraccion: 1,
    uso: {
      viewport: { width: 800, height: 1280 },
      deviceScaleFactor: 2.5,
      isMobile: true,
      hasTouch: true,
      userAgent: UA_TABLETA,
      colorScheme: 'light',
      locale: 'es-ES',
      timezoneId: 'Europe/Madrid',
    },
  },
  {
    id: 'telefono',
    nombre: 'Teléfono 412×915 (tema oscuro)',
    tactil: true,
    tema: 'oscuro',
    fraccion: 0.25,
    uso: {
      viewport: { width: 412, height: 915 },
      deviceScaleFactor: 2.6,
      isMobile: true,
      hasTouch: true,
      userAgent: UA_TELEFONO,
      colorScheme: 'dark',
      locale: 'es-ES',
      timezoneId: 'Europe/Madrid',
    },
  },
  {
    id: 'escritorio',
    nombre: 'Escritorio 1366×900',
    tactil: false,
    tema: 'claro',
    fraccion: 0.25,
    uso: {
      viewport: { width: 1366, height: 900 },
      deviceScaleFactor: 1,
      isMobile: false,
      hasTouch: false,
      colorScheme: 'light',
      locale: 'es-ES',
      timezoneId: 'Europe/Madrid',
    },
  },
];

const TABLETA = PERFILES[0]!.uso;

/**
 * Layout stress (phase 2 · 5, fase2-maquetacion.spec.ts only): the tablet turned, a small phone, the tablet's
 * split screen at two widths, the biggest text, the sepia theme and a desktop window at 200 % zoom (1366×900
 * seen as 683×450 CSS px).
 */
export const VARIANTES: Perfil[] = [
  { id: 'apaisada', nombre: 'Tableta apaisada 1280×800', tactil: true, tema: 'claro', fraccion: 1, uso: { ...TABLETA, viewport: { width: 1280, height: 800 } } },
  { id: 'movil360', nombre: 'Móvil pequeño 360×780', tactil: true, tema: 'claro', fraccion: 1, uso: { ...PERFILES[1]!.uso, viewport: { width: 360, height: 780 }, deviceScaleFactor: 3, colorScheme: 'light' } },
  { id: 'partida600', nombre: 'Pantalla partida 600×800', tactil: true, tema: 'claro', fraccion: 1, uso: { ...TABLETA, viewport: { width: 600, height: 800 } } },
  { id: 'partida700', nombre: 'Pantalla partida 700×800', tactil: true, tema: 'claro', fraccion: 1, uso: { ...TABLETA, viewport: { width: 700, height: 800 } } },
  { id: 'letra-grande', nombre: 'Tableta con la letra más grande (26 px)', tactil: true, tema: 'claro', fraccion: 1, uso: TABLETA, prefs: { tam: 26 } },
  { id: 'sepia', nombre: 'Tableta con el tema sepia', tactil: true, tema: 'claro', fraccion: 1, uso: TABLETA, prefs: { tema: 'sepia' } },
  { id: 'zoom200', nombre: 'Escritorio al 200 % (683×450)', tactil: false, tema: 'claro', fraccion: 1, uso: { ...PERFILES[2]!.uso, viewport: { width: 683, height: 450 }, deviceScaleFactor: 2 } },
];

export function perfilDe(nombreProyecto: string): Perfil {
  const p = [...PERFILES, ...VARIANTES].find((x) => x.id === nombreProyecto);
  if (!p) throw new Error(`perfil desconocido: ${nombreProyecto}`);
  return p;
}

export const MODO: 'completo' | 'rapido' = process.env.QA_MODO === 'rapido' ? 'rapido' : 'completo';
