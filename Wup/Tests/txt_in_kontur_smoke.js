#!/usr/bin/env node
/*
  Smoke-Test v2.56 — TXT-Zeile MITTEN in einer Punktliste (Anwenderfund
  2026-09-29, WupWorks5: "PSG must at least contain two points (PP)").
  Muster aus der Anwenderdatei EG-02 (hier SYNTHETISCH nachgebaut, ohne
  Projektdaten): eine PSG, deren erster Punkt per "TXT PP, …" auskommentiert
  ist, direkt danach zwei 2-Punkt-PAF mit gemeinsamem Endpunkt, die
  Auto-Kontur zu einer Kette verbindet.
  Vor dem Fix begann der Zeilenbereich der ersten PAF bei der TXT-Zeile und
  umfasste die PSG-Punkte — Auto-Kontur loeschte sie mit, es blieb "PSG ;".

    a) Zeilenbereiche: PSG umfasst ihre Punkte, die PAF beginnt erst bei
       ihrer eigenen TXT-Ueberschrift (keine Ueberlappung)
    b) Auto-Kontur: PAF verbunden, PSG behaelt alle 4 Punkte UND die
       auskommentierte TXT-Zeile; keine Kontur mit < 2 Punkten im Export
    c) dasselbe fuer eine TXT-Zeile mitten in einem Platten-Umriss (PP)
    d) unveraenderte Datei bleibt byte-gleich (Roundtrip)
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
  'PLI1  3000, 2000,   16,    0,    0,    30, OSB 16mm,  160;',
  'PP       0,    0,   16;',
  'TXT Umriss-Kommentar mitten im Plattenumriss ;',
  'PP    3000,    0,   16;', 'PP    3000, 2000,   16;', 'PP       0, 2000,   16;', 'PP       0,    0,   16;',
  'TXT ***SAEGEPOLYGON_PSG_RECHTECK*** ;',
  'PSG ;',
  'TXT PP,   1000,      5,     16, 121, 0, 0 ;',
  'PP   2000,      5,     16, 111, 0, 0 ;',
  'PP   2000,   1000,     16, 121, 0, 0 ;',
  'PP   1000,   1000,     16, 121, 0, 0 ;',
  'PP   1000,      5,     16, 111, 0, 0 ;',
  'TXT ***AUSFRAESUNG_PAF** ;',
  'PAF ;',
  'PP   2000,   1000,     16, 111, 0, 0 ;',
  'PP   1925,   1000,     16, 111, 0, 0 ;',
  'TXT ***AUSFRAESUNG_PAF** ;',
  'PAF ;',
  'PP   2000,    915,     16, 121, 0, 0 ;',
  'PP   2000,   1000,     16, 121, 0, 0 ;',
  ''].join('\r\n');

/* Punkte je Kontur wie die Maschine zaehlen: TXT/Leerzeilen ueberspringen */
function konturenMitWenigerAls2Punkten(zeilen) {
  const befund = [];
  zeilen.forEach((z, i) => {
    const m = /^(PSG|PAF|PSF|PSZ|PML)\b/.exec(z);
    if (!m) return;
    let n = 0;
    for (let j = i + 1; j < zeilen.length; j++) {
      const t = zeilen[j].trim();
      if (!t || /^TXT\b/.test(t)) continue;
      if (/^(PP|KB|TA)\b/.test(t)) { n++; continue; }
      if (/^MP\b/.test(t)) { n += 2; continue; }   /* Kreis = vollstaendige Kontur */
      break;
    }
    if (n < 2) befund.push(m[1] + '@' + (i + 1) + ':' + n);
  });
  return befund;
}

/* --- a) Zeilenbereiche --- */
{
  const ctx = editorKontext();
  wupLaden(ctx, DATEI, 'TXT.WUP');
  const r = vm.runInContext(`(() => {
    const l = modell.layers.find(x => x.id === 'PLI1');
    return l.ops.map(o => ({ kw: o.kw, von: o._lineStart + 1, bis: o._lineEnd + 1, n: o.poly.length }));
  })()`, ctx);
  const psg = r.find(o => o.kw === 'PSG'), paf = r.find(o => o.kw === 'PAF');
  pruefe(psg && psg.n === 4 && psg.bis === 17, 'PSG umfasst ihre 4 Punkte bis Zeile 17: ' + JSON.stringify(psg));
  pruefe(paf && paf.von === 18, 'erste PAF beginnt bei ihrer eigenen TXT-Ueberschrift (Zeile 18, nicht 13): ' + JSON.stringify(paf));
  const ueberlapp = r.slice(1).some((o, i) => o.von <= r[i].bis);
  pruefe(!ueberlapp, 'keine ueberlappenden Zeilenbereiche: ' + r.map(o => o.kw + ' ' + o.von + '-' + o.bis).join(', '));
}

/* --- b) Auto-Kontur --- */
{
  const ctx = editorKontext();
  wupLaden(ctx, DATEI, 'TXT.WUP');
  const r = vm.runInContext(`(() => {
    autoKonturVerbinden();
    const l = modell.layers.find(x => x.id === 'PLI1');
    return { zeilen: exportZeilenErzeugen().zeilen,
      paf: l.ops.filter(o => o.kw === 'PAF').map(o => o.poly.length) };
  })()`, ctx);
  pruefe(r.paf.length === 1 && r.paf[0] === 3, 'Auto-Kontur hat die zwei PAF zu einer 3-Punkt-Kette verbunden: ' + r.paf.join(','));
  const leer = konturenMitWenigerAls2Punkten(r.zeilen);
  pruefe(!leer.length, 'keine Kontur mit < 2 Punkten im Export (vorher: leere "PSG ;"): ' + (leer.join(', ') || '—'));
  const i = r.zeilen.findIndex(z => /^PSG\b/.test(z));
  pruefe(/^TXT PP,\s+1000/.test(r.zeilen[i + 1]) && r.zeilen.slice(i + 2, i + 6).every(z => /^PP\b/.test(z)),
    'PSG behaelt die auskommentierte TXT-Zeile und alle 4 Punkte');
}

/* --- c) TXT mitten im Plattenumriss --- */
{
  const ctx = editorKontext();
  wupLaden(ctx, DATEI, 'TXT.WUP');
  const r = vm.runInContext(`(() => {
    const l = modell.layers.find(x => x.id === 'PLI1');
    const p = l.plates[0];
    return { umriss: p.outline.length, psgVon: l.ops[0]._lineStart + 1 };
  })()`, ctx);
  pruefe(r.umriss === 5, 'Plattenumriss mit TXT-Zeile mittendrin: alle 5 Punkte gelesen: ' + r.umriss);
  pruefe(r.psgVon === 11, 'PSG danach beginnt bei ihrer eigenen TXT-Ueberschrift (Zeile 11, nicht 6): ' + r.psgVon);
}

/* --- d) Roundtrip --- */
{
  const ctx = editorKontext();
  wupLaden(ctx, DATEI, 'TXT.WUP');
  const aus = vm.runInContext(`exportZeilenErzeugen().zeilen.join('\\r\\n')`, ctx);
  pruefe(aus === DATEI, 'unveraenderte Datei bleibt byte-gleich');
}

if (fehler) { console.error('\nTXT-in-Kontur-Smoke: ' + fehler + ' Fehler.'); process.exit(1); }
console.log('\nTXT-in-Kontur-Smoke: alle Pruefungen OK');
