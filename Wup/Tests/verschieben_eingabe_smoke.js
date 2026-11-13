#!/usr/bin/env node
/*
  Smoke-Test: WP-A mm-genaues Verschieben per Zahlenfeld
  (auswahlVerschiebenUm / punktVerschiebenUm) auf der synthetischen
  Innenwand SEMA/IW02.WUP.

  (a) auswahlVerschiebenUm auf der ausgewaehlten offenen Tuer-PSG (4 Punkte,
      offene П-Form) um (5,-3) -> alle 4 Punkte verschoben, kein Kollaps.
  (b) punktVerschiebenUm auf dem geschlossenen PSF, Punkt 0, um (2,0)
      -> Punkt 0 UND Duplikat-Schlusspunkt verschoben, Zwischenpunkte nicht.
  (c) punktVerschiebenUm auf der offenen PSG, Punkt 0
      -> letzter Punkt (offenes Ende) unveraendert (kein Kollaps).
*/
'use strict';
const fs = require('fs');
const path = require('path');
const { editorKontext, synthetischeDatei, vm } = require('./harness');

let fehler = 0;
function pruefe(bedingung, text) {
  if (bedingung) console.log('  OK      ' + text);
  else { console.error('  FEHLER  ' + text); fehler++; }
}

const ctx = editorKontext();
/* synthetische Innenwand mit Tuer (SEMA-Stil), siehe 03_Beispiel-synthetisch/erzeugen.js */
const datei = synthetischeDatei('SEMA', 'IW02.WUP');
const puffer = fs.readFileSync(datei);
ctx.__buffer = puffer.buffer.slice(puffer.byteOffset, puffer.byteOffset + puffer.byteLength);
vm.runInContext(`
  const dek = dateiDekodieren(__buffer);
  modell = wupParsen(dek.text, 'IW02.WUP', dek.encoding, dek.hatteBom);
`, ctx);

console.log('(a) auswahlVerschiebenUm — offene Tuer-PSG (4 Punkte) um (5,-3)');
const ergA = vm.runInContext(`
  (() => {
    const lage = modell.layers[0];
    const op = lage.ops.find(o => o.kw === 'PSG' && (o.poly||[]).length === 4);
    if (!op) return { fehler: 'Tuer-PSG (4 Punkte) nicht gefunden' };
    const vorher = op.poly.map(p => [p.x, p.y]);
    ui.auswahl = { typ: 'op', id: op.id, lageId: lage.id };
    ui.mehrAuswahl = [];
    const n = auswahlVerschiebenUm(5, -3);
    return { n, closed: op.closed, vorher, nachher: op.poly.map(p => [p.x, p.y]) };
  })()
`, ctx);
if (ergA.fehler) { console.error('  FEHLER  ' + ergA.fehler); fehler++; }
else {
  pruefe(ergA.n === 1, 'auswahlVerschiebenUm meldet 1 verschobene Op: ' + ergA.n);
  pruefe(ergA.closed === false, 'Tuer-PSG ist offen (closed=false)');
  pruefe(ergA.nachher.length === 4, 'weiterhin 4 Punkte (kein Kollaps): ' + JSON.stringify(ergA.nachher));
  for (let i = 0; i < 4; i++) {
    const [vx, vy] = ergA.vorher[i], [nx, ny] = ergA.nachher[i];
    pruefe(Math.abs(nx - vx - 5) < 1e-9 && Math.abs(ny - vy + 3) < 1e-9,
      'Punkt ' + i + ' um (5,-3) verschoben: ' + JSON.stringify(ergA.vorher[i]) + ' -> ' + JSON.stringify(ergA.nachher[i]));
  }
}

console.log('(b) punktVerschiebenUm — geschlossenes PSF, Punkt 0, um (2,0)');
const ergB = vm.runInContext(`
  (() => {
    const lage = modell.layers[0];
    const op = lage.ops.find(o => o.kw === 'PSF');
    if (!op) return { fehler: 'PSF nicht gefunden' };
    const vorher = op.poly.map(p => [p.x, p.y]);
    const ok = punktVerschiebenUm(op, 0, 2, 0);
    return { ok, closed: op.closed, vorher, nachher: op.poly.map(p => [p.x, p.y]) };
  })()
`, ctx);
if (ergB.fehler) { console.error('  FEHLER  ' + ergB.fehler); fehler++; }
else {
  pruefe(ergB.ok === true, 'punktVerschiebenUm meldet Erfolg');
  pruefe(ergB.closed === true, 'PSF ist geschlossen (closed=true)');
  const letzter = ergB.nachher.length - 1;
  pruefe(Math.abs(ergB.nachher[0][0] - ergB.vorher[0][0] - 2) < 1e-9 && ergB.nachher[0][1] === ergB.vorher[0][1],
    'Punkt 0 um (2,0) verschoben: ' + JSON.stringify(ergB.vorher[0]) + ' -> ' + JSON.stringify(ergB.nachher[0]));
  pruefe(ergB.nachher[letzter][0] === ergB.nachher[0][0] && ergB.nachher[letzter][1] === ergB.nachher[0][1],
    'Duplikat-Schlusspunkt (' + letzter + ') mitverschoben, weiterhin synchron zu Punkt 0: ' + JSON.stringify(ergB.nachher[letzter]));
  for (let i = 1; i < letzter; i++) {
    const [vx, vy] = ergB.vorher[i], [nx, ny] = ergB.nachher[i];
    pruefe(nx === vx && ny === vy, 'Zwischenpunkt ' + i + ' unveraendert: ' + JSON.stringify(ergB.nachher[i]));
  }
}

console.log('(c) punktVerschiebenUm — offene Tuer-PSG, Punkt 0 -> letzter Punkt bleibt unveraendert');
const ergC = vm.runInContext(`
  (() => {
    const lage = modell.layers[0];
    const op = lage.ops.find(o => o.kw === 'PSG' && (o.poly||[]).length === 4);
    if (!op) return { fehler: 'Tuer-PSG (4 Punkte) nicht gefunden' };
    const vorher = op.poly.map(p => [p.x, p.y]);
    const ok = punktVerschiebenUm(op, 0, 7, 11);
    return { ok, closed: op.closed, vorher, nachher: op.poly.map(p => [p.x, p.y]) };
  })()
`, ctx);
if (ergC.fehler) { console.error('  FEHLER  ' + ergC.fehler); fehler++; }
else {
  pruefe(ergC.ok === true, 'punktVerschiebenUm meldet Erfolg');
  pruefe(ergC.closed === false, 'Tuer-PSG ist offen (closed=false)');
  pruefe(ergC.nachher.length === 4, 'weiterhin 4 Punkte (kein Kollaps)');
  pruefe(Math.abs(ergC.nachher[0][0] - ergC.vorher[0][0] - 7) < 1e-9 && Math.abs(ergC.nachher[0][1] - ergC.vorher[0][1] - 11) < 1e-9,
    'Punkt 0 um (7,11) verschoben: ' + JSON.stringify(ergC.vorher[0]) + ' -> ' + JSON.stringify(ergC.nachher[0]));
  const letzter = ergC.nachher.length - 1;
  pruefe(ergC.nachher[letzter][0] === ergC.vorher[letzter][0] && ergC.nachher[letzter][1] === ergC.vorher[letzter][1],
    'letzter Punkt (offenes Ende) NICHT auf Punkt 0 gezwungen: ' + JSON.stringify(ergC.nachher[letzter]));
}

console.log('\nVerschieben-Eingabe-Smoke: ' + (fehler ? fehler + ' FEHLER' : 'alle Pruefungen OK'));
process.exit(fehler ? 1 : 0);
