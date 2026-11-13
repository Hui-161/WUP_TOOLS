#!/usr/bin/env node
/*
  Roundtrip-Regressionstest fuer den WUP-Editor (wup_editor.html).

  Prueft fuer jede .wup-Datei der Referenzordner (harness.referenzOrdner():
  die synthetischen Dateien, dazu ein interner Ordner, wenn vorhanden):
  unveraendert einlesen (wupParsen) und re-exportieren
  (exportZeilenErzeugen) muss zeilenidentisch zum Original sein (bis auf
  finalen Zeilenumbruch); zusaetzlich muss exportBytesErzeugen() die Datei
  byte-identisch wiedergeben.

  Vorab: die eingecheckten synthetischen Dateien muessen dem Generator
  entsprechen (erzeugen.js --pruefen), sonst laufen beide auseinander.

  Aufruf:  node Wup/Tests/roundtrip.js
*/
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { kontextErzeugen, editorScriptLaden, referenzOrdner, referenzDateien, SYNTHETISCHER_ORDNER, vm } = require('./harness');

/* Generator und eingecheckte Dateien muessen uebereinstimmen */
function generatorPruefen() {
  try {
    const aus = execFileSync(process.execPath, [path.join(SYNTHETISCHER_ORDNER, 'erzeugen.js'), '--pruefen'], { encoding: 'utf8' });
    console.log('Generator: ' + aus.trim());
    return 0;
  } catch (e) {
    console.error('FEHLER  synthetische Dateien weichen vom Generator ab:\n' + ((e.stdout || '') + (e.stderr || '')).trim());
    return 1;
  }
}

function main() {
  const script = editorScriptLaden();
  const dateien = referenzDateien();
  if (!dateien.length) { console.error('Keine .wup-Dateien gefunden unter ' + referenzOrdner().join(', ')); process.exit(2); }

  let fehler = generatorPruefen(), ok = 0;
  const jeOrdner = {};
  for (const { pfad: datei, name } of dateien) {
    const ordnerName = name.split(path.sep)[0];
    jeOrdner[ordnerName] = (jeOrdner[ordnerName] || 0) + 1;
    /* Frischer Kontext pro Datei — kein Zustand schleppt sich mit */
    const ctx = kontextErzeugen();
    try {
      vm.runInContext(script, ctx, { filename: 'wup_editor.html#script' });
    } catch (e) {
      console.error('FATAL: Editor-Script laeuft nicht im Stub-Kontext: ' + e.message);
      process.exit(2);
    }
    const puffer = fs.readFileSync(datei);
    ctx.__buffer = puffer.buffer.slice(puffer.byteOffset, puffer.byteOffset + puffer.byteLength);
    ctx.__name = path.basename(datei);
    let resultat;
    try {
      resultat = vm.runInContext(`
        (() => {
          const dek = dateiDekodieren(__buffer);
          modell = wupParsen(dek.text, __name, dek.encoding, dek.hatteBom);
          kwZeileUeberlaenge = [];
          const { zeilen } = exportZeilenErzeugen();
          return { exportZeilen: zeilen, rawLines: modell.rawLines, bytes: Array.from(exportBytesErzeugen().bytes) };
        })()
      `, ctx);
    } catch (e) {
      console.error('FEHLER  ' + name + '  —  Exception: ' + e.message);
      fehler++;
      continue;
    }
    /* Vergleich zeilenweise; leere Schlusszeilen des Originals tolerieren */
    const orig = [...resultat.rawLines];
    while (orig.length && orig[orig.length - 1] === '') orig.pop();
    const exp = [...resultat.exportZeilen];
    while (exp.length && exp[exp.length - 1] === '') exp.pop();

    if (orig.length !== exp.length) {
      console.error('FEHLER  ' + name
        + '  —  Zeilenzahl ' + orig.length + ' -> ' + exp.length);
      fehler++;
      continue;
    }
    let diffZeile = -1;
    for (let i = 0; i < orig.length; i++) {
      if (orig[i] !== exp[i]) { diffZeile = i; break; }
    }
    if (diffZeile >= 0) {
      console.error('FEHLER  ' + name + '  —  erste Abweichung Zeile ' + (diffZeile + 1));
      console.error('   orig:   ' + JSON.stringify(orig[diffZeile]));
      console.error('   export: ' + JSON.stringify(exp[diffZeile]));
      fehler++;
      continue;
    }
    /* byteweise: fehlenden/zusaetzlichen Schluss-CRLF auf beiden Seiten abschneiden */
    const ohneEnde = b => { let n = b.length; while (n >= 2 && b[n - 2] === 0x0D && b[n - 1] === 0x0A) n -= 2; return b.subarray(0, n); };
    if (!ohneEnde(puffer).equals(ohneEnde(Buffer.from(resultat.bytes)))) {
      console.error('FEHLER  ' + name + '  —  exportBytesErzeugen() ist nicht byte-identisch');
      fehler++;
      continue;
    }
    ok++;
  }
  console.log('Geprueft: ' + Object.keys(jeOrdner).map(o => jeOrdner[o] + ' in ' + o).join(', '));
  console.log('\nRoundtrip: ' + ok + ' OK, ' + fehler + ' Fehler (von ' + dateien.length + ' Dateien)');
  process.exit(fehler ? 1 : 0);
}

main();
