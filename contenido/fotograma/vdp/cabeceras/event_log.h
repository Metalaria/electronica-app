// Minimal stand-in for the BlastEm header of the same name, so that its vdp.c builds alone (offline trace tool).
#ifndef EVENT_LOG_H_
#define EVENT_LOG_H_
#include <stdint.h>
#include "serialize.h"
enum { EVENT_FLUSH, EVENT_ADJUST, EVENT_PSG_REG, EVENT_YM_REG, EVENT_VDP_REG, EVENT_VRAM_BYTE, EVENT_VRAM_WORD, EVENT_VRAM_BYTE_DELTA, EVENT_VRAM_BYTE_ONE, EVENT_VRAM_BYTE_AUTO, EVENT_VRAM_WORD_DELTA, EVENT_VDP_INTRAM, EVENT_VSRAM_BYTE, EVENT_VSRAM_WORD, EVENT_CRAM, EVENT_STATE };
typedef struct event_reader { uint32_t last_byte_address; uint32_t last_word_address; deserialize_buffer buffer; } event_reader;
static inline void event_log(uint8_t type, uint32_t cycle, uint8_t size, uint8_t *payload) {}
static inline void event_vram_byte(uint32_t cycle, uint16_t address, uint8_t byte, uint8_t auto_inc) {}
static inline void event_vram_word(uint32_t cycle, uint32_t address, uint16_t value) {}
static inline void event_state(uint32_t cycle, serialize_buffer *state) {}
static inline uint8_t reader_next_event(event_reader *reader, uint32_t *cycle_out) { return 0; }
#endif
