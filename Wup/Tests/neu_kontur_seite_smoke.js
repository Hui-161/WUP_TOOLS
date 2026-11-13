#!/usr/bin/env node
/*
  Smoke-Test fuer WP3-P1 (Seiten-Wahl per Maus nach dem Erzeugen einer
  PAF/PSG-Kontur) und WP3-P3 (Schicht-Auswahl, hier nur indirekt ueber die
  Referenzgeometrie relevant):

    a) seiteBestimmen() an einer GESCHLOSSENEN Rechteck-PAF (100,100)-(500,300):
       Punkt innen -> {seite:'links', korrektur:1}; Punkt weit aussen ->
       {seite:'rechts', korrektur:2}; Punkt nahe der Kante -> {seite:'mitte',
       korrektur:3} (Schwelle 15mm, siehe seiteBestimmen()-Kommentar zur
       innen/aussen->Korrektur-Zuordnung).
    b) seiteBestimmen() an einer OFFENEN 2-Punkt-PAF (0,0)->(100,0): Punkt
       links der Richtung -> korrektur 1, rechts -> korrektur 2, nahe der
       Linie -> korrektur 3 (mitte).
    c) seitenWahlAnwenden(korrektur): setzt auf ALLE Ops in
       ui.seitenWahl.opIds die Korrektur-Stelle des Steuercodes je Punkt neu,
       werkzeug/schnitt/lauf bleiben je Punkt erhalten (auch wenn sie vorher
       zwischen den Punkten unterschiedlich waren).

  Aufruf:  node Wup/Tests/neu_kontur_seite_smoke.js
*/
'use strict';
const fs = require('fs');
const path = require('path');
const { editorKontext, wupLaden, synthetischeDatei, vm } = require('./harness');

let fehler = 0;
function pruefe(bedingung, text) {
  if (bedingung) console.log('  OK      ' + text);
  else { console.error('  FEHLER  ' + text); fehler++; }
}

/* synthetische Aussenwand mit Fenster (Granit-Stil): mehrere Lagen, Nagelreihen,
   Sperrflaechen, Saege- und Fraeskonturen — siehe 03_Beispiel-synthetisch/erzeugen.js */
const referenzDatei = synthetischeDatei('Granit', 'syn0003.wup');

/* ---------------------------------------------------------------------
   a) seiteBestimmen() an geschlossener Rechteck-PAF
   --------------------------------------------------------------------- */
function testGeschlossen() {
  console.log('Test a: seiteBestimmen() an geschlossener Rechteck-PAF');
  const ctx = editorKontext();
  const text = fs.readFileSync(referenzDatei, 'latin1');
  wupLaden(ctx, text, 'syn0003.wup');
  const erg = vm.runInContext(`
    (() => {
      const lage = obersteSichtbareLageMitPlatten();
      if (!lage) return { fehler: 'keine Ziel-Lage gefunden' };
      const op = neuesRechteckErzeugen([100,100],[500,300],'PAF',lage);
      if (!op) return { fehler: 'neuesRechteckErzeugen gab null zurueck' };
      return {
        innen: seiteBestimmen(op, [300,200]),
        aussen: seiteBestimmen(op, [5000,5000]),
        aufKante: seiteBestimmen(op, [100,200]),
      };
    })()
  `, ctx);
  if (erg.fehler) { console.error('  FEHLER  ' + erg.fehler); fehler++; return; }
  pruefe(erg.innen.seite === 'links' && erg.innen.korrektur === 1,
    'Punkt innen -> links/korrektur 1: ' + JSON.stringify(erg.innen));
  pruefe(erg.aussen.seite === 'rechts' && erg.aussen.korrektur === 2,
    'Punkt weit aussen -> rechts/korrektur 2: ' + JSON.stringify(erg.aussen));
  pruefe(erg.aufKante.seite === 'mitte' && erg.aufKante.korrektur === 3,
    'Punkt auf der Kante -> mitte/korrektur 3: ' + JSON.stringify(erg.aufKante));
}

/* ---------------------------------------------------------------------
   b) seiteBestimmen() an offener 2-Punkt-PAF
   --------------------------------------------------------------------- */
function testOffen() {
  console.log('Test b: seiteBestimmen() an offener 2-Punkt-PAF');
  const ctx = editorKontext();
  const text = fs.readFileSync(referenzDatei, 'latin1');
  wupLaden(ctx, text, 'syn0003.wup');
  const erg = vm.runInContext(`
    (() => {
      const lage = obersteSichtbareLageMitPlatten();
      if (!lage) return { fehler: 'keine Ziel-Lage gefunden' };
      /* offene Kontur: Start-/Endpunkt liegen weit auseinander -> bleibt offen */
      const op = neueKonturErzeugen('PAF', [[0,0],[100,0]], lage, false);
      if (!op) return { fehler: 'neueKonturErzeugen gab null zurueck' };
      return {
        closed: op.closed,
        links: seiteBestimmen(op, [50,50]),
        rechts: seiteBestimmen(op, [50,-50]),
        mitte: seiteBestimmen(op, [50,5]),
      };
    })()
  `, ctx);
  if (erg.fehler) { console.error('  FEHLER  ' + erg.fehler); fehler++; return; }
  pruefe(erg.closed === false, 'Kontur bleibt offen (Start/Ende weit auseinander)');
  pruefe(erg.links.seite === 'links' && erg.links.korrektur === 1,
    'Punkt links der Richtung -> korrektur 1: ' + JSON.stringify(erg.links));
  pruefe(erg.rechts.seite === 'rechts' && erg.rechts.korrektur === 2,
    'Punkt rechts der Richtung -> korrektur 2: ' + JSON.stringify(erg.rechts));
  pruefe(erg.mitte.seite === 'mitte' && erg.mitte.korrektur === 3,
    'Punkt nahe der Linie -> mitte/korrektur 3: ' + JSON.stringify(erg.mitte));
}

/* ---------------------------------------------------------------------
   c) seitenWahlAnwenden(korrektur)
   --------------------------------------------------------------------- */
function testAnwenden() {
  console.log('Test c: seitenWahlAnwenden(korrektur) setzt Korrektur, behaelt Rest');
  const ctx = editorKontext();
  const text = fs.readFileSync(referenzDatei, 'latin1');
  wupLaden(ctx, text, 'syn0003.wup');
  const erg = vm.runInContext(`
    (() => {
      const lage = obersteSichtbareLageMitPlatten();
      if (!lage) return { fehler: 'keine Ziel-Lage gefunden' };
      const op = neueKonturErzeugen('PAF', [[0,0],[100,0],[100,100]], lage, false);
      if (!op) return { fehler: 'neueKonturErzeugen gab null zurueck' };
      const pts = op.poly.filter(e => e.type === 'PP');
      /* bewusst unterschiedliche werkzeug/schnitt/lauf je Punkt setzen, um zu
         pruefen, dass seitenWahlAnwenden() NUR die Korrektur-Stelle ersetzt */
      pts[0].i = steuercodeBauen({ werkzeug: 2, schnitt: 1, korrektur: 3, lauf: 0 });
      pts[1].i = steuercodeBauen({ werkzeug: 1, schnitt: 2, korrektur: 1, lauf: 1 });
      pts[2].i = steuercodeBauen({ werkzeug: 3, schnitt: 1, korrektur: 3, lauf: 1 });
      const vorher = pts.map(p => steuercodeZerlegen(p.i));
      ui.seitenWahl = { opIds: [op.id], lageId: lage.id };
      seitenWahlAnwenden(2);
      const nachher = pts.map(p => steuercodeZerlegen(p.i));
      return { vorher, nachher };
    })()
  `, ctx);
  if (erg.fehler) { console.error('  FEHLER  ' + erg.fehler); fehler++; return; }
  erg.nachher.forEach((t, i) => {
    pruefe(t.korrektur === 2, 'Punkt ' + i + ': korrektur == 2, ist ' + t.korrektur);
    pruefe(t.werkzeug === erg.vorher[i].werkzeug, 'Punkt ' + i + ': werkzeug unveraendert (' + t.werkzeug + ')');
    pruefe(t.schnitt === erg.vorher[i].schnitt, 'Punkt ' + i + ': schnitt unveraendert (' + t.schnitt + ')');
    pruefe(t.lauf === erg.vorher[i].lauf, 'Punkt ' + i + ': lauf unveraendert (' + t.lauf + ')');
  });
}

testGeschlossen();
testOffen();
testAnwenden();

console.log('\nNeu-Kontur-Seite-Smoke: ' + (fehler ? fehler + ' FEHLER' : 'alle Pruefungen OK'));
process.exit(fehler ? 1 : 0);
