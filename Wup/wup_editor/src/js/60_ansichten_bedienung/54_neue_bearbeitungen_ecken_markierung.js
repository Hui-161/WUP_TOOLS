/* =====================================================================
   WP3 — NEUE BEARBEITUNGEN ERSTELLEN (Werkzeug 'neue-kontur')
   ===================================================================== */
/* headless testbar: kw = 'PAF'|'PSG'|'PSF'|'PSZ'|'PML', punkte = [[x,y],...]
   (ohne Schluss-Duplikat), lage = Ziel-Lage (z.B. obersteSichtbareLageMitPlatten()).
   PAF/PSG bleiben offen wie geklickt (werden aber automatisch geschlossen,
   wenn Start-/Endpunkt < 1mm auseinanderliegen); PSF/PSZ werden IMMER
   geschlossen (P-08 verlangt geschlossene Sperr-/Zwangsflaechen).
   PML (Markierlinie, Weinmann 3.4.2/5.3): offener PP-Zug, t=0 (traegt kein
   Material ab), Steuercode-Default 122 = Kugelschreiber (2) + Markierung auf
   der Definitionsebene (20) + Linienfarbe schwarz (100), wie das
   Weinmann-Beispiel "Schwarze Linie mit Kugelschreiber auf Platte: 122".
   erzwingeGeschlossen (optional, Default false/undefined): wenn true, wird
   die Kontur ebenfalls immer geschlossen — genutzt, wenn der Klick auf den
   Startpunkt das Polygon explizit abschliesst (Feedback-Punkt 10: sonst fehlt
   die Schliesslinie, weil der letzte gezeichnete Punkt nicht zwangslaeufig
   nahe am Start liegt). Bestehende Aufrufe mit 3 Argumenten verhalten sich
   unveraendert. */
/* z-Wert (Tiefe/Hoehe) fuer neu erzeugte Markierlinien: die realen
   Datensaetze (z.B. cadwork-Dach 1HG8190003) schreiben an PML-Punkten das z
   der Lage — derselbe Wert wie an den Platten-Umriss-PPs (PLA1 -60,
   Folie -61, ...). Erste Platte mit z liefert den Wert; Lage ohne
   Platten-z -> null (Feld wird beim Export weggelassen, wie bisher). */
function lageMarkierZ(lage) {
  for (const p of ((lage && lage.plates) || []))
    if (p.z != null && !isNaN(p.z)) return p.z;
  return null;
}
function neueKonturErzeugen(kw, punkte, lage, erzwingeGeschlossen) {
  if (!punkte || punkte.length < 2 || !lage) return null;
  const r3 = n => Math.round(n * 1000) / 1000;
  const pts = punkte.map(p => [r3(p[0]), r3(p[1])]);
  const istSperrflaeche = kw === 'PSF' || kw === 'PSZ';
  const startEndeNah = pts.length >= 2 && Geo.dist(pts[0], pts[pts.length - 1]) < 1;
  let closed = false;
  if (istSperrflaeche || erzwingeGeschlossen) {
    if (startEndeNah) pts[pts.length - 1] = pts[0].slice();
    else pts.push(pts[0].slice());
    closed = true;
  } else if (startEndeNah) {
    pts[pts.length - 1] = pts[0].slice();  /* exakt schliessen statt naeherungsweise */
    closed = true;
  }
  aenderungBeginnen();
  const poly = pts.map(p => istSperrflaeche
    /* echte PSF-Punkte (siehe f3PsfErzeugen): x,y ohne Steuercode/Tiefe */
    ? { type: 'PP', x: p[0], y: p[1], t: 0, i: 0, alpha: 0, z: null, raw: [] }
    : kw === 'PML'
    /* Markierlinie: kein Materialabtrag (t=0), Markier-Steuercode 122,
       z = Lagen-z wie in den realen Datensaetzen (lageMarkierZ) */
    ? { type: 'PP', x: p[0], y: p[1], t: 0, i: 122, alpha: 0, z: lageMarkierZ(lage), raw: [] }
    /* PAF/PSG: i=311 = KEINE Radiuskorrektur — sicherer Default, P-09 weist auf
       das noetige Setzen der Seite hin, statt eine falsche Seite zu raten */
    : { type: 'PP', x: p[0], y: p[1], t: lage.hz || 0, i: 311, alpha: 0, z: null, raw: [] });
  const anker = lage.ops[lage.ops.length - 1];
  const op = {
    id: 'op' + (++opIdZaehler), kw, headerParams: '',
    poly, closed, lageId: lage.id,
    _off: anker && anker._off ? anker._off.slice() : [0, 0],
    _lineStart: -1, _lineEnd: -1, _modified: true, _neu: true
  };
  lage.ops.push(op);
  opFilterSicherstellen(kw);
  auswahlSetzen({ typ: 'op', id: op.id, lageId: lage.id });
  alleNeuRendern(true);
  hinweisAnzeigen('Neue ' + kw + ' in ' + lage.id + ' erzeugt' + (kw === 'PAF' || kw === 'PSG'
    ? ' — Seite/Radiuskorrektur noch zu setzen (aktuell i=311, keine Korrektur).'
    : kw === 'PML' ? ' (Markierlinie, Code 122 = Kugelschreiber · Definitionsebene · schwarz).' : '.'), 'erfolg');
  return op;
}
/* =====================================================================
   WP-G — ECKEN-MARKIERUNG (Automatik, Anwenderwunsch; Umbau v2.48 nach
   Referenz-BV EG01_1): zwei 50-mm-PML in X und Y, die im WINKELPUNKT vor
   einer RIEGELWERK-Ecke enden. Die Platten stehen gegenueber dem Riegel-
   werk zurueck — der Winkelpunkt liegt deshalb um den waehlbaren Rueck-
   sprung (50/100/150/200 mm) diagonal ins Wandinnere versetzt (Beispiel:
   Riegel-Ecke 6733/0, Ruecksprung 100 -> Winkelpunkt 6633/100). Beide
   Linien laufen GEGENLAEUFIG zur Handzeichnung im Referenz-BV: Start auf
   der Platte, Ende im Winkelpunkt — so faengt der Markierer immer auf
   der Platte an (Anwenderwunsch). Anschlag-Vorschlag = Riegel-Ecke
   (maxX, minY) fuer ALLE Lagen; der fruehere PLA-Vorschlag (minX, minY)
   lag laut Anwender auf der falschen Seite. Headless testbar.
   ===================================================================== */
function riegelEcken() {
  /* die vier Ecken der Riegelwerk-BBox (alle Bauteil-Umrisse);
     ohne Hoelzer im Datensatz: ELM-Box als Rueckfallebene */
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const b of (modell.beams || []))
    for (const p of (b.outline || [])) {
      if (p[0] < minX) minX = p[0];
      if (p[0] > maxX) maxX = p[0];
      if (p[1] < minY) minY = p[1];
      if (p[1] > maxY) maxY = p[1];
    }
  if (!isFinite(minX) || maxX <= minX || maxY <= minY) {
    const ELM = modell.header.ELM;
    minX = 0; minY = 0; maxX = ELM.lx; maxY = ELM.by;
  }
  return [[minX, minY], [maxX, minY], [maxX, maxY], [minX, maxY]];
}
function anschlagEckeVorschlag() {
  /* anschlagsseitige Riegel-Ecke = Welt (maxX, minY) — fuer alle Lagen */
  return riegelEcken()[1];
}
function eckenRichtung(ecke) {
  /* Einheits-Richtung von der Riegel-Ecke diagonal INS Wandinnere */
  const ecken = riegelEcken();
  return [ecke[0] <= (ecken[0][0] + ecken[1][0]) / 2 ? 1 : -1,
          ecke[1] <= (ecken[0][1] + ecken[2][1]) / 2 ? 1 : -1];
}
/* v2.50 (Anwenderwunsch): Ruecksprung AUTOMATISCH aus der Plattenlage.
   v2.52 (Anwenderregel): "PML darf NIE auf einer
   Plattenkante sein" — der Winkelpunkt UND beide Linien-Endpunkte
   muessen streng IM Platteninneren derselben Platte liegen (> 1 mm von
   jeder Kante). Eine buendige Platte zaehlt damit NICHT mehr als
   Ueberstand: dort kommt der naechste 5-cm-Versatz. Nur bei echtem
   Ueberstand (Ecke samt Linien ganz im Inneren) bleibt es bei 0.
   null = kein passender Versatz innerhalb 100 cm (Abbruch beim Aufrufer). */
function plattePunktStrengInnen(platte, p) {
  const o = platte.outline || [];
  if (o.length < 3 || !Geo.punktInPolygon(p, o)) return false;
  for (let i = 0; i < o.length; i++)
    if (Geo.distPunktSegment(p, o[i], o[(i + 1) % o.length]) < 1) return false;
  return true;
}
function eckenPmlPunkteInnen(lage, ecke, r) {
  const L = 50;   /* Markierungslaenge wie in eckenPmlErzeugen */
  const [dx, dy] = eckenRichtung(ecke);
  const P = [ecke[0] + dx * r, ecke[1] + dy * r];
  const punkte = [P, [P[0] + dx * L, P[1]], [P[0], P[1] + dy * L]];
  return lage.plates.some(pl => punkte.every(p => plattePunktStrengInnen(pl, p)));
}
function eckenRuecksprungAutomatisch(lage, ecke) {
  for (let r = 0; r <= 1000; r += 50)
    if (eckenPmlPunkteInnen(lage, ecke, r)) return r;
  return null;
}
function eckenPmlErzeugen(lage, ecke, ruecksprung) {
  const L = 50;   /* Markierungslaenge [mm] (Anwenderdefinition) */
  const r = ruecksprung == null ? 100 : ruecksprung;
  const [dx, dy] = eckenRichtung(ecke);
  const P = [ecke[0] + dx * r, ecke[1] + dy * r];   /* Winkelpunkt */
  aenderungBeginnen();
  const ops = [];
  const markZ = lageMarkierZ(lage);   /* z wie in den realen PML-Datensaetzen */
  /* Start auf der Platte, Ende im Winkelpunkt (gegenlaeufig zum
     Referenz-Beispiel — der Markierer faengt auf der Platte an) */
  for (const start of [[P[0] + dx * L, P[1]], [P[0], P[1] + dy * L]]) {
    const poly = [[start[0], start[1]], [P[0], P[1]]].map(p =>
      ({ type: 'PP', x: p[0], y: p[1], t: 0, i: 122, alpha: 0, z: markZ, raw: [] }));
    const op = { id: 'op' + (++opIdZaehler), kw: 'PML', headerParams: '',
      poly, closed: false, lageId: lage.id, _off: [0, 0],
      _lineStart: -1, _lineEnd: -1, _modified: true, _neu: true, auto: 'ecke' };
    lage.ops.push(op);
    ops.push(op);
  }
  opFilterSicherstellen('PML');
  alleNeuRendern(true);
  return ops;
}
function eckenPmlKlick(welt) {
  const f = ui.eckenPml;
  ui.eckenPml = null;
  const lage = modell.layers.find(l => l.id === f.lageId);
  if (!lage) { svgRendern(); return; }
  let beste = null, besteD = Infinity;
  for (const p of riegelEcken()) {
    const d = Geo.dist(welt, p);
    if (d < besteD) { besteD = d; beste = p; }
  }
  if (!beste || besteD * ui.scale > 25) {
    hinweisAnzeigen('Keine Riegelwerk-Ecke in Klick-Naehe — Ecken-Markierung abgebrochen.', 'warnung');
    svgRendern();
    return;
  }
  let r = f.ruecksprung == null ? 100 : f.ruecksprung;
  if (r === 'auto') {
    r = eckenRuecksprungAutomatisch(lage, beste);
    if (r == null) {
      hinweisAnzeigen('Automatik: keine Platte der Lage ' + lage.id + ' innerhalb 100 cm diagonal zur Ecke ('
        + fmtZahl(beste[0]) + '/' + fmtZahl(beste[1]) + ') — Ecken-Markierung abgebrochen.', 'warnung');
      svgRendern();
      return;
    }
  }
  const ops = eckenPmlErzeugen(lage, beste, r);
  const wp = ops[0].poly[1];
  hinweisAnzeigen('Ecken-Markierung: 2× PML 50 mm in ' + lage.id + ' erzeugt — Winkelpunkt ('
    + fmtZahl(wp.x) + '/' + fmtZahl(wp.y) + ') = Riegel-Ecke (' + fmtZahl(beste[0]) + '/'
    + fmtZahl(beste[1]) + ') + ' + fmtZahl(r) + ' mm Ruecksprung'
    + (f.ruecksprung === 'auto'
      ? (r === 0 ? ' (automatisch: Platte steht ueber — Markierung direkt auf der Ecke)'
                 : ' (automatisch: kleinster 5-cm-Versatz ganz im Platteninneren)')
      : '') + '.', 'erfolg');
  /* Anwenderregel: PML darf NIE auf einer Plattenkante liegen — beim
     festen Wert wird das nicht erzwungen, aber deutlich gewarnt. */
  if (f.ruecksprung !== 'auto' && !eckenPmlPunkteInnen(lage, beste, r))
    hinweisAnzeigen('ACHTUNG: Die Markierung liegt auf oder ausserhalb einer Plattenkante von '
      + lage.id + ' — PML darf nie auf einer Plattenkante sein (Versatz noetig, Automatik-Modus nutzen).', 'warnung');
}
function eckenPmlStarten() {
  if (!modell) return;
  const lagen = modell.layers.filter(l => l.plates.length);
  if (!lagen.length) { hinweisAnzeigen('Keine Lage mit Platten vorhanden.', 'warnung'); return; }
  /* Vorauswahl IMMER PLA1 (Anwenderdefinition): PLI0/PLA0 sind keine
     echten Schichten, sondern die Einblasdaemmung — nie vorauswaehlen. */
  const lagenNr = id => { const m = /(\d+)\s*$/.exec(id); return m ? +m[1] : -1; };
  let vorLage = lagen.findIndex(l => /^PLA1$/i.test(l.id.trim()));
  if (vorLage < 0) vorLage = lagen.findIndex(l => l.side !== 'innen' && lagenNr(l.id) >= 1);
  if (vorLage < 0) vorLage = lagen.findIndex(l => lagenNr(l.id) >= 1);
  if (vorLage < 0) vorLage = 0;
  const merkR = speicherLaden('eckenPmlRuecksprung', 100);
  const merkModus = speicherLaden('eckenPmlModus', 'auto');
  document.querySelectorAll('.modal-hintergrund').forEach(m => m.remove());
  const hg = document.createElement('div');
  hg.className = 'modal-hintergrund';
  hg.innerHTML = '<div class="modal-fenster" role="dialog" aria-label="Ecken-Markierung">'
    + '<h2>⌐ Ecken-Markierung (2× PML 50 mm)</h2>'
    + '<div class="modal-untertitel">Schicht waehlen, dann die RIEGELWERK-Ecke im Canvas anklicken. '
    + 'Der Winkelpunkt liegt um den Platten-Ruecksprung diagonal vor der Ecke; beide Markierlinien '
    + 'starten auf der Platte und enden im Winkelpunkt. ◇ = Anschlag-Vorschlag (rechts unten).</div>'
    + '<div class="modal-abschnitt">' + lagen.map((l, i) =>
      '<label style="display:flex;gap:6px;align-items:center"><input type="radio" name="eckenLage" value="' + l.id + '"'
      + (i === vorLage ? ' checked' : '') + '> ' + l.id + ' <span class="mini-hinweis">(' + l.plates.length + ' Platten · '
      + (l.side === 'innen' ? 'pli' : 'pla')
      + (lagenNr(l.id) === 0 ? ' · Einblasdaemmung — keine echte Schicht' : '') + ')</span></label>').join('')
    + '</div>'
    + '<div class="modal-abschnitt"><span class="mini-hinweis">Platten-Ruecksprung gegenueber dem Riegelwerk:</span>'
    + '<label style="display:flex;gap:6px;align-items:flex-start;margin-top:4px"><input type="radio" name="eckenModus" value="auto"'
    + (merkModus !== 'manuell' ? ' checked' : '') + '> <span>Automatisch aus der Platte — nie auf einer '
    + 'Plattenkante: steht die Platte ueber die Ecke hinaus → Markierung direkt auf der Ecke (0); '
    + 'buendig oder zurueckstehend → in 5-cm-Schritten diagonal nach innen, bis Winkelpunkt und beide '
    + 'Linien ganz im Platteninneren liegen</span></label>'
    + '<label style="display:flex;gap:6px;align-items:center;margin-top:6px"><input type="radio" name="eckenModus" value="manuell"'
    + (merkModus === 'manuell' ? ' checked' : '') + '> Fester Wert:&nbsp;'
    + '<input type="number" id="eckenRuecksprungEingabe" step="0.5" value="' + (merkR / 10) + '" style="width:90px"> cm '
    + '<span class="mini-hinweis">(0 = auf der Ecke, negativ = ausserhalb)</span></label></div>'
    + '<div class="modal-fuss">'
    + '<button class="schaltflaeche schaltflaeche-neben schaltflaeche-klein" data-ecken="abbrechen">Abbrechen</button>'
    + '<button class="schaltflaeche schaltflaeche-haupt schaltflaeche-klein" data-ecken="weiter">Weiter: Riegel-Ecke anklicken</button>'
    + '</div></div>';
  document.body.appendChild(hg);
  hg.querySelector('[data-ecken="abbrechen"]').addEventListener('click', () => hg.remove());
  hg.addEventListener('click', ev => { if (ev.target === hg) hg.remove(); });
  /* Enter bestaetigt die Abfrage mit den Vorschlaegen (Anwenderwunsch),
     Escape bricht ab; Start-Fokus auf dem Weiter-Knopf, damit Enter
     sofort nach dem Oeffnen wirkt. */
  hg.addEventListener('keydown', ev => {
    /* stopPropagation: nach hg.remove() greift die Modal-Sperre des
       document-Handlers nicht mehr — OHNE Stopp wuerde DASSELBE Enter
       sofort auch die Anschlag-Ecke uebernehmen (kein Korrektur-Fenster) */
    if (ev.key === 'Enter') { ev.preventDefault(); ev.stopPropagation(); hg.querySelector('[data-ecken="weiter"]').click(); }
    else if (ev.key === 'Escape') { ev.preventDefault(); ev.stopPropagation(); hg.remove(); }
  });
  hg.querySelector('[data-ecken="weiter"]').focus();
  /* Tippen ins Zahlenfeld waehlt den Fester-Wert-Modus gleich mit */
  hg.querySelector('#eckenRuecksprungEingabe').addEventListener('focus', () => {
    hg.querySelector('input[name="eckenModus"][value="manuell"]').checked = true;
  });
  hg.querySelector('[data-ecken="weiter"]').addEventListener('click', () => {
    const lageId = (hg.querySelector('input[name="eckenLage"]:checked') || {}).value;
    const modus = (hg.querySelector('input[name="eckenModus"]:checked') || {}).value || 'auto';
    /* 0 und negative Werte sind GUELTIG (Anwenderwunsch) — kein "|| Vorgabe" */
    const eingabe = parseFloat((hg.querySelector('#eckenRuecksprungEingabe') || {}).value);
    const r = modus === 'auto' ? 'auto' : (isNaN(eingabe) ? merkR : Math.round(eingabe * 10));
    hg.remove();
    if (!lageId) return;
    speicherSichern('eckenPmlModus', modus);
    if (modus !== 'auto') speicherSichern('eckenPmlRuecksprung', r);
    ui.eckenPml = { lageId, ruecksprung: r };
    hinweisAnzeigen('Riegelwerk-Ecke anklicken — ◇ = Anschlag-Vorschlag. ' + (r === 'auto'
      ? 'Ruecksprung wird automatisch aus der Platte ermittelt (0 bei Ueberstand, sonst 5-cm-Schritte).'
      : 'Winkelpunkt liegt ' + (r / 10) + ' cm diagonal ' + (r < 0 ? 'AUSSERHALB der Ecke (Ueberstand)' : 'davor') + '.')
      + ' Esc bricht ab.', 'info');
    svgRendern();
  });
}
/* Marker fuer den Ecken-Wahl-Modus: die vier Riegelwerk-Ecken klein, die
   Anschlag-Ecke (Vorschlag, maxX/minY) gross mit Raute + Beschriftung. */
function eckenPmlMarkerSvg() {
  if (!ui.eckenPml || !modell) return '';
  const lage = modell.layers.find(l => l.id === ui.eckenPml.lageId);
  if (!lage) return '';
  const akz = cssVar('--akzent'), flaeche = cssVar('--flaeche');
  const teile = ['<g pointer-events="none">'];
  for (const p of riegelEcken()) {
    const c = toSVG(p[0], p[1]);
    teile.push('<circle cx="' + c.x + '" cy="' + c.y + '" r="4" fill="' + flaeche + '" stroke="' + akz + '" stroke-width="1.5"/>');
  }
  const anschlag = anschlagEckeVorschlag();
  if (anschlag) {
    const c = toSVG(anschlag[0], anschlag[1]);
    teile.push('<circle class="nr-gruppen-halo" cx="' + c.x + '" cy="' + c.y + '" r="14" fill="' + akz + '" opacity="0.25"/>'
      + '<path d="M' + c.x + ',' + (c.y - 8) + ' L' + (c.x + 8) + ',' + c.y + ' L' + c.x + ',' + (c.y + 8)
      + ' L' + (c.x - 8) + ',' + c.y + ' Z" fill="' + akz + '" stroke="' + flaeche + '" stroke-width="1.5"/>'
      + '<text x="' + (c.x + 12) + '" y="' + (c.y - 10) + '" font-size="11" font-weight="700" fill="' + akz
      + '" stroke="' + flaeche + '" stroke-width="2.5" paint-order="stroke">Anschlag (Vorschlag)</text>');
  }
  teile.push('</g>');
  return teile.join('');
}
