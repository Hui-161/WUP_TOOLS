#!/usr/bin/env node
/*
  Smoke-Test:
  A) Kanten-Verschiebung in X / Y / parallel (Overlay-Richtungen).
  B) Fang auf bereits gezeichnete Kontur-Punkte (Startpunkt zum Schliessen),
     inkl. Ortho beim Zeichnen (zeichenPunktBestimmen).
*/
'use strict';
const fs = require('fs');
const path = require('path');
const { editorKontext, synthetischeDatei, vm } = require('./harness');

let fehler = 0;
function pruefe(b, t) { if (b) console.log('  OK      ' + t); else { console.error('  FEHLER  ' + t); fehler++; } }

const ctx = editorKontext();
/* synthetische Innenwand mit Tuer (SEMA-Stil), siehe 03_Beispiel-synthetisch/erzeugen.js */
const datei = synthetischeDatei('SEMA', 'IW02.WUP');
const puffer = fs.readFileSync(datei);
ctx.__buffer = puffer.buffer.slice(puffer.byteOffset, puffer.byteOffset + puffer.byteLength);
vm.runInContext(`
  const dek = dateiDekodieren(__buffer);
  modell = wupParsen(dek.text, 'IW02.WUP', dek.encoding, dek.hatteBom);
  snapPunkteAufbauen();
`, ctx);

console.log('A) Kanten-Verschiebung in X / Y');
const a = vm.runInContext(`
  (() => {
    const lage = modell.layers[0];
    const op = lage.ops.find(o => o.kw === 'PSG' && (o.poly||[]).length === 4);
    const seg = { lageId: lage.id, besitzer: 'op', id: op.id, segIdx: 0 };
    /* X-Verschiebung um 10 */
    ui.kanten = [seg];
    const v0 = op.poly.map(p => [p.x, p.y]);
    kanteVerschieben(10, 'x');
    const nachX = op.poly.map(p => [p.x, p.y]);
    /* zurueck, dann Y-Verschiebung um 10 — nach Undo ist das Modell komplett
       ersetzt, Op per id neu holen */
    rueckgaengig();
    const op2 = modell.layers[0].ops.find(o => o.id === op.id);
    ui.kanten = [seg];
    kanteVerschieben(10, 'y');
    const nachY = op2.poly.map(p => [p.x, p.y]);
    return { v0, nachX, nachY };
  })()
`, ctx);
/* Segment 0 = Punkte 0,1. X-Move: nur x der Punkte 0,1 +10, y unveraendert */
pruefe(a.nachX[0][0] === a.v0[0][0] + 10 && a.nachX[0][1] === a.v0[0][1], 'X-Move: Punkt 0 nur in X (+10)');
pruefe(a.nachX[1][0] === a.v0[1][0] + 10 && a.nachX[1][1] === a.v0[1][1], 'X-Move: Punkt 1 nur in X (+10)');
pruefe(a.nachX[2][0] === a.v0[2][0] && a.nachX[2][1] === a.v0[2][1], 'X-Move: Punkt 2 unveraendert');
pruefe(a.nachY[0][1] === a.v0[0][1] + 10 && a.nachY[0][0] === a.v0[0][0], 'Y-Move: Punkt 0 nur in Y (+10)');
pruefe(a.nachY[1][1] === a.v0[1][1] + 10 && a.nachY[1][0] === a.v0[1][0], 'Y-Move: Punkt 1 nur in Y (+10)');

console.log('B) Fang auf gezeichnete Punkte + Ortho beim Zeichnen');
const b = vm.runInContext(`
  (() => {
    /* im Bau befindliche Kontur mit 3 Punkten */
    ui.neueKontur = { punkte: [[100, 100], [300, 100], [300, 300]] };
    /* Maus nahe dem Startpunkt (100,100) -> muss auf Startpunkt fangen */
    const nahStart = zeichenPunktBestimmen([104, 97], false);
    /* Maus frei, kein Snap, kein Ortho */
    const frei = zeichenPunktBestimmen([620, 512], false);
    /* Ortho zum letzten Punkt (300,300): Maus (620,290) -> y auf 300 gezogen
       (x-Differenz groesser) */
    const ortho = zeichenPunktBestimmen([620, 290], true);
    return { nahStart, frei, ortho };
  })()
`, ctx);
pruefe(b.nahStart.gefangen && b.nahStart.p[0] === 100 && b.nahStart.p[1] === 100,
  'Fang auf Startpunkt (100,100) zum Schliessen: ' + JSON.stringify(b.nahStart.p));
pruefe(!b.frei.gefangen && b.frei.p[0] === 620 && b.frei.p[1] === 512, 'freie Position ohne Snap/Ortho');
pruefe(!b.ortho.gefangen && b.ortho.p[1] === 300 && b.ortho.p[0] === 620,
  'Ortho zum letzten Punkt: y auf 300 eingerastet: ' + JSON.stringify(b.ortho.p));

console.log('\nVerschieben-Richtung/Snap-Smoke: ' + (fehler ? fehler + ' FEHLER' : 'alle Pruefungen OK'));
process.exit(fehler ? 1 : 0);
