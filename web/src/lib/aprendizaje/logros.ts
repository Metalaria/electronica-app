// Achievements (0.11). Pure module: the definitions and their conditions over a summary of the reader's
// progress (`Estadisticas`, computed by progreso.svelte.ts from the stored data). An achievement, once
// unlocked, stays unlocked (its time is stored and synchronised); the conditions are only checked to unlock.

export type IconoLogro =
  | 'libro'
  | 'libros'
  | 'birrete'
  | 'check'
  | 'diana'
  | 'rayo'
  | 'llama'
  | 'calendario'
  | 'lapiz'
  | 'protoboard'
  | 'onda'
  | 'trofeo'
  | 'brujula'
  | 'estrella'
  | 'sol'
  | 'luna'
  | 'gafas'
  | 'mapa'
  | 'medalla';

/** Category: the badge's colour. */
export type FamiliaLogro = 'lecciones' | 'preguntas' | 'ejercicios' | 'taller' | 'constancia' | 'cursos' | 'nivel';

export interface Estadisticas {
  xp: number;
  nivel: number;
  /** Lessons completed (not those marked by the placement test). */
  lecciones: number;
  /** Questions and practice items answered right (each once). */
  aciertos: number;
  /** …of them at the first attempt and without hints. */
  sinAyuda: number;
  ejercicios: number;
  /** Guided breadboard circuits mounted (ids). */
  circuitos: string[];
  /** Built-in guided circuits (to know when all are done). */
  totalGuiados: number;
  simulaciones: number;
  rachaMax: number;
  diasObjetivo: number;
  leidas: number;
  /** Chapters with every practice item and Repaso question answered right. */
  capitulosPreguntas: number;
  /** Chapters with every lesson completed. */
  capitulosLecciones: number;
  /** Courses with every lesson completed or passed by the placement test (at least one really completed). */
  cursosTerminados: number;
  /** Courses with at least one lesson completed. */
  cursosEmpezados: number;
  pruebas: number;
  /** A lesson completed before 8:00 / at night (23:00–4:00). */
  madrugador: boolean;
  noctambulo: boolean;
  /** Group B: days with the problem of the day solved, and the longest run of consecutive ones. */
  problemasDia: number;
  rachaProblemas: number;
}

export const ESTADISTICAS_VACIAS: Estadisticas = {
  xp: 0,
  nivel: 1,
  lecciones: 0,
  aciertos: 0,
  sinAyuda: 0,
  ejercicios: 0,
  circuitos: [],
  totalGuiados: 5,
  simulaciones: 0,
  rachaMax: 0,
  diasObjetivo: 0,
  leidas: 0,
  capitulosPreguntas: 0,
  capitulosLecciones: 0,
  cursosTerminados: 0,
  cursosEmpezados: 0,
  pruebas: 0,
  madrugador: false,
  noctambulo: false,
  problemasDia: 0,
  rachaProblemas: 0,
};

export interface Logro {
  id: string;
  nombre: string;
  /** How to get it (shown on locked badges too). */
  como: string;
  icono: IconoLogro;
  familia: FamiliaLogro;
  /** [done, needed] for a counter achievement (a progress bar under the locked badge). */
  progreso: (s: Estadisticas) => [number, number];
}

const contador =
  (f: (s: Estadisticas) => number, n: number) =>
  (s: Estadisticas): [number, number] => [Math.min(n, f(s)), n];
const siNo = (f: (s: Estadisticas) => boolean) => (s: Estadisticas): [number, number] => [f(s) ? 1 : 0, 1];

export const LOGROS: Logro[] = [
  // lessons
  { id: 'primera-leccion', nombre: 'Primera lección', como: 'Complete una lección «Estudiar por pasos».', icono: 'libro', familia: 'lecciones', progreso: contador((s) => s.lecciones, 1) },
  { id: 'diez-lecciones', nombre: 'Diez lecciones', como: 'Complete diez lecciones.', icono: 'libros', familia: 'lecciones', progreso: contador((s) => s.lecciones, 10) },
  { id: 'cincuenta-lecciones', nombre: 'Medio centenar', como: 'Complete cincuenta lecciones.', icono: 'libros', familia: 'lecciones', progreso: contador((s) => s.lecciones, 50) },
  { id: 'capitulo-lecciones', nombre: 'Capítulo entero', como: 'Complete todas las lecciones de un capítulo.', icono: 'birrete', familia: 'lecciones', progreso: contador((s) => s.capitulosLecciones, 1) },
  { id: 'madrugador', nombre: 'Madrugador', como: 'Complete una lección antes de las 8 de la mañana.', icono: 'sol', familia: 'lecciones', progreso: siNo((s) => s.madrugador) },
  { id: 'noctambulo', nombre: 'Búho del taller', como: 'Complete una lección entre las 23:00 y las 4:00.', icono: 'luna', familia: 'lecciones', progreso: siNo((s) => s.noctambulo) },
  { id: 'lector', nombre: 'Lector de fondo', como: 'Marque cien secciones del libro como leídas.', icono: 'gafas', familia: 'lecciones', progreso: contador((s) => s.leidas, 100) },
  // questions
  { id: 'primer-acierto', nombre: 'Primer acierto', como: 'Acierte una pregunta o una práctica.', icono: 'check', familia: 'preguntas', progreso: contador((s) => s.aciertos, 1) },
  { id: 'cincuenta-aciertos', nombre: 'Cincuenta aciertos', como: 'Acierte cincuenta preguntas o prácticas distintas.', icono: 'diana', familia: 'preguntas', progreso: contador((s) => s.aciertos, 50) },
  { id: 'doscientos-aciertos', nombre: 'Doscientos aciertos', como: 'Acierte doscientas preguntas o prácticas distintas.', icono: 'diana', familia: 'preguntas', progreso: contador((s) => s.aciertos, 200) },
  { id: 'sin-pistas', nombre: 'Sin pistas', como: 'Acierte veinticinco a la primera y sin ver ninguna pista.', icono: 'rayo', familia: 'preguntas', progreso: contador((s) => s.sinAyuda, 25) },
  { id: 'capitulo-preguntas', nombre: 'Capítulo dominado', como: 'Acierte todas las prácticas y preguntas de repaso de un capítulo.', icono: 'estrella', familia: 'preguntas', progreso: contador((s) => s.capitulosPreguntas, 1) },
  // exercises
  { id: 'primer-ejercicio', nombre: 'Primer ejercicio', como: 'Resuelva un ejercicio o problema del libro.', icono: 'lapiz', familia: 'ejercicios', progreso: contador((s) => s.ejercicios, 1) },
  { id: 'veinticinco-ejercicios', nombre: 'Cuaderno lleno', como: 'Resuelva veinticinco ejercicios o problemas.', icono: 'lapiz', familia: 'ejercicios', progreso: contador((s) => s.ejercicios, 25) },
  { id: 'cien-ejercicios', nombre: 'Cien ejercicios', como: 'Resuelva cien ejercicios o problemas.', icono: 'trofeo', familia: 'ejercicios', progreso: contador((s) => s.ejercicios, 100) },
  // workshop
  { id: 'primer-circuito', nombre: 'Primer montaje', como: 'Monte un circuito guiado en la protoboard y compruébelo simulando.', icono: 'protoboard', familia: 'taller', progreso: contador((s) => s.circuitos.length, 1) },
  { id: 'todos-los-montajes', nombre: 'Todos los montajes', como: 'Monte los cinco circuitos guiados de la protoboard.', icono: 'protoboard', familia: 'taller', progreso: contador((s) => s.circuitos.filter((c) => c !== 'libro').length, 5) },
  { id: 'primera-simulacion', nombre: 'Primera simulación', como: 'Simule un circuito en el simulador, el editor o la protoboard.', icono: 'onda', familia: 'taller', progreso: contador((s) => s.simulaciones, 1) },
  // consistency
  { id: 'racha-3', nombre: 'Tres días seguidos', como: 'Cumpla el objetivo diario tres días seguidos.', icono: 'llama', familia: 'constancia', progreso: contador((s) => s.rachaMax, 3) },
  { id: 'racha-7', nombre: 'Una semana', como: 'Cumpla el objetivo diario siete días seguidos.', icono: 'llama', familia: 'constancia', progreso: contador((s) => s.rachaMax, 7) },
  { id: 'racha-30', nombre: 'Un mes sin fallar', como: 'Cumpla el objetivo diario treinta días seguidos.', icono: 'llama', familia: 'constancia', progreso: contador((s) => s.rachaMax, 30) },
  { id: 'constancia', nombre: 'Constancia', como: 'Cumpla el objetivo diario treinta días en total.', icono: 'calendario', familia: 'constancia', progreso: contador((s) => s.diasObjetivo, 30) },
  // the problem of the day (group B)
  { id: 'problema-dia', nombre: 'Problema del día', como: 'Resuelva el problema del día.', icono: 'lapiz', familia: 'constancia', progreso: contador((s) => s.problemasDia, 1) },
  { id: 'problemas-7', nombre: 'Semana de problemas', como: 'Resuelva el problema del día siete días seguidos.', icono: 'calendario', familia: 'constancia', progreso: contador((s) => s.rachaProblemas, 7) },
  // courses
  { id: 'prueba-nivel', nombre: 'Punto de partida', como: 'Haga la prueba de nivel de un curso.', icono: 'brujula', familia: 'cursos', progreso: contador((s) => s.pruebas, 1) },
  { id: 'tres-cursos', nombre: 'Explorador', como: 'Complete lecciones de tres cursos distintos.', icono: 'mapa', familia: 'cursos', progreso: contador((s) => s.cursosEmpezados, 3) },
  { id: 'curso-terminado', nombre: 'Curso terminado', como: 'Termine todas las lecciones de un curso.', icono: 'birrete', familia: 'cursos', progreso: contador((s) => s.cursosTerminados, 1) },
  { id: 'tres-cursos-terminados', nombre: 'Tres cursos', como: 'Termine tres cursos.', icono: 'trofeo', familia: 'cursos', progreso: contador((s) => s.cursosTerminados, 3) },
  // levels
  { id: 'nivel-5', nombre: 'Nivel 5', como: 'Llegue al nivel 5 sumando XP.', icono: 'medalla', familia: 'nivel', progreso: contador((s) => s.nivel, 5) },
  { id: 'nivel-10', nombre: 'Nivel 10', como: 'Llegue al nivel 10 sumando XP.', icono: 'medalla', familia: 'nivel', progreso: contador((s) => s.nivel, 10) },
];

export const LOGRO = new Map(LOGROS.map((l) => [l.id, l]));

/** Whether an achievement's condition holds. */
export function cumple(l: Logro, s: Estadisticas): boolean {
  const [n, de] = l.progreso(s);
  return n >= de;
}
