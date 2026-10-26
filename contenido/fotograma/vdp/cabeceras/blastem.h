// Minimal stand-in for the BlastEm header of the same name, so that its vdp.c builds alone (offline trace tool).
#ifndef BLASTEM_H_
#define BLASTEM_H_
#include "system.h"
extern int headless;
extern void *config;
#endif
