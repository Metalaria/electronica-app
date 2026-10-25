<script lang="ts">
  // Bode plots built from poles and zeros (book 24.3, 0.20, 24.7, 0.10): each real pole bends the magnitude
  // down by 20 dB/decade from its frequency and adds up to −90° (−45° at the corner, −3 dB there), each zero the
  // opposite. Poles and zeros are dragged along the frequency axis; the asymptotes and the exact curve follow.
  // A test sine at the chosen frequency goes through the network: output amplitude |H| and phase ∠H.
  // Book example: RC of 1 kΩ and 100 nF → 1,59 kHz.
  import Escena, { type EventoPuntero } from '../../ui/Escena.svelte';
  import Marco from '../../ui/Marco.svelte';
  import Deslizador from '../../ui/Deslizador.svelte';
  import Selector from '../../ui/Selector.svelte';
  import Interruptor from '../../ui/Interruptor.svelte';
  import { Reloj, Muestreo } from '../../nucleo/reloj.svelte';
  import { txt, circulo, type Vista } from '../../nucleo/dibujo';
  import { alfa, paleta } from '../../nucleo/paleta';
  import { si, num } from '../../nucleo/formato';
  import { app } from '../../../../lib/estado.svelte';
  import { estatico, panel, curva, guia, punto, X, deX, type Ejes } from '../nucleo/grafica';

  const reloj = new Reloj();
  const pal = $derived(paleta(app.tema));

  interface Raiz {
    f: number;
    tipo: 'polo' | 'cero';
  }
  let raices = $state<Raiz[]>([{ f: 1592, tipo: 'polo' }]);
  let origen = $state(0); // zeros at the origin (high-pass)
  let ejemplo = $state<'rc' | 'dos' | 'adelanto' | 'pasoalto' | 'banda'>('rc');
  let fPrueba = $state(1000);
  let barrer = $state(true);

  $effect(() => {
    if (ejemplo === 'rc') {
      raices = [{ f: 1592, tipo: 'polo' }];
      origen = 0;
    } else if (ejemplo === 'dos') {
      raices = [
        { f: 1000, tipo: 'polo' },
        { f: 20000, tipo: 'polo' },
      ];
      origen = 0;
    } else if (ejemplo === 'adelanto') {
      raices = [
        { f: 1000, tipo: 'cero' },
        { f: 10000, tipo: 'polo' },
      ];
      origen = 0;
    } else if (ejemplo === 'pasoalto') {
      raices = [{ f: 1592, tipo: 'polo' }];
      origen = 1;
    } else {
      raices = [
        { f: 300, tipo: 'polo' },
        { f: 30000, tipo: 'polo' },
      ];
      origen = 1;
    }
  });

  // H(jω) = (jω/ω_o)^origen · Π(1 + jf/z) / Π(1 + jf/p), normalised so that a high-pass is 0 dB above its pole.
  function H(f: number): { m: number; fase: number } {
    let m = 1;
    let fase = 0;
    for (const r of raices) {
      const x = f / r.f;
      if (r.tipo === 'polo') {
        m /= Math.hypot(1, x);
        fase -= Math.atan(x);
      } else {
        m *= Math.hypot(1, x);
        fase += Math.atan(x);
      }
    }
    if (origen) {
      const fo = raices.find((r) => r.tipo === 'polo')?.f ?? 1000;
      m *= f / fo;
      fase += Math.PI / 2;
    }
    return { m, fase };
  }
  function asintota(f: number): number {
    let db = 0;
    for (const r of raices) if (f > r.f) db += (r.tipo === 'polo' ? -20 : 20) * Math.log10(f / r.f);
    if (origen) {
      const fo = raices.find((r) => r.tipo === 'polo')?.f ?? 1000;
      db += 20 * Math.log10(f / fo);
    }
    return db;
  }

  let fase = 0;
  let th = 0;
  let n = $state(0);
  const muestreo = new Muestreo(60);
  function paso(dt: number): void {
    if (barrer && !arrastre) {
      fase += dt / 14;
      fPrueba = Math.round(10 ** (1.3 + 4.4 * (0.5 - 0.5 * Math.cos(2 * Math.PI * fase))));
    }
    th = (th + (2 * Math.PI * dt) / 2.4) % (2 * Math.PI);
    if (muestreo.toca()) n++;
  }

  let geo: { eM: Ejes; eF: Ejes; yRegla: number } | null = null;
  let arrastre: number | 'prueba' | null = null;

  function puntero(ev: EventoPuntero): boolean | void {
    if (!geo) return;
    const { eM, yRegla } = geo;
    if (ev.tipo === 'abajo') {
      let mejor: number | 'prueba' | null = null;
      let d = 26;
      raices.forEach((r, i) => {
        const dx = Math.abs(X(eM, r.f) - ev.x);
        if (dx < d && Math.abs(ev.y - yRegla) < 40) {
          d = dx;
          mejor = i;
        }
      });
      if (mejor === null && ev.x >= eM.x - 10 && ev.x <= eM.x + eM.w + 10 && ev.y > yRegla + 30) mejor = 'prueba';
      arrastre = mejor;
      if (arrastre !== null) {
        mover(ev.x);
        return true;
      }
      return;
    }
    if (ev.tipo === 'mover' && arrastre !== null) mover(ev.x);
    if (ev.tipo === 'arriba') arrastre = null;
  }
  function mover(x: number): void {
    if (!geo) return;
    const f = Math.min(geo.eM.x1, Math.max(geo.eM.x0, deX(geo.eM, x)));
    const fr = Number(f.toPrecision(3));
    if (arrastre === 'prueba') {
      barrer = false;
      fPrueba = fr;
    } else if (typeof arrastre === 'number') {
      const r = raices[arrastre];
      if (r) {
        raices[arrastre] = { ...r, f: fr };
      }
    }
  }

  function dibujar(v: Vista): void {
    void n;
    const { ctx } = v;
    const p = pal;
    const est = v.estrecho;
    const eM: Ejes = est ? { x: 60, y: 120, w: 510, h: 170, x0: 1, x1: 1e6, y0: -80, y1: 30, logX: true } : { x: 60, y: 110, w: 500, h: 150, x0: 1, x1: 1e6, y0: -80, y1: 30, logX: true };
    const eF: Ejes = est ? { x: 60, y: 345, w: 510, h: 112, x0: 1, x1: 1e6, y0: -180, y1: 180, logX: true } : { x: 60, y: 300, w: 500, h: 110, x0: 1, x1: 1e6, y0: -180, y1: 180, logX: true };
    const eT: Ejes = est ? { x: 60, y: 522, w: 510, h: 90, x0: 0, x1: 2, y0: -1.3, y1: 1.3 } : { x: 620, y: 110, w: 250, h: 150, x0: 0, x1: 2, y0: -1.3, y1: 1.3 };
    const yRegla = est ? 60 : 55;
    geo = { eM, eF, yRegla };
    estatico(v, `bd:${est}`, (vv) => {
      panel(vv, eM, { titulo: 'Magnitud |H|', ux: 'Hz', fmtY: (y) => `${num(y, 0)} dB`, marcasY: [-80, -60, -40, -20, 0, 20], cero: true });
      panel(vv, eF, { titulo: 'Fase ∠H', ux: 'Hz', fmtY: (y) => `${num(y, 0)}°`, marcasY: [-180, -90, 0, 90, 180], cero: true });
      panel(vv, eT, { titulo: 'Senoide de prueba: entrada y salida', sinX: true, sinY: true, marcasY: [], cero: true });
      // The ruler where poles and zeros live.
      const c = vv.ctx;
      c.strokeStyle = p.tinta;
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(eM.x, yRegla);
      c.lineTo(eM.x + eM.w, yRegla);
      c.stroke();
      for (let e = 0; e <= 6; e++) {
        const x = X(eM, 10 ** e);
        c.beginPath();
        c.moveTo(x, yRegla - 5);
        c.lineTo(x, yRegla + 5);
        c.stroke();
      }
      txt(vv, 'arrastra los polos (×) y ceros (○) por el eje de frecuencia', eM.x, yRegla - 28, { tam: 11.5, color: p.suave, alin: 'left' });
    });
    // Curves.
    const N = 300;
    const fs = new Float64Array(N + 1);
    const mr = new Float64Array(N + 1);
    const ma = new Float64Array(N + 1);
    const fz = new Float64Array(N + 1);
    for (let i = 0; i <= N; i++) {
      const f = 10 ** ((6 * i) / N);
      const h = H(f);
      fs[i] = f;
      mr[i] = 20 * Math.log10(h.m);
      ma[i] = asintota(f);
      fz[i] = (h.fase * 180) / Math.PI;
    }
    curva(ctx, eM, fs, ma, alfa(p.serie[4], 0.85), 2, [6, 4]);
    curva(ctx, eM, fs, mr, p.acento, 2.6);
    curva(ctx, eF, fs, fz, p.serie[1], 2.4);
    // Poles and zeros on the ruler, with guides.
    for (const r of raices) {
      const x = X(eM, r.f);
      guia(ctx, eM, 'x', r.f, alfa(r.tipo === 'polo' ? p.peligro : p.bien, 0.45));
      guia(ctx, eF, 'x', r.f, alfa(r.tipo === 'polo' ? p.peligro : p.bien, 0.45));
      if (r.tipo === 'polo') {
        ctx.strokeStyle = p.peligro;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(x - 8, yRegla - 8);
        ctx.lineTo(x + 8, yRegla + 8);
        ctx.moveTo(x - 8, yRegla + 8);
        ctx.lineTo(x + 8, yRegla - 8);
        ctx.stroke();
      } else circulo(ctx, x, yRegla, 8, p.fondo, p.bien, 3);
      txt(v, si(r.f, 'Hz', 3), x, yRegla + 22, { tam: 11.5, peso: 700, color: r.tipo === 'polo' ? p.peligro : p.bien });
    }
    // Test frequency.
    const h = H(fPrueba);
    guia(ctx, eM, 'x', fPrueba, alfa(p.corriente, 0.7), 1.6, [2, 3]);
    guia(ctx, eF, 'x', fPrueba, alfa(p.corriente, 0.7), 1.6, [2, 3]);
    punto(ctx, eM, fPrueba, 20 * Math.log10(h.m), p.corriente, 6, p.fondo);
    punto(ctx, eF, fPrueba, (h.fase * 180) / Math.PI, p.corriente, 6, p.fondo);
    const M = 160;
    const xs = new Float64Array(M + 1);
    const yi = new Float64Array(M + 1);
    const yo = new Float64Array(M + 1);
    for (let i = 0; i <= M; i++) {
      const u = (2 * i) / M;
      xs[i] = u;
      yi[i] = Math.sin(th - 2 * Math.PI * u);
      yo[i] = Math.min(1.3, h.m) * Math.sin(th - 2 * Math.PI * u + h.fase);
    }
    curva(ctx, eT, xs, yi, alfa(p.tinta, 0.5), 1.6, [5, 4]);
    curva(ctx, eT, xs, yo, p.corriente, 2.4);
    txt(v, `${si(fPrueba, 'Hz', 3)}: ${num(20 * Math.log10(h.m), 1)} dB, ${num((h.fase * 180) / Math.PI, 1)}°`, eT.x + eT.w / 2, eT.y + eT.h + (est ? 16 : 20), { tam: 12.5, peso: 700, color: p.corriente });
  }

  const texto = $derived.by(() => {
    const h = H(fPrueba);
    const polos = raices.filter((r) => r.tipo === 'polo').length;
    const ceros = raices.length - polos + origen;
    return (
      `**Cada polo** dobla la magnitud hacia abajo 20 dB por década a partir de su frecuencia y aporta hasta −90° de fase (−45° y −3 dB justo en el codo, −1 dB una octava antes); **cada cero**, lo contrario. La curva real (continua) se separa de las asíntotas (discontinuas) solo cerca de los codos.\n` +
      `Aquí hay ${polos} ${polos === 1 ? 'polo' : 'polos'} y ${ceros} ${ceros === 1 ? 'cero' : 'ceros'}: la pendiente final es ${(ceros - polos) * 20} dB/década y la fase tiende a ${(ceros - polos) * 90}°. A ${si(fPrueba, 'Hz', 3)} la senoide sale con ${num(h.m, 3)} veces su amplitud y ${num((h.fase * 180) / Math.PI, 1)}° de desfase: eso es exactamente lo que mide el osciloscopio en la práctica 5.`
    );
  });

  const lecturas = $derived([
    { e: '|H| a la frecuencia de prueba', v: `${num(20 * Math.log10(H(fPrueba).m), 2)} dB`, c: pal.acento },
    { e: 'Fase', v: `${num((H(fPrueba).fase * 180) / Math.PI, 1)}°`, c: pal.serie[1] },
    { e: 'Asíntota', v: `${num(asintota(fPrueba), 2)} dB`, c: pal.serie[4] },
    { e: 'Frecuencia de prueba', v: si(fPrueba, 'Hz', 3), c: pal.corriente },
  ]);
</script>

<Marco {reloj} {texto} {lecturas}>
  {#snippet modos()}
    <Selector
      bind:valor={ejemplo}
      opciones={[
        { valor: 'rc', texto: 'RC paso bajo' },
        { valor: 'dos', texto: 'Dos polos' },
        { valor: 'pasoalto', texto: 'Paso alto' },
        { valor: 'banda', texto: 'Paso banda' },
        { valor: 'adelanto', texto: 'Cero y polo' },
      ]}
    />
  {/snippet}
  {#snippet escena()}
    <Escena {reloj} {paso} {dibujar} {puntero} dims={(a) => (a < 560 ? [600, 640] : [900, 440])} etiqueta="Diagrama de Bode construido con polos y ceros arrastrables" />
  {/snippet}
  {#snippet controles()}
    <Interruptor etiqueta="Barrer la frecuencia de prueba" bind:valor={barrer} />
    <Deslizador etiqueta="Frecuencia de prueba" bind:valor={fPrueba} min={1} max={1e6} log unidad="Hz" desactivado={barrer} />
    {#each raices as r, i (i)}
      <Deslizador etiqueta={r.tipo === 'polo' ? `Polo ${i + 1}` : `Cero ${i + 1}`} bind:valor={r.f} min={2} max={5e5} log unidad="Hz" color={r.tipo === 'polo' ? pal.peligro : pal.bien} />
    {/each}
  {/snippet}
</Marco>
