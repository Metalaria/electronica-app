# Pinned versions of everything compilar.sh downloads (sourced by compilar.sh).
# Changing any of these changes the binary: rebuild, run the validator over the 313 netlists and the
# Playwright tests, and commit the new web/vendor/ngspice-xspice/ together with this file.

# ngspice 45.2. SourceForge (the official home) is not reachable from every build machine, so the sources
# come from the GitHub mirror of the SourceForge git repository, pinned to the commit of the release tag.
# Official tarball (same release): https://sourceforge.net/projects/ngspice/files/ng-spice-rework/45.2/ngspice-45.2.tar.gz
NGSPICE_VERSION=45.2
NGSPICE_GIT=https://github.com/danchitnis/ngspice-sf-mirror.git
NGSPICE_TAG=ngspice-45.2
NGSPICE_COMMIT=724dc77b9153dc75eaec474b1f7a44f1fcf5f362

# Emscripten. TOOLCHAIN=github (default) assembles it from GitHub only: the emscripten sources at the tag, the
# LLVM release whose major version that emscripten expects (tools/shared.py: EXPECTED_LLVM_VERSION = 23) and
# the binaryen release it expects (tools/building.py: EXPECTED_BINARYEN_VERSION = 129). This is the toolchain
# that produced the committed binary. TOOLCHAIN=emsdk uses emsdk instead (same emscripten version, its own
# LLVM build, downloaded from storage.googleapis.com): same behaviour, not byte-identical.
EMSCRIPTEN_VERSION=6.0.3
EMSCRIPTEN_GIT=https://github.com/emscripten-core/emscripten.git
EMSCRIPTEN_COMMIT=283e2d130132859fde6a4e4c87fd254b38127651
EMSDK_GIT=https://github.com/emscripten-core/emsdk.git

LLVM_VERSION=23.1.4
LLVM_URL=https://github.com/llvm/llvm-project/releases/download/llvmorg-23.1.4/LLVM-23.1.4-Linux-X64.tar.xz
LLVM_SHA256=25d814fda50d5fb0084b42be09605d8b1595d49d5e2e03a3345d7e112ff6f9f3

BINARYEN_VERSION=129
BINARYEN_URL=https://github.com/WebAssembly/binaryen/releases/download/version_129/binaryen-version_129-x86_64-linux.tar.gz
BINARYEN_SHA256=50b9fa62b9abea752da92ec57e0c555fee578760cd237c40107957715d2976ba

# XSPICE code-model libraries linked into the binary, in the order of ngspice's spinit.
CODEMODELS="spice2poly analog digital xtradev xtraevt table tlines"
