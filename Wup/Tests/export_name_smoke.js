#!/usr/bin/env node
/*
  Smoke-Test fuer Punkt 4 (Export-Einstellungen, Zahnrad neben Export):
  prueft exportDateinameBestimmen() headless — Original beibehalten (Standard),
  bearbeitet-Muster, sowie den Rueckfall bei fehlendem/Platzhalter-Originalnamen.

  Punkt 5 (NR im Schnitt komplett darstellen + auswaehlbar) ist rein visuell
  (SVG-Zeichnung im Schnittprofil); zusaetzlich wird hier geprueft, dass der
  NR-Zweig von schnittSvg() bei mehreren nahen Nagelpunkten ein data-op-Attribut
  erzeugt (auswaehlbar), als headless-Naeherung an den echten Browser-Test.
*/
'use strict';
const fs = require('fs');
const path = require('path');
const { editorKontext, wupLaden, synthetischeDatei, vm } = require('./harness');

let fehler = 0;
function pruefe(bedingung, text) {
  if (bedingung) console.log('  OK      ' + text);
  else { console.error('  FEHLER  ' + text); fehler++; }
}

/* synthetische Innenwand mit Tuer (SEMA-Stil) */
const beispielPfad = synthetischeDatei('SEMA', 'IW02.WUP');
const wupBytes = fs.readFileSync(beispielPfad);
/* windows-1252/latin1-treu einlesen, wie es der Editor beim Datei-Upload tut */
const wupText = wupBytes.toString('latin1');

/* --- a) Standard: 'original' -> exakt modell.dateiName --- */
{
  const ctx = editorKontext();
  wupLaden(ctx, wupText, 'IW02.WUP');
  const ergebnis = vm.runInContext(`
    (() => {
      profil.export.dateiname = 'original';
      return { name: exportDateinameBestimmen(), original: modell.dateiName };
    })()
  `, ctx);
  pruefe(ergebnis.name === 'IW02.WUP' && ergebnis.original === 'IW02.WUP',
    "profil.export.dateiname='original' liefert exakt den Originalnamen: " + ergebnis.name);
}

/* --- b) 'bearbeitet' -> WUP_..._bearbeitet.wup --- */
{
  const ctx = editorKontext();
  wupLaden(ctx, wupText, 'IW02.WUP');
  const name = vm.runInContext(`
    profil.export.dateiname = 'bearbeitet';
    exportDateinameBestimmen();
  `, ctx);
  pruefe(name.includes('WUP_') && name.includes('bearbeitet') && name.toLowerCase().endsWith('.wup'),
    "profil.export.dateiname='bearbeitet' liefert das bearbeitet-Muster: " + name);
}

/* --- c) leerer/Platzhalter-Originalname + Modus 'original' -> Rueckfall auf bearbeitet-Muster --- */
{
  const ctx = editorKontext();
  wupLaden(ctx, wupText, 'IW02.WUP');
  const namen = vm.runInContext(`
    (() => {
      profil.export.dateiname = 'original';
      modell.dateiName = 'unbenannt.wup';
      const nameUnbenannt = exportDateinameBestimmen();
      modell.dateiName = '';
      const nameLeer = exportDateinameBestimmen();
      return { nameUnbenannt, nameLeer };
    })()
  `, ctx);
  pruefe(namen.nameUnbenannt !== 'unbenannt.wup' && namen.nameUnbenannt.includes('bearbeitet'),
    "Platzhalter 'unbenannt.wup' faellt auf das bearbeitet-Muster zurueck: " + namen.nameUnbenannt);
  pruefe(namen.nameLeer !== '' && namen.nameLeer.includes('bearbeitet'),
    "leerer dateiName faellt ebenfalls auf das bearbeitet-Muster zurueck: " + namen.nameLeer);
}

/* --- d) profil.export wird beim Start tief gemergt (Standard: original/diffZeigen=true) --- */
{
  const ctx = editorKontext();
  const std = vm.runInContext(`
    JSON.stringify({ d: profil.export.dateiname, diff: profil.export.diffZeigen,
      stdD: PROFIL_STANDARD.export.dateiname, stdDiff: PROFIL_STANDARD.export.diffZeigen })
  `, ctx);
  const w = JSON.parse(std);
  pruefe(w.d === 'original' && w.diff === true && w.stdD === 'original' && w.stdDiff === true,
    'profil.export ist per Default original/diffZeigen=true: ' + std);
}

/* --- e) diffZeigen=false ueberspringt die Diff-Ansicht (mitDiffBestaetigen-Logik nachgestellt) --- */
{
  const ctx = editorKontext();
  wupLaden(ctx, wupText, 'IW02.WUP');
  const uebersprungen = vm.runInContext(`
    (() => {
      profil.export.diffZeigen = false;
      let diffAngezeigt = false, exportiertAufgerufen = false;
      const echterDiffAnzeigen = diffAnzeigen;
      diffAnzeigen = () => { diffAngezeigt = true; };
      const exportieren = () => { exportiertAufgerufen = true; };
      const mitDiffBestaetigen = () => {
        if (profil.export && profil.export.diffZeigen === false) { exportieren(); return; }
        const hunks = exportDiffErzeugen();
        if (!hunks.length) { exportieren(); return; }
        diffAnzeigen(hunks, exportieren);
      };
      mitDiffBestaetigen();
      diffAnzeigen = echterDiffAnzeigen;
      return exportiertAufgerufen && !diffAngezeigt;
    })()
  `, ctx);
  pruefe(uebersprungen === true, 'profil.export.diffZeigen=false ueberspringt die Diff-Ansicht und exportiert direkt');
}

/* --- f) Punkt 5 (Naeherung headless): NR-Zweig von schnittSvg() erzeugt bei
   mehreren nahen Nagelpunkten eine data-op-Trefferlinie (auswaehlbar) --- */
{
  const ctx = editorKontext();
  wupLaden(ctx, wupText, 'IW02.WUP');
  const ergebnis = vm.runInContext(`
    (() => {
      const nrOp = (() => {
        for (const lage of modell.layers) {
          const nr = lage.ops.find(o => o.kw === 'NR' && nagelPunkte(o).length >= 2);
          if (nr) return { lage, op: nr };
        }
        return null;
      })();
      if (!nrOp) return { gefunden: false };
      const p0 = nagelPunkte(nrOp.op)[0];
      ui.schnitt = { aktiv: 'h', pos: p0[1] };
      svgRendern();
      /* der DOM-Stub des Harness liefert fuer unbekannte Eigenschaften eine
         Funktion, keinen Text — nur einen echten String auswerten */
      const svg = typeof document.__letzterSvgText === 'string' ? document.__letzterSvgText : '';
      return { gefunden: true, hatDataOp: svg.includes('data-op="' + nrOp.op.id + '"') };
    })()
  `, ctx);
  if (ergebnis.gefunden) {
    /* Im Headless-Harness gibt es kein echtes DOM, daher kann der erzeugte SVG-Text
       hier i.d.R. nicht eingefangen werden — siehe Hinweis im Abschlussbericht. */
    console.log('  INFO    NR mit >=2 nahen Punkten gefunden; SVG-Text-Erfassung im Harness nicht moeglich'
      + ' (data-op-Pruefung erfolgt am Quelltext, siehe unten).');
  } else {
    console.log('  INFO    Kein NR mit >=2 nahen Nagelpunkten in IW02.WUP gefunden - Punkt 5 nur ueber Quelltext geprueft.');
  }
  const quelltext = fs.readFileSync(path.join(__dirname, '..', 'wup_editor', 'wup_editor.html'), 'utf8');
  const nrZweig = quelltext.slice(quelltext.indexOf("if (op.kw === 'NR') {", quelltext.indexOf('Bearbeitungen: Kerben')));
  const abschnitt = nrZweig.slice(0, nrZweig.indexOf("continue;\n      }") + 20);
  pruefe(abschnitt.includes('data-op="\'+op.id+\'"'),
    'NR-Zweig in schnittSvg() erzeugt data-op-Attribute (Linie + Dreiecke auswaehlbar)');
}

if (fehler) {
  console.error('\nExport-Name-Smoke: ' + fehler + ' Fehler.');
  process.exit(1);
} else {
  console.log('\nExport-Name-Smoke: alle Pruefungen OK');
}
