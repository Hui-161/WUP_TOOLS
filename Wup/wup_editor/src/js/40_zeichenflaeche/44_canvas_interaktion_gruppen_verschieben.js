/* =====================================================================
   §14 CANVAS-INTERAKTION
   ===================================================================== */
function svgWeltPunkt(ev) {
  const svg = svgEl();
  const ctm = svg.getScreenCTM();
  if (!ctm) return null;
  const p = new DOMPoint(ev.clientX, ev.clientY).matrixTransform(ctm.inverse());
  return vonSVG(p.x, p.y);
}
function canvasWheel(ev) {
  if (!modell) return;
  ev.preventDefault();
  let faktor = ev.deltaY < 0 ? ZOOM_SCHRITT_FAKTOR : 1 / ZOOM_SCHRITT_FAKTOR;      /* B-04: sanftere Schritte */
  const w = document.getElementById('canvasWrapper');
  const ELM = modell.header.ELM;
  const fit = Math.min((w.clientWidth - 80) / Math.max(1, ELM.lx),
                       (w.clientHeight - 80) / Math.max(1, ELM.by));
  const minS = Math.max(ZOOM_MIN_ABSOLUT, fit * ZOOM_MIN_ANTEIL_VON_FIT), maxS = ZOOM_MAX_SKALIERUNG;
  const zielS = Math.max(minS, Math.min(maxS, ui.scale * faktor));
  if (zielS === ui.scale) return;
  faktor = zielS / ui.scale;
  const svg = svgEl();
  const ctm = svg.getScreenCTM();
  const p = new DOMPoint(ev.clientX, ev.clientY).matrixTransform(ctm.inverse());
  ui.pan.x = p.x - (p.x - ui.pan.x) * faktor;
  ui.pan.y = p.y - (p.y - ui.pan.y) * faktor;
  ui.scale = zielS;
  svgRendernThrottled();
}
function elementUnterMaus(ev) {
  let el = ev.target;
  while (el && el !== svgEl()) {
    if (el.dataset) {
      if (el.dataset.nrEnde != null && el.dataset.op) return { typ: 'nr-ende', opId: el.dataset.op, ende: el.dataset.nrEnde };
      if (el.dataset.op) return { typ: 'op', opId: el.dataset.op };
      if (!ui.nurOps && el.dataset.platte) return { typ: 'platte', plattenId: el.dataset.platte };
      if (!ui.nurOps && el.dataset.beam) return { typ: 'beam', beamId: el.dataset.beam };
    }
    el = el.parentNode;
  }
  return null;
}
/* =====================================================================
   WP-C (EXPERIMENTELL, Anwenderwunsch 2026-07-29): Gruppen-Verschieben bei
   Mehrfachauswahl im Verschieben-Modus (K).
   a) Ganze Bearbeitung angefasst, die Teil der Mehrfachauswahl ist ->
      ALLE ausgewaehlten Bearbeitungen ziehen gemeinsam (ein Delta).
   b) NR-ENDPUNKT angefasst und >= 2 NRs ausgewaehlt -> die GLEICHSEITIGEN
      Endpunkte aller ausgewaehlten NRs ziehen gemeinsam (verkuerzen/
      verlaengern). BEZUGSKANTE: massgeblich ist die Haelfte der ANGEKLICKTEN
      NR, in der der gegriffene Endpunkt liegt; fuer jede weitere NR wird der
      Endpunkt gewaehlt, der — projiziert auf die Achse der angeklickten NR —
      auf derselben Seite seiner eigenen NR-Mitte liegt. Damit ist die Wahl
      unabhaengig davon, wie xa/xe in der Datei orientiert sind.
   Kernlogik als reine Funktionen (headless testbar, Muster WP-A).
   ===================================================================== */
function opInMehrfachauswahl(opId) {
  return !!(ui.auswahl && ui.auswahl.typ === 'op' && ui.mehrAuswahl.length > 0
    && (ui.auswahl.id === opId || ui.mehrAuswahl.includes(opId)));
}
/* Bestimmt fuer jede ausgewaehlte NR den zum angeklickten Endpunkt
   GLEICHSEITIGEN Endpunkt. nrs: [{op, lage}], klickOp: die angefasste NR,
   klickEnde: 'a'|'e'. Rueckgabe: [{op, ende}] in Reihenfolge von nrs. */
function nrGruppenEndpunkte(nrs, klickOp, klickEnde) {
  const n0 = klickOp.nr;
  const p0 = klickEnde === 'a' ? [n0.xa, n0.ya] : [n0.xe, n0.ye];
  const m0 = [(n0.xa + n0.xe) / 2, (n0.ya + n0.ye) / 2];
  let achse = [p0[0] - m0[0], p0[1] - m0[1]];
  const laenge = Math.hypot(achse[0], achse[1]);
  achse = laenge > 1e-9 ? [achse[0] / laenge, achse[1] / laenge] : null;  /* Einzelnagel: keine Achse */
  const ziele = [];
  for (const f of nrs) {
    if (!f.op.nr) continue;
    if (f.op === klickOp || f.op.id === klickOp.id) { ziele.push({ op: f.op, ende: klickEnde }); continue; }
    const n = f.op.nr;
    if (!achse) { ziele.push({ op: f.op, ende: klickEnde }); continue; }
    const mx = (n.xa + n.xe) / 2, my = (n.ya + n.ye) / 2;
    const projA = (n.xa - mx) * achse[0] + (n.ya - my) * achse[1];
    /* projE = -projA (Mitte ist symmetrisch). Quer liegende NR (Projektion ~0):
       Rueckfall auf den Endpunkt, der dem angeklickten Punkt naeher liegt. */
    if (Math.abs(projA) < 1e-6) {
      const dA = Geo.dist(p0, [n.xa, n.ya]), dE = Geo.dist(p0, [n.xe, n.ye]);
      ziele.push({ op: f.op, ende: dA <= dE ? 'a' : 'e' });
    } else {
      ziele.push({ op: f.op, ende: projA > 0 ? 'a' : 'e' });
    }
  }
  return ziele;
}
/* Wendet ein gemeinsames Delta auf die Gruppen-Endpunkte an (absolut ab
   Dragstart-Schnappschuss — kein Drift durch inkrementelle Rundung). */
function nrGruppenEndpunkteSetzen(ziele, dx, dy) {
  for (const z of ziele) {
    const f = opFinden(z.opId);
    if (!f || !f.op.nr) continue;
    if (z.ende === 'a') { f.op.nr.xa = z.start.x + dx; f.op.nr.ya = z.start.y + dy; }
    else { f.op.nr.xe = z.start.x + dx; f.op.nr.ye = z.start.y + dy; }
    f.op._modified = true;
  }
}
/* Stellt alle Gruppen-Ops aus dem Dragstart-Schnappschuss wieder her und
   verschiebt sie in EINEM Schritt um (dx, dy) — Muster wie 'op-ganz'. */
function opsGruppeSetzen(starts, dx, dy) {
  for (const s of starts) {
    const f = opFinden(s.opId);
    if (!f) continue;
    for (let i = 0; i < (f.op.poly || []).length; i++) { f.op.poly[i].x = s.poly[i].x; f.op.poly[i].y = s.poly[i].y; }
    if (f.op.nr && s.nr) { f.op.nr.xa = s.nr.xa; f.op.nr.ya = s.nr.ya; f.op.nr.xe = s.nr.xe; f.op.nr.ye = s.nr.ye; }
    if (f.op.nbr) for (let i = 0; i < f.op.nbr.length; i++) { f.op.nbr[i].x = s.nbr[i].x; f.op.nbr[i].y = s.nbr[i].y; }
    opGeometrieVerschieben(f.op, dx, dy);
  }
}
function nrGruppenEndeDragStarten(welt, klickOp, klickEnde) {
  const nrs = mehrfachOps().filter(g => g.op.kw === 'NR' && g.op.nr);
  snapPunkteAufbauen();
  const ziele = nrGruppenEndpunkte(nrs, klickOp, klickEnde).map(z => ({
    opId: z.op.id, ende: z.ende,
    start: z.ende === 'a' ? { x: z.op.nr.xa, y: z.op.nr.ya } : { x: z.op.nr.xe, y: z.op.nr.ye },
    nrStart: structuredClone(z.op.nr)
  }));
  ui.dragging = {
    art: 'nr-gruppe-ende', ziele, klickOpId: klickOp.id, klickEnde,
    start: welt, bewegt: false, zuletztSnap: null,
    ausschluss: ziele.map(z => [z.start.x, z.start.y])
  };
}
function opsGruppeDragStarten(welt, ankerOp) {
  const gewaehlt = mehrfachOps();
  snapPunkteAufbauen();
  const starts = [], ausschluss = [];
  for (const g of gewaehlt) {
    starts.push({ opId: g.op.id,
      poly: structuredClone(g.op.poly || []),
      nr: structuredClone(g.op.nr || null),
      nbr: structuredClone(g.op.nbr || []) });
    for (const p of opPolyAlsArray(g.op)) ausschluss.push(p);
    if (g.op.nr) ausschluss.push([g.op.nr.xa, g.op.nr.ya], [g.op.nr.xe, g.op.nr.ye]);
    for (const n of (g.op.nbr || [])) ausschluss.push([n.x, n.y]);
  }
  /* Anker fuer den Punktfang = der Punkt der ANGEFASSTEN Op, der der Maus am
     naechsten liegt (gleiche Mechanik wie 'op-ganz') */
  const opPunkte = opPolyAlsArray(ankerOp)
    .concat(ankerOp.nr ? [[ankerOp.nr.xa, ankerOp.nr.ya], [ankerOp.nr.xe, ankerOp.nr.ye]] : []);
  let anker = null, besteDist = Infinity;
  for (const p of opPunkte) {
    const dd = Geo.dist(welt, p);
    if (dd < besteDist) { besteDist = dd; anker = { x: p[0], y: p[1] }; }
  }
  ui.dragging = { art: 'ops-gruppe', starts, start: welt, anker, ausschluss, bewegt: false, zuletztSnap: null };
}
