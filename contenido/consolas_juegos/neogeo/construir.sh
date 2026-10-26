#!/bin/sh
# Builds «05-scrolling» of ngdevkit-examples (Damien Ciabrini, LGPL-3.0+; backgrounds by ansimuz, CC0) and nullbios,
# the free replacement BIOS of ngdevkit (LGPL-3.0+), for «Un juego de verdad» of the Neo Geo (Consolas › Un fotograma).
# Never SNK's BIOS nor UniBIOS. Sources are fetched at pinned commits into a temporary folder; nothing of them is
# kept in the repository except the ROM images this script writes next to itself (and the licence texts).
#
# Needs: git, Python 3.12+ with Pillow (PYTHON=python3.12 if python3 is older), ImageMagick «convert», binutils-m68k-linux-gnu and an m68k gcc. Ubuntu's
# cross compiler works when told to generate 68000 code:
#   apt-get download gcc-14-m68k-linux-gnu cpp-14-m68k-linux-gnu gcc-14-m68k-linux-gnu-base libgcc-14-dev-m68k-cross
#   for d in *.deb; do dpkg -x "$d" raiz; done
#   M68K_GCC="$PWD/raiz/usr/bin/m68k-linux-gnu-gcc-14" sh construir.sh
# (ngdevkit's own toolchain, m68k-neogeo-elf-gcc, works too: M68K_GCC=m68k-neogeo-elf-gcc.)
# The Z80 sound driver (M ROM) is not built: «Un fotograma» does not emulate the Neo Geo's Z80.
set -e
here=$(cd "$(dirname "$0")" && pwd)
NGDEVKIT_COMMIT=5106cbd1414a86ba02810ee93ac977be3360de4f
EXAMPLES_COMMIT=4e7900b79b1555f9f1737549a49c26fbdb1aa589
GCC=${M68K_GCC:-m68k-neogeo-elf-gcc}
PY=${PYTHON:-python3}   # 3.12 or newer (paltool.py uses itertools.batched)
OBJCOPY=${M68K_OBJCOPY:-m68k-linux-gnu-objcopy}
AR=${M68K_AR:-m68k-linux-gnu-ar}
w=$(mktemp -d)
trap 'rm -rf "$w"' EXIT
# no C library: the few libc headers ngdevkit includes (stdio.h for NULL, string.h for strlen) as stubs
mkdir -p "$w/inc"
printf '#include <stddef.h>\n' > "$w/inc/stdio.h"
printf '#include <stddef.h>\nsize_t strlen(const char *);\n' > "$w/inc/string.h"
CC="$GCC -B/usr/m68k-linux-gnu/bin/ -m68000 -fno-pic -fno-pie -ffreestanding -fomit-frame-pointer -nostdinc -isystem $($GCC -print-file-name=include) -isystem $w/inc"

trae() { # repository commit folder
  git init -q "$w/$3" && git -C "$w/$3" fetch -q --depth 1 "https://github.com/$1.git" "$2" && git -C "$w/$3" checkout -q FETCH_HEAD
}
trae dciabrin/ngdevkit $NGDEVKIT_COMMIT ngdevkit
trae dciabrin/ngdevkit-examples $EXAMPLES_COMMIT ejemplos
k=$w/ngdevkit
e=$w/ejemplos/05-scrolling
a=$w/ejemplos/00-template/setup/ngdevkit-assets
TILETOOL="$PY $k/tools/tiletool.py"
PALTOOL="$PY $k/tools/paltool.py"

# --- runtime of ngdevkit: crt0, crti, crtn and libngdevkit (the C runtime newlib/libsyscalls is not needed here)
mkdir -p "$w/rt"
for s in ngdevkit-crt0 ngdevkit-crti ngdevkit-crtn; do $CC -I"$k/include" -c "$k/runtime/$s.S" -o "$w/rt/$s.o"; done
for c in soft-dip soft-dip-jp soft-dip-us soft-dip-eu bios-ram bios-backup-ram bios-calls ng_text_tall_args ng_text_args \
  ng_center_text_tall_args ng_center_text_args ng_cls_args ng_wait_vblank ng_memory_card_inserted \
  ng_memory_card_write_protected ng_memory_card_unlock ng_memory_card_lock; do
  $CC -I"$k/include" -std=c99 -O0 -c "$k/runtime/libngdevkit/$c.c" -o "$w/rt/$c.o"
done
$AR cr "$w/rt/libngdevkit.a" "$w"/rt/*.o
$AR cr "$w/rt/libsyscalls.a"   # the link script asks for it; nothing of it is used

# --- nullbios, AES flavour (BIOS_ROM_HARDWARE=0), European (BIOS_ROM_COUNTRY=2), as the cartridge 68000 sees it
for c in credits controllers gfx; do $CC -I"$k/include" -std=c99 -O2 -c "$k/nullbios/$c.c" -o "$w/rt/nb-$c.o"; done
$CC -DBIOS_ROM_HARDWARE=0 -DBIOS_ROM_COUNTRY=2 -I"$k/include" -c "$k/nullbios/biosstart.S" -o "$w/rt/nb-start.o"
$CC -nostdlib -Wl,--build-id=none -T "$k/nullbios/bios.ld" -L"$w/rt" "$w/rt/nb-start.o" "$w"/rt/nb-c*.o "$w/rt/nb-gfx.o" -lngdevkit -lgcc -o "$w/nullbios.elf"
$OBJCOPY -O binary -S -R .comment "$w/nullbios.elf" "$here/nullbios-aes.bin"
m68k-linux-gnu-nm "$w/nullbios.elf" > "$here/nullbios-aes.sym"

# --- graphics: ngdevkit's base assets (fix font, logo) and the three CC0 backgrounds of the example
cd "$a"
convert gfx/unscii8.png -crop 256x24+2+1 +repage -crop 8x8 +append +repage -background black -gravity east -extent 1024x8 -fuzz 30% -fill white -opaque white -colors 2 "$w/smalltext.gif"
convert gfx/unscii16.png -crop 256x48+2+1 +repage -crop 8x16 +append +repage -background black -gravity east -extent 1024x16 -fuzz 30% -fill white -opaque white -colors 2 "$w/talltext.gif"
convert -size 1024x8 xc:black \( "$w/smalltext.gif" -transparent black -fuzz 30% -fill '#ffffff' -opaque white \) -geometry +1+1 -composite \( "$w/smalltext.gif" -transparent black -fuzz 30% -fill '#ff0000' -opaque white -geometry +0+0 \) -composite -colors 16 "$w/smalltext-shadow.gif"
convert -size 1024x16 xc:black \( "$w/talltext.gif" -transparent black -fuzz 30% -fill '#ffffff' -opaque white \) -geometry +1+1 -composite \( "$w/talltext.gif" -transparent black -fuzz 30% -fill '#ff0000' -opaque white -geometry +0+0 \) -composite -colors 16 "$w/talltext-shadow.gif"
$PY ./build-srom.py -s "$w/smalltext-shadow.gif" -t "$w/talltext-shadow.gif" -b "$w/talltext.gif" -o "$w/srom-shadow.bmp"
$TILETOOL --fix -c "$w/srom-shadow.bmp" -o "$w/s1.bin"
$TILETOOL --sprite -c gfx/logo.gif -o "$w/logo.c1" "$w/logo.c2"
for p in 1 2; do
  (dd bs=64 count=14 if="$w/logo.c$p"; dd bs=64 skip=15 if="$w/logo.c$p"; dd bs=64 count=197 if=/dev/zero) 2>/dev/null > "$w/base.c$p"
done
cd "$e/setup/prepare-backgrounds"
mkdir -p "$e/assets" "$e/build/assets"
convert gfx/country-platform-back.png -crop 384x144+0+16 +repage "$e/assets/back.gif"
convert gfx/country-platform-forest.png gfx/country-platform-forest.png gfx/country-platform-forest.png +append -crop 480x144+0+80 +repage -background black -flatten "$e/assets/forest.gif"
convert gfx/country-platform-tiles-example.png gfx/country-platform-tiles-example.png +append -crop 384x144+0+80 +repage -background black -flatten "$e/assets/front.gif"
cd "$e"
for g in back forest front; do
  $PALTOOL "assets/$g.gif" -o "build/assets/$g.pal"
  $TILETOOL --sprite -c "assets/$g.gif" -o "build/assets/$g.c1" "build/assets/$g.c2"
done
cat "$w/base.c1" build/assets/back.c1 build/assets/forest.c1 build/assets/front.c1 > "$here/scrolling.c1"
cat "$w/base.c2" build/assets/back.c2 build/assets/forest.c2 build/assets/front.c2 > "$here/scrolling.c2"
cp "$w/s1.bin" "$here/scrolling.s1"

# --- program ROM (P1): the 68000 words big-endian, as the 68000 reads them (no byte swap)
$CC -I build -I"$k/include" -std=c99 -O2 -g -c main.c -o "$w/main.o"
$CC -nostdlib -Wl,--build-id=none -T "$k/runtime/ngdevkit.ld" -L"$w/rt" "$w/rt/ngdevkit-crt0.o" "$w/rt/ngdevkit-crti.o" "$w/main.o" -lngdevkit -lgcc "$w/rt/ngdevkit-crtn.o" -o "$w/rom.elf"
$OBJCOPY -O binary -S -R .text2 --gap-fill 0xff "$w/rom.elf" "$here/scrolling.p1"
m68k-linux-gnu-nm "$w/rom.elf" > "$here/scrolling.sym"
m68k-linux-gnu-objdump -d --no-show-raw-insn "$w/rom.elf" > "$w/rom.dis"
cp "$k/COPYING.LESSER" "$here/LGPL-3.0.txt"
cp "$k/COPYING" "$here/GPL-3.0.txt"
cp "$e/setup/prepare-backgrounds/gfx/LICENSE.md" "$here/fondos-LICENSE.md"
cp "$a/gfx/LICENSES.md" "$here/ngdevkit-assets-LICENSES.md"
ls -l "$here"
