// Minimal stand-in for the BlastEm header of the same name, so that its vdp.c builds alone (offline trace tool).
#ifndef UTIL_H_
#define UTIL_H_
#include <stdio.h>
void fatal_error(char *format, ...);
void warning(char *format, ...);
void debug_message(char *format, ...);
char *tern_find_ptr_default(void *head, const char *key, void *def);
#endif
