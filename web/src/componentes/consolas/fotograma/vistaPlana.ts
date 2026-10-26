// Pan and zoom of a flat view (the board or the photo of «Un fotograma»): mouse drag, wheel and trackpad pinch,
// one-finger pan and two-finger pinch on touch. Units of the content -> CSS px: x' = ox + x · k.

export class VistaPlana {
  k = 1;
  ox = 0;
  oy = 0;
  ancho = 0;
  alto = 0;
  anchoContenido = 1;
  altoContenido = 1;
  private punteros = new Map<number, { x: number; y: number }>();
  private arrastre: { x: number; y: number; ox: number; oy: number } | null = null;
  private pellizco: { d: number; cx: number; cy: number; k: number; ox: number; oy: number } | null = null;

  constructor(private readonly alCambiar: () => void) {}

  ajustar(): void {
    if (this.ancho <= 0) return;
    this.k = Math.min(this.ancho / this.anchoContenido, this.alto / this.altoContenido) * 0.96;
    this.ox = (this.ancho - this.anchoContenido * this.k) / 2;
    this.oy = (this.alto - this.altoContenido * this.k) / 2;
    this.alCambiar();
  }

  private limitar(): void {
    const kmin = Math.min(this.ancho / this.anchoContenido, this.alto / this.altoContenido) * 0.5;
    const kmax = kmin * 40;
    this.k = Math.max(kmin, Math.min(kmax, this.k));
    const w = this.anchoContenido * this.k;
    const h = this.altoContenido * this.k;
    this.ox = Math.min(this.ancho * 0.8, Math.max(this.ancho * 0.2 - w, this.ox));
    this.oy = Math.min(this.alto * 0.8, Math.max(this.alto * 0.2 - h, this.oy));
  }

  zoom(f: number, cx = this.ancho / 2, cy = this.alto / 2): void {
    const k0 = this.k;
    this.k *= f;
    this.limitar();
    const r = this.k / k0;
    this.ox = cx - (cx - this.ox) * r;
    this.oy = cy - (cy - this.oy) * r;
    this.limitar();
    this.alCambiar();
  }

  private pos(el: HTMLElement, ev: PointerEvent | WheelEvent): { x: number; y: number } {
    const r = el.getBoundingClientRect();
    return { x: ev.clientX - r.left, y: ev.clientY - r.top };
  }

  abajo(el: HTMLElement, ev: PointerEvent): void {
    el.setPointerCapture(ev.pointerId);
    const p = this.pos(el, ev);
    this.punteros.set(ev.pointerId, p);
    if (this.punteros.size === 2) {
      const [a, b] = [...this.punteros.values()] as [{ x: number; y: number }, { x: number; y: number }];
      this.pellizco = { d: Math.hypot(a.x - b.x, a.y - b.y), cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2, k: this.k, ox: this.ox, oy: this.oy };
      this.arrastre = null;
    } else if (this.punteros.size === 1) this.arrastre = { x: p.x, y: p.y, ox: this.ox, oy: this.oy };
  }

  mover(el: HTMLElement, ev: PointerEvent): void {
    if (!this.punteros.has(ev.pointerId)) return;
    const p = this.pos(el, ev);
    this.punteros.set(ev.pointerId, p);
    if (this.pellizco && this.punteros.size === 2) {
      const [a, b] = [...this.punteros.values()] as [{ x: number; y: number }, { x: number; y: number }];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      const cx = (a.x + b.x) / 2;
      const cy = (a.y + b.y) / 2;
      this.k = this.pellizco.k * (d / Math.max(1, this.pellizco.d));
      this.limitar();
      const r = this.k / this.pellizco.k;
      this.ox = cx - (this.pellizco.cx - this.pellizco.ox) * r;
      this.oy = cy - (this.pellizco.cy - this.pellizco.oy) * r;
      this.limitar();
      this.alCambiar();
    } else if (this.arrastre) {
      this.ox = this.arrastre.ox + p.x - this.arrastre.x;
      this.oy = this.arrastre.oy + p.y - this.arrastre.y;
      this.limitar();
      this.alCambiar();
    }
  }

  arriba(ev: PointerEvent): void {
    this.punteros.delete(ev.pointerId);
    if (this.punteros.size < 2) this.pellizco = null;
    if (this.punteros.size === 0) this.arrastre = null;
  }

  rueda(el: HTMLElement, ev: WheelEvent): void {
    ev.preventDefault();
    const p = this.pos(el, ev);
    const unidad = ev.deltaMode === 1 ? 16 : ev.deltaMode === 2 ? 400 : 1;
    const dx = ev.deltaX * unidad;
    const dy = ev.deltaY * unidad;
    const trackpad = !ev.ctrlKey && ev.deltaMode === 0 && (dx !== 0 || Math.abs(dy) < 50) && !Number.isInteger(dy / 100);
    if (trackpad && !ev.shiftKey) {
      this.ox -= dx;
      this.oy -= dy;
      this.limitar();
      this.alCambiar();
      return;
    }
    this.zoom(Math.exp(-dy * (ev.ctrlKey ? 0.012 : 0.0018)), p.x, p.y);
  }
}
