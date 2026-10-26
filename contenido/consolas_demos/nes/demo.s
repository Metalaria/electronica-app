; «Un fotograma» demo for the NES (NROM-128: 16 KB PRG-ROM, 8 KB CHR-ROM, vertical mirroring).
; Draws a fixed background (sky, clouds, sun, bricks, grass, ground, water) and a 16 x 16 robot made of four
; sprites that walks one pixel to the right every frame. The CPU prepares the sprites in RAM during the frame and
; the NMI handler copies them to the PPU with OAM DMA at the start of VBlank.
; Build: ca65 demo.s -g -o demo.o && ld65 -C nes.cfg demo.o -o demo.nes -Ln demo.lbl --dbgfile demo.dbg
; (contenido/fotograma/generar.mjs does it). The Spanish explanation of each instruction is in explicaciones.es.txt.

OAM_COPY = $0200            ; RAM page copied to the PPU's sprite memory by OAM DMA
ROBOT_Y  = 143              ; sprite Y is the line above the sprite's first row: the robot stands on the grass

PPUCTRL   = $2000
PPUMASK   = $2001
PPUSTATUS = $2002
PPUSCROLL = $2005
PPUADDR   = $2006
PPUDATA   = $2007
OAMDMA    = $4014

.segment "HEADER"
    .byte "NES", $1A        ; iNES signature
    .byte 1                 ; 1 x 16 KB of PRG-ROM
    .byte 1                 ; 1 x 8 KB of CHR-ROM
    .byte $01               ; mapper 0 (NROM), vertical mirroring
    .byte $00
    .res 8, 0

.segment "ZEROPAGE"
frames:   .res 1            ; incremented by every NMI
robot_x:  .res 1            ; robot's left edge in pixels
pointer:  .res 2            ; source address for the nametable copy

.segment "CODE"

reset:
    sei                     ; no IRQs
    cld                     ; the 2A03 has no decimal mode, but keep the flag clear
    ldx #$FF
    txs                     ; stack pointer at $01FF
    inx                     ; X = 0
    stx PPUCTRL             ; NMI off while setting up
    stx PPUMASK             ; rendering off

wait_vblank1:               ; the PPU needs about two frames to warm up
    bit PPUSTATUS
    bpl wait_vblank1

    lda #$FF                ; Y = $FF puts a sprite below the screen: hide all 64
clear_oam:
    sta OAM_COPY,x
    inx
    bne clear_oam

    lda #40
    sta robot_x

wait_vblank2:
    bit PPUSTATUS
    bpl wait_vblank2

    ; palettes: 32 bytes at PPU $3F00
    lda #$3F
    sta PPUADDR
    lda #$00
    sta PPUADDR
    ldx #0
load_palettes:
    lda palettes,x
    sta PPUDATA
    inx
    cpx #32
    bne load_palettes

    ; nametable 0 and its attribute table: 1024 bytes at PPU $2000
    lda #$20
    sta PPUADDR
    lda #$00
    sta PPUADDR
    lda #<nametable_data
    sta pointer
    lda #>nametable_data
    sta pointer+1
    ldx #4                  ; four pages of 256 bytes
    ldy #0
copy_nametable:
    lda (pointer),y
    sta PPUDATA
    iny
    bne copy_nametable
    inc pointer+1
    dex
    bne copy_nametable

    jsr place_robot

wait_vblank3:               ; switch the picture on during VBlank
    bit PPUSTATUS
    bpl wait_vblank3
    lda #0
    sta PPUSCROLL           ; horizontal scroll 0
    sta PPUSCROLL           ; vertical scroll 0
    lda #%10000000          ; NMI at VBlank, nametable 0, background and sprite tiles at $0000
    sta PPUCTRL
    lda #%00011110          ; show background and sprites, also in the leftmost 8 pixels
    sta PPUMASK

main_loop:                  ; one pass per frame
    lda frames
wait_frame:
    cmp frames              ; the NMI changes 'frames'
    beq wait_frame
    inc robot_x             ; one pixel to the right
    jsr place_robot
    jmp main_loop

; Writes the robot's four sprites (Y, tile, attributes, X) into the OAM copy.
place_robot:
    ldx #0
place_part:
    lda robot_parts,x       ; row offset
    clc
    adc #ROBOT_Y
    sta OAM_COPY,x
    lda robot_parts+1,x     ; tile number
    sta OAM_COPY+1,x
    lda robot_parts+2,x     ; attributes: palette 0, in front of the background
    sta OAM_COPY+2,x
    lda robot_parts+3,x     ; column offset
    clc
    adc robot_x
    sta OAM_COPY+3,x
    inx
    inx
    inx
    inx
    cpx #16
    bne place_part
    rts

; VBlank: copy the sprites to the PPU and reset the scroll for the next frame.
nmi:
    pha
    lda #>OAM_COPY
    sta OAMDMA              ; OAM DMA: 256 bytes from $0200, 513 or 514 CPU cycles
    lda #0
    sta PPUSCROLL
    sta PPUSCROLL
    lda #%10000000
    sta PPUCTRL
    inc frames
    pla
irq:
    rti

.segment "RODATA"
palettes:
    .byte $21, $30, $10, $28    ; background 0: sky, cloud white, grey, sun yellow
    .byte $21, $07, $17, $2A    ; background 1: dark brown, brown, green (grass and ground)
    .byte $21, $06, $16, $27    ; background 2: bricks
    .byte $21, $12, $21, $31    ; background 3: water
    .byte $21, $2C, $10, $0F    ; sprites 0: robot (cyan eyes, grey body, black outline)
    .byte $21, $2C, $10, $0F
    .byte $21, $2C, $10, $0F
    .byte $21, $2C, $10, $0F

robot_parts:                    ; row offset, tile, attributes, column offset
    .byte 0, $08, $00, 0
    .byte 0, $09, $00, 8
    .byte 8, $0A, $00, 0
    .byte 8, $0B, $00, 8

.include "fondo.inc"

.segment "VECTORS"
    .word nmi, reset, irq

.segment "CHARS"
.include "chr.inc"              ; the rest of the 8 KB is filled with zeros by the linker (nes.cfg)
