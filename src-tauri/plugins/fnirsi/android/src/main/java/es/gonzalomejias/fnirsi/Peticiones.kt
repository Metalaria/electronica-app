// The requests the page may send to the FNIRSI's link (2.1). The same rule as informe_de/permitida in
// src-tauri/plugins/fnirsi/src/lib.rs (desktop), kept apart from the plugin so that it has no Android dependency.
// Layout of a request (web/src/lib/fnirsi-real/protocolo.ts): [0] order, [1] sequence, [2] argument, [4..8] a
// little-endian u32 (a wave's first position, a read's address). Let through:
//   - 0x01 identification and 0x03 subscription;
//   - 0x04 the generator's custom wave (link patch 4, the owner's decision of 2026-11-25): [2] samples from 1 to 28,
//     position + samples <= 100;
//   - 0x02 a read, only of the wave table, to check a wave that was sent: [2] bytes from 1 to 56, address >=
//     0x20000F5A and address + bytes <= 0x20000F5A + 200.
// Anything else is refused. Unsigned 64-bit arithmetic: an address near 2^32 cannot wrap into the window.
package es.gonzalomejias.fnirsi

object Peticiones {
  const val ORDEN_INFO = 0x01
  const val ORDEN_LEER = 0x02
  const val ORDEN_SUSCRIBIR = 0x03
  const val ORDEN_ONDA = 0x04
  const val MUESTRAS_ONDA = 28L
  const val POSICIONES_ONDA = 100L
  const val LARGO_LECTURA = 56L
  const val DIR_TABLA_ONDA = 0x20000F5AL
  const val LARGO_TABLA_ONDA = 200L
  const val RECHAZO =
    "La aplicación solo envía al FNIRSI las órdenes de identificación y de suscripción, la onda a medida del generador y la lectura de su tabla."

  /** Little-endian u32 at bytes[4..8], as a non-negative Long; null when the request is too short. */
  private fun u32En(bytes: IntArray): Long? {
    if (bytes.size < 8) return null
    var x = 0L
    for (k in 0 until 4) x = x or ((bytes[4 + k].toLong() and 0xffL) shl (8 * k))
    return x
  }

  /** Whether a request (bytes 0..255 each) may be sent. */
  fun permitida(bytes: IntArray): Boolean {
    if (bytes.isEmpty()) return false
    return when (bytes[0] and 0xff) {
      ORDEN_INFO, ORDEN_SUSCRIBIR -> true
      ORDEN_ONDA -> {
        if (bytes.size < 3) return false
        val n = (bytes[2] and 0xff).toLong()
        val posicion = u32En(bytes) ?: return false
        n in 1..MUESTRAS_ONDA && posicion + n <= POSICIONES_ONDA
      }
      ORDEN_LEER -> {
        if (bytes.size < 3) return false
        val n = (bytes[2] and 0xff).toLong()
        val dir = u32En(bytes) ?: return false
        n in 1..LARGO_LECTURA && dir >= DIR_TABLA_ONDA && dir + n <= DIR_TABLA_ONDA + LARGO_TABLA_ONDA
      }
      else -> false
    }
  }
}
