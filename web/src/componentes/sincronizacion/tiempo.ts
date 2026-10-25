// «hace 3 min (25 oct, 10:02)»: relative time for the synchronisation pages.

export function cuando(t: number, ahora = Date.now()): string {
  const d = Math.max(0, ahora - t);
  const fecha = new Date(t).toLocaleString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  if (d < 60_000) return `hace un momento (${fecha})`;
  if (d < 3_600_000) return `hace ${Math.round(d / 60_000)} min (${fecha})`;
  if (d < 86_400_000) return `hace ${Math.round(d / 3_600_000)} h (${fecha})`;
  return `el ${fecha}`;
}
