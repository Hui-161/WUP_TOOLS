#!/usr/bin/env node
/*
  Smoke-Test: Feature-Fang beim Messen im Schnittprofil (Feedback-Punkt 7).
  Prueft profilSnapLaengsSammeln (Nagelreihen/Kanten-Kreuzungen entlang der
  Schnittlinie) und profilSnapPunkt (faengt die Maus-Laengskoordinate auf ein
  Feature-Ziel).

  Datei: synthetische Aussenwand mit Fenster (Granit-Stil, syn0003.wup).
  Der Sturzriegel liegt bei x 1890..3110 / y 2240..2340; seine Klammerreihe
  laeuft in allen drei genagelten Lagen bei y=2290 von x=1915 bis x=3085.
  Der linke Wechselstiel hat seine Reihe bei x=1850, ab y=40.
*/
'use strict';
const fs = require('fs');
const path = require('path');
const { editorKontext, synthetischeDatei, vm } = require('./harness');

let fehler = 0;
function pruefe(b, t) { if (b) console.log('  OK      ' + t); else { console.error('  FEHLER  ' + t); fehler++; } }

const ctx = editorKontext();
const datei = synthetischeDatei('Granit', 'syn0003.wup');
const puffer = fs.readFileSync(datei);
ctx.__buffer = puffer.buffer.slice(puffer.byteOffset, puffer.byteOffset + puffer.byteLength);
vm.runInContext(`
  const dek = dateiDekodieren(__buffer);
  modell = wupParsen(dek.text, 'syn0003.wup', dek.encoding, dek.hatteBom);
`, ctx);

console.log('A) profilSnapLaengsSammeln liefert Feature-Ziele auf einer Schnittlinie');
const a = vm.runInContext(`
  (() => {
    /* horizontaler Schnitt (achse 'y') bei y=2290 — dort liegen die
       Klammerreihen des Sturzriegels und mehrere Plattenkanten. */
    ui.schnitt = { aktiv: 'h', pos: 2290 };
    const liste = profilSnapLaengsSammeln('y', 2290);
    return { anzahl: liste.length, min: Math.min(...liste), max: Math.max(...liste),
             hatAnfang: liste.includes(1915), hatEnde: liste.includes(3085) };
  })()
`, ctx);
pruefe(a.anzahl > 0, 'Feature-Ziele gefunden: ' + a.anzahl);
pruefe(isFinite(a.min) && isFinite(a.max), 'Laengs-Werte endlich (min ' + Math.round(a.min) + ', max ' + Math.round(a.max) + ')');
pruefe(a.hatAnfang && a.hatEnde, 'Anfang (x=1915) und Ende (x=3085) der Sturz-Klammerreihe sind Fang-Ziele');

console.log('B) profilSnapPunkt faengt eine Maus-Laengskoordinate auf ein Feature');
const b = vm.runInContext(`
  (() => {
    ui.schnitt = { aktiv: 'h', pos: 2290 };
    ui.scale = 1;  /* 1 px/mm -> Fangradius = SNAP_FANGRADIUS_PX mm */
    const ziele = profilSnapLaengsSammeln('y', 2290).sort((x,y)=>x-y);
    const ziel = ziele[0];
    /* Maus knapp neben dem ersten Ziel (innerhalb Fangradius) */
    const nah = profilSnapPunkt([ziel + 3, 2290]);
    /* Maus weit weg von allen Zielen */
    const weit = profilSnapPunkt([ziel - 99999, 2290]);
    return {
      ziel,
      nahGefangen: nah.gefangen, nahX: nah.punkt[0], nahY: nah.punkt[1],
      weitGefangen: weit.gefangen
    };
  })()
`, ctx);
pruefe(b.nahGefangen === true && Math.abs(b.nahX - b.ziel) < 0.001,
  'Maus nahe Ziel rastet exakt auf Feature (x=' + Math.round(b.nahX) + ')');
pruefe(b.nahY === 2290, 'gefangener Punkt liegt auf der Schnittlinie (y=2290)');
pruefe(b.weitGefangen === false, 'Maus weit weg -> kein Fang (freie Position)');

console.log('C) vertikaler Schnitt (achse x): Laengs = y');
const c = vm.runInContext(`
  (() => {
    ui.schnitt = { aktiv: 'v', pos: 1850 };
    ui.scale = 1;
    const liste = profilSnapLaengsSammeln('x', 1850);
    if (!liste.length) return { leer: true };
    const hatReihenAnfang = liste.includes(40);
    const ziel = liste.sort((x,y)=>x-y)[0];
    const nah = profilSnapPunkt([1850, ziel + 3]);
    return { anzahl: liste.length, gefangen: nah.gefangen, px: nah.punkt[0], py: nah.punkt[1], ziel, hatReihenAnfang };
  })()
`, ctx);
pruefe(!c.leer && c.anzahl > 0, 'vertikaler Schnitt: Feature-Ziele gefunden (' + c.anzahl + ')');
pruefe(c.hatReihenAnfang, 'Anfang der Klammerreihe am Wechselstiel (y=40) ist Fang-Ziel');
pruefe(c.gefangen && c.px === 1850 && Math.abs(c.py - c.ziel) < 0.001,
  'gefangener Punkt liegt auf der Schnittlinie (x=1850), y auf Feature');

console.log('\nSchnitt-Fang-Smoke: ' + (fehler ? fehler + ' FEHLER' : 'alle Pruefungen OK'));
process.exit(fehler ? 1 : 0);
