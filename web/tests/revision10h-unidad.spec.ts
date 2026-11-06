// Review 10h (1.0, teacher mode and the local failure report, third and last review), without a browser: the PDF
// checks the review asked for (no answers in the student's paper, the same bytes for the same inputs) and two low
// findings of the failure report.
//   EPA_SIN_SERVIDOR=1 PLAYWRIGHT_BROWSERS_PATH=/tmp/claude-0/pwb npx playwright test -c playwright.revision10h.config.ts tests/revision10h-unidad.spec.ts
import { test, expect } from '@playwright/test';
import { cargarLibro, recursosNode } from './docente10/libro-node';
import { plano } from './docente10/leer-pdf';
import { bancoDe, elegirPorFiltros, FILTROS_VACIOS } from '../src/lib/docente/banco';
import { esperadoVariante, montarExamen, varianteDe, type ContextoExamen } from '../src/lib/docente/examen';
import type { DefinicionExamen } from '../src/lib/docente/tipos';
import { documentoExamen, documentoSoluciones } from '../src/lib/docente/pdf/documento';
import { generarPdf } from '../src/lib/docente/pdf/maquetar';
import { borrarInforme, entradasInforme, informarFallo, redactar, usarAlmacenamiento } from '../src/lib/informe-fallos';

const L = cargarLibro();
const ctx: ContextoExamen = L.libro;
const banco = bancoDe(L.banco);
const O = { titulo: 'Examen de prueba', notas: 'Conteste en el espacio reservado.', fecha: '', espacio: 'corto' as const, creado: Date.UTC(2026, 10, 6) };

test('verificado: con variantes, el examen no lleva el resultado de ninguna variante (las soluciones sí) y repite sus bytes', async () => {
  test.setTimeout(600_000);
  // every exercise with changing values of the book, plus some others
  const conVariantes = banco.filter((e) => e.k === 'ejercicio' && e.variable).map((e) => ({ k: e.k, ref: e.ref, puntos: 2 }));
  expect(conVariantes.length).toBeGreaterThan(30);
  const otros = elegirPorFiltros(banco, { ...FILTROS_VACIOS, partes: ['cap05', 'cap09'], cantidad: 10 }, 31);
  const def: DefinicionExamen = { items: [...conVariantes, ...otros], minutos: 60, variantes: true, barajar: true, semilla: 10_108, espacio: 'corto' };
  for (const v of [0, 3]) {
    const ex = montarExamen(def, ctx, v);
    expect(ex.faltan).toEqual([]);
    const a = await generarPdf(documentoExamen(ex, L.libro, O), recursosNode);
    const b = await generarPdf(documentoExamen(ex, L.libro, O), recursosNode);
    expect(Buffer.from(a.bytes).equals(Buffer.from(b.bytes)), `variante ${v}: mismos bytes`).toBe(true);
    const s = await generarPdf(documentoSoluciones(ex, L.libro, O), recursosNode);
    const texto = plano(a.texto);
    const textoS = plano(s.texto);
    let vistos = 0;
    for (const m of ex.items) {
      const vr = varianteDe(m, ctx);
      if (!vr) continue;
      const esp = plano(esperadoVariante(vr.item, vr.v).texto);
      // a result that is also one of the statement's data proves nothing
      if (Object.values(vr.v.valores).some((x) => texto.includes(plano(String(x))) && plano(String(x)) === esp)) continue;
      expect(textoS.includes(esp), `${m.ref}: el resultado está en las soluciones`).toBe(true);
      vistos++;
    }
    expect(vistos).toBeGreaterThan(30);
    expect(texto).not.toMatch(/Solución \d+\.\d+ del libro|Del libro ·|Desarrollo del libro|Con los valores de esta variante|Respuesta: [A-E]\b/);
  }
});

// r10h·7 (low, personal data): paths the redaction does not see — Java-style «file:/…» URIs (one slash, what Android's
// File.toURI() prints: the «:» before «/storage» blocks the root rule) and a WSL share «\\wsl$\…» (the «$» stops the
// share rule; the «\home\» after it is not the «/home/» rule).
test('r10h·7 redactar: «file:/storage/…» (Android) y «\\\\wsl$\\…» tampoco dejan el nombre', () => {
  for (const c of [
    'java.io.FileNotFoundException: file:/storage/emulated/0/Documents/Ana García/examen.pdf (Permission denied)',
    'No se pudo crear el fichero: \\\\wsl$\\Ubuntu\\home\\ana\\examen.pdf',
  ]) {
    const r = redactar(c);
    expect(r, c).not.toMatch(/Ana|ana/);
  }
});

// r10h·8 (low, the report itself): «Borrar» is a clear epoch of wall-clock time and every later entry must have t >
// borrado. A tablet whose clock was ahead when the reader cleared the report (an Android device with a wrong date that
// the network corrects later) drops every new failure — none is shown or kept — until the real time passes that moment.
test('r10h·8 un «Borrar» con el reloj adelantado no hace desaparecer los fallos siguientes', () => {
  const datos = new Map<string, string>();
  usarAlmacenamiento({ getItem: (k) => datos.get(k) ?? null, setItem: (k, v) => void datos.set(k, v), removeItem: (k) => void datos.delete(k) });
  const real = Date.now;
  try {
    const ahora = real();
    Date.now = () => ahora + 30 * 86_400_000; // the clock 30 days ahead when «Borrar» is pressed
    borrarInforme();
    Date.now = () => ahora + 60_000; // corrected by the network; a failure a minute later
    informarFallo('error', new Error('fallo tras corregir la hora'));
    expect(entradasInforme().map((e) => e.m)).toContain('fallo tras corregir la hora');
  } finally {
    Date.now = real;
    usarAlmacenamiento(undefined);
  }
});
