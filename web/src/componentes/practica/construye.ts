// 1.0 «Reto de montar el circuito»: what a built circuit measures and whether it meets the specification of the
// book's design exercise. The circuit is any netlist (the breadboard's, through editor/netlist.ts); it is reduced to
// its operating point with every device current saved, and each condition is checked on what was measured — values,
// any valid choice of them — and, since reviews 10d/10g, on the shape the exercise asks: a divider of n resistors with
// R₁ on top, a bridge of four arms, one LED with one series resistor, the load across the Zener (all of it), the base
// divider of 6.2, and nothing more («sobrantes»: no part across the supply, none with a leg in the air, one source).
// Pure: the generator (web/scripts/retos10.mjs), the app (Construye.svelte) and the tests use it.

import { lineasNetlist, numeroSpice } from '../../simulador/motor/netlist.ts';
import { modeloPorNombre } from '../editor/modelos.ts';
import { formatoValor } from '../calculadoras/unidades.ts';
import type { Condicion } from './tipos.ts';

export interface ElementoMedido {
  /** Instance name as in the netlist («R1», «D2»). */
  nombre: string;
  tipo: 'R' | 'D' | 'V' | 'I' | 'Q' | 'otro';
  /** Value (R: Ω; V, I: the DC value). */
  valor: number | null;
  /** Diodes: model name and its family (LED, DZ, D…). */
  modelo?: string;
  familia?: string;
  a: string;
  b: string;
  /** Current from a to b inside the element (A); diodes: anode → cathode. */
  corriente: number | null;
  /** V(a) − V(b). */
  tension: number | null;
  /** Bipolar transistors: a = collector, b = base, `emisor`, the collector current and V(C) − V(E). */
  emisor?: string;
  vce?: number | null;
}

export interface MedidaCircuito {
  /** Node voltages by lower-case node name ('0' is ground). */
  nodos: Record<string, number>;
  elementos: ElementoMedido[];
}

const ANALISIS = /^\.(op|tran|ac|dc|noise|tf|pz|sens|four|disto|sp|pss|meas|measure|print|plot|probe|save|step|options|end)\b/i;

/** The netlist reduced to its operating point with every device current saved (`.options savecurrents`). */
export function netlistMedida(texto: string): string {
  const out: string[] = [];
  let enControl = false;
  for (const l of texto.replace(/\r\n?/g, '\n').split('\n')) {
    const s = l.trim();
    if (/^\.control\b/i.test(s)) {
      enControl = true;
      continue;
    }
    if (enControl) {
      if (/^\.endc\b/i.test(s)) enControl = false;
      continue;
    }
    if (ANALISIS.test(s)) continue;
    out.push(l);
  }
  out.push('.options savecurrents', '.op', '.end');
  return out.join('\n') + '\n';
}

/** What the run measured: node voltages and, for every top-level two-terminal element, value, current and voltage. */
export function medidaDeOp(texto: string, vectores: Map<string, number>): MedidaCircuito {
  const nodos: Record<string, number> = { '0': 0 };
  for (const [k, v] of vectores) {
    const m = /^v\((.+)\)$/.exec(k);
    if (m) nodos[m[1]!] = v;
    else if (!k.includes('(') && !k.includes('[') && !k.includes('#')) nodos[k] = v;
  }
  const v = (n: string): number | null => (n === '0' || n === 'gnd' ? 0 : (nodos[n] ?? null));
  // ngspice names a saved device current «@r1[i]» or «i(@r1[i])» depending on the run
  const dispositivo = (k: string): number | undefined => vectores.get(k) ?? vectores.get(`i(${k})`);
  const elementos: ElementoMedido[] = [];
  for (const l of lineasNetlist(texto).lineas) {
    if (l.subckt) continue;
    const t = l.tokens;
    const nombre = t[0] ?? '';
    const c = nombre[0]?.toUpperCase();
    if (!c || !/[RDVIQ]/.test(c) || t.length < 3) continue;
    const a = t[1]!.toLowerCase();
    const b = t[2]!.toLowerCase();
    const n = nombre.toLowerCase();
    const va = v(a);
    const vb = v(b);
    const tension = va != null && vb != null ? va - vb : null;
    if (c === 'Q') {
      // «Q1 c b e [s] modelo»: collector current and V(C) − V(E)
      if (t.length < 5) continue;
      const e = t[3]!.toLowerCase();
      const ve = v(e);
      const modelo = t[t.length - 1] ?? '';
      const familia = modeloPorNombre(modelo)?.familia ?? '';
      elementos.push({ nombre, tipo: 'Q', valor: null, modelo, familia, a, b, emisor: e, corriente: dispositivo(`@${n}[ic]`) ?? null, tension, vce: va != null && ve != null ? va - ve : null });
    } else if (c === 'R') {
      const valor = numeroSpice(t[3] ?? '');
      const i = dispositivo(`@${n}[i]`) ?? (tension != null && valor ? tension / valor : null);
      elementos.push({ nombre, tipo: 'R', valor, a, b, corriente: i ?? null, tension });
    } else if (c === 'D') {
      const modelo = t[3] ?? '';
      const familia = modeloPorNombre(modelo)?.familia ?? (/led/i.test(modelo) ? 'LED' : /^dz/i.test(modelo) ? 'DZ' : 'D');
      elementos.push({ nombre, tipo: 'D', valor: null, modelo, familia, a, b, corriente: dispositivo(`@${n}[id]`) ?? null, tension });
    } else {
      // «V1 a b dc 12», «V1 a b 12»: the first number after the nodes
      let valor: number | null = null;
      for (const k of t.slice(3)) {
        const x = numeroSpice(k);
        if (x != null) {
          valor = x;
          break;
        }
        if (!/^dc$/i.test(k)) break;
      }
      const i = vectores.get(`${n}#branch`) ?? vectores.get(`i(${n})`) ?? null;
      elementos.push({ nombre, tipo: c === 'V' ? 'V' : 'I', valor, a, b, corriente: i, tension });
    }
  }
  return { nodos, elementos };
}

export interface ResultadoCondicion {
  cond: Condicion;
  bien: boolean;
  /** Spanish, «usted», plain text: what it measured and, when it fails, what to change. */
  mensaje: string;
}

const t = (v: number, u: string) => formatoValor(v, u, 3, true);
const pct = (x: number) => `${Math.round(x * 100)} %`;

const E12 = [1.0, 1.2, 1.5, 1.8, 2.2, 2.7, 3.3, 3.9, 4.7, 5.6, 6.8, 8.2];
/** Whether a resistance is a value of the E12 series (0,5 % for rounding). */
export function esE12(r: number): boolean {
  if (!(r > 0)) return false;
  const m = r / 10 ** Math.floor(Math.log10(r) + 1e-9);
  return E12.some((x) => Math.abs(m - x) / x < 0.005) || Math.abs(m - 10) < 0.05;
}

/** Each condition checked on the measured circuit; `bien` when all of them hold. */
export function comprobarConstruccion(conds: Condicion[], m: MedidaCircuito): { bien: boolean; resultados: ResultadoCondicion[] } {
  const res = conds.map((c) => comprobarUna(c, m));
  return { bien: res.every((r) => r.bien), resultados: res };
}

function comprobarUna(c: Condicion, m: MedidaCircuito): ResultadoCondicion {
  const rs = m.elementos.filter((e) => e.tipo === 'R');
  const fuentes = m.elementos.filter((e) => e.tipo === 'V');
  // the sources' + terminals and the − side (ground included)
  const positivos = new Set(fuentes.map((f) => ((f.valor ?? 0) >= 0 ? f.a : f.b)).filter((n) => n !== '0' && n !== 'gnd'));
  const negativos = new Set(['0', 'gnd', ...fuentes.map((f) => ((f.valor ?? 0) >= 0 ? f.b : f.a))]);
  const fijosTodos = new Set([...positivos, ...negativos]);
  const tensionNodo = (n: string) => (n === '0' || n === 'gnd' ? 0 : (m.nodos[n] ?? NaN));
  const valorEs = (r: ElementoMedido, v: number) => r.valor != null && Math.abs(r.valor - v) <= 0.005 * v;
  const nombres = (xs: ElementoMedido[]) => xs.map((x) => x.nombre).join(', ');
  switch (c.k) {
    case 'fuente': {
      const ok = fuentes.find((f) => f.valor != null && Math.abs(Math.abs(f.valor) - c.valor) <= 0.005 * c.valor);
      if (ok) return { cond: c, bien: true, mensaje: `La fuente es de ${t(c.valor, 'V')}.` };
      if (!fuentes.length) return { cond: c, bien: false, mensaje: `Falta la fuente: el reto pide alimentar el circuito con ${t(c.valor, 'V')}.` };
      return { cond: c, bien: false, mensaje: `El reto pide una fuente de ${t(c.valor, 'V')}; la suya da ${t(Math.abs(fuentes[0]!.valor ?? 0), 'V')}.` };
    }
    case 'nodo': {
      // the nodes the parts make: not ground, not held directly by a source
      const fijos = new Set(['0', 'gnd', ...fuentes.flatMap((f) => [f.a, f.b])]);
      const libres = Object.entries(m.nodos).filter(([n, v]) => !fijos.has(n) && Number.isFinite(v) && !n.includes('#'));
      if (!libres.length)
        return { cond: c, bien: false, mensaje: `Su circuito no tiene ningún punto entre las piezas, aparte de los de la fuente: ${c.nombre} necesita uno (por ejemplo, entre dos resistencias en serie).` };
      let mejor = libres[0]!;
      for (const x of libres) if (Math.abs(Math.abs(x[1]) - c.valor) < Math.abs(Math.abs(mejor[1]) - c.valor)) mejor = x;
      const v = Math.abs(mejor[1]);
      const rel = (v - c.valor) / c.valor;
      if (Math.abs(rel) <= c.tol + 1e-12) return { cond: c, bien: true, mensaje: `${mayuscula(c.nombre)} está a ${t(v, 'V')}: dentro de ${t(c.valor, 'V')} ± ${pct(c.tol)}.` };
      return {
        cond: c,
        bien: false,
        mensaje: `Ningún punto de su circuito está a ${t(c.valor, 'V')} ± ${pct(c.tol)}: el más cercano está a ${t(v, 'V')} (${rel > 0 ? '+' : '−'}${pct(Math.abs(rel))}).`,
      };
    }
    case 'led': {
      const leds = m.elementos.filter((e) => e.tipo === 'D' && e.familia === 'LED');
      if (!leds.length) return { cond: c, bien: false, mensaje: 'Falta el LED.' };
      // review 10g: the exercise is one LED with its series resistor — not two LEDs in series (which pass the same
      // current with another resistor), and the whole supply current goes through the LED (no other path)
      if (leds.length > 1) return { cond: c, bien: false, mensaje: `El ejercicio pide un solo LED con su resistencia limitadora; su circuito tiene ${leds.length} (${nombres(leds)}).` };
      if (rs.length !== 1)
        return { cond: c, bien: false, mensaje: `El ejercicio pide una sola resistencia limitadora en serie con el LED; su circuito tiene ${rs.length}.` };
      const i = leds[0]!.corriente ?? 0;
      if (i < 1e-4) return { cond: c, bien: false, mensaje: 'El LED no se enciende: no pasa corriente por él. Mire que no esté al revés (la pata larga, el ánodo, hacia el +) y que el circuito esté cerrado hasta el −.' };
      const iFuente = fuentes.length === 1 ? Math.abs(fuentes[0]!.corriente ?? 0) : null;
      if (iFuente != null && iFuente > 1.02 * i + 1e-6)
        return { cond: c, bien: false, mensaje: `La fuente da ${t(iFuente, 'A')} y por el LED solo pasan ${t(i, 'A')}: hay otro camino aparte del LED y su resistencia en serie. Toda la corriente tiene que pasar por el LED.` };
      const rel = (i - c.corriente) / c.corriente;
      if (Math.abs(rel) <= c.tol + 1e-12) return { cond: c, bien: true, mensaje: `Por el LED pasan ${t(i, 'A')}: dentro de ${t(c.corriente, 'A')} ± ${pct(c.tol)}.` };
      return {
        cond: c,
        bien: false,
        mensaje: `Por el LED pasan ${t(i, 'A')} y el reto pide ${t(c.corriente, 'A')} ± ${pct(c.tol)}: para que pase ${rel > 0 ? 'menos' : 'más'} corriente, la resistencia en serie tiene que ser ${rel > 0 ? 'mayor' : 'menor'}.`,
      };
    }
    case 'zener': {
      const zs = m.elementos.filter((e) => e.tipo === 'D' && e.familia === 'DZ');
      if (!zs.length) return { cond: c, bien: false, mensaje: 'Falta el diodo Zener.' };
      if (zs.length > 1) return { cond: c, bien: false, mensaje: `El regulador lleva un solo Zener; su circuito tiene ${zs.length} (${nombres(zs)}).` };
      // a Zener regulates in reverse: current from cathode to anode
      const i = Math.max(...zs.map((e) => -(e.corriente ?? 0)));
      if (i < 1e-5 && zs.some((e) => (e.corriente ?? 0) > 1e-4))
        return { cond: c, bien: false, mensaje: 'El Zener conduce en directa: está al revés. Para regular, el cátodo (la franja) va hacia el lado positivo.' };
      if (c.max != null && i > c.max)
        return { cond: c, bien: false, mensaje: `Por el Zener pasan ${t(i, 'A')}: más de los ${t(c.max, 'A')} que pide el reto, así que la resistencia serie tiene que ser mayor (o la carga consumir más).` };
      if (c.max != null && i >= c.min) return { cond: c, bien: true, mensaje: `Por el Zener pasan ${t(i, 'A')}: entre ${t(c.min, 'A')} y ${t(c.max, 'A')}.` };
      if (i >= c.min) return { cond: c, bien: true, mensaje: `Por el Zener pasan ${t(i, 'A')}: al menos los ${t(c.min, 'A')} que necesita para regular.` };
      return { cond: c, bien: false, mensaje: `Por el Zener solo pasan ${t(Math.max(0, i), 'A')}: necesita al menos ${t(c.min, 'A')} para regular, así que la resistencia serie tiene que ser menor.` };
    }
    case 'carga': {
      // review 10g: the load is EVERYTHING the regulated output feeds — the current that leaves the Zener's cathode
      // node through anything but the Zener (two loads in parallel add up; a load of two parts in series or parallel
      // counts whole)
      const zs = m.elementos.filter((e) => e.tipo === 'D' && e.familia === 'DZ');
      const z = zs.reduce<ElementoMedido | null>((x, y) => (!x || -(y.corriente ?? 0) > -(x.corriente ?? 0) ? y : x), null);
      if (!z) return { cond: c, bien: false, mensaje: 'Falta el diodo Zener: la carga va en paralelo con él.' };
      const salida = tensionNodo(z.a) >= tensionNodo(z.b) ? z.a : z.b;
      const sale = (e: ElementoMedido) => {
        const i = e.corriente ?? 0;
        if (e.tipo === 'Q') return 0;
        return e.a === salida ? i : e.b === salida ? -i : 0;
      };
      const cargas = m.elementos.filter((e) => e !== z && e.familia !== 'DZ' && e.tipo !== 'V' && e.tipo !== 'I' && sale(e) > 1e-6);
      if (!cargas.length)
        return { cond: c, bien: false, mensaje: 'Falta la resistencia de carga: va en paralelo con el Zener (entre la salida regulada y el −), aparte de la resistencia serie.' };
      const i = cargas.reduce((x, e) => x + sale(e), 0);
      const quien = cargas.length === 1 ? `La carga (${cargas[0]!.nombre})` : `La carga (${nombres(cargas)}, juntas)`;
      const rel = (i - c.corriente) / c.corriente;
      if (Math.abs(rel) <= c.tol + 1e-12) return { cond: c, bien: true, mensaje: `${quien} consume ${t(i, 'A')}: dentro de ${t(c.corriente, 'A')} ± ${pct(c.tol)}.` };
      return { cond: c, bien: false, mensaje: `${quien} consume ${t(i, 'A')} y el reto pide ${t(c.corriente, 'A')} ± ${pct(c.tol)}: para que consuma ${i > c.corriente ? 'menos' : 'más'}, su resistencia tiene que ser ${i > c.corriente ? 'mayor' : 'menor'}.` };
    }
    case 'divisor': {
      // review 10g: the divider as the exercise has it — exactly n resistors, one from the + to the output and the
      // rest from the output to the − (the load of 2.8 in parallel with the lower one), `arriba` the value of the upper
      // one and `valor` that of all of them when the exercise fixes them
      const forma =
        c.n === 2 ? 'una resistencia del + a la salida y otra de la salida al −' : `una resistencia del + a la salida y ${c.n - 1} de la salida al − (la de abajo y la carga, en paralelo)`;
      if (rs.length !== c.n) return { cond: c, bien: false, mensaje: `El ejercicio es un divisor de ${c.n} resistencias (${forma}); su circuito tiene ${rs.length}.` };
      const libres = [...new Set(rs.flatMap((r) => [r.a, r.b]).filter((n) => !fijosTodos.has(n)))];
      const entre = (r: ElementoMedido, x: Set<string>, o: string) => (x.has(r.a) && r.b === o) || (x.has(r.b) && r.a === o);
      const o = libres.length === 1 ? libres[0]! : null;
      const arriba = o ? rs.filter((r) => entre(r, positivos, o)) : [];
      const abajo = o ? rs.filter((r) => entre(r, negativos, o)) : [];
      if (!o || arriba.length !== 1 || abajo.length !== c.n - 1)
        return { cond: c, bien: false, mensaje: `Un divisor es ${forma}: en su circuito las resistencias no están así.` };
      if (c.valor != null && rs.some((r) => !valorEs(r, c.valor!)))
        return { cond: c, bien: false, mensaje: `Las ${c.n} resistencias del ejercicio son de ${t(c.valor, 'Ω')}; en su circuito ${nombres(rs.filter((r) => !valorEs(r, c.valor!)))} no.` };
      if (c.arriba != null && !valorEs(arriba[0]!, c.arriba))
        return { cond: c, bien: false, mensaje: `La resistencia de arriba (del + a la salida, R₁) tiene que ser la de ${t(c.arriba, 'Ω')}; la suya, ${arriba[0]!.nombre}, es de ${t(arriba[0]!.valor ?? 0, 'Ω')}.` };
      return { cond: c, bien: true, mensaje: `Es un divisor: ${arriba[0]!.nombre} del + a la salida y ${nombres(abajo)} de la salida al −.` };
    }
    case 'sobrantes': {
      // review 10g: nothing more than the exercise's circuit — no part straight across the supply (or with both legs on
      // one node) and none with a leg in the air (a node nothing else touches)
      const nodosDe = (e: ElementoMedido) => (e.tipo === 'Q' ? [e.a, e.b, e.emisor ?? ''] : [e.a, e.b]);
      const grado = new Map<string, number>();
      for (const e of m.elementos) for (const n of new Set(nodosDe(e))) grado.set(n, (grado.get(n) ?? 0) + 1);
      const piezas = m.elementos.filter((e) => e.tipo !== 'V' && e.tipo !== 'I');
      const fuentesTodas = m.elementos.filter((e) => e.tipo === 'V' || e.tipo === 'I');
      if (fuentesTodas.length > 1)
        return { cond: c, bien: false, mensaje: `Sobra ${nombres(fuentesTodas.slice(1))}: el ejercicio se alimenta con una sola fuente.` };
      const directa = piezas.filter((e) => e.tipo !== 'Q' && ((positivos.has(e.a) && negativos.has(e.b)) || (positivos.has(e.b) && negativos.has(e.a))));
      const corto = piezas.filter((e) => e.tipo !== 'Q' && e.a === e.b);
      const alAire = piezas.filter((e) => nodosDe(e).some((n) => !fijosTodos.has(n) && (grado.get(n) ?? 0) < 2));
      if (directa.length) return { cond: c, bien: false, mensaje: `Sobra ${nombres(directa)}: está directamente entre el + y el − de la fuente, fuera del circuito del ejercicio.` };
      if (corto.length) return { cond: c, bien: false, mensaje: `${nombres(corto)} tiene las dos patas en el mismo punto: no hace nada; quítela o colóquela bien.` };
      if (alAire.length) return { cond: c, bien: false, mensaje: `${nombres(alAire)} tiene una pata al aire (en una fila sin nada más): conéctela o quítela.` };
      return { cond: c, bien: true, mensaje: 'No sobra ninguna pieza.' };
    }
    case 'resistencia': {
      if (rs.some((r) => r.valor != null && Math.abs(r.valor - c.valor) <= 0.005 * c.valor)) return { cond: c, bien: true, mensaje: `Usa una resistencia de ${t(c.valor, 'Ω')}.` };
      return { cond: c, bien: false, mensaje: `El reto pide usar una resistencia de ${t(c.valor, 'Ω')}.` };
    }
    case 'e12': {
      const malas = rs.filter((r) => r.valor == null || !esE12(r.valor));
      if (!rs.length) return { cond: c, bien: false, mensaje: 'Su circuito no tiene resistencias.' };
      if (!malas.length) return { cond: c, bien: true, mensaje: 'Todas las resistencias son de la serie E12.' };
      return { cond: c, bien: false, mensaje: `${malas.map((r) => (r.valor != null ? t(r.valor, 'Ω') : r.nombre)).join(', ')} no ${malas.length > 1 ? 'son valores' : 'es un valor'} de la serie E12.` };
    }
    case 'resistencias': {
      const n = rs.filter((r) => r.valor != null && Math.abs(r.valor - c.valor) <= 0.005 * c.valor).length;
      if (n >= c.n) return { cond: c, bien: true, mensaje: `Usa ${n} resistencias de ${t(c.valor, 'Ω')}.` };
      return { cond: c, bien: false, mensaje: `El reto pide ${c.n} resistencias de ${t(c.valor, 'Ω')}; su circuito tiene ${n}.` };
    }
    case 'puente': {
      const vmax = Math.max(1e-9, ...fuentes.map((f) => Math.abs(f.valor ?? 0)));
      const fijos = new Set(['0', 'gnd', ...fuentes.flatMap((f) => [f.a, f.b])]);
      // the bridge's midpoints: nodes between the parts, well inside the supply
      const enMedio = Object.entries(m.nodos).filter(([n, v]) => !fijos.has(n) && !n.includes('#') && Math.abs(v) > 0.05 * vmax && Math.abs(v) < 0.95 * vmax);
      if (enMedio.length < 2)
        return { cond: c, bien: false, mensaje: 'Un puente tiene dos ramas, cada una con su punto medio: su circuito tiene menos de dos puntos intermedios.' };
      // review 10d: a midpoint is fed through a current-carrying resistor from above and drains through one below
      // (a dangling resistor's free end is not one), and the two midpoints are on different branches: no path of
      // current-carrying resistors joins them except through the supply (two nodes of one chain are not a bridge)
      const iMax = Math.max(0, ...rs.map((r) => Math.abs(r.corriente ?? 0)));
      const conducen = rs.filter((r) => Math.abs(r.corriente ?? 0) > Math.max(1e-6, 0.01 * iMax));
      const otro = (r: ElementoMedido, n: string) => (r.a === n ? r.b : r.a);
      const alimentado = (n: string) => {
        const v = tensionNodo(n);
        const suyas = conducen.filter((r) => r.a === n || r.b === n);
        return suyas.some((r) => tensionNodo(otro(r, n)) > v) && suyas.some((r) => tensionNodo(otro(r, n)) < v);
      };
      const raiz = new Map<string, string>();
      const buscar = (n: string): string => {
        let x = n;
        while (raiz.has(x) && raiz.get(x) !== x) x = raiz.get(x)!;
        return x;
      };
      for (const r of conducen) if (!fijos.has(r.a) && !fijos.has(r.b)) raiz.set(buscar(r.a), buscar(r.b));
      const medios = enMedio.filter(([n]) => alimentado(n));
      let mejor = Infinity;
      let par: [string, number][] = [];
      for (let i = 0; i < medios.length; i++)
        for (let j = i + 1; j < medios.length; j++) {
          if (buscar(medios[i]![0]) === buscar(medios[j]![0])) continue;
          const d = Math.abs(medios[i]![1] - medios[j]![1]);
          if (d < mejor) {
            mejor = d;
            par = [medios[i]!, medios[j]!];
          }
        }
      if (!par.length)
        return {
          cond: c,
          bien: false,
          mensaje: 'Un puente tiene dos ramas entre el + y el −, cada una con dos resistencias y su punto medio: en su circuito no hay dos puntos medios en ramas distintas por las que pase corriente.',
        };
      // review 10g: the four arms are the bridge's — one resistor from each midpoint to the + and one to the −, of the
      // exercise's value — and the only other resistor allowed is a detector between the two midpoints
      if (c.valor != null) {
        const [x, y] = [par[0]![0], par[1]![0]];
        const brazos = [x, y].flatMap((n) => [rs.filter((r) => (r.a === n && positivos.has(r.b)) || (r.b === n && positivos.has(r.a))), rs.filter((r) => (r.a === n && negativos.has(r.b)) || (r.b === n && negativos.has(r.a)))]);
        if (brazos.some((b) => b.length !== 1))
          return { cond: c, bien: false, mensaje: 'Cada rama del puente es una resistencia del + al punto medio y otra del punto medio al −: en su circuito no están así.' };
        const cuatro = brazos.map((b) => b[0]!);
        const malas = cuatro.filter((r) => !valorEs(r, c.valor!));
        if (malas.length) return { cond: c, bien: false, mensaje: `Los cuatro brazos del puente del ejercicio son de ${t(c.valor, 'Ω')} (R₄ también, para el equilibrio): ${nombres(malas)} no.` };
        const otras = rs.filter((r) => !cuatro.includes(r) && !((r.a === x && r.b === y) || (r.a === y && r.b === x)));
        if (otras.length) return { cond: c, bien: false, mensaje: `Sobra ${nombres(otras)}: no es un brazo del puente.` };
      }
      if (mejor <= c.tol * vmax) return { cond: c, bien: true, mensaje: `Los dos puntos medios están a ${t(par[0]![1], 'V')} y ${t(par[1]![1], 'V')}: el puente está equilibrado.` };
      return { cond: c, bien: false, mensaje: `Los puntos medios más parecidos están a ${t(par[0]![1], 'V')} y ${t(par[1]![1], 'V')}: el puente no está equilibrado (R₁/R₂ tiene que ser igual a R₃/R₄).` };
    }
    case 'transistor': {
      const qs = m.elementos.filter((e) => e.tipo === 'Q' && e.familia !== 'QP');
      if (!qs.length) return { cond: c, bien: false, mensaje: 'Falta el transistor NPN.' };
      const q = qs.reduce((x, y) => (Math.abs((y.corriente ?? 0) - c.ic) < Math.abs((x.corriente ?? 0) - c.ic) ? y : x));
      const ic = q.corriente ?? 0;
      if (ic < 1e-6) return { cond: c, bien: false, mensaje: 'Por el colector del transistor no pasa corriente: mire las patillas (colector, base, emisor) y que la base reciba tensión del divisor.' };
      if (c.divisor) {
        // review 10g: the bias the exercise asks — a divider on the base (R1 from the +, R2 to the −), RC from the + to
        // the collector and RE from the emitter to the − (a single base resistor of 560 kΩ gave the same current)
        const hay = (n: string, lado: Set<string>) => rs.some((r) => (r.a === n && lado.has(r.b)) || (r.b === n && lado.has(r.a)));
        const falta = [
          !hay(q.b, positivos) && 'R₁ (del + a la base)',
          !hay(q.b, negativos) && 'R₂ (de la base al −)',
          !hay(q.a, positivos) && 'R_C (del + al colector)',
          !hay(q.emisor ?? '', negativos) && 'R_E (del emisor al −)',
        ].filter((x): x is string => !!x);
        if (falta.length) return { cond: c, bien: false, mensaje: `La polarización por divisor lleva cuatro resistencias; en su circuito falta ${falta.join(', ')}.` };
      }
      if ((q.vce ?? 0) < 0.3) return { cond: c, bien: false, mensaje: `El transistor está saturado (solo ${t(q.vce ?? 0, 'V')} entre colector y emisor): el reto lo quiere en la región activa.` };
      const rel = (ic - c.ic) / c.ic;
      // review 10d: without the collector resistor the current is the same; V(C) − V(E) tells
      const vce = q.vce ?? 0;
      const relV = c.vce != null ? (vce - c.vce) / c.vce : 0;
      if (Math.abs(rel) <= c.tol + 1e-12 && c.vce != null && Math.abs(relV) > c.tol + 1e-12)
        return {
          cond: c,
          bien: false,
          mensaje: `La corriente de colector es ${t(ic, 'A')}, pero entre colector y emisor hay ${t(vce, 'V')} y el reto pide ${t(c.vce, 'V')} ± ${pct(c.tol)}: la resistencia de colector tiene que ser ${relV > 0 ? 'mayor' : 'menor'}${relV > 0 ? ' (o falta)' : ''}.`,
        };
      if (Math.abs(rel) <= c.tol + 1e-12) return { cond: c, bien: true, mensaje: `La corriente de colector es ${t(ic, 'A')}, con ${t(q.vce ?? 0, 'V')} entre colector y emisor: dentro de ${t(c.ic, 'A')} ± ${pct(c.tol)}, en la región activa.` };
      return { cond: c, bien: false, mensaje: `La corriente de colector es ${t(ic, 'A')} y el reto pide ${t(c.ic, 'A')} ± ${pct(c.tol)} (${rel > 0 ? '+' : '−'}${pct(Math.abs(rel))}).` };
    }
    case 'potencia': {
      const p = rs.map((r) => ({ r, w: Math.abs((r.corriente ?? 0) * (r.tension ?? 0)) }));
      const peor = p.reduce((x, y) => (y.w > x.w ? y : x), { r: null as ElementoMedido | null, w: 0 });
      if (peor.w <= c.max) return { cond: c, bien: true, mensaje: `Ninguna resistencia disipa más de ${t(c.max, 'W')}${peor.r ? ` (la que más, ${t(peor.w, 'W')})` : ''}.` };
      return { cond: c, bien: false, mensaje: `${peor.r!.nombre} disipa ${t(peor.w, 'W')}: más de los ${t(c.max, 'W')} que aguanta.` };
    }
  }
}

function mayuscula(s: string): string {
  return s ? s[0]!.toUpperCase() + s.slice(1) : s;
}

/** Plain-text summary of a condition for the specification list. */
export function textoCondicion(c: Condicion): string {
  switch (c.k) {
    case 'fuente':
      return `Alimentado con ${t(c.valor, 'V')}.`;
    case 'nodo':
      return `${mayuscula(c.nombre)} a ${t(c.valor, 'V')} ± ${pct(c.tol)}.`;
    case 'led':
      return `Un LED con ${t(c.corriente, 'A')} ± ${pct(c.tol)}.`;
    case 'zener':
      return c.max != null ? `Por el Zener, entre ${t(c.min, 'A')} y ${t(c.max, 'A')}.` : `Por el Zener, al menos ${t(c.min, 'A')}.`;
    case 'resistencias':
      return `Con ${c.n} resistencias de ${t(c.valor, 'Ω')}.`;
    case 'puente':
      return `Un puente equilibrado${c.valor != null ? ` con sus cuatro brazos de ${t(c.valor, 'Ω')}` : ''}: sus dos puntos medios a la misma tensión.`;
    case 'transistor':
      return `Un transistor NPN en la región activa con ${t(c.ic, 'A')} ± ${pct(c.tol)} de corriente de colector${c.vce != null ? ` y ${t(c.vce, 'V')} ± ${pct(c.tol)} entre colector y emisor` : ''}.`;
    case 'divisor':
      return c.n === 2
        ? `Un divisor de dos resistencias${c.arriba != null ? `, con la de ${t(c.arriba, 'Ω')} arriba` : ''}.`
        : `Un divisor con la carga en paralelo con la resistencia de abajo (${c.n} resistencias${c.valor != null ? ` de ${t(c.valor, 'Ω')}` : ''}).`;
    case 'sobrantes':
      return 'Sin piezas de más.';
    case 'carga':
      return `Una resistencia de carga que consuma ${t(c.corriente, 'A')} ± ${pct(c.tol)}.`;
    case 'resistencia':
      return `Con una resistencia de ${t(c.valor, 'Ω')}.`;
    case 'e12':
      return 'Resistencias de la serie E12.';
    case 'potencia':
      return `Ninguna resistencia por encima de ${t(c.max, 'W')}.`;
  }
}
