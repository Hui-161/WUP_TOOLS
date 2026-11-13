#!/usr/bin/env node
/*
  Smoke-Test Punkt 7: Auto-PSF / P-03 triggern jetzt auch, wenn ein Schnitt die
  NR-LINIE kreuzt, selbst wenn KEIN nominaler Nagelpunkt exakt im Schnittstreifen
  liegt (Nagel koennte irgendwo auf der Reihe sitzen). Prueft die Geometrie-Helfer
  und die Kernlogik nrRegionUngeschuetzt/f3NrUnterSchnitt.
*/
'use strict';
const { editorKontext, vm } = require('./harness');

let fehler = 0;
function pruefe(b, t) { if (b) console.log('  OK      ' + t); else { console.error('  FEHLER  ' + t); fehler++; } }

const ctx = editorKontext();

console.log('A) Geo.segmentKreuztPolygon');
const a = vm.runInContext(`
  (() => {
    const rect = [[0,0],[100,0],[100,100],[0,100],[0,0]];
    return {
      quer:   Geo.segmentKreuztPolygon([-50,50],[150,50], rect),  // durchquert -> true
      drin:   Geo.segmentKreuztPolygon([10,10],[20,20], rect),    // ganz innen -> true
      daneben:Geo.segmentKreuztPolygon([-50,-50],[-10,-10], rect),// ausserhalb -> false
      beruehrt:Geo.segmentKreuztPolygon([50,-30],[50,0], rect)    // endet auf Kante -> true
    };
  })()
`, ctx);
pruefe(a.quer === true, 'Strecke quer durch Rechteck -> kreuzt');
pruefe(a.drin === true, 'Strecke ganz innen -> kreuzt');
pruefe(a.daneben === false, 'Strecke ausserhalb -> kreuzt nicht');
pruefe(a.beruehrt === true, 'Strecke endet auf Kante -> kreuzt');

console.log('B) nrRegionUschuetzt: NR-Linie kreuzt Streifen OHNE Nagelpunkt darin');
const b = vm.runInContext(`
  (() => {
    /* Schnittstreifen (Region) als schmales Rechteck um x=500, y 0..1000 */
    const region = { poly: [[490,0],[510,0],[510,1000],[490,1000]] };
    /* NR laeuft horizontal bei y=500 von x=100..900 mit Abstand a=1000 ->
       nominale Nagelpunkte nur bei den Enden (100 und 900), KEINER bei x=500.
       Die NR-LINIE kreuzt den Streifen aber sehr wohl. */
    const nr = { kw:'NR', nr: { xa:100, ya:500, xe:900, ye:500, a:1000, i:11 }, poly:[] };
    const punkte = nagelPunkte(nr).map(p=>[Math.round(p[0]),Math.round(p[1])]);
    const punktImStreifen = punkte.some(p => p[0] >= 490 && p[0] <= 510);
    const ungeschuetzt = nrRegionUngeschuetzt(nr, region, []);
    return { punkte, punktImStreifen, ungeschuetzt };
  })()
`, ctx);
pruefe(b.punktImStreifen === false, 'kein nominaler Nagelpunkt im Streifen (' + JSON.stringify(b.punkte) + ')');
pruefe(b.ungeschuetzt === true, 'trotzdem als ungeschuetzt erkannt (NR-Linie kreuzt) — Kernforderung Punkt 7');

console.log('C) gedeckte Region triggert nicht');
const c = vm.runInContext(`
  (() => {
    const region = { poly: [[490,0],[510,0],[510,1000],[490,1000]] };
    const nr = { kw:'NR', nr: { xa:100, ya:500, xe:900, ye:500, a:1000, i:11 }, poly:[] };
    /* eine PSF, die die ganze Region deckt */
    const psf = [[480,-10],[520,-10],[520,1010],[480,1010]];
    return nrRegionUngeschuetzt(nr, region, [psf]);
  })()
`, ctx);
pruefe(c === false, 'wenn eine PSF die Region deckt -> nicht mehr ungeschuetzt (kein Doppel-PSF)');

console.log('D) f3AutoPsf erzeugt PSF fuer NR-Linien-Kreuzung (Modell)');
const d = vm.runInContext(`
  (() => {
    /* Mini-Wand: eine Lage mit einer NR (grober Abstand -> Punkte nur an Enden)
       und einem PSG-Saegeschnitt quer ueber die NR-Linie, KEIN Nagelpunkt am Schnitt. */
    const text = [
      'VERSION 3.4;','ELN t;','ZNR 1;','ELM 1000,1000,235,1;',
      'PLI1 1000,1000,15,0,0,30,OSB,160;',
      'PP 0,0,15;','PP 1000,0,15;','PP 1000,1000,15;','PP 0,1000,15;','PP 0,0,15;',
      'NR 100,500,900,500,1000,11;',                 /* Nagelpunkte nur bei x=100 und x=900 */
      'PSG;','PP 500,0,15,211,0;','PP 500,1000,15,211,0;',  /* Saegeschnitt quer bei x=500 */
      ''].join('\\r\\n');
    modell = wupParsen(text, 't.wup', 'windows-1252', false);
    const lage = modell.layers[0];
    const psfVor = lage.ops.filter(o=>o.kw==='PSF').length;
    f3AutoPsf();
    const psfNach = lage.ops.filter(o=>o.kw==='PSF').length;
    return { psfVor, psfNach };
  })()
`, ctx);
pruefe(d.psfVor === 0 && d.psfNach >= 1, 'Auto-PSF erzeugt Sperrflaeche fuer den Schnitt ueber die NR-Linie (vor '
  + d.psfVor + ', nach ' + d.psfNach + ')');

console.log('\nPSF-NR-Linie-Smoke: ' + (fehler ? fehler + ' FEHLER' : 'alle Pruefungen OK'));
process.exit(fehler ? 1 : 0);
