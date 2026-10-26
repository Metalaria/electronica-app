#!/usr/bin/env python3
"""Source patches for building ngspice 45.2 with XSPICE to WebAssembly (called by compilar.sh).

    python3 -I parches.py <ngspice source dir>

Every patch is anchored on exact text of ngspice 45.2 and asserts that the anchor is there exactly once (or
that the patch is already applied), so a different ngspice version fails loudly instead of building something
subtly different. The patches:

1. HICUM2 removed, as in eecircuit-engine (the C++ HICUM2 model needs libstdc++ and the existing engine has
   no HICUM either; ngspice bug 793).
2. The Asyncify hook of eecircuit-engine: before ngspice reads each command line it calls
   Module.handleThings(), where the driver (web/src/simulador/motor/nucleo.ts) can suspend the WebAssembly
   stack. Same code as eecircuit-engine, so one driver serves both engines.
3. XSPICE without dynamic loading: cmpp and the code-model libraries (icm) are not built by make (cmpp must
   run on the build machine; compilar.sh builds it natively and compiles the code models itself), and
   load_opus() / main() use the static registry of cm_estatico.c instead of dlopen().
"""
import os
import re
import sys

src = sys.argv[1] if len(sys.argv) > 1 else sys.exit('uso: parches.py <directorio de ngspice>')


def patch(rel, old, new, count=1):
    """Replace `old` by `new` in file `rel`; `old` must occur exactly `count` times (or `new` already there)."""
    path = os.path.join(src, rel)
    with open(path, encoding='utf-8', errors='surrogateescape') as f:
        text = f.read()
    if new and new in text and old not in text:
        print(f'parches: {rel}: ya aplicado')
        return
    n = text.count(old)
    assert n == count, f'{rel}: se esperaba {count} vez/veces el ancla {old[:60]!r}, hay {n}'
    text = text.replace(old, new)
    with open(path, 'w', encoding='utf-8', errors='surrogateescape') as f:
        f.write(text)
    print(f'parches: {rel}: {n} cambio(s)')


def drop_lines(rel, predicate, expected):
    """Remove the lines for which predicate(line) is true; exactly `expected` of them (0 if already done)."""
    path = os.path.join(src, rel)
    with open(path, encoding='utf-8', errors='surrogateescape') as f:
        lines = f.readlines()
    keep = [l for l in lines if not predicate(l)]
    n = len(lines) - len(keep)
    assert n in (expected, 0), f'{rel}: se esperaban {expected} líneas que quitar, hay {n}'
    with open(path, 'w', encoding='utf-8', errors='surrogateescape') as f:
        f.writelines(keep)
    print(f'parches: {rel}: {n} línea(s) quitadas')


def solo_hicum2(l):
    """A SUBDIRS line that only lists hicum2 (with its continuation backslash)."""
    return re.fullmatch(r'hicum2\s*\\?', l.strip()) is not None


# 1. HICUM2 (and the libstdc++ check that only it needs)
drop_lines('configure.ac', lambda l: l.startswith('AC_CHECK_LIB(stdc++') or l.startswith('AC_SUBST(XTRALIBS'), 2)
drop_lines('configure.ac', lambda l: 'src/spicelib/devices/hicum2/Makefile' in l or 'tests/hicum2/Makefile' in l, 2)
drop_lines('src/Makefile.am', lambda l: 'spicelib/devices/hicum2/libhicum2.la' in l, 1)
drop_lines('src/spicelib/devices/Makefile.am', solo_hicum2, 2)
drop_lines('src/spicelib/devices/dev.c', lambda l: l.strip() == 'get_hicum_info,', 1)
drop_lines('tests/Makefile.am', solo_hicum2, 2)

# 2. Asyncify hook (identical to eecircuit-engine's Docker/run.sh)
patch('src/frontend/control.c', '#include "ngspice/ngspice.h"',
      '#include <emscripten.h>\n\n'
      'EM_ASYNC_JS(void, eesim_sleep_hack, (), {\n'
      '    if (Module["handleThings"]) {\n'
      '        await new Promise((resolve) => {\n'
      '            Module["handleThings"]();\n'
      '        });\n'
      '    }\n'
      '});\n\n'
      '#include "ngspice/ngspice.h"')
patch('src/frontend/control.c', 'freewl = wlist = getcommand(string);',
      'eesim_sleep_hack();\n\n\t\tfreewl = wlist = getcommand(string);')

# 3. XSPICE with statically linked code models
patch('src/xspice/Makefile.am', 'SUBDIRS = mif cm enh evt ipc idn cmpp icm verilog vhdl',
      'SUBDIRS = mif cm enh evt ipc idn')
patch('src/spicelib/devices/dev.c',
      'int load_opus(const char *name)\n{\n',
      'int load_opus(const char *name)\n{\n'
      '#ifdef XSPICE_STATIC_CM\n'
      '    /* WebAssembly build: the code models are linked in (cm_estatico.c), there is no dlopen(). */\n'
      '    extern int cm_static_load(const char *);\n'
      '    return cm_static_load(name);\n'
      '#endif\n')
patch('src/main.c',
      '            ft_sperror(rv, "SIMinit");\n            sp_shutdown(EXIT_BAD);\n        }\n    }\n',
      '            ft_sperror(rv, "SIMinit");\n            sp_shutdown(EXIT_BAD);\n        }\n    }\n'
      '#if defined(XSPICE) && defined(XSPICE_STATIC_CM)\n'
      '    /* Register the linked-in code models, as the codemodel lines of a standard spinit would. */\n'
      '    {\n'
      '        extern void cm_static_load_all(void);\n'
      '        cm_static_load_all();\n'
      '    }\n'
      '#endif\n')
print('parches: listo')
