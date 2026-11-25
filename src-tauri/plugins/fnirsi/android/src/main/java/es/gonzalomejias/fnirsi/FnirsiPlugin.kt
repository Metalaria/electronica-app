// The real FNIRSI 2C53T through «stock-link», on Android (a USB cable to the tablet or phone, which acts as USB
// host). The Android WebView has no WebHID, so the app reads the link here with android.hardware.usb and gives the
// page only the raw 64-byte reports (decoded by web/src/lib/fnirsi-real/). Commands (Rust: src/movil.rs):
//   listar  -> { dispositivos: [{ nombre, id }] }   USB 1209:0001 named «2C53T stock-link», nothing else
//   abrir   -> { nombre, id }                        asks the user's permission (system dialog) when needed
//   enviar  -> {}                                    one 64-byte request (identification or subscription only)
//   leer    -> { bytes: [...], perdidos }            the reports received since the last call, 64 bytes each
//   cerrar  -> {}
// The link is a HID interface with two interrupt endpoints (IN 0x81, OUT 0x01) and vendor-defined 64-byte reports
// without a report id; it does not implement the SET_REPORT control request, so requests go through the OUT
// endpoint. Once subscribed it streams by itself, so a thread of its own reads the IN endpoint all the time and
// queues the reports; `leer` only empties the queue. The interface is claimed with force = true, which detaches
// the kernel's HID driver.
//
// The instrument drops off the bus and comes back about a second later whenever its mode changes (multimeter,
// oscilloscope, generator): that is FNIRSI's own firmware disconnecting USB. The page reconnects by calling `abrir`
// again. For the system it is a newly attached device, and a USB permission is given to one appearance of a device;
// 1.4: so the app's activity declares the link (USB_DEVICE_ATTACHED with a device filter, web/scripts/android-usb.mjs),
// which makes the permission dialog offer to always use the app with it: once the reader ticks that box, the
// permission holds whenever the link comes back and `hasPermission` is true without any dialog.

package es.gonzalomejias.fnirsi

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
import java.util.ArrayDeque
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
import java.util.concurrent.locks.ReentrantLock
import kotlin.concurrent.withLock

@InvokeArg
class EnviarArgs {
  var bytes: IntArray = IntArray(0)
}

@InvokeArg
class LeerArgs {
  var espera: Int = 100
  var maximo: Int = 64
}

@TauriPlugin
class FnirsiPlugin(private val activity: Activity) : Plugin(activity) {
  companion object {
    const val VID = 0x1209
    const val PID = 0x0001
    const val PRODUCTO = "2C53T stock-link"
    const val INFORME = 64
    const val ACCION_PERMISO = "es.gonzalomejias.fnirsi.PERMISO_USB"

    // (2.1: what the page may send is decided by Peticiones.permitida: identification, subscription, the
    // generator's custom wave and the read of its table only)

    // reports kept for the page; a full queue is emptied whole (half a record is of no use)
    const val COLA_MAXIMA = 4096
    const val ESPERA_LECTURA_MS = 100
    // failed reads in a row before checking that the instrument is still on the bus (a timeout and an error
    // both return a negative count)
    const val FALLOS_ANTES_DE_COMPROBAR = 10
    // 1.4: a link just back on the bus may get the permission the reader made permanent a moment after it is listed
    // (the system grants it while it handles the attachment): one more look before showing the dialog
    const val GRACIA_PERMISO_MS = 400L

    const val PERDIDO = "Se ha perdido la conexión con el FNIRSI: ¿ha cambiado de modo, se ha apagado o se ha desenchufado?"
  }

  private val usb: UsbManager? = activity.getSystemService(Context.USB_SERVICE) as? UsbManager
  /** Opening, closing and sending, in order. */
  private val hilo: ExecutorService = Executors.newSingleThreadExecutor()
  /** `leer` waits for reports here, so that a waiting read never delays a request. */
  private val lectores: ExecutorService = Executors.newSingleThreadExecutor()

  @Volatile private var conexion: UsbDeviceConnection? = null
  @Volatile private var interfaz: UsbInterface? = null
  @Volatile private var salida: UsbEndpoint? = null
  @Volatile private var abierto: UsbDevice? = null

  /** The reader thread and what it shares with `leer`, under `candado`. */
  private var lector: Thread? = null
  @Volatile private var leyendo = false
  private val candado = ReentrantLock()
  private val hayDatos = candado.newCondition()
  private val cola = ArrayDeque<ByteArray>()
  private var perdidos = 0
  private var errorLector: String? = null

  /** The permission request in flight (one at a time) and its receiver (set on the USB thread, read on the main one). */
  @Volatile private var pendiente: Invoke? = null
  @Volatile private var receptor: BroadcastReceiver? = null

  private fun enlaces(): List<UsbDevice> =
    usb?.deviceList?.values?.filter { it.vendorId == VID && it.productId == PID && it.productName?.trim() == PRODUCTO } ?: emptyList()

  private fun describir(d: UsbDevice): JSObject {
    val o = JSObject()
    o.put("nombre", d.productName?.trim() ?: PRODUCTO)
    o.put("id", d.deviceName)
    return o
  }

  @Command
  fun listar(invoke: Invoke) {
    val lista = JSArray()
    for (d in enlaces()) lista.put(describir(d))
    val o = JSObject()
    o.put("dispositivos", lista)
    invoke.resolve(o)
  }

  @Command
  fun abrir(invoke: Invoke) {
    val m = usb
    if (m == null) {
      invoke.reject("Este dispositivo no ofrece USB anfitrión: no puede leer el FNIRSI.")
      return
    }
    val actual = abierto
    if (actual != null && conexion != null && leyendo && enlaces().any { it.deviceName == actual.deviceName }) {
      invoke.resolve(describir(actual))
      return
    }
    val d = enlaces().firstOrNull()
    if (d == null) {
      invoke.reject("No se encuentra el FNIRSI 2C53T: enchúfelo a la tableta, enciéndalo en multímetro, osciloscopio o generador (no en «USB Sharing») y compruebe que lleva el firmware con el enlace.")
      return
    }
    if (m.hasPermission(d)) {
      hilo.execute { abrirCon(m, d, invoke) }
      return
    }
    hilo.execute {
      try {
        Thread.sleep(GRACIA_PERMISO_MS)
      } catch (_: InterruptedException) {
        // (the app is closing)
      }
      if (m.hasPermission(d)) abrirCon(m, d, invoke) else pedirPermiso(m, d, invoke)
    }
  }

  private fun pedirPermiso(m: UsbManager, d: UsbDevice, invoke: Invoke) {
    // a request still waiting (the dialog was left open) is replaced by this one
    terminarPermiso()?.reject("Se ha vuelto a pedir el permiso del FNIRSI.")
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
          inv.reject("No se ha dado permiso para usar el FNIRSI: pulse otra vez «Conectar el FNIRSI real» y acepte el aviso de Android. Si el aviso ofrece usar siempre la aplicación con este dispositivo, márquelo: así no se lo volverá a preguntar en cada cambio de modo.")
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

  /** On the USB thread: the HID interface claimed, its two endpoints found and the reader thread started. */
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
    if (intf == null) {
      invoke.reject("El FNIRSI no tiene la interfaz USB esperada.")
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
    if (ent == null || sal == null) {
      invoke.reject("El FNIRSI no tiene los dos canales USB esperados.")
      return
    }
    val c = m.openDevice(d)
    if (c == null) {
      invoke.reject("No se pudo abrir el FNIRSI: desenchúfelo, vuelva a enchufarlo y acepte el permiso.")
      return
    }
    if (!c.claimInterface(intf, true)) {
      c.close()
      invoke.reject("El FNIRSI está enchufado, pero otra aplicación lo está usando.")
      return
    }
    candado.withLock {
      cola.clear()
      perdidos = 0
      errorLector = null
    }
    conexion = c
    interfaz = intf
    salida = sal
    abierto = d
    leyendo = true
    val entrada: UsbEndpoint = ent
    val t = Thread({ leerSiempre(c, entrada) }, "fnirsi-usb")
    t.isDaemon = true
    lector = t
    t.start()
    invoke.resolve(describir(d))
  }

  private fun sigueEnchufado(): Boolean {
    val d = abierto ?: return false
    return enlaces().any { it.deviceName == d.deviceName }
  }

  /** The reader thread: every input report into the queue, until told to stop or the instrument goes away. */
  private fun leerSiempre(c: UsbDeviceConnection, entrada: UsbEndpoint) {
    val buf = ByteArray(maxOf(INFORME, entrada.maxPacketSize))
    var fallos = 0
    while (leyendo) {
      val n = c.bulkTransfer(entrada, buf, INFORME, ESPERA_LECTURA_MS)
      if (n == INFORME) {
        fallos = 0
        val informe = buf.copyOf(INFORME)
        candado.withLock {
          if (cola.size >= COLA_MAXIMA) {
            perdidos += cola.size
            cola.clear()
          }
          cola.addLast(informe)
          hayDatos.signalAll()
        }
      } else if (n < 0) {
        fallos++
        if (fallos >= FALLOS_ANTES_DE_COMPROBAR) {
          fallos = 0
          if (leyendo && !sigueEnchufado()) {
            candado.withLock {
              errorLector = PERDIDO
              hayDatos.signalAll()
            }
            return
          }
        }
      }
      // (a report of another size is not the link's: ignored)
    }
  }

  @Command
  fun enviar(invoke: Invoke) {
    val args = invoke.parseArgs(EnviarArgs::class.java)
    val bytes = args.bytes
    if (bytes.isEmpty() || bytes.size > INFORME) {
      invoke.reject("Petición al FNIRSI de tamaño incorrecto.")
      return
    }
    if (!Peticiones.permitida(bytes)) {
      invoke.reject(Peticiones.RECHAZO)
      return
    }
    val informe = ByteArray(INFORME)
    for (k in bytes.indices) informe[k] = bytes[k].toByte()
    hilo.execute { enviarAhora(informe, invoke) }
  }

  /** On the USB thread: the request through the interrupt OUT endpoint. */
  private fun enviarAhora(informe: ByteArray, invoke: Invoke) {
    val c = conexion
    val sal = salida
    if (c == null || sal == null) {
      invoke.reject("El FNIRSI no está abierto.")
      return
    }
    val n = c.bulkTransfer(sal, informe, INFORME, 500)
    if (n == INFORME) {
      invoke.resolve(JSObject())
      return
    }
    if (!sigueEnchufado()) {
      cerrarTodo()
      invoke.reject(PERDIDO)
    } else {
      invoke.reject("El FNIRSI no acepta la petición: ¿está ocupado o colgado? Desenchúfelo y vuelva a enchufarlo.")
    }
  }

  @Command
  fun leer(invoke: Invoke) {
    val args = invoke.parseArgs(LeerArgs::class.java)
    val espera = args.espera.coerceIn(0, 2000)
    val maximo = args.maximo.coerceIn(1, 512)
    lectores.execute { leerAhora(espera, maximo, invoke) }
  }

  /** On the readers' thread: waits for the first report (at most `espera` ms) and empties the queue. */
  private fun leerAhora(espera: Int, maximo: Int, invoke: Invoke) {
    if (conexion == null) {
      invoke.reject("El FNIRSI no está abierto.")
      return
    }
    val informes = ArrayList<ByteArray>()
    var contados = 0
    var error: String? = null
    candado.withLock {
      if (cola.isEmpty() && errorLector == null && espera > 0) {
        try {
          hayDatos.await(espera.toLong(), TimeUnit.MILLISECONDS)
        } catch (_: InterruptedException) {
          // (the app is closing)
        }
      }
      while (informes.size < maximo && !cola.isEmpty()) informes.add(cola.removeFirst())
      contados = perdidos
      perdidos = 0
      if (informes.isEmpty()) error = errorLector
    }
    val motivo = error
    if (motivo != null) {
      hilo.execute { cerrarTodo() }
      invoke.reject(motivo)
      return
    }
    val bytes = JSArray()
    for (informe in informes) for (b in informe) bytes.put(b.toInt() and 0xff)
    val o = JSObject()
    o.put("bytes", bytes)
    o.put("perdidos", contados)
    invoke.resolve(o)
  }

  @Command
  fun cerrar(invoke: Invoke) {
    hilo.execute {
      cerrarTodo()
      invoke.resolve(JSObject())
    }
  }

  /**
   * 1.4 (as the Brymen's, 1.3.1): the activity goes (closed, or recreated by the system) with the permission dialog
   * still open: its receiver is unregistered (it would leak the destroyed activity) and the request answered; the link
   * is closed on the USB thread, and both threads end after it.
   */
  override fun onDestroy(activity: AppCompatActivity) {
    terminarPermiso()?.reject("La aplicación se ha cerrado antes de dar el permiso del FNIRSI.")
    try {
      hilo.execute { cerrarTodo() }
    } catch (_: java.util.concurrent.RejectedExecutionException) {
      // (already shut down)
    }
    hilo.shutdown()
    lectores.shutdown()
  }

  /** On the USB thread: the reader stopped, the interface released, the connection closed. */
  private fun cerrarTodo() {
    leyendo = false
    val t = lector
    lector = null
    if (t != null && t !== Thread.currentThread()) {
      try {
        // (the reader's transfer waits at most ESPERA_LECTURA_MS)
        t.join(1000)
      } catch (_: InterruptedException) {
        // (the app is closing)
      }
    }
    val c = conexion
    val intf = interfaz
    conexion = null
    interfaz = null
    salida = null
    abierto = null
    if (c != null) {
      if (intf != null) c.releaseInterface(intf)
      c.close()
    }
  }
}
