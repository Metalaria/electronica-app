// 1.1 «Proyectos por etapas»: the light index of the projects and their stages — what the reader's section chips, the
// chapter-end card, the courses' path and the progress counts need — so those, which load with the reader, do not
// carry the stages' netlists and checks (etapas.ts, loaded with #/etapas). A unit test keeps it equal to etapas.ts.

export interface EtapaIndice {
  id: string;
  n: number;
  /** HTML. */
  titulo: string;
  secciones: string[];
}

export interface ProyectoIndice {
  parte: string;
  titulo: string;
  corto: string;
  etapas: EtapaIndice[];
}

const e = (id: string, n: number, titulo: string, ...secciones: string[]): EtapaIndice => ({ id, n, titulo, secciones });

/** In the order of etapas.ts `PROYECTOS` (the book's «por dónde empezar»: the supply first). */
export const INDICE_PROYECTOS: readonly ProyectoIndice[] = [
  {
    parte: 'cap50',
    titulo: 'Fuente de alimentación de laboratorio',
    corto: 'Fuente de laboratorio',
    etapas: [
      e('cap50-1', 1, 'El rectificador y el filtro', 'sec-50.9', 'sec-50.5'),
      e('cap50-2', 2, 'El lazo de tensión', 'sec-50.6', 'sec-50.4'),
      e('cap50-3', 3, 'El límite de corriente', 'sec-50.8'),
      e('cap50-4', 4, 'El prerregulador y la disipación', 'sec-50.7', 'sec-50.3'),
    ],
  },
  {
    parte: 'cap49',
    titulo: 'Estación de medida ambiental IoT',
    corto: 'Estación IoT',
    etapas: [
      e('cap49-1', 1, 'El bus I²C: la resistencia de pull-up', 'sec-49.6'),
      e('cap49-2', 2, 'El micrófono: amplificación y referencia', 'sec-49.7'),
      e('cap49-3', 3, 'El detector de nivel: la constante de tiempo', 'sec-49.7'),
    ],
  },
  {
    parte: 'cap51',
    titulo: 'Amplificador de audio Hi-Fi',
    corto: 'Amplificador Hi-Fi',
    etapas: [
      e('cap51-1', 1, 'El preamplificador', 'sec-51.3', 'sec-51.2'),
      e('cap51-2', 2, 'La polarización: el multiplicador de V<sub>BE</sub>', 'sec-51.5', 'sec-51.4'),
      e('cap51-3', 3, 'Los raíles: potencia y disipación', 'sec-51.7', 'sec-51.8'),
    ],
  },
  {
    parte: 'cap52',
    titulo: 'Radio definida por software (SDR)',
    corto: 'Radio SDR',
    etapas: [
      e('cap52-1', 1, 'El atenuador de entrada', 'sec-new-52-frontend'),
      e('cap52-2', 2, 'La ganancia de la banda base', 'sec-new-52-frontend'),
      e('cap52-3', 3, 'El filtro de la banda base', 'sec-new-52-frontend'),
    ],
  },
];

export const proyectoIndice = (parte: string): ProyectoIndice | undefined => INDICE_PROYECTOS.find((p) => p.parte === parte);

/** Book section label → the stages it teaches (for the chips next to the section titles). */
export const ETAPAS_DE_SECCION: Readonly<Record<string, readonly { parte: string; etapa: EtapaIndice }[]>> = (() => {
  const r: Record<string, { parte: string; etapa: EtapaIndice }[]> = {};
  for (const p of INDICE_PROYECTOS) for (const x of p.etapas) for (const s of x.secciones) (r[s] ??= []).push({ parte: p.parte, etapa: x });
  return r;
})();

/** The chapter that introduces the four (printed 47, file cap48): not staged, its designs are these projects' maps. */
export const PARTE_INTEGRACION = 'cap48';
