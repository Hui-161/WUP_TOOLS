/* ---------- 3D-Schraegansicht (Kabinett-Projektion) ---------- */
function svg3dRendern() {
  const ELM = modell.header.ELM;
  const teile = [];
  const zUeberhoehung = 2.2;                              /* Lagendicken sichtbar machen */
  const stapel = lagenStapel();
  const explosion = ui.dreiDExplosion ? Math.max(24, ELM.hz * 0.4) : 0;
  /* Echte drehbare Axonometrie: Wand um die Mitte zentriert, Gier (az) um die
     senkrechte Achse, Neigung (el) um die waagerechte — orthografische
     Projektion. Ziehen dreht (siehe canvasPointerDown/Move), Rad zoomt (ui.scale),
     Shift+Ziehen verschiebt (ui.dreiDPan). */
  const cx = ELM.lx / 2, cy = ELM.by / 2;
  const az = ui.dreiDWinkel.az, el = ui.dreiDWinkel.el;
  const cA = Math.cos(az), sA = Math.sin(az), cE = Math.cos(el), sE = Math.sin(el);
  const wrap = document.getElementById('canvasWrapper');
  const mX = (wrap ? wrap.clientWidth : 1000) / 2 + ui.dreiDPan.x;
  const mY = (wrap ? wrap.clientHeight : 700) / 2 + ui.dreiDPan.y;
  const s = ui.scale;
  const proj = (wx, wy, z) => {
    const X = wx - cx, Y = wy - cy, Z = z * zUeberhoehung;
    const x1 = X * cA + Z * sA;          /* Gier um senkrechte Achse */
    const z1 = -X * sA + Z * cA;
    const y2 = Y * cE - z1 * sE;          /* Neigung um waagerechte Achse */
    return { x: mX + x1 * s, y: mY - y2 * s };
  };
  /* Zeichen-Reihenfolge (Maler): bei Blick von der Innenseite (cA*cE>=0) von
     aussen nach innen, sonst umgekehrt — so bleibt die Verdeckung beim Drehen
     plausibel, ohne echte Flaechensortierung. */
  const stapelReihe = (cA * cE >= 0) ? stapel : stapel.slice().reverse();
  const flaeche = (pts, z, fill, op, stroke, daten) => {
    if (pts.length < 2) return '';
    let d = '';
    for (let i = 0; i < pts.length; i++) {
      const p = proj(pts[i][0], pts[i][1], z);
      d += (i ? ' L ' : 'M ') + p.x + ' ' + p.y;
    }
    return '<path d="'+d+' Z" fill="'+fill+'" fill-opacity="'+op+'" stroke="'
      +(stroke||cssVar('--rahmen'))+'" stroke-width="0.8"'+(daten||'')+'/>';
  };
  const koerper = (pts, zVon, zBis, fill, daten) => {
    const t = [];
    /* Seitenwaende (nur grob: alle Kanten, Maler-Reihenfolge reicht fuer Eindruck) */
    for (let i = 0; i < pts.length - 1; i++) {
      const a0 = proj(pts[i][0], pts[i][1], zVon), b0 = proj(pts[i+1][0], pts[i+1][1], zVon);
      const a1 = proj(pts[i][0], pts[i][1], zBis), b1 = proj(pts[i+1][0], pts[i+1][1], zBis);
      t.push('<path d="M '+a0.x+' '+a0.y+' L '+b0.x+' '+b0.y+' L '+b1.x+' '+b1.y+' L '+a1.x+' '+a1.y
        +' Z" fill="'+fill+'" fill-opacity="0.35" stroke="'+cssVar('--rahmen')+'" stroke-width="0.5"'+(daten||'')+'/>');
    }
    t.push(flaeche(pts, zBis, fill, 0.85, null, daten));
    return t.join('');
  };

  /* Grundriss-Rahmen am Boden */
  teile.push(flaeche([[0,0],[ELM.lx,0],[ELM.lx,ELM.by],[0,ELM.by],[0,0]], 0, 'none', 0,
    cssVar('--text-blass')));

  /* Explosions-Versatz je Eintrag nach ORIGINAL-Reihenfolge (aussen 0 -> innen),
     unabhaengig von der Zeichen-Reihenfolge */
  const versatzVon = new Map();
  stapel.forEach((e, i) => versatzVon.set(e, i * explosion));
  for (const eintrag of stapelReihe) {
    const versatz = versatzVon.get(eintrag);
    const sichtbar = eintrag.art === 'balken' ? ui.zeigeRiegel
      : lagenSichtbar(eintrag.lage);
    const zVon = eintrag.zVon + versatz, zBis = eintrag.zBis + versatz;
    if (sichtbar) {
      if (eintrag.art === 'balken') {
        for (const beam of modell.beams)
          if (beam.outline.length >= 3)
            teile.push(koerper(beam.outline, zVon, zVon + (beam.hz || (eintrag.zBis - eintrag.zVon)),
              cssVar('--svg-riegel'), ' data-beam="'+beam.id+'"'));
        for (const g of eintrag.gefach) if (lagenSichtbar(g))
          for (const platte of g.plates)
            if (platte.outline.length >= 3)
              teile.push(flaeche(platte.outline, zVon + 2, lagenFarbe(g), 0.3));
        /* Beschriftung */
        const b = proj(-60, 0, (zVon + zBis) / 2);
        teile.push('<text x="'+b.x+'" y="'+b.y+'" font-size="10" fill="'+cssVar('--text-gedimmt')+'">Riegelwerk</text>');
      } else {
        const lage = eintrag.lage, farbe = lagenFarbe(lage);
        for (const platte of lage.plates)
          if (platte.outline.length >= 3)
            teile.push(koerper(platte.outline, zVon, zBis, farbe, ' data-platte="'+platte.id+'"'));
        /* Bearbeitungen auf der Oberflaeche andeuten */
        for (const op of lage.ops) {
          if (ui.opFilter[op.kw] === false) continue;
          if (op.kw === 'NR') {
            const a = proj(op.nr.xa, op.nr.ya, zBis + 0.5), b = proj(op.nr.xe, op.nr.ye, zBis + 0.5);
            teile.push('<line x1="'+a.x+'" y1="'+a.y+'" x2="'+b.x+'" y2="'+b.y
              +'" stroke="'+cssVar('--svg-nr')+'" stroke-width="1" stroke-dasharray="2 4" data-op="'+op.id+'"/>');
            continue;
          }
          if (!opIstZerspanend(op)) continue;
          const pts = opPolyAlsArray(op);
          if (pts.length >= 2) {
            let d = '';
            for (let i = 0; i < pts.length; i++) {
              const p = proj(pts[i][0], pts[i][1], zBis + 0.5);
              d += (i ? ' L ' : 'M ') + p.x + ' ' + p.y;
            }
            teile.push('<path d="'+d+(op.closed?' Z':'')+'" fill="none" stroke="'
              +(op.kw==='PSG'?cssVar('--svg-psg'):cssVar('--svg-paf'))+'" stroke-width="1.2" data-op="'+op.id+'"/>');
          }
          for (const mp of (op.poly||[]).filter(e => e.type === 'MP')) {
            const c = proj(mp.x, mp.y, zBis + 0.5);
            teile.push('<circle cx="'+c.x+'" cy="'+c.y+'" r="'+Math.max(1.5, Math.abs(mp.r||4)*ui.scale)
              +'" fill="none" stroke="'+cssVar('--svg-paf')+'" stroke-width="1" data-op="'+op.id+'"/>');
          }
        }
        const b = proj(-60, 0, (zVon + zBis) / 2);
        teile.push('<text x="'+b.x+'" y="'+b.y+'" font-size="10" fill="'+farbe+'">'+lage.id+'</text>');
      }
    }
  }
  teile.push('<text x="12" y="20" font-size="11" fill="'+cssVar('--text-gedimmt')
    +'">3D — ziehen zum Drehen · Shift+ziehen verschieben · Rad zoomen · Doppelklick setzt den Blick zurueck. Bearbeiten in der 2D-Ansicht.</text>');
  return '<g>' + teile.join('') + '</g>';
}
function dreiDUmschalten() {
  ui.dreiD = !ui.dreiD;
  document.getElementById('btn3d').classList.toggle('umschalt-aktiv', ui.dreiD);
  document.getElementById('lbl3dExplosion').hidden = !ui.dreiD;
  svgRendern();
}

