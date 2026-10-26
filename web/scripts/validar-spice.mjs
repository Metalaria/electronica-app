#!/usr/bin/env node
// Runs every netlist through the app's ngspice engine (WebAssembly, the same code as the simulator's worker)
// and writes a JSON report. Called by contenido/spice.py after copying the netlists; also usable alone.
//
//   node scripts/validar-spice.mjs --dir public/libro/spice [--salida informe.json] [--nativo] [--tiempo 120]
//                                  [--hilos N] [--solo cap42/fig-42.5_filtro_rc] [--motor xspice|eecircuit]
//
// --motor chooses the build of ngspice (src/simulador/motor/motores.ts; default: the app's default engine).
// For each netlist: whether it ran (estado: ok | errores | fallo | tiempo), run time (ms: wall clock of the
// run; cpuMs: CPU time of the simulation thread, simulation and output analysis), plots, measurements
// printed, ngspice errors, and the slider parameters found by netlist.ts (contenido/spice.py checks they match
// its own). With --nativo, the same file is also run with the system's `ngspice -b` and the measurements of
// both are compared (relative tolerance 1e-3).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';

const web = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const motor = path.join(web, 'src', 'simulador', 'motor');

if (!isMainThread) {
  // ---------------------------------------------------------------- worker: one netlist at a time
  const { compilar } = await import(path.join(motor, 'nucleo.ts'));
  const { simular } = await import(path.join(motor, 'simular.ts'));
  const { listarParametros, analizarNetlist } = await import(path.join(motor, 'netlist.ts'));
  const { todasLasMedidas } = await import(path.join(motor, 'salida.ts'));
  const modulo = workerData.modulo ?? (await compilar(fs.readFileSync(workerData.wasm)));
  parentPort.on('message', async ({ id, fichero }) => {
    const texto = fs.readFileSync(fichero, 'utf8');
    // CPU time of this thread: unlike the wall time, it hardly changes when the machine is busy.
    const cpu0 = process.threadCpuUsage?.();
    const sim = await simular(modulo, texto, undefined, workerData.motor);
    const cpu = cpu0 ? process.threadCpuUsage(cpu0) : null;
    const r = sim.ejecucion;
    const a = sim.salida;
    parentPort.postMessage({
      id,
      ms: r.ms,
      cpuMs: cpu ? Math.round((cpu.user + cpu.system) / 1000) : null,
      fallo: r.fallo,
      graficas: r.graficas.map((g) => ({ id: g.id, analisis: g.analisis, puntos: g.puntos, vectores: g.vectores.length })),
      medidas: todasLasMedidas(a).map((m) => [m.nombre, m.valor]),
      // ngspice's own measurements (not echo lines), for the comparison with native ngspice.
      medidasNgspice: todasLasMedidas(a).filter((m) => !m.eco).map((m) => [m.nombre, m.valor]),
      errores: a.errores.slice(0, 8),
      explicaciones: a.explicaciones,
      avisos: a.avisos.length,
      anulados: sim.anulados,
      conKlu: sim.conKlu,
      analisis: analizarNetlist(texto).analisis,
      control: sim.control,
      parametros: listarParametros(texto).map((p) => ({ id: p.id, valor: p.valor })),
      salida: r.salida.length > 20000 ? r.salida.slice(0, 20000) : r.salida,
    });
  });
  parentPort.postMessage({ listo: true });
} else {
  // ---------------------------------------------------------------- main
  const args = process.argv.slice(2);
  const opt = (k, def) => {
    const i = args.indexOf(k);
    return i >= 0 ? args[i + 1] : def;
  };
  const dir = path.resolve(opt('--dir', path.join(web, 'public', 'libro', 'spice')));
  const salida = opt('--salida', null);
  const nativo = args.includes('--nativo');
  const tiempo = Number(opt('--tiempo', '120')) * 1000;
  const hilos = Math.max(1, Number(opt('--hilos', String(Math.min(8, os.availableParallelism?.() ?? os.cpus().length)))));
  const solo = opt('--solo', null);
  const { MOTORES, MOTOR_PREDETERMINADO, esIdMotor } = await import(path.join(motor, 'motores.ts'));
  const idMotor = opt('--motor', MOTOR_PREDETERMINADO);
  if (!esIdMotor(idMotor)) {
    console.error(`validar-spice: motor desconocido «${idMotor}» (xspice o eecircuit).`);
    process.exit(2);
  }
  const wasm = path.join(web, 'public', MOTORES[idMotor].wasm);
  if (!fs.existsSync(wasm)) {
    console.error(`validar-spice: falta public/${MOTORES[idMotor].wasm} (ejecute antes «node scripts/ngspice.mjs»).`);
    process.exit(2);
  }
  const ficheros = [];
  const recorrer = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) recorrer(p);
      else if (e.name.endsWith('.cir')) ficheros.push(p);
    }
  };
  recorrer(dir);
  const ids = ficheros.map((f) => path.relative(dir, f).replace(/\\/g, '/').replace(/\.cir$/, ''));
  let cola = ids.map((id, k) => ({ id, fichero: ficheros[k] }));
  if (solo) cola = cola.filter((x) => x.id === solo);

  const { analizarSalida, todasLasMedidas } = await import(path.join(motor, 'salida.ts'));
  const { compilar } = await import(path.join(motor, 'nucleo.ts'));
  const modulo = await compilar(fs.readFileSync(wasm));

  const informe = {};
  const t0 = Date.now();

  function nuevoHilo() {
    let w;
    try {
      w = new Worker(fileURLToPath(import.meta.url), { workerData: { modulo, wasm, motor: idMotor } });
    } catch {
      w = new Worker(fileURLToPath(import.meta.url), { workerData: { wasm, motor: idMotor } });
    }
    return w;
  }

  async function trabajador() {
    let w = null;
    let listo = null;
    const arrancar = () => {
      w = nuevoHilo();
      listo = new Promise((r) => w.once('message', r));
    };
    arrancar();
    for (;;) {
      const tarea = cola.shift();
      if (!tarea) break;
      await listo;
      const res = await new Promise((resolve) => {
        const temporizador = setTimeout(() => {
          w.terminate();
          resolve({ id: tarea.id, tiempo: true });
        }, tiempo);
        const fin = (m) => {
          clearTimeout(temporizador);
          w.off('error', err);
          resolve(m);
        };
        const err = (e) => {
          clearTimeout(temporizador);
          w.off('message', fin);
          resolve({ id: tarea.id, fallo: `excepción: ${e?.message ?? e}` });
        };
        w.once('message', fin);
        w.once('error', err);
        w.postMessage(tarea);
      });
      if (res.tiempo || (res.fallo && !res.graficas)) {
        await w.terminate().catch(() => {});
        arrancar();
      }
      const e = {
        estado: res.tiempo ? 'tiempo' : res.fallo ? 'fallo' : res.errores?.length ? 'errores' : 'ok',
        ms: res.ms ?? null,
        ...res,
      };
      delete e.id;
      delete e.tiempo;
      if (nativo) e.nativo = compararNativo(tarea.fichero, res.medidasNgspice ?? []);
      delete e.medidasNgspice;
      informe[tarea.id] = e;
      const marca = e.estado === 'ok' ? '·' : e.estado === 'errores' ? 'e' : e.estado === 'tiempo' ? 'T' : 'F';
      process.stderr.write(marca);
    }
    await w?.terminate().catch(() => {});
  }

  function compararNativo(fichero, medidasMotor) {
    const r = spawnSync('ngspice', ['-b', path.basename(fichero)], {
      cwd: path.dirname(fichero),
      encoding: 'utf8',
      timeout: tiempo,
      maxBuffer: 64 * 1024 * 1024,
    });
    if (r.error) return { estado: 'sin-ngspice', detalle: String(r.error.message ?? r.error) };
    const a = analizarSalida(`${r.stdout ?? ''}\n${r.stderr ?? ''}`);
    const nat = todasLasMedidas(a).map((m) => [m.nombre, m.valor]);
    const dif = [];
    const n = Math.min(nat.length, medidasMotor.length);
    for (let i = 0; i < n; i++) {
      const [na, va] = nat[i];
      const [nb, vb] = medidasMotor[i];
      const tol = Math.max(1e-12, 1e-3 * Math.max(Math.abs(va), Math.abs(vb)));
      const iguales = (Number.isNaN(va) && Number.isNaN(vb)) || va === vb || Math.abs(va - vb) <= tol;
      if (na.toLowerCase() !== nb.toLowerCase() || !iguales) dif.push([na, va, nb, vb]);
    }
    return {
      estado: dif.length || nat.length !== medidasMotor.length ? 'difiere' : 'igual',
      medidas: nat.length,
      diferencias: dif.slice(0, 10),
      totalDiferencias: dif.length,
    };
  }

  await Promise.all(Array.from({ length: Math.min(hilos, cola.length) }, trabajador));
  process.stderr.write('\n');

  const valores = Object.values(informe);
  const cuenta = (k) => valores.filter((v) => v.estado === k).length;
  const resumen = {
    motor: idMotor,
    total: valores.length,
    ok: cuenta('ok'),
    errores: cuenta('errores'),
    fallo: cuenta('fallo'),
    tiempo: cuenta('tiempo'),
    segundos: Math.round((Date.now() - t0) / 100) / 10,
  };
  if (nativo) {
    resumen.nativoIgual = valores.filter((v) => v.nativo?.estado === 'igual').length;
    resumen.nativoDifiere = valores.filter((v) => v.nativo?.estado === 'difiere').length;
  }
  const json = JSON.stringify({ resumen, netlists: informe }, null, 1);
  if (salida) fs.writeFileSync(salida, json);
  else process.stdout.write(json + '\n');
  console.error(
    `validar-spice (${idMotor}): ${resumen.total} netlists en ${resumen.segundos} s: ${resumen.ok} sin errores, ` +
      `${resumen.errores} con errores de ngspice, ${resumen.fallo} fallos del motor, ${resumen.tiempo} sin terminar` +
      (nativo ? `; frente a ngspice nativo: ${resumen.nativoIgual} iguales, ${resumen.nativoDifiere} con diferencias` : ''),
  );
}
