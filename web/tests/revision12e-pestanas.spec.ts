// Independent review 12e — real Chromium tabs (one context). Build first:
//   npx vite build --outDir /tmp/claude-0/epa-revision12e --emptyOutDir
//   EPA_DIST=/tmp/claude-0/epa-revision12e EPA_PUERTO=4557 PLAYWRIGHT_BROWSERS_PATH=/tmp/claude-0/pwb \
//     npx playwright test -c playwright.revision12b.config.ts tests/revision12e-pestanas.spec.ts
//   12e·1  the 12b·1 burst (two tabs write the daily activity at the same instant, 20 times), under three timings:
//          as is, with the CPU slowed ×6 (CDP), and with one tab frozen for 5 s right after the burst (what a
//          background tab's timer throttling does to the truce's delayed write-back). Records WHEN each write of the
//          key lands after the burst, and checks the real invariants — nothing lost (40 steps), every record's last
//          change marked, no ping-pong (at most a couple of writes per tab once quiet) — rather than «no write in
//          [2.5 s, 6.5 s]», which only holds while the delayed write-back fires on time.
import { expect, test, type CDPSession, type Page } from '@playwright/test';

interface Diario {
  registrarActividad(tipo: string, n: number): void;
  leerDias(): Promise<Record<string, { pasos: number }>>;
  itemsDias(): Record<string, { pasos: number; t: number }>;
  escribir(): Promise<void>;
  cargar(): Promise<void>;
}

async function abrir(page: Page, ruta = '/#/'): Promise<void> {
  await page.route('https://api.github.com/**', (r) => r.fulfill({ status: 401, body: '{}' }));
  await page.addInitScript(() => ((window as unknown as { __epaPruebasDiario: object }).__epaPruebasDiario = {}));
  await page.goto(ruta);
  await page.waitForFunction(() => typeof (window as unknown as { __epaPruebasDiario: Partial<Diario> }).__epaPruebasDiario.cargar === 'function');
  await page.evaluate(() => (window as unknown as { __epaPruebasDiario: Diario }).__epaPruebasDiario.cargar());
}

for (const modo of ['normal', 'cpu6', 'congelada'] as const)
  test(`12e·1 ráfaga de 12b·1 (${modo}): nada se pierde, cada cambio con su marca, sin ping-pong`, async ({ context }) => {
    test.setTimeout(300_000);
    const p1 = await context.newPage();
    await abrir(p1);
    await p1.evaluate(() => {
      localStorage.removeItem('epa:progreso-diario');
      localStorage.removeItem('epa:sinc-marcas');
    });
    const p2 = await context.newPage();
    await abrir(p2);
    await abrir(p1);
    const avisos: string[] = [];
    for (const [n, p] of [[1, p1], [2, p2]] as const) p.on('console', (m) => m.type() === 'warning' && /guardado/.test(m.text()) && avisos.push(`p${n}: ${m.text().slice(0, 90)}`));
    const obs = await context.newPage();
    await obs.goto('/icono.png');
    await obs.evaluate(() => {
      const w = window as unknown as { __t: number[] };
      w.__t = [];
      window.addEventListener('storage', (e) => {
        if (e.key === 'epa:progreso-diario') w.__t.push(performance.timeOrigin + performance.now());
      });
    });
    const cdp: CDPSession[] = [];
    if (modo === 'cpu6')
      for (const p of [p1, p2]) {
        const s = await context.newCDPSession(p);
        await s.send('Emulation.setCPUThrottlingRate', { rate: 6 });
        cdp.push(s);
      }
    const N = 20;
    for (let i = 0; i < N; i++) {
      const T = (await p1.evaluate(() => performance.timeOrigin + performance.now())) + 120;
      const paso = (p: Page) =>
        p.evaluate(async (T) => {
          const d = (window as unknown as { __epaPruebasDiario: Diario }).__epaPruebasDiario;
          while (performance.timeOrigin + performance.now() < T);
          d.registrarActividad('paso', 1);
          await d.escribir();
        }, T);
      await Promise.all([paso(p1), paso(p2)]);
      await p1.waitForTimeout(40);
    }
    const fin = await obs.evaluate(() => performance.timeOrigin + performance.now());
    if (modo === 'congelada') {
      const s = await context.newCDPSession(p2);
      await s.send('Page.setWebLifecycleState', { state: 'frozen' });
      await p1.waitForTimeout(5000);
      await s.send('Page.setWebLifecycleState', { state: 'active' });
    }
    await p1.waitForTimeout(12_000);
    for (const s of cdp) await s.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    const tiempos = (await obs.evaluate(() => (window as unknown as { __t: number[] }).__t)).map((t) => Math.round(t - fin)).filter((t) => t > 0);
    const enVentana12b = tiempos.filter((t) => t >= 2500 && t <= 6500);
    const tarde = tiempos.filter((t) => t > 2500);
    const sinMarca = await p1.evaluate(() => {
      const v = JSON.parse(localStorage.getItem('epa:progreso-diario') ?? '{}') as Record<string, { t: number }>;
      const m = JSON.parse(localStorage.getItem('epa:sinc-marcas') ?? '{}') as { cambios?: Record<string, Record<string, number>> };
      const c = m.cambios?.['progreso-diario'] ?? {};
      return Object.entries(v)
        .filter(([k]) => k.includes('@'))
        .filter(([k, r]) => !(c[k]! >= r.t))
        .map(([k, r]) => `${k}: registro t=${r.t}, marca ${c[k] ?? 'ninguna'}`);
    });
    const total = async (p: Page) => {
      const dias = await p.evaluate(() => (window as unknown as { __epaPruebasDiario: Diario }).__epaPruebasDiario.leerDias());
      return Object.values(dias).reduce((s, d) => s + d.pasos, 0);
    };
    const guardado = await p1.evaluate(() => {
      const v = JSON.parse(localStorage.getItem('epa:progreso-diario') ?? '{}') as Record<string, { pasos: number }>;
      return Object.entries(v)
        .filter(([k]) => k.includes('@') && !k.endsWith('~'))
        .reduce((s, [, r]) => s + r.pasos, 0);
    });
    console.log(`[${modo}] escrituras tras la ráfaga (ms): ${JSON.stringify(tiempos)}; en la ventana de 12b·1: ${enVentana12b.length}; avisos: ${JSON.stringify(avisos.slice(-4))} (${avisos.length})`);
    console.log(`[${modo}] guardado ${guardado}, p1 ${await total(p1)}, p2 ${await total(p2)}, sin marca ${JSON.stringify(sinMarca)}`);
    expect(guardado, 'pasos guardados (registros)').toBe(2 * N);
    expect(await total(p1), 'pasos según la pestaña 1').toBe(2 * N);
    expect(await total(p2), 'pasos según la pestaña 2').toBe(2 * N);
    expect(sinMarca, 'cambios sin su marca').toEqual([]);
    // no ping-pong: once quiet, a delayed write-back per tab at most (and the other tab's answer to it)
    expect(tarde.length, `escrituras después de 2,5 s: ${JSON.stringify(tarde)}`).toBeLessThanOrEqual(3);
  });
