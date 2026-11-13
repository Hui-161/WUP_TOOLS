/* =====================================================================
   AP3: NUMERISCHES SUCHEN & ERSETZEN (Strg+H) — Feld-Ersetzung statt
   Rohtext-Suchen/Ersetzen (wie frueher in Notepad++): trifft NIE versehentlich
   andere Werte, weil nur echte Datenfelder geprueft werden.
   Geprueft werden je Op (feld x/y/xy/z/t/steuercode/nrIndex/nrAbstand):
   poly-Elemente PP/KB/MP/TA (x/y je nach feld), nr (xa/xe = x-Achse,
   ya/ye = y-Achse, i = Geraeteindex, a = Abstand), nbr (x/y). Geschlossene
   Konturen: der doppelte Schlusspunkt (identische Koordinate wie der
   Startpunkt) wird durch die Feld-fuer-Feld-Ersetzung automatisch konsistent
   mitgeaendert — kein Sonderfall noetig, weil beide Punkte unabhaengig auf
   denselben Suchwert geprueft werden und bei Treffer beide denselben
   Ersatzwert erhalten.
   AP-WE2 (Anwenderwunsch: nicht nur x/y, auch Index/Name/Steuercode/z/BOZ
   aendern koennen, mit Lagen-/Typ-Filter): feld 'name' (Platten-Name, Text)
   und 'bozWert' (BOZ-Durchmesser an Bauteilen) laufen ueber eigene Funktionen
   (werteErsetzenName/werteErsetzenBoz), weil sie nicht auf Lagen-Ops, sondern
   auf Platten bzw. Bauteil-Bearbeitungen wirken. RUECKWAERTSKOMPATIBEL: alte
   Aufrufe mit optionen.achse (statt feld) verhalten sich exakt wie zuvor —
   siehe feldAusOptionen(). */
function feldAusOptionen(opt) {
  if (opt.feld) return opt.feld;
  if (opt.achse) return opt.achse === 'beide' ? 'xy' : opt.achse;
  return 'xy';
}
function werteErsetzenTreffer(op, optionen) {
  const feld = feldAusOptionen(optionen);
  const { suchwert, toleranz } = optionen;
  const pruefeX = feld === 'x' || feld === 'xy';
  const pruefeY = feld === 'y' || feld === 'xy';
  const passt = w => Math.abs(w - suchwert) <= toleranz;
  const passtExakt = w => Math.round(w) === Math.round(suchwert);
  const felder = [];
  if (feld === 'x' || feld === 'y' || feld === 'xy') {
    for (const e of (op.poly || [])) {
      if (e.type === 'PP' || e.type === 'KB' || e.type === 'MP' || e.type === 'TA') {
        if (pruefeX && passt(e.x)) felder.push([e, 'x']);
        if (pruefeY && passt(e.y)) felder.push([e, 'y']);
      }
    }
    if (op.nr) {
      if (pruefeX && passt(op.nr.xa)) felder.push([op.nr, 'xa']);
      if (pruefeX && passt(op.nr.xe)) felder.push([op.nr, 'xe']);
      if (pruefeY && passt(op.nr.ya)) felder.push([op.nr, 'ya']);
      if (pruefeY && passt(op.nr.ye)) felder.push([op.nr, 'ye']);
    }
    for (const n of (op.nbr || [])) {
      if (pruefeX && passt(n.x)) felder.push([n, 'x']);
      if (pruefeY && passt(n.y)) felder.push([n, 'y']);
    }
  } else if (feld === 'z') {
    for (const e of (op.poly || [])) if (e.z != null && passt(e.z)) felder.push([e, 'z']);
  } else if (feld === 't') {
    for (const e of (op.poly || [])) if (e.t != null && passt(e.t)) felder.push([e, 't']);
  } else if (feld === 'steuercode') {
    /* Nur PP/KB/MP tragen einen echten Steuercode i — EXAKTER Ganzzahl-
       Vergleich, keine Toleranz, damit nie ein benachbarter Code mitgetroffen wird */
    for (const e of (op.poly || [])) {
      if ((e.type === 'PP' || e.type === 'KB' || e.type === 'MP') && e.i != null && passtExakt(e.i)) felder.push([e, 'i']);
    }
  } else if (feld === 'radius') {
    /* Radius r gibt es nur an KB (Kreisbogen) und MP (Vollkreis). Vorzeichen
       bei MP = Drehrichtung — es wird der Wert INKLUSIVE Vorzeichen verglichen,
       damit die Drehrichtung nie versehentlich mitgeaendert wird. */
    for (const e of (op.poly || []))
      if ((e.type === 'KB' || e.type === 'MP') && e.r != null && passt(e.r)) felder.push([e, 'r']);
  } else if (feld === 'winkel') {
    /* Neigungswinkel alpha an PP/KB. Fehlendes alpha zaehlt als 0 (so wird es
       auch serialisiert), damit "0 -> x" alle ungeneigten Punkte findet. */
    for (const e of (op.poly || []))
      if ((e.type === 'PP' || e.type === 'KB') && passt(e.alpha == null ? 0 : e.alpha)) felder.push([e, 'alpha']);
  } else if (feld === 'nrIndex') {
    if (op.nr && op.nr.i != null && passtExakt(op.nr.i)) felder.push([op.nr, 'i']);
  } else if (feld === 'nrAbstand') {
    if (op.nr && op.nr.a != null && passt(op.nr.a)) felder.push([op.nr, 'a']);
  }
  return felder;
}
function werteErsetzenWertZuweisen(feld, ersatzwert) {
  return (feld === 'steuercode' || feld === 'nrIndex') ? Math.round(ersatzwert) : ersatzwert;
}
function werteErsetzen(optionen) {
  const opt = Object.assign({ achse: 'beide', toleranz: 0.01, bereich: 'sichtbar', nurVorschau: false,
    lagenFilter: null, typFilter: null, textModus: 'exakt',
    plattenNameFilter: null, plattenNameModus: 'exakt' }, optionen || {});
  opt.feld = feldAusOptionen(opt);
  if (!modell) return { treffer: 0, ops: [] };
  if (opt.feld === 'name') return werteErsetzenName(opt);
  if (opt.feld === 'bozWert') return werteErsetzenBoz(opt);
  if (WE_PLATTEN_FELDER.includes(opt.feld)) return werteErsetzenPlatte(opt);
  if (opt.suchwert == null || isNaN(opt.suchwert)) return { treffer: 0, ops: [] };
  let quelle;
  if (opt.bereich === 'auswahl') quelle = mehrfachOps();
  else if (opt.bereich === 'alle') quelle = modell.layers.flatMap(lage => lage.ops.map(op => ({ op, lage })));
  else quelle = sichtbareOpsFlach(); /* 'sichtbar' (Standard) */
  if (opt.lagenFilter) quelle = quelle.filter(f => opt.lagenFilter.includes(f.lage.id));
  if (opt.typFilter) quelle = quelle.filter(f => opt.typFilter.includes(f.op.kw));

  /* Erster Durchlauf: nur zaehlen (auch bei nurVorschau=false noetig, damit
     aenderungBeginnen() erst NACH dem Zaehlen und nur bei treffer > 0 laeuft) */
  let treffer = 0;
  const betroffen = [];
  for (const f of quelle) {
    const felder = werteErsetzenTreffer(f.op, opt);
    if (felder.length) { treffer += felder.length; betroffen.push(f); }
  }
  if (opt.nurVorschau || treffer === 0) return { treffer, ops: betroffen };

  aenderungBeginnen();
  for (const f of betroffen) {
    const felder = werteErsetzenTreffer(f.op, opt);
    for (const [obj, feld] of felder) obj[feld] = werteErsetzenWertZuweisen(opt.feld, opt.ersatzwert);
    f.op._modified = true;
  }
  alleNeuRendern(true);
  return { treffer, ops: betroffen };
}
/* AP-WE3: Platten-Kopfdaten gezielt ersetzen. Eigene Feldgruppe (Praefix
   'platte'), damit Platten-Werte NIE mit gleichnamigen Op-Werten verwechselt
   werden (z.B. Material-Index 30 der Platte vs. Steuercode 30 eines Punkts).
   platteX/platteY/platteXY wirken auf die UMRISS-Punkte; die Kopfzeile
   (x, y, lx, by) wird danach aus dem Umriss nachgefuehrt — dasselbe Muster
   wie beim Kantenverschieben (F6). Der doppelte Schlusspunkt geschlossener
   Umrisse bleibt automatisch synchron, weil jedes Feld einzeln geprueft wird. */
const WE_PLATTEN_FELDER = ['platteIdx', 'platteHz', 'platteZ', 'platteX', 'platteY', 'platteXY'];
function werteErsetzenPlatteFelder(platte, opt) {
  const passt = w => Math.abs(w - opt.suchwert) <= opt.toleranz;
  const passtExakt = w => Math.round(w) === Math.round(opt.suchwert);
  const felder = [];
  if (opt.feld === 'platteIdx') {
    /* Material-Index: exakter Ganzzahl-Vergleich, keine Toleranz */
    if (platte.materialIdx != null && !isNaN(platte.materialIdx) && passtExakt(platte.materialIdx))
      felder.push([platte, 'materialIdx']);
  } else if (opt.feld === 'platteHz') {
    if (platte.hz != null && !isNaN(platte.hz) && passt(platte.hz)) felder.push([platte, 'hz']);
  } else if (opt.feld === 'platteZ') {
    /* Nur Platten, die ueberhaupt ein z tragen — fehlendes z ("Wert wird
       berechnet", Weinmann 3.2.2) darf nicht stillschweigend gesetzt werden */
    if (platte.z != null && !isNaN(platte.z) && passt(platte.z)) felder.push([platte, 'z']);
  } else {
    const pruefeX = opt.feld === 'platteX' || opt.feld === 'platteXY';
    const pruefeY = opt.feld === 'platteY' || opt.feld === 'platteXY';
    for (const p of (platte.outline || [])) {
      if (pruefeX && passt(p[0])) felder.push([p, 0]);
      if (pruefeY && passt(p[1])) felder.push([p, 1]);
    }
  }
  return felder;
}
function werteErsetzenPlatteNachlauf(platte, feld) {
  if (feld !== 'platteX' && feld !== 'platteY' && feld !== 'platteXY') return;
  if (!platte.outline || !platte.outline.length) return;
  const xs = platte.outline.map(p => p[0]), ys = platte.outline.map(p => p[1]);
  platte.x = Math.min(...xs); platte.y = Math.min(...ys);
  platte.lx = Math.max(...xs) - platte.x;
  platte.by = Math.max(...ys) - platte.y;
}
function werteErsetzenPlatte(opt) {
  if (opt.suchwert == null || isNaN(opt.suchwert)) return { treffer: 0, ops: [] };
  let quelle;
  if (opt.bereich === 'auswahl') {
    const f = (ui.auswahl && ui.auswahl.typ === 'platte') ? platteFinden(ui.auswahl.id) : null;
    quelle = f ? [f] : [];
  } else if (opt.bereich === 'alle') {
    quelle = modell.layers.flatMap(lage => lage.plates.map(platte => ({ platte, lage })));
  } else {
    quelle = modell.layers.filter(lagenSichtbar).flatMap(lage => lage.plates.map(platte => ({ platte, lage })));
  }
  if (opt.lagenFilter) quelle = quelle.filter(f => opt.lagenFilter.includes(f.lage.id));
  /* AP-WE4/WE5 (Anwenderwunsch): nach vorhandenem Platten-Namen filtern.
     Modus 'exakt' (Standard) = Name muss exakt uebereinstimmen;
     Modus 'beginnt' = Name beginnt mit dem Filter (laufende Nummer am Ende
     wird ignoriert, z. B. "OSB_3-Beplankung" trifft ...-1410 UND ...-1411). */
  if (opt.plattenNameFilter) {
    const beginnt = opt.plattenNameModus === 'beginnt';
    quelle = quelle.filter(f => beginnt
      ? (f.platte.name || '').startsWith(opt.plattenNameFilter)
      : (f.platte.name || '') === opt.plattenNameFilter);
  }

  let treffer = 0;
  const betroffen = [];
  for (const f of quelle) {
    const felder = werteErsetzenPlatteFelder(f.platte, opt);
    if (felder.length) { treffer += felder.length; betroffen.push(f); }
  }
  if (opt.nurVorschau || treffer === 0) return { treffer, ops: betroffen };

  aenderungBeginnen();
  for (const f of betroffen) {
    const felder = werteErsetzenPlatteFelder(f.platte, opt);
    for (const [obj, feld] of felder)
      obj[feld] = opt.feld === 'platteIdx' ? Math.round(opt.ersatzwert) : opt.ersatzwert;
    werteErsetzenPlatteNachlauf(f.platte, opt.feld);
    f.platte._modified = true;
  }
  alleNeuRendern(true);
  return { treffer, ops: betroffen };
}
/* feld 'name': wirkt auf PLATTEN-Namen (platte.name), NICHT auf Bauteil-Namen
   (beams) — Bauteile werden nicht re-serialisiert, siehe Dialog-Hinweis. */
function werteErsetzenName(opt) {
  if (opt.suchwert == null || opt.suchwert === '') return { treffer: 0, ops: [] };
  const suchtext = String(opt.suchwert);
  const ersatztext = opt.ersatzwert == null ? '' : String(opt.ersatzwert);
  const enthaelt = opt.textModus === 'enthaelt';
  let quelle;
  if (opt.bereich === 'auswahl') {
    const f = (ui.auswahl && ui.auswahl.typ === 'platte') ? platteFinden(ui.auswahl.id) : null;
    quelle = f ? [f] : [];
  } else if (opt.bereich === 'alle') {
    quelle = modell.layers.flatMap(lage => lage.plates.map(platte => ({ platte, lage })));
  } else {
    quelle = modell.layers.filter(lagenSichtbar).flatMap(lage => lage.plates.map(platte => ({ platte, lage })));
  }
  if (opt.lagenFilter) quelle = quelle.filter(f => opt.lagenFilter.includes(f.lage.id));

  const treffend = f => {
    const name = f.platte.name || '';
    return enthaelt ? (suchtext !== '' && name.includes(suchtext)) : name === suchtext;
  };
  const betroffen = quelle.filter(treffend);
  const treffer = betroffen.length;
  if (opt.nurVorschau || treffer === 0) return { treffer, ops: betroffen };

  aenderungBeginnen();
  for (const f of betroffen) {
    const platte = f.platte;
    platte.name = enthaelt ? String(platte.name || '').split(suchtext).join(ersatztext) : ersatztext;
    platte._modified = true;
  }
  alleNeuRendern(true);
  return { treffer, ops: betroffen };
}
/* feld 'bozWert': BOZ (abgekuendigtes Kuerzel, siehe beamBozErsetzen) an
   Bauteilen — nur der Durchmesser (params[2]) wird geprueft/ersetzt, die
   Bearbeitung bleibt eine BOZ-Zeile (anders als beamBozErsetzen, das BOZ in
   PAF/MP umwandelt). Export ueber modell._zeilenErsetzungen, exakt nach dem
   dortigen Muster; bei mehrfachem Treffer auf derselben Zeile wird ein
   bestehender Eintrag aktualisiert statt dupliziert. */
function werteErsetzenBoz(opt) {
  if (opt.suchwert == null || isNaN(opt.suchwert)) return { treffer: 0, ops: [] };
  const toleranz = isNaN(opt.toleranz) ? 0.01 : opt.toleranz;
  const passt = w => Math.abs(w - opt.suchwert) <= toleranz;
  let beams;
  if (opt.bereich === 'auswahl') {
    beams = (ui.auswahl && ui.auswahl.typ === 'beam') ? modell.beams.filter(b => b.id === ui.auswahl.id) : [];
  } else if (opt.bereich === 'alle') {
    beams = modell.beams;
  } else {
    beams = ui.zeigeRiegel === false ? [] : modell.beams; /* 'sichtbar' */
  }

  const betroffen = [];
  for (const beam of beams) {
    for (const bb of (beam.bearbeitungen || [])) {
      if (bb.kw !== 'BOZ') continue;
      const d = zahl(bb.params[2]);
      if (!isNaN(d) && passt(d)) betroffen.push({ beam, bb });
    }
  }
  const treffer = betroffen.length;
  if (opt.nurVorschau || treffer === 0) return { treffer, ops: betroffen };

  aenderungBeginnen();
  modell._zeilenErsetzungen = modell._zeilenErsetzungen || [];
  for (const f of betroffen) {
    const { beam, bb } = f;
    bb.params = bb.params.slice();
    bb.params[2] = fmtZahl(opt.ersatzwert);
    const neueZeile = kwZeile('BOZ', bb.params);
    const bestehend = modell._zeilenErsetzungen.find(e => e.von === bb._zeile && e.bis === bb._zeileEnde);
    if (bestehend) bestehend.zeilen = [neueZeile];
    else modell._zeilenErsetzungen.push({ von: bb._zeile, bis: bb._zeileEnde, zeilen: [neueZeile] });
    beam._modified = true;
  }
  alleNeuRendern(true);
  return { treffer, ops: betroffen };
}
/* AP-WE3: Quelltext-Vorschau fuer den Suchen&Ersetzen-Dialog. Baut je
   betroffenem Objekt eine alt/neu-Gegenueberstellung der WUP-Zeilen —
   REIN LESEND (Klon + Serialisierung), das Modell wird nicht angefasst.
   "neu" zeigt exakt die Zeilen, die der Export schreiben wuerde: das Objekt
   wird durch die Ersetzung _modified und beim Export als Block neu
   serialisiert (Line-Replacement, siehe exportZeilenErzeugen). */
function werteErsetzenVorschauHunks(optionen, maxHunks) {
  const opt = Object.assign({ toleranz: 0.01, bereich: 'sichtbar' }, optionen || {}, { nurVorschau: true });
  opt.feld = feldAusOptionen(opt);
  const max = maxHunks || 60;
  const r = werteErsetzen(opt);
  const rohZeilen = (von, bis) => modell.rawLines.slice(von, bis + 1);
  const hunks = [];
  for (const f of r.ops.slice(0, max)) {
    let titel, zeileNr = null, alt, neu, anzahl;
    if (opt.feld === 'bozWert') {
      const { beam, bb } = f;
      titel = (beam.name ? beam.name + ' ' : '') + '(' + beam.kw + ') · BOZ';
      zeileNr = bb._zeile >= 0 ? bb._zeile + 1 : null;
      alt = zeileNr ? rohZeilen(bb._zeile, bb._zeileEnde != null ? bb._zeileEnde : bb._zeile) : [kwZeile('BOZ', bb.params)];
      const params = bb.params.slice();
      params[2] = fmtZahl(opt.ersatzwert);
      neu = [kwZeile('BOZ', params)];
      anzahl = 1;
    } else if (opt.feld === 'name' || WE_PLATTEN_FELDER.includes(opt.feld)) {
      const platte = f.platte;
      titel = f.lage.id + ' · Platte' + (platte.name ? ' „' + platte.name + '“' : ' ' + platte.id);
      zeileNr = platte._lineStart >= 0 ? platte._lineStart + 1 : null;
      alt = zeileNr ? rohZeilen(platte._lineStart, platte._lineEnd) : platteSerialisieren(platte);
      const klon = structuredClone(platte);
      if (opt.feld === 'name') {
        const ersatztext = opt.ersatzwert == null ? '' : String(opt.ersatzwert);
        klon.name = opt.textModus === 'enthaelt'
          ? String(klon.name || '').split(String(opt.suchwert)).join(ersatztext) : ersatztext;
        anzahl = 1;
      } else {
        const felder = werteErsetzenPlatteFelder(klon, opt);
        for (const [obj, feld] of felder)
          obj[feld] = opt.feld === 'platteIdx' ? Math.round(opt.ersatzwert) : opt.ersatzwert;
        werteErsetzenPlatteNachlauf(klon, opt.feld);
        anzahl = felder.length;
      }
      neu = platteSerialisieren(klon);
    } else {
      const op = f.op;
      titel = f.lage.id + ' · ' + op.kw;
      zeileNr = op._lineStart >= 0 ? op._lineStart + 1 : null;
      alt = zeileNr ? rohZeilen(op._lineStart, op._lineEnd) : opSerialisieren(op);
      const klon = structuredClone(op);
      const felder = werteErsetzenTreffer(klon, opt);
      for (const [obj, feld] of felder) obj[feld] = werteErsetzenWertZuweisen(opt.feld, opt.ersatzwert);
      neu = opSerialisieren(klon);
      anzahl = felder.length;
    }
    hunks.push({ titel, zeileNr, alt, neu, anzahl });
  }
  return { treffer: r.treffer, objekte: r.ops.length, hunks, mehr: Math.max(0, r.ops.length - hunks.length) };
}
const WE_FELDER = [
  { v: 'x', t: 'X-Koordinate' }, { v: 'y', t: 'Y-Koordinate' }, { v: 'xy', t: 'X + Y' },
  { v: 'z', t: 'Z-Wert' }, { v: 't', t: 'Tiefe t' }, { v: 'steuercode', t: 'Steuercode i' },
  { v: 'radius', t: 'Radius r (KB/MP)' }, { v: 'winkel', t: 'Neigungswinkel α' },
  { v: 'nrIndex', t: 'NR-Geraeteindex' }, { v: 'nrAbstand', t: 'NR-Abstand a' },
  { v: 'name', t: 'Platten-Name (Text)' }, { v: 'platteIdx', t: 'Platten-Materialindex' },
  { v: 'platteHz', t: 'Platten-Staerke hz' }, { v: 'platteZ', t: 'Platten-Position z' },
  { v: 'platteX', t: 'Platten-Umriss X' }, { v: 'platteY', t: 'Platten-Umriss Y' },
  { v: 'platteXY', t: 'Platten-Umriss X + Y' },
  { v: 'bozWert', t: 'BOZ-Durchmesser' }
];
/* Feld-Metadaten fuer den Dialog: Gruppe (op = Lagenbearbeitungen, platte,
   beam), exakter Ganzzahl-Vergleich (ohne Toleranz), Texteingabe, Einheit,
   und ein Kurzhinweis, WAS genau getroffen wird — damit der Anwender vor dem
   Ersetzen sieht, welche Datenfelder ueberhaupt in Frage kommen. */
const WE_FELD_INFO = {
  x:          { gruppe: 'op', einheit: 'mm', hinweis: 'X von PP/KB/MP/TA-Punkten, NR-Endpunkten (xa/xe) und NBR-Nagelbildern.' },
  y:          { gruppe: 'op', einheit: 'mm', hinweis: 'Y von PP/KB/MP/TA-Punkten, NR-Endpunkten (ya/ye) und NBR-Nagelbildern.' },
  xy:         { gruppe: 'op', einheit: 'mm', hinweis: 'X und Y gemeinsam — trifft beide Achsen unabhaengig voneinander.' },
  z:          { gruppe: 'op', einheit: 'mm', hinweis: 'Z-Position von Polygonpunkten (nur Punkte, die ein z tragen).' },
  t:          { gruppe: 'op', einheit: 'mm', hinweis: 'Tiefe t von Polygonpunkten (PP/KB/MP/TA). Vorzeichen wird mitverglichen.' },
  steuercode: { gruppe: 'op', exakt: true, hinweis: 'Steuercode i an PP/KB/MP — exakter Vergleich, trifft NIE benachbarte Codes.' },
  radius:     { gruppe: 'op', einheit: 'mm', hinweis: 'Radius r von KB-Kreisboegen und MP-Vollkreisen. Vorzeichen bei MP = Drehrichtung, wird mitverglichen.' },
  winkel:     { gruppe: 'op', einheit: '°', hinweis: 'Neigungswinkel α an PP/KB. Punkte ohne Winkelangabe zaehlen als 0°.' },
  nrIndex:    { gruppe: 'op', exakt: true, hinweis: 'Nagel-/Klammergeraet i von Nagelreihen — exakter Vergleich.' },
  nrAbstand:  { gruppe: 'op', einheit: 'mm', hinweis: 'Nagelabstand a von Nagelreihen.' },
  name:       { gruppe: 'platte', text: true, hinweis: 'Platten-Namen. Bauteil-Namen (Riegelwerk) aendert diese Version nicht.' },
  platteIdx:  { gruppe: 'platte', exakt: true, hinweis: 'Material-Index der Platten-Kopfzeile — exakter Vergleich. Steuercodes von Bearbeitungspunkten bleiben unberuehrt.' },
  platteHz:   { gruppe: 'platte', einheit: 'mm', hinweis: 'Plattenstaerke hz der Kopfzeile. Achtung: bei PP-Umrissen wird hz auch in die Umriss-Punkte geschrieben.' },
  platteZ:    { gruppe: 'platte', einheit: 'mm', hinweis: 'Z-Position der Platten-Kopfzeile. Platten ohne z-Angabe werden nicht angefasst.' },
  platteX:    { gruppe: 'platte', einheit: 'mm', hinweis: 'X der Umriss-Punkte; x/lx der Kopfzeile werden aus dem Umriss nachgefuehrt.' },
  platteY:    { gruppe: 'platte', einheit: 'mm', hinweis: 'Y der Umriss-Punkte; y/by der Kopfzeile werden aus dem Umriss nachgefuehrt.' },
  platteXY:   { gruppe: 'platte', einheit: 'mm', hinweis: 'X und Y der Umriss-Punkte; Kopfzeile wird nachgefuehrt.' },
  bozWert:    { gruppe: 'beam', einheit: 'mm', hinweis: 'Durchmesser d von BOZ-Bohrungen an Bauteilen (abgekuendigtes Kuerzel, bleibt BOZ-Zeile).' }
};
const WE_TYPEN = ['NR', 'PAF', 'PSG', 'PSF', 'PSZ', 'PML'];
/* AP-WE3: Zeilenpaar fuer die Quelltext-Vorschau parameterweise vergleichen
   und Unterschiede markieren. Rein textuell, wird nur fuers HTML gebraucht —
   bei abweichender Struktur (anderes Keyword / andere Parameterzahl) wird
   ohne Markierung escaped zurueckgegeben. */
function weZeilenPaarHtml(altZeile, neuZeile) {
  const zerlegen = z => {
    const m = /^(\S+)(\s+)(.*?)(;.*)?$/.exec(z || '');
    return m ? { kw: m[1], sep: m[2], params: m[3].split(','), rest: m[4] || '' } : null;
  };
  const a = zerlegen(altZeile), n = zerlegen(neuZeile);
  let altHtml = escapeHtml(altZeile), neuHtml = escapeHtml(neuZeile);
  if (a && n && a.kw === n.kw && a.params.length === n.params.length) {
    const anders = a.params.map((p, i) => {
      const x = parseFloat(p), y = parseFloat(n.params[i]);
      if (!isNaN(x) && !isNaN(y)) return Math.abs(x - y) > 1e-9;
      return p.trim() !== n.params[i].trim();
    });
    const bauen = teil => teil.kw === undefined ? '' : escapeHtml(teil.kw) + teil.sep
      + teil.params.map((p, i) => anders[i] ? '<mark class="we-mark">' + escapeHtml(p) + '</mark>' : escapeHtml(p)).join(',')
      + escapeHtml(teil.rest);
    altHtml = bauen(a);
    neuHtml = bauen(n);
  }
  return { altHtml, neuHtml };
}
/* Whitespace-normalisierter Zeilenvergleich: rohe Originalzeilen und neu
   serialisierte Zeilen duerfen sich in Fuellzeichen unterscheiden ("PAF;" vs
   "PAF     ;") — das ist WUP-semantisch identisch und KEINE Aenderung. */
function weZeileGleich(a, b) {
  return String(a).replace(/\s+/g, '') === String(b).replace(/\s+/g, '');
}
/* Ein Vorschau-Hunk als HTML: bei gleicher Zeilenzahl werden nur die
   geaenderten Zeilen als alt/neu-Paar gezeigt, unveraenderte Nachbarzeilen
   als gedimmter Zaehler zusammengefasst (grosse Konturen bleiben lesbar).
   Bei abweichender Zeilenzahl (selten) kompletter alt-Block, dann neu-Block. */
function weHunkHtml(hunk) {
  const teile = ['<div class="we-hunk"><div class="we-hunk-kopf">' + escapeHtml(hunk.titel)
    + (hunk.zeileNr ? ' — Zeile ' + hunk.zeileNr : ' — neu (noch ohne Zeile)')
    + ' · ' + hunk.anzahl + ' Wert(e)</div>'];
  const gleicheZahl = hunk.alt.length === hunk.neu.length;
  if (gleicheZahl) {
    let unveraendert = 0;
    const zwischenstand = () => {
      if (unveraendert > 0)
        teile.push('<div class="we-zeile-dim">· ' + unveraendert + ' unveraenderte Zeile(n)</div>');
      unveraendert = 0;
    };
    for (let i = 0; i < hunk.alt.length; i++) {
      if (weZeileGleich(hunk.alt[i], hunk.neu[i])) { unveraendert++; continue; }
      zwischenstand();
      const p = weZeilenPaarHtml(hunk.alt[i], hunk.neu[i]);
      teile.push('<div class="diff-zeile diff-zeile-alt">' + p.altHtml + '</div>'
        + '<div class="diff-zeile diff-zeile-neu">' + p.neuHtml + '</div>');
    }
    zwischenstand();
  } else {
    const MAX = 30;
    for (const z of hunk.alt.slice(0, MAX)) teile.push('<div class="diff-zeile diff-zeile-alt">' + escapeHtml(z) + '</div>');
    if (hunk.alt.length > MAX) teile.push('<div class="we-zeile-dim">… +' + (hunk.alt.length - MAX) + ' weitere Zeilen</div>');
    for (const z of hunk.neu.slice(0, MAX)) teile.push('<div class="diff-zeile diff-zeile-neu">' + escapeHtml(z) + '</div>');
    if (hunk.neu.length > MAX) teile.push('<div class="we-zeile-dim">… +' + (hunk.neu.length - MAX) + ' weitere Zeilen</div>');
  }
  teile.push('</div>');
  return teile.join('');
}
/* Fundstellen-Ansicht (Suchen ohne Ersatzwert): zeigt nur die alt-Zeilen der
   Treffer, markiert ueber den Vergleich mit einer Sentinel-Ersetzung
   (suchwert+1), die ausschliesslich der Positionsbestimmung dient. */
function weHunkFundHtml(hunk) {
  const teile = ['<div class="we-hunk"><div class="we-hunk-kopf">' + escapeHtml(hunk.titel)
    + (hunk.zeileNr ? ' — Zeile ' + hunk.zeileNr : ' — neu (noch ohne Zeile)')
    + ' · ' + hunk.anzahl + ' Fundstelle(n)</div>'];
  if (hunk.alt.length === hunk.neu.length) {
    let unveraendert = 0;
    const zwischenstand = () => {
      if (unveraendert > 0)
        teile.push('<div class="we-zeile-dim">· ' + unveraendert + ' Zeile(n) ohne Treffer</div>');
      unveraendert = 0;
    };
    for (let i = 0; i < hunk.alt.length; i++) {
      if (weZeileGleich(hunk.alt[i], hunk.neu[i])) { unveraendert++; continue; }
      zwischenstand();
      teile.push('<div class="diff-zeile we-zeile-fund">' + weZeilenPaarHtml(hunk.alt[i], hunk.neu[i]).altHtml + '</div>');
    }
    zwischenstand();
  } else {
    for (const z of hunk.alt.slice(0, 30)) teile.push('<div class="diff-zeile we-zeile-fund">' + escapeHtml(z) + '</div>');
    if (hunk.alt.length > 30) teile.push('<div class="we-zeile-dim">… +' + (hunk.alt.length - 30) + ' weitere Zeilen</div>');
  }
  teile.push('</div>');
  return teile.join('');
}
/* AP-WE5: Optionen fuer den Platten-Namensfilter. Oben die Praefix-Gruppe
   "Beginnend mit" (Name ohne laufende Nummer am Ende — trifft z. B. alle
   "OSB_3-Beplankung-…"), darunter die exakten Namen. Wert-Kodierung
   'anfang:…' / 'exakt:…' — ':' ist in WUP-Namen nicht erlaubt
   (Weinmann 3.2.2) und damit kollisionsfrei. */
function weNameFilterOptionenHtml(namen) {
  const praefixe = Array.from(new Set(
    namen.filter(n => /-\d+$/.test(n)).map(n => n.replace(/-\d+$/, '')).filter(Boolean))).sort();
  let html = '<option value="">— alle Namen —</option>';
  if (praefixe.length)
    html += '<optgroup label="Beginnend mit (Nummer am Ende ignorieren)">'
      + praefixe.map(p => '<option value="anfang:' + escapeHtml(p) + '">' + escapeHtml(p) + '-…</option>').join('')
      + '</optgroup>';
  html += '<optgroup label="Exakter Name">'
    + namen.map(n => '<option value="exakt:' + escapeHtml(n) + '">' + escapeHtml(n) + '</option>').join('')
    + '</optgroup>';
  return html;
}
function weNameFilterLesen(wert) {
  if (!wert) return { plattenNameFilter: null, plattenNameModus: 'exakt' };
  if (wert.indexOf('anfang:') === 0) return { plattenNameFilter: wert.slice(7), plattenNameModus: 'beginnt' };
  return { plattenNameFilter: wert.replace(/^exakt:/, ''), plattenNameModus: 'exakt' };
}
