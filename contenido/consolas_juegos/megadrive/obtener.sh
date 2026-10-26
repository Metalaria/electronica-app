#!/bin/sh
# Fetches «Gentris» (sample game of SGDK, MIT; by Werton, in Stéphane Dallongeville's SGDK) for «Un juego de verdad»
# of the Mega Drive: the ROM SGDK ships already built (sample/game/gentris/out/release/rom.bin) at a pinned commit,
# checked by its SHA-256, and the licence of SGDK. Building it from source needs SGDK's toolchain (m68k-elf-gcc,
# rescomp) and gives the same game; the shipped build is used so that the trace matches what SGDK publishes.
set -e
here=$(cd "$(dirname "$0")" && pwd)
C=9a78a44143a867cd8c5053b95cd061a21f0b73c2
curl -sSfL -o "$here/gentris.bin" "https://raw.githubusercontent.com/Stephane-D/SGDK/$C/sample/game/gentris/out/release/rom.bin"
curl -sSfL -o "$here/gentris-LICENSE.txt" "https://raw.githubusercontent.com/Stephane-D/SGDK/$C/license.txt"
echo "d74d0a0266b9b969488e199d800674e19f04d1e3b112252709c4442c35c9b682  $here/gentris.bin" | sha256sum -c -
