// Applies a practice's settings (variant, connections, instrument controls, component values) to the bench.

import type { Banco } from '../banco.svelte.ts';
import type { Ajustes, Practica, Variante } from './tipos';
import { CIRCUITOS } from './circuitos';
import { BM_POSICIONES } from '../motor/dmm.ts';
import { limitarDds } from '../motor/generador.ts';
import { FN_DMM_LISTA } from '../fnirsi/logica.svelte.ts';
import { aplicarParametro } from '../../../simulador/motor/netlist.ts';

export function varianteDe(p: Practica, id: string): Variante {
  return p.variantes.find((v) => v.id === id) ?? p.variantes[0]!;
}

/** Loads a variant's circuit (keeps the leads where they were when the nodes still exist). */
export function cargarVariante(b: Banco, p: Practica, id: string): void {
  const v = varianteDe(p, id);
  const antes = { bm: b.bm, fn: b.fn, sondas: b.sondas };
  b.cargar(CIRCUITOS[v.circuito] ?? '', `Práctica ${p.n} · ${v.nombre}`, {
    generador: v.generador ?? null,
    asentamiento: v.asentamiento ?? 0,
    dinamico: v.dinamico ?? false,
  });
  b.variante = v.id;
  const existe = (n: string | null) => n === null || n === '0' || b.circuito.nodos.some((x) => x.toLowerCase() === n.toLowerCase());
  const elem = (s: { elemento: string } | null) => !s || b.circuito.elementos.some((e) => e.nombre.toLowerCase() === s.elemento.toLowerCase());
  if (existe(antes.bm.rojo) && existe(antes.bm.negro) && elem(antes.bm.serie)) b.bm = antes.bm;
  if (existe(antes.fn.rojo) && existe(antes.fn.negro) && elem(antes.fn.serie)) b.fn = antes.fn;
  b.sondas = {
    ch1: existe(antes.sondas.ch1) ? antes.sondas.ch1 : null,
    ch2: existe(antes.sondas.ch2) ? antes.sondas.ch2 : null,
    masa: existe(antes.sondas.masa) ? antes.sondas.masa : '0',
  };
}

export function aplicar(b: Banco, p: Practica, a: Ajustes): void {
  if (a.variante && a.variante !== b.variante) cargarVariante(b, p, a.variante);
  if (a.alimentado !== undefined) b.alimentado = a.alimentado;
  if (a.parametros) {
    let t = b.texto;
    for (const [id, v] of Object.entries(a.parametros)) t = aplicarParametro(t, id, v);
    b.texto = t;
  }
  const m = b.brymen;
  if (a.bm) {
    if (a.bm.borne) m.ponerBorne(a.bm.borne);
    if (a.bm.pos) {
      const i = BM_POSICIONES.findIndex((x) => x.id === a.bm!.pos);
      if (i >= 0) m.girar(i);
    }
    if (a.bm.sub !== undefined) m.sub = a.bm.sub;
    if (a.bm.serie !== undefined && a.bm.serie) b.enSerie('bm', a.bm.serie.elemento, a.bm.serie.terminal);
    else {
      if (a.bm.rojo !== undefined) b.poner('bmRojo', a.bm.rojo);
      if (a.bm.negro !== undefined) b.poner('bmNegro', a.bm.negro);
      if (a.bm.serie === null) b.bm = { ...b.bm, serie: null };
    }
  }
  const f = b.fnirsi;
  if (a.fnDmm) {
    if (a.fnDmm.funcion) {
      const i = FN_DMM_LISTA.findIndex((x) => x.id === a.fnDmm!.funcion);
      if (i >= 0) f.fnDmm = i;
    }
    if (a.fnDmm.borne) f.borne = a.fnDmm.borne;
    if (a.fnDmm.serie) b.enSerie('fn', a.fnDmm.serie.elemento, a.fnDmm.serie.terminal);
    else if (a.fnDmm.serie === null) b.fn = { rojo: null, negro: null, serie: null };
    if (a.fnDmm.rojo !== undefined) b.poner('fnRojo', a.fnDmm.rojo);
    if (a.fnDmm.negro !== undefined) b.poner('fnNegro', a.fnDmm.negro);
  }
  if (a.sondas) {
    if (a.sondas.ch1 !== undefined) b.poner('ch1', a.sondas.ch1);
    if (a.sondas.ch2 !== undefined) b.poner('ch2', a.sondas.ch2);
    if (a.sondas.masa !== undefined) b.poner('masa', a.sondas.masa);
  }
  if (a.fn) {
    const o = a.fn;
    f.encendido = true;
    if (o.modo) f.elegirModo(o.modo);
    o.ch?.forEach((c, k) => {
      if (!c) return;
      const ch = f.canales[k]!;
      if (c.on !== undefined) ch.on = c.on;
      if (c.x10 !== undefined) {
        ch.sondaX10 = c.x10;
        if (ch.menuX10 !== c.x10) {
          ch.menuX10 = c.x10;
          if (c.vDiv === undefined) ch.vDiv = ch.vDiv * (c.x10 ? 10 : 0.1);
        }
      }
      if (c.vDiv !== undefined) ch.vDiv = c.vDiv;
      if (c.pos !== undefined) ch.pos = c.pos;
      if (c.ac !== undefined) ch.ac = c.ac;
      if (c.invertir !== undefined) ch.invertir = c.invertir;
    });
    if (o.sDiv !== undefined) f.sDiv = o.sDiv;
    if (o.hpos !== undefined) f.hpos = o.hpos;
    if (o.disparo) f.disparo = { ...f.disparo, ...o.disparo };
    if (o.mates !== undefined) f.mates = o.mates;
    if (o.cursores !== undefined) f.cursores = o.cursores;
    if (o.cur) f.cur = { ...o.cur };
    if (o.xy !== undefined) f.xy = o.xy;
    if (o.prm !== undefined) f.prm = o.prm;
    if (o.dds) f.dds = limitarDds({ ...f.dds, ...o.dds });
    if (o.run !== undefined) f.run = o.run;
    else {
      f.run = true;
      f.esperando = false;
    }
    f.menu = null;
  }
}

/** Starts a practice from its initial settings. */
export function iniciarPractica(b: Banco, p: Practica): void {
  b.anotaciones = [];
  cargarVariante(b, p, p.inicial.variante ?? p.variantes[0]!.id);
  b.bm = { rojo: null, negro: null, serie: null };
  b.fn = { rojo: null, negro: null, serie: null };
  b.sondas = { ch1: null, ch2: null, masa: '0' };
  b.alimentado = true;
  aplicar(b, p, { ...p.inicial, variante: undefined });
}
