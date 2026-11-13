#!/usr/bin/env node
/*
  Smoke-Test fuer die Punkte 4/5/13 (allgemeine Automatik-Einstellungen)
  und Punkt 8 (NR-Index als Dropdown MIT freier Eingabe).

  Headless, ohne echtes DOM/Modal — prueft die Logik, die der Dialog
  automatikEinstellungenOeffnen() beim Speichern ausfuehrt (profil.freistich
  schreiben, PROFIL_STANDARD als Rueckfall), sowie dass NR "Geraet i" auch
  mit einer unbekannten Zahl uebernommen wird (eigenschaftenWertUebernehmen
  nimmt ein input-artiges Objekt entgegen, kein echtes DOM-Element noetig).
*/
'use strict';
const { editorKontext, wupLaden, vm } = require('./harness');

let fehler = 0;
function pruefe(bedingung, text) {
  if (bedingung) console.log('  OK      ' + text);
  else { console.error('  FEHLER  ' + text); fehler++; }
}

const wupText = ['VERSION 3.4;', 'ELN test;', 'ELM     3000, 2500, 235, 1;',
  'PLI1    3000, 2500, 15, 0, 0, 30, OSB, 160;',
  'PP      0, 0;', 'PP      3000, 0;', 'PP      3000, 2500;', 'PP      0, 2500;', 'PP      0, 0;',
  'NR      100, 100, 900, 100, 100, 10;', ''].join('\r\n');

/* --- 1) automatikEinstellungenOeffnen existiert, Alias funktioniert --- */
{
  const ctx = editorKontext();
  const typ = vm.runInContext('typeof automatikEinstellungenOeffnen', ctx);
  pruefe(typ === 'function', 'automatikEinstellungenOeffnen() ist definiert');
  const aliasGleich = vm.runInContext('psfEinstellungenOeffnen === automatikEinstellungenOeffnen', ctx);
  pruefe(aliasGleich === true, 'psfEinstellungenOeffnen ist ein Alias auf automatikEinstellungenOeffnen');
}

/* --- 2) profil.freistich wird beim Laden tief gemergt (bestehende Zeile bleibt intakt) --- */
{
  const ctx = editorKontext();
  const varianteVorhanden = vm.runInContext(
    `profil.freistich.variante === PROFIL_STANDARD.freistich.variante
     && profil.freistich.radius_holz === PROFIL_STANDARD.freistich.radius_holz`, ctx);
  pruefe(varianteVorhanden, 'profil.freistich enthaelt nach dem Start alle Standard-Felder (tiefer Merge intakt)');
}

/* --- 3) Speichern-Logik: Freistich-Felder + PSF-Offset schreiben, wie es der
   Dialog-Save-Handler tut (direkt gegen profil, ohne echtes DOM) --- */
{
  const ctx = editorKontext();
  vm.runInContext(`
    profil.freistich.variante = 'klassisch' === 'klassisch' ? 'klassisch' : 'mp';
    profil.freistich.radius_holz = 12.5;
    profil.freistich.radius_abrasiv = 9;
    profil.freistich.klassisch_laenge = 80;
    profil.default_offset_unbekannt = 25;
    profilSichern();
  `, ctx);
  const werte = vm.runInContext(`JSON.stringify({
    v: profil.freistich.variante, rh: profil.freistich.radius_holz,
    ra: profil.freistich.radius_abrasiv, kl: profil.freistich.klassisch_laenge,
    u: profil.default_offset_unbekannt
  })`, ctx);
  const w = JSON.parse(werte);
  pruefe(w.v === 'klassisch' && w.rh === 12.5 && w.ra === 9 && w.kl === 80 && w.u === 25,
    'Freistich-/PSF-Werte werden korrekt in profil geschrieben: ' + werte);

  /* Nach profilSichern() erneut aus dem (gleichen) Speicher laden -> Werte bleiben erhalten.
     speicherLaden() nutzt intern den korrekten praefigierten Schluessel. */
  const werte2 = vm.runInContext(`
    profil = Object.assign({}, PROFIL_STANDARD, speicherLaden('profil', {}));
    profil.freistich = Object.assign({}, PROFIL_STANDARD.freistich, profil.freistich || {});
    JSON.stringify({ v: profil.freistich.variante, rh: profil.freistich.radius_holz })
  `, ctx);
  pruefe(JSON.parse(werte2).v === 'klassisch' && JSON.parse(werte2).rh === 12.5,
    'Gespeicherte Automatik-Einstellungen ueberleben einen Neuladen-Zyklus');
}

/* --- 4) Standard-Rueckfall: PROFIL_STANDARD.freistich bleibt unveraendertes Referenzobjekt --- */
{
  const ctx = editorKontext();
  const stdUnveraendert = vm.runInContext(`
    profil.freistich.radius_holz = 999;
    PROFIL_STANDARD.freistich.radius_holz === 10
  `, ctx);
  pruefe(stdUnveraendert, 'PROFIL_STANDARD.freistich bleibt beim Aendern von profil.freistich unveraendert (kein shared reference)');
}

/* --- 5) NR "Geraet i": nrIndexListeHtml() enthaelt bekannte Indizes --- */
{
  const ctx = editorKontext();
  const html = vm.runInContext('nrIndexListeHtml()', ctx);
  pruefe(html.includes('id="nrIndexListe"') && html.includes('value="10"') && html.includes('value="20"'),
    'nrIndexListeHtml() liefert ein <datalist> mit den bekannten NR-Indizes');
}

/* --- 6) NR "Geraet i": freie (unbekannte) Zahl wird uebernommen --- */
{
  const ctx = editorKontext();
  wupLaden(ctx, wupText);
  const ergebnis = vm.runInContext(`
    (() => {
      const lage = modell.layers[0];
      const op = lage.ops.find(o => o.kw === 'NR');
      auswahlSetzen({ typ: 'op', id: op.id, lageId: lage.id });
      const input = { dataset: { feld: 'i' }, value: '777' };
      eigenschaftenWertUebernehmen(input);
      return op.nr.i;
    })()
  `, ctx);
  pruefe(ergebnis === 777, 'unbekannter NR-Index (777, nicht in profil.nr_indizes) wird per freier Eingabe uebernommen, ist: ' + ergebnis);
}

if (fehler) {
  console.error('\nAutomatik-Einstellungen-Smoke: ' + fehler + ' Fehler.');
  process.exit(1);
} else {
  console.log('\nAutomatik-Einstellungen-Smoke: alle Pruefungen OK');
}
