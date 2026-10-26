/* Static registry of the XSPICE code models for the WebAssembly build of ngspice (compilar.sh).
 *
 * Native ngspice loads each code-model library (analog.cm, digital.cm, ...) with dlopen() from the
 * `codemodel` lines of spinit; dlmain.c gives every library its device table, its user-defined node table and
 * a pointer to the core functions. WebAssembly has no dlopen(), so the code models are compiled into the
 * binary and call the core functions directly (dlmain.c and its coreitf indirection are not used). This file
 * replaces dlmain.c and load_opus() (src/spicelib/devices/dev.c, patched by parches.py). It is compiled in
 * two roles:
 *
 *   -DCM_LIB=analog   (once per library, with -I<generated dir of the library>)
 *                     the library's tables, from the cminfo.h / udninfo.h written by `cmpp -lst`:
 *                     cm_static_analog_devs[] and cm_static_analog_udns[], NULL-terminated.
 *   -DCM_REGISTRY     cm_static_load(name) and cm_static_load_all(), which register those tables with
 *                     ngspice exactly as load_opus() does after dlopen() (add_device, add_udn).
 *
 * cm_static_load_all() runs once at start-up (patched main.c), in spinit order; `codemodel x.cm` afterwards
 * (from a user's spinit) is accepted and does nothing for a library already registered.
 */

#include <stdio.h>
#include <string.h>

#include "ngspice/ngspice.h"
#include "ngspice/devdefs.h"
#include "ngspice/evtudn.h"

#define CM_CAT2(a, b, c) a##b##c
#define CM_CAT(a, b, c) CM_CAT2(a, b, c)

#if defined(CM_LIB)

#include "cmextrn.h"
#include "udnextrn.h"

SPICEdev *CM_CAT(cm_static_, CM_LIB, _devs)[] = {
#include "cminfo.h"
    NULL
};

Evt_Udn_Info_t *CM_CAT(cm_static_, CM_LIB, _udns)[] = {
#include "udninfo.h"
    NULL
};

#elif defined(CM_REGISTRY)

int add_device(int n, SPICEdev **devs, int flag);
int add_udn(int n, Evt_Udn_Info_t **udns);

int cm_static_load(const char *name);
void cm_static_load_all(void);

/* CM_LIBRARIES is defined by compilar.sh, e.g. X(spice2poly) X(analog) X(digital) ... */
#define X(lib) extern SPICEdev *CM_CAT(cm_static_, lib, _devs)[]; \
               extern Evt_Udn_Info_t *CM_CAT(cm_static_, lib, _udns)[];
CM_LIBRARIES
#undef X

static struct {
    const char *name;
    SPICEdev **devs;
    Evt_Udn_Info_t **udns;
    int loaded;
} cm_static_libs[] = {
#define X(lib) { #lib, CM_CAT(cm_static_, lib, _devs), CM_CAT(cm_static_, lib, _udns), 0 },
    CM_LIBRARIES
#undef X
};

/* Accepts "analog", "analog.cm" or any path ending in one of those. Returns 0 on success, as load_opus(). */
int cm_static_load(const char *name)
{
    const char *base = name;
    const char *p;
    size_t len;
    size_t i;

    for (p = name; *p; p++)
        if (*p == '/' || *p == '\\')
            base = p + 1;
    len = strlen(base);
    if (len > 3 && strcmp(base + len - 3, ".cm") == 0)
        len -= 3;

    for (i = 0; i < sizeof cm_static_libs / sizeof cm_static_libs[0]; i++) {
        int n;
        if (strlen(cm_static_libs[i].name) != len || strncmp(cm_static_libs[i].name, base, len) != 0)
            continue;
        if (cm_static_libs[i].loaded)
            return 0;
        for (n = 0; cm_static_libs[i].devs[n]; n++)
            ;
        add_device(n, cm_static_libs[i].devs, 1);
        for (n = 0; cm_static_libs[i].udns[n]; n++)
            ;
        add_udn(n, cm_static_libs[i].udns);
        cm_static_libs[i].loaded = 1;
        return 0;
    }
    fprintf(stderr, "Error: code model library \"%s\" is not linked into this ngspice\n", name);
    return 1;
}

void cm_static_load_all(void)
{
    size_t i;
    for (i = 0; i < sizeof cm_static_libs / sizeof cm_static_libs[0]; i++)
        cm_static_load(cm_static_libs[i].name);
}

#else
#error "compile with -DCM_LIB=<library> or -DCM_REGISTRY"
#endif
