function tooltipAktualisieren(ev) {
  const tip = document.getElementById('svgTooltip');
  const treffer = elementUnterMaus(ev);
  if (!treffer) { tip.classList.add('versteckt'); return; }
  let text = '';
  if (treffer.typ === 'op' || treffer.typ === 'nr-ende') {
    const f = opFinden(treffer.opId);
    if (f) {
      text = f.op.kw + ' (' + f.lage.id + ')';
      if (f.op.kw === 'NR') text += ' · a=' + fmtZahl(f.op.nr.a) + ' · i=' + f.op.nr.i;
      else if (f.op.poly && f.op.poly.length) {
        const t = opMaxTiefe(f.op);
        if (t) text += ' · t=' + fmtZahl(t);
      }
      if (f.op.auto) text += ' · AUTO';
    }
  } else if (treffer.typ === 'platte') {
    const f = platteFinden(treffer.plattenId);
    if (f) text = f.platte.kw + ' ' + (f.platte.name || '') + ' · ' + fmtZahl(f.platte.lx) + '×' + fmtZahl(f.platte.by) + '×' + fmtZahl(f.platte.hz);
  } else if (treffer.typ === 'beam') {
    const b = modell.beams.find(x => x.id === treffer.beamId);
    if (b) text = b.kw + ' ' + (b.name || '');
  }
  if (!text) { tip.classList.add('versteckt'); return; }
  tip.textContent = text;
  tip.classList.remove('versteckt');
  const wrap = document.getElementById('canvasWrapper').getBoundingClientRect();
  tip.style.left = (ev.clientX - wrap.left + 14) + 'px';
  tip.style.top = (ev.clientY - wrap.top + 14) + 'px';
}
function messPanelRendern() {
  const panel = document.getElementById('messPanel');
  const zeigen = modell && (ui.messungen.length > 0 || ui.werkzeug === 'messen');
  panel.classList.toggle('versteckt', !zeigen);
  if (!zeigen) return;
  if (!ui.messungen.length) {
    panel.innerHTML = '<b>📏 Messen</b><div class="mini-hinweis">1. Klick = Startpunkt (mit Fang), 2. Klick = Endpunkt.'
      + (ui.schnitt.aktiv ? '<br>Klicks im Schnittprofil messen entlang der Schnittlinie.' : '') + '</div>';
    return;
  }
  const zeilen = ui.messungen.map((mess, i) => {
    const dx = mess.b[0] - mess.a[0], dy = mess.b[1] - mess.a[1];
    return '<tr><td>' + (i + 1) + '</td><td>' + fmtZahl(Math.round(Math.hypot(dx, dy) * 10) / 10)
      + '</td><td>' + fmtZahl(Math.round(dx * 10) / 10) + '</td><td>' + fmtZahl(Math.round(dy * 10) / 10)
      + '</td><td><span style="cursor:pointer" data-mess-loeschen="' + i + '" title="Messung entfernen">✕</span></td></tr>';
  }).join('');
  panel.innerHTML = '<b>📏 Messungen</b> <span class="mini-hinweis" style="float:right;cursor:pointer" data-mess-alle="1">alle ✕</span>'
    + '<table><tr><th>#</th><th>L [mm]</th><th>Δx</th><th>Δy</th><th></th></tr>' + zeilen + '</table>';
}
function naechsterOpPunktFinden(weltP) {
  /* WP2: naechster Einzelpunkt (PP/KB-Punkt, MP-Zentrum) einer sichtbaren, nicht
     ausgeblendeten Op im Fangradius (Bildschirm-px, wie SNAP_FANGRADIUS_PX). Reine
     NR bleiben aussen vor — die haben ihr eigenes Anfassen (nr-ganz/nr-ende). */
  if (!modell) return null;
  let bester = null, besteDist = SNAP_FANGRADIUS_PX / ui.scale;
  for (const lage of modell.layers.filter(lagenSichtbar)) {
    for (const op of lage.ops) {
      if (op.kw === 'NR' || ui.opFilter[op.kw] === false) continue;
      for (const e of (op.poly || [])) {
        if (e.type !== 'PP' && e.type !== 'KB' && e.type !== 'MP') continue;
        const d = Geo.dist(weltP, [e.x, e.y]);
        if (d < besteDist) { besteDist = d; bester = { op, lage, punkt: e }; }
      }
    }
  }
  return bester;
}
function naechsteKanteFinden(welt, treffer) {
  const kandidaten = [];
  if (treffer.typ === 'platte') {
    const f = platteFinden(treffer.plattenId);
    if (f) kandidaten.push({ besitzer: 'platte', id: f.platte.id, pts: f.platte.outline });
  } else {
    const f = opFinden(treffer.opId);
    if (f && opHatKantenGeometrie(f.op)) kandidaten.push({ besitzer: 'op', id: f.op.id, pts: opPolyAlsArray(f.op) });
  }
  let beste = null, besteD = 15 / ui.scale;
  for (const k of kandidaten)
    for (let i = 0; i < k.pts.length - 1; i++) {
      const d = Geo.distPunktSegment(welt, k.pts[i], k.pts[i + 1]);
      if (d < besteD) { besteD = d; beste = { besitzer: k.besitzer, id: k.id, segIdx: i }; }
    }
  return beste;
}
function obersteSichtbareLageMitPlatten() {
  /* Ziel-Lage fuer neu erzeugte Bearbeitungen (NR/Kontur): oberste sichtbare Lage mit Platten */
  const sichtbare = modell.layers.filter(l => lagenSichtbar(l) && l.plates.length);
  if (!sichtbare.length) return null;
  sichtbare.sort((x, y) => y.num - x.num);
  return sichtbare[0];
}
/* WP3-P3 (Schicht-Auswahl): Ziel-Lagen fuer eine neu zu erzeugende Kontur/NR —
   headless testbar. Liefert die in ui.neuKonturLagen ausgewaehlten Lagen (nur
   solche, die im aktuellen Modell noch existieren — die Auswahl kann von
   einer vorherigen Datei stammen). Ist die Auswahl leer/ungueltig, faellt die
   Funktion auf das alte Einzel-Lage-Verhalten zurueck (obersteSichtbareLage-
   MitPlatten()), damit Erzeugen ohne vorherige Lagen-Wahl unveraendert bleibt. */
function zielLagenFuerNeu() {
  const ids = Array.isArray(ui.neuKonturLagen) ? ui.neuKonturLagen : [];
  const lagen = ids.map(id => modell.layers.find(l => l.id === id)).filter(Boolean);
  if (lagen.length) return lagen;
  return [obersteSichtbareLageMitPlatten()].filter(Boolean);
}
/* lage (optional): Ziel-Lage; ohne Angabe wie bisher obersteSichtbareLage-
   MitPlatten() (Rueckwaertskompatibel). WP3-P3: der Aufrufer in canvasPointer-
   Down iteriert bei mehreren gewaehlten Schichten selbst ueber zielLagenFuerNeu()
   und ruft diese Funktion je Lage auf. */
function neueNagelreiheErzeugen(a, b, lage) {
  lage = lage || obersteSichtbareLageMitPlatten();
  if (!lage) { hinweisAnzeigen('Keine sichtbare Lage fuer die Nagelreihe.', 'warnung'); return null; }
  aenderungBeginnen();
  const anker = lage.ops[lage.ops.length - 1];
  const op = {
    id: 'op' + (++opIdZaehler), kw: 'NR', headerParams: '',
    nr: { xa: Math.round(a[0]), ya: Math.round(a[1]), xe: Math.round(b[0]), ye: Math.round(b[1]),
      a: ui.nrLetzte.a, i: ui.nrLetzte.i },
    nbr: [], poly: [], closed: false, auto: false, lageId: lage.id,
    _off: anker && anker._off ? anker._off.slice() : [0, 0],  /* B-03: Anker-Block */
    _neu: true, _modified: true, _lineStart: -1, _lineEnd: -1, _opLine: null
  };
  lage.ops.push(op);
  opFilterSicherstellen('NR');
  alleNeuRendern();
  auswahlSetzen({ typ: 'op', id: op.id, lageId: lage.id });
  hinweisAnzeigen('Neue NR in ' + lage.id + ' (a=' + ui.nrLetzte.a + ', i=' + ui.nrLetzte.i + ') — Werte rechts anpassbar.', 'erfolg');
  return op;
}

