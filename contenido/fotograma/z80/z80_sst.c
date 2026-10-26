// Runs SingleStepTests/z80 cases on floooh's z80.h (one instruction each) and prints every tick's pins, so that
// validar_z80.py can compare them with the per-cycle bus states recorded from a real Z80.
// Input (stdin, one test per block, written by validar_z80.py):
//   T <name>
//   R pc sp a f b c d e h l i r wz ix iy af_ bc_ de_ hl_ im iff1 iff2
//   M <addr> <value>          (initial RAM, any number of lines)
//   P <port> <value>          (values read from I/O ports, in order)
//   G                         (run)
// Output: per test «T name», then «K addr data m1 mreq iorq rd wr rfsh» per tick, then «F <regs as R>» and
// «W addr value» for every RAM byte written.
#define CHIPS_IMPL
#include <stdio.h>
#include <string.h>
#include <stdlib.h>
#include "z80.h"

static uint8_t mem[65536];
static uint8_t touched[65536];

int main(void) {
    char line[512], name[128];
    z80_t cpu;
    unsigned ports[64]; int nports = 0, iport = 0;
    while (fgets(line, sizeof line, stdin)) {
        if (line[0] == 'T') {
            sscanf(line + 2, "%127s", name);
            memset(mem, 0, sizeof mem); memset(touched, 0, sizeof touched);
            nports = 0; iport = 0;
            z80_init(&cpu);
        } else if (line[0] == 'R') {
            unsigned v[22];
            sscanf(line + 2, "%u %u %u %u %u %u %u %u %u %u %u %u %u %u %u %u %u %u %u %u %u %u",
                   &v[0], &v[1], &v[2], &v[3], &v[4], &v[5], &v[6], &v[7], &v[8], &v[9], &v[10], &v[11], &v[12],
                   &v[13], &v[14], &v[15], &v[16], &v[17], &v[18], &v[19], &v[20], &v[21]);
            cpu.pc = v[0]; cpu.sp = v[1]; cpu.a = v[2]; cpu.f = v[3]; cpu.b = v[4]; cpu.c = v[5]; cpu.d = v[6];
            cpu.e = v[7]; cpu.h = v[8]; cpu.l = v[9]; cpu.i = v[10]; cpu.r = v[11]; cpu.wz = v[12]; cpu.ix = v[13];
            cpu.iy = v[14]; cpu.af2 = v[15]; cpu.bc2 = v[16]; cpu.de2 = v[17]; cpu.hl2 = v[18]; cpu.im = v[19];
            cpu.iff1 = v[20]; cpu.iff2 = v[21];
        } else if (line[0] == 'M') {
            unsigned a, d; sscanf(line + 2, "%u %u", &a, &d); mem[a & 0xFFFF] = d;
        } else if (line[0] == 'P') {
            unsigned a, d; sscanf(line + 2, "%u %u", &a, &d); if (nports < 64) ports[nports++] = d;
        } else if (line[0] == 'G') {
            printf("T %s\n", name);
            uint64_t pins = z80_prefetch(&cpu, cpu.pc);
            for (int t = 0; t < 200; t++) {
                pins = z80_tick(&cpu, pins);
                if (t > 0 && z80_opdone(&cpu)) {   // T1 of the next instruction's fetch: its address is the new PC
                    printf("N %u\n", (unsigned)Z80_GET_ADDR(pins));
                    break;
                }
                uint16_t a = Z80_GET_ADDR(pins);
                if (pins & Z80_MREQ) {
                    if (pins & Z80_RD) { Z80_SET_DATA(pins, mem[a]); }
                    else if (pins & Z80_WR) { mem[a] = Z80_GET_DATA(pins); touched[a] = 1; }
                } else if (pins & Z80_IORQ) {
                    if (pins & Z80_M1) { Z80_SET_DATA(pins, 0xFF); }
                    else if (pins & Z80_RD) { Z80_SET_DATA(pins, iport < nports ? ports[iport++] : 0xFF); }
                }
                printf("K %u %u %d %d %d %d %d %d\n", a, (unsigned)Z80_GET_DATA(pins), !!(pins & Z80_M1), !!(pins & Z80_MREQ),
                       !!(pins & Z80_IORQ), !!(pins & Z80_RD), !!(pins & Z80_WR), !!(pins & Z80_RFSH));
            }
            printf("F %u %u %u %u %u %u %u %u %u %u %u %u %u %u %u %u %u %u %u %u %u %u\n", cpu.pc, cpu.sp, cpu.a, cpu.f,
                   cpu.b, cpu.c, cpu.d, cpu.e, cpu.h, cpu.l, cpu.i, cpu.r, cpu.wz, cpu.ix, cpu.iy, cpu.af2, cpu.bc2,
                   cpu.de2, cpu.hl2, cpu.im, cpu.iff1, cpu.iff2);
            for (int a = 0; a < 65536; a++) if (touched[a]) printf("W %d %u\n", a, mem[a]);
        }
    }
    return 0;
}
