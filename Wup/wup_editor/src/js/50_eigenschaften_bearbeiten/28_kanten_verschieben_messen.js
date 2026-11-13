/* =====================================================================
   F6 — KANTEN VERSCHIEBEN
   ===================================================================== */
function kanteHolen(k) {
  /* k = { besitzer:'platte'|'op', id, segIdx } -> { a, b, setze(fn) } */
  if (k.besitzer === 'platte') {
    const f = platteFinden(k.id);
    if (!f) return null;
    const o = f.platte.outline;
    if (k.segIdx >= o.length - 1) return null;
    return { a: o[k.segIdx], b: o[k.segIdx + 1], platte: f.platte, lage: f.lage };
  }
  const f = opFinden(k.id);
  if (!f) return null;
  const pts = (f.op.poly||[]).filter(e => e.type==='PP'||e.type==='KB');
  if (k.segIdx >= pts.length - 1) return null;
  return { a: [pts[k.segIdx].x, pts[k.segIdx].y], b: [pts[k.segIdx+1].x, pts[k.segIdx+1].y],
           op: f.op, lage: f.lage, p1: pts[k.segIdx], p2: pts[k.segIdx+1] };
}
function kantenUrsprungErfassen(kanten) {
  /* Schnappschuss der Original-Endpunkte + Kanten-Normale je Kante VOR jeder
     Verschiebung — Grundlage fuer absolute (nicht-inkrementelle) Verschiebung,
     damit wiederholtes Setzen (Drag) nicht durch Rundungsfehler driftet. */
  const erg = [];
  for (const k of kanten) {
    const seg = kanteHolen(k);
    if (!seg) continue;
    const u = Geo.norm([seg.b[0]-seg.a[0], seg.b[1]-seg.a[1]]);
    const n = [-u[1], u[0]];
    let istGeschlossen = false;
    if (k.besitzer === 'platte') {
      const o = seg.platte.outline;
      istGeschlossen = o.length >= 2 && Math.abs(o[0][0]-o[o.length-1][0]) < 0.01 && Math.abs(o[0][1]-o[o.length-1][1]) < 0.01;
    }
    /* Normalen der Gruppe an der ersten Kante ausrichten: kollineare Kanten
       koennen entgegengesetzt durchlaufen sein (Plattenumriss CCW, deckungs-
       gleicher PSG-Zuschnitt CW — der Normalfall bei verknuepften Kanten,
       Spec F6). Ohne Ausrichtung wandern sie bei gemeinsamem Verschieben in
       ENTGEGENGESETZTE Richtungen und die Kontur reisst auseinander. */
    if (erg.length && (n[0]*erg[0].n[0] + n[1]*erg[0].n[1]) < 0) { n[0] = -n[0]; n[1] = -n[1]; }
    erg.push({ k, seg, a0: seg.a.slice(), b0: seg.b.slice(), n, istGeschlossen });
  }
  return erg;
}
function kantenGeometrieSetzen(ursprung, delta, richtung) {
  /* Setzt jede Kante ABSOLUT auf a0/b0 + Versatz — kein +=, daher driftfrei bei
     wiederholtem Aufruf mit demselben Ursprung (z.B. waehrend eines Drags).
     richtung: 'senkrecht' (Default) = delta entlang Kanten-Normale (parallel-
     Versatz) · 'x' = delta rein in X · 'y' = delta rein in Y. */
  for (const u of ursprung) {
    const { k, seg, a0, b0, n } = u;
    const dx = richtung === 'x' ? delta : richtung === 'y' ? 0 : n[0]*delta;
    const dy = richtung === 'y' ? delta : richtung === 'x' ? 0 : n[1]*delta;
    if (k.besitzer === 'platte') {
      const o = seg.platte.outline;
      o[k.segIdx][0] = a0[0]+dx; o[k.segIdx][1] = a0[1]+dy;
      o[k.segIdx+1][0] = b0[0]+dx; o[k.segIdx+1][1] = b0[1]+dy;
      if (u.istGeschlossen) {
        if (k.segIdx === 0) { o[o.length-1][0] = a0[0]+dx; o[o.length-1][1] = a0[1]+dy; }
        if (k.segIdx + 1 === o.length - 1) { o[0][0] = b0[0]+dx; o[0][1] = b0[1]+dy; }
      }
      /* Kopf-Masse nachfuehren */
      const b = Geo.bbox(o);
      seg.platte.x = b.minX; seg.platte.y = b.minY;
      seg.platte.lx = Math.round((b.maxX - b.minX)*1000)/1000;
      seg.platte.by = Math.round((b.maxY - b.minY)*1000)/1000;
      if (seg.platte.outlineSource === 'header') {
        /* Header-Rechteck: Umriss bleibt Header-generiert, Masse oben reichen */
      } else seg.platte.outlineSource = 'pp';
      seg.platte._modified = true;
    } else {
      seg.p1.x = a0[0]+dx; seg.p1.y = a0[1]+dy;
      seg.p2.x = b0[0]+dx; seg.p2.y = b0[1]+dy;
      const pts = (seg.op.poly||[]).filter(e => e.type==='PP'||e.type==='KB');
      /* NUR bei geschlossenem Zug: Duplikat-Endpunkt synchron halten. Offene
         Zuege (z.B. Tuer-PSG als offene П-Form) haben ebenfalls >= 3 Punkte —
         ohne closed-Pruefung wuerde der letzte Punkt auf den ersten gezwungen
         und die Kontur kollabiert zum Dreieck. */
      if (seg.op.closed && pts.length >= 3) {
        if (seg.p1 === pts[0]) { pts[pts.length-1].x = seg.p1.x; pts[pts.length-1].y = seg.p1.y; }
        if (seg.p2 === pts[pts.length-1]) { pts[0].x = seg.p2.x; pts[0].y = seg.p2.y; }
      }
      seg.op._modified = true;
    }
  }
}
/* Feedback-Punkt 6: Punktfang beim parallelen Verschieben einer mittig
   gegriffenen Kante (Drag-Art 'kante-ganz'). 'freiesDelta' ist die ohne Fang
   errechnete Normalen-Verschiebung; a0/n0 sind Ausgangspunkt bzw. Normale der
   ERSTEN Kante der Gruppe (wie in kantenUrsprungErfassen). Aus 'liste' (ohne
   'ausschluss') wird der Punkt gewaehlt, der (a) nahe genug an der Maus liegt
   (Fangradius) und (b) dessen "einrastendes" Delta — also jenes Delta, bei dem
   die verschobene Kante GENAU durch den Punkt laeuft — dem freien Delta am
   naechsten kommt. Rein rechnerisch (kein DOM-Zugriff) und daher headless
   testbar (Wup/Tests/kante_fang_smoke.js). */
function kantenFangDeltaFinden(mausWelt, freiesDelta, a0, n0, liste, ausschluss) {
  const fangradius = SNAP_FANGRADIUS_PX / ui.scale;
  let bester = null, besterDelta = null, besteDiff = Infinity;
  for (const p of liste) {
    if (ausschluss && ausschluss.some(a => Math.abs(a[0]-p[0]) < 0.01 && Math.abs(a[1]-p[1]) < 0.01)) continue;
    if (Geo.dist(mausWelt, p) >= fangradius) continue;
    const benoetigt = (p[0]-a0[0])*n0[0] + (p[1]-a0[1])*n0[1];
    const diff = Math.abs(benoetigt - freiesDelta);
    if (diff < besteDiff) { besteDiff = diff; bester = p; besterDelta = benoetigt; }
  }
  return bester ? { delta: besterDelta, punkt: bester } : null;
}
function kanteVerschieben(delta, richtung) {
  /* delta in mm; richtung 'senkrecht'|'x'|'y' (Default senkrecht = parallel-Versatz
     entlang der Kanten-Normalen; Vorzeichen: Welt-Normale links der Kantenrichtung) */
  if (!ui.kanten.length || !delta) return;
  richtung = richtung || 'senkrecht';
  aenderungBeginnen();
  const ursprung = kantenUrsprungErfassen(ui.kanten);
  kantenGeometrieSetzen(ursprung, delta, richtung);
  alleNeuRendern(true);
  verschiebenOverlayRendern();
  const rTxt = richtung === 'x' ? 'in X' : richtung === 'y' ? 'in Y' : 'parallel';
  hinweisAnzeigen('Kante(n) um ' + delta + ' mm ' + rTxt + ' verschoben.', 'erfolg');
}
function kollineareKantenFinden(basis) {
  /* sucht in sichtbaren Lagen alle Kanten kollinear zur Basiskante (±1 mm) */
  const seg0 = kanteHolen(basis);
  if (!seg0) return [basis];
  const erg = [basis];
  const pruefe = (besitzer, id, pts, geschlossen) => {
    for (let i = 0; i < pts.length - 1; i++) {
      if (besitzer === basis.besitzer && id === basis.id && i === basis.segIdx) continue;
      if (Geo.kollinear(seg0.a, seg0.b, pts[i], pts[i+1], 1))
        erg.push({ besitzer, id, segIdx: i });
    }
  };
  for (const lage of modell.layers.filter(lagenSichtbar)) {
    for (const platte of lage.plates)
      if (platte.outline.length >= 2) pruefe('platte', platte.id, platte.outline);
    for (const op of lage.ops) {
      if (!opHatKantenGeometrie(op)) continue;
      const pts = opPolyAlsArray(op);
      if (pts.length >= 2) pruefe('op', op.id, pts);
    }
  }
  return erg;
}

/* =====================================================================
   F7 — MESSEN mit Punktfang  /  Schnapp-Punkte
   ===================================================================== */
let snapPunkte = [];
function snapPunkteAufbauen() {
  snapPunkte = [[0, 0]];
  if (!modell) return;
  const ELM = modell.header.ELM;
  snapPunkte.push([ELM.lx, 0], [0, ELM.by], [ELM.lx, ELM.by]);
  const addSeg = pts => {
    for (let i = 0; i < pts.length; i++) {
      snapPunkte.push(pts[i]);
      if (i < pts.length - 1)
        snapPunkte.push([(pts[i][0]+pts[i+1][0])/2, (pts[i][1]+pts[i+1][1])/2]);
    }
  };
  for (const lage of modell.layers.filter(lagenSichtbar)) {
    for (const platte of lage.plates) if (platte.outline.length) addSeg(platte.outline);
    for (const op of lage.ops) {
      if (op.nr) { snapPunkte.push([op.nr.xa,op.nr.ya],[op.nr.xe,op.nr.ye]); continue; }
      const pts = opPolyAlsArray(op);
      if (pts.length) addSeg(pts);
      for (const e of (op.poly||[])) if (e.type === 'MP') snapPunkte.push([e.x, e.y]);
    }
  }
  if (ui.zeigeRiegel) for (const beam of modell.beams) if (beam.outline.length) addSeg(beam.outline);
}
/* Generischer Fang: naechster Punkt aus 'liste' im Fangradius; Kandidaten an
   den 'ausschluss'-Koordinaten (±0.01mm) werden uebersprungen. */
function naechsterSnapInListe(weltP, liste, ausschluss) {
  let bester = null, besteDist = SNAP_FANGRADIUS_PX / ui.scale;
  for (const p of liste) {
    if (ausschluss && ausschluss.some(a => Math.abs(a[0]-p[0]) < 0.01 && Math.abs(a[1]-p[1]) < 0.01)) continue;
    const d = Geo.dist(weltP, p);
    if (d < besteDist) { besteDist = d; bester = p; }
  }
  return bester;
}
function naechsterSnap(weltP) { return naechsterSnapInListe(weltP, snapPunkte, null); }
/* WP-B: wie naechsterSnap, aber gezogener Punkt (bzw. bei geschlossener Kontur
   sein zu Dragbeginn deckungsgleicher Duplikat-Partner) als Fangziel ausgeschlossen,
   damit er nicht sich selbst faengt und kleben bleibt. */
function naechsterSnapOhne(weltP, ausschluss) { return naechsterSnapInListe(weltP, snapPunkte, ausschluss); }
/* Zeichnen: Fang gegen Modell-Snappunkte UND die bereits gesetzten Punkte der
   im Bau befindlichen Kontur (damit man an einen frisch gezeichneten Punkt —
   v.a. den Startpunkt zum Schliessen — fangen kann). */
function naechsterSnapZeichnen(weltP) {
  const liste = ui.neueKontur && ui.neueKontur.punkte ? snapPunkte.concat(ui.neueKontur.punkte) : snapPunkte;
  return naechsterSnapInListe(weltP, liste, null);
}
/* Effektiver naechster Kontur-Punkt beim Zeichnen: Punktfang hat Vorrang, sonst
   (bei Shift) Ortho zum letzten Punkt, sonst freie Position. Gibt {p:[x,y],
   gefangen:bool} zurueck. */
function zeichenPunktBestimmen(welt, ortho) {
  const snap = naechsterSnapZeichnen(welt);
  if (snap) return { p: snap.slice(), gefangen: true };
  const p = welt.slice();
  const pkte = ui.neueKontur && ui.neueKontur.punkte;
  if (ortho && pkte && pkte.length) {
    const last = pkte[pkte.length - 1];
    if (Math.abs(p[0] - last[0]) > Math.abs(p[1] - last[1])) p[1] = last[1]; else p[0] = last[0];
  }
  return { p, gefangen: false };
}

