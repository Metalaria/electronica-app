"""The FM7303 V3.0r7 schematic, complete, as drawn by the app (contenido/fm7303.py).

Every part, value and connection follows the kit's original schematic reproduced in the book (figure 15.26,
`foto_fm7303_esquema.png`), read together with the book's simplified schematic (figure 15.25), the text of
chapter 15 (cap16.typ) and appendix E (IC pins). Where the original is ambiguous, the book's text decides
(e.g. the AFC filter order R5-C15-R4-C14 of section 15.8.3). Layout: the eight functional blocks of
figure 15.9, signal from left to right in the top row (front-end, IF), audio from left to right in the
bottom row (stereo decoder, de-emphasis, power amplifier), supplies on the right.
"""

from fm7303_dibujo import (Esquema, R, C, CV, L, D, SW, PUENTE, MEDIDOR, ALTAVOZ, POT, CONMUTADOR, CAJA_CI,
                           NPN, TRAFO_FI, FILTRO_CER, BLOQUE3, GND, RAIL, ANTENA)

# Block colours of figure 15.9 (morado, naranja, rojo, verde, azul, dorado, gris, turquesa).
BLOQUES = {
    1: {'nombre': 'Front-end de RF, oscilador y sintonía', 'color': '#6C3483', 'seccion': 'sec-16.8.1'},
    2: {'nombre': 'Amplificación de FI y detección', 'color': '#CA6F1E', 'seccion': 'sec-16.8.2'},
    3: {'nombre': 'Control automático de frecuencia (AFC)', 'color': '#B03A2E', 'seccion': 'sec-16.8.3'},
    4: {'nombre': 'Decodificador estéreo y desénfasis', 'color': '#1E8449', 'seccion': 'sec-16.8.4'},
    5: {'nombre': 'Amplificador de audio TEA2025', 'color': '#2E6EA6', 'seccion': 'sec-16.8.5'},
    6: {'nombre': 'Alimentación y reguladores', 'color': '#B7950B', 'seccion': 'sec-16.8.6'},
    7: {'nombre': 'Display digital de frecuencia', 'color': '#707B7C', 'seccion': 'sec-16.8.7'},
    8: {'nombre': 'Medidor de señal', 'color': '#148F77', 'seccion': 'sec-16.8.8'},
}

ANCHO = 1800
ALTO = 820

# Areas of the blocks on the sheet [x0, y0, x1, y1] (faint backgrounds, zoom targets).
CAJAS = {
    1: [6, 18, 626, 336],
    7: [24, 340, 340, 448],
    2: [626, 18, 1470, 300],
    8: [1158, 226, 1214, 300],
    3: [690, 300, 1062, 456],
    6: [1474, 18, 1796, 700],
    4: [6, 480, 958, 808],
    5: [958, 480, 1470, 808],
}


def v(x, y0, y1):
    return (x, y0), (x, y1)


def h(y, x0, x1):
    return (x0, y), (x1, y)


def construir():
    e = Esquema()
    A = e.add
    w = e.w
    t = e.texto

    def lab(p, texto, dx, dy, ancla='start', tam=8):
        """Designator and value next to a part (two lines when `texto` has «\n»)."""
        x, y = p.anclas['center']
        for k, linea in enumerate(texto.split('\n')):
            t(x + dx, y + dy + k * 9, linea, tam if k == 0 else tam - 0.5, ancla, peso=600 if k == 0 else 400)

    # ================================================================ block 1: front-end
    ic1 = A(CAJA_CI('IC1', 'X', 'IC', 170, 40, 360, 40,
                    [('p1', 'rfin', '1'), ('p2', 'ic1_2', '2'), ('p3', 'rf', '3'), ('p4', 'mixin', '4'),
                     ('p5', '0', '5'), ('p6', 'mixout', '6'), ('p7', 'nc_ic1_7', '7'), ('p8', 'osc8', '8'),
                     ('p9', 'v59', '9')],
                    'IC1  TA7358AP', 'front-end: amp. RF, oscilador local y mezclador', paso=40), 1)
    ant = A(ANTENA('ANT', (28, 125), 'ant'), 1)
    bpf = A(BLOQUE3('BPF', 'X', 'BandPass', 55, 112, 60, 26, 'BPF', '87108',
                    {'in': (45, 125), 'out': (125, 125), 'gnd': (85, 150)},
                    {'in': 'ant', 'out': 'rfin', 'gnd': '0'}), 1)
    w('ant', ant.p('start'), bpf.p('in'))
    A(GND('G1', bpf.p('gnd')), 1)
    w('rfin', bpf.p('out'), (190, 125), ic1.p('p1'))
    c1 = A(C('C1', *v(230, 100, 132), 1e-9, '1000 pF', ('ic1_2', '0')), 1)
    w('ic1_2', ic1.p('p2'), c1.p('start'))
    A(GND('G2', c1.p('end')), 1)
    lab(c1, 'C1\n1000', 8, -2)
    # RF tank (L1 + C4A, trimmer C4A', C3) on pin 3, C2 to the mixer input (pin 4)
    w('rf', ic1.p('p3'), (270, 180), (70, 180))
    c2 = A(C('C2', *h(130, 270, 310), 4.7e-12, '4,7 pF', ('rf', 'mixin')), 1)
    w('mixin', ic1.p('p4'), c2.p('end'))
    lab(c2, 'C2 4,7', 0, -12, 'middle')
    c3 = A(C('C3', *v(70, 180, 220), 22e-12, '22 pF', ('rf', '0')), 1)
    c4ap = A(CV('C4A\'', *v(115, 180, 220), 10e-12, 'trimmer 10 pF', ('rf', '0'), trim=True), 1)
    c4a = A(CV('C4A', *v(160, 180, 220), 20e-12, '20 pF (variable)', ('rf', '0')), 1)
    l1 = A(L('L1', *v(215, 180, 220), 0.058e-6, '0,058 µH', ('rf', 'l1b')), 1)
    w('0', c3.p('end'), c4a.p('end'))
    A(GND('G3', (115, 220)), 1)
    lab(c3, 'C3 22', 0, -27, 'middle')
    lab(c4ap, "C4A' 10", 0, -27, 'middle')
    lab(c4a, 'C4A 20', 4, -27, 'middle')
    lab(l1, 'L1\n0,058 µH', 10, -2)
    w('l1b', l1.p('end'), (215, 270), (300, 270))
    c5 = A(C('C5', *v(250, 270, 302), 0.01e-6, '0,01 µF', ('l1b', '0')), 1)
    A(GND('G4', c5.p('end')), 1)
    lab(c5, 'C5\n0,01µ', 9, 0)
    r1 = A(R('R1', *h(270, 300, 340), 30, '30 Ω', ('l1b', 'v59')), 1)
    lab(r1, 'R1 30', 0, -9, 'middle')
    # 5.9 V node of the front-end: R1, BG1 collector, R2, C10
    w('v59', r1.p('end'), (560, 270))
    A(RAIL('V1', (560, 270), 'v59', '5,9 V', 'derecha'), 6)
    c10 = A(C('C10', *v(520, 270, 302), 0.01e-6, '0,01 µF', ('v59', '0')), 1)
    A(GND('G5', c10.p('end')), 1)
    lab(c10, 'C10\n0,01µ', 9, 0)
    # pin 6 (mixer output) towards B1; pin 9 supply; pin 5 ground
    w('mixout', ic1.p('p6'), (390, 112), (680, 112))
    A(RAIL('V2', ic1.p('p9'), 'v59', '5,9 V', 'abajo'), 6)
    A(GND('G6', ic1.p('p5')), 1)
    # oscillator tank on pin 8 through C8: C6 (to the buffer), C7, C4B', C4B, L2; C9 to the varicap D1
    c8 = A(C('C8', *v(470, 128, 160), 15e-12, '15 pF', ('osc8', 'osc')), 1)
    w('osc8', ic1.p('p8'), c8.p('start'))
    lab(c8, 'C8 15', 9, 2)
    w('osc', c8.p('end'), (470, 190))
    w('osc', (370, 190), (580, 190))
    c6 = A(C('C6', *v(370, 190, 222), 2e-12, '2 pF (2,2)', ('osc', 'bgb')), 1)
    c7 = A(C('C7', *v(415, 190, 230), 22e-12, '22 pF', ('osc', '0')), 1)
    c4bp = A(CV('C4B\'', *v(460, 190, 230), 10e-12, 'trimmer 10 pF', ('osc', '0'), trim=True), 1)
    c4b = A(CV('C4B', *v(505, 190, 230), 20e-12, '20 pF (variable)', ('osc', '0')), 1)
    l2 = A(L('L2', *v(550, 190, 230), 0.042e-6, '0,042 µH', ('osc', '0')), 1)
    w('0', c7.p('end'), l2.p('end'))
    A(GND('G7', (460, 230)), 1)
    lab(c6, 'C6\n2', -9, 0, 'end')
    lab(c7, 'C7 22', 0, 41, 'middle')
    lab(c4bp, "C4B' 10", 0, 41, 'middle')
    lab(c4b, 'C4B 20', 0, 41, 'middle')
    lab(l2, 'L2\n0,042 µH', 10, -2)
    c9 = A(C('C9', *h(190, 580, 616), 10e-12, '10 pF', ('osc', 'var')), 1)
    lab(c9, 'C9 10', 0, -11, 'middle')
    d1 = A(D('D1', *v(616, 236, 190), 'FV1043 (varicap)', ('0', 'var'), tipo='VAR'), 1)
    A(GND('G8', d1.p('start')), 1)
    lab(d1, 'D1\nFV1043', 10, 2)
    # buffer BG1 (9018): base from C6 and R2, emitter to R3 and the display's FM input
    bg1 = A(NPN('BG1', (400, 350), ('bgb', 'v59', 'bge'), '9018'), 1)
    w('bgb', c6.p('end'), (370, 350), bg1.p('base'))
    r2 = A(R('R2', *v(392, 270, 310), 220e3, '220 kΩ', ('v59', 'bgb')), 1)
    w('bgb', r2.p('end'), (392, 350))
    w('v59', bg1.p('collector'), (424, 270))
    lab(r2, 'R2\n220k', -8, -2, 'end')
    lab(bg1, 'BG1\n9018', 16, -4)
    w('bge', bg1.p('emitter'), (424, 400))
    r3 = A(R('R3', *v(424, 400, 440), 330, '330 Ω', ('bge', '0')), 1)
    A(GND('G9', r3.p('end')), 1)
    lab(r3, 'R3\n330', 8, 0)
    t(470, 352, 'buffer del', 7, 'start', color='#5d6d7e', cursiva=True)
    t(470, 361, 'oscilador', 7, 'start', color='#5d6d7e', cursiva=True)

    # ================================================================ block 2: IF chain and detector
    b1 = A(TRAFO_FI('B1', 680, 112, ('mixout', 'v59', 'b1s', '0'), 'transformador de FI'), 2)
    d2 = A(D('D2', *v(632, 152, 112), '1N60P (germanio)', ('v59', 'mixout')), 2)
    c13 = A(C('C13', *v(656, 112, 152), 75e-12, '75 pF', ('mixout', 'v59')), 2)
    w('v59', d2.p('start'), b1.p('p3'))
    A(RAIL('V3', (632, 152), 'v59', '5,9 V', 'abajo'), 6)
    A(GND('G10', b1.p('p4')), 2)
    lab(b1, 'B1\n3 µH', 0, -38, 'middle')
    lab(d2, 'D2\n1N60P', -8, -20, 'end')
    lab(c13, 'C13', 7, -26)
    t(663, 95, '75', 7.5)
    r6 = A(R('R6', *h(112, 714, 752), 300, '300 Ω', ('b1s', 'cf1in')), 2)
    lab(r6, 'R6 300', 0, -9, 'middle')
    cf1 = A(FILTRO_CER('CF1', 762, 112, ('cf1in', 'ic2in', '0'), '10,7 MHz'), 2)
    w('cf1in', r6.p('end'), cf1.p('p1'))
    A(GND('G11', cf1.p('p2')), 2)
    lab(cf1, 'CF1 10,7M', 0, -26, 'middle')

    ic2 = A(CAJA_CI('IC2', 'X', 'IC', 832, 40, 224, 40,
                    [('p1', 'ic2_1', '1'), ('p2', 'ic2_2', '2'), ('p3', 'ic2out', '3'), ('p4', '0', '4'),
                     ('p5', 'ic2_5', '5'), ('p6', 'ic2in', '6'), ('p7', 'ic2_7', '7')],
                    'IC2  TA7061BP', 'amplificador de FI', paso=32), 2)
    # input from CF1 to pin 6, under the box; R9 (330 Ω) terminates CF1 from the bias pin 7 (C23)
    w('ic2in', cf1.p('p3'), (812, 112), (812, 168), (1008, 168), ic2.p('p6'))
    r9 = A(R('R9', *v(1040, 100, 140), 330, '330 Ω', ('ic2_7', 'ic2in')), 2)
    w('ic2_7', ic2.p('p7'), r9.p('start'))
    w('ic2in', r9.p('end'), (1040, 168), (1008, 168))
    c23 = A(C('C23', *h(100, 1040, 1072), 0.01e-6, '0,01 µF', ('ic2_7', '0')), 2)
    A(GND('G12', c23.p('end')), 2)
    lab(r9, 'R9\n330', 8, -2)
    lab(c23, 'C23', 0, -12, 'middle')
    c20 = A(C('C20', *v(848, 96, 126), 0.01e-6, '0,01 µF', ('ic2_1', '0')), 2)
    c21 = A(C('C21', *v(880, 96, 126), 0.01e-6, '0,01 µF', ('ic2_2', '0')), 2)
    w('ic2_1', ic2.p('p1'), c20.p('start'))
    w('ic2_2', ic2.p('p2'), c21.p('start'))
    A(GND('G13', c20.p('end')), 2)
    A(GND('G14', c21.p('end')), 2)
    lab(c20, 'C20', -9, 6, 'end')
    lab(c21, 'C21', 9, 6)
    A(GND('G15', ic2.p('p4')), 2)
    c22 = A(C('C22', *v(976, 100, 132), 0.01e-6, '0,01 µF', ('ic2_5', '0')), 2)
    w('ic2_5', ic2.p('p5'), c22.p('start'))
    A(GND('G16', c22.p('end')), 2)
    lab(c22, 'C22', -8, 6, 'end')
    r8 = A(R('R8', *v(992, 96, 136), 220, '220 Ω', ('ic2_5', 'v12')), 2)
    w('ic2_5', (976, 96), (992, 96))
    A(RAIL('V4', r8.p('end'), 'v12', '12 V', 'abajo'), 6)
    lab(r8, 'R8', 7, -12)
    # output (pin 3) down to R7 (load to 12 V) and CF2
    w('ic2out', ic2.p('p3'), (912, 232))
    r7 = A(R('R7', *h(232, 872, 912), 330, '330 Ω', ('v12', 'ic2out')), 2)
    A(RAIL('V5', r7.p('start'), 'v12', '12 V', 'izq'), 6)
    lab(r7, 'R7 330', 0, 13, 'middle')
    w('ic2out', (912, 210), (930, 210))
    cf2 = A(FILTRO_CER('CF2', 930, 210, ('ic2out', 'if2', '0'), '10,7 MHz'), 2)
    A(GND('G17', cf2.p('p2')), 2)
    lab(cf2, 'CF2 10,7M', 0, -26, 'middle')

    ic3 = A(CAJA_CI('IC3', 'X', 'IC', 1100, 40, 306, 40,
                    [('p1', 'if2', '1'), ('p2', 'ic3_2', '2'), ('p3', 'sm', '3'), ('p4', 'mute', '4'),
                     ('p5', '0', '5'), ('p6', 'b2a', '6'), ('p7', 'b2b', '7'), ('p8', 'det', '8'),
                     ('p9', 'ic3_9', '9')],
                    'IC3  TA7303P', 'FI, limitador, detector, medidor y mute', paso=34), 2)
    w('if2', cf2.p('p3'), (1117, 210), ic3.p('p1'))
    e.tp('TP2', 'if2', (1040, 210), 'TP2')
    r10 = A(R('R10', *h(140, 1117, 1151), 330, '330 Ω', ('if2', 'ic3_2')), 2)
    w('ic3_2', ic3.p('p2'), (1151, 160))
    c24 = A(C('C24', *v(1151, 160, 192), 0.01e-6, '0,01 µF', ('ic3_2', '0')), 2)
    A(GND('G18', c24.p('end')), 2)
    lab(r10, 'R10 330', 0, -9, 'middle')
    lab(c24, 'C24', 9, 6)
    # pin 3: signal-strength output -> C25, the meter, R11 + W2 (mute threshold)
    w('sm', ic3.p('p3'), (1185, 110), (1185, 238))
    w('sm', (1185, 106), (1201, 106))
    c25 = A(C('C25', *v(1201, 106, 138), 10e-6, '10 µF', ('sm', '0'), pol=True), 2)
    A(GND('G19', c25.p('end')), 2)
    lab(c25, 'C25', -4, -26, 'middle')
    # pin 4: mute input with C26, and K2 from the wiper of W2
    w('mute', ic3.p('p4'), (1219, 132))
    c26 = A(C('C26', *v(1219, 132, 164), 0.01e-6, '0,01 µF', ('mute', '0')), 2)
    A(GND('G20', c26.p('end')), 2)
    lab(c26, 'C26', 9, 6)
    A(GND('G21', ic3.p('p5')), 2)
    # B2 (discriminator coil) with C27 across it and C28 from pin 7 to ground
    b2 = A(L('B2', *v(1287, 120, 164), 7.6e-6, '7,6 µH', ('b2a', 'b2b'), nucleo=True), 2)
    w('b2a', ic3.p('p6'), (1287, 100), (1287, 120))
    w('b2a', (1287, 100), (1318, 100), (1318, 124))
    c27 = A(C('C27', *v(1318, 124, 160), 24e-12, '24 pF', ('b2a', 'b2b')), 2)
    w('b2b', b2.p('end'), (1287, 176), (1321, 176))
    w('b2b', c27.p('end'), (1318, 176))
    w('b2b', ic3.p('p7'), (1321, 100), (1340, 100), (1340, 176), (1321, 176))
    c28 = A(C('C28', *v(1300, 176, 208), 10e-12, '10 pF', ('b2b', '0')), 2)
    A(GND('G22', c28.p('end')), 2)
    lab(b2, 'B2\n7,6 µH', -12, 0, 'end')
    lab(c27, 'C27\n24', 7, -18)
    lab(c28, 'C28 10', 8, 6)
    # pin 8: detector output (TP3), C29
    w('det', ic3.p('p8'), (1355, 250))
    c29 = A(C('C29', *h(118, 1355, 1385), 220e-12, '220 pF', ('det', '0')), 2)
    A(GND('G23', c29.p('end')), 2)
    lab(c29, 'C29 220', 0, -11, 'middle')
    e.tp('TP3', 'det', (1355, 205), 'TP3')
    # pin 9: supply through R12 (75 Ω) with C30, C31
    w('ic3_9', ic3.p('p9'), (1389, 100), (1420, 100))
    r12 = A(R('R12', *v(1420, 64, 100), 75, '75 Ω', ('v12', 'ic3_9')), 2)
    A(RAIL('V6', r12.p('start'), 'v12', '12 V', 'arriba'), 6)
    c30 = A(C('C30', *h(100, 1420, 1450), 0.01e-6, '0,01 µF', ('ic3_9', '0')), 2)
    A(GND('G24', c30.p('end')), 2)
    c31 = A(C('C31', *v(1420, 100, 136), 100e-6, '100 µF', ('ic3_9', '0'), pol=True), 2)
    A(GND('G25', c31.p('end')), 2)
    lab(r12, 'R12', -8, 10, 'end')
    lab(c30, 'C30', 0, -11, 'middle')
    lab(c31, 'C31\n100µ', 8, 6)

    # ================================================================ block 8: signal meter (and W2/K2 of the mute)
    me = A(MEDIDOR('M1', *v(1185, 238, 282), 'medidor de aguja «5V Meter»', ('sm', '0')), 8)
    A(GND('G26', me.p('end')), 8)
    lab(me, 'S-meter\n5 V', -16, 0, 'end')
    r11 = A(R('R11', *h(224, 1185, 1225), 2e3, '2 kΩ', ('sm', 'w2a')), 2)
    lab(r11, 'R11 2k', 0, -9, 'middle')
    w2 = A(POT('W2', *v(1235, 236, 276), 1, 10e3, '10 kΩ (sensibilidad del mute)', ('w2a', '0', 'w2t')), 2)
    w('w2a', r11.p('end'), (1235, 224), w2.p('start'))
    A(GND('G27', w2.p('end')), 2)
    lab(w2, 'W2 10k', 0, 34, 'middle')
    k2 = A(SW('K2', *v(1251, 210, 172), 'Mute (on/off)', ('w2t', 'mute')), 2)
    w('w2t', w2.p('tap'), (1251, 256), (1251, 210))
    w('mute', k2.p('end'), (1251, 132), (1219, 132))
    lab(k2, 'K2', 9, -4)

    # ================================================================ block 3: AFC
    # K1: common to R5; ON = detector (TP3), OFF = wiper of W1 (TP1)
    k1 = A(CONMUTADOR('K1', (900, 330), (930, 316), (930, 344), 'AFC (on/off)', ('k1c', 'det', 'tp1')), 3)
    t(915, 304, 'ON', 7, 'middle', color='#5d6d7e')
    t(944, 354, 'OFF', 7, 'start', color='#5d6d7e')
    lab(k1, 'K1 (AFC)', -36, 3, 'end')
    w('det', (1355, 250), (1355, 316), k1.p('a'))
    w1 = A(POT('W1', *v(1000, 390, 430), -1, 20e3, '20 kΩ (polarización del varicap sin AFC)', ('v6', '0', 'tp1')), 3)
    A(RAIL('V7', w1.p('start'), 'v6', '6 V', 'arriba'), 6)
    A(GND('G28', w1.p('end')), 3)
    w('tp1', k1.p('b'), (970, 344), (970, 410), w1.p('tap'))
    e.tp('TP1', 'tp1', (970, 380), 'TP1')
    lab(w1, 'W1\n20k', 10, 0)
    r5 = A(R('R5', *h(330, 830, 870), 470e3, '470 kΩ', ('afc', 'k1c')), 3)
    w('k1c', r5.p('end'), k1.p('com'))
    c15 = A(C('C15', *v(810, 330, 366), 0.47e-6, '0,47 µF', ('afc', '0'), pol=True), 3)
    A(GND('G29', c15.p('end')), 3)
    r4 = A(R('R4', *h(330, 740, 780), 100e3, '100 kΩ', ('var', 'afc')), 3)
    w('afc', r4.p('end'), r5.p('start'))
    c14 = A(C('C14', *v(712, 330, 362), 0.01e-6, '0,01 µF', ('var', '0')), 3)
    A(GND('G30', c14.p('end')), 3)
    w('var', d1.p('end'), (640, 190), (640, 330), r4.p('start'))
    lab(r5, 'R5 470k', 0, -9, 'middle')
    lab(r4, 'R4 100k', 0, -9, 'middle')
    lab(c15, 'C15\n0,47µ', 9, 4)
    lab(c14, 'C14\n0,01µ', 9, 4)

    # Det Out continues along the middle of the sheet to the stereo decoder (R14, C35)
    w('det', (1355, 316), (1355, 470), (30, 470), (30, 590))

    # ================================================================ block 7: display
    disp = A(BLOQUE3('SC3610D', 'X', 'Display', 40, 350, 260, 60, 'SC3610D (FDMR 3610D)',
                     'frecuencímetro: cuenta el oscilador local y resta 10,7 MHz',
                     {'amfm': (60, 420), 'range': (90, 420), 'amin': (120, 420), 'gnd': (170, 420),
                      'vcc': (220, 420), 'fmin': (270, 420)},
                     {'amfm': '0', 'range': '0', 'amin': '0', 'gnd': '0', 'vcc': 'v31', 'fmin': 'bge'}), 7)
    for k, (pin, nombre) in enumerate((('amfm', 'AM/FM'), ('range', 'Range'), ('amin', 'AM In'), ('gnd', 'GND'),
                                       ('vcc', 'Vcc+'), ('fmin', 'FM In'))):
        x, y = disp.p(pin)
        t(x, 406, nombre, 6.5, 'middle', color='#5d6d7e')
        if pin in ('amfm', 'range', 'amin', 'gnd'):
            A(GND(f'G{50 + k}', (x, y)), 7)
    A(RAIL('V13', disp.p('vcc'), 'v31', '3,1 V', 'abajo'), 6)
    w('bge', (424, 380), (330, 380), (330, 440), (270, 440), disp.p('fmin'))

    # ================================================================ block 6: supplies
    cz1 = A(BLOQUE3('CZ1', 'V', 'DCJack', 1690, 40, 52, 34, 'CZ1', '12 V CC', {'pos': (1716, 84), 'neg': (1752, 57)},
                    {'pos': 'vin', 'neg': '0'}), 6)
    cz1.polaridad = {'positivo': 'pos', 'negativo': 'neg'}
    A(GND('G31', cz1.p('neg')), 6)
    k4 = A(SW('K4', *v(1716, 96, 136), 'interruptor del volumen (Power)', ('vin', 'v12')), 6)
    w('vin', cz1.p('pos'), k4.p('start'))
    lab(k4, 'K4\nPower', 10, 0)
    w('v12', k4.p('end'), (1716, 160), (1780, 160))
    w('v12', (1716, 160), (1520, 160))
    A(RAIL('V8', (1520, 160), 'v12', '12 V', 'izq'), 6)
    c61 = A(C('C61', *v(1748, 160, 192), 0.047e-6, '0,047 µF', ('v12', '0')), 6)
    c62 = A(C('C62', *v(1780, 160, 196), 1000e-6, '1000 µF', ('v12', '0'), pol=True), 6)
    A(GND('G32', c61.p('end')), 6)
    A(GND('G33', c62.p('end')), 6)
    lab(c61, 'C61', -8, 4, 'end')
    lab(c62, 'C62', 9, -14)
    # power LED
    r15 = A(R('R15', *v(1680, 160, 200), 3.3e3, '3,3 kΩ', ('v12', 'd5a')), 6)
    d5 = A(D('D5', *v(1680, 206, 240), 'LED verde (encendido)', ('d5a', '0'), tipo='LED'), 6)
    w('d5a', r15.p('end'), d5.p('start'))
    A(GND('G34', d5.p('end')), 6)
    lab(r15, 'R15\n3,3k', -8, 0, 'end')
    lab(d5, 'D5', -12, 8, 'end')
    # 78L06
    ic7 = A(BLOQUE3('IC7', 'X', 'Regulator', 1592, 270, 56, 28, '78L06', 'IC7',
                    {'in': (1620, 260), 'out': (1582, 284), 'gnd': (1620, 308)},
                    {'in': 'v12', 'out': 'v6', 'gnd': '0'}), 6)
    w('v12', (1620, 160), ic7.p('in'))
    c18 = A(C('C18', *h(236, 1620, 1652), 0.01e-6, '0,01 µF', ('v12', '0')), 6)
    A(GND('G35', c18.p('end')), 6)
    lab(c18, 'C18', 0, -11, 'middle')
    A(GND('G36', ic7.p('gnd')), 6)
    w('v6', ic7.p('out'), (1500, 284))
    A(RAIL('V9', (1500, 284), 'v6', '6 V', 'izq'), 6)
    c16 = A(C('C16', *v(1568, 284, 320), 100e-6, '100 µF', ('v6', '0'), pol=True), 6)
    c17 = A(C('C17', *v(1546, 284, 316), 0.01e-6, '0,01 µF', ('v6', '0')), 6)
    A(GND('G37', c16.p('end')), 6)
    A(GND('G38', c17.p('end')), 6)
    lab(c16, 'C16', 0, -28, 'middle')
    lab(c17, 'C17', 0, -26, 'middle')
    # L3 to the 5.9 V rail (front-end and AMS1117), C11 and C12
    l3 = A(L('L3', *v(1520, 284, 344), 100e-6, '100 µH', ('v6', 'v59')), 6)
    w('v59', l3.p('end'), (1520, 360))
    w('v59', (1500, 360), (1660, 360))
    A(RAIL('V10', (1500, 360), 'v59', '5,9 V', 'izq'), 6)
    c11 = A(C('C11', *v(1566, 360, 392), 0.01e-6, '0,01 µF', ('v59', '0')), 6)
    c12 = A(C('C12', *v(1596, 360, 396), 100e-6, '100 µF', ('v59', '0'), pol=True), 6)
    A(GND('G39', c11.p('end')), 6)
    A(GND('G40', c12.p('end')), 6)
    lab(l3, 'L3', -9, -4, 'end')
    t(1511, 330, '100 µH', 7.5, 'end')
    lab(c11, 'C11', -8, 4, 'end')
    lab(c12, 'C12\n100µ', 9, 4)
    # AMS1117-3.3 from the 5.9 V rail, D3 to the display (3.1 V)
    ic6 = A(BLOQUE3('IC6', 'X', 'Regulator', 1625, 420, 70, 28, 'AMS1117-3.3', 'IC6 (cara inferior)',
                    {'in': (1660, 410), 'out': (1660, 458), 'gnd': (1705, 434)},
                    {'in': 'v59', 'out': 'v33', 'gnd': '0'}), 6)
    w('v59', (1660, 360), ic6.p('in'))
    A(GND('G41', ic6.p('gnd')), 6)
    d3 = A(D('D3', *v(1660, 470, 510), '1N60P (germanio)', ('v33', 'v31')), 6)
    w('v33', ic6.p('out'), d3.p('start'))
    lab(d3, 'D3\n1N60P', -10, 0, 'end')
    c32 = A(C('C32', *v(1710, 520, 552), 0.01e-6, '0,01 µF', ('v31', '0')), 6)
    w('v31', d3.p('end'), (1660, 520), (1740, 520))
    A(RAIL('V14', (1740, 520), 'v31', '3,1 V', 'derecha'), 6)
    A(GND('G42', c32.p('end')), 6)
    lab(c32, 'C32', 9, 4)
    # 8 V rail of the stereo decoder: R13 from 12 V with C33, C34
    A(RAIL('V12', (1560, 590), 'v12', '12 V', 'arriba'), 6)
    r13 = A(R('R13', *v(1560, 590, 630), 220, '220 Ω', ('v12', 'v8')), 6)
    w('v8', r13.p('end'), (1560, 650), (1520, 650))
    A(RAIL('V11', (1520, 650), 'v8', '8 V', 'izq'), 6)
    c33 = A(C('C33', *v(1600, 650, 682), 0.01e-6, '0,01 µF', ('v8', '0')), 6)
    c34 = A(C('C34', *v(1635, 650, 686), 100e-6, '100 µF', ('v8', '0'), pol=True), 6)
    w('v8', (1560, 650), (1635, 650))
    A(GND('G43', c33.p('end')), 6)
    A(GND('G44', c34.p('end')), 6)
    lab(r13, 'R13\n220', 8, 0)
    lab(c33, 'C33', -8, 4, 'end')
    lab(c34, 'C34\n100µ', 9, 4)

    # ================================================================ block 4: stereo decoder and de-emphasis
    ic4 = A(CAJA_CI('IC4', 'X', 'IC', 130, 520, 486, 40,
                    [('p1', 'mpx', '1'), ('p2', 'lpf', '2'), ('p3', 'v8', '3'), ('p4', 'vco', '4'),
                     ('p5', '0', '5'), ('p6', 'st', '6'), ('p7', 'pil', '7'), ('p8', 'outr', '8'),
                     ('p9', 'outl', '9')],
                    'IC4  TA7343AP', 'decodificador estéreo por PLL (VCO de 38 kHz)', paso=54), 4)
    X = {k: ic4.p(f'p{k}')[0] for k in range(1, 10)}
    r14 = A(R('R14', *h(590, 30, 70), 220, '220 Ω', ('det', 'r14')), 4)
    c35 = A(C('C35', *h(590, 80, 116), 4.7e-6, '4,7 µF', ('r14', 'mpx'), pol=True), 4)
    w('r14', r14.p('end'), c35.p('start'))
    w('mpx', c35.p('end'), (X[1], 590), ic4.p('p1'))
    lab(r14, 'R14 220', 0, 13, 'middle')
    lab(c35, 'C35 4,7µ', 0, 16, 'middle')
    # 8 V bus under the IC (pin 3 is the supply)
    w('v8', (190, 700), (505, 700))
    A(RAIL('V15', (190, 700), 'v8', '8 V', 'izq'), 6)
    w('v8', ic4.p('p3'), (X[3], 700))
    # pin 2: loop filter R16-C36 and C37
    w('lpf', ic4.p('p2'), (X[2], 580), (X[2] + 25, 580))
    r16 = A(R('R16', *v(X[2], 580, 620), 1e3, '1 kΩ', ('lpf', 'lpf2')), 4)
    c36 = A(C('C36', *v(X[2], 670, 630), 3.3e-6, '3,3 µF', ('v8', 'lpf2'), pol=True), 4)
    w('lpf2', r16.p('end'), c36.p('end'))
    w('v8', c36.p('start'), (X[2], 700))
    c37 = A(C('C37', *v(X[2] + 25, 580, 620), 1e-6, '1 µF', ('lpf', 'v8')), 4)
    w('v8', c37.p('end'), (X[2] + 25, 700))
    lab(r16, 'R16\n1k', -8, 0, 'end')
    lab(c36, 'C36\n3,3µ', -9, 2, 'end')
    lab(c37, 'C37\n1µ', 8, 2)
    # VCO: C38 (polyester, 1000 pF) between pins 3 and 4; R17 + W3 from pin 4 to the 8 V bus
    c38 = A(C('C38', *h(600, X[3], X[4]), 1000e-12, '1000 pF (poliéster)', ('v8', 'vco')), 4)
    lab(c38, 'C38 1000 poli.', 0, -12, 'middle', tam=7.5)
    w('vco', ic4.p('p4'), (X[4], 615))
    r17 = A(R('R17', *v(X[4], 615, 655), 9.1e3, '9,1 kΩ', ('vco', 'w3a')), 4)
    w3 = A(POT('W3', *v(X[4], 660, 700), 1, 5e3, '5 kΩ (ajuste del VCO)', ('w3a', 'v8', 'v8')), 4)
    w('w3a', r17.p('end'), w3.p('start'))
    w('v8', w3.p('tap'), (X[4] + 16, 700))
    lab(r17, 'R17\n9,1k', -8, 0, 'end')
    lab(w3, 'W3\n5k', -8, 14, 'end')
    A(GND('G60', ic4.p('p5')), 4)
    # pin 6: stereo LED (R18 + D4 from the 8 V bus) and the «Monitor» bridge to TP4 (R19)
    w('st', ic4.p('p6'), (X[6], 600))
    r18 = A(R('R18', *v(X[6], 600, 640), 560, '560 Ω', ('st', 'd4k')), 4)
    d4 = A(D('D4', *v(X[6], 690, 650), 'LED rojo (estéreo)', ('v8', 'd4k'), tipo='LED'), 4)
    w('d4k', r18.p('end'), d4.p('end'))
    w('v8', d4.p('start'), (X[6], 700))
    w('st', (X[6], 585), (X[6] - 15, 585))
    mon = A(PUENTE('MON', *h(585, X[6] - 15, X[6] - 35), 'puente «Monitor» (cara inferior)', ('st', 'tp4')), 4)
    r19 = A(R('R19', *v(X[6] - 35, 600, 640), 330e3, '330 kΩ', ('tp4', '0')), 4)
    w('tp4', mon.p('end'), r19.p('start'))
    A(GND('G61', r19.p('end')), 4)
    e.tp('TP4', 'tp4', (X[6] - 35, 585), 'TP4')
    lab(r18, 'R18\n560', 8, -4)
    lab(d4, 'D4', 10, 4)
    lab(r19, 'R19\n330k', -8, 2, 'end')
    lab(mon, 'Monitor', 0, -9, 'middle', tam=7)
    # pin 7: pilot filter C39 and R20 to the bus; K3 (mono) shorts it to the bus and stops the VCO
    w('pil', ic4.p('p7'), (X[7], 620))
    w('pil', (X[7], 610), (X[7] - 26, 610), (X[7] - 26, 620))
    w('pil', (X[7], 610), (X[7] + 24, 610), (X[7] + 24, 620))
    k3 = A(SW('K3', *v(X[7] - 26, 620, 660), 'estéreo/mono (para el VCO)', ('pil', 'v8')), 4)
    c39 = A(C('C39', *v(X[7], 620, 656), 1e-6, '1 µF', ('pil', 'v8')), 4)
    r20 = A(R('R20', *v(X[7] + 24, 620, 660), 220e3, '220 kΩ', ('pil', 'v8')), 4)
    w('v8', k3.p('end'), (X[7] - 26, 700))
    w('v8', c39.p('end'), (X[7], 700))
    w('v8', r20.p('end'), (X[7] + 24, 700))
    lab(k3, 'K3', -9, 14, 'end')
    lab(c39, 'C39', 0, 46, 'middle')
    lab(r20, 'R20', 8, -4)
    # outputs: pin 9 (channel L, upper) and pin 8 (channel R, lower)
    w('outl', ic4.p('p9'), (X[9], 585), (625, 585))
    r22 = A(R('R22', *v(604, 585, 625), 3.3e3, '3,3 kΩ', ('outl', '0')), 4)
    A(GND('G62', r22.p('end')), 4)
    lab(r22, 'R22', -7, 2, 'end')
    w('outr', ic4.p('p8'), (X[8], 660), (620, 660))
    r21 = A(R('R21', *v(X[8], 660, 700), 3.3e3, '3,3 kΩ', ('outr', '0')), 4)
    A(GND('G63', r21.p('end')), 4)
    lab(r21, 'R21', 8, 2)

    def desenfasis(y, out, n, cc, cg, ll, cp, cg2, ra, cg3, rb, j):
        """One channel of the de-emphasis and output filter (section 15.8.4), from x = 620 to the jack."""
        nd = n
        cin = A(C(cc, *h(y, 625 if y == 585 else 620, 661), 4.7e-6, '4,7 µF', (out, f'{nd}1'), pol=True), 4)
        w(f'{nd}1', cin.p('end'), (690, y))
        c1_ = A(C(cg, *v(675, y, y + 32), 4700e-12, '4700 pF', (f'{nd}1', '0')), 4)
        A(GND(f'G{cg}', c1_.p('end')), 4)
        l_ = A(L(ll, *h(y, 690, 740), 40e-3, '40 mH', (f'{nd}1', f'{nd}2')), 4)
        w(f'{nd}1', (682, y), (682, y - 22), (690, y - 22))
        cpar = A(C(cp, *h(y - 22, 690, 740), 1000e-12, '1000 pF', (f'{nd}1', f'{nd}2')), 4)
        w(f'{nd}2', cpar.p('end'), (748, y - 22), (748, y))
        w(f'{nd}2', l_.p('end'), (770, y))
        c2_ = A(C(cg2, *v(760, y, y + 32), 6800e-12, '6800 pF', (f'{nd}2', '0')), 4)
        A(GND(f'G{cg2}', c2_.p('end')), 4)
        r_a = A(R(ra, *h(y, 770, 810), 2.2e3, '2,2 kΩ', (f'{nd}2', f'{nd}3')), 4)
        w(f'{nd}3', r_a.p('end'), (840, y))
        c3_ = A(C(cg3, *v(825, y, y + 32), 6800e-12, '6800 pF', (f'{nd}3', '0')), 4)
        A(GND(f'G{cg3}', c3_.p('end')), 4)
        r_b = A(R(rb, *h(y, 840, 880), 2.2e3, '2,2 kΩ', (f'{nd}3', j)), 4)
        lab(cin, f'{cc} 4,7µ', 0, -14, 'middle')
        lab(c1_, cg, -7, 30, 'middle')
        lab(l_, f'{ll} 40 mH', 0, 12, 'middle')
        lab(cpar, f'{cp} 1000', 0, -11, 'middle')
        lab(c2_, cg2, 0, 30, 'middle')
        lab(r_a, f'{ra} 2,2k', 0, -9, 'middle')
        lab(c3_, cg3, 0, 30, 'middle')
        lab(r_b, f'{rb} 2,2k', 0, -9, 'middle')
        return r_b
    desenfasis(585, 'outl', 'dl', 'C40', 'C42', 'L4', 'C43', 'C44', 'R23', 'C45', 'R24', 'jl')
    desenfasis(660, 'outr', 'dr', 'C41', 'C46', 'L5', 'C47', 'C48', 'R25', 'C49', 'R26', 'jr')
    cz3 = A(BLOQUE3('CZ3', 'X', 'Jack', 892, 605, 40, 36, 'CZ3', 'jack 3,5',
                    {'l': (912, 595), 'r': (912, 651), 'g': (942, 623)}, {'l': 'jl', 'r': 'jr', 'g': '0'}), 4)
    A(GND('G64', cz3.p('g')), 4)
    w('jl', (880, 585), (930, 585))
    w('jl', (912, 585), cz3.p('l'))
    w('jr', (880, 660), (930, 660))
    w('jr', (912, 660), cz3.p('r'))

    # ================================================================ block 5: volume and TEA2025
    r27 = A(R('R27', *h(585, 930, 970), 47e3, '47 kΩ', ('jl', 'w4la')), 5)
    r28 = A(R('R28', *h(660, 930, 970), 47e3, '47 kΩ', ('jr', 'w4ra')), 5)
    lab(r27, 'R27 47k', 0, -9, 'middle')
    lab(r28, 'R28 47k', 0, 13, 'middle')
    w4l = A(POT('W4-1', *v(1040, 540, 580), 1, 20e3, 'A5k–20k (volumen, canal L)', ('w4la', '0', 'w4lt')), 5)
    w4r = A(POT('W4-2', *v(1040, 700, 740), 1, 20e3, 'A5k–20k (volumen, canal R)', ('w4ra', '0', 'w4rt')), 5)
    w('w4la', r27.p('end'), (990, 585), (990, 540), w4l.p('start'))
    w('w4ra', r28.p('end'), (990, 660), (990, 700), w4r.p('start'))
    A(GND('G65', w4l.p('end')), 5)
    A(GND('G66', w4r.p('end')), 5)
    lab(w4l, 'W4-1', -10, -2, 'end')
    lab(w4r, 'W4-2', -10, -2, 'end')
    T = [(f'p{16 - i}', 'arriba', 18 + 36 * i) for i in range(8)]
    B = [(f'p{i + 1}', 'abajo', 18 + 36 * i) for i in range(8)]
    redes5 = {'p1': 'nc_ic5_1', 'p2': 'o1', 'p3': 'bs1', 'p4': '0', 'p5': '0', 'p6': 'fb1', 'p7': 'in1', 'p8': 'svr',
              'p9': '0', 'p10': 'in2', 'p11': 'fb2', 'p12': '0', 'p13': '0', 'p14': 'bs2', 'p15': 'o2', 'p16': 'v12'}
    ic5 = A(CAJA_CI('IC5', 'X', 'IC', 1100, 620, 288, 60,
                    [(n, redes5[n], n[1:], ld, off) for n, ld, off in T + B],
                    'IC5  TEA2025', 'amplificador de audio estéreo (DIP-16)', lado=None), 5)
    P = {k: ic5.p(f'p{k}') for k in range(1, 17)}
    w('v12', P[16], (P[16][0], 600), (1100, 600))
    A(RAIL('V16', (1100, 600), 'v12', '12 V', 'izq'), 6)
    # channel L: C50 to pin 10, output pin 15 with C51, bootstrap C52 (to pin 14), C53 to the speaker
    w('w4lt', w4l.p('tap'), (1056, 530), (1066, 530))
    c50 = A(C('C50', *h(530, 1066, 1100), 0.22e-6, '0,22 µF', ('w4lt', 'in2')), 5)
    w('in2', c50.p('end'), (P[10][0], 530), P[10])
    lab(c50, 'C50 0,22µ', 0, -11, 'middle')
    w('o2', P[15], (P[15][0], 545), (1240, 545))
    c51 = A(C('C51', *v(1128, 560, 590), 0.15e-6, '0,15 µF', ('o2', '0')), 5)
    w('o2', (P[15][0], 560), (1128, 560))
    A(GND('G67', c51.p('end')), 5)
    lab(c51, 'C51', -6, 4, 'end')
    c52 = A(C('C52', *h(590, P[15][0], P[14][0]), 100e-6, '100 µF', ('o2', 'bs2'), pol=True), 5)
    w('bs2', P[14], c52.p('end'))
    lab(c52, 'C52', 0, -11, 'middle')
    c53 = A(C('C53', *h(545, 1240, 1280), 1000e-6, '1000 µF', ('o2', 'spl'), pol=True), 5)
    lab(c53, 'C53 1000µ', 0, -12, 'middle')
    w('0', P[13], (P[13][0], 600), (P[12][0], 600), P[12])
    A(GND('G68', ((P[13][0] + P[12][0]) / 2, 600)), 5)
    c54 = A(C('C54', *v(P[11][0], 600, 568), 100e-6, '100 µF', ('fb2', '0'), pol=True), 5)
    w('fb2', P[11], c54.p('start'))
    w('0', c54.p('end'), (P[11][0] + 18, 568))
    A(GND('G69', (P[11][0] + 18, 568)), 5)
    lab(c54, 'C54', -7, 0, 'end')
    w('0', P[9], (P[9][0], 596), (P[9][0] + 20, 596))
    A(GND('G70', (P[9][0] + 20, 596)), 5)
    # channel R: C55 to pin 7, output pin 2 with C56, bootstrap C57 (to pin 3), C58 to the speaker
    w('w4rt', w4r.p('tap'), (1056, 770), (1066, 770))
    c55 = A(C('C55', *h(770, 1066, 1100), 0.22e-6, '0,22 µF', ('w4rt', 'in1')), 5)
    w('in1', c55.p('end'), (P[7][0], 770), P[7])
    lab(c55, 'C55 0,22µ', 0, 13, 'middle')
    w('o1', P[2], (P[2][0], 740), (1240, 740))
    c56 = A(C('C56', *h(725, P[2][0], 1126), 0.15e-6, '0,15 µF', ('o1', '0')), 5)
    A(GND('G71', c56.p('end')), 5)
    lab(c56, 'C56', 0, -11, 'middle')
    c57 = A(C('C57', *h(708, P[2][0], P[3][0]), 100e-6, '100 µF', ('o1', 'bs1'), pol=True), 5)
    w('bs1', P[3], c57.p('end'))
    lab(c57, 'C57', 0, 14, 'middle')
    c58 = A(C('C58', *h(740, 1240, 1280), 1000e-6, '1000 µF', ('o1', 'spr'), pol=True), 5)
    lab(c58, 'C58 1000µ', 0, 14, 'middle')
    w('0', P[4], (P[4][0], 700), (P[5][0], 700), P[5])
    A(GND('G72', ((P[4][0] + P[5][0]) / 2, 700)), 5)
    c59 = A(C('C59', *v(P[6][0], 700, 732), 100e-6, '100 µF', ('fb1', '0'), pol=True), 5)
    w('fb1', P[6], c59.p('start'))
    A(GND('G73', c59.p('end')), 5)
    lab(c59, 'C59', -7, 4, 'end')
    c60 = A(C('C60', *v(P[8][0], 700, 732), 100e-6, '100 µF', ('svr', '0'), pol=True), 5)
    w('svr', P[8], c60.p('start'))
    A(GND('G74', c60.p('end')), 5)
    lab(c60, 'C60', 8, 4)
    # speakers on CZ2
    spl = A(ALTAVOZ('CZ2-L', *v(1440, 545, 590), 'altavoz izquierdo (4 u 8 Ω)', ('spl', '0')), 5)
    spr = A(ALTAVOZ('CZ2-R', *v(1440, 740, 785), 'altavoz derecho (4 u 8 Ω)', ('spr', '0')), 5)
    w('spl', c53.p('end'), spl.p('start'))
    w('spr', c58.p('end'), spr.p('start'))
    A(GND('G75', spl.p('end')), 5)
    A(GND('G76', spr.p('end')), 5)
    t(1458, 570, 'CZ2', 8, 'start', peso=600)
    t(1458, 579, 'altavoz L', 7.5)
    t(1458, 765, 'CZ2', 8, 'start', peso=600)
    t(1458, 774, 'altavoz R', 7.5)

    return e, {'ancho': ANCHO, 'alto': ALTO}
