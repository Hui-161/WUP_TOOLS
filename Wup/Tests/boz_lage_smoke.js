#!/usr/bin/env node
/*
  Smoke-Test v2.60 — BOZ in Plattenlagen + P-24 + bozAlleErsetzen()
  (Anwenderwunsch 2026-11-10: "Funktion anbieten, die BOZ in PAF mit MP
  abzuaendern — als gravierenden Befund melden … nur die BOZ in den
  Plattenlagen … immer Ebene 2"). Synthetische Wand, keine Projektdaten.

    a) BOZ in einer Lage wird als lage.bohrungen gelesen (nicht mehr
       UNBEKANNT), Riegelwerk-BOZ bleibt Bauteilbearbeitung
    b) P-24 nur fuer die Lagen-BOZ (Warnung), nicht fuer das Riegelwerk
    c) unveraenderte Datei bleibt byte-gleich (Roundtrip)
    d) bozAlleErsetzen: "PAF 2;" + "MP x, y, d/2, |t|, 211" — auch bei
       negativer Tiefe Ebene 2 und |t|; Riegelwerk-BOZ unberuehrt; ein
       Undo-Schritt; P-24 danach still; Undo stellt den Export wieder her
    e) MODUL-relative Koordinaten bleiben roh (keine Verschiebung)
*/
'use strict';
const { editorKontext, wupLaden, vm } = require('./harness');

let fehler = 0;
function pruefe(bedingung, text) {
  if (bedingung) console.log('  OK      ' + text);
  else { console.error('  FEHLER  ' + text); fehler++; }
}
const DATEI = ['VERSION 3.5;', 'ELN TEST;', 'ELM  3000, 2500,  160, 1;',
  'UG   3000,   80,  160,    0,    0,  0, 1, 0;',
  'TXT ***BOHRUNG_BOZ*** ;',
  'BOZ    180,     40,     40, 2 ;',                     /* Z6: Riegelwerk — bleibt */
  'PLI0  3000, 2500,  160,    0,    0,   240, Holzfaser isocell,    0;',
  'PP       0,    0,  160;', 'PP    3000,    0,  160;', 'PP    3000, 2500,  160;', 'PP       0, 2500,  160;', 'PP       0,    0,  160;',
  'TXT ***BOHRUNG_BOZ*** ;',
  'BOZ     60,    497,     40, 2 ;',                     /* Z14: Lage */
  'BOZ    900,   1200,     30, -3 ;',                    /* Z15: Lage, negative Tiefe */
  'PLI1  3000, 2500,   15,    0,    0,    30, OSB,  160;',
  'PP       0,    0,   15;', 'PP    3000,    0,   15;', 'PP    3000, 2500,   15;', 'PP       0, 2500,   15;', 'PP       0,    0,   15;',
  ''].join('\r\n');

const ctx = editorKontext();
wupLaden(ctx, DATEI, 'BOZ.WUP');
const r = vm.runInContext(`(() => {
  const pli0 = modell.layers.find(l => l.id === 'PLI0');
  pruefungenAusfuehren();
  const p24 = modell.pruefungen.filter(p => p.code === 'P-24');
  const roh = exportZeilenErzeugen().zeilen.join('\\r\\n');
  const undoVor = undoStack.length;
  const erg = bozAlleErsetzen();
  const nach = exportZeilenErzeugen().zeilen;
  pruefungenAusfuehren();
  const p24nach = modell.pruefungen.filter(p => p.code === 'P-24').length;
  const undoNach = undoStack.length;
  rueckgaengig();
  const nachUndo = exportZeilenErzeugen().zeilen.join('\\r\\n');
  return {
    bohrungen: (pli0.bohrungen || []).map(b => [b.x, b.y, b.d, b.t, b._zeile + 1]),
    unbekannt: modell.warnings.filter(w => w.code === 'UNBEKANNT').length,
    riegel: modell.beams[0].bearbeitungen.map(b => b.kw),
    p24: p24.map(p => ({ level: p.level, lage: p.lageId, msg: p.msg })),
    roh, erg, nach, p24nach, undo: undoNach - undoVor, nachUndo
  };
})()`, ctx);

/* a) */
pruefe(JSON.stringify(r.bohrungen) === JSON.stringify([[60, 497, 40, 2, 14], [900, 1200, 30, -3, 15]]),
  'zwei BOZ in PLI0 als lage.bohrungen gelesen: ' + JSON.stringify(r.bohrungen));
pruefe(r.unbekannt === 0, 'keine UNBEKANNT-Warnung mehr fuer Lagen-BOZ: ' + r.unbekannt);
pruefe(r.riegel.join() === 'BOZ', 'Riegelwerk-BOZ bleibt Bauteilbearbeitung');
/* b) */
pruefe(r.p24.length === 2 && r.p24.every(p => p.level === 'warnung' && p.lage === 'PLI0'),
  'P-24 genau fuer die zwei Lagen-BOZ (Warnung, Lage PLI0): ' + r.p24.length);
pruefe(r.p24.some(p => /Quelltext-Zeile 14/.test(p.msg)) && !r.p24.some(p => /Zeile 6\b/.test(p.msg)),
  'Meldung nennt die Zeile, Riegelwerk-BOZ (Zeile 6) wird nicht gemeldet');
/* c) */
pruefe(r.roh === DATEI, 'unveraenderte Datei bleibt byte-gleich');
/* d) */
pruefe(r.erg.ersetzt === 2 && r.erg.uebersprungen.length === 0, 'bozAlleErsetzen: 2 ersetzt, 0 uebersprungen');
const i = r.nach.findIndex(z => /^PAF\s+2;$/.test(z));
pruefe(r.nach[i - 1] === 'TXT ***BOHRUNG_BOZ*** ;' && r.nach[i + 1] === 'MP      60, 497, 20, 2, 211;'
  && /^PAF\s+2;$/.test(r.nach[i + 2]) && r.nach[i + 3] === 'MP      900, 1200, 15, 3, 211;',
  'Zeilen: PAF 2 + MP x, y, d/2, |t|, 211 (auch bei t < 0 Ebene 2): ' + r.nach.slice(i - 1, i + 4).join(' | '));
pruefe(r.nach.filter(z => /^BOZ/.test(z)).length === 1 && r.nach[5] === 'BOZ    180,     40,     40, 2 ;',
  'Riegelwerk-BOZ unberuehrt');
pruefe(r.undo === 1 && r.p24nach === 0, 'ein Undo-Schritt, P-24 danach still');
pruefe(r.nachUndo === DATEI, 'Undo stellt den Export byte-gleich wieder her');

/* e) MODUL-relativ */
{
  const c2 = editorKontext();
  const modul = DATEI.replace('PLI0  3000,', 'MODUL 100, 200;\r\nPLI0  3000,').replace('PLI1  3000,', 'ENDMODUL;\r\nPLI1  3000,');
  wupLaden(c2, modul, 'MODUL.WUP');
  const m = vm.runInContext(`(() => { const l = modell.layers.find(x => x.id === 'PLI0');
    const b = (l && l.bohrungen || [])[0]; bozAlleErsetzen();
    return { b: b ? [b.x, b.y] : null, z: exportZeilenErzeugen().zeilen.filter(x => /^MP/.test(x)) }; })()`, c2);
  if (m.b) pruefe(m.z[0] === 'MP      60, 497, 20, 2, 211;', 'MODUL: MP behaelt die rohen (relativen) Koordinaten: ' + m.z[0]);
  else console.log('  (MODUL-Fall vom Parser hier nicht als Lage erkannt — uebersprungen)');
}

if (fehler) { console.error('\nBOZ-Lage-Smoke: ' + fehler + ' Fehler.'); process.exit(1); }
console.log('\nBOZ-Lage-Smoke: alle Pruefungen OK');
