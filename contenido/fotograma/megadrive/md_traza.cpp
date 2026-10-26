// Offline trace generator of the Mega Drive (model 1, VA6.8 PAL board; NTSC selectable) for «Un fotograma».
// 68000: Moira (MIT) in its precise timing mode (m68k/parchear_moira.py), checked against SingleStepTests 680x0.
// Z80: floooh's z80.h (z80_md.c). VDP 315-5313: BlastEm's VDP core (GPL-3, offline; vdp/parchear_vdp.py).
// Bus glue after BlastEm's genesis.c: FIFO stalls lengthen the 68000's bus cycle (/DTACK late), a 68000 → VRAM
// DMA takes the bus (/BR, /BG) until it ends, the V and H interrupts reach /IPL0-2, the Z80 stops while the
// 68000 owns its bus or holds it in reset.
// Usage: md_traza <rom> <frames before the recorded one> <pal 1|0> > salida.json
//        md_traza <rom> <frame since reset> <pal 1|0> --juego <start-up 68000 cycles> [script] > salida.json
// Game mode: only the start-up and the frame are recorded (from the frame before, so that nothing at its start is
// missed); a 3-button pad on port 1 follows the script "frame:mask,…" (mask bit 0 up, 1 down, 2 left, 3 right,
// 4 A, 5 B, 6 C, 7 start).
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <vector>
#include "Moira.h"
extern "C" {
#include "vdp.h"
#include "vdp_ganchos.h"
#include "z80_md.h"
}

using moira::u8;
using moira::u16;
using moira::u32;

static uint32_t MCLK = 53203424;
static const int DIV68 = 7, DIVZ = 15;

struct Ev { uint32_t t; uint32_t a; uint16_t d; uint8_t k, f, c; };
struct InsM { uint32_t t; uint32_t pc; uint32_t ciclo; uint8_t k; uint32_t r[17]; };
struct InsZ { uint32_t t; uint16_t pc; uint32_t ciclo; uint16_t r[12]; };
struct Sen { uint32_t t; uint8_t k, v; };
static std::vector<Ev> ev68, evz;
static std::vector<InsM> ins68;
static std::vector<InsZ> insz;
static std::vector<Sen> sen;

enum { K_PROG, K_LEE, K_ESC, K_LEE_B, K_ESC_B, K_IACK, K_DMA };
enum { C_NINGUNO, C_ROM, C_RAM, C_VDP, C_IO, C_ARBITRO, C_TMSS, C_ZRAM, C_YM, C_PSG };
enum { F_ESC = 1, F_DMA = 8, F_VECTOR = 16, F_PROG = 64 };
enum { S_IPL, S_BR, S_ZBUSREQ, S_ZBUSACK, S_ZRESET };

static std::vector<uint8_t> rom;
static uint8_t ram[0x10000];
static vdp_context *vdp;
static uint64_t mclk_z = 0;              // time of the next Z80 tick
static bool z_reset = true;              // the Z80 starts held in reset
static bool z_busreq = false, z_busack = false;
static uint8_t version_reg = 0xE1;           // overseas, PAL, no expansion unit, TMSS revision 1
static bool en_reset = true;
static int ipl_previo = 0;
static uint32_t t_encendido = 0;         // display enabled
static bool grabar = true;               // record bus events and instructions now
static uint8_t mando = 0;                // pad 1 buttons held (bit 0 up … 7 start)
static uint8_t io_datos1 = 0, io_ctrl1 = 0;   // port 1 data and control registers ($A10003, $A10009)
struct Pulsacion { uint32_t cuadro; uint8_t mascara; };
static std::vector<Pulsacion> guion;

// 3-button pad on port 1 (active low): TH high → C B R L D U, TH low → Start A 0 0 D U
static uint8_t leer_mando() {
    bool th = (io_ctrl1 & 0x40) ? (io_datos1 & 0x40) : true;
    uint8_t b = mando, v;
    if (th) v = 0x40 | (~(((b >> 6) & 1) << 5 | ((b >> 5) & 1) << 4 | ((b >> 3) & 1) << 3 | ((b >> 2) & 1) << 2 | ((b >> 1) & 1) << 1 | (b & 1)) & 0x3F);
    else v = (~(((b >> 7) & 1) << 5 | ((b >> 4) & 1) << 4) & 0x30) | (~(((b >> 1) & 1) << 1 | (b & 1)) & 0x03);
    return (v & ~io_ctrl1 & 0x7F) | (io_datos1 & io_ctrl1 & 0x7F);
}

static void senal(uint32_t t, uint8_t k, uint8_t v) { sen.push_back({t, k, v}); }

static uint8_t chip_de(uint32_t a) {
    a &= 0xFFFFFF;
    if (a < 0x400000) return C_ROM;
    if (a >= 0xA00000 && a < 0xA04000) return C_ZRAM;
    if (a >= 0xA04000 && a < 0xA06000) return C_YM;
    if (a >= 0xA10000 && a < 0xA10020) return C_IO;
    if (a >= 0xA11100 && a < 0xA11300) return C_ARBITRO;
    if (a >= 0xA14000 && a < 0xA14004) return C_TMSS;
    if (a >= 0xC00000 && a < 0xC00020) return (a & 0x1F) >= 0x10 && (a & 0x1F) < 0x18 ? C_PSG : C_VDP;
    if (a >= 0xE00000) return C_RAM;
    return C_NINGUNO;
}

static uint16_t leer_palabra_memoria(uint32_t a) {
    a &= 0xFFFFFE;
    if (a < 0x400000) return a + 1 < rom.size() ? rom[a] << 8 | rom[a + 1] : 0xFFFF;
    if (a >= 0xE00000) return ram[a & 0xFFFF] << 8 | ram[(a + 1) & 0xFFFF];
    return 0xFFFF;
}

// --- the VDP reads the 68000 bus during a DMA (word address)
extern "C" uint16_t read_dma_value(uint32_t address) {
    uint32_t a = address * 2;
    uint16_t v = leer_palabra_memoria(a);
    if (grabar) ev68.push_back({vdp->cycles, a & 0xFFFFFF, v, K_DMA, F_DMA, chip_de(a)});
    return v;
}
static uint16_t bus_abierto(system_header *s) { return 0xFFFF; }

class Md;
static Md *cpu;

// --- Z80: one tick per Z80 clock while it is out of reset and owns its bus
static void tick_z80() {
    if (z_reset || z_busack) return;
    if (z_busreq && zmd_frontera()) {   // grants its bus at an instruction boundary (approximation of the M cycle end)
        z_busack = true;
        senal((uint32_t)mclk_z, S_ZBUSACK, 0);
        return;
    }
    zmd_evento e; zmd_estado s;
    uint32_t t = (uint32_t)mclk_z;
    if (zmd_paso(&e, &s) && grabar) {
        uint32_t t1 = t - e.desfase * DIVZ;
        uint8_t f = e.tipo == ZMD_ESCRITURA || e.tipo == ZMD_ES_ESCRITURA ? 1 : 0;
        if (e.tipo == ZMD_M1) {
            f |= e.empieza ? 2 : 64;
            if (e.empieza) insz.push_back({t, e.a, (uint32_t)evz.size(), {s.a, s.f, s.b, s.c, s.d, s.e, s.h, s.l, s.ix, s.iy, s.sp, s.i}});
        }
        if (e.tipo == ZMD_LECTURA) f |= 64;
        if (e.tipo == ZMD_INTACK) f |= 16;
        evz.push_back({t1, e.a, e.d, e.tipo, f, e.chip});
    }
}

static void actualizar_ipl();

static void avanzar(uint64_t objetivo) {
    vdp_run_context(vdp, (uint32_t)objetivo);
    while (mclk_z + DIVZ <= objetivo) { tick_z80(); mclk_z += DIVZ; }
    actualizar_ipl();
}

class Md : public moira::Moira {
public:
    Md() { irqMode = moira::IrqMode::USER; }
    bool parado() const { return flags & moira::State::STOPPED; }
    uint64_t mclk() const { return (uint64_t)clock * DIV68; }

    void sync(int cycles) override { clock += cycles; avanzar((uint64_t)clock * DIV68); }

    void registrar(uint32_t a, uint16_t d, uint8_t k, uint8_t f) const {
        if (!grabar) return;
        uint32_t t = (uint32_t)((clock - 2) * DIV68);
        if (en_reset && (a & 0xFFFFFF) < 8) f |= F_VECTOR;
        uint8_t fc = readFC();
        if (k == K_LEE && (fc == 2 || fc == 6)) { k = K_PROG; f |= F_PROG; }
        ev68.push_back({t, a & 0xFFFFFF, d, k, f, chip_de(a)});
    }

    // the 68000 waits for /DTACK until the VDP has accepted the access
    void esperar_vdp() const {
        uint64_t ahora = (uint64_t)clock * DIV68;
        if (vdp->cycles > ahora) {
            uint64_t extra = (vdp->cycles - ahora + DIV68 - 1) / DIV68;
            const_cast<Md *>(this)->clock += extra;
            avanzar((uint64_t)clock * DIV68);
        }
    }

    uint16_t leer(uint32_t a, bool byte) const {
        a &= 0xFFFFFF;
        uint64_t ahora = (uint64_t)clock * DIV68;
        if (a < 0x400000 || a >= 0xE00000) return leer_palabra_memoria(a);
        if (a >= 0xA00000 && a < 0xA10000) {
            if (!z_busack) return 0xFFFF;
            if (a < 0xA04000) { uint8_t v = zmd_ram[a & 0x1FFF]; return v << 8 | v; }
            return 0;
        }
        if (a >= 0xA10000 && a < 0xA10020) {
            if ((a & 0x1E) == 0) return version_reg << 8 | version_reg;
            if ((a & 0x1E) == 2) { uint8_t v = leer_mando(); return v << 8 | v; }
            if ((a & 0x1E) == 8) return io_ctrl1 << 8 | io_ctrl1;
            return 0x7F7F;
        }
        if (a >= 0xA11100 && a < 0xA11102) { uint16_t v = z_busack ? 0 : 0x0101; return v | 0xFEFE; }
        if (a >= 0xC00000 && a < 0xC00020) {
            uint32_t p = a & 0x1F;
            vdp_run_context(vdp, (uint32_t)ahora);
            uint16_t v;
            if (p < 4) { v = vdp_data_port_read(vdp); esperar_vdp(); }
            else if (p < 8) v = vdp_control_port_read(vdp);
            else v = vdp_hv_counter_read(vdp);
            return v;
        }
        return 0xFFFF;
    }

    void escribir(uint32_t a, uint16_t v, bool byte) const {
        a &= 0xFFFFFF;
        uint64_t ahora = (uint64_t)clock * DIV68;
        if (a >= 0xE00000) {
            if (byte) ram[a & 0xFFFF] = (a & 1) ? v & 0xFF : v >> 8;
            else { ram[a & 0xFFFF] = v >> 8; ram[(a + 1) & 0xFFFF] = v; }
            return;
        }
        if (a >= 0xA00000 && a < 0xA04000) {
            if (z_busack) zmd_ram[a & 0x1FFF] = byte ? ((a & 1) ? v & 0xFF : v >> 8) : v >> 8;
            return;
        }
        if (a >= 0xA11100 && a < 0xA11102) {
            bool req = byte ? (v & 0x101) != 0 : (v & 0x100) != 0;
            if (req != z_busreq) {
                z_busreq = req;
                senal((uint32_t)ahora, S_ZBUSREQ, req ? 0 : 1);
                if (!req && z_busack) { z_busack = false; senal((uint32_t)ahora, S_ZBUSACK, 1); }
                if (req && z_reset && !z_busack) { z_busack = true; senal((uint32_t)ahora, S_ZBUSACK, 0); }
            }
            return;
        }
        if (a >= 0xA11200 && a < 0xA11202) {
            bool corre = byte ? (v & 0x101) != 0 : (v & 0x100) != 0;
            if (corre == z_reset) {
                z_reset = !corre;
                senal((uint32_t)ahora, S_ZRESET, corre ? 1 : 0);
                if (corre) zmd_reiniciar();
                if (!corre && z_busreq && !z_busack) { z_busack = true; senal((uint32_t)ahora, S_ZBUSACK, 0); }
            }
            return;
        }
        if (a >= 0xC00000 && a < 0xC00020) {
            uint32_t p = a & 0x1F;
            uint16_t val = byte ? (p < 0x10 ? (v & 0xFF) | (v & 0xFF) << 8 : v & 0xFF) : v;
            if (p < 4) {
                vdp_run_context(vdp, (uint32_t)ahora);
                while (vdp_data_port_write(vdp, val) < 0) vdp_run_context_full(vdp, vdp->cycles + 1);
                esperar_vdp();
            } else if (p < 8) {
                vdp_run_context_full(vdp, (uint32_t)ahora);
                int bloqueado = vdp_control_port_write(vdp, val);
                if (bloqueado) {
                    // 68000 → VRAM DMA: the VDP asks for the bus and keeps it until the copy ends
                    senal(vdp->cycles, S_BR, 0);
                    while (bloqueado) {
                        while (vdp->flags & FLAG_DMA_RUN) vdp_run_dma_done(vdp, vdp->cycles + 4000000);
                        bloqueado = bloqueado < 0 ? vdp_control_port_write(vdp, val) : 0;
                    }
                    senal(vdp->cycles, S_BR, 1);
                }
                esperar_vdp();
                if (!t_encendido && (vdp->regs[REG_MODE_2] & BIT_DISP_EN)) t_encendido = (uint32_t)ahora;
            }
            return;
        }
        if (a >= 0xA10000 && a < 0xA10020) {
            uint8_t b = byte ? ((a & 1) ? v & 0xFF : v >> 8) : v & 0xFF;
            if ((a & 0x1E) == 2) io_datos1 = b;
            if ((a & 0x1E) == 8) io_ctrl1 = b;
            return;
        }
        // TMSS, ROM: nothing to change in these programs
    }

    u8 read8(u32 a) const override { uint16_t w = leer(a, true); u8 v = (a & 1) ? w & 0xFF : w >> 8; registrar(a, v, K_LEE_B, 0); return v; }
    u16 read16(u32 a) const override { uint16_t v = leer(a, false); registrar(a, v, K_LEE, 0); return v; }
    u32 read32(u32 a) const override { return (u32)read16(a) << 16 | read16(a + 2); }
    void write8(u32 a, u8 v) const override { registrar(a, v, K_ESC_B, F_ESC); escribir(a, (a & 1) ? v : v << 8, true); }
    void write16(u32 a, u16 v) const override { registrar(a, v, K_ESC, F_ESC); escribir(a, v, false); }
    void write32(u32 a, u32 v) const override { write16(a, v >> 16); write16(a + 2, v); }
    u16 read16Dasm(u32 a) const override { return leer_palabra_memoria(a); }

    // interrupt acknowledge: the VDP's interrupts are autovectored (/VPA)
    u16 readIrqUserVector(u8 level) const override {
        if (grabar) ev68.push_back({(uint32_t)((clock - 4) * DIV68), 0xFFFFF0u | (uint32_t)level << 1, (uint16_t)(24 + level), K_IACK, F_VECTOR, C_VDP});
        vdp_int_ack(vdp);
        actualizar_ipl();
        return 24 + level;
    }
    void willInterrupt(u8 level) override {
        if (!grabar) return;
        // the main loop logged the instruction about to start; the interrupt is taken instead (it runs after RTE)
        if (!ins68.empty() && ins68.back().k == 0 && ins68.back().pc == getPC() && ins68.back().ciclo == ev68.size()) ins68.pop_back();
        InsM in{(uint32_t)mclk(), getPC(), (uint32_t)ev68.size(), 2, {}};
        guardar_regs(in);
        ins68.push_back(in);
    }
    void guardar_regs(InsM &in) const {
        for (int i = 0; i < 8; i++) in.r[i] = getD(i);
        for (int i = 0; i < 8; i++) in.r[8 + i] = getA(i);
        in.r[16] = getSR();
    }
};

static void actualizar_ipl() {
    int nivel = 0;
    if ((vdp->flags2 & FLAG2_VINT_PENDING) && (vdp->regs[REG_MODE_2] & BIT_VINT_EN)) nivel = 6;
    else if ((vdp->flags2 & FLAG2_HINT_PENDING) && (vdp->regs[REG_MODE_1] & BIT_HINT_EN)) nivel = 4;
    if (nivel != ipl_previo) {
        senal(vdp->cycles, S_IPL, nivel);
        ipl_previo = nivel;
        if (cpu) cpu->setIPL(nivel);
    }
}

// ---- JSON output
template <class T, class F> static void lista(const char *n, const std::vector<T> &v, F f, bool coma) {
    printf("\"%s\":[", n);
    for (size_t i = 0; i < v.size(); i++) printf(i ? ",%u" : "%u", (unsigned)f(v[i]));
    printf("]%s\n", coma ? "," : "");
}

int main(int argc, char **argv) {
    if (argc < 4) { fprintf(stderr, "uso: md_traza <rom> <cuadros previos> <pal 1|0>\n"); return 2; }
    FILE *fr = fopen(argv[1], "rb");
    if (!fr) { perror(argv[1]); return 1; }
    rom.resize(0x400000);
    rom.resize(fread(rom.data(), 1, rom.size(), fr));
    fclose(fr);
    int previos = atoi(argv[2]);
    bool pal = atoi(argv[3]) != 0;
    bool modo_juego = argc >= 6 && !strcmp(argv[4], "--juego");
    uint64_t ciclos_arranque = modo_juego ? strtoull(argv[5], nullptr, 10) : 0;
    if (modo_juego && argc >= 7) {
        for (const char *q = argv[6]; *q;) {
            unsigned c = 0, m = 0; int n = 0;
            if (sscanf(q, "%u:%u%n", &c, &m, &n) != 2) break;
            guion.push_back({c, (uint8_t)m});
            q += n;
            if (*q == ',') q++;
        }
    }
    if (!pal) { MCLK = 53693175; version_reg = 0xA1; }

    vdp = init_vdp_context(pal ? 1 : 0, 0);
    vdp->system = (system_header *)calloc(1, sizeof(system_header));
    vdp->system->get_open_bus_value = bus_abierto;
    vdp->system->type = SYSTEM_GENESIS;
    vr_vaciar();
    vreg.activo = 1;
    vreg.lineas_siempre = 1;
    zmd_reiniciar();
    senal(0, S_IPL, 0); senal(0, S_BR, 1); senal(0, S_ZBUSREQ, 1); senal(0, S_ZBUSACK, 1); senal(0, S_ZRESET, 0);

    static Md m68;
    cpu = &m68;
    m68.setModel(moira::Model::M68000, moira::Model::M68000);
    m68.setClock(0);
    {
        InsM in{0, 0, 0, 3, {}};
        ins68.push_back(in);   // reset: the vector reads
    }
    m68.reset();
    en_reset = false;
    ins68[0].pc = m68.getPC();
    // frames: from a line 0 to the next one (V counter wraps from $1FF to 0); in game mode counted from the reset
    std::vector<uint32_t> inicios;
    uint32_t visto = 0;
    uint32_t t_arranque = 0;
    while (true) {
        if (modo_juego && grabar && !t_arranque && (uint64_t)m68.getClock() >= ciclos_arranque && !m68.parado()) {
            // end of the recorded start-up, at an instruction boundary; nothing more until the frame before
            t_arranque = (uint32_t)m68.mclk();
            grabar = false;
            vreg.activo = 0;
        }
        if (m68.parado()) {
            m68.execute();
        } else {
            if (grabar) {
                InsM in{(uint32_t)m68.mclk(), m68.getPC(), (uint32_t)ev68.size(), 0, {}};
                m68.guardar_regs(in);
                ins68.push_back(in);
            }
            m68.execute();
        }
        for (; visto < vreg.n_lineas; visto++) {
            if (vreg.lineas[visto].linea != 0x1FF) continue;
            if (!modo_juego && !(t_encendido && vreg.lineas[visto].t > t_encendido)) continue;
            inicios.push_back(vreg.lineas[visto].t);
            uint32_t n = (uint32_t)inicios.size() - 1;   // frame number of the frame starting here
            for (const Pulsacion &p : guion) if (n >= p.cuadro) mando = p.mascara;
            if (modo_juego && (int)n + 1 == previos) { grabar = true; vreg.activo = 1; }
        }
        if (inicios.size() >= (size_t)previos + 2) break;
        if (m68.mclk() > 3500000000ull) { fprintf(stderr, "sin final\n"); return 1; }
    }
    uint32_t t0 = inicios[previos], t1 = inicios[previos + 1];

    printf("{\"reloj_hz\":%u,\"pal\":%d,\"t_encendido\":%u,\"t_arranque\":%u,\"t0\":%u,\"t1\":%u,\n", MCLK, pal ? 1 : 0, t_encendido, t_arranque, t0, t1);
    printf("\"m68k\":{");
    lista("t", ev68, [](const Ev &e) { return e.t; }, true); lista("a", ev68, [](const Ev &e) { return e.a; }, true);
    lista("d", ev68, [](const Ev &e) { return e.d; }, true); lista("k", ev68, [](const Ev &e) { return e.k; }, true);
    lista("f", ev68, [](const Ev &e) { return e.f; }, true); lista("c", ev68, [](const Ev &e) { return e.c; }, false);
    printf("},\n\"z80\":{");
    lista("t", evz, [](const Ev &e) { return e.t; }, true); lista("a", evz, [](const Ev &e) { return e.a; }, true);
    lista("d", evz, [](const Ev &e) { return e.d; }, true); lista("k", evz, [](const Ev &e) { return e.k; }, true);
    lista("f", evz, [](const Ev &e) { return e.f; }, true); lista("c", evz, [](const Ev &e) { return e.c; }, false);
    printf("},\n\"ins68\":{");
    lista("t", ins68, [](const InsM &e) { return e.t; }, true); lista("pc", ins68, [](const InsM &e) { return e.pc; }, true);
    lista("ciclo", ins68, [](const InsM &e) { return e.ciclo; }, true); lista("k", ins68, [](const InsM &e) { return e.k; }, true);
    const char *nr[17] = {"D0", "D1", "D2", "D3", "D4", "D5", "D6", "D7", "A0", "A1", "A2", "A3", "A4", "A5", "A6", "A7", "SR"};
    for (int r = 0; r < 17; r++) { printf("\"%s\":[", nr[r]); for (size_t i = 0; i < ins68.size(); i++) printf(i ? ",%u" : "%u", ins68[i].r[r]); printf("]%s\n", r < 16 ? "," : ""); }
    printf("},\n\"insz\":{");
    lista("t", insz, [](const InsZ &e) { return e.t; }, true); lista("pc", insz, [](const InsZ &e) { return e.pc; }, true);
    lista("ciclo", insz, [](const InsZ &e) { return e.ciclo; }, true);
    const char *nz[12] = {"A", "F", "B", "C", "D", "E", "H", "L", "IX", "IY", "SP", "I"};
    for (int r = 0; r < 12; r++) { printf("\"%s\":[", nz[r]); for (size_t i = 0; i < insz.size(); i++) printf(i ? ",%u" : "%u", insz[i].r[r]); printf("]%s\n", r < 11 ? "," : ""); }
    printf("},\n\"sen\":{");
    lista("t", sen, [](const Sen &e) { return e.t; }, true); lista("k", sen, [](const Sen &e) { return e.k; }, true);
    lista("v", sen, [](const Sen &e) { return e.v; }, false);
    printf("},\n\"ranuras\":{");
    std::vector<vr_ranura> R(vreg.ranuras, vreg.ranuras + vreg.n_ranuras);
    lista("t", R, [](const vr_ranura &r) { return r.t; }, true);
    lista("linea", R, [](const vr_ranura &r) { return r.linea; }, true);
    lista("etiquetas", R, [](const vr_ranura &r) { return r.etiquetas; }, true);
    lista("n", R, [](const vr_ranura &r) { return r.n; }, true);
    lista("dir", R, [](const vr_ranura &r) { return r.n ? r.dir[0] : 0; }, true);
    lista("val", R, [](const vr_ranura &r) { uint32_t v = 0; for (int j = 0; j < r.n && j < 4; j++) v |= (uint32_t)r.val[j] << (8 * j); return v; }, true);
    lista("esc_dir1", R, [](const vr_ranura &r) { return (uint32_t)(r.esc_dir + 1); }, true);
    lista("esc_val", R, [](const vr_ranura &r) { return r.esc_val; }, true);
    lista("esc_bytes", R, [](const vr_ranura &r) { return r.esc_bytes; }, true);
    lista("esc_dma", R, [](const vr_ranura &r) { return r.esc_dma; }, false);
    printf("},\n\"pixeles\":{");
    std::vector<vr_pixel> P(vreg.pixeles, vreg.pixeles + vreg.n_pixeles);
    lista("t", P, [](const vr_pixel &p) { return p.t; }, true);
    lista("fila", P, [](const vr_pixel &p) { return p.fila; }, true);
    lista("x", P, [](const vr_pixel &p) { return p.x; }, false);
    printf("},\n\"lineas\":{");
    std::vector<vr_linea> L(vreg.lineas, vreg.lineas + vreg.n_lineas);
    lista("t", L, [](const vr_linea &l) { return l.t; }, true);
    lista("v", L, [](const vr_linea &l) { return l.linea; }, false);
    printf("},\n\"fb_ancho\":%d,\"fb\":[", 360);
    for (int y = 0; y < 300; y++) for (int x = 0; x < 360; x++) printf((x | y) ? ",%u" : "%u", vr_cuadro[y * VR_ANCHO_FB + x]);
    printf("]}\n");
    return 0;
}
