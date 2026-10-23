<script lang="ts">
  // Metastability and synchronisers (book 9.9, 28.4, 28.8, problem 28.B, 36.17): if the data changes inside the
  // setup–hold window, the flip-flop's latch starts almost balanced and the imbalance grows as e^(t/τ); the
  // output takes an unpredictable time to resolve. Persistence traces of many captures with asynchronous data
  // show the fan of late decisions. MTBF = e^(t_r/τ)/(T₀·f_reloj·f_datos); problem 28.B: 200 MHz, 5 MHz,
  // τ = 0,2 ns, T₀ = 1 ns, 1 ns of setup → one flip-flop fails every 8 minutes, two every 1,11 million years.
  import Escena from '../../ui/Escena.svelte';
  import Marco from '../../ui/Marco.svelte';
  import Deslizador from '../../ui/Deslizador.svelte';
  import Selector from '../../ui/Selector.svelte';
  import { Reloj, Muestreo } from '../../nucleo/reloj.svelte';
  import { txt, txtRico, type Vista } from '../../nucleo/dibujo';
  import { alfa, paleta } from '../../nucleo/paleta';
  import { num } from '../../nucleo/formato';
  import { app } from '../../../../lib/estado.svelte';
  import { estatico, panel, curva, guia, X, Y, type Ejes } from '../nucleo/grafica';

  const reloj = new Reloj();
  const pal = $derived(paleta(app.tema));

  let fclk = $state(200e6);
  let etapas = $state(1);
  let tau = $state(0.2e-9);
  const T0 = 1e-9;
  const FDATOS = 5e6;
  const TSU = 1e-9;

  const tr = $derived(etapas / fclk - TSU);
  const mtbf = $derived(Math.exp(tr / tau) / (T0 * fclk * FDATOS));

  function legible(s: number): string {
    const anio = 3.156e7;
    if (s < 120) return `${num(s, 1)} s`;
    if (s < 7200) return `${num(s / 60, 1)} minutos`;
    if (s < 2 * 86400) return `${num(s / 3600, 1)} horas`;
    if (s < anio) return `${num(s / 86400, 0)} días`;
    const a = s / anio;
    if (a < 1e6) return `${num(a, 0)} años`;
    if (a < 1e9) return `${num(a / 1e6, 2)} millones de años`;
    const e = Math.floor(Math.log10(a));
    return `${num(a / 10 ** e, 1)}·10^${e} años`;
  }

  // Captures: every 0,25 s on screen the data changes at a random instant relative to the clock edge (±1,5 ns).
  interface Captura {
    dt: number; // data edge − clock edge (ns)
    tres: number; // resolution time after the edge (ns), or −1 when outside the window
    valor: number; // final value
  }
  const capturas: Captura[] = [];
  let semilla = 12345;
  function azar(): number {
    semilla = (semilla * 1103515245 + 12345) & 0x7fffffff;
    return semilla / 0x7fffffff;
  }
  const VENT_SU = 0.5; // ns before the edge (setup, for the drawing)
  const VENT_H = 0.2; // ns after (hold)
  const TCQ = 0.4; // normal clock-to-Q (ns)
  function capturar(): void {
    const dt = (azar() * 2 - 1) * 1.2;
    const centro = (VENT_H - VENT_SU) / 2;
    let tres = -1;
    let valor = dt < centro ? 1 : 0; // data rose before the edge → captured 1
    if (dt > -VENT_SU && dt < VENT_H) {
      // Imbalance proportional to the distance to the balance point; grows as e^(t/τ) until it reaches 1.
      const d0 = Math.max(1e-6, Math.abs(dt - centro) / (VENT_SU + VENT_H));
      tres = TCQ + (tau * 1e9) * Math.log(1 / d0);
      valor = azar() < 0.5 ? 1 : 0;
    }
    capturas.push({ dt, tres, valor });
    if (capturas.length > 90) capturas.shift();
  }
  let acum = 0;
  let total = 0;
  let meta = 0;
  let n = $state(0);
  const muestreo = new Muestreo(80);
  $effect(() => {
    void [tau, reloj.reinicios];
    capturas.length = 0;
    total = 0;
    meta = 0;
  });
  function paso(dt: number): void {
    acum += dt;
    while (acum >= 0.25) {
      acum -= 0.25;
      capturar();
      total++;
      if (capturas[capturas.length - 1]!.tres >= 0) meta++;
    }
    if (muestreo.toca()) n++;
  }

  function dibujar(v: Vista): void {
    void n;
    const { ctx } = v;
    const p = pal;
    const est = v.estrecho;
    const eD: Ejes = est ? { x: 60, y: 40, w: 510, h: 80, x0: -1, x1: 3, y0: -0.2, y1: 1.2 } : { x: 60, y: 40, w: 520, h: 80, x0: -1, x1: 3, y0: -0.2, y1: 1.2 };
    const eQ: Ejes = est ? { x: 60, y: 188, w: 510, h: 160, x0: -1, x1: 3, y0: -0.15, y1: 1.15 } : { x: 60, y: 170, w: 520, h: 200, x0: -1, x1: 3, y0: -0.15, y1: 1.15 };
    estatico(v, `me:${est}`, (vv) => {
      panel(vv, eD, { titulo: 'Dato asíncrono: dónde cambia respecto al flanco de reloj (t = 0)', fmtX: (x) => `${x} ns`, marcasX: [-1, 0, 1, 2, 3], sinY: true, marcasY: [] });
      panel(vv, eQ, { titulo: 'Salida Q: persistencia de las últimas capturas', fmtX: (x) => `${x} ns`, marcasX: [-1, 0, 1, 2, 3], sinY: true, marcasY: [0, 0.5, 1] });
      const c = vv.ctx;
      c.fillStyle = alfa(p.peligro, 0.12);
      c.fillRect(X(eD, -VENT_SU), eD.y, X(eD, VENT_H) - X(eD, -VENT_SU), eD.h);
      txt(vv, 'setup + hold', X(eD, (VENT_H - VENT_SU) / 2), eD.y + 10, { tam: 10.5, color: p.peligro, peso: 700 });
      guia(c, eD, 'x', 0, p.tinta, 1.6, [4, 3]);
      guia(c, eQ, 'x', 0, p.tinta, 1.6, [4, 3]);
      txt(vv, 'flanco', X(eQ, 0) + 4, eQ.y + 10, { tam: 10.5, color: p.suave, alin: 'left' });
      guia(c, eQ, 'y', 0.5, alfa(p.peligro, 0.4));
    });
    // Data edges of the recent captures.
    capturas.forEach((c, i) => {
      const a = (i + 1) / capturas.length;
      const x = X(eD, c.dt);
      ctx.strokeStyle = alfa(c.tres >= 0 ? p.peligro : p.serie[0], 0.15 + 0.6 * a);
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(x, Y(eD, 0));
      ctx.lineTo(x, Y(eD, 1));
      ctx.stroke();
    });
    // Q traces: normal ones switch at TCQ; metastable ones sit near ½ and leave at tres.
    capturas.forEach((c, i) => {
      const a = (i + 1) / capturas.length;
      const xs: number[] = [];
      const ys: number[] = [];
      const ini = 1 - c.valor; // previous value (assume Q changes)
      for (let k = 0; k <= 160; k++) {
        const t = -1 + (4 * k) / 160;
        let y: number;
        if (c.tres < 0) y = t < TCQ ? ini : c.valor;
        else if (t < TCQ * 0.6) y = ini;
        else if (t < c.tres) {
          // Hovering around ½, drifting slowly away (exponential growth of the imbalance).
          const g = Math.exp((t - c.tres) / (tau * 1e9));
          y = 0.5 + (c.valor ? 0.5 : -0.5) * g;
        } else y = c.valor;
        xs.push(t);
        ys.push(y);
      }
      curva(ctx, eQ, xs, ys, alfa(c.tres >= 0 ? p.peligro : p.serie[0], 0.12 + 0.6 * a), c.tres >= 0 ? 1.8 : 1.2);
    });
    // MTBF ladder.
    const bx = est ? 60 : 620;
    const by = est ? 405 : 60;
    txt(v, `MTBF con ${etapas} ${etapas === 1 ? 'biestable' : 'biestables'}`, bx, by, { tam: 12, peso: 700, color: p.suave, alin: 'left' });
    txtRico(v, legible(mtbf), bx, by + 26, { tam: est ? 18 : 17, peso: 800, color: mtbf < 3.156e7 * 100 ? p.peligro : p.bien, alin: 'left' });
    txtRico(v, `t_r = ${num(tr * 1e9, 1)} ns = ${num(tr / tau, 1)} τ`, bx, by + 50, { tam: 11.5, color: p.suave, alin: 'left' });
  }

  const texto = $derived(
    `**Dentro de la ventana de setup y hold** el biestable no captura un valor erróneo, sino algo peor: su lazo queda casi equilibrado y la salida se queda a medio camino un tiempo impredecible, porque el desequilibrio solo crece como e^{t/τ} (τ = ${num(tau * 1e9, 2)} ns). Las trazas rojas son esas capturas; cuanto más cerca del centro de la ventana cambió el dato, más tarda en decidirse.\n` +
      `**MTBF = exp(t_r/τ)/(T_0·f_reloj·f_datos)**, con los datos del problema 28.B: a ${num(fclk / 1e6, 0)} MHz, con ${etapas} ${etapas === 1 ? 'biestable' : 'biestables'} hay ${num(tr * 1e9, 1)} ns para resolverse y el MTBF es de ${legible(mtbf)}. Cada biestable más suma un periodo al exponente: por eso toda señal que cruza de dominio de reloj pasa por dos.`,
  );

  const lecturas = $derived.by(() => {
    void n;
    return [
      { e: 'MTBF', v: legible(mtbf), c: mtbf < 3.156e9 ? pal.peligro : pal.bien },
      { e: 'Tiempo para resolverse t_r', v: `${num(tr * 1e9, 1)} ns` },
      { e: 'Capturas metaestables', v: `${meta} de ${total}`, c: pal.peligro },
    ];
  });
</script>

<Marco {reloj} {texto} {lecturas}>
  {#snippet modos()}
    <Selector
      etiqueta="Biestables en el sincronizador"
      bind:valor={etapas}
      opciones={[
        { valor: 1, texto: '1' },
        { valor: 2, texto: '2' },
        { valor: 3, texto: '3' },
      ]}
    />
  {/snippet}
  {#snippet escena()}
    <Escena {reloj} {paso} {dibujar} dims={(a) => (a < 560 ? [600, 490] : [900, 400])} etiqueta="Capturas de un dato asíncrono y la salida metaestable de un biestable" />
  {/snippet}
  {#snippet controles()}
    <Selector
      etiqueta="Reloj"
      bind:valor={fclk}
      opciones={[
        { valor: 200e6, texto: '200 MHz' },
        { valor: 100e6, texto: '100 MHz' },
        { valor: 50e6, texto: '50 MHz' },
      ]}
    />
    <Deslizador etiqueta="Constante de resolución τ" bind:valor={tau} min={0.05e-9} max={0.5e-9} paso={0.01e-9} formato={(x) => `${num(x * 1e9, 2)} ns`} />
  {/snippet}
</Marco>
