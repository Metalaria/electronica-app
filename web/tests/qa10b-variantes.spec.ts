// QA 1.0 part B (failing until fixed): «Practicar con otros valores», the problem of the day and the teacher-mode
// variants say what is asked with `ejercicio.pide`, a text written for the BOOK's values. When it names a value of a
// quantity that the variant changes, the reader is asked for the wrong thing: ej-3.3 with f = 80 Hz says «En esta
// variante se pide: XC a 50 Hz»; prob-4.A says «Rizado con 100 µH» while L varies. No browser needed:
//   PLAYWRIGHT_BROWSERS_PATH=/tmp/claude-0/pwb npx playwright test -c playwright.config.ts tests/qa10b-variantes.spec.ts
// (the base config starts its web server first; any config whose testMatch takes this file will do).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';

const libro = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public', 'libro', 'practica');

interface Item {
  id: string;
  tipo: string;
  varia?: Record<string, unknown>;
  ejercicio?: { label: string; pide?: string };
}

test('qa10b·1 «En esta variante se pide» no nombra un valor del libro de una magnitud que la variante cambia', () => {
  const malos: string[] = [];
  for (const f of fs.readdirSync(libro).filter((x) => /^cap.*\.json$/.test(x))) {
    const d = JSON.parse(fs.readFileSync(path.join(libro, f), 'utf8')) as { items: Item[] };
    for (const it of d.items) {
      if (it.tipo !== 'numerico' || !it.ejercicio?.pide || !it.varia || !Object.keys(it.varia).length) continue;
      // the text without subscripts (R<sub>2</sub> is a name, not a value)
      const pide = it.ejercicio.pide.replace(/<sub>.*?<\/sub>/g, '').replace(/<[^>]+>/g, '');
      if (/\d+(?:[.,]\d+)?\s*(?:[pnuµmkMG])?(?:Hz|H|F|V|A|Ω|W|s)\b/.test(pide)) malos.push(`${it.id}: «${pide}» (varía ${Object.keys(it.varia).join(', ')})`);
    }
  }
  expect(malos).toEqual([]);
});
