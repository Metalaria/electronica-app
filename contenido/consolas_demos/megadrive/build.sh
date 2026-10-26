#!/bin/sh
# Assemble the Mega Drive demo with GNU binutils for the 68000 (package binutils-m68k-linux-gnu) and write the
# header checksum. Usage: build.sh <output directory>
set -e
out=${1:-.}
here=$(dirname "$0")
m68k-linux-gnu-as -mcpu=68000 --register-prefix-optional -al="$out/demo.lst" -o "$out/demo.o" "$here/demo.s"
m68k-linux-gnu-ld -Ttext=0 -e 0 -o "$out/demo.elf" "$out/demo.o"
m68k-linux-gnu-objcopy -O binary "$out/demo.elf" "$out/demo.md"
m68k-linux-gnu-nm "$out/demo.elf" > "$out/demo.sym"
python3 - "$out/demo.md" <<'PY'
import sys
p = sys.argv[1]
rom = bytearray(open(p, 'rb').read())
assert len(rom) == 0x1000, hex(len(rom))
# header checksum: 16-bit sum of the big-endian words from $200 to the end, at $18E
suma = sum((rom[i] << 8) | rom[i + 1] for i in range(0x200, len(rom), 2)) & 0xFFFF
rom[0x18E] = suma >> 8
rom[0x18F] = suma & 0xFF
open(p, 'wb').write(rom)
PY
