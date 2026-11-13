#!/usr/bin/env node
/*
  Smoke-Test fuer Feedback-Punkte 11+12 (Auto-Kontur):
  - kollineareSegmenteZusammenfassen(): reine Geometrie-Funktion, PSG-Geraden-
    stuecke auf gleicher Achse mit kleiner Luecke (< Grenzwert) zu EINER Strecke
    zusammenfassen, groessere Luecken NIE ueberbruecken.
  - autoKonturVerbinden(): Orchestrierung ueber das Modell — PSG-Zusammenfassung
    + PAF/PSF-Endpunkt-Verkettung offener Konturen, Export bleibt konsistent.
*/
'use strict';
const { editorKontext, wupLaden, vm } = require('./harness');

let fehler = 0;
function pruefe(b, t) { if (b) console.log('  OK      ' + t); else { console.error('  FEHLER  ' + t); fehler++; } }

/* --- a) kollineareSegmenteZusammenfassen direkt (reine Funktion, kein Modell noetig) --- */
console.log('a) kollineareSegmenteZusammenfassen: kollineare PSG-Segmente auf y=100');
{
  const ctx = editorKontext();
  const ergebnis = vm.runInContext(`
    (() => {
      const segmente = [
        { a: [0, 100],    b: [500, 100],  op: 's1' },   /* Basis */
        { a: [600, 100],  b: [1000, 100], op: 's2' },   /* Luecke 100 < 150 -> mit s1 verschmelzen */
        { a: [1300, 100], b: [1500, 100], op: 's3' },   /* Luecke 300 >= 150 -> eigenstaendig */
        { a: [0, 0],      b: [500, 500],  op: 's4' }     /* nicht kollinear -> eigenstaendig */
      ];
      const gruppen = kollineareSegmenteZusammenfassen(segmente, 150);
      return JSON.stringify(gruppen.map(g => ({ a: g.a, b: g.b, verbraucht: g.verbraucht })));
    })()
  `, ctx);
  const gruppen = JSON.parse(ergebnis);
  pruefe(gruppen.length === 3, 'genau 3 Gruppen entstehen (0..1000 verschmolzen, 1300..1500 getrennt, Diagonale eigenstaendig): ' + ergebnis);
  const merge = gruppen.find(g => g.verbraucht.includes('s1'));
  pruefe(!!merge && merge.verbraucht.length === 2 && merge.verbraucht.includes('s2'),
    's1+s2 (Luecke 100mm < 150mm) werden zusammengefasst');
  if (merge) {
    pruefe(Math.min(merge.a[0], merge.b[0]) === 0 && Math.max(merge.a[0], merge.b[0]) === 1000,
      'zusammengefasste Strecke reicht von x=0 bis x=1000: a=' + JSON.stringify(merge.a) + ' b=' + JSON.stringify(merge.b));
  }
  const einzeln = gruppen.find(g => g.verbraucht.length === 1 && g.verbraucht[0] === 's3');
  pruefe(!!einzeln, 's3 (Luecke 300mm >= 150mm) bleibt eigenstaendig, wird NICHT ueberbrueckt');
  const diagonale = gruppen.find(g => g.verbraucht.length === 1 && g.verbraucht[0] === 's4');
  pruefe(!!diagonale, 'nicht-kollineares Segment s4 bleibt eigenstaendig');
}

/* --- b) autoKonturVerbinden auf einem geparsten Mini-WUP mit PSG-Segmenten --- */
console.log('b) autoKonturVerbinden: PSG-Segmente in einer Lage werden im Modell zusammengefasst');
{
  const ctx = editorKontext();
  const wupText = ['VERSION 3.4;', 'ELN test;', 'ELM     3000, 2500, 235, 1;',
    'PLI1    3000, 2500, 15, 0, 0, 30, OSB, 160;',
    'PP      0, 0;', 'PP      3000, 0;', 'PP      3000, 2500;', 'PP      0, 2500;', 'PP      0, 0;',
    'PSG;',
    'PP      0, 100, 15, 311, 0;',
    'PP      500, 100, 15, 311, 0;',
    'PSG;',
    'PP      600, 100, 15, 311, 0;',
    'PP      1000, 100, 15, 311, 0;',
    'PSG;',
    'PP      1300, 100, 15, 311, 0;',
    'PP      1500, 100, 15, 311, 0;',
    ''].join('\r\n');
  wupLaden(ctx, wupText);
  const vorher = vm.runInContext('modell.layers[0].ops.filter(o => o.kw === "PSG").length', ctx);
  pruefe(vorher === 3, 'vor dem Zusammenfassen 3 PSG-Ops geparst: ' + vorher);

  vm.runInContext('autoKonturVerbinden();', ctx);
  const nachher = vm.runInContext('modell.layers[0].ops.filter(o => o.kw === "PSG").length', ctx);
  pruefe(nachher === 2, 'nach autoKonturVerbinden() nur noch 2 PSG-Ops (0..500 + 600..1000 verschmolzen, 1300..1500 bleibt getrennt): ' + nachher);

  const merged = vm.runInContext(`
    (() => {
      const ops = modell.layers[0].ops.filter(o => o.kw === 'PSG');
      const treffer = ops.find(o => {
        const p = o.poly.filter(e => e.type === 'PP' || e.type === 'KB');
        if (p.length !== 2) return false;
        const xs = [p[0].x, p[1].x];
        return Math.min(...xs) === 0 && Math.max(...xs) === 1000;
      });
      return treffer ? { gefunden: true, y0: treffer.poly[0].y, y1: treffer.poly[1].y } : { gefunden: false };
    })()
  `, ctx);
  pruefe(merged.gefunden, 'zusammengefasste PSG reicht von x=0 bis x=1000');
  if (merged.gefunden) pruefe(merged.y0 === 100 && merged.y1 === 100, 'y-Koordinate der zusammengefassten PSG bleibt 100: ' + JSON.stringify(merged));

  const exportOk = vm.runInContext(`
    (() => { try { exportZeilenErzeugen(); return true; } catch (e) { return e.message; } })()
  `, ctx);
  pruefe(exportOk === true, 'exportZeilenErzeugen() wirft nach dem Zusammenfassen keine Exception: ' + exportOk);
}

/* --- c) PAF-Endpunkt-Verkettung: zwei offene PAF, deren Enden sich beruehren --- */
console.log('c) autoKonturVerbinden: zwei offene PAF mit gemeinsamem Endpunkt werden verkettet');
{
  const ctx = editorKontext();
  const wupText = ['VERSION 3.4;', 'ELN test;', 'ELM     3000, 2500, 235, 1;',
    'PLI1    3000, 2500, 15, 0, 0, 30, OSB, 160;',
    'PP      0, 0;', 'PP      3000, 0;', 'PP      3000, 2500;', 'PP      0, 2500;', 'PP      0, 0;',
    'PAF;',
    'PP      100, 100, 15, 311, 0;',
    'PP      100, 500, 15, 311, 0;',
    'PAF;',
    'PP      100, 500, 15, 311, 0;',
    'PP      500, 500, 15, 311, 0;',
    ''].join('\r\n');
  wupLaden(ctx, wupText);
  const vorher = vm.runInContext('modell.layers[0].ops.filter(o => o.kw === "PAF").length', ctx);
  pruefe(vorher === 2, 'vor dem Verbinden 2 offene PAF-Ops geparst: ' + vorher);

  vm.runInContext('autoKonturVerbinden();', ctx);
  const nachher = vm.runInContext('modell.layers[0].ops.filter(o => o.kw === "PAF").length', ctx);
  pruefe(nachher === 1, 'nach autoKonturVerbinden() nur noch 1 PAF-Op (Op-Anzahl sinkt um 1): ' + nachher);

  const kette = vm.runInContext(`
    (() => {
      const op = modell.layers[0].ops.find(o => o.kw === 'PAF');
      return { closed: op.closed, punkte: op.poly.filter(e => e.type === 'PP').map(p => [p.x, p.y]) };
    })()
  `, ctx);
  pruefe(kette.punkte.length === 3, 'verkettete PAF hat 3 Punkte (100,100)-(100,500)-(500,500): ' + JSON.stringify(kette.punkte));
  pruefe(kette.closed === false, 'verkettete PAF bleibt offen');

  const exportOk = vm.runInContext(`
    (() => { try { exportZeilenErzeugen(); return true; } catch (e) { return e.message; } })()
  `, ctx);
  pruefe(exportOk === true, 'exportZeilenErzeugen() wirft nach dem Verketten keine Exception: ' + exportOk);
}

/* --- d) Nichts zu tun -> Hinweis, keine Aenderung --- */
console.log('d) autoKonturVerbinden auf unverbindbarem Modell: kein Absturz, Hinweis "Nichts zu verbinden"');
{
  const ctx = editorKontext();
  const wupText = ['VERSION 3.4;', 'ELN test;', 'ELM     3000, 2500, 235, 1;',
    'PLI1    3000, 2500, 15, 0, 0, 30, OSB, 160;',
    'PP      0, 0;', 'PP      3000, 0;', 'PP      3000, 2500;', 'PP      0, 2500;', 'PP      0, 0;',
    ''].join('\r\n');
  wupLaden(ctx, wupText);
  let absturz = null;
  try { vm.runInContext('autoKonturVerbinden();', ctx); } catch (e) { absturz = e.message; }
  pruefe(absturz === null, 'autoKonturVerbinden() auf leerem Modell (keine Ops) stuerzt nicht ab: ' + absturz);
}

if (fehler) {
  console.error('\nAuto-Kontur-Smoke: ' + fehler + ' Fehler.');
  process.exit(1);
} else {
  console.log('\nAuto-Kontur-Smoke: alle Pruefungen OK');
}
