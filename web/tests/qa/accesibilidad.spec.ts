// Accessibility basics that need the keyboard or both themes (the per-page checks of comprobaciones.ts already
// look for buttons and links without a name, fields without a label and text contrast in every profile):
// focus visible when moving with Tab on the desktop, and contrast in the dark theme on the desktop.
import { test } from '@playwright/test';
import { Registro, esperarCalma, prepararPagina, recogerYComprobar } from './arnes.ts';
import { MODO } from './perfiles.ts';
import { azarDe, todasLasRutas } from './rutas.ts';

const PAGINAS = todasLasRutas().filter((r) => r.siempre && !r.accion);

test('foco visible al moverse con el tabulador', async ({ page }, info) => {
  const reg = new Registro(info);
  test.skip(reg.perfil.id !== 'escritorio', 'solo en el escritorio (teclado)');
  test.skip(!!process.env.QA_FILTRO, 'con QA_FILTRO solo corre el rastreador');
  test.setTimeout(PAGINAS.length * 60_000);
  await prepararPagina(page, reg);
  const tabs = MODO === 'rapido' ? 12 : 30;
  let revisados = 0;
  for (const r of PAGINAS) {
    reg.ruta = r.id;
    await page.goto(`/${r.hash}`);
    await esperarCalma(page, 15_000);
    await page.locator('body').click({ position: { x: 1, y: 1 } }).catch(() => {});
    for (let k = 0; k < tabs; k++) {
      await page.keyboard.press('Tab');
      const sin = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null;
        if (!el || el === document.body) return null;
        // the element and its first descendants (a focus ring may be drawn on an inner icon)
        // the element, its first descendants (a ring drawn on an inner icon) and its two nearest ancestors (a field whose
        // wrapper shows :focus-within)
        const foto = () =>
          [el, ...[...el.querySelectorAll('*')].slice(0, 4), el.parentElement, el.parentElement?.parentElement]
            .filter((x): x is Element => !!x)
            .map((x) => {
              const s = getComputedStyle(x);
              return [s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0 ? `${s.outlineStyle}${s.outlineWidth}${s.outlineColor}` : '', s.boxShadow, s.backgroundColor, s.borderColor, s.color, s.textDecorationLine, s.stroke, s.strokeWidth, s.fill].join('|');
            })
            .join('#');
        const con = foto();
        const s = getComputedStyle(el);
        if (s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0) return null;
        el.blur();
        const sinFoco = foto();
        el.focus();
        if (con !== sinFoco) return null;
        const t = (el.innerText || el.getAttribute('aria-label') || el.tagName).replace(/\s+/g, ' ').trim().slice(0, 40);
        const cls = [...el.classList].slice(0, 2).map((c) => `.${c}`).join('');
        return { firma: `${el.parentElement?.tagName.toLowerCase() ?? ''} > ${el.tagName.toLowerCase()}${cls}`, t };
      });
      revisados++;
      if (sin) await reg.anotar({ sev: 'accesibilidad', tipo: 'foco-invisible', firma: sin.firma, msg: `Con el tabulador, «${sin.t}» recibe el foco sin ninguna marca visible.` });
    }
  }
  reg.cobertura({ 'foco: elementos revisados con Tab': revisados });
});

test('contraste en el tema oscuro del escritorio', async ({ page }, info) => {
  const reg = new Registro(info);
  test.skip(reg.perfil.id !== 'escritorio', 'el teléfono ya va en tema oscuro');
  test.skip(!!process.env.QA_FILTRO, 'con QA_FILTRO solo corre el rastreador');
  const rutas = todasLasRutas().filter((r) => !r.accion && (r.siempre || azarDe(`oscuro:${r.id}`) < (MODO === 'rapido' ? 0.005 : 0.02)));
  test.setTimeout(rutas.length * 60_000);
  await page.emulateMedia({ colorScheme: 'dark' });
  await prepararPagina(page, reg);
  for (const [i, r] of rutas.entries()) {
    reg.ruta = `${r.id} (oscuro)`;
    await page.evaluate(() => (window as unknown as { __qa?: { marcar: () => void } }).__qa?.marcar()).catch(() => {});
    if (i === 0) await page.goto(`/${r.hash}`);
    else await page.evaluate((h) => (location.hash = h), r.hash);
    await esperarCalma(page, r.pesada ? 20_000 : 8000);
    await recogerYComprobar(page, reg, { tactil: false, completa: !!r.completa, accesibilidad: true });
  }
  reg.cobertura({ 'rutas en tema oscuro (escritorio)': rutas.length });
});
