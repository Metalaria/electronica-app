// Minimal stand-in for BlastEm's system.h (offline trace tool).
#ifndef SYSTEM_H_
#define SYSTEM_H_
#include <stddef.h>
#include <stdint.h>
typedef enum { SYSTEM_UNKNOWN, SYSTEM_GENESIS, SYSTEM_GENESIS_PLAYER, SYSTEM_SMS, SYSTEM_SMS_PLAYER } system_type;
typedef struct system_header system_header;
struct system_header { uint16_t (*get_open_bus_value)(system_header *); system_type type; uint8_t enter_debugger; };
#include "event_log.h"
#endif
