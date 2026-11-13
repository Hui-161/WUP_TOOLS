#!/usr/bin/env node
/*
  Smoke-Test fuer AP3 (Strg+H, numerisches Suchen & Ersetzen — Koordinaten-
  Ersetzung statt Rohtext, Notepad++-Ersatz). Synthetisches Modell (wupLaden):
    a) nurVorschau zaehlt korrekt (Achse/Toleranz beachtet, keine Mutation).
    b) Ersetzen aendert NUR die Achse/Toleranz-Treffer, setzt op._modified,
       und haelt den doppelten Schlusspunkt einer geschlossenen Kontur
       automatisch synchron (kein Sonderfall noetig).
    c) bereich='auswahl' beschraenkt korrekt auf ui.auswahl/ui.mehrAuswahl.
    d) Export nach dem Ersetzen laeuft ohne Exception.
*/
'use strict';
const { editorKontext, wupLaden, vm } = require('./harness');

let fehler = 0;
function pruefe(bedingung, text) {
  if (bedingung) console.log('  OK      ' + text);
  else { console.error('  FEHLER  ' + text); fehler++; }
}

/* Synthetisches Modell:
   - eine NR bei y=355 (Nutzer-Anwendungsfall: "Unterkante 5 cm nach oben verkuerzen")
   - eine zweite NR bei y=355 in einer ANDEREN Lage-Op, damit 'sichtbar' mehrere trifft
   - ein geschlossenes PSF-Rechteck MIT y=355 an einer Ecke (Schlusspunkt-Duplikat testen)
   - ein PAF mit x=355 (nur x betroffen, nicht y — Achsen-Isolation testen) */
function testDatei() {
  return [
    'VERSION 3.4;', 'ELN test;', 'ELM     3000, 2500, 235, 1;',
    'PLI1    3000, 2500, 15, 0, 0, 30, OSB, 160;',
    'PP      0, 0;', 'PP      3000, 0;', 'PP      3000, 2500;', 'PP      0, 2500;', 'PP      0, 0;',
    'NR      100, 355, 500, 355, 32, 10;',
    'PSF;',
    'PP      600, 355, 15, 0, 0, 0;', 'PP      700, 355, 15, 0, 0, 0;',
    'PP      700, 455, 15, 0, 0, 0;', 'PP      600, 455, 15, 0, 0, 0;', 'PP      600, 355, 15, 0, 0, 0;',
    'PAF;',
    'PP      355, 900, 15, 311, 0;', 'PP      355, 1200, 15, 311, 0;',
    ''].join('\r\n');
}

/* --- a) nurVorschau zaehlt korrekt, keine Mutation --- */
{
  const ctx = editorKontext();
  wupLaden(ctx, testDatei());
  const erg = vm.runInContext(`
    (() => {
      const vor = JSON.stringify(modell.layers);
      const r = werteErsetzen({ suchwert: 355, ersatzwert: 400, achse: 'y', toleranz: 0.01, bereich: 'sichtbar', nurVorschau: true });
      const nach = JSON.stringify(modell.layers);
      return { treffer: r.treffer, opsAnzahl: r.ops.length, unveraendert: vor === nach };
    })()
  `, ctx);
  /* y=355 kommt vor bei: NR (ya UND ye = 2 Treffer), PSF (3 Punkte bei y=355:
     die beiden oberen Rechteck-Ecken PLUS der Schlusspunkt-Duplikat-Partner
     der ersten Ecke — alle 3 werden unabhaengig gezaehlt, da jedes Feld fuer
     sich geprueft wird), PAF hat kein y=355 (nur x=355) -> 5 Treffer in 2 Ops */
  pruefe(erg.treffer === 5, 'nurVorschau zaehlt 5 y-Treffer (NR: ya+ye, PSF: 3 Punkte bei y=355): ' + erg.treffer);
  pruefe(erg.opsAnzahl === 2, 'nurVorschau meldet 2 betroffene Ops (NR + PSF): ' + erg.opsAnzahl);
  pruefe(erg.unveraendert, 'nurVorschau=true veraendert das Modell NICHT');
}

/* --- b) Ersetzen aendert nur Achse/Toleranz-Treffer, setzt _modified, Schlusspunkt bleibt synchron --- */
{
  const ctx = editorKontext();
  wupLaden(ctx, testDatei());
  const erg = vm.runInContext(`
    (() => {
      const nr = modell.layers[0].ops.find(o => o.kw === 'NR');
      const psf = modell.layers[0].ops.find(o => o.kw === 'PSF');
      const paf = modell.layers[0].ops.find(o => o.kw === 'PAF');
      const r = werteErsetzen({ suchwert: 355, ersatzwert: 400, achse: 'y', toleranz: 0.01, bereich: 'sichtbar' });
      return {
        treffer: r.treffer,
        nrModified: !!nr._modified, nrYa: nr.nr.ya, nrYe: nr.nr.ye, nrXa: nr.nr.xa,
        psfModified: !!psf._modified,
        psfEckeErsetzt: psf.poly[0].y, psfSchlusspunkt: psf.poly[4].y,
        psfSchlusspunktSynchron: psf.poly[0].y === psf.poly[4].y,
        pafUnveraendert: paf.poly[0].x === 355 && !paf._modified
      };
    })()
  `, ctx);
  pruefe(erg.treffer === 5, 'Ersetzen meldet 5 Treffer: ' + erg.treffer);
  pruefe(erg.nrModified && erg.nrYa === 400 && erg.nrYe === 400, 'NR.ya/ye auf 400 ersetzt, _modified gesetzt: ya=' + erg.nrYa + ' ye=' + erg.nrYe);
  pruefe(erg.nrXa === 100, 'NR.xa (x-Achse) NICHT veraendert (achse=y): ' + erg.nrXa);
  pruefe(erg.psfModified && erg.psfEckeErsetzt === 400, 'PSF-Ecke auf 400 ersetzt, _modified gesetzt: ' + erg.psfEckeErsetzt);
  pruefe(erg.psfSchlusspunktSynchron, 'geschlossene PSF: Schlusspunkt-Duplikat bleibt automatisch synchron (' + erg.psfSchlusspunkt + ')');
  pruefe(erg.pafUnveraendert, 'PAF (x=355, aber achse=y gesucht) bleibt unveraendert');
}

/* --- c) bereich='auswahl' beschraenkt korrekt --- */
{
  const ctx = editorKontext();
  wupLaden(ctx, testDatei());
  const erg = vm.runInContext(`
    (() => {
      const nr = modell.layers[0].ops.find(o => o.kw === 'NR');
      const psf = modell.layers[0].ops.find(o => o.kw === 'PSF');
      /* nur die PSF auswaehlen -> NR (auch bei y=355) darf NICHT angefasst werden */
      ui.auswahl = { typ: 'op', id: psf.id, lageId: modell.layers[0].id };
      ui.mehrAuswahl = [];
      const r = werteErsetzen({ suchwert: 355, ersatzwert: 999, achse: 'y', toleranz: 0.01, bereich: 'auswahl' });
      return { treffer: r.treffer, opsAnzahl: r.ops.length,
        psfGeaendert: psf.poly[0].y === 999, nrUnveraendert: nr.nr.ya === 355 };
    })()
  `, ctx);
  pruefe(erg.opsAnzahl === 1 && erg.psfGeaendert, "bereich='auswahl' aendert nur die ausgewaehlte PSF: " + erg.treffer + ' Treffer, ops=' + erg.opsAnzahl);
  pruefe(erg.nrUnveraendert, "bereich='auswahl' laesst die NICHT ausgewaehlte NR unangetastet");
}

/* --- d) Export nach Ersetzen laeuft ohne Exception --- */
{
  const ctx = editorKontext();
  wupLaden(ctx, testDatei());
  const exportiertOhneFehler = vm.runInContext(`
    (() => {
      werteErsetzen({ suchwert: 355, ersatzwert: 400, achse: 'beide', toleranz: 0.01, bereich: 'alle' });
      try {
        kwZeileUeberlaenge = [];
        exportZeilenErzeugen();
        return true;
      } catch (e) { return false; }
    })()
  `, ctx);
  pruefe(exportiertOhneFehler === true, 'exportZeilenErzeugen() nach werteErsetzen() wirft keine Exception');
}

/* =====================================================================
   AP-WE2: erweiterte Felder (Index/Name/Steuercode/z/BOZ) + Lagen-/Typ-Filter
   Synthetisches Modell mit ZWEI Lagen (PLI1/PLI2), damit lagenFilter/typFilter
   sich beweisen lassen:
   - je Lage eine NR (nrIndex=11, y=355) und eine PAF (Rechteck mit 4 Punkten
     i=211 + 1 Punkt i=300/t=52, PLI1 geschlossen mit Schlusspunkt-Duplikat,
     PLI2 nur 2 Punkte offen)
   - ein Bauteil (OG) mit zwei BOZ-Bearbeitungen (d=40) */
function testDateiErweitert() {
  return [
    'VERSION 3.4;', 'ELN test;', 'ELM     3000, 2500, 235, 1;',
    'PLI1    3000, 2500, 15, 0, 0, 30, Platte-A, 160;',
    'PP      0, 0;', 'PP      3000, 0;', 'PP      3000, 2500;', 'PP      0, 2500;', 'PP      0, 0;',
    'NR      100, 355, 500, 355, 32, 11;',
    'PAF;',
    'PP      600, 355, 50.005, 211, 0;', 'PP      700, 355, 50.005, 211, 0;',
    'PP      700, 455, 52, 300, 0;', 'PP      600, 455, 50.005, 211, 0;', 'PP      600, 355, 50.005, 211, 0;',
    'PLI2    3000, 2500, 15, 0, 3000, 30, Platte-B, 160;',
    'PP      0, 0;', 'PP      3000, 0;', 'PP      3000, 2500;', 'PP      0, 2500;', 'PP      0, 0;',
    'NR      100, 355, 500, 355, 32, 11;',
    'PAF;',
    'PP      600, 355, 50, 211, 0;', 'PP      700, 355, 50, 211, 0;',
    'OG      200, 100, 60, 500, 200, 30, Riegel, 0;',
    'BOZ     100, 30, 40, 2;',
    'BOZ     100, 50, 40, 2;',
    ''].join('\r\n');
}

/* --- e) feld 'steuercode' 211->311, EXAKT, trifft nur i=211 (nicht i=300) --- */
{
  const ctx = editorKontext();
  wupLaden(ctx, testDateiErweitert());
  const erg = vm.runInContext(`
    (() => {
      const paf1 = modell.layers[0].ops.find(o => o.kw === 'PAF');
      const r = werteErsetzen({ feld: 'steuercode', suchwert: 211, ersatzwert: 311, bereich: 'alle' });
      return {
        treffer: r.treffer,
        alle211: paf1.poly.filter(e => e.i === 211).length,
        alle311: paf1.poly.filter(e => e.i === 311).length,
        punkt300Unveraendert: paf1.poly.find(e => e.t === 52).i === 300,
        xUnveraendert: paf1.poly[0].x === 600
      };
    })()
  `, ctx);
  /* 4 Punkte i=211 je Lage (PLI1: 4, PLI2: 2) = 6 Treffer */
  pruefe(erg.treffer === 6, "feld 'steuercode' 211->311 zaehlt 6 Treffer (PLI1: 4, PLI2: 2): " + erg.treffer);
  pruefe(erg.alle211 === 0 && erg.alle311 === 4, 'PLI1-PAF: alle vier i=211 -> i=311 ersetzt: ' + erg.alle311);
  pruefe(erg.punkt300Unveraendert, 'Punkt mit i=300 bleibt unveraendert (exakter Vergleich, keine Toleranz)');
  pruefe(erg.xUnveraendert, 'x-Koordinaten bleiben bei feld=steuercode unveraendert');
}

/* --- f) feld 'nrIndex' 11->20 nur nr.i (nicht nr.a/xa/ya) --- */
{
  const ctx = editorKontext();
  wupLaden(ctx, testDateiErweitert());
  const erg = vm.runInContext(`
    (() => {
      const nr1 = modell.layers[0].ops.find(o => o.kw === 'NR');
      const nr2 = modell.layers[1].ops.find(o => o.kw === 'NR');
      const r = werteErsetzen({ feld: 'nrIndex', suchwert: 11, ersatzwert: 20, bereich: 'alle' });
      return { treffer: r.treffer, nr1i: nr1.nr.i, nr2i: nr2.nr.i, nr1a: nr1.nr.a, nr1ya: nr1.nr.ya };
    })()
  `, ctx);
  pruefe(erg.treffer === 2, "feld 'nrIndex' 11->20 zaehlt 2 Treffer (eine NR je Lage): " + erg.treffer);
  pruefe(erg.nr1i === 20 && erg.nr2i === 20, 'beide NR.i auf 20 ersetzt: ' + erg.nr1i + '/' + erg.nr2i);
  pruefe(erg.nr1a === 32, 'NR.a (Abstand) bleibt unveraendert: ' + erg.nr1a);
  pruefe(erg.nr1ya === 355, 'NR.ya (Koordinate) bleibt unveraendert: ' + erg.nr1ya);
}

/* --- g) feld 't' mit Toleranz (50.005 <-> 50 mit Toleranz 0.01, 52 bleibt unberuehrt) --- */
{
  const ctx = editorKontext();
  wupLaden(ctx, testDateiErweitert());
  const erg = vm.runInContext(`
    (() => {
      const paf1 = modell.layers[0].ops.find(o => o.kw === 'PAF');
      const r = werteErsetzen({ feld: 't', suchwert: 50, ersatzwert: 66, toleranz: 0.01, bereich: 'alle' });
      return {
        treffer: r.treffer,
        alle66: paf1.poly.filter(e => e.t === 66).length,
        punkt52Unveraendert: paf1.poly.find(e => e.i === 300).t === 52
      };
    })()
  `, ctx);
  pruefe(erg.treffer === 6, "feld 't' mit Toleranz 0.01 zaehlt 6 Treffer (50.005 pass, 52 nicht): " + erg.treffer);
  pruefe(erg.alle66 === 4, 'PLI1-PAF: vier t=50.005 -> t=66 ersetzt (Toleranz erfasst 50.005): ' + erg.alle66);
  pruefe(erg.punkt52Unveraendert, 't=52 bleibt unveraendert (ausserhalb Toleranz)');
}

/* --- h) feld 'name' exakt + enthaelt auf Platten, Export enthaelt neuen Namen --- */
{
  const ctx = editorKontext();
  wupLaden(ctx, testDateiErweitert());
  const erg = vm.runInContext(`
    (() => {
      const r = werteErsetzen({ feld: 'name', suchwert: 'Platte-A', ersatzwert: 'Neu-A', textModus: 'exakt', bereich: 'alle' });
      const platte = modell.layers[0].plates[0];
      const zeilen = exportZeilenErzeugen().zeilen;
      return { treffer: r.treffer, opsAnzahl: r.ops.length, name: platte.name, modified: !!platte._modified,
        exportEnthaeltNeu: zeilen.some(z => z.includes('Neu-A')),
        exportEnthaeltAlt: zeilen.some(z => z.includes('Platte-A')) };
    })()
  `, ctx);
  pruefe(erg.treffer === 1 && erg.opsAnzahl === 1, "feld 'name' exakt: 1 Treffer/1 Platte: " + erg.treffer);
  pruefe(erg.name === 'Neu-A' && erg.modified, 'Platten-Name exakt ersetzt, _modified gesetzt: ' + erg.name);
  pruefe(erg.exportEnthaeltNeu && !erg.exportEnthaeltAlt, 'Export enthaelt den neuen Namen, nicht mehr den alten');

  const ctx2 = editorKontext();
  wupLaden(ctx2, testDateiErweitert());
  const erg2 = vm.runInContext(`
    (() => {
      const r = werteErsetzen({ feld: 'name', suchwert: 'Platte', ersatzwert: 'Bauteil', textModus: 'enthaelt', bereich: 'alle' });
      const zeilen = exportZeilenErzeugen().zeilen;
      return { treffer: r.treffer,
        nameA: modell.layers[0].plates[0].name, nameB: modell.layers[1].plates[0].name,
        exportA: zeilen.some(z => z.includes('Bauteil-A')), exportB: zeilen.some(z => z.includes('Bauteil-B')) };
    })()
  `, ctx2);
  pruefe(erg2.treffer === 2, "feld 'name' enthaelt: 2 Treffer (beide Platten): " + erg2.treffer);
  pruefe(erg2.nameA === 'Bauteil-A' && erg2.nameB === 'Bauteil-B', 'beide Namen per Teilstring ersetzt: ' + erg2.nameA + '/' + erg2.nameB);
  pruefe(erg2.exportA && erg2.exportB, 'Export enthaelt beide neuen Namen (Teilstring-Ersetzung)');
}

/* --- i) feld 'bozWert' 40->50: params[2] + _zeilenErsetzungen + Export --- */
{
  const ctx = editorKontext();
  wupLaden(ctx, testDateiErweitert());
  const erg = vm.runInContext(`
    (() => {
      const beam = modell.beams[0];
      const r = werteErsetzen({ feld: 'bozWert', suchwert: 40, ersatzwert: 50, toleranz: 0.5, bereich: 'alle' });
      const bbs = beam.bearbeitungen.filter(b => b.kw === 'BOZ');
      const params2NachR = bbs.map(b => b.params[2]);
      const erwarteteZeilen = bbs.map(b => kwZeile('BOZ', b.params));
      const zeilen = exportZeilenErzeugen().zeilen;
      const zeilenErsetzungenAnzahl1 = modell._zeilenErsetzungen.length;
      const zeilenErsetzungenPassenExakt = erwarteteZeilen.every(z => modell._zeilenErsetzungen.some(e => e.zeilen[0] === z));
      const exportEnthaeltBeideZeilen = erwarteteZeilen.every(z => zeilen.includes(z));
      /* zweites Ersetzen auf denselben Zeilen darf KEINE weiteren _zeilenErsetzungen-Eintraege erzeugen */
      const r2 = werteErsetzen({ feld: 'bozWert', suchwert: 50, ersatzwert: 60, toleranz: 0.5, bereich: 'alle' });
      return {
        treffer: r.treffer, opsAnzahl: r.ops.length,
        params2NachR, beamModified: !!beam._modified,
        zeilenErsetzungenAnzahl1, zeilenErsetzungenPassenExakt, exportEnthaeltBeideZeilen,
        treffer2: r2.treffer,
        zeilenErsetzungenAnzahl2: modell._zeilenErsetzungen.length
      };
    })()
  `, ctx);
  pruefe(erg.treffer === 2 && erg.opsAnzahl === 2, "feld 'bozWert' 40->50 zaehlt 2 Treffer (beide BOZ): " + erg.treffer);
  pruefe(erg.params2NachR.every(p => p === '50'), 'bb.params[2] (Durchmesser) auf 50 gesetzt: ' + erg.params2NachR.join(','));
  pruefe(erg.beamModified, 'beam._modified gesetzt');
  pruefe(erg.zeilenErsetzungenAnzahl1 === 2, '_zeilenErsetzungen hat genau 2 Eintraege (einen je BOZ-Zeile): ' + erg.zeilenErsetzungenAnzahl1);
  pruefe(erg.zeilenErsetzungenPassenExakt, '_zeilenErsetzungen-Eintraege enthalten exakt die neu erzeugte BOZ-Zeile (kwZeile-Muster wie beamBozErsetzen)');
  pruefe(erg.exportEnthaeltBeideZeilen, 'Export-Zeilen (exportZeilenErzeugen) enthalten beide neuen BOZ-Zeilen exakt');
  pruefe(erg.treffer2 === 2 && erg.zeilenErsetzungenAnzahl2 === 2,
    'zweites Ersetzen auf denselben Zeilen aktualisiert bestehende Eintraege statt zu duplizieren: ' + erg.zeilenErsetzungenAnzahl2);
}

/* --- j) lagenFilter beschraenkt auf eine Lage --- */
{
  const ctx = editorKontext();
  wupLaden(ctx, testDateiErweitert());
  const erg = vm.runInContext(`
    (() => {
      const nr1 = modell.layers[0].ops.find(o => o.kw === 'NR');
      const nr2 = modell.layers[1].ops.find(o => o.kw === 'NR');
      const r = werteErsetzen({ feld: 'y', suchwert: 355, ersatzwert: 999, toleranz: 0.01,
        bereich: 'alle', lagenFilter: ['PLI1'] });
      return { treffer: r.treffer, nr1ya: nr1.nr.ya, nr2ya: nr2.nr.ya,
        nurPli1: r.ops.every(f => f.lage.id === 'PLI1') };
    })()
  `, ctx);
  pruefe(erg.nr1ya === 999, "lagenFilter=['PLI1']: NR in PLI1 geaendert: " + erg.nr1ya);
  pruefe(erg.nr2ya === 355, "lagenFilter=['PLI1']: NR in PLI2 NICHT geaendert: " + erg.nr2ya);
  pruefe(erg.nurPli1, 'alle betroffenen Ops gehoeren zur gefilterten Lage PLI1');
}

/* --- k) typFilter ['NR'] trifft keine PAF --- */
{
  const ctx = editorKontext();
  wupLaden(ctx, testDateiErweitert());
  const erg = vm.runInContext(`
    (() => {
      const paf1 = modell.layers[0].ops.find(o => o.kw === 'PAF');
      const r = werteErsetzen({ feld: 'y', suchwert: 355, ersatzwert: 999, toleranz: 0.01,
        bereich: 'alle', typFilter: ['NR'] });
      return { treffer: r.treffer, nurNr: r.ops.every(f => f.op.kw === 'NR'),
        pafUnveraendert: paf1.poly[0].y === 355 };
    })()
  `, ctx);
  pruefe(erg.nurNr, "typFilter=['NR']: nur NR-Ops betroffen, keine PAF: " + erg.treffer);
  pruefe(erg.pafUnveraendert, 'PAF (y=355, aber typFilter=NR) bleibt unveraendert');
}

/* --- l) alte API {achse:'y'} verhaelt sich unveraendert (Rueckwaertskompatibilitaet) --- */
{
  const ctx = editorKontext();
  wupLaden(ctx, testDateiErweitert());
  const erg = vm.runInContext(`
    (() => {
      const nr1 = modell.layers[0].ops.find(o => o.kw === 'NR');
      const r = werteErsetzen({ suchwert: 355, ersatzwert: 777, achse: 'y', toleranz: 0.01, bereich: 'alle' });
      return { treffer: r.treffer, nr1ya: nr1.nr.ya };
    })()
  `, ctx);
  /* y=355 kommt vor: NR (ya+ye) je Lage (2x2=4) + PAF-Ecken je Lage (PLI1: 3
     Punkte bei y=355 inkl. Schlusspunkt-Duplikat, PLI2: 2 Punkte) = 4+3+2 = 9 */
  pruefe(erg.treffer === 9, "alte API {achse:'y'} verhaelt sich wie zuvor (feld intern zu 'y' normalisiert): " + erg.treffer);
  pruefe(erg.nr1ya === 777, 'NR.ya via alter Achse-API ersetzt: ' + erg.nr1ya);
}

/* =====================================================================
   AP-WE3: neue Felder (radius/winkel/platteIdx/platteHz/platteZ/platteX*)
   + Quelltext-Vorschau (werteErsetzenVorschauHunks).
   Synthetisches Modell:
   - PLI1 (hz=15, i=30, z=160) mit PP-Umriss, PAF mit KB-Bogen (r=800) und
     einem PP mit alpha=5, zweites PAF nur mit MP (r=34)
   - PLI2 (hz=18, i=60, OHNE z) daneben (x=3000..4000) */
function testDateiNeueFelder() {
  return [
    'VERSION 3.4;', 'ELN test;', 'ELM     4000, 2500, 235, 1;',
    'PLI1    3000, 2500, 15, 0, 0, 30, Platte-A, 160;',
    'PP      0, 0;', 'PP      3000, 0;', 'PP      3000, 2500;', 'PP      0, 2500;', 'PP      0, 0;',
    'PAF;',
    'PP      2000, 0, 16, 211, 0;', 'PP      2000, 1800, 16, 211, 0;',
    'KB      3000, 1800, 800, Acw, 16, 211, 0;',
    'PP      3000, 0, 16, 211, 5, 0;',
    'PAF;',
    'MP      3382, 40, 34, 18, 211;',
    'PLI2    1000, 2500, 18, 3000, 0, 60, Platte-B;',
    'PP      3000, 0;', 'PP      4000, 0;', 'PP      4000, 2500;', 'PP      3000, 2500;', 'PP      3000, 0;',
    ''].join('\r\n');
}

/* --- m) feld 'radius': trifft nur KB r=800, MP r=34 bleibt --- */
{
  const ctx = editorKontext();
  wupLaden(ctx, testDateiNeueFelder());
  const erg = vm.runInContext(`
    (() => {
      const paf1 = modell.layers[0].ops[0], paf2 = modell.layers[0].ops[1];
      const r = werteErsetzen({ feld: 'radius', suchwert: 800, ersatzwert: 750, toleranz: 0.01, bereich: 'alle' });
      return { treffer: r.treffer, kbR: paf1.poly.find(e => e.type === 'KB').r,
        mpR: paf2.poly[0].r, paf2Unveraendert: !paf2._modified,
        xUnveraendert: paf1.poly[0].x === 2000 };
    })()
  `, ctx);
  pruefe(erg.treffer === 1, "feld 'radius' 800->750 zaehlt 1 Treffer (nur KB): " + erg.treffer);
  pruefe(erg.kbR === 750, 'KB-Radius auf 750 ersetzt: ' + erg.kbR);
  pruefe(erg.mpR === 34 && erg.paf2Unveraendert, 'MP-Radius 34 bleibt unveraendert (kein Beifang)');
  pruefe(erg.xUnveraendert, 'Koordinaten bleiben bei feld=radius unveraendert');
}

/* --- n) feld 'winkel': alpha=5 gezielt; fehlendes alpha zaehlt als 0 --- */
{
  const ctx = editorKontext();
  wupLaden(ctx, testDateiNeueFelder());
  const erg = vm.runInContext(`
    (() => {
      const paf1 = modell.layers[0].ops[0];
      const r5 = werteErsetzen({ feld: 'winkel', suchwert: 5, ersatzwert: 10, toleranz: 0.01, bereich: 'alle' });
      const r0 = werteErsetzen({ feld: 'winkel', suchwert: 0, ersatzwert: 0, toleranz: 0.01, bereich: 'alle', nurVorschau: true });
      return { treffer5: r5.treffer, alphaNeu: paf1.poly[3].alpha, treffer0: r0.treffer,
        andereAlpha: paf1.poly.slice(0, 3).every(e => !e.alpha) };
    })()
  `, ctx);
  pruefe(erg.treffer5 === 1 && erg.alphaNeu === 10, "feld 'winkel' 5->10: genau der eine geneigte Punkt: " + erg.treffer5 + '/' + erg.alphaNeu);
  pruefe(erg.andereAlpha, 'alpha der uebrigen Punkte unveraendert');
  pruefe(erg.treffer0 === 3, "Suche alpha=0 findet auch Punkte OHNE Winkelangabe (PP+PP+KB): " + erg.treffer0);
}

/* --- o) feld 'platteIdx': exakt, trifft NIE Steuercodes oder andere Platten --- */
{
  const ctx = editorKontext();
  wupLaden(ctx, testDateiNeueFelder());
  const erg = vm.runInContext(`
    (() => {
      const r = werteErsetzen({ feld: 'platteIdx', suchwert: 30, ersatzwert: 35, bereich: 'alle' });
      const p1 = modell.layers[0].plates[0], p2 = modell.layers[1].plates[0];
      const paf1 = modell.layers[0].ops[0];
      const zeilen = exportZeilenErzeugen().zeilen;
      return { treffer: r.treffer, idx1: p1.materialIdx, idx2: p2.materialIdx,
        modified: !!p1._modified, steuercodeUnveraendert: paf1.poly[0].i === 211,
        exportNeu: zeilen.some(z => /^PLI1\\s+3000, 2500, 15, 0, 0, 35, Platte-A, 160;/.test(z)) };
    })()
  `, ctx);
  pruefe(erg.treffer === 1 && erg.idx1 === 35, "feld 'platteIdx' 30->35: nur PLI1-Platte: " + erg.treffer + '/' + erg.idx1);
  pruefe(erg.idx2 === 60, 'PLI2-Materialindex 60 bleibt unveraendert');
  pruefe(erg.steuercodeUnveraendert, 'Steuercodes der Bearbeitungen bleiben unveraendert (getrennte Feldgruppe)');
  pruefe(erg.modified && erg.exportNeu, 'Export schreibt die neue Platten-Kopfzeile: ' + erg.exportNeu);
}

/* --- p) feld 'platteHz' + 'platteZ' (Platten ohne z werden nicht angefasst) --- */
{
  const ctx = editorKontext();
  wupLaden(ctx, testDateiNeueFelder());
  const erg = vm.runInContext(`
    (() => {
      const rHz = werteErsetzen({ feld: 'platteHz', suchwert: 15, ersatzwert: 16, toleranz: 0.01, bereich: 'alle' });
      const rZ = werteErsetzen({ feld: 'platteZ', suchwert: 160, ersatzwert: 170, toleranz: 0.01, bereich: 'alle' });
      const rZ0 = werteErsetzen({ feld: 'platteZ', suchwert: 0, ersatzwert: 5, toleranz: 0.01, bereich: 'alle', nurVorschau: true });
      const p1 = modell.layers[0].plates[0], p2 = modell.layers[1].plates[0];
      return { hzTreffer: rHz.treffer, hz1: p1.hz, hz2: p2.hz,
        zTreffer: rZ.treffer, z1: p1.z, zOhne: rZ0.treffer };
    })()
  `, ctx);
  pruefe(erg.hzTreffer === 1 && erg.hz1 === 16 && erg.hz2 === 18, "feld 'platteHz' 15->16: nur PLI1: " + erg.hz1 + '/' + erg.hz2);
  pruefe(erg.zTreffer === 1 && erg.z1 === 170, "feld 'platteZ' 160->170: " + erg.z1);
  pruefe(erg.zOhne === 0, 'Platte OHNE z-Angabe wird von platteZ nie getroffen: ' + erg.zOhne);
}

/* --- q) feld 'platteX': Umriss ersetzt + Kopfzeile (x/lx) nachgefuehrt --- */
{
  const ctx = editorKontext();
  wupLaden(ctx, testDateiNeueFelder());
  const erg = vm.runInContext(`
    (() => {
      const r = werteErsetzen({ feld: 'platteX', suchwert: 3000, ersatzwert: 3010, toleranz: 0.01, bereich: 'alle' });
      const p1 = modell.layers[0].plates[0], p2 = modell.layers[1].plates[0];
      const zeilen = exportZeilenErzeugen().zeilen;
      return { treffer: r.treffer,
        p1lx: p1.lx, p1x: p1.x, p2x: p2.x, p2lx: p2.lx,
        schlusspunktSynchron: p2.outline[0][0] === p2.outline[4][0],
        opUnveraendert: modell.layers[0].ops[0].poly[1].x === 2000,
        exportP1: zeilen.some(z => /^PLI1\\s+3010, 2500, 15, 0, 0, 30, Platte-A, 160;/.test(z)),
        exportPp: zeilen.some(z => /^PP\\s+3010, 2500/.test(z)) };
    })()
  `, ctx);
  /* x=3000 im Umriss: PLI1 2 Punkte + PLI2 3 Punkte (inkl. Schlusspunkt-Duplikat) = 5 */
  pruefe(erg.treffer === 5, "feld 'platteX' 3000->3010 zaehlt 5 Umriss-Treffer: " + erg.treffer);
  pruefe(erg.p1lx === 3010 && erg.p1x === 0, 'PLI1-Kopf nachgefuehrt: lx=3010, x=0: ' + erg.p1lx);
  pruefe(erg.p2x === 3010 && erg.p2lx === 990, 'PLI2-Kopf nachgefuehrt: x=3010, lx=990: ' + erg.p2x + '/' + erg.p2lx);
  pruefe(erg.schlusspunktSynchron, 'Schlusspunkt-Duplikat des Umrisses bleibt synchron');
  pruefe(erg.opUnveraendert, 'Bearbeitungs-Koordinaten (PAF x=2000) bleiben unveraendert');
  pruefe(erg.exportP1 && erg.exportPp, 'Export schreibt Kopfzeile + Umriss-PP mit neuen Werten');
}

/* --- r) werteErsetzenVorschauHunks: rein lesend, alt=Original, neu=Ersetzung --- */
{
  const ctx = editorKontext();
  wupLaden(ctx, testDateiNeueFelder());
  const erg = vm.runInContext(`
    (() => {
      const vor = JSON.stringify(modell.layers);
      const v = werteErsetzenVorschauHunks({ feld: 'steuercode', suchwert: 211, ersatzwert: 311, bereich: 'alle' }, 60);
      const nach = JSON.stringify(modell.layers);
      const h = v.hunks[0];
      return { unveraendert: vor === nach, treffer: v.treffer, objekte: v.objekte,
        hunkAnzahl: v.hunks.length, mehr: v.mehr,
        titel: h.titel, zeileNr: h.zeileNr,
        altHatOriginal: h.alt.some(z => z.includes('211')),
        neuHat311: h.neu.some(z => z.includes('311')),
        neuOhne211: !h.neu.some(z => z.includes(' 211')),
        altAusRaw: h.alt.every(z => modell.rawLines.includes(z)) };
    })()
  `, ctx);
  pruefe(erg.unveraendert, 'Vorschau-Hunks veraendern das Modell NICHT');
  pruefe(erg.treffer === 5 && erg.objekte === 2 && erg.hunkAnzahl === 2 && erg.mehr === 0,
    'Vorschau: 5 Steuercode-Treffer in 2 Ops -> 2 Hunks: ' + erg.treffer + '/' + erg.hunkAnzahl);
  pruefe(erg.titel === 'PLI1 · PAF' && erg.zeileNr === 10, 'Hunk-Titel + Original-Zeilennummer korrekt: ' + erg.titel + ' Z' + erg.zeileNr);
  pruefe(erg.altHatOriginal && erg.altAusRaw, 'alt-Zeilen sind die Original-Rohzeilen');
  pruefe(erg.neuHat311 && erg.neuOhne211, 'neu-Zeilen enthalten 311 statt 211');
}

/* --- s) Platten-Felder respektieren den lagenFilter --- */
{
  const ctx = editorKontext();
  wupLaden(ctx, testDateiNeueFelder());
  const erg = vm.runInContext(`
    (() => {
      const r = werteErsetzen({ feld: 'platteX', suchwert: 3000, ersatzwert: 2990, toleranz: 0.01,
        bereich: 'alle', lagenFilter: ['PLI2'] });
      const p1 = modell.layers[0].plates[0], p2 = modell.layers[1].plates[0];
      return { treffer: r.treffer, p1lx: p1.lx, p2x: p2.x, nurPli2: r.ops.every(f => f.lage.id === 'PLI2') };
    })()
  `, ctx);
  pruefe(erg.treffer === 3 && erg.nurPli2, "lagenFilter=['PLI2']: nur PLI2-Umriss getroffen (3 Punkte): " + erg.treffer);
  pruefe(erg.p1lx === 3000, 'PLI1 bleibt unveraendert (lx=3000): ' + erg.p1lx);
  pruefe(erg.p2x === 2990, 'PLI2-Kopf nachgefuehrt: x=2990: ' + erg.p2x);
}

/* =====================================================================
   AP-WE5 (Anwenderfund an aw002561): (t) platteSerialisieren darf die
   Zusatzfelder der Umriss-PPs (i, alpha, z) NICHT ueberschreiben — beim
   Aendern nur des Materialindex muessen die PP-Zeilen byte-identisch zum
   Original bleiben. (u) Namensfilter-Modus 'beginnt' (laufende Nummer am
   Namensende ignorieren) + Options-/Lese-Hilfen. */
function testDateiZusatzfelder() {
  return [
    'VERSION 3.4;', 'ELN test;', 'ELM     6528, 2980, 230, 1;',
    /* Muster aus aw002561: PLI1 mit i=0, PP-z=200 */
    'PLI1    1250, 2940, 15, 0, 0, 0, OSB_3-Beplankung-4260, 200;',
    'PP      0, 0, 15, 0, 0, 200;', 'PP      1250, 0, 15, 0, 0, 200;',
    'PP      1250, 2940, 15, 0, 0, 200;', 'PP      0, 2940, 15, 0, 0, 200;', 'PP      0, 0, 15, 0, 0, 200;',
    'PLI1    1250, 2940, 15, 1250, 0, 0, OSB_3-Beplankung-4261, 200;',
    'PP      1250, 0, 15, 0, 0, 200;', 'PP      2500, 0, 15, 0, 0, 200;',
    'PP      2500, 2940, 15, 0, 0, 200;', 'PP      1250, 2940, 15, 0, 0, 200;', 'PP      1250, 0, 15, 0, 0, 200;',
    /* Muster PLA1: i=10 im PP, z=-15 */
    'PLA1    1220, 2910, 15, 30, 30, 10, Gipsfaser_1-Beplankung-4250, -15;',
    'PP      30, 30, 15, 10, 0, -15;', 'PP      1250, 30, 15, 10, 0, -15;',
    'PP      1250, 2940, 15, 10, 0, -15;', 'PP      30, 2940, 15, 10, 0, -15;', 'PP      30, 30, 15, 10, 0, -15;',
    ''].join('\r\n');
}

/* --- t) Zusatzfelder der Umriss-PPs bleiben beim Re-Serialisieren erhalten --- */
{
  const ctx = editorKontext();
  wupLaden(ctx, testDateiZusatzfelder());
  const erg = vm.runInContext(`
    (() => {
      const vorherPp = modell.rawLines.filter(z => z.startsWith('PP'));
      const r = werteErsetzen({ feld: 'platteIdx', suchwert: 0, ersatzwert: 30, bereich: 'alle' });
      const zeilen = exportZeilenErzeugen().zeilen;
      const nachherPp = zeilen.filter(z => z.startsWith('PP'));
      return {
        treffer: r.treffer,
        koepfe: zeilen.filter(z => /^PL/.test(z)),
        ppIdentisch: vorherPp.length === nachherPp.length && vorherPp.every((z, i) => z === nachherPp[i]),
        beispielPp: nachherPp[0]
      };
    })()
  `, ctx);
  pruefe(erg.treffer === 2, "platteIdx 0->30 trifft die beiden PLI1 (PLA1 hat i=10): " + erg.treffer);
  pruefe(erg.koepfe[0].includes(' 30, OSB_3-Beplankung-4260') && erg.koepfe[2].includes(' 10, Gipsfaser'),
    'Kopfzeilen: PLI1-Index ersetzt, PLA1 unveraendert');
  pruefe(erg.ppIdentisch, 'ALLE Umriss-PP-Zeilen bleiben byte-identisch (z=200/-15 und i=10 erhalten): ' + erg.beispielPp);
}

/* --- u) Namensfilter 'beginnt' + Options-/Lese-Hilfen --- */
{
  const ctx = editorKontext();
  wupLaden(ctx, testDateiZusatzfelder());
  const erg = vm.runInContext(`
    (() => {
      const rBeginnt = werteErsetzen({ feld: 'platteIdx', suchwert: 0, ersatzwert: 30, bereich: 'alle',
        nurVorschau: true, plattenNameFilter: 'OSB_3-Beplankung', plattenNameModus: 'beginnt' });
      const rExakt = werteErsetzen({ feld: 'platteIdx', suchwert: 0, ersatzwert: 30, bereich: 'alle',
        nurVorschau: true, plattenNameFilter: 'OSB_3-Beplankung-4260', plattenNameModus: 'exakt' });
      const rExaktPraefix = werteErsetzen({ feld: 'platteIdx', suchwert: 0, ersatzwert: 30, bereich: 'alle',
        nurVorschau: true, plattenNameFilter: 'OSB_3-Beplankung', plattenNameModus: 'exakt' });
      const html = weNameFilterOptionenHtml(['OSB_3-Beplankung-4260', 'OSB_3-Beplankung-4261', 'Gipsfaser_1-Beplankung-4250']);
      return { beginnt: rBeginnt.treffer, exakt: rExakt.treffer, exaktPraefix: rExaktPraefix.treffer,
        hatPraefixGruppe: html.includes('Beginnend mit') && html.includes('value="anfang:OSB_3-Beplankung"'),
        praefixEinmal: (html.match(/anfang:OSB_3-Beplankung"/g) || []).length === 1,
        lesenAnfang: JSON.stringify(weNameFilterLesen('anfang:OSB_3-Beplankung')),
        lesenExakt: JSON.stringify(weNameFilterLesen('exakt:OSB_3-Beplankung-4260')),
        lesenLeer: JSON.stringify(weNameFilterLesen('')) };
    })()
  `, ctx);
  pruefe(erg.beginnt === 2, "Modus 'beginnt': trifft beide OSB-Platten trotz verschiedener Nummern: " + erg.beginnt);
  pruefe(erg.exakt === 1, "Modus 'exakt' mit vollem Namen: nur eine Platte: " + erg.exakt);
  pruefe(erg.exaktPraefix === 0, "Modus 'exakt' mit Praefix: KEIN Treffer (kein exakter Name): " + erg.exaktPraefix);
  pruefe(erg.hatPraefixGruppe && erg.praefixEinmal, 'Options-HTML: Praefix-Gruppe vorhanden, Praefix dedupliziert');
  pruefe(erg.lesenAnfang === '{"plattenNameFilter":"OSB_3-Beplankung","plattenNameModus":"beginnt"}',
    'weNameFilterLesen dekodiert anfang: korrekt');
  pruefe(erg.lesenExakt.includes('"OSB_3-Beplankung-4260"') && erg.lesenLeer.includes('null'),
    'weNameFilterLesen dekodiert exakt:/leer korrekt');
}

/* --- v) AP-WE6: Wert-Vorschlaege (vorhandene Werte + Ersatz-Vorschlaege) --- */
{
  const ctx = editorKontext();
  wupLaden(ctx, testDateiErweitert());
  const erg = vm.runInContext(`
    (() => {
      const nrIdx = weVorhandeneWerte('nrIndex');
      const sc = weVorhandeneWerte('steuercode');
      const ersatzNr = weErsatzVorschlaege('nrIndex');
      const ersatzIdx = weErsatzVorschlaege('platteIdx');
      const xy = weVorhandeneWerte('x');
      return {
        nrIdx: nrIdx.map(v => v.wert + ':' + v.anzahl).join(','),
        nrIdxText: nrIdx[0].text,
        scErster: sc[0], scHaeufigster211: sc[0].wert === 211,
        ersatzNrWerte: ersatzNr.map(v => v.wert).join(','),
        ersatzNrHatText: ersatzNr.every(v => v.text && v.text.length > 3),
        ersatzIdxHat30: ersatzIdx.some(v => v.wert === 30 && v.text.includes('OSB')),
        xyLeer: xy.length === 0
      };
    })()
  `, ctx);
  pruefe(erg.nrIdx === '11:2', "weVorhandeneWerte('nrIndex'): 11 kommt 2x vor: " + erg.nrIdx);
  pruefe(erg.nrIdxText.includes('Klammer'), 'NR-Index-Erklaerung aus dem Maschinenprofil: ' + erg.nrIdxText);
  pruefe(erg.scHaeufigster211 && erg.scErster.text.includes('ueberschneidend'),
    'haeufigster Steuercode 211 mit Worten erklaert: ' + erg.scErster.text);
  pruefe(erg.ersatzNrWerte === '10,11,20,25,32', 'Ersatz-Vorschlaege nrIndex = Maschinenprofil-Geraete: ' + erg.ersatzNrWerte);
  pruefe(erg.ersatzNrHatText, 'alle Geraete-Vorschlaege mit Klartext-Erklaerung');
  pruefe(erg.ersatzIdxHat30, 'platteIdx-Vorschlaege enthalten 30 mit Materialklasse OSB');
  pruefe(erg.xyLeer, "x-Koordinate liefert bewusst KEINE Vorschlaege (zu viele Einzelwerte)");
}

if (fehler) {
  console.error('\nWerte-Ersetzen-Smoke: ' + fehler + ' Fehler.');
  process.exit(1);
} else {
  console.log('\nWerte-Ersetzen-Smoke: alle Pruefungen OK');
}
