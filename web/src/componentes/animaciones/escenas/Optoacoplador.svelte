<script lang="ts">
  // Optocoupler (book 19.1 and 44.4): an infrared LED and a phototransistor face each other across a
  // transparent insulating barrier. Only light crosses: the two circuits keep separate grounds. The current
  // transfer ratio CTR = I_C/I_F, and the output saturates when the load cannot take CTR·I_F.
  import Escena from '../ui/Escena.svelte';
  import Marco from '../ui/Marco.svelte';
  import Deslizador from '../ui/Deslizador.svelte';
  import Selector from '../ui/Selector.svelte';
  import Grafica from '../ui/Grafica.svelte';
  import { Reloj } from '../nucleo/reloj.svelte';
  import { txt, txtRico, fondo, rr, foton, brillo, azar, Camino, electronesEnCamino, corrienteEnCamino, type Vista } from '../nucleo/dibujo';
  import { hilo, resistencia, diodo, bjt, masa } from '../nucleo/esquema';
  import { alfa, paleta } from '../nucleo/paleta';
  import { si, num, pct } from '../nucleo/formato';
  import { app } from '../../../lib/estado.svelte';

  const reloj = new Reloj();
  const pal = $derived(paleta(app.tema));
  let IF = $state(0.005);
  let ctr = $state(1);
  let RL = $state(1000);
  const VCC = 5;
  const IC = $derived(Math.min(ctr * IF, (VCC - 0.2) / RL));
  const vout = $derived(VCC - IC * RL);
  const saturado = $derived(ctr * IF > (VCC - 0.2) / RL);

  const rnd = azar(101);
  const fot = Array.from({ length: 16 }, () => ({ y: rnd(), t: rnd() }));
  let t = 0;
  function paso(dt: number): void {
    t += dt;
  }

  function dibujar(v: Vista): void {
    void [IF, ctr, RL];
    const { ctx } = v;
    const p = pal;
    fondo(v);
    const est = v.estrecho;
    const cx = v.w / 2;
    const cy = est ? 214 : 160;
    // Package outline (DIP) cut away.
    rr(ctx, cx - 120, cy - 90, 240, 180, 14);
    ctx.fillStyle = alfa('#202326', p.oscuro ? 0.6 : 0.85);
    ctx.fill();
    // Transparent barrier.
    ctx.fillStyle = alfa('#bfe6ff', 0.25);
    ctx.fillRect(cx - 14, cy - 80, 28, 160);
    ctx.strokeStyle = alfa('#bfe6ff', 0.7);
    ctx.setLineDash([5, 4]);
    ctx.strokeRect(cx - 14, cy - 80, 28, 160);
    ctx.setLineDash([]);
    txt(v, 'barrera aislante', cx, est ? cy - 104 : cy + 104, { tam: 12, peso: 700, color: p.suave });
    // LED die and phototransistor die.
    const k = Math.min(1, IF / 0.02);
    if (IF > 0) brillo(ctx, cx - 60, cy, 50, '#ff4466', 0.2 + 0.5 * k);
    rr(ctx, cx - 76, cy - 18, 32, 36, 4);
    ctx.fillStyle = '#7a2633';
    ctx.fill();
    rr(ctx, cx + 44, cy - 24, 36, 48, 4);
    ctx.fillStyle = '#3d4552';
    ctx.fill();
    if (est) {
      txt(v, 'LED IR', cx - 70, cy + 106, { tam: 11.5, color: p.suave, peso: 700 });
      txt(v, 'fototransistor', cx + 80, cy + 106, { tam: 11.5, color: p.suave, peso: 700 });
    } else {
      txt(v, 'LED IR', cx - 60, cy + 34, { tam: 11.5, color: '#e8d6d9', peso: 700 });
      txt(v, 'fototransistor', cx + 62, cy + 40, { tam: 11.5, color: '#d6dde8', peso: 700 });
    }
    const n = Math.round(16 * k);
    for (let i = 0; i < n; i++) {
      const f = fot[i]!;
      const u = (f.t + t * 1.2) % 1;
      const x = cx - 40 + u * 82;
      foton(ctx, x, cy - 26 + f.y * 52, 0, '#ff6688', 20, 3.2, Math.sin(Math.PI * u));
    }
    // Input circuit (left) and output circuit (right), with separate grounds.
    const xi = cx - 220;
    hilo(v, [
      [xi, cy - 100],
      [xi, cy - 60],
    ]);
    txtRico(v, '+5 V', xi, cy - 112, { tam: 13, peso: 800, color: p.positivo });
    resistencia(v, xi, cy - 60, xi, cy - 10, { largo: 40 });
    diodo(v, xi, cy - 6, xi, cy + 40, { tipo: 'led', luz: '#ff4466', conduce: k });
    hilo(v, [
      [xi, cy + 40],
      [xi, cy + 80],
    ]);
    masa(v, xi, cy + 80);
    txt(v, 'masa de entrada', xi, est ? cy + 136 : cy + 112, { tam: 11.5, color: p.suave });
    hilo(v, [
      [xi, cy - 20],
      [cx - 120, cy - 20],
    ]);
    if (est) txtRico(v, `I_F = ${si(IF, 'A', 2)}`, 8, 28, { tam: 13, peso: 800, color: p.corriente, alin: 'left' });
    else txtRico(v, `I_F = ${si(IF, 'A', 2)}`, xi - 14, cy + 18, { tam: 13, peso: 800, color: p.corriente, alin: 'right' });
    const xo = cx + 230;
    txtRico(v, `+${VCC} V`, xo, cy - 112, { tam: 13, peso: 800, color: p.positivo });
    hilo(v, [
      [xo, cy - 100],
      [xo, cy - 80],
    ]);
    resistencia(v, xo, cy - 80, xo, cy - 30, { largo: 40 });
    const tr = bjt(v, xo - 14, cy + 14, { activo: Math.min(1, IC / 0.005) });
    hilo(v, [
      [xo, cy - 30],
      tr.c,
    ]);
    hilo(v, [tr.e, [xo, cy + 80]]);
    masa(v, xo, cy + 80);
    txt(v, 'masa de salida', xo, est ? cy + 136 : cy + 112, { tam: 11.5, color: p.suave });
    hilo(v, [
      [xo, cy - 30],
      [xo + 50, cy - 30],
    ]);
    if (est) {
      txtRico(v, `V_out = ${num(vout, 2)} V`, v.w - 8, 28, { tam: 14, peso: 800, color: p.acento, alin: 'right' });
      txtRico(v, `I_C = ${si(IC, 'A', 2)}`, v.w - 8, 64, { tam: 13, peso: 800, color: p.corriente, alin: 'right' });
    } else {
      txtRico(v, `V_out = ${num(vout, 2)} V`, xo + 54, cy - 48, { tam: 14, peso: 800, color: p.acento, alin: 'left' });
      txtRico(v, `I_C = ${si(IC, 'A', 2)}`, xo + 20, cy + 50, { tam: 13, peso: 800, color: p.corriente, alin: 'left' });
    }
    if (IC > 1e-5) {
      const c = new Camino([
        [xo, cy - 100],
        [xo, cy + 80],
      ]);
      electronesEnCamino(ctx, c, -t * 60, 18, 3, p, Math.min(1, IC / 0.004 + 0.2));
      corrienteEnCamino(ctx, c, t * 40, 80, p, 10, Math.min(1, IC / 0.004 + 0.2));
    }
  }

  const curva = $derived.by(() => {
    const xs: number[] = [];
    const ys: number[] = [];
    for (let i = 0; i <= 100; i++) {
      const f = (i / 100) * 0.02;
      xs.push(f);
      ys.push(Math.min(ctr * f, (VCC - 0.2) / RL));
    }
    return { xs, ys };
  });

  const texto = $derived(
    `La corriente del LED, ${si(IF, 'A', 2)}, produce luz infrarroja que cruza la **barrera aislante** y genera fotocorriente en la base del fototransistor, que la amplifica: I_C = CTR·I_F = ${pct(ctr, 0)} × ${si(IF, 'A', 2)}. ` +
      (saturado ? `Pero con R_L = ${si(RL, 'Ω', 2)} la salida no admite más de ${si((VCC - 0.2) / RL, 'A', 2)}: el fototransistor **satura** y V_out ≈ 0,2 V, que es como se usa en conmutación.` : `La salida queda en ${num(vout, 2)} V.`) +
      '\nNo hay ningún camino eléctrico entre los dos lados: masas separadas y miles de voltios de aislamiento. El CTR dispersa mucho y cae con los años, y el fototransistor es lento (más cuanto mayor es R_L).',
  );
  const lecturas = $derived([
    { e: 'I_C', v: si(IC, 'A', 3), c: pal.corriente },
    { e: 'V_out', v: `${num(vout, 2)} V`, c: pal.acento },
    { e: 'CTR efectivo', v: IF > 0 ? pct(IC / IF, 0) : '—' },
    { e: 'Estado', v: saturado ? 'saturado' : IC < 1e-5 ? 'cortado' : 'activo' },
  ]);
</script>

<Marco {reloj} {texto} {lecturas} leyenda={['foton', 'electron', 'corriente']}>
  {#snippet escena()}
    <Escena {reloj} {paso} {dibujar} dims={(a) => (a < 560 ? [700, 460] : [760, 380])} etiqueta="Optoacoplador: luz que cruza una barrera aislante" />
  {/snippet}
  {#snippet controles()}
    <Deslizador etiqueta="Corriente del LED I_F" bind:valor={IF} min={0} max={0.02} paso={0.0002} unidad="A" />
    <Deslizador etiqueta="CTR del optoacoplador" bind:valor={ctr} min={0.2} max={3} paso={0.05} formato={(x) => pct(x, 0)} />
    <Selector
      etiqueta="Resistencia de carga R_L"
      bind:valor={RL}
      opciones={[
        { valor: 330, texto: '330 Ω' },
        { valor: 1000, texto: '1 kΩ' },
        { valor: 10000, texto: '10 kΩ' },
      ]}
    />
  {/snippet}
  {#snippet grafica()}
    <Grafica
      titulo="Corriente de salida frente a la del LED"
      x={{ etiqueta: 'I_F', unidad: 'A', min: 0, max: 0.02 }}
      y={{ etiqueta: 'I_C', unidad: 'A', min: 0, max: 0.016 }}
      series={[{ x: curva.xs, y: curva.ys, color: pal.acento }]}
      puntos={[{ x: IF, y: IC, color: pal.corriente, etiqueta: si(IC, 'A', 2) }]}
    />
  {/snippet}
</Marco>
