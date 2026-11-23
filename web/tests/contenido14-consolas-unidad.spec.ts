// 1.4 (contenido14) in Node: the consoles' content the owner decided on 23-11, read from the published data (the
// explorer's JSON and the compiled lessons). The Super Nintendo's PAL faces are iFixit's photos of a populated
// SNSP-CPU-01 (credit, licence, source, boxes and footprint markers inside the photo, the blue circles said); the
// Mega Drive's practice uses the 9 V adapter and still cites Sega's 10 V; IC15/IC17 are said to be U15/U17; the NES
// adapter's label; the Master System II and Game Boy Color faults come from the verified sources (and the Color's
// headphone jack can be the fault); the earlier fixes stay (GBC +3,3 V from U7; figures 38.16 and 38.22).
//   EPA_SIN_SERVIDOR=1 PLAYWRIGHT_BROWSERS_PATH=/tmp/claude-0/pwb npx playwright test -c playwright.contenido14.config.ts tests/contenido14-consolas-unidad.spec.ts
import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const publico = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const json = (r: string): any => JSON.parse(fs.readFileSync(path.join(publico, r), 'utf8'));
const leccion = (id: string) => json(`libro/lecciones11/${id}.json`) as { modelo: { valores: Record<string, { valor: number }> }; tarjetas: Record<string, unknown>[]; libro?: Record<string, unknown> };
const tarjeta = (id: string, t: string) => leccion(id).tarjetas.find((x) => x.id === t)! as Record<string, unknown>;
/** The plain text of a lesson's piece (texts are arrays of { t, s } tokens). */
const plano = (x: unknown): string => JSON.stringify(x ?? '');

test('Super Nintendo: las caras PAL son las fotos de iFixit, con su crédito, su licencia y sus recuadros dentro', () => {
  const d = json('consolas/snes.json');
  for (const id of ['cara-a', 'cara-b']) {
    const f = d.fotos.find((x: { id: string }) => x.id === id);
    expect(f.src).toBe(`consolas/snes/foto-${id}.jpg`);
    expect([f.ancho, f.alto]).toEqual([1600, 1200]);
    expect(f.credito).toBe('Foto: Arty Boomshaka y colaboradores, iFixit, CC BY-NC-SA 3.0');
    expect(f.titulo).not.toMatch(/sin piezas|incompleta/);
    for (const h of f.hotspots) for (const c of h.cajas) expect(c[0] >= 0 && c[1] >= 0 && c[2] <= 1600 && c[3] <= 1200 && c[2] > c[0] && c[3] > c[1], `${id} ${h.id}`).toBe(true);
    for (const [r, p] of Object.entries(f.posiciones as Record<string, [number, number]>)) expect(p[0] >= 0 && p[0] < 1600 && p[1] >= 0 && p[1] < 1200, r).toBe(true);
    expect(f.posiciones_nota).toContain('homografía');
  }
  expect(d.fotos.find((x: { id: string }) => x.id === 'cara-b').nota).toContain('círculos azules');
  const fuente = d.fuentes.find((x: { url: string }) => x.url === 'https://www.ifixit.com/Teardown/PAL+Super+Nintendo+Teardown/96506');
  expect(fuente.licencia).toContain('CC BY-NC-SA 3.0');
  expect(fuente.uso).toContain('sin recortar ni retocar');
  // the photo files really are the new ones (4:3, not the old scans of 1600 × 1351)
  const tam = (f: string) => {
    const b = fs.readFileSync(path.join(publico, f));
    for (let i = 2; i < b.length; ) {
      const m = b[i + 1]!;
      if (m >= 0xc0 && m <= 0xc2) return [b.readUInt16BE(i + 7), b.readUInt16BE(i + 5)];
      i += 2 + b.readUInt16BE(i + 2);
    }
    return null;
  };
  expect(tam('consolas/snes/foto-cara-a.jpg')).toEqual([1600, 1200]);
  expect(tam('consolas/snes/foto-cara-b.jpg')).toEqual([1600, 1200]);
  // the lessons on those photos no longer call the board bare
  for (const l of ['snes-placa', 'snes-relojes'])
    for (const t of leccion(`consola-snes/${l}`).tarjetas) expect(plano([t.texto, t.exito, t.solucion, (t.widget as { zonas?: unknown })?.zonas]), `${l} ${String(t.id)}`).not.toMatch(/desnuda|Sitio del|Huella|sitio de/);
});

test('Mega Drive: la práctica usa el adaptador de 9 V y cita también los 10 V del manual; IC15/IC17 son U15/U17', () => {
  for (const l of ['megadrive-alimentacion', 'megadrive-averias']) {
    const x = leccion(`consola-megadrive/${l}`);
    expect(x.modelo.valores.V_ad!.valor, l).toBe(9);
    const libro = plano(x.libro);
    expect(libro, l).toContain('10 V de continua y 1,2 A');
    expect(libro, l).toContain('9 V de continua y 1,2 A');
  }
  expect(plano(tarjeta('consola-megadrive/megadrive-alimentacion', 'formula-disipa').exito)).toContain('2 W');
  expect(plano(tarjeta('consola-megadrive/megadrive-alimentacion', 'por-que-ic17').texto)).toContain('U15');
});

test('NES: el adaptador PAL, por su etiqueta (9 V de alterna, 1,3 A); sin el 9,8 V sin fuente', () => {
  const x = leccion('consola-nes/nes-alimentacion');
  expect(x.modelo.valores.V_ad!.valor).toBe(9);
  expect(x.modelo.valores.I_ad!.valor).toBe(1.3);
  expect(plano(tarjeta('consola-nes/nes-alimentacion', 'explore-p6').nota)).toContain('etiqueta del adaptador');
  expect(plano(x)).not.toContain('9,8');
});

test('Master System II y Game Boy Color: las averías de las fuentes comprobadas; la toma de auriculares puede fallar', () => {
  const sms = leccion('consola-sms/sms-averias');
  expect(plano(sms.libro)).toContain('el conector de 50 patas sucio');
  expect(sms.tarjetas.some((t) => t.id === 'toque-modulador')).toBe(true);
  const alt = tarjeta('consola-gbc/gbc-averias', 'tocar-altavoz') as { actividad: { bien: string[] } };
  expect(alt.actividad.bien.sort()).toEqual(['hp', 'ls']);
  expect(plano(leccion('consola-gbc/gbc-averias').libro)).toContain('Un altavoz sano mide 8 Ω');
  // not confirmed by any source that could be read: not used
  for (const l of ['consola-sms/sms-averias', 'consola-gbc/gbc-averias']) expect(plano(leccion(l)), l).not.toMatch(/C32|C35|C38|837-6067|837-6629/);
});

test('lo que ya estaba arreglado sigue: +3,3 V de U7 en la Color y las figuras 38.16 y 38.22', () => {
  const gbc = json('consolas/gbc.json');
  const todos = [...gbc.hotspots, ...gbc.fotos.flatMap((f: { hotspots: unknown[] }) => f.hotspots)] as { esquema: string[]; funcion: string }[];
  expect(todos.find((h) => h.esquema.includes('U5'))!.funcion).toContain('los da U7');
  const refs = json('libro/refs.json');
  const num = (l: string) => JSON.stringify(refs).match(new RegExp(`"${l.replace('.', '\\.')}":\\{"num":"([^"]+)"`))?.[1];
  expect([num('fig-37.16'), num('fig-37.22')]).toEqual(['38.16', '38.22']);
  expect(JSON.stringify(json('consolas/nes.json').fuentes)).toContain('{{num:fig-37.16}}');
});
