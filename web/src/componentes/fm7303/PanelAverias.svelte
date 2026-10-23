<script lang="ts">
  // «Averías»: the troubleshooting of section 15.12. A fault the book lists is hidden in the kit; the reader sees
  // the symptom, measures with the multimeter and the oscilloscope, uses the two quick tests of the book (the
  // tweezers on TP2 and the audio injected into the amplifier), and then points at the faulty part.
  import Shuffle from '@lucide/svelte/icons/shuffle';
  import Crosshair from '@lucide/svelte/icons/crosshair';
  import type { EstadoKit } from './estado.svelte';
  import type { Averia } from './tipos';
  import { si } from './formato';
  import Frontal from './Frontal.svelte';
  import Mandos from './Mandos.svelte';
  import Multimetro from './Multimetro.svelte';
  import Osciloscopio from './Osciloscopio.svelte';
  import Cita from './ui/Cita.svelte';

  let { k, respuesta }: { k: EstadoKit; respuesta: { ref: string; n: number } | null } = $props();

  const av = $derived(k.averia);
  let intentos = $state<string[]>([]);
  let resuelta = $state(false);
  let solucion = $state(false);
  let prueba = $state<{ que: string; resultado: string } | null>(null);

  function elegir(a: Averia) {
    k.inyectar(a);
    intentos = [];
    resuelta = false;
    solucion = false;
    prueba = null;
    k.modo = 'normal';
  }
  function azar() {
    const lista = k.kit.averias.filter((x) => x.id !== av?.id);
    elegir(lista[Math.floor(Math.random() * lista.length)]!);
  }
  function salir() {
    k.inyectar(null);
    k.modo = 'normal';
  }

  // A part pointed at on the schematic (Kit.svelte hands the tap over).
  let ultima = 0;
  $effect(() => {
    const r = respuesta;
    if (!r || r.n === ultima || !av) return;
    ultima = r.n;
    if (av.aceptar.includes(r.ref)) {
      resuelta = true;
      k.modo = 'normal';
      k.elegirPieza(r.ref);
    } else {
      if (!intentos.includes(r.ref)) intentos = [...intentos, r.ref];
      k.modo = 'normal';
    }
  });

  function pinzas() {
    const r = k.radio;
    const sigue = r.alimentada && r.decodificador;
    prueba = {
      que: 'Pinzas en TP2 (entrada de FI)',
      resultado: !r.alimentada
        ? 'No se oye nada.'
        : !sigue
          ? 'No se oye nada por los altavoces.'
          : av?.senal.canal_r === false
            ? 'Siseo claro, pero solo por el altavoz izquierdo.'
            : 'Siseo claro por los altavoces: la FI, la detección y el audio están vivos.',
    };
  }
  function inyectar() {
    const r = k.radio;
    prueba = {
      que: 'Tono de 1 kHz en la entrada del TEA2025',
      resultado: !r.alimentada
        ? 'No suena: el amplificador no tiene alimentación.'
        : av?.senal.canal_r === false
          ? 'El tono suena por el altavoz izquierdo, pero no por el derecho.'
          : 'El tono suena limpio por los dos altavoces: la cadena de audio está bien y el problema está antes.',
    };
  }
</script>

<div class="panel-averias">
  {#if !av}
    <p class="intro">
      El receptor es una cadena: se busca en qué punto desaparece la señal (bisección). Cada síntoma apunta a una etapa
      <Cita cita={k.kit.citas['tabla_nada']} />, y dos pruebas rápidas parten el aparato en dos: inyectar audio en el amplificador
      <Cita cita={k.kit.citas['inyectar']} corto /> y tocar TP2 con unas pinzas <Cita cita={k.kit.citas['pinzas']} corto />.
      Elija un caso: la avería queda oculta en el kit simulado.
    </p>
    <button type="button" class="principal" onclick={azar}><Shuffle size={17} /> Caso al azar</button>
    <ol class="casos">
      {#each k.kit.averias as a, i (a.id)}
        <li><button type="button" onclick={() => elegir(a)} data-averia={a.id}><b>Caso {i + 1}.</b> {a.sintoma}</button></li>
      {/each}
    </ol>
  {:else}
    <section class="sintoma">
      <h3>Síntoma</h3>
      <p>{av.sintoma}</p>
      <div class="botones">
        <button type="button" onclick={salir}>Otro caso</button>
        {#if !resuelta}
          <button type="button" class="principal" class:activo={k.modo === 'senalar'} onclick={() => (k.modo = k.modo === 'senalar' ? 'normal' : 'senalar')} data-senalar>
            <Crosshair size={17} /> {k.modo === 'senalar' ? 'Toque la pieza en el esquema…' : 'Señalar la pieza averiada'}
          </button>
        {/if}
      </div>
      {#if intentos.length && !resuelta}
        <p class="intento">No es {intentos.join(', ')}. Siga midiendo: compare con el mapa de tensiones y los puntos de prueba.</p>
      {/if}
      {#if resuelta || solucion}
        <div class="resuelta" data-resuelta={resuelta ? 'si' : 'no'}>
          <p><b>{resuelta ? '¡Encontrada!' : 'Solución:'} {av.titulo}.</b> {av.explicacion} <Cita cita={k.kit.citas[av.cita]} /></p>
        </div>
      {:else}
        <button type="button" class="enlace" onclick={() => (solucion = true)}>Ver la solución</button>
      {/if}
    </section>

    <Frontal {k} />

    <section>
      <h3>Pruebas rápidas</h3>
      <div class="botones">
        <button type="button" onclick={pinzas}>Tocar TP2 con unas pinzas</button>
        <button type="button" onclick={inyectar}>Inyectar 1 kHz en el TEA2025</button>
      </div>
      {#if prueba}<p class="prueba"><b>{prueba.que}:</b> {prueba.resultado}</p>{/if}
      {#if k.dc?.consumo != null}<p class="prueba">Consumo de la fuente: <b>{si(k.dc.consumo, 'A', 3)}</b> <Cita cita={k.kit.citas['consumo']} corto /></p>{/if}
    </section>

    <section>
      <h3>Multímetro</h3>
      <Multimetro {k} />
    </section>
    <section>
      <h3>Osciloscopio</h3>
      <Osciloscopio {k} />
    </section>
    {#if k.medidas.length}
      <section>
        <h3>Medidas anotadas</h3>
        <ol class="medidas">
          {#each k.medidas as m (m.t)}<li><span>{m.donde}</span><b>{m.valor}</b></li>{/each}
        </ol>
      </section>
    {/if}
    {#if resuelta && (av.senal.w1 != null || av.senal.w3 != null || av.senal.l1 != null)}
      <section>
        <h3>Corregir el ajuste</h3>
        <Mandos {k} solo={av.senal.w1 != null ? ['w1'] : av.senal.w3 != null ? ['monitor', 'w3'] : ['l1', 'c4a']} />
      </section>
    {/if}
  {/if}
</div>

<style>
  .panel-averias {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .intro,
  .sintoma p,
  .prueba,
  .intento {
    margin: 0;
    font-size: 13.5px;
    line-height: 1.45;
  }
  h3 {
    margin: 0 0 6px;
    font-size: 15px;
    color: var(--titulos);
  }
  .sintoma {
    padding: 10px 12px;
    border: 1px solid var(--acento-borde);
    border-radius: 12px;
    background: var(--acento-tinte);
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .sintoma p {
    font-size: 15px;
  }
  .botones {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  button {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    min-height: 44px;
    padding: 0 14px;
    border: 1px solid var(--linea);
    border-radius: 10px;
    background: var(--superficie);
    color: var(--tinta);
    font: 600 13.5px var(--sans);
    cursor: pointer;
    text-align: left;
  }
  .principal {
    border-color: var(--acento);
    background: var(--acento);
    color: #fff;
    align-self: flex-start;
  }
  .principal.activo {
    background: #b03a2e;
    border-color: #b03a2e;
  }
  .casos {
    margin: 0;
    padding: 0;
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .casos button {
    width: 100%;
    min-height: 48px;
    padding: 8px 12px;
    font-weight: 400;
    line-height: 1.35;
  }
  .intento {
    color: #b03a2e;
  }
  .resuelta {
    padding: 8px 10px;
    border-radius: 8px;
    background: color-mix(in srgb, #1e8449 15%, var(--superficie));
  }
  .enlace {
    align-self: flex-start;
    min-height: 36px;
    padding: 0 4px;
    border: 0;
    background: none;
    color: var(--acento);
    text-decoration: underline;
    font-weight: 500;
  }
  .prueba {
    margin-top: 6px;
  }
  .medidas {
    margin: 0;
    padding-left: 20px;
    font-size: 13px;
    font-variant-numeric: tabular-nums;
  }
  .medidas li span {
    color: var(--tinta-suave);
    margin-right: 8px;
  }
</style>
