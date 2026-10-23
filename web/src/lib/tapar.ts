// Hides the analysis of the problems the reader is trying (blocks [desde, hasta) of a part, top level),
// with one shared <style> element: no DOM of the reader is touched, and chunks rendered later are
// hidden too.

const tapadas = new Map<string, { parte: string; desde: number; hasta: number }>();
let estilo: HTMLStyleElement | null = null;

function escribir(): void {
  if (typeof document === 'undefined') return;
  if (!estilo) {
    estilo = document.createElement('style');
    estilo.id = 'epa-tapadas';
    document.head.appendChild(estilo);
  }
  const reglas: string[] = [];
  for (const t of tapadas.values()) {
    const sel: string[] = [];
    for (let i = t.desde; i < t.hasta; i++) sel.push(`article[id="${CSS.escape(t.parte)}"] .trozo > [data-b="${i}"]`);
    if (sel.length) reglas.push(`${sel.join(',')}{display:none!important}`);
  }
  estilo.textContent = reglas.join('\n');
}

export function tapar(label: string, parte: string, desde: number, hasta: number, si: boolean): void {
  const actual = tapadas.has(label);
  if (si === actual) return;
  if (si) tapadas.set(label, { parte, desde, hasta });
  else tapadas.delete(label);
  escribir();
}
