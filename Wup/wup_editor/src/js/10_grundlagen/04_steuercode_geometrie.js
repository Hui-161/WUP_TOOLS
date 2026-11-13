/* =====================================================================
   §3 STEUERCODE-SYSTEM (Kernmodul)
   ===================================================================== */
function steuercodeZerlegen(i) {
  i = Math.max(0, Math.round(Number(i) || 0));
  return { werkzeug: i % 10, schnitt: Math.floor(i/10) % 10,
           korrektur: Math.floor(i/100) % 10, lauf: Math.floor(i/1000) % 10 };
}
function steuercodeBauen(t) {
  return (t.lauf||0)*1000 + (t.korrektur||0)*100 + (t.schnitt||0)*10 + (t.werkzeug||0);
}
function steuercodeWorte(i, kw) {
  const t = steuercodeZerlegen(i);
  const wzPaf = {1:'zyl. Fraeser',2:'Fraeser m. Fase',3:'Nutfraeser',4:'Markierfraeser'};
  const wzPsg = {1:'Standard-Saegeblatt',2:'fein gezahnt',3:'Kettensaege'};
  const wz = (kw === 'PSG' ? wzPsg : wzPaf)[t.werkzeug] || ('Werkzeug ' + t.werkzeug);
  const sn = {1:'ueberschneidend',2:'unterschneidend'}[t.schnitt] || ('Schnitt ' + t.schnitt);
  const ko = {1:'Korr. links (Gutteil rechts)',2:'Korr. rechts (Gutteil links)',3:'keine Korrektur'}[t.korrektur] || ('Korr. ' + t.korrektur);
  const la = t.lauf === 1 ? 'Gleichlauf' : 'Gegenlauf';
  return wz + ' · ' + sn + ' · ' + ko + ' · ' + la;
}

/* =====================================================================
   GEOMETRIE-HILFSMODUL (Pflicht laut §4)
   ===================================================================== */
const Geo = {
  dist(a, b) { return Math.hypot(b[0]-a[0], b[1]-a[1]); },
  norm(v) { const l = Math.hypot(v[0], v[1]) || 1; return [v[0]/l, v[1]/l]; },
  cross(u, v) { return u[0]*v[1] - u[1]*v[0]; },
  /* Shoelace-Vorzeichen: > 0 = CCW (mathematisch positiv) */
  umlaufsinn(punkte) {
    let s = 0;
    for (let i = 0; i < punkte.length - 1; i++)
      s += (punkte[i+1][0]-punkte[i][0]) * (punkte[i+1][1]+punkte[i][1]);
    return -s; /* >0 = CCW im Standard-Mathe-System */
  },
  punktInPolygon(p, poly) {
    let drin = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const xi = poly[i][0], yi = poly[i][1], xj = poly[j][0], yj = poly[j][1];
      if (((yi > p[1]) !== (yj > p[1])) &&
          (p[0] < (xj - xi) * (p[1] - yi) / (yj - yi) + xi)) drin = !drin;
    }
    return drin;
  },
  /* Wie punktInPolygon, aber Punkte GENAU AUF dem Rand zaehlen ebenfalls als
     "gedeckt" (Toleranz tol mm). Reine Ray-Casting-Tests (punktInPolygon)
     werfen fuer Randpunkte je nach Gleitkomma-Rundung 'drin' ODER 'draussen'
     aus — bei einer neu erzeugten PSF, deren Eckpunkte exakt den Rand der
     PRUEF-Region bilden (identische/deckungsgleiche Flaeche), wuerde eine rein
     interior-basierte Pruefung die eigene Deckung NICHT erkennen und bei jedem
     erneuten Lauf dieselbe Sperrflaeche nochmal anlegen. */
  punktInOderAufPolygon(p, poly, tol) {
    if (Geo.punktInPolygon(p, poly)) return true;
    tol = tol || 0.5;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++)
      if (Geo.distPunktSegment(p, poly[j], poly[i]) <= tol) return true;
    return false;
  },
  distPunktSegment(p, a, b) {
    const dx = b[0]-a[0], dy = b[1]-a[1];
    const l2 = dx*dx + dy*dy;
    if (l2 === 0) return Geo.dist(p, a);
    let t = ((p[0]-a[0])*dx + (p[1]-a[1])*dy) / l2;
    t = Math.max(0, Math.min(1, t));
    return Geo.dist(p, [a[0]+t*dx, a[1]+t*dy]);
  },
  bbox(punkte) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const [x, y] of punkte) {
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
    }
    return { minX, minY, maxX, maxY };
  },
  bboxErweitern(b, o) { return { minX: b.minX-o, minY: b.minY-o, maxX: b.maxX+o, maxY: b.maxY+o }; },
  punktInBbox(p, b) { return p[0] >= b.minX && p[0] <= b.maxX && p[1] >= b.minY && p[1] <= b.maxY; },
  bboxUeberlappt(a, b) { return a.minX <= b.maxX && a.maxX >= b.minX && a.minY <= b.maxY && a.maxY >= b.minY; },
  kollinear(a1, a2, b1, b2, tol) {
    /* gleiche Richtung (oder entgegengesetzt) und b1 nahe der Geraden a1-a2 */
    const u = Geo.norm([a2[0]-a1[0], a2[1]-a1[1]]);
    const v = Geo.norm([b2[0]-b1[0], b2[1]-b1[1]]);
    if (Math.abs(Geo.cross(u, v)) > 0.02) return false;
    const w = [b1[0]-a1[0], b1[1]-a1[1]];
    return Math.abs(Geo.cross(u, w)) <= (tol || 1);
  },
  /* Schneiden sich die Strecken p1p2 und p3p4? (echte Segment-Schnittpruefung
     inkl. kollinearer Ueberlappung) */
  segmenteSchneiden(p1, p2, p3, p4) {
    const o = (a, b, c) => Math.sign((b[0]-a[0])*(c[1]-a[1]) - (b[1]-a[1])*(c[0]-a[0]));
    const aufSeg = (a, b, c) => Math.min(a[0],b[0])-1e-9 <= c[0] && c[0] <= Math.max(a[0],b[0])+1e-9
                             && Math.min(a[1],b[1])-1e-9 <= c[1] && c[1] <= Math.max(a[1],b[1])+1e-9;
    const o1 = o(p1,p2,p3), o2 = o(p1,p2,p4), o3 = o(p3,p4,p1), o4 = o(p3,p4,p2);
    if (o1 !== o2 && o3 !== o4) return true;
    if (o1 === 0 && aufSeg(p1,p2,p3)) return true;
    if (o2 === 0 && aufSeg(p1,p2,p4)) return true;
    if (o3 === 0 && aufSeg(p3,p4,p1)) return true;
    if (o4 === 0 && aufSeg(p3,p4,p2)) return true;
    return false;
  },
  /* Beruehrt/kreuzt die Strecke a-b das Polygon (Endpunkt drin ODER eine Kante
     geschnitten)? poly als [[x,y],...] (offen oder geschlossen). */
  segmentKreuztPolygon(a, b, poly) {
    if (Geo.punktInPolygon(a, poly) || Geo.punktInPolygon(b, poly)) return true;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++)
      if (Geo.segmenteSchneiden(a, b, poly[j], poly[i])) return true;
    return false;
  }
};

