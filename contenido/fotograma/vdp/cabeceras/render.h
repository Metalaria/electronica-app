// Minimal stand-in for BlastEm's render.h: the frame goes to the trace tool's buffer.
#ifndef RENDER_H_
#define RENDER_H_
#include <stdint.h>
#define FRAMEBUFFER_ODD 0
#define FRAMEBUFFER_EVEN 1
#define FRAMEBUFFER_USER_START 2
typedef enum { VID_NTSC, VID_PAL, NUM_VID_STD } vid_std;
typedef void (*window_close_handler)(uint8_t which);
uint32_t render_map_color(uint8_t r, uint8_t g, uint8_t b);
uint32_t *render_get_framebuffer(uint8_t which, int *pitch);
void render_framebuffer_updated(uint8_t which, int width);
uint8_t render_get_active_framebuffer(void);
uint32_t render_overscan_top(void);
uint32_t render_overscan_bot(void);
uint32_t render_overscan_left(void);
uint8_t render_create_window(char *caption, uint32_t width, uint32_t height, window_close_handler close_handler);
void render_destroy_window(uint8_t which);
void render_set_video_standard(vid_std std);
#endif
