// Minimal libretro front end used only to cross-check «Un fotograma» frames against reference emulators
// (Genesis Plus GX for the Master System and Mega Drive, Geolith for the Neo Geo). Not part of the app.
// Usage: frente <core.so> <rom> <sysdir> <first frame> <last frame> <out prefix> [script "frame:mask,..."]
//        [var=value ...]
// Frame n (1-based) is the picture returned by the n-th retro_run. Mask bits follow RETRO_DEVICE_ID_JOYPAD_*.
#include <dlfcn.h>
#include <stdarg.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include "libretro.h"

static unsigned formato = RETRO_PIXEL_FORMAT_0RGB1555;
static const char *sysdir;
static unsigned cuadro, desde, hasta;
static const char *prefijo;
static int nguion; static unsigned gcuadro[512], gmascara[512];
static unsigned mascara;
static int nvars; static char *vclave[64], *vvalor[64];

static void registro(enum retro_log_level l, const char *fmt, ...) { if (!getenv("FRENTE_LOG")) return; (void)l; va_list ap; va_start(ap, fmt); vfprintf(stderr, fmt, ap); va_end(ap); }

static bool entorno(unsigned cmd, void *data) {
    switch (cmd) {
    case RETRO_ENVIRONMENT_GET_SYSTEM_DIRECTORY: case RETRO_ENVIRONMENT_GET_SAVE_DIRECTORY:
        *(const char **)data = sysdir; return true;
    case RETRO_ENVIRONMENT_SET_PIXEL_FORMAT: formato = *(const enum retro_pixel_format *)data; return true;
    case RETRO_ENVIRONMENT_GET_LOG_INTERFACE: ((struct retro_log_callback *)data)->log = registro; return true;
    case RETRO_ENVIRONMENT_GET_VARIABLE: {
        struct retro_variable *v = data;
        for (int i = 0; i < nvars; i++) if (!strcmp(v->key, vclave[i])) { v->value = vvalor[i]; return true; }
        v->value = NULL; return false;
    }
    case RETRO_ENVIRONMENT_GET_VARIABLE_UPDATE: *(bool *)data = false; return true;
    case RETRO_ENVIRONMENT_GET_CAN_DUPE: *(bool *)data = true; return true;
    default: return false;
    }
}

static void video(const void *datos, unsigned w, unsigned h, size_t pitch) {
    if (!datos || cuadro < desde || cuadro > hasta) return;
    char ruta[1024];
    snprintf(ruta, sizeof ruta, "%s%05u.ppm", prefijo, cuadro);
    FILE *f = fopen(ruta, "wb");
    fprintf(f, "P6 %u %u 255\n", w, h);
    for (unsigned y = 0; y < h; y++) {
        const uint8_t *fila = (const uint8_t *)datos + y * pitch;
        for (unsigned x = 0; x < w; x++) {
            uint8_t rgb[3];
            if (formato == RETRO_PIXEL_FORMAT_XRGB8888) {
                uint32_t p = ((const uint32_t *)fila)[x];
                rgb[0] = p >> 16; rgb[1] = p >> 8; rgb[2] = p;
            } else if (formato == RETRO_PIXEL_FORMAT_RGB565) {
                uint16_t p = ((const uint16_t *)fila)[x];
                rgb[0] = (p >> 11) << 3; rgb[1] = ((p >> 5) & 63) << 2; rgb[2] = (p & 31) << 3;
            } else {
                uint16_t p = ((const uint16_t *)fila)[x];
                rgb[0] = ((p >> 10) & 31) << 3; rgb[1] = ((p >> 5) & 31) << 3; rgb[2] = (p & 31) << 3;
            }
            fwrite(rgb, 1, 3, f);
        }
    }
    fclose(f);
}
static void audio(int16_t l, int16_t r) { (void)l; (void)r; }
static size_t audio_lote(const int16_t *d, size_t n) { (void)d; return n; }
static void sondeo(void) {}
static int16_t estado(unsigned puerto, unsigned disp, unsigned indice, unsigned id) {
    (void)disp; (void)indice;
    if (puerto) return 0;
    if (id == RETRO_DEVICE_ID_JOYPAD_MASK) return (int16_t)mascara;
    return (mascara >> id) & 1;
}

#define F(n) n = dlsym(h, #n); if (!n) { fprintf(stderr, "falta %s\n", #n); return 1; }
int main(int argc, char **argv) {
    if (argc < 7) { fprintf(stderr, "uso: frente core rom sysdir desde hasta prefijo [guion] [var=valor...]\n"); return 2; }
    void *h = dlopen(argv[1], RTLD_NOW);
    if (!h) { fprintf(stderr, "%s\n", dlerror()); return 1; }
    sysdir = argv[3]; desde = atoi(argv[4]); hasta = atoi(argv[5]); prefijo = argv[6];
    for (int i = 7; i < argc; i++) {
        char *eq = strchr(argv[i], '=');
        if (eq) { *eq = 0; vclave[nvars] = argv[i]; vvalor[nvars++] = eq + 1; continue; }
        for (const char *q = argv[i]; *q && nguion < 512;) {
            unsigned c, m; int n = 0;
            if (sscanf(q, "%u:%u%n", &c, &m, &n) != 2) break;
            gcuadro[nguion] = c; gmascara[nguion++] = m; q += n; if (*q == ',') q++;
        }
    }
    void (*retro_set_environment)(retro_environment_t); void (*retro_set_video_refresh)(retro_video_refresh_t);
    void (*retro_set_audio_sample)(retro_audio_sample_t); void (*retro_set_audio_sample_batch)(retro_audio_sample_batch_t);
    void (*retro_set_input_poll)(retro_input_poll_t); void (*retro_set_input_state)(retro_input_state_t);
    void (*retro_init)(void); bool (*retro_load_game)(const struct retro_game_info *); void (*retro_run)(void);
    void (*retro_set_controller_port_device)(unsigned, unsigned);
    void *(*retro_get_memory_data)(unsigned); size_t (*retro_get_memory_size)(unsigned);
    F(retro_set_environment) F(retro_set_video_refresh) F(retro_set_audio_sample) F(retro_set_audio_sample_batch)
    F(retro_set_input_poll) F(retro_set_input_state) F(retro_init) F(retro_load_game) F(retro_run)
    F(retro_set_controller_port_device) F(retro_get_memory_data) F(retro_get_memory_size)
    retro_set_environment(entorno);
    retro_init();
    retro_set_video_refresh(video); retro_set_audio_sample(audio); retro_set_audio_sample_batch(audio_lote);
    retro_set_input_poll(sondeo); retro_set_input_state(estado);
    FILE *f = fopen(argv[2], "rb");
    if (!f) { perror(argv[2]); return 1; }
    fseek(f, 0, SEEK_END); long n = ftell(f); fseek(f, 0, SEEK_SET);
    void *datos = malloc(n);
    if (fread(datos, 1, n, f) != (size_t)n) { fprintf(stderr, "lectura corta\n"); return 1; }
    fclose(f);
    struct retro_game_info gi = { argv[2], datos, (size_t)n, NULL };
    if (!retro_load_game(&gi)) { fprintf(stderr, "no carga\n"); return 1; }
    retro_set_controller_port_device(0, RETRO_DEVICE_JOYPAD);
    for (cuadro = 1; cuadro <= hasta; cuadro++) {
        for (int g = 0; g < nguion; g++) if (cuadro >= gcuadro[g]) mascara = gmascara[g];
        retro_run();
    }
    if (getenv("FRENTE_RAM")) {
        FILE *r = fopen(getenv("FRENTE_RAM"), "wb");
        fwrite(retro_get_memory_data(RETRO_MEMORY_SYSTEM_RAM), 1, retro_get_memory_size(RETRO_MEMORY_SYSTEM_RAM), r);
        fclose(r);
    }
    return 0;
}
