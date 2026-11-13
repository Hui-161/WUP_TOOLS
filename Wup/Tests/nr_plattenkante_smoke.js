#!/usr/bin/env node
/*
  Smoke-Test v2.64 — P-25 NR_AUF_PLATTENKANTE (Anwender: "Nagelreihe direkt
  auf Plattenkante" — "Warnung, nur genau auf der Kante").
  Positiv: Aussenkante, Stoss zweier Platten, Nagelpunkt auf der Kante,
  Kante eines PP-Umrisses, Teilueberdeckung. Negativ: 1 mm daneben, Kante
  nur gekreuzt, in der Flucht aber neben der Kante, nur Endpunkt beruehrt.
  Dazu: Stufe Warnung, Export unveraendert.
*/
'use strict';
const { editorKontext, wupLaden, vm } = require('./harness');

let fehler = 0;
function pruefe(b, t) { if (b) console.log('  OK      ' + t); else { console.error('  FEHLER  ' + t); fehler++; } }

/* frei erfundene Wand: zwei Platten 1250 x 2500 nebeneinander (Stoss bei x=1250) */
const KOPF = ['VERSION 3.5;', 'ANR TEST;', 'ELB WAND;', 'ELN T1;', 'ZNR 1;', 'ELA INNEN;',
  'ELM  2500, 2500,  160, 1;',
  'PLI1  1250, 2500,   15,    0,    0,    30, OSB,  160;',
  'PLI1  1250, 2500,   15, 1250,    0,    30, OSB,  160;'];
function befunde(nrZeilen) {
  const ctx = editorKontext();
  const text = KOPF.concat(nrZeilen, ['']).join('\r\n');
  wupLaden(ctx, text, 'T1.wup');
  return vm.runInContext(`(() => {
    pruefungenAusfuehren();
    const p = modell.pruefungen.filter(x => x.code === 'P-25');
    const erg = exportBytesErzeugen();
    return { anzahl: p.length, stufen: p.map(x => x.level), texte: p.map(x => x.msg),
             exportGleich: new TextDecoder('windows-1252').decode(erg.bytes) === __text };
  })()`, ctx);
}
const nr = (xa, ya, xe, ye) => 'NR  ' + [xa, ya, xe, ye, 100, 10].join(', ') + ' ;';

console.log('A) Befund');
let b = befunde([nr(0, 100, 0, 2400)]);
pruefe(b.anzahl === 1 && b.stufen[0] === 'warnung', 'NR auf der Aussenkante x=0 -> eine Warnung');
pruefe(/NR_AUF_PLATTENKANTE/.test(b.texte[0] || '') && /Kante der Platte/.test(b.texte[0] || ''), 'Meldung nennt Regel und Platte: ' + (b.texte[0] || ''));
pruefe(b.exportGleich, 'Export bleibt byte-gleich (reine Meldung)');
b = befunde([nr(1250, 100, 1250, 2400)]);
pruefe(b.anzahl === 1 && /Stoss von 2 Platten/.test(b.texte[0] || ''), 'NR auf dem Plattenstoss x=1250 -> Warnung nennt den Stoss');
b = befunde([nr(600, 2500, 600, 2500)]);
pruefe(b.anzahl === 1, 'Nagelpunkt auf der Oberkante y=2500 -> Warnung');
b = befunde([nr(100, 0, 3000, 0)]);
pruefe(b.anzahl === 1, 'NR laeuft ueber die Kante hinaus (Teilueberdeckung) -> Warnung');
b = befunde([nr(2400, 2500, 100, 2500)]);
pruefe(b.anzahl === 1, 'Richtung der NR ist egal -> Warnung');

console.log('B) kein Befund');
b = befunde([nr(1, 100, 1, 2400)]);
pruefe(b.anzahl === 0, '1 mm neben der Kante -> kein Befund (kein Mindest-Randabstand)');
b = befunde([nr(1000, 1200, 1500, 1200)]);
pruefe(b.anzahl === 0, 'NR kreuzt den Stoss quer -> kein Befund');
b = befunde([nr(0, 2600, 0, 3000)]);
pruefe(b.anzahl === 0, 'in der Flucht der Kante, aber ausserhalb -> kein Befund');
b = befunde([nr(0, 2500, 0, 3000)]);
pruefe(b.anzahl === 0, 'beruehrt die Kante nur mit dem Endpunkt -> kein Befund');
b = befunde([nr(600, 1200, 600, 1200)]);
pruefe(b.anzahl === 0, 'Nagelpunkt mitten in der Platte -> kein Befund');
b = befunde([nr(100, 100, 1100, 2400)]);
pruefe(b.anzahl === 0, 'schraege NR durch die Platte -> kein Befund');

console.log('C) Umriss aus Punkten');
const erg = (() => {
  const ctx = editorKontext();
  return vm.runInContext(`(() => {
    const lage = { plates: [{ id: 'PLI1#1', name: 'X', lx: 0, by: 0, x: 0, y: 0,
      outline: [[0,0],[1000,0],[1000,500],[500,1000],[0,1000],[0,0]] }] };
    const op = (xa, ya, xe, ye) => ({ nr: { xa, ya, xe, ye } });
    return {
      schraeg: nrAufPlattenkante(op(900, 600, 600, 900), lage).length,
      schraegDaneben: nrAufPlattenkante(op(900, 601, 600, 901), lage).length,
      gerade: nrAufPlattenkante(op(1000, 100, 1000, 400), lage).length,
      ohneMasse: nrAufPlattenkante(op(0, 0, 0, 100), { plates: [{ id: 'P', lx: 0, by: 0, x: 0, y: 0, outline: [] }] }).length
    };
  })()`, ctx);
})();
pruefe(erg.schraeg === 1, 'NR auf einer schraegen Umrisskante -> Befund');
pruefe(erg.schraegDaneben === 0, 'parallel 1 mm daneben -> kein Befund');
pruefe(erg.gerade === 1, 'NR auf gerader Umrisskante -> Befund');
pruefe(erg.ohneMasse === 0, 'Platte ohne Masse und ohne Umriss -> kein Befund, kein Absturz');

console.log('\nNR-Plattenkante-Smoke: ' + (fehler ? fehler + ' Fehler.' : 'alle Pruefungen OK'));
process.exit(fehler ? 1 : 0);
