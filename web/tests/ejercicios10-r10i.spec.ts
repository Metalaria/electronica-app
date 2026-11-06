// Fix round of review 10i (1.0 exercises): femto, «otros valores» computed from the inputs as shown, twins of the
// book's values, statement texts. No browser:
//   EPA_SIN_SERVIDOR=1 PLAYWRIGHT_BROWSERS_PATH=/tmp/claude-0/pwb npx playwright test -c playwright.ejercicios10.config.ts tests/ejercicios10-r10i.spec.ts
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import { comprobar, leer } from '../src/lib/magnitudes';
import { calcular } from '../src/componentes/calculadoras/motor';
import { comoSeMuestran, enunciadoDe, valorTexto, variantes } from '../src/componentes/practica/variantes';
import type { ItemNumerico } from '../src/componentes/practica/tipos';

const PRACTICA = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'libro', 'practica');
const numericos = (): ItemNumerico[] =>
  readdirSync(PRACTICA)
    .filter((f) => /^(cap|ap)\w+\.json$/.test(f))
    .flatMap((f) => JSON.parse(readFileSync(join(PRACTICA, f), 'utf-8')).items ?? [])
    .filter((x: ItemNumerico) => x?.tipo === 'numerico');
const plano = (h: string) => h.replace(/<[^>]+>/g, '');

test('femto: «744 fF» como la escribe la app; «2,2 f» solo es femto, los faradios se escriben F', () => {
  const F = (valor: number) => ({ valor, unidad: 'F', tol: 0.02, texto: '' });
  expect(comprobar('744 fF', F(744e-15)).tipo).toBe('bien');
  expect(comprobar('744 f', F(744e-15)).tipo).toBe('bien');
  expect(comprobar('2,2 f', F(2.2)).tipo).not.toBe('bien');
  expect(comprobar('2,2 F', F(2.2)).tipo).toBe('bien');
  expect(comprobar('2,2 faradios', F(2.2)).tipo).toBe('bien');
  expect(comprobar('470 fA', { valor: 4.7e-13, unidad: 'A', tol: 0.02, texto: '' }).tipo).toBe('bien');
});

test('otros valores (todos los generadores numéricos): lo que se calcula es lo que se muestra', () => {
  const malas: string[] = [];
  let n = 0;
  for (const it of numericos()) {
    const f = it.formula;
    for (const v of variantes(it)) {
      n++;
      // every value written in the statement reads back as exactly the value used
      for (const x of f.vars) {
        if (x.id === it.objetivo || v.valores[x.id] == null) continue;
        if (it.ejercicio && !it.ejercicio.html.includes(`{{${x.id}}}`)) continue;
        const l = leer(valorTexto(v.valores[x.id]!, x.unidad), x.unidad);
        const usado = v.valores[x.id]!;
        // (a unit the answer reader does not take, «ns/m», is checked on the rounding the text uses)
        const leido = 'error' in l ? Number(usado.toPrecision(3)) : l.valor;
        if (Math.abs(leido - usado) > 1e-9 * Math.abs(usado)) malas.push(`${it.id}: ${x.id} se muestra «${valorTexto(usado, x.unidad)}» y se usa ${usado}`);
      }
      // and the expected result is the formula on those values
      const r = calcular(f, it.objetivo, v.valores).valor;
      if (Math.abs(r - v.resultado) > 1e-12 * Math.abs(r)) malas.push(`${it.id}: resultado`);
    }
  }
  expect(malas.slice(0, 20)).toEqual([]);
  expect(n).toBeGreaterThan(1000);
});

test('otros valores: ninguna variante repite los valores del libro tal como se muestran (gemelos de coma flotante)', () => {
  const malas: string[] = [];
  for (const it of numericos()) {
    const libro = JSON.stringify(comoSeMuestran(it, it.libro));
    for (const v of variantes(it)) if (JSON.stringify(comoSeMuestran(it, v.valores)) === libro) malas.push(it.id);
  }
  expect(malas).toEqual([]);
});

test('enunciados generados: el símbolo primero y el nombre entre paréntesis; velocidades sin «Mm/s»', () => {
  for (const it of numericos().filter((x) => !x.ejercicio)) {
    const v = variantes(it)[0];
    if (!v) continue;
    const t = plano(enunciadoDe(it, v));
    expect(t, it.id).toMatch(/^Calcule \S.* \(.+\) con estos datos: /);
    expect(t, it.id).not.toMatch(/Mm\/s|Gm\/s/);
  }
  const lc = numericos().find((x) => x.id === 'cap36-num-longitud-critica')!;
  expect(plano(enunciadoDe(lc, variantes(lc)[0]!))).toMatch(/×\s10⁸\sm\/s/);
  expect(comprobar('1,8 × 10⁸ m/s', { valor: 1.8e8, unidad: 'm/s', tol: 0.02, texto: '' }).tipo).toBe('bien');
});
