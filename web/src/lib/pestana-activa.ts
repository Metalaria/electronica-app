// One active tab at a time (1.0, browser only: Tauri has one window and the tests' Node harnesses no real page).
//
// The app opened in a second tab shows «La aplicación está abierta en otra pestaña» with «Usar aquí»; pressing it asks
// the active tab to hand over: that tab waits for a synchronisation run in progress, writes everything it has pending
// (`registrarAntesDeCeder`: the run, then every module's pending writes — lib/almacen.ts `volcarTodo`), stops writing
// and only then releases, and shows «Esta pestaña está en pausa» with its own «Usar aquí» (which reloads it as the
// active tab: its memory may be older than what the other tab stored).
//
// Mechanism: the Web Lock `epa-activa` (navigator.locks), held for the tab's whole life by the active tab; the
// BroadcastChannel `epa-activa` carries the hand-over (`pedir` → … → `cedida`) and `quien`/`aqui` (is there an active
// tab?). A tab that crashes or is closed loses the lock with its process (the browser releases it), so «Usar aquí»
// gets it at once. A tab that is frozen (a hung script) keeps it: after `ESPERA_CEDER` without the hand-over the
// screen says so and offers «Usar aquí de todos modos», which takes the lock from it (`steal`); that tab, if it ever
// runs again, is told by the lock's rejection and the channel and pauses — what it had not written by then stays
// unwritten (and the 0.12 protections between tabs, kept, stop a stale copy from overwriting newer data). A reload
// of the active tab: the new page may find the old document's lock not yet released; with no tab answering `quien` it
// waits for it (`ESPERA_PROPIA`) before showing the screen. Back/forward cache: a page restored while it still holds
// the lock is still the active tab; one that lost it pauses.
// Without Web Locks (an old browser): the active tab says `latido` on the channel every second; a new tab that hears
// none in 1.5 s becomes active; two active tabs (opened at once, or a frozen tab that comes back) keep the one that
// became active last (`epoca`), the other pauses after writing what it has pending. Without BroadcastChannel either:
// no gate (as before 1.0).
//
// The guarantee for the data: `escrituraPermitida()` is false from the moment a tab starts handing over until it is
// the active tab again, and lib/almacen.ts refuses every write while it is false (a paused tab never writes; a waiting
// tab never even reads: `obtenerAlmacen` waits for `esperarPestanaActiva`). The flag is synchronous on purpose: a
// check that waited for a task (a lock query) would never complete during `pagehide`, and the flush on closing the page
// would be lost (0.12, ESQUEMA.md: why the Guardado does not use a Web Lock).
//
// Tests: a browser driven by automation (`navigator.webdriver`: every Playwright suite, several of which open two pages
// of one context — among them the 0.12 specs of the protections between tabs writing at once, which stay as a
// defence) has no gate unless `window.__epaPestanaUnica = true` is set before the app loads (tests/datos10-pestanas
// .spec.ts); `window.__epaVariasPestanas = true` switches it off anywhere; `window.__epaEsperasPestana = {ceder,
// propia, latido}` shortens the waits.

import { hayCambiosSinGuardar, puedeSalir } from './salida';

type Estado = 'libre' | 'decidiendo' | 'esperando' | 'activa' | 'cediendo' | 'pausada';

const NOMBRE = 'epa-activa';
const ESPERA_CEDER = 4000;
const ESPERA_PROPIA = 2500;
const LATIDO = 1000;

interface Mensaje {
  tipo: 'pedir' | 'cedida' | 'quien' | 'aqui' | 'latido' | 'robada' | 'activa';
  de: string;
  epoca?: number;
}

let estado: Estado = 'libre';
let iniciado = false;
let listo: () => void = () => {};
const puerta = new Promise<void>((r) => (listo = r));
let soltar: (() => void) | null = null;
let canal: BroadcastChannel | null = null;
let epoca = 0;
const yo = Math.random().toString(36).slice(2, 10);
/** This page was the active tab at some point (taking over again reloads it). */
let fueActiva = false;
const antesDeCeder: (() => Promise<unknown>)[] = [];
const alFinalDeCeder: (() => Promise<unknown>)[] = [];
let pantalla: HTMLElement | null = null;

const ventana = (): (Window & { __epaVariasPestanas?: boolean; __epaPestanaUnica?: boolean; __epaEsperasPestana?: { ceder?: number; propia?: number; latido?: number } }) | null =>
  typeof window !== 'undefined' ? (window as never) : null;
const esperas = () => ventana()?.__epaEsperasPestana ?? {};
const cerrojos = (): LockManager | undefined => (typeof navigator !== 'undefined' ? (navigator as Navigator & { locks?: LockManager }).locks : undefined);

/** Whether the gate applies: a real browser page (not Tauri, not a test harness without a DOM), not switched off. */
function aplica(): boolean {
  const w = ventana();
  if (!w || typeof document === 'undefined' || typeof document.createElement !== 'function' || !document.body) return false;
  if ('__TAURI_INTERNALS__' in w || w.__epaVariasPestanas) return false;
  // (a browser driven by automation — the Playwright suites, which open several pages of one context to check other
  // things — has no gate unless the test asks for it: tests/datos10-pestanas.spec.ts)
  if (typeof navigator !== 'undefined' && navigator.webdriver && !w.__epaPestanaUnica) return false;
  return typeof BroadcastChannel !== 'undefined' || !!cerrojos()?.request;
}

/**
 * Whether this tab may write the reader's data now (always, where the gate does not apply): the active tab, also while
 * it hands over (its last flush; it still holds the lock, so no other tab writes yet).
 */
export function escrituraPermitida(): boolean {
  return estado === 'libre' || estado === 'activa' || estado === 'cediendo';
}

/** Whether this tab may start something new that writes (a synchronisation run): not once it is handing over. */
export function pestanaEnUso(): boolean {
  return estado === 'libre' || estado === 'activa';
}

/** The state, for the tests and the components. */
export function estadoPestana(): Estado {
  return estado;
}

/**
 * Resolves when this tab may use the storage: at once where the gate does not apply or when no other tab is active,
 * else when the reader presses «Usar aquí». Idempotent.
 */
export function esperarPestanaActiva(): Promise<void> {
  if (!iniciado) iniciar();
  return puerta;
}

/**
 * Something to finish before this tab hands over, in order of registration: a run in progress (sincronizar.svelte.ts),
 * then — `alFinal` — every module's pending writes (lib/almacen.ts).
 */
export function registrarAntesDeCeder(f: () => Promise<unknown>, alFinal = false): () => void {
  const lista = alFinal ? alFinalDeCeder : antesDeCeder;
  lista.push(f);
  return () => {
    const i = lista.indexOf(f);
    if (i >= 0) lista.splice(i, 1);
  };
}

function iniciar(): void {
  iniciado = true;
  if (!aplica()) {
    estado = 'libre';
    listo();
    return;
  }
  estado = 'decidiendo';
  // (tests: the state, read by tests/datos10-pestanas.spec.ts)
  (window as unknown as { __epaEstadoPestana?: () => Estado }).__epaEstadoPestana = estadoPestana;
  if (typeof BroadcastChannel !== 'undefined') {
    canal = new BroadcastChannel(NOMBRE);
    canal.onmessage = (e: MessageEvent<Mensaje>) => void recibir(e.data);
  }
  window.addEventListener('pageshow', (e) => void alVolver(e as PageTransitionEvent));
  // (registered before any module's: during the unload no write waits for a check — `antesDeEscribir`)
  window.addEventListener('pagehide', () => (descargando = true), true);
  window.addEventListener('pageshow', () => (descargando = false), true);
  if (cerrojos()?.request) void decidirConCerrojo();
  else void decidirConLatidos();
}

// ------------------------------------------------------------------ with Web Locks

/**
 * Asks for the lock (`ifAvailable`, `steal`, or waiting, abortable); resolves true once held (held until `soltar`),
 * false when not given. A held lock taken away (`steal` in another tab) pauses this tab.
 */
function pedirCerrojo(o: LockOptions): Promise<boolean> {
  return new Promise<boolean>((ok) => {
    cerrojos()!
      .request(NOMBRE, o, (lock) => {
        if (!lock) {
          ok(false);
          return undefined;
        }
        ok(true);
        return new Promise<void>((r) => (soltar = r));
      })
      .catch(() => {
        // aborted before given (our own AbortController) or taken away while held (`steal`)
        ok(false);
        if (estado === 'activa' || estado === 'cediendo') pausarYa();
      });
  });
}

async function decidirConCerrojo(): Promise<void> {
  if (await pedirCerrojo({ ifAvailable: true })) return hacerseActiva();
  // Held. By an active tab (it answers `quien`), or by this very tab's previous document (a reload) still unloading.
  const control = new AbortController();
  const respuesta = new Promise<void>((r) => {
    if (!canal) return;
    const oir = (e: MessageEvent<Mensaje>) => {
      if (e.data?.tipo === 'aqui' || e.data?.tipo === 'latido') {
        canal?.removeEventListener('message', oir);
        r();
      }
    };
    canal.addEventListener('message', oir);
    canal.postMessage({ tipo: 'quien', de: yo } satisfies Mensaje);
  });
  const propia = pedirCerrojo({ signal: control.signal });
  const plazo = new Promise<void>((r) => setTimeout(r, esperas().propia ?? ESPERA_PROPIA));
  const ganado = await Promise.race([propia, respuesta.then(() => false), plazo.then(() => false)]);
  if (ganado) return hacerseActiva();
  control.abort();
  if (await propia) return hacerseActiva();
  estado = 'esperando';
  mostrar('otra');
}

/** The request of a «Usar aquí» still waiting for the lock (withdrawn when another tab becomes the active one). */
let pendiente: AbortController | null = null;

async function tomarConCerrojo(): Promise<void> {
  const control = new AbortController();
  pendiente = control;
  canal?.postMessage({ tipo: 'pedir', de: yo } satisfies Mensaje);
  const pedida = pedirCerrojo({ signal: control.signal });
  let plazo: ReturnType<typeof setTimeout> | undefined;
  const lento = new Promise<false>((r) => (plazo = setTimeout(() => r(false), esperas().ceder ?? ESPERA_CEDER)));
  const ganado = await Promise.race([pedida, lento]);
  clearTimeout(plazo);
  if (ganado) return hacerseActiva();
  // (withdrawn: another tab that asked too became the active one)
  if (control.signal.aborted) return;
  // the active tab does not hand over (frozen, or busy for long): say so; «Usar aquí de todos modos» takes the lock
  mostrar('atascada', async () => {
    control.abort();
    await pedida;
    if (estado === 'activa') return;
    if (await pedirCerrojo({ steal: true })) {
      canal?.postMessage({ tipo: 'robada', de: yo } satisfies Mensaje);
      hacerseActiva();
    } else mostrar('otra');
  });
  // (it may still hand over in the meantime)
  if ((await pedida) && estado !== 'activa') hacerseActiva();
  if (pendiente === control) pendiente = null;
}

// ------------------------------------------------------------------ without Web Locks: heartbeats

let latidos: ReturnType<typeof setInterval> | null = null;
let ultimoLatido = 0;

async function decidirConLatidos(): Promise<void> {
  canal?.postMessage({ tipo: 'quien', de: yo } satisfies Mensaje);
  await new Promise((r) => setTimeout(r, (esperas().latido ?? LATIDO) * 1.5));
  if (Date.now() - ultimoLatido < (esperas().latido ?? LATIDO) * 1.5) {
    estado = 'esperando';
    mostrar('otra');
  } else hacerseActiva();
}

async function tomarConLatidos(): Promise<void> {
  canal?.postMessage({ tipo: 'pedir', de: yo } satisfies Mensaje);
  const plazo = esperas().ceder ?? ESPERA_CEDER;
  const inicio = Date.now();
  // handed over («cedida») or silent: the active tab stopped beating
  while (Date.now() - inicio < plazo) {
    await new Promise((r) => setTimeout(r, 100));
    if (cedidaVista || Date.now() - ultimoLatido > (esperas().latido ?? LATIDO) * 2.5) return hacerseActiva();
  }
  mostrar('atascada', async () => {
    if (estado !== 'activa') hacerseActiva();
  });
}
let cedidaVista = false;

// ------------------------------------------------------------------ messages, states

async function recibir(m: Mensaje): Promise<void> {
  if (!m || m.de === yo) return;
  if (m.tipo === 'latido') {
    ultimoLatido = Date.now();
    // two active tabs (no Web Locks): the one that became active last stays
    if (estado === 'activa' && !cerrojos()?.request && ((m.epoca ?? 0) > epoca || ((m.epoca ?? 0) === epoca && m.de > yo))) await ceder();
    return;
  }
  if (m.tipo === 'cedida') {
    cedidaVista = true;
    return;
  }
  if (m.tipo === 'quien') {
    if (estado === 'activa') canal?.postMessage({ tipo: 'aqui', de: yo } satisfies Mensaje);
    return;
  }
  if (m.tipo === 'pedir' && estado === 'activa') return ceder();
  // another tab that also asked became the active one: this tab's request is withdrawn (else the lock would come here
  // later on its own, when that tab hands over to a third one) and «Usar aquí» is offered again
  if (m.tipo === 'activa' && pendiente && (estado === 'esperando' || estado === 'pausada')) {
    pendiente.abort();
    pendiente = null;
    mostrar(estado === 'pausada' ? 'pausada' : 'otra');
    return;
  }
  if (m.tipo === 'robada' && (estado === 'activa' || estado === 'cediendo')) pausarYa();
}

// ------------------------------------------------------------------ a tab that comes back from a hang

/**
 * A hung tab (a script that blocked it for seconds) whose lock was taken meanwhile (`steal`) learns it from tasks —
 * the lock's rejection, `robada` — that may run AFTER its own timers that were due during the hang, and those timers
 * write (tests/datos10-pestanas.spec.ts, «una pestaña que se cuelga»: another tab's write, merged back by the 0.11
 * learning modules' tab link, landed right after the thaw). So the active tab keeps a pulse (every `PULSO` ms): a write
 * when the pulse is older than `HUECO` — the event loop was blocked, or the timers throttled in a background tab —
 * first checks that this tab still holds `epa-activa` (a lock query, ~1 ms) and waits for it: it is delayed, never
 * refused for it (so a false alarm costs a millisecond); a tab that lost the lock pauses and the write is refused. The
 * pulse never hides a gap: the timer that finds one starts the same check. During the unload no write waits (no later
 * task would run).
 */
const PULSO = 250;
const HUECO = 1500;
let ultimoPulso = 0;
let pulso: ReturnType<typeof setInterval> | null = null;
let comprobando: Promise<void> | null = null;
let descargando = false;

function latirPulso(): void {
  const ahora = performance.now();
  if (ultimoPulso && ahora - ultimoPulso > HUECO) {
    void comprobarTrasHueco();
    return;
  }
  ultimoPulso = ahora;
}

/** Whether `epa-activa` is held by this page (its own lock `epa-yo:<id>` gives its client id); true without an answer. */
async function sigoActiva(): Promise<boolean> {
  const l = cerrojos();
  if (!l?.query) return true;
  try {
    const q = await l.query();
    const de = (n: string) => (q.held ?? []).find((x) => x.name === n)?.clientId;
    const activa = de(NOMBRE);
    return !!activa && activa === de(`epa-yo:${yo}`);
  } catch {
    return true;
  }
}

function comprobarTrasHueco(): Promise<void> {
  comprobando ??= (async () => {
    try {
      if (cerrojos()?.query) {
        if (!(await sigoActiva())) pausarYa();
      } else if (canal) {
        // without Web Locks: a newer active tab beats within a beat and a half (`recibir` cedes to it)
        await new Promise((r) => setTimeout(r, (esperas().latido ?? LATIDO) * 1.5));
      }
    } catch {
      // (no answer: as it was)
    } finally {
      ultimoPulso = performance.now();
      comprobando = null;
    }
  })();
  return comprobando;
}

/**
 * Before a write (lib/almacen.ts): null when it may go at once, else a promise to await first (the check after a
 * hang). The caller checks `escrituraPermitida()` after it.
 */
export function antesDeEscribir(): Promise<void> | null {
  if ((estado !== 'activa' && estado !== 'cediendo') || descargando) return null;
  if (comprobando) return comprobando;
  if (ultimoPulso && performance.now() - ultimoPulso > HUECO) return comprobarTrasHueco();
  return null;
}

function hacerseActiva(): void {
  if (fueActiva && estado !== 'activa') {
    // this page was active before and paused: its modules' memory may be older than what the other tab stored — it
    // starts again (still writing nothing: the flushes of its unload are refused; the new page asks for the lock)
    estado = 'pausada';
    soltar?.();
    soltar = null;
    location.reload();
    return;
  }
  estado = 'activa';
  fueActiva = true;
  epoca = Date.now();
  // (tests: when this page became the active tab, on the clock the pages share)
  (window as unknown as { __epaActivaDesde?: number }).__epaActivaDesde = performance.timeOrigin + performance.now();
  cedidaVista = false;
  quitarPantalla();
  canal?.postMessage({ tipo: 'activa', de: yo } satisfies Mensaje);
  ultimoPulso = performance.now();
  pulso ??= setInterval(() => {
    if (estado === 'activa') latirPulso();
  }, PULSO);

  // (a lock of this page alone: its client id tells, after the back/forward cache, whether `epa-activa` is still ours)
  if (cerrojos()?.request) void cerrojos()!.request(`epa-yo:${yo}`, () => new Promise<void>(() => {})).catch(() => undefined);
  if (!cerrojos()?.request && canal && !latidos) {
    const latir = () => canal?.postMessage({ tipo: 'latido', de: yo, epoca } satisfies Mensaje);
    latir();
    // (also while handing over: the other tab waits for «cedida», not for silence)
    latidos = setInterval(() => {
      if (estado === 'activa' || estado === 'cediendo') latir();
    }, esperas().latido ?? LATIDO);
  }
  listo();
}

/** Hands over: everything pending written first, then no more writes, then the lock released. */
async function ceder(): Promise<void> {
  if (estado !== 'activa') return;
  estado = 'cediendo';
  mostrar('pausando');
  // (a request seen after a hang may be old: the asking tab may have taken the lock meanwhile — «Usar aquí de todos
  // modos» —, and then this tab must not flush over its writes; datos10-pestanas.spec.ts «se cuelga», 2 of 16 before)
  if (!(await sigoActiva())) {
    pausarYa();
    return;
  }
  // (writes are still allowed while handing over: `escrituraPermitida`)
  for (const f of [...antesDeCeder, ...alFinalDeCeder]) {
    try {
      await Promise.race([f(), new Promise((r) => setTimeout(r, 5000))]);
    } catch {
      // (a write that fails stays pending in its module; the next active tab reads the storage as it is)
    }
  }
  pausarYa();
  canal?.postMessage({ tipo: 'cedida', de: yo } satisfies Mensaje);
}

function pausarYa(): void {
  estado = 'pausada';
  soltar?.();
  soltar = null;
  mostrar('pausada');
}

async function alVolver(e: PageTransitionEvent): Promise<void> {
  if (!e.persisted || estado !== 'activa') return;
  // restored from the back/forward cache: still the active tab only if the lock is still held (by this page: nobody
  // else could have taken it while it was held)
  if (!(await sigoActiva())) pausarYa();
}

// ------------------------------------------------------------------ the screen

type Pantalla = 'otra' | 'atascada' | 'pausando' | 'pausada';

const TEXTOS: Record<Pantalla, { titulo: string; texto: string; boton?: string }> = {
  otra: {
    titulo: 'La aplicación está abierta en otra pestaña',
    texto: 'Para que sus datos no se mezclen, solo se puede usar en una pestaña a la vez. Si la usa aquí, la otra pestaña guardará lo que tenga pendiente y quedará en pausa.',
    boton: 'Usar aquí',
  },
  atascada: {
    titulo: 'La otra pestaña no responde',
    texto: 'Puede que esté bloqueada o muy ocupada. Si la cierra, esta tomará el relevo. Si la usa aquí de todos modos, lo que la otra pestaña no hubiera guardado todavía no se guardará.',
    boton: 'Usar aquí de todos modos',
  },
  pausando: { titulo: 'Esta pestaña está en pausa', texto: 'Guardando lo pendiente antes de pasar a la otra pestaña…' },
  pausada: {
    titulo: 'Esta pestaña está en pausa',
    texto: 'La aplicación se está usando en otra pestaña. Lo que hizo aquí está guardado.',
    boton: 'Usar aquí',
  },
};

const ESTILO = `
.epa-pestana{position:fixed;inset:0;z-index:2147483000;display:grid;place-items:center;padding:16px;
  background:var(--fondo,#fcfbf8);color:var(--tinta,#262626);font-family:var(--sans,system-ui,sans-serif)}
.epa-pestana__caja{max-width:30em;background:var(--superficie,#fff);border:1px solid var(--linea,#e3dfd6);
  border-radius:12px;padding:24px;box-shadow:var(--sombra,none)}
.epa-pestana h1{margin:0 0 .6em;font-size:1.3rem;line-height:1.3;color:var(--titulos,#1a3a5c);outline:none}
.epa-pestana p{margin:0 0 1.2em;line-height:1.5;font-size:1rem}
.epa-pestana button{min-height:44px;min-width:44px;padding:10px 20px;border-radius:8px;border:1px solid var(--acento,#2e6ea6);
  background:var(--acento,#2e6ea6);color:var(--superficie,#fff);font:inherit;font-weight:600;cursor:pointer}
.epa-pestana button:focus-visible{outline:3px solid var(--titulos,#1a3a5c);outline-offset:2px}
`;

function mostrar(cual: Pantalla, accion?: () => Promise<void>): void {
  if (!pantalla) {
    const estilo = document.createElement('style');
    estilo.textContent = ESTILO;
    document.head.appendChild(estilo);
    pantalla = document.createElement('div');
    pantalla.className = 'epa-pestana';
    pantalla.setAttribute('role', 'dialog');
    pantalla.setAttribute('aria-modal', 'true');
    pantalla.setAttribute('aria-labelledby', 'epa-pestana-titulo');
    pantalla.setAttribute('aria-describedby', 'epa-pestana-texto');
    document.body.appendChild(pantalla);
  }
  const app = document.getElementById('app');
  if (app) app.inert = true;
  const t = TEXTOS[cual];
  pantalla.dataset.pantalla = cual;
  pantalla.innerHTML = '';
  const caja = document.createElement('div');
  caja.className = 'epa-pestana__caja';
  const h = document.createElement('h1');
  h.id = 'epa-pestana-titulo';
  h.tabIndex = -1;
  h.textContent = t.titulo;
  const p = document.createElement('p');
  p.id = 'epa-pestana-texto';
  p.textContent = t.texto;
  if (cual === 'pausando') p.setAttribute('role', 'status');
  caja.append(h, p);
  let boton: HTMLButtonElement | null = null;
  if (t.boton) {
    boton = document.createElement('button');
    boton.type = 'button';
    boton.textContent = t.boton;
    boton.addEventListener('click', () => {
      boton!.disabled = true;
      void (async () => {
        // (review 10f: «Usar aquí» of a paused tab reloads it — a page with unsaved changes, the teacher-mode editor,
        // asks first with the app's dialog, shown above this screen; «Cancelar» leaves the tab paused as it was)
        if (cual === 'pausada' && hayCambiosSinGuardar()) {
          const p = pantalla;
          if (p) p.style.display = 'none';
          const ok = await puedeSalir();
          if (p) p.style.display = '';
          if (!ok) {
            boton!.disabled = false;
            boton!.focus();
            return;
          }
        }
        await (accion ? accion() : tomar());
      })();
    });
    caja.append(boton);
  }
  pantalla.append(caja);
  (boton ?? h).focus();
}

function tomar(): Promise<void> {
  return cerrojos()?.request ? tomarConCerrojo() : tomarConLatidos();
}

function quitarPantalla(): void {
  pantalla?.remove();
  pantalla = null;
  const app = document.getElementById('app');
  if (app) app.inert = false;
}
