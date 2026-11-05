// 0.12, review finding 6: the save before installing an update (lib/almacen.ts guardarTodoAntesDeSalir) must AWAIT
// the modules' pending writes. With a slow storage (EPA_TAURI=1 EPA_IPC_MS=150: every plugin-store call takes 150 ms)
// a step studied and a note written just before are in the store when it returns; with `antes` the old way (dispatch
// the events, wait 300 ms) is measured instead, to show what it lost. Prints JSON {problemas}.
//   EPA_TAURI=1 EPA_IPC_MS=150 node --no-warnings --import ./tests/actualizacion/registrar.mjs tests/actualizacion/salir.ts [antes]
import { datos } from './navegador.ts';

setTimeout(() => {
  console.log(JSON.stringify({ problemas: ['TIEMPO AGOTADO'] }));
  process.exit(3);
}, 120_000).unref?.();

const antes = process.argv.includes('antes');
const problemas: string[] = [];
const U = await import('../../src/lib/usuario.svelte.ts');
await U.cargarUsuario();
const D = await import('../../src/lib/progreso-diario.svelte.ts');
await D.cargarProgresoDiario();
const A = await import('../../src/lib/almacen.ts');
// the reader studies two steps and writes a note, then installs the update at once
D.registrarActividad('paso', 2);
U.guardarNota({ label: 'fig:1', parte: 'cap01', titulo: 'Figura 1' }, 'nota justo antes de actualizar');
const t0 = Date.now();
if (antes) {
  window.dispatchEvent(new Event('pagehide'));
  window.dispatchEvent(new CustomEvent('epa:antes-de-sincronizar'));
  await new Promise((r) => setTimeout(r, 300));
} else await A.guardarTodoAntesDeSalir();
const ms = Date.now() - t0;
// what is in the store at that moment (the installer ends the process right after)
const diario = JSON.parse(datos.get('epa:progreso-diario') ?? '{}') as Record<string, { pasos?: number }>;
const pasos = Object.entries(diario)
  .filter(([k]) => k.includes('@'))
  .reduce((n, [, r]) => n + (r.pasos ?? 0), 0);
if (pasos !== 2) problemas.push(`el progreso diario guardado tiene ${pasos} pasos (2 estudiados)`);
const notas = JSON.parse(datos.get('epa:notas') ?? '{}') as Record<string, { texto?: string }>;
if (notas['fig:1']?.texto !== 'nota justo antes de actualizar') problemas.push('la nota no está guardada');
console.log(JSON.stringify({ antes, ms, problemas }));
process.exit(0);
