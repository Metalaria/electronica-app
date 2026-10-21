<script lang="ts">
  // The colour code (book 2.4, IEC 60062) with an animated reading: band by band, the value builds up.
  // Bands can be changed by tapping them on the resistor or with the swatches; presets are the book's examples.
  import Escena from '../ui/Escena.svelte';
  import Marco from '../ui/Marco.svelte';
  import Selector from '../ui/Selector.svelte';
  import { Reloj } from '../nucleo/reloj.svelte';
  import { txt, txtRico, fondo, flecha, rr, type Vista } from '../nucleo/dibujo';
  import { resistenciaAxial } from '../nucleo/piezas';
  import { alfa, paleta } from '../nucleo/paleta';
  import { COLORES, E24 } from '../nucleo/fisica';
  import { si, siCorto, num, superindice } from '../nucleo/formato';
  import { app } from '../../../lib/estado.svelte';
  import type { EventoPuntero } from '../ui/Escena.svelte';

  const reloj = new Reloj();
  const pal = $derived(paleta(app.tema));

  let cinco = $state<4 | 5>(4);
  // Indices into COLORES.
  let d = $state([4, 7, 0]);
  let mult = $state(2);
  let tol = $state(10);

  const TOLERANCIAS = [1, 2, 5, 6, 7, 8, 10, 11];
  const MULTS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];

  const digitos = $derived(cinco === 5 ? d : d.slice(0, 2));
  const exponente = $derived(mult === 10 ? -1 : mult === 11 ? -2 : mult);
  const base = $derived(digitos.reduce((a, x) => a * 10 + x, 0));
  const valor = $derived(base * 10 ** exponente);
  const tolerancia = $derived(COLORES[tol]!.tol ?? 20);
  const indicesBandas = $derived([...digitos, mult, tol]);

  function normalizado(x: number): boolean {
    if (!(x > 0)) return false;
    const m = x / 10 ** Math.floor(Math.log10(x) + 1e-9);
    return E24.some((e) => Math.abs(e - m) < 0.005);
  }

  function preset(bandas: number[]): void {
    if (bandas.length === 5) {
      cinco = 5;
      d = bandas.slice(0, 3);
      mult = bandas[3]!;
      tol = bandas[4]!;
    } else {
      cinco = 4;
      d = [bandas[0]!, bandas[1]!, d[2] ?? 0];
      mult = bandas[2]!;
      tol = bandas[3]!;
    }
  }

  // Animated reading: the highlight walks along the bands.
  let t = 0;
  function paso(dt: number): void {
    t += dt;
  }
  const PERIODO = 1.1;

  /** «×100», «×0,1», «×10⁵». */
  function mx(e: number): string {
    if (e === -1) return '×0,1';
    if (e === -2) return '×0,01';
    return e <= 3 ? `×${10 ** e}` : `×10${superindice(e)}`;
  }

  // Band positions along the body (tolerance band set apart).
  const posiciones = $derived(cinco === 5 ? [0.2, 0.31, 0.42, 0.53, 0.8] : [0.22, 0.34, 0.46, 0.8]);
  let geom = { x0: 0, x1: 0, yc: 0, r: 0 };

  function dibujar(v: Vista): void {
    const { ctx } = v;
    const p = pal;
    void [cinco, d, mult, tol];
    fondo(v);
    const est = v.estrecho;
    const x0 = v.w * 0.16;
    const x1 = v.w * 0.84;
    const yc = est ? 170 : 150;
    const r = est ? 62 : 58;
    geom = { x0, x1, yc, r };
    const n = indicesBandas.length;
    const paso = Math.floor(t / PERIODO) % (n + 2);
    const brillos = indicesBandas.map((_, i) => (i === paso ? 0.6 + 0.4 * Math.sin(t * 8) : 0));
    resistenciaAxial(ctx, p, {
      x0,
      x1,
      yc,
      r,
      cuerpo: cinco === 5 ? p.lacaAzul : p.laca,
      bandas: indicesBandas.map((c, i) => ({ f: posiciones[i]!, color: COLORES[c]!.color, ancho: 0.065 })),
      patas: [10, v.w - 10],
      brilloBandas: brillos,
    });
    // Reading direction.
    flecha(ctx, x0 + 10, yc - r - 26, x0 + (x1 - x0) * 0.6, yc - r - 26, p.acento, 2.2, 10);
    txt(v, 'sentido de lectura', x0 + 10, yc - r - 46, { alin: 'left', tam: 13, peso: 700, color: p.acento });
    txt(v, 'separada', x0 + (x1 - x0) * posiciones[n - 1]!, yc - r - 26, { tam: 12, color: p.suave });

    // Label under each band.
    const yL = yc + r + (est ? 34 : 30);
    indicesBandas.forEach((c, i) => {
      const x = x0 + (x1 - x0) * posiciones[i]!;
      const col = COLORES[c]!;
      const esMult = i === n - 2;
      const esTol = i === n - 1;
      const s = esTol ? `±${num(col.tol ?? 20, col.tol && col.tol < 1 ? 2 : 0)} %` : esMult ? mx(c === 10 ? -1 : c === 11 ? -2 : c) : String(col.digito);
      ctx.strokeStyle = alfa(p.suave, 0.5);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, yc + r + 4);
      ctx.lineTo(x, yL - 12);
      ctx.stroke();
      txt(v, s, x, yL, { tam: est ? 15 : 16, peso: 800, color: i === paso ? p.acento : p.tinta });
      txt(v, col.nombre, x, yL + 20 + (est && i % 2 ? 16 : 0), { tam: 11.5, color: p.suave });
    });

    // Running computation.
    const yR = v.h - (est ? 90 : 72);
    let parcial = '';
    const k = Math.min(paso, n);
    if (k === 0) parcial = String(digitos[0]);
    else if (k < digitos.length) parcial = digitos.slice(0, k + 1).join('');
    else if (k === digitos.length) parcial = `${base} ${mx(exponente)} = ${siCorto(valor, 'Ω', 3)}`;
    else parcial = `${siCorto(valor, 'Ω', 3)} ±${num(tolerancia, tolerancia < 1 ? 2 : 0)} %`;
    rr(ctx, v.w / 2 - 210, yR - 22, 420, 44, 22);
    ctx.fillStyle = alfa(p.acento, 0.1);
    ctx.fill();
    txt(v, parcial, v.w / 2, yR, { tam: 20, peso: 800, color: p.acento });
    const min = valor * (1 - tolerancia / 100);
    const max = valor * (1 + tolerancia / 100);
    txtRico(v, `entre ${si(min, 'Ω', 4)} y ${si(max, 'Ω', 4)}`, v.w / 2, yR + 40, { tam: 13.5, color: p.suave });
  }

  function puntero(e: EventoPuntero): boolean | void {
    if (e.tipo !== 'abajo') return;
    const { x0, x1, yc, r } = geom;
    if (Math.abs(e.y - yc) > r + 10) return;
    const n = indicesBandas.length;
    for (let i = 0; i < n; i++) {
      const x = x0 + (x1 - x0) * posiciones[i]!;
      if (Math.abs(e.x - x) < (x1 - x0) * 0.05) {
        if (i === n - 1) tol = TOLERANCIAS[(TOLERANCIAS.indexOf(tol) + 1) % TOLERANCIAS.length]!;
        else if (i === n - 2) mult = MULTS[(MULTS.indexOf(mult) + 1) % MULTS.length]!;
        else {
          const nd = [...d];
          nd[i] = ((nd[i] ?? 0) + 1) % 10;
          if (i === 0 && nd[0] === 0) nd[0] = 1;
          d = nd;
        }
        return true;
      }
    }
  }

  const texto = $derived(
    `**${siCorto(valor, 'Ω', 3)} ±${num(tolerancia, tolerancia < 1 ? 2 : 0)} %.** ` +
      (cinco === 4
        ? 'Cuatro bandas: dos cifras, multiplicador y tolerancia (5 % o 10 %). '
        : 'Cinco bandas (1 % o mejor, cuerpo azul de película metálica): tres cifras, multiplicador y tolerancia. ') +
      'La banda de tolerancia está más separada: es la que dice por qué extremo empezar.\n' +
      (normalizado(valor)
        ? 'Es un valor de la serie E24: si al leerlo al revés sale un número absurdo, ese era el sentido equivocado.'
        : 'Ese valor **no** está en la serie E24: si se lee una resistencia real y sale algo así, probablemente se ha leído al revés o se ha confundido un color (azul y violeta, marrón y rojo).') +
      (mult >= 10 ? ' El dorado y el plateado como multiplicador (×0,1 y ×0,01) marcan las resistencias de menos de 10 Ω.' : ''),
  );

  const lecturas = $derived([
    { e: 'Valor', v: siCorto(valor, 'Ω', 3), c: pal.acento },
    { e: 'Tolerancia', v: `±${num(tolerancia, tolerancia < 1 ? 2 : 0)} %` },
    { e: 'Mínimo', v: si(valor * (1 - tolerancia / 100), 'Ω', 4) },
    { e: 'Máximo', v: si(valor * (1 + tolerancia / 100), 'Ω', 4) },
    { e: 'Serie E24', v: normalizado(valor) ? 'sí' : 'no', c: normalizado(valor) ? pal.bien : pal.aviso },
  ]);

  function grupo(i: number): number[] {
    const n = indicesBandas.length;
    if (i === n - 1) return TOLERANCIAS;
    if (i === n - 2) return MULTS;
    return i === 0 ? [1, 2, 3, 4, 5, 6, 7, 8, 9] : [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
  }
  function elegir(i: number, c: number): void {
    const n = indicesBandas.length;
    if (i === n - 1) tol = c;
    else if (i === n - 2) mult = c;
    else {
      const nd = [...d];
      nd[i] = c;
      d = nd;
    }
  }
  const nombresBanda = $derived(cinco === 5 ? ['1.ª cifra', '2.ª cifra', '3.ª cifra', 'Multiplicador', 'Tolerancia'] : ['1.ª cifra', '2.ª cifra', 'Multiplicador', 'Tolerancia']);
</script>

<Marco {reloj} {texto} {lecturas}>
  {#snippet modos()}
    <Selector bind:valor={cinco} opciones={[{ valor: 4, texto: 'Cuatro bandas' }, { valor: 5, texto: 'Cinco bandas' }]} />
  {/snippet}
  {#snippet escena()}
    <Escena {reloj} {paso} {dibujar} {puntero} dims={(a) => (a < 560 ? [560, 470] : [900, 400])} etiqueta="Resistencia con bandas de colores y su lectura" />
  {/snippet}
  {#snippet controles()}
    <p class="nota">Toque una banda en el dibujo para cambiar su color, o elíjalo aquí:</p>
    {#each nombresBanda as nombre, i (nombre)}
      <div class="fila">
        <span class="et">{nombre}</span>
        <div class="muestras">
          {#each grupo(i) as c (c)}
            <button
              type="button"
              class="muestra"
              class:activa={indicesBandas[i] === c}
              style:--m={COLORES[c]!.color}
              title={COLORES[c]!.nombre}
              aria-label={COLORES[c]!.nombre}
              aria-pressed={indicesBandas[i] === c}
              onclick={() => elegir(i, c)}
            ></button>
          {/each}
        </div>
      </div>
    {/each}
    <div class="presets">
      <span class="et">Ejemplos del libro</span>
      <button class="boton" onclick={() => preset([4, 7, 2, 10])}>4,7 kΩ ±5 %</button>
      <button class="boton" onclick={() => preset([1, 0, 0, 1, 1])}>1 kΩ ±1 %</button>
      <button class="boton" onclick={() => preset([1, 0, 10, 10])}>1 Ω ±5 %</button>
      <button class="boton" onclick={() => preset([2, 2, 0, 1, 1])}>2,2 kΩ ±1 %</button>
    </div>
  {/snippet}
</Marco>

<style>
  .nota {
    margin: 0;
    font-size: 13px;
    color: var(--tinta-suave);
  }
  .fila {
    display: grid;
    gap: 4px;
  }
  .et {
    font-size: 13px;
    font-weight: 700;
  }
  .muestras {
    display: flex;
    flex-wrap: wrap;
    gap: 5px;
  }
  .muestra {
    width: 26px;
    height: 26px;
    padding: 0;
    border: 2px solid var(--superficie);
    border-radius: 50%;
    background: var(--m);
    box-shadow: 0 0 0 1px var(--linea);
  }
  .muestra.activa {
    box-shadow: 0 0 0 2px var(--acento);
    transform: scale(1.12);
  }
  .presets {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;
  }
  .presets .et {
    width: 100%;
  }
  .presets .boton {
    min-height: 30px;
    padding: 0 10px;
    font-size: 13px;
  }
</style>
