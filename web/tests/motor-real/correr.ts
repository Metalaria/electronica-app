// Command line of the real-engine harness (used by revision11-motor.spec.ts):
//   node --experimental-transform-types --no-warnings --import ./tests/motor-real/registrar.mjs tests/motor-real/correr.ts casos [filtro]
//   … correr.ts azar <n> [desde]
// The last line of the output is the JSON result.
import { errores } from './arnes.ts';

const [modo = 'casos', a1 = '', a2 = ''] = process.argv.slice(2);
if (modo === 'casos') {
  const { correrCasos } = await import('./escenarios.ts');
  // (0.12: the backup and the daily activity summed across devices, added to the same list)
  await import('./escenarios12.ts');
  // (1.0: the transition from 0.12, the schema migration, the exercises' merge)
  await import('./escenarios10.ts');
  // (1.0 Brilliant: the store «seguridad» and its merge)
  await import('./escenariosBrilliant10.ts');
  // (1.0 exercises, review 10g: drafts against another device's solved state)
  await import('./escenariosEjercicios10.ts');
  // (1.1: the real modules' stores with their own merge — laboratorio, seguridad — against a stale tab)
  await import('./escenarios11.ts');
  // (review 11a: the lessons' store with its merge, and the lab's «Hágalo por mí» mark)
  await import('./escenarios11a.ts');
  console.log(JSON.stringify(await correrCasos(a1)));
} else if (modo === 'rendimiento') {
  // … correr.ts rendimiento [circuitos,…] : one autosave of the editor's library (≈ 13 kB per circuit)
  const { medir } = await import('./rendimiento.ts');
  const r: Record<string, unknown> = {};
  for (const n of (a1 || '200,500').split(',').map(Number)) r[n] = await medir(n, 60, 6, a2 === 'tauri');
  console.log(JSON.stringify(r));
} else {
  const { simularPrueba } = await import('./azar.ts');
  const n = Number(a1 || 50);
  const desde = Number(a2 || 0);
  const problemas: string[] = [];
  let maximo = 0;
  // (1.0: runs of the 0.12 device refused by a file of format 2 — the transition is exercised)
  let rechazos012 = 0;
  for (let p = desde; p < desde + n; p++) {
    const r = await simularPrueba(p);
    problemas.push(...r.problemas);
    maximo = Math.max(maximo, r.commitsAsentar);
    rechazos012 += r.rechazos012 ?? 0;
  }
  console.log(JSON.stringify({ pruebas: n, problemas: problemas.slice(0, 30), conProblemas: problemas.length, commitsAsentarMax: maximo, rechazos012, errores: errores.slice(0, 10) }));
}
