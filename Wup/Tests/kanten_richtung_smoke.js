#!/usr/bin/env node
/*
  Smoke-Test: gemeinsames Verschieben kollinearer Kanten mit ENTGEGENGESETZTER
  Laufrichtung (Spec F6 — Plattenumriss CCW + deckungsgleicher PSG-Zuschnitt CW
  ist der Normalfall bei verknuepften Kanten). Beide Kanten muessen sich in
  DIESELBE Welt-Richtung bewegen, sonst reisst die Kontur auseinander.
*/
'use strict';
const { editorKontext, wupLaden, vm } = require('./harness');

const ctx = editorKontext();
/* Zwei PAF-Zuege mit kollinearer Kante auf y=500, entgegengesetzt durchlaufen */
wupLaden(ctx, [
  'VERSION 3.4;', 'ELN test;', 'ELM     3000, 2500, 235, 1;',
  'PLI1    3000, 2500, 15, 0, 0, 30, OSB, 160;',
  'PP      0, 0;', 'PP      3000, 0;', 'PP      3000, 2500;', 'PP      0, 2500;', 'PP      0, 0;',
  'PAF;',
  'PP      100, 500, 15, 311, 0;', 'PP      500, 500, 15, 311, 0;',   /* laeuft +x */
  'PAF;',
  'PP      900, 500, 15, 311, 0;', 'PP      600, 500, 15, 311, 0;',   /* laeuft -x */
  ''].join('\r\n'));

const erg = vm.runInContext(`
  (() => {
    const lage = modell.layers[0];
    const [op1, op2] = lage.ops.filter(o => o.kw === 'PAF');
    ui.kanten = [
      { lageId: lage.id, besitzer: 'op', id: op1.id, segIdx: 0 },
      { lageId: lage.id, besitzer: 'op', id: op2.id, segIdx: 0 },
    ];
    kanteVerschieben(10);
    return { y1: op1.poly[0].y, y2: op2.poly[0].y };
  })()
`, ctx);

if (erg.y1 === 510 && erg.y2 === 510) {
  console.log('OK      beide kollinearen Kanten in dieselbe Richtung verschoben (y=510)');
  console.log('\nKanten-Richtung-Smoke: alle Pruefungen OK');
  process.exit(0);
} else {
  console.error('FEHLER  Kanten laufen auseinander oder falsch: y1=' + erg.y1 + ', y2=' + erg.y2 + ' (erwartet beide 510)');
  process.exit(1);
}
