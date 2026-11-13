#!/usr/bin/env node
/*
  Smoke-Test fuer die klassische Freistich-Variante (F2).

  Prueft an einer synthetischen L-Kontur (Innenecke) in beiden
  Korrektur-Varianten (Werkstueck rechts / links):
    1. Es entsteht ein PAF mit genau 3 PP-Punkten (kein "Stich" in die Ecke).
    2. Die beiden Schenkel liegen ENTLANG der Konturkanten.
    3. Radiuskorrektur + Lauf werden von der Eltern-Kontur GEERBT
       (sonst fraest die Maschine auf der falschen Seite ins Gutteil).
    4. v2.58 — Anwender-Entscheidung E21: Enden ueberschneiden (x1x),
       nur die Ecke unterschneidet (x2x). Vorher 222 an allen drei Punkten.
*/
'use strict';
const { editorKontext, wupLaden, vm } = require('./harness');

let fehler = 0;
function pruefe(bedingung, text) {
  if (bedingung) console.log('  OK      ' + text);
  else { console.error('  FEHLER  ' + text); fehler++; }
}

/* L-Kontur, Innenecke bei (1060, 540).
   CCW-Umlauf + Korrektur 2 (Werkstueck links)  ODER
   CW-Umlauf  + Korrektur 1 (Werkstueck rechts) — gleiche Flaeche. */
function testDatei(punkte, code) {
  const pp = punkte.map(p => `PP      ${p[0]}, ${p[1]}, 15, ${code}, 0;`).join('\r\n');
  return ['VERSION 3.4;', 'ELN test;', 'ELM     3000, 2500, 235, 1;',
    'PLI1    3000, 2500, 15, 0, 0, 30, OSB, 160;',
    'PP      0, 0;', 'PP      3000, 0;', 'PP      3000, 2500;', 'PP      0, 2500;', 'PP      0, 0;',
    'PAF;', pp, ''].join('\r\n');
}

const ccw = [[1000,500],[1100,500],[1100,540],[1060,540],[1060,600],[1000,600],[1000,500]];
const cw = [...ccw].reverse();

function lauf(name, punkte, elternCode, erwarteterCode) {
  console.log(name);
  const ctx = editorKontext();
  wupLaden(ctx, testDatei(punkte, elternCode));
  const erg = vm.runInContext(`
    (() => {
      profil.freistich.variante = 'klassisch';
      const lage = modell.layers[0];
      const op = lage.ops.find(o => o.kw === 'PAF');
      const ecken = f2InneneckenFinden(op, true);
      if (ecken.length !== 1) return { fehler: 'Innenecken gefunden: ' + ecken.length };
      const neu = f2FreistichErzeugen(lage, op, ecken[0]);
      return { ecke: { x: ecken[0].punkt.x, y: ecken[0].punkt.y },
               kw: neu.kw, poly: neu.poly.map(p => ({ type: p.type, x: p.x, y: p.y, i: p.i })) };
    })()
  `, ctx);
  if (erg.fehler) { console.error('  FEHLER  ' + erg.fehler); fehler++; return; }
  pruefe(erg.ecke.x === 1060 && erg.ecke.y === 540, 'Innenecke bei (1060,540) erkannt');
  pruefe(erg.kw === 'PAF' && erg.poly.length === 3 && erg.poly.every(p => p.type === 'PP'),
    'PAF mit 3 PP-Punkten erzeugt (statt Einzelstich)');
  const [a, m, b] = erg.poly;
  pruefe(m.x === 1060 && m.y === 540, 'mittlerer Punkt liegt auf der Ecke');
  /* Schenkel entlang der Kanten: einer auf y=540 (horizontale Kante Richtung
     x=1100), einer auf x=1060 (vertikale Kante Richtung y=600) */
  const aufKante = p => (p.y === 540 && p.x > 1060 && p.x <= 1100 + 94)
                     || (p.x === 1060 && p.y > 540 && p.y <= 600 + 94);
  pruefe(aufKante(a) && aufKante(b) && (a.x === 1060) !== (b.x === 1060),
    'beide Schenkel liegen entlang der Konturkanten: ('
    + a.x + ',' + a.y + ') / (' + b.x + ',' + b.y + ')');
  pruefe(m.i === erwarteterCode.ecke && a.i === erwarteterCode.ende && b.i === erwarteterCode.ende,
    'Steuercodes Ende/Ecke/Ende ' + erwarteterCode.ende + '/' + erwarteterCode.ecke + '/' + erwarteterCode.ende
    + ' (E21, Korrektur/Lauf von Eltern geerbt), ist: ' + erg.poly.map(p => p.i).join('/'));
}

/* Eltern 222: korr 2, lauf 0 → Ecke 222, Enden 212.
   Eltern 1121: korr 1, lauf 1 → Ecke 1122, Enden 1112. */
lauf('Fall 1: CCW-Umlauf, Eltern-Korrektur 2 (Werkstueck links)', ccw, 222, { ecke: 222, ende: 212 });
lauf('Fall 2: CW-Umlauf, Eltern-Korrektur 1 (Werkstueck rechts)', cw, 1121, { ecke: 1122, ende: 1112 });

console.log('\nFreistich-Smoke: ' + (fehler ? fehler + ' FEHLER' : 'alle Pruefungen OK'));
process.exit(fehler ? 1 : 0);
