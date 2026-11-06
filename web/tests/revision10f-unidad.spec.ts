// Review 10f (1.0, the local failure report), without a browser: the redaction of paths that still keep the reader's
// name — paths outside the system's user folders.
//   EPA_SIN_SERVIDOR=1 PLAYWRIGHT_BROWSERS_PATH=/tmp/claude-0/pwb npx playwright test -c playwright.revision10f.config.ts tests/revision10f-unidad.spec.ts
import { test, expect } from '@playwright/test';
import { redactar } from '../src/lib/informe-fallos';

// r10f·5: «C:\Users\<name>\…», «/Users/<name>/…» and «/home/<name>/…» go whole (review 10c); other absolute paths keep
// only their file name, but they are cut at the first space (so a folder named after the reader stays) or not seen at
// all (UNC shares, a drive letter with «/»).
test('r10f·5 rutas fuera de la carpeta de usuario: no queda el nombre del lector', () => {
  const casos = [
    'No se pudo crear el fichero: D:\\Ana García\\Exámenes\\examen.pdf (os error 5)',
    'No se pudo crear el fichero: D:/Ana García/Exámenes/examen.pdf',
    'No se pudo crear el fichero: \\\\NAS-CASA\\ana.garcia\\Exámenes\\examen.pdf',
    'No se pudo crear el fichero: //NAS-CASA/ana.garcia/Exámenes/examen.pdf',
    'No se pudo crear el fichero: E:\\Datos de Ana García\\examen.pdf',
  ];
  for (const c of casos) {
    const r = redactar(c);
    expect(r, c).not.toMatch(/Ana|ana/);
    expect(r, c).toContain('examen.pdf');
  }
});
