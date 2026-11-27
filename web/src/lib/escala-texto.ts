// 2.2: the system's text size (Android: Settings → Display → Font size, which the WebView applies as its text zoom;
// Chrome on Android: its accessibility text scaling). The page's text grows with it on its own — the app's px sizes
// are scaled by the browser — and the layout reflows (min-heights, wrapping). A few labels must not grow as much (the
// bottom bar's and the rail's, «at most 1.3×», the owner's call): they opt out of the browser's scaling
// (text-size-adjust: none) and size themselves with --escala-texto, the factor measured here:
//   font-size: calc(12px * min(var(--escala-texto, 1), 1.3));
// (and the attribute data-letra-tope, which the tests' simulation of the system's size leaves alone)
// The factor is the width of the same text with and without the browser's scaling (1 on a computer, where the
// browser's zoom changes the viewport instead and the window size classes take care of it).

let sonda: HTMLDivElement | null = null;

function crearSonda(): HTMLDivElement {
  const d = document.createElement('div');
  d.setAttribute('aria-hidden', 'true');
  d.dataset.escalaTexto = '';
  d.style.cssText = 'position:absolute;left:-9999px;top:0;visibility:hidden;pointer-events:none;contain:layout;white-space:nowrap';
  const libre = document.createElement('span');
  libre.style.cssText = 'font:400 100px/1 sans-serif;text-size-adjust:auto;-webkit-text-size-adjust:auto';
  const fija = document.createElement('span');
  fija.style.cssText = 'font:400 100px/1 sans-serif;text-size-adjust:none;-webkit-text-size-adjust:none';
  libre.textContent = fija.textContent = 'MMMMMMMMMM';
  d.append(libre, document.createElement('br'), fija);
  document.body.append(d);
  return d;
}

/** Measures the factor now and writes --escala-texto on the root (1 when it cannot tell). */
export function medirEscalaTexto(): number {
  if (typeof document === 'undefined' || !document.body) return 1;
  sonda ??= crearSonda();
  const [libre, , fija] = [...sonda.childNodes] as HTMLElement[];
  const a = libre!.getBoundingClientRect().width;
  const b = fija!.getBoundingClientRect().width;
  let f = a > 0 && b > 0 ? a / b : 1;
  if (!Number.isFinite(f) || f < 0.5 || f > 4) f = 1;
  f = Math.round(f * 100) / 100;
  document.documentElement.style.setProperty('--escala-texto', String(f));
  return f;
}

/** Measures at start and again when the app comes back to the screen (the system's size may have changed). */
export function vigilarEscalaTexto(): () => void {
  medirEscalaTexto();
  const otra = () => {
    if (document.visibilityState === 'visible') medirEscalaTexto();
  };
  document.addEventListener('visibilitychange', otra);
  window.addEventListener('resize', otra);
  return () => {
    document.removeEventListener('visibilitychange', otra);
    window.removeEventListener('resize', otra);
  };
}
