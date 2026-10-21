// Minimal inline markup for UI text, rendered without {@html}: «V_BE», «10^17», «V_{CE(sat)}», «**negrita**».

export interface Trozo {
  t: string;
  sub?: boolean;
  sup?: boolean;
  b?: boolean;
}

export function analizar(s: string): Trozo[] {
  const res: Trozo[] = [];
  const partes = s.split(/(\*\*[^*]+\*\*)/g);
  for (const parte of partes) {
    if (!parte) continue;
    const negrita = parte.startsWith('**') && parte.endsWith('**') && parte.length > 4;
    const cuerpo = negrita ? parte.slice(2, -2) : parte;
    const re = /([_^])(\{[^}]*\}|[−\-+]?[A-Za-z0-9áéíóúñÁÉÍÓÚ]+)/g;
    let k = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(cuerpo))) {
      // An underscore inside a word that is not a subscript marker is unlikely in this app's texts.
      if (m.index > k) res.push({ t: cuerpo.slice(k, m.index), b: negrita });
      const t = m[2]!.replace(/^\{|\}$/g, '');
      res.push(m[1] === '_' ? { t, sub: true, b: negrita } : { t, sup: true, b: negrita });
      k = m.index + m[0].length;
    }
    if (k < cuerpo.length) res.push({ t: cuerpo.slice(k), b: negrita });
  }
  return res;
}

/** Plain text (for aria labels and search). */
export function plano(s: string): string {
  return analizar(s)
    .map((t) => t.t)
    .join('');
}
