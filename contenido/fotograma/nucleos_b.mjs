// Third-party emulator cores of the «Un fotograma» generators of agent B, fetched at pinned commits from GitHub
// into contenido/.cache/fotograma/nucleos (never versioned: only their output is), checked by SHA-256, and the
// native trace tools built from them with the system C/C++ compiler.
//   - floooh/chips z80.h (zlib licence): the Z80 of the Master System and of the Mega Drive's sound side.
//   - dirkwhoffmann/Moira (MIT): the 68000 of the Mega Drive and the Neo Geo, in its precise timing mode.
//   - BlastEm's vdp.c / vdp.h (Michael Pavone, GPL-3, GitHub mirror libretro/blastem): the VDP of the Master System
//     (mode 4) and the Mega Drive, instrumented by vdp/parchear_vdp.py. Used offline only: the app ships the traces.

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = dirname(fileURLToPath(import.meta.url));
const CACHE = join(AQUI, '../.cache/fotograma/nucleos');

export const NUCLEOS = {
  chips: {
    url: 'https://raw.githubusercontent.com/floooh/chips/9e88298ce56319953ac7a43213a1120359f7a3a6/',
    ficheros: [['chips/z80.h', '6ca70ffd91b1bdbaf00f7a41e7092b326145fd1c95dcdd7bb01183370de734f3']],
  },
  blastem: {
    url: 'https://raw.githubusercontent.com/libretro/blastem/ef8917cf581954fe19ced558a0fa4f7dc17665d6/',
    ficheros: [
      ['vdp.c', 'cc60a16cc90a9fc0e812a3989fbd9ad40a3182438cc5b40e7fc3ab301eb2c454'],
      ['vdp.h', 'c282691478b6f4c7711576c98ed3d35f90917935a35a153f94d916b743c3ee13'],
    ],
  },
  moira: {
    url: 'https://raw.githubusercontent.com/dirkwhoffmann/Moira/ce28239b0507ebfe1bf2ad2b9c9252dc2f2cc031/',
    ficheros: [
    ['Moira/LICENSE', '1a561b630581419de4720e49c5fe5a4133b18ce20e0cd68fd9fce0dce27f0791'],
    ['Moira/Moira.cpp', '7487b9cf836f82c62f142aae583e7f0ba3586cbe1f813938384c0f82ab97ff60'],
    ['Moira/Moira.h', 'fce554988c0ea08e46ecec4c7900e563ebaeb5a19ee1523716c2f1c8fc7cbffb'],
    ['Moira/MoiraALU.h', 'a07d9b16bf75cafc80824dd1e6466fc79bf80175567c6d2a888efc031c4e0679'],
    ['Moira/MoiraALU_cpp.h', 'eab3f4c533a4cb91f2e161aa0a5e0b0b4f9a44a76ef3c77c35bbaa446fc91a74'],
    ['Moira/MoiraCache.h', 'f36245deaed0e9404322699aadfd174c727d2697914d32fba8c95dfeb32c12ca'],
    ['Moira/MoiraCache_cpp.h', 'b828dcc363cf8b31542ef668ea6e639041cdb1063f68f57376a246b7a7361370'],
    ['Moira/MoiraConfig.h', '4eaa843676341669f846db4b030c83f8ddc6736af04c02ac7797c023c0cbaefc'],
    ['Moira/MoiraCore68000.cpp', 'a8ae969d7a94db67ebaa4d99f0d8f1be0f83c9c1aefbea1a4fa2e0e782a24d70'],
    ['Moira/MoiraCore68010.cpp', 'ffa0dc6b2133da4b58db2c057ea78e003b68f13d3cf0bf0a86b29d6d50cd5dd0'],
    ['Moira/MoiraCore68020.cpp', 'f0c68795385db2b03594d2018b67b4aa69355bab2777ae554e8c701bee98e97c'],
    ['Moira/MoiraCore_cpp.h', '30b4598a530dad7a70eb3f890127a7cc21a3a24bdaa4efa3f21848beda12e8c6'],
    ['Moira/MoiraDasm.h', 'bdf897cf8f5e0a8eb721b9d4b39c12b6ff33034713943f26ace8a6144068ba39'],
    ['Moira/MoiraDasmFPU_cpp.h', 'd3e59d4637ee30ede92b85ba8990b52d8b562d6804f2ae44f81511ddd1325359'],
    ['Moira/MoiraDasmMMU_cpp.h', '7294ee0517bbcfd00f7806331848a2983f2a095b98f302ba3e22827f1f901ef0'],
    ['Moira/MoiraDasm_cpp.h', '9218d5490796b84168b4bd89a258f63be7323d85f0cc02508360f77cc2115f7c'],
    ['Moira/MoiraDataflow.h', '2c965c893df9c3e3113a4eb7f51f36aaa07a17e7a1bb350a40015c77402aecbb'],
    ['Moira/MoiraDataflow_cpp.h', '8c7aff3627095e244ba56bc3f8a4bc2b56ff59fd2b8ef3a363761c5112dde42b'],
    ['Moira/MoiraDebugger.cpp', '4934fc605e0a14b3bdf2a323a5eeebb15c0336f7ce64ba91ea6232c5149acbd7'],
    ['Moira/MoiraDebugger.h', '887e73d956814e8242d7b91a30160763a1dca60988a7e3979036907b55f31bf1'],
    ['Moira/MoiraExceptions.h', 'a8d9eb08120fd7ed0f4d6b35e07894d2361bdc6dc613c1851fb4fcb139de9435'],
    ['Moira/MoiraExceptions_cpp.h', '16a5cc7d4e5eba41020f944afc47d675853654b290a60d2566b0747fc671d57a'],
    ['Moira/MoiraExecFPU_cpp.h', '396847015a54c13bc5612f685cf66c1e78b8f19504d74abc26e8d29a7a6a2a6d'],
    ['Moira/MoiraExecMMU_cpp.h', 'c767bfd78edebdf19be65446baa025b94e948e0bb0e2be7bc5acba1fd0b91f23'],
    ['Moira/MoiraExec_cpp.h', '9a25f5e36de08969bfa0b3b9cc15ff6a82aa0895c34519fbd23814cf447698a2'],
    ['Moira/MoiraInit.h', '9456db69eb2b7feada61dc7c35c408b24730fce4d324f363bf15bb2fbb8d4d9e'],
    ['Moira/MoiraInit_cpp.h', '5749a4d0bd59f5db7a45152a49c4b7cdcf0d43cd226bd23c6be53222e63b5588'],
    ['Moira/MoiraMacros.h', 'ff840354b5e0a6d93ba9462d8b8dcfebbbdd23f63f08f8ce3b65bc7bf0ee489d'],
    ['Moira/MoiraTypes.h', 'f4f1c01f181c347f5b31fa349483c16c7084ab5e709563c1baac2346f5b6c4f0'],
    ['Moira/StrWriter.h', 'd7a6a5392bfde1dd6b0503e7cf3ebc1f154921bbcbd76956345a10bb0f82e9ad'],
    ['Moira/StrWriter_cpp.h', '97ee6426bc27115e5b515f26f66f5cb3cf0407bd3d799ebb7e44c249fa9f9c51'],
    ],
  },
};

function sha(buf) {
  return createHash('sha256').update(buf).digest('hex');
}

/** Downloads (once) every pinned file; returns the cache folder of each core. */
export function traerNucleos() {
  const dirs = {};
  for (const [id, n] of Object.entries(NUCLEOS)) {
    const dir = join(CACHE, id);
    for (const [f, h] of n.ficheros) {
      const ruta = join(dir, f);
      if (!existsSync(ruta) || sha(readFileSync(ruta)) !== h) {
        mkdirSync(dirname(ruta), { recursive: true });
        execFileSync('curl', ['-sSfL', '--retry', '3', '-o', ruta, n.url + f]);
        if (sha(readFileSync(ruta)) !== h) throw new Error(`${id}/${f}: el SHA-256 no coincide con el fijado`);
      }
    }
    dirs[id] = dir;
  }
  return dirs;
}

function viejo(salida, fuentes) {
  if (!existsSync(salida)) return true;
  const t = statSync(salida).mtimeMs;
  return fuentes.some((f) => statSync(f).mtimeMs > t);
}

function cc(args) {
  execFileSync(args[0], args.slice(1), { stdio: ['ignore', 'inherit', 'inherit'] });
}

/** Builds the native tools in `tmp` (only what changed) and returns their paths. */
export function herramientas(tmp) {
  const n = traerNucleos();
  mkdirSync(tmp, { recursive: true });
  const V = join(AQUI, 'vdp');
  const inc = ['-I', join(V, 'cabeceras'), '-I', V, '-I', join(n.blastem), '-I', join(n.chips, 'chips')];
  const vdpTraza = join(tmp, 'vdp_traza.c');
  if (viejo(vdpTraza, [join(n.blastem, 'vdp.c'), join(V, 'parchear_vdp.py')])) {
    execFileSync('python3', [join(V, 'parchear_vdp.py'), join(n.blastem, 'vdp.c'), vdpTraza], { stdio: 'inherit' });
  }
  const objVdp = join(tmp, 'vdp_traza.o');
  const objReg = join(tmp, 'vdp_registro.o');
  if (viejo(objVdp, [vdpTraza])) cc(['gcc', '-O2', '-w', '-c', ...inc, vdpTraza, '-o', objVdp]);
  if (viejo(objReg, [join(V, 'vdp_registro.c'), join(V, 'vdp_ganchos.h')])) cc(['gcc', '-O2', '-w', '-c', ...inc, join(V, 'vdp_registro.c'), '-o', objReg]);
  const out = {};
  const sms = join(tmp, 'sms_traza');
  const fSms = join(AQUI, 'sms/sms_traza.c');
  if (viejo(sms, [fSms, objVdp, objReg])) cc(['gcc', '-O2', '-w', ...inc, '-o', sms, fSms, objVdp, objReg]);
  out.sms_traza = sms;
  // Moira: a patched copy (precise timing, RTE/JSR bus order) compiled once
  const dirMoira = join(tmp, 'moira');
  const marca = join(dirMoira, '.parcheado');
  if (!existsSync(marca)) {
    mkdirSync(dirMoira, { recursive: true });
    for (const [f] of NUCLEOS.moira.ficheros) writeFileSync(join(dirMoira, f.replace('Moira/', '')), readFileSync(join(n.moira, f)));
    execFileSync('python3', [join(AQUI, 'm68k/parchear_moira.py'), dirMoira], { stdio: 'inherit' });
    writeFileSync(marca, '');
  }
  const objMoira = ['Moira', 'MoiraDebugger', 'MoiraCore68000', 'MoiraCore68010', 'MoiraCore68020'].map((f) => {
    const o = join(dirMoira, f + '.o');
    if (viejo(o, [marca])) cc(['g++', '-O1', '-std=c++20', '-w', '-c', join(dirMoira, f + '.cpp'), '-o', o]);
    return o;
  });
  const incMd = [...inc, '-I', join(AQUI, 'megadrive'), '-I', dirMoira];
  const objZmd = join(tmp, 'z80_md.o');
  if (viejo(objZmd, [join(AQUI, 'megadrive/z80_md.c')])) cc(['gcc', '-O2', '-w', '-c', ...incMd, join(AQUI, 'megadrive/z80_md.c'), '-o', objZmd]);
  const md = join(tmp, 'md_traza');
  const fMd = join(AQUI, 'megadrive/md_traza.cpp');
  if (viejo(md, [fMd, objVdp, objReg, objZmd, ...objMoira])) cc(['g++', '-O2', '-std=c++20', '-w', ...incMd, '-o', md, fMd, objVdp, objReg, objZmd, ...objMoira]);
  out.md_traza = md;
  const ng = join(tmp, 'ng_traza');
  const fNg = join(AQUI, 'neogeo/ng_traza.cpp');
  if (viejo(ng, [fNg, ...objMoira])) cc(['g++', '-O2', '-std=c++20', '-w', '-I', dirMoira, '-o', ng, fNg, ...objMoira]);
  out.ng_traza = ng;
  const m68sst = join(tmp, 'm68k_sst');
  const fM68 = join(AQUI, 'm68k/m68k_sst.cpp');
  if (viejo(m68sst, [fM68, ...objMoira])) cc(['g++', '-O2', '-std=c++20', '-w', '-I', dirMoira, '-o', m68sst, fM68, ...objMoira]);
  out.m68k_sst = m68sst;
  const sst = join(tmp, 'z80_sst');
  const fSst = join(AQUI, 'z80/z80_sst.c');
  if (viejo(sst, [fSst])) cc(['gcc', '-O2', '-w', ...inc, '-o', sst, fSst]);
  out.z80_sst = sst;
  return out;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  console.log(herramientas(process.argv[2] ?? join(AQUI, '../.cache/fotograma/bin')));
}
