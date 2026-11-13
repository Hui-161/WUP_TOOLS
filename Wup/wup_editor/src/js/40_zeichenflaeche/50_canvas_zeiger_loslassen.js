function canvasPointerUp(ev) {
  const d = ui.dragging;
  ui.dragging = null;
  if (d && d.art === 'rechtsauswahl') {
    if (!d.bewegt) return; /* Rechtsklick ohne Ziehen: normales Kontextmenue, siehe contextmenu-Handler */
    const modus = d.aktuell[0] >= d.start[0] ? 'linie' : 'kasten';
    const treffer = opsImBereich(modus, d.start, d.aktuell);
    /* Kontextmenue nach diesem Drag EINMALIG unterdruecken (Rechtsklick-Up
       loest sonst das globale contextmenu-Ereignis aus). */
    ui._rechtsauswahlWar = true;
    if (treffer.length) {
      const additiv = !!(ev && (ev.ctrlKey || ev.metaKey));
      if (additiv && ui.auswahl && ui.auswahl.typ === 'op') {
        const ids = [ui.auswahl.id, ...ui.mehrAuswahl];
        for (const t of treffer) if (!ids.includes(t.op.id)) ids.push(t.op.id);
        ui.auswahl = { typ: 'op', id: ids[0], lageId: (opFinden(ids[0]) || {}).lage ? opFinden(ids[0]).lage.id : treffer[0].lage.id };
        ui.mehrAuswahl = ids.slice(1);
      } else {
        ui.auswahl = { typ: 'op', id: treffer[0].op.id, lageId: treffer[0].lage.id };
        ui.mehrAuswahl = treffer.slice(1).map(t => t.op.id);
      }
      svgRendern(); eigenschaftenRendern(); baumAuswahlMarkieren();
      hinweisAnzeigen((additiv ? ui.mehrAuswahl.length + 1 : treffer.length) + ' Bearbeitungen ausgewaehlt ('
        + (modus === 'linie' ? 'Auswahl-Linie' : 'Auswahl-Kasten') + ').', 'info');
    } else svgRendern();
    return;
  }
  if (d && d.art === 'gummiband' && ui.gummiband) {
    const g = ui.gummiband;
    ui.gummiband = null;
    const a = vonSVG(Math.min(g.s.x, g.e.x), Math.min(g.s.y, g.e.y));
    const b = vonSVG(Math.max(g.s.x, g.e.x), Math.max(g.s.y, g.e.y));
    const minX = Math.min(a[0], b[0]), maxX = Math.max(a[0], b[0]);
    const minY = Math.min(a[1], b[1]), maxY = Math.max(a[1], b[1]);
    const treffer = [];
    for (const lage of modell.layers.filter(lagenSichtbar))
      for (const op of lage.ops) {
        if (ui.opFilter[op.kw] === false) continue;
        const pts = op.kw === 'NR' ? [[op.nr.xa, op.nr.ya], [op.nr.xe, op.nr.ye]] : opPolyAlsArray(op);
        if (pts.some(p => p[0] >= minX && p[0] <= maxX && p[1] >= minY && p[1] <= maxY))
          treffer.push({ op, lage });
      }
    if (treffer.length) {
      ui.auswahl = { typ: 'op', id: treffer[0].op.id, lageId: treffer[0].lage.id };
      ui.mehrAuswahl = treffer.slice(1).map(t => t.op.id);
      svgRendern(); eigenschaftenRendern(); baumAuswahlMarkieren();
      hinweisAnzeigen(treffer.length + ' Bearbeitungen ausgewaehlt.', 'info');
    } else svgRendern();
    return;
  }
  if (d && (d.art === 'nr-ganz' || d.art === 'nr-ende') && d.bewegt) {
    const f = opFinden(d.opId);
    if (f) {
      /* auf ganze mm runden — ausser dem exakt gefangenen Endpunkt (WP-B: nicht
         nochmal runden, wenn er bereits exakt auf einem Snap-Punkt sitzt) */
      const snapFeld = d.art === 'nr-ende' && d.zuletztSnap ? (d.ende === 'a' ? ['xa', 'ya'] : ['xe', 'ye']) : [];
      for (const k of ['xa', 'ya', 'xe', 'ye']) if (!snapFeld.includes(k)) f.op.nr[k] = Math.round(f.op.nr[k] * 10) / 10;
    }
    ui.snapAnzeige = null;
    alleNeuRendern(true);
    return;
  }
  if (d && d.art === 'nr-gruppe-ende' && d.bewegt) {
    /* WP-C: ohne exakten Punktfang auf 0,1 mm runden; MIT Fang nicht runden,
       damit alle gleichseitigen Endpunkte exakt dasselbe Delta behalten */
    if (!d.zuletztSnap) {
      for (const z of d.ziele) {
        const f = opFinden(z.opId);
        if (!f || !f.op.nr) continue;
        const felder = z.ende === 'a' ? ['xa', 'ya'] : ['xe', 'ye'];
        for (const k of felder) f.op.nr[k] = Math.round(f.op.nr[k] * 10) / 10;
      }
    }
    ui.snapAnzeige = null;
    alleNeuRendern(true);
    hinweisAnzeigen(d.ziele.length + ' NR-Endpunkte gemeinsam verschoben (experimentell — bitte Ergebnis pruefen).', 'info');
    return;
  }
  if (d && d.art === 'ops-gruppe' && d.bewegt) {
    if (!d.zuletztSnap) {
      for (const s of d.starts) {
        const f = opFinden(s.opId);
        if (!f) continue;
        for (const e of (f.op.poly || [])) { e.x = Math.round(e.x * 10) / 10; e.y = Math.round(e.y * 10) / 10; }
        if (f.op.nr) for (const k of ['xa', 'ya', 'xe', 'ye']) f.op.nr[k] = Math.round(f.op.nr[k] * 10) / 10;
        for (const n of (f.op.nbr || [])) { n.x = Math.round(n.x * 10) / 10; n.y = Math.round(n.y * 10) / 10; }
      }
    }
    ui.snapAnzeige = null;
    alleNeuRendern(true);
    hinweisAnzeigen(d.starts.length + ' Bearbeitungen gemeinsam verschoben.', 'erfolg');
    return;
  }
  if (d && d.art === 'op-punkt' && d.bewegt) {
    if (!d.zuletztSnap) {
      d.punkt.x = Math.round(d.punkt.x * 10) / 10;
      d.punkt.y = Math.round(d.punkt.y * 10) / 10;
    }
    const f = opFinden(d.opId);
    if (f) {
      const pts = (f.op.poly || []).filter(e => e.type === 'PP' || e.type === 'KB');
      if (f.op.closed && pts.length >= 3) {
        if (d.punkt === pts[0]) { pts[pts.length - 1].x = d.punkt.x; pts[pts.length - 1].y = d.punkt.y; }
        if (d.punkt === pts[pts.length - 1]) { pts[0].x = d.punkt.x; pts[0].y = d.punkt.y; }
      }
    }
    ui.snapAnzeige = null;
    alleNeuRendern(true);
    return;
  }
  if (d && d.art === 'kante-ganz' && d.bewegt) {
    /* auf ganze mm runden — je Kante ueber die Dragstart-Referenzen (nicht ueber
       eine Distanz-Heuristik), damit offene Konturen nicht faelschlich geschlossen werden.
       Feedback-Punkt 6: bei exaktem Punktfang (d.zuletztSnap) NICHT runden — die
       Kante sitzt bereits exakt auf dem Snap-Punkt, Runden wuerde sie wieder davon abziehen. */
    if (!d.zuletztSnap) for (const u of d.urspruenge) {
      const k = u.k, seg = u.seg;
      if (k.besitzer === 'platte') {
        const o = seg.platte.outline;
        o[k.segIdx][0] = Math.round(o[k.segIdx][0] * 10) / 10; o[k.segIdx][1] = Math.round(o[k.segIdx][1] * 10) / 10;
        o[k.segIdx + 1][0] = Math.round(o[k.segIdx + 1][0] * 10) / 10; o[k.segIdx + 1][1] = Math.round(o[k.segIdx + 1][1] * 10) / 10;
        if (u.istGeschlossen) {
          if (k.segIdx === 0) { o[o.length - 1][0] = o[0][0]; o[o.length - 1][1] = o[0][1]; }
          if (k.segIdx + 1 === o.length - 1) { o[0][0] = o[o.length - 1][0]; o[0][1] = o[o.length - 1][1]; }
        }
      } else {
        seg.p1.x = Math.round(seg.p1.x * 10) / 10; seg.p1.y = Math.round(seg.p1.y * 10) / 10;
        seg.p2.x = Math.round(seg.p2.x * 10) / 10; seg.p2.y = Math.round(seg.p2.y * 10) / 10;
        const pts = (seg.op.poly || []).filter(e => e.type === 'PP' || e.type === 'KB');
        if (seg.op.closed && pts.length >= 3) {
          if (seg.p1 === pts[0]) { pts[pts.length - 1].x = seg.p1.x; pts[pts.length - 1].y = seg.p1.y; }
          if (seg.p2 === pts[pts.length - 1]) { pts[0].x = seg.p2.x; pts[0].y = seg.p2.y; }
        }
      }
    }
    ui.snapAnzeige = null;
    alleNeuRendern(true);
    return;
  }
  if (d && d.art === 'op-ganz' && d.bewegt) {
    const f = opFinden(d.opId);
    /* Feedback-Punkt 6 (Bonus): bei exaktem Anker-Punktfang nicht runden —
       der Anker sitzt bereits exakt auf dem Snap-Punkt. */
    if (f && !d.zuletztSnap) {
      for (const e of (f.op.poly || [])) { e.x = Math.round(e.x * 10) / 10; e.y = Math.round(e.y * 10) / 10; }
      if (f.op.nr) for (const k of ['xa', 'ya', 'xe', 'ye']) f.op.nr[k] = Math.round(f.op.nr[k] * 10) / 10;
      for (const n of (f.op.nbr || [])) { n.x = Math.round(n.x * 10) / 10; n.y = Math.round(n.y * 10) / 10; }
    }
    ui.snapAnzeige = null;
    alleNeuRendern(true);
    return;
  }
}
