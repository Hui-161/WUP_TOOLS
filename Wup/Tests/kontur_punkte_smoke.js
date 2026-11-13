#!/usr/bin/env node
/*
  Smoke-Test v2.57 — P-23 KONTUR_OHNE_PUNKTE (Anwenderwunsch nach Fund EG-02:
  WupWorks5 "PSG must at least contain two points (PP)", die Bearbeitung fehlt
  dann in der Fertigung). Synthetische Wand, keine Projektdaten.

    a) Positivfaelle (FEHLER): PSG ohne Punkt, PAF mit 1 Punkt, PSF mit 1
       Punkt (dort P-23 statt P-08), PAF an einem Bauteil mit 1 Punkt —
       Meldung nennt Lage/Bauteil, Art und Quelltext-Zeile
    b) Negativfaelle: PSG mit 2 Punkten, PSF als Kreis (MP), PSZ als
       Rechteck (TA), PML mit 2 Punkten, TXT-Zeile zwischen zwei Punkten
       zaehlt nicht — keine P-23
    c) Befunde aendern den Export nicht (byte-gleich)
*/
'use strict';
const { editorKontext, wupLaden, vm } = require('./harness');

let fehler = 0;
function pruefe(bedingung, text) {
  if (bedingung) console.log('  OK      ' + text);
  else { console.error('  FEHLER  ' + text); fehler++; }
}
const DATEI = [
  'VERSION 3.5;', 'ELN TEST;', 'ELM  3000, 2000,  160, 1;',
  'QS   3000,   60,  160,    0,    0,  0, 1001,   0;',
  'PAF ;',                                              /* Z5: Bauteil-PAF mit 1 Punkt -> P-23 */
  'PP     100,   30,  10, 211, 0;',
  'PLI1  3000, 2000,   16,    0,    0,    30, OSB 16mm,  160;',
  'PP       0,    0,   16;', 'PP    3000,    0,   16;', 'PP    3000, 2000,   16;', 'PP       0, 2000,   16;', 'PP       0,    0,   16;',
  'PSG ;',                                              /* Z13: 0 Punkte -> P-23 */
  'PAF ;',                                              /* Z14: 1 Punkt -> P-23 */
  'PP    500,  500,  16, 211, 0, 0 ;',
  'PSF ;',                                              /* Z16: 1 Punkt -> P-23 (nicht P-08) */
  'PP    700,  700,   0, 0, 0 ;',
  'PSG ;',                                              /* ok: 2 Punkte, TXT dazwischen */
  'PP    100,    5,  16, 211, 0, 0 ;',
  'TXT Kommentar zwischen den Punkten ;',
  'PP    900,    5,  16, 211, 0, 0 ;',
  'PSF ;',                                              /* ok: Kreis */
  'MP   1500, 1000,  30, 0, 0, 0 ;',
  'PSZ ;',                                              /* ok: Rechteck */
  'TA    200,  100, 1200, 1200, 0, 0, 0, 0, 0, 0 ;',
  'PML ;',                                              /* ok: 2 Punkte */
  'PP   2000,  100,   0, 122, 0 ;',
  'PP   2000,  150,   0, 122, 0 ;',
  ''].join('\r\n');

const ctx = editorKontext();
wupLaden(ctx, DATEI, 'P23.WUP');
const r = vm.runInContext(`(() => {
  const vorher = exportZeilenErzeugen().zeilen.join('\\r\\n');
  pruefungenAusfuehren();
  const p23 = modell.pruefungen.filter(p => p.code === 'P-23');
  return { vorher, nachher: exportZeilenErzeugen().zeilen.join('\\r\\n'),
    p23: p23.map(p => ({ level: p.level, msg: p.msg, lageId: p.lageId, ref: !!p.ref })),
    p08: modell.pruefungen.filter(p => p.code === 'P-08' && /PSF-Polygon/.test(p.msg)).length };
})()`, ctx);

/* a) */
const texte = r.p23.map(p => p.msg);
pruefe(r.p23.length === 4, 'genau 4 Konturen mit < 2 Punkten gemeldet: ' + r.p23.length);
pruefe(r.p23.every(p => p.level === 'fehler'), 'alle als FEHLER eingestuft');
pruefe(texte.some(t => /PLI1 PSG hat nur 0 Punkt\(e\) \(Quelltext-Zeile 13\)/.test(t)), 'PSG ohne Punkt mit Lage + Zeile 13');
pruefe(texte.some(t => /PLI1 PAF hat nur 1 Punkt\(e\) \(Quelltext-Zeile 14\)/.test(t)), 'PAF mit 1 Punkt mit Zeile 14');
pruefe(texte.some(t => /PLI1 PSF hat nur 1 Punkt\(e\) \(Quelltext-Zeile 16\)/.test(t)) && r.p08 === 0,
  'PSF mit 1 Punkt: P-23 statt der ungenaueren P-08 (P-08 fuer PSF: ' + r.p08 + ')');
pruefe(texte.some(t => /Bauteil QS( "[^"]*")? PAF hat nur 1 Punkt\(e\) \(Quelltext-Zeile 5\)/.test(t)), 'Bauteil-PAF mit 1 Punkt erkannt');
pruefe(r.p23.filter(p => p.lageId === 'PLI1').every(p => p.ref), 'Lagen-Befunde sind im Fehler-Log anklickbar (ref)');
pruefe(texte.every(t => /Originaldatei wiederherstellen/.test(t)), 'Meldung sagt, was zu tun ist');

/* b) */
pruefe(!texte.some(t => /PSZ|PML|Zeile 18|Zeile 22/.test(t)), 'keine Meldung fuer PSG mit 2 Punkten (TXT dazwischen), Kreis, Rechteck, PML');

/* c) */
pruefe(r.vorher === r.nachher && r.nachher === DATEI.replace(/\r\n$/, '\r\n'), 'Pruefung aendert den Export nicht (byte-gleich)');

if (fehler) { console.error('\nKontur-Punkte-Smoke: ' + fehler + ' Fehler.'); process.exit(1); }
console.log('\nKontur-Punkte-Smoke: alle Pruefungen OK');
