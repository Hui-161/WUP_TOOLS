/* =====================================================================
   F3 — AUTO-SPERRFLAECHEN (PSF) unter Bearbeitungen
   ===================================================================== */
function f3OffsetFuerLage(lage) {
  let off = 0, unbekannt = false;
  for (const op of lage.ops) {
    if (op.kw !== 'NR') continue;
    const eintrag = profil.nr_indizes[op.nr.i];
    if (eintrag) off = Math.max(off, eintrag.psf_offset);
    else { off = Math.max(off, profil.default_offset_unbekannt); unbekannt = true; }
  }
  return { off, unbekannt };
}
function f3StreifenUmSegment(a, b, off) {
  /* Orientiertes Rechteck (4-Punkt-Polygon) entlang der Strecke a->b:
     Linie senkrecht um off aufgeweitet, Enden um off verlaengert (Endkappen),
     damit Klammern direkt an den Linienenden ebenfalls gedeckt sind.
     Dadurch entsteht bei diagonalen Bahnen ein SCHRAEGER Streifen statt einer
     riesigen achsparallelen BBox. */
  const dx = b[0]-a[0], dy = b[1]-a[1];
  const len = Math.hypot(dx, dy);
  if (len < 1e-6) {
    /* entarteter Punkt -> kleines Quadrat */
    return [[a[0]-off,a[1]-off],[a[0]+off,a[1]-off],[a[0]+off,a[1]+off],[a[0]-off,a[1]+off]];
  }
  const tx = dx/len, ty = dy/len;       /* Tangente (Linienrichtung) */
  const nx = -ty, ny = tx;              /* Normale */
  const ax = a[0]-tx*off, ay = a[1]-ty*off;   /* Anfang mit Endkappe */
  const bx = b[0]+tx*off, by = b[1]+ty*off;   /* Ende mit Endkappe */
  return [
    [ax + nx*off, ay + ny*off],
    [bx + nx*off, by + ny*off],
    [bx - nx*off, by - ny*off],
    [ax - nx*off, ay - ny*off]
  ];
}
function f3SchnittRegionen(op, off) {
  /* Liefert die abzusichernden Bereiche eines Ops als POLYGONE (Punktlisten).
     PSG (Saege): faehrt die LINIEN ab -> je Segment ein orientierter Streifen
       (korrekt auch bei Diagonalen).
     PAF (Fraeser): geschlossene Kontur = FLAECHE wird geraeumt -> ganze Polygon-
       flaeche absichern; offene Kontur = Fraesbahn -> je Segment ein Streifen.
     MP/TA: flaechig -> aufgeweitete BBox als Polygon. */
  const punkte = (op.poly || []).filter(e => e.type === 'PP' || e.type === 'KB').map(e => [e.x, e.y]);
  const istGeschlossen = punkte.length >= 4 &&
    Math.abs(punkte[0][0]-punkte[punkte.length-1][0]) < 0.5 &&
    Math.abs(punkte[0][1]-punkte[punkte.length-1][1]) < 0.5;
  if (op.kw === 'PSG' && punkte.length >= 2) {
    const regionen = [];
    for (let i = 0; i < punkte.length - 1; i++)
      regionen.push({ poly: f3StreifenUmSegment(punkte[i], punkte[i+1], off) });
    return regionen;
  }
  if (op.kw === 'PAF' && punkte.length >= 2) {
    if (istGeschlossen) {
      /* gefraeste Flaeche: das reale Polygon deckt alle innenliegenden NR exakt
         ab (kein achsparalleles Riesenrechteck bei schraegen Flaechen) */
      return [{ poly: punkte.slice(0, -1) }];
    }
    /* offene Fraesbahn -> Streifen je Segment */
    const regionen = [];
    for (let i = 0; i < punkte.length - 1; i++)
      regionen.push({ poly: f3StreifenUmSegment(punkte[i], punkte[i+1], off) });
    return regionen;
  }
  const bbox = f3KonturBbox(op);
  if (!bbox) return [];
  const e = Geo.bboxErweitern(bbox, off);
  return [{ poly: [[e.minX,e.minY],[e.maxX,e.minY],[e.maxX,e.maxY],[e.minX,e.maxY]] }];
}
function f3KonturBbox(op) {
  const pts = opPunkte(op);
  return pts.length ? Geo.bbox(pts) : null;
}
function f3PsfErzeugen(zielLage, region) {
  /* region = { poly:[[x,y],...] } — kann ein orientierter (schraeger) Streifen sein */
  const r3 = n => Math.round(n*1000)/1000;
  const pp = (x, y) => ({ type:'PP', x:r3(x), y:r3(y), t:0, i:0, alpha:0, z:null, raw:[] });
  const ecken = region.poly.slice();
  /* PSF-Polygon schliessen (erster Punkt am Ende wiederholt) */
  const polyPP = ecken.map(p => pp(p[0], p[1]));
  polyPP.push(pp(ecken[0][0], ecken[0][1]));
  const neu = { id: 'op' + (++opIdZaehler), kw: 'PSF', headerParams: '',
    poly: polyPP,
    closed: true, auto: 'psf', lageId: zielLage.id,
    txtKommentar: 'SPERRFLAECHE FUER BEFESTIGUNG (AUTO)',
    _lineStart: -1, _lineEnd: -1, _modified: true, _neu: true };
  /* bei den vorhandenen PSF einsortieren: nach letzter PSF, sonst ans Ende */
  let pos = -1;
  zielLage.ops.forEach((o, i) => { if (o.kw === 'PSF') pos = i; });
  const anker = pos >= 0 ? zielLage.ops[pos] : zielLage.ops[zielLage.ops.length - 1];
  neu._off = anker && anker._off ? anker._off.slice() : [0, 0];   /* B-03 */
  if (pos >= 0) zielLage.ops.splice(pos + 1, 0, neu);
  else zielLage.ops.push(neu);
  return neu;
}
function f3PsfDecktRegion(lage, region) {
  /* deckt eine vorhandene PSF alle Eckpunkte der Region ab? Randtolerant
     (punktInOderAufPolygon), damit eine deckungsgleiche/fast-identische
     bereits erzeugte PSF zuverlaessig als Deckung erkannt wird — sonst
     wuerde bei Randpunkten (Gleitkomma) dieselbe Sperrflaeche wiederholt
     neu angelegt. */
  for (const op of lage.ops) {
    if (op.kw !== 'PSF') continue;
    const poly = opPolyAlsArray(op);
    if (poly.length >= 3 && region.poly.every(e => Geo.punktInOderAufPolygon(e, poly))) return true;
  }
  return false;
}
/* Punkt 7: eine NR gilt in einer Schnitt-Region als UNGESCHUETZT, wenn
   (a) ein nominaler Nagelpunkt in der Region liegt und nicht von PSF gedeckt ist,
   ODER (b) die NR-LINIE die Region kreuzt und die Region nicht bereits ganz von
   einer PSF gedeckt ist. (b) ist konservativer: ein Nagel/eine Klammer kann
   irgendwo entlang der Reihe sitzen, nicht nur am nominalen Punkt — die
   Saege/Fraese darf die Reihe also nirgends ungedeckt kreuzen. Gilt gleichermassen
   fuer NR in derselben Schicht wie in Schichten darunter (Aufrufer iteriert diese). */
function nrRegionUngeschuetzt(nr, region, psfs) {
  if (!nr.nr) return false;
  /* Schneller Bbox-Vorfilter: liegt die NR ueberhaupt in der Naehe der Region?
     Ohne diesen fruehen Ausstieg wuerden fuer JEDE (Region, NR)-Kombination die
     teuren Punkt-/Segment-Polygon-Tests laufen — bei vielsegmentigen PSG-Konturen
     (viele Regionen, je Segment eine) x vielen NR entsteht sonst eine quadratische
     Explosion (realer Absturz/Haenger bei einer 75-Punkte-PSG mit ~47 NR). */
  const rb = Geo.bbox(region.poly);
  const nrMinX = Math.min(nr.nr.xa, nr.nr.xe), nrMaxX = Math.max(nr.nr.xa, nr.nr.xe);
  const nrMinY = Math.min(nr.nr.ya, nr.nr.ye), nrMaxY = Math.max(nr.nr.ya, nr.nr.ye);
  if (nrMaxX < rb.minX || nrMinX > rb.maxX || nrMaxY < rb.minY || nrMinY > rb.maxY) return false;
  const treffer = nagelPunkte(nr).filter(p => Geo.punktInPolygon(p, region.poly));
  if (treffer.length && !treffer.every(p => psfs.some(poly => Geo.punktInOderAufPolygon(p, poly)))) return true;
  const regionGedeckt = psfs.some(poly => region.poly.every(e => Geo.punktInOderAufPolygon(e, poly)));
  if (!regionGedeckt &&
      Geo.segmentKreuztPolygon([nr.nr.xa, nr.nr.ya], [nr.nr.xe, nr.nr.ye], region.poly)) return true;
  return false;
}
function f3NrUnterSchnitt(zielLage, region) {
  /* liegt eine NR der Ziellage ungeschuetzt in/unter der Region? (Punkt- ODER
     Linien-Kreuzung, siehe nrRegionUngeschuetzt) */
  const psfs = zielLage.ops.filter(o => o.kw === 'PSF').map(o => opPolyAlsArray(o)).filter(p => p.length >= 3);
  for (const nr of zielLage.ops) {
    if (nr.kw !== 'NR') continue;
    if (nrRegionUngeschuetzt(nr, region, psfs)) return true;
  }
  return false;
}
function f3BauteilSchnitte() {
  /* Saegeschnitte aus Bauteilbearbeitungen (SG) als Strecken in Element-Koordinaten.
     Geometrie wie im SVG gezeichnet: Trennschnitt am Riegel an x = origin_x + sg.x,
     ueber die Riegelbreite. Bei BT4/BT6 (Trapez) sind beam.x/y nicht gesetzt —
     dann den Ursprung/Hoehe aus der outline-BBox ableiten. */
  const segmente = [];
  for (const beam of (modell.beams || [])) {
    let ox = beam.x, oy = beam.y, hoehe = beam.by;
    if (ox == null || oy == null || !hoehe) {
      const pts = (beam.outline || []).filter(p => p && p.length >= 2);
      if (pts.length) {
        const b = Geo.bbox(pts);
        if (ox == null) ox = b.minX;
        if (oy == null) oy = b.minY;
        if (!hoehe) hoehe = b.maxY - b.minY;
      }
    }
    ox = ox || 0; oy = oy || 0; hoehe = hoehe || 0;
    for (const bb of (beam.bearbeitungen || [])) {
      if (bb.kw !== 'SG' || bb.params.length < 1) continue;
      const bx = parseFloat(bb.params[0]);
      if (isNaN(bx)) continue;
      const x = ox + bx;
      segmente.push({ a: [x, oy], b: [x, oy + hoehe], beam });
    }
  }
  return segmente;
}
/* v2.61 (Anwenderwunsch 2026-11-11 "AUTO-PSF: BOZ-Sperrflaechen auch
   automatisch setzen", Entscheidung: NUR BOZ in Plattenlagen — Riegelwerk-
   BOZ/Richtungsbohrung bleiben aussen vor). Eine BOZ wird wie eine
   Rundfraesung (MP) behandelt: flaechig, aufgeweitete BBox des Bohrkreises
   (r = d/2) um den Offset der Ziellage. Auch schon auf PAF/MP umgestellte
   Bohrungen (_umgestellt, bis zum Neuladen) — gebohrt wird trotzdem. */
function f3BohrungRegion(b, off) {
  const r = (b.d || 0) / 2 + off;
  return { poly: [[b.x - r, b.y - r], [b.x + r, b.y - r], [b.x + r, b.y + r], [b.x - r, b.y + r]] };
}
function f3AutoPsf(nurOp) {
  if (!modell) return;
  let anzahl = 0, unbekanntGes = false;
  aenderungBeginnen();
  for (const lage of modell.layers) {
    /* Momentaufnahme: f3PsfErzeugen fuegt neue PSF-Ops per splice() MITTEN in
       zielLage.ops ein (nach der letzten vorhandenen PSF) — bei Iteration ueber
       das LIVE-Array wuerde eine Einfuegung vor der aktuellen Cursor-Position
       das gerade verarbeitete Op nach hinten schieben und der for-of-Iterator
       wuerde es SPAETER ERNEUT besuchen (Endlosschleife/Haenger, real beobachtet
       bei einer 75-Punkte-PSG in derselben Lage wie viele NR). */
    for (const op of lage.ops.slice()) {
      if (nurOp && op !== nurOp) continue;
      if (!opIstZerspanend(op)) continue;
      if (!f3KonturBbox(op)) continue;
      /* Ziele: die EIGENE Lage (NR auf demselben PAF/PSG) + alle Lagen darunter. */
      const ziele = [lage, ...lagenUnter(lage)];
      for (const ziel of ziele) {
        if (!ziel.ops.some(o => o.kw === 'NR')) continue;
        const { off, unbekannt } = f3OffsetFuerLage(ziel);
        /* PSG/PAF: ein Streifen je Liniensegment (auch diagonal korrekt);
           MP/TA: eine Flaechen-Region */
        const regionen = f3SchnittRegionen(op, off);
        for (const region of regionen) {
          if (!f3NrUnterSchnitt(ziel, region)) continue;
          if (unbekannt) unbekanntGes = true;
          if (f3PsfDecktRegion(ziel, region)) continue;
          f3PsfErzeugen(ziel, region);
          anzahl++;
        }
      }
    }
  }
  /* Lagen-BOZ (v2.61): eigene Lage + alle Lagen darunter, wie MP */
  let bohrPsf = 0;
  if (!nurOp) {
    for (const lage of modell.layers) {
      for (const b of (lage.bohrungen || [])) {
        for (const ziel of [lage, ...lagenUnter(lage)]) {
          if (!ziel.ops.some(o => o.kw === 'NR')) continue;
          const { off, unbekannt } = f3OffsetFuerLage(ziel);
          const region = f3BohrungRegion(b, off);
          if (!f3NrUnterSchnitt(ziel, region)) continue;
          if (unbekannt) unbekanntGes = true;
          if (f3PsfDecktRegion(ziel, region)) continue;
          f3PsfErzeugen(ziel, region);
          anzahl++; bohrPsf++;
        }
      }
    }
  }
  /* Zweite Schleife: Saegeschnitte aus Bauteilbearbeitungen (SG am Riegel).
     Diese gehen durch die ganze Wand -> jede Lage mit NR ist betroffen. */
  if (!nurOp) {
    const schnitte = f3BauteilSchnitte();
    if (schnitte.length) {
      for (const ziel of modell.layers) {
        if (!ziel.ops.some(o => o.kw === 'NR')) continue;
        const { off, unbekannt } = f3OffsetFuerLage(ziel);
        for (const seg of schnitte) {
          const region = { poly: f3StreifenUmSegment(seg.a, seg.b, off) };
          if (!f3NrUnterSchnitt(ziel, region)) continue;
          if (unbekannt) unbekanntGes = true;
          if (f3PsfDecktRegion(ziel, region)) continue;
          f3PsfErzeugen(ziel, region);
          anzahl++;
        }
      }
    }
  }
  if (!anzahl) { undoStack.pop(); undoRedoKnoepfe(); }
  alleNeuRendern();
  let text = anzahl ? anzahl + ' Sperrflaeche(n) erzeugt (Schnittlinien-Streifen, '
      + 'auch diagonal + Riegel-Saegeschnitte SG' + (bohrPsf ? ' + ' + bohrPsf + ' fuer BOZ in Plattenlagen' : '')
      + '; nur wo NR unter dem Schnitt liegen).'
    : 'Keine ungeschuetzte Nagelreihe unter einem Schnitt gefunden — nichts zu tun.';
  if (unbekanntGes) text += ' Achtung: unbekannter NR-Index, konservativ ' + profil.default_offset_unbekannt + ' mm.';
  hinweisAnzeigen(text, anzahl ? 'erfolg' : 'info');
}

/* PSF-Parameter einstellen (Zahnrad neben Auto-Sperrflaechen) */
function automatikEinstellungenOeffnen() {
  /* P-4/5/13: allgemeiner Einstellungsdialog fuer alle Automatiken.
     v2.58 (Anwenderwunsch 2026-10-27 "die Einstellungen an die jetzigen
     Funktionen anpassen"): der Dialog stammte aus v2.9 und kannte nur drei
     Automatiken. Jetzt alle sechs in der Reihenfolge des Menues (Alt+A 1–6),
     dazu die Freistich-Codes nach E21 (Enden 212, Ecke 222), MP-Code und
     Korrektur-Erben, die Werte der Richtungs-Bohrung und die Vorgabe der
     Ecken-PML (dieselben Speicher wie deren Startabfrage). */
  document.querySelectorAll('.modal-hintergrund').forEach(m => m.remove());
  const idxNummern = Object.keys(profil.nr_indizes || {}).map(Number).sort((a, b) => a - b);
  const zeilen = idxNummern.map(idx => {
    const e = profil.nr_indizes[idx];
    return '<tr><td>' + idx + '<div class="idx-name">' + escapeHtml(e.name || '') + '</div></td>'
      + '<td><input type="number" min="0" step="0.5" data-psf-idx="' + idx + '" value="'
      + (e.psf_offset != null ? e.psf_offset : '') + '"> mm</td></tr>';
  }).join('');
  const fr = profil.freistich, ri = profil.richtung;
  const pmlModus = speicherLaden('eckenPmlModus', 'auto');
  const pmlR = speicherLaden('eckenPmlRuecksprung', 100);
  const zahl = (id, wert, step, min) => '<input type="number"' + (min != null ? ' min="' + min + '"' : '')
    + ' step="' + step + '" id="' + id + '" value="' + wert + '">';
  const titel = (text, kbd) => '<div class="karten-titel" style="margin-top:16px">' + text
    + (kbd ? ' <kbd>Alt+A ' + kbd + '</kbd>' : '') + '</div>';
  const hg = document.createElement('div');
  hg.className = 'modal-hintergrund';
  hg.innerHTML =
    '<div class="modal-fenster" role="dialog" aria-label="Automatik-Einstellungen">'
    + '<h2>Automatik-Einstellungen</h2>'
    + '<div class="modal-untertitel">Parameter der sechs Automatiken, in der Reihenfolge des Menues. '
    + 'Gilt fuer diesen Browser; „Standard" setzt die Werkzeug-Vorgaben ein.</div>'

    + titel('Über-/Unterschnitt (F1)', 1).replace('margin-top:16px', 'margin-top:0')
    + '<div class="modal-untertitel">Innenecken → Unterschnitt (x2x), Aussenecken → Ueberschnitt (x1x), '
    + 'freie Enden offener Zuege → Ueberschnitt (laufen in den Abfall). Konturen mit gemischter, '
    + 'fehlender oder 300er-Korrektur werden uebersprungen und gemeldet. Keine weiteren Parameter.</div>'

    + titel('Auto-Sperrflächen (F3)', 2)
    + '<div class="modal-untertitel" style="margin-bottom:8px">Sicherheitsabstand (Offset) je Klammer-/Nagel-Index. '
    + 'Breitrueckenklammern brauchen mehr Abstand als normale Klammern.</div>'
    + '<table class="modal-tabelle"><thead><tr><th>NR-Index</th><th>Offset</th></tr></thead>'
    + '<tbody>' + zeilen + '</tbody></table>'
    + '<div class="modal-abschnitt"><button class="schaltflaeche schaltflaeche-neben schaltflaeche-klein" '
    + 'data-psf-modal="geraete">Geräte anlegen / ändern…</button>'
    + (idxNummern.length ? '' : ' <span class="mini-hinweis">Noch keine Geräte hinterlegt.</span>') + '</div>'
    + '<div class="modal-abschnitt"><label>Unbekannter Index (konservativ): '
    + zahl('psfOffsetUnbekannt', profil.default_offset_unbekannt, 0.5, 0) + ' mm</label></div>'

    + titel('⛓ Auto-Kontur', 3)
    + '<div class="modal-untertitel">Verkettet PAF/PSF mit gemeinsamen Endpunkten und fasst PSG-Linien '
    + 'in gleicher Achse zusammen, wenn die Luecke kleiner als der Grenzwert ist (spart Maschinen-Absetzen). '
    + 'Es wird NIE ueber eine groessere Luecke oder ueber nicht-kollineare Segmente hinweg zusammengefasst.</div>'
    + '<div class="modal-abschnitt"><label>Max. Luecke zum Zusammenfassen [mm]: '
    + zahl('akMaxLuecke', profil.autoKontur.maxLuecke, 1, 0) + '</label></div>'

    + titel('◎ Richtung', 4)
    + '<div class="modal-untertitel">Richtungs-Bohrung BOZ in Ober-/Untergurten (Abgleich mit BVN/BVX — '
    + 'dort separat ergaenzen). Erzeugung und Pruefung P-18 lesen dieselben Werte.</div>'
    + '<div class="modal-abschnitt" style="margin-top:0">'
    + '<label>Durchmesser [mm]: ' + zahl('riDurchmesser', ri.durchmesser, 1, 1)
    + ' ± ' + zahl('riDToleranz', ri.d_toleranz, 0.5, 0) + '</label>'
    + '<label>Tiefe beim Erzeugen [mm]: ' + zahl('riTiefe', ri.tiefe, 0.5, 0) + '</label>'
    + '<label>Tiefe akzeptiert von–bis [mm]: ' + zahl('riTiefeMin', ri.tiefe_min, 0.5, 0)
    + ' – ' + zahl('riTiefeMax', ri.tiefe_max, 0.5, 0) + '</label>'
    + '<label>Abstand vom Bauteilanfang [mm]: ' + zahl('riAbstand', ri.abstand_ende, 1, 0) + '</label>'
    + '</div>'

    + titel('⌐ Ecken-PML', 5)
    + '<div class="modal-untertitel">Vorgabe fuer die Startabfrage (dort weiter aenderbar). '
    + 'Schicht ist immer PLA1 vorgewaehlt.</div>'
    + '<div class="modal-abschnitt" style="margin-top:0">'
    + '<label><input type="radio" name="pmlModus" value="auto"' + (pmlModus !== 'manuell' ? ' checked' : '')
    + '> Ruecksprung automatisch aus der Platte (nie auf einer Plattenkante)</label>'
    + '<label><input type="radio" name="pmlModus" value="manuell"' + (pmlModus === 'manuell' ? ' checked' : '')
    + '> Fester Wert: ' + zahl('pmlRuecksprung', pmlR / 10, 0.5) + ' cm '
    + '<span class="mini-hinweis">(0 = auf der Ecke, negativ = ausserhalb)</span></label>'
    + '</div>'

    + titel('◷ Freistiche (F2)', 6)
    + '<div class="modal-untertitel">An jeder unterschnittenen Innenecke ohne Freistich. Vorhandene '
    + 'Freistiche werden erkannt — auch fremde (Granit: 3 Punkte mit Eckpunkt auf der Kontur).</div>'
    + '<div class="modal-abschnitt" style="margin-top:0">'
    + '<label>Variante: <select id="frVariante" style="width:auto">'
    + '<option value="klassisch"' + (fr.variante === 'klassisch' ? ' selected' : '') + '>Klassisch (PAF-Polyzug, 3 Punkte)</option>'
    + '<option value="mp"' + (fr.variante !== 'klassisch' ? ' selected' : '') + '>Rundfraesung (MP)</option>'
    + '</select></label>'
    + '<div class="mini-hinweis" style="margin-top:6px">Klassisch</div>'
    + '<label>Schenkellaenge [mm]: ' + zahl('frKlassischLaenge', fr.klassisch_laenge, 1, 0) + '</label>'
    + '<label>Steuercode Ecke: ' + zahl('frCodeEcke', fr.klassisch_steuercode, 1, 0)
    + ' &nbsp;Enden: ' + zahl('frCodeEnden', fr.klassisch_steuercode_enden, 1, 0)
    + ' <span class="mini-hinweis">(E21: Ecke 222, Enden 212)</span></label>'
    + '<div class="mini-hinweis" style="margin-top:6px">Rundfraesung</div>'
    + '<label>Radius Holzwerkstoff [mm]: ' + zahl('frRadiusHolz', fr.radius_holz, 0.5, 0) + '</label>'
    + '<label>Radius abrasiv (Gips) [mm]: ' + zahl('frRadiusAbrasiv', fr.radius_abrasiv, 0.5, 0) + '</label>'
    + '<label>Steuercode: ' + zahl('frCodeMp', fr.steuercode, 1, 0) + '</label>'
    + '<div class="mini-hinweis" style="margin-top:6px">Beide</div>'
    + '<label><input type="checkbox" id="frErben"' + (fr.korrektur_erben !== false ? ' checked' : '')
    + '> Radiuskorrektur und Lauf von der Kontur erben <span class="mini-hinweis">(sonst kann die '
    + 'Maschine auf der falschen Seite ins Gutteil fraesen — nur abschalten, wenn die Codes oben '
    + 'die Korrektur schon richtig tragen)</span></label>'
    + '</div>'

    + '<div class="modal-fuss">'
    + '<button class="schaltflaeche schaltflaeche-neben schaltflaeche-klein" data-psf-modal="abbrechen">Abbrechen</button>'
    + '<button class="schaltflaeche schaltflaeche-neben schaltflaeche-klein" data-psf-modal="standard">Standard</button>'
    + '<button class="schaltflaeche schaltflaeche-haupt schaltflaeche-klein" data-psf-modal="speichern">Speichern</button>'
    + '</div></div>';
  document.body.appendChild(hg);
  const feld = id => hg.querySelector('#' + id);
  const schliessen = () => hg.remove();
  hg.addEventListener('click', ev => { if (ev.target === hg) schliessen(); });
  hg.querySelector('[data-psf-modal="abbrechen"]').addEventListener('click', schliessen);
  hg.querySelector('[data-psf-modal="geraete"]').addEventListener('click', () => { schliessen(); geraetebelegungOeffnen(false); });
  hg.querySelector('[data-psf-modal="standard"]').addEventListener('click', () => {
    const std = PROFIL_STANDARD.nr_indizes || {};
    hg.querySelectorAll('input[data-psf-idx]').forEach(inp => {
      const e = std[inp.dataset.psfIdx];
      if (e && e.psf_offset != null) inp.value = e.psf_offset;
    });
    feld('psfOffsetUnbekannt').value = PROFIL_STANDARD.default_offset_unbekannt;
    const stdFr = PROFIL_STANDARD.freistich, stdRi = PROFIL_STANDARD.richtung;
    feld('frVariante').value = stdFr.variante;
    feld('frRadiusHolz').value = stdFr.radius_holz;
    feld('frRadiusAbrasiv').value = stdFr.radius_abrasiv;
    feld('frKlassischLaenge').value = stdFr.klassisch_laenge;
    feld('frCodeEcke').value = stdFr.klassisch_steuercode;
    feld('frCodeEnden').value = stdFr.klassisch_steuercode_enden;
    feld('frCodeMp').value = stdFr.steuercode;
    feld('frErben').checked = stdFr.korrektur_erben !== false;
    feld('akMaxLuecke').value = PROFIL_STANDARD.autoKontur.maxLuecke;
    feld('riDurchmesser').value = stdRi.durchmesser;
    feld('riDToleranz').value = stdRi.d_toleranz;
    feld('riTiefe').value = stdRi.tiefe;
    feld('riTiefeMin').value = stdRi.tiefe_min;
    feld('riTiefeMax').value = stdRi.tiefe_max;
    feld('riAbstand').value = stdRi.abstand_ende;
    hg.querySelector('input[name="pmlModus"][value="auto"]').checked = true;
    feld('pmlRuecksprung').value = 10;
  });
  hg.querySelector('[data-psf-modal="speichern"]').addEventListener('click', () => {
    /* Steuercodes: ganze Zahl 0..9999 — sonst bleibt der alte Wert und es
       wird gemeldet (nie still auf einen Ersatzwert ausweichen) */
    const verworfen = [];
    const wert = (id, pruef, ziel, schluessel, text) => {
      const roh = feld(id).value.trim();
      const v = parseFloat(roh);
      if (roh !== '' && !isNaN(v) && pruef(v)) ziel[schluessel] = v;
      else verworfen.push(text);
    };
    const nichtNeg = v => v >= 0, code = v => Number.isInteger(v) && v >= 0 && v <= 9999;
    hg.querySelectorAll('input[data-psf-idx]').forEach(inp => {
      const idx = inp.dataset.psfIdx, v = parseFloat(inp.value);
      if (!profil.nr_indizes[idx]) return;
      if (!isNaN(v) && v >= 0) profil.nr_indizes[idx].psf_offset = v;
      else verworfen.push('PSF-Offset Index ' + idx);
    });
    wert('psfOffsetUnbekannt', nichtNeg, profil, 'default_offset_unbekannt', 'Offset unbekannter Index');
    profil.freistich.variante = feld('frVariante').value === 'klassisch' ? 'klassisch' : 'mp';
    wert('frRadiusHolz', nichtNeg, profil.freistich, 'radius_holz', 'Radius Holz');
    wert('frRadiusAbrasiv', nichtNeg, profil.freistich, 'radius_abrasiv', 'Radius abrasiv');
    wert('frKlassischLaenge', v => v > 0, profil.freistich, 'klassisch_laenge', 'Schenkellaenge');
    wert('frCodeEcke', code, profil.freistich, 'klassisch_steuercode', 'Steuercode Ecke');
    wert('frCodeEnden', code, profil.freistich, 'klassisch_steuercode_enden', 'Steuercode Enden');
    wert('frCodeMp', code, profil.freistich, 'steuercode', 'Steuercode Rundfraesung');
    profil.freistich.korrektur_erben = feld('frErben').checked;
    wert('akMaxLuecke', nichtNeg, profil.autoKontur, 'maxLuecke', 'Max. Luecke');
    wert('riDurchmesser', v => v > 0, profil.richtung, 'durchmesser', 'Richtung Durchmesser');
    wert('riDToleranz', nichtNeg, profil.richtung, 'd_toleranz', 'Richtung Toleranz');
    wert('riTiefe', nichtNeg, profil.richtung, 'tiefe', 'Richtung Tiefe');
    wert('riTiefeMin', nichtNeg, profil.richtung, 'tiefe_min', 'Richtung Tiefe von');
    wert('riTiefeMax', nichtNeg, profil.richtung, 'tiefe_max', 'Richtung Tiefe bis');
    wert('riAbstand', nichtNeg, profil.richtung, 'abstand_ende', 'Richtung Abstand');
    if (profil.richtung.tiefe_min > profil.richtung.tiefe_max) {
      const t = profil.richtung.tiefe_min; profil.richtung.tiefe_min = profil.richtung.tiefe_max; profil.richtung.tiefe_max = t;
    }
    const modus = (hg.querySelector('input[name="pmlModus"]:checked') || {}).value === 'manuell' ? 'manuell' : 'auto';
    speicherSichern('eckenPmlModus', modus);
    const pml = parseFloat(feld('pmlRuecksprung').value);
    /* 0 und negative Werte sind GUELTIG (Anwenderwunsch Ecken-PML) */
    if (!isNaN(pml)) speicherSichern('eckenPmlRuecksprung', Math.round(pml * 10));
    else if (modus === 'manuell') verworfen.push('Ecken-PML fester Wert');
    profilSichern();
    schliessen();
    if (modell) { pruefungenAusfuehren(); alleNeuRendern(true); }
    fehlerLogRendern && fehlerLogRendern();
    fehlerZaehlerRendern && fehlerZaehlerRendern();
    if (verworfen.length)
      hinweisAnzeigen('Gespeichert — ' + verworfen.length + ' ungueltige Eingabe(n) NICHT uebernommen (alter Wert bleibt): '
        + verworfen.join(', ') + '.', 'warnung');
    else hinweisAnzeigen('Automatik-Einstellungen gespeichert.', 'erfolg');
  });
}
const psfEinstellungenOeffnen = automatikEinstellungenOeffnen; /* Alias fuer Abwaertskompatibilitaet */

