// Randomized simulation of ONE real Guardado (sixth review, x8b/x8c): reader edits and deletions at random moments
// (also inside the storage's IPC waits), guardar/escribir/volcar/refrescar, a load that may fail and is retried, reads
// and writes failing at random (the data key and sinc-marcas), random IPC delays; storage like Tauri's or like
// localStorage (falsos/almacen-ipc.ts). Checks:
//   - at every store write (the process dying there): every stored item the reader never deleted is still stored;
//     every stored value is one the reader set (or an initial one);
//   - at the end (failures off; the final flush is a write — `escribir` — or what hiding the page does — `volcar`):
//     storage == memory == the reader's intended state.
//   EPA_SUSTITUIR='src/lib/almacen.ts=tests/motor-real/falsos/almacen-ipc.ts' EPA_ALMACEN=tauri|navegador \
//     node --experimental-transform-types --no-warnings --import ./tests/motor-real/registrar.mjs \
//     tests/motor-real/guardado-azar.ts <pruebas> [semilla] [escribir|volcar]   (prints JSON)
const g = globalThis as any;
g.window = new EventTarget();
g.document = new EventTarget();
console.warn = () => {};
const { guardadoDeRegistro } = await import('../../src/lib/sincronizacion/guardado.ts');
const N = Number(process.argv[2] ?? 50);
let semilla = Number(process.argv[3] ?? 1);
const FINAL = process.argv[4] === 'escribir' ? 'escribir' : 'volcar';
const azar = () => ((semilla = (semilla * 1103515245 + 12345) % 2147483648) / 2147483648);
const elegir = <T>(l: T[]) => l[Math.floor(azar() * l.length)]!;
const espera = (ms = 0) => new Promise((r) => setTimeout(r, ms));
const problemas: string[] = [];
for (let p = 0; p < N; p++) {
  const K = `k${p}`;
  const inicial: Record<string, any> = {};
  for (let i = 0; i < 4; i++) inicial[`i${i}`] = { v: `ini${i}`, t: 1 };
  g.__tauri.set(K, JSON.stringify(inicial));
  g.__tauri.delete('sinc-marcas');
  const pFallaL = azar() * 0.4;
  const pFallaE = azar() * 0.3;
  let fallos = true;
  g.__ipcMs = Math.floor(azar() * 4);
  const soloEscritura = !!process.env.SOLO_ESCRITURA;
  g.__fallaLeer = (c: string) => !soloEscritura && fallos && (c === K || c === 'sinc-marcas') && azar() < pFallaL;
  g.__fallaEscribir = (c: string) => fallos && (c === K || c === 'sinc-marcas') && azar() < pFallaE;
  const mem = { m: {} as Record<string, any> };
  const gd = guardadoDeRegistro({ claveAlmacen: K, claveSinc: K, obtener: () => mem.m, tiempo: (v: any) => v?.t });
  // the reader's intended state: initial, then each of the reader's sets and deletions in order
  const intencion: Record<string, any> = structuredClone(inicial);
  const borradosAlguna = new Set<string>();
  const valores = new Set(Object.values(inicial).map((v) => JSON.stringify(v)));
  let n = 0;
  /** Edits scheduled by `__alEscribir` not made yet (review 12b, finding 5: the final check must wait for them). */
  let programadas = 0;
  const editar = () => {
    const ids = Object.keys(mem.m);
    if (ids.length && azar() < 0.25) {
      const id = elegir(ids);
      delete mem.m[id];
      delete intencion[id];
      borradosAlguna.add(id);
    } else {
      const id = azar() < 0.5 && ids.length ? elegir(ids) : `n${n++ % 6}`;
      const v = { v: `e${p}-${n++}`, t: 100 + n };
      mem.m[id] = v;
      intencion[id] = structuredClone(v);
      valores.add(JSON.stringify(v));
    }
  };
  g.__alEscribir = (c: string) => {
    if (c === K) {
      const s = g.__tauri.get(K);
      // (checked after the set lands, in the next turn)
      setTimeout(() => {
        const st = JSON.parse(g.__tauri.get(K) ?? '{}');
        for (const id of Object.keys(inicial)) if (!borradosAlguna.has(id) && !st[id]) problemas.push(`prueba ${p}: muerte tras una escritura: falta ${id} (guardado ${Object.keys(st)})`);
        for (const [id, v] of Object.entries(st)) if (!valores.has(JSON.stringify(v))) problemas.push(`prueba ${p}: valor desconocido ${id}=${JSON.stringify(v)}`);
        void s;
      }, g.__ipcMs + 1);
      if (azar() < 0.3) {
        programadas++;
        setTimeout(() => {
          editar();
          gd.guardar(0);
          programadas--;
        }, 0);
      }
    }
  };
  let cargado = false;
  const cargar = async () => {
    if (cargado) return;
    await gd
      .cargar((m: any) => (mem.m = { ...m, ...mem.m }))
      .then(
        () => (cargado = true),
        () => undefined,
      );
  };
  const pendientes: Promise<unknown>[] = [];
  if (azar() < 0.7) pendientes.push(cargar());
  for (let paso = 0; paso < 25; paso++) {
    const op = azar();
    if (op < 0.4) {
      editar();
      if (azar() < 0.5) gd.guardar(Math.floor(azar() * 5));
      else pendientes.push(gd.escribir().catch(() => undefined));
    } else if (op < 0.5) pendientes.push(gd.volcar().catch(() => undefined));
    else if (op < 0.6) pendientes.push(gd.refrescar().catch(() => undefined));
    else if (op < 0.7 && !process.env.SIN_REINTENTO) pendientes.push(cargar());
    if (azar() < 0.5) await espera(Math.floor(azar() * 6));
  }
  await Promise.all(pendientes);
  await espera(20);
  fallos = false;
  g.__alEscribir = undefined;
  // (review 12b, finding 5) the edits a write scheduled still run after this point, each with its own guardar(0): the
  // Guardado must be idle — none scheduled, no timer — before the final write, or memory is compared with a storage
  // that has not had the chance to take an edit made after the final write (a harness artefact, not a loss)
  for (let k = 0; k < 400 && (programadas > 0 || (gd as any).temporizador); k++) await espera(5);
  if (programadas > 0 || (gd as any).temporizador) problemas.push(`prueba ${p}: el guardado no queda en reposo`);
  if (!process.env.SIN_REINTENTO) await cargar();
  if (FINAL === 'escribir') await gd.escribir().catch((e: any) => problemas.push(`prueba ${p}: escritura final ${e.message}`));
  else await gd.volcar().catch((e: any) => problemas.push(`prueba ${p}: volcar final ${e.message}`));
  await espera(10);
  const st = JSON.parse(g.__tauri.get(K) ?? '{}');
  const ord = (o: any) => JSON.stringify(Object.fromEntries(Object.entries(o).sort(([a], [b]) => (a < b ? -1 : 1))));
  if (ord(st) !== ord(mem.m)) problemas.push(`prueba ${p}: tras ${FINAL} guardado ≠ memoria\n  ${ord(st)}\n  ${ord(mem.m)}`);
  if (ord(mem.m) !== ord(intencion)) problemas.push(`prueba ${p}: memoria ≠ lo que hizo el lector\n  mem ${ord(mem.m)}\n  int ${ord(intencion)}`);
}
console.log(JSON.stringify({ pruebas: N, problemas: problemas.slice(0, 12), total: problemas.length }));
