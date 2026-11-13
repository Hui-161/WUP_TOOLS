function beamHolen() {
  const f = auswahlAufloesen();
  return f && f.beam ? f.beam : null;
}
/* WP-D: fehlende RICHTUNGSBEARBEITUNGEN erzeugen — reine Kernfunktion
   (headless testbar). Je Ober-/Untergurt ohne erkannte Richtungsbohrung wird
   eine BOZ nach Hauskonvention eingefuegt: Ø/Tiefe aus profil.richtung,
   x = abstand_ende vom Bauteilanfang (eindeutige Ende-Zuordnung), y = mittig
   auf der Gurtbreite, t POSITIV (Konvention der realen Datensaetze = laut
   Anwender die PLI-Seite des Riegelwerks). Export ueber _zeilenErsetzungen
   direkt hinter der Bauteil-Kopfzeile, mit TXT-Marker wie im SEMA-Export.
   Rueckgabe: Anzahl erzeugter Bohrungen (0 = nichts zu tun, kein Undo-Punkt). */
function richtungsbearbeitungenErzeugen() {
  if (!modell) return 0;
  const r = profil.richtung;
  const kandidaten = modell.beams.filter(b =>
    (b.kw === 'OG' || b.kw === 'UG') && b._lineStart >= 0 && !richtungsbearbeitungFinden(b).length);
  if (!kandidaten.length) return 0;
  aenderungBeginnen();
  modell._zeilenErsetzungen = modell._zeilenErsetzungen || [];
  for (const beam of kandidaten) {
    const laenge = beam.lx || 0;
    /* kurze Gurte: Bohrung bei L/4, sonst fester Abstand vom Anfang */
    const bx = laenge > 0 && laenge < 2 * r.abstand_ende ? Math.max(r.durchmesser, laenge / 4) : r.abstand_ende;
    const byPos = (beam.by || 0) / 2;
    const params = [fmtZahl(bx), fmtZahl(byPos), fmtZahl(r.durchmesser), fmtZahl(r.tiefe)];
    const txtZeile = 'TXT'.padEnd(8, ' ') + '***BOHRUNG_BOZ*** RICHTUNG (AUTO);';
    const bozZeile = kwZeile('BOZ', params);
    const bestehend = modell._zeilenErsetzungen.find(e => e.von === beam._lineStart && e.bis === beam._lineStart);
    if (bestehend) bestehend.zeilen = bestehend.zeilen.concat([txtZeile, bozZeile]);
    else modell._zeilenErsetzungen.push({ von: beam._lineStart, bis: beam._lineStart,
      zeilen: [modell.rawLines[beam._lineStart], txtZeile, bozZeile] });
    /* Modell nachziehen (Anzeige + P-18 sofort gruen). _zeile = -1: existiert
       noch nicht in rawLines — Loeschen/Konvertieren erst nach Export+Neuladen
       (Guards in beamBozErsetzen/beamBearbLoeschen). */
    beam.bearbeitungen.push({ kw: 'BOZ', params, poly: [], _zeile: -1, _zeileEnde: -1, _beam: beam, auto: 'richtung' });
    beam._modified = true;
  }
  return kandidaten.length;
}
function autoRichtungAusfuehren() {
  if (!modell) return;
  const r = profil.richtung;
  const offen = modell.beams.filter(b =>
    (b.kw === 'OG' || b.kw === 'UG') && b._lineStart >= 0 && !richtungsbearbeitungFinden(b).length);
  if (!offen.length) {
    hinweisAnzeigen('Alle Ober-/Untergurte haben bereits eine Richtungsbearbeitung.', 'info');
    return;
  }
  bestaetigen('Fuer ' + offen.length + ' Gurt(e) ohne Richtungsbearbeitung eine Bohrung BOZ Ø'
    + fmtZahl(r.durchmesser) + ' mm, Tiefe ' + fmtZahl(r.tiefe) + ' mm (PLI-Seite) erzeugen? '
    + '⚠ WICHTIG: Die Bohrung entsteht NUR in der WUP-Datei — in der Abbund-Datei (BVN/BVX) wird sie '
    + 'NICHT automatisch erzeugt und muss dort separat vorhanden sein (gleiche Referenzseite und '
    + 'gleiches Bauteilende; die X-Position darf abweichen).', 'Erzeugen', () => {
    const n = richtungsbearbeitungenErzeugen();
    alleNeuRendern(true);
    hinweisAnzeigen(n + ' Richtungsbohrung(en) erzeugt (Ø' + fmtZahl(r.durchmesser) + ', t=+' + fmtZahl(r.tiefe)
      + ' = PLI-Seite). Abbund-Datei (BVN/BVX) separat ergaenzen!', 'erfolg');
  });
}
/* v2.60 (Anwenderwunsch 2026-11-10 "Funktion anbieten, die BOZ in PAF mit
   MP abzuaendern", P-24): BOZ ist seit Schnittstelle 3.4 abgekuendigt
   ("PAF / MP ersetzt BOZ", Weinmann S. 14/28). Umrechnung je Bohrung:
     PAF 2                    ANWENDER-ENTSCHEIDUNG 2026-11-10: "Immer
                              Ebene 2" — unabhaengig vom Vorzeichen der
                              BOZ-Tiefe (SEMA schreibt +2, Granit -3)
     MP x, y, d/2, |t|, 211   (Bauteil-/Ebenen-Koordinaten, Code wie das
                              Weinmann-Beispiel)
   BEWUSST: kein Ebene-4-Zweig — nicht "nach Vorzeichen verbessern".
   Rueckgabe: { zeilen, modellBb } oder { grund }. */
function bozPafUmrechnung(beam, bb) {
  if (!bb || bb.kw !== 'BOZ') return { grund: 'keine BOZ' };
  if (bb._zeile < 0) return { grund: 'neu erzeugt — erst nach Export und Neuladen' };
  const x = zahl(bb.params[0]), y = zahl(bb.params[1]), d = zahl(bb.params[2]), tRoh = zahl(bb.params[3]);
  if ([x, y, d, tRoh].some(v => isNaN(v)) || d <= 0) return { grund: 'Werte unvollstaendig' };
  const ebene = 2;
  const t = Math.abs(tRoh), off = beam._off || [0, 0];
  return {
    ebene,
    zeilen: [kwZeile('PAF', [ebene]), kwZeile('MP', [fmtZahl(x), fmtZahl(y), fmtZahl(d / 2), fmtZahl(t), 211])],
    modellBb: { kw: 'PAF', params: [String(ebene)], _zeile: bb._zeile, _zeileEnde: bb._zeileEnde, _beam: beam,
      poly: [{ type: 'MP', x: x + off[0], y: y + off[1], r: d / 2, t, i: 211, raw: [] }] }
  };
}
function bozUmstellen(beam, idx, u) {
  const bb = beam.bearbeitungen[idx];
  modell._zeilenErsetzungen = modell._zeilenErsetzungen || [];
  modell._zeilenErsetzungen.push({ von: bb._zeile, bis: bb._zeileEnde, zeilen: u.zeilen });
  beam.bearbeitungen[idx] = u.modellBb;
  beam._modified = true;
}
/* Alle BOZ in PLATTENLAGEN umstellen (Anwender: "nur die BOZ in der
   Platten Lagen" — Riegelwerk-BOZ = Richtungsbohrung bleiben). Plattenlage:
   "PAF 2;" (Weinmann S. 30: PAF [e], e Standard 2) + "MP x, y, d/2, |t|, 211"
   mit den ROHEN Koordinaten der Zeile (MODUL-relativ wie im Original).
   Headless (Editor-Popup, Uebersicht ueber den Kern). Genau EIN Undo-
   Schritt, nur bei Treffern. Bis zum Export/Neuladen bleibt der Eintrag in
   lage.bohrungen mit _umgestellt (Anzeige in PAF-Farbe, P-24 still).
   Rueckgabe: { ersetzt, uebersprungen: [Text] }. */
function bozAlleErsetzen() {
  const erg = { ersetzt: 0, uebersprungen: [] };
  if (!modell) return erg;
  const plan = [];
  for (const lage of modell.layers)
    for (const b of (lage.bohrungen || [])) {
      if (b._umgestellt) continue;
      const x = zahl(b.params[0]), y = zahl(b.params[1]), d = zahl(b.params[2]), t = zahl(b.params[3]);
      if ([x, y, d, t].some(v => isNaN(v)) || d <= 0) {
        erg.uebersprungen.push(lage.id + ' BOZ ' + b.params.join(',').trim() + ' — Werte unvollstaendig');
        continue;
      }
      plan.push({ b, zeilen: [kwZeile('PAF', [2]), kwZeile('MP', [fmtZahl(x), fmtZahl(y), fmtZahl(d / 2), fmtZahl(Math.abs(t)), 211])] });
    }
  if (!plan.length) return erg;
  aenderungBeginnen();
  modell._zeilenErsetzungen = modell._zeilenErsetzungen || [];
  for (const p of plan) {
    modell._zeilenErsetzungen.push({ von: p.b._zeile, bis: p.b._zeile, zeilen: p.zeilen });
    p.b._umgestellt = true;
  }
  erg.ersetzt = plan.length;
  alleNeuRendern(true);
  return erg;
}
function beamBozErsetzen(idx) {
  /* BOZ (abgekuendigt) -> PAF Ebene 2 + MP (v2.60, Anwender: immer Ebene 2) */
  const beam = beamHolen();
  if (!beam) return;
  const bb = beam.bearbeitungen[idx];
  if (!bb || bb.kw !== 'BOZ') return;
  const u = bozPafUmrechnung(beam, bb);
  if (!u.zeilen) { hinweisAnzeigen('BOZ nicht umgestellt: ' + u.grund + '.', 'warnung'); return; }
  aenderungBeginnen();
  bozUmstellen(beam, idx, u);
  alleNeuRendern(true);
  const d = zahl(bb.params[2]);
  hinweisAnzeigen('BOZ → PAF (Ebene 2) + MP r=' + fmtZahl(d / 2) + ' (aus d=' + fmtZahl(d) + '), Code 211.', 'erfolg');
}
function beamBearbLoeschen(idx) {
  const beam = beamHolen();
  if (!beam) return;
  const bb = beam.bearbeitungen[idx];
  if (!bb) return;
  if (bb._zeile < 0) { hinweisAnzeigen('Neu erzeugte Richtungsbohrung: Loeschen erst nach Export + Neuladen moeglich (oder Strg+Z direkt nach dem Erzeugen).', 'warnung'); return; }
  const gurt = beam.kw === 'UG' || beam.kw === 'OG';
  const markier = gurt && (bb.kw === 'BOZ' || (bb.kw === 'PAF' && bb.poly.length === 1 && bb.poly[0].type === 'MP'));
  const frage = markier
    ? '⚠ Das sieht nach einer Markierbohrung am ' + (beam.kw === 'UG' ? 'Untergurt' : 'Obergurt')
      + ' aus — die gehoert normalerweise zum Datensatz. Trotzdem loeschen?'
    : bb.kw + ' am Bauteil ' + (beam.name || beam.kw) + ' wirklich loeschen?';
  bestaetigen(frage, 'Loeschen', () => {
    aenderungBeginnen();
    modell._zeilenErsetzungen = modell._zeilenErsetzungen || [];
    modell._zeilenErsetzungen.push({ von: bb._zeile, bis: bb._zeileEnde, zeilen: [] });
    beam.bearbeitungen.splice(idx, 1);
    beam._modified = true;
    alleNeuRendern(true);
    hinweisAnzeigen(bb.kw + ' entfernt.', 'erfolg');
  });
}
function konturenVerbinden(kandidaten) {
  /* Offene PAF/PSG zu einer Kette verbinden (Ende A == Start B, Toleranz 1 mm).
     Richtung einzelner Teilstuecke wird bei Bedarf umgedreht. */
  if (kandidaten.length < 2) { hinweisAnzeigen('Mindestens 2 offene Konturen auswaehlen.', 'warnung'); return; }
  if (new Set(kandidaten.map(k => k.lage.id)).size > 1) {
    hinweisAnzeigen('Verbinden geht nur innerhalb einer Lage.', 'warnung'); return;
  }
  if (new Set(kandidaten.map(k => k.op.kw)).size > 1) {
    hinweisAnzeigen('Nur gleichartige Bearbeitungen (alle PAF oder alle PSG) verbinden.', 'warnung'); return;
  }
  const TOL = 1.0;
  const gleich = (p, q) => Math.hypot(p.x - q.x, p.y - q.y) <= TOL;
  const rest = kandidaten.slice();
  const kette = rest.shift();
  let punkte = kette.op.poly.filter(e => e.type === 'PP' || e.type === 'KB');
  if (punkte.length < 2) { hinweisAnzeigen('Erste Kontur hat zu wenige Punkte.', 'warnung'); return; }
  let fortschritt = true;
  while (rest.length && fortschritt) {
    fortschritt = false;
    for (let i = 0; i < rest.length; i++) {
      let p2 = rest[i].op.poly.filter(e => e.type === 'PP' || e.type === 'KB');
      if (p2.length < 2) { rest.splice(i, 1); fortschritt = true; break; }
      const ende = punkte[punkte.length - 1], start = punkte[0];
      if (gleich(ende, p2[0]))            { punkte = punkte.concat(p2.slice(1)); }
      else if (gleich(ende, p2[p2.length - 1])) { punkte = punkte.concat(p2.slice(0, -1).reverse()); }
      else if (gleich(start, p2[p2.length - 1])) { punkte = p2.slice(0, -1).concat(punkte); }
      else if (gleich(start, p2[0]))      { punkte = p2.slice(1).reverse().concat(punkte); }
      else continue;
      rest.splice(i, 1);
      fortschritt = true;
      break;
    }
  }
  if (rest.length) {
    hinweisAnzeigen(rest.length + ' Kontur(en) passen nicht an die Kette (Enden treffen sich nicht, Toleranz 1 mm).', 'warnung');
    return;
  }
  aenderungBeginnen();
  const ziel = kandidaten[0].op, lage = kandidaten[0].lage;
  ziel.poly = punkte;
  ziel.closed = gleich(punkte[0], punkte[punkte.length - 1]);
  ziel._modified = true;
  for (const k of kandidaten.slice(1)) {
    if (!k.op._neu && k.op._lineStart >= 0) {
      lage._geloeschteOps = lage._geloeschteOps || [];
      lage._geloeschteOps.push({ _lineStart: k.op._lineStart, _lineEnd: k.op._lineEnd });
    }
    const idx = lage.ops.indexOf(k.op);
    if (idx >= 0) lage.ops.splice(idx, 1);
  }
  ui.mehrAuswahl = [];
  alleNeuRendern();
  auswahlSetzen({ typ: 'op', id: ziel.id, lageId: lage.id });
  hinweisAnzeigen(kandidaten.length + ' Konturen zu einer ' + ziel.kw + '-Kette verbunden ('
    + punkte.length + ' Punkte' + (ziel.closed ? ', geschlossen' : ', offen') + '). Jetzt Auto ⊕⊖ anwenden.', 'erfolg');
}
/* ---- P-11/12: Auto-Kontur (headless testbare Kernfunktionen) ---- */
function offeneKettenGruppieren(kandidaten) {
  /* Gruppiert Kandidaten { op, lage } (gleiche Lage + kw vorausgesetzt vom Aufrufer)
     nach beruehrenden Enden (Toleranz 1 mm) — wie konturenVerbinden(), aber OHNE
     UI-Warnungen und OHNE dass eine vollstaendige Kette erzwungen wird: liefert alle
     zusammenhaengenden Gruppen (auch Gruppen der Groesse 1, die nichts verbindet). */
  const TOL = 1.0;
  const gleich = (p, q) => Math.hypot(p.x - q.x, p.y - q.y) <= TOL;
  const rest = kandidaten.slice();
  const gruppen = [];
  while (rest.length) {
    const seed = rest.shift();
    const teile = [seed];
    let punkte = seed.op.poly.filter(e => e.type === 'PP' || e.type === 'KB');
    if (punkte.length >= 2) {
      let fortschritt = true;
      while (rest.length && fortschritt) {
        fortschritt = false;
        for (let i = 0; i < rest.length; i++) {
          const p2 = rest[i].op.poly.filter(e => e.type === 'PP' || e.type === 'KB');
          if (p2.length < 2) continue;
          const ende = punkte[punkte.length - 1], start = punkte[0];
          if (gleich(ende, p2[0]))                 punkte = punkte.concat(p2.slice(1));
          else if (gleich(ende, p2[p2.length - 1])) punkte = punkte.concat(p2.slice(0, -1).reverse());
          else if (gleich(start, p2[p2.length - 1])) punkte = p2.slice(0, -1).concat(punkte);
          else if (gleich(start, p2[0]))            punkte = p2.slice(1).reverse().concat(punkte);
          else continue;
          teile.push(rest[i]);
          rest.splice(i, 1);
          fortschritt = true;
          break;
        }
      }
    }
    gruppen.push({ teile, punkte });
  }
  return gruppen;
}
function kollineareSegmenteZusammenfassen(segmente, maxLuecke) {
  /* Reine Funktion (kein DOM). segmente: [{ a:[x,y], b:[x,y], op }, ...] — je ein
     gerades 2-Punkt-Segment. Gruppiert nach gemeinsamer unendlicher Gerade
     (Geo.kollinear, Toleranz 1 mm), sortiert innerhalb der Geraden nach Projektion
     und fasst konsekutive Segmente zusammen, solange die Luecke < maxLuecke ist
     (und > -Toleranz, d.h. auch ueberlappende/anstossende Segmente).
     SICHERHEIT: es wird NIE ueber eine Luecke >= maxLuecke oder zwischen
     nicht-kollinearen Segmenten hinweg zusammengefasst — die Saege wuerde sonst
     durch unbearbeiteten Zwischenraum fahren.
     Rueckgabe: [{ op, a, b, verbraucht:[op,...] }, ...] — je Gruppe die
     zusammengefasste Strecke (a..b, Weltkoordinaten) + die aufgegangenen Original-Ops. */
  const TOL = 1.0;
  const rest = segmente.slice();
  const gruppen = [];
  while (rest.length) {
    const seed = rest.shift();
    const cluster = [seed];
    for (let i = rest.length - 1; i >= 0; i--) {
      if (Geo.kollinear(seed.a, seed.b, rest[i].a, rest[i].b, TOL)) {
        cluster.push(rest[i]);
        rest.splice(i, 1);
      }
    }
    if (cluster.length === 1) {
      gruppen.push({ op: seed.op, a: seed.a, b: seed.b, verbraucht: [seed.op] });
      continue;
    }
    const u = Geo.norm([seed.b[0] - seed.a[0], seed.b[1] - seed.a[1]]);
    const proj = p => (p[0] - seed.a[0]) * u[0] + (p[1] - seed.a[1]) * u[1];
    const teile = cluster.map(s => {
      const ta = proj(s.a), tb = proj(s.b);
      return { seg: s, tmin: Math.min(ta, tb), tmax: Math.max(ta, tb) };
    }).sort((x, y) => x.tmin - y.tmin);
    const weltpunkt = t => [seed.a[0] + t * u[0], seed.a[1] + t * u[1]];
    const abschliessen = (kette, ketteMin, ketteMax) => {
      gruppen.push({ op: kette[0].seg.op, a: weltpunkt(ketteMin), b: weltpunkt(ketteMax),
        verbraucht: kette.map(k => k.seg.op) });
    };
    let kette = [teile[0]], ketteMin = teile[0].tmin, ketteMax = teile[0].tmax;
    for (let i = 1; i < teile.length; i++) {
      const t = teile[i];
      const luecke = t.tmin - ketteMax;
      if (luecke < maxLuecke && luecke > -TOL) {
        kette.push(t);
        ketteMax = Math.max(ketteMax, t.tmax);
      } else {
        abschliessen(kette, ketteMin, ketteMax);
        kette = [t]; ketteMin = t.tmin; ketteMax = t.tmax;
      }
    }
    abschliessen(kette, ketteMin, ketteMax);
  }
  return gruppen;
}
function autoKonturVerbinden() {
  /* P-11/12: ueber alle sichtbaren Lagen automatisch Bearbeitungen zusammenfassen,
     um Maschinen-Absetzen zu sparen — PAF/PSF mit gemeinsamen Endpunkten verketten
     + PSG-Geradenstuecke in gleicher Achse mit kleiner Luecke zusammenfassen. */
  if (!modell) return;
  const r3 = n => Math.round(n * 1000) / 1000;
  const gleich = (p, q) => Math.hypot(p.x - q.x, p.y - q.y) <= 1.0;
  let aenderungGemacht = false, entfernt = 0;
  const loeschenVormerken = (lage, op) => {
    if (!op._neu && op._lineStart >= 0) {
      lage._geloeschteOps = lage._geloeschteOps || [];
      lage._geloeschteOps.push({ _lineStart: op._lineStart, _lineEnd: op._lineEnd });
    }
    const idx = lage.ops.indexOf(op);
    if (idx >= 0) lage.ops.splice(idx, 1);
  };
  const naechsterPunkt = (op, weltPt) => {
    const pts = op.poly.filter(e => e.type === 'PP' || e.type === 'KB');
    let best = pts[0], bestD = Infinity;
    for (const p of pts) {
      const d = Math.hypot(p.x - weltPt[0], p.y - weltPt[1]);
      if (d < bestD) { bestD = d; best = p; }
    }
    return best;
  };
  for (const lage of modell.layers.filter(lagenSichtbar)) {
    /* 1) PAF/PSF: offene Konturen mit gemeinsamen Endpunkten verketten */
    for (const kw of ['PAF', 'PSF']) {
      const kandidaten = lage.ops.filter(o => o.kw === kw && !o.closed).map(op => ({ op, lage }));
      if (kandidaten.length < 2) continue;
      for (const g of offeneKettenGruppieren(kandidaten)) {
        if (g.teile.length < 2 || g.punkte.length < 2) continue;
        if (!aenderungGemacht) { aenderungBeginnen(); aenderungGemacht = true; }
        const ziel = g.teile[0].op;
        ziel.poly = g.punkte;
        ziel.closed = gleich(g.punkte[0], g.punkte[g.punkte.length - 1]);
        ziel._modified = true;
        for (const teil of g.teile.slice(1)) loeschenVormerken(lage, teil.op);
        entfernt += g.teile.length - 1;
      }
    }
    /* 2) PSG: gerade 2-Punkt-Segmente, die kollinear + luecken-nah sind, zusammenfassen */
    const psgKandidaten = lage.ops.filter(o => o.kw === 'PSG'
      && (o.poly || []).filter(e => e.type === 'PP' || e.type === 'KB').length === 2);
    if (psgKandidaten.length >= 2) {
      const segmente = psgKandidaten.map(op => {
        const pts = op.poly.filter(e => e.type === 'PP' || e.type === 'KB');
        return { a: [pts[0].x, pts[0].y], b: [pts[1].x, pts[1].y], op };
      });
      for (const g of kollineareSegmenteZusammenfassen(segmente, profil.autoKontur.maxLuecke)) {
        if (g.verbraucht.length < 2) continue;
        if (!aenderungGemacht) { aenderungBeginnen(); aenderungGemacht = true; }
        const erstesOp = g.verbraucht[0], letztesOp = g.verbraucht[g.verbraucht.length - 1];
        const pA = naechsterPunkt(erstesOp, g.a), pB = naechsterPunkt(letztesOp, g.b);
        erstesOp.poly = [
          { type: 'PP', x: r3(g.a[0]), y: r3(g.a[1]), t: pA.t, i: pA.i, alpha: 0, z: pA.z != null ? pA.z : null, raw: [] },
          { type: 'PP', x: r3(g.b[0]), y: r3(g.b[1]), t: pB.t, i: pB.i, alpha: 0, z: pB.z != null ? pB.z : null, raw: [] }
        ];
        erstesOp.closed = false;
        erstesOp._modified = true;
        for (const op of g.verbraucht) if (op !== erstesOp) loeschenVormerken(lage, op);
        entfernt += g.verbraucht.length - 1;
      }
    }
  }
  if (!aenderungGemacht) { hinweisAnzeigen('Nichts zu verbinden gefunden.', 'info'); return; }
  ui.mehrAuswahl = [];
  alleNeuRendern();
  hinweisAnzeigen(entfernt + ' Kontur(en) zusammengefasst.', 'erfolg');
}
