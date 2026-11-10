// 1.1 projects by stages: the XP the app's own ledger rule (progreso.svelte.ts premioDe, a rune module: run with the
// guided labs' loader, tests/laboratorio11/registrar.mjs) gives a stage's checks. Prints one JSON object.
import { premioDe } from '../../src/lib/aprendizaje/progreso.svelte.ts';
import { idEvento } from '../../src/lib/proyectos11/registro.ts';

const base = { tipo: 'respuesta' as const, id: idEvento('cap50-1'), clase: 'practica' as const, origen: 'proyecto' as const, parte: 'cap50', seccion: 'sec-50.9', subtipo: 'proyecto', t: 1 };
const casos = {
  primera: { correcta: true, intento: 1, pistas: 0, final: true },
  tercera: { correcta: true, intento: 3, pistas: 0, final: true },
  fallo: { correcta: false, intento: 1, pistas: 0, final: false },
};
console.log(JSON.stringify(Object.fromEntries(Object.entries(casos).map(([k, c]) => [k, premioDe({ ...base, ...c })]))));
process.exit(0);
