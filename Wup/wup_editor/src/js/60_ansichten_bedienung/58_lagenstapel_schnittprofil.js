/* =====================================================================
   §16 LAGENSTAPEL (z-Aufbau), SCHNITT-PROFIL, 3D-ANSICHT
   ===================================================================== */
function lagenStapel() {
  /* Reihenfolge von aussen (unten) nach innen (oben), Balkenlage in der Mitte.
     zVon/zBis sind synthetische Stapelkoordinaten in mm. */
  if (!modell) return [];
  const aussen = modell.layers.filter(l => l.side === 'aussen' && l.num > 0)
    .sort((a, b) => b.num - a.num);
  const innen = modell.layers.filter(l => l.side === 'innen' && l.num > 0)
    .sort((a, b) => a.num - b.num);
  const gefach = modell.layers.filter(l => l.num === 0); /* PLI0/PLA0 in der Balkenlage */
  const balkenHz = modell.beams.reduce((mx, b) => Math.max(mx, b.hz || 0), 0)
    || Math.max(20, modell.header.ELM.hz - [...aussen, ...innen].reduce((sm, l) => sm + (l.hz || 0), 0));
  const stapel = [];
  let z = 0;
  for (const lage of aussen) { stapel.push({ art: 'lage', lage, zVon: z, zBis: z + (lage.hz || 1) }); z += lage.hz || 1; }
  stapel.push({ art: 'balken', zVon: z, zBis: z + balkenHz, gefach }); z += balkenHz;
  for (const lage of innen) { stapel.push({ art: 'lage', lage, zVon: z, zBis: z + (lage.hz || 1) }); z += lage.hz || 1; }
  return stapel;
}
function polygonSchnittIntervalle(pts, achse, pos) {
  /* Schnitt eines (geschlossenen) Polygons mit der Linie achse==pos.
     achse 'y': horizontale Linie y=pos -> x-Intervalle; achse 'x': vertikale Linie -> y-Intervalle */
  const kreuz = [];
  const k = achse === 'y' ? 1 : 0, q = 1 - k; /* k: gepruefte Koordinate, q: Ergebniskoordinate */
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1];
    const av = a[k], bv = b[k];
    if ((av <= pos && bv > pos) || (bv <= pos && av > pos)) {
      const t = (pos - av) / (bv - av);
      kreuz.push(a[q] + t * (b[q] - a[q]));
    }
  }
  kreuz.sort((x, y) => x - y);
  const erg = [];
  for (let i = 0; i + 1 < kreuz.length; i += 2) erg.push([kreuz[i], kreuz[i + 1]]);
  return erg;
}
function linieKreuzungen(pts, achse, pos) {
  /* Kreuzungspunkte einer offenen Linie mit der Schnittlinie (fuer Saegeschnitte) */
  const erg = [];
  const k = achse === 'y' ? 1 : 0, q = 1 - k;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1];
    if ((a[k] <= pos && b[k] > pos) || (b[k] <= pos && a[k] > pos)) {
      const t = (pos - a[k]) / (b[k] - a[k]);
      erg.push(a[q] + t * (b[q] - a[q]));
    }
  }
  return erg;
}
/* Feedback-Punkt 7: Fang-Ziele beim Messen IM Schnittprofil. Sammelt die
   Laengs-Koordinaten (entlang der Schnittlinie) aller Feature-Kreuzungen:
   Nagelreihen-Punkte nahe der Linie, Platten-/Bauteil-/PAF/PSG/PSF-Kanten-
   kreuzungen, MP-Kreis-Sehnenenden. achse 'y' = horizontaler Schnitt (Laengs
   = x), achse 'x' = vertikaler Schnitt (Laengs = y). */
function profilSnapLaengsSammeln(achse, pos) {
  const out = [];
  const add = v => { if (isFinite(v)) out.push(v); };
  if (!modell) return out;
  for (const lage of modell.layers.filter(lagenSichtbar)) {
    for (const op of lage.ops) {
      if (ui.opFilter[op.kw] === false) continue;
      if (op.kw === 'NR') {
        for (const p of nagelPunkte(op)) {
          const wert = achse === 'y' ? p[1] : p[0];
          if (Math.abs(wert - pos) > 25) continue;
          add(achse === 'y' ? p[0] : p[1]);
        }
        continue;
      }
      const pts = opPolyAlsArray(op);
      if (op.closed && pts.length >= 3) {
        for (const [i0, i1] of polygonSchnittIntervalle(pts, achse, pos)) { add(i0); add(i1); }
      } else if (pts.length >= 2) {
        for (const kr of linieKreuzungen(pts, achse, pos)) add(kr);
      }
      for (const e of (op.poly || [])) if (e.type === 'MP') {
        const wert = achse === 'y' ? e.y : e.x, laengs = achse === 'y' ? e.x : e.y, r = Math.abs(e.r || 0);
        if (Math.abs(wert - pos) <= r) {
          const halb = Math.sqrt(Math.max(0, r * r - (wert - pos) * (wert - pos)));
          add(laengs - halb); add(laengs + halb);
        }
      }
    }
    for (const platte of lage.plates) if (platte.outline.length >= 3)
      for (const [i0, i1] of polygonSchnittIntervalle(platte.outline, achse, pos)) { add(i0); add(i1); }
  }
  if (ui.zeigeRiegel) for (const beam of modell.beams) if (beam.outline.length >= 3)
    for (const [i0, i1] of polygonSchnittIntervalle(beam.outline, achse, pos)) { add(i0); add(i1); }
  return out;
}
/* Ist die Maus (Event) aktuell im Schnittprofil-Bereich? */
function mausImProfil(ev) {
  if (!ui.schnitt.aktiv || !ui._profilRect) return false;
  const svgC = svgEl().getScreenCTM();
  if (!svgC) return false;
  const sp = new DOMPoint(ev.clientX, ev.clientY).matrixTransform(svgC.inverse());
  const r = ui._profilRect;
  return sp.x >= r.x0 && sp.x <= r.x1 && sp.y >= r.y0 && sp.y <= r.y1;
}
/* Snap-Punkt (Weltkoordinate auf der Schnittlinie) fuer das Messen im Profil:
   faengt die Laengs-Koordinate der Maus auf das naechste Feature-Ziel. */
function profilSnapPunkt(welt) {
  const achse = ui.schnitt.aktiv === 'h' ? 'y' : 'x';
  const pos = ui.schnitt.pos;
  const laengsMaus = achse === 'y' ? welt[0] : welt[1];
  let best = null, bestD = SNAP_FANGRADIUS_PX / ui.scale;
  for (const v of profilSnapLaengsSammeln(achse, pos)) {
    const d = Math.abs(v - laengsMaus);
    if (d < bestD) { bestD = d; best = v; }
  }
  const laengs = best != null ? best : Math.round(laengsMaus * 10) / 10;
  return { punkt: achse === 'y' ? [laengs, pos] : [pos, laengs], gefangen: best != null };
}
function ueberstandSvg() {
  /* I-03: wie weit stehen Platten je Lage ueber das Riegelwerk hinaus? */
  const teile = [];
  let rb = null;
  for (const beam of modell.beams) {
    if (beam.hz <= 1 || beam.outline.length < 3) continue;
    const bb = Geo.bbox(beam.outline);
    rb = rb ? { minX: Math.min(rb.minX, bb.minX), minY: Math.min(rb.minY, bb.minY),
                maxX: Math.max(rb.maxX, bb.maxX), maxY: Math.max(rb.maxY, bb.maxY) } : bb;
  }
  if (!rb) return '';
  let reihe = 0;
  for (const lage of modell.layers) {
    if (!lagenSichtbar(lage) || !lage.plates.length) continue;
    if (lage.num === 0) continue;   /* Gefachdaemmung liegt naturgemaess im Riegelwerk */
    let lb = null;
    for (const platte of lage.plates) {
      if (platte.outline.length < 3) continue;
      const bb = Geo.bbox(platte.outline);
      lb = lb ? { minX: Math.min(lb.minX, bb.minX), minY: Math.min(lb.minY, bb.minY),
                  maxX: Math.max(lb.maxX, bb.maxX), maxY: Math.max(lb.maxY, bb.maxY) } : bb;
    }
    if (!lb) continue;
    const farbe = lagenFarbe(lage);
    const masz = (wert, wx, wy, dx, dy) => {
      if (Math.abs(wert) < 0.5) return;
      const p = toSVG(wx, wy);
      const fp = svgLabelFrei(p.x + dx, p.y + dy);
      const beschr = lage.id + ' ' + (wert > 0 ? '+' : '') + fmtZahl(Math.round(wert * 10) / 10);
      /* Feedback 2: Ueberstand deckend mit Rahmen + Hintergrund, damit die
         Bemassung ueber jedem Untergrund gut lesbar bleibt. */
      const breite = beschr.length * 6.2 + 8, hoehe = 15;
      teile.push('<line x1="'+p.x+'" y1="'+p.y+'" x2="'+fp.x+'" y2="'+fp.y
        +'" stroke="'+farbe+'" stroke-width="1"/>');
      teile.push('<rect x="'+(fp.x-3)+'" y="'+(fp.y-11)+'" width="'+breite+'" height="'+hoehe
        +'" rx="3" fill="'+cssVar('--flaeche')+'" stroke="'+farbe+'" stroke-width="1"/>');
      teile.push('<text x="'+(fp.x+1)+'" y="'+(fp.y+0.5)+'" font-size="10" font-weight="700" fill="'+farbe
        +'">'+escapeHtml(beschr)+'</text>');
    };
    const my = (lb.minY + lb.maxY) / 2, mx = (lb.minX + lb.maxX) / 2;
    masz(rb.minX - lb.minX, lb.minX, my, -54 - reihe*8, 0);            /* links  */
    masz(lb.maxX - rb.maxX, lb.maxX, my, 12 + reihe*8, 0);             /* rechts */
    masz(lb.maxY - rb.maxY, mx, lb.maxY, 0, -14 - reihe*6);            /* oben   */
    masz(rb.minY - lb.minY, mx, lb.minY, 0, 18 + reihe*6);             /* unten  */
    reihe++;
  }
  return teile.join('');
}
function schnittSvg() {
  const ELM = modell.header.ELM;
  const horizontal = ui.schnitt.aktiv === 'h';        /* Linie y=pos, Profil entlang X */
  const pos = ui.schnitt.pos;
  const teile = [];
  const akz = cssVar('--akzent'), randF = cssVar('--rahmen'), txtF = cssVar('--text-gedimmt');

  /* --- Schnittlinie mit Griff --- */
  if (horizontal) {
    const a = toSVG(0, pos), b = toSVG(ELM.lx, pos);
    teile.push('<line x1="'+a.x+'" y1="'+a.y+'" x2="'+b.x+'" y2="'+b.y
      +'" stroke="'+akz+'" stroke-width="1.5" stroke-dasharray="10 5" data-schnittlinie="1" style="cursor:ns-resize"/>');
    teile.push('<rect x="'+(Math.min(a.x,b.x)-26)+'" y="'+(a.y-9)+'" width="24" height="18" rx="4" fill="'+akz
      +'" data-schnittlinie="1" style="cursor:ns-resize"/>'
      +'<text x="'+(Math.min(a.x,b.x)-14)+'" y="'+(a.y+4)+'" font-size="10" fill="#fff" text-anchor="middle" pointer-events="none">A</text>');
    teile.push('<text x="'+(Math.max(a.x,b.x)+6)+'" y="'+(a.y+4)+'" font-size="10" fill="'+akz+'">y = '+fmtZahl(pos)+'</text>');
  } else {
    const a = toSVG(pos, 0), b = toSVG(pos, ELM.by);
    teile.push('<line x1="'+a.x+'" y1="'+a.y+'" x2="'+b.x+'" y2="'+b.y
      +'" stroke="'+akz+'" stroke-width="1.5" stroke-dasharray="10 5" data-schnittlinie="1" style="cursor:ew-resize"/>');
    const oben = Math.min(a.y, b.y);
    teile.push('<rect x="'+(a.x-12)+'" y="'+(oben-26)+'" width="24" height="18" rx="4" fill="'+akz
      +'" data-schnittlinie="1" style="cursor:ew-resize"/>'
      +'<text x="'+a.x+'" y="'+(oben-13)+'" font-size="10" fill="#fff" text-anchor="middle" pointer-events="none">B</text>');
    teile.push('<text x="'+(a.x+6)+'" y="'+(Math.max(a.y,b.y)+14)+'" font-size="10" fill="'+akz+'">x = '+fmtZahl(pos)+'</text>');
  }

  /* --- Profil-Einblendung --- */
  const wrap = document.getElementById('canvasWrapper');
  const stapel = lagenStapel().filter(b => b.art === 'balken' || lagenSichtbar(b.lage));
  if (!stapel.length) return teile.join('');
  const gesamtDicke = stapel[stapel.length - 1].zBis - stapel[0].zVon;
  const panelDicke = Math.min(170, Math.max(80, gesamtDicke * 0.9));
  const zSkala = panelDicke / gesamtDicke;
  const achse = horizontal ? 'y' : 'x';

  /* Panel-Geometrie: h-Schnitt unten (Achse=x am Bildschirm), v-Schnitt rechts (Achse=y) */
  let pX0, pY0, laengsVonWelt; /* laengsVonWelt(wert) -> Bildschirm-Laengskoordinate */
  if (horizontal) {
    pY0 = wrap.clientHeight - panelDicke - 26;
    laengsVonWelt = w => toSVG(w, pos).x;
    pX0 = 0;
  } else {
    pX0 = wrap.clientWidth - panelDicke - 26;
    laengsVonWelt = w => toSVG(pos, w).y;
    pY0 = 0;
  }
  /* Hintergrund + Bereich fuer Messen-Werkzeug merken (I-04) */
  if (horizontal) {
    teile.push('<rect x="0" y="'+pY0+'" width="'+wrap.clientWidth+'" height="'+(panelDicke+26)
      +'" fill="'+cssVar('--flaeche')+'" opacity="0.94" stroke="'+randF+'"/>');
    ui._profilRect = { x0: 0, y0: pY0, x1: wrap.clientWidth, y1: pY0 + panelDicke + 26 };
  } else {
    teile.push('<rect x="'+pX0+'" y="0" width="'+(panelDicke+26)+'" height="'+wrap.clientHeight
      +'" fill="'+cssVar('--flaeche')+'" opacity="0.94" stroke="'+randF+'"/>');
    ui._profilRect = { x0: pX0, y0: 0, x1: pX0 + panelDicke + 26, y1: wrap.clientHeight };
  }
  const titel = horizontal ? 'Schnitt A–A (y='+fmtZahl(pos)+') · innen oben' : 'Schnitt B–B (x='+fmtZahl(pos)+') · innen rechts';
  teile.push('<text x="'+(horizontal?8:pX0+4)+'" y="'+(horizontal?pY0+14:14)+'" font-size="10" fill="'+txtF+'">'+titel+'</text>');

  /* Band-Position: innen oben (h) bzw. innen rechts (v) -> Stapel zBis ist innen-aussen sortiert von aussen */
  const dickeKoord = z => horizontal
    ? pY0 + 22 + (gesamtDicke - z) * zSkala            /* z hoch = innen = weiter oben */
    : pX0 + 22 + (gesamtDicke - z) * zSkala;           /* z hoch = innen = weiter rechts? -> rechts = groesser x */
  const dickeKoordV = z => pX0 + 22 + z * zSkala;      /* v: innen (z gross) rechts */

  const band = (l0, l1, d0, d1, fill, op, daten) => {
    const a = Math.min(l0, l1), b = Math.max(l0, l1);
    const c = Math.min(d0, d1), d = Math.max(d0, d1);
    if (horizontal)
      return '<rect x="'+a+'" y="'+c+'" width="'+Math.max(0.5,b-a)+'" height="'+Math.max(0.5,d-c)
        +'" fill="'+fill+'" opacity="'+(op||1)+'"'+(daten||'')+'/>';
    return '<rect x="'+c+'" y="'+a+'" width="'+Math.max(0.5,d-c)+'" height="'+Math.max(0.5,b-a)
      +'" fill="'+fill+'" opacity="'+(op||1)+'"'+(daten||'')+'/>';
  };
  const dk = horizontal ? dickeKoord : dickeKoordV;

  for (const eintrag of stapel) {
    const d0 = dk(eintrag.zVon), d1 = dk(eintrag.zBis);
    if (eintrag.art === 'balken') {
      /* Balkenlage: Gurte/Stiele, die die Linie kreuzen */
      let getroffen = false;
      if (ui.zeigeRiegel) for (const beam of modell.beams) {
        if (beam.outline.length < 3) continue;
        for (const [i0, i1] of polygonSchnittIntervalle(beam.outline, achse, pos)) {
          teile.push(band(laengsVonWelt(i0), laengsVonWelt(i1), d0, d1, cssVar('--svg-riegel'), 0.8));
          getroffen = true;
        }
      }
      /* Gefachdaemmung (PLI0/PLA0) schraffiert */
      for (const g of eintrag.gefach) if (lagenSichtbar(g))
        for (const platte of g.plates) {
          const pts = platte.outline.length >= 3 ? platte.outline : null;
          if (!pts) continue;
          for (const [i0, i1] of polygonSchnittIntervalle(pts, achse, pos))
            teile.push(band(laengsVonWelt(i0), laengsVonWelt(i1), d0, d1, lagenFarbe(g), 0.3));
        }
      const beschr = horizontal ? '<text x="6" y="'+((d0+d1)/2+3)+'"' : '<text x="'+((d0+d1)/2)+'" y="16" transform="rotate(90 '+((d0+d1)/2)+' 16)"';
      teile.push(beschr+' font-size="9" fill="'+txtF+'">RW</text>');
      continue;
    }
    const lage = eintrag.lage;
    const farbe = lagenFarbe(lage);
    /* Platten der Lage */
    for (const platte of lage.plates) {
      if (platte.outline.length < 3) continue;
      for (const [i0, i1] of polygonSchnittIntervalle(platte.outline, achse, pos))
        teile.push(band(laengsVonWelt(i0), laengsVonWelt(i1), d0, d1, farbe, 0.55));
    }
    /* Bearbeitungen: Kerben (PAF geschlossen), Saegestriche, NR-Marken */
    const innenSeite = lage.side === 'innen';
    for (const op of lage.ops) {
      if (ui.opFilter[op.kw] === false) continue;
      if (op.kw === 'NR') {
        /* P-5: NR im Schnitt vollstaendig darstellen + anwaehlbar machen —
           vorher nur einzelne, nicht anklickbare Dreiecke. Jetzt zusaetzlich
           eine durchgehende Linie ueber alle nahen Nagelpunkte (min..max
           Laengskoordinate) mit breiter transparenter Trefferlinie, analog
           zur PAF/PSG-Trefferlinie (kerbExtra) weiter unten im selben Block. */
        const spitze = innenSeite ? Math.min(d0,d1) : Math.max(d0,d1);
        const nrSel = (ui.auswahl && ui.auswahl.id === op.id) || ui.mehrAuswahl.includes(op.id);
        const nrFarbe = nrSel ? cssVar('--svg-auswahl') : cssVar('--svg-nr');
        const lps = [];
        for (const p of nagelPunkte(op)) {
          const wert = achse === 'y' ? p[1] : p[0];
          const laengs = achse === 'y' ? p[0] : p[1];
          if (Math.abs(wert - pos) > 25) continue;  /* nahe der Schnittlinie */
          lps.push(laengsVonWelt(laengs));
        }
        if (lps.length >= 2) {
          const lpMin = Math.min(...lps), lpMax = Math.max(...lps);
          if (horizontal)
            teile.push('<line x1="'+lpMin+'" y1="'+spitze+'" x2="'+lpMax+'" y2="'+spitze
              +'" stroke="'+nrFarbe+'" stroke-width="'+(nrSel?2.5:1.5)+'" data-op="'+op.id+'"/>'
              +'<line x1="'+lpMin+'" y1="'+spitze+'" x2="'+lpMax+'" y2="'+spitze
              +'" stroke="transparent" stroke-width="14" data-op="'+op.id+'" style="cursor:pointer"/>');
          else
            teile.push('<line x1="'+spitze+'" y1="'+lpMin+'" x2="'+spitze+'" y2="'+lpMax
              +'" stroke="'+nrFarbe+'" stroke-width="'+(nrSel?2.5:1.5)+'" data-op="'+op.id+'"/>'
              +'<line x1="'+spitze+'" y1="'+lpMin+'" x2="'+spitze+'" y2="'+lpMax
              +'" stroke="transparent" stroke-width="14" data-op="'+op.id+'" style="cursor:pointer"/>');
        }
        for (const lp of lps) {
          if (horizontal)
            teile.push('<path d="M '+(lp-3)+' '+spitze+' L '+(lp+3)+' '+spitze+' L '+lp+' '+(spitze+(innenSeite?6:-6))+' Z" fill="'+nrFarbe+'" data-op="'+op.id+'" style="cursor:pointer"/>');
          else
            teile.push('<path d="M '+spitze+' '+(lp-3)+' L '+spitze+' '+(lp+3)+' L '+(spitze+(innenSeite?6:-6))+' '+lp+' Z" fill="'+nrFarbe+'" data-op="'+op.id+'" style="cursor:pointer"/>');
        }
        continue;
      }
      if (!opIstZerspanend(op) && op.kw !== 'PSF') continue;
      const tiefe = Math.min(opMaxTiefe(op) || lage.hz, lage.hz);
      const tiefeAnteil = tiefe / (lage.hz || 1);
      /* Kerbe wirkt von der bearbeiteten (aufliegenden = jeweils aeusseren?) Flaeche:
         Bearbeitung erfolgt entgegen Z der Lage -> von der freien Seite der Lage */
      const frei = innenSeite ? Math.min(d0,d1) : Math.max(d0,d1);     /* freie Flaeche */
      const grund = innenSeite ? frei + tiefeAnteil*Math.abs(d1-d0) : frei - tiefeAnteil*Math.abs(d1-d0);
      const mpKreise = (op.poly||[]).filter(e => e.type === 'MP');
      const pts = opPolyAlsArray(op);
      if (op.kw === 'PSF') {
        if (pts.length >= 3) for (const [i0, i1] of polygonSchnittIntervalle(pts, achse, pos)) {
          const lA = laengsVonWelt(i0), lB = laengsVonWelt(i1);
          if (horizontal)
            teile.push('<line x1="'+Math.min(lA,lB)+'" y1="'+(frei+(innenSeite?-3:3))+'" x2="'+Math.max(lA,lB)+'" y2="'+(frei+(innenSeite?-3:3))+'" stroke="'+cssVar('--svg-psf')+'" stroke-width="2" stroke-dasharray="4 3"/>');
          else
            teile.push('<line x1="'+(frei+(innenSeite?-3:3))+'" y1="'+Math.min(lA,lB)+'" x2="'+(frei+(innenSeite?-3:3))+'" y2="'+Math.max(lA,lB)+'" stroke="'+cssVar('--svg-psf')+'" stroke-width="2" stroke-dasharray="4 3"/>');
        }
        continue;
      }
      const kerbFarbe = op.kw === 'PSG' ? cssVar('--svg-psg') : cssVar('--svg-paf');
      const kerbSel = (ui.auswahl && ui.auswahl.id === op.id) || ui.mehrAuswahl.includes(op.id);
      const kerbExtra = ' data-op="'+op.id+'" stroke="' + (kerbSel ? cssVar('--svg-auswahl') : 'transparent')
        + '" stroke-width="' + (kerbSel ? 2.5 : 8) + '" style="cursor:pointer"';
      if (op.closed && pts.length >= 3) {
        for (const [i0, i1] of polygonSchnittIntervalle(pts, achse, pos))
          teile.push(band(laengsVonWelt(i0), laengsVonWelt(i1), frei, grund, kerbFarbe, 0.75, kerbExtra));
      } else if (pts.length >= 2) {
        for (const kr of linieKreuzungen(pts, achse, pos)) {
          const lp = laengsVonWelt(kr);
          if (horizontal)
            teile.push('<line x1="'+lp+'" y1="'+frei+'" x2="'+lp+'" y2="'+grund+'" stroke="'+kerbFarbe
              +'" stroke-width="3" data-op="'+op.id+'" style="cursor:pointer"/>'
              +'<line x1="'+lp+'" y1="'+frei+'" x2="'+lp+'" y2="'+grund+'" stroke="transparent" stroke-width="10" data-op="'+op.id+'"/>');
          else
            teile.push('<line x1="'+frei+'" y1="'+lp+'" x2="'+grund+'" y2="'+lp+'" stroke="'+kerbFarbe
              +'" stroke-width="3" data-op="'+op.id+'" style="cursor:pointer"/>'
              +'<line x1="'+frei+'" y1="'+lp+'" x2="'+grund+'" y2="'+lp+'" stroke="transparent" stroke-width="10" data-op="'+op.id+'"/>');
        }
      }
      for (const mp of mpKreise) {
        const wert = achse === 'y' ? mp.y : mp.x;
        const laengs = achse === 'y' ? mp.x : mp.y;
        const r = Math.abs(mp.r || 0);
        if (Math.abs(wert - pos) > r) continue;
        const halb = Math.sqrt(Math.max(0, r*r - (wert-pos)*(wert-pos)));
        teile.push(band(laengsVonWelt(laengs - halb), laengsVonWelt(laengs + halb), frei, grund, kerbFarbe, 0.75,
          ' data-op="'+op.id+'"'));
      }
    }
    /* Lagen-Beschriftung */
    if (horizontal)
      teile.push('<text x="6" y="'+((d0+d1)/2+3)+'" font-size="9" fill="'+txtF+'">'+lage.id+'</text>');
    else
      teile.push('<text x="'+((d0+d1)/2+3)+'" y="16" font-size="9" fill="'+txtF+'" transform="rotate(90 '+((d0+d1)/2+3)+' 16)">'+lage.id+'</text>');
  }

  /* Messungen entlang der Schnittlinie auch IM Profil anzeigen */
  const messF = cssVar('--svg-mess');
  const dTop = horizontal ? pY0 + 20 : pX0 + 20;
  const dBot = horizontal ? pY0 + 22 + gesamtDicke * zSkala : pX0 + 22 + gesamtDicke * zSkala;
  const messStrich = (wert, dick) => {
    const lp = laengsVonWelt(wert);
    return horizontal
      ? '<line x1="'+lp+'" y1="'+dTop+'" x2="'+lp+'" y2="'+dBot+'" stroke="'+messF+'" stroke-width="'+dick+'" stroke-dasharray="3 3"/>'
      : '<line x1="'+dTop+'" y1="'+lp+'" x2="'+dBot+'" y2="'+lp+'" stroke="'+messF+'" stroke-width="'+dick+'" stroke-dasharray="3 3"/>';
  };
  for (const mess of ui.messungen) {
    const aufLinie = p => Math.abs((achse === 'y' ? p[1] : p[0]) - pos) < 0.6;
    if (!aufLinie(mess.a) || !aufLinie(mess.b)) continue;
    const wa = achse === 'y' ? mess.a[0] : mess.a[1];
    const wb = achse === 'y' ? mess.b[0] : mess.b[1];
    teile.push(messStrich(wa, 1.5) + messStrich(wb, 1.5));
    const mitte = laengsVonWelt((wa + wb) / 2);
    const lab = fmtZahl(Math.round(Math.abs(wb - wa) * 10) / 10) + ' mm';
    if (horizontal)
      teile.push('<line x1="'+laengsVonWelt(wa)+'" y1="'+(dTop+6)+'" x2="'+laengsVonWelt(wb)+'" y2="'+(dTop+6)+'" stroke="'+messF+'" stroke-width="1.5"/>'
        +'<text x="'+mitte+'" y="'+(dTop+3)+'" font-size="10" font-weight="700" fill="'+messF+'" text-anchor="middle">'+lab+'</text>');
    else
      teile.push('<line x1="'+(dTop+6)+'" y1="'+laengsVonWelt(wa)+'" x2="'+(dTop+6)+'" y2="'+laengsVonWelt(wb)+'" stroke="'+messF+'" stroke-width="1.5"/>'
        +'<text x="'+(dTop+14)+'" y="'+mitte+'" font-size="10" font-weight="700" fill="'+messF+'">'+lab+'</text>');
  }
  if (ui.messStart && Math.abs((achse === 'y' ? ui.messStart[1] : ui.messStart[0]) - pos) < 0.6)
    teile.push(messStrich(achse === 'y' ? ui.messStart[0] : ui.messStart[1], 2));

  return '<g pointer-events="visiblePainted">'+teile.join('')+'</g>';
}
function schnittUmschalten(richtung) {
  if (!modell) return;
  const ELM = modell.header.ELM;
  if (ui.schnitt.aktiv === richtung) ui.schnitt.aktiv = null;
  else {
    ui.schnitt.aktiv = richtung;
    ui.schnitt.pos = richtung === 'h' ? ELM.by / 2 : ELM.lx / 2;
  }
  document.getElementById('btnSchnittH').classList.toggle('umschalt-aktiv', ui.schnitt.aktiv === 'h');
  document.getElementById('btnSchnittV').classList.toggle('umschalt-aktiv', ui.schnitt.aktiv === 'v');
  svgRendern();
}

