#!/usr/bin/env node
/*
  Sammel-Runner: fuehrt alle Tests unter Wup/Tests/ nacheinander aus
  (roundtrip + *_smoke.js; harness.js und dieses Skript ausgenommen).

  Aufruf:  node Wup/Tests/alle.js
  Exit-Code 0 nur, wenn ALLE Tests gruen sind — geeignet fuer CI/Hooks.
*/
'use strict';
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const eigene = new Set(['harness.js', 'alle.js']);
const dateien = fs.readdirSync(__dirname)
  .filter(f => f.endsWith('.js') && !eigene.has(f))
  .sort();

let fehler = 0;
for (const f of dateien) {
  const pfad = path.join(__dirname, f);
  try {
    const aus = execFileSync(process.execPath, [pfad], { encoding: 'utf8', timeout: 120000 });
    const letzte = aus.trim().split('\n').pop();
    console.log('OK      ' + f + '  —  ' + letzte);
  } catch (e) {
    fehler++;
    const aus = ((e.stdout || '') + (e.stderr || '')).trim().split('\n').slice(-4).join('\n          ');
    console.error('FEHLER  ' + f + '\n          ' + aus);
  }
}
console.log('\nGesamt: ' + dateien.length + ' Tests, ' + fehler + ' Fehler');
process.exit(fehler ? 1 : 0);
