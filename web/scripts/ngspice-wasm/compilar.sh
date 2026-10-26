#!/usr/bin/env bash
# Builds ngspice 45.2 WITH XSPICE (all standard code-model libraries linked in statically) to WebAssembly and
# writes web/vendor/ngspice-xspice/ (ngspice.mjs, ngspice.wasm, compilacion.json, LICENSE.txt).
# See README.md in this folder. Versions and checksums: versiones.sh.
#
#   web/scripts/ngspice-wasm/compilar.sh [fase…]
#
# Phases (all, in order, when none is given): herramientas fuentes cmpp configurar modelos compilar enlazar
# copiar. Environment:
#   TRABAJO    work directory (default ${TMPDIR:-/tmp}/ngspice-wasm; about 1 GB with the toolchain)
#   SALIDA     output directory (default web/vendor/ngspice-xspice)
#   TOOLCHAIN  github (default: emscripten + LLVM + binaryen releases, all from GitHub) | emsdk | sistema
#              (emcc already in PATH)
#   JOBS       parallel make jobs (default 2)
#   CFLAGS_OPT optimisation of the C compilation (default -O3; eecircuit-engine uses -O2)
#   LINK_OPT   optimisation of the final link, run by emcc through wasm-opt (default -O3)
#   WASM_OPT   extra wasm-opt pass on the linked binary, e.g. "-Oz" (default: none)
# Needs: bash, git, curl, tar with xz, python3, node (≥ 18), gcc, make, autoconf, automake, libtool, bison,
# flex, sha256sum, gzip.
set -euo pipefail

AQUI="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WEB="$(cd "$AQUI/../.." && pwd)"
# shellcheck source=versiones.sh
. "$AQUI/versiones.sh"

TRABAJO="${TRABAJO:-${TMPDIR:-/tmp}/ngspice-wasm}"
SALIDA="${SALIDA:-$WEB/vendor/ngspice-xspice}"
TOOLCHAIN="${TOOLCHAIN:-github}"
JOBS="${JOBS:-2}"
CFLAGS_OPT="${CFLAGS_OPT:--O3}"
LINK_OPT="${LINK_OPT:--O3}"
WASM_OPT="${WASM_OPT:-}"

TC="$TRABAJO/toolchain"
SRC="$TRABAJO/ngspice"
BUILD="$SRC/release"
ICM="$SRC/src/xspice/icm"
GEN="$TRABAJO/codemodels"
CMPP="$TRABAJO/cmpp/cmpp"

log() { printf '\n== compilar.sh: %s\n' "$*"; }
falla() { printf 'compilar.sh: ERROR: %s\n' "$*" >&2; exit 1; }

mkdir -p "$TRABAJO"

# ------------------------------------------------------------------------------------------------ toolchain
activar_toolchain() {
  case "$TOOLCHAIN" in
    github)
      export EM_CONFIG="$TC/emscripten.config"
      export PATH="$TC/emscripten:$TC/binaryen/bin:$PATH"
      ;;
    emsdk)
      # shellcheck disable=SC1091
      . "$TC/emsdk/emsdk_env.sh" >/dev/null
      ;;
    sistema) ;;
    *) falla "TOOLCHAIN desconocido: $TOOLCHAIN" ;;
  esac
  command -v emcc >/dev/null || falla "no se encuentra emcc (TOOLCHAIN=$TOOLCHAIN)"
}

fase_herramientas() {
  case "$TOOLCHAIN" in
    github) herramientas_github ;;
    emsdk)
      log "emsdk $EMSCRIPTEN_VERSION"
      [ -d "$TC/emsdk" ] || git clone -q "$EMSDK_GIT" "$TC/emsdk"
      git -C "$TC/emsdk" checkout -q "$EMSCRIPTEN_VERSION"
      "$TC/emsdk/emsdk" install "$EMSCRIPTEN_VERSION"
      "$TC/emsdk/emsdk" activate "$EMSCRIPTEN_VERSION"
      ;;
    sistema) ;;
  esac
  activar_toolchain
  emcc --version | head -1
}

herramientas_github() {
  mkdir -p "$TC"
  if [ ! -x "$TC/llvm/bin/clang" ]; then
    log "LLVM $LLVM_VERSION (solo clang, wasm-ld y binutils de LLVM; se descarga en flujo, ≈ 2 GB)"
    rm -rf "$TC/llvm" "$TC/llvm.sha256"
    mkdir -p "$TC/llvm"
    curl -fsSL "$LLVM_URL" | tee >(sha256sum | cut -d' ' -f1 > "$TC/llvm.sha256") |
      tar xJf - -C "$TC/llvm" --strip-components=1 --wildcards \
        '*/bin/clang' '*/bin/clang-[0-9]*' '*/bin/clang++' '*/bin/lld' '*/bin/wasm-ld' '*/bin/llvm-ar' \
        '*/bin/llvm-ranlib' '*/bin/llvm-nm' '*/bin/llvm-objcopy' '*/bin/llvm-strip' '*/lib/clang/*/include'
    for _ in $(seq 60); do [ -s "$TC/llvm.sha256" ] && break; sleep 1; done
    [ "$(cat "$TC/llvm.sha256")" = "$LLVM_SHA256" ] ||
      { rm -rf "$TC/llvm"; falla "suma SHA-256 de LLVM incorrecta: $(cat "$TC/llvm.sha256")"; }
    if command -v strip >/dev/null; then
      strip "$TC"/llvm/bin/clang-[0-9]* "$TC/llvm/bin/lld" "$TC/llvm/bin/llvm-ar" "$TC/llvm/bin/llvm-nm" \
        "$TC/llvm/bin/llvm-objcopy" || true
    fi
  fi
  if [ ! -x "$TC/binaryen/bin/wasm-opt" ]; then
    log "binaryen $BINARYEN_VERSION"
    rm -rf "$TC/binaryen"
    mkdir -p "$TC/binaryen"
    curl -fsSL "$BINARYEN_URL" -o "$TC/binaryen.tar.gz"
    echo "$BINARYEN_SHA256  $TC/binaryen.tar.gz" | sha256sum -c --quiet || falla "suma SHA-256 de binaryen incorrecta"
    tar xzf "$TC/binaryen.tar.gz" -C "$TC/binaryen" --strip-components=1 --wildcards \
      '*/bin/wasm-opt' '*/bin/wasm-metadce' '*/bin/wasm-emscripten-finalize' '*/bin/wasm-ctor-eval'
    rm "$TC/binaryen.tar.gz"
  fi
  if [ ! -x "$TC/emscripten/emcc" ]; then
    log "emscripten $EMSCRIPTEN_VERSION"
    rm -rf "$TC/emscripten"
    git -c advice.detachedHead=false clone -q --depth 1 --branch "$EMSCRIPTEN_VERSION" "$EMSCRIPTEN_GIT" "$TC/emscripten"
    [ "$(git -C "$TC/emscripten" rev-parse HEAD)" = "$EMSCRIPTEN_COMMIT" ] || falla "emscripten: commit inesperado"
    (cd "$TC/emscripten" && npm ci --omit=dev --omit=optional --no-audit --no-fund --loglevel=error)
    # The launcher scripts (emcc, emconfigure…) are generated; the generator also writes test/runner.
    mkdir -p "$TC/emscripten/test"
    python3 "$TC/emscripten/tools/maint/create_entry_points.py"
    rm -rf "$TC/emscripten/test" "$TC/emscripten/docs" "$TC/emscripten/site" "$TC/emscripten/media" \
      "$TC/emscripten/.git"
  fi
  cat > "$TC/emscripten.config" <<EOF
LLVM_ROOT = '$TC/llvm/bin'
BINARYEN_ROOT = '$TC/binaryen'
NODE_JS = '$(command -v node)'
CACHE = '$TC/cache'
EOF
}

# ------------------------------------------------------------------------------------------------ sources
fase_fuentes() {
  log "ngspice $NGSPICE_VERSION ($NGSPICE_COMMIT)"
  rm -rf "$SRC"
  git -c advice.detachedHead=false clone -q --depth 1 --branch "$NGSPICE_TAG" "$NGSPICE_GIT" "$SRC"
  [ "$(git -C "$SRC" rev-parse HEAD)" = "$NGSPICE_COMMIT" ] || falla "ngspice: commit inesperado"
  python3 -I "$AQUI/parches.py" "$SRC"
}

# cmpp (the XSPICE code-model preprocessor) runs on the build machine: native compiler, not emcc.
fase_cmpp() {
  log "cmpp nativo"
  local c="$SRC/src/xspice/cmpp" d="$TRABAJO/cmpp"
  rm -rf "$d"
  mkdir -p "$d"
  flex -o "$d/ifs_lex.c" "$c/ifs_lex.l"
  flex -o "$d/mod_lex.c" "$c/mod_lex.l"
  bison -d -o "$d/ifs_yacc.c" "$c/ifs_yacc.y" 2>/dev/null
  bison -d -o "$d/mod_yacc.c" "$c/mod_yacc.y" 2>/dev/null
  "${CC_FOR_BUILD:-gcc}" -O1 -w -I"$d" -I"$c" -o "$CMPP" "$c/main.c" "$c/file_buffer.c" "$c/pp_ifs.c" \
    "$c/pp_lst.c" "$c/pp_mod.c" "$c/read_ifs.c" "$c/writ_ifs.c" "$c/util.c" \
    "$d/ifs_lex.c" "$d/ifs_yacc.c" "$d/mod_lex.c" "$d/mod_yacc.c"
}

# ------------------------------------------------------------------------------------------------ configure
fase_configurar() {
  activar_toolchain
  log "configure (XSPICE, KLU, sin OSDI, sin X11, sin readline)"
  # Reproducible build date (configure puts it in config.h; ngspice prints it): the date of the ngspice commit.
  SOURCE_DATE_EPOCH="$(git -C "$SRC" log -1 --format=%ct)"
  export SOURCE_DATE_EPOCH
  (cd "$SRC" && ./autogen.sh >/dev/null 2>&1) || (cd "$SRC" && ./autogen.sh)
  rm -rf "$BUILD"
  mkdir -p "$BUILD"
  (cd "$BUILD" && emconfigure ../configure --disable-debug --disable-openmp --enable-xspice --disable-osdi \
    --without-x --with-readline=no \
    CFLAGS="$CFLAGS_OPT -DXSPICE_STATIC_CM -Wno-everything" > configure.log 2>&1) ||
    { tail -40 "$BUILD/configure.log"; falla "configure"; }
  grep -q '#define XSPICE 1' "$BUILD/src/include/ngspice/config.h" || falla "configure no ha activado XSPICE"
  # Link line of the ngspice program (same flags as eecircuit-engine, plus the code models).
  python3 -I - "$BUILD/src/Makefile" "$GEN/libcodemodels.a" "$AQUI/pre.js" "$LINK_OPT" <<'EOF'
import sys
path, lib, pre, opt = sys.argv[1:]
text = open(path).read()
old = '$(ngspice_LDADD) $(LIBS)'
assert text.count(old) == 1, f'src/Makefile: se esperaba una vez {old!r}, hay {text.count(old)}'
flags = (f'{lib} {opt} -s ASYNCIFY=1 -s ASYNCIFY_ADVISE=0 -s ASYNCIFY_IGNORE_INDIRECT=0 '
         '-s ENVIRONMENT="web,worker" -s ALLOW_MEMORY_GROWTH=1 -s MODULARIZE=1 -s EXPORT_ES6=1 '
         '-s EXPORTED_RUNTIME_METHODS=["FS","Asyncify","callMain"] '
         f'--pre-js {pre} -o spice.mjs')
open(path, 'w').write(text.replace(old, f'{old} {flags}'))
print('compilar.sh: src/Makefile: enlace de ngspice con los modelos de código y Asyncify')
EOF
}

# ------------------------------------------------------------------------------------------------ code models
fase_modelos() {
  activar_toolchain
  log "modelos de código XSPICE: $CODEMODELS"
  rm -rf "$GEN"
  mkdir -p "$GEN/obj"
  local cflags=("$CFLAGS_OPT" -DXSPICE_STATIC_CM -Wno-everything -I"$BUILD/src/include" -I"$SRC/src/include")
  local objs=() lib m u f lista=""
  for lib in $CODEMODELS; do
    mkdir -p "$GEN/$lib"
    (cd "$GEN/$lib" && CMPP_IDIR="$ICM/$lib" CMPP_ODIR="$GEN/$lib" "$CMPP" -lst)
    for m in $("$CMPP" -p "$ICM/$lib/modpath.lst" || true); do
      mkdir -p "$GEN/$lib/$m"
      (cd "$GEN/$lib/$m" && CMPP_IDIR="$ICM/$lib/$m" CMPP_ODIR="$GEN/$lib/$m" "$CMPP" -ifs &&
        CMPP_IDIR="$ICM/$lib/$m" CMPP_ODIR="$GEN/$lib/$m" "$CMPP" -mod)
      for f in cfunc ifspec; do
        emcc "${cflags[@]}" -I"$GEN/$lib" -I"$ICM/$lib" -I"$ICM/$lib/$m" -I"$SRC/src/xspice/tlines" \
          -c "$GEN/$lib/$m/$f.c" -o "$GEN/obj/$lib-$m-$f.o"
        objs+=("$GEN/obj/$lib-$m-$f.o")
      done
    done
    for u in $("$CMPP" -p "$ICM/$lib/udnpath.lst" || true); do
      emcc "${cflags[@]}" -I"$GEN/$lib" -I"$ICM/$lib" -I"$ICM/$lib/$u" -c "$ICM/$lib/$u/udnfunc.c" \
        -o "$GEN/obj/$lib-$u-udnfunc.o"
      objs+=("$GEN/obj/$lib-$u-udnfunc.o")
    done
    emcc "${cflags[@]}" -DCM_LIB="$lib" -I"$GEN/$lib" -c "$AQUI/cm_estatico.c" -o "$GEN/obj/$lib-tabla.o"
    objs+=("$GEN/obj/$lib-tabla.o")
    lista="$lista X($lib)"
  done
  for f in msline_common tline_common; do
    emcc "${cflags[@]}" -I"$SRC/src/xspice/tlines" -c "$SRC/src/xspice/tlines/$f.c" -o "$GEN/obj/$f.o"
    objs+=("$GEN/obj/$f.o")
  done
  emcc "${cflags[@]}" -DCM_REGISTRY "-DCM_LIBRARIES=$lista" -c "$AQUI/cm_estatico.c" -o "$GEN/obj/registro.o"
  objs+=("$GEN/obj/registro.o")
  # dlmain.c ends with three helpers the code models call that are not core functions (fopen_with_path,
  # cm_message_printf, cm_is_inertial); everything before them is the dlopen interface, not used here.
  python3 -I - "$ICM/dlmain.c" "$GEN/dlmain_ayudas.c" <<'PY'
import sys
src, dst = sys.argv[1:]
text = open(src).read()
i = text.index('fopen_with_path()\n')
i = text.rindex('/*', 0, i)
tail = text[i:]
for name in ('FILE *fopen_with_path(', 'cm_message_printf(const char *fmt, ...)', 'Mif_Boolean_t cm_is_inertial('):
    assert name in tail, f'dlmain.c: falta {name}'
assert 'coreitf' not in tail, 'dlmain.c: el final usa coreitf'
head = """/* Generated by compilar.sh from the end of src/xspice/icm/dlmain.c (ngspice). */
#include <stdarg.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include "ngspice/config.h"
#include "ngspice/cpextern.h"
#include "ngspice/devdefs.h"
#include "ngspice/dstring.h"
#include "ngspice/dllitf.h"
#include "ngspice/evtudn.h"
#include "ngspice/inpdefs.h"
#include "ngspice/inertial.h"
#include "ngspice/cmproto.h"
/* In dlmain.c cm_getvar() forwards to the core's cp_getvar(). */
#define cm_getvar(name, type, retval, rsize) cp_getvar(name, type, retval, rsize)
"""
open(dst, 'w').write(head + tail)
PY
  emcc "${cflags[@]}" -c "$GEN/dlmain_ayudas.c" -o "$GEN/obj/dlmain_ayudas.o"
  objs+=("$GEN/obj/dlmain_ayudas.o")
  rm -f "$GEN/libcodemodels.a"
  emar rcs "$GEN/libcodemodels.a" "${objs[@]}"
  echo "compilar.sh: ${#objs[@]} objetos en $GEN/libcodemodels.a"
}

# ------------------------------------------------------------------------------------------------ build
fase_compilar() {
  activar_toolchain
  log "make -j$JOBS"
  (cd "$BUILD" && emmake make -j"$JOBS" > make.log 2>&1) || { grep -E 'error|Error' "$BUILD/make.log" | head -40; falla "make"; }
  [ -f "$BUILD/src/spice.wasm" ] || falla "no se ha generado src/spice.wasm"
}

# Re-link only (after changing LINK_OPT or pre.js): drop the program and make it again.
fase_enlazar() {
  activar_toolchain
  log "enlace"
  rm -f "$BUILD/src/ngspice" "$BUILD/src/spice.mjs" "$BUILD/src/spice.wasm"
  (cd "$BUILD/src" && emmake make ngspice > enlace.log 2>&1) || { tail -30 "$BUILD/src/enlace.log"; falla "enlace"; }
  if [ -n "$WASM_OPT" ]; then
    log "wasm-opt $WASM_OPT"
    wasm-opt "$BUILD/src/spice.wasm" $WASM_OPT --enable-bulk-memory --enable-nontrapping-float-to-int \
      --enable-sign-ext --enable-mutable-globals --enable-bulk-memory-opt --enable-call-indirect-overlong \
      -o "$BUILD/src/spice.opt.wasm"
    mv "$BUILD/src/spice.opt.wasm" "$BUILD/src/spice.wasm"
  fi
}

# ------------------------------------------------------------------------------------------------ output
fase_copiar() {
  activar_toolchain
  log "copiar a $SALIDA"
  mkdir -p "$SALIDA"
  local js="$BUILD/src/spice.mjs" wasm="$BUILD/src/spice.wasm"
  python3 -I - "$js" "$SALIDA/ngspice.mjs" <<'EOF'
import re, sys
src, dst = sys.argv[1:]
text = open(src).read()
# The default location of the binary is `new URL('spice.wasm', import.meta.url)`, which bundlers (Vite) try
# to resolve at build time. The app always passes instantiateWasm, so point it at locateFile/the plain name.
pat = re.compile(r"new URL\((['\"])spice\.wasm\1,\s*import\.meta\.url\)\.href")
n = len(pat.findall(text))
assert n <= 1, f'ngspice.mjs: {n} referencias a spice.wasm con import.meta.url'
text = pat.sub("'spice.wasm'", text)
open(dst, 'w').write('// ngspice 45.2 with XSPICE, compiled to WebAssembly by web/scripts/ngspice-wasm/compilar.sh. '
                     'Do not edit.\n' + text)
EOF
  cp "$wasm" "$SALIDA/ngspice.wasm"
  local tam gz sha
  tam=$(stat -c %s "$SALIDA/ngspice.wasm")
  gz=$(gzip -9 -c "$SALIDA/ngspice.wasm" | wc -c)
  sha=$(sha256sum "$SALIDA/ngspice.wasm" | cut -d' ' -f1)
  local emver
  emver=$(emcc --version | head -1)
  cat > "$SALIDA/compilacion.json" <<EOF
{
  "ngspice": { "version": "$NGSPICE_VERSION", "git": "$NGSPICE_GIT", "commit": "$NGSPICE_COMMIT" },
  "emscripten": { "version": "$EMSCRIPTEN_VERSION", "toolchain": "$TOOLCHAIN", "emcc": "$emver",
                  "llvm": "$LLVM_VERSION", "binaryen": "$BINARYEN_VERSION" },
  "xspice": { "codemodels": "$CODEMODELS", "registro": "estático (cm_estatico.c)" },
  "opciones": { "cflags": "$CFLAGS_OPT", "enlace": "$LINK_OPT", "wasm_opt": "$WASM_OPT" },
  "wasm": { "bytes": $tam, "gzip9": $gz, "sha256": "$sha" },
  "js": { "bytes": $(stat -c %s "$SALIDA/ngspice.mjs"), "sha256": "$(sha256sum "$SALIDA/ngspice.mjs" | cut -d' ' -f1)" }
}
EOF
  {
    printf 'ngspice %s con XSPICE, compilado a WebAssembly con Emscripten %s (web/scripts/ngspice-wasm).\n\n' \
      "$NGSPICE_VERSION" "$EMSCRIPTEN_VERSION"
    printf 'El código de enlace JavaScript y las bibliotecas del sistema (musl, compiler-rt) son de Emscripten,\n'
    printf 'con licencia MIT / University of Illinois (https://github.com/emscripten-core/emscripten).\n\n'
    printf 'Licencia de ngspice (fichero COPYING de sus fuentes):\n\n'
    cat "$SRC/COPYING"
  } > "$SALIDA/LICENSE.txt"
  cat "$SALIDA/compilacion.json"
}

FASES=("$@")
[ ${#FASES[@]} -gt 0 ] || FASES=(herramientas fuentes cmpp configurar modelos compilar copiar)
for f in "${FASES[@]}"; do
  "fase_$f"
done
log "listo"
