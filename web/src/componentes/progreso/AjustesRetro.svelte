<script lang="ts">
  // «Aa» (0.11): sounds and vibration of the learning feedback (each one on its own, on by default), and the daily
  // reminder — a local notification at the chosen time, Android only (elsewhere the row says «Solo en Android»).
  // Device-only preferences (`prefs`), like the theme. The reminder module is loaded only when it is used.
  import { usuario, ponerSonido, ponerVibracion, ponerRecordatorio } from '../../lib/usuario.svelte';
  import { enTauri } from '../../lib/almacen';
  import { retro } from '../../lib/aprendizaje/retroalimentacion';

  const HORA_DEFECTO = '20:00';
  const android = enTauri() && /Android/i.test(navigator.userAgent);

  const sonido = $derived(usuario.prefs.sonido !== false);
  const vibracion = $derived(usuario.prefs.vibracion !== false);
  const recordatorio = $derived(usuario.prefs.recordatorio ?? { activo: false, hora: HORA_DEFECTO });

  let ocupado = $state(false);
  let aviso = $state('');

  function cambiarSonido(v: boolean) {
    ponerSonido(v);
    if (v) retro('acierto');
  }

  function cambiarVibracion(v: boolean) {
    ponerVibracion(v);
    if (v) retro('paso');
  }

  async function aplicar(activo: boolean, hora: string, interruptor?: HTMLInputElement) {
    if (ocupado) return;
    ocupado = true;
    aviso = '';
    try {
      const { aplicarRecordatorio } = await import('../../lib/aprendizaje/recordatorio');
      const r = await aplicarRecordatorio(activo, hora);
      if (r === 'programado') {
        ponerRecordatorio({ activo, hora });
        aviso = activo ? `Le avisaremos cada día a las ${hora}.` : '';
      } else if (r === 'denegado') {
        ponerRecordatorio({ activo: false, hora });
        aviso = 'Android no deja que la aplicación muestre notificaciones. Puede permitirlas en los ajustes del sistema, en Aplicaciones.';
      } else {
        aviso = 'No se pudo programar el recordatorio. Pruebe otra vez.';
      }
    } finally {
      ocupado = false;
      // the switch shows what was stored (it stays off when Android refuses)
      if (interruptor) interruptor.checked = usuario.prefs.recordatorio?.activo ?? false;
    }
  }
</script>

<div class="retro">
<div class="grupo" data-ajustes-retro>
  <span class="etiqueta" id="et-retro">Sonido y vibración</span>
  <label class="fila">
    <input type="checkbox" role="switch" checked={sonido} onchange={(e) => cambiarSonido(e.currentTarget.checked)} data-ajuste-sonido />
    <span>Sonidos al acertar, fallar y terminar</span>
  </label>
  <label class="fila">
    <input type="checkbox" role="switch" checked={vibracion} onchange={(e) => cambiarVibracion(e.currentTarget.checked)} data-ajuste-vibracion />
    <span>Vibración</span>
  </label>
</div>

<div class="grupo" data-ajustes-recordatorio>
  <span class="etiqueta" id="et-recordatorio">Recordatorio diario</span>
  {#if android}
    <label class="fila">
      <input
        type="checkbox"
        role="switch"
        checked={recordatorio.activo}
        disabled={ocupado}
        onchange={(e) => aplicar(e.currentTarget.checked, recordatorio.hora, e.currentTarget)}
        data-ajuste-recordatorio
      />
      <span>Aviso diario para estudiar unos minutos</span>
    </label>
    {#if recordatorio.activo}
      <label class="fila hora">
        <span>Hora del aviso</span>
        <input
          type="time"
          value={recordatorio.hora}
          disabled={ocupado}
          onchange={(e) => e.currentTarget.value && aplicar(true, e.currentTarget.value)}
          data-ajuste-hora
        />
      </label>
    {/if}
    {#if aviso}<p class="ayuda" role="status" data-aviso-recordatorio>{aviso}</p>{/if}
  {:else}
    <p class="ayuda solo-android" data-recordatorio-no>Solo en Android: un aviso a la hora que elija para estudiar unos minutos.</p>
  {/if}
</div>
</div>

<style>
  .retro {
    margin: 16px 0;
  }
  .grupo + .grupo {
    margin-top: 16px;
  }
  .etiqueta {
    display: block;
    margin-bottom: 4px;
    color: var(--tinta-tenue);
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }
  .fila {
    display: flex;
    align-items: center;
    gap: 10px;
    min-height: 44px;
    color: var(--tinta);
    font-size: 15px;
    cursor: pointer;
  }
  .fila input[type='checkbox'] {
    width: 20px;
    height: 20px;
    flex-shrink: 0;
    accent-color: var(--acento);
  }
  .hora {
    justify-content: space-between;
  }
  .hora input {
    min-height: 44px;
    padding: 0 10px;
    border: 1px solid var(--linea);
    border-radius: 10px;
    background: var(--fondo);
    color: var(--tinta);
    font-family: var(--sans);
    font-size: 16px;
  }
  .ayuda {
    margin: 4px 0 0;
    color: var(--tinta-suave);
    font-size: 13px;
    line-height: 1.4;
  }
</style>
