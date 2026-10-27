// Start page (0.9): where the reader is, shared by the greeting, «Seguir leyendo» and the path of chapters.
// The lesson to continue (lib/lecciones.svelte.ts → ultimaLeccion) comes first; without one, the part read
// last at its section (usuario.posiciones); without any reading, the first chapter. Reactive: call it inside
// $derived.

import { usuario } from '../../lib/usuario.svelte';
import { infoParte, ordenLectura, rotuloParte } from '../../lib/datos';
import { corto } from '../../lib/navegacion.svelte';
import { rutaLeccion, ultimaLeccion } from '../../lib/lecciones.svelte';
import type { InfoParte, Seccion } from '../../lib/tipos';

export interface Destino {
  tipo: 'leccion' | 'lectura' | 'empezar';
  parte: string;
  info: InfoParte;
  /** «Capítulo 5 · Diodos». */
  capitulo: string;
  seccion: Seccion | null;
  /** Lesson step (0-based) and steps, for 'leccion'. */
  paso: number;
  pasos: number;
  /** Time of the reading position, for 'lectura'. */
  t: number;
  /** «Continuar». */
  href: string;
}

export function capituloDe(parte: string, info: InfoParte): string {
  const t = corto(info.titulo);
  return info.num != null && (info.tipo === 'capitulo' || info.tipo === 'apendice') ? `${rotuloParte(parte)} · ${t}` : t;
}

export function destinoActual(): Destino | null {
  const l = ultimaLeccion();
  if (l) {
    const info = infoParte(l.parte);
    if (info) {
      const seccion = info.secciones?.find((s) => s.label === l.seccion) ?? null;
      return {
        tipo: 'leccion',
        parte: l.parte,
        info,
        capitulo: l.capitulo || capituloDe(l.parte, info),
        seccion,
        paso: l.paso,
        pasos: l.pasos,
        t: 0,
        href: rutaLeccion(l.parte, l.seccion, l.paso),
      };
    }
  }
  let ultima: { id: string; t: number } | null = null;
  for (const [id, p] of Object.entries(usuario.posiciones)) if (infoParte(id) && (!ultima || p.t > ultima.t)) ultima = { id, t: p.t };
  if (ultima) {
    const info = infoParte(ultima.id)!;
    const pos = usuario.posiciones[ultima.id]!;
    const seccion = info.secciones?.find((s) => s.label === pos.sec) ?? null;
    return {
      tipo: 'lectura',
      parte: ultima.id,
      info,
      capitulo: capituloDe(ultima.id, info),
      seccion,
      paso: 0,
      pasos: 0,
      t: pos.t,
      href: ultima.id === 'glosario' ? '#/glosario' : `#/${ultima.id}`,
    };
  }
  const orden = ordenLectura();
  const parte = orden.find((p) => infoParte(p)?.tipo === 'capitulo') ?? orden[0];
  const info = parte ? infoParte(parte) : undefined;
  if (!parte || !info) return null;
  const seccion = info.secciones?.[0] ?? null;
  return {
    tipo: 'empezar',
    parte,
    info,
    capitulo: capituloDe(parte, info),
    seccion,
    paso: 0,
    pasos: 0,
    t: 0,
    href: seccion ? `#/${parte}/${seccion.label}` : `#/${parte}`,
  };
}

const PALABRAS = ['cero', 'un', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve', 'diez'];

/** «un», «dos» … «diez», then digits. */
export function enPalabras(n: number): string {
  return PALABRAS[n] ?? String(n);
}

const ORDINALES = ['', 'primero', 'segundo', 'tercero', 'cuarto', 'quinto', 'sexto', 'séptimo', 'octavo', 'noveno', 'décimo'];

/** «el séptimo» (día), or «el día 12». */
export function elOrdinal(n: number): string {
  return ORDINALES[n] ? `el ${ORDINALES[n]}` : `el día ${n}`;
}
