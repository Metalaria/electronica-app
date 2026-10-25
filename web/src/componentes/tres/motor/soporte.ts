// WebGL2 detection without importing three.js (the page decides between the 3D chunk and the 2D view).

let soporte: boolean | null = null;

/** WebGL2 available (checked once; tests force it off with window.__epaSinWebGL = true). */
export function soporteWebGL2(): boolean {
  if ((globalThis as { __epaSinWebGL?: boolean }).__epaSinWebGL) return false;
  if (soporte != null) return soporte;
  try {
    const c = document.createElement('canvas');
    const g = c.getContext('webgl2');
    soporte = !!g;
    g?.getExtension('WEBGL_lose_context')?.loseContext();
  } catch {
    soporte = false;
  }
  return soporte;
}
