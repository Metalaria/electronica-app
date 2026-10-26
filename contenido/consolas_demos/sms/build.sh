#!/bin/sh
# Assemble the Master System demo with GNU binutils for the Z80 (Debian/Ubuntu package binutils-z80) and write the
# cartridge checksum. Usage: build.sh <output directory>
set -e
out=${1:-.}
here=$(dirname "$0")
z80-unknown-coff-as -al="$out/demo.lst" -o "$out/demo.o" "$here/demo.s"
z80-unknown-coff-ld -Ttext=0 -o "$out/demo.out" "$out/demo.o"
z80-unknown-coff-objcopy -O binary "$out/demo.out" "$out/demo.sms"
z80-unknown-coff-nm "$out/demo.out" > "$out/demo.sym"
python3 - "$out/demo.sms" <<'PY'
import sys
p = sys.argv[1]
rom = bytearray(open(p, 'rb').read())
assert len(rom) == 0x8000, len(rom)
# «TMR SEGA» header: 16-bit sum of $0000-$7FEF (ROM size code $C = 32 KB), little-endian at $7FFA
suma = sum(rom[:0x7FF0]) & 0xFFFF
rom[0x7FFA] = suma & 0xFF
rom[0x7FFB] = suma >> 8
open(p, 'wb').write(rom)
PY
