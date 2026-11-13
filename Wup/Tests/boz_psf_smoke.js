#!/usr/bin/env node
/*
  Smoke-Test v2.61 — Auto-PSF fuer BOZ in Plattenlagen (Anwenderwunsch
  2026-11-11 "AUTO-PSF: BOZ-Sperrflaechen auch automatisch setzen";
  Entscheidungen: nur Plattenlagen-BOZ, Regel wie Fraesungen = eigene Lage
  + Lagen DARUNTER derselben Seite). Synthetische Wand, keine Projektdaten.

    a) BOZ in PLI2 ueber NR in PLI2 und PLI1 → P-03 (fehler), Auto-PSF legt
       je Lage eine Sperrflaeche an (Bohrkreis + Offset des NR-Index)
    b) danach keine P-03 mehr, zweiter Lauf erzeugt nichts (deckungsgleich)
    c) NR auf der ANDEREN Seite (PLA1) und NR ausserhalb des Kreises bleiben
       ohne Sperrflaeche; BOZ in PLI0 (unterste Lage) erzeugt nichts
    d) Riegelwerk-BOZ werden nicht beachtet
*/
'use strict';
const { editorKontext, wupLaden, vm } = require('./harness');

let fehler = 0;
function pruefe(bedingung, text) {
  if (bedingung) console.log('  OK      ' + text);
  else { console.error('  FEHLER  ' + text); fehler++; }
}
const platte = id => [id + '  3000, 2500,   15,    0,    0,    30, OSB,  160;',
  'PP       0,    0,   15;', 'PP    3000,    0,   15;', 'PP    3000, 2500,   15;', 'PP       0, 2500,   15;', 'PP       0,    0,   15;'];
const DATEI = ['VERSION 3.5;', 'ELN TEST;', 'ELM  3000, 2500,  160, 1;',
  'UG   3000,   80,  160,    0,    0,  0, 1, 0;',
  'BOZ   1000,     40,     40, 2 ;',                     /* Riegelwerk — nicht beachten */
  'PLI0  3000, 2500,  160,    0,    0,   240, Holzfaser isocell,    0;',
  'PP       0,    0,  160;', 'PP    3000,    0,  160;', 'PP    3000, 2500,  160;', 'PP       0, 2500,  160;', 'PP       0,    0,  160;',
  'BOZ   2000,   1200,     40, 2 ;',                     /* PLI0: unterste Lage → nichts */
  ...platte('PLI1'),
  'NR     500,  100,  500, 2400, 150, 11;',              /* unter der PLI2-BOZ (x=500) */
  'NR    2000,  100, 2000, 2400, 150, 11;',              /* unter der PLI0-BOZ, aber PLI1 liegt NICHT unter PLI0 */
  ...platte('PLI2'),
  'NR     510,  100,  510, 2400, 150, 20;',              /* in der eigenen Lage, 10 mm neben dem Zentrum */
  'NR     900,  100,  900, 2400, 150, 20;',              /* weit weg */
  'BOZ    500,   1000,     40, 2 ;',                     /* Z: PLI2 */
  ...platte('PLA1'),
  'NR     500,  100,  500, 2400, 150, 20;',              /* andere Seite */
  ''].join('\r\n');

const ctx = editorKontext();
wupLaden(ctx, DATEI, 'BOZPSF.WUP');
const r = vm.runInContext(`(() => {
  const psf = () => modell.layers.map(l => l.id + ':' + l.ops.filter(o => o.auto === 'psf').length).join(' ');
  const bbox = id => modell.layers.find(l => l.id === id).ops.filter(o => o.auto === 'psf').map(o => {
    const b = Geo.bbox(opPolyAlsArray(o)); return [b.minX, b.minY, b.maxX, b.maxY]; });
  pruefungenAusfuehren();
  const p03 = modell.pruefungen.filter(p => p.code === 'P-03' && /BOZ/.test(p.msg)).map(p => p.msg);
  f3AutoPsf();
  const nach = psf();
  pruefungenAusfuehren();
  const p03nach = modell.pruefungen.filter(p => p.code === 'P-03').length;
  const undo1 = undoStack.length;
  f3AutoPsf();
  return { p03, nach, b1: bbox('PLI1'), b2: bbox('PLI2'), p03nach, zweiter: psf(), undo: undoStack.length - undo1 };
})()`, ctx);

/* a) */
pruefe(r.p03.length === 1 && /BOZ in PLI2/.test(r.p03[0]),
  'P-03 meldet die BOZ in PLI2 (einmal je Bohrung): ' + r.p03.join(' | ').slice(0, 160));
pruefe(r.nach === 'PLI0:0 PLI1:1 PLI2:1 PLA1:0', 'Auto-PSF: je eine Sperrflaeche in PLI2 und PLI1, keine in PLA1/PLI0: ' + r.nach);
/* Bohrkreis r=20 + Offset: Index 20 → 20 mm (PLI2), Index 11 → 7 mm (PLI1) */
pruefe(JSON.stringify(r.b2) === JSON.stringify([[460, 960, 540, 1040]]), 'PLI2-PSF = Kreis 20 + 20 mm: ' + JSON.stringify(r.b2));
pruefe(JSON.stringify(r.b1) === JSON.stringify([[473, 973, 527, 1027]]), 'PLI1-PSF = Kreis 20 + 7 mm: ' + JSON.stringify(r.b1));
/* b) */
pruefe(r.p03nach === 0, 'danach keine P-03 mehr: ' + r.p03nach);
pruefe(r.zweiter === r.nach && r.undo === 0, 'zweiter Lauf erzeugt nichts und keinen Undo-Schritt');
/* c/d) implizit oben: PLA1 0, PLI0-BOZ ohne Wirkung, Riegelwerk-BOZ (x=1000) ohne PSF */
pruefe(!r.b1.some(b => b[0] > 1500) && !r.b2.some(b => b[0] > 800), 'keine PSF fuer die PLI0-BOZ (x=2000) und die Riegelwerk-BOZ (x=1000)');

if (fehler) { console.error('\nBOZ-PSF-Smoke: ' + fehler + ' Fehler.'); process.exit(1); }
console.log('\nBOZ-PSF-Smoke: alle Pruefungen OK');
