<script lang="ts">
  // Hall effect (book 34.5 and 19.5): carriers moving through a semiconductor plate in a perpendicular field
  // feel the Lorentz force F = q·v × B and pile up on one edge until the transverse field balances it. The
  // Hall voltage V_H = I·B/(n·q·t) is proportional to the field (and to the current that excites the plate).
  import Escena from '../ui/Escena.svelte';
  import Marco from '../ui/Marco.svelte';
  import Deslizador from '../ui/Deslizador.svelte';
  import Grafica from '../ui/Grafica.svelte';
  import { Reloj } from '../nucleo/reloj.svelte';
  import { txt, txtRico, fondo, rr, flecha, electrones, azar, circulo, gradCilindro, type Vista } from '../nucleo/dibujo';
  import { hilo } from '../nucleo/esquema';
  import { alfa, mezcla, paleta } from '../nucleo/paleta';
  import { Q } from '../nucleo/fisica';
  import { si } from '../nucleo/formato';
  import { app } from '../../../lib/estado.svelte';

  const reloj = new Reloj();
  const pal = $derived(paleta(app.tema));
  let I = $state(5e-3);
  let B = $state(0.1);
  const N = 1e21; // m⁻³ (lightly doped InSb-like plate)
  const T = 0.2e-3;
  const VH = $derived((I * B) / (N * Q * T));

  const rnd = azar(111);
  const els = Array.from({ length: 70 }, () => ({ u: rnd(), w: rnd(), s: 0.7 + rnd() * 0.6 }));
  let fase = 0;
  function paso(dt: number): void {
    fase += dt * Math.min(0.5, 0.05 + I * 50);
  }

  function dibujar(v: Vista): void {
    void [I, B];
    const { ctx } = v;
    const p = pal;
    fondo(v);
    const est = v.estrecho;
    const x0 = 80;
    const x1 = v.w - (est ? 80 : 220);
    const y0 = est ? 120 : 110;
    const y1 = est ? 300 : 290;
    const k = Math.max(-1, Math.min(1, B / 0.2));
    // Field symbols over the plate (⊗ into the page for B > 0).
    for (let gx = x0 - 40; gx < x1 + 40; gx += 46)
      for (let gy = y0 - 50; gy < y1 + 50; gy += 46) {
        if (gx > x0 - 4 && gx < x1 + 4 && gy > y0 - 4 && gy < y1 + 4) continue;
        const a = Math.abs(k);
        if (a < 0.02) continue;
        circulo(ctx, gx, gy, 8, undefined, alfa(p.campoB, 0.3 + 0.6 * a), 1.5);
        if (k > 0) {
          ctx.strokeStyle = alfa(p.campoB, 0.3 + 0.6 * a);
          ctx.beginPath();
          ctx.moveTo(gx - 5, gy - 5);
          ctx.lineTo(gx + 5, gy + 5);
          ctx.moveTo(gx + 5, gy - 5);
          ctx.lineTo(gx - 5, gy + 5);
          ctx.stroke();
        } else circulo(ctx, gx, gy, 2.4, alfa(p.campoB, 0.3 + 0.6 * a));
      }
    // Plate.
    rr(ctx, x0, y0, x1 - x0, y1 - y0, 6);
    ctx.fillStyle = p.siN;
    ctx.fill();
    ctx.strokeStyle = mezcla(p.linea, p.tinta, 0.2);
    ctx.stroke();
    // Charge accumulation on the edges: electrons (moving left) deflected by F = −q·v×B.
    // With B into the page and electrons moving to −x, the force on them points to −y (top edge).
    const acum = Math.min(1, Math.abs(VH) / 0.03) * Math.sign(VH);
    const n = Math.round(Math.abs(acum) * 18);
    for (let i = 0; i < n; i++) {
      const x = x0 + 20 + ((x1 - x0 - 40) * (i + 0.5)) / n;
      circulo(ctx, x, acum > 0 ? y0 + 8 : y1 - 8, 3.4, p.electron);
      txt(v, '+', x, acum > 0 ? y1 - 8 : y0 + 8, { tam: 13, peso: 900, color: p.positivo });
    }
    // Electrons: drifting from right to left, along straight lines once the Hall field balances the force.
    const pts: { x: number; y: number }[] = [];
    for (const e of els) {
      const u = (e.u + fase * e.s) % 1;
      const x = x1 - 10 - u * (x1 - x0 - 20);
      pts.push({ x, y: y0 + 18 + e.w * (y1 - y0 - 36) });
    }
    electrones(ctx, pts, 3.4, p);
    // Transverse Hall field arrows.
    if (Math.abs(acum) > 0.05)
      for (let i = 0; i < 4; i++) {
        const x = x0 + ((x1 - x0) * (i + 0.5)) / 4;
        if (acum > 0) flecha(ctx, x, y1 - 22, x, y0 + 22, alfa(p.campoE, 0.75), 1.8, 8);
        else flecha(ctx, x, y0 + 22, x, y1 - 22, alfa(p.campoE, 0.75), 1.8, 8);
      }
    // Lorentz force on one electron (illustration).
    if (Math.abs(k) > 0.05) {
      const xe = (x0 + x1) / 2;
      const ye = (y0 + y1) / 2;
      circulo(ctx, xe, ye, 6, p.electron, '#ffffff', 2);
      flecha(ctx, xe, ye, xe - 60, ye, alfa(p.electron, 0.9), 2, 9, [5, 3]);
      txt(v, 'v', xe - 70, ye - 12, { tam: 13, peso: 800, color: p.electron });
      flecha(ctx, xe, ye, xe, ye - 50 * Math.sign(k), p.hueco, 2.6, 10);
      txt(v, 'F', xe + 12, ye - 40 * Math.sign(k), { tam: 14, peso: 900, color: p.hueco });
    }
    // Current contacts left/right and Hall contacts top/bottom.
    ctx.fillStyle = gradCilindro(ctx, y0, y1, p.aluminio, p.oscuro);
    ctx.fillRect(x0 - 14, y0 + 10, 14, y1 - y0 - 20);
    ctx.fillRect(x1, y0 + 10, 14, y1 - y0 - 20);
    ctx.fillStyle = p.aluminio;
    ctx.fillRect((x0 + x1) / 2 - 16, y0 - 12, 32, 12);
    ctx.fillRect((x0 + x1) / 2 - 16, y1, 32, 12);
    flecha(ctx, x0 - 60, (y0 + y1) / 2, x0 - 18, (y0 + y1) / 2, p.corriente, 3, 12);
    txtRico(v, `I = ${si(I, 'A', 2)}`, x0 - 60, (y0 + y1) / 2 - 22, { tam: 13.5, peso: 800, color: p.corriente, alin: 'left' });
    // Voltmeter.
    const xm = (x0 + x1) / 2;
    hilo(v, [
      [xm, y0 - 12],
      [xm, y0 - 40],
      [xm + 140, y0 - 40],
    ]);
    hilo(v, [
      [xm, y1 + 12],
      [xm, y1 + 40],
      [xm + 140, y1 + 40],
      [xm + 140, y0 - 40],
    ]);
    rr(ctx, xm + 100, (y0 + y1) / 2 - 24, 80, 48, 10);
    ctx.fillStyle = p.panel;
    ctx.fill();
    ctx.strokeStyle = p.tinta;
    ctx.stroke();
    txtRico(v, si(VH, 'V', 3), xm + 140, (y0 + y1) / 2, { tam: 14, peso: 800, color: p.acento });
    txtRico(v, `B = ${si(B, 'T', 2)} ${B >= 0 ? '(entrante)' : '(saliente)'}`, est ? v.w / 2 : v.w - 110, est ? 40 : 60, { tam: 14, peso: 800, color: p.campoB });
  }

  const curva = $derived({ x: [-0.2, 0.2], y: [(I * -0.2) / (N * Q * T), (I * 0.2) / (N * Q * T)] });

  const texto = $derived(
    `Los electrones que forman la corriente se mueven por la placa y el campo magnético los empuja hacia un borde (fuerza de Lorentz, F = q·v×B). Se acumulan allí y dejan el borde opuesto positivo, hasta que el **campo transversal** que crean equilibra la fuerza y vuelven a ir rectos.\n` +
      `Esa diferencia es la tensión Hall: V_H = I·B/(n·q·t) = ${si(VH, 'V', 3)}. Es proporcional al campo y no exige contacto: la base de los sensores de corriente aislados, de posición y de los encoders magnéticos. Sus puntos débiles son el offset y la deriva.`,
  );
  const lecturas = $derived([
    { e: 'Tensión Hall V_H', v: si(VH, 'V', 3), c: pal.acento },
    { e: 'Sensibilidad', v: `${si(I / (N * Q * T), 'V/T', 3)}` },
    { e: 'Campo B', v: si(B, 'T', 3), c: pal.campoB },
  ]);
</script>

<Marco {reloj} {texto} {lecturas} leyenda={['electron', 'corriente', 'campoE', 'campoB']}>
  {#snippet escena()}
    <Escena {reloj} {paso} {dibujar} dims={(a) => (a < 560 ? [560, 440] : [860, 400])} etiqueta="Placa Hall con electrones desviados por el campo magnético" />
  {/snippet}
  {#snippet controles()}
    <Deslizador etiqueta="Campo magnético B" bind:valor={B} min={-0.2} max={0.2} paso={0.002} unidad="T" />
    <Deslizador etiqueta="Corriente de excitación I" bind:valor={I} min={0} max={10e-3} paso={1e-4} unidad="A" />
  {/snippet}
  {#snippet grafica()}
    <Grafica
      titulo="Tensión Hall frente al campo"
      x={{ etiqueta: 'B', unidad: 'T', min: -0.2, max: 0.2 }}
      y={{ etiqueta: 'V_H', unidad: 'V', min: -0.07, max: 0.07 }}
      series={[{ x: curva.x, y: curva.y, color: pal.acento }]}
      puntos={[{ x: B, y: VH, color: pal.corriente, etiqueta: si(VH, 'V', 3) }]}
    />
  {/snippet}
</Marco>
