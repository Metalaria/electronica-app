// Quick look at one route: node tests/proyectos-ver.mjs <url> <out.png> [ancho alto dpr] [oscuro]
import { chromium } from '@playwright/test';
const [url, out, w = '1280', h = '800', dpr = '2', tema = 'claro'] = process.argv.slice(2);
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: +w, height: +h }, deviceScaleFactor: +dpr });
p.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.log('consola:', m.type(), m.text()); });
p.on('pageerror', (e) => console.log('error:', e.message));
await p.addInitScript((t) => { try { localStorage.setItem('epa:prefs', JSON.stringify({ tema: t, tam: 18 })); } catch {} }, tema);
await p.goto(url);
await p.waitForTimeout(+(process.env.ESPERA ?? 3500));
await p.screenshot({ path: out, timeout: 180000 });
await b.close();
