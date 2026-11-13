#!/usr/bin/env node
/*
  Smoke-Test: Text-Panel-Sprung fuer NEU erzeugte / bearbeitete Bearbeitungen
  (Feedback: "wenn ich die neu kontur eingefuegt habe, springe ich im
  Quelltext links nicht automatisch zu den zeilen").

  Ursache: neu/geaendert erzeugte Zeilen hatten keine Original-Zeilennummer
  mehr (ersetzt/angehaengt) und dadurch keinen Bezug zur ausloesenden
  Bearbeitung im Text-Panel. Fix: exportZeilenErzeugen() taggt jede erzeugte
  Zeile mit einem "besitzer" ({typ:'op'|'platte', id}); textZuElementScrollen/
  istAusgewaehlt/zeileZuElementSpringen nutzen das als Fallback.
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

console.log('A) neu erzeugte Kontur bekommt einen Besitzer-Eintrag im Text-Panel');
const a = vm.runInContext(`
  (() => {
    const lage = modell.layers[0];
    const op = neueKonturErzeugen('PAF', [[100,100],[500,100],[500,400],[100,400]], lage, true);
    textZustand.dirty = true;
    ui.auswahl = { typ: 'op', id: op.id, lageId: lage.id };
    ui.mehrAuswahl = [];
    textZuElementScrollen();
    const idx = textZustand.info.findIndex(i => i.besitzer && i.besitzer.typ === 'op' && i.besitzer.id === op.id);
    return { opId: op.id, auswahlZeile: textZustand.auswahlZeile, gefundenerIndex: idx };
  })()
`, ctx);
pruefe(a.gefundenerIndex >= 0, 'Text-Panel enthaelt mindestens eine Zeile mit besitzer=op:' + a.opId);
pruefe(a.auswahlZeile === a.gefundenerIndex, 'textZuElementScrollen setzt auswahlZeile auf genau diese Zeile (Sprung funktioniert)');
pruefe(a.auswahlZeile >= 0, 'auswahlZeile ist gesetzt (nicht mehr -1)');

console.log('B) Hervorhebung (istAusgewaehlt-Aequivalent) findet die neuen Zeilen ueber den Besitzer');
const b = vm.runInContext(`
  (() => {
    const lage = modell.layers[0];
    const op = lage.ops.find(o => o.kw === 'PAF' && o._neu);
    const besitzerSchluessel = ausgewaehlteBesitzerSchluessel();
    const treffer = textZustand.info.filter(i => i.besitzer && besitzerSchluessel.has(i.besitzer.typ + ':' + i.besitzer.id));
    return { anzahlTreffer: treffer.length, schluesselHatOp: besitzerSchluessel.has('op:' + op.id) };
  })()
`, ctx);
pruefe(b.schluesselHatOp, 'ausgewaehlteBesitzerSchluessel enthaelt die ausgewaehlte neue Op');
pruefe(b.anzahlTreffer >= 4, 'mehrere Zeilen der neuen Kontur werden als ausgewaehlt erkannt (' + b.anzahlTreffer + ')');

console.log('C) Klick auf eine neue Zeile springt zurueck zur erzeugenden Op (zeileZuElementSpringen)');
const c = vm.runInContext(`
  (() => {
    const lage = modell.layers[0];
    const op = lage.ops.find(o => o.kw === 'PAF' && o._neu);
    const idx = textZustand.info.findIndex(i => i.besitzer && i.besitzer.typ === 'op' && i.besitzer.id === op.id);
    ui.auswahl = null;
    zeileZuElementSpringen(idx);
    return { auswahlOpId: ui.auswahl && ui.auswahl.id, erwartetOpId: op.id };
  })()
`, ctx);
pruefe(c.auswahlOpId === c.erwartetOpId, 'Klick auf neue Zeile waehlt die richtige Op wieder aus');

console.log('D) unveraendertes Original-Verhalten bleibt intakt (bestehende Op, echte Original-Zeile)');
const d = vm.runInContext(`
  (() => {
    /* frisches Modell ohne Aenderungen */
    const dek = dateiDekodieren(__buffer);
    modell = wupParsen(dek.text, 'IW02.WUP', dek.encoding, dek.hatteBom);
    textZustand.dirty = true;
    const lage = modell.layers[0];
    const op = lage.ops.find(o => o.kw === 'PSG');
    ui.auswahl = { typ: 'op', id: op.id, lageId: lage.id };
    ui.mehrAuswahl = [];
    textZuElementScrollen();
    return { auswahlZeile: textZustand.auswahlZeile, quelle: textZustand.info[textZustand.auswahlZeile] && textZustand.info[textZustand.auswahlZeile].quelle };
  })()
`, ctx);
pruefe(d.auswahlZeile >= 0 && d.quelle === 'orig', 'unveraenderte Bestands-Op springt weiterhin ueber origZeile (quelle=' + d.quelle + ')');

console.log('\nText-Sprung-Neu-Smoke: ' + (fehler ? fehler + ' FEHLER' : 'alle Pruefungen OK'));
process.exit(fehler ? 1 : 0);
