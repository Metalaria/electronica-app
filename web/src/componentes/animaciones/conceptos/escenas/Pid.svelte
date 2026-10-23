<script lang="ts">
  // PID control of a small oven (book 30.1, 30.2, 30.3, 30.11, 30.5): a first-order plant with dead time
  // (gain 2 °C per % of power, T = 40 s, L = 6 s), heater saturated between 0 and 100 %. P alone leaves a
  // steady-state error; I removes it (and winds up when the heater saturates, unless clamped); D brakes the
  // overshoot. Ziegler–Nichols from the open-loop step: K_p = 1,2·T/(K·L), T_i = 2·L, T_d = 0,5·L. Simulated in
  // discrete time (the controller runs every 0,1 s of process time), 10 s of process per second on screen.
  import Escena from '../../ui/Escena.svelte';
  import Marco from '../../ui/Marco.svelte';
  import Deslizador from '../../ui/Deslizador.svelte';
  import Interruptor from '../../ui/Interruptor.svelte';
  import { Reloj, Muestreo } from '../../nucleo/reloj.svelte';
  import { txt, rr, type Vista } from '../../nucleo/dibujo';
  import { alfa, paleta } from '../../nucleo/paleta';
  import { num, pct } from '../../nucleo/formato';
  import { app } from '../../../../lib/estado.svelte';
  import { estatico, panel, curva, type Ejes } from '../nucleo/grafica';

  const reloj = new Reloj();
  const pal = $derived(paleta(app.tema));

  const K = 2;
  const TAU = 40;
  const L = 6;
  const AMB = 20;
  let Kp = $state(2);
  let Ti = $state(0); // 0 = no integral
  let Td = $state(0);
  let antiwindup = $state(true);

  function zn(): void {
    Kp = Number(((1.2 * TAU) / (K * L)).toFixed(2));
    Ti = 2 * L;
    Td = 0.5 * L;
  }

  const DT = 0.1;
  const HIST = 2400; // 240 s of process
  const hT = new Float64Array(HIST);
  const hU = new Float64Array(HIST);
  const hR = new Float64Array(HIST);
  let ih = 0;
  let temp = AMB;
  let integ = 0;
  let ePrev = 0;
  let consigna = 150;
  let tProc = 0;
  let perturb = 0;
  const retardo = new Float64Array(Math.round(L / DT));
  let ir = 0;
  let acum = 0;
  let ultimo = { p: 0, i: 0, d: 0, u: 0 };

  function reiniciar(): void {
    temp = AMB;
    integ = 0;
    ePrev = 0;
    tProc = 0;
    perturb = 0;
    retardo.fill(0);
    hT.fill(AMB);
    hU.fill(0);
    hR.fill(150);
    ih = 0;
  }
  $effect(() => {
    void reloj.reinicios;
    reiniciar();
  });

  function pasoProceso(): void {
    // Set point: 150 °C, dropping to 100 °C between 120 s and 200 s of every 240 s cycle.
    const ciclo = tProc % 240;
    consigna = ciclo > 120 && ciclo < 200 ? 100 : 150;
    const e = consigna - temp;
    const p = Kp * e;
    let i = Ti > 0 ? (Kp / Ti) * integ : 0;
    const d = Td > 0 ? (Kp * Td * (e - ePrev)) / DT : 0;
    let u = p + i + d;
    const sat = u > 100 || u < 0;
    u = Math.max(0, Math.min(100, u));
    // Clamping anti-windup: stop integrating while saturated in the direction of the error.
    if (!(antiwindup && sat && Math.sign(e) === Math.sign(p + i + d - 50))) integ += e * DT;
    i = Ti > 0 ? (Kp / Ti) * integ : 0;
    ePrev = e;
    // Dead time, then the first-order oven (with an optional heat loss: door opened).
    const uRet = retardo[ir]!;
    retardo[ir] = u;
    ir = (ir + 1) % retardo.length;
    const objetivo = AMB + K * uRet - perturb;
    temp += ((objetivo - temp) * DT) / TAU;
    if (perturb > 0) perturb = Math.max(0, perturb - DT * 4);
    tProc += DT;
    hT[ih % HIST] = temp;
    hU[ih % HIST] = u;
    hR[ih % HIST] = consigna;
    ih++;
    ultimo = { p, i, d, u };
  }

  let n = $state(0);
  const muestreo = new Muestreo(80);
  function paso(dt: number): void {
    acum += dt * 10;
    while (acum >= DT) {
      acum -= DT;
      pasoProceso();
    }
    if (muestreo.toca()) n++;
  }

  function abrirPuerta(): void {
    perturb = 60;
  }

  function dibujar(v: Vista): void {
    void n;
    const { ctx } = v;
    const p = pal;
    const est = v.estrecho;
    const eT: Ejes = est ? { x: 60, y: 40, w: 510, h: 220, x0: -240, x1: 0, y0: 0, y1: 220 } : { x: 60, y: 40, w: 560, h: 230, x0: -240, x1: 0, y0: 0, y1: 220 };
    const eU: Ejes = est ? { x: 60, y: 318, w: 510, h: 102, x0: -240, x1: 0, y0: -5, y1: 105 } : { x: 60, y: 320, w: 560, h: 90, x0: -240, x1: 0, y0: -5, y1: 105 };
    estatico(v, `pid:${est}`, (vv) => {
      panel(vv, eT, { titulo: 'Temperatura y consigna', ux: 's', fmtY: (y) => `${num(y, 0)} °C`, marcasY: [0, 50, 100, 150, 200] });
      panel(vv, eU, { titulo: 'Potencia del calefactor (saturada 0–100 %)', ux: 's', fmtY: (y) => `${num(y, 0)} %`, marcasY: [0, 50, 100] });
    });
    const M = Math.min(ih, HIST);
    const xs = new Float64Array(M);
    const yT = new Float64Array(M);
    const yU = new Float64Array(M);
    const yR = new Float64Array(M);
    for (let k = 0; k < M; k++) {
      const j = (ih - M + k + HIST) % HIST;
      xs[k] = -(M - 1 - k) * DT;
      yT[k] = hT[j]!;
      yU[k] = hU[j]!;
      yR[k] = hR[j]!;
    }
    curva(ctx, eT, xs, yR, alfa(p.tinta, 0.5), 1.6, [6, 4]);
    curva(ctx, eT, xs, yT, p.calor, 2.4);
    curva(ctx, eU, xs, yU, p.acento, 1.8);
    // The oven (right column on wide screens, small on phones).
    const ox = est ? 470 : 680;
    const oy = est ? 450 : 70;
    const ow = est ? 100 : 170;
    const oh = est ? 110 : 170;
    rr(ctx, ox, oy, ow, oh, 10);
    ctx.fillStyle = p.panel;
    ctx.fill();
    ctx.fillStyle = alfa(p.calor, 0.15 + 0.85 * Math.min(1, Math.max(0, (temp - AMB) / 200)));
    ctx.fill();
    ctx.strokeStyle = p.tinta;
    ctx.lineWidth = 2;
    ctx.stroke();
    txt(v, `${num(temp, 1)} °C`, ox + ow / 2, oy + oh / 2 - 8, { tam: est ? 15 : 20, peso: 800, color: '#fff' });
    txt(v, est ? `→ ${consigna} °C` : `consigna ${consigna} °C`, ox + ow / 2, oy + oh / 2 + 16, { tam: 11.5, color: '#fff', peso: 700 });
    // Contributions of P, I and D.
    const cx = est ? 60 : 680;
    const cy = est ? 470 : 280;
    const filas: [string, number, string][] = [
      ['P', ultimo.p, p.serie[0]],
      ['I', ultimo.i, p.serie[2]],
      ['D', ultimo.d, p.serie[1]],
    ];
    txt(v, 'Aportación de cada término', cx, cy - 14, { tam: 12, peso: 700, color: p.suave, alin: 'left' });
    filas.forEach(([et, val, c], k) => {
      const y = cy + k * 24;
      const w = est ? 300 : 170;
      txt(v, et, cx + 8, y + 9, { tam: 12, peso: 800, color: c });
      ctx.fillStyle = alfa(p.tinta, 0.07);
      ctx.fillRect(cx + 20, y, w, 18);
      const z = cx + 20 + w / 2;
      const ww = Math.max(-w / 2, Math.min(w / 2, (val / 200) * (w / 2) * 2));
      ctx.fillStyle = c;
      ctx.fillRect(Math.min(z, z + ww), y, Math.abs(ww), 18);
      txt(v, `${num(val, 1)} %`, cx + 26 + w, y + 9, { tam: 11.5, peso: 700, alin: 'left' });
    });
  }

  const texto = $derived.by(() => {
    void n;
    const err = consigna - temp;
    const tipo = Ti > 0 && Td > 0 ? 'PID' : Ti > 0 ? 'PI' : Td > 0 ? 'PD' : 'P';
    return (
      `**Control ${tipo}** de un horno con 6 s de retardo y 40 s de constante de tiempo (curva de reacción de la sección 30.2). ` +
      (Ti === 0
        ? `Solo con P queda un **error permanente** (ahora ${num(err, 1)} °C): sin error no habría potencia. Subir K_p lo reduce, pero acerca la oscilación.`
        : `El integral acumula el error hasta anularlo. ${antiwindup ? 'Con anti-windup deja de acumular mientras el calefactor está saturado.' : '**Sin anti-windup**, durante la saturación sigue acumulando y luego hay que «descargarlo»: sobreoscilación enorme.'}`) +
      `\nEl derivativo frena la subida antes de llegar; el retardo es el enemigo: durante esos 6 s el controlador actúa sin ver el efecto de lo que ya hizo. Ziegler–Nichols en lazo abierto da K_p = 1,2·T/(K·L) = ${num((1.2 * TAU) / (K * L), 2)}, T_i = 2L = 12 s, T_d = 0,5L = 3 s: un punto de partida agresivo.`
    );
  });

  const lecturas = $derived.by(() => {
    void n;
    return [
      { e: 'Temperatura', v: `${num(temp, 1)} °C`, c: pal.calor },
      { e: 'Error', v: `${num(consigna - temp, 1)} °C` },
      { e: 'Potencia', v: pct(ultimo.u / 100, 0), c: pal.acento },
      { e: 'K_p', v: num(Kp, 2) },
    ];
  });
</script>

<Marco {reloj} {texto} {lecturas}>
  {#snippet escena()}
    <Escena {reloj} {paso} {dibujar} dims={(a) => (a < 560 ? [600, 580] : [900, 430])} etiqueta="Control PID de la temperatura de un horno con retardo" />
  {/snippet}
  {#snippet controles()}
    <div class="botones">
      <button class="boton" onclick={() => ((Kp = 2), (Ti = 0), (Td = 0))}>Solo P</button>
      <button class="boton" onclick={() => ((Kp = 2), (Ti = 30), (Td = 0))}>PI</button>
      <button class="boton" onclick={zn}>PID de Ziegler–Nichols</button>
      <button class="boton" onclick={abrirPuerta}>Abrir la puerta</button>
    </div>
    <Deslizador etiqueta="K_p (% por °C)" bind:valor={Kp} min={0.1} max={10} paso={0.05} formato={(x) => num(x, 2)} />
    <Deslizador etiqueta="T_i (0 = sin integral)" bind:valor={Ti} min={0} max={120} paso={1} formato={(x) => (x === 0 ? 'sin I' : `${num(x, 0)} s`)} />
    <Deslizador etiqueta="T_d (0 = sin derivativo)" bind:valor={Td} min={0} max={10} paso={0.1} formato={(x) => (x === 0 ? 'sin D' : `${num(x, 1)} s`)} />
    <Interruptor etiqueta="Anti-windup (limitar el integrador)" bind:valor={antiwindup} />
  {/snippet}
</Marco>

<style>
  .botones {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
</style>
