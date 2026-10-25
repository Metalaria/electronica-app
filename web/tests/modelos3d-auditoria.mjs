#!/usr/bin/env node
// Geometry audit of every 3D component model (web/src/componentes/tres/modelos): finds what makes depth
// fighting (z-fighting) on GPUs with less depth precision (mobile, ANGLE-Metal) or broken cut faces.
//
//   PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers node tests/modelos3d-auditoria.mjs [--solo tipo1,tipo2] [--detalle bajo]
//       [--json salida.json]
//
// It starts its own Vite dev server (the models are imported as modules in a Chromium page, no WebGL needed),
// builds each model with its default parameters and reports:
//   - coplanar: two faces of different solids on the same plane (closer than 0,001 mm, five times the depth
//     step of a 16-bit depth buffer at the default view) overlapping by more than 0,0005 mm²
//     (same facing: always fight; opposite facing: touching solids, whose faces fight in the cutaway);
//   - rótulo: a text decal less than 0,008 mm above the face it lies on;
// and exits with 1 when something is found. Each finding names the two parts (DatosParte.parte) and meshes.

import { createServer } from 'vite';
import { chromium } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const web = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const opt = (k, d) => (args.includes(k) ? args[args.indexOf(k) + 1] : d);
const solo = opt('--solo', '');
const detalle = opt('--detalle', 'alto');
const salidaJson = opt('--json', '');

const servidor = await createServer({ root: web, configFile: path.join(web, 'vite.config.ts'), server: { port: 0, strictPort: false, host: '127.0.0.1' }, logLevel: 'error' });
await servidor.listen();
const dir = servidor.resolvedUrls?.local?.[0] ?? `http://127.0.0.1:${servidor.config.server.port}/`;
const navegador = await chromium.launch();
const pagina = await navegador.newPage();
await pagina.goto(dir + 'index.html').catch(() => {});

const resultado = await pagina.evaluate(
  async ({ solo, detalle }) => {
    const M = await import('/src/componentes/tres/modelos/index.ts');
    const tipos = solo ? solo.split(',') : M.tiposDisponibles();
    const informe = {};
    const nombreDe = (o) => {
      for (let p = o; p; p = p.parent) if (p.userData?.parte) return p.userData.parte;
      return o.name || '?';
    };
    for (const tipo of tipos) {
      const g = M.crearModelo(tipo, {}, { detalle });
      g.updateMatrixWorld(true);
      const tris = []; // [ax, ay, az, bx, by, bz, cx, cy, cz, solid id]
      const solidos = [];
      const decals = [];
      const m4 = g.matrixWorld.clone();
      const va = g.position.clone();
      g.traverse((o) => {
        if (!o.isMesh) return;
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        if (mats.every((m) => m.transparent && !m.map)) return; // glass: no depth writes
        const pos = o.geometry.getAttribute('position');
        const idx = o.geometry.index;
        const n = o.isInstancedMesh ? o.count : 1;
        for (let k = 0; k < n; k++) {
          if (o.isInstancedMesh) {
            o.getMatrixAt(k, m4);
            m4.premultiply(o.matrixWorld);
          } else m4.copy(o.matrixWorld);
          const id = solidos.length;
          solidos.push({ parte: nombreDe(o), malla: o.name || o.geometry.type, decal: !!o.userData.decal });
          const cuenta = idx ? idx.count : pos.count;
          const lista = o.userData.decal ? decals : tris;
          for (let i = 0; i < cuenta; i += 3) {
            const t = [];
            for (let j = 0; j < 3; j++) {
              va.fromBufferAttribute(pos, idx ? idx.getX(i + j) : i + j).applyMatrix4(m4);
              t.push(va.x, va.y, va.z);
            }
            t.push(id);
            lista.push(t);
          }
        }
      });
      // Plane of a triangle: unit normal and offset; degenerate ones are skipped.
      const plano = (t) => {
        const ux = t[3] - t[0], uy = t[4] - t[1], uz = t[5] - t[2];
        const wx = t[6] - t[0], wy = t[7] - t[1], wz = t[8] - t[2];
        let nx = uy * wz - uz * wy, ny = uz * wx - ux * wz, nz = ux * wy - uy * wx;
        const l = Math.hypot(nx, ny, nz);
        if (l < 1e-9) return null;
        nx /= l; ny /= l; nz /= l;
        return { n: [nx, ny, nz], d: nx * t[0] + ny * t[1] + nz * t[2], area: l / 2 };
      };
      // Bucket by canonical plane (normal up to sign, offset to 0,002 mm).
      const cubos = new Map();
      const claveDe = (p) => {
        let [x, y, z] = p.n;
        let d = p.d;
        const s = Math.abs(x) > 1e-6 ? Math.sign(x) : Math.abs(y) > 1e-6 ? Math.sign(y) : Math.sign(z);
        x *= s; y *= s; z *= s; d *= s;
        return { base: `${Math.round(x * 500)},${Math.round(y * 500)},${Math.round(z * 500)}`, q: Math.round(d / 0.002), signo: s };
      };
      const info = [];
      for (const t of tris) {
        const p = plano(t);
        if (!p || p.area < 1e-7) continue;
        const k = claveDe(p);
        const e = { t, p, s: k.signo };
        info.push([k, e]);
        const c = `${k.base}|${k.q}`;
        if (!cubos.has(c)) cubos.set(c, []);
        cubos.get(c).push(e);
      }
      // Overlap area of two coplanar triangles (2D clipping in the plane's basis).
      const area2d = (P) => {
        let a = 0;
        for (let i = 0; i < P.length; i++) {
          const [x0, y0] = P[i];
          const [x1, y1] = P[(i + 1) % P.length];
          a += x0 * y1 - x1 * y0;
        }
        return a / 2;
      };
      const recortar = (sujeto, clip) => {
        let salida = sujeto;
        const ccw = area2d(clip) > 0 ? 1 : -1;
        for (let i = 0; i < clip.length && salida.length; i++) {
          const A = clip[i];
          const B = clip[(i + 1) % clip.length];
          const dentro = (P) => ccw * ((B[0] - A[0]) * (P[1] - A[1]) - (B[1] - A[1]) * (P[0] - A[0])) >= -1e-12;
          const entrada = salida;
          salida = [];
          for (let j = 0; j < entrada.length; j++) {
            const P = entrada[j];
            const Q = entrada[(j + 1) % entrada.length];
            const dp = dentro(P);
            const dq = dentro(Q);
            if (dp) salida.push(P);
            if (dp !== dq) {
              const a1 = (B[0] - A[0]) * (P[1] - A[1]) - (B[1] - A[1]) * (P[0] - A[0]);
              const a2 = (B[0] - A[0]) * (Q[1] - A[1]) - (B[1] - A[1]) * (Q[0] - A[0]);
              const u = a1 / (a1 - a2);
              salida.push([P[0] + (Q[0] - P[0]) * u, P[1] + (Q[1] - P[1]) * u]);
            }
          }
        }
        return salida;
      };
      const solape = (a, b, n) => {
        const ref = Math.abs(n[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0];
        const e1 = [n[1] * ref[2] - n[2] * ref[1], n[2] * ref[0] - n[0] * ref[2], n[0] * ref[1] - n[1] * ref[0]];
        const l = Math.hypot(...e1);
        e1[0] /= l; e1[1] /= l; e1[2] /= l;
        const e2 = [n[1] * e1[2] - n[2] * e1[1], n[2] * e1[0] - n[0] * e1[2], n[0] * e1[1] - n[1] * e1[0]];
        const pr = (t) => [0, 1, 2].map((i) => [t[i * 3] * e1[0] + t[i * 3 + 1] * e1[1] + t[i * 3 + 2] * e1[2], t[i * 3] * e2[0] + t[i * 3 + 1] * e2[1] + t[i * 3 + 2] * e2[2]]);
        const r = recortar(pr(a), pr(b));
        return r.length >= 3 ? Math.abs(area2d(r)) : 0;
      };
      const pares = new Map();
      for (const [k, e] of info) {
        for (const dq of [-1, 0, 1]) {
          const lista = cubos.get(`${k.base}|${k.q + dq}`);
          if (!lista) continue;
          for (const f of lista) {
            const A = e.t[9];
            const B = f.t[9];
            if (A >= B) continue;
            if (Math.abs(e.p.d * e.s - f.p.d * f.s) > 0.001) continue;
            const a = solape(e.t, f.t, e.p.n);
            if (a < 1e-7) continue;
            const mismo = e.s === f.s;
            const clave = `${A}|${B}|${mismo}`;
            pares.set(clave, (pares.get(clave) ?? 0) + a);
          }
        }
      }
      const hallazgos = [];
      for (const [k, a] of pares) {
        if (a < 5e-4) continue;
        const [A, B, mismo] = k.split('|');
        const sa = solidos[A];
        const sb = solidos[B];
        hallazgos.push({ tipo: 'coplanar', mismo: mismo === 'true', a: sa.parte, b: sb.parte, area: Math.round(a * 1e4) / 1e4 });
      }
      // Decals: distance to the nearest parallel face below them.
      for (const d of decals) {
        const p = plano(d);
        if (!p) continue;
        let minimo = Infinity;
        const cx = (d[0] + d[3] + d[6]) / 3, cy = (d[1] + d[4] + d[7]) / 3, cz = (d[2] + d[5] + d[8]) / 3;
        for (const [k, e] of info) {
          const dot = e.p.n[0] * p.n[0] + e.p.n[1] * p.n[1] + e.p.n[2] * p.n[2];
          if (dot < 0.999) continue;
          const dist = p.d - e.p.d;
          if (dist < -1e-6 || dist > 0.05) continue;
          // The decal's centre must lie over that face.
          const q = [cx - p.n[0] * dist, cy - p.n[1] * dist, cz - p.n[2] * dist];
          const t = e.t;
          const sub = (i) => [t[i * 3] - q[0], t[i * 3 + 1] - q[1], t[i * 3 + 2] - q[2]];
          const cr = (u, v) => [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
          const [a, b, c] = [sub(0), sub(1), sub(2)];
          const s1 = cr(a, b), s2 = cr(b, c), s3 = cr(c, a);
          const sg = (v) => Math.sign(v[0] * p.n[0] + v[1] * p.n[1] + v[2] * p.n[2]);
          if (sg(s1) === sg(s2) && sg(s2) === sg(s3)) minimo = Math.min(minimo, dist);
        }
        if (minimo < 0.008) hallazgos.push({ tipo: 'rotulo', a: solidos[d[9]].parte, distancia: Math.round(minimo * 1e5) / 1e5 });
      }
      // One line per kind and pair of parts.
      const unicos = new Map();
      for (const h of hallazgos) {
        const k = `${h.tipo}|${h.a}|${h.b ?? ''}|${h.mismo ?? ''}`;
        const x = unicos.get(k);
        if (x) {
          if (h.area) x.area = Math.round((x.area + h.area) * 1e4) / 1e4;
          x.veces++;
        } else unicos.set(k, { ...h, veces: 1 });
      }
      informe[tipo] = { triangulos: tris.length, hallazgos: [...unicos.values()] };
      M.liberarModelo(g);
    }
    return informe;
  },
  { solo, detalle },
);

await navegador.close();
await servidor.close();
let total = 0;
for (const [tipo, r] of Object.entries(resultado)) {
  total += r.hallazgos.length;
  if (!r.hallazgos.length) {
    console.log(`${tipo}: bien (${r.triangulos} triángulos)`);
    continue;
  }
  console.log(`${tipo}: ${r.hallazgos.length} problema(s)`);
  for (const h of r.hallazgos) {
    if (h.tipo === 'coplanar') console.log(`   caras coplanarias ${h.mismo ? 'del mismo lado' : 'enfrentadas'}: ${h.a} ↔ ${h.b} (${h.area} mm²${h.veces > 1 ? `, ${h.veces} piezas` : ''})`);
    else console.log(`   rótulo a ${h.distancia} mm de su cara: ${h.a}`);
  }
}
console.log(`\n${Object.keys(resultado).length} modelos, ${total} problema(s)`);
if (salidaJson) fs.writeFileSync(salidaJson, JSON.stringify(resultado, null, 1));
process.exit(total ? 1 : 0);
