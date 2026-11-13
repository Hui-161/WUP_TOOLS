#!/usr/bin/env node
/*
  Smoke-Test AP2: opsImBereich() (Rechtsklick-Ziehen-Mehrfachauswahl,
  Linie/Kasten) — headless, ohne Drag/DOM — anhand der Geometrie der
  synthetischen Innenwand SEMA/IW02.WUP:
   a) Linie quer durch die Tuer-PSG (offene 4-Punkt-Kontur, x 2240..3340,
      y bis 2130) trifft genau diese Bearbeitung. Die Linie reicht je 20 mm
      ueber die Tuer hinaus — die Klammerreihen der Wechselstiele liegen
      35 mm neben der Tuerkante und bleiben damit ausserhalb.
   b) Linie weit ausserhalb jeder Geometrie trifft nichts.
   c) Kasten um die beiden PSF-Bereiche der Balkentaschen (x 820..990 und
      4410..4580, y 2700..2860) waehlt die 2 PSF (daneben auch die
      durchlaufende PSG-Linie bei y=2860 —
      opsImBereich meldet "schneidet ODER liegt darin", nicht nur "liegt
      vollstaendig darin"; siehe Punkt d).
   d) ui.opFilter.PSG=false schliesst PSG aus demselben Kasten aus (danach
      wird der Filter wieder zurueckgesetzt, damit kein Testzustand
      weiterlebt).
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
`, ctx);

console.log('a) Linie quer durch die Tuer-PSG (x 2240..3340, y bis 2130) trifft sie');
const a = vm.runInContext(`
  opsImBereich('linie', [2220, 1000], [3360, 1000])
    .map(t => ({ kw: t.op.kw, pts: (t.op.poly || []).map(p => [p.x, p.y]) }))
`, ctx);
pruefe(a.length === 1, 'genau 1 Treffer, ist: ' + a.length);
pruefe(a[0] && a[0].kw === 'PSG', 'Treffer ist eine PSG-Bearbeitung');
pruefe(a[0] && a[0].pts.some(p => p[0] === 2240) && a[0].pts.some(p => p[0] === 3340),
  'Treffer ist die Tuer-Kontur (x 2240/3340)');

console.log('b) Linie weit ausserhalb jeder Geometrie trifft nichts');
const b = vm.runInContext(`opsImBereich('linie', [50000, 50000], [51000, 51000])`, ctx);
pruefe(b.length === 0, 'keine Treffer, ist: ' + b.length);

console.log('c) Kasten um die PSF-Bereiche (x 800..4600, y 2680..2880) waehlt die 2 PSF');
const c = vm.runInContext(`
  opsImBereich('kasten', [800, 2680], [4600, 2880]).map(t => t.op.kw)
`, ctx);
const cPsf = c.filter(kw => kw === 'PSF');
pruefe(cPsf.length === 2, '2 PSF getroffen, ist: ' + cPsf.length + ' (alle Treffer: ' + c.join(',') + ')');
pruefe(c.includes('PSG'), 'die durchlaufende PSG-Linie am oberen Rand ist ebenfalls getroffen');

console.log('d) ui.opFilter.PSG=false schliesst PSG aus demselben Kasten aus');
const d = vm.runInContext(`
  (() => {
    ui.opFilter.PSG = false;
    const treffer = opsImBereich('kasten', [800, 2680], [4600, 2880]).map(t => t.op.kw);
    ui.opFilter.PSG = true; /* Zustand zuruecksetzen */
    return treffer;
  })()
`, ctx);
pruefe(!d.includes('PSG'), 'PSG nicht mehr in den Treffern, ist: ' + d.join(','));
pruefe(d.filter(kw => kw === 'PSF').length === 2, 'weiterhin 2 PSF getroffen, ist: ' + d.filter(kw => kw === 'PSF').length);
/* Kontrolle: Filter wurde tatsaechlich zurueckgesetzt (kein Seiteneffekt fuer andere Tests) */
const nachher = vm.runInContext(`ui.opFilter.PSG`, ctx);
pruefe(nachher === true, 'ui.opFilter.PSG nach dem Test wieder true');

console.log('\nRechtsauswahl-Smoke: ' + (fehler ? fehler + ' FEHLER' : 'alle Pruefungen OK'));
process.exit(fehler ? 1 : 0);
