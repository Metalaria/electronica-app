// A reactive clock that ticks once a minute (and when the page becomes visible again), for views whose state depends
// on the time passing — the spaced review's «Para repasar hoy» (review 10d: it only changed when the view was opened
// again). One interval for the whole app, started by the first reader.

const reloj = $state({ ahora: Date.now() });
let iniciado = false;

function iniciar(): void {
  if (iniciado || typeof window === 'undefined') return;
  iniciado = true;
  setInterval(() => (reloj.ahora = Date.now()), 60_000);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) reloj.ahora = Date.now();
  });
}

/** Now (ms), as a reactive value: an effect or derived that reads it runs again every minute. */
export function ahoraMinuto(): number {
  iniciar();
  return reloj.ahora;
}
