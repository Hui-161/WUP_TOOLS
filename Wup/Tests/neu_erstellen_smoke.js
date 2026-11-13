#!/usr/bin/env node
/*
  Smoke-Test fuer den Umbau des Werkzeugs "Neu erstellen" (Feedback-Punkte
  1/2/10):
    a) neueKonturErzeugen('PAF', [4 Rechteck-Ecken ohne Schluss], lage, true)
       -> mit erzwingeGeschlossen=true wird die Kontur geschlossen (Bugfix
       Feedback-Punkt 10: Klick auf den Startpunkt schliesst jetzt zuverlaessig,
       auch wenn der letzte gezeichnete Punkt nicht nahe am Start liegt).
    b) neueKonturErzeugen('PAF', [3 offene Punkte], lage, false) -> bleibt
       offen (Default-Verhalten unveraendert, siehe verschieben_neu_smoke.js).
    c) neuesRechteckErzeugen([100,100],[500,300],'PSG',lage) -> geschlossenes,
       achsparalleles 4-Eck-Polygon (5 Punkte inkl. Schluss-Duplikat), Export
       laeuft durch.

  Aufruf:  node Wup/Tests/neu_erstellen_smoke.js
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
   a) neueKonturErzeugen('PAF', ..., true) -> erzwungen geschlossen
   --------------------------------------------------------------------- */
function testErzwingeGeschlossen() {
  console.log("Test a: neueKonturErzeugen('PAF', ..., erzwingeGeschlossen=true)");
  const ctx = editorKontext();
  const text = fs.readFileSync(referenzDatei, 'latin1');
  wupLaden(ctx, text, 'syn0003.wup');
  const erg = vm.runInContext(`
    (() => {
      const lage = obersteSichtbareLageMitPlatten();
      if (!lage) return { fehler: 'keine Ziel-Lage gefunden' };
      /* 4 Rechteck-Ecken OHNE Schluss-Duplikat — wie sie beim Klicken auf
         den Startpunkt in ui.neueKontur.punkte stehen (der Startpunkt-Klick
         selbst wird NICHT mehr an die Liste angehaengt). */
      const op = neueKonturErzeugen('PAF', [[100,100],[500,100],[500,400],[100,400]], lage, true);
      if (!op) return { fehler: 'neueKonturErzeugen gab null zurueck' };
      const pts = op.poly.filter(e => e.type === 'PP');
      return {
        closed: op.closed, anzahl: pts.length,
        erster: { x: pts[0].x, y: pts[0].y }, letzter: { x: pts[pts.length-1].x, y: pts[pts.length-1].y }
      };
    })()
  `, ctx);
  if (erg.fehler) { console.error('  FEHLER  ' + erg.fehler); fehler++; return; }
  pruefe(erg.closed === true, 'closed=true trotz Start/Ende nicht deckungsgleich in der Eingabe');
  pruefe(erg.anzahl === 5, '5 Punkte (4 Ecken + Schluss-Duplikat)');
  pruefe(erg.erster.x === erg.letzter.x && erg.erster.y === erg.letzter.y,
    'letzter Punkt == erster Punkt (Schliesslinie vorhanden): ' + JSON.stringify(erg.erster) + ' / ' + JSON.stringify(erg.letzter));
}

/* ---------------------------------------------------------------------
   b) neueKonturErzeugen('PAF', ..., false) -> bleibt offen (Default)
   --------------------------------------------------------------------- */
function testOffenBleibtOffen() {
  console.log("Test b: neueKonturErzeugen('PAF', ..., erzwingeGeschlossen=false)");
  const ctx = editorKontext();
  const text = fs.readFileSync(referenzDatei, 'latin1');
  wupLaden(ctx, text, 'syn0003.wup');
  const erg = vm.runInContext(`
    (() => {
      const lage = obersteSichtbareLageMitPlatten();
      if (!lage) return { fehler: 'keine Ziel-Lage gefunden' };
      const op = neueKonturErzeugen('PAF', [[100,100],[500,100],[500,400]], lage, false);
      if (!op) return { fehler: 'neueKonturErzeugen gab null zurueck' };
      const pts = op.poly.filter(e => e.type === 'PP');
      return { closed: op.closed, anzahl: pts.length };
    })()
  `, ctx);
  if (erg.fehler) { console.error('  FEHLER  ' + erg.fehler); fehler++; return; }
  pruefe(erg.closed === false, 'closed=false (Doppelklick/Enter bei nicht deckungsgleichem Start/Ende laesst offen)');
  pruefe(erg.anzahl === 3, '3 Punkte (kein Schluss-Duplikat angehaengt)');
}

/* ---------------------------------------------------------------------
   c) neuesRechteckErzeugen(...)
   --------------------------------------------------------------------- */
function testRechteck() {
  console.log("Test c: neuesRechteckErzeugen([100,100],[500,300],'PSG',lage)");
  const ctx = editorKontext();
  const text = fs.readFileSync(referenzDatei, 'latin1');
  wupLaden(ctx, text, 'syn0003.wup');
  const erg = vm.runInContext(`
    (() => {
      const lage = obersteSichtbareLageMitPlatten();
      if (!lage) return { fehler: 'keine Ziel-Lage gefunden' };
      const op = neuesRechteckErzeugen([100,100],[500,300],'PSG',lage);
      if (!op) return { fehler: 'neuesRechteckErzeugen gab null zurueck' };
      let exportFehler = null, zeilen = null;
      try {
        kwZeileUeberlaenge = [];
        zeilen = exportZeilenErzeugen().zeilen;
      } catch (e) { exportFehler = e.message; }
      const pts = op.poly.filter(e => e.type === 'PP');
      return {
        kw: op.kw, closed: op.closed, anzahl: pts.length,
        xs: [...new Set(pts.map(p => p.x))].sort((a,b) => a-b),
        ys: [...new Set(pts.map(p => p.y))].sort((a,b) => a-b),
        erster: { x: pts[0].x, y: pts[0].y }, letzter: { x: pts[pts.length-1].x, y: pts[pts.length-1].y },
        exportFehler
      };
    })()
  `, ctx);
  if (erg.fehler) { console.error('  FEHLER  ' + erg.fehler); fehler++; return; }
  pruefe(erg.kw === 'PSG', 'Op hat kw=PSG');
  pruefe(erg.closed === true, 'Op ist geschlossen (closed=true)');
  pruefe(erg.anzahl === 5, '5 PP-Punkte (4 Ecken + Schluss-Duplikat)');
  pruefe(erg.xs.length === 2 && erg.xs[0] === 100 && erg.xs[1] === 500, 'x-Werte sind {100,500}: ' + JSON.stringify(erg.xs));
  pruefe(erg.ys.length === 2 && erg.ys[0] === 100 && erg.ys[1] === 300, 'y-Werte sind {100,300}: ' + JSON.stringify(erg.ys));
  pruefe(erg.erster.x === erg.letzter.x && erg.erster.y === erg.letzter.y,
    'erster == letzter Punkt: ' + JSON.stringify(erg.erster) + ' / ' + JSON.stringify(erg.letzter));
  pruefe(!erg.exportFehler, 'Export wirft keine Exception' + (erg.exportFehler ? (' — ' + erg.exportFehler) : ''));
}

/* ---------------------------------------------------------------------
   d) AP-WE6: neueKonturErzeugen('PML', ...) — Markierlinie: offener Zug,
      t=0 (kein Materialabtrag), Markier-Steuercode 122; Export als
      PML-Zeile + PP-Zeilen (Weinmann 3.4.2/5.3)
   --------------------------------------------------------------------- */
function testPml() {
  console.log("Test d: neueKonturErzeugen('PML', ...) — Markierlinie");
  const ctx = editorKontext();
  const text = fs.readFileSync(referenzDatei, 'latin1');
  wupLaden(ctx, text, 'syn0003.wup');
  const erg = vm.runInContext(`
    (() => {
      const lage = obersteSichtbareLageMitPlatten();
      if (!lage) return { fehler: 'keine Ziel-Lage gefunden' };
      const op = neueKonturErzeugen('PML', [[100,100],[900,100]], lage, false);
      if (!op) return { fehler: 'neueKonturErzeugen gab null zurueck' };
      const zeilen = exportZeilenErzeugen().zeilen;
      const pmlIdx = zeilen.findIndex(z => z.startsWith('PML') && z.trim() === 'PML     ;'.trim());
      const platteMitZ = lage.plates.find(p => p.z != null && !isNaN(p.z));
      return {
        kw: op.kw, closed: op.closed, anzahl: op.poly.length,
        t: op.poly[0].t, i: op.poly[0].i,
        z: op.poly[0].z, lagenZ: platteMitZ ? platteMitZ.z : null,
        exportHatPml: pmlIdx >= 0,
        ppDanach: pmlIdx >= 0 ? zeilen[pmlIdx + 1] : ''
      };
    })()
  `, ctx);
  if (erg.fehler) { console.error('  FEHLER  ' + erg.fehler); fehler++; return; }
  pruefe(erg.kw === 'PML' && erg.closed === false && erg.anzahl === 2, 'PML als offener 2-Punkt-Zug erzeugt');
  pruefe(erg.t === 0, 'Markierlinie traegt kein Material ab (t=0): ' + erg.t);
  pruefe(erg.i === 122, 'Markier-Steuercode 122 (Kugelschreiber + Definitionsebene + schwarz): ' + erg.i);
  pruefe(erg.z === erg.lagenZ, 'PML-Punkte tragen das Lagen-z (wie reale Datensaetze, z.B. Dach 1HG8190003): '
    + erg.z + ' == ' + erg.lagenZ);
  pruefe(erg.exportHatPml, 'Export enthaelt die PML-Kopfzeile');
  pruefe(erg.ppDanach.startsWith('PP') && erg.ppDanach.includes('122'), 'PP-Zeile mit Code 122 folgt: ' + erg.ppDanach);
  pruefe(erg.lagenZ == null || erg.ppDanach.replace(/;\s*$/, '').trim().endsWith(String(erg.lagenZ)),
    'PP-Zeile endet mit dem z-Wert: ' + erg.ppDanach);
}

testErzwingeGeschlossen();
testOffenBleibtOffen();
testRechteck();
testPml();

console.log('\nNeu-Erstellen-Smoke: ' + (fehler ? fehler + ' FEHLER' : 'alle Pruefungen OK'));
process.exit(fehler ? 1 : 0);
