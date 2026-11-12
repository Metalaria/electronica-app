// 1.2 «Brilliant-style» lesson UI (agent ui12): the pure logic of the shell, the living circuit and the identity.
// Node only (no browser, no server):
//   EPA_SIN_SERVIDOR=1 PLAYWRIGHT_BROWSERS_PATH=/tmp/claude-0/pwb npx playwright test -c playwright.lecciones11.config.ts tests/lecciones11-ui12-unidad.spec.ts
//   - lib/leccion12/ritmo.ts: missed cards come back once, before the summary; segments; back from the return round;
//   - lib/aprendizaje/camino.ts dominadaDe: the fourth state of the course map;
//   - lib/leccion12/identidad.ts + tokens11.css: WCAG AA of the new tokens, the voltage scale and the wires of the six
//     blocks in the three themes;
//   - lib/leccion12/cc.ts: the DC solver against every circuit card of the published lessons (their models were checked
//     against ngspice by the generator), the path parser, the known nodes of a non-linear netlist;
//   - lib/leccion12/manipular.ts and lib/leccion12/una-idea.ts.
import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import { contraste, revisarContrastes, tokensPorTema } from '../src/lib/leccion11/contraste.ts';
import { compilarModelo, valoresDeTarjeta } from '../src/lib/leccion11/modelo.ts';
import type { Leccion11, Mando, Tarjeta, WidgetCircuito } from '../src/lib/leccion11/tipos.ts';
import { anotarFallada, anterior, nuevoRitmo, posicion, segmentos, siguiente } from '../src/lib/leccion12/ritmo.ts';
import { dominadaDe } from '../src/lib/aprendizaje/camino.ts';
import { BLOQUES, SERIES, contrasteMinimoEscala, distancia, hiloDeBloque } from '../src/lib/leccion12/identidad.ts';
import { esLineal, nodoDeMedida, nodosConocidos, numeroSpice, puntosDeCamino, resolverCC, valorDC } from '../src/lib/leccion12/cc.ts';
import { mandoDePieza, pasoMando, pasosDeArrastre, pasosDeTecla, piezasManipulables } from '../src/lib/leccion12/manipular.ts';
import { avisosUnaIdea, contarFrases } from '../src/lib/leccion12/una-idea.ts';
import type { DominioConcepto } from '../src/lib/aprendizaje/dominio.ts';
// @ts-expect-error a plain .mjs module of the generator
import { cargarEsquemas11 } from '../scripts/esquemas11.mjs';

const registro = (await cargarEsquemas11()) as typeof import('../src/lib/leccion11/esquemas/registro.ts');
const web = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const raiz = path.join(web, '..');
const css = fs.readFileSync(path.join(web, 'src/estilos/tokens11.css'), 'utf8');

// ------------------------------------------------------------------ rhythm
test.describe('ritmo: las tarjetas falladas vuelven al final', () => {
  test('sin fallos: lección normal hasta el resumen', () => {
    let r = nuevoRitmo();
    const ruta: number[] = [];
    let k = 0;
    while (k !== 4) {
      const p = siguiente(r, k, 5);
      r = p.ritmo;
      k = p.destino;
      ruta.push(k);
      expect(p.fresca).toBe(false);
    }
    expect(ruta).toEqual([1, 2, 3, 4]);
    expect(r.fase).toBe('hecha');
    expect(segmentos(r, 5, 4).map((s) => s.estado)).toEqual(['hecho', 'hecho', 'hecho', 'hecho', 'actual']);
  });

  test('falladas (en el orden de la lección, sin repetir) vuelven una vez, frescas, antes del resumen', () => {
    let r = nuevoRitmo();
    r = anotarFallada(r, 3);
    r = anotarFallada(r, 1);
    r = anotarFallada(r, 3);
    expect(r.falladas).toEqual([3, 1]);
    let p = siguiente(r, 5, 7);
    expect(p).toMatchObject({ destino: 1, fresca: true });
    expect(p.ritmo.fase).toBe('vuelta');
    // a miss in the return round is not noted again
    expect(anotarFallada(p.ritmo, 1)).toBe(p.ritmo);
    const seg = segmentos(p.ritmo, 7, 1);
    expect(seg.length).toBe(9);
    expect(seg.filter((s) => s.vuelta).map((s) => s.k)).toEqual([1, 3]);
    expect(seg.findIndex((s) => s.estado === 'actual')).toBe(6);
    expect(posicion(p.ritmo, 7, 1)).toEqual({ x: 7, de: 9 });
    p = siguiente(p.ritmo, 1, 7);
    expect(p).toMatchObject({ destino: 3, fresca: true });
    expect(posicion(p.ritmo, 7, 3)).toEqual({ x: 8, de: 9 });
    p = siguiente(p.ritmo, 3, 7);
    expect(p).toMatchObject({ destino: 6, fresca: false });
    expect(p.ritmo.fase).toBe('hecha');
    expect(posicion(p.ritmo, 7, 6)).toEqual({ x: 9, de: 9 });
    // after the summary, going back and on again does not bring them back a second time
    const atras = anterior(p.ritmo, 6, 7);
    expect(atras.destino).toBe(5);
    expect(siguiente(atras.ritmo, 5, 7)).toMatchObject({ destino: 6, fresca: false });
  });

  test('atrás desde la primera tarjeta que vuelve: sale de la ronda y la conserva', () => {
    let r = anotarFallada(nuevoRitmo(), 0);
    const p = siguiente(r, 2, 4);
    expect(p).toMatchObject({ destino: 0, fresca: true });
    const a = anterior(p.ritmo, 0, 4);
    expect(a.destino).toBe(2);
    expect(a.ritmo.fase).toBe('normal');
    r = a.ritmo;
    expect(siguiente(r, 2, 4)).toMatchObject({ destino: 0, fresca: true });
  });

  test('el resumen no vuelve nunca y una lección de una sola tarjeta no se rompe', () => {
    const r = anotarFallada(nuevoRitmo(), 4);
    expect(siguiente(r, 3, 5)).toMatchObject({ destino: 4, fresca: false });
    expect(siguiente(nuevoRitmo(), 0, 1).destino).toBe(0);
    expect(segmentos(nuevoRitmo(), 1, 0)).toEqual([{ k: 0, estado: 'actual', vuelta: false }]);
  });
});

// ------------------------------------------------------------------ course map
test.describe('mapa del curso: «dominada»', () => {
  const ahora = Date.UTC(2026, 10, 12, 12);
  const d = (x: Partial<DominioConcepto>): DominioConcepto => ({
    clave: 'cap01/sec-1.4', valor: 0.95, nivel: 'dominado', precision: 0.95, retencion: 0.98, estabilidad: 20, ultima: ahora - 86_400_000, items: 6, rondas: 3, repasar: false, ...x,
  });
  test('nivel «dominado» y sin repaso pendiente', () => {
    expect(dominadaDe(d({}), ahora)).toBe(true);
    expect(dominadaDe(d({ nivel: 'competente' }), ahora)).toBe(false);
    expect(dominadaDe(d({ repasar: true }), ahora)).toBe(false);
    // a review date already reached: due now, not mastered
    expect(dominadaDe(d({ ultima: ahora - 60 * 86_400_000 }), ahora)).toBe(false);
    expect(dominadaDe(null, ahora)).toBe(false);
    expect(dominadaDe(d({ rondas: 0 }), ahora)).toBe(false);
  });
});

// ------------------------------------------------------------------ identity and contrast
test.describe('identidad 4.0/4.1: contraste', () => {
  test('los tokens nuevos cumplen AA (la lista de pares incluye rojo, violeta, bloque y la escala)', () => {
    expect(revisarContrastes(css)).toEqual([]);
    const t = tokensPorTema(css);
    expect(t.claro.tinta).toBe('#1b1f27');
    expect(t.claro['tinta-suave']).toBe('#5b6472');
    expect(t.claro.rojo).toBe('#b3261e');
    expect(t.claro.verde).toBe('#1c7a4b');
    expect(t.claro.violeta).toBe('#6a45c0');
    expect(css).toContain("'JetBrains Mono'");
  });

  test('cada paso de la escala de tensiones ≥ 3:1 sobre el panel, en los tres temas', () => {
    const temas = tokensPorTema(css);
    const out: Record<string, number> = {};
    for (const [tema, tk] of Object.entries(temas)) {
      const e = { neg: tk['tension-neg']!, cero: tk['tension-cero']!, pos: tk['tension-pos']! };
      out[tema] = Math.round(contrasteMinimoEscala(e, tk.panel!, 40) * 100) / 100;
      expect(out[tema], tema).toBeGreaterThanOrEqual(3);
    }
    console.log('escala de tensiones, contraste mínimo sobre el panel:', JSON.stringify(out));
  });

  test('los hilos en el color de cada bloque: ≥ 3:1 sobre panel y fondo y lejos de los colores de serie', () => {
    const temas = tokensPorTema(css);
    const peor: Record<string, number> = {};
    for (const tema of ['claro', 'sepia', 'oscuro'] as const) {
      const tk = temas[tema];
      for (const b of BLOQUES) {
        const h = hiloDeBloque(b, tema);
        const c = Math.min(contraste(h, tk.panel!), contraste(h, tk.fondo!));
        peor[tema] = Math.min(peor[tema] ?? Infinity, Math.round(c * 100) / 100);
        expect(c, `${tema} ${b} ${h}`).toBeGreaterThanOrEqual(3);
        for (const s of SERIES) expect(distancia(h, s), `${tema} ${b} frente a ${s}`).toBeGreaterThan(0.08);
      }
    }
    console.log('hilos por bloque, contraste mínimo:', JSON.stringify(peor));
    expect(hiloDeBloque('nada', 'claro')).toBe(hiloDeBloque('1a3a5c', 'claro'));
  });
});

// ------------------------------------------------------------------ DC solver
test.describe('circuito vivo: el punto de trabajo en continua', () => {
  test('números SPICE, valores DC y caminos', () => {
    expect(numeroSpice('1.5k')).toBe(1500);
    expect(numeroSpice('10meg')).toBe(1e7);
    expect(numeroSpice('2.2e-9')).toBeCloseTo(2.2e-9, 20);
    expect(numeroSpice('4.7uF')).toBeCloseTo(4.7e-6, 15);
    expect(Number.isNaN(numeroSpice('DX'))).toBe(true);
    expect(valorDC(['DC', '12'])).toBe(12);
    expect(valorDC(['0'])).toBe(0);
    expect(valorDC(['DC', '0', 'SIN(0', '5', '50)'])).toBe(0);
    expect(valorDC(['PULSE(1', '5', '0)'])).toBe(1);
    expect(puntosDeCamino('M40 230 V50 H190 V230 Z')).toEqual([[40, 230], [40, 50], [190, 50], [190, 230], [40, 230]]);
    expect(puntosDeCamino('M10 10 l5 0 v5 h-5 z')).toEqual([[10, 10], [15, 10], [15, 15], [10, 15], [10, 10]]);
    expect(nodoDeMedida('v(salida)')).toBe('salida');
    expect(nodoDeMedida('v(a)-v(b)')).toBeNull();
  });

  test('divisor 12 V, 10 kΩ / 5 kΩ: 4 V y 0,8 mA; un nodo flotante no rompe el sistema', () => {
    const s = resolverCC(['VF fte 0 DC 12', 'VMED fte ent 0', 'R1 ent salida 10000', 'VABAJO salida b 0', 'R2 b 0 5000', 'C1 x 0 1e-6'])!;
    expect(s.nodos.salida).toBeCloseTo(4, 6);
    expect(s.nodos.x).toBe(0);
    expect(s.corrientes.vmed).toBeCloseTo(8e-4, 9);
    expect(s.corrientes.vabajo).toBeCloseTo(8e-4, 9);
    expect(resolverCC(['VF a 0 DC 5', 'R1 a an 1000', 'D1 an 0 DX'])).toBeNull();
    expect(esLineal(['VF a 0 DC 5', 'D1 a 0 DX'])).toBe(false);
    expect(nodosConocidos(['VF fte 0 DC 5', 'VMED fte a 0', 'R1 a an 1000', 'D1 an 0 DX'], {})).toEqual({ '0': 0, fte: 5, a: 5 });
  });

  test('frente al modelo de cada tarjeta de circuito publicada (comprobado con ngspice por el generador)', () => {
    let tarjetas = 0;
    let medidas = 0;
    const saltadas: string[] = [];
    const dirYaml = path.join(raiz, 'contenido/lecciones11');
    for (const parte of fs.readdirSync(dirYaml).filter((x) => /^cap\d+$/.test(x))) {
      for (const f of fs.readdirSync(path.join(dirYaml, parte)).filter((x) => x.endsWith('.yaml'))) {
        const fuente = parse(fs.readFileSync(path.join(dirYaml, parte, f), 'utf8')) as { tarjetas: { id: string; widget?: { tipo: string; mide?: Record<string, string> } }[] };
        const json = path.join(web, 'public/libro/lecciones11', parte, f.replace(/\.yaml$/, '.json'));
        if (!fs.existsSync(json)) continue;
        const l = JSON.parse(fs.readFileSync(json, 'utf8')) as Leccion11;
        const mc = compilarModelo(l.modelo);
        const base: Record<string, number> = {};
        for (const [k, v] of Object.entries(l.modelo.valores)) base[k] = v.valor;
        let propios = { ...base };
        for (const t of l.tarjetas as Tarjeta[]) {
          propios = { ...propios, ...t.inicio };
          const w = t.widget as WidgetCircuito | undefined;
          const mide = fuente.tarjetas.find((x) => x.id === t.id)?.widget?.mide;
          if (w?.tipo !== 'circuito' || !mide) continue;
          const def = registro.esquemaDe(w.esquema)!;
          const v = mc.evaluar(valoresDeTarjeta(t, propios));
          const ctx = { p: (q: string) => (w.piezas[q] ? (v[w.piezas[q]!] ?? 0) : 0), tiene: (q: string) => q in w.piezas, cerrado: (q: string) => !w.piezas[q] || (v[w.piezas[q]!] ?? 0) !== 0 };
          const lineas = def.netlist(ctx, 'op');
          if (!esLineal(lineas) || lineas.some((x) => /sin\s*\(|pulse|ic\s*=/i.test(x))) {
            saltadas.push(`${parte}/${f}#${t.id}`);
            continue;
          }
          const s = resolverCC(lineas);
          expect(s, `${parte}/${f}#${t.id}`).not.toBeNull();
          tarjetas++;
          for (const [obs, calc] of Object.entries(mide)) {
            const o = def.observables[obs];
            if (!o || o.analisis !== 'op') continue;
            const m = /^(-?)([vi])\(([a-z0-9_]+)\)$/i.exec(o.medida.trim());
            if (!m) continue;
            const x = (m[2]!.toLowerCase() === 'v' ? s!.nodos[m[3]!.toLowerCase()] : s!.corrientes[m[3]!.toLowerCase()])! * (m[1] ? -1 : 1);
            const y = v[calc]!;
            expect(Math.abs(x - y), `${parte}/${f}#${t.id} ${obs} = ${o.medida}: ${x} frente a ${calc} = ${y}`).toBeLessThanOrEqual(1e-3 * Math.abs(y) + 1e-9);
            medidas++;
          }
        }
      }
    }
    console.log(`resolverCC: ${tarjetas} tarjetas lineales, ${medidas} medidas iguales al modelo; ${saltadas.length} no lineales, de alterna o transitorias (solo nodos conocidos)`);
    expect(tarjetas).toBeGreaterThan(20);
    expect(medidas).toBeGreaterThan(20);
  });
});

// ------------------------------------------------------------------ direct manipulation
test.describe('manipulación directa', () => {
  const r2: Mando = { valor: 'R_2', tipo: 'deslizador', valores: [1000, 1200, 1500, 1800, 2200, 2700, 3300], serie: 'E12' };
  const w: WidgetCircuito = {
    tipo: 'circuito', esquema: 'divisor', piezas: { fuente: 'V_in', arriba: 'R_1', abajo: 'R_2', carga: 'R_L', interruptor: 'carga' }, ocultar: false,
    mandos: [r2, { valor: 'carga', tipo: 'conectar', valores: [0, 1] }],
  };
  test('qué piezas se tocan y con qué mando', () => {
    expect(mandoDePieza(w, 'abajo')).toBe(r2);
    expect(mandoDePieza(w, 'arriba')).toBeNull();
    expect(piezasManipulables(w).map((x) => x.pieza)).toEqual(['abajo', 'interruptor']);
  });
  test('pasos en la serie E, con tope; arrastre y teclas', () => {
    expect(pasoMando(r2, 1500, 1)).toBe(1800);
    expect(pasoMando(r2, 1490, 1)).toBe(1800);
    expect(pasoMando(r2, 1500, -10)).toBe(1000);
    expect(pasoMando(r2, 3300, 3)).toBe(3300);
    expect(pasosDeArrastre(r2, 0, -60)).toBeGreaterThan(0);
    expect(pasosDeArrastre(r2, -60, 10)).toBeLessThan(0);
    expect(pasosDeArrastre(r2, 3, 2)).toBe(0);
    expect(pasosDeTecla(r2, 'ArrowUp')).toBe(1);
    expect(pasosDeTecla(r2, 'PageDown')).toBe(-1);
    expect(pasosDeTecla(r2, 'End')).toBe('fin');
    expect(pasosDeTecla(r2, 'a')).toBeNull();
  });
});

// ------------------------------------------------------------------ one idea per screen
test.describe('una idea por pantalla', () => {
  const tx = (s: string) => [{ t: 'txt' as const, s }];
  const base: Tarjeta = { id: 'x', tipo: 'explorar', fase: 'Explore', titulo: tx('Divisor'), texto: tx('Mueva R₂.'), libro: [], fijar: {}, inicio: {}, widget: { tipo: 'grafica' } as Tarjeta['widget'] };
  test('una tarjeta corta con su visual no avisa; sin visual, con tres frases o larga, sí', () => {
    expect(avisosUnaIdea(base)).toEqual([]);
    expect(avisosUnaIdea({ ...base, widget: undefined })).toHaveLength(1);
    expect(avisosUnaIdea({ ...base, texto: tx('Una. Dos. Tres.') })[0]).toContain('3 frases');
    expect(avisosUnaIdea({ ...base, texto: tx('palabra '.repeat(45)) })[0]).toContain('palabras');
    expect(avisosUnaIdea({ ...base, tipo: 'resumen', widget: undefined })).toEqual([]);
    expect(contarFrases('Con 1.5 V, p. ej. una pila. Fíjese.')).toBe(2);
  });
  test('las lecciones de Fundamentos publicadas: cuántos avisos darían (informativo)', () => {
    let n = 0;
    let tarjetas = 0;
    const tipos: Record<string, number> = {};
    const dir = path.join(web, 'public/libro/lecciones11');
    for (const parte of fs.readdirSync(dir).filter((x) => /^cap\d+$/.test(x)))
      for (const f of fs.readdirSync(path.join(dir, parte))) {
        const l = JSON.parse(fs.readFileSync(path.join(dir, parte, f), 'utf8')) as Leccion11;
        for (const t of l.tarjetas) {
          tarjetas++;
          const av = avisosUnaIdea(t);
          n += av.length;
          for (const x of av) {
            const k = `${t.tipo}: ${x.replace(/\d+/g, 'N').slice(0, 48)}`;
            tipos[k] = (tipos[k] ?? 0) + 1;
          }
        }
      }
    console.log(`una idea por pantalla: ${n} avisos en ${tarjetas} tarjetas publicadas`, JSON.stringify(tipos));
    expect(tarjetas).toBeGreaterThan(500);
  });
});
