// Hooks called by the instrumented BlastEm VDP (vdp_traza.c, written by parchear_vdp.py) and the recorder that
// collects them for the «Un fotograma» traces of the Master System and the Mega Drive (vdp_registro.c).
#ifndef VDP_GANCHOS_H_
#define VDP_GANCHOS_H_
#include <stdint.h>

// What the VDP is doing in a slot (several tags can share one slot).
// VG_MAPA / VG_PATRON: plane A (or the window, or the only plane of mode 4); _B: plane B (mode 5).
enum { VG_MAPA, VG_PATRON, VG_SPR_PATRON, VG_SPR_TABLA, VG_SPR_X, VG_EXTERNO, VG_MAPA_B, VG_PATRON_B };

struct vdp_context_s;
void vdp_gancho_etiqueta(void *ctx, int etiqueta);
uint8_t vdp_gancho_lectura(void *ctx, uint32_t dir);
uint32_t vdp_gancho_lectura32(void *ctx, uint32_t dir);
void vdp_gancho_ranura(void *ctx);
void vdp_gancho_escritura(void *ctx, uint32_t dir, uint32_t valor, int bytes);
void vdp_gancho_pixel(void *ctx, int ranura);
void vdp_gancho_pixel_x(void *ctx, int x);   // pixels from x (inactive mode)
void vdp_gancho_linea(void *ctx);

#define VDP_RD(ctx, a) vdp_gancho_lectura((ctx), (a))
#define VDP_RD32(ctx, a) vdp_gancho_lectura32((ctx), (a))

// ---- recorder (vdp_registro.c)
#define VR_MAX_LECTURAS 8
typedef struct {
    uint32_t t;            // master clock cycle at which the slot starts
    uint16_t linea;        // V counter during the slot
    uint8_t etiquetas;     // bit mask of VG_*
    uint8_t n;             // VRAM bytes read in the slot
    uint32_t dir[VR_MAX_LECTURAS];
    uint8_t val[VR_MAX_LECTURAS];
    int32_t esc_dir;       // VRAM write in this slot (-1: none)
    uint16_t esc_val;
    uint8_t esc_bytes;
    uint8_t esc_dma;       // the write comes from a DMA (68000 copy or fill)
} vr_ranura;

typedef struct { uint32_t t; uint32_t fila; uint16_t x; } vr_pixel;   // two pixels from x (output line buffer)
typedef struct { uint32_t t; uint16_t linea; } vr_linea;               // V counter when the line changes

typedef struct {
    int activo;
    int lineas_siempre;    // record line changes even while «activo» is off (to count frames)
    vr_ranura actual;
    vr_ranura *ranuras; uint32_t n_ranuras, cap_ranuras;
    vr_pixel *pixeles; uint32_t n_pixeles, cap_pixeles;
    vr_linea *lineas; uint32_t n_lineas, cap_lineas;
} vdp_registro;

extern vdp_registro vreg;
// Frame buffer handed to the VDP (pitch in uint32 = VR_ANCHO_FB) and the last finished frame.
#define VR_ANCHO_FB 512
#define VR_ALTO_FB 512
extern uint32_t vr_fb[VR_ALTO_FB * VR_ANCHO_FB];
extern uint32_t vr_cuadro[VR_ALTO_FB * VR_ANCHO_FB];
extern uint32_t vr_cuadros;            // finished frames
void vr_vaciar(void);
#endif
