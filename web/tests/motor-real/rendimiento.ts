// Cost of one write of a big store through the real `guardadoDeRegistro` (fourth review, finding 3): the editor's
// library of N circuits (≈ 10 kB each: 200 ≈ 2 MB, 500 ≈ 5 MB), one circuit changed per write (an autosave), and
// whether the write took the fast path (the key as this module left it: no merge), on a browser's storage or on a
// Tauri-like one (fifth review: values, no texts, IPC round trips). Run by correr.ts `rendimiento [n,…] [tauri]`.
import { almacenamiento, nuevoDisp, reloj } from './arnes.ts';

interface Medida {
  bytes: number;
  escrituras: number[];
  rapidas: number;
  completas: number;
  /** A write after another tab wrote the key (a merge). */
  conOtraPestana: number;
}

const circuito = (i: number, k: number) => ({
  id: `c${i}`,
  nombre: `Circuito ${i}`,
  creado: 1,
  actualizado: 1,
  doc: {
    version: 1,
    titulo: `C${i}`,
    componentes: Array.from({ length: k }, (_, j) => ({ id: `R${j}`, tipo: 'R', x: j * 10, y: i, rot: 90, valor: '4k7', props: { tol: 5, potencia: '0.25W', etiqueta: `R${j}` } })),
    cables: Array.from({ length: k }, (_, j) => ({ id: `w${j}`, puntos: [[j, 0], [j + 10, 0], [j + 10, i]] })),
  },
});
type Circuito = ReturnType<typeof circuito>;

interface G {
  cargar(adoptar?: (m: Record<string, Circuito>) => void): Promise<Record<string, Circuito>>;
  escribir(): Promise<void>;
  medidas?: { rapidas: number; completas: number };
}

export async function medir(n: number, k = 60, veces = 6, tauri = false): Promise<Medida> {
  const A = await nuevoDisp(`R${n}`, [], 0, '0.11', { tauri });
  const m: Record<string, Circuito> = {};
  for (let i = 0; i < n; i++) m[`c${i}`] = circuito(i, k);
  almacenamiento(A).set('editor-circuitos', JSON.stringify({ version: 1, circuitos: m }));
  const mod = (await import(new URL('../../src/lib/sincronizacion/guardado.ts', import.meta.url).href + `?d=${A.etiqueta}`)) as {
    guardadoDeRegistro(o: unknown): G;
  };
  const memoria = { circuitos: {} as Record<string, Circuito> };
  const g = mod.guardadoDeRegistro({
    claveAlmacen: 'editor-circuitos',
    claveSinc: 'editor-circuitos',
    campo: 'circuitos',
    obtener: () => memoria.circuitos,
    tiempo: (v: Circuito) => v.actualizado,
  });
  await g.cargar((m) => (memoria.circuitos = m));
  const escrituras: number[] = [];
  const r0 = (g.medidas?.rapidas ?? 0);
  const c0 = (g.medidas?.completas ?? 0);
  const una = async (r: number) => {
    reloj.ahora = 10_000 + r;
    const c = memoria.circuitos.c5!;
    c.doc.componentes[0]!.x = r;
    c.actualizado = 10 + r;
    const t0 = performance.now();
    await g.escribir();
    return Math.round(performance.now() - t0);
  };
  for (let r = 0; r < veces; r++) escrituras.push(await una(r));
  const rapidas = (g.medidas?.rapidas ?? 0) - r0;
  const completas = (g.medidas?.completas ?? 0) - c0;
  // (Tauri: one window, no other writer of the key)
  if (tauri) {
    reloj.ahora = 0;
    return { bytes: almacenamiento(A).get('editor-circuitos')!.length, escrituras, rapidas, completas, conOtraPestana: 0 };
  }
  // another tab of the device writes the key (another circuit changed): this write merges
  const otro = JSON.parse(almacenamiento(A).get('editor-circuitos')!) as { circuitos: Record<string, Circuito> };
  otro.circuitos.c9!.nombre = 'Cambiado en otra pestaña';
  otro.circuitos.c9!.actualizado = 20_000;
  almacenamiento(A).set('editor-circuitos', JSON.stringify(otro));
  const conOtraPestana = await una(veces);
  const final = JSON.parse(almacenamiento(A).get('editor-circuitos')!) as { circuitos: Record<string, Circuito> };
  if (final.circuitos.c9!.nombre !== 'Cambiado en otra pestaña' || memoria.circuitos.c9!.nombre !== 'Cambiado en otra pestaña')
    throw new Error('la escritura con fusión perdió el cambio de la otra pestaña');
  if (final.circuitos.c5!.doc.componentes[0]!.x !== veces) throw new Error('la escritura no guardó el cambio del lector');
  reloj.ahora = 0;
  return { bytes: almacenamiento(A).get('editor-circuitos')!.length, escrituras, rapidas, completas, conOtraPestana };
}
