; «Paso a paso» demo for the Sega Master System II (Z80, VDP 315-5246 in mode 4).
; A tiled background (sky, grass, bricks) and one 8x8 sprite that moves one pixel per frame.
; The trace starts at the cartridge entry point $0000: on a real console the Sega boot ROM runs first,
; checks the «TMR SEGA» header, maps the cartridge (port $3E) and jumps here.
; Assembled with GNU as for the Z80 (binutils-z80); see build.sh. Licence: CC0 1.0.
; Each «[tag]» names the Spanish explanation in explicaciones.es.txt.

        .equ VDP_DATA, 0xBE           ; VDP data port
        .equ VDP_CTRL, 0xBF           ; VDP control port (and status when read)
        .equ SPRITE_X, 0xC000         ; RAM variable: sprite X position

        .org 0x0000
reset:
        di                            ; [di] no interrupts while we set up
        im 1                          ; [im1] mode 1: /INT always calls $0038
        ld sp, 0xDFF0                 ; [sp] stack at the top of the 8 KB work RAM
        jp main                       ; [jpmain] skip over the interrupt vectors

        .org 0x0038
irq:
        jp vblank                     ; [irq] frame interrupt entry (RST 38h)

        .org 0x0066
nmi:
        retn                          ; [nmi] pause button: ignored

main:
        ld hl, vdp_regs               ; [regs1] table of 11 register writes
        ld b, vdp_regs_end - vdp_regs ; [regs2] 22 bytes: value, $80 + register number
        ld c, VDP_CTRL                ; [regs3] every byte goes to the control port
        otir                          ; [regs4] out (c),(hl); hl++; b--; repeat while b != 0

        xor a                         ; [cram1] CRAM address 0 ...
        out (VDP_CTRL), a             ; [cram2] ... low byte of the address
        ld a, 0xC0                    ; [cram3] code 3 = write to CRAM
        out (VDP_CTRL), a             ; [cram4] second control byte
        ld hl, palette                ; [cram5] 32 colours: 16 for tiles, 16 for sprites
        ld b, 32                      ; [cram6]
        ld c, VDP_DATA                ; [cram7]
        otir                          ; [cram8] copy the palette into CRAM

        xor a                         ; [vram1] VRAM address $0000 ...
        out (VDP_CTRL), a             ; [vram2]
        ld a, 0x40                    ; [vram3] code 1 = write to VRAM
        out (VDP_CTRL), a             ; [vram4]
        ld hl, tiles                  ; [vram5] four 8x8 tiles, 32 bytes each
        ld b, tiles_end - tiles       ; [vram6] 128 bytes
        otir                          ; [vram7] (c) is still the data port

        xor a                         ; [map1] name table at $3800
        out (VDP_CTRL), a             ; [map2]
        ld a, 0x78                    ; [map3] $38 + write code $40
        out (VDP_CTRL), a             ; [map4]
        ld d, 16                      ; [map5] 16 rows of sky (tile 0)
        xor a                         ; [map6]
        call fill_rows                ; [map7]
        ld d, 1                       ; [map8] one row of grass (tile 1)
        ld a, 1                       ; [map9]
        call fill_rows                ; [map10]
        ld d, 7                       ; [map11] seven rows of bricks (tile 2)
        ld a, 2                       ; [map12]
        call fill_rows                ; [map13]

        ld a, 64                      ; [spr0] start the sprite at X = 64
        ld (SPRITE_X), a              ; [spr0b]
        xor a                         ; [spr1] sprite attribute table: Y list at $3F00
        out (VDP_CTRL), a             ; [spr2]
        ld a, 0x7F                    ; [spr3] $3F + write code $40
        out (VDP_CTRL), a             ; [spr4]
        ld a, 119                     ; [spr5] sprite 0: Y = 119 (drawn from line 120)
        out (VDP_DATA), a             ; [spr6]
        ld a, 0xD0                    ; [spr7] $D0 ends the sprite list
        out (VDP_DATA), a             ; [spr8]
        call put_sprite_x             ; [spr9] X and tile number at $3F80

        ld a, 0xE0                    ; [on1] register 1: display on, frame interrupt on
        out (VDP_CTRL), a             ; [on2]
        ld a, 0x81                    ; [on3]
        out (VDP_CTRL), a             ; [on4]
        ei                            ; [ei] accept interrupts from now on
loop:
        halt                          ; [halt] sleep until the next interrupt
        jr loop                       ; [loop]

; Fill D rows of 32 name-table entries with tile A (the VRAM address is already set).
fill_rows:
        ld e, 32                      ; [row1] 32 columns per row
fill_entry:
        out (VDP_DATA), a             ; [row2] low byte: tile number
        ex af, af'                    ; [row3] keep the tile number in the shadow A
        xor a                         ; [row4] high byte: no flip, palette 0, behind sprites
        out (VDP_DATA), a             ; [row5]
        ex af, af'                    ; [row6]
        dec e                         ; [row7]
        jr nz, fill_entry             ; [row8]
        dec d                         ; [row9]
        jr nz, fill_rows              ; [row10]
        ret                           ; [row11]

; Write the sprite's X and tile number at $3F80.
put_sprite_x:
        ld a, 0x80                    ; [px1] VRAM address $3F80 ...
        out (VDP_CTRL), a             ; [px2]
        ld a, 0x7F                    ; [px3] $3F + write code $40
        out (VDP_CTRL), a             ; [px4]
        ld a, (SPRITE_X)              ; [px5] read the position from RAM
        out (VDP_DATA), a             ; [px6] X
        ld a, 3                       ; [px7] tile 3: the ball
        out (VDP_DATA), a             ; [px8]
        ret                           ; [px9]

; Frame interrupt: the VDP pulls /INT low when line 193 starts (first line after the picture).
vblank:
        push af                       ; [vb1] save the registers we use
        in a, (VDP_CTRL)              ; [vb2] reading the status releases /INT
        ld a, (SPRITE_X)              ; [vb3]
        inc a                         ; [vb4] one pixel to the right
        ld (SPRITE_X), a              ; [vb5]
        call put_sprite_x             ; [vb6] the VRAM copy is read on the next frame
        pop af                        ; [vb7]
        ei                            ; [vb8] interrupts were disabled by the acknowledge
        reti                          ; [vb9]

vdp_regs:
        .byte 0x06, 0x80              ; R0: mode 4
        .byte 0x80, 0x81              ; R1: display off for now
        .byte 0xFF, 0x82              ; R2: name table at $3800
        .byte 0xFF, 0x83              ; R3: unused in mode 4
        .byte 0xFF, 0x84              ; R4: unused in mode 4
        .byte 0xFF, 0x85              ; R5: sprite attribute table at $3F00
        .byte 0xFB, 0x86              ; R6: sprite tiles from $0000
        .byte 0x00, 0x87              ; R7: border = sprite colour 0
        .byte 0x00, 0x88              ; R8: no horizontal scroll
        .byte 0x00, 0x89              ; R9: no vertical scroll
        .byte 0xFF, 0x8A              ; R10: no line interrupt
vdp_regs_end:

palette:
        ; Background: 0 black, 1 sky, 2 light green, 3 dark green, 4 brick, 5 mortar, 6 dark brick
        .byte 0x00, 0x39, 0x0C, 0x04, 0x06, 0x2A, 0x01, 0x00
        .byte 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00
        ; Sprites: 0 border/transparent (dark blue), 1 yellow, 2 orange, 3 white
        .byte 0x10, 0x0F, 0x07, 0x3F, 0x00, 0x00, 0x00, 0x00
        .byte 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00

tiles:
        ; Each row: four bit planes (bit 0 to bit 3 of the colour index), leftmost pixel in bit 7.
        ; Tile 0: sky (colour 1)
        .rept 8
        .byte 0xFF, 0x00, 0x00, 0x00
        .endr
        ; Tile 1: grass (colours 2 and 3)
        .byte 0x00, 0xFF, 0x00, 0x00
        .byte 0x00, 0xFF, 0x00, 0x00
        .byte 0x44, 0xFF, 0x00, 0x00
        .byte 0xEE, 0xFF, 0x00, 0x00
        .byte 0xFF, 0xFF, 0x00, 0x00
        .byte 0xBB, 0xFF, 0x00, 0x00
        .byte 0xFF, 0xFF, 0x00, 0x00
        .byte 0xFF, 0xFF, 0x00, 0x00
        ; Tile 2: bricks (colour 4 with mortar 5 and shade 6)
        .byte 0xFF, 0x00, 0xFF, 0x00
        .byte 0x80, 0x00, 0xFF, 0x00
        .byte 0x80, 0x00, 0xFF, 0x00
        .byte 0x80, 0x7F, 0xFF, 0x00
        .byte 0xFF, 0x00, 0xFF, 0x00
        .byte 0x08, 0x00, 0xFF, 0x00
        .byte 0x08, 0x00, 0xFF, 0x00
        .byte 0x08, 0xF7, 0xFF, 0x00
        ; Tile 3: the ball (sprite colours: 1 yellow fill, 2 orange outline, 3 white shine)
        .byte 0x00, 0x3C, 0x00, 0x00
        .byte 0x3C, 0x42, 0x00, 0x00
        .byte 0x7E, 0xB1, 0x00, 0x00
        .byte 0x7E, 0xA1, 0x00, 0x00
        .byte 0x7E, 0x81, 0x00, 0x00
        .byte 0x7E, 0x81, 0x00, 0x00
        .byte 0x3C, 0x42, 0x00, 0x00
        .byte 0x00, 0x3C, 0x00, 0x00
tiles_end:

        ; Cartridge header read by the boot ROM: «TMR SEGA», checksum, product code, region and size.
        .org 0x7FF0
        .ascii "TMR SEGA"
        .byte 0x00, 0x00
        .word 0x0000                  ; checksum: written by build.py
        .byte 0x00, 0x00, 0x00        ; product code and version
        .byte 0x4C                    ; SMS export, 32 KB
