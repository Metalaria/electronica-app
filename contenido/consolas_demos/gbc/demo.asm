; «Un fotograma» demo for the Game Boy Color (CGB only): 32 KB ROM without mapper. The same scene as the DMG demo
; (contenido/consolas_demos/gb/demo.asm), in colour: the tiles reach the VRAM through a general-purpose HDMA, every
; tile of the background gets a CGB palette through VRAM bank 1, and every 8 frames an HBlank HDMA started in the
; VBlank handler copies the next frame of the water animation over tile $07, 16 bytes in the first HBlank.
; Draws a fixed background (sky, clouds, sun, bricks, grass, ground, water) and a 16 x 16 robot made of four
; sprites that walks one pixel to the right every frame. The CPU sleeps in HALT; the VBlank interrupt copies the
; sprites to the OAM with OAM DMA (from a routine in HRAM, the only memory the CPU can read during the DMA) and the
; main loop moves the robot for the next frame.
; Build: rgbasm -I ../gb -o demo.o demo.asm && rgblink -n demo.sym -o demo.gbc demo.o && rgbfix -C -v -p 0xFF demo.gbc
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
DEF rVBK  EQU $FF4F                 ; VRAM bank (CGB)
DEF rHDMA1 EQU $FF51                ; HDMA source, high
DEF rHDMA2 EQU $FF52                ; HDMA source, low
DEF rHDMA3 EQU $FF53                ; HDMA destination, high
DEF rHDMA4 EQU $FF54                ; HDMA destination, low
DEF rHDMA5 EQU $FF55                ; HDMA length/mode/start
DEF rBCPS EQU $FF68                 ; background palette index
DEF rBCPD EQU $FF69                 ; background palette data
DEF rOCPS EQU $FF6A                 ; sprite palette index
DEF rOCPD EQU $FF6B                 ; sprite palette data

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

    ld a, HIGH(Tiles)               ; general-purpose HDMA: tiles from the ROM to VRAM $8000
    ldh [rHDMA1], a
    ld a, LOW(Tiles)
    ldh [rHDMA2], a
    xor a
    ldh [rHDMA3], a                 ; destination $8000 (the VRAM offset $0000)
    ldh [rHDMA4], a
    ld a, (TilesEnd - Tiles) / 16 - 1
    ldh [rHDMA5], a                 ; bit 7 = 0: copy everything now; the CPU waits until it is done

    ld a, $80                       ; palette index 0 with auto-increment
    ldh [rBCPS], a
    ld hl, BgPalettes
    ld b, BgPalettesEnd - BgPalettes
CopyBgPalettes:
    ld a, [hli]
    ldh [rBCPD], a
    dec b
    jr nz, CopyBgPalettes
    ld a, $80
    ldh [rOCPS], a
    ld hl, ObjPalettes
    ld b, ObjPalettesEnd - ObjPalettes
CopyObjPalettes:
    ld a, [hli]
    ldh [rOCPD], a
    dec b
    jr nz, CopyObjPalettes

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

    ld a, 1                         ; VRAM bank 1: the attributes (palette number) of every map entry
    ldh [rVBK], a
    ld hl, $9800
    ld de, BgAttr
    ld bc, BgAttrEnd - BgAttr
CopyAttr:
    ld a, [de]
    ld [hli], a
    inc de
    dec bc
    ld a, b
    or c
    jr nz, CopyAttr
    xor a
    ldh [rVBK], a                   ; back to bank 0

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
    and 7                           ; every 8 frames, the next water frame
    jr nz, .done
    ld a, [wFrames]
    and 8                           ; frame A or B
    ld hl, Tiles + 7 * 16           ; A: tile $07 as drawn
    jr z, .source
    ld hl, Tiles + 12 * 16          ; B: tile $0C, the second frame
.source:
    ld a, h
    ldh [rHDMA1], a                 ; HDMA source
    ld a, l
    ldh [rHDMA2], a
    xor a
    ldh [rHDMA3], a
    ld a, $70                       ; destination $8070: tile $07
    ldh [rHDMA4], a
    ld a, $80                       ; bit 7 = 1: one 16-byte block in the next HBlank
    ldh [rHDMA5], a
.done:
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

BgPalettes:                         ; RGB555, 4 colours per palette (as the NES demo's palettes)
    dw $7E8D, $7FFF, $5294, $1B9F   ; 0: sky, cloud, grey, sun
    dw $7E8D, $08CA, $1594, $1B08   ; 1: grass and ground
    dw $7E8D, $086C, $151A, $2A9F   ; 2: bricks
    dw $7E8D, $6944, $7E8D, $7F54   ; 3: water
BgPalettesEnd:
ObjPalettes:
    dw $0000, $7F84, $4A52, $0000   ; 0: robot (colour 0 is transparent)
ObjPalettesEnd:

INCLUDE "fondo.inc"

SECTION "Tiles", ROM0, ALIGN[4]     ; HDMA sources must be 16-byte aligned
Tiles:
INCLUDE "teselas.inc"
TilesEnd:

SECTION "Shadow OAM", WRAM0, ALIGN[8]
wShadowOAM: ds 160

SECTION "Variables", WRAM0
wRobotX: ds 1
wFrames: ds 1

SECTION "OAM DMA routine", HRAM
hOamDma: ds OamDmaRoutineEnd - OamDmaRoutine
