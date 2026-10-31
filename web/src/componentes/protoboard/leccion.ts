// «La protoboard por dentro» (0.11): the mini-lesson before the first guided circuit. One idea per screen,
// each with something to tap — the strips of five, the central channel, the rails — and quick questions whose
// answers come from the board's own connectivity model (placa.ts `agujero`: two holes are joined when they
// share a conductor), never written by hand. Plain TypeScript.

import { agujero, agujerosDe, nombreAgujero, SIGNO_RIEL, type ConfigPlaca, type Pt } from './placa.ts';

export const CLAVE_LECCION = 'epa:protoboard-leccion';

export type PantallaLeccion =
  | { tipo: 'explorar'; id: string; titulo: string; texto: string; pide?: 'riel' | 'canal' }
  | { tipo: 'pregunta'; id: string; a: Pt; b: Pt; titulo: string }
  | { tipo: 'tocar'; id: string; a: Pt; titulo: string }
  | { tipo: 'final'; id: string; titulo: string; texto: string };

/** The column of a hole as the book names it: «10a». */
export const nombre = (cfg: ConfigPlaca, q: Pt): string => nombreAgujero(cfg, q[0], q[1]);

/** Two holes joined inside the board (the same strip or the same rail). */
export function unidos(cfg: ConfigPlaca, a: Pt, b: Pt): boolean {
  const x = agujero(cfg, a[0], a[1]);
  const y = agujero(cfg, b[0], b[1]);
  return !!x && !!y && x.nodo === y.nodo;
}

/** Every hole joined to this one (itself included). */
export function grupoDe(cfg: ConfigPlaca, q: Pt): Pt[] {
  const a = agujero(cfg, q[0], q[1]);
  return a ? agujerosDe(cfg, a.nodo) : [];
}

/** The nearest hole to a world point (a finger rarely lands on the exact centre). */
export function huecoCercano(cfg: ConfigPlaca, w: Pt): Pt | null {
  let mejor: { q: Pt; d: number } | null = null;
  for (let dx = -1; dx <= 1; dx++)
    for (let dy = -1; dy <= 1; dy++) {
      const q: Pt = [Math.round(w[0]) + dx, Math.round(w[1]) + dy];
      if (!agujero(cfg, q[0], q[1])) continue;
      const d = Math.hypot(q[0] - w[0], q[1] - w[1]);
      if (d < 1.1 && (!mejor || d < mejor.d)) mejor = { q, d };
    }
  return mejor?.q ?? null;
}

/** What lit up when a hole was tapped, in one sentence. */
export function explicarGrupo(cfg: ConfigPlaca, q: Pt): string {
  const a = agujero(cfg, q[0], q[1]);
  if (!a) return '';
  if (a.tipo === 'riel') {
    const f = Number(a.fila);
    const signo = SIGNO_RIEL[f]!;
    return `Se ha encendido todo el carril ${signo} (${signo === '+' ? 'rojo' : 'azul'}) de ${f < 2 ? 'arriba' : 'abajo'}: recorre la placa a lo largo, de un extremo al otro.`;
  }
  const filas = a.fila <= 'e' ? 'a–e' : 'f–j';
  return `Se han encendido los 5 agujeros de la columna ${a.x}, filas ${filas}: por dentro los une una pinza de metal. Es una tira.`;
}

/** The screens of the lesson on a board of this size (questions on real holes of it). */
export function pantallasLeccion(cfg: ConfigPlaca): PantallaLeccion[] {
  const c = Math.min(10, cfg.columnas - 1);
  const d = Math.min(23, cfg.columnas - 2);
  const n = (q: Pt) => nombre(cfg, q);
  const a: Pt = [c, 3];
  return [
    { tipo: 'explorar', id: 'tiras', titulo: 'Toque cualquier agujero de la placa.', texto: 'Debajo de los agujeros hay pinzas de metal: lo que se enciende está unido por dentro.' },
    {
      tipo: 'explorar',
      id: 'canal',
      pide: 'canal',
      titulo: 'Ahora toque un agujero de la fila e y luego el de la fila f de la misma columna.',
      texto: 'El canal central separa las dos mitades: cada columna tiene dos tiras, a–e arriba y f–j abajo. Por eso un chip DIP va a caballo del canal: así cada patilla tiene su propia tira.',
    },
    {
      tipo: 'explorar',
      id: 'carriles',
      pide: 'riel',
      titulo: 'Toque un agujero de la fila marcada con + (roja).',
      texto: 'Los carriles van a lo largo: el rojo (+) y el azul (−) llevan la alimentación a cualquier columna. Basta un cable corto desde una tira hasta el carril.',
    },
    ...([[c, 7], [c, 10], [c + 1, 3]] as Pt[]).map((b, i): PantallaLeccion => ({ tipo: 'pregunta', id: `p${i + 1}`, a, b, titulo: `¿Están unidos los agujeros ${n(a)} y ${n(b)}?` })),
    { tipo: 'tocar', id: 'p4', a: [d, 5], titulo: `Toque un agujero unido a ${n([d, 5])} (que no sea ese).` },
    {
      tipo: 'final',
      id: 'fin',
      titulo: 'Ya sabe cómo es por dentro',
      texto: 'Cada columna tiene dos tiras de cinco agujeros, una a cada lado del canal; los carriles + y − recorren la placa a lo largo. Dos patas en la misma tira quedan unidas; para unir dos tiras hace falta un cable.',
    },
  ];
}

/** The answer to a question, explained (from the model). */
export function respuesta(cfg: ConfigPlaca, a: Pt, b: Pt): { si: boolean; texto: string } {
  const si = unidos(cfg, a, b);
  const x = agujero(cfg, a[0], a[1])!;
  const y = agujero(cfg, b[0], b[1])!;
  let texto: string;
  if (si) texto = `Sí: ${nombre(cfg, a)} y ${nombre(cfg, b)} están en la misma tira de cinco (columna ${x.x}).`;
  else if (x.x === y.x) texto = `No: están en la misma columna, pero el canal central las separa en dos tiras (a–e y f–j).`;
  else texto = `No: cada columna es una tira distinta; ${nombre(cfg, a)} y ${nombre(cfg, b)} solo se unirían con un cable.`;
  return { si, texto };
}

export function leccionVista(): boolean {
  try {
    return localStorage.getItem(CLAVE_LECCION) === '1';
  } catch {
    return false;
  }
}

export function marcarLeccion(): void {
  try {
    localStorage.setItem(CLAVE_LECCION, '1');
  } catch {
    /* private mode */
  }
}
