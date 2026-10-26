; «Un fotograma» demo for the Game Boy (DMG): 32 KB ROM without mapper.
; Draws a fixed background (sky, clouds, sun, bricks, grass, ground, water) and a 16 x 16 robot made of four
; sprites that walks one pixel to the right every frame. The CPU sleeps in HALT; the VBlank interrupt copies the
; sprites to the OAM with OAM DMA (from a routine in HRAM, the only memory the CPU can read during the DMA) and the
; main loop moves the robot for the next frame.
; Build: rgbasm -o demo.o demo.asm && rgblink -n demo.sym -o demo.gb demo.o && rgbfix -v -p 0xFF demo.gb
; (contenido/fotograma/generar.mjs does it). The Spanish explanation of each instruction is in explicaciones.es.txt.

DEF rIF   EQU $FF0F
DEF rLCDC EQU $FF40
DEF rSCY  EQU $FF42
DEF rSCX  EQU $FF43
DEF rLY   EQU $FF44
DEF rDMA  EQU $FF46
DEF rBGP  EQU $FF47
DEF rOBP0 EQU $FF48
DEF rIE   EQU $FFFF

DEF ROBOT_Y EQU 80 + 16            ; OAM Y = screen Y + 16: top at line 80, feet on the grass (line 96)

SECTION "VBlank vector", ROM0[$40]
VBlankVector:
    jp VBlankHandler

SECTION "Header", ROM0[$100]
EntryPoint:
    nop
    jp Start
    ds $150 - @, 0                  ; logo, title and checksums: filled in by rgbfix

SECTION "Main", ROM0[$150]
Start:
    di                              ; no interrupts while setting up
    ld sp, $FFFE                    ; stack at the top of HRAM
WaitVBlank:
    ldh a, [rLY]                    ; the LCD may only be switched off during VBlank
    cp 144
    jr c, WaitVBlank
    xor a
    ldh [rLCDC], a                  ; LCD off: the CPU has the VRAM to itself

    ld hl, $8000                    ; tiles to the start of the VRAM
    ld de, Tiles
    ld bc, TilesEnd - Tiles
CopyTiles:
    ld a, [de]
    ld [hli], a
    inc de
    dec bc
    ld a, b
    or c
    jr nz, CopyTiles

    ld hl, $9800                    ; background map: 32 x 32 tile numbers
    ld de, BgMap
    ld bc, BgMapEnd - BgMap
CopyMap:
    ld a, [de]
    ld [hli], a
    inc de
    dec bc
    ld a, b
    or c
    jr nz, CopyMap

    ld hl, wShadowOAM               ; all sprites off screen (Y = 0)
    ld b, 160
    xor a
ClearOam:
    ld [hli], a
    dec b
    jr nz, ClearOam

    ld hl, hOamDma                  ; the DMA routine must run from HRAM
    ld de, OamDmaRoutine
    ld b, OamDmaRoutineEnd - OamDmaRoutine
CopyDma:
    ld a, [de]
    ld [hli], a
    inc de
    dec b
    jr nz, CopyDma

    ld a, 40
    ld [wRobotX], a
    xor a
    ld [wFrames], a                 ; WRAM starts with random values: clear the frame counter
    call PlaceRobot

    ld a, %11100100                 ; shades 3, 2, 1, 0 for colours 3, 2, 1, 0
    ldh [rBGP], a
    ldh [rOBP0], a
    xor a
    ldh [rSCX], a
    ldh [rSCY], a
    ldh [rIF], a                    ; forget interrupts requested while setting up
    ld a, 1
    ldh [rIE], a                    ; only the VBlank interrupt
    ld a, %10010011                 ; LCD on, tiles at $8000, map at $9800, sprites on, background on
    ldh [rLCDC], a
    ei

MainLoop:
    halt                            ; sleep until the VBlank interrupt
    ld hl, wRobotX
    inc [hl]                        ; one pixel to the right
    call PlaceRobot
    jr MainLoop

; Writes the robot's four sprites (Y, X, tile, attributes) into the OAM copy in WRAM.
PlaceRobot:
    ld hl, wShadowOAM
    ld de, RobotParts
    ld b, 4
.part:
    ld a, [de]                      ; row offset
    add ROBOT_Y
    ld [hli], a
    inc de
    ld a, [de]                      ; column offset
    ld c, a
    ld a, [wRobotX]
    add c
    add 8                           ; OAM X = screen X + 8
    ld [hli], a
    inc de
    ld a, [de]                      ; tile
    ld [hli], a
    inc de
    ld a, [de]                      ; attributes
    ld [hli], a
    inc de
    dec b
    jr nz, .part
    ret

VBlankHandler:
    push af
    call hOamDma                    ; copy the 160 bytes of wShadowOAM to the OAM
    ld a, [wFrames]
    inc a
    ld [wFrames], a
    pop af
    reti

; Copied to HRAM. Starts the OAM DMA and waits the 160 machine cycles it takes.
OamDmaRoutine:
    ld a, HIGH(wShadowOAM)
    ldh [rDMA], a
    ld a, 40
.wait:
    dec a                           ; 4 machine cycles per turn: 40 turns = 160 cycles
    jr nz, .wait
    ret
OamDmaRoutineEnd:

RobotParts:                         ; row offset, column offset, tile, attributes
    db 0, 0, $08, 0
    db 0, 8, $09, 0
    db 8, 0, $0A, 0
    db 8, 8, $0B, 0

Tiles:
INCLUDE "teselas.inc"
TilesEnd:

INCLUDE "fondo.inc"

SECTION "Shadow OAM", WRAM0, ALIGN[8]
wShadowOAM: ds 160

SECTION "Variables", WRAM0
wRobotX: ds 1
wFrames: ds 1

SECTION "OAM DMA routine", HRAM
hOamDma: ds OamDmaRoutineEnd - OamDmaRoutine
