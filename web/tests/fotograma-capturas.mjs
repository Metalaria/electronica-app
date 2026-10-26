// Screenshots of «Un fotograma» (NES, Game Boy, Game Boy Color) on the owner's three devices, light and dark:
//   node tests/fotograma-capturas.mjs --url http://localhost:4231/ [--maquinas nes,gb,gbc]
// → tests/capturas/fotograma/<maquina>[-juego]-<equipo>-<tema>.png (git-ignored). Each capture is taken in the middle of a
// visible line of the frame, paused, after a short playback so that the pulses show.
import { mkdirSync } from 'node:fs';
import { chromium } from '@playwright/test';

const arg = (n, d) => {
  const i = process.argv.indexOf(`--${n}`);
  return i > 0 ? process.argv[i + 1] : d;
};
const url = arg('url', 'http://localhost:4231/');
const maquinas = arg('maquinas', 'nes,gb,gbc').split(',');
const EQUIPOS = [
  { id: 'mac', viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2 },
  { id: 'tableta', viewport: { width: 800, height: 1100 }, deviceScaleFactor: 2, hasTouch: true },
  { id: 'movil', viewport: { width: 412, height: 915 }, deviceScaleFactor: 2.625, hasTouch: true, isMobile: true },
];
const dir = new URL('./capturas/fotograma/', import.meta.url);
mkdirSync(dir, { recursive: true });
const b = await chromium.launch();
const VARIANTES = [
  ...EQUIPOS.flatMap((e) => ['claro', 'oscuro'].map((tema) => ({ e, tema, juego: false }))),
  // the homebrew game: every device in light, the Mac in dark
  ...EQUIPOS.map((e) => ({ e, tema: 'claro', juego: true })),
  { e: EQUIPOS[0], tema: 'oscuro', juego: true },
];
for (const m of maquinas) {
  for (const { e, tema, juego } of VARIANTES) {
    {
      const ctx = await b.newContext({ ...e });
      await ctx.addInitScript((t) => localStorage.setItem('epa:prefs', JSON.stringify({ tema: t, tam: 18 })), tema);
      const p = await ctx.newPage();
      await p.goto(`${url}#/consolas/${m}/fotograma`);
      await p.waitForFunction(() => !!globalThis.__epaFotograma, null, { timeout: 60000 });
      if (juego) {
        await p.getByRole('tab', { name: 'Un juego de verdad' }).click();
        await p.waitForFunction(() => globalThis.__epaFotograma?.traza.m.tipo === 'juego', null, { timeout: 60000 });
      }
      // the middle of the frame: line 100, a little after the start of the visible part of the line
      await p.evaluate(() => {
        const h = globalThis.__epaFotograma;
        const r = h.rep;
        const lt = h.traza.arrays[h.traza.m.video.lineasT];
        const ln = h.traza.arrays[h.traza.m.video.lineasN];
        let t = r.seg.t0;
        for (let i = 0; i < lt.length; i++) if (ln[i] === 100 && lt[i] >= r.seg.t0) { t = lt[i] + 140; break; }
        h.ir(t);
      });
      await p.getByRole('button', { name: 'Unos puntos' }).click();
      await p.getByRole('button', { name: 'Reproducir' }).click();
      await p.waitForTimeout(1600);
      await p.getByRole('button', { name: 'Pausar' }).click();
      await p.waitForTimeout(700);
      const nombre = `${m}${juego ? '-juego' : ''}-${e.id}-${tema}`;
      await p.screenshot({ path: new URL(`${nombre}.png`, dir).pathname, fullPage: e.id !== 'mac' });
      if (e.id === 'mac') await p.screenshot({ path: new URL(`${nombre}-pagina.png`, dir).pathname, fullPage: true });
      await ctx.close();
      console.log(`${m} ${juego ? 'juego ' : ''}${e.id} ${tema}`);
    }
  }
}
await b.close();
