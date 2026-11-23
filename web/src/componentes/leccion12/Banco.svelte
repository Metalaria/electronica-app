<script lang="ts">
  // 1.2 «En el banco» (optional): what to put on the bench, what to measure and what it should read; the reader types
  // the measured value and the app compares it with the expected one and its tolerance, with advice when it is off.
  // Nothing is stored or reported: «Continuar» is always open, and the sheet of the «Cuaderno de prácticas» is named.
  // 1.3: «Medir con el Brymen» fills the value from the real BM869s through its BU-86X cable (only where the platform
  // can read it) and compares it at once; typing still works the same.
  // 1.4: «Medir con el FNIRSI» does the same with the real FNIRSI 2C53T's multimeter (only a «fiable» reading: AC, the
  // diode function and the capacitance unit keep their warning and are never taken).
  import { untrack } from 'svelte';
  import { brymenReal } from '../../lib/brymen-real/conexion.svelte';
  import { pantallaPara, porQueNo, textoCampo, textoPantalla } from '../../lib/brymen-real/lectura';
  import { fnirsiReal } from '../../lib/fnirsi-real/conexion.svelte';
  import { porQueNoFnirsi, tomarFnirsi } from '../../lib/fnirsi-real/comparar';
  import type { PantallaReal } from '../../lib/brymen-real/protocolo';
  import { compilarModelo, enRango, formatear, type Valores } from '../../lib/leccion11/modelo';
  import type { EstadoTarjeta } from '../../lib/leccion11/motor';
  import type { Leccion11 } from '../../lib/leccion11/tipos';
  import { leerEstimacion } from '../../lib/leccion12/prediccion';
  import type { Banco, EstadoBanco } from '../../lib/leccion12/tipos';
  import TextoVivo from '../leccion11/TextoVivo.svelte';

  let {
    leccion,
    a,
    ea,
    efectivos,
    prefijo,
    valor,
    cambiar,
  }: {
    leccion: Leccion11;
    a: Banco;
    ea: EstadoBanco;
    efectivos: Valores;
    prefijo: string;
    valor: (id: string) => string;
    cambiar: (c: Partial<EstadoTarjeta>) => void;
  } = $props();

  const mc = $derived(compilarModelo(leccion.modelo));
  const mag = $derived({ sim: [], nombre: '', unidad: a.unidad, cifras: a.cifras, recortar: false });
  const pc = (x: number) => formatear({ sim: [], nombre: '', unidad: '%', cifras: 2, recortar: true }, x * 100);
  const esperado = $derived(mc.funcion(a.esperado)(mc.evaluar(efectivos)));
  const desviacion = $derived(ea.valor != null && esperado !== 0 ? ea.valor / esperado - 1 : NaN);
  const dentro = $derived(Number.isFinite(desviacion) && Math.abs(desviacion) <= a.tol + 1e-12);
  const consejo = $derived(ea.comparado && ea.valor != null && !dentro ? a.consejos.find((c) => !c.cuando || enRango(c.cuando, { desviacion, medida: ea.valor! })) : undefined);
  const id = $derived(`${prefijo}-banco`);
  const malo = $derived(ea.texto.trim() !== '' && ea.valor == null);

  let esperandoReal = $state(false);
  let avisoReal = $state('');
  let leidoReal = $state('');
  let leidoEn = $state<'Brymen' | 'FNIRSI'>('Brymen');

  function anotarReal(p: PantallaReal, en: 'Brymen' | 'FNIRSI') {
    avisoReal = '';
    leidoReal = textoPantalla(p);
    leidoEn = en;
    cambiar({ actividad: { ...ea, texto: textoCampo(p), valor: p.valor, comparado: true } });
  }

  function tomarReal(): boolean {
    const l = brymenReal.estado === 'conectado' ? brymenReal.lectura : null;
    const p = pantallaPara(l, a.unidad);
    if (!l || !p || p.valor === null) {
      avisoReal = porQueNo(l, a.unidad);
      return false;
    }
    anotarReal(p, 'Brymen');
    return true;
  }

  // ---------------------------------------------------------------- 1.4: the real FNIRSI's multimeter
  let esperandoFn = $state(false);
  let plazoFn: ReturnType<typeof setTimeout> | undefined;
  /** How long a connected FNIRSI has to send a multimeter reading before the reason is said. */
  const PLAZO_FNIRSI_MS = 4000;

  function tomarFn() {
    esperandoFn = false;
    clearTimeout(plazoFn);
    const t = tomarFnirsi(fnirsiReal, a.unidad);
    if ('aviso' in t) avisoReal = t.aviso;
    else anotarReal(t.pantalla, 'FNIRSI');
  }

  function medirFnirsi() {
    avisoReal = '';
    leidoReal = '';
    esperandoFn = true;
    clearTimeout(plazoFn);
    plazoFn = setTimeout(() => {
      if (!esperandoFn) return;
      esperandoFn = false;
      avisoReal = fnirsiReal.estado === 'conectado' ? porQueNoFnirsi(fnirsiReal, a.unidad) : fnirsiReal.mensaje || 'No se pudo conectar el FNIRSI.';
    }, PLAZO_FNIRSI_MS);
    if (fnirsiReal.estado === 'desconectado' || fnirsiReal.estado === 'error') void fnirsiReal.conectar();
  }

  // (connecting first: the value is taken with the first multimeter reading, or the reason it cannot be is said)
  $effect(() => {
    if (!esperandoFn) return;
    const estado = fnirsiReal.estado;
    if (estado === 'conectado') {
      if (fnirsiReal.modo !== 'multimetro' || fnirsiReal.multimetroVigente()) untrack(tomarFn);
    } else if (estado === 'error') {
      esperandoFn = false;
      clearTimeout(plazoFn);
      avisoReal = fnirsiReal.mensaje || 'No se pudo conectar el FNIRSI.';
    }
  });
  $effect(() => () => clearTimeout(plazoFn));

  function medirReal() {
    avisoReal = '';
    if (brymenReal.estado === 'desconectado' || brymenReal.estado === 'error') {
      esperandoReal = true;
      void brymenReal.conectar();
      return;
    }
    if (brymenReal.estado === 'conectado') tomarReal();
    else esperandoReal = true;
  }

  // (connecting first: the value is taken with the first reading, or the reason it cannot be is said)
  $effect(() => {
    if (!esperandoReal) return;
    const estado = brymenReal.estado;
    if (estado === 'conectado' && brymenReal.lectura) {
      esperandoReal = false;
      untrack(tomarReal);
    } else if (estado === 'error' || estado === 'desconectado') {
      esperandoReal = false;
      avisoReal = brymenReal.mensaje || 'No se pudo conectar el Brymen.';
    }
  });

  function escribir(texto: string) {
    leidoReal = '';
    const v = leerEstimacion(texto, a.unidad);
    cambiar({ actividad: { ...ea, texto, valor: Number.isFinite(v) ? v : null, comparado: false } });
  }
</script>

<div class="a12 banco" data-banco>
  <p class="a12-suave">Paso opcional, para hacerlo con piezas de verdad; puede seguir sin él.</p>
  <div>
    <strong>Necesita</strong>
    <ul class="piezas">
      {#each a.piezas as p, k (k)}<li><TextoVivo texto={p} {valor} /></li>{/each}
    </ul>
  </div>
  <p><strong>Mida:</strong> <TextoVivo texto={a.medir} {valor} /></p>
  <div class="a12-ficha">
    <span class="a12-suave">Debería leer</span>
    <strong data-esperado>{formatear(mag, esperado)} ± {pc(a.tol)}</strong>
  </div>
  <label for={id}>Lo que ha medido</label>
  <div class="a12-fila">
    <input {id} class="a12-campo" type="text" inputmode="decimal" autocomplete="off" spellcheck="false" value={ea.texto} aria-invalid={malo} oninput={(ev) => escribir((ev.currentTarget as HTMLInputElement).value)} data-medida-banco />
    <span aria-hidden="true">{a.unidad}</span>
    <button type="button" class="a12-boton a12-primario" disabled={ea.valor == null} onclick={() => cambiar({ actividad: { ...ea, comparado: true } })} data-comparar>Comparar</button>
  </div>
  {#if brymenReal.disponible}
    <div class="a12-fila real">
      <button type="button" class="a12-boton" onclick={medirReal} disabled={esperandoReal} data-medir-real>Medir con el Brymen</button>
      {#if brymenReal.estado === 'conectado' || brymenReal.estado === 'sin-respuesta'}
        <button type="button" class="a12-boton" onclick={() => void brymenReal.desconectar()} data-desconectar-real>Desconectar</button>
      {/if}
    </div>
  {/if}
  {#if fnirsiReal.disponible}
    <div class="a12-fila real">
      <button type="button" class="a12-boton" onclick={medirFnirsi} disabled={esperandoFn} data-medir-fnirsi>Medir con el FNIRSI</button>
      {#if fnirsiReal.estado === 'conectado' || fnirsiReal.estado === 'reconectando'}
        <button type="button" class="a12-boton" onclick={() => void fnirsiReal.desconectar()} data-desconectar-fnirsi>Desconectar el FNIRSI</button>
      {/if}
    </div>
  {/if}
  {#if brymenReal.disponible || fnirsiReal.disponible}
    <p class="a12-suave" role="status" aria-live="polite" data-estado-real-banco>
      {#if avisoReal}{avisoReal}{:else if esperandoReal}{brymenReal.mensaje || 'Conectando con el Brymen…'}{:else if esperandoFn}{fnirsiReal.mensaje || 'Conectando con el FNIRSI…'}{:else if leidoReal}Leído en su {leidoEn}: {leidoReal}.{/if}
    </p>
  {/if}
  {#if malo}<p class="a12-no">No es un número.</p>{/if}
  {#if ea.comparado && ea.valor != null}
    <div aria-live="polite" data-comparacion={dentro ? 'bien' : 'mal'}>
      <p class={dentro ? 'a12-ok' : 'a12-no'}>
        {dentro ? 'Dentro de la tolerancia' : 'Fuera de la tolerancia'}: se desvía un {pc(Math.abs(desviacion))} {desviacion >= 0 ? 'por encima' : 'por debajo'}.
      </p>
      {#if consejo}<p data-consejo><TextoVivo texto={consejo.texto} {valor} /></p>{/if}
    </div>
  {/if}
  {#if a.ficha}
    <p class="a12-suave" data-ficha={a.ficha.n}>Cuaderno de prácticas, ficha {a.ficha.n}: «{a.ficha.titulo}».</p>
  {/if}
</div>

<style>
  .piezas {
    margin: 4px 0 0;
    padding-left: 1.2em;
  }
  label {
    font-weight: 600;
  }
  .real {
    margin-top: 6px;
  }
  input {
    flex: 1 1 8em;
    max-width: 12em;
  }
</style>
