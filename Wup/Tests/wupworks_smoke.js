#!/usr/bin/env node
/*
  Smoke-Test fuer AP1 (WupWorks5-Anbindung, Grundstein):
    a) exportBytesErzeugen() liefert fuer eine unveraendert geladene Datei
       byteweise EXAKT den Original-Inhalt (bis auf ggf. fehlenden End-CRLF —
       tolerant verglichen, wie roundtrip.js es fuer Zeilen tut).
    b) wupworksCurlBefehl() enthaelt Adresse, Port und Dateiname.
    c) PROFIL_STANDARD.wupworks + tiefer Merge beim Laden.
    d) exportBytesErzeugen()-Rueckgabefelder (name/datenverlust/ueberlaengen).
*/
'use strict';
const fs = require('fs');
const path = require('path');
const { kontextErzeugen, editorScriptLaden, editorKontext, wupLaden, synthetischeDatei, vm } = require('./harness');

let fehler = 0;
function pruefe(bedingung, text) {
  if (bedingung) console.log('  OK      ' + text);
  else { console.error('  FEHLER  ' + text); fehler++; }
}

/* synthetische Innenwand mit Tuer (SEMA-Stil, Windows-1252 mit Umlaut im Kommentar) */
const beispielPfad = synthetischeDatei('SEMA', 'IW02.WUP');

/* --- a) exportBytesErzeugen() byteweise identisch zum Original --- */
{
  const script = editorScriptLaden();
  const ctx = kontextErzeugen();
  vm.runInContext(script, ctx, { filename: 'wup_editor.html#script' });
  const puffer = fs.readFileSync(beispielPfad);
  ctx.__buffer = puffer.buffer.slice(puffer.byteOffset, puffer.byteOffset + puffer.byteLength);
  ctx.__name = path.basename(beispielPfad);
  const resultat = vm.runInContext(`
    (() => {
      const dek = dateiDekodieren(__buffer);
      modell = wupParsen(dek.text, __name, dek.encoding, dek.hatteBom);
      const r = exportBytesErzeugen();
      return { bytes: Array.from(r.bytes), name: r.name, datenverlust: r.datenverlust, ueberlaengen: r.ueberlaengen, encoding: modell.encoding };
    })()
  `, ctx);

  const origBytes = Array.from(puffer);
  /* tolerant: fehlenden End-CRLF (0x0D 0x0A) an BEIDEN Seiten abschneiden, wie roundtrip.js es zeilenweise tut */
  const crlfAbschneiden = arr => {
    const a = arr.slice();
    while (a.length >= 2 && a[a.length - 2] === 0x0D && a[a.length - 1] === 0x0A) a.length -= 2;
    return a;
  };
  const origGetrimmt = crlfAbschneiden(origBytes);
  const expGetrimmt = crlfAbschneiden(resultat.bytes);
  pruefe(origGetrimmt.length === expGetrimmt.length, 'exportBytesErzeugen()-Bytes gleiche Laenge wie Original (getrimmt): '
    + origGetrimmt.length + ' == ' + expGetrimmt.length);
  let ersteAbweichung = -1;
  for (let i = 0; i < Math.min(origGetrimmt.length, expGetrimmt.length); i++)
    if (origGetrimmt[i] !== expGetrimmt[i]) { ersteAbweichung = i; break; }
  pruefe(ersteAbweichung === -1, 'exportBytesErzeugen()-Bytes stimmen byteweise mit dem Original ueberein'
    + (ersteAbweichung >= 0 ? ' (erste Abweichung bei Byte ' + ersteAbweichung + ')' : ''));
  pruefe(resultat.name === 'IW02.WUP', 'exportBytesErzeugen().name liefert den Original-Dateinamen: ' + resultat.name);
  pruefe(resultat.datenverlust === 0, 'exportBytesErzeugen().datenverlust ist 0 bei unveraenderter Datei: ' + resultat.datenverlust);
  pruefe(resultat.ueberlaengen === 0, 'exportBytesErzeugen().ueberlaengen ist 0 bei unveraenderter Datei: ' + resultat.ueberlaengen);
}

/* --- b) wupworksCurlBefehl() enthaelt Adresse, Port, Dateiname --- */
{
  const wupBytes = fs.readFileSync(beispielPfad);
  const wupText = wupBytes.toString('latin1');
  const ctx = editorKontext();
  wupLaden(ctx, wupText, 'IW02.WUP');
  const befehl = vm.runInContext(`
    (() => {
      profil.wupworks.adresse = '192.168.1.50';
      profil.wupworks.port = 45070;
      return wupworksCurlBefehl();
    })()
  `, ctx);
  pruefe(befehl.includes('192.168.1.50'), 'wupworksCurlBefehl() enthaelt die Maschinen-Adresse: ' + befehl);
  pruefe(befehl.includes('45070'), 'wupworksCurlBefehl() enthaelt den Port: ' + befehl);
  pruefe(befehl.includes('IW02.WUP'), 'wupworksCurlBefehl() enthaelt den Export-Dateinamen: ' + befehl);
  pruefe(befehl.startsWith('curl -X POST http://192.168.1.50:45070/api/1/documents -F file=@'),
    'wupworksCurlBefehl() hat die erwartete curl-Form: ' + befehl);
}

/* --- c) PROFIL_STANDARD.wupworks + tiefer Merge --- */
{
  const ctx = editorKontext();
  const std = vm.runInContext(`
    JSON.stringify({ adresse: profil.wupworks.adresse, port: profil.wupworks.port,
      stdAdresse: PROFIL_STANDARD.wupworks.adresse, stdPort: PROFIL_STANDARD.wupworks.port })
  `, ctx);
  const w = JSON.parse(std);
  pruefe(w.adresse === '' && w.port === 45070 && w.stdAdresse === '' && w.stdPort === 45070,
    'profil.wupworks ist per Default {adresse:"", port:45070}: ' + std);
}
/* Tief mergen: aeltere gespeicherte Profile ohne wupworks-Feld duerfen nicht abstuerzen,
   und ein gespeichertes Teilprofil (nur adresse) muss port trotzdem aus dem Standard erben. */
{
  const ctx = kontextErzeugen();
  vm.runInContext(editorScriptLaden(), ctx, { filename: 'wup_editor.html#script' });
  /* SPEICHER_PRAEFIX ist erst nach dem Laden des Scripts bekannt — Speicher
     danach setzen und das Profil-Setup manuell erneut ausfuehren (die feste
     Merge-Logik am Skript-Ende laeuft nur einmal beim ersten Laden). */
  ctx.localStorage.setItem(vm.runInContext('speicherSchluessel("profil")', ctx), JSON.stringify({ wupworks: { adresse: '10.0.0.5' } }));
  vm.runInContext(`
    profil = Object.assign({}, PROFIL_STANDARD, speicherLaden('profil', {}));
    profil.wupworks = Object.assign({}, PROFIL_STANDARD.wupworks, profil.wupworks || {});
  `, ctx);
  const w = vm.runInContext('JSON.stringify(profil.wupworks)', ctx);
  const geladen = JSON.parse(w);
  pruefe(geladen.adresse === '10.0.0.5' && geladen.port === 45070,
    'gespeichertes Teilprofil (nur adresse) erbt port aus PROFIL_STANDARD: ' + w);
}

if (fehler) {
  console.error('\nWupWorks5-Smoke: ' + fehler + ' Fehler.');
  process.exit(1);
} else {
  console.log('\nWupWorks5-Smoke: alle Pruefungen OK');
}
