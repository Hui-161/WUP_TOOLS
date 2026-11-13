#!/usr/bin/env node
/*
  Smoke-Test fuer WP-G/WP-H (v2.29, Umbau v2.48): Ecken-Markierung (2x
  50-mm-PML zum Winkelpunkt vor einer RIEGELWERK-Ecke) und die gravierenden
  Pruefungen P-19/P-20/P-21 inkl. Korrektur-Funktionen.
    a) riegelEcken: ohne Hoelzer die ELM-Box; anschlagEckeVorschlag =
       Riegel-Ecke (maxX, minY) fuer ALLE Lagen (PLA-Korrektur v2.48).
    b) eckenPmlErzeugen: Winkelpunkt = Ecke + Ruecksprung diagonal nach
       innen; 2 offene PML a 50 mm, GEGENLAEUFIG (Start auf der Platte,
       Ende im Winkelpunkt), Code 122, EIN Undo-Schritt, Export beide.
    c) P-19: Platten mit i=0 je Namens-Gruppe als FEHLER mit Vorschlag
       (OSB -> 30); materialIndexVorschlag-Heuristik.
    d) P-20: NR-Index ausserhalb 10/11/20/25/32 als FEHLER; bekannte ok.
    e) P-21: PAF/PSG-Punkte mit alpha != 0 als FEHLER; neigungenNullen()
       korrigiert alle und setzt _modified (PSF-alpha bleibt unangetastet).
    f) P-22: NR-Index 25 in PLA als FEHLER (in PLI erlaubt);
       nrIndex25PlaKorrigieren() stellt nur die PLA-Reihen auf 20.
*/
'use strict';
const { editorKontext, wupLaden, vm } = require('./harness');

let fehler = 0;
function pruefe(bedingung, text) {
  if (bedingung) console.log('  OK      ' + text);
  else { console.error('  FEHLER  ' + text); fehler++; }
}

function testDatei() {
  return [
    'VERSION 3.4;', 'ELN test;', 'ELM     6000, 2900, 230, 1;',
    /* PLI1: zwei OSB-Platten mit i=0 (P-19-Fall, wie aw002561) */
    'PLI1    3000, 2900, 15, 0, 0, 0, OSB_3-Beplankung-4260, 200;',
    'PP      0, 0, 15, 0, 0, 200;', 'PP      3000, 0, 15, 0, 0, 200;',
    'PP      3000, 2900, 15, 0, 0, 200;', 'PP      0, 2900, 15, 0, 0, 200;', 'PP      0, 0, 15, 0, 0, 200;',
    'PLI1    3000, 2900, 15, 3000, 0, 0, OSB_3-Beplankung-4261, 200;',
    'PP      3000, 0, 15, 0, 0, 200;', 'PP      6000, 0, 15, 0, 0, 200;',
    'PP      6000, 2900, 15, 0, 0, 200;', 'PP      3000, 2900, 15, 0, 0, 200;', 'PP      3000, 0, 15, 0, 0, 200;',
    'NR      100, 100, 100, 2800, 90, 10;',   /* bekannter Index -> ok */
    'NR      200, 100, 200, 2800, 90, 1;',    /* Index 1 -> P-20 */
    'NR      300, 100, 300, 2800, 90, 25;',   /* Index 25 in PLI -> KEIN P-22 */
    'PAF;',
    'PP      500, 500, 15, 211, 12, 200;',    /* alpha=12 -> P-21 */
    'PP      900, 500, 15, 211, 0, 200;',
    /* PLA1: Gipsfaser mit korrektem Index (kein P-19) */
    'PLA1    6000, 2900, 15, 0, 0, 10, Gipsfaser_1-Beplankung-4250, -15;',
    'PP      0, 0, 15, 10, 0, -15;', 'PP      6000, 0, 15, 10, 0, -15;',
    'PP      6000, 2900, 15, 10, 0, -15;', 'PP      0, 2900, 15, 10, 0, -15;', 'PP      0, 0, 15, 10, 0, -15;',
    'NR      400, 100, 400, 2800, 90, 25;',   /* Index 25 in PLA -> P-22 */
    'PSF;',
    'PP      100, 100, 0, 0, 5;',             /* PSF-alpha zaehlt NICHT fuer P-21 */
    'PP      200, 100, 0, 0, 5;', 'PP      200, 200, 0, 0, 5;', 'PP      100, 100, 0, 0, 5;',
    ''].join('\r\n');
}

/* --- a) Riegel-Ecken + Anschlag-Vorschlag (fuer alle Lagen gleich) --- */
{
  const ctx = editorKontext();
  wupLaden(ctx, testDatei());
  const erg = vm.runInContext(`
    (() => ({ ecken: riegelEcken().map(p => p.join('/')).join(' '),
              anschlag: anschlagEckeVorschlag() }))()
  `, ctx);
  pruefe(erg.ecken === '0/0 6000/0 6000/2900 0/2900',
    'riegelEcken ohne Hoelzer = ELM-Box-Ecken: ' + erg.ecken);
  pruefe(erg.anschlag[0] === 6000 && erg.anschlag[1] === 0,
    'Anschlag-Vorschlag = Riegel-Ecke (maxX, minY) = 6000/0 fuer ALLE Lagen: ' + erg.anschlag.join('/'));
}

/* --- b) Ecken-PML erzeugen --- */
{
  const ctx = editorKontext();
  wupLaden(ctx, testDatei());
  const erg = vm.runInContext(`
    (() => {
      const pli = modell.layers.find(l => l.id === 'PLI1');
      const ops = eckenPmlErzeugen(pli, [6000, 0], 100);
      const zeilen = exportZeilenErzeugen().zeilen;
      return {
        anzahl: ops.length,
        kws: ops.map(o => o.kw).join(','),
        offen: ops.every(o => !o.closed && o.poly.length === 2),
        codes: ops.every(o => o.poly.every(e => e.i === 122 && e.t === 0)),
        zWerte: ops.map(o => o.poly.map(e => e.z).join(',')).join(' '),
        ppZeile: zeilen[zeilen.findIndex(z => z.startsWith('PML')) + 1],
        px: ops[0].poly.map(e => e.x + '/' + e.y).join(' '),
        py: ops[1].poly.map(e => e.x + '/' + e.y).join(' '),
        undoTiefe: undoStack.length,
        exportPml: zeilen.filter(z => z.startsWith('PML')).length
      };
    })()
  `, ctx);
  pruefe(erg.anzahl === 2 && erg.kws === 'PML,PML' && erg.offen, '2 offene PML erzeugt');
  pruefe(erg.px === '5850/100 5900/100',
    'X-Linie startet auf der Platte, endet im Winkelpunkt (6000/0 + 100 diagonal): ' + erg.px);
  pruefe(erg.py === '5900/150 5900/100',
    'Y-Linie startet auf der Platte, endet im Winkelpunkt: ' + erg.py);
  pruefe(erg.codes, 'beide PML mit t=0 und Markier-Code 122');
  pruefe(erg.zWerte === '200,200 200,200',
    'PML-Punkte tragen das Lagen-z 200 (wie reale Datensaetze): ' + erg.zWerte);
  pruefe(erg.ppZeile.replace(/;\s*$/, '').trim().endsWith('200'),
    'exportierte PP-Zeile endet mit dem z-Wert: ' + erg.ppZeile);
  pruefe(erg.undoTiefe === 1, 'EIN Undo-Schritt fuer beide Linien: ' + erg.undoTiefe);
  pruefe(erg.exportPml === 2, 'Export enthaelt beide PML-Bloecke: ' + erg.exportPml);
}

/* --- b2) Ruecksprung 0 und negativ (v2.49, Anwenderwunsch) --- */
{
  const ctx = editorKontext();
  wupLaden(ctx, testDatei());
  const erg = vm.runInContext(`
    (() => {
      const pli = modell.layers.find(l => l.id === 'PLI1');
      const n0 = eckenPmlErzeugen(pli, [6000, 0], 0);
      const nm = eckenPmlErzeugen(pli, [6000, 0], -50);
      const f = o => o.poly.map(e => e.x + '/' + e.y).join(' ');
      return { p0: f(n0[0]) + ' | ' + f(n0[1]), pm: f(nm[0]) + ' | ' + f(nm[1]) };
    })()
  `, ctx);
  pruefe(erg.p0 === '5950/0 6000/0 | 6000/50 6000/0',
    'Ruecksprung 0: Winkelpunkt GENAU auf der Riegel-Ecke: ' + erg.p0);
  pruefe(erg.pm === '6000/-50 6050/-50 | 6050/0 6050/-50',
    'Ruecksprung -50: Winkelpunkt diagonal AUSSERHALB (Ueberstand): ' + erg.pm);
}

/* --- b3) Ruecksprung AUTOMATISCH aus der Plattenlage (v2.50/v2.52) ---
   v2.52-Regel: PML nie auf einer Plattenkante — Winkelpunkt + beide
   Linien-Endpunkte muessen streng IM Platteninneren liegen. */
{
  const ctx = editorKontext();
  const datei = [
    'VERSION 3.4;', 'ELN auto;', 'ELM     6000, 2900, 230, 1;',
    /* PLI1: buendig — Kante laeuft durch die Ecke -> Versatz 50, NICHT 0 */
    'PLI1    6000, 2900, 15, 0, 0, 30, OSB-buendig, 200;',
    'PP      0, 0, 15, 0, 0, 200;', 'PP      6000, 0, 15, 0, 0, 200;',
    'PP      6000, 2900, 15, 0, 0, 200;', 'PP      0, 2900, 15, 0, 0, 200;', 'PP      0, 0, 15, 0, 0, 200;',
    /* PLA1: exakt 100/60 zurueckgesetzt — bei r=100 laege der Winkelpunkt
       AUF der Kante (x=5900 bzw. x=100) -> naechster Schritt 150 */
    'PLA1    5800, 2831, 15, 100, 60, 10, Gips-zurueck, -15;',
    'PP      100, 60, 15, 10, 0, -15;', 'PP      5900, 60, 15, 10, 0, -15;',
    'PP      5900, 2891, 15, 10, 0, -15;', 'PP      100, 2891, 15, 10, 0, -15;', 'PP      100, 60, 15, 10, 0, -15;',
    /* PLA2: echter Ueberstand rundum -> 0 (Markierung direkt auf der Ecke) */
    'PLA2    6040, 2940, 15, -20, -20, 10, Gips-ueberstand, -30;',
    'PP      -20, -20, 15, 10, 0, -30;', 'PP      6020, -20, 15, 10, 0, -30;',
    'PP      6020, 2920, 15, 10, 0, -30;', 'PP      -20, 2920, 15, 10, 0, -30;', 'PP      -20, -20, 15, 10, 0, -30;',
    /* PLA3 wie BV fallB: rechts buendig, unten buendig, oben Ueberstand -> 50 */
    'PLA3    5675, 2950, 15, 325, 0, 20, HWF-fallB, -60;',
    'PP      325, 0, 15, 20, 0, -60;', 'PP      6000, 0, 15, 20, 0, -60;',
    'PP      6000, 2950, 15, 20, 0, -60;', 'PP      325, 2950, 15, 20, 0, -60;', 'PP      325, 0, 15, 20, 0, -60;',
    ''].join('\r\n');
  wupLaden(ctx, datei);
  const erg = vm.runInContext(`
    (() => {
      const l = id => modell.layers.find(x => x.id === id);
      return {
        buendig: eckenRuecksprungAutomatisch(l('PLI1'), [6000, 0]),
        zurueckRU: eckenRuecksprungAutomatisch(l('PLA1'), [6000, 0]),
        zurueckLU: eckenRuecksprungAutomatisch(l('PLA1'), [0, 0]),
        ueberstand: eckenRuecksprungAutomatisch(l('PLA2'), [6000, 0]),
        fallB: eckenRuecksprungAutomatisch(l('PLA3'), [6000, 0]),
        kanteMan: eckenPmlPunkteInnen(l('PLI1'), [6000, 0], 0),
        innenMan: eckenPmlPunkteInnen(l('PLI1'), [6000, 0], 50)
      };
    })()
  `, ctx);
  pruefe(erg.buendig === 50, 'buendige Platte: Kante durch die Ecke -> Versatz 50 statt 0: ' + erg.buendig);
  pruefe(erg.zurueckRU === 150 && erg.zurueckLU === 150,
    'exakt 100 zurueckgesetzt: r=100 laege AUF der Kante -> 150 an beiden unteren Ecken: '
    + erg.zurueckRU + '/' + erg.zurueckLU);
  pruefe(erg.ueberstand === 0, 'echter Ueberstand rundum -> 0: ' + erg.ueberstand);
  pruefe(erg.fallB === 50, 'fallB-Fall (rechts+unten buendig) -> 50: ' + erg.fallB);
  pruefe(erg.kanteMan === false && erg.innenMan === true,
    'eckenPmlPunkteInnen: r=0 auf der Kante -> false, r=50 innen -> true (Warnung im Fest-Modus)');
}

/* --- c) P-19 + materialIndexVorschlag --- */
{
  const ctx = editorKontext();
  wupLaden(ctx, testDatei());
  const erg = vm.runInContext(`
    (() => {
      pruefungenAusfuehren();
      const p19 = modell.pruefungen.filter(p => p.code === 'P-19');
      const gruppen = plattenIdxNullGruppen();
      return { anzahl: p19.length, level: p19[0] && p19[0].level, msg: p19[0] ? p19[0].msg : '',
        gruppen: gruppen.map(g => g.praefix + ':' + g.anzahl + ':' + (g.vorschlag ? g.vorschlag.idx : '-')).join(' | '),
        heuristik: [materialIndexVorschlag('OSB_3-Beplankung').idx,
                    materialIndexVorschlag('Gipsfaser_1-Beplankung').idx,
                    materialIndexVorschlag('Holzfasern-Daemmung').idx,
                    materialIndexVorschlag('Gipskartonplatte').idx,
                    materialIndexVorschlag('voellig unbekannt') === null ? 'null' : 'x'].join(',') };
    })()
  `, ctx);
  pruefe(erg.anzahl === 1 && erg.level === 'fehler', 'P-19 als FEHLER, eine Meldung je Namens-Gruppe: ' + erg.anzahl);
  pruefe(erg.msg.includes('OSB_3-Beplankung…') && erg.msg.includes('Vorschlag: 30 (OSB)'),
    'P-19-Meldung mit Namens-Praefix + Tabellen-Vorschlag: ' + erg.msg.slice(0, 90));
  pruefe(erg.gruppen === 'OSB_3-Beplankung:2:30', 'plattenIdxNullGruppen: 2 Platten, Vorschlag 30: ' + erg.gruppen);
  pruefe(erg.heuristik === '30,10,240,70,null', 'Heuristik OSB/Gipsfaser/Holzfaser/GKP/unbekannt: ' + erg.heuristik);
}

/* --- d) P-20 NR-Index-Whitelist --- */
{
  const ctx = editorKontext();
  wupLaden(ctx, testDatei());
  const erg = vm.runInContext(`
    (() => {
      pruefungenAusfuehren();
      const p20 = modell.pruefungen.filter(p => p.code === 'P-20');
      return { anzahl: p20.length, level: p20[0] && p20[0].level, msg: p20[0] ? p20[0].msg : '' };
    })()
  `, ctx);
  pruefe(erg.anzahl === 1 && erg.level === 'fehler', 'P-20: genau der Index-1-Fall als FEHLER (Index 10 ok): ' + erg.anzahl);
  pruefe(erg.msg.includes('Geraeteindex 1') && erg.msg.includes('10/11/20/25/32'),
    'P-20-Meldung nennt Index und Whitelist: ' + erg.msg.slice(0, 80));
}

/* --- e) P-21 + neigungenNullen --- */
{
  const ctx = editorKontext();
  wupLaden(ctx, testDatei());
  const erg = vm.runInContext(`
    (() => {
      pruefungenAusfuehren();
      const p21vor = modell.pruefungen.filter(p => p.code === 'P-21').length;
      const paf = modell.layers[0].ops.find(o => o.kw === 'PAF');
      const psf = modell.layers.find(l => l.id === 'PLA1').ops.find(o => o.kw === 'PSF');
      const n = neigungenNullen();
      const p21nach = modell.pruefungen.filter(p => p.code === 'P-21').length;
      return { p21vor, n, p21nach,
        pafAlpha: paf.poly.map(e => e.alpha).join(','), pafModified: !!paf._modified,
        psfAlphaBleibt: psf.poly[0].alpha === 5, undoTiefe: undoStack.length };
    })()
  `, ctx);
  pruefe(erg.p21vor === 1, 'P-21: geneigte PAF als FEHLER gemeldet: ' + erg.p21vor);
  pruefe(erg.n === 1 && erg.pafAlpha === '0,0' && erg.pafModified,
    'neigungenNullen: 1 Punkt korrigiert, alpha jetzt 0, _modified: ' + erg.pafAlpha);
  pruefe(erg.p21nach === 0, 'P-21 nach der Korrektur leer');
  pruefe(erg.psfAlphaBleibt, 'PSF-alpha bleibt unangetastet (kein PAF/PSG)');
  pruefe(erg.undoTiefe === 1, 'neigungenNullen = ein Undo-Schritt: ' + erg.undoTiefe);
}

/* --- f) P-22 NR-Index 25 in PLA + nrIndex25PlaKorrigieren --- */
{
  const ctx = editorKontext();
  wupLaden(ctx, testDatei());
  const erg = vm.runInContext(`
    (() => {
      pruefungenAusfuehren();
      const p22 = modell.pruefungen.filter(p => p.code === 'P-22');
      const n = nrIndex25PlaKorrigieren();
      pruefungenAusfuehren();
      const pliNr = modell.layers.find(l => l.id === 'PLI1').ops.filter(o => o.kw === 'NR').map(o => o.nr.i);
      const plaNr = modell.layers.find(l => l.id === 'PLA1').ops.filter(o => o.kw === 'NR').map(o => o.nr.i);
      return { anzahl: p22.length, level: p22[0] && p22[0].level, msg: p22[0] ? p22[0].msg : '',
        lageId: p22[0] && p22[0].lageId, n,
        p22nach: modell.pruefungen.filter(p => p.code === 'P-22').length,
        pliNr: pliNr.join(','), plaNr: plaNr.join(','), undoTiefe: undoStack.length };
    })()
  `, ctx);
  pruefe(erg.anzahl === 1 && erg.level === 'fehler' && erg.lageId === 'PLA1',
    'P-22: genau die PLA-Reihe mit Index 25 als FEHLER (PLI-25 erlaubt): ' + erg.anzahl);
  pruefe(erg.msg.includes('Geraeteindex 25') && erg.msg.includes('gehoert 20'),
    'P-22-Meldung erklaert die Maschinen-Umstellung 20->25: ' + erg.msg.slice(0, 80));
  pruefe(erg.n === 1 && erg.p22nach === 0, 'nrIndex25PlaKorrigieren: 1 Reihe korrigiert, P-22 danach leer');
  pruefe(erg.plaNr === '20', 'PLA-Reihe steht jetzt auf 20: ' + erg.plaNr);
  pruefe(erg.pliNr === '10,1,25', 'PLI-Reihen unangetastet (inkl. der erlaubten 25): ' + erg.pliNr);
  pruefe(erg.undoTiefe === 1, 'Korrektur = ein Undo-Schritt: ' + erg.undoTiefe);
}

if (fehler) {
  console.error('\nEcken/Grav-Smoke: ' + fehler + ' Fehler.');
  process.exit(1);
} else {
  console.log('\nEcken/Grav-Smoke: alle Pruefungen OK');
}
