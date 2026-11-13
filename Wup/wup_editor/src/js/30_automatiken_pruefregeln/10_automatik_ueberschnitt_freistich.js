/* =====================================================================
   F1 — AUTO-UEBER-/UNTERSCHNITT
   ===================================================================== */
function f1Analysieren(op) {
  /* liefert { aenderungen:[{punktIdx, alt, neu, art}], problem } */
  const erg = { aenderungen: [], problem: null };
  if (!opIstZerspanend(op)) return erg;
  const pts = (op.poly||[]).filter(e => e.type === 'PP' || e.type === 'KB');
  if (pts.length < 3) return erg;
  /* Materialseite je Segment aus Hunderterstelle — Konsistenz pruefen */
  const korrSet = new Set(pts.map(p => steuercodeZerlegen(p.i).korrektur).filter(k => k === 1 || k === 2));
  const hatDrei = pts.some(p => steuercodeZerlegen(p.i).korrektur === 3);
  if (korrSet.size !== 1 || hatDrei) {
    erg.problem = korrSet.size > 1 ? 'Gemischte Werkzeugradiuskorrektur — keine Auto-Aenderung.'
      : hatDrei ? 'Korrektur 300 (kein Gutteil unterscheidbar) — keine Auto-Aenderung.'
      : 'Keine Werkzeugradiuskorrektur gesetzt — keine Auto-Aenderung.';
    return erg;
  }
  const korr = [...korrSet][0]; /* 1 = Werkstueck rechts, 2 = Werkstueck links */
  const geschlossen = pts.length >= 4 &&
    Math.abs(pts[0].x - pts[pts.length-1].x) < 0.01 && Math.abs(pts[0].y - pts[pts.length-1].y) < 0.01;
  const eff = geschlossen ? pts.slice(0, -1) : pts;
  const n = eff.length;

  function eckArt(idx) {
    /* Knick am Punkt eff[idx]: Segment (idx-1 -> idx) und (idx -> idx+1) */
    const vor = eff[(idx - 1 + n) % n], hier = eff[idx], nach = eff[(idx + 1) % n];
    const u = [hier.x - vor.x, hier.y - vor.y];
    const v = [nach.x - hier.x, nach.y - hier.y];
    if (Math.hypot(...u) < 0.01 || Math.hypot(...v) < 0.01) return null;
    const kreuz = Geo.cross(u, v);
    if (Math.abs(kreuz) < 1e-6) return null; /* gerade weiter — keine Ecke */
    /* Material links (korr 2): Linksknick (kreuz>0) = konvex (Aussenecke),
       Rechtsknick = konkav (Innenecke). Material rechts (korr 1) spiegelbildlich. */
    const linksKnick = kreuz > 0;
    const materialLinks = korr === 2;
    const innenecke = materialLinks ? !linksKnick : linksKnick;
    return innenecke ? 'innen' : 'aussen';
  }

  const von = geschlossen ? 0 : 1;
  const bis = geschlossen ? n : n - 1;
  for (let idx = von; idx < bis; idx++) {
    const art = eckArt(idx);
    if (!art) continue;
    const soll = art === 'innen' ? 2 : 1;
    const zer = steuercodeZerlegen(eff[idx].i);
    if (zer.schnitt !== soll) {
      erg.aenderungen.push({ punktIdx: idx, alt: eff[idx].i,
        neu: steuercodeBauen({ ...zer, schnitt: soll }), art });
    }
  }
  /* Offene Zuege: freie Schnittenden IMMER ueberschneiden — der Schnitt laeuft
     dort nach aussen in den Abfall (weg von der Platte) und muss sicher durch sein.
     Innenecken im Zugverlauf behalten die Eckenregel (Unterschnitt). */
  if (!geschlossen) {
    for (const idx of [0, n-1]) {
      const zer = steuercodeZerlegen(eff[idx].i);
      if (zer.schnitt !== 1) {
        /* evtl. vorhandene Ecken-Aenderung am selben Punkt hat Vorrang */
        if (erg.aenderungen.some(a => a.punktIdx === idx)) continue;
        erg.aenderungen.push({ punktIdx: idx, alt: eff[idx].i,
          neu: steuercodeBauen({ ...zer, schnitt: 1 }), art: 'ende' });
      }
    }
  }
  erg._geschlossen = geschlossen; erg._eff = eff;
  return erg;
}

function f1Anwenden(op, analyse) {
  const pts = (op.poly||[]).filter(e => e.type === 'PP' || e.type === 'KB');
  const geschlossen = analyse._geschlossen;
  for (const a of analyse.aenderungen) {
    analyse._eff[a.punktIdx].i = a.neu;
    /* geschlossener Zug: erster == letzter Punkt synchron halten */
    if (geschlossen && a.punktIdx === 0) pts[pts.length-1].i = a.neu;
  }
  op._modified = true;
}

function f1AlleAusfuehren() {
  if (!modell) return;
  const plan = [];
  for (const lage of modell.layers)
    for (const op of lage.ops)
      if (opIstZerspanend(op)) {
        const a = f1Analysieren(op);
        if (a.problem) plan.push({ lage, op, problem: a.problem });
        else if (a.aenderungen.length) plan.push({ lage, op, analyse: a });
      }
  const echte = plan.filter(p => p.analyse);
  const probleme = plan.filter(p => p.problem);
  if (!echte.length) {
    hinweisAnzeigen(probleme.length
      ? 'Keine Auto-Aenderung moeglich (' + probleme.length + ' Kontur(en) mit unklarer Materialseite).'
      : 'Alle Ecken bereits korrekt ueber-/unterschnitten.', 'erfolg');
    pruefungenAusfuehren(); fehlerLogRendern();
    return;
  }
  const summe = echte.reduce((s, p) => s + p.analyse.aenderungen.length, 0);
  bestaetigen('Auto-Schnitt: ' + summe + ' Eckpunkt(e) in ' + echte.length + ' Kontur(en) anpassen?'
    + (probleme.length ? ' (' + probleme.length + ' uebersprungen)' : ''), 'Anwenden', () => {
    aenderungBeginnen();
    for (const p of echte) f1Anwenden(p.op, p.analyse);
    alleNeuRendern();
    hinweisAnzeigen(summe + ' Steuercode(s) angepasst.', 'erfolg');
  });
}

/* =====================================================================
   F2 — FREISTICH an unterschnittenen Innenecken
   ===================================================================== */
function lagenMaterialAbrasiv(lage) {
  const idx = lage.plates.map(p => p.materialIdx).find(i => i != null && !isNaN(i) && i > 0);
  return istAbrasiv(idx);
}
/* v2.58 (Anwenderfund 2026-10-27): VORHANDENE Freistiche erkennen, auch
   wenn sie nicht vom Editor stammen. Granit schreibt sie als offene PAF mit
   genau 3 PP-Punkten (Schenkel 63 mm, Ecke = Eckpunkt der Kontur); bis v2.57
   zaehlte nur op.auto === 'freistich' — F2 setzte darum einen ZWEITEN
   Freistich ueber jeden vorhandenen, und P-10 meldete fertige Dateien.
   Ausserdem galt der Freistich selbst als Kontur mit Innenecke.
   Form allein genuegt nicht: der Eckpunkt muss auf einem Punkt einer
   ANDEREN zerspanenden Kontur derselben Lage liegen. */
const FREISTICH_SCHENKEL_MAX = 200;   /* [mm] Editor 94, Granit 63 */
function f2IstFreistichForm(op) {
  if (op.kw !== 'PAF') return false;
  const p = op.poly || [];
  if (p.length !== 3 || p.some(e => e.type !== 'PP')) return false;
  const l1 = Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y);
  const l2 = Math.hypot(p[2].x - p[1].x, p[2].y - p[1].y);
  if (l1 < 0.5 || l2 < 0.5 || l1 > FREISTICH_SCHENKEL_MAX || l2 > FREISTICH_SCHENKEL_MAX) return false;
  return Math.abs(Geo.cross([p[1].x - p[0].x, p[1].y - p[0].y], [p[2].x - p[1].x, p[2].y - p[1].y])) > 1e-6;
}
function f2IstFreistich(lage, op) {
  if (op.auto === 'freistich') return true;
  if (!lage || !f2IstFreistichForm(op)) return false;
  const m = op.poly[1];
  return lage.ops.some(o => o !== op && opIstZerspanend(o) && !f2IstFreistichForm(o)
    && (o.poly || []).some(e => (e.type === 'PP' || e.type === 'KB')
      && Math.hypot(e.x - m.x, e.y - m.y) <= 0.5));
}
function f2InneneckenFinden(op, nurUnterschnitten, lage) {
  const erg = [];
  if (!opIstZerspanend(op)) return erg;
  /* ein Freistich braucht keinen Freistich (v2.58) */
  if (op.auto === 'freistich' || (lage && f2IstFreistich(lage, op))) return erg;
  const a = f1Analysieren(op);
  if (a.problem || !a._eff) return erg;
  const eff = a._eff, n = eff.length;
  const geschlossen = a._geschlossen;
  const von = geschlossen ? 0 : 1, bis = geschlossen ? n : n - 1;
  for (let idx = von; idx < bis; idx++) {
    const vor = eff[(idx-1+n)%n], hier = eff[idx], nach = eff[(idx+1)%n];
    const u = [hier.x-vor.x, hier.y-vor.y], v = [nach.x-hier.x, nach.y-hier.y];
    if (Math.hypot(...u) < 0.01 || Math.hypot(...v) < 0.01) continue;
    const kreuz = Geo.cross(u, v);
    if (Math.abs(kreuz) < 1e-6) continue;
    const korr = steuercodeZerlegen(hier.i).korrektur;
    if (korr !== 1 && korr !== 2) continue;
    const innen = (korr === 2) ? (kreuz < 0) : (kreuz > 0);
    if (!innen) continue;
    if (nurUnterschnitten && steuercodeZerlegen(hier.i).schnitt !== 2) continue;
    /* Winkelhalbierende Richtung ABFALL: Normale beider Segmente zur Werkzeugseite */
    const un = Geo.norm(u), vn = Geo.norm(v);
    /* Werkzeug-/Abfallseite: korr 1 = Werkstueck rechts -> Abfall links (Normale links);
       korr 2 = Werkstueck links -> Abfall rechts (Normale rechts) */
    const nIn  = korr === 2 ? [un[1], -un[0]] : [-un[1], un[0]];
    const nOut = korr === 2 ? [vn[1], -vn[0]] : [-vn[1], vn[0]];
    const b = Geo.norm([nIn[0]+nOut[0], nIn[1]+nOut[1]]);
    erg.push({ punkt: hier, idx, bisector: b, unterschnitten: steuercodeZerlegen(hier.i).schnitt === 2,
      /* Kantenrichtungen am Eck: einDir zeigt VON der Ecke zurueck zum Vorgaenger,
         ausDir zeigt VON der Ecke zum Nachfolger — Basis fuer den klassischen Freistich */
      einDir: [-un[0], -un[1]], ausDir: [vn[0], vn[1]],
      einLaenge: Math.hypot(...u), ausLaenge: Math.hypot(...v) });
  }
  return erg;
}
function f2FreistichVorhanden(lage, ecke, r, eltern) {
  /* Freistich im Umkreis 2r um die Ecke vorhanden?
     - MP-Variante: Mittelpunkt nahe der Ecke
     - klassische Variante: ein PP-Punkt des PAF-Polyzugs liegt auf der Ecke —
       auch bei fremd erzeugten Freistichen (Granit, v2.58: f2IstFreistichForm).
     Die Eltern-Kontur selbst zaehlt nie (sie liegt ja auf der Ecke). */
  const grenze = 2 * r + 0.5;
  for (const op of lage.ops) {
    if (op.kw !== 'PAF' || op === eltern) continue;
    const klassisch = op.auto === 'freistich' || f2IstFreistichForm(op);
    for (const e of (op.poly || [])) {
      if (e.type === 'MP' && Geo.dist([e.x, e.y], [ecke.punkt.x, ecke.punkt.y]) <= grenze) return true;
      if (e.type === 'PP' && klassisch
          && Geo.dist([e.x, e.y], [ecke.punkt.x, ecke.punkt.y]) <= grenze) return true;
    }
  }
  return false;
}
function f2FreistichErzeugen(lage, op, ecke) {
  return profil.freistich.variante === 'klassisch'
    ? f2FreistichErzeugenKlassisch(lage, op, ecke)
    : f2FreistichErzeugenMp(lage, op, ecke);
}
function f2FreistichErzeugenMp(lage, op, ecke) {
  const r = lagenMaterialAbrasiv(lage) ? profil.freistich.radius_abrasiv : profil.freistich.radius_holz;
  const d = r / Math.SQRT2;
  const tElternRoh = ecke.punkt.t != null ? ecke.punkt.t : opMaxTiefe(op);
  /* B-05: Radiuskorrektur und Lauf von der Eltern-Bearbeitung erben —
     die Korrektur muss auf der Abfallseite liegen, die sich aus der Richtung
     der darunterliegenden Kontur ergibt. Abschaltbar via profil.freistich.korrektur_erben */
  const eltern = steuercodeZerlegen(ecke.punkt.i);
  const basis = steuercodeZerlegen(profil.freistich.steuercode);
  const erben = profil.freistich.korrektur_erben !== false && (eltern.korrektur === 1 || eltern.korrektur === 2);
  const code = erben
    ? steuercodeBauen({ werkzeug: basis.werkzeug, schnitt: 0, korrektur: eltern.korrektur, lauf: eltern.lauf })
    : profil.freistich.steuercode;
  /* Kreisrichtung passend zur Korrekturseite: korr 1 (Werkstueck rechts) -> CCW (r<0),
     korr 2 (Werkstueck links) -> CW (r>0); ohne Erben: CW wie bisher */
  const rSigniert = erben && eltern.korrektur === 1 ? -r : r;
  const neu = { id: 'op' + (++opIdZaehler), kw: 'PAF', headerParams: '',
    poly: [{ type: 'MP', x: Math.round((ecke.punkt.x + d*ecke.bisector[0])*1000)/1000,
             y: Math.round((ecke.punkt.y + d*ecke.bisector[1])*1000)/1000,
             r: rSigniert, t: tElternRoh, i: code,
             z: ecke.punkt.z != null ? ecke.punkt.z : null, raw: [] }],
    closed: false, auto: 'freistich', elternId: op.id, lageId: lage.id,
    _off: op._off ? op._off.slice() : [0, 0],
    txtKommentar: 'FREISTICH (AUTO)',
    _lineStart: -1, _lineEnd: -1, _modified: true, _neu: true };
  const pos = lage.ops.indexOf(op);
  lage.ops.splice(pos + 1, 0, neu);
  return neu;
}
function f2FreistichErzeugenKlassisch(lage, op, ecke) {
  /* Klassischer Freistich: PAF-Polyzug mit 3 PP-Punkten — von einem Punkt auf der
     einlaufenden Kante zur Ecke, dann zur auslaufenden Kante. Die Schenkel liegen
     ENTLANG der beiden Kanten (Material bleibt, der Fraeser raeumt die Ecke frei).
     Beispiel (Anwender):
        PAF;
        PP  2438,194,40,222,0,-40;   (Ende einlaufende Kante)
        PP  2438,100,40,222,0,-40;   (Ecke)
        PP  2344,100,40,222,0,-40;   (Ende auslaufende Kante)
     v2.58 — Anwender-Entscheidung E21 (2026-10-01, Konzept WupCreator):
     die freien ENDEN ueberschneiden (212), nur die ECKE unterschneidet
     (222). Mit 222 an allen drei Punkten meldete F1/P-11 jeden Freistich,
     und die Enden liefen nicht sicher durch. */
  const r3 = n => Math.round(n * 1000) / 1000;
  /* v2.58 SICHERHEIT: Schenkel hoechstens halbe Kantenlaenge (wie der
     WupCreator). Laenger liefe der Schenkel bei kurzen Kanten ueber die
     naechste Ecke der Kontur hinaus — die Verlaengerung der Kante liegt
     dort im GUTTEIL. Gekuerzte Schenkel werden gezaehlt (ui-Meldung). */
  const Lsoll = profil.freistich.klassisch_laenge || 94;
  const halbe = Math.min(ecke.einLaenge != null ? ecke.einLaenge / 2 : Infinity,
                         ecke.ausLaenge != null ? ecke.ausLaenge / 2 : Infinity);
  const L = Math.min(Lsoll, halbe);
  const tElternRoh = ecke.punkt.t != null ? ecke.punkt.t : opMaxTiefe(op);
  const zRoh = ecke.punkt.z != null ? ecke.punkt.z : null;
  const basisCode = profil.freistich.klassisch_steuercode != null
    ? profil.freistich.klassisch_steuercode : 222;
  const basisCodeEnden = profil.freistich.klassisch_steuercode_enden != null
    ? profil.freistich.klassisch_steuercode_enden : 212;
  /* Radiuskorrektur + Lauf von der Eltern-Kontur erben: der Polyzug laeuft in
     DERSELBEN Richtung wie die Eltern-Kontur (pEin→Ecke = Richtung des
     einlaufenden Segments, Ecke→pAus = Richtung des auslaufenden), das
     Werkstueck liegt also auf derselben Seite. Ein fest kodierter Basiscode
     (2xx) laesst die Maschine bei Eltern-Korrektur 1 auf der falschen Seite
     fraesen — ins Gutteil. Werkzeug + Schnittende kommen weiterhin aus dem
     Basiscode. Abschaltbar via profil.freistich.korrektur_erben (wie MP). */
  const eltern = steuercodeZerlegen(ecke.punkt.i);
  const erben = profil.freistich.korrektur_erben !== false
    && (eltern.korrektur === 1 || eltern.korrektur === 2);
  const codeAus = c => {
    const basis = steuercodeZerlegen(c);
    return erben ? steuercodeBauen({ werkzeug: basis.werkzeug, schnitt: basis.schnitt,
                                     korrektur: eltern.korrektur, lauf: eltern.lauf }) : c;
  };
  const code = codeAus(basisCode), codeEnde = codeAus(basisCodeEnden);
  const ein = ecke.einDir, aus = ecke.ausDir;
  const eckP = [ecke.punkt.x, ecke.punkt.y];
  const pEin = [eckP[0] + ein[0] * L, eckP[1] + ein[1] * L];
  const pAus = [eckP[0] + aus[0] * L, eckP[1] + aus[1] * L];
  const pp = (x, y, i) => ({ type: 'PP', x: r3(x), y: r3(y), t: tElternRoh, i,
    alpha: 0, z: zRoh, raw: [] });
  const neu = { id: 'op' + (++opIdZaehler), kw: 'PAF', headerParams: '',
    poly: [pp(pEin[0], pEin[1], codeEnde), pp(eckP[0], eckP[1], code), pp(pAus[0], pAus[1], codeEnde)],
    closed: false, auto: 'freistich', elternId: op.id, lageId: lage.id,
    _off: op._off ? op._off.slice() : [0, 0],
    txtKommentar: 'FREISTICH (AUTO, KLASSISCH)',
    _schenkelGekuerzt: L < Lsoll - 1e-9,
    _lineStart: -1, _lineEnd: -1, _modified: true, _neu: true };
  const pos = lage.ops.indexOf(op);
  lage.ops.splice(pos + 1, 0, neu);
  return neu;
}
function f2SammelAktion() {
  if (!modell) return;
  let anzahl = 0, gekuerzt = 0;
  aenderungBeginnen();
  for (const lage of modell.layers) {
    const fraeserR = lagenMaterialAbrasiv(lage) ? profil.freistich.radius_abrasiv : profil.freistich.radius_holz;
    for (const op of lage.ops.slice()) {
      if (!opIstZerspanend(op) || op.auto) continue;
      for (const ecke of f2InneneckenFinden(op, true, lage)) {
        if (!f2FreistichVorhanden(lage, ecke, fraeserR, op)) {
          if (f2FreistichErzeugen(lage, op, ecke)._schenkelGekuerzt) gekuerzt++;
          anzahl++;
        }
      }
    }
  }
  if (!anzahl) { undoStack.pop(); undoRedoKnoepfe(); }
  alleNeuRendern();
  hinweisAnzeigen(anzahl ? anzahl + ' Freistich(e) eingefuegt ('
      + (profil.freistich.variante === 'klassisch' ? 'klassisch, Enden '
        + profil.freistich.klassisch_steuercode_enden + ' / Ecke ' + profil.freistich.klassisch_steuercode
        + ', Korrektur von der Kontur' : 'Rundfraesung, r abhaengig vom Lagen-Material') + ').'
      + (gekuerzt ? ' ' + gekuerzt + ' davon mit gekuerzten Schenkeln (kurze Kante: hoechstens halbe Kantenlaenge, '
        + 'sonst liefe der Schenkel ins Gutteil) — bitte pruefen.' : '')
    : 'Keine unterschnittene Innenecke ohne Freistich gefunden (vorhandene Freistiche werden erkannt).',
    anzahl ? (gekuerzt ? 'warnung' : 'erfolg') : 'info');
}

