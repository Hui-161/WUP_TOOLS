#!/usr/bin/env node
/*
  Smoke-Test fuer WP-C (v2.25, EXPERIMENTELL): Gruppen-Verschieben bei
  Mehrfachauswahl im Verschieben-Modus.
    a) nrGruppenEndpunkte: gleichseitige Endpunkt-Wahl — robust gegen
       vertauschte xa/xe-Orientierung, Sonderfaelle Einzelnagel und quer
       liegende NR.
    b) nrGruppenEndpunkteSetzen: gemeinsames Delta ab Schnappschuss,
       _modified gesetzt, nur die Zielseite bewegt sich.
    c) opsGruppeSetzen: ganze Gruppe (NR + PAF + PSF) verschiebt sich um EIN
       Delta, relative Abstaende bleiben, wiederholtes Setzen driftet nicht.
    d) Export nach Gruppen-Verschieben laeuft ohne Exception.
*/
'use strict';
const { editorKontext, wupLaden, vm } = require('./harness');

let fehler = 0;
function pruefe(bedingung, text) {
  if (bedingung) console.log('  OK      ' + text);
  else { console.error('  FEHLER  ' + text); fehler++; }
}

/* Drei parallele vertikale NRs (Reihen), die mittlere mit VERTAUSCHTER
   Orientierung (xa/ya = oben), dazu eine quer liegende und ein Einzelnagel,
   plus PAF + PSF fuer den Gruppen-Move. */
function testDatei() {
  return [
    'VERSION 3.4;', 'ELN test;', 'ELM     4000, 2500, 235, 1;',
    'PLI1    4000, 2500, 15, 0, 0, 30, Platte-A, 160;',
    'PP      0, 0;', 'PP      4000, 0;', 'PP      4000, 2500;', 'PP      0, 2500;', 'PP      0, 0;',
    'NR      500, 100, 500, 2400, 150, 10;',     /* Reihe 1: a unten, e oben */
    'NR      1000, 2400, 1000, 100, 150, 10;',   /* Reihe 2: VERTAUSCHT — a oben, e unten */
    'NR      1500, 100, 1500, 2400, 150, 10;',   /* Reihe 3: a unten, e oben */
    'NR      2000, 1200, 3000, 1200, 150, 10;',  /* quer liegende NR */
    'NR      3500, 800, 3500, 800, 1, 10;',      /* Einzelnagel (Start == Ende) */
    'PAF;',
    'PP      2000, 300, 15, 211, 0;', 'PP      2400, 300, 15, 211, 0;',
    'PSF;',
    'PP      2600, 300, 15, 0, 0, 0;', 'PP      2900, 300, 15, 0, 0, 0;',
    'PP      2900, 600, 15, 0, 0, 0;', 'PP      2600, 600, 15, 0, 0, 0;', 'PP      2600, 300, 15, 0, 0, 0;',
    ''].join('\r\n');
}

/* --- a) Gleichseitige Endpunkt-Wahl --- */
{
  const ctx = editorKontext();
  wupLaden(ctx, testDatei());
  const erg = vm.runInContext(`
    (() => {
      const nrs = modell.layers[0].ops.filter(o => o.kw === 'NR').map(op => ({ op, lage: modell.layers[0] }));
      const r1 = nrs[0].op, r2 = nrs[1].op, r3 = nrs[2].op, quer = nrs[3].op, einzel = nrs[4].op;
      /* Klick auf den UNTEREN Endpunkt von Reihe 1 (ende 'a', y=100) */
      const ziele = nrGruppenEndpunkte([nrs[0], nrs[1], nrs[2], nrs[3], nrs[4]], r1, 'a');
      const je = {};
      ziele.forEach(z => { je[z.op.id] = z.ende; });
      return {
        anzahl: ziele.length,
        r1: je[r1.id], r2: je[r2.id], r3: je[r3.id], quer: je[quer.id], einzel: je[einzel.id],
        /* Gegenprobe: Klick auf den OBEREN Endpunkt von Reihe 1 (ende 'e') */
        oben: (() => {
          const z2 = nrGruppenEndpunkte([nrs[0], nrs[1], nrs[2]], r1, 'e');
          const j2 = {}; z2.forEach(z => { j2[z.op.id] = z.ende; });
          return { r1: j2[r1.id], r2: j2[r2.id], r3: j2[r3.id] };
        })()
      };
    })()
  `, ctx);
  pruefe(erg.anzahl === 5, 'nrGruppenEndpunkte liefert je NR genau ein Ziel: ' + erg.anzahl);
  pruefe(erg.r1 === 'a' && erg.r3 === 'a', 'gleich orientierte Reihen: unterer Endpunkt = a/a: ' + erg.r1 + '/' + erg.r3);
  pruefe(erg.r2 === 'e', 'VERTAUSCHT orientierte Reihe 2: unterer Endpunkt korrekt als e erkannt: ' + erg.r2);
  pruefe(erg.oben.r1 === 'e' && erg.oben.r2 === 'a' && erg.oben.r3 === 'e',
    'Gegenprobe oberer Endpunkt: e/a/e: ' + erg.oben.r1 + '/' + erg.oben.r2 + '/' + erg.oben.r3);
  pruefe(erg.quer === 'a', 'quer liegende NR: Rueckfall auf den naechstgelegenen Endpunkt (a bei x=2000): ' + erg.quer);
  pruefe(erg.einzel === 'a', 'Einzelnagel (keine Achse): uebernimmt die angeklickte Seite: ' + erg.einzel);
}

/* --- b) Gemeinsames Delta auf die Zielseite, andere Seite bleibt --- */
{
  const ctx = editorKontext();
  wupLaden(ctx, testDatei());
  const erg = vm.runInContext(`
    (() => {
      const lage = modell.layers[0];
      const nrs = lage.ops.filter(o => o.kw === 'NR').slice(0, 3).map(op => ({ op, lage }));
      const r1 = nrs[0].op, r2 = nrs[1].op, r3 = nrs[2].op;
      const ziele = nrGruppenEndpunkte(nrs, r1, 'a').map(z => ({
        opId: z.op.id, ende: z.ende,
        start: z.ende === 'a' ? { x: z.op.nr.xa, y: z.op.nr.ya } : { x: z.op.nr.xe, y: z.op.nr.ye }
      }));
      /* Reihen unten um 50 mm verkuerzen (nach oben schieben) */
      nrGruppenEndpunkteSetzen(ziele, 0, 50);
      return {
        r1a: [r1.nr.xa, r1.nr.ya], r1e: [r1.nr.xe, r1.nr.ye],
        r2a: [r2.nr.xa, r2.nr.ya], r2e: [r2.nr.xe, r2.nr.ye],
        r3a: [r3.nr.ya], modified: [r1, r2, r3].every(o => o._modified)
      };
    })()
  `, ctx);
  pruefe(erg.r1a[1] === 150 && erg.r1a[0] === 500, 'Reihe 1: unterer Punkt (a) 100 -> 150, x unveraendert: ' + erg.r1a.join('/'));
  pruefe(erg.r1e[1] === 2400, 'Reihe 1: oberer Punkt (e) bleibt bei 2400');
  pruefe(erg.r2e[1] === 150 && erg.r2a[1] === 2400, 'Reihe 2 (vertauscht): NUR der untere Punkt (e) wandert: e=' + erg.r2e[1] + ', a=' + erg.r2a[1]);
  pruefe(erg.r3a[0] === 150, 'Reihe 3: unterer Punkt 100 -> 150');
  pruefe(erg.modified, 'alle drei NRs sind _modified');
}

/* --- c) Ganze Gruppe verschieben (NR + PAF + PSF), kein Drift --- */
{
  const ctx = editorKontext();
  wupLaden(ctx, testDatei());
  const erg = vm.runInContext(`
    (() => {
      const lage = modell.layers[0];
      const nr = lage.ops.find(o => o.kw === 'NR');
      const paf = lage.ops.find(o => o.kw === 'PAF');
      const psf = lage.ops.find(o => o.kw === 'PSF');
      const starts = [nr, paf, psf].map(op => ({ opId: op.id,
        poly: structuredClone(op.poly || []), nr: structuredClone(op.nr || null), nbr: structuredClone(op.nbr || []) }));
      /* mehrfach setzen wie waehrend eines Drags — nur der LETZTE Wert zaehlt */
      opsGruppeSetzen(starts, 5, 5);
      opsGruppeSetzen(starts, -3, 12);
      opsGruppeSetzen(starts, 10, -20);
      return {
        nrA: [nr.nr.xa, nr.nr.ya], pafP0: [paf.poly[0].x, paf.poly[0].y],
        psfP0: [psf.poly[0].x, psf.poly[0].y],
        psfGeschlossen: psf.poly[0].x === psf.poly[4].x && psf.poly[0].y === psf.poly[4].y,
        abstandErhalten: (paf.poly[0].x - nr.nr.xa) === (2000 - 500),
        modified: [nr, paf, psf].every(o => o._modified)
      };
    })()
  `, ctx);
  pruefe(erg.nrA[0] === 510 && erg.nrA[1] === 80, 'NR um (10,-20) verschoben — kein Drift trotz mehrfachem Setzen: ' + erg.nrA.join('/'));
  pruefe(erg.pafP0[0] === 2010 && erg.pafP0[1] === 280, 'PAF mit demselben Delta verschoben: ' + erg.pafP0.join('/'));
  pruefe(erg.psfP0[0] === 2610 && erg.psfGeschlossen, 'PSF verschoben, Schlusspunkt-Duplikat synchron');
  pruefe(erg.abstandErhalten, 'relativer Abstand NR<->PAF unveraendert (1500 mm)');
  pruefe(erg.modified, 'alle Gruppen-Ops _modified');
}

/* --- d) Export nach Gruppen-Aktionen ohne Exception --- */
{
  const ctx = editorKontext();
  wupLaden(ctx, testDatei());
  const ok = vm.runInContext(`
    (() => {
      const lage = modell.layers[0];
      const nrs = lage.ops.filter(o => o.kw === 'NR').slice(0, 3).map(op => ({ op, lage }));
      const ziele = nrGruppenEndpunkte(nrs, nrs[0].op, 'a').map(z => ({
        opId: z.op.id, ende: z.ende,
        start: z.ende === 'a' ? { x: z.op.nr.xa, y: z.op.nr.ya } : { x: z.op.nr.xe, y: z.op.nr.ye } }));
      nrGruppenEndpunkteSetzen(ziele, 0, 75.5);
      try { kwZeileUeberlaenge = []; exportZeilenErzeugen(); return true; }
      catch (e) { return false; }
    })()
  `, ctx);
  pruefe(ok === true, 'exportZeilenErzeugen() nach Gruppen-Endpunkt-Verschieben wirft keine Exception');
}

if (fehler) {
  console.error('\nVerschieben-Gruppe-Smoke: ' + fehler + ' Fehler.');
  process.exit(1);
} else {
  console.log('\nVerschieben-Gruppe-Smoke: alle Pruefungen OK');
}
