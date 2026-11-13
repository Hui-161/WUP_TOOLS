/* =====================================================================
   §5 MULTIWAND-ERKENNUNG (einfache X-Luecken-Clusterung der Platten-BBoxen —
   siehe wup_analyzer.html detectWallRanges fuer die Vorlage; NUR die
   Cluster-Idee wird portiert, nicht die m²/Raster-Logik)
   ===================================================================== */
function waendeErmitteln(frei) {
  const subWalls = frei.subWalls || [];
  const intervalle = [];
  for (const lage of frei.layers)
    for (const p of lage.plates) {
      if (!p.outline || p.outline.length < 2) continue;
      let minX = Infinity, maxX = -Infinity;
      for (const pt of p.outline) { if (pt[0] < minX) minX = pt[0]; if (pt[0] > maxX) maxX = pt[0]; }
      if (isFinite(minX)) intervalle.push([minX, maxX]);
    }
  if (!intervalle.length) {
    return [{ xMin: 0, xMax: (frei.header.ELM && frei.header.ELM.lx) || 1000,
      name: frei.header.ELN || frei.dateiName, quelle: 'single' }];
  }
  intervalle.sort((a, b) => a[0] - b[0]);
  const GAP_TOLERANZ = 50; /* mm */
  const cluster = [[intervalle[0][0], intervalle[0][1]]];
  for (let i = 1; i < intervalle.length; i++) {
    const [s, e] = intervalle[i];
    const letzter = cluster[cluster.length - 1];
    if (s <= letzter[1] + GAP_TOLERANZ) letzter[1] = Math.max(letzter[1], e);
    else cluster.push([s, e]);
  }
  if (cluster.length <= 1) {
    const sw = subWalls[0];
    return [{ xMin: cluster[0][0], xMax: cluster[0][1],
      name: (sw && (sw.znr || sw.eln || sw.fullName)) || frei.header.ELN || frei.dateiName,
      quelle: sw ? 'txt' : 'single' }];
  }
  return cluster.map((c, i) => {
    const sw = subWalls[i];
    return { xMin: c[0], xMax: c[1],
      name: (sw && (sw.znr || sw.eln || sw.fullName)) || ('Wand ' + (i + 1)),
      quelle: sw ? 'txt' : 'cluster' };
  });
}

