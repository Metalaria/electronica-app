#!/bin/sh
# Assemble the Neo Geo demo (P ROM) with GNU binutils for the 68000 and draw its graphics ROMs (C1, C2, S1).
# The P ROM's words are stored big-endian here (the 68000's view); cartridges keep the same order.
# Usage: build.sh <output directory>
set -e
out=${1:-.}
here=$(dirname "$0")
m68k-linux-gnu-as -mcpu=68000 --register-prefix-optional -al="$out/demo.lst" -o "$out/demo.o" "$here/demo.s"
m68k-linux-gnu-ld -Ttext=0 -e 0 -o "$out/demo.elf" "$out/demo.o"
m68k-linux-gnu-objcopy -O binary "$out/demo.elf" "$out/demo.p1"
m68k-linux-gnu-nm "$out/demo.elf" > "$out/demo.sym"
python3 "$here/graficos.py" "$out"
