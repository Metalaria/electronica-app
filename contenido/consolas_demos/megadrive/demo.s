| «Paso a paso» demo for the Sega Mega Drive (68000 + VDP 315-5313 in mode 5, H40, PAL).
| Plane B: sky and ground. Plane A: clouds that drift one pixel per frame (horizontal scroll table).
| One 16x16 sprite that moves one pixel per frame; its attribute entry lives in 68000 RAM and is copied to VRAM by
| a VDP DMA in every vertical blank. The Z80 gets a two-byte program (DI, HALT) and stays idle.
| Assembled with GNU as for the 68000 (binutils-m68k-linux-gnu); see build.sh. Licence: CC0 1.0.
| Each «[tag]» names the Spanish explanation in explicaciones.es.txt.

        .equ VDP_DATA,  0xC00000
        .equ VDP_CTRL,  0xC00004
        .equ Z80_RAM,   0xA00000
        .equ Z80_BUSREQ, 0xA11100
        .equ Z80_RESET, 0xA11200
        .equ VERSION,   0xA10001
        .equ TMSS,      0xA14000
        .equ SPR_RAM,   0xFF0000        | sprite 0 attribute entry (8 bytes), copied to VRAM by DMA
        .equ SCROLL_A,  0xFF0008        | horizontal scroll of plane A
        .equ TILES,     0x0800          | tile data (fixed address: the DMA source registers need it)
        .equ N_TILES,   11

        .text
        .org 0x0000
        .long 0x00FFFE00                | initial supervisor stack pointer
        .long start                     | initial program counter
        .rept 28
        .long idle_exc                  | bus/address error, illegal instruction ... level 5 interrupt
        .endr
        .long vblank                    | vector 30: level 6 interrupt = VDP vertical blank
        .long idle_exc                  | vector 31: level 7
        .rept 32
        .long idle_exc                  | TRAP #n and reserved vectors
        .endr

        | Cartridge header: «SEGA» at $100 is what the TMSS boot code and the console check.
        .org 0x0100
        .ascii "SEGA MEGA DRIVE "
        .ascii "(C)EPA  2026.OCT"
        .ascii "ELECTRONICA PRACTICA AVANZADA: UN FOTOGRAMA     "
        .ascii "ELECTRONICA PRACTICA AVANZADA: UN FOTOGRAMA     "
        .ascii "GM 00000000-00"
        .word 0x0000                    | checksum: written by build.sh
        .ascii "J               "
        .long 0x00000000, 0x00000FFF    | ROM start and end
        .long 0x00FF0000, 0x00FFFFFF    | RAM start and end
        .ascii "            "
        .ascii "            "
        .ascii "                                        "
        .ascii "E               "

        .org 0x0200
start:
        move.b  VERSION, d0             | [tmss1] read the console version register
        andi.b  #0x0F, d0               | [tmss2] bits 0-3: hardware revision
        beq.s   1f                      | [tmss3] revision 0 has no TMSS
        move.l  #0x53454741, TMSS       | [tmss4] write «SEGA»: the VDP is unlocked
1:      lea     VDP_CTRL, a5            | [a5] a5: VDP control port
        lea     VDP_DATA, a4            | [a4] a4: VDP data port

        move.w  #0x0100, Z80_BUSREQ     | [z1] ask the Z80 for its bus
        move.w  #0x0100, Z80_RESET      | [z2] and let it out of reset
2:      btst    #0, Z80_BUSREQ          | [z3] bit 0 = 0 when the bus is granted
        bne.s   2b                      | [z4]
        move.b  #0xF3, Z80_RAM          | [z5] DI
        move.b  #0x76, Z80_RAM+1        | [z6] HALT
        move.w  #0x0000, Z80_RESET      | [z7] reset the Z80 ...
        move.w  #0x0000, Z80_BUSREQ     | [z8] ... give its bus back ...
        move.w  #0x0100, Z80_RESET      | [z9] ... and let it run from $0000

        lea     vdp_regs(pc), a0        | [r1] table of register writes
        moveq   #18, d1                 | [r2] 19 registers
3:      move.w  (a0)+, (a5)             | [r3] $8000 + register number × $100 + value
        dbf     d1, 3b                  | [r4]

        move.l  #0xC0000000, (a5)       | [c1] CRAM write from address 0
        lea     palette(pc), a0         | [c2]
        moveq   #15, d1                 | [c3] 16 colours
4:      move.w  (a0)+, (a4)             | [c4] 0000 BBB0 GGG0 RRR0
        dbf     d1, 4b                  | [c5]

        | Tiles: DMA from the cartridge ROM to VRAM $0000
        move.l  #0x93B09400, (a5)       | [d1] length: 176 words (11 tiles)
        move.l  #0x95009604, (a5)       | [d2] source $000800 / 2 = $000400: low and middle bytes
        move.w  #0x9700, (a5)           | [d3] high byte; bit 7 = 0: copy from the 68000 bus
        move.l  #0x40000080, (a5)       | [d4] VRAM write at $0000 with CD5 = 1: the DMA starts

        | Plane B (name table at $E000): 19 rows of sky, 13 of ground
        move.l  #0x60000003, (a5)       | [b1] VRAM write at $E000
        move.w  #19*64-1, d1            | [b2]
5:      move.w  #0x0001, (a4)           | [b3] tile 1: sky
        dbf     d1, 5b                  | [b4]
        move.w  #13*64-1, d1            | [b5]
6:      move.w  #0x0003, (a4)           | [b6] tile 3: ground
        dbf     d1, 6b                  | [b7]

        | Plane A (name table at $C000): emptied by a VDP fill, then three clouds
        move.l  #0x93FF940F, (a5)       | [f1] fill length: $0FFF bytes
        move.w  #0x9780, (a5)           | [f2] DMA mode: fill
        move.l  #0x40000083, (a5)       | [f3] VRAM write at $C000 with DMA
        move.w  #0x0000, (a4)           | [f4] the fill value starts the fill (the VDP works alone)
7:      move.w  (a5), d0                | [f5] status register
        btst    #1, d0                  | [f6] bit 1: DMA in progress
        bne.s   7b                      | [f7]
        lea     clouds(pc), a0          | [k1] list of cloud positions (VRAM write commands)
        moveq   #2, d1                  | [k2] three clouds
8:      move.l  (a0)+, (a5)             | [k3] address of the cloud in plane A
        move.l  #0x00050006, (a4)       | [k4] two tiles: cloud left (5), cloud right (6)
        dbf     d1, 8b                  | [k5]

        | Sprite 0 in RAM: Y, size/link, tile, X (all +128)
        lea     SPR_RAM, a0             | [s1]
        move.w  #128+150, (a0)+         | [s2] Y = 150
        move.w  #0x0500, (a0)+          | [s3] 2 × 2 cells, last sprite of the list
        move.w  #0x8007, (a0)+          | [s4] priority, palette 0, tiles from 7
        move.w  #128+40, (a0)+          | [s5] X = 40
        move.w  #0, (a0)+               | [s6] plane A scroll = 0

        move.w  #0x8174, (a5)           | [on1] register 1: display on, V interrupt on, DMA on, mode 5
loop:
        stop    #0x2500                 | [stop] interrupt mask 5 (level 6 gets through) and wait without using the bus
        bra.s   loop                    | [loop]

| Vertical blank (level 6): the VDP pulls /IPL1 and /IPL2 at the start of line 224.
vblank:
        addq.w  #1, SPR_RAM+6           | [v1] sprite one pixel to the right (in RAM)
        subq.w  #1, SCROLL_A            | [v2] clouds one pixel to the left
        move.l  #0x7C000003, (a5)       | [v3] VRAM write at $FC00 (horizontal scroll table)
        move.w  SCROLL_A, (a4)          | [v4] scroll of plane A for the whole screen
        move.l  #0x93049400, (a5)       | [v5] DMA length: 4 words
        move.l  #0x95009680, (a5)       | [v6] source $FF0000 / 2 = $7F8000: low and middle bytes
        move.w  #0x977F, (a5)           | [v7] high byte: from the 68000 bus
        move.l  #0x70000083, (a5)       | [v8] VRAM write at $F000 with DMA: the VDP copies the RAM entry
        rte                             | [v9] back to the STOP loop

idle_exc:
        rte                             | [idle] unused exceptions

        .align 2
vdp_regs:
        .word 0x8004                    | R0: no H interrupt
        .word 0x8134                    | R1: display off, V interrupt and DMA on, mode 5
        .word 0x8230                    | R2: plane A at $C000
        .word 0x832C                    | R3: window at $B000 (not used)
        .word 0x8407                    | R4: plane B at $E000
        .word 0x8578                    | R5: sprite table at $F000
        .word 0x8600
        .word 0x8700                    | R7: background colour 0
        .word 0x8800
        .word 0x8900
        .word 0x8AFF                    | R10: H interrupt counter
        .word 0x8B00                    | R11: whole-screen scrolling
        .word 0x8C81                    | R12: 40 cells wide (H40)
        .word 0x8D3F                    | R13: horizontal scroll table at $FC00
        .word 0x8E00
        .word 0x8F02                    | R15: auto-increment 2
        .word 0x9001                    | R16: planes of 64 × 32 cells
        .word 0x9100                    | R17, R18: no window
        .word 0x9200

palette:
        | 0 black, 1 sky, 2 light sky, 3 grass, 4 dark grass, 5 white, 6 grey, 7 yellow, 8 orange, 9 dark orange
        .word 0x0000, 0x0E84, 0x0EA6, 0x00A2, 0x0060, 0x0EEE, 0x0AAA, 0x00EE
        .word 0x006E, 0x004A, 0x0000, 0x0000, 0x0000, 0x0000, 0x0000, 0x0000

clouds:
        | VRAM write commands for plane A, row r, column c: $C000 + r*128 + c*2
        .long 0x40000003 + ((3*128+6)<<16)
        .long 0x40000003 + ((5*128+22)<<16)
        .long 0x40000003 + ((2*128+34)<<16)

        .org TILES
tiles:
        | 4 bits per pixel, 8 pixels per row (4 bytes), 8 rows per tile
        .long 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000 | 0 empty
        .long 0x11111111, 0x11111111, 0x11111111, 0x11111111, 0x11111111, 0x11111111, 0x11111111, 0x11111111 | 1 sky
        .long 0x22222222, 0x22222222, 0x22222222, 0x22222222, 0x22222222, 0x22222222, 0x22222222, 0x22222222 | 2 light sky
        .long 0x33334444, 0x33334444, 0x33334444, 0x33334444, 0x44443333, 0x44443333, 0x44443333, 0x44443333 | 3 ground
        .long 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000 | 4 (unused)
        .long 0x00000555, 0x00055555, 0x05555555, 0x55555555, 0x55555555, 0x56666666, 0x06666666, 0x00000000 | 5 cloud left
        .long 0x55500000, 0x55555000, 0x55555550, 0x55555555, 0x55555555, 0x66666665, 0x66666660, 0x00000000 | 6 cloud right
        .long 0x00000888, 0x00088777, 0x00877777, 0x08775777, 0x08757777, 0x87777777, 0x87777777, 0x87777777 | 7 ball top left
        .long 0x87777777, 0x87777777, 0x87777777, 0x08777777, 0x08777777, 0x00877777, 0x00088777, 0x00000888 | 8 ball bottom left
        .long 0x88800000, 0x77788000, 0x77777800, 0x77777780, 0x77777780, 0x77777778, 0x77777778, 0x77777798 | 9 ball top right
        .long 0x77777798, 0x77777798, 0x77777798, 0x77777980, 0x77779980, 0x77799800, 0x99988000, 0x88800000 | 10 ball bottom right
        .org 0x0FFE
        .word 0x0000
