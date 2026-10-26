#!/bin/sh
# Builds «Food Fighter» (Haroldo O. Pinheiro, 2022, MIT; sprites «64 16x16 food sprites» by Henry Software, CC0) for
# «Un juego de verdad» of the Master System (Consolas › Un fotograma). Sources fetched at pinned commits into a
# temporary folder; only the ROM, its symbol file and the licence are kept next to this script.
#
# Needs: git, a C compiler and SDCC 4.0.0. The library objects shipped with the game (crt0_sms.rel, PSGlib.rel) and
# SMSlib.lib of devkitSMS (commit 50b0fc4, the last one with the SMSlib.h the game carries) use SDCC's calling
# convention from before 4.1.12; SDCC 4.2's own library (puts) uses the new one, so mixing them garbles the text.
# Ubuntu's archive still has the 4.0.0 packages:
#   for f in sdcc_4.0.0+dfsg-2_amd64.deb sdcc-libraries_4.0.0+dfsg-2_all.deb; do
#     curl -O http://archive.ubuntu.com/ubuntu/pool/universe/s/sdcc/$f; done
#   for d in *.deb; do dpkg -x "$d" raiz; done
#   SDCC_HOME="$PWD/raiz/usr" PATH="$PWD/raiz/usr/bin:$PATH" sh construir.sh
set -e
here=$(cd "$(dirname "$0")" && pwd)
JUEGO_COMMIT=48fe2ea967952fb233f148c44ed48f66a01fb567
DEVKIT_COMMIT=50b0fc4
w=$(mktemp -d)
trap 'rm -rf "$w"' EXIT

git clone -q https://github.com/haroldo-ok/food-fighter.git "$w/ff"
git -C "$w/ff" checkout -q $JUEGO_COMMIT
git clone -q https://github.com/sverx/devkitSMS.git "$w/dk"
git -C "$w/dk" checkout -q $DEVKIT_COMMIT
git -C "$w/dk" show HEAD:SMSlib/src/SMSlib.h | cmp -s - "$w/ff/lib/SMSlib.h" || { echo "SMSlib.h distinto del del juego"; exit 1; }
cc -O2 -o "$w/folder2c" "$w/dk/folder2c/src/folder2c.c"
cc -O2 -o "$w/ihx2sms" "$w/dk/ihx2sms/src/ihx2sms.c"

cd "$w/ff"
"$w/folder2c" data data
for f in data actor food_fighter; do sdcc -c -mz80 --peep-file lib/peep-rules.txt $f.c; done
sdcc -o food_fighter.ihx -mz80 --no-std-crt0 --data-loc 0xC000 lib/crt0_sms.rel data.rel actor.rel \
  food_fighter.rel "$w/dk/SMSlib/SMSlib.lib" lib/PSGlib.rel
"$w/ihx2sms" food_fighter.ihx food_fighter.sms
cp food_fighter.sms food_fighter.noi "$here/"
cp LICENSE "$here/food_fighter-LICENSE.txt"
sha256sum "$here/food_fighter.sms"
