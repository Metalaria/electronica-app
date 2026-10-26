// Offline trace generator of the Master System II (PAL board 171-5922A) for «Un fotograma».
// Z80: floooh's cycle-stepped z80.h (zlib licence), checked with z80/validar_z80.py against SingleStepTests.
// VDP 315-5246 in mode 4: BlastEm's VDP core (GPL-3, run offline; vdp/parchear_vdp.py instruments it).
// Clock: the 53.203424 MHz oscillator; the Z80 runs at 1/15 of it, a VDP slot lasts 20 master cycles.
// The trace starts at the cartridge entry point $0000 with the boot ROM switched off (port $3E = $AB), as the
// Sega boot ROM leaves the console after checking the cartridge.
// Usage: sms_traza <rom.sms> <frames to run before the recorded one> <halt address> > salida.json
//        sms_traza <rom.sms> <frame since reset> --juego <start-up T states> [script] > salida.json
// Game mode: only the start-up (first T states) and the frame are recorded; script "frame:mask,…" holds buttons of
// pad 1 from a frame on (mask bit 0 up, 1 down, 2 left, 3 right, 4 button 1, 5 button 2).
#define CHIPS_IMPL
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include "z80.h"
#include "vdp.h"
#include "vdp_ganchos.h"

#define T_Z80 15u                       // master cycles per Z80 T state

enum { K_M1, K_LECTURA, K_ESCRITURA, K_ES_LECTURA, K_ES_ESCRITURA, K_REFRESCO, K_INTACK };
enum { C_NINGUNO, C_CARTUCHO, C_RAM, C_VDP, C_PSG, C_IO };
enum { F_ESCRITURA = 1, F_M1 = 2, F_VECTOR = 16, F_OPERANDO = 64 };

typedef struct { uint32_t t; uint16_t a; uint16_t d; uint8_t k, f, c; } evento;
typedef struct { uint32_t t; uint16_t pc; uint32_t ciclo; uint16_t r[12]; } instruccion;
typedef struct { uint32_t t; uint8_t k, v; } senal;

static evento *ev; static uint32_t n_ev, cap_ev;
static instruccion *ins; static uint32_t n_ins, cap_ins;
static senal *sen; static uint32_t n_sen, cap_sen;
#define CRECER(arr, n, cap) do { if ((n) == (cap)) { (cap) = (cap) ? (cap) * 2 : 4096; \
    (arr) = realloc((arr), (cap) * sizeof(*(arr))); } } while (0)

static uint8_t rom[0x100000];
static uint32_t rom_tam;
static uint8_t ram[0x2000];
static uint8_t paginas[3] = {0, 1, 2};   // Sega mapper ($FFFD-$FFFF)
static vdp_context *vdp;
static uint32_t mclk;
static int grabar = 1;                   // record bus events and instructions now
static uint8_t mando = 0;                // pad 1 buttons held (active high here)
typedef struct { int cuadro; uint8_t mascara; } pulsacion;
static pulsacion guion[256];
static int n_guion;

uint16_t read_dma_value(uint32_t address) { return 0; }   // no 68000 DMA on the Master System
static uint16_t bus_abierto(system_header *s) { return 0xFFFF; }   // as BlastEm's sms.c

static void bus(uint32_t t, uint16_t a, uint16_t d, uint8_t k, uint8_t f, uint8_t c) {
    if (!grabar) return;
    CRECER(ev, n_ev, cap_ev);
    ev[n_ev++] = (evento){t, a, d, k, f, c};
}

static uint8_t leer_mem(uint16_t a, uint8_t *chip) {
    if (a >= 0xC000) { *chip = C_RAM; return ram[a & 0x1FFF]; }
    *chip = C_CARTUCHO;
    uint32_t off = a < 0x400 ? a : (uint32_t)paginas[a >> 14] * 0x4000 + (a & 0x3FFF);
    return rom[off % rom_tam];
}

static void escribir_mem(uint16_t a, uint8_t d, uint8_t *chip) {
    if (a >= 0xC000) {
        *chip = C_RAM;
        ram[a & 0x1FFF] = d;
        if (a >= 0xFFFD) paginas[a - 0xFFFD] = d;
    } else *chip = C_CARTUCHO;   // writes to ROM go nowhere
}

static uint8_t leer_es(uint16_t p, uint8_t *chip) {
    switch (p & 0xC1) {
    case 0x40: case 0x41: {
        *chip = C_VDP;
        uint16_t hv = vdp_hv_counter_read(vdp);
        return (p & 1) ? hv & 0xFF : hv >> 8;
    }
    case 0x80: *chip = C_VDP; return vdp_data_port_read_pbc(vdp);
    case 0x81: {
        *chip = C_VDP;
        uint8_t r = vdp_control_port_read(vdp);
        vdp->flags2 &= ~(FLAG2_VINT_PENDING | FLAG2_HINT_PENDING);
        return r;
    }
    case 0xC0: *chip = C_IO; return (uint8_t)~mando;   // port $DC: pad 1 (active low), pad 2 up/down
    case 0xC1: *chip = C_IO; return 0xFF;               // port $DD
    default: *chip = C_IO; return 0xFF;
    }
}

static void escribir_es(uint16_t p, uint8_t d, uint8_t *chip) {
    switch (p & 0xC1) {
    case 0x40: case 0x41: *chip = C_PSG; break;      // SN76489 inside the VDP: silent in these programs
    case 0x80: *chip = C_VDP; vdp_data_port_write_pbc(vdp, d); break;
    case 0x81: *chip = C_VDP; vdp_control_port_write_pbc(vdp, d); break;
    default: *chip = C_IO; break;                    // $3E memory control, $3F I/O control (315-5237)
    }
}

static int linea_int(void) {
    return ((vdp->flags2 & FLAG2_VINT_PENDING) && (vdp->regs[REG_MODE_2] & BIT_VINT_EN)) ||
           ((vdp->flags2 & FLAG2_HINT_PENDING) && (vdp->regs[REG_MODE_1] & BIT_HINT_EN));
}

static void json_u32(const char *nombre, uint32_t n, uint32_t (*f)(uint32_t), int coma) {
    printf("\"%s\":[", nombre);
    for (uint32_t i = 0; i < n; i++) printf(i ? ",%u" : "%u", f(i));
    printf("]%s\n", coma ? "," : "");
}
static uint32_t ev_t(uint32_t i) { return ev[i].t; }
static uint32_t ev_a(uint32_t i) { return ev[i].a; }
static uint32_t ev_d(uint32_t i) { return ev[i].d; }
static uint32_t ev_k(uint32_t i) { return ev[i].k; }
static uint32_t ev_f(uint32_t i) { return ev[i].f; }
static uint32_t ev_c(uint32_t i) { return ev[i].c; }
static uint32_t in_t(uint32_t i) { return ins[i].t; }
static uint32_t in_pc(uint32_t i) { return ins[i].pc; }
static uint32_t in_ciclo(uint32_t i) { return ins[i].ciclo; }
static int reg_i;
static uint32_t in_r(uint32_t i) { return ins[i].r[reg_i]; }
static uint32_t se_t(uint32_t i) { return sen[i].t; }
static uint32_t se_k(uint32_t i) { return sen[i].k; }
static uint32_t se_v(uint32_t i) { return sen[i].v; }
static uint32_t ra_t(uint32_t i) { return vreg.ranuras[i].t; }
static uint32_t ra_linea(uint32_t i) { return vreg.ranuras[i].linea; }
static uint32_t ra_etq(uint32_t i) { return vreg.ranuras[i].etiquetas; }
static uint32_t ra_n(uint32_t i) { return vreg.ranuras[i].n; }
static uint32_t ra_dir0(uint32_t i) { return vreg.ranuras[i].n ? vreg.ranuras[i].dir[0] : 0; }
static uint32_t ra_val(uint32_t i) {
    vr_ranura *r = &vreg.ranuras[i];
    uint32_t v = 0;
    for (int j = 0; j < r->n && j < 4; j++) v |= (uint32_t)r->val[j] << (8 * j);
    return v;
}
static uint32_t ra_dirs(uint32_t i) {   // second address (sprite scan reads two unrelated bytes)
    vr_ranura *r = &vreg.ranuras[i];
    return r->n > 1 ? r->dir[1] : 0;
}
static uint32_t ra_esc_dir(uint32_t i) { return (uint32_t)(vreg.ranuras[i].esc_dir + 1); }
static uint32_t ra_esc_val(uint32_t i) { return vreg.ranuras[i].esc_val; }
static uint32_t px_t(uint32_t i) { return vreg.pixeles[i].t; }
static uint32_t px_fila(uint32_t i) { return vreg.pixeles[i].fila; }
static uint32_t px_x(uint32_t i) { return vreg.pixeles[i].x; }
static uint32_t li_t(uint32_t i) { return vreg.lineas[i].t; }
static uint32_t li_l(uint32_t i) { return vreg.lineas[i].linea; }

int main(int argc, char **argv) {
    if (argc < 4) { fprintf(stderr, "uso: sms_traza <rom> <cuadros previos> <dirección de HALT>\n"); return 2; }
    FILE *f = fopen(argv[1], "rb");
    if (!f) { perror(argv[1]); return 1; }
    rom_tam = fread(rom, 1, sizeof rom, f);
    fclose(f);
    int previos = atoi(argv[2]);
    int modo_juego = !strcmp(argv[3], "--juego");
    uint16_t dir_halt = modo_juego ? 0 : (uint16_t)strtol(argv[3], NULL, 0);
    uint64_t ticks_arranque = modo_juego && argc > 4 ? strtoull(argv[4], NULL, 10) : 0;
    if (modo_juego && argc > 5) {
        for (const char *q = argv[5]; *q && n_guion < 256;) {
            int c, m, n = 0;
            if (sscanf(q, "%d:%d%n", &c, &m, &n) != 2) break;
            guion[n_guion++] = (pulsacion){c, (uint8_t)m};
            q += n;
            if (*q == ',') q++;
        }
    }

    // colours: what the VDP outputs for each of the 64 Master System colours (CRAM through the data port)
    uint32_t paleta[64];
    {
        vdp_context *p = init_vdp_context(1, 0);
        vdp_control_port_write_pbc(p, 0x04); vdp_control_port_write_pbc(p, 0x80);   // mode 4
        for (int base = 0; base < 64; base += 32) {
            vdp_control_port_write_pbc(p, 0x00); vdp_control_port_write_pbc(p, 0xC0);
            for (int i = 0; i < 32; i++) vdp_data_port_write_pbc(p, base + i);
            vdp_run_context_full(p, p->cycles + 3420 * 3);
            for (int i = 0; i < 32; i++) paleta[base + i] = p->colors[MODE4_OFFSET + i];
        }
        vdp_free(p);
    }

    vdp = init_vdp_context(1, 0);       // PAL
    vdp->system = calloc(1, sizeof(system_header));
    vdp->system->get_open_bus_value = bus_abierto;
    vdp->system->type = SYSTEM_SMS;
    vr_vaciar();
    vreg.activo = 1;

    z80_t cpu;
    uint64_t pins = z80_init(&cpu);
    int int_previo = 0, halt_visto = 0, cuadros = 0;
    uint32_t t_halt = 0, t0 = 0, t1 = 0;
    uint16_t linea_previa = vdp->vcounter;
    uint32_t cuadro_fb = 0;
    senal s0 = {0, 0, 1};
    CRECER(sen, n_sen, cap_sen); sen[n_sen++] = s0;   // /INT high at reset

    for (uint64_t tick = 0; ; tick++) {
        pins = z80_tick(&cpu, pins);
        mclk = (uint32_t)(tick * T_Z80);
        vdp_run_context_full(vdp, mclk);
        uint16_t a = Z80_GET_ADDR(pins);
        uint8_t chip = C_NINGUNO;
        if (pins & Z80_MREQ) {
            if ((pins & (Z80_M1 | Z80_RD)) == (Z80_M1 | Z80_RD)) {
                uint8_t d = leer_mem(a, &chip);
                Z80_SET_DATA(pins, d);
                int empieza = z80_opdone(&cpu) || tick == 0;
                if (empieza && modo_juego && grabar && !t_halt && tick >= ticks_arranque) {
                    // end of the recorded start-up, at an instruction boundary; nothing more until the frame
                    t_halt = mclk;
                    grabar = 0;
                    vreg.activo = 0;
                }
                if (empieza && grabar) {
                    CRECER(ins, n_ins, cap_ins);
                    instruccion *in = &ins[n_ins++];
                    in->t = mclk; in->pc = a; in->ciclo = n_ev;
                    uint16_t r[12] = {cpu.a, cpu.f, cpu.b, cpu.c, cpu.d, cpu.e, cpu.h, cpu.l, cpu.ix, cpu.iy, cpu.sp, cpu.i};
                    memcpy(in->r, r, sizeof r);
                    if (a == dir_halt && !halt_visto) { halt_visto = 1; t_halt = mclk; }
                }
                bus(mclk, a, d, K_M1, empieza ? F_M1 : F_OPERANDO, chip);
            } else if (pins & Z80_RFSH) {
                bus(mclk, a, 0, K_REFRESCO, 0, C_NINGUNO);
            } else if (pins & Z80_RD) {
                uint8_t d = leer_mem(a, &chip);
                Z80_SET_DATA(pins, d);
                bus(mclk - T_Z80, a, d, K_LECTURA, F_OPERANDO, chip);
            } else if (pins & Z80_WR) {
                uint8_t d = Z80_GET_DATA(pins);
                escribir_mem(a, d, &chip);
                bus(mclk - T_Z80, a, d, K_ESCRITURA, F_ESCRITURA, chip);
            }
        } else if (pins & Z80_IORQ) {
            if (pins & Z80_M1) {
                Z80_SET_DATA(pins, 0xFF);
                bus(mclk - T_Z80, a, 0xFF, K_INTACK, F_VECTOR, C_NINGUNO);
            } else if (pins & Z80_RD) {
                uint8_t d = leer_es(a, &chip);
                Z80_SET_DATA(pins, d);
                bus(mclk - 2 * T_Z80, a, d, K_ES_LECTURA, 0, chip);
            } else if (pins & Z80_WR) {
                uint8_t d = Z80_GET_DATA(pins);
                escribir_es(a, d, &chip);
                bus(mclk - T_Z80, a, d, K_ES_ESCRITURA, F_ESCRITURA, chip);
            }
        }
        int il = linea_int();
        if (il) pins |= Z80_INT; else pins &= ~Z80_INT;
        if (il != int_previo) {
            CRECER(sen, n_sen, cap_sen);
            sen[n_sen++] = (senal){mclk, 0, (uint8_t)!il};   // k 0: /INT (active low)
            int_previo = il;
        }
        if (vdp->vcounter != linea_previa) {
            linea_previa = vdp->vcounter;
            if (linea_previa == 0 && (halt_visto || modo_juego)) {
                // a new frame starts (V counter 0: first line of the picture)
                for (int g = 0; g < n_guion; g++) if (cuadros >= guion[g].cuadro) mando = guion[g].mascara;
                if (cuadros == previos) {
                    t0 = vdp->cycles; cuadro_fb = vr_cuadros;
                    if (modo_juego) { grabar = 1; vreg.activo = 1; }
                }
                if (cuadros == previos + 1) { t1 = vdp->cycles; break; }
                cuadros++;
            }
        }
        if (tick > 400000000ull) { fprintf(stderr, "sin final\n"); return 1; }
    }
    // the frame shown during [t0, t1) is the one the VDP finished inside that window
    if (vr_cuadros == cuadro_fb) { fprintf(stderr, "el cuadro no terminó en la ventana\n"); return 1; }

    printf("{\"reloj_hz\":53203424,\"t_halt\":%u,\"t0\":%u,\"t1\":%u,\n", t_halt, t0, t1);
    printf("\"paleta\":["); for (int i = 0; i < 64; i++) printf(i ? ",%u" : "%u", paleta[i]); printf("],\n");
    printf("\"z80\":{"); json_u32("t", n_ev, ev_t, 1); json_u32("a", n_ev, ev_a, 1); json_u32("d", n_ev, ev_d, 1);
    json_u32("k", n_ev, ev_k, 1); json_u32("f", n_ev, ev_f, 1); json_u32("c", n_ev, ev_c, 0); printf("},\n");
    printf("\"ins\":{"); json_u32("t", n_ins, in_t, 1); json_u32("pc", n_ins, in_pc, 1); json_u32("ciclo", n_ins, in_ciclo, 1);
    const char *nr[12] = {"A", "F", "B", "C", "D", "E", "H", "L", "IX", "IY", "SP", "I"};
    for (reg_i = 0; reg_i < 12; reg_i++) json_u32(nr[reg_i], n_ins, in_r, reg_i < 11);
    printf("},\n");
    printf("\"sen\":{"); json_u32("t", n_sen, se_t, 1); json_u32("k", n_sen, se_k, 1); json_u32("v", n_sen, se_v, 0); printf("},\n");
    printf("\"ranuras\":{"); json_u32("t", vreg.n_ranuras, ra_t, 1); json_u32("linea", vreg.n_ranuras, ra_linea, 1);
    json_u32("etiquetas", vreg.n_ranuras, ra_etq, 1); json_u32("n", vreg.n_ranuras, ra_n, 1);
    json_u32("dir", vreg.n_ranuras, ra_dir0, 1); json_u32("dir2", vreg.n_ranuras, ra_dirs, 1);
    json_u32("val", vreg.n_ranuras, ra_val, 1); json_u32("esc_dir1", vreg.n_ranuras, ra_esc_dir, 1);
    json_u32("esc_val", vreg.n_ranuras, ra_esc_val, 0); printf("},\n");
    printf("\"pixeles\":{"); json_u32("t", vreg.n_pixeles, px_t, 1); json_u32("fila", vreg.n_pixeles, px_fila, 1);
    json_u32("x", vreg.n_pixeles, px_x, 0); printf("},\n");
    printf("\"lineas\":{"); json_u32("t", vreg.n_lineas, li_t, 1); json_u32("v", vreg.n_lineas, li_l, 0); printf("},\n");
    // the finished frame: every row the VDP wrote, 342 wide is more than the line buffer (13 + 256 + 15 + …)
    printf("\"fb_ancho\":%d,\"fb\":[", VR_ANCHO_FB);
    for (int y = 0; y < 300; y++) for (int x = 0; x < 300; x++) printf((x | y) ? ",%u" : "%u", vr_cuadro[y * VR_ANCHO_FB + x]);
    printf("]}\n");
    return 0;
}
