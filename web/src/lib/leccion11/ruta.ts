// 1.1 lessons: which lesson a route opens. The route is the 1.0 one, #/leccion/<parte>/<label>[/<rest>], so the course
// path, the book's «Estudiar por pasos» link, «Siguiente sección» and «Continuar» open the new lesson whenever the
// section has one; the 1.0 lesson (the book's text step by step, with its practice and Repaso questions) stays at
// #/leccion/<parte>/<label>/clasica[/<rest>], and its own screens (practica-N, pregunta-N, fin) open it too. Pure.

export type ModoLeccion = 'nueva' | 'clasica';

/** The part of the anchor after the section label («3», «clasica/5», «practica-2», «fin», ''). */
export function restoDeAncla(ancla: string): string {
  return ancla.split('/').slice(1).join('/');
}

export function elegirModo(resto: string, hayNueva: boolean): ModoLeccion {
  if (!hayNueva) return 'clasica';
  if (resto === 'clasica' || resto.startsWith('clasica/')) return 'clasica';
  if (/^(practica-\d+|pregunta-\d+|fin)$/.test(resto)) return 'clasica';
  return 'nueva';
}

/** The anchor the 1.0 lesson reads: «label/rest» without the «clasica» segment. */
export function anclaClasica(ancla: string): string {
  const [label, ...resto] = ancla.split('/');
  const r = resto[0] === 'clasica' ? resto.slice(1) : resto;
  return [label, ...r].join('/');
}

/** Card of the new lesson in the route (0-based; «/3» is the third card), 0 without one. */
export function tarjetaDeRuta(resto: string, total: number): number {
  const n = /^\d+$/.test(resto) ? Number(resto) : 1;
  return Math.max(0, Math.min(total - 1, n - 1));
}

/** Route of a card of the new lesson (the first card has no number, as the 1.0 lesson's first step). */
export function rutaTarjeta(parte: string, seccion: string, k: number): string {
  const base = `#/leccion/${parte}/${encodeURIComponent(seccion)}`;
  return k > 0 ? `${base}/${k + 1}` : base;
}

/** Route of the 1.0 lesson of a section that has a new one. */
export function rutaClasica(parte: string, seccion: string): string {
  return `#/leccion/${parte}/${encodeURIComponent(seccion)}/clasica`;
}
