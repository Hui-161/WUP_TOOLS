#!/usr/bin/env node
/*
  Smoke-Test v2.58 — Freistich-Automatik F2 (Anwenderwunsch 2026-10-27
  "Auto-Freistich wieder aktivieren, Einstellungen an die jetzigen
  Funktionen anpassen"). Synthetische Wand, keine Projektdaten.

    a) VORHANDENER fremder Freistich (Granit-Form: offene PAF, 3 PP,
       Schenkel 63 mm, Ecke auf dem Konturpunkt, 222 ueberall) wird erkannt:
       F2 fuegt nichts hinzu, P-10 schweigt, der Freistich selbst gilt nicht
       als Kontur mit Innenecke; Export bleibt byte-gleich
    b) ohne den vorhandenen Freistich: genau einer, Enden 212 / Ecke 222
       (E21), und F1/P-11/P-12 melden am neuen Freistich nichts
    c) kleine Oeffnung 60x60: Schenkel hoechstens halbe Kantenlaenge (30),
       kein Punkt ausserhalb der Oeffnung (sonst Fraesung ins Gutteil),
       Meldung nennt die gekuerzten Schenkel
    d) kleine 3-Punkt-PAF OHNE fremde Kontur an der Ecke (Granit-Ausklinkung)
       ist KEIN Freistich — sie bekommt weiter einen
    e) Automatiken-Menue: Eintrag "Freistiche" (Ziffer 6) ist vorhanden und
       verdrahtet, Einstellungen liegen auf 7; Profil kennt die Enden-Codes
*/
'use strict';
const fs = require('fs');
const path = require('path');
const { editorKontext, wupLaden, vm } = require('./harness');

let fehler = 0;
function pruefe(bedingung, text) {
  if (bedingung) console.log('  OK      ' + text);
  else { console.error('  FEHLER  ' + text); fehler++; }
}
const KOPF = ['VERSION 3.5;', 'ELN TEST;', 'ELM  3000, 2500,  160, 1;',
  'PLI1  3000, 2500,   15,    0,    0,    30, OSB 15mm,  160;',
  'PP       0,    0,   15;', 'PP    3000,    0,   15;', 'PP    3000, 2500,   15;', 'PP       0, 2500,   15;', 'PP       0,    0,   15;'];
/* Ausschnitt 1000..2000 x 1000..2000 (Loch, Korrektur 2, Ecken 221) */
const LOCH = ['PSG;',
  'PP    1000, 1000, -15, 221, 0, 135;', 'PP    1000, 2000, -15, 221, 0, 135;',
  'PP    2000, 2000, -15, 221, 0, 135;', 'PP    2000, 1000, -15, 221, 0, 135;',
  'PP    1000, 1000, -15, 221, 0, 135;'];
/* Granit-Freistich an der Ecke (1000,2000): Schenkel 63 mm entlang beider Kanten */
const GRANIT_FS = ['PAF;',
  'PP    1000, 1937, -15, 222, 0, 135;', 'PP    1000, 2000, -15, 222, 0, 135;',
  'PP    1063, 2000, -15, 222, 0, 135;'];

function laden(zeilen) {
  const ctx = editorKontext();
  wupLaden(ctx, zeilen.concat(['']).join('\r\n'), 'FS.WUP');
  return ctx;
}
const lauf = (ctx, js) => vm.runInContext(js, ctx);
const AUSWERTEN = `(() => {
  const l = modell.layers[0];
  pruefungenAusfuehren();
  const p10 = modell.pruefungen.filter(p => p.code === 'P-10').length;
  const vorher = exportZeilenErzeugen().zeilen.join('\\r\\n');
  f2SammelAktion();
  const neu = l.ops.filter(o => o.auto === 'freistich');
  pruefungenAusfuehren();
  const amNeuen = modell.pruefungen.filter(p => p.ref && p.ref.auto === 'freistich').map(p => p.code);
  return { p10, vorher, nachher: exportZeilenErzeugen().zeilen.join('\\r\\n'),
    neu: neu.map(o => o.poly.map(e => ({ x: e.x, y: e.y, i: e.i }))), amNeuen,
    p10nach: modell.pruefungen.filter(p => p.code === 'P-10').length };
})()`;
function hinweiseMitschneiden(ctx) {
  lauf(ctx, `globalThis.__hinweise = [];
    hinweisAnzeigen = (t, a) => { globalThis.__hinweise.push({ t, a }); };`);
}

/* --- a) vorhandener Granit-Freistich --- */
console.log('a) vorhandener fremder Freistich');
{
  const ctx = laden(KOPF.concat(LOCH, GRANIT_FS));
  const r = lauf(ctx, `(() => {
    const l = modell.layers[0];
    const fs = l.ops.find(o => o.kw === 'PAF');
    return { erkannt: f2IstFreistich(l, fs), alsEltern: f2InneneckenFinden(fs, true, l).length };
  })()`);
  pruefe(r.erkannt === true, 'Granit-PAF (3 PP, 63 mm, Ecke auf dem Konturpunkt) gilt als Freistich');
  pruefe(r.alsEltern === 0, 'der Freistich selbst gilt nicht als Kontur mit Innenecke: ' + r.alsEltern);
  const e = lauf(ctx, AUSWERTEN);
  pruefe(e.p10 === 3, 'P-10 meldet nur die drei Ecken OHNE Freistich (vorher 4 + Freistich-Ecke): ' + e.p10);
  pruefe(e.neu.length === 3, 'F2 ergaenzt genau die drei fehlenden, keinen zweiten an (1000,2000): ' + e.neu.length);
  pruefe(!e.neu.some(p => p.some(q => q.x === 1000 && q.y === 2000)), 'kein doppelter Freistich an der vorhandenen Ecke');
  pruefe(e.p10nach === 0, 'danach keine P-10 mehr: ' + e.p10nach);
}
{
  /* alle vier Ecken mit Freistich versorgt → F2 aendert nichts, Export byte-gleich */
  const voll = KOPF.concat(LOCH, GRANIT_FS,
    ['PAF;', 'PP    1937, 2000, -15, 222, 0, 135;', 'PP    2000, 2000, -15, 222, 0, 135;', 'PP    2000, 1937, -15, 222, 0, 135;'],
    ['PAF;', 'PP    2000, 1063, -15, 222, 0, 135;', 'PP    2000, 1000, -15, 222, 0, 135;', 'PP    1937, 1000, -15, 222, 0, 135;'],
    ['PAF;', 'PP    1063, 1000, -15, 222, 0, 135;', 'PP    1000, 1000, -15, 222, 0, 135;', 'PP    1000, 1063, -15, 222, 0, 135;']);
  const c2 = laden(voll);
  const e = lauf(c2, AUSWERTEN);
  pruefe(e.p10 === 0 && e.neu.length === 0, 'Wand mit vier Granit-Freistichen: P-10 ' + e.p10 + ', neue ' + e.neu.length);
  pruefe(e.vorher === e.nachher && e.nachher === voll.concat(['']).join('\r\n'), 'Export bleibt byte-gleich');
}

/* --- b) Codes nach E21 --- */
console.log('b) neuer Freistich: Enden 212, Ecke 222 (E21)');
{
  const ctx = laden(KOPF.concat(LOCH));
  const e = lauf(ctx, AUSWERTEN);
  pruefe(e.neu.length === 4, 'vier Freistiche im Ausschnitt: ' + e.neu.length);
  pruefe(e.neu.every(p => p.length === 3 && p[0].i === 212 && p[1].i === 222 && p[2].i === 212),
    'jeder Freistich 212/222/212: ' + e.neu.map(p => p.map(q => q.i).join('/')).join(' '));
  pruefe(e.neu.every(p => Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y) === 94), 'Schenkel 94 mm bei langer Kante');
  pruefe(e.amNeuen.length === 0, 'keine Pruefregel meldet die neuen Freistiche (F1-Enden passen): ' + e.amNeuen.join(','));
}

/* --- c) kleine Oeffnung --- */
console.log('c) kleine Oeffnung 60x60');
{
  const klein = ['PSG;',
    'PP    1000, 1000, -15, 221, 0, 135;', 'PP    1000, 1060, -15, 221, 0, 135;',
    'PP    1060, 1060, -15, 221, 0, 135;', 'PP    1060, 1000, -15, 221, 0, 135;',
    'PP    1000, 1000, -15, 221, 0, 135;'];
  const ctx = laden(KOPF.concat(klein));
  hinweiseMitschneiden(ctx);
  const e = lauf(ctx, AUSWERTEN);
  const pkt = e.neu.flat();
  pruefe(e.neu.length === 4, 'vier Freistiche: ' + e.neu.length);
  pruefe(e.neu.every(p => Math.abs(Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y) - 30) < 1e-9),
    'Schenkel auf halbe Kantenlaenge gekuerzt (30 mm statt 94)');
  pruefe(pkt.every(q => q.x >= 1000 && q.x <= 1060 && q.y >= 1000 && q.y <= 1060),
    'kein Freistich-Punkt ausserhalb der Oeffnung (Gutteil bleibt unberuehrt)');
  const h = lauf(ctx, 'globalThis.__hinweise');
  pruefe(h.some(x => /4 davon mit gekuerzten Schenkeln/.test(x.t) && x.a === 'warnung'),
    'Meldung zaehlt die gekuerzten Schenkel (Warnung): ' + (h.map(x => x.t).pop() || '').slice(0, 90));
}

/* --- d) Granit-Ausklinkung ist kein Freistich --- */
console.log('d) kleine 3-Punkt-Ausfraesung ohne fremde Kontur an der Ecke');
{
  const ausklinkung = ['PAF;', 'PP       0,   73, -15, 211, 0, 135;',
    'PP       4,   73, -15, 221, 0, 135;', 'PP       4,    0, -15, 211, 0, 135;'];
  const ctx = laden(KOPF.concat(ausklinkung));
  const r = lauf(ctx, `(() => { const l = modell.layers[0]; const op = l.ops[0];
    return { form: f2IstFreistichForm(op), freistich: f2IstFreistich(l, op), ecken: f2InneneckenFinden(op, true, l).length }; })()`);
  pruefe(r.form === true && r.freistich === false && r.ecken === 1,
    'Form passt, aber keine fremde Kontur an der Ecke → kein Freistich, Innenecke bleibt: ' + JSON.stringify(r));
}

/* --- e) Menue, Profil --- */
console.log('e) Menue und Profil');
{
  const html = fs.readFileSync(path.join(__dirname, '..', 'wup_editor', 'wup_editor.html'), 'utf8');
  const menue = html.slice(html.indexOf('id="automatikMenue"'), html.indexOf('id="btnWerteErsetzen"'));
  const eintraege = [...menue.matchAll(/class="menue-eintrag" id="(\w+)"/g)].map(m => m[1]);
  pruefe(eintraege[5] === 'btnAutoFreistich' && eintraege[6] === 'btnPsfEinstell',
    'Menue: Freistiche an Position 6, Einstellungen an 7: ' + eintraege.join(','));
  pruefe(/getElementById\('btnAutoFreistich'\)\.addEventListener\('click', f2SammelAktion\)/.test(html),
    'Eintrag ist mit f2SammelAktion verdrahtet');
  pruefe(/'btnEckenPml', 'btnAutoFreistich'/.test(html), 'Eintrag wird nach dem Laden freigeschaltet');
  const ctx = editorKontext();
  const p = lauf(ctx, 'JSON.stringify(PROFIL_STANDARD.freistich)');
  const f = JSON.parse(p);
  pruefe(f.klassisch_steuercode === 222 && f.klassisch_steuercode_enden === 212 && f.variante === 'klassisch',
    'Profil-Standard: klassisch, Ecke 222, Enden 212: ' + p);
  /* altes gespeichertes Profil ohne Enden-Code bekommt ihn beim Laden */
  const ctx2 = editorKontext();
  const alt = lauf(ctx2, `speicherSichern('profil', { freistich: { variante: 'klassisch', klassisch_steuercode: 222 } });
    profil = Object.assign({}, PROFIL_STANDARD, speicherLaden('profil', {}));
    profil.freistich = Object.assign({}, PROFIL_STANDARD.freistich, profil.freistich || {});
    profil.freistich.klassisch_steuercode_enden`);
  pruefe(alt === 212, 'gespeichertes Alt-Profil wird um den Enden-Code ergaenzt: ' + alt);
}

if (fehler) { console.error('\nFreistich-vorhanden-Smoke: ' + fehler + ' Fehler.'); process.exit(1); }
console.log('\nFreistich-vorhanden-Smoke: alle Pruefungen OK');
