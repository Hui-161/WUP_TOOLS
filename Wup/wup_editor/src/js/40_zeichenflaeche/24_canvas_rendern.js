function svgRendern() {
  const svg = svgEl();
  if (!modell) { svg.innerHTML = ''; return; }
  _svgLabels = [];
  if (ui.dreiD) { svg.innerHTML = svg3dRendern(); return; }
  const ELM = modell.header.ELM;
  const teile = [];
  const istAusgewaehlt = (typ, id) => ui.auswahl && ui.auswahl.typ === typ && ui.auswahl.id === id;

  /* --- Bbox + Achsenkreuz --- */
  const o = toSVG(0, 0), e = toSVG(ELM.lx, ELM.by);
  teile.push('<rect x="'+Math.min(o.x,e.x)+'" y="'+Math.min(o.y,e.y)+'" width="'+Math.abs(e.x-o.x)
    +'" height="'+Math.abs(e.y-o.y)+'" fill="none" stroke="'+cssVar('--text-blass')
    +'" stroke-dasharray="6 4" stroke-width="1"/>');
  const axS = spiegelX() ? -1 : 1, ayS = spiegelY() ? 1 : -1;
  /* Nullpunkt deutlich markieren */
  {
    const o0 = toSVG(0, 0);
    teile.push('<circle cx="'+o0.x+'" cy="'+o0.y+'" r="6" fill="'+cssVar('--akzent')+'" opacity="0.25"/>'
      + '<circle cx="'+o0.x+'" cy="'+o0.y+'" r="3" fill="'+cssVar('--akzent')+'"/>'
      + '<text x="'+(o0.x+8)+'" y="'+(o0.y+16)+'" font-size="10" font-weight="700" fill="'+cssVar('--akzent')+'">0,0</text>');
  }
  teile.push('<line x1="'+o.x+'" y1="'+o.y+'" x2="'+(o.x+axS*46)+'" y2="'+o.y+'" stroke="'+cssVar('--fehler')+'" stroke-width="1.6"/>');
  teile.push('<line x1="'+o.x+'" y1="'+o.y+'" x2="'+o.x+'" y2="'+(o.y+ayS*46)+'" stroke="'+cssVar('--erfolg')+'" stroke-width="1.6"/>');
  teile.push('<text x="'+(o.x+axS*50-(axS<0?8:0))+'" y="'+(o.y+4)+'" font-size="11" fill="'+cssVar('--fehler')+'">X→</text>');
  teile.push('<text x="'+(o.x-6)+'" y="'+(o.y+ayS*52+(ayS>0?10:0))+'" font-size="11" fill="'+cssVar('--erfolg')+'">Y↑</text>');

  /* --- Riegelwerk --- */
  if (ui.zeigeRiegel) {
    for (const beam of modell.beams) {
      if (!beam.outline.length) continue;
      const tragRelevant = beam.hz > 1;
      const sel = istAusgewaehlt('beam', beam.id);
      teile.push('<path d="' + pfadAusPunkten(beam.outline, true) + '" data-beam="' + beam.id + '"'
        + ' fill="' + (tragRelevant ? cssVar('--svg-riegel') : 'none') + '"'
        + ' fill-opacity="0.5" stroke="' + (sel ? cssVar('--svg-auswahl') : cssVar('--svg-riegel-rand'))
        + '" stroke-width="' + (sel ? 2.5 : 1) + '"/>');
      /* Bauteilbearbeitungen als einfache Symbole — v2.59: Lage im
         BAUTEIL-Koordinatensystem (Weinmann 1.3.2: x entlang des Bauteils),
         umgerechnet ueber bauteilPunktGlobal(); vorher landeten BOZ an QS
         und BT4/BT6 neben dem Bauteil. Bohrungen (BOZ/BOY/BOX) haben einen
         eigenen Filter-Chip, sobald die Datei welche enthaelt. */
      if (ui.zeigeBauteilBearb) {
        /* WP-D: erkannte Richtungsbearbeitungen der Gurte hervorheben */
        const richtungen = (beam.kw === 'OG' || beam.kw === 'UG') ? richtungsbearbeitungFinden(beam) : [];
        const akz = cssVar('--akzent');
        const richtungSvg = (c, d, richtung) => {
          const r0 = Math.max(4, d / 2 * ui.scale);
          return '<g pointer-events="none"><circle cx="'+c.x+'" cy="'+c.y+'" r="'+(r0+3)
            +'" fill="none" stroke="'+akz+'" stroke-width="1.4" opacity="0.65"/>'
            +'<circle cx="'+c.x+'" cy="'+c.y+'" r="'+r0+'" fill="'+akz+'" fill-opacity="0.2" stroke="'+akz+'" stroke-width="1.6"/>'
            +'<circle cx="'+c.x+'" cy="'+c.y+'" r="1.8" fill="'+akz+'"/>'
            +'<title>Richtungsbearbeitung (Abgleich BVN/BVX) — '+beam.kw+', '+(richtung.ende === 'anfang' ? 'Bauteilanfang' : 'Bauteilende')
            +(richtung.eindeutig ? '' : ' — ZU MITTIG')+'</title></g>';
        };
        for (const bb of beam.bearbeitungen) {
          const richtung = richtungen.find(g => g.bb === bb);
          if ((bb.kw === 'BOZ' || bb.kw === 'BOY' || bb.kw === 'BOX') && bb.params.length >= 3) {
            if (ui.opFilter.BOZ === false) continue;
            const pos = bohrungLokal(beam, bb);
            if (!pos) continue;
            const d = Math.abs(zahl(bb.params[2])) || 6;
            const c = toSVG(...bauteilPunktGlobal(beam, pos[0], pos[1]));
            if (richtung) { teile.push(richtungSvg(c, d, richtung)); continue; }
            const farbe = cssVar('--svg-bohrung') || cssVar('--fehler');
            const r0 = Math.max(4, d / 2 * ui.scale);
            teile.push('<g pointer-events="none" data-bohrung="' + bb.kw + '">'
              + '<circle cx="'+c.x+'" cy="'+c.y+'" r="'+r0+'" fill="'+farbe+'" fill-opacity="0.18" stroke="'+farbe+'" stroke-width="1.5"/>'
              + '<line x1="'+(c.x-r0)+'" y1="'+c.y+'" x2="'+(c.x+r0)+'" y2="'+c.y+'" stroke="'+farbe+'" stroke-width="1"/>'
              + '<line x1="'+c.x+'" y1="'+(c.y-r0)+'" x2="'+c.x+'" y2="'+(c.y+r0)+'" stroke="'+farbe+'" stroke-width="1"/>'
              + '<title>' + bb.kw + ' Ø' + fmtZahl(d) + ' — ' + beam.kw + (beam.name ? ' "' + escapeHtml(beam.name) + '"' : '')
              + ' (Bauteil x ' + fmtZahl(pos[0]) + ' / y ' + fmtZahl(pos[1]) + ')</title></g>');
          } else if (richtung && bb.kw === 'PAF') {
            /* Richtungsbearbeitung in PAF+MP-Form */
            if (ui.opFilter.BOZ === false) continue;
            teile.push(richtungSvg(toSVG(...bauteilPunktGlobal(beam, richtung.bx, richtung.byPos)), richtung.d, richtung));
          } else if (bb.kw === 'SG' && bb.params.length >= 1) {
            const bx = zahl(bb.params[0]);
            if (!isNaN(bx)) {
              const p1 = toSVG(...bauteilPunktGlobal(beam, bx, 0));
              const p2 = toSVG(...bauteilPunktGlobal(beam, bx, bauteilBreite(beam)));
              teile.push('<line x1="'+p1.x+'" y1="'+p1.y+'" x2="'+p2.x+'" y2="'+p2.y
                +'" stroke="'+cssVar('--svg-psg')+'" stroke-width="1.2" stroke-dasharray="4 2" opacity="0.85"/>');
            }
          }
        }
      }
    }
  }

  /* --- Lagen (sortiert nach |z|, Lage 0 zuunterst) --- */
  const lagen = modell.layers.filter(lagenSichtbar)
    .slice().sort((a, b) => a.num - b.num);
  const lagenFarben = {};
  lagen.forEach(l => { lagenFarben[l.id] = lagenFarbe(l); });

  for (const lage of lagen) {
    for (const platte of lage.plates) {
      if (platte.outline.length < 3) continue;
      const sel = istAusgewaehlt('platte', platte.id);
      teile.push('<path d="' + pfadAusPunkten(platte.outline, true) + '"'
        + ' data-platte="' + platte.id + '" data-lage="' + lage.id + '"'
        + ' fill="' + lagenFarben[lage.id] + '" fill-opacity="' + (0.10 + 0.05 * Math.min(lage.num, 3)) + '"'
        + ' stroke="' + (sel ? cssVar('--svg-auswahl') : lagenFarben[lage.id]) + '"'
        + ' stroke-width="' + (sel ? 2.5 : 1.2) + '"/>');
    }
  }
  /* v2.60: BOZ in Plattenlagen (Einblaslage) — Element-Koordinaten;
     nach "BOZ → PAF/MP" (bis zum Neuladen) in PAF-Farbe */
  if (ui.opFilter.BOZ !== false) {
    for (const lage of lagen) {
      for (const b of (lage.bohrungen || [])) {
        const c = toSVG(b.x, b.y), r0 = Math.max(4, (b.d || 6) / 2 * ui.scale);
        const farbe = b._umgestellt ? cssVar('--svg-paf') : (cssVar('--svg-bohrung') || cssVar('--fehler'));
        teile.push('<g pointer-events="none" data-bohrung="lage-' + (b._umgestellt ? 'paf' : 'boz') + '">'
          + '<circle cx="'+c.x+'" cy="'+c.y+'" r="'+r0+'" fill="'+farbe+'" fill-opacity="0.18" stroke="'+farbe+'" stroke-width="1.5"'
          + (b._umgestellt ? '' : ' stroke-dasharray="3 2"') + '/>'
          + '<line x1="'+(c.x-r0)+'" y1="'+c.y+'" x2="'+(c.x+r0)+'" y2="'+c.y+'" stroke="'+farbe+'" stroke-width="1"/>'
          + '<line x1="'+c.x+'" y1="'+(c.y-r0)+'" x2="'+c.x+'" y2="'+(c.y+r0)+'" stroke="'+farbe+'" stroke-width="1"/>'
          + '<title>' + (b._umgestellt ? 'PAF 2 + MP (aus BOZ umgestellt, Export ausstehend)' : 'BOZ (abgekuendigt)')
          + ' Ø' + fmtZahl(b.d) + ' — ' + lage.id + ' (' + fmtZahl(b.x) + ' / ' + fmtZahl(b.y) + ')</title></g>');
      }
    }
  }
  /* PSF -> PSG -> PAF -> NR */
  /* Jede Op in einen eigenen <g data-op-wrapper> gehuellt (EDT-2): so kann
     hoverPatchen() spaeter NUR die betroffene Op neu zeichnen, statt bei
     jedem Hover-Wechsel die komplette Szene neu aufzubauen. */
  for (const reihenfolgeKw of ['PSF', 'PSZ', 'PSG', 'PAF', 'PML', 'NR']) {
    for (const lage of lagen) {
      for (const op of lage.ops) {
        if (op.kw !== reihenfolgeKw) continue;
        teile.push('<g data-op-wrapper="' + op.id + '">' + opSvg(op, lage) + '</g>');
      }
    }
  }

  /* Messungen */
  for (const mess of ui.messungen) {
    const a = toSVG(mess.a[0], mess.a[1]), b = toSVG(mess.b[0], mess.b[1]);
    teile.push('<line x1="'+a.x+'" y1="'+a.y+'" x2="'+b.x+'" y2="'+b.y
      +'" stroke="'+cssVar('--svg-mess')+'" stroke-width="1.5" stroke-dasharray="5 3"/>');
    teile.push('<circle cx="'+a.x+'" cy="'+a.y+'" r="3" fill="'+cssVar('--svg-mess')+'"/>');
    teile.push('<circle cx="'+b.x+'" cy="'+b.y+'" r="3" fill="'+cssVar('--svg-mess')+'"/>');
    const d = Geo.dist(mess.a, mess.b);
    teile.push('<text x="'+((a.x+b.x)/2+6)+'" y="'+((a.y+b.y)/2-6)+'" font-size="11" font-weight="600" fill="'
      +cssVar('--svg-mess')+'">'+ (Math.round(d*10)/10) +' mm</text>');
  }
  if (ui.messStart) {
    const s = toSVG(ui.messStart[0], ui.messStart[1]);
    teile.push('<circle cx="'+s.x+'" cy="'+s.y+'" r="5" fill="none" stroke="'+cssVar('--svg-mess')+'" stroke-width="2"/>');
  }
  if (ui.neueNrStart) {
    const s = toSVG(ui.neueNrStart[0], ui.neueNrStart[1]);
    teile.push('<circle cx="'+s.x+'" cy="'+s.y+'" r="5" fill="none" stroke="'+cssVar('--svg-nr')+'" stroke-width="2"/>');
  }
  /* WP3: Live-Vorschau der neuen Kontur (Linienzug + Gummiband zur Maus) */
  if (ui.neueKontur) {
    if (ui.neueKontur.zentrum) {
      const c = toSVG(ui.neueKontur.zentrum[0], ui.neueKontur.zentrum[1]);
      teile.push('<circle cx="'+c.x+'" cy="'+c.y+'" r="5" fill="none" stroke="'+cssVar('--svg-paf')+'" stroke-width="2"/>');
      if (ui._neueKonturMaus) {
        const m = toSVG(ui._neueKonturMaus[0], ui._neueKonturMaus[1]);
        const r = Geo.dist(ui.neueKontur.zentrum, ui._neueKonturMaus) * ui.scale;
        teile.push('<circle cx="'+c.x+'" cy="'+c.y+'" r="'+r+'" fill="none" stroke="'+cssVar('--svg-paf')+'" stroke-width="1.5" stroke-dasharray="4 3"/>');
        teile.push('<line x1="'+c.x+'" y1="'+c.y+'" x2="'+m.x+'" y2="'+m.y+'" stroke="'+cssVar('--svg-paf')+'" stroke-width="1" stroke-dasharray="2 2"/>');
      }
    } else if (ui.neueKontur.punkte && ui.neueKontur.punkte.length) {
      const svgPts = ui.neueKontur.punkte.map(p => toSVG(p[0], p[1]));
      let d = svgPts.map((p, i) => (i === 0 ? 'M' : 'L') + p.x + ',' + p.y).join(' ');
      if (ui._neueKonturMaus) {
        const m = toSVG(ui._neueKonturMaus[0], ui._neueKonturMaus[1]);
        d += ' L' + m.x + ',' + m.y;
      }
      teile.push('<path d="'+d+'" fill="none" stroke="'+cssVar('--svg-paf')+'" stroke-width="1.5" stroke-dasharray="4 3"/>');
      for (const p of svgPts) teile.push('<circle cx="'+p.x+'" cy="'+p.y+'" r="3" fill="'+cssVar('--svg-paf')+'"/>');
    } else if (ui.neueKontur.rechteckStart) {
      /* Rechteck-Vorschau: erste Ecke markieren, bei bekannter Mausposition
         das achsparallele Rechteck gestrichelt zeigen (analog Polygon/Kreis) */
      const a = toSVG(ui.neueKontur.rechteckStart[0], ui.neueKontur.rechteckStart[1]);
      teile.push('<circle cx="'+a.x+'" cy="'+a.y+'" r="5" fill="none" stroke="'+cssVar('--svg-paf')+'" stroke-width="2"/>');
      if (ui._neueKonturMaus) {
        const b = toSVG(ui._neueKonturMaus[0], ui._neueKonturMaus[1]);
        const x = Math.min(a.x, b.x), y = Math.min(a.y, b.y);
        const w = Math.abs(b.x - a.x), h = Math.abs(b.y - a.y);
        teile.push('<rect x="'+x+'" y="'+y+'" width="'+w+'" height="'+h+'" fill="none" stroke="'
          +cssVar('--svg-paf')+'" stroke-width="1.5" stroke-dasharray="4 3"/>');
      }
    }
  }
  /* Schnapp-Anzeige: deutlicher Fangpunkt-Marker (Raute + Ring + Fadenkreuz +
     Koordinaten), damit exakt sichtbar ist, welcher Punkt gefangen wird. */
  if (ui.snapAnzeige) {
    const s = toSVG(ui.snapAnzeige[0], ui.snapAnzeige[1]);
    const f = cssVar('--akzent');
    teile.push('<g class="snap-marker" pointer-events="none">');
    teile.push('<line x1="'+(s.x-11)+'" y1="'+s.y+'" x2="'+(s.x+11)+'" y2="'+s.y+'" stroke="'+f+'" stroke-width="1" opacity="0.7"/>');
    teile.push('<line x1="'+s.x+'" y1="'+(s.y-11)+'" x2="'+s.x+'" y2="'+(s.y+11)+'" stroke="'+f+'" stroke-width="1" opacity="0.7"/>');
    teile.push('<circle cx="'+s.x+'" cy="'+s.y+'" r="7" fill="none" stroke="'+f+'" stroke-width="1.75"/>');
    teile.push('<path d="M'+s.x+','+(s.y-4.5)+' L'+(s.x+4.5)+','+s.y+' L'+s.x+','+(s.y+4.5)+' L'+(s.x-4.5)+','+s.y+' Z" fill="'+f+'"/>');
    const tx = fmtZahl(ui.snapAnzeige[0]) + ', ' + fmtZahl(ui.snapAnzeige[1]);
    teile.push('<text x="'+(s.x+11)+'" y="'+(s.y-9)+'" font-size="10.5" font-weight="700" fill="'+f+'" '
      + 'stroke="'+cssVar('--flaeche')+'" stroke-width="2.5" paint-order="stroke" style="pointer-events:none">'+escapeHtml(tx)+'</text>');
    teile.push('</g>');
  }
  /* F6 Kantenauswahl */
  for (const k of ui.kanten) {
    const seg = kanteHolen(k);
    if (!seg) continue;
    const a = toSVG(seg.a[0], seg.a[1]), b = toSVG(seg.b[0], seg.b[1]);
    teile.push('<line x1="'+a.x+'" y1="'+a.y+'" x2="'+b.x+'" y2="'+b.y
      +'" stroke="'+cssVar('--svg-auswahl')+'" stroke-width="4" opacity="0.85" stroke-linecap="round"/>');
  }

  /* I-02: markierte Einzellinie hervorheben */
  if (ui.segMark) {
    const f = opFinden(ui.segMark.opId);
    if (f && f.op.poly && f.op.poly[ui.segMark.idx]) {
      const e = f.op.poly[ui.segMark.idx];
      if (e.type === 'MP') {
        const c = toSVG(e.x, e.y);
        teile.push('<circle cx="'+c.x+'" cy="'+c.y+'" r="'+Math.max(5, Math.abs(e.r)*ui.scale)
          +'" fill="none" stroke="'+cssVar('--svg-auswahl')+'" stroke-width="3.5" opacity="0.9"/>');
      } else if (ui.segMark.idx > 0) {
        const v = f.op.poly[ui.segMark.idx - 1];
        if (v.x != null) {
          const a = toSVG(v.x, v.y), b = toSVG(e.x, e.y);
          teile.push('<line x1="'+a.x+'" y1="'+a.y+'" x2="'+b.x+'" y2="'+b.y
            +'" stroke="'+cssVar('--svg-auswahl')+'" stroke-width="4.5" opacity="0.85" stroke-linecap="round"/>');
        }
      } else {
        const c = toSVG(e.x, e.y);
        teile.push('<circle cx="'+c.x+'" cy="'+c.y+'" r="6" fill="none" stroke="'+cssVar('--svg-auswahl')+'" stroke-width="3"/>');
      }
    }
  }

  /* Fehlerlog-Klick: kurze Blitz-Hervorhebung um das betroffene Element */
  if (ui._flashOpId) {
    const f = opFinden(ui._flashOpId);
    const pts = f ? (f.op.nr ? [[f.op.nr.xa, f.op.nr.ya], [f.op.nr.xe, f.op.nr.ye]] : opPolyAlsArray(f.op)) : null;
    if (pts && pts.length) {
      const b = Geo.bbox(pts);
      const e = Geo.bboxErweitern(b, 30);
      const a1 = toSVG(spiegelX() ? modell.header.ELM.lx - e.minX : e.minX,
                       spiegelY() ? e.minY : modell.header.ELM.by - e.minY);
      const a2 = toSVG(spiegelX() ? modell.header.ELM.lx - e.maxX : e.maxX,
                       spiegelY() ? e.maxY : modell.header.ELM.by - e.maxY);
      const x = Math.min(a1.x, a2.x), y = Math.min(a1.y, a2.y);
      const w = Math.abs(a2.x - a1.x), h = Math.abs(a2.y - a1.y);
      teile.push('<rect x="'+x+'" y="'+y+'" width="'+w+'" height="'+h
        +'" rx="4" fill="none" stroke="'+cssVar('--fehler')+'" stroke-width="3" opacity="0.95">'
        + '<animate attributeName="opacity" values="0.95;0.25;0.95" dur="0.6s" repeatCount="2"/>'
        + '<animate attributeName="stroke-width" values="3;6;3" dur="0.6s" repeatCount="2"/></rect>');
    }
  }

  /* I-03: Plattenueberstand ueber das Riegelwerk je sichtbarer Lage */
  if (ui.zeigeUeberstand && modell.beams.length) teile.push(ueberstandSvg());

  /* Gummiband-Auswahl */
  if (ui.gummiband) {
    const g = ui.gummiband;
    teile.push('<rect x="'+Math.min(g.s.x,g.e.x)+'" y="'+Math.min(g.s.y,g.e.y)
      +'" width="'+Math.abs(g.e.x-g.s.x)+'" height="'+Math.abs(g.e.y-g.s.y)
      +'" fill="'+cssVar('--akzent')+'" fill-opacity="0.08" stroke="'+cssVar('--akzent')
      +'" stroke-width="1" stroke-dasharray="4 3"/>');
  }
  /* AP2: Rechtsklick-Ziehen-Vorschau — Linie (Kreuzungs-Auswahl) bei Zug
     nach rechts, Kasten (Umschliessungs-/Kreuzungs-Auswahl) bei Zug nach links */
  if (ui.dragging && ui.dragging.art === 'rechtsauswahl' && ui.dragging.bewegt) {
    const auswF = cssVar('--svg-auswahl');
    const s = toSVG(ui.dragging.start[0], ui.dragging.start[1]);
    const e = toSVG(ui.dragging.aktuell[0], ui.dragging.aktuell[1]);
    if (ui.dragging.aktuell[0] >= ui.dragging.start[0]) {
      teile.push('<line x1="'+s.x+'" y1="'+s.y+'" x2="'+e.x+'" y2="'+e.y
        +'" stroke="'+auswF+'" stroke-width="1.5" stroke-dasharray="6 4"/>');
      teile.push('<text x="'+((s.x+e.x)/2+6)+'" y="'+((s.y+e.y)/2-6)
        +'" font-size="10.5" font-weight="700" fill="'+auswF+'">Linie</text>');
    } else {
      teile.push('<rect x="'+Math.min(s.x,e.x)+'" y="'+Math.min(s.y,e.y)
        +'" width="'+Math.abs(e.x-s.x)+'" height="'+Math.abs(e.y-s.y)
        +'" fill="'+auswF+'" fill-opacity="0.08" stroke="'+auswF
        +'" stroke-width="1.5" stroke-dasharray="6 4"/>');
      teile.push('<text x="'+(Math.min(s.x,e.x)+6)+'" y="'+(Math.min(s.y,e.y)-6)
        +'" font-size="10.5" font-weight="700" fill="'+auswF+'">Kasten</text>');
    }
  }

  /* Achsen-Kompass fest unten links (folgt der Spiegelung) */
  {
    const w = document.getElementById('canvasWrapper');
    const kx = 34, ky = w.clientHeight - 30;
    const sx2 = spiegelX() ? -1 : 1, sy2 = spiegelY() ? 1 : -1;
    teile.push('<g opacity="0.95">'
      + '<circle cx="'+kx+'" cy="'+ky+'" r="3" fill="'+cssVar('--text-gedimmt')+'"/>'
      + '<line x1="'+kx+'" y1="'+ky+'" x2="'+(kx+sx2*26)+'" y2="'+ky+'" stroke="'+cssVar('--fehler')+'" stroke-width="2"/>'
      + '<text x="'+(kx+sx2*30-(sx2<0?8:0))+'" y="'+(ky+4)+'" font-size="11" font-weight="700" fill="'+cssVar('--fehler')+'">X</text>'
      + '<line x1="'+kx+'" y1="'+ky+'" x2="'+kx+'" y2="'+(ky+sy2*26)+'" stroke="'+cssVar('--erfolg')+'" stroke-width="2"/>'
      + '<text x="'+(kx-4)+'" y="'+(ky+sy2*32+(sy2>0?8:0))+'" font-size="11" font-weight="700" fill="'+cssVar('--erfolg')+'">Y</text>'
      + '</g>');
  }

  /* Feedback-Punkt 6 C: Original-Ghost + Massline waehrend eines aktiven Drags */
  teile.push(dragUeberlagerungSvg());
  teile.push(nrGruppenVorschauSvg());
  teile.push(eckenPmlMarkerSvg());

  /* Schnitt-Linie + Profil-Einblendung */
  if (ui.schnitt.aktiv) teile.push(schnittSvg());

  svg.innerHTML = '<g>' + teile.join('') + '</g>';
}

/* EDT-2: Pan-Drag/Wheel-Zoom/Snap-Hover feuern pro Mousemove- bzw. Wheel-Tick
   oft mehrfach schneller, als der Browser einen Frame rendern kann - jeder
   dieser Ticks loeste bisher einen vollstaendigen svgRendern()-Rebuild
   (komplette Szene neu als String) aus. Buendelt auf maximal einen
   vollstaendigen Rebuild pro Animationsframe; das Endergebnis (finale
   ui.pan/ui.scale-Werte, finale Pfad-Koordinaten) ist identisch zu vorher -
   nur die Zahl der Zwischen-Rebuilds sinkt. */
let _svgRenderPending = false;
function svgRendernThrottled() {
  if (_svgRenderPending) return;
  _svgRenderPending = true;
  requestAnimationFrame(() => { _svgRenderPending = false; svgRendern(); });
}

/* EDT-2: Hover wechselt oft (Mousemove ueber viele Ops hinweg) und loeste
   bisher ebenfalls einen kompletten svgRendern()-Rebuild aus. opSvg() erzeugt
   pro Op sowohl den Normal- als auch den Hover-/Auswahl-Zustand (inkl. der
   zusaetzlichen Glow-Overlay-Linien/-Kreise) - hoverPatchen() ruft dieselbe
   Funktion nur fuer die 1-2 tatsaechlich betroffenen Ops erneut auf und
   ersetzt nur deren <g data-op-wrapper>-Inhalt, statt die ganze Szene neu
   aufzubauen. Erwartet, dass ui.hoverOp VORHER bereits auf den neuen Wert
   gesetzt wurde (opSvg() liest ui.hoverOp direkt).
   Faellt auf svgRendern() zurueck, wenn kein aktueller Wrapper existiert
   (z.B. 3D-Modus, in dem gar keine Op-Wrapper gerendert werden). */
function hoverPatchen(alteOpId, neueOpId) {
  const svg = svgEl();
  for (const opId of [alteOpId, neueOpId]) {
    if (!opId) continue;
    const wrapper = svg.querySelector('[data-op-wrapper="' + opId + '"]');
    const f = opFinden(opId);
    if (!wrapper || !f) { svgRendern(); return; }
    wrapper.innerHTML = opSvg(f.op, f.lage);
  }
}

function lagenFarbe(lage) {
  const basis = lage.side === 'innen'
    ? ['#0e9594', '#2a7fb8', '#6c5ce7', '#0a8a3a', '#7f8c8d', '#16a085']
    : ['#d35400', '#b8860b', '#8e44ad', '#c0392b', '#7b1d1d', '#a04000'];
  if (lage.num === 0) return cssVar('--text-blass');
  return basis[(lage.num - 1) % basis.length];
}

function opSvg(op, lage) {
  const teile = [];
  if (ui.opFilter[op.kw] === false) return '';
  const sel = (ui.auswahl && ui.auswahl.typ === 'op' && ui.auswahl.id === op.id)
    || ui.mehrAuswahl.includes(op.id);
  const hov = !sel && ui.hoverOp === op.id;
  /* Hover-Glow + breite unsichtbare Klickflaeche (leichteres Fangen) */
  const hitAttr = ' data-op="' + op.id + '" stroke="transparent" stroke-width="14" fill="none" style="cursor:pointer"';
  if (op.kw === 'NR') {
    const a0 = toSVG(op.nr.xa, op.nr.ya), b0 = toSVG(op.nr.xe, op.nr.ye);
    if (sel || hov)
      teile.push('<line x1="'+a0.x+'" y1="'+a0.y+'" x2="'+b0.x+'" y2="'+b0.y+'" stroke="'
        + cssVar('--svg-auswahl') + '" stroke-width="' + (sel ? 9 : 6) + '" opacity="' + (sel ? 0.45 : 0.25)
        + '" stroke-linecap="round"/>');
    teile.push('<line x1="'+a0.x+'" y1="'+a0.y+'" x2="'+b0.x+'" y2="'+b0.y+'"'+hitAttr+'/>');
  } else if ((op.poly || []).some(e => e.x != null)) {
    const ptsHit = opPolyAlsArray(op);
    if (ptsHit.length >= 2) {
      if (sel || hov) {
        teile.push('<path d="' + pfadAusPunkten(ptsHit, op.closed) + '" fill="none" stroke="'
          + cssVar('--svg-auswahl') + '" stroke-width="' + (sel ? 8 : 5) + '" opacity="' + (sel ? 0.4 : 0.25)
          + '" stroke-linejoin="round"/>');
      }
      teile.push('<path d="' + pfadAusPunkten(ptsHit, op.closed) + '"' + hitAttr + '/>');
    }
    for (const mp of (op.poly || []).filter(e => e.type === 'MP')) {
      const c = toSVG(mp.x, mp.y);
      const r = Math.max(7, Math.abs(mp.r) * ui.scale);
      if (sel || hov)
        teile.push('<circle cx="'+c.x+'" cy="'+c.y+'" r="'+r+'" fill="none" stroke="'
          + cssVar('--svg-auswahl') + '" stroke-width="5" opacity="0.35"/>');
      teile.push('<circle cx="'+c.x+'" cy="'+c.y+'" r="'+Math.max(9, r)+'" fill="transparent" data-op="'
        + op.id + '" style="cursor:pointer"/>');
    }
  }
  const farben = { PSF: cssVar('--svg-psf'), PSZ: cssVar('--syn-psz'), PSG: cssVar('--svg-psg'),
                   PAF: cssVar('--svg-paf'), NR: cssVar('--svg-nr'), PML: cssVar('--text-gedimmt') };
  const farbe = sel ? cssVar('--svg-auswahl') : (farben[op.kw] || cssVar('--text-gedimmt'));
  const datenAttr = ' data-op="' + op.id + '" data-lage="' + lage.id + '"';

  if (op.kw === 'NR') {
    const a = toSVG(op.nr.xa, op.nr.ya), b = toSVG(op.nr.xe, op.nr.ye);
    teile.push('<line x1="'+a.x+'" y1="'+a.y+'" x2="'+b.x+'" y2="'+b.y+'"'+datenAttr
      +' stroke="'+farbe+'" stroke-width="'+(sel?3:1.6)+'" stroke-linecap="round" style="cursor:move"/>');
    /* Punktmuster */
    const np = nagelPunkte(op);
    const schritt = Math.max(1, Math.ceil(np.length / 80));
    for (let i = 0; i < np.length; i += schritt) {
      const p = toSVG(np[i][0], np[i][1]);
      teile.push('<circle cx="'+p.x+'" cy="'+p.y+'" r="1.7" fill="'+farbe+'"'+datenAttr+'/>');
    }
    /* Endpunkt-Griffe */
    for (const [pt, ende] of [[ [op.nr.xa,op.nr.ya], 'a' ], [ [op.nr.xe,op.nr.ye], 'e' ]]) {
      const p = toSVG(pt[0], pt[1]);
      teile.push('<circle cx="'+p.x+'" cy="'+p.y+'" r="'+(sel?5:3.5)+'" fill="'+cssVar('--flaeche')
        +'" stroke="'+farbe+'" stroke-width="1.6"'+datenAttr+' data-nr-ende="'+ende+'" style="cursor:pointer"/>');
    }
    teile.push(pfeilMittel([op.nr.xa,op.nr.ya],[op.nr.xe,op.nr.ye], farbe));
    return teile.join('');
  }

  const pts = opPolyAlsArray(op);
  if (pts.length >= 2) {
    if (op.kw === 'PSF' || op.kw === 'PSZ') {
      teile.push('<path d="'+pfadAusPunkten(pts, op.closed)+'"'+datenAttr
        +' fill="'+farbe+'" fill-opacity="0.13" stroke="'+farbe+'" stroke-width="'+(sel?2.5:1.4)
        +'" stroke-dasharray="'+(op.kw==='PSZ'?'2 3':'7 3')+'"/>');
      /* Schraffur-Andeutung via Muster sparen wir, halbtransparent reicht */
    } else {
      teile.push('<path d="'+pfadAusPunkten(pts, false)+'"'+datenAttr
        +' fill="none" stroke="'+farbe+'" stroke-width="'+(sel?2.8:1.8)+'"/>');
      /* Richtungspfeile + Kamm je Segment */
      const ppPunkte = (op.poly||[]).filter(x => x.type==='PP'||x.type==='KB');
      for (let i = 0; i < pts.length - 1; i++) {
        teile.push(pfeilMittel(pts[i], pts[i+1], farbe));
        if (opIstZerspanend(op)) {
          const korr = steuercodeZerlegen(ppPunkte[i+1] ? ppPunkte[i+1].i : 0).korrektur;
          teile.push(kammStrich(pts[i], pts[i+1], korr, farbe));
        }
      }
      /* Schnittdetails ⊕/⊖ */
      if (ui.schnittdetails && opIstZerspanend(op)) {
        ppPunkte.forEach((p, i) => {
          const zer = steuercodeZerlegen(p.i);
          if (zer.schnitt !== 1 && zer.schnitt !== 2) return;
          const s = toSVG(p.x, p.y);
          const fp = svgLabelFrei(s.x, s.y);   /* B-06: Kollisionen ausweichen */
          const schnittFarbe = zer.schnitt === 1 ? cssVar('--erfolg') : cssVar('--fehler');
          teile.push('<text x="'+fp.x+'" y="'+fp.y+'" font-size="11" font-weight="700" fill="'+schnittFarbe+'">'
            + (zer.schnitt===1?'⊕10':'⊖20') + '</text>');
        });
      }
    }
  }
  /* MP / TA */
  for (const elPoly of (op.poly||[])) {
    if (elPoly.type === 'MP') {
      const c = toSVG(elPoly.x, elPoly.y);
      teile.push('<circle cx="'+c.x+'" cy="'+c.y+'" r="'+Math.max(2, Math.abs(elPoly.r)*ui.scale)+'"'+datenAttr
        +' fill="none" stroke="'+farbe+'" stroke-width="'+(sel?2.6:1.6)+'"/>');
      if (op.auto === 'freistich')
        teile.push('<circle cx="'+c.x+'" cy="'+c.y+'" r="2" fill="'+farbe+'"'+datenAttr+'/>');
    } else if (elPoly.type === 'TA') {
      const c1 = toSVG(elPoly.x - elPoly.lx/2, elPoly.y + elPoly.by/2);
      teile.push('<rect x="'+c1.x+'" y="'+c1.y+'" width="'+(elPoly.lx*ui.scale)+'" height="'+(elPoly.by*ui.scale)
        +'"'+datenAttr+' fill="none" stroke="'+farbe+'" stroke-width="1.6" rx="'+(elPoly.r*ui.scale)+'"/>');
    }
  }
  return teile.join('');
}


/* v2.59: BAUTEIL-Koordinatensystem (Weinmann-Schnittstelle 1.3.2) —
   x entlang des Bauteils, y quer (Breite), z Hoehe. Liegende Bauteile
   (UG/OG/LS/EBT …): x = Element-x. QS (senkrecht): x = Element-y, y =
   Element-x. BT4/BT6: x entlang P1.1→P2.2 (Weinmann S. 18), y zur
   Gegenseite. Fehlt jede Angabe: Element-Lage ab Umriss-Ecke. */
function bauteilAchsen(beam) {
  const pts = (beam.outline || []).filter(p => p && p.length >= 2);
  if (beam.kw === 'QS' && beam.x != null)
    return { o: [beam.x, beam.y || 0], ex: [0, 1], ey: [1, 0], breite: beam.lx || 0 };
  if ((beam.kw === 'BT4' || beam.kw === 'BT6') && pts.length >= 4) {
    /* Weinmann S. 18: Faserrichtung/Laenge = Strecke P1.1→P2.2 (bzw. P1.2→P2.1,
       wenn Punkte zusammenfallen). Im Umriss: erster → letzter Punkt (BT6:
       P1.1 → P2.3). Granit fuehrt schraege Gurte teils anders herum — passt
       P1.1→P1.2 deutlich besser zur angegebenen Laenge lx, gilt die. */
    const ecken = pts.slice(0, beam.kw === 'BT4' ? 4 : 6);
    const n = ecken.length, h = n / 2;
    const len = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1]);
    let o = ecken[0], z = ecken[n - 1];
    if (len(o, z) < 0.5) { o = ecken[h - 1]; z = ecken[h]; }
    if (beam.lx > 0 && Math.abs(len(ecken[0], ecken[1]) - beam.lx) + 1 < Math.abs(len(o, z) - beam.lx)) { o = ecken[0]; z = ecken[1]; }
    const l = len(o, z) || 1;
    const ex = [(z[0] - o[0]) / l, (z[1] - o[1]) / l];
    let ey = [-ex[1], ex[0]];
    const quer = ecken.map(p => (p[0] - o[0]) * ey[0] + (p[1] - o[1]) * ey[1]);
    if (quer.reduce((a, b) => a + b, 0) < 0) { ey = [-ey[0], -ey[1]]; }
    return { o, ex, ey, breite: Math.max(...quer.map(Math.abs)) };
  }
  let ox = beam.x, oy = beam.y, breite = beam.by;
  if (ox == null || oy == null || !breite) {
    if (pts.length) { const bb = Geo.bbox(pts);
      if (ox == null) ox = bb.minX; if (oy == null) oy = bb.minY;
      if (!breite) breite = bb.maxY - bb.minY; }
  }
  return { o: [ox || 0, oy || 0], ex: [1, 0], ey: [0, 1], breite: breite || 0 };
}
function bauteilPunktGlobal(beam, lx, ly) {
  const a = bauteilAchsen(beam);
  return [a.o[0] + a.ex[0] * lx + a.ey[0] * ly, a.o[1] + a.ex[1] * lx + a.ey[1] * ly];
}
function bauteilBreite(beam) { return bauteilAchsen(beam).breite; }
/* Lage einer Bohrung in der Draufsicht (Bauteil-x/-y):
   BOZ x,y,d,t · BOY x,z,d,t (quer durch → Mitte der Breite) ·
   BOX y,z,d,t (laengs → am Bauteilanfang) */
function bohrungLokal(beam, bb) {
  const a = zahl(bb.params[0]), b = zahl(bb.params[1]);
  if (bb.kw === 'BOZ') return isNaN(a) || isNaN(b) ? null : [a, b];
  if (bb.kw === 'BOY') return isNaN(a) ? null : [a, bauteilBreite(beam) / 2];
  if (bb.kw === 'BOX') return isNaN(a) ? null : [0, a];
  return null;
}
function modellHatBohrungen() {
  return !!modell && (modell.layers.some(l => (l.bohrungen || []).length) || modell.beams.some(b => (b.bearbeitungen || []).some(bb =>
    bb.kw === 'BOZ' || bb.kw === 'BOY' || bb.kw === 'BOX'
    || (bb.kw === 'PAF' && (bb.poly || []).length === 1 && bb.poly[0].type === 'MP'))));
}
