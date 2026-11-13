/* =====================================================================
   OP-HILFEN
   ===================================================================== */
function opIstZerspanend(op) { return op.kw === 'PAF' || op.kw === 'PSG'; }
function opHatKantenGeometrie(op) {
  /* WP2: Kanten-/Punktverschiebung nicht nur fuer zerspanende Ops (PAF/PSG),
     sondern fuer jede Op mit Polygon-Geometrie (auch PSF/PSZ) — nur reine NR ausgenommen. */
  return op.kw !== 'NR' && (op.poly || []).some(e => e.type === 'PP' || e.type === 'KB');
}
function opPunkte(op) {
  /* repraesentative Kontur-Punkte (MP/TA -> Quadrat-Ecken) */
  const pts = [];
  for (const e of (op.poly || [])) {
    if (e.type === 'PP' || e.type === 'KB') pts.push([e.x, e.y]);
    else if (e.type === 'MP') {
      const r = Math.abs(e.r);
      pts.push([e.x-r,e.y-r],[e.x+r,e.y-r],[e.x+r,e.y+r],[e.x-r,e.y+r]);
    } else if (e.type === 'TA') {
      pts.push([e.x-e.lx/2,e.y-e.by/2],[e.x+e.lx/2,e.y-e.by/2],
               [e.x+e.lx/2,e.y+e.by/2],[e.x-e.lx/2,e.y+e.by/2]);
    }
  }
  if (op.kw === 'NR' && op.nr) pts.push([op.nr.xa,op.nr.ya],[op.nr.xe,op.nr.ye]);
  return pts;
}
function opMaxTiefe(op) {
  let t = 0;
  for (const e of (op.poly||[])) if (e.t != null) t = Math.max(t, Math.abs(e.t));
  return t;
}
function nagelPunkte(nrOp) {
  const { xa, ya, xe, ye, a } = nrOp.nr;
  const pts = [[xa, ya]];
  const laenge = Math.hypot(xe-xa, ye-ya);
  if (laenge > 0.01 && a > 0.01) {
    const n = Math.floor(laenge / a);
    const ux = (xe-xa)/laenge, uy = (ye-ya)/laenge;
    for (let k = 1; k <= n; k++) pts.push([xa + ux*a*k, ya + uy*a*k]);
  }
  if (laenge > 0.01) pts.push([xe, ye]);
  return pts;
}
function lagenUnter(lage) {
  /* alle Lagen derselben Seite mit kleinerer Nummer */
  return modell.layers.filter(l => l.side === lage.side && l.num < lage.num);
}
function opPolyAlsArray(op) {
  return (op.poly||[]).filter(e => e.type==='PP'||e.type==='KB').map(e => [e.x, e.y]);
}
/* WP2: gesamte Geometrie einer Op um (dx, dy) verschieben — ALLE absoluten
   Koordinatenfelder (PP/KB/MP/TA: x,y; NR: xa,ya,xe,ye; NBR: x,y).
   Nicht zu verwechseln mit opVerschieben() (= Reihenfolge-Verschiebung in der Liste). */
function opGeometrieVerschieben(op, dx, dy) {
  for (const e of (op.poly || [])) { e.x += dx; e.y += dy; }
  if (op.nr) { op.nr.xa += dx; op.nr.ya += dy; op.nr.xe += dx; op.nr.ye += dy; }
  for (const n of (op.nbr || [])) { n.x += dx; n.y += dy; }
  op._modified = true;
  return op;
}

/* =====================================================================
   AP2: RECHTSKLICK-ZIEHEN — MEHRFACHAUSWAHL (Linie/Kasten)
   Reine, headless testbare Trefferpruefung. modus 'linie': Kreuzungs-Auswahl
   entlang der gezogenen Strecke a-b. modus 'kasten': alles, was das Rechteck
   a-b schneidet ODER darin liegt. Nur sichtbare Bearbeitungen (lagenSichtbar +
   ui.opFilter). Rueckgabe [{op, lage}]. */
function opGeometrieSegmenteUndKreise(op) {
  const segmente = [], kreise = [];
  if (op.kw === 'NR' && op.nr) {
    segmente.push([[op.nr.xa, op.nr.ya], [op.nr.xe, op.nr.ye]]);
  } else {
    const pts = (op.poly || []).filter(e => e.type === 'PP' || e.type === 'KB' || e.type === 'TA').map(e => [e.x, e.y]);
    for (let i = 0; i < pts.length - 1; i++) segmente.push([pts[i], pts[i + 1]]);
    for (const e of (op.poly || [])) if (e.type === 'MP') kreise.push({ zentrum: [e.x, e.y], r: Math.abs(e.r) });
  }
  return { segmente, kreise };
}
function opsImBereich(modus, a, b) {
  const treffer = [];
  const minX = Math.min(a[0], b[0]), maxX = Math.max(a[0], b[0]);
  const minY = Math.min(a[1], b[1]), maxY = Math.max(a[1], b[1]);
  /* geschlossenes Rechteck-Polygon fuer den Kasten-Modus (im Uhrzeigersinn/-gegen egal —
     Geo.punktInPolygon/segmentKreuztPolygon sind vorzeichenunabhaengig) */
  const rechteckPoly = [[minX, minY], [maxX, minY], [maxX, maxY], [minX, maxY]];
  const rechteckBbox = { minX, minY, maxX, maxY };
  for (const lage of modell.layers.filter(lagenSichtbar)) {
    for (const op of lage.ops) {
      if (ui.opFilter[op.kw] === false) continue;
      const { segmente, kreise } = opGeometrieSegmenteUndKreise(op);
      let treffend = false;
      if (modus === 'linie') {
        for (const [p1, p2] of segmente) if (Geo.segmenteSchneiden(a, b, p1, p2)) { treffend = true; break; }
        if (!treffend) for (const k of kreise) if (Geo.distPunktSegment(k.zentrum, a, b) <= k.r) { treffend = true; break; }
      } else { /* 'kasten' */
        for (const [p1, p2] of segmente) if (Geo.segmentKreuztPolygon(p1, p2, rechteckPoly)) { treffend = true; break; }
        if (!treffend) for (const k of kreise) {
          const kreisBbox = { minX: k.zentrum[0] - k.r, minY: k.zentrum[1] - k.r, maxX: k.zentrum[0] + k.r, maxY: k.zentrum[1] + k.r };
          if (Geo.bboxUeberlappt(kreisBbox, rechteckBbox)) { treffend = true; break; }
        }
      }
      if (treffend) treffer.push({ op, lage });
    }
  }
  return treffer;
}

/* =====================================================================
   UNDO / REDO  (Snapshot des editierbaren Modells, min. 30 Schritte)
   ===================================================================== */
const undoStack = [], redoStack = [];
function snapshotErzeugen() {
  /* beams enthalten zyklische _beam-Referenzen in den Bearbeitungen -> vor dem Klonen kappen */
  const beamsFlach = modell.beams.map(b => {
    const kopie = Object.assign({}, b, {
      bearbeitungen: (b.bearbeitungen || []).map(bb => {
        const { _beam, ...rest } = bb;
        return structuredClone(rest);
      })
    });
    return kopie;
  });
  return {
    layers: structuredClone(modell.layers),
    beams: beamsFlach,
    zeilenErsetzungen: structuredClone(modell._zeilenErsetzungen || [])
  };
}
function aenderungBeginnen() {
  if (!modell) return;
  undoStack.push(snapshotErzeugen());
  if (undoStack.length > UNDO_MAX_SCHRITTE) undoStack.shift();
  redoStack.length = 0;
  undoRedoKnoepfe();
}
function snapshotAnwenden(s) {
  modell.layers = s.layers;
  if (s.zeilenErsetzungen !== undefined) modell._zeilenErsetzungen = s.zeilenErsetzungen;
  if (s.beams !== undefined) modell.beams = s.beams;
  alleNeuRendern();
}
function rueckgaengig() {
  if (!undoStack.length) return;
  redoStack.push(snapshotErzeugen());
  snapshotAnwenden(undoStack.pop());
  undoRedoKnoepfe();
  hinweisAnzeigen('Rueckgaengig', 'info');
}
function wiederholen() {
  if (!redoStack.length) return;
  undoStack.push(snapshotErzeugen());
  snapshotAnwenden(redoStack.pop());
  undoRedoKnoepfe();
}
function undoRedoKnoepfe() {
  document.getElementById('btnUndo').disabled = !undoStack.length;
  document.getElementById('btnRedo').disabled = !redoStack.length;
}

