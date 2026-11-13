/* =====================================================================
   §6 LEICHTER KARTEN-SVG-RENDERER (eigenstaendig, NICHT svgRendern() des
   Editors — nur Umrisse/Linien fuer eine schnelle Sichtpruefung)
   ===================================================================== */
function bboxUeberlappt1D(minA, maxA, minB, maxB) { return minA <= maxB && maxA >= minB; }

function punkteAusOp(op) {
  const pts = [];
  for (const e of (op.poly || [])) {
    if (e.type === 'PP' || e.type === 'KB') pts.push([e.x, e.y]);
    else if (e.type === 'MP') pts.push([e.x, e.y]);
    else if (e.type === 'TA') pts.push([e.x, e.y], [e.x + e.lx, e.y], [e.x + e.lx, e.y + e.by], [e.x, e.y + e.by]);
  }
  return pts;
}

function svgPolylinie(pts, geschlossen, attrs) {
  if (!pts.length) return '';
  const d = pts.map(p => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ');
  const tag = geschlossen ? 'polygon' : 'polyline';
  return '<' + tag + ' points="' + d + '" ' + attrs + '/>';
}

function kartenSvgErzeugen(frei, wand) {
  const tol = 5; /* mm Toleranz beim Ueberlapp-Test mit dem Wand-X-Bereich */
  let minY = Infinity, maxY = -Infinity;
  let minX = wand.xMin, maxX = wand.xMax;
  const teile = [];
  /* WP-F: Solo-Modus — ist genau EIN Bearbeitungstyp sichtbar (Alt+Klick auf
     den Chip), wird dieser Typ kraeftig hervorgehoben und der Rest gedimmt,
     damit er auch in den kleinen Karten sofort ins Auge springt. */
  const soloTyp = (() => {
    const an = Object.keys(sichtbarkeit.bearbeitungen).filter(k => sichtbarkeit.bearbeitungen[k]);
    return an.length === 1 ? an[0] : null;
  })();
  const wandBreite = Math.max(500, (wand.xMax - wand.xMin) || 0);
  const soloDick = wandBreite / 60;       /* Strichstaerke in Weltkoordinaten (mm) */
  const hintergrundDimm = soloTyp ? ' opacity="0.35"' : '';

  const bboxErweitern = pts => {
    for (const p of pts) { if (p[1] < minY) minY = p[1]; if (p[1] > maxY) maxY = p[1]; }
  };

  /* Platten je Lage */
  for (const lage of frei.layers) {
    if (!sichtbarkeit.lagen[lage.id]) continue;
    const farbe = (lage.typ === 'PLI' || lage.typ === 'SLI') ? 'var(--svg-platte-innen)' : 'var(--svg-platte-aussen)';
    for (const p of lage.plates) {
      if (!p.outline || p.outline.length < 3) continue;
      let pMinX = Infinity, pMaxX = -Infinity;
      for (const pt of p.outline) { if (pt[0] < pMinX) pMinX = pt[0]; if (pt[0] > pMaxX) pMaxX = pt[0]; }
      if (!bboxUeberlappt1D(pMinX, pMaxX, minX - tol, maxX + tol)) continue;
      bboxErweitern(p.outline);
      teile.push(svgPolylinie(p.outline, true,
        'fill="' + farbe + '" fill-opacity="0.22" stroke="' + farbe + '" stroke-width="3"' + hintergrundDimm));
    }
  }
  /* Riegel (Bauteile) */
  for (const beam of (sichtbarkeit.riegel === false ? [] : (frei.beams || []))) {
    if (!beam.outline || beam.outline.length < 3) continue;
    let bMinX = Infinity, bMaxX = -Infinity;
    for (const pt of beam.outline) { if (pt[0] < bMinX) bMinX = pt[0]; if (pt[0] > bMaxX) bMaxX = pt[0]; }
    if (!bboxUeberlappt1D(bMinX, bMaxX, minX - tol, maxX + tol)) continue;
    bboxErweitern(beam.outline);
    teile.push(svgPolylinie(beam.outline, true,
      'fill="var(--svg-riegel)" fill-opacity="0.55" stroke="var(--svg-riegel-rand)" stroke-width="2.5"' + hintergrundDimm));
  }
  /* Bearbeitungen je Lage (nur sichtbare Typen/Lagen) */
  for (const lage of frei.layers) {
    if (!sichtbarkeit.lagen[lage.id]) continue;
    for (const op of lage.ops) {
      if (!sichtbarkeit.bearbeitungen[op.kw]) continue;
      const farbe = BEARBEITUNGS_FARBEN[op.kw] || 'var(--text-gedimmt)';
      const solo = soloTyp === op.kw;
      if (op.kw === 'NR' && op.nr) {
        const a = [op.nr.xa, op.nr.ya], b = [op.nr.xe, op.nr.ye];
        if (!bboxUeberlappt1D(Math.min(a[0], b[0]), Math.max(a[0], b[0]), minX - tol, maxX + tol)) continue;
        bboxErweitern([a, b]);
        if (solo) teile.push(svgPolylinie([a, b], false,
          'fill="none" stroke="' + farbe + '" stroke-width="' + (soloDick * 2.2).toFixed(1) + '" stroke-linecap="round" opacity="0.25"'));
        teile.push(svgPolylinie([a, b], false, 'fill="none" stroke="' + farbe + '" stroke-width="'
          + (solo ? soloDick.toFixed(1) : 4) + '" stroke-linecap="round"'));
        continue;
      }
      const pts = punkteAusOp(op);
      if (!pts.length) continue;
      let oMinX = Infinity, oMaxX = -Infinity;
      for (const pt of pts) { if (pt[0] < oMinX) oMinX = pt[0]; if (pt[0] > oMaxX) oMaxX = pt[0]; }
      if (!bboxUeberlappt1D(oMinX, oMaxX, minX - tol, maxX + tol)) continue;
      bboxErweitern(pts);
      const gestrichelt = (op.kw === 'PSF' || op.kw === 'PSZ') ? 'stroke-dasharray="10 6"' : '';
      if (solo) teile.push(svgPolylinie(pts, !!op.closed,
        'fill="none" stroke="' + farbe + '" stroke-width="' + (soloDick * 2.2).toFixed(1) + '" opacity="0.25"'));
      teile.push(svgPolylinie(pts, !!op.closed,
        'fill="none" stroke="' + farbe + '" stroke-width="' + (solo ? soloDick.toFixed(1) : 2.4) + '" ' + gestrichelt));
    }
  }
  /* v0.18: BOZ in PLATTENLAGEN (Einblaslage PLI0) — vom Kern als
     lage.bohrungen gelesen (Editor v2.60), Element-Koordinaten */
  if (sichtbarkeit.bohrungen !== false) {
    for (const lage of frei.layers) {
      if (!sichtbarkeit.lagen[lage.id]) continue;
      for (const b of (lage.bohrungen || [])) {
        if (!bboxUeberlappt1D(b.x, b.x, minX - tol, maxX + tol)) continue;
        const rb = Math.max(Math.max(35, wandBreite * 0.014) * 0.8, (b.d || 0) / 2);
        teile.push('<g data-bohrung="lage"><circle cx="' + b.x.toFixed(1) + '" cy="' + b.y.toFixed(1) + '" r="' + rb.toFixed(1)
          + '" fill="var(--svg-bohrung)" fill-opacity="0.25" stroke="var(--svg-bohrung)" stroke-width="' + (rb * 0.25).toFixed(1)
          + '" stroke-dasharray="' + (rb * 0.5).toFixed(1) + ' ' + (rb * 0.3).toFixed(1) + '"/>'
          + '<path d="M' + (b.x - rb).toFixed(1) + ' ' + b.y.toFixed(1) + 'H' + (b.x + rb).toFixed(1)
          + 'M' + b.x.toFixed(1) + ' ' + (b.y - rb).toFixed(1) + 'V' + (b.y + rb).toFixed(1)
          + '" stroke="var(--svg-bohrung)" stroke-width="' + (rb * 0.18).toFixed(1) + '"/></g>');
      }
    }
  }
  /* WP-D / v0.17: BOHRUNGEN am Riegelwerk (Anwenderwunsch "BOZ im Oversight
     auch"). Lage im BAUTEIL-System ueber den Kern (bauteilPunktGlobal,
     Editor v2.59: QS senkrecht, BT4/BT6 entlang P1.1→P2.2) — fehlt der
     Kern oder ist er aelter, gilt die alte Rechnung beam.x + x (richtig nur
     fuer liegende Gurte). Richtungsbohrungen (Hauskonvention: Ø40, geringe Tiefe,
     OG/UG) kraeftig in Akzentfarbe, alle uebrigen BOZ/BOY/BOX als Kreis
     mit Kreuz. Eigene Chips "Richtungsbohrung" und "Bohrungen". */
  const kernBauteil = kern && typeof kern.bauteilPunktGlobal === 'function' && typeof kern.bohrungLokal === 'function';
  const istRichtung = (beam, bb) => {
    if (beam.kw !== 'OG' && beam.kw !== 'UG') return false;
    if (kern && typeof kern.richtungsbearbeitungFinden === 'function')
      return kern.richtungsbearbeitungFinden(beam).some(g => g.bb === bb);
    if (bb.kw !== 'BOZ' || !bb.params || bb.params.length < 4) return false;
    const d = Math.abs(parseFloat(bb.params[2])), t = Math.abs(parseFloat(bb.params[3]));
    return !isNaN(d) && Math.abs(d - 40) <= 2 && !isNaN(t) && t >= 1 && t <= 5;
  };
  const bohrPos = (beam, bb) => {
    if (kernBauteil) {
      const lok = kern.bohrungLokal(beam, bb);
      return lok ? kern.bauteilPunktGlobal(beam, lok[0], lok[1]) : null;
    }
    if (bb.kw !== 'BOZ') return null;
    return [(beam.x || 0) + (parseFloat(bb.params[0]) || 0), (beam.y || 0) + (parseFloat(bb.params[1]) || 0)];
  };
  for (const beam of (frei.beams || [])) {
    for (const bb of (beam.bearbeitungen || [])) {
      if ((bb.kw !== 'BOZ' && bb.kw !== 'BOY' && bb.kw !== 'BOX') || !bb.params || bb.params.length < 3) continue;
      const richtung = istRichtung(beam, bb);
      if (richtung ? sichtbarkeit.richtung === false : sichtbarkeit.bohrungen === false) continue;
      const pos = bohrPos(beam, bb);
      if (!pos || isNaN(pos[0]) || isNaN(pos[1])) continue;
      const px = pos[0], py = pos[1];
      if (!bboxUeberlappt1D(px, px, minX - tol, maxX + tol)) continue;
      const r = Math.max(35, wandBreite * 0.014);
      if (richtung) {
        teile.push('<circle cx="' + px.toFixed(1) + '" cy="' + py.toFixed(1) + '" r="' + (r * 2).toFixed(1)
          + '" fill="var(--akzent)" fill-opacity="0.18"/>'
          + '<circle cx="' + px.toFixed(1) + '" cy="' + py.toFixed(1) + '" r="' + r.toFixed(1)
          + '" fill="var(--akzent)" stroke="var(--flaeche)" stroke-width="' + (r * 0.3).toFixed(1) + '"/>');
      } else {
        const rb = Math.max(r * 0.8, Math.abs(parseFloat(bb.params[2]) || 0) / 2);
        teile.push('<g data-bohrung="' + bb.kw + '"><circle cx="' + px.toFixed(1) + '" cy="' + py.toFixed(1) + '" r="' + rb.toFixed(1)
          + '" fill="var(--svg-bohrung)" fill-opacity="0.25" stroke="var(--svg-bohrung)" stroke-width="' + (rb * 0.25).toFixed(1) + '"/>'
          + '<path d="M' + (px - rb).toFixed(1) + ' ' + py.toFixed(1) + 'H' + (px + rb).toFixed(1)
          + 'M' + px.toFixed(1) + ' ' + (py - rb).toFixed(1) + 'V' + (py + rb).toFixed(1)
          + '" stroke="var(--svg-bohrung)" stroke-width="' + (rb * 0.18).toFixed(1) + '"/></g>');
      }
    }
  }

  if (!isFinite(minY)) { minY = 0; maxY = (frei.header.ELM && frei.header.ELM.by) || 1000; }
  const pad = Math.max(20, (maxX - minX) * 0.03, (maxY - minY) * 0.03);
  const vbX = minX - pad, vbY = -(maxY + pad);
  const vbW = (maxX - minX) + 2 * pad, vbH = (maxY - minY) + 2 * pad;
  const clipId = 'clip-w-' + wand.dateiIndex + '-' + wand.wandIndex;
  return '<svg viewBox="' + vbX.toFixed(1) + ' ' + vbY.toFixed(1) + ' ' + vbW.toFixed(1) + ' ' + vbH.toFixed(1) + '" '
    + 'preserveAspectRatio="xMidYMid meet">'
    /* clip-path wird vom Browser MIT der scale(1,-1)-Transform des <g>
       gespiegelt — das Rect muss daher in WELT-Koordinaten (wie die Kinder)
       stehen, nicht im gespiegelten Anzeige-System. Sonst deckt es nach der
       Spiegelung nur einen flachen Streifen bei y≈0 ab (Bug: Karten zeigten
       nur die Unterkante der Wand). */
    + '<defs><clipPath id="' + clipId + '"><rect x="' + (minX - tol).toFixed(1) + '" y="' + (minY - pad).toFixed(1)
      + '" width="' + ((maxX - minX) + 2 * tol).toFixed(1) + '" height="' + ((maxY - minY) + 2 * pad).toFixed(1) + '"/></clipPath></defs>'
    + '<g transform="scale(1,-1)" clip-path="url(#' + clipId + ')">' + teile.join('') + '</g>'
    + '</svg>';
}

