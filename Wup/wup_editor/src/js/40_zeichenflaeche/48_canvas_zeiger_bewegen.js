function canvasPointerMove(ev) {
  if (!modell) return;
  const welt = svgWeltPunkt(ev);
  if (welt) {
    document.getElementById('koordAnzeige').textContent =
      'x: ' + fmtZahl(welt[0]) + ' · y: ' + fmtZahl(welt[1]);
    /* WP3-P1: Seiten-Wahl-Popup folgt der Maus, zeigt die aktuelle Wahl anhand
       der ersten betroffenen Op (Referenzgeometrie ist auf allen gewaehlten
       Schichten identisch, siehe zielLagenFuerNeu()). */
    if (ui.seitenWahl) {
      const referenz = opFinden(ui.seitenWahl.opIds[0]);
      if (referenz) seitenWahlPopupRendern(ev.clientX, ev.clientY, seiteBestimmen(referenz.op, welt));
    }
    if (ui.werkzeug === 'messen') {
      /* Feedback 7: im Schnittprofil auf Feature-Laengsziele fangen (Marker
         nur bei Treffer), sonst normaler Punktfang. */
      let snap;
      if (mausImProfil(ev)) { const ps = profilSnapPunkt(welt); snap = ps.gefangen ? ps.punkt : null; }
      else snap = naechsterSnap(welt);
      if ((snap && ui.snapAnzeige !== snap) || (!snap && ui.snapAnzeige)) { ui.snapAnzeige = snap; svgRendernThrottled(); }
    }
    /* WP3: Gummiband der Kontur-Vorschau zur Maus mitfuehren; beim Polygon den
       effektiven Punkt (Fang > Ortho > frei) zeigen, damit sichtbar ist, wo der
       naechste Klick landet und ob/welcher Punkt gefangen wird. */
    if (ui.werkzeug === 'neue-kontur' && ui.neueKontur) {
      if (ui.neueKontur.punkte) {
        const best = zeichenPunktBestimmen(welt, ev.shiftKey);
        ui._neueKonturMaus = best.p;
        ui.snapAnzeige = best.gefangen ? best.p.slice() : null;
      } else if (ui.neueKontur.rechteckStart) {
        /* Rechteck-Vorschau: zweite Ecke mit Punktfang, wie beim Polygon */
        const snap = naechsterSnapZeichnen(welt) || welt;
        ui._neueKonturMaus = snap;
        ui.snapAnzeige = snap;
      } else {
        ui._neueKonturMaus = welt;   /* MP: Radius-Vorschau roh */
      }
      svgRendernThrottled();
    } else if (ui.werkzeug === 'neue-kontur' && !ui.dreiD) {
      /* WP-K (Anwenderwunsch): Fang-Vorschau schon VOR dem ersten Punkt.
         Der Klick fing zwar auch bisher (zeichenPunktBestimmen laeuft ab
         Punkt 1), aber ui.neueKontur entsteht erst MIT dem ersten Klick —
         ohne Marker wirkte der erste Punkt wie "faengt nicht". Deckt auch
         den NR-Start/-Endpunkt (ui.neueNrStart) und das MP-Zentrum ab. */
      const snap = naechsterSnap(welt);
      const neu = snap ? snap.slice() : null;
      if (String(neu) !== String(ui.snapAnzeige)) { ui.snapAnzeige = neu; svgRendernThrottled(); }
    }
  }
  const d = ui.dragging;
  if (!d) {
    tooltipAktualisieren(ev);
    if ((ui.werkzeug === 'auswahl' || ui.werkzeug === 'kante') && !ui.dreiD) {
      const t = elementUnterMaus(ev);
      const neuHover = t && (t.typ === 'op' || t.typ === 'nr-ende') ? t.opId : null;
      if (neuHover !== ui.hoverOp) { const alterHover = ui.hoverOp; ui.hoverOp = neuHover; hoverPatchen(alterHover, neuHover); }
      /* WP-C: Vorschau der gleichseitigen Gruppen-Endpunkte beim Schweben
         ueber einem NR-Endpunkt, der Teil einer Mehrfachauswahl mit >= 2 NRs ist */
      let vorschau = null;
      if (ui.werkzeug === 'kante' && t && t.typ === 'nr-ende') {
        const fH = opFinden(t.opId);
        if (fH && fH.op.kw === 'NR' && opInMehrfachauswahl(fH.op.id)) {
          const nrs = mehrfachOps().filter(g => g.op.kw === 'NR' && g.op.nr);
          if (nrs.length >= 2) {
            const ziele = nrGruppenEndpunkte(nrs, fH.op, t.ende);
            /* angeklickter Referenzpunkt zuerst (bekommt das Fadenkreuz) */
            ziele.sort((a, b) => (a.op.id === fH.op.id ? -1 : 0) - (b.op.id === fH.op.id ? -1 : 0));
            vorschau = { opId: fH.op.id, ende: t.ende,
              punkte: ziele.map(z => z.ende === 'a' ? [z.op.nr.xa, z.op.nr.ya] : [z.op.nr.xe, z.op.nr.ye]) };
          }
        }
      }
      const vorher = JSON.stringify(ui.nrGruppeVorschau);
      if (JSON.stringify(vorschau) !== vorher) { ui.nrGruppeVorschau = vorschau; svgRendernThrottled(); }
    }
    return;
  }
  if (d.art === 'rechtsauswahl') {
    if (welt) {
      d.aktuell = welt;
      if (!d.bewegt && Geo.dist(d.start, welt) * ui.scale >= 5) {
        d.bewegt = true;
        /* Linux/GTK-Chromium feuert contextmenu bereits beim DRUECKEN der
           rechten Taste (Windows erst beim Loslassen) — ein dort schon
           geoeffnetes Menue beim Uebergang in den Drag wieder schliessen,
           sonst haengt es waehrend der Auswahl-Geste offen. */
        kontextmenueSchliessen();
      }
      svgRendernThrottled();
    }
    return;
  }
  if (d.art === 'gummiband') {
    const svgC = svgEl().getScreenCTM();
    const sp = new DOMPoint(ev.clientX, ev.clientY).matrixTransform(svgC.inverse());
    ui.gummiband.e = { x: sp.x, y: sp.y };
    svgRendern();
    return;
  }
  if (d.art === 'schnitt') {
    if (welt) {
      const ELM = modell.header.ELM;
      ui.schnitt.pos = ui.schnitt.aktiv === 'h'
        ? Math.max(0, Math.min(ELM.by, Math.round(welt[1])))
        : Math.max(0, Math.min(ELM.lx, Math.round(welt[0])));
      svgRendern();
    }
    return;
  }
  if (d.art === 'pan') {
    ui.pan.x = d.panStart.x + (ev.clientX - d.startClient[0]);
    ui.pan.y = d.panStart.y + (ev.clientY - d.startClient[1]);
    svgRendernThrottled();
    return;
  }
  if (d.art === 'dreiDpan') {
    ui.dreiDPan.x = d.panStart.x + (ev.clientX - d.startClient[0]);
    ui.dreiDPan.y = d.panStart.y + (ev.clientY - d.startClient[1]);
    svgRendernThrottled();
    return;
  }
  if (d.art === 'dreiDdrehen') {
    /* horizontal = Gier, vertikal = Neigung; Neigung auf +/- ~80 Grad begrenzt */
    ui.dreiDWinkel.az = d.winkelStart.az + (ev.clientX - d.startClient[0]) * 0.008;
    ui.dreiDWinkel.el = Math.max(-1.4, Math.min(1.4, d.winkelStart.el + (ev.clientY - d.startClient[1]) * 0.008));
    svgRendernThrottled();
    return;
  }
  if (!welt) return;
  if (d.art === 'nr-ganz' || d.art === 'nr-ende') {
    const f = opFinden(d.opId);
    if (!f) { ui.dragging = null; return; }
    if (!d.bewegt) {
      if (Geo.dist(welt, d.start) * ui.scale < 3) return; /* Klick, kein Drag */
      aenderungBeginnen();
      d.bewegt = true;
    }
    const n = f.op.nr, s = d.nrStart;
    /* WP-B: Punktfang fuer den gezogenen NR-Endpunkt (nr-ganz bleibt ohne Fang,
       siehe Aufgabenstellung — optional, hier weggelassen). Shift = Ortho hat
       Vorrang vor Fang. */
    if (d.art === 'nr-ende' && !ev.shiftKey) {
      const snap = naechsterSnapOhne(welt, d.ausschluss);
      d.zuletztSnap = snap;
      if (snap) {
        if (d.ende === 'a') { n.xa = snap[0]; n.ya = snap[1]; } else { n.xe = snap[0]; n.ye = snap[1]; }
        ui.snapAnzeige = snap;
        f.op._modified = true;
        svgRendern();
        return;
      }
      ui.snapAnzeige = null;
    }
    let dx = welt[0] - d.start[0], dy = welt[1] - d.start[1];
    if (ev.shiftKey) { if (Math.abs(dx) > Math.abs(dy)) dy = 0; else dx = 0; }
    if (d.art === 'nr-ganz') {
      n.xa = s.xa + dx; n.ya = s.ya + dy; n.xe = s.xe + dx; n.ye = s.ye + dy;
    } else if (d.ende === 'a') { n.xa = s.xa + dx; n.ya = s.ya + dy; }
    else { n.xe = s.xe + dx; n.ye = s.ye + dy; }
    f.op._modified = true;
    svgRendern();
    return;
  }
  if (d.art === 'nr-gruppe-ende') {
    if (!d.bewegt) {
      if (Geo.dist(welt, d.start) * ui.scale < 3) return; /* Klick, kein Drag */
      aenderungBeginnen();
      d.bewegt = true;
    }
    let dx = welt[0] - d.start[0], dy = welt[1] - d.start[1];
    if (ev.shiftKey) {
      if (Math.abs(dx) > Math.abs(dy)) dy = 0; else dx = 0;
      ui.snapAnzeige = null; d.zuletztSnap = null;
    } else {
      /* Punktfang: der ANGEKLICKTE Endpunkt rastet ein, alle gleichseitigen
         Endpunkte folgen mit exakt demselben Delta (Abstaende bleiben erhalten) */
      const klick = d.ziele.find(z => z.opId === d.klickOpId && z.ende === d.klickEnde);
      const snap = naechsterSnapOhne(welt, d.ausschluss);
      d.zuletztSnap = snap;
      if (snap && klick) { dx = snap[0] - klick.start.x; dy = snap[1] - klick.start.y; ui.snapAnzeige = snap; }
      else ui.snapAnzeige = null;
    }
    d.dxAktuell = dx; d.dyAktuell = dy;
    nrGruppenEndpunkteSetzen(d.ziele, dx, dy);
    svgRendern();
    return;
  }
  if (d.art === 'ops-gruppe') {
    if (!d.bewegt) {
      if (Geo.dist(welt, d.start) * ui.scale < 3) return; /* Klick, kein Drag */
      aenderungBeginnen();
      d.bewegt = true;
    }
    let dx = welt[0] - d.start[0], dy = welt[1] - d.start[1];
    if (ev.shiftKey) {
      if (Math.abs(dx) > Math.abs(dy)) dy = 0; else dx = 0;
      ui.snapAnzeige = null; d.zuletztSnap = null;
    } else if (d.anker) {
      /* Anker-Punktfang wie 'op-ganz' — die ganze Gruppe folgt dem Anker */
      const ankerVerschoben = [d.anker.x + dx, d.anker.y + dy];
      const snap = naechsterSnapInListe(ankerVerschoben, snapPunkte, d.ausschluss);
      if (snap) { dx = snap[0] - d.anker.x; dy = snap[1] - d.anker.y; ui.snapAnzeige = snap; d.zuletztSnap = snap; }
      else { ui.snapAnzeige = null; d.zuletztSnap = null; }
    }
    d.dxAktuell = dx; d.dyAktuell = dy;
    opsGruppeSetzen(d.starts, dx, dy);   /* setzt _modified je Op mit */
    svgRendern();
    return;
  }
  if (d.art === 'op-punkt') {
    const f = opFinden(d.opId);
    if (!f) { ui.dragging = null; return; }
    if (!d.bewegt) {
      if (Geo.dist(welt, d.start) * ui.scale < 3) return; /* Klick, kein Drag */
      aenderungBeginnen();
      d.bewegt = true;
    }
    /* WP-B: Punktfang — Mausposition (nicht die bisherige Punktposition) gegen
       die (ausschluss-gefilterten) Snap-Kandidaten pruefen; im Fangradius wird
       der Punkt EXAKT auf den Snap-Punkt gesetzt (Ring wie beim Messen). */
    const snap = naechsterSnapOhne(welt, d.ausschluss);
    d.zuletztSnap = snap;
    if (snap) { d.punkt.x = snap[0]; d.punkt.y = snap[1]; ui.snapAnzeige = snap; }
    else {
      const dx = welt[0] - d.start[0], dy = welt[1] - d.start[1];
      d.punkt.x = d.punktStart.x + dx; d.punkt.y = d.punktStart.y + dy;
      ui.snapAnzeige = null;
    }
    /* NUR bei geschlossenem Zug: Duplikat-Endpunkt synchron halten (offene
       Zuege mit >= 3 Punkten wuerden sonst kollabieren, siehe kantenGeometrieSetzen) */
    const pts = (f.op.poly || []).filter(e => e.type === 'PP' || e.type === 'KB');
    if (f.op.closed && pts.length >= 3) {
      if (d.punkt === pts[0]) { pts[pts.length - 1].x = d.punkt.x; pts[pts.length - 1].y = d.punkt.y; }
      if (d.punkt === pts[pts.length - 1]) { pts[0].x = d.punkt.x; pts[0].y = d.punkt.y; }
    }
    f.op._modified = true;
    svgRendern();
    return;
  }
  if (d.art === 'kante-ganz') {
    if (!d.bewegt) {
      if (Geo.dist(welt, d.startWelt) * ui.scale < 3) return; /* Klick, kein Drag */
      aenderungBeginnen();
      d.bewegt = true;
    }
    const u0 = d.urspruenge[0];
    const n0 = u0 && u0.n;
    if (!n0) return;
    let delta = (welt[0] - d.startWelt[0]) * n0[0] + (welt[1] - d.startWelt[1]) * n0[1];
    /* Feedback-Punkt 6: Punktfang — rastet die Kante so ein, dass sie exakt
       durch einen nahen Snap-Punkt laeuft (Shift = kein Fang, freie Verschiebung) */
    if (!ev.shiftKey) {
      const fang = kantenFangDeltaFinden(welt, delta, u0.a0, n0, snapPunkte, d.ausschluss);
      if (fang) { delta = fang.delta; ui.snapAnzeige = fang.punkt; d.zuletztSnap = fang.punkt; }
      else { ui.snapAnzeige = null; d.zuletztSnap = null; }
    } else { ui.snapAnzeige = null; d.zuletztSnap = null; }
    d.deltaAktuell = delta;
    kantenGeometrieSetzen(d.urspruenge, delta);
    svgRendern();
    return;
  }
  if (d.art === 'op-ganz') {
    const f = opFinden(d.opId);
    if (!f) { ui.dragging = null; return; }
    if (!d.bewegt) {
      if (Geo.dist(welt, d.start) * ui.scale < 3) return; /* Klick, kein Drag */
      aenderungBeginnen();
      d.bewegt = true;
    }
    /* absolut setzen (nicht inkrementell): erst aus dem Dragstart-Schnappschuss
       wiederherstellen, dann in EINEM Schritt um den Gesamt-Delta verschieben —
       so driftet nichts durch wiederholte Rundung waehrend des Drags */
    const s = d.opStart;
    for (let i = 0; i < (f.op.poly || []).length; i++) { f.op.poly[i].x = s.poly[i].x; f.op.poly[i].y = s.poly[i].y; }
    if (f.op.nr && s.nr) { f.op.nr.xa = s.nr.xa; f.op.nr.ya = s.nr.ya; f.op.nr.xe = s.nr.xe; f.op.nr.ye = s.nr.ye; }
    if (f.op.nbr) for (let i = 0; i < f.op.nbr.length; i++) { f.op.nbr[i].x = s.nbr[i].x; f.op.nbr[i].y = s.nbr[i].y; }
    let dx = welt[0] - d.start[0], dy = welt[1] - d.start[1];
    /* Feedback-Punkt 6 (Bonus): Anker-Punktfang — der Anker (naechster Op-Punkt
       zum Dragstart) rastet auf einen nahen Snap-Punkt ein; Shift = kein Fang */
    if (!ev.shiftKey && d.anker) {
      const ankerVerschoben = [d.anker.x + dx, d.anker.y + dy];
      const snap = naechsterSnapInListe(ankerVerschoben, snapPunkte, d.ausschluss);
      if (snap) { dx = snap[0] - d.anker.x; dy = snap[1] - d.anker.y; ui.snapAnzeige = snap; d.zuletztSnap = snap; }
      else { ui.snapAnzeige = null; d.zuletztSnap = null; }
    } else { ui.snapAnzeige = null; d.zuletztSnap = null; }
    d.dxAktuell = dx; d.dyAktuell = dy;
    opGeometrieVerschieben(f.op, dx, dy);
    svgRendern();
    return;
  }
}
