/* =====================================================================
   WP3-P1 — SEITEN-WAHL PER MAUS (nur PAF/PSG, nach dem Erzeugen)
   ===================================================================== */
/* headless testbar: op = die erzeugte PAF/PSG-Op (Referenzgeometrie fuer die
   Seiten-Bestimmung), weltPunkt = [x,y] der Mausposition in Weltkoordinaten.
   Ermittelt, auf welcher Seite der Kontur der Punkt liegt, und bildet das auf
   die Weinmann-Korrektur ab (1 = links, Werkzeug links/Werkstueck rechts;
   2 = rechts, Werkzeug rechts/Werkstueck links; 3 = mitte/keine Korrektur).
   schwelle (mm): liegt der Punkt naeher als das am naechsten Kontursegment,
   gilt er als "auf der Linie" -> mitte (gilt fuer offene UND geschlossene
   Konturen gleichermassen, siehe neu_kontur_seite_smoke.js).
   Offene Kontur: Vorzeichen von Geo.cross(Richtung des naechsten Segments,
   Punkt - Segmentanfang) — Geo.cross ist der math. Kreuzprodukt-Skalar
   (u.x*v.y - u.y*v.x); bei einem y-nach-oben-Koordinatensystem liegt ein
   Punkt mit positivem Kreuzprodukt LINKS der Bewegungsrichtung (wie beim
   Blick in Laufrichtung: positive y-Komponente = links), also -> korrektur 1;
   negativ -> rechts -> korrektur 2.
   Geschlossene Kontur: es gibt keine Lauf-Richtung als Bezug (anders als bei
   der offenen Kontur mit ihrem Richtungsvektor), "links"/"rechts" waeren hier
   bedeutungslos. Stattdessen wird ueber Geo.punktInPolygon() innen/aussen
   bestimmt und auf dieselben Korrektur-Werte abgebildet: innen (Klick liegt
   IM Polygon, z.B. eine auszuschneidende Ausnehmung/ein Loch) -> korrektur 1
   (Werkzeug faehrt an der Aussenseite der Kontur, das Gutteil bleibt AUSSEN
   unberuehrt); aussen (Klick liegt AUSSERHALB, z.B. ein Umriss, der die
   Aussenkante des Werkstuecks bildet) -> korrektur 2 (Werkzeug faehrt an der
   Innenseite, das Gutteil bleibt INNERHALB der Kontur erhalten). Damit zeigt
   die Klickposition immer auf die Seite, die NICHT weggefraest wird —
   konsistent mit der Intuition "ich klicke auf das Gutteil". */
function seiteBestimmen(op, weltPunkt) {
  const schwelle = 15; /* mm */
  const poly = opPolyAlsArray(op);
  if (!poly || poly.length < 2) return { seite: 'mitte', korrektur: 3 };
  let bestIdx = 0, bestDist = Infinity;
  for (let i = 0; i < poly.length - 1; i++) {
    const d = Geo.distPunktSegment(weltPunkt, poly[i], poly[i + 1]);
    if (d < bestDist) { bestDist = d; bestIdx = i; }
  }
  if (bestDist < schwelle) return { seite: 'mitte', korrektur: 3 };
  if (op.closed) {
    const innen = Geo.punktInPolygon(weltPunkt, poly);
    return innen ? { seite: 'links', korrektur: 1 } : { seite: 'rechts', korrektur: 2 };
  }
  const a = poly[bestIdx], b = poly[bestIdx + 1];
  const richtung = Geo.norm([b[0] - a[0], b[1] - a[1]]);
  const rel = [weltPunkt[0] - a[0], weltPunkt[1] - a[1]];
  const cr = Geo.cross(richtung, rel);
  return cr >= 0 ? { seite: 'links', korrektur: 1 } : { seite: 'rechts', korrektur: 2 };
}
/* headless testbar: wendet korrektur (1|2|3) auf alle Ops aus ui.seitenWahl.
   opIds an — Steuercode je Punkt wird zerlegt, nur die Korrektur-Stelle
   ersetzt, werkzeug/schnitt/lauf je Punkt bleiben erhalten (relevant, falls
   ein Punkt bereits abweichend war, z.B. nach F1 Ueber-/Unterschnitt). */
function seitenWahlAnwenden(korrektur) {
  if (!ui.seitenWahl || !ui.seitenWahl.opIds) return;
  for (const opId of ui.seitenWahl.opIds) {
    const f = opFinden(opId);
    if (!f) continue;
    for (const e of (f.op.poly || [])) {
      if (e.type !== 'PP' && e.type !== 'KB') continue;
      const zer = steuercodeZerlegen(e.i);
      e.i = steuercodeBauen({ ...zer, korrektur });
    }
    f.op._modified = true;
  }
}
/* UI-seitig: startet nach dem Erzeugen einer/mehrerer PAF/PSG-Ops (Polygon
   oder Rechteck, ueber die gewaehlten Schichten hinweg — Punkt 3) den
   interaktiven Seiten-Wahl-Schritt (Punkt 1). Fuer alle anderen Arten (NR,
   PSF, PSZ) sowie fuer die Form MP/Kreis (siehe canvasPointerDown) passiert
   nichts — dort bleibt es bei i=311/dem bisherigen Sofort-Abschluss. */
function seitenWahlStartenFallsNoetig(kw, ops, lageId) {
  if ((kw !== 'PAF' && kw !== 'PSG') || !ops || !ops.length) return;
  ui.seitenWahl = { opIds: ops.map(o => o.id), lageId };
  hinweisAnzeigen('Seite der Radiuskorrektur per Maus waehlen, dann klicken (Escape = spaeter, bleibt bei i=311).', 'info');
}
/* UI-seitig: schliesst den Seiten-Wahl-Schritt per Klick ab — bestimmt die
   Seite anhand der Referenz-Op (erste aus opIds) und wendet sie auf ALLE
   betroffenen Ops an (auch die auf den anderen gewaehlten Schichten). */
function seitenWahlBestaetigen(weltPunkt) {
  const sw = ui.seitenWahl;
  if (!sw) return;
  const referenz = opFinden(sw.opIds[0]);
  const wahl = referenz ? seiteBestimmen(referenz.op, weltPunkt) : { seite: 'mitte', korrektur: 3 };
  seitenWahlAnwenden(wahl.korrektur);
  ui.seitenWahl = null;
  seitenWahlPopupVerstecken();
  alleNeuRendern(true);
  hinweisAnzeigen('Seite gesetzt: ' + wahl.seite + ' (Korrektur ' + wahl.korrektur + ').', 'erfolg');
}
function seitenWahlPopupRendern(clientX, clientY, wahl) {
  const pop = document.getElementById('seitenWahlPopup');
  if (!pop) return;
  const texte = { 1: '◀ Links schneiden (100)', 2: 'Rechts schneiden ▶ (200)', 3: 'Mitte — keine Korrektur (300)' };
  pop.textContent = texte[wahl.korrektur] || '';
  pop.style.left = (clientX + 16) + 'px';
  pop.style.top = (clientY + 16) + 'px';
  pop.classList.remove('versteckt');
}
function seitenWahlPopupVerstecken() {
  const pop = document.getElementById('seitenWahlPopup');
  if (pop) pop.classList.add('versteckt');
}
/* headless testbar: zentrum=[x,y], radius (mm), lage = Ziel-Lage.
   Erzeugt PAF mit einem MP-Punkt (Rundfraesung) — Felder wie beim Freistich-MP
   (f2FreistichErzeugenMp), aber ohne auto/elternId (keine automatisch erzeugte Op). */
function neuerKreisErzeugen(zentrum, radius, lage) {
  if (!zentrum || !lage) return null;
  const r = Math.max(1, Math.round(radius));
  aenderungBeginnen();
  const anker = lage.ops[lage.ops.length - 1];
  const op = {
    id: 'op' + (++opIdZaehler), kw: 'PAF', headerParams: '',
    poly: [{ type: 'MP', x: Math.round(zentrum[0]), y: Math.round(zentrum[1]),
             r, t: lage.hz || 0, i: 301, z: null, raw: [] }],
    closed: false, lageId: lage.id,
    _off: anker && anker._off ? anker._off.slice() : [0, 0],
    _lineStart: -1, _lineEnd: -1, _modified: true, _neu: true
  };
  lage.ops.push(op);
  opFilterSicherstellen('PAF');
  auswahlSetzen({ typ: 'op', id: op.id, lageId: lage.id });
  alleNeuRendern(true);
  hinweisAnzeigen('Neuer Kreis (MP, r=' + r + ') in ' + lage.id + ' erzeugt.', 'erfolg');
  return op;
}
/* headless testbar: eckeA/eckeB = [x,y] zweier gegenueberliegender Ecken,
   kw = 'NR'|'PAF'|'PSG'|'PSF'|'PSZ' (Form "Rechteck" aus #neueKonturForm),
   lage = Ziel-Lage. Erzeugt ein achsparalleles, GESCHLOSSENES 4-Eck-Polygon
   (5 Punkte inkl. Schluss-Duplikat) aus den beiden Ecken — Steuercode/Feld-
   Konvention wie neueKonturErzeugen fuer die jeweilige Art (PAF/PSG: i=311,
   t=lage.hz; PSF/PSZ: x,y mit t=0,i=0). */
function neuesRechteckErzeugen(eckeA, eckeB, kw, lage) {
  if (!eckeA || !eckeB || !lage) return null;
  const r3 = n => Math.round(n * 1000) / 1000;
  const x0 = r3(Math.min(eckeA[0], eckeB[0])), x1 = r3(Math.max(eckeA[0], eckeB[0]));
  const y0 = r3(Math.min(eckeA[1], eckeB[1])), y1 = r3(Math.max(eckeA[1], eckeB[1]));
  const ecken = [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
  ecken.push(ecken[0].slice());
  const istSperrflaeche = kw === 'PSF' || kw === 'PSZ';
  aenderungBeginnen();
  const poly = ecken.map(p => istSperrflaeche
    ? { type: 'PP', x: p[0], y: p[1], t: 0, i: 0, alpha: 0, z: null, raw: [] }
    : { type: 'PP', x: p[0], y: p[1], t: lage.hz || 0, i: 311, alpha: 0, z: null, raw: [] });
  const anker = lage.ops[lage.ops.length - 1];
  const op = {
    id: 'op' + (++opIdZaehler), kw, headerParams: '',
    poly, closed: true, lageId: lage.id,
    _off: anker && anker._off ? anker._off.slice() : [0, 0],
    _lineStart: -1, _lineEnd: -1, _modified: true, _neu: true
  };
  lage.ops.push(op);
  opFilterSicherstellen(kw);
  auswahlSetzen({ typ: 'op', id: op.id, lageId: lage.id });
  alleNeuRendern(true);
  hinweisAnzeigen('Neues Rechteck (' + kw + ') in ' + lage.id + ' erzeugt' + (kw === 'PAF' || kw === 'PSG'
    ? ' — Seite/Radiuskorrektur noch zu setzen (aktuell i=311, keine Korrektur).' : '.'), 'erfolg');
  return op;
}
/* Sammelt Klicks im Werkzeug 'neue-kontur' und ruft neueKonturErzeugen() bei
   Abschluss auf. Rein UI-seitig — die eigentliche Op-Erzeugung liegt in der
   headless testbaren Funktion oben.
   schliessen (optional): true, wenn der Aufruf vom Klick auf den Startpunkt
   kommt (Feedback-Punkt 10 — dort MUSS die Kontur geschlossen werden, weil der
   Startpunkt selbst nicht mehr an die Punkteliste angehaengt wird); false/
   undefined bei Doppelklick/Enter — dort bleibt die Kontur offen, ausser
   Start-/Endpunkt liegen ohnehin nah beieinander (startEndeNah in
   neueKonturErzeugen) oder die Art ist PSF/PSZ (immer geschlossen). */
function neueKonturVersuchAbschliessen(schliessen) {
  if (!ui.neueKontur || !ui.neueKontur.punkte) return;
  const typEl = document.getElementById('neueKonturTyp');
  const kw = typEl ? typEl.value : 'PAF';
  let punkte = ui.neueKontur.punkte.slice();
  /* Doppelklick loest zwei pointerdown-Events aus — der zweite faellt praktisch
     auf denselben Punkt wie der erste Klick der Doppelklick-Geste; als
     Duplikat entfernen, sonst haette der letzte Punkt keinen Effekt auf die
     Kontur aber wuerde die Mindestpunktzahl verfaelschen. */
  if (punkte.length >= 2 && Geo.dist(punkte[punkte.length - 2], punkte[punkte.length - 1]) < 1)
    punkte.pop();
  const minPunkte = (kw === 'PSF' || kw === 'PSZ') ? 3 : 2;
  ui.neueKontur = null; ui._neueKonturMaus = null; ui.snapAnzeige = null;
  if (punkte.length < minPunkte) {
    hinweisAnzeigen('Mindestens ' + minPunkte + ' Punkte fuer ' + kw + ' noetig — Kontur verworfen.', 'warnung');
    svgRendern();
    return;
  }
  const lagen = zielLagenFuerNeu();
  if (!lagen.length) { hinweisAnzeigen('Keine sichtbare Lage fuer die Kontur.', 'warnung'); svgRendern(); return; }
  const ops = lagen.map(lage => neueKonturErzeugen(kw, punkte, lage, schliessen === true)).filter(Boolean);
  seitenWahlStartenFallsNoetig(kw, ops, lagen[0].id);
}


