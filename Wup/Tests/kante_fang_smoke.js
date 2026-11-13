#!/usr/bin/env node
/*
  Smoke-Test Feedback-Punkt 6 (A): Punktfang beim parallelen Verschieben einer
  mittig gegriffenen Kante ("kante-ganz"). Prueft die reine Rechenlogik in
  kantenFangDeltaFinden() — headless, ohne Drag/DOM — anhand einer Kante
  der synthetischen Innenwand SEMA/IW02.WUP (erste Kante der Tuer-Saegekontur):
   1) ein Snap-Kandidat exakt auf der um ein bekanntes Delta verschobenen
      Kantenlinie, nahe der Maus -> das einrastende Delta wird zurueckgegeben.
   2) derselbe Kandidat, aber ausserhalb des Fangradius (Maus weit weg) -> kein Fang.
   3) derselbe Kandidat im Fangradius, aber via 'ausschluss' gefiltert -> kein Fang.
   4) zwei Kandidaten im Fangradius -> es gewinnt der, dessen einrastendes Delta
      dem freien Delta am naechsten liegt (nicht zwingend der raeumlich naechste).
*/
'use strict';
const fs = require('fs');
const path = require('path');
const { editorKontext, synthetischeDatei, vm } = require('./harness');

let fehler = 0;
function pruefe(b, t) { if (b) console.log('  OK      ' + t); else { console.error('  FEHLER  ' + t); fehler++; } }

const ctx = editorKontext();
/* synthetische Innenwand mit Tuer (SEMA-Stil), siehe 03_Beispiel-synthetisch/erzeugen.js */
const datei = synthetischeDatei('SEMA', 'IW02.WUP');
const puffer = fs.readFileSync(datei);
ctx.__buffer = puffer.buffer.slice(puffer.byteOffset, puffer.byteOffset + puffer.byteLength);
vm.runInContext(`
  const dek = dateiDekodieren(__buffer);
  modell = wupParsen(dek.text, 'IW02.WUP', dek.encoding, dek.hatteBom);
  ui.scale = 0.5;   /* Fangradius = SNAP_FANGRADIUS_PX / ui.scale = 24 mm */
`, ctx);

console.log('1) Kandidat exakt auf verschobener Kantenlinie, nahe der Maus -> Delta rastet ein');
const erg1 = vm.runInContext(`
  (() => {
    const lage = modell.layers[0];
    const op = lage.ops.find(o => o.kw === 'PSG' && (o.poly||[]).length === 4);
    const ursprung = kantenUrsprungErfassen([{ lageId: lage.id, besitzer: 'op', id: op.id, segIdx: 0 }]);
    const u0 = ursprung[0];
    const a0 = u0.a0, n0 = u0.n;
    const rl = [-n0[1], n0[0]];  /* Kantenrichtung (Laengsvektor) */
    const mitte = [(a0[0]+u0.b0[0])/2, (a0[1]+u0.b0[1])/2];
    /* Kandidat liegt exakt auf der um 15mm entlang n0 verschobenen Linie */
    const p1 = [mitte[0] + n0[0]*15 + rl[0]*20, mitte[1] + n0[1]*15 + rl[1]*20];
    const treffer = kantenFangDeltaFinden(p1, 12 /* freies Delta */, a0, n0, [p1], null);
    return { delta: treffer && treffer.delta, punkt: treffer && treffer.punkt };
  })()
`, ctx);
pruefe(erg1.delta != null && Math.abs(erg1.delta - 15) < 0.001,
  'einrastendes Delta = 15 (Kante laeuft dann exakt durch den Punkt), ist: ' + erg1.delta);
pruefe(!!erg1.punkt, 'Snap-Punkt wird zurueckgegeben');

console.log('2) derselbe Kandidat, Maus weit entfernt -> kein Fang (ausserhalb Fangradius)');
const erg2 = vm.runInContext(`
  (() => {
    const lage = modell.layers[0];
    const op = lage.ops.find(o => o.kw === 'PSG' && (o.poly||[]).length === 4);
    const ursprung = kantenUrsprungErfassen([{ lageId: lage.id, besitzer: 'op', id: op.id, segIdx: 0 }]);
    const u0 = ursprung[0];
    const a0 = u0.a0, n0 = u0.n;
    const rl = [-n0[1], n0[0]];
    const mitte = [(a0[0]+u0.b0[0])/2, (a0[1]+u0.b0[1])/2];
    const p1 = [mitte[0] + n0[0]*15 + rl[0]*20, mitte[1] + n0[1]*15 + rl[1]*20];
    const mausWeit = [p1[0] + 1000, p1[1] + 1000];
    return kantenFangDeltaFinden(mausWeit, 12, a0, n0, [p1], null);
  })()
`, ctx);
pruefe(erg2 === null, 'kein Fang, wenn die Maus weit vom Kandidaten entfernt ist');

console.log('3) derselbe Kandidat im Fangradius, aber per ausschluss gefiltert -> kein Fang');
const erg3 = vm.runInContext(`
  (() => {
    const lage = modell.layers[0];
    const op = lage.ops.find(o => o.kw === 'PSG' && (o.poly||[]).length === 4);
    const ursprung = kantenUrsprungErfassen([{ lageId: lage.id, besitzer: 'op', id: op.id, segIdx: 0 }]);
    const u0 = ursprung[0];
    const a0 = u0.a0, n0 = u0.n;
    const rl = [-n0[1], n0[0]];
    const mitte = [(a0[0]+u0.b0[0])/2, (a0[1]+u0.b0[1])/2];
    const p1 = [mitte[0] + n0[0]*15 + rl[0]*20, mitte[1] + n0[1]*15 + rl[1]*20];
    return kantenFangDeltaFinden(p1, 12, a0, n0, [p1], [p1]);
  })()
`, ctx);
pruefe(erg3 === null, 'kein Fang, wenn der Kandidat im ausschluss steht');

console.log('4) zwei Kandidaten im Fangradius -> es gewinnt das naeher am freien Delta liegende');
const erg4 = vm.runInContext(`
  (() => {
    const lage = modell.layers[0];
    const op = lage.ops.find(o => o.kw === 'PSG' && (o.poly||[]).length === 4);
    const ursprung = kantenUrsprungErfassen([{ lageId: lage.id, besitzer: 'op', id: op.id, segIdx: 0 }]);
    const u0 = ursprung[0];
    const a0 = u0.a0, n0 = u0.n;
    const rl = [-n0[1], n0[0]];
    const mitte = [(a0[0]+u0.b0[0])/2, (a0[1]+u0.b0[1])/2];
    /* pNah: einrastendes Delta 8 (nahe am freien Delta 10); pFern: Delta 20 */
    const pNah = [mitte[0] + n0[0]*8 + rl[0]*5, mitte[1] + n0[1]*8 + rl[1]*5];
    const pFern = [mitte[0] + n0[0]*20 + rl[0]*5, mitte[1] + n0[1]*20 + rl[1]*5];
    const treffer = kantenFangDeltaFinden(mitte, 10, a0, n0, [pFern, pNah], null);
    return { delta: treffer && treffer.delta };
  })()
`, ctx);
pruefe(erg4.delta != null && Math.abs(erg4.delta - 8) < 0.001,
  'Kandidat mit Delta 8 (naeher an freiem Delta 10) gewinnt gegen Delta 20, ist: ' + erg4.delta);

console.log('\nKante-Fang-Smoke: ' + (fehler ? fehler + ' FEHLER' : 'alle Pruefungen OK'));
process.exit(fehler ? 1 : 0);
