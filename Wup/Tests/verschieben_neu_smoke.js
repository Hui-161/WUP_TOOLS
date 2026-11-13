#!/usr/bin/env node
/*
  Smoke-Test fuer WP2 (Verschieben aller Bearbeitungsarten) und WP3 (Neue
  Bearbeitungen erstellen).

  Prueft headless (ohne Canvas/Pointer-Events, direkt auf den reinen
  Modell-Funktionen):
    1. opGeometrieVerschieben() auf einer vollstaendigen WUP-Datei: alle Punkte einer
       PAF-Op verschieben sich um (dx,dy), _modified wird gesetzt, Export
       enthaelt die neuen Koordinaten und wirft keine Exception.
    2. Kanten-Logik (kantenUrsprungErfassen/kantenGeometrieSetzen): an einer
       geschlossenen PAF-Kontur eine Kante senkrecht verschieben — die beiden
       Kantenpunkte verschieben sich, Nachbarsegmente bleiben verbunden, der
       Schluss-Duplikatpunkt bleibt synchron.
    3. neueKonturErzeugen('PSF', ...) erzeugt eine geschlossene Op (erster ==
       letzter Punkt), Export laeuft durch, PSF-Zeilen sind im selben Format
       wie echte PSF-Zeilen der Beispieldateien (t=0,i=0 -> Kurzform "0,0,0,0").
    4. neuerKreisErzeugen(...) erzeugt eine MP-Zeile im Export.

  Aufruf:  node Wup/Tests/verschieben_neu_smoke.js
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
   1. opGeometrieVerschieben auf einer vollstaendigen Datei
   --------------------------------------------------------------------- */
function testOpGeometrieVerschieben() {
  console.log('Test 1: opGeometrieVerschieben() auf syn0003.wup');
  const ctx = editorKontext();
  const text = fs.readFileSync(referenzDatei, 'latin1');
  wupLaden(ctx, text, 'syn0003.wup');
  const erg = vm.runInContext(`
    (() => {
      let paf = null;
      for (const lage of modell.layers) {
        const f = lage.ops.find(o => o.kw === 'PAF' && (o.poly || []).length);
        if (f) { paf = f; break; }
      }
      if (!paf) return { fehler: 'keine PAF-Op mit Punkten gefunden' };
      const vor = paf.poly.map(p => ({ x: p.x, y: p.y }));
      opGeometrieVerschieben(paf, 10, 5);
      const nachModified = paf._modified === true;
      const nach = paf.poly.map(p => ({ x: p.x, y: p.y }));
      let exportFehler = null, zeilen = null;
      try {
        kwZeileUeberlaenge = [];
        zeilen = exportZeilenErzeugen().zeilen;
      } catch (e) { exportFehler = e.message; }
      return { vor, nach, nachModified, exportFehler, zeilen, opId: paf.id, off: paf._off || [0,0] };
    })()
  `, ctx);
  if (erg.fehler) { console.error('  FEHLER  ' + erg.fehler); fehler++; return; }
  pruefe(erg.vor.length === erg.nach.length && erg.vor.length > 0, 'PAF-Op hat Punkte');
  const alleVerschoben = erg.vor.every((p, i) =>
    Math.abs((erg.nach[i].x - p.x) - 10) < 1e-9 && Math.abs((erg.nach[i].y - p.y) - 5) < 1e-9);
  pruefe(alleVerschoben, 'alle Punkte der Op um (10, 5) verschoben');
  pruefe(erg.nachModified, '_modified wurde gesetzt');
  pruefe(!erg.exportFehler, 'Export wirft keine Exception' + (erg.exportFehler ? (' — ' + erg.exportFehler) : ''));
  if (erg.zeilen) {
    const erwX = Math.round((erg.nach[0].x - erg.off[0]) * 1000) / 1000;
    const erwY = Math.round((erg.nach[0].y - erg.off[1]) * 1000) / 1000;
    const gefunden = erg.zeilen.some(z => z.startsWith('PP') && z.includes(String(erwX)) && z.includes(String(erwY)));
    pruefe(gefunden, 'Export enthaelt die neuen (verschobenen) Koordinaten (x=' + erwX + ', y=' + erwY + ')');
  }
}

/* ---------------------------------------------------------------------
   2. Kanten-Logik an einer geschlossenen Kontur
   --------------------------------------------------------------------- */
function testDateiGeschlossenesPAF() {
  const ecken = [[100, 100], [500, 100], [500, 400], [100, 400], [100, 100]];
  const pp = ecken.map(p => `PP      ${p[0]}, ${p[1]}, 15, 311, 0;`).join('\r\n');
  return ['VERSION 3.4;', 'ELN test;', 'ELM     3000, 2500, 235, 1;',
    'PLI1    3000, 2500, 15, 0, 0, 30, OSB, 160;',
    'PP      0, 0;', 'PP      3000, 0;', 'PP      3000, 2500;', 'PP      0, 2500;', 'PP      0, 0;',
    'PAF;', pp, ''].join('\r\n');
}
function testKantenLogik() {
  console.log('Test 2: Kanten-Logik (geschlossene Kontur, Kante senkrecht verschieben)');
  const ctx = editorKontext();
  wupLaden(ctx, testDateiGeschlossenesPAF());
  const erg = vm.runInContext(`
    (() => {
      const lage = modell.layers[0];
      const op = lage.ops.find(o => o.kw === 'PAF');
      if (!op) return { fehler: 'keine PAF-Op gefunden' };
      const pts = op.poly.filter(e => e.type === 'PP' || e.type === 'KB');
      if (pts.length < 5 || pts[0].x !== pts[pts.length-1].x || pts[0].y !== pts[pts.length-1].y)
        return { fehler: 'Kontur nicht wie erwartet geschlossen aufgebaut' };
      /* Kante 0 = Segment zwischen pts[0] (100,100) und pts[1] (500,100) — horizontal */
      ui.kanten = [{ besitzer: 'op', id: op.id, segIdx: 0 }];
      const urspruenge = kantenUrsprungErfassen(ui.kanten);
      kantenGeometrieSetzen(urspruenge, 20);
      return {
        p0: { x: pts[0].x, y: pts[0].y }, p1: { x: pts[1].x, y: pts[1].y },
        pLetzter: { x: pts[pts.length-1].x, y: pts[pts.length-1].y },
        p2: { x: pts[2].x, y: pts[2].y }, p3: { x: pts[3].x, y: pts[3].y },
        modified: op._modified === true
      };
    })()
  `, ctx);
  if (erg.fehler) { console.error('  FEHLER  ' + erg.fehler); fehler++; return; }
  pruefe(erg.p0.x === 100 && erg.p0.y === 120, 'erster Kantenpunkt senkrecht (entlang Normale) um 20 verschoben: ' + JSON.stringify(erg.p0));
  pruefe(erg.p1.x === 500 && erg.p1.y === 120, 'zweiter Kantenpunkt mitverschoben: ' + JSON.stringify(erg.p1));
  pruefe(erg.pLetzter.x === erg.p0.x && erg.pLetzter.y === erg.p0.y,
    'Schluss-Duplikatpunkt bleibt synchron zum ersten Punkt: ' + JSON.stringify(erg.pLetzter));
  pruefe(erg.p2.x === 500 && erg.p2.y === 400, 'Nachbarsegment (unteres Eck) unveraendert: ' + JSON.stringify(erg.p2));
  pruefe(erg.p3.x === 100 && erg.p3.y === 400, 'Nachbarsegment (unteres Eck) unveraendert: ' + JSON.stringify(erg.p3));
  pruefe(erg.modified, '_modified wurde gesetzt');
}

/* ---------------------------------------------------------------------
   3. neueKonturErzeugen('PSF', ...)
   --------------------------------------------------------------------- */
function testNeueKonturPsf() {
  console.log("Test 3: neueKonturErzeugen('PSF', ...)");
  const ctx = editorKontext();
  const text = fs.readFileSync(referenzDatei, 'latin1');
  wupLaden(ctx, text, 'syn0003.wup');
  const erg = vm.runInContext(`
    (() => {
      const lage = obersteSichtbareLageMitPlatten();
      if (!lage) return { fehler: 'keine Ziel-Lage gefunden' };
      const op = neueKonturErzeugen('PSF', [[100,100],[500,100],[500,400],[100,400]], lage);
      if (!op) return { fehler: 'neueKonturErzeugen gab null zurueck' };
      let exportFehler = null, gesamtZeilen = null;
      try {
        kwZeileUeberlaenge = [];
        gesamtZeilen = exportZeilenErzeugen().zeilen;
      } catch (e) { exportFehler = e.message; }
      /* die Datei syn0003.wup enthaelt bereits echte PSF-Bloecke — die eigene
         Serialisierung der NEUEN Op pruefen (opSerialisieren ist derselbe Code,
         den exportZeilenErzeugen fuer diese Op verwendet), statt blind die
         ERSTE PSF-Zeile im Gesamtexport zu greifen (waere die eines Bestandsblocks) */
      const eigeneZeilen = opSerialisieren(op);
      const pts = op.poly.filter(e => e.type === 'PP');
      return {
        kw: op.kw, closed: op.closed, anzahl: pts.length,
        erster: { x: pts[0].x, y: pts[0].y }, letzter: { x: pts[pts.length-1].x, y: pts[pts.length-1].y },
        exportFehler, eigeneZeilen,
        hatPsfZeileImGesamtexport: (gesamtZeilen || []).some(z => z.startsWith('PSF'))
      };
    })()
  `, ctx);
  if (erg.fehler) { console.error('  FEHLER  ' + erg.fehler); fehler++; return; }
  pruefe(erg.kw === 'PSF', 'Op hat kw=PSF');
  pruefe(erg.closed === true, 'Op ist geschlossen (closed=true)');
  pruefe(erg.anzahl === 5, '5 PP-Punkte (4 Ecken + Schluss-Duplikat)');
  pruefe(erg.erster.x === erg.letzter.x && erg.erster.y === erg.letzter.y,
    'erster == letzter Punkt (P-08 geschlossen): ' + JSON.stringify(erg.erster) + ' / ' + JSON.stringify(erg.letzter));
  pruefe(!erg.exportFehler, 'Export wirft keine Exception' + (erg.exportFehler ? (' — ' + erg.exportFehler) : ''));
  pruefe(erg.hatPsfZeileImGesamtexport, 'Gesamtexport enthaelt PSF-Zeilen (Bestand + neue Op)');
  pruefe(/^PSF\s*;$/.test(erg.eigeneZeilen[0]), 'eigene Serialisierung beginnt mit PSF-Header: ' + erg.eigeneZeilen[0]);
  const ppZeilen = erg.eigeneZeilen.slice(1);
  pruefe(ppZeilen.length === 5, 'eigene Serialisierung hat 5 PP-Zeilen: ' + JSON.stringify(ppZeilen));
  /* echte PSF-PP-Zeilen der Beispieldateien sind t=0,i=0,alpha=0,z=null ->
     Kurzform "x, y, 0, 0, 0, 0" (siehe polyElementSerialisieren) */
  pruefe(ppZeilen.every(z => /^PP\s+-?[\d.]+,\s*-?[\d.]+,\s*0,\s*0,\s*0,\s*0;$/.test(z)),
    'alle PP-Zeilen im selben Kurzformat wie echte PSF-Punkte (t=0,i=0,alpha=0,z=null): ' + JSON.stringify(ppZeilen));
}

/* ---------------------------------------------------------------------
   4. neuerKreisErzeugen(...)
   --------------------------------------------------------------------- */
function testNeuerKreis() {
  console.log('Test 4: neuerKreisErzeugen(...)');
  const ctx = editorKontext();
  const text = fs.readFileSync(referenzDatei, 'latin1');
  wupLaden(ctx, text, 'syn0003.wup');
  const erg = vm.runInContext(`
    (() => {
      const lage = obersteSichtbareLageMitPlatten();
      if (!lage) return { fehler: 'keine Ziel-Lage gefunden' };
      const op = neuerKreisErzeugen([200, 200], 10, lage);
      if (!op) return { fehler: 'neuerKreisErzeugen gab null zurueck' };
      let exportFehler = null, zeilen = null;
      try {
        kwZeileUeberlaenge = [];
        zeilen = exportZeilenErzeugen().zeilen;
      } catch (e) { exportFehler = e.message; }
      return {
        kw: op.kw, typ: op.poly[0] && op.poly[0].type, r: op.poly[0] && op.poly[0].r,
        i: op.poly[0] && op.poly[0].i, exportFehler, zeilen,
        hatMpZeile: (zeilen || []).some(z => z.startsWith('MP'))
      };
    })()
  `, ctx);
  if (erg.fehler) { console.error('  FEHLER  ' + erg.fehler); fehler++; return; }
  pruefe(erg.kw === 'PAF', 'Op hat kw=PAF (Rundfraesung wie Freistich-MP)');
  pruefe(erg.typ === 'MP', 'Poly-Element ist vom Typ MP');
  pruefe(erg.r === 10, 'Radius = 10');
  pruefe(erg.i === 301, 'Steuercode i=301 (wie spezifiziert)');
  pruefe(!erg.exportFehler, 'Export wirft keine Exception' + (erg.exportFehler ? (' — ' + erg.exportFehler) : ''));
  pruefe(erg.hatMpZeile, 'Export enthaelt eine MP-Zeile');
}

testOpGeometrieVerschieben();
testKantenLogik();
testNeueKonturPsf();
testNeuerKreis();

console.log('\nVerschieben/Neu-Smoke: ' + (fehler ? fehler + ' FEHLER' : 'alle Pruefungen OK'));
process.exit(fehler ? 1 : 0);
