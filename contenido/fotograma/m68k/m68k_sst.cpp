// Runs SingleStepTests/680x0 (68000) cases on Moira in its precise timing mode and prints every bus access with
// the CPU clock at which Moira performs it, for validar_m68k.py.
// Input (stdin): «T name», «R d0..d7 a0..a6 usp ssp sr pc ird irc», «M addr byte»…, «G».
// Output: «T name», «B r|w b|w addr value clock fc» per access, «F d0..d7 a0..a6 usp ssp sr pc ird irc clock».
#include <cstdio>
#include <cstring>
#include <cstdlib>
#include <unordered_map>
#include "Moira.h"

using namespace moira;

static std::unordered_map<uint32_t, uint8_t> mem;
static bool registrar = false;

class Cpu : public Moira {
public:
    u8 rd(u32 a) const { auto it = mem.find(a & 0xFFFFFF); return it == mem.end() ? 0 : it->second; }
    u8 read8(u32 a) const override { u8 v = rd(a); log('r', 'b', a, v); return v; }
    u16 read16(u32 a) const override { u16 v = rd(a) << 8 | rd(a + 1); log('r', 'w', a, v); return v; }
    u32 read32(u32 a) const override { return (u32)read16(a) << 16 | read16(a + 2); }
    void write8(u32 a, u8 v) const override { mem[a & 0xFFFFFF] = v; log('w', 'b', a, v); }
    void write16(u32 a, u16 v) const override { mem[a & 0xFFFFFF] = v >> 8; mem[(a + 1) & 0xFFFFFF] = v; log('w', 'w', a, v); }
    void write32(u32 a, u32 v) const override { write16(a, v >> 16); write16(a + 2, v); }
    u16 read16Dasm(u32 a) const override { return rd(a) << 8 | rd(a + 1); }
    u16 read16OnReset(u32 a) const override { return rd(a) << 8 | rd(a + 1); }
    void log(char rw, char sz, u32 a, u32 v) const { if (registrar) printf("B %c %c %u %u %lld %u\n", rw, sz, a & 0xFFFFFF, v, (long long)clock, readFC()); }
};

int main() {
    static Cpu cpu;
    cpu.setModel(Model::M68000, Model::M68000);
    char line[1024], name[256];
    unsigned r[20];
    while (fgets(line, sizeof line, stdin)) {
        if (line[0] == 'T') { sscanf(line + 2, "%255[^\n]", name); mem.clear(); }
        else if (line[0] == 'R') {
            int n = 0; char *p = line + 2;
            for (int i = 0; i < 20; i++) r[i] = strtoul(p, &p, 10), n++;
        } else if (line[0] == 'M') {
            unsigned a, v; sscanf(line + 2, "%u %u", &a, &v); mem[a & 0xFFFFFF] = v;
        } else if (line[0] == 'G') {
            printf("T %s\n", name);
            cpu.reset();
            cpu.setSR(r[17]);
            cpu.setUSP(r[15]);
            cpu.setISP(r[16]);
            for (int i = 0; i < 8; i++) cpu.setD(i, r[i]);
            for (int i = 0; i < 7; i++) cpu.setA(i, r[8 + i]);
            cpu.setPC(r[18]); cpu.setPC0(r[18]);
            cpu.setIRD(r[19] & 0xFFFF); cpu.setIRC(r[19] >> 16);
            cpu.setClock(0);
            registrar = true;
            cpu.execute();
            registrar = false;
            printf("F");
            for (int i = 0; i < 8; i++) printf(" %u", cpu.getD(i));
            for (int i = 0; i < 7; i++) printf(" %u", cpu.getA(i));
            printf(" %u %u %u %u %u %u %lld\n", cpu.getUSP(), cpu.getISP(), cpu.getSR(), cpu.getPC(), cpu.getIRD(), cpu.getIRC(), (long long)cpu.getClock());
        }
    }
    return 0;
}
