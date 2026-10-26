| «Paso a paso» demo for the Neo Geo AES (68000 + LSPC2-A2): everything on screen is a sprite or the fix layer.
| A ball made of two chained sprites (32 × 32) moves one pixel per frame over a ground strip of 20 chained
| sprites; the fix layer writes «NEO GEO». The trace starts at the cartridge's USER entry ($122): the system ROM
| (SNK's BIOS, not included) has already checked the cartridge, cleared VRAM and palettes and called USER.
| Assembled with GNU as for the 68000 (binutils-m68k-linux-gnu); see build.sh. Licence: CC0 1.0.
| Each «[tag]» names the Spanish explanation in explicaciones.es.txt.

        .equ REG_WATCHDOG, 0x300001
        .equ REG_SWPROM,   0x3A0013
        .equ REG_VRAMADDR, 0x3C0000
        .equ REG_VRAMRW,   0x3C0002
        .equ REG_VRAMMOD,  0x3C0004
        .equ REG_LSPCMODE, 0x3C0006
        .equ REG_IRQACK,   0x3C000C
        .equ PALETTES,     0x400000
        .equ BACKDROP,     0x401FFE
        .equ BALL_X,       0x100000      | RAM: ball X position

        .text
        .org 0x0000
        .long 0x0010F300                | initial stack pointer
        .long 0x00C00402                | reset: the system ROM's entry (vectors used before REG_SWPROM)
        .rept 23
        .long idle_exc
        .endr
        .long vblank                    | vector 25: level 1 interrupt = LSPC vertical blank
        .long idle_exc                  | vector 26: level 2 (LSPC timer)
        .long idle_exc                  | vector 27: level 3
        .rept 36
        .long idle_exc
        .endr

        | Cartridge header read by the system ROM
        .org 0x0100
        .ascii "NEO-GEO"
        .byte 0x00                      | system version
        .word 0x0EAA                    | NGH number (not an SNK one)
        .long 0x00100000                | P ROM size
        .long 0x00100010                | backup RAM area used by the game
        .word 0x0000                    | backup RAM size
        .byte 0x00                      | eye-catcher: done by the BIOS
        .byte 0x00                      | eye-catcher sprite bank
        .long 0x00000400, 0x00000400, 0x00000400   | software DIP tables (Japan, USA, Europe)

        .org 0x0122
        jmp     user                    | [user] USER: the system ROM calls this to start the game
        .org 0x0128
        rts                             | PLAYER_START
        .org 0x012E
        rts                             | DEMO_END
        .org 0x0134
        rts                             | COIN_SOUND

        .org 0x0200
user:
        move.b  d0, REG_WATCHDOG        | [w1] kick the watchdog (a write to $300001 every frame keeps the reset away)
        move.b  d0, REG_SWPROM          | [vec] vectors from the cartridge from now on
        lea     REG_VRAMADDR, a5        | [a5] a5: LSPC VRAM address register
        lea     REG_VRAMRW, a4          | [a4] a4: LSPC VRAM data register

        | Palettes: backdrop, palette 1 (ball), palette 2 (ground), palette 3 (text)
        move.w  #0x7BCF, BACKDROP       | [p1] backdrop colour: light blue
        lea     PALETTES+32, a0         | [p2] palette 1
        lea     colours(pc), a1         | [p3]
        moveq   #47, d1                 | [p4] 3 palettes of 16 colours
1:      move.w  (a1)+, (a0)+            | [p5] copy one colour (palette RAM, 16 bits)
        dbf     d1, 1b                  | [p6]

        | Fix layer: «NEO GEO» on row 4 from column 16 (map at $7000, column by column)
        move.w  #32, REG_VRAMMOD        | [x1] one column further after each write
        move.w  #0x7000+16*32+4, (a5)   | [x2] column 16, row 4
        lea     text(pc), a0            | [x3]
        moveq   #6, d1                  | [x4] 7 characters
2:      move.w  (a0)+, (a4)             | [x5] palette 3, fix tile number
        dbf     d1, 2b                  | [x6]

        | Sprite tile maps (SCB1): two tiles per sprite, sprite n at $0000 + n × 64
        move.w  #1, REG_VRAMMOD         | [m1] consecutive words
        move.w  #1*64, (a5)             | [m2] sprite 1 (left half of the ball)
        move.w  #1, (a4)                | [m3] tile 1 (even word: tile number)
        move.w  #0x0100, (a4)           | [m3b] palette 1 (odd word: palette, flips)
        move.w  #2, (a4)                | [m4] tile 2 below it
        move.w  #0x0100, (a4)           | [m4b]
        move.w  #2*64, (a5)             | [m5] sprite 2 (right half)
        move.w  #3, (a4)                | [m6] tile 3
        move.w  #0x0100, (a4)           | [m6b]
        move.w  #4, (a4)                | [m7] tile 4
        move.w  #0x0100, (a4)           | [m7b]
        moveq   #3, d0                  | [g1] ground: sprites 3 to 22
        moveq   #19, d1                 | [g2]
3:      move.w  d0, d2                  | [g3]
        lsl.w   #6, d2                  | [g4] sprite × 64
        move.w  d2, (a5)                | [g5]
        move.w  #5, (a4)                | [g6] tile 5
        move.w  #0x0200, (a4)           | [g6b] palette 2
        move.w  #5, (a4)                | [g7] tile 5 again below
        move.w  #0x0200, (a4)           | [g7b]
        addq.w  #1, d0                  | [g8]
        dbf     d1, 3b                  | [g9]

        | Shrink (SCB2), Y and size (SCB3), X (SCB4) for sprites 1 to 22
        move.w  #0x8001, (a5)           | [s1] SCB2 of sprite 1
        moveq   #21, d1                 | [s2]
4:      move.w  #0x0FFF, (a4)           | [s3] no shrinking
        dbf     d1, 4b                  | [s4]
        move.w  #0x8201, (a5)           | [s5] SCB3 of sprite 1
        move.w  #((496-140)<<7)+2, (a4) | [s6] ball: Y = 140, 2 tiles high
        move.w  #0x0040, (a4)           | [s7] sprite 2: sticky (chained to sprite 1)
        move.w  #((496-192)<<7)+2, (a4) | [s8] ground: Y = 192, 2 tiles high (the last 32 lines)
        moveq   #18, d1                 | [s9]
5:      move.w  #0x0040, (a4)           | [s10] sprites 4 to 22 chained
        dbf     d1, 5b                  | [s11]
        move.w  #0x8401, (a5)           | [s12] SCB4 of sprite 1
        move.w  #40<<7, (a4)            | [s13] ball X = 40
        move.w  #40<<7, BALL_X          | [s14] and in RAM
        move.w  #0x8403, (a5)           | [s15] SCB4 of sprite 3
        move.w  #0<<7, (a4)             | [s16] ground X = 0 (the chained ones follow 16 pixels apart)

loop:
        stop    #0x2000                 | [stop] mask 0: the level 1 interrupt gets through; wait without using the bus
        bra.s   loop                    | [loop]

| Vertical blank (level 1): the LSPC asks for it at the start of the bottom border.
vblank:
        move.w  #4, REG_IRQACK          | [v1] acknowledge the vertical blank interrupt
        move.b  d0, REG_WATCHDOG        | [v2] kick the watchdog
        addi.w  #1<<7, BALL_X           | [v3] ball one pixel to the right (X is in bits 15-7)
        move.w  #0x8401, (a5)           | [v4] SCB4 of sprite 1
        move.w  BALL_X, (a4)            | [v5] new X: the LSPC reads it when it renders the next frame
        rte                             | [v6]

idle_exc:
        rte                             | [idle] unused exceptions

        .align 2
colours:
        | Neo Geo colour: bit 15 dark, then the low bits of R, G, B, then 4 bits of each (R4-1, G4-1, B4-1)
        .word 0x0000, 0x0FF0, 0x0F60, 0x7FFF, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0     | 1: yellow, orange, white
        .word 0x0000, 0, 0, 0, 0, 0x02C2, 0x0181, 0x0420, 0x0A52, 0, 0, 0, 0, 0, 0, 0 | 2: greens, mortar, brick
        .word 0x0000, 0x7FFF, 0x0333, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0       | 3: white, grey
text:
        .word 0x3001, 0x3002, 0x3003, 0x3000, 0x3004, 0x3002, 0x3003   | «NEO GEO» (palette 3)

        .org 0x0FFE
        .word 0x0000
