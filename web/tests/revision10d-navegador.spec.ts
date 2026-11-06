// Review 10d in the browser (one targeted run):
//   PLAYWRIGHT_BROWSERS_PATH=/tmp/claude-0/pwb nice npx playwright test -c playwright.revision10d.config.ts tests/revision10d-navegador.spec.ts --workers=1
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test, type Page } from '@playwright/test';
import type { PracticaParte } from '../src/componentes/practica/tipos.ts';

const libro = path.join(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), 'public', 'libro');
const J = <T>(p: string): T => JSON.parse(fs.readFileSync(path.join(libro, p), 'utf8')) as T;

async function limpio(page: Page): Promise<void> {
  await page.context().route('https://api.github.com/**', (r) => r.fulfill({ status: 404, body: '{}' }));
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('preparado')) {
      sessionStorage.setItem('preparado', '1');
      localStorage.clear();
      localStorage.setItem('epa:sinc-ajustes', JSON.stringify({ auto: false }));
      localStorage.setItem('epa:prefs', JSON.stringify({ tema: 'claro', tam: 18, sonido: false, vibracion: false }));
    }
  });
}

function rutaPractica(parte: string, seccion: string, id: string): string {
  const d = J<PracticaParte>(`practica/${parte}.json`);
  const i = d.secciones[seccion]!.items.indexOf(id);
  expect(i, id).toBeGreaterThanOrEqual(0);
  return `#/leccion/${parte}/${seccion}/practica-${i + 1}`;
}

test('r10d·6 avería: la pieza bien y el tipo mal da una frase gramatical; la lectura sale de ngspice; la nota tras un fallo', async ({ page }) => {
  await limpio(page);
  const id = 'cap01-averia-fig-1.3-0-E3-abierta';
  await page.goto(rutaPractica('cap01', 'sec-1.3', id));
  const z = page.locator(`[data-averia="${id}"]`);
  await expect(z).toHaveAttribute('data-listo', '', { timeout: 30_000 });
  // R1 open: between A (the + of the source) and B, the whole 12 V (healthy: 1,52 V) — simulated, not stored
  await page.locator('[data-punta="roja"]').selectOption({ label: 'punto A' });
  await page.locator('[data-punta="negra"]').selectOption({ label: 'punto B' });
  await page.locator('[data-medir]').click();
  await expect(page.locator('[data-lectura-polimetro]')).toContainText('12,0 V');
  // the right part with the wrong fault: the message must read as Spanish
  await page.locator('label:has([data-pieza="E3"])').click();
  await page.locator('label:has([data-tipo="corto"])').click();
  await page.locator('[data-comprobar]').click();
  const aviso = page.getByText(/La pieza es esa/);
  await expect(aviso).toBeVisible();
  const texto = (await aviso.textContent()) ?? '';
  // today: «… no es lo que le pasa: con está en cortocircuito las medidas serían otras.»
  expect(texto, texto).not.toMatch(/con está/);
});
