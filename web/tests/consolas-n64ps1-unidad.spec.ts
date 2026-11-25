// 2.0 (n64ps1) in Node: the Nintendo 64 (OpeN64, NUS-CPU-03) and the PlayStation (pu-18, PU-18) of «Consolas», read
// from the published data and the app's modules. The photos of the real retail boards with their credits, licences
// and boxes inside; the sources with their licences; OpeN64's schematic-vs-PCB notes; the size budget (each board's
// data and schematic within the largest of the first seven machines); the architecture decoders; «Un fotograma»'s
// byte order (the N64's left texel in the high nibble, the PlayStation's in the low one); the registries that hide
// «Arquitectura» and «Un fotograma» for a machine without a model; and «Busque la avería» on both boards.
//   EPA_SIN_SERVIDOR=1 PLAYWRIGHT_BROWSERS_PATH=/tmp/claude-0/pwb npx playwright test -c playwright.n64ps1.config.ts tests/consolas-n64ps1-unidad.spec.ts
import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cargarArquitectura, tieneArquitectura } from '../src/componentes/consolas/arquitectura/maquinas.ts';
import { cargarFotograma, tieneFotograma } from '../src/componentes/consolas/fotograma/maquinas.ts';
import { N64 as ARQ_N64 } from '../src/componentes/consolas/arquitectura/n64.ts';
import { PS1 as ARQ_PS1 } from '../src/componentes/consolas/arquitectura/ps1.ts';
import { N64 as FOTO_N64 } from '../src/componentes/consolas/fotograma/maquinas/n64.ts';
import { PS1 as FOTO_PS1 } from '../src/componentes/consolas/fotograma/maquinas/ps1.ts';
import { nibbles } from '../src/componentes/consolas/fotograma/ejemplo.ts';
import { averiaPorId, averiasDe } from '../src/lib/averias-placa/definiciones.ts';
import { diagnosticar, evaluarModelo, lectura, padsDe, redDePad, type LeccionJson, type PlacaMinima, type Resultado } from '../src/lib/averias-placa/modelo.ts';
import type { IdMaquina } from '../src/componentes/consolas/datos.ts';

const publico = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const json = (r: string): any => JSON.parse(fs.readFileSync(path.join(publico, r), 'utf8'));
const tam = (r: string) => fs.statSync(path.join(publico, r)).size;
/** Bytes of a console's explorer data: its JSON and its sheets (photos apart). */
const esquema = (m: string) =>
  tam(`consolas/${m}.json`) +
  fs
    .readdirSync(path.join(publico, 'consolas', m))
    .filter((f) => f.startsWith('hoja-'))
    .reduce((s, f) => s + tam(`consolas/${m}/${f}`), 0);
const fotos = (m: string) =>
  fs
    .readdirSync(path.join(publico, 'consolas', m))
    .filter((f) => f.endsWith('.jpg'))
    .reduce((s, f) => s + tam(`consolas/${m}/${f}`), 0);
const SIETE = ['nes', 'neogeo', 'sms', 'megadrive', 'gb', 'gbc', 'snes'];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function fotosDe(d: any): any[] {
  return [{ ...d.foto, hotspots: d.hotspots }, ...(d.fotos ?? [])];
}

test('Nintendo 64: la foto es la NUS-CPU-04 de iFixit, con su crédito y sus recuadros y huellas dentro', () => {
  const d = json('consolas/n64.json');
  expect(d.placa).toContain('NUS-CPU-03');
  const fs_ = fotosDe(d);
  expect(fs_.map((f) => f.id)).toEqual(['cpu04']);
  const f = fs_[0];
  expect(f.credito).toBe('Foto: iFixit, «Nintendo 64 Teardown», CC BY-NC-SA 3.0');
  expect(f.revision).toContain('NUS-CPU-04');
  expect(f.hotspots.length).toBe(18);
  for (const h of f.hotspots) for (const c of h.cajas) expect(c[0] >= 0 && c[1] >= 0 && c[2] <= f.ancho && c[3] <= f.alto && c[2] > c[0] && c[3] > c[1], h.id).toBe(true);
  for (const [r, p] of Object.entries(f.posiciones as Record<string, [number, number]>)) expect(p[0] >= 0 && p[0] < f.ancho && p[1] >= 0 && p[1] < f.alto, r).toBe(true);
  // (the note names this board's PCB, not the SNES's: posiciones_nota once said «nonSNES» for every machine)
  expect(f.posiciones_nota).toContain('OpeN64');
  expect(f.posiciones_nota).not.toContain('nonSNES');
  // OpeN64's schematic puts the 78M05's input and output on +3.3V; its PCB (and the board view) on +12V and +5V
  expect(d.notas.find((n: { ref: string; pin?: string }) => n.ref === 'U13' && n.pin === '1').texto).toContain('+12V');
  expect(d.notas.find((n: { ref: string; pin?: string }) => n.ref === 'U13' && n.pin === '3').texto).toContain('+5V');
  const p = json('consolas/placas/n64.json');
  const u13 = p.huellas.find((h: { r: string }) => h.r === 'U13');
  const pads = padsDe(p as PlacaMinima);
  expect(redDePad(pads, 'U13.1')).toBe('+12V');
  expect(redDePad(pads, 'U13.3')).toBe('+5V');
  expect(u13.lado).toBe('F');
  expect(p.huellas.length).toBe(273);
  const fu = d.fuentes.map((s: { titulo: string; licencia: string }) => `${s.titulo} · ${s.licencia}`).join('\n');
  expect(fu).toContain('CERN-OHL-P v2');
  expect(fu).toContain('CC BY-NC-SA 3.0');
  for (const s of d.fuentes) expect(s.licencia.length, s.titulo).toBeGreaterThan(3);
});

test('PlayStation: las dos caras de la PU-18 de Antoinebercovici (CC BY-SA 4.0) y la recreación pu-18', () => {
  const d = json('consolas/ps1.json');
  expect(d.placa).toContain('PU-18');
  const fs_ = fotosDe(d);
  expect(fs_.map((f) => f.id)).toEqual(['cara-a', 'cara-b', 'pu18']);
  for (const f of fs_.slice(0, 2)) {
    expect(f.credito).toBe('Foto: Antoinebercovici, Wikimedia Commons, CC BY-SA 4.0');
    expect(f.revision).toContain('PU-18 (1-664-537-62)');
  }
  expect(fs_[2].credito).toContain('CC0');
  for (const f of fs_) {
    expect(f.hotspots.length, f.id).toBeGreaterThan(4);
    for (const h of f.hotspots) for (const c of h.cajas) expect(c[0] >= 0 && c[1] >= 0 && c[2] <= f.ancho && c[3] <= f.alto && c[2] > c[0] && c[3] > c[1], `${f.id} ${h.id}`).toBe(true);
    for (const [r, p] of Object.entries(f.posiciones as Record<string, [number, number]>)) expect(p[0] >= 0 && p[0] < f.ancho && p[1] >= 0 && p[1] < f.alto, `${f.id} ${r}`).toBe(true);
    expect(f.posiciones_nota, f.id).toContain('pu-18');
  }
  // one source per Commons file page, each with its link (a bare URL in the text once widened «Fuentes» on a phone)
  const c = d.fuentes.filter((s: { titulo: string }) => s.titulo.startsWith('Antoinebercovici'));
  expect(c.map((x: { url: string }) => x.url)).toEqual(['top', 'bottom'].map((x) => `https://commons.wikimedia.org/wiki/File:Sony_Playstation_1_SCPH-5502_motherboard_${x}.jpg`));
  for (const x of c) expect(x.licencia).toBe('CC BY-SA 4.0');
  for (const x of d.fuentes) expect(`${x.titulo} ${x.uso}`, x.titulo).not.toMatch(/https?:\/\//);
  expect(d.fuentes[0].licencia).toContain('CC0');
  // the two controller fuses of the fault are on the photo of the component side
  for (const r of ['PS605', 'PS602', 'CN102', 'CN602']) expect(d.foto.posiciones[r], r).toBeTruthy();
  expect(json('consolas/placas/ps1.json').huellas.length).toBe(554);
});

test('tamaños: la placa y el esquema de cada una, dentro de lo que ocupan las siete primeras', () => {
  // (the boards of the first seven machines, by the board index: some have two, e.g. gbc-cgb04 and gbc-opengbc)
  const placas = json('consolas/placas/indice.json').placas as { id: string; maquina: string }[];
  const maxPlaca = Math.max(...placas.filter((e) => SIETE.includes(e.maquina)).map((e) => tam(`consolas/placas/${e.id}.json`)));
  const maxEsquema = Math.max(...SIETE.map(esquema));
  const maxFotos = Math.max(...SIETE.map(fotos));
  for (const m of ['n64', 'ps1']) {
    expect(tam(`consolas/placas/${m}.json`), m).toBeLessThanOrEqual(maxPlaca);
    // (the PlayStation's schematic, 554 parts on 3 sheets, is a few per cent above the Neo Geo's: allowed to 10 %)
    expect(esquema(m), m).toBeLessThanOrEqual(maxEsquema * 1.1);
    expect(fotos(m), m).toBeLessThanOrEqual(maxFotos);
  }
  const indice = placas.map((e) => e.id);
  expect(indice).toContain('n64');
  expect(indice).toContain('ps1');
});

test('arquitectura: los decodificadores de direcciones de la N64 y de la PlayStation', () => {
  const n = (dir: number) => ARQ_N64.decodificar(dir, false);
  expect(n(0xa4040010).bloque).toBe('rcp');
  expect(n(0xa4040010).zona).toBe('Registros del RSP');
  expect(n(0x80000400).bloque).toBe('rdram');
  expect(n(0xb0001000).bloque).toBe('cart');
  expect(n(0xbfc00000).bloque).toBe('pif');
  const p = (dir: number) => ARQ_PS1.decodificar(dir, false);
  expect(p(0xbfc00000).seleccion).toBe('~CS2');
  expect(p(0xbfc00000).bloque).toBe('bios');
  expect(p(0x1f801810).bloque).toBe('gpu');
  expect(p(0x1f801c00).seleccion).toBe('~CS4');
  expect(p(0x1f801800).seleccion).toBe('~CS5');
  // the 2 MB of RAM repeat in the first 8 MB
  expect(p(0x345678).zona).toContain('espejo');
  expect(p(0x345678).bloque).toBe('ram');
  // the PlayStation has a PAL and an NTSC variant; the N64 too (its VI clock changes)
  expect(ARQ_PS1.variantes?.map((v) => v.id).length).toBe(2);
  expect(ARQ_N64.variantes?.map((v) => v.id).length).toBe(2);
});

test('«Un fotograma»: el orden de los texeles en el byte (N64 arriba, PlayStation abajo) y las señales del diagrama', () => {
  const hex = (xs: number[]) => xs.map((x) => x.toString(16).padStart(2, '0'));
  expect(hex(nibbles(FOTO_N64.ejemplo))).toEqual(['16', 'f6', '66', '61']);
  expect(hex(nibbles(FOTO_PS1.ejemplo))).toEqual(['61', '6f', '66', '16']);
  for (const [a, f] of [
    [ARQ_N64, FOTO_N64],
    [ARQ_PS1, FOTO_PS1],
  ] as const) {
    const bloques = new Set(a.diagrama.bloques.map((x) => x.id));
    const conexiones = new Set(a.diagrama.conexiones.map((x) => x.id));
    expect(f.pasos.length, f.maquina).toBeGreaterThanOrEqual(10);
    expect(f.pasos.length, f.maquina).toBeLessThanOrEqual(16);
    for (const p of f.pasos) {
      for (const b of p.bloques) expect(bloques.has(b), `${f.maquina} ${p.titulo}: ${b}`).toBe(true);
      for (const s of p.senales) expect(conexiones.has(s.id), `${f.maquina} ${p.titulo}: ${s.id}`).toBe(true);
    }
  }
});

test('los registros: las diez máquinas con modelo tienen las dos pestañas; una sin modelo, ninguna, y su carga falla', async () => {
  for (const m of ['nes', 'neogeo', 'sms', 'megadrive', 'gb', 'gbc', 'snes', 'n64', 'ps1'] as IdMaquina[]) {
    expect(tieneArquitectura(m), m).toBe(true);
    expect(tieneFotograma(m), m).toBe(true);
  }
  expect((await cargarArquitectura('n64')).id).toBe('n64');
  expect((await cargarFotograma('ps1')).maquina).toBe('ps1');
  const nada = 'xbox' as IdMaquina;
  expect(tieneArquitectura(nada)).toBe(false);
  expect(tieneFotograma(nada)).toBe(false);
  await expect(cargarArquitectura(nada)).rejects.toThrow('no tiene arquitectura');
  await expect(cargarFotograma(nada)).rejects.toThrow();
});

const valor = (r: Resultado) => (r.tipo === 'valor' ? r.valor : r.tipo);

function banco(id: string, placaId: string, leccion: string, tarjetaId: string) {
  const def = averiaPorId(id)!;
  const l = json(`libro/lecciones11/${leccion}.json`) as LeccionJson;
  const t = l.tarjetas.find((x) => x.id === tarjetaId)!;
  const pads = padsDe(json(`consolas/placas/${placaId}.json`) as PlacaMinima);
  const red = (p: string) => redDePad(pads, p)!;
  const fallo = (f: string) => t.actividad!.fallos.find((x) => x.id === f)!;
  const leer = (con: Record<string, number>, roja: string, negra: string, modo: 'V' | 'Ω') => valor(lectura(def, l, evaluarModelo(l.modelo, con), red(roja), red(negra), modo, modo === 'V'));
  return { def, l, t, fallo, leer, sano: t.actividad!.sano ?? {} };
}

test('Nintendo 64, «No da imagen»: el polímetro en la placa sana y con cada avería', () => {
  expect(averiasDe('n64').map((d) => d.id)).toEqual(['n64-sin-imagen']);
  const { def, l, t, fallo, leer, sano } = banco('n64-sin-imagen', 'n64', 'consola-n64/n64-averias', 'averia-sin-imagen');
  expect(leer(sano, 'U13.1', 'U13.2', 'V')).toBe(12);
  expect(leer(sano, 'U13.3', 'U13.2', 'V')).toBe(5);
  expect(leer(sano, 'U5.4', 'U6.14', 'V')).toBe(5);
  expect(leer(sano, 'U6.6', 'U6.14', 'V')).toBe(3.3);
  expect(leer(sano, 'P4.2', 'U6.14', 'V')).toBe(3.3);
  expect(leer(fallo('fuente-sin-12').con, 'U13.1', 'U13.2', 'V')).toBe(0);
  expect(leer(fallo('fuente-sin-12').con, 'P4.6', 'U6.14', 'V')).toBe(0);
  expect(leer(fallo('regulador-muerto').con, 'U13.1', 'U13.2', 'V')).toBe(12);
  expect(leer(fallo('regulador-muerto').con, 'U13.3', 'U13.2', 'V')).toBe(0);
  expect(leer(fallo('cic-sin-respuesta').con, 'U6.6', 'U6.14', 'V')).toBe(0);
  expect(leer(fallo('cic-sin-respuesta').con, 'U13.3', 'U13.2', 'V')).toBe(5);
  const fmt = (x: number, u: string) => `${x} ${u}`;
  expect(diagnosticar(def, l, t, fallo('regulador-muerto'), 'regulador', new Set(), fmt).bien).toBe(true);
  expect(diagnosticar(def, l, t, fallo('regulador-muerto'), 'fuente', new Set(['entrada']), fmt).bien).toBe(false);
});

test('PlayStation, «Los mandos fallan»: PS605 y PS602 medidos en la PU-18', () => {
  expect(averiasDe('ps1').map((d) => d.id)).toEqual(['ps1-mandos']);
  const { def, l, t, fallo, leer, sano } = banco('ps1-mandos', 'ps1', 'consola-ps1/ps1-averias', 'averia-mandos');
  // healthy: the fuse conducts, 3.3 V and 8 V reach the controllers' connector CN102
  expect(leer(sano, 'PS605.1', 'PS605.2', 'Ω')).toBe(0);
  expect(leer(sano, 'CN102.9', 'CN102.7', 'V')).toBe(3.3);
  expect(leer(sano, 'CN102.4', 'CN102.7', 'V')).toBe(8);
  expect(leer(sano, 'PS605.2', 'CN602.2', 'V')).toBe(3.3);
  // PS605 open: no continuity, no 3.3 V at CN102 but still before the fuse
  const f5 = fallo('ps605-abierto').con;
  expect(leer(f5, 'PS605.1', 'PS605.2', 'Ω')).toBe(Infinity);
  expect(leer(f5, 'CN102.9', 'CN102.7', 'V')).toBe(0);
  expect(leer(f5, 'CN602.3', 'CN602.2', 'V')).toBe(3.3);
  expect(leer(f5, 'CN102.4', 'CN102.7', 'V')).toBe(8);
  // PS602 open: 8 V before the fuse, none after it
  const f2 = fallo('ps602-abierto').con;
  expect(leer(f2, 'CN102.4', 'CN102.7', 'V')).toBe(0);
  expect(leer(f2, 'PS602.2', 'CN102.7', 'V')).toBe(0);
  expect(leer(f2, 'PS602.1', 'CN102.7', 'V')).toBe(8);
  expect(leer(f2, 'CN102.9', 'CN102.7', 'V')).toBe(3.3);
  const fmt = (x: number, u: string) => `${x} ${u}`;
  expect(diagnosticar(def, l, t, fallo('ps602-abierto'), 'ps602', new Set(), fmt).bien).toBe(true);
  expect(diagnosticar(def, l, t, fallo('ps602-abierto'), 'ps605', new Set(['v8']), fmt).bien).toBe(false);
});
