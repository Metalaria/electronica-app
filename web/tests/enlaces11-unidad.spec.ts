// 1.1 «enlaces11», in Node (no browser, no server):
//   - synchronisation: the stores of the real modules `laboratorio` and `seguridad` mark their writes (claveSinc), so a
//     stale tab's copy no longer takes the reader's step or tap away; scenarios e11 of the real engine
//     (tests/motor-real/escenarios11.ts);
//   - editor: a netlist opened as a drawing whose source feeds only a controlled source or an expression (E/G control
//     nodes, POLY, V(a) of a B source) gets a net label on that terminal instead of a dangling one and no warning; the
//     netlist it writes is the same (the book's 313 netlists: tests/enlaces11-unidad «barrido»);
//   - deep links: the parser of epa://leccion/<parte>/<label> and its hash route.
//   EPA_SIN_SERVIDOR=1 npx playwright test -c playwright.enlaces11.config.ts tests/enlaces11-unidad.spec.ts
import { execFile } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test, expect } from '@playwright/test';

const WEB = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

// ------------------------------------------------------------------ 1. synchronisation

test('sincronización: laboratorio y seguridad marcan sus cambios; la copia desfasada de otra pestaña no los borra (escenarios e11)', async () => {
  test.setTimeout(300_000);
  const salida = await new Promise<string>((ok, mal) =>
    execFile(
      process.execPath,
      ['--experimental-transform-types', '--no-warnings', '--import', './tests/motor-real/registrar.mjs', 'tests/motor-real/correr.ts', 'casos', 'e11'],
      { cwd: WEB, maxBuffer: 64 << 20 },
      (e, out) => (e ? mal(e) : ok(out)),
    ),
  );
  const r = JSON.parse(salida.trim().split('\n').pop()!) as { nombre: string; ok: boolean; error?: string }[];
  expect(r.length).toBe(3);
  expect(r.filter((c) => !c.ok).map((c) => `${c.nombre}: ${c.error}`)).toEqual([]);
});

test('sincronización: cada Guardado registrado marca con la clave de su almacén', () => {
  // (static: the modules pass claveSinc; the runtime guard of sincronizableGuardado is scenario e11·3)
  for (const [f, clave] of [
    ['src/lib/laboratorio.svelte.ts', 'CLAVE_LABORATORIO'],
    ['src/lib/aprendizaje/seguridad.svelte.ts', 'CLAVE_SEGURIDAD'],
    ['src/lib/proyectos11/estado.svelte.ts', 'CLAVE_PROYECTOS'],
  ])
    expect(readFileSync(path.join(WEB, f), 'utf8'), f).toContain(`claveSinc: ${clave},`);
});

// ------------------------------------------------------------------ 2. editor: controlled sources

async function importar() {
  const { sembrarDibujos } = await import('../src/componentes/esquema-auto/generar.ts');
  const { editableDeNetlist } = await import('../src/componentes/esquema-auto/editable.ts');
  const { documentoDeEditable } = await import('../src/componentes/editor/importar.ts');
  const { generarNetlist } = await import('../src/componentes/editor/netlist.ts');
  const { conectividad } = await import('../src/componentes/editor/conectividad.ts');
  sembrarDibujos(JSON.parse(readFileSync(path.join(WEB, 'src/componentes/esquema-auto/precalculado.json'), 'utf8')));
  return (t: string) => {
    const doc = documentoDeEditable(t, editableDeNetlist(t)!, { tipo: 'libro', id: 'x' });
    const nl = generarNetlist(doc);
    return {
      avisos: nl.avisos.map((a) => a.texto),
      lineas: nl.texto.split('\n').filter((l) => /^[A-Z]/.test(l)),
      etiquetas: doc.componentes.filter((c) => c.tipo === 'ETQ').map((c) => c.campos['red']).sort(),
      sueltos: conectividad(doc).sueltos.length,
    };
  };
}

test('editor: una fuente que solo alimenta una fuente controlada o una expresión se dibuja con su etiqueta, sin terminal suelto ni aviso', async () => {
  const abrir = await importar();
  const casos: [string, string, string[]][] = [
    ['E de cuatro nodos', 'V1 in 0 SIN(0 1 1k)\nE1 out 0 in 0 10\nRL out 0 1k\n.tran 1u 2m', ['in']],
    ['G de cuatro nodos', 'V1 in 0 DC 1\nG1 0 out in 0 1m\nRL out 0 1k\n.op', ['in']],
    ['B con V(in)', 'V1 in 0 DC 2\nB1 out 0 V=V(in)*V(in)\nRL out 0 1k\n.op', ['in']],
    ['B con V(a,b)', 'V1 a 0 DC 2\nV2 b 0 DC 1\nB1 0 out I=V(a,b)*1m\nRL out 0 1k\n.op', ['a', 'b']],
    ['E con VALUE', 'V1 in 0 DC 1\nE1 out 0 VALUE={2*V(in)}\nRL out 0 1k\n.op', ['in']],
    ['E con POLY(2)', 'V1 a 0 DC 1\nV2 b 0 DC 2\nE1 out 0 POLY(2) a 0 b 0 0 1 1\nRL out 0 1k\n.op', ['a', 'b']],
  ];
  for (const [nombre, cuerpo, nodos] of casos) {
    const t = `* ${nombre}\n${cuerpo}\n.end\n`;
    const r = abrir(t);
    expect(r.avisos, nombre).toEqual([]);
    expect(r.sueltos, nombre).toBe(0);
    expect(r.etiquetas, nombre).toEqual(nodos);
    // the netlist it writes: the same element lines
    for (const l of cuerpo.split('\n').filter((x) => /^[A-Z]/.test(x))) expect(r.lineas, nombre).toContain(l);
  }
  // control: a node nobody reads is still a loose terminal, with its warning
  const suelto = abrir('* suelto\nV1 in 0 DC 1\nV2 x 0 DC 1\nE1 out 0 in 0 2\nRL out 0 1k\n.op\n.end\n');
  expect(suelto.etiquetas).toEqual(['in']);
  expect(suelto.avisos).toEqual([expect.stringMatching(/^V2: un terminal .* no está conectado a nada\.$/)]);
});

test('editor: las netlists del libro abiertas como dibujo dan la misma netlist; sin el aviso falso de las fuentes de control', async () => {
  test.setTimeout(300_000);
  const { sembrarDibujos } = await import('../src/componentes/esquema-auto/generar.ts');
  const { editableDeNetlist } = await import('../src/componentes/esquema-auto/editable.ts');
  const { documentoDeEditable } = await import('../src/componentes/editor/importar.ts');
  const { generarNetlist } = await import('../src/componentes/editor/netlist.ts');
  sembrarDibujos(JSON.parse(readFileSync(path.join(WEB, 'src/componentes/esquema-auto/precalculado.json'), 'utf8')));
  const libro = path.join(WEB, 'public/libro');
  const sp = JSON.parse(readFileSync(path.join(libro, 'spice.json'), 'utf8')) as { netlists: Record<string, { fichero: string }> };
  const elementos = (s: string) => s.split('\n').filter((l) => /^[A-Za-z]/.test(l)).map((l) => l.trim().split(/\s+/).slice(0, 1).join(' '));
  for (const id of ['cap06/sec-6.13_distorsion', 'cap28/prob-28.B_pll', 'cap32/lockin_32.16', 'cap31/zn_lazo_abierto']) {
    const t = readFileSync(path.join(libro, sp.netlists[id]!.fichero), 'utf8');
    const nl = generarNetlist(documentoDeEditable(t, editableDeNetlist(t)!, { tipo: 'libro', id }));
    expect(nl.avisos.map((a) => a.texto), id).toEqual([]);
    expect(nl.errores, id).toEqual([]);
    // every element of the book's netlist is written
    for (const n of elementos(t).filter((x) => !x.startsWith('.') && !x.startsWith('*') && !x.startsWith('+'))) expect(elementos(nl.texto), id).toContain(n);
  }
});

// ------------------------------------------------------------------ 3. deep links

test('enlaces: epa://leccion/<parte>/<label> válido, y todo lo demás rechazado', async () => {
  const { leerEnlace, LONGITUD_MAXIMA } = await import('../src/lib/enlaces.ts');
  expect(leerEnlace('epa://leccion/cap01/sec-1.4')).toEqual({ parte: 'cap01', label: 'sec-1.4' });
  expect(leerEnlace('  EPA://Leccion/APA/SEC-A.1/ ')).toEqual({ parte: 'apa', label: 'sec-a.1' });
  expect(leerEnlace('epa://leccion/apg/apg-3')).toEqual({ parte: 'apg', label: 'apg-3' });
  for (const malo of [
    null,
    undefined,
    42,
    {},
    '',
    'epa://',
    'epa://leccion',
    'epa://leccion/cap01',
    'epa://leccion/cap01/',
    'epa://leccion//sec-1.4',
    'epa://leccion/cap01/sec-1.4/extra',
    'epa://leccion/cap01/sec-1.4?x=1',
    'epa://leccion/cap01/sec-1.4#/editor',
    'epa://leccion/cap01/sec-1.4%2F..%2F',
    'epa://leccion/cap01/../../sincronizacion',
    'epa://leccion/cap01/sec-..',
    'epa://leccion/cap01/sec-1.4.',
    'epa://leccion/cap01/sec 1.4',
    'epa://leccion/cap01/sec_1.4',
    'epa://lección/cap01/sec-1.4',
    'epa://leccion/cap01/sec-1.4\u0000',
    'epa://editor/cap01/sec-1.4',
    'epa://evil.example/cap01/sec-1.4',
    'epa:leccion/cap01/sec-1.4',
    'epa:/leccion/cap01/sec-1.4',
    'https://leccion/cap01/sec-1.4',
    'javascript:alert(1)//epa://leccion/cap01/sec-1.4',
    'epa://leccion/glosario/sec-1.4',
    'epa://leccion/00_preliminares/00_preliminares-1',
    'epa://leccion/cap1/sec-1.4',
    'epa://leccion/cap01/fig-1.4',
    'epa://leccion/cap01/cap02-1',
    'epa://leccion/cap-new-/sec-new-1',
    'epa://leccion/cap-new-a.b/sec-new-1',
    'epa://leccion/cap-nueva/sec-new-1',
    `epa://leccion/cap01/sec-${'1'.repeat(LONGITUD_MAXIMA)}`,
  ])
    expect(leerEnlace(malo), String(malo)).toBeNull();
});

test('enlaces: la ruta de cada sección del libro, con la grafía del libro; lo desconocido, «no encontrada»', async () => {
  const { rutaDeEnlace, resolverEnlace } = await import('../src/lib/enlaces.ts');
  const indice = JSON.parse(readFileSync(path.join(WEB, 'public/libro/indice.json'), 'utf8')) as { partes: Record<string, { secciones?: { label: string }[] }> };
  let n = 0;
  for (const [parte, p] of Object.entries(indice.partes)) {
    // (review 11c: the expansions' new chapters, cap-new-<name>, have QR links too)
    if (!/^(cap\d{2}|ap[A-Z]|cap-new-[a-z0-9]+)$/.test(parte)) continue;
    for (const s of p.secciones ?? []) {
      // as printed (the QR) and as a reader or a platform may change its case
      for (const enlace of [`epa://leccion/${parte}/${s.label}`, `epa://leccion/${parte}/${s.label}`.toUpperCase()])
        expect(rutaDeEnlace(enlace, indice), enlace).toBe(`#/leccion/${parte}/${s.label}`);
      n++;
    }
  }
  expect(n).toBeGreaterThan(700);
  // (1.2: book 4.1 calls it cap56; a 4.0 QR with the provisional ids opens the same section)
  expect(rutaDeEnlace('epa://leccion/cap-new-maquinas/sec-new-maquinas.1', indice)).toBe('#/leccion/cap56/sec-56.1');
  // a valid shape the book does not have: its route (the lesson page says «no encontrada»); not resolved
  expect(rutaDeEnlace('epa://leccion/cap99/sec-99.1', indice)).toBe('#/leccion/cap99/sec-99.1');
  expect(resolverEnlace({ parte: 'cap01', label: 'sec-1.99' }, indice)).toBeNull();
  expect(resolverEnlace({ parte: 'cap01', label: 'sec-1.4' }, null)).toBeNull();
  // anything invalid: the lesson page with nothing (its «no encontrada»), never another route
  expect(rutaDeEnlace('epa://leccion/cap01/../../editor', indice)).toBe('#/leccion');
  expect(rutaDeEnlace(undefined)).toBe('#/leccion');
  // without the index yet: the link's own (lower) case; the lesson page resolves it once the index is there
  expect(rutaDeEnlace('epa://leccion/apA/sec-A.1')).toBe('#/leccion/apa/sec-a.1');
});

test('enlaces: en el navegador, el mismo enlace como hash; las rutas propias no se tocan', async () => {
  const { rutaDeHashEnlace } = await import('../src/lib/enlaces.ts');
  expect(rutaDeHashEnlace('#epa://leccion/cap01/sec-1.4')).toBe('#/leccion/cap01/sec-1.4');
  expect(rutaDeHashEnlace('#/epa://leccion/cap01/sec-1.4')).toBe('#/leccion/cap01/sec-1.4');
  expect(rutaDeHashEnlace('#epa%3A%2F%2Fleccion%2Fcap01%2Fsec-1.4')).toBe('#/leccion/cap01/sec-1.4');
  expect(rutaDeHashEnlace('#/EPA%3a%2f%2fleccion%2fcap01%2fsec-1.4')).toBe('#/leccion/cap01/sec-1.4');
  expect(rutaDeHashEnlace('#epa%3A%E0%A4%A')).toBe('#/leccion');
  expect(rutaDeHashEnlace('#epa://otra/cosa')).toBe('#/leccion');
  for (const propia of ['', '#', '#/', '#/cap01', '#/leccion/cap01/sec-1.4', '#/editor/libro/cap42/x', '#/epa', '#/guia/epa:'])
    expect(rutaDeHashEnlace(propia), propia).toBeNull();
});

test('enlaces en Android: el filtro de intención del esquema en el manifiesto generado, como lo escribe el plugin; idempotente', async () => {
  const { prepararManifiesto, contenidoBloque, BLOQUE } = await import('../scripts/android-enlaces.mjs');
  const conf = JSON.parse(readFileSync(path.join(WEB, '../src-tauri/tauri.conf.json'), 'utf8')) as { plugins: Record<string, unknown> };
  const config = conf.plugins['deep-link'];
  const plantilla = readFileSync(path.join(WEB, 'tests/enlaces11/AndroidManifest.plantilla.xml'), 'utf8');
  const una = prepararManifiesto(plantilla, config);
  expect(prepararManifiesto(una, config)).toBe(una);
  const marca = `<!-- ${BLOQUE}. AUTO-GENERATED. DO NOT REMOVE. -->`;
  expect(una.split(marca).length).toBe(3);
  // inside the activity, before its closing tag, with the scheme and the host
  const actividad = /<activity\b[\s\S]*?<\/activity>/.exec(una)![0];
  expect(actividad).toContain('<data android:scheme="epa" />');
  expect(actividad).toContain('<data android:host="leccion" />');
  expect(actividad).toContain('<action android:name="android.intent.action.VIEW" />');
  expect(actividad).toContain('<category android:name="android.intent.category.BROWSABLE" />');
  expect(actividad).not.toContain('autoVerify');
  expect(actividad.match(/android:launchMode="singleTask"/g)?.length).toBe(1);
  expect((una.match(/<intent-filter/g) ?? []).length).toBe(2);
  expect(contenidoBloque(config)).toContain('android:scheme="epa"');
  // the rest of the manifest untouched
  expect(una.replace(new RegExp(`\\s*${marca.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\s\\S]*?${marca.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`), '')).toBe(plantilla);
  // an activity without singleTask (or with another mode) gets it
  for (const otra of [plantilla.replace(/\s*android:launchMode="singleTask"/, ''), plantilla.replace('singleTask', 'standard')]) {
    const r = prepararManifiesto(otra, config);
    expect(/<activity\b[^>]*>/.exec(r)![0]).toContain('android:launchMode="singleTask"');
    expect(r.match(/android:launchMode=/g)?.length).toBe(1);
  }
  expect(() => prepararManifiesto(plantilla, { desktop: { schemes: ['epa'] } })).toThrow(/plugins\.deep-link\.mobile/);
  expect(() => prepararManifiesto('<manifest></manifest>', config)).toThrow(/única <activity>/);
});

test('enlaces: el esquema registrado en Tauri y el plugin fijado; la app escucha al arrancar', () => {
  const tauri = path.join(WEB, '../src-tauri');
  const conf = JSON.parse(readFileSync(path.join(tauri, 'tauri.conf.json'), 'utf8')) as { plugins: { 'deep-link': { desktop: { schemes: string[] }; mobile: { scheme: string[]; host: string; appLink: boolean }[] } } };
  expect(conf.plugins['deep-link'].desktop.schemes).toEqual(['epa']);
  expect(conf.plugins['deep-link'].mobile).toEqual([{ scheme: ['epa'], host: 'leccion', appLink: false }]);
  expect(readFileSync(path.join(tauri, 'Cargo.toml'), 'utf8')).toMatch(/^tauri-plugin-deep-link = "=2\.6\.3"$/m);
  expect(readFileSync(path.join(tauri, 'Cargo.lock'), 'utf8')).toMatch(/name = "tauri-plugin-deep-link"\nversion = "2\.6\.3"/);
  const lib = readFileSync(path.join(tauri, 'src/lib.rs'), 'utf8');
  expect(lib).toContain('.plugin(tauri_plugin_deep_link::init())');
  expect(lib).toContain('enlaces::enlace_pendiente');
  expect(lib).toContain('enlaces::segunda_instancia(app, &args)');
  // the single-instance plugin stays the first one
  expect(lib.indexOf('tauri_plugin_single_instance::init')).toBeLessThan(lib.indexOf('tauri_plugin_deep_link::init'));
  expect(readFileSync(path.join(WEB, 'src/App.svelte'), 'utf8')).toContain('void iniciarEnlaces();');
  expect(readFileSync(path.join(WEB, 'scripts/android-preparar.mjs'), 'utf8')).toContain('prepararEnlacesAndroid(androidDir');
});
