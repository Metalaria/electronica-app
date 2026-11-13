// 1.2 (consolas-A): lessons that are not sections of the book — the «Consolas por dentro» course (owner 12-11 19:40).
// Each console of the «Consolas» explorer is a part «consola-<maquina>» whose lessons are
// contenido/lecciones11/consola-<maquina>/<label>.yaml, listed (titles and order) in contenido/lecciones11/consolas.yaml.
// The lesson generator (lecciones11.mjs) works on them unchanged through two kinds of synthetic «book» parts:
//   - «consola-<maquina>»: one h2 per lesson of the manifest (label and title), so `leccion: consola-snes/snes-placa`
//     names a section like any other;
//   - «<maquina>» (nes, snes…): the console's sourced data as citeable blocks — the explorer's data
//     (web/public/consolas/<maquina>.json: notice, photos, hotspots, equivalences, notes, revisions, sources), its
//     architecture model (componentes/consolas/arquitectura/<maquina>.ts: the diagram's blocks and the address
//     decoder on its example addresses) and the external facts of the manifest (`externas`, each with its source:
//     the repair lessons' service manuals, ConsoleMods…). A lesson cites them as «snes#12» (the generator finds the
//     block by its quote if the index moves), and the book chapters as usual («cap37#120»).
// After generation, `completar` adds what the app shows on a console lesson: `consola` (the machine) and, on each
// citation, its source (title and link) or, for a book block, the section it is in. `partes()` is what
// lecciones11.mjs publishes as libro/lecciones11/partes.json: the app (lib/datos.ts) and conceptos11.mjs merge those
// parts into the book's index with tipo «consola», so courses, progress, mastery and review treat them as chapters.
// Reads only. Contract and examples: contenido/lecciones11/GUIA.md §12.
import fs from 'node:fs';
import path from 'node:path';
import { parse } from 'yaml';

export const PREFIJO = 'consola-';
const MAQUINAS = ['nes', 'neogeo', 'sms', 'megadrive', 'gb', 'gbc', 'snes'];
/** The block colour of the course (the book's «Proyectos, diagnóstico e ingeniería inversa»). */
const COLOR = '8A1F3D';
const ID = /^[a-z0-9][a-z0-9-]*$/;

const plano = (h) =>
  String(h ?? '')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
const frase = (...xs) =>
  xs
    .map(plano)
    .filter(Boolean)
    .map((x) => (/[.:;!?)»]$/.test(x) ? x : `${x}.`))
    .join(' ');

/**
 * The console parts of a lessons folder. `fuentes`: contenido/lecciones11 (or EPA_LECCIONES11), `publico`: web/public,
 * `src(p)`: a path under web/src (to import the architecture models).
 */
export async function consolas11({ fuentes, publico, src }) {
  const errores = [];
  const manifiesto = path.join(fuentes, 'consolas.yaml');
  /** parte → { maquina, titulo, lecciones: [{ label, titulo }], externas } in the manifest's order */
  const partes = new Map();
  if (fs.existsSync(manifiesto)) {
    let m;
    try {
      m = parse(fs.readFileSync(manifiesto, 'utf8'), { strict: true, uniqueKeys: true });
    } catch (e) {
      errores.push(`consolas.yaml: YAML no válido: ${e instanceof Error ? e.message : String(e)}`);
      m = null;
    }
    for (const [p, x] of Object.entries(m?.partes ?? {})) {
      const d = `consolas.yaml: ${p}`;
      if (!p.startsWith(PREFIJO) || !MAQUINAS.includes(x?.maquina) || p !== PREFIJO + x.maquina) {
        errores.push(`${d}: la parte se llama «consola-<maquina>» con una máquina del explorador (${MAQUINAS.join(', ')})`);
        continue;
      }
      for (const k of Object.keys(x)) if (!['maquina', 'titulo', 'lecciones', 'externas'].includes(k)) errores.push(`${d}: clave desconocida «${k}»`);
      const lecciones = [];
      for (const [i, l] of (x.lecciones ?? []).entries()) {
        if (!l || !ID.test(String(l.label ?? '')) || typeof l.titulo !== 'string' || !l.titulo.trim()) errores.push(`${d}: lección ${i + 1}: { label, titulo }`);
        else if (lecciones.some((y) => y.label === l.label)) errores.push(`${d}: lección «${l.label}» repetida`);
        else lecciones.push({ label: l.label, titulo: l.titulo });
      }
      const externas = [];
      for (const [i, s] of (x.externas ?? []).entries()) {
        const ok = s && typeof s.titulo === 'string' && /^https:\/\//.test(String(s.url ?? '')) && Array.isArray(s.hechos) && s.hechos.length && s.hechos.every((h) => typeof h === 'string' && h.trim());
        if (!ok) errores.push(`${d}: externas ${i + 1}: { titulo, url (https), hechos: [«…»] } (cada hecho, lo que dice la fuente)`);
        else externas.push({ titulo: s.titulo, url: s.url, hechos: s.hechos });
      }
      partes.set(p, { maquina: x.maquina, titulo: typeof x.titulo === 'string' ? x.titulo : x.maquina, lecciones, externas });
    }
  }

  // ---- the citeable blocks of a console (built once, on demand)
  const cache = new Map();
  async function datosMaquina(maq) {
    if (cache.has(maq)) return cache.get(maq);
    const bloques = [];
    const fuentesB = [];
    const poner = (html, fuente) => {
      bloques.push({ t: 'p', html });
      fuentesB.push(fuente);
    };
    const f = path.join(publico, 'consolas', `${maq}.json`);
    const d = fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : null;
    if (d) {
      const exp = (vista = 'fuentes', que = '') => ({ titulo: `Explorador «Consolas» · ${d.titulo}${que ? `: ${que}` : ''}`, url: `#/consolas/${maq}/${vista}` });
      poner(frase(`${d.titulo}, placa ${d.placa}; esquema ${d.esquema_titulo}`, d.aviso), exp('fuentes', 'aviso'));
      const fotos = [{ ...d.foto, id: d.foto?.id ?? 'principal', hotspots: d.hotspots ?? [] }, ...(d.fotos ?? [])];
      for (const ft of fotos) {
        poner(frase(`Foto «${ft.titulo ?? d.placa}»`, ft.revision, ft.credito, ft.nota), exp('foto', `foto «${ft.titulo ?? d.placa}»`));
        for (const h of ft.hotspots ?? []) poner(frase(h.nombre, h.pieza, h.funcion, h.verificacion), exp(`foto/foto%3A${encodeURIComponent(h.id)}`, h.nombre));
      }
      for (const e of d.equivalencias ?? []) poner(frase(e.foto, e.esquema, e.senales, e.cambios, e.nota, e.fuente ? `(${e.fuente})` : ''), exp('fuentes', 'equivalencias'));
      for (const n of d.notas ?? []) poner(frase(`${n.ref}${n.pin ? ` (${n.pin})` : ''}: ${n.texto}`), exp('fuentes', 'notas'));
      for (const r of d.revisiones ?? []) poner(frase(`${r.vista}: ${r.revision}`, `(${r.fuente})`), exp('fuentes', 'revisiones'));
      for (const s of d.fuentes ?? []) poner(frase(s.titulo, s.autor, `Licencia: ${s.licencia}`, s.uso), { titulo: s.titulo, url: s.url });
      if (d.grupos) poner(frase(`Buses y grupos de señales: ${Object.values(d.grupos).join('; ')}`), exp('esquema', 'buses'));
    }
    // the architecture model: the diagram's blocks and the decoder on the example addresses the explorer offers
    const ts = src(`componentes/consolas/arquitectura/${maq}.ts`);
    if (fs.existsSync(ts)) {
      const mod = await import(ts);
      const a = Object.values(mod).find((x) => x && typeof x === 'object' && typeof x.decodificar === 'function' && x.diagrama);
      if (a) {
        const arq = { titulo: `Explorador «Consolas» · ${d?.titulo ?? maq}: arquitectura`, url: `#/consolas/${maq}/arquitectura` };
        for (const b of a.diagrama.bloques ?? []) poner(frase(`${b.titulo}${b.sub ? ` (${b.sub})` : ''}: ${b.info}`), arq);
        for (const v of a.variantes ?? []) poner(frase(`${v.titulo}: ${v.nota}`), arq);
        const digitos = (esp) => a.espacios?.find((e) => e.id === esp)?.digitos ?? a.digitos;
        for (const ej of a.ejemplos ?? []) {
          const r = a.decodificar(ej.dir, ej.escritura, ej.espacio);
          const dir = `$${r.direccion.toString(16).toUpperCase().padStart(digitos(ej.espacio), '0')}`;
          const donde = ej.espacio && a.espacios?.length ? ` (${a.espacios.find((e) => e.id === ej.espacio)?.titulo ?? ej.espacio})` : '';
          const activas = r.tabla.filter((x) => x.activa).map((x) => x.etiqueta);
          poner(
            frase(`Decodificador, ${ej.escritura ? 'escritura' : 'lectura'} en ${dir}${donde}: ${r.zona}`, r.texto, r.seleccion ? `Selección: ${r.seleccion}` : 'Sin selección de chip', activas.length ? `Activas: ${activas.join('; ')}` : '', r.espejo ? `Espejo de ${r.espejo}` : ''),
            arq,
          );
        }
      }
    }
    // the manifest's external facts (each with its source)
    const p = partes.get(PREFIJO + maq);
    for (const s of p?.externas ?? []) for (const h of s.hechos) poner(plano(h), { titulo: s.titulo, url: s.url });
    // the supply nets of the schematic and what each one reaches (last, so the blocks above keep their indices)
    for (const r of d?.redes ?? []) {
      if (r.g !== 'power' || /GND/i.test(r.n)) continue;
      const refs = [...new Set(r.nodos.map((x) => x[0]))].sort((a, b) => a.localeCompare(b, 'en', { numeric: true }));
      poner(frase(`Red ${r.n.replace(/^\//, '')} del esquema (alimentación): llega a ${refs.join(', ')}`), { titulo: `Explorador «Consolas» · ${d.titulo}: esquema`, url: `#/consolas/${maq}/esquema` });
    }
    const r = { bloques, fuentes: fuentesB };
    cache.set(maq, r);
    return r;
  }
  // (precomputed: the generator's context reads blocks synchronously)
  for (const maq of MAQUINAS) if (partes.has(PREFIJO + maq)) await datosMaquina(maq);

  return {
    errores,
    /** Position of a console part in the course (the explorer's order), or -1. */
    orden: (p) => [...partes.keys()].indexOf(p),
    /** The synthetic blocks of a console part or of a console's data; undefined for anything else. */
    bloques(p) {
      const x = partes.get(p);
      if (x) return x.lecciones.map((l) => ({ t: 'h2', label: l.label, num: null, html: l.titulo }));
      if (MAQUINAS.includes(p) && cache.has(p)) return cache.get(p).bloques;
      return undefined;
    },
    /**
     * The lesson as the app shows it: `consola` on a console lesson; on each citation of console data its source,
     * on each citation of the book the label of its section (the «Del libro» link). Other lessons are left as they are.
     */
    completar(l, bloquesLibro) {
      const x = partes.get(l.parte);
      if (!x) return l;
      const libro = {};
      for (const [k, c] of Object.entries(l.libro)) {
        const extra = {};
        if (cache.has(c.parte)) {
          const f = cache.get(c.parte).fuentes[c.bloque];
          if (f) extra.fuente = f;
        } else {
          const bs = bloquesLibro(c.parte) ?? [];
          for (let i = Math.min(c.bloque, bs.length - 1); i >= 0; i--)
            if (bs[i]?.t === 'h2' && bs[i].label) {
              extra.seccion = bs[i].label;
              break;
            }
        }
        libro[k] = { ...c, ...extra };
      }
      return { ...l, consola: x.maquina, libro };
    },
    /** libro/lecciones11/partes.json (null when there is no console part). */
    partes() {
      if (!partes.size) return null;
      return {
        version: 1,
        partes: Object.fromEntries(
          // (only the lessons already written: a planned one has no lesson to open yet)
          [...partes].map(([p, x]) => [
            p,
            {
              tipo: 'consola',
              titulo: x.titulo,
              color: COLOR,
              maquina: x.maquina,
              secciones: x.lecciones.filter((l) => fs.existsSync(path.join(fuentes, p, `${l.label}.yaml`))).map((l) => ({ num: null, label: l.label, titulo: l.titulo })),
            },
          ]),
        ),
      };
    },
  };
}
