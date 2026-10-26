// Recorder of the instrumented VDP's hooks, plus the few BlastEm functions the VDP needs from the rest of the
// emulator (frame buffer, colour mapping, messages, save-state stubs), for the offline trace generators.
#include <stdarg.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include "vdp.h"
#include "render.h"
#include "util.h"
#include "vdp_ganchos.h"

vdp_registro vreg;
uint32_t vr_fb[VR_ALTO_FB * VR_ANCHO_FB];
uint32_t vr_cuadro[VR_ALTO_FB * VR_ANCHO_FB];
uint32_t vr_cuadros;
int headless = 0;
void *config = NULL;

#define CRECER(arr, n, cap) do { if ((n) == (cap)) { (cap) = (cap) ? (cap) * 2 : 4096; \
    (arr) = realloc((arr), (cap) * sizeof(*(arr))); if (!(arr)) { fprintf(stderr, "sin memoria\n"); exit(1); } } } while (0)

static void limpiar_actual(void) {
    memset(&vreg.actual, 0, sizeof vreg.actual);
    vreg.actual.esc_dir = -1;
}

void vr_vaciar(void) {
    vreg.n_ranuras = vreg.n_pixeles = vreg.n_lineas = 0;
    limpiar_actual();
}

void vdp_gancho_etiqueta(void *ctx, int etiqueta) { vreg.actual.etiquetas |= 1u << etiqueta; }

uint8_t vdp_gancho_lectura(void *ctx, uint32_t dir) {
    vdp_context *c = ctx;
    uint8_t v = c->vdpmem[dir];
    if (vreg.actual.n < VR_MAX_LECTURAS) {
        vreg.actual.dir[vreg.actual.n] = dir;
        vreg.actual.val[vreg.actual.n] = v;
        vreg.actual.n++;
    }
    return v;
}

uint32_t vdp_gancho_lectura32(void *ctx, uint32_t dir) {
    vdp_context *c = ctx;
    for (int i = 0; i < 4; i++) vdp_gancho_lectura(ctx, dir + i);
    return *((uint32_t *)(&c->vdpmem[dir]));
}

void vdp_gancho_escritura(void *ctx, uint32_t dir, uint32_t valor, int bytes) {
    vdp_context *c = ctx;
    vreg.actual.esc_dma = (c->flags & FLAG_DMA_RUN) != 0;
    vreg.actual.esc_dir = (int32_t)dir;
    vreg.actual.esc_val = valor;
    vreg.actual.esc_bytes = bytes;
}

void vdp_gancho_ranura(void *ctx) {
    vdp_context *c = ctx;
    if (vreg.activo) {
        vreg.actual.t = c->cycles;
        vreg.actual.linea = c->vcounter;
        CRECER(vreg.ranuras, vreg.n_ranuras, vreg.cap_ranuras);
        vreg.ranuras[vreg.n_ranuras++] = vreg.actual;
    }
    limpiar_actual();
}

void vdp_gancho_pixel(void *ctx, int ranura) {
    vdp_context *c = ctx;
    if (!vreg.activo || ranura < 6 || !c->output) return;
    CRECER(vreg.pixeles, vreg.n_pixeles, vreg.cap_pixeles);
    vr_pixel *p = &vreg.pixeles[vreg.n_pixeles++];
    p->t = c->cycles;
    p->fila = (uint32_t)((c->output - c->fb) / VR_ANCHO_FB);
    p->x = (ranura - 6) * 2;
}

void vdp_gancho_pixel_x(void *ctx, int x) {
    vdp_context *c = ctx;
    if (!vreg.activo || !c->output) return;
    CRECER(vreg.pixeles, vreg.n_pixeles, vreg.cap_pixeles);
    vr_pixel *p = &vreg.pixeles[vreg.n_pixeles++];
    p->t = c->cycles;
    p->fila = (uint32_t)((c->output - c->fb) / VR_ANCHO_FB);
    p->x = x & ~1;
}

void vdp_gancho_linea(void *ctx) {
    vdp_context *c = ctx;
    if (!vreg.activo && !vreg.lineas_siempre) return;
    CRECER(vreg.lineas, vreg.n_lineas, vreg.cap_lineas);
    vreg.lineas[vreg.n_lineas].t = c->cycles;
    vreg.lineas[vreg.n_lineas].linea = c->vcounter;
    vreg.n_lineas++;
}

// ---- render.h
uint32_t render_map_color(uint8_t r, uint8_t g, uint8_t b) { return (uint32_t)r << 16 | (uint32_t)g << 8 | b; }
uint32_t *render_get_framebuffer(uint8_t which, int *pitch) { *pitch = VR_ANCHO_FB * sizeof(uint32_t); return vr_fb; }
void render_framebuffer_updated(uint8_t which, int width) { memcpy(vr_cuadro, vr_fb, sizeof vr_fb); vr_cuadros++; }
uint8_t render_get_active_framebuffer(void) { return FRAMEBUFFER_ODD; }
uint32_t render_overscan_top(void) { return 0; }
uint32_t render_overscan_bot(void) { return 0; }
uint32_t render_overscan_left(void) { return 0; }
uint8_t render_create_window(char *caption, uint32_t width, uint32_t height, window_close_handler h) { return 0; }
void render_destroy_window(uint8_t which) {}
void render_set_video_standard(vid_std std) {}

// ---- util.h
void fatal_error(char *format, ...) { va_list a; va_start(a, format); vfprintf(stderr, format, a); va_end(a); exit(1); }
void warning(char *format, ...) { va_list a; va_start(a, format); vfprintf(stderr, format, a); va_end(a); }
void debug_message(char *format, ...) { va_list a; va_start(a, format); vfprintf(stderr, format, a); va_end(a); }

// ---- serialize.h / event_log.h (save states and event logs are not used)
void save_int32(serialize_buffer *b, uint32_t v) {}
void save_int16(serialize_buffer *b, uint16_t v) {}
void save_int8(serialize_buffer *b, uint8_t v) {}
void save_buffer8(serialize_buffer *b, void *v, size_t l) {}
void save_buffer16(serialize_buffer *b, uint16_t *v, size_t l) {}
uint32_t load_int32(deserialize_buffer *b) { return 0; }
uint16_t load_int16(deserialize_buffer *b) { return 0; }
uint8_t load_int8(deserialize_buffer *b) { return 0; }
void load_buffer8(deserialize_buffer *b, void *d, size_t l) {}
void load_buffer16(deserialize_buffer *b, uint16_t *d, size_t l) {}
void reader_ensure_data(event_reader *r, size_t bytes) {}
