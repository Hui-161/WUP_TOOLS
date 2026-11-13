#!/usr/bin/env node
/*
  Smoke-Test v2.62 — Geraetebelegung als Dialog.
  Prueft den DOM-freien Teil: die Zeilenpruefung (ungueltige Zeilen werden
  benannt, nichts wird still verworfen), die Startbedingung und die
  Beispielbelegung. Der Dialog selbst wird im Browser-Test edtg geprueft.
*/
'use strict';
const { editorKontext, vm } = require('./harness');

let fehler = 0;
function pruefe(b, t) { if (b) console.log('  OK      ' + t); else { console.error('  FEHLER  ' + t); fehler++; } }

const ctx = editorKontext();
const e = vm.runInContext(`
  (() => {
    const gut = geraeteZeilenPruefen([
      { index: '7', name: 'Geraet A', offset: '12' },
      { index: '', name: '', offset: '' },
      { index: ' 30 ', name: '  Geraet B ', offset: '7,5' }
    ]);
    const schlecht = geraeteZeilenPruefen([
      { index: '7', name: 'A', offset: '10' },
      { index: '7', name: 'doppelt', offset: '10' },
      { index: 'x', name: 'kein Index', offset: '10' },
      { index: '1.5', name: 'Kommazahl', offset: '10' },
      { index: '8', name: 'ohne Abstand', offset: '' },
      { index: '9', name: 'negativ', offset: '-3' }
    ]);
    const vorher = profil.nr_indizes;
    profil.nr_indizes = {};
    const leerNoetig = geraeteAbfrageNoetig();
    profil.nr_indizes = { 7: { name: 'A', psf_offset: 10 } };
    const vollNoetig = geraeteAbfrageNoetig();
    profil.nr_indizes = vorher;
    return { gut, schlecht, leerNoetig, vollNoetig,
      beispiel: Object.keys(NR_INDIZES_BEISPIEL).length,
      beispielGueltig: Object.keys(NR_INDIZES_BEISPIEL).every(i =>
        /^\\d+$/.test(i) && NR_INDIZES_BEISPIEL[i].psf_offset >= 0 && NR_INDIZES_BEISPIEL[i].name),
      beispielEigenesObjekt: PROFIL_STANDARD.nr_indizes !== NR_INDIZES_BEISPIEL };
  })()
`, ctx);

console.log('A) Zeilenpruefung');
pruefe(JSON.stringify(e.gut.belegung) === JSON.stringify({ 7: { name: 'Geraet A', psf_offset: 12 }, 30: { name: 'Geraet B', psf_offset: 7.5 } }),
  'gueltige Zeilen uebernommen, Leerzeile uebergangen, Komma als Dezimalzeichen: ' + JSON.stringify(e.gut.belegung));
pruefe(e.gut.verworfen.length === 0, 'keine Meldung bei gueltiger Liste');
pruefe(e.schlecht.verworfen.length === 5, 'fuenf ungueltige Zeilen einzeln benannt: ' + e.schlecht.verworfen.length);
pruefe(Object.keys(e.schlecht.belegung).join() === '7', 'nur die erste gueltige Zeile bleibt in der Belegung');
pruefe(/doppelt/.test(e.schlecht.verworfen[0]) && /Zeile 2/.test(e.schlecht.verworfen[0]), 'Meldung nennt Zeile und Grund: ' + e.schlecht.verworfen[0]);

console.log('B) Startbedingung');
pruefe(e.leerNoetig === true, 'leere Belegung -> Abfrage beim Start');
pruefe(e.vollNoetig === false, 'vorhandene Belegung -> keine Abfrage');

console.log('C) Beispielbelegung');
pruefe(e.beispiel > 0 && e.beispielGueltig, 'Beispiel hat Eintraege mit Index, Namen und Abstand: ' + e.beispiel);
pruefe(e.beispielEigenesObjekt, 'Profil-Standard teilt kein Objekt mit dem Beispiel');

console.log('\nGeraetebelegung-Smoke: ' + (fehler ? fehler + ' Fehler.' : 'alle Pruefungen OK'));
process.exit(fehler ? 1 : 0);
