// 1.3: the real Brymen BM869s through its BU-86X USB cable, on Android (a USB-C OTG adapter on the Xiaomi Pad 6).
// The Android WebView has no WebHID, so the app reads the cable here with android.hardware.usb and gives the page
// only the raw bytes (decoded by web/src/lib/brymen-real/protocolo.ts). Commands (Rust: src/movil.rs):
//   listar  -> { dispositivos: [{ nombre, id }] }   the BU-86X cables connected (VID 0x0820, PID 0x0001 only)
//   abrir   -> { nombre, id }                        asks the user's permission (system dialog) the first time
//   leer    -> { bytes: [...] }                      the request, then up to 24 bytes (three 8-byte reports)
//   cerrar  -> {}
// The exchange follows libsigrok (src/serial_hid_bu86x.c, src/dmm/bm86x.c; and libsigrok-0.4.0
// src/hardware/brymen-bm86x/protocol.c for the USB level): the request 00 86 66 to report 0 — through the interrupt
// OUT endpoint when the cable has one, else as a class SET_REPORT control transfer (output report, wValue 0x0200, as
// Linux hidraw does for hid_write; then feature report, wValue 0x0300, as the old libusb driver did) —, and the
// reply read from the interrupt IN endpoint. The interface is claimed with force = true, which detaches the kernel's
// HID driver. All USB I/O runs on one thread of its own, in order; the plugin's command methods only queue it.

package es.gonzalomejias.brymen

import android.app.Activity
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.hardware.usb.UsbConstants
import android.hardware.usb.UsbDevice
import android.hardware.usb.UsbDeviceConnection
import android.hardware.usb.UsbEndpoint
import android.hardware.usb.UsbInterface
import android.hardware.usb.UsbManager
import android.os.Build
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import app.tauri.annotation.Command
import app.tauri.annotation.InvokeArg
import app.tauri.annotation.TauriPlugin
import app.tauri.plugin.Invoke
import app.tauri.plugin.JSArray
import app.tauri.plugin.JSObject
import app.tauri.plugin.Plugin
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors

@InvokeArg
class LeerArgs {
  var espera: Int = 500
}

@TauriPlugin
class BrymenPlugin(private val activity: Activity) : Plugin(activity) {
  companion object {
    const val VID = 0x0820
    const val PID = 0x0001
    const val PAQUETE = 24
    const val ACCION_PERMISO = "es.gonzalomejias.brymen.PERMISO_USB"
    val PETICION = byteArrayOf(0x00, 0x86.toByte(), 0x66)

    // USB HID class requests (HID 1.11, 7.2): host to device, class, interface
    const val TIPO_SALIDA = 0x21
    const val SET_REPORT = 0x09
    const val INFORME_SALIDA = 0x0200
    const val INFORME_CARACTERISTICA = 0x0300

    // how the request went the last time: unknown, interrupt OUT, SET_REPORT output, SET_REPORT feature
    const val ENVIO_DESCONOCIDO = 0
    const val ENVIO_INTERRUPCION = 1
    const val ENVIO_SALIDA = 2
    const val ENVIO_CARACTERISTICA = 3
  }

  private val usb: UsbManager? = activity.getSystemService(Context.USB_SERVICE) as? UsbManager
  private val hilo: ExecutorService = Executors.newSingleThreadExecutor()

  // (1.3.1: written on the USB thread, read on the main thread by «abrir»: volatile, so the main thread sees them)
  @Volatile private var conexion: UsbDeviceConnection? = null
  @Volatile private var interfaz: UsbInterface? = null
  @Volatile private var entrada: UsbEndpoint? = null
  @Volatile private var salida: UsbEndpoint? = null
  @Volatile private var abierto: UsbDevice? = null
  @Volatile private var envio = ENVIO_DESCONOCIDO

  /** The permission request in flight (one at a time) and its receiver. */
  private var pendiente: Invoke? = null
  private var receptor: BroadcastReceiver? = null

  private fun cables(): List<UsbDevice> =
    usb?.deviceList?.values?.filter { it.vendorId == VID && it.productId == PID } ?: emptyList()

  private fun describir(d: UsbDevice): JSObject {
    val o = JSObject()
    val nombre = d.productName?.trim()
    o.put("nombre", if (nombre.isNullOrEmpty()) "BU-86X" else nombre)
    o.put("id", d.deviceName)
    return o
  }

  @Command
  fun listar(invoke: Invoke) {
    val lista = JSArray()
    for (d in cables()) lista.put(describir(d))
    val o = JSObject()
    o.put("dispositivos", lista)
    invoke.resolve(o)
  }

  @Command
  fun abrir(invoke: Invoke) {
    val m = usb
    if (m == null) {
      invoke.reject("Este dispositivo no ofrece USB anfitrión: no puede leer el cable del Brymen.")
      return
    }
    // (one read of each: the USB thread may be closing it meanwhile)
    val actual = abierto
    val abiertaYa = conexion
    if (actual != null && abiertaYa != null) {
      invoke.resolve(describir(actual))
      return
    }
    val d = cables().firstOrNull()
    if (d == null) {
      invoke.reject("No se encuentra el cable BU-86X: enchúfelo a la tableta con un adaptador USB-C OTG y vuelva a intentarlo.")
      return
    }
    if (m.hasPermission(d)) {
      hilo.execute { abrirCon(m, d, invoke) }
      return
    }
    pedirPermiso(m, d, invoke)
  }

  private fun pedirPermiso(m: UsbManager, d: UsbDevice, invoke: Invoke) {
    // a request still waiting (the dialog was left open) is replaced by this one
    terminarPermiso()?.reject("Se ha vuelto a pedir el permiso del cable.")
    pendiente = invoke
    val r = object : BroadcastReceiver() {
      override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != ACCION_PERMISO) return
        val inv = terminarPermiso() ?: return
        // (some systems leave the extra out: the manager's own answer is checked too)
        val concedido = intent.getBooleanExtra(UsbManager.EXTRA_PERMISSION_GRANTED, false) || m.hasPermission(d)
        if (concedido) {
          hilo.execute { abrirCon(m, d, inv) }
        } else {
          inv.reject("No se ha dado permiso para usar el cable: pulse otra vez «Conectar el Brymen real» y acepte el aviso de Android.")
        }
      }
    }
    receptor = r
    // the broadcast comes from our own PendingIntent: the receiver need not be exported
    ContextCompat.registerReceiver(activity, r, IntentFilter(ACCION_PERMISO), ContextCompat.RECEIVER_NOT_EXPORTED)
    // Android 12+: the system adds the extras, so the PendingIntent must be mutable; Android 14+: a mutable one
    // must have an explicit intent (our package)
    val banderas = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) PendingIntent.FLAG_MUTABLE else 0
    val intento = Intent(ACCION_PERMISO).setPackage(activity.packageName)
    val pi = PendingIntent.getBroadcast(activity, 0, intento, banderas)
    m.requestPermission(d, pi)
  }

  private fun terminarPermiso(): Invoke? {
    val r = receptor
    receptor = null
    if (r != null) {
      try {
        activity.unregisterReceiver(r)
      } catch (_: IllegalArgumentException) {
        // (already unregistered)
      }
    }
    val inv = pendiente
    pendiente = null
    return inv
  }

  /** On the USB thread: the HID interface claimed and its endpoints found. */
  private fun abrirCon(m: UsbManager, d: UsbDevice, invoke: Invoke) {
    cerrarTodo()
    var intf: UsbInterface? = null
    for (i in 0 until d.interfaceCount) {
      val x = d.getInterface(i)
      if (x.interfaceClass == UsbConstants.USB_CLASS_HID) {
        intf = x
        break
      }
    }
    if (intf == null && d.interfaceCount > 0) intf = d.getInterface(0)
    if (intf == null) {
      invoke.reject("El cable BU-86X no tiene la interfaz USB esperada.")
      return
    }
    var ent: UsbEndpoint? = null
    var sal: UsbEndpoint? = null
    for (k in 0 until intf.endpointCount) {
      val e = intf.getEndpoint(k)
      if (e.type != UsbConstants.USB_ENDPOINT_XFER_INT) continue
      if (e.direction == UsbConstants.USB_DIR_IN && ent == null) ent = e
      if (e.direction == UsbConstants.USB_DIR_OUT && sal == null) sal = e
    }
    if (ent == null) {
      invoke.reject("El cable BU-86X no tiene el canal de lectura esperado.")
      return
    }
    val c = m.openDevice(d)
    if (c == null) {
      invoke.reject("No se pudo abrir el cable BU-86X: desenchúfelo, vuelva a enchufarlo y acepte el permiso.")
      return
    }
    if (!c.claimInterface(intf, true)) {
      c.close()
      invoke.reject("El cable BU-86X está enchufado, pero otra aplicación lo está usando.")
      return
    }
    conexion = c
    interfaz = intf
    entrada = ent
    salida = sal
    abierto = d
    envio = ENVIO_DESCONOCIDO
    invoke.resolve(describir(d))
  }

  @Command
  fun leer(invoke: Invoke) {
    val args = invoke.parseArgs(LeerArgs::class.java)
    val espera = args.espera.coerceIn(1, 2000)
    hilo.execute { leerAhora(espera, invoke) }
  }

  private fun sigueEnchufado(): Boolean {
    val d = abierto ?: return false
    return cables().any { it.deviceName == d.deviceName }
  }

  private fun perdido(invoke: Invoke) {
    cerrarTodo()
    invoke.reject("Se ha perdido la conexión con el cable del Brymen: ¿se ha desenchufado?")
  }

  /** On the USB thread: the request, then the reply (at most one packet). */
  private fun leerAhora(espera: Int, invoke: Invoke) {
    val c = conexion
    val intf = interfaz
    val ent = entrada
    if (c == null || intf == null || ent == null) {
      invoke.reject("El cable del Brymen no está abierto.")
      return
    }
    if (!enviarPeticion(c, intf)) {
      if (!sigueEnchufado()) perdido(invoke) else invoke.reject("El cable BU-86X no acepta la petición de lectura.")
      return
    }
    val recibido = ArrayList<Int>(PAQUETE)
    val buf = ByteArray(maxOf(64, ent.maxPacketSize))
    while (recibido.size < PAQUETE) {
      val n = c.bulkTransfer(ent, buf, ent.maxPacketSize.coerceAtLeast(8), espera)
      if (n <= 0) break
      for (k in 0 until n) recibido.add(buf[k].toInt() and 0xff)
    }
    // a failed transfer and the cable gone from the bus: it was unplugged
    if (recibido.isEmpty() && !sigueEnchufado()) {
      perdido(invoke)
      return
    }
    val bytes = JSArray()
    for (b in recibido) bytes.put(b)
    val o = JSObject()
    o.put("bytes", bytes)
    invoke.resolve(o)
  }

  private fun enviarPeticion(c: UsbDeviceConnection, intf: UsbInterface): Boolean {
    val sal = salida
    val intentos = when (envio) {
      ENVIO_INTERRUPCION -> listOf(ENVIO_INTERRUPCION)
      ENVIO_SALIDA -> listOf(ENVIO_SALIDA)
      ENVIO_CARACTERISTICA -> listOf(ENVIO_CARACTERISTICA)
      else -> if (sal != null) listOf(ENVIO_INTERRUPCION, ENVIO_SALIDA, ENVIO_CARACTERISTICA) else listOf(ENVIO_SALIDA, ENVIO_CARACTERISTICA)
    }
    for (modo in intentos) {
      val n = when (modo) {
        ENVIO_INTERRUPCION -> if (sal != null) c.bulkTransfer(sal, PETICION, PETICION.size, 500) else -1
        ENVIO_SALIDA -> c.controlTransfer(TIPO_SALIDA, SET_REPORT, INFORME_SALIDA, intf.id, PETICION, PETICION.size, 500)
        else -> c.controlTransfer(TIPO_SALIDA, SET_REPORT, INFORME_CARACTERISTICA, intf.id, PETICION, PETICION.size, 500)
      }
      if (n >= 0) {
        envio = modo
        return true
      }
    }
    return false
  }

  @Command
  fun cerrar(invoke: Invoke) {
    hilo.execute {
      cerrarTodo()
      invoke.resolve(JSObject())
    }
  }

  /**
   * 1.3.1: the activity goes (closed, or recreated by the system) with the permission dialog still open: its receiver
   * is unregistered (it would leak the destroyed activity) and the request answered; the cable is closed on the USB
   * thread, and the thread ends after it.
   */
  override fun onDestroy(activity: AppCompatActivity) {
    terminarPermiso()?.reject("La aplicación se ha cerrado antes de dar el permiso del cable.")
    try {
      hilo.execute { cerrarTodo() }
    } catch (_: java.util.concurrent.RejectedExecutionException) {
      // (already shut down)
    }
    hilo.shutdown()
  }

  private fun cerrarTodo() {
    val c = conexion
    val intf = interfaz
    conexion = null
    interfaz = null
    entrada = null
    salida = null
    abierto = null
    envio = ENVIO_DESCONOCIDO
    if (c != null) {
      if (intf != null) c.releaseInterface(intf)
      c.close()
    }
  }
}
