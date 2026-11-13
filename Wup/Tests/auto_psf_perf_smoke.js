#!/usr/bin/env node
/*
  Regressionstest: f3AutoPsf() darf auf KEINER Beispieldatei haengen/explodieren.

  Realer Vorfall: eine Datei mit einer PSG-Kontur aus 75 Punkten (~74 Segmente)
  in derselben Lage wie viele NR. Zwei zusammenwirkende Bugs fuehrten zum Haenger:
   1. f3AutoPsf iterierte mit `for (const op of lage.ops)` ueber das LIVE-Array,
      in das f3PsfErzeugen per splice() mitten hinein neue PSF-Ops einfuegte —
      das verschob das gerade verarbeitete Op hinter die Iterator-Position, die
      es dann ERNEUT besuchte (Endlosschleife).
   2. f3PsfDecktRegion/regionGedeckt nutzten reines punktInPolygon (Ray-Casting),
      das fuer Randpunkte (Gleitkomma) oft 'draussen' meldet — eine gerade erst
      erzeugte, deckungsgleiche PSF wurde dadurch nicht als Deckung erkannt und
      es entstanden endlos viele Duplikate.
  Fix: Momentaufnahme (`lage.ops.slice()`) fuer die aeussere Iteration + rand-
  toleranter Deckungstest (Geo.punktInOderAufPolygon).

  Dieser Test laesst f3AutoPsf mit einem harten Zeitlimit laufen und prueft
  zusaetzlich, dass keine absurde PSF-Flut entsteht.

  Nachgestellt mit der synthetischen Datei Granit/syn0004.wup: 18 Sparren-
  ausschnitte als EINE Saegekontur mit 77 Punkten, in derselben Lage 22
  Klammerreihen. Die Datei bringt ihre 36 Sperrflaechen schon mit (je
  Ausschnitt zwei Flanken, die die Klammerreihe im Raehm kreuzen). Damit die
  Automatik wirklich ERZEUGEN muss (nur dabei trat der Haenger auf), nimmt
  der Test die Sperrflaechen zuerst aus dem Modell — so, wie der Editor eine
  Bearbeitung loescht — und laesst sie neu entstehen.
*/
'use strict';
const fs = require('fs');
const path = require('path');
const { editorKontext, referenzDateien, synthetischeDatei, vm } = require('./harness');

let fehler = 0;
function pruefe(b, t) { if (b) console.log('  OK      ' + t); else { console.error('  FEHLER  ' + t); fehler++; } }

const datei = synthetischeDatei('Granit', 'syn0004.wup');
const ctx = editorKontext();
const puffer = fs.readFileSync(datei);
ctx.__buffer = puffer.buffer.slice(puffer.byteOffset, puffer.byteOffset + puffer.byteLength);

console.log('f3AutoPsf() auf syn0004.wup (Saegekontur mit 77 Punkten, Sperrflaechen vorher entfernt)');
let ergebnis;
try {
  ergebnis = vm.runInContext(`
    (() => {
      const dek = dateiDekodieren(__buffer);
      modell = wupParsen(dek.text, 'syn0004.wup', dek.encoding, dek.hatteBom);
      undoStack.length = 0; redoStack.length = 0;
      const psfZaehlen = () => modell.layers.reduce((n, l) => n + l.ops.filter(o => o.kw === 'PSF').length, 0);
      const p03Zaehlen = () => { pruefungenAusfuehren(); return modell.pruefungen.filter(p => p.code === 'P-03').length; };
      const konturPunkte = Math.max(...modell.layers.map(l => Math.max(0, ...l.ops.filter(o => o.kw === 'PSG').map(o => o.poly.length))));
      const nrAnzahl = modell.layers.reduce((n, l) => n + l.ops.filter(o => o.kw === 'NR').length, 0);
      const psfInDatei = psfZaehlen(), p03InDatei = p03Zaehlen();
      /* vorhandene Sperrflaechen entfernen, wie der Editor loescht */
      for (const lage of modell.layers) {
        for (const op of lage.ops.filter(o => o.kw === 'PSF'))
          (lage._geloeschteOps = lage._geloeschteOps || []).push({ _lineStart: op._lineStart, _lineEnd: op._lineEnd });
        lage.ops = lage.ops.filter(o => o.kw !== 'PSF');
      }
      const p03OhnePsf = p03Zaehlen();
      const t0 = Date.now();
      f3AutoPsf();
      const dauer = Date.now() - t0;
      const psfGesamt = psfZaehlen(), p03Danach = p03Zaehlen();
      kwZeileUeberlaenge = [];
      let exportOk = true, exportFehler = '';
      try {
        const { zeilen } = exportZeilenErzeugen();
        const text = zeilen.join('\\r\\n') + '\\r\\n';
        wupParsen(text, 'reexport.wup', 'windows-1252', false);
      } catch (e) { exportOk = false; exportFehler = e.message; }
      return { dauer, psfGesamt, exportOk, exportFehler, konturPunkte, nrAnzahl, psfInDatei, p03InDatei, p03OhnePsf, p03Danach };
    })()
  `, ctx, { timeout: 8000 });
} catch (e) {
  ergebnis = { timeout: true, fehler: e.message };
}

pruefe(!ergebnis.timeout, 'f3AutoPsf() haengt sich NICHT auf (kein Timeout)');
if (!ergebnis.timeout) {
  pruefe(ergebnis.konturPunkte === 77 && ergebnis.nrAnzahl === 22,
    'Ausgangslage: Saegekontur mit 77 Punkten, 22 Nagelreihen (' + ergebnis.konturPunkte + ' / ' + ergebnis.nrAnzahl + ')');
  pruefe(ergebnis.psfInDatei === 36 && ergebnis.p03InDatei === 0,
    'Datei bringt 36 Sperrflaechen mit und hat keinen P-03-Befund (' + ergebnis.psfInDatei + ' / ' + ergebnis.p03InDatei + ')');
  pruefe(ergebnis.p03OhnePsf > 0, 'ohne Sperrflaechen meldet P-03 die Kollision (' + ergebnis.p03OhnePsf + ')');
  pruefe(ergebnis.dauer < 3000, 'Laufzeit deutlich unter 3s (' + ergebnis.dauer + 'ms)');
  pruefe(ergebnis.psfGesamt === 36,
    'genau die 36 Sperrflaechen entstehen neu, keine Explosion (' + ergebnis.psfGesamt + ')');
  pruefe(ergebnis.p03Danach === 0, 'danach kein P-03-Befund mehr (' + ergebnis.p03Danach + ')');
  pruefe(ergebnis.exportOk, 'Export nach Auto-PSF bleibt gueltig' + (ergebnis.exportOk ? '' : ': ' + ergebnis.exportFehler));
}

console.log('\nB) f3AutoPsf() ueber ALLE Beispieldateien (Haenger-Klasse allgemein absichern)');
const alleDateien = referenzDateien();
let langsamste = { dauer: 0, datei: '' };
const jeOrdner = {};
for (const { pfad: f, name } of alleDateien) {
  const ordnerName = name.split(path.sep)[0];
  jeOrdner[ordnerName] = (jeOrdner[ordnerName] || 0) + 1;
  const c = editorKontext();
  const b = fs.readFileSync(f);
  c.__buffer = b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
  let r;
  try {
    r = vm.runInContext(`
      (() => {
        const dek = dateiDekodieren(__buffer);
        modell = wupParsen(dek.text, 'x.wup', dek.encoding, dek.hatteBom);
        undoStack.length = 0; redoStack.length = 0;
        const t0 = Date.now();
        f3AutoPsf();
        return { dauer: Date.now() - t0 };
      })()
    `, c, { timeout: 4000 });
  } catch (e) {
    console.error('  FEHLER  ' + name + ' -> ' + e.message);
    fehler++;
    continue;
  }
  if (r.dauer > langsamste.dauer) langsamste = { dauer: r.dauer, datei: name };
}
pruefe(alleDateien.length > 0, alleDateien.length + ' Dateien durchlaufen (' + Object.keys(jeOrdner).map(o => jeOrdner[o] + ' in ' + o).join(', ')
  + '), langsamste: ' + langsamste.datei + ' (' + langsamste.dauer + 'ms)');

console.log('\nAuto-PSF-Performance-Smoke: ' + (fehler ? fehler + ' FEHLER' : 'alle Pruefungen OK'));
process.exit(fehler ? 1 : 0);
