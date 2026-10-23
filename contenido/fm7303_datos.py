"""Book data of the «Kit FM7303» view: every value the app shows as «del libro», with the section or figure it
comes from and a quote that the build checks against /home/claude/v3/libro/cap16.typ; the function of every
component; the voltage map; the test points; the signal path; the alignment procedure; the faults.

Quotes are short literal extracts of the chapter (Typst markup removed). Values that only the kit's original
schematic gives (figure 15.26, a photo) or a book figure (15.28 voltage map and coil table, 15.16 FNIRSI
traces) cite the figure; those are checked only for the existence of the label.
"""

import json
import os
import re

# ------------------------------------------------------------------ citations
# id -> (label, quote). The quote must appear in that section of cap16.typ (or label is a figure).
CITAS = {
    'alim_9_12': ('sec-16.15.4', 'la alimentación debe estar entre 9 y 12 V. Con menos de 9 V cae la sensibilidad'),
    'nunca_conmutada': ('sec-16.15.4', 'NUNCA uses una fuente conmutada'),
    'railes': ('sec-16.11.2', '12 V en la entrada (tras K4), unos 8 V en el decodificador TA7343AP (tras R13), 6 V a la salida del 78L06 (5,9 V en la patilla 9 del TA7358AP, tras L3) y 3,3 V a la salida del AMS1117 (unos 3,1 V en el display tras D3; el display debería encenderse)'),
    'ausente': ('sec-16.11.2', 'Una tensión ausente localiza de inmediato el problema'),
    'doce_fi': ('sec-16.8.6', 'Los 12 V sin regular alimentan la cadena de FI (el TA7061BP y el TA7303P'),
    'r12': ('sec-16.8.6', 'a través de R12, de 75 Ω, con su propio desacoplo'),
    'r13': ('sec-16.8.6', 'El decodificador TA7343AP trabaja a unos 8 V, que obtiene de los 12 V con la caída en R13 y el filtro C33-C34'),
    'doce_audio': ('sec-16.8.5', 'El amplificador trabaja directamente con los 12 V de alimentación, sin regular'),
    'ta7358_max': ('sec-16.8.6', 'el TA7358AP admite como máximo 8 V, y su hoja de datos lo especifica para funcionar entre 1,6 y 6 V'),
    'tolerancia': ('sec-16.21', 'Alimentaciones: ±5 %'),
    'tolerancia_pol': ('sec-16.21', 'Tensiones de polarización: ±10 % suele bastar'),
    'desviacion': ('sec-16.21', 'una desviación pequeña no significa nada; una del 50 % señala la zona'),
    'reposo_audio': ('sec-16.21', 'La salida de audio en reposo, que debe estar a media alimentación o a cero según la topología'),
    'mapa_fig': ('fig-16.28', 'Mapa de tensiones del FM7303: «TEA2025: ≈ 6 V (media alimentación)», «IC1 5,9 V · IC4 8 V», «IC2, IC3, IC5 12 V», y datos de las bobinas L1 0,058 µH, L2 0,042 µH'),
    'esquema_orig': ('fig-16.26', 'Esquema original del fabricante (V3.0r7): todos los valores de los componentes'),
    'tp_tabla_1': ('sec-16.9', '4,6 V de continua (con K1 pulsado y W1 ajustado), igual que TP3'),
    'tp_tabla_2': ('sec-16.9', 'Señal de 10,7 MHz al sintonizar una emisora (sonda ×10)'),
    'tp_tabla_3': ('sec-16.9', '4,6 V de continua con la señal MPX (audio y piloto de 19 kHz) superpuesta'),
    'tp_tabla_4': ('sec-16.9', 'Onda de 38 kHz del VCO (con el puente «Monitor» cerrado y K3 en la posición estéreo)'),
    'tp2_sonda': ('sec-16.9', 'TP2 es de alta frecuencia (10,7 MHz) y alta impedancia: hay que usar sonda ×10'),
    'tp2_pista': ('sec-16.9', 'se mide en la pista que va de CF2 a la entrada del TA7303P'),
    'tp1_multi': ('sec-16.9', 'TP1 es una tensión continua y basta el multímetro'),
    'tp3_reposo': ('sec-16.8.2', 'en reposo está a unos 4,6 V de continua'),
    'tp3_pin8': ('sec-16.8.2', 'El punto de prueba TP3, en el pin 8 del TA7303'),
    'fi': ('sec-16.3.1', 'diferencia que el circuito mantiene siempre en 10,7 MHz'),
    'banda_bpf': ('sec-16.3.1', 'BPF 87108, de 87 a 108 MHz'),
    'l1_datos': ('sec-16.3.1', 'L1 = «D5, L6.5, T3.5, Φ0.6» significa 5 mm de diámetro, 6,5 mm de longitud, 3,5 espiras y 0,6 mm de hilo'),
    'espiras': ('sec-16.3.1', 'las bobinas de aire L1 (RF, 3,5 espiras) y L2 (oscilador, 2,5 espiras)'),
    'ol': ('sec-16.19', 'El oscilador local, entre 98,7 y 118,7 MHz'),
    'cf_ancho': ('sec-16.8.2', 'tienen un ancho de banda de unos 280 kHz a 3 dB'),
    'b1_b2': ('sec-16.7', 'B1 (primario 11 espiras, 3 µH) se afina para máxima señal; B2 (18 espiras, 7,6 µH) determina la calidad de sonido'),
    'b1_c13': ('sec-16.22', 'resuena con C13, de 75 pF, cerca de 10,7 MHz'),
    'medidor_5v': ('sec-16.8.8', 'Esa tensión no supera los 5 V (de ahí el nombre del terminal) y, en la práctica, con emisoras fuertes apenas pasa de 4 V'),
    'medidor_maximo': ('sec-16.8.8', 'en todos esos ajustes se busca, precisamente, el máximo del medidor'),
    'pico_antena': ('sec-16.11.3', 'si el pico no se aprecia, baja la antena o usa una emisora más floja'),
    'consumo': ('sec-16.11.1', 'del orden de un centenar de miliamperios como mucho: solo el TEA2025 se lleva unos 35 mA en reposo'),
    'tea_35': ('sec-16.5', 'a lo que se suma la corriente de reposo, de unos 35 mA'),
    'salida_1000': ('sec-16.5', 'En el FM7303 son de 1000 µF (C53 y C58): 20 Hz con altavoces de 8 Ω y 40 Hz con los de 4 Ω'),
    'c61_c62': ('sec-16.8.5', 'el desacoplo de su alimentación (C61 de 0,047 µF y C62 de 1000 µF)'),
    'vco_c38': ('sec-16.8.4', 'El condensador de poliéster C38 (1000 pF), con la resistencia R17 y W3, fija la frecuencia libre del VCO'),
    'lazo': ('sec-16.8.4', 'el filtro del lazo es otro, la red R16-C36-C37 de la patilla 2'),
    'trampa': ('sec-16.8.4', 'la bobina L4 con C43 (1000 pF) forma una trampa en unos 25 kHz y el conjunto atenúa unos 27 dB los restos del piloto de 19 kHz y más de 30 dB los de 38 kHz'),
    'desenfasis_50': ('sec-16.8.4', 'de constante de tiempo normalizada (50 µs en Europa, 75 µs en América)'),
    'k3': ('sec-16.4', 'El interruptor K3 (St/Mon) detiene el VCO: en posición ON fuerza el modo mono, y en OFF permite el estéreo'),
    'led_estereo': ('sec-16.4', 'Un LED indicador estéreo se enciende cuando el PLL se engancha al piloto'),
    'mpx': ('sec-16.4', 'Un tono piloto de 19 kHz avisa de que la emisión es estéreo y sirve de referencia precisa'),
    'afc_filtro': ('sec-16.8.3', 'a través de K1 y del filtro R5-C15-R4-C14, al varicap del oscilador; el filtro, con una constante de tiempo de unas décimas de segundo, deja pasar la continua y quita el audio'),
    'afc_k1': ('sec-16.8.3', 'K1 es un conmutador: en ON lleva al varicap la tensión del detector, y en OFF la del cursor del potenciómetro W1 (conectado entre los 6 V y masa)'),
    'afc_w1': ('sec-16.8.3', 'si W1 está mal ajustado, al pulsar K1 la emisora se desplaza en lugar de fijarse'),
    'afc_pegajoso': ('sec-16.8.3', 'hace que ocupe un tramo más ancho del dial y que el paso de una emisora a otra sea más lento y «pegajoso»'),
    'buffer': ('sec-16.8.1', 'aísla el oscilador local del resto del circuito (en especial del contador de frecuencia del display)'),
    'display_cuenta': ('sec-16.8.7', 'cuenta la frecuencia del oscilador local (que toma a través del buffer 9018 del bloque 1) y, restando internamente los 10,7 MHz'),
    'display_ayuda': ('sec-16.8.7', 'si fallara, la radio seguiría funcionando'),
    'tracking_regla': ('sec-16.11.4', 'en el extremo bajo de la banda se ajusta la bobina; en el extremo alto, el condensador de presintonía'),
    'q_entrada': ('sec-16.18', 'la bobina cambia la frecuencia en la misma proporción en toda la banda, mientras que el trimmer solo pesa cuando su capacidad es comparable a la total'),
    'sintonia_lc': ('sec-16.18', 'la frecuencia va con 1/√C'),
    'paso_1': ('sec-16.11.3', 'gira la presintonía de RF C4A\' hasta que el medidor de aguja indique el máximo'),
    'paso_2': ('sec-16.11.3', 'Gira el núcleo del transformador de FI B1 hasta el máximo en el medidor'),
    'paso_3': ('sec-16.11.3', 'gira el núcleo de la bobina de discriminador B2 hasta que TP3 marque 4,6 V'),
    'paso_4': ('sec-16.11.4', 'gira el variable al extremo de frecuencia alta y ajusta la presintonía del oscilador C4B\' hasta acercarte a 108 MHz'),
    'paso_5': ('sec-16.11.4', 'separa o junta las espiras de la bobina del oscilador L2 hasta acercarte a 88 MHz. Ambos ajustes se influyen: repite varias veces'),
    'paso_6': ('sec-16.11.4', 'elige una emisora de frecuencia baja y ajusta la bobina de RF L1 (separando espiras) para máxima señal en el medidor; luego una emisora de frecuencia alta y ajusta la presintonía de RF C4A\' para el máximo'),
    'paso_7': ('sec-16.11.5', 'Pulsa K1 para activar el AFC. Con el Brymen BM869s mide el punto TP1 y gira el potenciómetro W1 hasta que marque 4,6 V'),
    'paso_8': ('sec-16.11.6', 'Gira el potenciómetro W3 hasta que la frecuencia sea exactamente 38 kHz. Después, vuelve a abrir el punto «Monitor»'),
    'paso_8b': ('sec-16.11.6', 'Haz la medida sin una emisora estéreo sintonizada'),
    'paso_9': ('sec-16.11.7', 'Pulsa K2 (Mute) y, en una frecuencia sin emisora (donde se oye el siseo característico de la FM), ajusta el potenciómetro W2 hasta que ese ruido baje de forma satisfactoria'),
    'paso_9b': ('sec-16.11.7', 'demasiada sensibilidad de silenciado «elimina» también emisoras débiles e incluso reduce el volumen de las fuertes'),
    'preparacion': ('sec-16.11', 'deja K1 (AFC) y K2 (Mute) sin pulsar (apagados), conecta el medidor de aguja al terminal 5V Meter, inserta el display, y alimenta con 9-12 V (centro positivo)'),
    'frio': ('sec-16.11.1', 'verifica que NO hay cortocircuito entre +12 V y masa'),
    'tabla_nada': ('sec-16.12', 'Nada, ni display'),
    'tabla_display_si': ('sec-16.12', 'Display sí, sin sonido'),
    'tabla_ruido': ('sec-16.12', 'Ruido de fondo y nada más'),
    'tabla_sensibilidad': ('sec-16.12', 'Poca sensibilidad'),
    'tabla_no_cambia': ('sec-16.12', 'Oscilador local: condensador variable, L2 o TA7358AP'),
    'antena_ausente': ('sec-16.12', 'Antena mal conectada'),
    'bobina_fuera': ('sec-16.12', 'Bobina ajustada fuera de su punto'),
    'inyectar': ('sec-16.12', 'Si suena, toda la cadena de audio está bien y el problema está antes'),
    'pinzas': ('sec-16.11.8', 'Si la cadena de FI, detección y audio está viva, oirás un siseo claro o restos de emisoras por el altavoz'),
    'un_canal': ('sec-16.5', 'Un canal sí y otro no'),
    'deformar': ('sec-16.18', 'Deformar una bobina al manipular la placa'),
    'ej_l3': ('sec-16.23', 'la bobina de filtro L3 (100 µH) abierta o mal soldada'),
    'ej_w1': ('sec-16.23', 'Si está desviado, lo corrijo girando el potenciómetro W1 hasta llevar TP1 a 4,6 V'),
    'ej_w3': ('sec-16.23', 'Con el FNIRSI en TP4 se retoca W3 hasta medir exactamente 38 kHz'),
    'display_osc': ('sec-16.23', 'el display cuenta el oscilador local, así que si muestra una cifra que cambia al girar el dial, el oscilador funciona'),
    'fnirsi_fft': ('sec-16.11.8', 'Verás un pico claro en 19 kHz (el piloto) y, con una emisora estéreo, energía entre 23 y 53 kHz'),
    'rizado': ('sec-16.11.8', 'con el osciloscopio en acoplamiento AC y escala sensible (20 mV/div) sobre el rail de 12 V, comprueba que el rizado es de pocos milivoltios'),
    'prm': ('sec-16.11.6', 'usa la medida automática de frecuencia (botón PRM)'),
    'fig_fnirsi': ('fig-16.16', 'Lo que verás en el FNIRSI: el audio de salida, la señal MPX con el piloto superpuesto, la FFT mostrando el pico del piloto de 19 kHz, y el rizado de la alimentación en acoplo AC'),
    'fig_tracking': ('fig-16.23', 'El seguimiento entre oscilador local y sintonía, y el orden de ajuste del front-end'),
    'ruido_entre': ('sec-16.2', 'entre emisoras se oye más ruido que con una emisora sintonizada'),
    'estereo_debil': ('sec-16.4', 'las emisoras débiles dan mal estéreo, con mucho ruido y el indicador parpadeando'),
    'superhet': ('sec-16.3.1', 'un mezclador que combina ambas'),
    'detector': ('sec-16.3.2', 'contiene además el detector de FM, que convierte la variación de frecuencia de la portadora de nuevo en señal de audio'),
    'matriz': ('sec-16.4', 'separa los canales: (L+R) + (L−R) = 2L da el izquierdo, y (L+R) − (L−R) = 2R da el derecho'),
    'tea_potencia': ('sec-16.8.5', 'capaz de entregar unos 2 W por canal sobre 8 Ω con 12 V'),
    'limitador': ('sec-16.8.2', 'toda esta amplificación se hace siempre a la misma frecuencia (10,7 MHz, sin importar qué emisora oigas)'),
}


def _normalizar(t):
    t = re.sub(r'#(strong|emph|sub|super)\[', '', t)
    t = re.sub(r'#nr\("([^"]+)"\)', r'\1', t)
    t = t.replace('\\.', '.').replace("\\'", "'").replace('\\~', '~').replace('\\', '')
    t = t.replace(']', '').replace('[', '')
    return re.sub(r'\s+', ' ', t)


def secciones(texto):
    """label -> normalized text of that section (up to the next heading of the same or higher level)."""
    lineas = texto.split('\n')
    res = {}
    cab = []
    for i, l in enumerate(lineas):
        m = re.match(r'^(=+)\s.*<((?:sec|prob)-[^>]+)>\s*$', l)
        if m:
            cab.append((i, len(m.group(1)), m.group(2)))
    for k, (i, nivel, label) in enumerate(cab):
        fin = len(lineas)
        for j in range(i + 1, len(lineas)):
            mm = re.match(r'^(=+)\s', lineas[j])
            if mm and len(mm.group(1)) <= nivel:
                fin = j
                break
        res[label] = _normalizar('\n'.join(lineas[i:fin]))
    return res


def verificar_citas(cap16, refs):
    secs = secciones(open(cap16, encoding='utf-8').read())
    errores = []
    for cid, (label, texto) in CITAS.items():
        if label not in refs:
            errores.append(f'cita {cid}: la etiqueta {label} no existe en refs.json')
            continue
        if label.startswith('fig-'):
            continue
        sec = secs.get(label)
        if sec is None:
            errores.append(f'cita {cid}: no encuentro la sección {label} en cap16.typ')
        elif _normalizar(texto) not in sec:
            errores.append(f'cita {cid}: «{texto[:70]}…» no está en {label}')
    return errores


# ------------------------------------------------------------------ components
# ref -> (function, book label, animation id or None)
A_R, A_POT, A_CC, A_CE, A_CP, A_CV, A_L, A_T, A_D, A_PN, A_LED, A_Q, A_X = (
    'resistencia-ohm', 'potenciometro', 'condensador-ceramico', 'condensador-electrolitico', 'condensador-pelicula',
    'condensador-placas', 'bobina-lenz', 'transformador', 'diodo-polarizacion', 'union-pn', 'led', 'bjt-portadores', 'cristal')

COMPONENTES = {
    'ANT': ('Antena telescópica: capta la señal de radio, de unos pocos microvoltios.', 'sec-16.8.1', None),
    'BPF': ('Filtro paso banda de entrada «87108»: deja pasar la banda de FM (87 a 108 MHz) y rechaza el resto.', 'sec-16.3.1', None),
    'IC1': ('TA7358AP, el front-end: amplificador de RF, oscilador local y mezclador en un chip SIP-9. Entrega la FI de 10,7 MHz por la patilla 6. Alimentado a 5,9 V por la patilla 9.', 'sec-16.3.1', None),
    'C1': ('Desacoplo de la patilla 2 de IC1, parte de la entrada del amplificador de RF.', 'sec-16.8.1', A_CC),
    'C2': ('Acopla el tanque de RF (patilla 3) con la entrada del mezclador (patilla 4).', 'sec-16.8.1', A_CC),
    'C3': ('Capacidad fija del circuito sintonizado de RF, en paralelo con C4A y su presintonía.', 'sec-16.18', A_CC),
    'C4A': ('Sección de RF del condensador variable de sintonía (CBM223F): mueve el circuito de entrada a la vez que el oscilador.', 'sec-16.3.1', A_CV),
    "C4A'": ('Presintonía (trimmer) de RF: en el extremo alto de la banda se ajusta para máximo del medidor (seguimiento).', 'sec-16.11.4', A_CV),
    'L1': ('Bobina de aire de RF: 3,5 espiras, Ø 5 mm, 6,5 mm de largo, hilo de 0,6 mm (0,058 µH). Se ajusta separando o juntando espiras, en el extremo bajo.', 'sec-16.3.1', A_L),
    'C5': ('Desacoplo del extremo frío de L1, por donde R1 alimenta el amplificador de RF.', 'sec-16.8.1', A_CC),
    'R1': ('Alimenta el amplificador de RF de IC1 (patilla 3) a través de L1, desde los 5,9 V.', 'sec-16.8.1', A_R),
    'C10': ('Desacoplo del nudo de 5,9 V junto al buffer BG1.', 'sec-16.8.1', A_CC),
    'C8': ('Acopla el oscilador de IC1 (patilla 8) a su circuito tanque.', 'sec-16.8.1', A_CC),
    'C6': ('Toma una muestra del oscilador local para la base del buffer BG1.', 'sec-16.8.1', A_CC),
    'C7': ('Capacidad fija del tanque del oscilador (L2 + C4B).', 'sec-16.18', A_CC),
    'C4B': ('Sección del oscilador del condensador variable: fija, con L2, la frecuencia del oscilador local.', 'sec-16.8.1', A_CV),
    "C4B'": ('Presintonía (trimmer) del oscilador: con el variable al extremo alto se ajusta hasta que el display marque cerca de 108 MHz.', 'sec-16.11.4', A_CV),
    'L2': ('Bobina de aire del oscilador: 2,5 espiras, Ø 5 mm, 5 mm de largo (0,042 µH). En el extremo bajo se separan o juntan sus espiras hasta 88 MHz.', 'sec-16.11.4', A_L),
    'C9': ('Acopla el varicap D1 al tanque del oscilador: la capacidad del varicap retoca la frecuencia.', 'sec-16.3.3', A_CC),
    'D1': ('Varicap FV1043 del AFC: su capacidad depende de la tensión inversa (TP3 con K1 en ON, TP1 con K1 en OFF) y corrige la frecuencia del oscilador.', 'sec-16.8.3', A_PN),
    'BG1': ('Transistor 9018 en colector común: buffer del oscilador hacia el display, para que el contador no cargue ni desvíe el oscilador.', 'sec-16.8.1', A_Q),
    'R2': ('Polarización de base de BG1, desde su colector.', 'sec-16.8.1', A_R),
    'R3': ('Resistencia de emisor de BG1; del emisor sale la señal del oscilador hacia la entrada FM In del display.', 'sec-16.8.1', A_R),
    'B1': ('Transformador de FI: primario de 11 espiras (3 µH) que resuena con C13 cerca de 10,7 MHz; secundario de 1 espira hacia CF1. Su núcleo se ajusta para máximo del medidor.', 'sec-16.11.3', A_T),
    'D2': ('Diodo de germanio 1N60P en paralelo con el primario de B1.', 'sec-16.10.2', A_D),
    'C13': ('Resuena con el primario de B1 (3 µH) cerca de 10,7 MHz.', 'sec-16.22', A_CC),
    'R6': ('Resistencia en serie entre el secundario de B1 y la entrada del filtro cerámico CF1.', 'sec-16.8.2', A_R),
    'CF1': ('Filtro cerámico de 10,7 MHz (unos 280 kHz de ancho): da la selectividad. Su patilla 1 es la entrada.', 'sec-16.8.2', A_X),
    'CF2': ('Segundo filtro cerámico de 10,7 MHz, entre IC2 e IC3. Su patilla 1 es la entrada; montado al revés degrada la recepción.', 'sec-16.10.5', A_X),
    'IC2': ('TA7061BP: primer amplificador de FI (SIP de 7 patillas), entre CF1 y CF2, alimentado con los 12 V.', 'sec-16.3.2', None),
    'R9': ('Lleva la polarización de la patilla 7 a la entrada de IC2 (patilla 6) y carga la salida de CF1.', 'sec-16.8.2', A_R),
    'C23': ('Desacoplo de la patilla 7 de IC2.', 'sec-16.8.2', A_CC),
    'C20': ('Desacoplo de la patilla 1 de IC2.', 'sec-16.8.2', A_CC),
    'C21': ('Desacoplo de la patilla 2 de IC2.', 'sec-16.8.2', A_CC),
    'C22': ('Desacoplo de la alimentación de IC2 (patilla 5), con R8.', 'sec-16.8.2', A_CC),
    'R8': ('Alimenta IC2 desde los 12 V; con C22 filtra su alimentación.', 'sec-16.8.6', A_R),
    'R7': ('Carga de la salida de IC2 (patilla 3) desde los 12 V; entrega la FI amplificada a CF2.', 'sec-16.8.2', A_R),
    'IC3': ('TA7303P: amplificador-limitador de FI, detector de FM (con B2), salida del medidor de señal (patilla 3) y mute (patilla 4). La patilla 8 es la salida del detector, TP3.', 'sec-16.3.2', None),
    'R10': ('Lleva la polarización de la patilla 2 a la entrada de IC3 (patilla 1, TP2) y carga la salida de CF2.', 'sec-16.8.2', A_R),
    'C24': ('Desacoplo de la polarización de entrada de IC3 (patilla 2).', 'sec-16.8.2', A_CC),
    'C25': ('Filtra la tensión de intensidad de señal de la patilla 3 de IC3, que mueve el medidor.', 'sec-16.8.8', A_CE),
    'C26': ('Desacoplo de la entrada de mute de IC3 (patilla 4).', 'sec-16.11.7', A_CC),
    'B2': ('Bobina del discriminador (18 espiras, 7,6 µH): su núcleo se ajusta hasta que TP3 marque 4,6 V; determina la calidad de sonido.', 'sec-16.11.3', A_L),
    'C27': ('Con B2 forma el circuito resonante del discriminador de FM.', 'sec-16.8.2', A_CC),
    'C28': ('Condensador del discriminador, de la patilla 7 de IC3 a masa.', 'sec-16.8.2', A_CC),
    'C29': ('Filtra los restos de FI en la salida del detector (TP3).', 'sec-16.8.2', A_CC),
    'R12': ('Alimenta IC3 desde los 12 V con su propio desacoplo (C30, C31).', 'sec-16.8.6', A_R),
    'C30': ('Desacoplo de alta frecuencia de la alimentación de IC3.', 'sec-16.8.6', A_CC),
    'C31': ('Desacoplo (electrolítico) de la alimentación de IC3.', 'sec-16.8.6', A_CE),
    'M1': ('Medidor de aguja «5V Meter»: indica la intensidad de señal (la tensión de la patilla 3 de IC3, que no supera los 5 V). Es el instrumento de los ajustes de C4A\', L1 y B1.', 'sec-16.8.8', None),
    'R11': ('Con W2, divisor que lleva una parte de la tensión del medidor a la entrada de mute.', 'sec-16.11.7', A_R),
    'W2': ('Sensibilidad del mute (10 kΩ): fija con qué intensidad de señal se silencia el audio entre emisoras.', 'sec-16.11.7', A_POT),
    'K2': ('Interruptor del mute: conecta el cursor de W2 a la patilla 4 de IC3.', 'sec-16.11.7', None),
    'K1': ('Conmutador del AFC: en ON lleva al varicap la tensión del detector (TP3); en OFF, la del cursor de W1 (TP1).', 'sec-16.8.3', None),
    'W1': ('Potenciómetro de 20 kΩ entre los 6 V y masa: su cursor (TP1) polariza el varicap con el AFC apagado. Se ajusta a 4,6 V.', 'sec-16.11.5', A_POT),
    'R5': ('Primera resistencia del filtro del AFC (470 kΩ); con C15 da una constante de tiempo de unas décimas de segundo.', 'sec-16.8.3', A_R),
    'C15': ('Condensador del filtro del AFC (0,47 µF): deja pasar la continua y quita el audio.', 'sec-16.8.3', A_CE),
    'R4': ('Segunda resistencia del filtro del AFC (100 kΩ), hasta el varicap.', 'sec-16.8.3', A_R),
    'C14': ('Último condensador del filtro del AFC, junto al varicap.', 'sec-16.8.3', A_CC),
    'SC3610D': ('Módulo de display SC3610D (FDMR 3610D): un frecuencímetro que cuenta el oscilador local y resta 10,7 MHz. Se alimenta con unos 3,1 V tras D3. Si fallara, la radio seguiría sonando.', 'sec-16.8.7', None),
    'CZ1': ('Conector de alimentación de 12 V, centro positivo. Fuente lineal o pilas, nunca conmutada; entre 9 y 12 V.', 'sec-16.8.6', None),
    'K4': ('Interruptor de encendido, dentro del potenciómetro de volumen (sin serigrafía propia).', 'sec-16.10.6', None),
    'C61': ('Desacoplo de alta frecuencia del raíl de 12 V (0,047 µF).', 'sec-16.8.5', A_CC),
    'C62': ('Desacoplo del raíl de 12 V (1000 µF): absorbe los picos del TEA2025 al ritmo de la música.', 'sec-16.8.5', A_CE),
    'R15': ('Limita la corriente del LED de encendido D5.', 'sec-16.10.2', A_R),
    'D5': ('LED verde de encendido.', 'sec-16.10.2', A_LED),
    'IC7': ('Regulador 78L06: 6 V regulados para el front-end (y para W1).', 'sec-16.8.6', None),
    'C18': ('Desacoplo de la entrada del 78L06.', 'sec-16.8.6', A_CC),
    'C16': ('Desacoplo (electrolítico) de la salida de 6 V del 78L06.', 'sec-16.8.6', A_CE),
    'C17': ('Desacoplo de alta frecuencia de la salida de 6 V.', 'sec-16.8.6', A_CC),
    'L3': ('Bobina de filtro de 100 µH entre los 6 V del 78L06 y el raíl de 5,9 V del front-end.', 'sec-16.8.6', A_L),
    'C11': ('Desacoplo de alta frecuencia del raíl de 5,9 V.', 'sec-16.8.6', A_CC),
    'C12': ('Desacoplo (electrolítico) del raíl de 5,9 V.', 'sec-16.8.6', A_CE),
    'IC6': ('Regulador AMS1117-3.3 (SMD, cara inferior): 3,3 V solo para el display, colgado del raíl de 5,9 V.', 'sec-16.8.6', None),
    'D3': ('Diodo de germanio 1N60P en serie con la alimentación del display: deja unos 3,1 V.', 'sec-16.8.6', A_D),
    'C32': ('Desacoplo de la alimentación del display.', 'sec-16.8.7', A_CC),
    'R13': ('220 Ω desde los 12 V: su caída deja unos 8 V para el decodificador estéreo.', 'sec-16.8.6', A_R),
    'C33': ('Desacoplo de alta frecuencia del raíl de 8 V.', 'sec-16.8.6', A_CC),
    'C34': ('Filtro (electrolítico) del raíl de 8 V del decodificador.', 'sec-16.8.6', A_CE),
    'R14': ('Lleva la salida del detector (TP3) al decodificador estéreo, con C35.', 'sec-16.20', A_R),
    'C35': ('Acoplo de la señal MPX a la entrada de IC4 (bloquea la continua de 4,6 V).', 'sec-16.20', A_CE),
    'IC4': ('TA7343AP: decodificador estéreo por PLL. Su VCO, enganchado al piloto de 19 kHz, regenera los 38 kHz y separa los canales L y R. Alimentado a 8 V por la patilla 3.', 'sec-16.4', None),
    'R16': ('Filtro del lazo del PLL (patilla 2), con C36 y C37.', 'sec-16.8.4', A_R),
    'C36': ('Filtro del lazo del PLL (patilla 2).', 'sec-16.8.4', A_CE),
    'C37': ('Filtro del lazo del PLL (patilla 2).', 'sec-16.8.4', A_CC),
    'C38': ('Condensador de poliéster de 1000 pF, el único de película del kit: con R17 y W3 fija la frecuencia libre del VCO; tiene que ser estable con la temperatura.', 'sec-16.8.4', A_CP),
    'R17': ('Resistencia fija del VCO, en serie con W3.', 'sec-16.8.4', A_R),
    'W3': ('Ajuste del VCO (5 kΩ): se gira hasta medir exactamente 38 kHz en TP4.', 'sec-16.11.6', A_POT),
    'R18': ('Limita la corriente del LED de estéreo D4.', 'sec-16.8.4', A_R),
    'D4': ('LED rojo de estéreo: se enciende cuando el PLL se engancha al piloto.', 'sec-16.4', A_LED),
    'MON': ('Puente «Monitor» (dos pads en la cara inferior): se une con estaño para medir los 38 kHz en TP4 y se vuelve a abrir después.', 'sec-16.11.6', None),
    'R19': ('Carga del punto TP4.', 'sec-16.11.6', A_R),
    'K3': ('Interruptor estéreo/mono: en ON detiene el VCO y fuerza el modo mono; en OFF permite el estéreo.', 'sec-16.4', None),
    'C39': ('Condensador de la patilla 7 de IC4, la que K3 lleva a los 8 V para detener el VCO.', 'sec-16.8.4', A_CC),
    'R20': ('Resistencia de la patilla 7 de IC4 a los 8 V.', 'sec-16.8.4', A_R),
    'R21': ('Carga de la salida R de IC4 (patilla 8).', 'sec-16.8.4', A_R),
    'R22': ('Carga de la salida L de IC4 (patilla 9).', 'sec-16.8.4', A_R),
    'C40': ('Acoplo de la salida L del decodificador hacia el desénfasis.', 'sec-16.8.4', A_CE),
    'C41': ('Acoplo de la salida R del decodificador hacia el desénfasis.', 'sec-16.8.4', A_CE),
    'C42': ('Primer condensador del filtro de desénfasis (canal L).', 'sec-16.8.4', A_CC),
    'L4': ('Bobina de 40 mH del desénfasis del canal L; con C43 forma una trampa en unos 25 kHz.', 'sec-16.8.4', A_L),
    'C43': ('En paralelo con L4: trampa en unos 25 kHz contra los restos del piloto y la subportadora.', 'sec-16.8.4', A_CC),
    'C44': ('Condensador del filtro de desénfasis (canal L).', 'sec-16.8.4', A_CC),
    'R23': ('Resistencia del filtro de desénfasis (canal L).', 'sec-16.8.4', A_R),
    'C45': ('Último condensador del filtro de desénfasis (canal L).', 'sec-16.8.4', A_CC),
    'R24': ('Salida del canal L hacia el jack CZ3.', 'sec-16.8.4', A_R),
    'C46': ('Primer condensador del filtro de desénfasis (canal R).', 'sec-16.8.4', A_CC),
    'L5': ('Bobina de 40 mH del desénfasis del canal R; con C47 forma la trampa de unos 25 kHz.', 'sec-16.8.4', A_L),
    'C47': ('En paralelo con L5: trampa en unos 25 kHz.', 'sec-16.8.4', A_CC),
    'C48': ('Condensador del filtro de desénfasis (canal R).', 'sec-16.8.4', A_CC),
    'R25': ('Resistencia del filtro de desénfasis (canal R).', 'sec-16.8.4', A_R),
    'C49': ('Último condensador del filtro de desénfasis (canal R).', 'sec-16.8.4', A_CC),
    'R26': ('Salida del canal R hacia el jack CZ3.', 'sec-16.8.4', A_R),
    'CZ3': ('Jack de 3,5 mm del frontal: salida de audio para usar la radio como sintonizador con un amplificador externo.', 'sec-16.10.7', None),
    'R27': ('Lleva el canal L al volumen W4-1.', 'sec-16.8.5', A_R),
    'R28': ('Lleva el canal R al volumen W4-2.', 'sec-16.8.5', A_R),
    'W4-1': ('Sección L del potenciómetro doble de volumen (A5k–20k); ajusta los dos canales a la vez.', 'sec-16.8.5', A_POT),
    'W4-2': ('Sección R del potenciómetro doble de volumen.', 'sec-16.8.5', A_POT),
    'C50': ('Acoplo de entrada del canal L al TEA2025 (patilla 10): bloquea la continua.', 'sec-16.8.5', A_CC),
    'C55': ('Acoplo de entrada del canal R al TEA2025 (patilla 7).', 'sec-16.8.5', A_CC),
    'IC5': ('TEA2025: amplificador de audio estéreo en DIP-16 (unos 2 W por canal con 12 V); sus cuatro patillas centrales de masa llevan el calor al cobre. Salidas a media alimentación.', 'sec-16.5', None),
    'C51': ('Red de estabilidad de la salida 2 (patilla 15).', 'sec-16.5', A_CC),
    'C52': ('Condensador de bootstrap del canal 2 (patillas 15 y 14): deja que la salida se acerque más al raíl positivo.', 'sec-16.5', A_CE),
    'C53': ('Condensador de salida del canal L (1000 µF): bloquea la continua hacia el altavoz; con 8 Ω, corte en 20 Hz.', 'sec-16.5', A_CE),
    'C54': ('Red de realimentación del canal 2 (patilla 11), que fija la ganancia.', 'sec-16.5', A_CE),
    'C56': ('Red de estabilidad de la salida 1 (patilla 2).', 'sec-16.5', A_CC),
    'C57': ('Condensador de bootstrap del canal 1 (patillas 2 y 3).', 'sec-16.5', A_CE),
    'C58': ('Condensador de salida del canal R (1000 µF) hacia el altavoz.', 'sec-16.5', A_CE),
    'C59': ('Red de realimentación del canal 1 (patilla 6).', 'sec-16.5', A_CE),
    'C60': ('Condensador de la patilla 8 (rechazo del rizado de la alimentación).', 'sec-16.5', A_CE),
    'CZ2-L': ('Altavoz izquierdo (4 u 8 Ω) en CZ2.', 'sec-16.7', None),
    'CZ2-R': ('Altavoz derecho (4 u 8 Ω) en CZ2.', 'sec-16.7', None),
}


# ------------------------------------------------------------------ voltage map (sections 15.11.2, 15.21; figure 15.28)
# Each point: where it is (net and, if useful, the pin), the book's value and tolerance, and the citation.
MAPA = [
    {'id': 'entrada', 'nombre': '12 V en la entrada (tras K4)', 'red': 'v12', 'pieza': 'K4', 'esperado': 12.0, 'tol': 0.05, 'cita': 'railes'},
    {'id': 'ic4', 'nombre': '8 V del decodificador (IC4, patilla 3, tras R13)', 'red': 'v8', 'pieza': 'IC4', 'pin': 'p3', 'esperado': 8.0, 'tol': 0.05, 'aprox': True, 'cita': 'railes'},
    {'id': '78l06', 'nombre': '6 V a la salida del 78L06', 'red': 'v6', 'pieza': 'IC7', 'pin': 'out', 'esperado': 6.0, 'tol': 0.05, 'cita': 'railes'},
    {'id': 'ic1', 'nombre': '5,9 V en la patilla 9 del TA7358AP (tras L3)', 'red': 'v59', 'pieza': 'IC1', 'pin': 'p9', 'esperado': 5.9, 'tol': 0.05, 'cita': 'railes'},
    {'id': 'ams', 'nombre': '3,3 V a la salida del AMS1117', 'red': 'v33', 'pieza': 'IC6', 'pin': 'out', 'esperado': 3.3, 'tol': 0.05, 'cita': 'railes'},
    {'id': 'display', 'nombre': '3,1 V en el display (tras D3)', 'red': 'v31', 'pieza': 'SC3610D', 'pin': 'vcc', 'esperado': 3.1, 'tol': 0.05, 'aprox': True, 'cita': 'railes'},
    {'id': 'ic2', 'nombre': '12 V de IC2 (TA7061BP, por R8)', 'red': 'ic2_5', 'pieza': 'IC2', 'pin': 'p5', 'esperado': 12.0, 'tol': 0.05, 'cita': 'mapa_fig'},
    {'id': 'ic3', 'nombre': '12 V de IC3 (TA7303P, patilla 9, por R12)', 'red': 'ic3_9', 'pieza': 'IC3', 'pin': 'p9', 'esperado': 12.0, 'tol': 0.05, 'cita': 'mapa_fig'},
    {'id': 'ic5', 'nombre': '12 V de IC5 (TEA2025, patilla 16)', 'red': 'v12', 'pieza': 'IC5', 'pin': 'p16', 'esperado': 12.0, 'tol': 0.05, 'cita': 'mapa_fig'},
    {'id': 'tp1', 'nombre': 'TP1: polarización del varicap (cursor de W1)', 'red': 'tp1', 'esperado': 4.6, 'tol': 0.10, 'cita': 'tp_tabla_1'},
    {'id': 'tp3', 'nombre': 'TP3: salida del detector (IC3, patilla 8)', 'red': 'det', 'pieza': 'IC3', 'pin': 'p8', 'esperado': 4.6, 'tol': 0.10, 'cita': 'tp3_reposo'},
    {'id': 'tea_o1', 'nombre': 'Salida 1 del TEA2025 en reposo (patilla 2)', 'red': 'o1', 'pieza': 'IC5', 'pin': 'p2', 'esperado': 6.0, 'tol': 0.10, 'aprox': True, 'cita': 'mapa_fig'},
    {'id': 'tea_o2', 'nombre': 'Salida 2 del TEA2025 en reposo (patilla 15)', 'red': 'o2', 'pieza': 'IC5', 'pin': 'p15', 'esperado': 6.0, 'tol': 0.10, 'aprox': True, 'cita': 'mapa_fig'},
]

# ------------------------------------------------------------------ test points
TPS = [
    {'id': 'TP1', 'red': 'tp1', 'que': 'Polarización del varicap del AFC (cursor de W1)', 'pregunta': '¿Está bien ajustado el AFC?',
     'esperado': '4,6 V de continua (con K1 pulsado y W1 ajustado), igual que TP3', 'cita': 'tp_tabla_1', 'instrumento': 'multimetro',
     'ajustes': [('Multímetro en tensión continua, punta negra en masa', 'tp1_multi')]},
    {'id': 'TP2', 'red': 'if2', 'que': 'Entrada de FI del TA7303P, tras CF2 (sin serigrafía: la pista de CF2 a IC3)', 'pregunta': '¿Trabajan el front-end, el mezclador, los filtros y el primer amplificador de FI?',
     'esperado': 'Señal de 10,7 MHz al sintonizar una emisora (sonda ×10)', 'cita': 'tp_tabla_2', 'instrumento': 'osciloscopio',
     'ajustes': [('Sonda ×10 (la ×1 desintoniza el circuito)', 'tp2_sonda'), ('Lo útil es ver actividad al sintonizar, no la amplitud', 'tp2_sonda')]},
    {'id': 'TP3', 'red': 'det', 'que': 'Salida del detector (Det Out), patilla 8 del TA7303P', 'pregunta': '¿Funciona la detección?',
     'esperado': '4,6 V de continua con la señal MPX (audio y piloto de 19 kHz) superpuesta', 'cita': 'tp_tabla_3', 'instrumento': 'osciloscopio',
     'ajustes': [('Multímetro: 4,6 V (ajuste de B2)', 'paso_3'), ('Osciloscopio en acoplo AC y FFT: pico del piloto en 19 kHz', 'fnirsi_fft')]},
    {'id': 'TP4', 'red': 'tp4', 'que': 'Oscilador (VCO) del decodificador estéreo TA7343AP', 'pregunta': '¿Está a 38 kHz?',
     'esperado': 'Onda de 38 kHz del VCO (con el puente «Monitor» cerrado y K3 en la posición estéreo)', 'cita': 'tp_tabla_4', 'instrumento': 'osciloscopio',
     'ajustes': [('Medida automática de frecuencia (PRM)', 'prm'), ('Sin emisora estéreo sintonizada: se mide la frecuencia libre', 'paso_8b')]},
]

# ------------------------------------------------------------------ signal path (stages)
# Each stage: the chain of parts it goes through: ('pieza', in-terminal, out-terminal), joined along the wires.
ETAPAS = [
    {'id': 'antena', 'nombre': 'Antena y filtro de entrada', 'bloque': 1, 'senal': 'RF de 87 a 108 MHz, microvoltios', 'cita': 'banda_bpf',
     'cadena': [('ANT', 'start', 'start'), ('BPF', 'in', 'out'), ('IC1', 'p1', 'p1')]},
    {'id': 'rf', 'nombre': 'Amplificador de RF y circuito de entrada (L1 + C4A)', 'bloque': 1, 'senal': 'la emisora elegida, amplificada', 'cita': 'superhet',
     'cadena': [('IC1', 'p1', 'p3'), ('C2', 'start', 'end'), ('IC1', 'p4', 'p4')]},
    {'id': 'ol', 'nombre': 'Oscilador local (L2 + C4B)', 'bloque': 1, 'senal': 'de 98,7 a 118,7 MHz, 10,7 MHz por encima de la emisora', 'cita': 'ol',
     'cadena': [('L2', 'start', 'start'), ('C8', 'end', 'start'), ('IC1', 'p8', 'p8')]},
    {'id': 'mezclador', 'nombre': 'Mezclador: frecuencia intermedia', 'bloque': 1, 'senal': 'FI de 10,7 MHz', 'cita': 'fi',
     'cadena': [('IC1', 'p4', 'p6'), ('B1', 'p1', 'p6'), ('R6', 'start', 'end'), ('CF1', 'p1', 'p3')]},
    {'id': 'fi', 'nombre': 'Amplificación de FI y filtros cerámicos', 'bloque': 2, 'senal': '10,7 MHz amplificada, ancho de unos 280 kHz', 'cita': 'cf_ancho',
     'cadena': [('CF1', 'p3', 'p3'), ('IC2', 'p6', 'p3'), ('CF2', 'p1', 'p3'), ('IC3', 'p1', 'p1')]},
    {'id': 'detector', 'nombre': 'Limitador y detector de FM (B2)', 'bloque': 2, 'senal': 'señal MPX sobre 4,6 V de continua', 'cita': 'detector',
     'cadena': [('IC3', 'p1', 'p8')]},
    {'id': 'mpx', 'nombre': 'Señal MPX hacia el decodificador', 'bloque': 4, 'senal': 'L+R, piloto de 19 kHz y L−R en 38 kHz', 'cita': 'mpx',
     'cadena': [('IC3', 'p8', 'p8'), ('R14', 'start', 'end'), ('C35', 'start', 'end'), ('IC4', 'p1', 'p1')]},
    {'id': 'estereo', 'nombre': 'Decodificador estéreo PLL', 'bloque': 4, 'senal': 'canales L y R separados', 'cita': 'matriz',
     'cadena': [('IC4', 'p1', 'p9')], 'cadena2': [('IC4', 'p1', 'p8')]},
    {'id': 'desenfasis', 'nombre': 'Desénfasis y filtro de 19/38 kHz', 'bloque': 4, 'senal': 'audio L y R limpio', 'cita': 'trampa',
     'cadena': [('IC4', 'p9', 'p9'), ('C40', 'start', 'end'), ('L4', 'start', 'end'), ('R23', 'start', 'end'), ('R24', 'start', 'end')],
     'cadena2': [('IC4', 'p8', 'p8'), ('C41', 'start', 'end'), ('L5', 'start', 'end'), ('R25', 'start', 'end'), ('R26', 'start', 'end')]},
    {'id': 'volumen', 'nombre': 'Volumen W4', 'bloque': 5, 'senal': 'audio de nivel de línea', 'cita': 'doce_audio',
     'cadena': [('R24', 'end', 'end'), ('R27', 'start', 'end'), ('W4-1', 'start', 'tap'), ('C50', 'start', 'end'), ('IC5', 'p10', 'p10')],
     'cadena2': [('R26', 'end', 'end'), ('R28', 'start', 'end'), ('W4-2', 'start', 'tap'), ('C55', 'start', 'end'), ('IC5', 'p7', 'p7')]},
    {'id': 'potencia', 'nombre': 'Amplificador TEA2025 y altavoces', 'bloque': 5, 'senal': 'unos vatios por canal', 'cita': 'tea_potencia',
     'cadena': [('IC5', 'p10', 'p15'), ('C53', 'start', 'end'), ('CZ2-L', 'start', 'start')],
     'cadena2': [('IC5', 'p7', 'p2'), ('C58', 'start', 'end'), ('CZ2-R', 'start', 'start')]},
]

# ------------------------------------------------------------------ guided alignment (section 15.11, in the book's order)
PASOS = [
    {'id': 'preparacion', 'seccion': 'sec-16.11', 'titulo': 'Preparación', 'cita': 'preparacion',
     'texto': 'K1 (AFC) y K2 (Mute) apagados, medidor de aguja conectado al terminal «5V Meter», display insertado y alimentación entre 9 y 12 V, centro positivo.'},
    {'id': 'railes', 'seccion': 'sec-16.11.2', 'titulo': 'Tensiones de alimentación (multímetro)', 'cita': 'railes',
     'texto': 'Con el multímetro en continua y la punta negra en masa, mide los raíles: 12 V tras K4, unos 8 V en IC4, 6 V del 78L06, 5,9 V en la patilla 9 de IC1, 3,3 V del AMS1117 y unos 3,1 V en el display.'},
    {'id': 'c4a', 'seccion': 'sec-16.11.3', 'titulo': 'Presintonía de RF C4A\' al máximo del medidor', 'cita': 'paso_1',
     'texto': 'Sintoniza una emisora fuerte de referencia y gira C4A\' hasta que el medidor de aguja indique el máximo.'},
    {'id': 'b1', 'seccion': 'sec-16.11.3', 'titulo': 'Núcleo de B1 al máximo del medidor', 'cita': 'paso_2',
     'texto': 'Gira el núcleo del transformador de FI B1 hasta el máximo del medidor. Si el pico no se aprecia, baja la antena o usa una emisora más floja.'},
    {'id': 'b2', 'seccion': 'sec-16.11.3', 'titulo': 'Núcleo de B2 hasta TP3 = 4,6 V', 'cita': 'paso_3',
     'texto': 'Mide TP3 (patilla 8 del TA7303) con el multímetro y gira el núcleo de B2 hasta que marque 4,6 V.'},
    {'id': 'cobertura', 'seccion': 'sec-16.11.4', 'titulo': 'Cobertura: C4B\' en el extremo alto, L2 en el bajo', 'cita': 'paso_4',
     'texto': 'Con el variable al extremo alto, ajusta C4B\' hasta que el display marque cerca de 108 MHz; con el variable al extremo bajo, separa o junta las espiras de L2 hasta cerca de 88 MHz. Se influyen: repite.'},
    {'id': 'seguimiento', 'seccion': 'sec-16.11.4', 'titulo': 'Seguimiento: L1 abajo, C4A\' arriba', 'cita': 'paso_6',
     'texto': 'Con una emisora baja, ajusta L1 para máxima señal en el medidor; con una emisora alta, C4A\' para el máximo. Repite hasta estabilizar.'},
    {'id': 'afc', 'seccion': 'sec-16.11.5', 'titulo': 'AFC: W1 hasta TP1 = 4,6 V', 'cita': 'paso_7',
     'texto': 'Pulsa K1, mide TP1 y gira W1 hasta 4,6 V, el mismo valor que TP3: así al pulsar o soltar K1 la emisora no se desplaza.'},
    {'id': 'estereo', 'seccion': 'sec-16.11.6', 'titulo': 'Estéreo: W3 hasta 38 kHz en TP4', 'cita': 'paso_8',
     'texto': 'Puentea el punto «Monitor», pon K3 en estéreo y, sin emisora estéreo sintonizada, mide la frecuencia en TP4 (PRM). Gira W3 hasta 38 kHz exactos y vuelve a abrir «Monitor».'},
    {'id': 'mute', 'seccion': 'sec-16.11.7', 'titulo': 'Sensibilidad del Mute (W2)', 'cita': 'paso_9',
     'texto': 'Pulsa K2 y, en una frecuencia sin emisora, ajusta W2 hasta que el siseo baje de forma satisfactoria, sin pasarte: demasiado silenciado elimina emisoras débiles.'},
]

# ------------------------------------------------------------------ faults (troubleshooting mode)
# dc: placeholder overrides of the DC model; senal: what the signal model changes; pieza: the answer.
AVERIAS = [
    {'id': 'antena', 'titulo': 'Antena mal conectada', 'pieza': 'ANT', 'aceptar': ['ANT', 'BPF'], 'cita': 'antena_ausente',
     'sintoma': 'Se oye ruido de fondo y nada más; el medidor apenas se mueve en ninguna emisora.', 'dc': {}, 'senal': {'antena': False},
     'explicacion': 'Sin antena no llega señal al front-end: TP2 no muestra 10,7 MHz al sintonizar, pero todas las tensiones son normales y la prueba de pinzas en TP2 da siseo. Es una de las cinco averías propias de un kit.'},
    {'id': 'l3', 'titulo': 'L3 abierta (soldadura fría)', 'pieza': 'L3', 'aceptar': ['L3'], 'cita': 'ej_l3',
     'sintoma': 'No se recibe ninguna emisora, solo siseo, y el display no se enciende.', 'dc': {'RL3': '1e9'}, 'senal': {'front_end': False, 'display': False},
     'explicacion': 'La salida del 78L06 da 6 V, pero la patilla 9 del TA7358AP está a 0 V: el corte está entre ambos, en L3. Como el AMS1117 cuelga del mismo raíl de 5,9 V, también se apaga el display.'},
    {'id': 'w1', 'titulo': 'W1 desajustado', 'pieza': 'W1', 'aceptar': ['W1'], 'cita': 'afc_w1',
     'sintoma': 'Al pulsar K1 (AFC) la emisora se desplaza en lugar de quedar enganchada.', 'dc': {}, 'senal': {'w1': 0.64},
     'explicacion': 'TP1 no vale 4,6 V: al pasar K1 de OFF a ON el varicap salta de la tensión de W1 a la del detector (4,6 V) y la frecuencia del oscilador cambia. Se corrige girando W1 hasta 4,6 V en TP1.'},
    {'id': 'w3', 'titulo': 'VCO del decodificador lejos de 38 kHz', 'pieza': 'W3', 'aceptar': ['W3', 'C38', 'R17'], 'cita': 'ej_w3',
     'sintoma': 'Las emisoras estéreo se oyen en mono: el LED de estéreo no se enciende nunca.', 'dc': {}, 'senal': {'w3': 0.06},
     'explicacion': 'Con el puente «Monitor» cerrado y K3 en estéreo, TP4 da una frecuencia libre lejos de 38 kHz: el PLL no engancha el piloto. Se ajusta W3 hasta 38 kHz.'},
    {'id': 'r13', 'titulo': 'R13 abierta: el decodificador sin sus 8 V', 'pieza': 'R13', 'aceptar': ['R13'], 'cita': 'ausente',
     'sintoma': 'El display marca la emisora y el medidor sube, pero no se oye nada.', 'dc': {'R13': '1e9'}, 'senal': {'decodificador': False},
     'explicacion': 'TP3 tiene su señal MPX y sus 4,6 V: la radio funciona hasta el detector. Pero la patilla 3 del TA7343AP no tiene los 8 V: R13 está abierta. Una tensión ausente localiza de inmediato el problema.'},
    {'id': 'c58', 'titulo': 'C58 abierto (condensador de salida)', 'pieza': 'C58', 'aceptar': ['C58', 'CZ2-R'], 'cita': 'un_canal',
     'sintoma': 'Un canal suena y el otro no.', 'dc': {}, 'senal': {'canal_r': False},
     'explicacion': 'Las continuas son normales (los dos amplificadores están a media alimentación). La señal llega a la salida del TEA2025 (patilla 2) pero no al altavoz derecho: el condensador de salida de ese canal está abierto. «Un canal sí y otro no» apunta a un componente externo de ese canal.'},
    {'id': 'l2', 'titulo': 'Oscilador local parado (L2 abierta)', 'pieza': 'L2', 'aceptar': ['L2', 'C4B', 'IC1'], 'cita': 'tabla_no_cambia',
     'sintoma': 'Solo siseo en todo el dial; el display no marca ninguna cifra.', 'dc': {}, 'senal': {'oscilador': False},
     'explicacion': 'El display cuenta el oscilador local: si no muestra una cifra que cambie al girar el dial, el oscilador no funciona. Las tensiones son normales y la prueba de pinzas en TP2 da siseo: la FI y el audio están vivos. Hay que mirar el condensador variable, L2 o el TA7358AP.'},
    {'id': 'ams', 'titulo': 'AMS1117 sin soldar', 'pieza': 'IC6', 'aceptar': ['IC6'], 'cita': 'display_ayuda',
     'sintoma': 'La radio suena bien, pero el display está apagado.', 'dc': {'IC6EN': 0}, 'senal': {'display': False},
     'explicacion': 'Faltan los 3,3 V a la salida del AMS1117 (y los 3,1 V tras D3) con los 5,9 V presentes en su entrada. El display es un instrumento de ayuda: si falla, la radio sigue sonando.'},
    {'id': 'k4', 'titulo': 'Interruptor K4 que no cierra', 'pieza': 'K4', 'aceptar': ['K4', 'CZ1'], 'cita': 'tabla_nada',
     'sintoma': 'Nada: ni sonido, ni display, ni LED de encendido.', 'dc': {'K4': '1e12'}, 'senal': {'alimentacion': False},
     'explicacion': 'Hay 12 V en CZ1 pero no tras K4: el interruptor del volumen no cierra. «Nada, ni display» apunta a la alimentación.'},
    {'id': 'l1', 'titulo': 'L1 deformada (bobina fuera de su punto)', 'pieza': 'L1', 'aceptar': ['L1', "C4A'"], 'cita': 'bobina_fuera',
     'sintoma': 'Se reciben las emisoras fuertes, pero con poca señal; las débiles desaparecen, sobre todo en la parte baja del dial.', 'dc': {}, 'senal': {'l1': 0.13},
     'explicacion': 'Todas las tensiones son normales y el display marca bien: el oscilador funciona. El medidor marca poco: el circuito de entrada (L1 + C4A) no sigue al oscilador. Deformar una bobina al manipular la placa la desajusta; se corrige repitiendo el seguimiento (L1 en el extremo bajo).'},
]

# Simulated broadcast stations (not from the book): frequency (MHz), level at the antenna (dBµV), stereo.
EMISORAS = [
    {'f': 88.6, 'nivel': 62, 'estereo': True, 'nombre': 'Emisora simulada A'},
    {'f': 91.3, 'nivel': 34, 'estereo': True, 'nombre': 'Emisora simulada B (débil)'},
    {'f': 94.8, 'nivel': 58, 'estereo': False, 'nombre': 'Emisora simulada C (mono)'},
    {'f': 98.0, 'nivel': 78, 'estereo': True, 'nombre': 'Emisora simulada D (fuerte)'},
    {'f': 101.7, 'nivel': 66, 'estereo': True, 'nombre': 'Emisora simulada E'},
    {'f': 104.5, 'nivel': 40, 'estereo': True, 'nombre': 'Emisora simulada F (débil)'},
    {'f': 107.4, 'nivel': 64, 'estereo': True, 'nombre': 'Emisora simulada G'},
]

# Constants of the alignment model. 'libro': value from the book (citation); 'modelo': chosen for the model.
CONSTANTES = {
    'L1': {'valor': 0.058e-6, 'origen': 'libro', 'cita': 'mapa_fig'},
    'L2': {'valor': 0.042e-6, 'origen': 'libro', 'cita': 'mapa_fig'},
    'C4max': {'valor': 20e-12, 'origen': 'libro', 'cita': 'esquema_orig', 'nota': 'C4A = C4B = 20 pF'},
    'C4trim': {'valor': 10e-12, 'origen': 'libro', 'cita': 'esquema_orig', 'nota': "C4A' = C4B' = 10 pF"},
    'C3': {'valor': 22e-12, 'origen': 'libro', 'cita': 'esquema_orig'},
    'C7': {'valor': 22e-12, 'origen': 'libro', 'cita': 'esquema_orig'},
    'C9': {'valor': 10e-12, 'origen': 'libro', 'cita': 'esquema_orig'},
    'FI': {'valor': 10.7e6, 'origen': 'libro', 'cita': 'fi'},
    'banda': {'valor': [88e6, 108e6], 'origen': 'libro', 'cita': 'paso_4'},
    'ancho_fi': {'valor': 280e3, 'origen': 'libro', 'cita': 'cf_ancho'},
    'B1': {'valor': 3e-6, 'origen': 'libro', 'cita': 'b1_c13'},
    'C13': {'valor': 75e-12, 'origen': 'libro', 'cita': 'b1_c13'},
    'B2': {'valor': 7.6e-6, 'origen': 'libro', 'cita': 'b1_b2'},
    'C27': {'valor': 24e-12, 'origen': 'libro', 'cita': 'esquema_orig'},
    'TP3': {'valor': 4.6, 'origen': 'libro', 'cita': 'tp3_reposo'},
    'TP1': {'valor': 4.6, 'origen': 'libro', 'cita': 'tp_tabla_1'},
    'VCO': {'valor': 38e3, 'origen': 'libro', 'cita': 'paso_8'},
    'C38': {'valor': 1000e-12, 'origen': 'libro', 'cita': 'vco_c38'},
    'R17': {'valor': 9.1e3, 'origen': 'libro', 'cita': 'esquema_orig'},
    'W3': {'valor': 5e3, 'origen': 'libro', 'cita': 'esquema_orig'},
    'W1': {'valor': 20e3, 'origen': 'libro', 'cita': 'afc_k1'},
    'medidor_max': {'valor': 5.0, 'origen': 'libro', 'cita': 'medidor_5v'},
}


def exportar(cap16, refs_path):
    refs = json.load(open(refs_path, encoding='utf-8'))
    errores = verificar_citas(cap16, refs)
    citas = {}
    for cid, (label, texto) in CITAS.items():
        r = refs.get(label, {})
        citas[cid] = {'ref': label, 'num': r.get('num'), 'tipo': r.get('tipo'), 'texto': texto}
    for k, (f, sec, anim) in COMPONENTES.items():
        if sec not in refs:
            errores.append(f'componente {k}: la sección {sec} no existe')
    return errores, citas, refs
