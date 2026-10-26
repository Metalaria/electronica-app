// See z80_md.c.
#ifndef Z80_MD_H_
#define Z80_MD_H_
#include <stdint.h>
#ifdef __cplusplus
extern "C" {
#endif
enum { ZMD_M1, ZMD_LECTURA, ZMD_ESCRITURA, ZMD_ES_LECTURA, ZMD_ES_ESCRITURA, ZMD_REFRESCO, ZMD_INTACK };
enum { ZMD_NINGUNO, ZMD_RAM, ZMD_YM, ZMD_BANCO, ZMD_VDP, ZMD_VENTANA };
typedef struct { uint16_t a; uint8_t d, tipo, chip, empieza, desfase, f; } zmd_evento;
typedef struct { uint16_t pc, ix, iy, sp; uint8_t a, f, b, c, d, e, h, l, i, halt; } zmd_estado;
extern uint8_t zmd_ram[0x2000];
void zmd_reiniciar(void);
int zmd_frontera(void);
int zmd_paso(zmd_evento *ev, zmd_estado *est);
#ifdef __cplusplus
}
#endif
#endif
