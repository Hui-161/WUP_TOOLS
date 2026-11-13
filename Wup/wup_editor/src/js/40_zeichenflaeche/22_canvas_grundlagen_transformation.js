/* =====================================================================
   §6 SVG-CANVAS — Rendering & Transformation
   ===================================================================== */
const ui = {
  ansicht: 'innen',
  /* GUI-M: die fruehere ui.seite-Filterung ist entfernt — die Seiten-
     Dreiecke schalten die Lagen-Sichtbarkeit DIREKT (seiteSetzen). */
  scale: 0.2, pan: { x: 40, y: 40 },
  werkzeug: 'auswahl',
  auswahl: null,           /* { typ, lageId, opId, plattenId, beamId, punktIdx, kanten:[] } */
  kanten: [],              /* F6: [{lageId, besitzer:'platte'|'op', id, segIdx}] */
  messungen: [], messStart: null,
  neueNrStart: null, nrLetzte: { a: 150, i: 10 },
  neueKontur: null,        /* WP3: Entwurf einer neuen Kontur — {punkte:[[x,y],...]} oder {zentrum:[x,y]} fuer MP */
  neuKonturLagen: null,    /* WP3-P3: gewaehlte Ziel-Lagen (Array von lageId) fuer neue Konturen; null/leer = Fallback obersteSichtbareLageMitPlatten() */
  seitenWahl: null,        /* WP3-P1: aktiver Seiten-Wahl-Schritt nach PAF/PSG-Erzeugung — {opIds:[...], lageId} */
  kanteRichtung: 'senkrecht', /* Verschieben-Overlay: 'senkrecht'|'x'|'y' */
  schnittdetails: false, zeigeRiegel: true, zeigeBauteilBearb: true,
  schnitt: { aktiv: null, pos: 0 },          /* 'h' | 'v' | null */
  dreiD: false, dreiDExplosion: true,
  dreiDWinkel: { az: 0.55, el: 0.42 },   /* Gier/Neigung [rad] fuer die drehbare 3D-Axonometrie */
  dreiDPan: { x: 0, y: 0 },
  opFilter: { NR: true, PAF: true, PSG: true, PSF: true, PSZ: true, PML: true, BOZ: true }, /* BOZ = Bauteil-Bohrungen, Chip nur wenn vorhanden (v2.59) */
  mehrAuswahl: [],
  nurOps: false, zeigeUeberstand: false, segMark: null,
  textTab: 'quelltext', logZu: true,   /* Fehlerlog standardmaessig eingeklappt */
  logFilter: { fehler: true, warnung: true, hinweis: true },   /* GUI-E: Level-Chips */
  segMarkMehr: null,   /* Feedback K: weitere markierte Punkte { opId, idxs: [] } */
  hoverOp: null, gummiband: null,                            /* zusaetzliche Op-IDs bei Strg/Umschalt+Klick */
  nrGruppeVorschau: null,  /* WP-C: Hover-Vorschau der gleichseitigen NR-Endpunkte — { opId, ende, punkte:[[x,y],...] } */
  eckenPml: null,          /* WP-G: aktiver Ecken-Markierungs-Modus — { lageId, ruecksprung } */
  dragging: null
};
const svgEl = () => document.getElementById('canvas');

function cssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}
function spiegelX() { return ui.ansicht === 'aussen' || ui.ansicht === 'spiegel-xy'; }
function spiegelY() { return ui.ansicht === 'spiegel-y' || ui.ansicht === 'spiegel-xy'; }
function toSVG(wx, wy) {
  const ELM = modell.header.ELM;
  const px = spiegelX() ? (ELM.lx - wx) : wx;
  const py = spiegelY() ? wy : (ELM.by - wy);
  return { x: px * ui.scale + ui.pan.x, y: py * ui.scale + ui.pan.y };
}
function vonSVG(sx, sy) {
  const ELM = modell.header.ELM;
  let wx = (sx - ui.pan.x) / ui.scale;
  if (spiegelX()) wx = ELM.lx - wx;
  let wy = (sy - ui.pan.y) / ui.scale;
  if (!spiegelY()) wy = ELM.by - wy;
  return [wx, wy];
}
function zoomEinpassen() {
  if (!modell) return;
  const w = document.getElementById('canvasWrapper');
  const ELM = modell.header.ELM;
  if (ELM.lx <= 0 || ELM.by <= 0) return;
  const sx = (w.clientWidth - 80) / ELM.lx, sy = (w.clientHeight - 80) / ELM.by;
  ui.scale = Math.max(0.01, Math.min(sx, sy));
  ui.pan = { x: (w.clientWidth - ELM.lx * ui.scale) / 2, y: (w.clientHeight - ELM.by * ui.scale) / 2 };
  svgRendern();
}

function pfadAusPunkten(pts, schliessen) {
  if (!pts.length) return '';
  let d = '';
  pts.forEach((p, i) => {
    const s = toSVG(p[0], p[1]);
    d += (i === 0 ? 'M' : 'L') + s.x.toFixed(1) + ' ' + s.y.toFixed(1) + ' ';
  });
  if (schliessen) d += 'Z';
  return d;
}
function escapeHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function lagenSichtbar(lage) {
  /* GUI-M: nur noch lage.sichtbar — die Seiten-Dreiecke schalten die
     Lagen direkt, ein zusaetzlicher ui.seite-Filter existiert nicht mehr */
  return !!lage.sichtbar;
}

function pfeilMittel(p1, p2, farbe) {
  /* kleine Pfeilspitze in Segmentmitte (Bearbeitungsrichtung) */
  const a = toSVG(p1[0], p1[1]), b = toSVG(p2[0], p2[1]);
  const mx = (a.x+b.x)/2, my = (a.y+b.y)/2;
  const dx = b.x-a.x, dy = b.y-a.y, l = Math.hypot(dx,dy) || 1;
  if (l < 14) return '';
  const ux = dx/l, uy = dy/l;
  const s = 5;
  return '<path d="M' + (mx - ux*s - uy*s*0.7) + ' ' + (my - uy*s + ux*s*0.7)
    + ' L' + (mx + ux*s) + ' ' + (my + uy*s)
    + ' L' + (mx - ux*s + uy*s*0.7) + ' ' + (my - uy*s - ux*s*0.7)
    + '" fill="none" stroke="' + farbe + '" stroke-width="1.4"/>';
}
function kammStrich(p1, p2, korr, farbe) {
  /* kurzer Querstrich auf der WERKZEUG-/Abfallseite (korr: 1 = Abfall links, 2 = Abfall rechts) */
  if (korr !== 1 && korr !== 2) return '';
  const a = toSVG(p1[0], p1[1]), b = toSVG(p2[0], p2[1]);
  const dx = b.x-a.x, dy = b.y-a.y, l = Math.hypot(dx,dy) || 1;
  if (l < 18) return '';
  const ux = dx/l, uy = dy/l;
  /* Bildschirm-y ist gespiegelt: links der Bearbeitungsrichtung (Welt) = rechts im Bild?
     Wir bestimmen die Weltnormale und transformieren beide Punkte — robust gegen Spiegelung. */
  const nWelt = korr === 1 ? [ -(p2[1]-p1[1]), (p2[0]-p1[0]) ] : [ (p2[1]-p1[1]), -(p2[0]-p1[0]) ];
  const nl = Math.hypot(...nWelt) || 1;
  const mWelt = [ (p1[0]+p2[0])/2, (p1[1]+p2[1])/2 ];
  const m2 = [ mWelt[0] + nWelt[0]/nl * 8/ui.scale, mWelt[1] + nWelt[1]/nl * 8/ui.scale ];
  const s1 = toSVG(mWelt[0], mWelt[1]), s2 = toSVG(m2[0], m2[1]);
  return '<line x1="'+s1.x+'" y1="'+s1.y+'" x2="'+s2.x+'" y2="'+s2.y+'" stroke="'+farbe+'" stroke-width="1.2" opacity="0.8"/>';
}

let _svgLabels = [];
function svgLabelFrei(x, y) {
  /* B-06: freie Position fuer Mini-Labels suchen (⊕⊖ etc.) */
  const kandidaten = [[5,-5],[7,12],[-15,-5],[-15,12],[5,-18],[18,4],[-26,4],[5,25]];
  for (const [dx, dy] of kandidaten) {
    const px = x + dx, py = y + dy;
    if (!_svgLabels.some(l => Math.abs(l.x - px) < 13 && Math.abs(l.y - py) < 12)) {
      _svgLabels.push({ x: px, y: py });
      return { x: px, y: py };
    }
  }
  return { x: x + 5, y: y - 5 };
}
/* Feedback-Punkt 6 C: waehrend eines aktiven Drags (op-punkt, nr-ende, nr-ganz,
   kante-ganz, op-ganz) die Original-Geometrie gestrichelt/gedimmt als Ghost
   einblenden + eine Massline mit dem zurueckgelegten Verschiebeweg in mm. */
function dragUeberlagerungSvg() {
  const d = ui.dragging;
  if (!d || !d.bewegt) return '';
  const arten = ['op-punkt', 'nr-ende', 'nr-ganz', 'kante-ganz', 'op-ganz', 'nr-gruppe-ende', 'ops-gruppe'];
  if (!arten.includes(d.art)) return '';
  const ghostFarbe = cssVar('--text-gedimmt'), akz = cssVar('--akzent'), flaeche = cssVar('--flaeche');
  const teile = [];
  const mmText = dist => (Math.round(dist * 10) / 10) + ' mm';
  const massLinie = (ax, ay, bx, by, text) => {
    const A = toSVG(ax, ay), B = toSVG(bx, by);
    const mx = (A.x + B.x) / 2, my = (A.y + B.y) / 2;
    return '<line x1="' + A.x + '" y1="' + A.y + '" x2="' + B.x + '" y2="' + B.y
      + '" stroke="' + akz + '" stroke-width="1" stroke-dasharray="2 2" opacity="0.85"/>'
      + '<text x="' + mx + '" y="' + (my - 6) + '" font-size="11" font-weight="700" fill="' + akz
      + '" stroke="' + flaeche + '" stroke-width="2.5" paint-order="stroke" text-anchor="middle" '
      + 'style="pointer-events:none">' + escapeHtml(text) + '</text>';
  };
  if (d.art === 'op-punkt') {
    const g = toSVG(d.punktStart.x, d.punktStart.y);
    teile.push('<circle cx="' + g.x + '" cy="' + g.y + '" r="5" fill="none" stroke="' + ghostFarbe
      + '" stroke-width="1.5" stroke-dasharray="3 2" opacity="0.6"/>');
    const dist = Geo.dist([d.punktStart.x, d.punktStart.y], [d.punkt.x, d.punkt.y]);
    if (dist > 0.05) teile.push(massLinie(d.punktStart.x, d.punktStart.y, d.punkt.x, d.punkt.y, mmText(dist)));
  } else if (d.art === 'kante-ganz') {
    for (const u of d.urspruenge) {
      const a = toSVG(u.a0[0], u.a0[1]), b = toSVG(u.b0[0], u.b0[1]);
      teile.push('<line x1="' + a.x + '" y1="' + a.y + '" x2="' + b.x + '" y2="' + b.y
        + '" stroke="' + ghostFarbe + '" stroke-width="1.5" stroke-dasharray="4 3" opacity="0.6"/>');
    }
    const u0 = d.urspruenge[0];
    if (u0) {
      const delta = d.deltaAktuell || 0;
      const midO = [(u0.a0[0] + u0.b0[0]) / 2, (u0.a0[1] + u0.b0[1]) / 2];
      const midN = [midO[0] + u0.n[0] * delta, midO[1] + u0.n[1] * delta];
      if (Math.abs(delta) > 0.05)
        teile.push(massLinie(midO[0], midO[1], midN[0], midN[1], (delta > 0 ? '+' : '') + (Math.round(delta * 10) / 10) + ' mm'));
    }
  } else if (d.art === 'op-ganz') {
    const s = d.opStart;
    const pts = (s.poly || []).filter(e => e.type === 'PP' || e.type === 'KB').map(e => [e.x, e.y]);
    if (pts.length >= 2) {
      const svgPts = pts.map(p => toSVG(p[0], p[1]));
      const dPath = svgPts.map((p, i) => (i === 0 ? 'M' : 'L') + p.x + ',' + p.y).join(' ');
      teile.push('<path d="' + dPath + '" fill="none" stroke="' + ghostFarbe
        + '" stroke-width="1.5" stroke-dasharray="4 3" opacity="0.6"/>');
    }
    if (s.nr) {
      const a = toSVG(s.nr.xa, s.nr.ya), b = toSVG(s.nr.xe, s.nr.ye);
      teile.push('<line x1="' + a.x + '" y1="' + a.y + '" x2="' + b.x + '" y2="' + b.y
        + '" stroke="' + ghostFarbe + '" stroke-width="1.5" stroke-dasharray="4 3" opacity="0.6"/>');
    }
    if (d.anker) {
      const dx = d.dxAktuell || 0, dy = d.dyAktuell || 0;
      const dist = Math.hypot(dx, dy);
      if (dist > 0.05) teile.push(massLinie(d.anker.x, d.anker.y, d.anker.x + dx, d.anker.y + dy, mmText(dist)));
    }
  } else if (d.art === 'nr-ganz' || d.art === 'nr-ende') {
    const s = d.nrStart;
    const a = toSVG(s.xa, s.ya), b = toSVG(s.xe, s.ye);
    teile.push('<line x1="' + a.x + '" y1="' + a.y + '" x2="' + b.x + '" y2="' + b.y
      + '" stroke="' + ghostFarbe + '" stroke-width="1.5" stroke-dasharray="4 3" opacity="0.6"/>');
    const f = opFinden(d.opId);
    if (f && f.op.nr) {
      const n = f.op.nr;
      const midO = [(s.xa + s.xe) / 2, (s.ya + s.ye) / 2], midN = [(n.xa + n.xe) / 2, (n.ya + n.ye) / 2];
      const dist = Geo.dist(midO, midN);
      if (dist > 0.05) teile.push(massLinie(midO[0], midO[1], midN[0], midN[1], mmText(dist)));
    }
  } else if (d.art === 'nr-gruppe-ende') {
    /* WP-C: Ghost aller betroffenen NRs + KRAEFTIGE Marker auf den bewegten
       gleichseitigen Endpunkten (Anwenderwunsch: Punkt besonders hervorheben) */
    for (const z of d.ziele) {
      const s = z.nrStart;
      const a = toSVG(s.xa, s.ya), b = toSVG(s.xe, s.ye);
      teile.push('<line x1="' + a.x + '" y1="' + a.y + '" x2="' + b.x + '" y2="' + b.y
        + '" stroke="' + ghostFarbe + '" stroke-width="1.5" stroke-dasharray="4 3" opacity="0.6"/>');
      const f = opFinden(z.opId);
      if (f && f.op.nr) {
        const p = z.ende === 'a' ? [f.op.nr.xa, f.op.nr.ya] : [f.op.nr.xe, f.op.nr.ye];
        teile.push(nrGruppenPunktSvg(p, z.opId === d.klickOpId && z.ende === d.klickEnde));
      }
    }
    const klick = d.ziele.find(z => z.opId === d.klickOpId && z.ende === d.klickEnde);
    if (klick) {
      const dist = Math.hypot(d.dxAktuell || 0, d.dyAktuell || 0);
      if (dist > 0.05)
        teile.push(massLinie(klick.start.x, klick.start.y,
          klick.start.x + (d.dxAktuell || 0), klick.start.y + (d.dyAktuell || 0),
          mmText(dist) + ' · ' + d.ziele.length + ' Endpunkte'));
    }
  } else if (d.art === 'ops-gruppe') {
    for (const s of d.starts) {
      const pts = (s.poly || []).filter(e => e.type === 'PP' || e.type === 'KB').map(e => [e.x, e.y]);
      if (pts.length >= 2) {
        const svgPts = pts.map(p => toSVG(p[0], p[1]));
        teile.push('<path d="' + svgPts.map((p, i) => (i === 0 ? 'M' : 'L') + p.x + ',' + p.y).join(' ')
          + '" fill="none" stroke="' + ghostFarbe + '" stroke-width="1.5" stroke-dasharray="4 3" opacity="0.6"/>');
      }
      if (s.nr) {
        const a = toSVG(s.nr.xa, s.nr.ya), b = toSVG(s.nr.xe, s.nr.ye);
        teile.push('<line x1="' + a.x + '" y1="' + a.y + '" x2="' + b.x + '" y2="' + b.y
          + '" stroke="' + ghostFarbe + '" stroke-width="1.5" stroke-dasharray="4 3" opacity="0.6"/>');
      }
    }
    if (d.anker) {
      const dist = Math.hypot(d.dxAktuell || 0, d.dyAktuell || 0);
      if (dist > 0.05)
        teile.push(massLinie(d.anker.x, d.anker.y, d.anker.x + (d.dxAktuell || 0), d.anker.y + (d.dyAktuell || 0),
          mmText(dist) + ' · ' + d.starts.length + ' Bearbeitungen'));
    }
  }
  return teile.join('');
}
/* WP-C: kraeftiger Doppelring-Marker fuer einen Gruppen-Endpunkt. Der
   angeklickte Referenzpunkt (hauptpunkt) bekommt zusaetzlich ein Fadenkreuz. */
function nrGruppenPunktSvg(p, hauptpunkt) {
  const c = toSVG(p[0], p[1]);
  const akz = cssVar('--akzent'), flaeche = cssVar('--flaeche');
  /* pointer-events:none auf der GRUPPE ist Pflicht: die Marker liegen ueber
     dem echten Endpunkt-Griff und wuerden sonst dessen Klick abfangen */
  let s = '<g pointer-events="none">'
    + '<circle class="nr-gruppen-halo" cx="' + c.x + '" cy="' + c.y + '" r="10" fill="' + akz + '" opacity="0.25"/>'
    + '<circle cx="' + c.x + '" cy="' + c.y + '" r="5.5" fill="' + akz + '" stroke="' + flaeche + '" stroke-width="2"/>';
  if (hauptpunkt)
    s += '<path d="M' + (c.x - 9) + ',' + c.y + ' H' + (c.x + 9) + ' M' + c.x + ',' + (c.y - 9) + ' V' + (c.y + 9)
      + '" stroke="' + akz + '" stroke-width="1.4" fill="none"/>';
  return s + '</g>';
}
/* WP-C: Hover-Vorschau — zeigt VOR dem Ziehen, welche gleichseitigen
   NR-Endpunkte gemeinsam wandern wuerden (ui.nrGruppeVorschau). */
function nrGruppenVorschauSvg() {
  const v = ui.nrGruppeVorschau;
  if (!v || ui.dragging) return '';
  return v.punkte.map((p, i) => nrGruppenPunktSvg(p, i === 0)).join('');
}
