// Automatic checks of one page, run inside the page (page.evaluate): text overflowing its box, elements past
// the viewport and horizontal page scroll, covered or overlapping touch targets and targets smaller than 40 px
// (touch profiles), images without size, broken-looking text (NaN, undefined, null, [object Object],
// Infinity), blank pages, English left in the UI, buttons and links without an accessible name, fields
// without a label, and text contrast (WCAG AA, computed here). The function is serialised by Playwright: it
// must not reference anything outside itself.

export interface Crudo {
  sev: 'error' | 'funcional' | 'visual' | 'rendimiento' | 'accesibilidad' | 'texto';
  tipo: string;
  firma: string;
  msg: string;
}

export interface OpcionesComprobar {
  tactil: boolean;
  /** Check the whole document (long pages), not only what is on screen. */
  completa: boolean;
  /** Contrast and accessible names (on by default; off for the repeated screens of a walk). */
  accesibilidad: boolean;
}

export function comprobarPagina(op: OpcionesComprobar): Crudo[] {
  const r: Crudo[] = [];
  const vistos = new Set<string>();
  const anotar = (c: Crudo) => {
    const k = `${c.tipo}|${c.firma}`;
    if (vistos.has(k)) return;
    vistos.add(k);
    r.push(c);
  };
  const W = window.innerWidth;
  const H = window.innerHeight;

  const firma = (el: Element): string => {
    const partes: string[] = [];
    let e: Element | null = el;
    for (let k = 0; e && k < 4 && e !== document.body; k++, e = e.parentElement) {
      const cls = [...e.classList].filter((c) => !/^s-|^svelte-/.test(c)).slice(0, 2);
      partes.unshift(e.tagName.toLowerCase() + cls.map((c) => `.${c}`).join(''));
    }
    return partes.join(' > ');
  };
  const texto = (el: Element) => ((el as HTMLElement).innerText ?? el.textContent ?? '').replace(/\s+/g, ' ').trim();
  const corto = (s: string, n = 60) => (s.length > n ? `${s.slice(0, n)}…` : s);
  const estilo = new Map<Element, CSSStyleDeclaration>();
  const cs = (el: Element) => estilo.get(el) ?? estilo.set(el, getComputedStyle(el)).get(el)!;

  const oculto = (el: Element): boolean => {
    for (let e: Element | null = el; e; e = e.parentElement) {
      const s = cs(e);
      if (s.display === 'none' || s.visibility === 'hidden' || Number(s.opacity) < 0.05) return true;
      if (e.getAttribute('aria-hidden') === 'true' && e !== document.documentElement) return true;
      if ((e as HTMLElement).inert) return true;
    }
    return false;
  };
  const enPantalla = (rc: DOMRect) => rc.bottom > 0 && rc.top < H && rc.right > 0 && rc.left < W;
  const relevante = (el: Element, rc: DOMRect) => rc.width > 0 && rc.height > 0 && (op.completa || enPantalla(rc)) && !oculto(el);
  /** Inside a book text block: its English technical words are the book's, not the UI's. */
  const enLibro = (el: Element) => !!el.closest('article.lectura .bloques, article.lectura p, article.lectura li, article.lectura td, article.lectura th, .texto-libro, .glosario dd, .cita, [data-cita], .enunciado, [data-enunciado], .pie, figcaption, .descripcion, .netlist, textarea, code, pre, kbd, .fichero, .hoja, .ficha');

  const todos = [...document.body.querySelectorAll('*')].filter((e) => !e.closest('svg') || e.tagName.toLowerCase() === 'svg');

  // ---------------------------------------------------------------- page-level
  const raiz = document.scrollingElement ?? document.documentElement;
  if (raiz.scrollWidth > W + 1)
    anotar({ sev: 'visual', tipo: 'scroll-horizontal', firma: 'página', msg: `La página tiene desplazamiento horizontal: ${raiz.scrollWidth} px de ancho en una ventana de ${W} px.` });
  const main = document.querySelector('main') ?? document.body;
  const capa = document.querySelector('.capa-protoboard, [role="dialog"]');
  const zona = capa ?? main;
  const visibleZona = texto(zona);
  const graficos = zona.querySelectorAll('canvas, svg, img').length;
  if (visibleZona.length < 3 && !graficos)
    anotar({ sev: 'funcional', tipo: 'pagina-en-blanco', firma: firma(zona), msg: 'La pantalla está en blanco: sin texto ni gráficos.' });

  // ---------------------------------------------------------------- per element
  const interactivos: { el: Element; rc: DOMRect }[] = [];
  for (const el of todos) {
    const tag = el.tagName.toLowerCase();
    if (tag === 'script' || tag === 'style' || tag === 'template') continue;
    const rc = el.getBoundingClientRect();
    if (!relevante(el, rc)) continue;
    const s = cs(el);
    const tieneTexto = [...el.childNodes].some((n) => n.nodeType === 3 && (n.textContent ?? '').trim().length > 0);

    // ---- text overflowing its box: the text's own boxes (direct text and inline descendants, measured with a
    // Range, so absolutely placed pseudo-elements and hanging icons do not count) against the content box
    const soloLector = rc.width <= 2 || rc.height <= 2 || s.clipPath.startsWith('inset(50%') || (s.clip !== 'auto' && s.position === 'absolute');
    if (!soloLector && s.display !== 'inline' && s.display !== 'contents' && tag !== 'svg' && !el.closest('textarea, pre, code, .cm-editor') && !['auto', 'scroll'].includes(s.overflowX) && s.textOverflow !== 'ellipsis') {
      const nodos: Text[] = [];
      const visitarTexto = (padre: Element) => {
        for (const n of padre.childNodes) {
          if (n.nodeType === 3) {
            if ((n.textContent ?? '').trim()) nodos.push(n as Text);
          } else if (n.nodeType === 1 && !(n as Element).closest('svg') && ['inline', 'contents'].includes(cs(n as Element).display) && cs(n as Element).position !== 'absolute') visitarTexto(n as Element);
        }
      };
      visitarTexto(el);
      if (nodos.length) {
        const rango = document.createRange();
        let x0 = Infinity;
        let x1 = -Infinity;
        let y1 = -Infinity;
        for (const n of nodos) {
          rango.selectNodeContents(n);
          for (const q of rango.getClientRects()) {
            if (q.width === 0) continue;
            x0 = Math.min(x0, q.left);
            x1 = Math.max(x1, q.right);
            y1 = Math.max(y1, q.bottom);
          }
        }
        const pl = parseFloat(s.paddingLeft) + parseFloat(s.borderLeftWidth);
        const pr = parseFloat(s.paddingRight) + parseFloat(s.borderRightWidth);
        const pb = parseFloat(s.borderBottomWidth);
        const izq = rc.left + pl;
        const der = rc.right - pr;
        if (x1 > -Infinity && (x1 > der + 2 || x0 < izq - 2) && rc.width > 4)
          anotar({ sev: 'visual', tipo: 'texto-desborda', firma: firma(el), msg: `Texto más ancho que su caja (sobresale ${Math.round(Math.max(x1 - der, izq - x0))} px): «${corto(texto(el) || el.textContent || '')}».` });
        else if (y1 > rc.bottom - pb + 3 && ['hidden', 'clip'].includes(s.overflowY) && !(Number(s.webkitLineClamp) > 0))
          anotar({ sev: 'visual', tipo: 'texto-cortado', firma: firma(el), msg: `Texto cortado por abajo (${Math.round(y1 - rc.bottom)} px): «${corto(texto(el) || el.textContent || '')}».` });
      }
    }

    // ---- past the viewport's edges, not inside something that scrolls sideways
    if ((tieneTexto || /^(button|a|input|select|img|canvas)$/.test(tag)) && (rc.right > W + 1 || rc.left < -1) && rc.right > 0 && rc.left < W) {
      let desplazable = false;
      let recortado = false;
      for (let e = el.parentElement; e && e !== document.body; e = e.parentElement) {
        const x = cs(e).overflowX;
        if (x === 'auto' || x === 'scroll') {
          desplazable = true;
          break;
        }
        if (x === 'hidden' || x === 'clip') recortado = true;
        if (cs(e).position === 'fixed') break;
      }
      // clipped by a container (html, main…) at the screen's edge is still cut off for the reader
      if (!desplazable && recortado && tieneTexto === false && /^(button|a|input|select)$/.test(tag))
        anotar({ sev: 'visual', tipo: 'cortado', firma: firma(el), msg: `Control cortado por el borde de la pantalla (${Math.round(rc.left)}…${Math.round(rc.right)} px de ${W}): «${corto(el.getAttribute('aria-label') || texto(el) || tag)}».` });
      else if (!desplazable && recortado)
        anotar({ sev: 'visual', tipo: 'cortado', firma: firma(el), msg: `Se sale de la pantalla y queda cortado (${Math.round(rc.left)}…${Math.round(rc.right)} px de ${W}): «${corto(texto(el) || el.getAttribute('aria-label') || tag)}».` });
      if (!desplazable && !recortado)
        anotar({ sev: 'visual', tipo: 'fuera-de-pantalla', firma: firma(el), msg: `Se sale de la pantalla (${Math.round(rc.left)}…${Math.round(rc.right)} px de ${W}): «${corto(texto(el)) || tag}».` });
    }

    // ---- interactive targets
    const rol = el.getAttribute('role');
    const esInteractivo =
      (tag === 'a' && el.hasAttribute('href')) || tag === 'button' || tag === 'select' || tag === 'textarea' || (tag === 'input' && (el as HTMLInputElement).type !== 'hidden') || rol === 'button' || rol === 'tab' || rol === 'link' || rol === 'checkbox' || rol === 'slider' || rol === 'menuitem' || tag === 'summary';
    if (esInteractivo && !(el as HTMLButtonElement).disabled) {
      interactivos.push({ el, rc });
      // inline links inside running text are exempt (WCAG 2.5.8)
      const enLinea = tag === 'a' && s.display === 'inline' && !!el.parentElement && /^(p|li|td|dd|span|em|strong|figcaption|div)$/.test(el.parentElement.tagName.toLowerCase()) && texto(el.parentElement).length > texto(el).length + 10;
      const dentroDeEtiqueta = !!el.closest('label') && (el.closest('label')!.getBoundingClientRect().height >= 40);
      // a larger hit area drawn with an absolutely placed ::before/::after (negative insets) counts
      let ancho = rc.width;
      let alto = rc.height;
      for (const pseudo of ['::before', '::after']) {
        const p = getComputedStyle(el, pseudo);
        if (p.content === 'none' || p.position !== 'absolute') continue;
        const n = (v: string) => (v.endsWith('px') ? Math.max(0, -parseFloat(v)) : 0);
        // negative insets, or the pseudo-element's own size (a box centred with a transform)
        ancho = Math.max(ancho, rc.width + n(p.left) + n(p.right), parseFloat(p.width) || 0);
        alto = Math.max(alto, rc.height + n(p.top) + n(p.bottom), parseFloat(p.height) || 0);
      }
      if (op.tactil && !enLinea && !dentroDeEtiqueta && Math.min(ancho, alto) < 40 && !(tag === 'input' && (el as HTMLInputElement).type === 'range' && rc.width >= 40))
        anotar({ sev: 'accesibilidad', tipo: 'objetivo-pequeno', firma: firma(el), msg: `Objetivo táctil de ${Math.round(ancho)}×${Math.round(alto)} px (mínimo 40): «${corto(texto(el) || el.getAttribute('aria-label') || el.getAttribute('title') || tag, 40)}».` });

      if (op.accesibilidad) {
        // accessible name
        if (tag === 'a' || tag === 'button' || rol === 'button' || rol === 'tab' || rol === 'link' || rol === 'menuitem') {
          const lb = el.getAttribute('aria-labelledby');
          const nombre =
            el.getAttribute('aria-label') ||
            (lb ? lb.split(/\s+/).map((id) => document.getElementById(id)?.textContent ?? '').join(' ') : '') ||
            // textContent: innerText is empty inside chunks that content-visibility skips
            (el.textContent ?? '').trim() ||
            el.getAttribute('title') ||
            [...el.querySelectorAll('img[alt]')].map((i) => i.getAttribute('alt')).join(' ') ||
            [...el.querySelectorAll('svg title, [aria-label]')].map((i) => i.textContent || i.getAttribute('aria-label')).join(' ');
          if (!nombre.trim()) anotar({ sev: 'accesibilidad', tipo: 'sin-nombre', firma: firma(el), msg: `${tag === 'a' ? 'Enlace' : 'Botón'} sin nombre accesible (ni texto, ni aria-label, ni title).` });
        }
        // form fields
        if ((tag === 'input' && !['button', 'submit', 'reset', 'image', 'hidden'].includes((el as HTMLInputElement).type)) || tag === 'select' || tag === 'textarea') {
          const f = el as HTMLInputElement;
          const etiquetado = (f.labels?.length ?? 0) > 0 || el.hasAttribute('aria-label') || el.hasAttribute('aria-labelledby') || el.hasAttribute('title');
          if (!etiquetado)
            anotar({ sev: 'accesibilidad', tipo: 'campo-sin-etiqueta', firma: firma(el), msg: `Campo ${f.type || tag} sin etiqueta${f.placeholder ? ` (solo el texto de ayuda «${corto(f.placeholder, 30)}»)` : ''}.` });
        }
      }
    }

    // ---- images without intrinsic size (the layout jumps when they load)
    if (tag === 'img') {
      const img = el as HTMLImageElement;
      const padre = img.parentElement ? cs(img.parentElement) : null;
      const conTamano =
        (img.hasAttribute('width') && img.hasAttribute('height')) ||
        s.aspectRatio !== 'auto' ||
        ((img.style.width || img.style.maxWidth) && img.style.height) ||
        img.classList.contains('m') ||
        s.position === 'absolute' ||
        (!!padre && padre.aspectRatio !== 'auto');
      if (!conTamano) anotar({ sev: 'visual', tipo: 'imagen-sin-tamano', firma: firma(el), msg: `Imagen sin width/height ni aspect-ratio: ${corto(img.getAttribute('src') ?? '', 60)}.` });
      if (img.complete && img.naturalWidth === 0 && img.getAttribute('src')) anotar({ sev: 'error', tipo: 'imagen-rota', firma: firma(el), msg: `Imagen que no carga: ${corto(img.getAttribute('src') ?? '', 80)}.` });
    }

    // ---- contrast of the element's own text
    if (op.accesibilidad && tieneTexto && tag !== 'svg' && !el.closest('svg')) {
      // inactive controls are exempt (WCAG 1.4.3), also those marked only by a class
      const disabled = (el as HTMLButtonElement).disabled || !!el.closest('[disabled], [aria-disabled="true"], .desactivado, .deshabilitado');
      if (!disabled) {
        const rgba = (c: string): [number, number, number, number] | null => {
          // color-mix() computes to «color(srgb r g b / a)» with 0–1 channels
          const s = /color\(srgb ([\d.e-]+) ([\d.e-]+) ([\d.e-]+)(?: \/ ([\d.]+))?\)/.exec(c);
          if (s) return [Number(s[1]) * 255, Number(s[2]) * 255, Number(s[3]) * 255, s[4] === undefined ? 1 : Number(s[4])];
          const m = /rgba?\(([\d.]+)[, ]+([\d.]+)[, ]+([\d.]+)(?:[, /]+([\d.]+%?))?\)/.exec(c);
          if (!m) return null;
          let a = m[4] === undefined ? 1 : m[4].endsWith('%') ? Number(m[4].slice(0, -1)) / 100 : Number(m[4]);
          if (Number.isNaN(a)) a = 1;
          return [Number(m[1]), Number(m[2]), Number(m[3]), a];
        };
        const fg = rgba(s.color);
        // background: blend the ancestors' backgrounds until an opaque one; give up on images and gradients
        let capas: [number, number, number, number][] = [];
        let incierto = false;
        for (let e: Element | null = el; e; e = e.parentElement) {
          const se = cs(e);
          if (se.backgroundImage !== 'none' || se.backdropFilter !== 'none' || (se.filter !== 'none' && se.filter !== '')) {
            incierto = true;
            break;
          }
          const b = rgba(se.backgroundColor);
          if (b && b[3] > 0) {
            capas.push(b);
            if (b[3] >= 0.99) break;
          }
        }
        if (!incierto && fg) {
          let fondo: [number, number, number] = [255, 255, 255];
          capas = capas.reverse();
          for (const c of capas) fondo = [c[0] * c[3] + fondo[0] * (1 - c[3]), c[1] * c[3] + fondo[1] * (1 - c[3]), c[2] * c[3] + fondo[2] * (1 - c[3])];
          let opacidad = fg[3];
          for (let e: Element | null = el; e; e = e.parentElement) opacidad *= Number(cs(e).opacity);
          const color: [number, number, number] = [fg[0] * opacidad + fondo[0] * (1 - opacidad), fg[1] * opacidad + fondo[1] * (1 - opacidad), fg[2] * opacidad + fondo[2] * (1 - opacidad)];
          const lum = (c: [number, number, number]) => {
            const f = (v: number) => {
              const x = v / 255;
              return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
            };
            return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]);
          };
          const l1 = lum(color);
          const l2 = lum(fondo);
          const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
          const px = parseFloat(s.fontSize);
          const grande = px >= 24 || (px >= 18.66 && Number(s.fontWeight) >= 700);
          const minimo = grande ? 3 : 4.5;
          if (ratio < minimo) {
            const hex = (c: number[]) => '#' + c.slice(0, 3).map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
            anotar({ sev: 'accesibilidad', tipo: 'contraste', firma: `${firma(el)} ${hex(color)}/${hex(fondo)}`, msg: `Contraste ${ratio.toFixed(2)}:1 (mínimo ${minimo}) de ${hex(color)} sobre ${hex(fondo)}: «${corto(texto(el), 40)}».` });
          }
        }
      }
    }
  }

  // ---------------------------------------------------------------- targets covered by something else / overlapping
  // (not inside a chunk the browser is skipping — content-visibility: auto —: its boxes are stale and a tap there
  // reaches the chunk itself)
  // nor scrolled out of a scroller of its own (an index list under its panel's header): its centre must be inside
  // every ancestor that clips
  const centroVisible = (el: Element, rc: DOMRect) => {
    const x = rc.left + rc.width / 2;
    const y = rc.top + rc.height / 2;
    for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) {
      const st = cs(a);
      if (st.overflowX === 'visible' && st.overflowY === 'visible') continue;
      const r = a.getBoundingClientRect();
      if (x < r.left || x > r.right || y < r.top || y > r.bottom) return false;
    }
    return true;
  };
  const enVista = interactivos.filter(
    ({ el, rc }) =>
      rc.top >= 0 &&
      rc.bottom <= H &&
      rc.left >= 0 &&
      rc.right <= W &&
      rc.width >= 4 &&
      rc.height >= 4 &&
      (el as Element & { checkVisibility?: (o: object) => boolean }).checkVisibility?.({ contentVisibilityAuto: true }) !== false &&
      centroVisible(el, rc),
  );
  /** The fixed or sticky box an element moves with (null: the page). */
  const capaDe = (x: Element): Element | null => {
    for (let e: Element | null = x; e; e = e.parentElement) if (cs(e).position === 'fixed' || cs(e).position === 'sticky') return e;
    return null;
  };
  /** Targets a tap at their centre reaches (the ones under an open panel or popover are not compared). */
  const alcanzables: { el: Element; rc: DOMRect }[] = [];
  for (const { el, rc } of enVista) {
    const x = rc.left + rc.width / 2;
    const y = rc.top + rc.height / 2;
    const arriba = document.elementFromPoint(x, y);
    if (arriba && (arriba === el || el.contains(arriba) || arriba.contains(el))) alcanzables.push({ el, rc });
    if (arriba && arriba !== el && !el.contains(arriba) && !arriba.contains(el) && !arriba.closest('label')?.contains(el) && cs(arriba).pointerEvents !== 'none') {
      // only targets covered by something of their own layer: a sticky bar over content scrolled under it, or
      // an overlay (viewer, sheet, search) over the page, is by design
      if (capaDe(arriba) === capaDe(el))
        anotar({ sev: 'visual', tipo: 'objetivo-tapado', firma: firma(el), msg: `El centro de «${corto(texto(el) || el.getAttribute('aria-label') || el.tagName.toLowerCase(), 40)}» está tapado por ${firma(arriba)}.` });
    }
  }
  for (let i = 0; i < alcanzables.length && i < 400; i++)
    for (let j = i + 1; j < alcanzables.length && j < 400; j++) {
      const a = alcanzables[i]!;
      const b = alcanzables[j]!;
      if (a.el.contains(b.el) || b.el.contains(a.el) || capaDe(a.el) !== capaDe(b.el)) continue;
      const ix = Math.min(a.rc.right, b.rc.right) - Math.max(a.rc.left, b.rc.left);
      const iy = Math.min(a.rc.bottom, b.rc.bottom) - Math.max(a.rc.top, b.rc.top);
      if (ix <= 2 || iy <= 2) continue;
      const menor = Math.min(a.rc.width * a.rc.height, b.rc.width * b.rc.height);
      // a control drawn inside another one (the «×» that clears a search field) is a design, not an overlap
      const dentro = (x: DOMRect, y: DOMRect) => x.left >= y.left - 1 && x.right <= y.right + 1 && x.top >= y.top - 1 && x.bottom <= y.bottom + 1;
      if (dentro(a.rc, b.rc) || dentro(b.rc, a.rc)) continue;
      if ((ix * iy) / menor > 0.25)
        anotar({ sev: 'visual', tipo: 'objetivos-solapados', firma: `${firma(a.el)} ⟂ ${firma(b.el)}`, msg: `Dos controles se solapan (${Math.round((100 * ix * iy) / menor)} %): «${corto(texto(a.el) || a.el.getAttribute('aria-label') || '', 30)}» y «${corto(texto(b.el) || b.el.getAttribute('aria-label') || '', 30)}».` });
    }

  // ---------------------------------------------------------------- visible text: broken values and English
  const malos = /(^|[^\p{L}\p{N}_.-])(NaN|undefined|null|\[object Object\]|-?Infinity)(?![\p{L}\p{N}_])/u;
  const ingles =
    /^(Loading|Loading\.\.\.|Error|Warning|Cancel|Close|Save|Open|Settings|Back|Next|Previous|Submit|Delete|Edit|Search|Undo|Redo|Show|Hide|Start|Stop|Pause|Play|Copy|Download|Upload|Untitled|Click|Tap|Select|Choose|Done|Retry|Failed|Success|Unknown|Empty|Remove|Add|Apply|Help|Home|View|Zoom in|Zoom out|Fullscreen|Exit|Simulate|Run|Value|Name|Type|Width|Height|Color|Theme|Light|Dark|Yes|OK|Ok|Continue|Skip|Finish|Reset|Clear|Refresh|Reload|More|Less|Details|Summary|Result|Results|Hint|Answer|Check|Correct|Wrong|Score|Level|Step|Steps|Page|Chapter|Section|Figure|Table)$/;
  // lower-case function words (the book writes gates as «AND», «OR»), two of them or a whole phrase
  const palabrasIngles = /\b(the|and|with|from|your|this|that|is|are|not|of|to|for)\b/g;
  const frasesIngles = /\b(click here|tap here|not found|failed to|could not|unknown error|please)\b/i;
  const recorrido = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n = recorrido.nextNode(); n; n = recorrido.nextNode()) {
    const t = (n.textContent ?? '').trim();
    if (!t) continue;
    const p = n.parentElement;
    if (!p || p.closest('script, style, textarea, pre, code, .cm-editor, kbd, [contenteditable]')) continue;
    const rc = p.getBoundingClientRect();
    if (!relevante(p, rc)) continue;
    const m = malos.exec(t);
    if (m) anotar({ sev: 'texto', tipo: 'valor-roto', firma: `${firma(p)} ${m[2]}`, msg: `Texto visible con «${m[2]}»: «${corto(t, 80)}».` });
    if (!enLibro(p)) {
      if (ingles.test(t)) anotar({ sev: 'texto', tipo: 'ingles', firma: `${firma(p)} ${t}`, msg: `Texto en inglés en la interfaz: «${t}».` });
      else if ((frasesIngles.test(t) || new Set(t.match(palabrasIngles) ?? []).size >= 2) && t.length > 6 && !/[áéíóúñ¿¡]/i.test(t)) anotar({ sev: 'texto', tipo: 'ingles', firma: `${firma(p)} ${corto(t, 30)}`, msg: `Posible frase en inglés en la interfaz: «${corto(t, 80)}».` });
    }
  }
  // attributes the user sees or hears
  for (const el of document.querySelectorAll('[aria-label], [title], [placeholder], [alt]')) {
    const rc = el.getBoundingClientRect();
    if (!relevante(el, rc)) continue;
    for (const a of ['aria-label', 'title', 'placeholder', 'alt']) {
      const v = el.getAttribute(a);
      if (!v) continue;
      const m = malos.exec(v);
      if (m) anotar({ sev: 'texto', tipo: 'valor-roto', firma: `${firma(el)} @${a} ${m[2]}`, msg: `Atributo ${a} con «${m[2]}»: «${corto(v, 80)}».` });
      if (!enLibro(el) && ingles.test(v.trim())) anotar({ sev: 'texto', tipo: 'ingles', firma: `${firma(el)} @${a} ${v}`, msg: `Atributo ${a} en inglés: «${v}».` });
    }
  }
  for (const el of document.querySelectorAll('input, output')) {
    const v = (el as HTMLInputElement).value;
    const rc = el.getBoundingClientRect();
    if (v && relevante(el, rc) && /^(NaN|undefined|null|-?Infinity)$/.test(v.trim()))
      anotar({ sev: 'texto', tipo: 'valor-roto', firma: `${firma(el)} =${v}`, msg: `Campo con el valor «${v}».` });
  }
  return r;
}
