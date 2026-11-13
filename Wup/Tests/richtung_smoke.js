#!/usr/bin/env node
/*
  Smoke-Test fuer WP-D (v2.26): Richtungsbearbeitung (Hauskonvention —
  Bohrung ~Ø40/t1-5 in Ober-/Untergurt fuer den Abgleich WUP <-> Abbund BVN/BVX)
  und AP-WE4 (Namensfilter im Werte-Ersetzen).
    a) richtungsbearbeitungFinden: erkennt BOZ nach Kriterien, verwirft
       falschen Durchmesser/zu tiefe Bohrung, meldet Eindeutigkeit/Ende.
    b) P-18: RICHTUNG_FEHLT je Gurt ohne Bohrung, RICHTUNG_MITTIG bei zu
       mittiger Lage, kein Befund bei korrekter Bohrung; LS/QS unbeachtet.
    c) richtungsbearbeitungenErzeugen: erzeugt BOZ nur fuer offene Gurte,
       Export enthaelt TXT-Marker + BOZ direkt nach der Kopfzeile, P-18
       danach leer, idempotent (zweiter Lauf erzeugt nichts).
    d) Roundtrip-Sicherheit: unveraenderte Datei bleibt trotz P-18-Befunden
       zeilenidentisch.
    e) Namensfilter: platteHz-Ersetzung trifft nur Platten mit exakt
       passendem Namen.
*/
'use strict';
const { editorKontext, wupLaden, vm } = require('./harness');

let fehler = 0;
function pruefe(bedingung, text) {
  if (bedingung) console.log('  OK      ' + text);
  else { console.error('  FEHLER  ' + text); fehler++; }
}

/* OG mit korrekter Richtungsbohrung, UG ohne, zweiter OG mit MITTIGER
   Bohrung, dazu Stoerkandidaten (falscher Ø, zu tief, LS mit BOZ). */
function testDatei() {
  return [
    'VERSION 3.4;', 'ELN test;', 'ELM     8000, 2500, 235, 1;',
    'OG      8000, 80, 160, 0, 2420, 0, Raehm-1, 0;',
    'TXT ***BOHRUNG_BOZ*** ;',
    'BOZ     100, 40, 40, 2;',
    'UG      8000, 120, 160, 0, 0, 0, Schwelle-1, 0;',
    'BOZ     100, 60, 12, 2;',              /* falscher Durchmesser -> zaehlt nicht */
    'BOZ     200, 60, 40, 60;',             /* zu tief -> zaehlt nicht */
    'LS      2000, 60, 160, 500, 200, 0, Stiel-1, 0;',
    'BOZ     100, 30, 40, 2;',              /* LS: von P-18 nicht verlangt/geprueft */
    'PLI1    8000, 2500, 15, 0, 0, 30, OSB-Platte, 160;',
    'PP      0, 0;', 'PP      8000, 0;', 'PP      8000, 2500;', 'PP      0, 2500;', 'PP      0, 0;',
    'PLI2    8000, 2500, 15, 0, 0, 60, Gipsfaser, 175;',
    'PP      0, 0;', 'PP      8000, 0;', 'PP      8000, 2500;', 'PP      0, 2500;', 'PP      0, 0;',
    ''].join('\r\n');
}
function testDateiMittig() {
  return [
    'VERSION 3.4;', 'ELN test;', 'ELM     8000, 2500, 235, 1;',
    'OG      8000, 80, 160, 0, 2420, 0, Raehm-M, 0;',
    'BOZ     3900, 40, 40, 2;',             /* fast Mitte (4000) -> nicht eindeutig */
    ''].join('\r\n');
}

/* --- a) Erkennung --- */
{
  const ctx = editorKontext();
  wupLaden(ctx, testDatei());
  const erg = vm.runInContext(`
    (() => {
      const og = modell.beams.find(b => b.kw === 'OG');
      const ug = modell.beams.find(b => b.kw === 'UG');
      const rOg = richtungsbearbeitungFinden(og), rUg = richtungsbearbeitungFinden(ug);
      return { og: rOg.length, ogEnde: rOg[0] && rOg[0].ende, ogEindeutig: rOg[0] && rOg[0].eindeutig,
        ogD: rOg[0] && rOg[0].d, ug: rUg.length };
    })()
  `, ctx);
  pruefe(erg.og === 1 && erg.ogD === 40, 'OG: genau eine Richtungsbohrung erkannt (Ø40): ' + erg.og);
  pruefe(erg.ogEnde === 'anfang' && erg.ogEindeutig === true, 'OG: Bohrung eindeutig am Bauteilanfang: ' + erg.ogEnde);
  pruefe(erg.ug === 0, 'UG: falscher Ø (12) und zu tiefe Bohrung (t=60) zaehlen NICHT: ' + erg.ug);
}

/* --- b) P-18 --- */
{
  const ctx = editorKontext();
  wupLaden(ctx, testDatei());
  const erg = vm.runInContext(`
    (() => {
      pruefungenAusfuehren();
      const p18 = modell.pruefungen.filter(p => p.code === 'P-18');
      return { anzahl: p18.length, level: p18[0] && p18[0].level,
        meldung: p18[0] ? p18[0].msg : '',
        keinLs: !p18.some(p => p.msg.includes('Stiel-1')) };
    })()
  `, ctx);
  pruefe(erg.anzahl === 1, 'P-18 meldet genau 1 Befund (nur der UG ohne Bohrung): ' + erg.anzahl);
  pruefe(erg.level === 'warnung' && erg.meldung.includes('RICHTUNG_FEHLT') && erg.meldung.includes('Schwelle-1'),
    'P-18: RICHTUNG_FEHLT als Warnung fuer die Schwelle: ' + erg.meldung.slice(0, 60));
  pruefe(erg.meldung.includes('BVN/BVX'), 'Meldung nennt den Abbund-Abgleich (BVN/BVX)');
  pruefe(erg.keinLs, 'LS (Stiel) wird von P-18 nicht verlangt');

  const ctx2 = editorKontext();
  wupLaden(ctx2, testDateiMittig());
  const erg2 = vm.runInContext(`
    (() => {
      pruefungenAusfuehren();
      const p18 = modell.pruefungen.filter(p => p.code === 'P-18');
      return { anzahl: p18.length, level: p18[0] && p18[0].level, mittig: p18[0] && p18[0].msg.includes('RICHTUNG_MITTIG') };
    })()
  `, ctx2);
  pruefe(erg2.anzahl === 1 && erg2.level === 'hinweis' && erg2.mittig,
    'P-18: zu mittige Bohrung -> Hinweis RICHTUNG_MITTIG: ' + erg2.anzahl + '/' + erg2.level);
}

/* --- c) Automatik erzeugt fehlende Bohrungen --- */
{
  const ctx = editorKontext();
  wupLaden(ctx, testDatei());
  const erg = vm.runInContext(`
    (() => {
      const n1 = richtungsbearbeitungenErzeugen();
      pruefungenAusfuehren();
      const p18Nachher = modell.pruefungen.filter(p => p.code === 'P-18').length;
      const ug = modell.beams.find(b => b.kw === 'UG');
      const neue = ug.bearbeitungen.find(b => b.auto === 'richtung');
      const zeilen = exportZeilenErzeugen().zeilen;
      const ugZeile = zeilen.findIndex(z => /^UG\\s/.test(z));
      const n2 = richtungsbearbeitungenErzeugen();
      return { n1, n2, p18Nachher,
        neueParams: neue ? neue.params.join(',') : null,
        txtDanach: zeilen[ugZeile + 1], bozDanach: zeilen[ugZeile + 2],
        undoTiefe: undoStack.length };
    })()
  `, ctx);
  pruefe(erg.n1 === 1, 'Automatik erzeugt genau 1 Bohrung (nur der offene UG): ' + erg.n1);
  pruefe(erg.p18Nachher === 0, 'P-18 ist nach der Automatik leer');
  pruefe(erg.neueParams === '100,60,40,2', 'BOZ-Parameter: x=100, y=Gurtmitte(60), Ø40, t=+2 (PLI-Seite): ' + erg.neueParams);
  pruefe(erg.txtDanach.startsWith('TXT') && erg.txtDanach.includes('***BOHRUNG_BOZ*** RICHTUNG (AUTO);'),
    'Export: TXT-Marker direkt nach der UG-Kopfzeile: ' + erg.txtDanach);
  pruefe(erg.bozDanach.startsWith('BOZ') && erg.bozDanach.includes('100, 60, 40, 2;'),
    'Export: BOZ-Zeile folgt dem Marker: ' + erg.bozDanach);
  pruefe(erg.n2 === 0, 'zweiter Lauf erzeugt NICHTS (idempotent): ' + erg.n2);
  pruefe(erg.undoTiefe === 1, 'genau ein Undo-Schritt (zweiter Lauf ohne Kandidaten erzeugt keinen): ' + erg.undoTiefe);
}

/* --- d) Roundtrip unveraendert trotz P-18-Befunden --- */
{
  const ctx = editorKontext();
  wupLaden(ctx, testDatei());
  const erg = vm.runInContext(`
    (() => {
      pruefungenAusfuehren();
      const { zeilen } = exportZeilenErzeugen();
      const orig = modell.rawLines.slice();
      while (orig.length && orig[orig.length-1] === '') orig.pop();
      const exp = zeilen.slice();
      while (exp.length && exp[exp.length-1] === '') exp.pop();
      return orig.length === exp.length && orig.every((z, i) => z === exp[i]);
    })()
  `, ctx);
  pruefe(erg === true, 'unveraenderte Datei exportiert trotz P-18-Befunden zeilenidentisch');
}

/* --- e) Namensfilter im Werte-Ersetzen (AP-WE4) --- */
{
  const ctx = editorKontext();
  wupLaden(ctx, testDatei());
  const erg = vm.runInContext(`
    (() => {
      const r = werteErsetzen({ feld: 'platteHz', suchwert: 15, ersatzwert: 18, toleranz: 0.01,
        bereich: 'alle', plattenNameFilter: 'OSB-Platte' });
      const p1 = modell.layers[0].plates[0], p2 = modell.layers[1].plates[0];
      const rOhne = werteErsetzen({ feld: 'platteHz', suchwert: 15, ersatzwert: 18, toleranz: 0.01,
        bereich: 'alle', nurVorschau: true });
      return { treffer: r.treffer, hz1: p1.hz, hz2: p2.hz, nurName: r.ops.every(f => f.platte.name === 'OSB-Platte'),
        ohneFilter: rOhne.treffer };
    })()
  `, ctx);
  pruefe(erg.treffer === 1 && erg.nurName, 'plattenNameFilter: nur die OSB-Platte getroffen: ' + erg.treffer);
  pruefe(erg.hz1 === 18 && erg.hz2 === 15, 'OSB hz 15->18, Gipsfaser bleibt 15: ' + erg.hz1 + '/' + erg.hz2);
  pruefe(erg.ohneFilter === 1, 'ohne Filter wuerde nur noch die Gipsfaser-Platte (hz 15) getroffen: ' + erg.ohneFilter);
}

if (fehler) {
  console.error('\nRichtung-Smoke: ' + fehler + ' Fehler.');
  process.exit(1);
} else {
  console.log('\nRichtung-Smoke: alle Pruefungen OK');
}
