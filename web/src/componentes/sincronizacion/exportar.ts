// «Exportar copia» (0.12), shared by the Sincronización page and «Aa»: makes the backup (lib/sincronizacion/copia.ts)
// and saves it (fichero.ts). Resolves the Spanish message to show; rejects with one.
import { crearCopia, ErrorCopia } from '../../lib/sincronizacion/copia';
import { CANCELADO, guardarFichero } from '../../lib/sincronizacion/fichero';

export async function exportarCopia(): Promise<string> {
  let c: Awaited<ReturnType<typeof crearCopia>>;
  try {
    c = await crearCopia();
  } catch (e) {
    throw new Error(e instanceof ErrorCopia ? e.message : `No se ha podido preparar la copia: ${e instanceof Error ? e.message : String(e)}`);
  }
  let r: Awaited<ReturnType<typeof guardarFichero>>;
  try {
    r = await guardarFichero(c.nombre, c.texto);
  } catch (e) {
    throw new Error(`No se ha podido guardar el fichero: ${e instanceof Error ? e.message : String(e)}`);
  }
  const n = `${c.elementos} ${c.elementos === 1 ? 'elemento' : 'elementos'}`;
  if (r === CANCELADO) return 'No se ha guardado ninguna copia.';
  if (r === 'guardado') return `Copia guardada (${c.nombre}, ${n}).`;
  return `Copia descargada: ${c.nombre} (${n}). Está en la carpeta de descargas del navegador.`;
}
