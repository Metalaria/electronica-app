"""Cross-check of the Game Boy / Game Boy Color traces against an independent emulator (run by hand):
    PYTHONPATH=<folder with pyboy> python3 contenido/fotograma/contrastar_gb.py gb|gbc [programa] [rom] [entradas JSON]
With a button script (the one of juegos.json), PyBoy gets it shifted by the length of its own boot ROM (tried from 60
to 90 frames), and frames around the recorded one are compared.
Runs the demo ROM in PyBoy (headless, its own open-source boot ROM) and looks, among its first 400 frames, for one
equal pixel for pixel to the framebuffer stored in the trace (colours compared through a one-to-one map between the
trace's values — DMG shade 0–3 or CGB RGB555 — and PyBoy's RGB values).
"""
import os
import subprocess
import sys
import json

import numpy as np
from pyboy import PyBoy

maquina = sys.argv[1]
programa = sys.argv[2] if len(sys.argv) > 2 else 'demo'
raiz = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..')
rom = os.path.join(raiz, sys.argv[3]) if len(sys.argv) > 3 else os.path.join(raiz, 'contenido/consolas_demos', maquina, 'demo.gbc' if maquina == 'gbc' else 'demo.gb')
entradas = json.loads(sys.argv[4]) if len(sys.argv) > 4 else []
traza = os.path.join(raiz, 'web/public/consolas/fotograma', maquina, programa + '.bin')
BOTON = {'a': 'a', 'b': 'b', 'select': 'select', 'start': 'start', 'arriba': 'up', 'abajo': 'down', 'izquierda': 'left', 'derecha': 'right'}
# the framebuffer of the trace, decoded with the generators' Node reader
js = ("import {readFileSync} from 'node:fs'; import {leerTraza} from './contenido/fotograma/traza.mjs';"
      "const {arrays} = leerTraza(readFileSync(process.argv[1])); process.stdout.write(JSON.stringify(Array.from(arrays.fb)));")
fb = np.array(json.loads(subprocess.check_output(['node', '--input-type=module', '-e', js, traza], cwd=raiz)))

def diferencia(img_rgb):
    cod = (img_rgb[:, 0].astype(np.int64) << 16) | (img_rgb[:, 1].astype(np.int64) << 8) | img_rgb[:, 2]
    # pixels that disagree with the best one-to-one map trace value -> PyBoy colour
    pares, n = np.unique(fb.astype(np.int64) * (1 << 24) + cod, return_counts=True)
    usado_a, usado_b, buenos = set(), set(), 0
    for i in np.argsort(-n):
        a, b = int(pares[i]) >> 24, int(pares[i]) & 0xFFFFFF
        if a not in usado_a and b not in usado_b:
            usado_a.add(a)
            usado_b.add(b)
            buenos += int(n[i])
    return fb.size - buenos


def correr(desfase, total, desde):
    pb = PyBoy(rom, window='null', cgb=(maquina == 'gbc'), sound_emulated=False)
    pulsados = set()
    mejor = (None, 10**9)
    for k in range(total):
        quiero = set()
        for n, b in entradas:
            if k >= n + desfase:
                quiero = set(x for x in str(b).split('+') if x)
        for x in pulsados - quiero:
            pb.button_release(BOTON[x])
        for x in quiero - pulsados:
            pb.button_press(BOTON[x])
        pulsados = quiero
        pb.tick(1, k >= desde)
        if k >= desde:
            dif = diferencia(np.asarray(pb.screen.ndarray)[:, :, :3].reshape(-1, 3))
            if dif < mejor[1]:
                mejor = (k, dif)
            if dif == 0:
                break
    pb.stop(save=False)
    return mejor


if not entradas:
    mejor = correr(0, 400, 0)
else:
    fin = max(n for n, _ in entradas)
    mejor = (None, 10**9)
    for desfase in range(60, 91):
        k, dif = correr(desfase, fin + desfase + 400, fin + desfase)
        if dif < mejor[1]:
            mejor = (k, dif)
        if dif == 0:
            break
print('PyBoy %s: el cuadro %d difiere en %d de %d píxeles del cuadro de la traza' % (maquina, mejor[0], mejor[1], fb.size))
sys.exit(1 if mejor[1] else 0)
