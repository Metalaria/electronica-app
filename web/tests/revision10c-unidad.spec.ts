// Review 10c (1.0, teacher mode and the local error report), without a browser: findings proved in Node with the
// app's own modules and font files.
//   EPA_SIN_SERVIDOR=1 PLAYWRIGHT_BROWSERS_PATH=/tmp/claude-0/pwb npx playwright test -c playwright.revision10c.config.ts tests/revision10c-unidad.spec.ts
import { test, expect } from '@playwright/test';
import { cargarLibro, recursosNode } from './docente10/libro-node';
import { leerPdf, plano } from './docente10/leer-pdf';
import { bancoDe, elegirPorFiltros, FILTROS_VACIOS } from '../src/lib/docente/banco';
import { montarExamen, type ContextoExamen } from '../src/lib/docente/examen';
import type { DefinicionExamen } from '../src/lib/docente/tipos';
import { documentoCurso, documentoExamen } from '../src/lib/docente/pdf/documento';
import { generarPdf } from '../src/lib/docente/pdf/maquetar';
import { redactar } from '../src/lib/informe-fallos';

const L = cargarLibro();
const ctx: ContextoExamen = L.libro;
const banco = bancoDe(L.banco);
const O = { titulo: 'Examen de prueba', notas: '', fecha: '6 de noviembre de 2026', espacio: 'corto' as const, creado: Date.UTC(2026, 10, 6) };
const def = (items: DefinicionExamen['items']): DefinicionExamen => ({ items, minutos: 0, variantes: false, barajar: false, semilla: 1, espacio: 'corto' });

// r10c·1 (medium): the exam's notes come from a <textarea> («instrucciones que se imprimen en el examen», 3 rows):
// a line break typed there reaches the PDF as a character no font has — drawn as «?» and the lines run together.
test('r10c·1 notas de varias líneas: el PDF del examen no dibuja «?» por el salto de línea', async () => {
  const items = elegirPorFiltros(banco, { ...FILTROS_VACIOS, partes: ['cap05'], cantidad: 2 }, 3);
  const ex = montarExamen(def(items), ctx, 0);
  const notas = 'Lea todo el examen antes de empezar.\nPuede usar calculadora.\nTiempo: 50 minutos.';
  const r = await generarPdf(documentoExamen(ex, L.libro, { ...O, notas }), recursosNode);
  expect(r.faltan, 'caracteres sin glifo').toEqual([]);
  const texto = plano((await leerPdf(r.bytes)).texto.join(' '));
  expect(texto).toContain('Lea todo el examen antes de empezar.');
  expect(texto).not.toContain('empezar.?Puede');
});

test('r10c·1 notas de varias líneas: el índice de un curso tampoco', async () => {
  const d = documentoCurso({ titulo: 'Diodos', notas: 'Primero la teoría.\nDespués los ejercicios.', elementos: [{ k: 'ejercicio', label: 'ej-5.1' }], creado: 0 }, L.libro);
  const r = await generarPdf(d, recursosNode);
  expect(r.faltan, 'caracteres sin glifo').toEqual([]);
});

// Verified (no finding): a title pasted in decomposed form (NFD: «e» + U+0301) has every glyph.
test('verificado: título con acentos descompuestos (NFD): sin caracteres sin glifo', async () => {
  const items = elegirPorFiltros(banco, { ...FILTROS_VACIOS, partes: ['cap05'], cantidad: 1 }, 3);
  const ex = montarExamen(def(items), ctx, 0);
  const r = await generarPdf(documentoExamen(ex, L.libro, { ...O, titulo: 'Examen de rectificacio\u0301n y regulacio\u0301n' }), recursosNode);
  expect(r.faltan, 'caracteres sin glifo').toEqual([]);
});

// r10c·3 (medium): an absolute path with a space in a folder name — «C:\Users\Nombre Apellido\…», the usual Windows
// user folder, or «/Users/Nombre Apellido/…» — is cut at the space and replaced by its LAST segment so far, which is
// the user's first name; the rest of the path follows untouched.
test('r10c·3 redactar: una ruta con espacios no deja el nombre del usuario', () => {
  for (const m of [
    'No se pudo leer C:\\Users\\Ana García\\AppData\\Roaming\\com.epa\\lector.json: acceso denegado',
    'ENOENT: /Users/Ana García/Library/Application Support/com.epa/lector.json',
    'failed to open /home/ana garcia/.local/share/com.epa/lector.json',
  ]) {
    const r = redactar(m);
    expect(r, r).not.toMatch(/Ana|ana|Mejías|mejias/);
  }
});

// Verified (no finding): the student's exam PDF carries no answer — for 160 items picked over the whole book, neither
// a test question's explanation nor the opening of an exercise's worked solution is in its text.
test('verificado: el PDF del examen no lleva respuestas ni desarrollos', async () => {
  test.setTimeout(600_000);
  const items = elegirPorFiltros(banco, { ...FILTROS_VACIOS, cantidad: 160 }, 10_10);
  expect(items.length).toBeGreaterThan(100);
  const ex = montarExamen({ ...def(items), variantes: true, barajar: true, semilla: 4242 }, ctx, 1);
  const r = await generarPdf(documentoExamen(ex, L.libro, O), recursosNode);
  const texto = plano(r.texto);
  const limpio = (h: string) => plano(h.split('<img')[0]!.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/[\u00a0\u202f\u2009]/g, ' '));
  let comprobados = 0;
  for (const m of ex.items) {
    if (m.k === 'pregunta') {
      const p = ctx.pregunta(m.ref)!;
      const ex8 = limpio(p.explicacion).split(' ').slice(0, 8).join(' ');
      if (ex8.split(' ').length < 8 || limpio(p.enunciado).includes(ex8)) continue;
      expect(texto.includes(ex8), `${m.ref}: explicación en el examen`).toBe(false);
      comprobados++;
    } else if (m.variante == null) {
      const bl = L.libro.bloques(m.ref);
      const s = bl?.solucion.find((b) => b.t === 'p') as { html: string } | undefined;
      if (!s) continue;
      const s8 = limpio(s.html).split(' ').slice(0, 8).join(' ');
      const enun = bl!.enunciado.filter((b) => b.t === 'p').map((b) => limpio((b as { html: string }).html)).join(' ');
      if (s8.split(' ').length < 8 || enun.includes(s8)) continue;
      expect(texto.includes(s8), `${m.ref}: solución en el examen`).toBe(false);
      comprobados++;
    }
  }
  expect(comprobados).toBeGreaterThan(60);
  expect(texto).not.toMatch(/Solución \d+\.\d+ del libro|Del libro ·|Desarrollo del libro/);
});
