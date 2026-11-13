#!/usr/bin/env node
/*
  Smoke-Test v2.65 — Rueckweg Editor -> Uebersicht mit Nachlauf und weitere
  Uebergabe in ein laufendes Fenster (erneut:true).
    A) Eine Aenderung innerhalb der 2-s-Drosselung kommt nach Ablauf an.
    B) erneut:true: zweite Datei wird geladen, der letzte Stand der ersten
       geht vorher zurueck.
    C) Ohne erneut bleibt es bei der Einmal-Uebergabe.
*/
'use strict';
const { vm } = require('./harness');
let fehler = 0;
function pruefe(b, t) { if (b) console.log('  OK      ' + t); else { console.error('  FEHLER  ' + t); fehler++; } }
const warten = ms => new Promise(r => setTimeout(r, ms));
const WAND = n => ['VERSION 3.5;', 'ANR TEST;', 'ELB WAND;', 'ELN ' + n + ';', 'ZNR 1;', 'ELA INNEN;',
  'ELM  2500, 2500,  160, 1;', 'PLI1  1250, 2500,   15,    0,    0,    30, OSB,  160;',
  'NR    100,    100,    100,   2400, 100, 10 ;', ''].join('\r\n');

(async () => {
  /* Kontext von Hand: den message-Lauscher des Editors einsammeln, bevor
     sein Script laeuft (das Harness ersetzt addEventListener durch No-ops). */
  const { kontextErzeugen, editorScriptLaden } = require('./harness');
  const ctx = kontextErzeugen();
  ctx.__lauscher = [];
  ctx.addEventListener = (typ, fn) => { if (typ === 'message') ctx.__lauscher.push(fn); };
  vm.runInContext(editorScriptLaden(), ctx, { filename: 'wup_editor.html#script' });
  vm.runInContext('profil.nr_indizes = JSON.parse(JSON.stringify(NR_INDIZES_BEISPIEL));', ctx);
  const senden = d => ctx.__lauscher.forEach(fn => fn({ data: d }));
  const zurueck = () => { const r = vm.runInContext("localStorage.getItem('wup_editor_v1_uebergabeZurueck')", ctx); return r ? JSON.parse(r) : null; };

  console.log('A) Nachlauf');
  senden({ typ: 'wup-uebergabe', name: 'A.wup', text: WAND('A') });
  pruefe(vm.runInContext('modell && modell.dateiName', ctx) === 'A.wup', 'erste Uebergabe geladen');
  vm.runInContext('uebergabeZurueckSchreiben()', ctx);     /* Sperrzeit beginnt jetzt */
  vm.runInContext(`modell.layers[0].ops[0].nr.a = 150; modell.layers[0].ops[0]._modified = true; alleNeuRendern();`, ctx);
  const sofort = zurueck();
  pruefe(sofort && !/, 150,/.test(sofort.text), 'innerhalb der 2 s noch nicht geschrieben (Drosselung bleibt)');
  await warten(2200);
  const spaeter = zurueck();
  pruefe(spaeter && spaeter.name === 'A.wup' && /150/.test(spaeter.text.split('\r\n').find(z => /^NR/.test(z)) || ''), 'nach Ablauf kommt die letzte Aenderung an (Nachlauf)');

  console.log('B) erneut:true');
  vm.runInContext(`modell.layers[0].ops[0].nr.a = 175; modell.layers[0].ops[0]._modified = true; alleNeuRendern();`, ctx);
  senden({ typ: 'wup-uebergabe', name: 'B.wup', text: WAND('B'), erneut: true });
  const vorB = zurueck();
  pruefe(vorB && vorB.name === 'A.wup' && /175/.test(vorB.text.split('\r\n').find(z => /^NR/.test(z)) || ''), 'letzter Stand von A ging vor dem Wechsel zurueck');
  pruefe(vm.runInContext('modell.dateiName', ctx) === 'B.wup' && vm.runInContext('uebergabeAktivName', ctx) === 'B.wup', 'B ist geladen und aktiv');

  console.log('C) ohne erneut');
  senden({ typ: 'wup-uebergabe', name: 'C.wup', text: WAND('C') });
  pruefe(vm.runInContext('modell.dateiName', ctx) === 'B.wup', 'ohne erneut keine zweite Uebergabe (Einmal-Uebergabe wie bisher)');

  console.log('\nUebergabe-Rueckweg-Smoke: ' + (fehler ? fehler + ' Fehler.' : 'alle Pruefungen OK'));
  process.exit(fehler ? 1 : 0);
})();
