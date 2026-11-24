// 1.4.1: the clock of the real Brymen's loop, in a worker of its own. A page whose window is hidden or covered gets
// its timers slowed by the browser to about one a second; a dedicated worker's timers keep their pace. It answers
// each message after the milliseconds it carries, with the same id.

const ambito = self as unknown as {
  onmessage: ((e: MessageEvent<{ id: number; ms: number }>) => void) | null;
  postMessage(m: number): void;
};

ambito.onmessage = (e) => {
  const { id, ms } = e.data;
  setTimeout(() => ambito.postMessage(id), ms);
};
