// The Mega Drive's Z80 (floooh's z80.h) on its own bus: 8 KB of RAM (U7) at $0000-$1FFF (mirrored to $3FFF),
// YM2612 at $4000-$5FFF, bank register at $6000, VDP/PSG at $7F00 and the 68000 window at $8000-$FFFF.
// md_traza.cpp ticks it once per Z80 clock (master clock / 15) while it owns its bus and is out of reset.
#define CHIPS_IMPL
#include <stdint.h>
#include <string.h>
#include "z80.h"
#include "z80_md.h"

uint8_t zmd_ram[0x2000];
static z80_t cpu;
static uint64_t pins;
static uint16_t banco;

void zmd_reiniciar(void) { pins = z80_init(&cpu); }

int zmd_frontera(void) { return z80_opdone(&cpu); }

int zmd_paso(zmd_evento *ev, zmd_estado *est) {
    pins = z80_tick(&cpu, pins);
    uint16_t a = Z80_GET_ADDR(pins);
    int n = 0;
    ev->a = a; ev->d = 0; ev->f = 0; ev->chip = ZMD_NINGUNO; ev->desfase = 0;
    if (pins & Z80_MREQ) {
        if ((pins & (Z80_M1 | Z80_RD)) == (Z80_M1 | Z80_RD)) {
            ev->tipo = ZMD_M1; n = 1;
            ev->empieza = z80_opdone(&cpu);
        } else if (pins & Z80_RFSH) { ev->tipo = ZMD_REFRESCO; n = 1; ev->empieza = 0; }
        else if (pins & Z80_RD) { ev->tipo = ZMD_LECTURA; ev->desfase = 1; n = 1; ev->empieza = 0; }
        else if (pins & Z80_WR) { ev->tipo = ZMD_ESCRITURA; ev->desfase = 1; n = 1; ev->empieza = 0; }
        if (n && ev->tipo != ZMD_REFRESCO) {
            uint8_t d = 0xFF;
            if (a < 0x4000) { ev->chip = ZMD_RAM; if (ev->tipo == ZMD_ESCRITURA) zmd_ram[a & 0x1FFF] = Z80_GET_DATA(pins); else d = zmd_ram[a & 0x1FFF]; }
            else if (a < 0x6000) { ev->chip = ZMD_YM; d = 0x00; }
            else if (a < 0x6100) { ev->chip = ZMD_BANCO; if (ev->tipo == ZMD_ESCRITURA) banco = ((banco >> 1) | ((Z80_GET_DATA(pins) & 1) << 8)) & 0x1FF; }
            else if (a < 0x8000) { ev->chip = ZMD_VDP; }
            else { ev->chip = ZMD_VENTANA; }
            if (ev->tipo == ZMD_ESCRITURA) ev->d = Z80_GET_DATA(pins);
            else { Z80_SET_DATA(pins, d); ev->d = d; }
        }
    } else if (pins & Z80_IORQ) {
        // the Mega Drive decodes no Z80 I/O ports
        ev->tipo = (pins & Z80_M1) ? ZMD_INTACK : (pins & Z80_WR) ? ZMD_ES_ESCRITURA : ZMD_ES_LECTURA;
        ev->desfase = ev->tipo == ZMD_ES_LECTURA ? 2 : 1;
        if (!(pins & Z80_WR)) { Z80_SET_DATA(pins, 0xFF); ev->d = 0xFF; } else ev->d = Z80_GET_DATA(pins);
        ev->empieza = 0; n = 1;
    }
    est->pc = cpu.pc; est->a = cpu.a; est->f = cpu.f; est->b = cpu.b; est->c = cpu.c; est->d = cpu.d; est->e = cpu.e;
    est->h = cpu.h; est->l = cpu.l; est->ix = cpu.ix; est->iy = cpu.iy; est->sp = cpu.sp; est->i = cpu.i;
    est->halt = (pins & Z80_HALT) != 0;
    return n;
}
