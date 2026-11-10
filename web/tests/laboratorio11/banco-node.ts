// 1.1 guided labs in Node: every lab of practicas/laboratorios.ts on a REAL bench (Banco, the Brymen and FNIRSI state
// machines, the instruments' loads in the netlist, the app's WebAssembly ngspice — hooks.mjs swaps only the worker).
// For each step: the book's set-up, «Comprobar» before doing anything (must not pass, unless the previous step left it
// done), «Hágalo por mí», the reading typed as the instrument shows it (must pass), the same reading ten times off
// (must fail), the reading against the book's expected value; then each typical mistake made on top of the right
// settings (replayed from the start) must be rejected with its hint. Prints one JSON line per lab.
//   node --no-warnings --import ./tests/laboratorio11/registrar.mjs tests/laboratorio11/banco-node.ts [n …]
import { Banco } from '../../src/componentes/instrumentos/banco.svelte.ts';
import { PRACTICAS } from '../../src/componentes/instrumentos/practicas/practicas.ts';
import { aplicar } from '../../src/componentes/instrumentos/practicas/aplicar.ts';
import { LABORATORIOS } from '../../src/componentes/instrumentos/practicas/laboratorios.ts';
import { evaluarPaso, hacerPaso, iniciarLaboratorio, prepararPaso, type Laboratorio, type PasoLab } from '../../src/componentes/instrumentos/practicas/laboratorio.ts';
import { formatoSI } from '../../src/componentes/grafica/formato.ts';

let ultimo = '';
/** Simulates when the netlist changed, then reads the meters and acquires, as the bench view does. */
async function simular(b: Banco): Promise<void> {
  // a reading can change the bench (the meters' autorange changes the ohmmeter's test current): until it is stable
  for (let vuelta = 0; vuelta < 6; vuelta++) {
    const n = b.plan.netlist;
    if (n === ultimo && b.datos) break;
    const v = b.version;
    b.pedir(n, true);
    for (let k = 0; k < 1200 && b.version === v && !b.error; k++) await new Promise((r) => setTimeout(r, 25));
    ultimo = n;
    leer(b);
  }
  leer(b);
  b.leido = b.version;
}

function leer(b: Banco): void {
  for (let k = 0; k < 3; k++) {
    b.brymen.leer(b.senalDmm('bm'));
    b.fnirsi.leerDmm(b.senalDmm('fn'));
    const { entradas, inicio, fin } = b.entradasOsc();
    b.fnirsi.adquirir(entradas, inicio, fin);
  }
}

/** The reading as a reader would type it from the screen (four significant digits, the unit with its prefix). */
const escribir = (v: number, u: string) => (u === '' || u === '°' || u === 'dB' || u === '%' ? `${String(Math.round(v * 1000) / 1000).replace('.', ',')}${u ? ' ' + u : ''}` : formatoSI(v, u, 4));

async function hacerHasta(b: Banco, lab: Laboratorio, i: number): Promise<void> {
  const p = PRACTICAS.find((x) => x.n === lab.n)!;
  iniciarLaboratorio(b, p, lab);
  for (let k = 0; k <= i; k++) {
    const paso = lab.pasos[k]!;
    prepararPaso(b, p, paso);
    if (typeof paso.hazlo === 'function' || k === i) await simular(b);
    hacerPaso(b, p, paso);
    if (typeof paso.hazlo === 'function') {
      await simular(b);
      hacerPaso(b, p, paso);
    }
  }
  await simular(b);
}

async function correr(lab: Laboratorio) {
  const p = PRACTICAS.find((x) => x.n === lab.n)!;
  const b = new Banco();
  ultimo = '';
  iniciarLaboratorio(b, p, lab);
  await simular(b);
  const pasos = [];
  for (const [i, paso] of lab.pasos.entries()) {
    prepararPaso(b, p, paso);
    await simular(b);
    const antes = evaluarPaso(paso, b, '');
    hacerPaso(b, p, paso);
    await simular(b);
    if (typeof paso.hazlo === 'function') {
      // the cursors go where the trace is once it is on screen
      hacerPaso(b, p, paso);
      await simular(b);
    }
    // a table step: note points over the sweep, as the reader would
    if (paso.tabla) {
      for (const f of [1000, 2000, 3000, 4000, 4500, 5033, 5600, 6500, 8000, 10000, 14000, 20000]) {
        aplicar(b, p, { fn: { dds: { frecuencia: f } } });
        await simular(b);
        const r = p.tabla!.anotar(b);
        if (typeof r !== 'string') b.anotaciones = [...b.anotaciones, r];
      }
      aplicar(b, p, { fn: { dds: { frecuencia: 5033 } } });
      await simular(b);
    }
    const sinLectura = evaluarPaso(paso, b, '');
    const l = paso.lectura;
    const v = l ? l.medir(b) : null;
    const texto = l && v !== null ? escribir(v, l.unidad) : '';
    const despues = evaluarPaso(paso, b, texto);
    const diez = l && v !== null ? evaluarPaso(paso, b, escribir(v * 10, l.unidad)) : null;
    // the number alone when the screen shows a prefix (616,0 µA typed as «616,0»)
    const conPrefijo = l && v !== null && /^[-\d,.]+ [pnµmkM]/.test(texto) ? evaluarPaso(paso, b, texto.split(' ')[0]!) : null;
    const c = l?.libro ? p.comprobaciones.find((x) => x.id === l.libro) : undefined;
    pasos.push({
      i,
      id: paso.id,
      antes: antes.estado,
      sinLectura: sinLectura.estado === 'mal' ? sinLectura.pista : sinLectura.estado,
      despues: despues.estado,
      pista: despues.estado === 'bien' ? '' : despues.pista,
      texto,
      lectura: v,
      diez: diez ? (diez.estado === 'mal' ? diez.pista : diez.estado) : null,
      prefijo: conPrefijo ? (conPrefijo.estado === 'mal' ? conPrefijo.pista : conPrefijo.estado) : null,
      libro: c ? { id: c.id, esperado: c.esperado, tol: c.tol.abs ?? Math.abs(c.esperado) * (c.tol.rel ?? 0.01) } : null,
    });
  }
  const errores = [];
  for (const [i, paso] of lab.pasos.entries()) {
    for (const e of paso.errores ?? []) {
      const b2 = new Banco();
      ultimo = '';
      await hacerHasta(b2, lab, i);
      const bien = evaluarPaso(paso, b2, paso.lectura ? escribir(paso.lectura.medir(b2) ?? NaN, paso.lectura.unidad) : '');
      if (typeof e.hacer === 'function') e.hacer(b2);
      else aplicar(b2, p, e.hacer);
      await simular(b2);
      const v = paso.lectura ? paso.lectura.medir(b2) : null;
      const r = evaluarPaso(paso, b2, v !== null && paso.lectura ? escribir(v, paso.lectura.unidad) : '');
      errores.push({ paso: paso.id, nombre: e.nombre, esperada: e.pista, antes: bien.estado, estado: r.estado, pista: r.estado === 'bien' ? '' : r.pista });
    }
  }
  return { n: lab.n, pasos, errores };
}

const pedidos = process.argv.slice(2).map(Number).filter(Boolean);
for (const lab of LABORATORIOS) {
  if (pedidos.length && !pedidos.includes(lab.n)) continue;
  const t = Date.now();
  const r = await correr(lab);
  console.log(JSON.stringify({ ...r, ms: Date.now() - t }));
}
process.exit(0);
