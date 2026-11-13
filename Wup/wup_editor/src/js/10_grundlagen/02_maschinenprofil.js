/* =====================================================================
   §10 MASCHINENPROFIL (konfigurierbar, localStorage)
   ===================================================================== */
/* GERAETEBELEGUNG — BEISPIEL (v2.62): welches Nagel-/Klammergeraet hinter
   welchem NR-Index steht, ist je Anlage verschieden. Diese Liste ist der
   Vorschlag im Dialog "Geraetebelegung" (67_geraetebelegung.js); ist die
   Belegung im Profil leer, fragt der Editor beim Start danach. */
const NR_INDIZES_BEISPIEL = {
  10: { name: 'Klammer S540 25-65 (OSB, Hub unten)',        psf_offset: 7 },
  11: { name: 'Klammer S540 25-65 (Gips, Hub oben)',        psf_offset: 7 },
  20: { name: 'Breitrueckenklammer S640 50-80 (Steico)',    psf_offset: 20 },
  25: { name: 'Breitrueckenklammer S640 70-130 (Weichfaser)', psf_offset: 20 },
  32: { name: 'Coilnagler CW650 (Lattenschuh, nur mit NBR)', psf_offset: 20 }
};
const PROFIL_STANDARD = {
  name: 'Standard',
  wand_max: { lx: 12000, by: 3800, hz: 600 },
  saege:    { tiefe_max: 80, blattbreite: 3 },
  fraeser:  { tiefe_max: 98 },
  freistich:{ radius_holz: 10, radius_abrasiv: 8, steuercode: 301, korrektur_erben: true,
              variante: 'klassisch',   /* 'klassisch' = PAF-Polyzug (Standard) · 'mp' = Rundfraesung */
              klassisch_laenge: 94,     /* Schenkellaenge entlang jeder Kante [mm] */
              klassisch_steuercode: 222,        /* i am ECKpunkt (unterschneiden) */
              klassisch_steuercode_enden: 212   /* i an beiden freien Enden (ueberschneiden) — E21, v2.58 */ },
  /* Fraeser je Materialgruppe: T101 d=20 Holzwerkstoffe / T111 d=16 abrasiv */
  bm_abrasiv: [[10,19],[50,89],[100,109],[130,159],[170,189]],
  nr_indizes: {},   /* leer: der Editor fragt beim ersten Start (Dialog Geraetebelegung) */
  default_offset_unbekannt: 20,
  luftdicht_regel_aktiv: true,
  autoKontur: { maxLuecke: 150 }, /* P-11: max. Luecke [mm] fuer PSG-Kollinear-Zusammenfassung */
  export: { dateiname: 'original', diffZeigen: true }, /* P-4: Export-Einstellungen */
  wupworks: { adresse: '', port: 45070 }, /* AP1: WupWorks5-Anbindung (Weinmann-Maschinensoftware) */
  /* WP-D: RICHTUNGSBEARBEITUNG (Hauskonvention) — Bohrung im Ober-/
     Untergurt zur Lage-/Richtungskennzeichnung fuer den Abgleich WUP <->
     Abbund-Datei. Reale SEMA-Exporte: BOZ 100, y,
     40, 2 mit TXT ***BOHRUNG_BOZ***. tiefe positiv = Konvention der
     vorhandenen Datensaetze (laut Anwender die PLI-Seite des Riegelwerks). */
  richtung: {
    durchmesser: 40, d_toleranz: 2,   /* akzeptierter Bohrdurchmesser [mm] */
    tiefe: 2, tiefe_min: 1, tiefe_max: 5, /* Soll-Tiefe + akzeptierter Bereich [mm] */
    abstand_ende: 100,                /* Auto-Erzeugung: Abstand vom Bauteilanfang [mm] */
    mitte_sperrzone: 0.15             /* Anteil der Laenge je Seite der Mitte, in dem die Zuordnung Anfang/Ende als NICHT eindeutig gilt */
  }
};
let profil;
/* v2.63: als Funktion, damit ein anderes Fenster (die Uebersicht) das Profil
   neu einlesen kann, nachdem der Editor es gespeichert hat. */
function profilNeuLaden() {
  profil = Object.assign({}, PROFIL_STANDARD, speicherLaden('profil', {}));
  /* freistich tief mergen: aeltere gespeicherte Profile kennen variante/
     klassisch_* noch nicht und wuerden den ganzen Block sonst ausduennen */
  profil.freistich = Object.assign({}, PROFIL_STANDARD.freistich, profil.freistich || {});
  profil.autoKontur = Object.assign({}, PROFIL_STANDARD.autoKontur, profil.autoKontur || {});
  profil.export = Object.assign({}, PROFIL_STANDARD.export, profil.export || {});
  profil.wupworks = Object.assign({}, PROFIL_STANDARD.wupworks, profil.wupworks || {});
  profil.richtung = Object.assign({}, PROFIL_STANDARD.richtung, profil.richtung || {});
}
profilNeuLaden();
function profilSichern() { speicherSichern('profil', profil); }

/* Material-Klassen Weinmann 4.3 (Anzeige + P-17) */
const MATERIAL_KLASSEN = [
  [1,9,'Holzbauteil'],[10,19,'Fermacell'],[20,29,'Weichfaserplatte'],[30,39,'OSB'],
  [40,49,'Spanplatte'],[50,59,'Putztraegerplatte'],[60,69,'Gips'],[70,79,'Gipskartonplatte'],
  [80,89,'Kunststoffplatte'],[90,99,'Sperrholzplatte'],[100,109,'Putz'],[110,119,'Verschalung'],
  [120,129,'Dreischichtplatte'],[130,139,'Leim'],[140,149,'Daemmplatte Diffutherm'],
  [150,159,'Daemmplatte Heraklith'],[160,169,'Bohlen'],[170,179,'Klebeband/Tape'],
  [180,189,'Folie/Dampfsperre (versatzneutral)'],[190,199,'Multiplexplatte'],
  [200,209,'Hartfaserplatte'],[210,219,'Profilierte Platte'],[220,229,'Porenbeton'],
  [230,239,'Gefachdaemmung Zellulose'],[240,249,'Gefachdaemmung Holzweichfaser'],
  [250,259,'Gefachdaemmung Mineralwolle']
];
function materialKlasse(idx) {
  if (idx == null || isNaN(idx)) return '';
  for (const [von, bis, name] of MATERIAL_KLASSEN) if (idx >= von && idx <= bis) return name;
  return idx === 0 ? 'nicht gesetzt' : 'unbekannt';
}
function istAbrasiv(idx) {
  if (idx == null) return false;
  return profil.bm_abrasiv.some(([von, bis]) => idx >= von && idx <= bis);
}

