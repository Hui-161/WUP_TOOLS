#!/usr/bin/env node
/*
  Smoke-Test: Verschieben in OFFENEN Polygonzuegen (>= 3 Punkte).

  Fehlerbild aus der Praxis, nachgestellt in der synthetischen Innenwand
  SEMA/IW02.WUP: das Tuer-Saegepolygon ist eine offene П-Form
  (3340,5 → 3340,2130 → 2240,2130 → 2240,5 — unten offen). Die Duplikat-
  Schlusspunkt-Synchronisation darf NUR bei geschlossenen Zuegen greifen;
  ohne closed-Pruefung wurde beim Verschieben einer Kante der letzte Punkt
  auf den ersten gezwungen und die Tuer kollabierte zum Dreieck.
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

console.log('Tuer-PSG (offene П-Form) — Kante verschieben');
const erg = vm.runInContext(`
  (() => {
    const lage = modell.layers[0];
    /* das Tuer-PSG: 4 Punkte, offen, x-Bereich 2240..3340 */
    const op = lage.ops.find(o => o.kw === 'PSG' && (o.poly||[]).length === 4);
    if (!op) return { fehler: 'Tuer-PSG (4 Punkte) nicht gefunden' };
    const vorher = op.poly.map(p => [p.x, p.y]);
    ui.kanten = [{ lageId: lage.id, besitzer: 'op', id: op.id, segIdx: 0 }];
    kanteVerschieben(10);   /* Segment (3340,5)->(3340,2130) parallel um 10mm */
    return { closed: op.closed, vorher, nachher: op.poly.map(p => [p.x, p.y]) };
  })()
`, ctx);
if (erg.fehler) { console.error('  FEHLER  ' + erg.fehler); fehler++; }
else {
  pruefe(erg.closed === false, 'Kontur ist als offen erkannt (closed=false)');
  pruefe(JSON.stringify(erg.vorher) === JSON.stringify([[3340, 5], [3340, 2130], [2240, 2130], [2240, 5]]),
    'Ausgangslage ist die Tuer-Kontur der Datei: ' + JSON.stringify(erg.vorher));
  pruefe(erg.vorher.length === 4 && erg.nachher.length === 4, 'weiterhin 4 Punkte');
  /* Segment 0 (Punkte 0+1) verschoben, Punkte 2+3 unveraendert */
  const [n0, n1, n2, n3] = erg.nachher, [v0, v1, v2, v3] = erg.vorher;
  pruefe(n0[0] !== v0[0] || n0[1] !== v0[1], 'Punkt 1 (Kantenanfang) verschoben: ' + JSON.stringify(n0));
  pruefe(n1[0] !== v1[0] || n1[1] !== v1[1], 'Punkt 2 (Kantenende) verschoben: ' + JSON.stringify(n1));
  pruefe(n2[0] === v2[0] && n2[1] === v2[1], 'Punkt 3 unveraendert: ' + JSON.stringify(n2));
  pruefe(n3[0] === v3[0] && n3[1] === v3[1],
    'Punkt 4 (offenes Ende) NICHT auf Punkt 1 gezwungen (kein Dreieck): ' + JSON.stringify(n3));
}

console.log('Gegenprobe: geschlossenes PSF — Schlusspunkt bleibt synchron');
const erg2 = vm.runInContext(`
  (() => {
    const lage = modell.layers[0];
    const op = lage.ops.find(o => o.kw === 'PSF');
    if (!op) return { fehler: 'PSF nicht gefunden' };
    ui.kanten = [{ lageId: lage.id, besitzer: 'op', id: op.id, segIdx: 0 }];
    kanteVerschieben(10);
    const pts = op.poly;
    return { closed: op.closed,
             erster: [pts[0].x, pts[0].y],
             letzter: [pts[pts.length-1].x, pts[pts.length-1].y] };
  })()
`, ctx);
if (erg2.fehler) { console.error('  FEHLER  ' + erg2.fehler); fehler++; }
else {
  pruefe(erg2.closed === true, 'PSF ist geschlossen (closed=true)');
  pruefe(erg2.erster[0] === erg2.letzter[0] && erg2.erster[1] === erg2.letzter[1],
    'Duplikat-Schlusspunkt weiterhin synchron: ' + JSON.stringify(erg2.erster));
}

console.log('\nOffene-Kontur-Smoke: ' + (fehler ? fehler + ' FEHLER' : 'alle Pruefungen OK'));
process.exit(fehler ? 1 : 0);
