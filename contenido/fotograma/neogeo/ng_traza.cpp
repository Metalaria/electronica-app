// Offline trace generator of the Neo Geo AES (board NEO-AES3-5: 68000 + LSPC2-A2) for «Un fotograma».
// 68000: Moira (MIT) in its precise timing mode, as for the Mega Drive. LSPC: a model of our own built from the
// documented access pattern (wiki.neogeodev.org «Rendering logic», «Display timing», «VRAM», «Sprites»):
//   - master clock 24 MHz, 1536 master cycles per line (384 pixels of 4), 264 lines (raster counter $F8-$1FF),
//     hsync 28 px, back porch 28, 320 visible pixels, front porch 8; vsync $F8-$FF, top border $100-$10F, picture
//     $110-$1EF, bottom border $1F0-$1FF; V blank interrupt (level 1) 58 master cycles into line $1F0 (MAME);
//   - every 16 master cycles: slow VRAM slots (4 each) sprite map even word, odd word, CPU, fix map; fast VRAM
//     slots 2, 1.5 ×4 (parsing), 2 (active list), 1.5 SCB2, 1.5 SCB3, 1.5 SCB4, 1.5 CPU; one sprite line of
//     16 pixels (two 32-bit C ROM reads); the fix layer 4 S ROM reads per 8 pixels, fetched 8 pixels ahead;
//   - parsing for line N during line N-2 (381 SCB3 reads, 96 active list writes: matches then fill), rendering of
//     line N during line N-1 into one of two line buffers, output with the fix layer on top.
// Times are in half master cycles (48 MHz) so that the 1.5-cycle slots fall on whole units.
// Demo mode: the trace starts at the cartridge's USER entry and the system ROM is not used (see the demo's
// comments). System ROM mode (--bios): reset through the vectors of a free system ROM (ngdevkit's nullbios, never
// SNK's), mapped at $C00000 and over the vector table until REG_SWPROM; only the start-up (first N 68000 cycles) and
// the frame are recorded; the controllers read idle except for an optional button script.
// Usage: ng_traza <p rom> <c1> <c2> <s1> <frames before the recorded one> > salida.json
//        ng_traza <p rom> <c1> <c2> <s1> <frame since reset> --bios <system rom> <start-up 68000 cycles> [script]
//        (script: "frame:p1mask:statusmask,…", masks of pressed buttons: P1 bit 0 up, 1 down, 2 left, 3 right,
//        4 A, 5 B, 6 C, 7 D; status bit 0 start, 1 select)
#include <cstdio>
#include <deque>
#include <cstdlib>
#include <cstring>
#include <vector>
#include "Moira.h"

using moira::u8;
using moira::u16;
using moira::u32;

static const int LINEA = 1536 * 2;                 // half master cycles per line
static const int LINEAS = 264;
static const int CICLO = 32;                       // 16 master cycles

struct Ev { uint32_t t; uint32_t a; uint32_t d; uint8_t k, f, c; };
struct InsM { uint32_t t; uint32_t pc; uint32_t ciclo; uint8_t k; uint32_t r[17]; };
struct Sen { uint32_t t; uint8_t k, v; };
static std::vector<Ev> ev68, evLenta, evRapida, evC, evS;
static std::vector<InsM> ins68;
static std::vector<Sen> sen;
struct Px { uint32_t t; uint16_t x, y; uint16_t color; };
static std::vector<Px> pix;

enum { K_PROG, K_LEE, K_ESC, K_LEE_B, K_ESC_B, K_IACK };
enum { C_NINGUNO, C_PROM, C_RAM, C_IO, C_SISTEMA, C_LSPC, C_PALETA, C_BIOS };
// slow VRAM kinds, fast VRAM kinds
enum { KL_SCB1_PAR, KL_SCB1_IMPAR, KL_CPU, KL_FIJA };
enum { KR_ANALISIS, KR_LISTA_ESC, KR_RELLENO, KR_LISTA, KR_SCB2, KR_SCB3, KR_SCB4, KR_CPU };

static std::vector<uint8_t> prom, c1, c2, s1, bios;
static bool modo_bios = false;
static bool grabar = true;                          // record bus events, instructions and pixels now
// The AES board has no fix ROM of its own (no SFIX, unlike the MVS): REG_BRDFIX and REG_CRTFIX change nothing and
// the fix layer always comes from the cartridge's S ROM.
static uint8_t mando_p1 = 0, mando_estado = 0;      // pressed buttons (active high here)
struct Pulsacion { int cuadro; uint8_t p1, estado; };
static std::vector<Pulsacion> guion;
static uint8_t ram[0x10000];
static uint16_t vram[0x10000];                     // $0000-$7FFF slow, $8000-$87FF fast
static uint16_t paleta[0x1000];
static uint16_t vram_dir = 0, vram_mod = 1;
// CPU accesses waiting for their slot. Writing the address makes the LSPC read the word there into its read latch
// (one slot); a data write refreshes the latch with the word at the incremented address in the same slot (MAME's
// set_videoram_offset/data do both at once).
struct Pendiente { uint16_t dir; uint16_t val; bool lectura; uint16_t siguiente; };
static std::deque<Pendiente> cpu_lenta, cpu_rapida;
static uint16_t lectura_vram = 0;
static bool vectores_cartucho = false;
static size_t cola_max = 0;                         // longest queue of CPU accesses waiting for the LSPC
static bool irq_vblank = false;
static int ipl_previo = 0;

// --- LSPC state
static uint64_t t_lspc = 0;                        // next 16-master-cycle boundary to process (half cycles)
static uint16_t lista[2][96];                      // active lists ($8600, $8680) for lines N and N+1
static uint8_t buffer[2][384];                     // line buffers: colour index (palette*16+colour, 0 = empty)
static uint16_t buffer_pal[2][384];
#define registrar grabar

static void senal(uint32_t t, uint8_t k, uint8_t v) { sen.push_back({t, k, v}); }

class Ng;
static Ng *cpu;
static void actualizar_ipl();

// raster counter of line index v (0 = raster $F8)
static int raster(int v) { return 0xF8 + v; }
// visible line (0..223) of raster r, or -1
static int visible(int r) { return r >= 0x110 && r <= 0x1EF ? r - 0x110 : -1; }

struct Sprite { int x, y, alto, s; };
// X, Y (top line, in visible-line coordinates) and height (lines) of sprite s, following sticky chains
static Sprite datos_sprite(int s) {
    int cabeza = s;
    int x = vram[0x8400 + s] >> 7;
    int pasos = 0;
    while (cabeza > 1 && (vram[0x8200 + cabeza] & 0x40)) { cabeza--; pasos++; }
    if (pasos) x = (vram[0x8400 + cabeza] >> 7) + 16 * pasos;
    uint16_t scb3 = vram[0x8200 + cabeza];
    int y = 496 - (scb3 >> 7);
    int alto = (scb3 & 0x3F) * 16;
    return {x & 0x1FF, y, alto, s};
}

static void vram_escribir(uint16_t dir, uint16_t v) { vram[dir] = v; }

// One 16-master-cycle step of the LSPC, starting at time t (half cycles).
static void paso_lspc(uint64_t t) {
    uint64_t linea_abs = t / LINEA;
    int v = (int)(linea_abs % LINEAS);
    int n = (int)((t % LINEA) / CICLO);           // cycle in the line, 0..95
    int r = raster(v);
    uint32_t T = (uint32_t)t;
    int lista_rend = (int)((linea_abs + 1) & 1);   // list used to render the next line
    int lista_anal = (int)(linea_abs & 1);         // list being built for line +2 (alternates)

    // --- start of a line: V blank interrupt, line buffer clear
    if (n == 0 && r == 0x1F0) { /* the interrupt itself is raised below at +58 master cycles */ }
    if (r == 0x1F0 && t % LINEA <= 116 && t % LINEA + CICLO > 116) {
        irq_vblank = true;
        actualizar_ipl();
    }

    // --- parsing for raster r+2: 5 slots in this cycle (times +0, +4, +7, +10, +13 half cycles)
    static int anal_s = 1, anal_n = 0, anal_espera = 0;
    static int anal_linea = -1;
    if (anal_linea != (int)linea_abs) { anal_linea = (int)linea_abs; anal_s = 1; anal_n = 0; anal_espera = 0; }
    int destino = raster((v + 2) % LINEAS);
    int vis = visible(destino);
    const int off_anal[5] = {0, 4, 7, 10, 13};
    for (int k = 0; k < 5; k++) {
        uint32_t ts = T + off_anal[k];
        if (anal_espera) {
            // the previous read matched: write the sprite number in the active list
            uint16_t dir = 0x8600 + lista_anal * 0x80 + anal_n;
            vram[dir] = anal_espera;
            if (registrar) evRapida.push_back({ts, dir, (uint32_t)anal_espera, KR_LISTA_ESC, 1, 0});
            anal_n++;
            anal_espera = 0;
        } else if (anal_s <= 381) {
            uint16_t dir = 0x8200 + anal_s;
            if (registrar) evRapida.push_back({ts, dir, vram[dir], KR_ANALISIS, 0, 0});
            if (vis >= 0 && anal_n < 96) {
                Sprite sp = datos_sprite(anal_s);
                if (sp.alto && vis >= sp.y && vis < sp.y + sp.alto) anal_espera = anal_s;
            }
            anal_s++;
        } else if (anal_n < 96) {
            uint16_t dir = 0x8600 + lista_anal * 0x80 + anal_n;
            vram[dir] = 0;
            if (registrar) evRapida.push_back({ts, dir, 0, KR_RELLENO, 1, 0});
            anal_n++;
        }
    }
    for (int i = 0; i < 96; i++) lista[lista_anal][i] = vram[0x8600 + lista_anal * 0x80 + i];

    // --- rendering of raster r+1, sprite n of the active list
    int prox = raster((v + 1) % LINEAS);
    int visr = visible(prox);
    uint16_t dl = 0x8600 + lista_rend * 0x80 + n;
    uint16_t s = vram[dl];
    if (registrar) {
        evRapida.push_back({T + 16, dl, s, KR_LISTA, 0, 0});
        evRapida.push_back({T + 20, (uint32_t)(0x8000 + s), vram[0x8000 + s], KR_SCB2, 0, 0});
        evRapida.push_back({T + 23, (uint32_t)(0x8200 + s), vram[0x8200 + s], KR_SCB3, 0, 0});
        evRapida.push_back({T + 26, (uint32_t)(0x8400 + s), vram[0x8400 + s], KR_SCB4, 0, 0});
    }
    Sprite sp = datos_sprite(s);
    int fila = visr >= 0 && s ? visr - sp.y : 0;
    if (fila < 0 || fila >= 512) fila = 0;
    uint16_t d1 = s * 64 + (fila / 16) * 2;
    uint16_t tile_lo = vram[d1], attr = vram[d1 + 1];
    if (registrar) {
        evLenta.push_back({T, d1, tile_lo, KL_SCB1_PAR, 0, 0});
        evLenta.push_back({T + 8, (uint32_t)(d1 + 1), attr, KL_SCB1_IMPAR, 0, 0});
    }
    uint32_t tile = tile_lo | ((attr >> 4) & 0xF) << 16;
    int fy = fila % 16;
    if (attr & 2) fy = 15 - fy;
    for (int mitad = 0; mitad < 2; mitad++) {
        // left half (blocks top-left / bottom-left), then right half (top-right / bottom-right)
        uint32_t bloque = mitad == 0 ? (fy < 8 ? 32 : 48) : (fy < 8 ? 0 : 16);
        uint32_t dir = tile * 64 + bloque + (fy % 8) * 2;
        uint8_t p0 = dir < c1.size() ? c1[dir] : 0, p1 = dir + 1 < c1.size() ? c1[dir + 1] : 0;
        uint8_t p2 = dir < c2.size() ? c2[dir] : 0, p3 = dir + 1 < c2.size() ? c2[dir + 1] : 0;
        if (registrar) evC.push_back({T + 16 * mitad, dir, (uint32_t)(p0 << 24 | p1 << 16 | p2 << 8 | p3), 0, 0, 0});
        if (s && visr >= 0 && fila < sp.alto) {
            for (int x = 0; x < 8; x++) {
                int col = ((p0 >> x) & 1) | ((p1 >> x) & 1) << 1 | ((p2 >> x) & 1) << 2 | ((p3 >> x) & 1) << 3;
                int px = mitad * 8 + x;
                if (attr & 1) px = 15 - px;
                int sx = (sp.x + px) & 0x1FF;
                if (col && sx < 320) { buffer[(linea_abs + 1) & 1][sx] = col; buffer_pal[(linea_abs + 1) & 1][sx] = attr >> 8; }
            }
        }
    }

    // --- CPU slots: slow VRAM at +8 master cycles, fast VRAM at +14.5
    if (!cpu_lenta.empty()) {
        Pendiente p = cpu_lenta.front(); cpu_lenta.pop_front();
        if (p.lectura) lectura_vram = vram[p.dir];
        else { vram_escribir(p.dir, p.val); lectura_vram = vram[p.siguiente]; }
        if (registrar) evLenta.push_back({T + 16, p.dir, p.lectura ? vram[p.dir] : p.val, KL_CPU, (uint8_t)(p.lectura ? 0 : 1), 0});
    }
    if (!cpu_rapida.empty()) {
        Pendiente p = cpu_rapida.front(); cpu_rapida.pop_front();
        if (p.lectura) lectura_vram = vram[p.dir];
        else { vram_escribir(p.dir, p.val); lectura_vram = vram[p.siguiente]; }
        if (registrar) evRapida.push_back({T + 29, p.dir, p.lectura ? vram[p.dir] : p.val, KR_CPU, (uint8_t)(p.lectura ? 0 : 1), 0});
    }

    // --- fix layer: tile column c is output from pixel 56 + 8c; its map word and 4 S ROM bytes are fetched 8
    //     pixels before. A fix tile spans two cycles: the map read uses the fix slot of the first one.
    int visf = visible(r);
    int pos = (int)(t % LINEA) / 2;                // master cycles in the line
    if (visf >= 0) {
        int c = (pos - (224 - 32)) / 32;           // column whose fetch starts in this 32-cycle window
        if (pos >= 224 - 32 && c < 40 && ((pos - (224 - 32)) % 32) == 0) {
            int fila_fija = visf / 8 + 2;
            uint16_t dm = 0x7000 + c * 32 + fila_fija;
            uint16_t ent = vram[dm];
            if (registrar) evLenta.push_back({T + 24, dm, ent, KL_FIJA, 0, 0});
            uint32_t ft = ent & 0xFFF;
            const std::vector<uint8_t> &rom_s = s1;
            const int orden[4] = {16, 24, 0, 8};   // pixels 0-1, 2-3, 4-5, 6-7
            for (int k = 0; k < 4; k++) {
                uint32_t dir = ft * 32 + orden[k] + (visf % 8);
                uint8_t b = dir < rom_s.size() ? rom_s[dir] : 0;
                if (registrar) evS.push_back({T + 32 + 16 * k, dir, b, 0, 0, 0});
                for (int h = 0; h < 2; h++) {
                    int col = h ? b >> 4 : b & 0xF;
                    int x = c * 8 + k * 2 + h;
                    // output: fix pixel over the line buffer of this line, else sprite, else backdrop
                    uint8_t *lb = buffer[linea_abs & 1];
                    uint16_t color;
                    if (col) color = paleta[(ent >> 12) * 16 + col];
                    else if (lb[x]) color = paleta[buffer_pal[linea_abs & 1][x] * 16 + lb[x]];
                    else color = paleta[0xFFF];
                    if (registrar) pix.push_back({(uint32_t)((uint64_t)linea_abs * LINEA + (224 + x * 4) * 2), (uint16_t)x, (uint16_t)visf, color});
                }
            }
        }
    }
    // the line buffer just output is cleared for reuse at the end of the line
    if (n == 95) { memset(buffer[linea_abs & 1], 0, 384); }
}

static void avanzar(uint64_t objetivo_mclk) {
    uint64_t obj = objetivo_mclk * 2;
    while (t_lspc + CICLO <= obj) { paso_lspc(t_lspc); t_lspc += CICLO; }
}

static void actualizar_ipl();

class Ng : public moira::Moira {
public:
    Ng() { irqMode = moira::IrqMode::USER; }
    bool parado() const { return flags & moira::State::STOPPED; }
    uint64_t mclk() const { return (uint64_t)clock * 2; }
    void sync(int cycles) override { clock += cycles; avanzar((uint64_t)clock * 2); }

    uint8_t chip(uint32_t a) const {
        a &= 0xFFFFFF;
        if (a < 0x80 && modo_bios && !vectores_cartucho) return C_BIOS;
        if (a < 0x100000) return C_PROM;
        if (a < 0x200000) return C_RAM;
        if (a < 0x300000) return C_PROM;
        if (a >= 0x300000 && a < 0x3A0000) return C_IO;
        if (a >= 0x3A0000 && a < 0x3C0000) return C_SISTEMA;
        if (a >= 0x3C0000 && a < 0x400000) return C_LSPC;
        if (a >= 0x400000 && a < 0x500000) return C_PALETA;
        if (a >= 0xC00000 && a < 0xD00000) return C_BIOS;
        return C_NINGUNO;
    }
    void registrar_bus(uint32_t a, uint32_t d, uint8_t k, uint8_t f) const {
        if (!grabar) return;
        uint8_t fc = readFC();
        if (k == K_LEE && (fc == 2 || fc == 6)) { k = K_PROG; f |= 64; }
        ev68.push_back({(uint32_t)((clock - 2) * 4), a & 0xFFFFFF, d, k, f, chip(a)});
    }
    uint16_t leer(uint32_t a) const {
        a &= 0xFFFFFE;
        if (modo_bios && a < 0x80 && !vectores_cartucho) return bios[a] << 8 | bios[a + 1];
        if (a >= 0xC00000 && a < 0xD00000) { uint32_t o = a & 0x1FFFF; return o + 1 < bios.size() ? bios[o] << 8 | bios[o + 1] : 0xFFFF; }
        if (a >= 0x300000 && a < 0x3A0000) {
            // controllers (active low) and status; $320000 = sound reply (the Z80 is not emulated: 0)
            if (a < 0x320000) return (uint16_t)(~mando_p1 & 0xFF) << 8 | 0xFF;
            if (a < 0x340000) return 0x00FF;
            if (a < 0x380000) return 0xFFFF;
            return (uint16_t)(0x7F & ~mando_estado) << 8 | 0xFF;   // bit 7 = 0: AES
        }
        if (a < 0x100000 || (a >= 0x200000 && a < 0x300000)) {
            uint32_t o = a & 0xFFFFF;
            if (o + 1 < prom.size()) return prom[o] << 8 | prom[o + 1];
            return 0xFFFF;
        }
        if (a < 0x200000) return ram[a & 0xFFFF] << 8 | ram[(a + 1) & 0xFFFF];
        if (a >= 0x3C0000 && a < 0x400000) {
            switch (a & 0xE) {
            case 0: case 2: return lectura_vram;
            case 4: return vram_mod;
            case 6: { uint64_t t = (uint64_t)clock * 4; int v = (int)((t / LINEA) % LINEAS); return raster(v) << 7; }
            }
            return 0xFFFF;
        }
        if (a >= 0x400000 && a < 0x500000) return paleta[(a >> 1) & 0xFFF];
        return 0xFFFF;
    }
    void escribir(uint32_t a, uint16_t v, bool byte) const {
        a &= 0xFFFFFF;
        if (a >= 0x100000 && a < 0x200000) {
            if (byte) ram[a & 0xFFFF] = (a & 1) ? v & 0xFF : v >> 8;
            else { ram[a & 0xFFFF] = v >> 8; ram[(a + 1) & 0xFFFF] = v; }
            return;
        }
        if (a >= 0x3A0000 && a < 0x3C0000) {
            switch (a & 0x1F) {
            case 0x13: vectores_cartucho = true; break;    // REG_SWPROM
            case 0x03: vectores_cartucho = false; break;   // REG_SWPBIOS
            }
            return;
        }
        if (a >= 0x3C0000 && a < 0x400000) {
            switch (a & 0xE) {
            case 0:
                vram_dir = v & 0x8000 ? v & 0x87FF : v;
                (vram_dir >= 0x8000 ? cpu_rapida : cpu_lenta).push_back({vram_dir, 0, true, vram_dir});
                break;
            case 2: {
                std::deque<Pendiente> &q = vram_dir >= 0x8000 ? cpu_rapida : cpu_lenta;
                uint16_t d = vram_dir;
                vram_dir = (vram_dir & 0x8000) | ((vram_dir + vram_mod) & 0x7FFF);
                if (vram_dir >= 0x8000) vram_dir &= 0x87FF;
                q.push_back({d, v, false, vram_dir});
                if (q.size() > cola_max) cola_max = q.size();
                break;
            }
            case 4: vram_mod = v; break;
            case 0xC: if (v & 4) { irq_vblank = false; actualizar_ipl(); } break;
            }
            return;
        }
        if (a >= 0x400000 && a < 0x500000) { paleta[(a >> 1) & 0xFFF] = v; return; }
    }
    u8 read8(u32 a) const override { uint16_t w = leer(a); u8 v = (a & 1) ? w & 0xFF : w >> 8; registrar_bus(a, v, K_LEE_B, 0); return v; }
    u16 read16(u32 a) const override { uint16_t v = leer(a); registrar_bus(a, v, K_LEE, 0); return v; }
    u32 read32(u32 a) const override { return (u32)read16(a) << 16 | read16(a + 2); }
    void write8(u32 a, u8 v) const override { registrar_bus(a, v, K_ESC_B, 1); escribir(a, (a & 1) ? v : v << 8, true); }
    void write16(u32 a, u16 v) const override { registrar_bus(a, v, K_ESC, 1); escribir(a, v, false); }
    void write32(u32 a, u32 v) const override { write16(a, v >> 16); write16(a + 2, v); }
    u16 read16Dasm(u32 a) const override { return leer(a); }
    u16 readIrqUserVector(u8 level) const override {
        ev68.push_back({(uint32_t)((clock - 4) * 4), 0xFFFFF0u | (uint32_t)level << 1, (uint32_t)(24 + level), K_IACK, 16, C_NINGUNO});
        return 24 + level;
    }
    void willInterrupt(u8 level) override {
        if (!grabar) return;
        // the main loop logged the instruction about to start; the interrupt is taken instead (it runs after RTE)
        if (!ins68.empty() && ins68.back().k == 0 && ins68.back().pc == getPC() && ins68.back().ciclo == ev68.size()) ins68.pop_back();
        InsM in{(uint32_t)(clock * 4), getPC(), (uint32_t)ev68.size(), 2, {}};
        guardar(in);
        ins68.push_back(in);
    }
    void guardar(InsM &in) const {
        for (int i = 0; i < 8; i++) in.r[i] = getD(i);
        for (int i = 0; i < 8; i++) in.r[8 + i] = getA(i);
        in.r[16] = getSR();
    }
};

static void actualizar_ipl() {
    int nivel = irq_vblank ? 1 : 0;
    if (nivel != ipl_previo) {
        senal((uint32_t)t_lspc, 0, nivel);
        ipl_previo = nivel;
        if (cpu) cpu->setIPL(nivel);
    }
}

static std::vector<uint8_t> leer_fichero(const char *r) {
    FILE *f = fopen(r, "rb");
    if (!f) { perror(r); exit(1); }
    std::vector<uint8_t> v;
    uint8_t b[65536]; size_t n;
    while ((n = fread(b, 1, sizeof b, f)) > 0) v.insert(v.end(), b, b + n);
    fclose(f);
    return v;
}

template <class T, class F> static void lista_json(const char *n, const std::vector<T> &v, F f, bool coma) {
    printf("\"%s\":[", n);
    for (size_t i = 0; i < v.size(); i++) printf(i ? ",%u" : "%u", (unsigned)f(v[i]));
    printf("]%s\n", coma ? "," : "");
}
static void bus_json(const char *nombre, const std::vector<Ev> &v, bool coma) {
    printf("\"%s\":{", nombre);
    lista_json("t", v, [](const Ev &e) { return e.t; }, true); lista_json("a", v, [](const Ev &e) { return e.a; }, true);
    lista_json("d", v, [](const Ev &e) { return e.d; }, true); lista_json("k", v, [](const Ev &e) { return e.k; }, true);
    lista_json("f", v, [](const Ev &e) { return e.f; }, true); lista_json("c", v, [](const Ev &e) { return e.c; }, false);
    printf("}%s\n", coma ? "," : "");
}

int main(int argc, char **argv) {
    if (argc < 6) { fprintf(stderr, "uso: ng_traza <p> <c1> <c2> <s1> <cuadros previos> [--bios <rom> <ciclos de arranque> [guion]]\n"); return 2; }
    prom = leer_fichero(argv[1]); c1 = leer_fichero(argv[2]); c2 = leer_fichero(argv[3]); s1 = leer_fichero(argv[4]);
    int previos = atoi(argv[5]);
    uint64_t ciclos_arranque = 0;
    if (argc >= 9 && !strcmp(argv[6], "--bios")) {
        modo_bios = true;
        bios = leer_fichero(argv[7]);
        ciclos_arranque = strtoull(argv[8], nullptr, 10);
        if (argc >= 10) {
            for (const char *q = argv[9]; *q;) {
                Pulsacion pu{};
                unsigned c = 0, a = 0, b = 0;
                int n = 0;
                if (sscanf(q, "%u:%u:%u%n", &c, &a, &b, &n) != 3) break;
                pu.cuadro = (int)c; pu.p1 = (uint8_t)a; pu.estado = (uint8_t)b;
                guion.push_back(pu);
                q += n;
                if (*q == ',') q++;
            }
        }
    }

    static Ng m68;
    cpu = &m68;
    m68.setModel(moira::Model::M68000, moira::Model::M68000);
    m68.setClock(0);
    if (modo_bios) {
        // power on: the 68000 takes SSP and PC from the system ROM (mapped over the vector table)
        m68.reset();
    } else {
        // The state the system ROM leaves before calling USER: VRAM, palettes and RAM cleared, supervisor mode with
        // interrupts masked, the stack at $10F300, the LSPC running. The trace starts at an arbitrary point of the
        // frame (the BIOS's own timing is not modelled): here, the start of raster $F8.
        m68.reset();
        ev68.clear();
        m68.setClock(0);
        m68.setSR(0x2700);
        m68.setISP(0x10F300);
        m68.setPC(0x122); m68.setPC0(0x122);
        m68.setIRD(prom[0x122] << 8 | prom[0x123]); m68.setIRC(prom[0x124] << 8 | prom[0x125]);
    }
    senal(0, 0, 0);
    uint32_t t_stop = 0;
    std::vector<uint64_t> inicios;   // start of raster $110 (first visible line): after the STOP, or since reset
    uint64_t linea_previa = 0;
    while (true) {
        if (modo_bios && grabar && !t_stop && (uint64_t)m68.getClock() >= ciclos_arranque && !m68.parado()) {
            // end of the recorded start-up, at an instruction boundary; nothing more until the frame
            t_stop = (uint32_t)(m68.mclk() * 2);
            grabar = false;
        }
        if (m68.parado()) {
            if (!t_stop) t_stop = (uint32_t)(m68.mclk() * 2);
            m68.execute();
        } else {
            if (grabar) {
                InsM in{(uint32_t)(m68.mclk() * 2), m68.getPC(), (uint32_t)ev68.size(), 0, {}};
                m68.guardar(in);
                ins68.push_back(in);
            }
            m68.execute();
        }
        uint64_t la = t_lspc / LINEA;
        if (la != linea_previa) {
            linea_previa = la;
            if ((t_stop || modo_bios) && raster((int)(la % LINEAS)) == 0x110) {
                inicios.push_back(la * LINEA);
                int cuadro = (int)inicios.size() - 1;
                for (const Pulsacion &pu : guion) if (cuadro >= pu.cuadro) { mando_p1 = pu.p1; mando_estado = pu.estado; }
                if (modo_bios && cuadro + 1 == previos) grabar = true;   // from the frame before: nothing at its start is missed
            }
            if (inicios.size() >= (size_t)previos + 2) break;
        }
        if (m68.mclk() > 400000000ull) { fprintf(stderr, "sin final\n"); return 1; }
    }
    if (cola_max > 1) fprintf(stderr, "ng_traza: hasta %zu accesos del 68000 esperando a la LSPC\n", cola_max);
    uint32_t t0 = (uint32_t)inicios[previos], t1 = (uint32_t)inicios[previos + 1];
    printf("{\"reloj_hz\":48000000,\"t_stop\":%u,\"t0\":%u,\"t1\":%u,\n", t_stop, t0, t1);
    bus_json("m68k", ev68, true); bus_json("lenta", evLenta, true); bus_json("rapida", evRapida, true);
    bus_json("crom", evC, true); bus_json("srom", evS, true);
    printf("\"ins68\":{");
    lista_json("t", ins68, [](const InsM &e) { return e.t; }, true); lista_json("pc", ins68, [](const InsM &e) { return e.pc; }, true);
    lista_json("ciclo", ins68, [](const InsM &e) { return e.ciclo; }, true); lista_json("k", ins68, [](const InsM &e) { return e.k; }, true);
    const char *nr[17] = {"D0", "D1", "D2", "D3", "D4", "D5", "D6", "D7", "A0", "A1", "A2", "A3", "A4", "A5", "A6", "A7", "SR"};
    for (int r = 0; r < 17; r++) { printf("\"%s\":[", nr[r]); for (size_t i = 0; i < ins68.size(); i++) printf(i ? ",%u" : "%u", ins68[i].r[r]); printf("]%s\n", r < 16 ? "," : ""); }
    printf("},\n\"sen\":{");
    lista_json("t", sen, [](const Sen &e) { return e.t; }, true); lista_json("k", sen, [](const Sen &e) { return e.k; }, true);
    lista_json("v", sen, [](const Sen &e) { return e.v; }, false);
    printf("},\n\"pix\":{");
    lista_json("t", pix, [](const Px &p) { return p.t; }, true); lista_json("x", pix, [](const Px &p) { return p.x; }, true);
    lista_json("y", pix, [](const Px &p) { return p.y; }, true); lista_json("color", pix, [](const Px &p) { return p.color; }, false);
    printf("}}\n");
    return 0;
}
