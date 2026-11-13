function nrIndexListeHtml() {
  /* Bekannte Geraete-Indizes als Vorschlagsliste — freie Zahleneingabe bleibt trotzdem moeglich */
  const idxBekannt = Object.keys(profil.nr_indizes || {});
  return '<datalist id="nrIndexListe">' + idxBekannt.map(i =>
    '<option value="' + i + '" label="' + i + ' — ' + escapeHtml(profil.nr_indizes[i].name || '') + '">')
    .join('') + '</datalist>';
}
function eigenschaftenMehrfachRendern(el, ops) {
  const gruppen = {};
  for (const f of ops) gruppen[f.op.kw] = (gruppen[f.op.kw] || 0) + 1;
  const teile = ['<div class="eig-kopf"><b>' + ops.length + ' Bearbeitungen ausgewaehlt</b> '
    + '<span class="mini-hinweis">(' + Object.entries(gruppen).map(([k, n]) => n + '× ' + k).join(', ') + ')</span></div>'
    + '<div class="mini-hinweis">Strg+Klick fuegt hinzu/entfernt. Aenderungen wirken auf alle passenden.</div>'];
  teile.push('<div class="karten-titel" style="font-size:0.72rem">Verschieben um</div>'
    + verschiebenBlockHtml('v-dx', 'v-dy', 'op-verschieben', 'Verschieben',
      'Verschiebt alle ' + ops.length + ' ausgewaehlten Bearbeitungen (jedes kw) um Δx/Δy.'));
  const nrs = ops.filter(f => f.op.kw === 'NR');
  const polys = ops.filter(f => opIstZerspanend(f.op));
  if (nrs.length) {
    teile.push('<div class="karten-titel" style="font-size:0.72rem">Nagelreihen (' + nrs.length + ')</div>'
      + '<div class="eig-zeile">' + eingabe('Abstand a', 'mehr-a', '', 70)
      + '<label class="eig-feld"><span>Geraet i</span><input type="number" class="eingabefeld eingabefeld-klein" '
      + 'data-feld="mehr-i" list="nrIndexListe" style="width:60px" value=""></label>' + nrIndexListeHtml()
      + '<button class="schaltflaeche schaltflaeche-klein" data-aktion="mehr-nr">Anwenden</button></div>'
      + '<div class="mini-hinweis">Leeres Feld = unveraendert.</div>');
  }
  if (polys.length >= 2 && polys.every(f2 => !f2.op.closed)) {
    teile.push('<div class="eig-zeile"><button class="schaltflaeche schaltflaeche-klein" data-aktion="mehr-verbinden" '
      + 'title="Offene Konturen, deren Enden aneinanderstossen, zu einer Bearbeitung zusammenfassen — danach greift Auto ⊕⊖ an den Innenecken">⛓ Konturen verbinden</button></div>');
  }
  if (polys.length) {
    teile.push('<div class="karten-titel" style="font-size:0.72rem">Saege-/Fraeskonturen (' + polys.length + ')</div>'
      + '<div class="eig-zeile">' + eingabe('Tiefe t', 'mehr-t', '', 70)
      + '<button class="schaltflaeche schaltflaeche-klein" data-aktion="mehr-t">Tiefe setzen</button></div>'
      + steuercodeEditorHtml(polys[0].op).replace('data-aktion="sc-anwenden"', 'data-aktion="mehr-sc"')
        .replace('Auf alle Punkte anwenden', 'Auf alle ' + polys.length + ' Konturen anwenden')
        .replace('Auf alle Punkte<', 'Auf alle ' + polys.length + ' Konturen<'));
  }
  teile.push('<div class="eig-zeile">'
    + '<button class="schaltflaeche schaltflaeche-klein schaltflaeche-gefahr" data-aktion="mehr-loeschen">🗑 Alle loeschen</button>'
    + '<button class="schaltflaeche schaltflaeche-klein" data-aktion="mehr-leeren">Auswahl aufheben</button></div>');
  el.innerHTML = teile.join('');
}

function eingabe(label, feld, wert, breite) {
  return '<label class="eig-feld"><span>' + label + '</span>'
    + '<input class="eingabefeld eingabefeld-klein" data-feld="' + feld + '" value="' + escapeHtml(String(wert)) + '"'
    + (breite ? ' style="width:' + breite + 'px"' : '') + '></label>';
}
/* WP-A: mm-genaues Verschieben per Zahlenfeld — gemeinsamer HTML-Baustein fuer
   "ganze Bearbeitung(en)" (mehrfachOps) und "markierter Einzelpunkt" (segMark).
   Feldnamen beginnen mit 'v-' (siehe Ausschluss in eigenschaftenWertUebernehmen
   und im keydown-Handler, analog zu 'kanteDelta'/'mehr-*'). */
function verschiebenBlockHtml(feldX, feldY, aktion, knopfText, hinweisText) {
  return '<div class="eig-zeile">' + eingabe('Δx [mm]', feldX, '0', 65) + eingabe('Δy [mm]', feldY, '0', 65)
    + '<button class="schaltflaeche schaltflaeche-klein" data-aktion="' + aktion + '">' + knopfText + '</button></div>'
    + (hinweisText ? '<div class="mini-hinweis">' + hinweisText + '</div>' : '');
}
function eigWertLesen(feld) {
  const inp = document.querySelector('#eigenschaften [data-feld="' + feld + '"]');
  const v = inp ? parseFloat(inp.value.replace(',', '.')) : NaN;
  return isNaN(v) ? 0 : v;
}
/* WP-A.1: verschiebt ALLE aktuell ausgewaehlten Ops (Einzel- wie Mehrfachauswahl,
   jedes kw inkl. NR/PSF/PSZ) um (dx, dy) — headless testbar. Rueckgabe = Anzahl
   verschobener Ops (0 = keine Auswahl oder kein Delta). */
function auswahlVerschiebenUm(dx, dy) {
  if (!dx && !dy) return 0;
  const ops = mehrfachOps();
  if (!ops.length) return 0;
  aenderungBeginnen();
  for (const f of ops) opGeometrieVerschieben(f.op, dx, dy);
  alleNeuRendern(true);
  return ops.length;
}
/* WP-A.2: verschiebt NUR den Punkt op.poly[punktIdx] um (dx, dy) — bei
   geschlossener Kontur (op.closed) wird der Duplikat-Schlusspunkt synchron
   gehalten (gleiches Muster wie in kantenGeometrieSetzen / 'op-punkt'-Drag).
   Headless testbar. Rueckgabe = true bei Erfolg. */
function punktVerschiebenUm(op, punktIdx, dx, dy) {
  const e = (op.poly || [])[punktIdx];
  if (!e || (!dx && !dy)) return false;
  aenderungBeginnen();
  e.x += dx; e.y += dy;
  if (e.type === 'PP' || e.type === 'KB') {
    const pts = op.poly.filter(p => p.type === 'PP' || p.type === 'KB');
    if (op.closed && pts.length >= 3) {
      if (e === pts[0]) { pts[pts.length - 1].x = e.x; pts[pts.length - 1].y = e.y; }
      if (e === pts[pts.length - 1]) { pts[0].x = e.x; pts[0].y = e.y; }
    }
  }
  op._modified = true;
  alleNeuRendern(true);
  return true;
}
/* Verschieben-Overlay (schwebend ueber der Ansicht) — Kanten-Verschiebung
   parallel / in X / in Y per mm-Eingabe. Nur im Werkzeug 'kante' sichtbar. */
function verschiebenOverlayRendern() {
  const ov = document.getElementById('verschiebenOverlay');
  if (!ov) return;
  if (!modell || ui.werkzeug !== 'kante') { ov.classList.add('versteckt'); return; }
  ov.classList.remove('versteckt');
  const r = ui.kanteRichtung || 'senkrecht';
  const aktiv = w => r === w ? ' aktiv' : '';
  const anzahl = ui.kanten.length;
  ov.innerHTML =
    '<div class="vo-titel">⇆ Verschieben</div>'
    + '<div class="vo-hinweis">Kante anklicken (Shift+Klick = kollineare dazu), '
    + 'dann Richtung + mm. Ziehen geht weiterhin direkt.</div>'
    + '<div class="vo-hinweis"><b>' + anzahl + '</b> Kante(n) gewaehlt</div>'
    + '<div class="vo-richtung">'
    + '<button data-kante-richtung="senkrecht" class="' + aktiv('senkrecht').trim() + '" title="Parallel-Versatz senkrecht zur Kante">⊥ parallel</button>'
    + '<button data-kante-richtung="x" class="' + aktiv('x').trim() + '" title="Nur in X-Richtung">→ X</button>'
    + '<button data-kante-richtung="y" class="' + aktiv('y').trim() + '" title="Nur in Y-Richtung">↑ Y</button>'
    + '</div>'
    + '<div class="vo-zeile">'
    + '<input type="number" step="0.5" class="eingabefeld eingabefeld-klein vo-delta" id="voDelta" value="0" '
    + (anzahl ? '' : 'disabled ') + 'title="Verschiebeweg in mm (Enter loest aus)">'
    + '<button class="schaltflaeche schaltflaeche-klein" data-aktion="vo-verschieben"' + (anzahl ? '' : ' disabled') + '>Verschieben</button>'
    + '</div>'
    + '<div class="vo-hinweis">' + (r === 'senkrecht'
        ? 'Vorzeichen: + = links der Kantenrichtung. Plattenkante zieht lx/by nach.'
        : 'Bewegt beide Kantenpunkte um den Betrag; angrenzende Segmente wandern mit.')
    + '</div>';
}
/* GUI-D: aufklappbarer Abschnitt im Eigenschaften-Panel. Der Auf/Zu-Zustand
   haelt sich je Schluessel ueber Neu-Renderings (ui._eigOffen). */
function eigAbschnittHtml(schluessel, titel, inhalt, offenStandard) {
  ui._eigOffen = ui._eigOffen || {};
  const offen = ui._eigOffen[schluessel] != null ? ui._eigOffen[schluessel] : !!offenStandard;
  return '<div class="eig-abschnitt">'
    + '<div class="eig-abschnitt-kopf" data-eig-abschnitt="' + schluessel + '">'
    + '<span>' + (offen ? '▾' : '▸') + '</span>' + titel + '</div>'
    + (offen ? '<div class="eig-abschnitt-inhalt">' + inhalt + '</div>' : '')
    + '</div>';
}
function eigenschaftenRendern() {
  const el = document.getElementById('eigenschaften');
  if (!modell) { el.innerHTML = '<span class="mini-hinweis">Keine Datei geladen.</span>'; return; }
  if (ui.werkzeug === 'kante') {
    el.innerHTML = '<div class="mini-hinweis"><b>Verschieben-Modus.</b><br>'
      + 'Bearbeitung/Kante/Punkt anfassen und ziehen (Punkt- und NR-Endpunkt-Fang aktiv, Shift = ortho).<br>'
      + 'Die mm-genaue Kanten-Verschiebung (parallel / X / Y) liegt jetzt im '
      + 'schwebenden Feld <b>⇆ Verschieben</b> oben rechts in der Ansicht.</div>';
    return;
  }
  if (ui.mehrAuswahl.length) {
    const ops = mehrfachOps();
    if (ops.length > 1) { eigenschaftenMehrfachRendern(el, ops); return; }
  }
  const f = auswahlAufloesen();
  if (!f) { el.innerHTML = '<span class="mini-hinweis">Nichts ausgewaehlt. Klick auf ein Element im Canvas oder im Text-Panel. Strg+Klick = Mehrfachauswahl.</span>'; return; }

  if (f.beam) {
    const b = f.beam;
    const gurt = b.kw === 'UG' || b.kw === 'OG';
    const bearbZeilen = (b.bearbeitungen || []).map((bb, i) => {
      const istMarkierBohrung = gurt && (bb.kw === 'BOZ'
        || (bb.kw === 'PAF' && bb.poly.length === 1 && bb.poly[0].type === 'MP'));
      const beschreibung = bb.kw === 'BOZ'
        ? 'BOZ d=' + fmtZahl(zahl(bb.params[2]) || 0) + ' bei ' + fmtZahl(zahl(bb.params[0]) || 0) + '/' + fmtZahl(zahl(bb.params[1]) || 0)
        : bb.kw + (bb.poly.length ? ' (' + bb.poly.length + ' Pkt)' : ' ' + escapeHtml((bb.params || []).slice(0, 4).join(',')));
      return '<div class="eig-zeile" style="margin:2px 0">'
        + '<span class="mini-hinweis" style="flex:1">' + beschreibung
        + (istMarkierBohrung ? ' <span title="Markierbohrung am Gurt — gehoert i.d.R. zum Datensatz">📌</span>' : '') + '</span>'
        + (bb.kw === 'BOZ' ? '<button class="schaltflaeche schaltflaeche-klein" data-boz-ersetzen="' + i
          + '" title="BOZ (abgekuendigt) durch PAF Ebene 2 + MP ersetzen — Achtung: d→r halbiert">→ PAF/MP</button>' : '')
        + '<button class="schaltflaeche schaltflaeche-klein schaltflaeche-gefahr" data-beam-bearb-loeschen="' + i
        + '" title="Bearbeitung aus dem Datensatz entfernen">✕</button></div>';
    }).join('');
    el.innerHTML = '<div class="eig-kopf">' + b.kw + ' <b>' + escapeHtml(b.name || '') + '</b></div>'
      + '<div class="mini-hinweis">Materialindex ' + b.materialIdx + ' · hz ' + fmtZahl(b.hz)
      + ' · z ' + fmtZahl(b.z) + (b.fromModule ? ' · aus MODUL' : '') + '</div>'
      + ((b.bearbeitungen || []).length
        ? '<div class="karten-titel" style="font-size:0.72rem;margin-top:6px">Bauteilbearbeitungen (' + b.bearbeitungen.length + ')</div>' + bearbZeilen
        : '<div class="mini-hinweis">Keine Bauteilbearbeitungen.</div>');
    return;
  }
  if (f.platte) {
    const p = f.platte, lage = f.lage;
    const klasse = materialKlasse(p.materialIdx);
    el.innerHTML = '<div class="eig-kopf">' + p.kw + ' <b>' + escapeHtml(p.name || '') + '</b>'
      + ' <span class="mini-hinweis">(' + lage.id + ')</span></div>'
      + '<div class="eig-zeile">' + eingabe('lx', 'lx', fmtZahl(p.lx)) + eingabe('by', 'by', fmtZahl(p.by))
      + eingabe('hz', 'hz', fmtZahl(p.hz)) + '</div>'
      + '<div class="eig-zeile">' + eingabe('x', 'x', fmtZahl(p.x)) + eingabe('y', 'y', fmtZahl(p.y))
      + eingabe('Mat-Idx', 'materialIdx', p.materialIdx, 70) + '</div>'
      + '<div class="mini-hinweis">Materialklasse: ' + (klasse ? klasse.name : 'unbekannt')
      + ' · Umriss: ' + (p.outlineSource === 'pp' ? p.outline.length + ' PP-Punkte' : 'aus Kopfdaten (Rechteck)') + '</div>'
      + '<div class="eig-zeile"><button class="schaltflaeche schaltflaeche-klein" data-aktion="platte-uebernehmen">Uebernehmen</button></div>';
    return;
  }

  const op = f.op, lage = f.lage;
  const teile = [];
  teile.push('<div class="eig-kopf"><b>' + op.kw + '</b> <span class="mini-hinweis">(' + lage.id + ')</span>'
    + (op.auto ? ' <span class="abzeichen-auto">AUTO</span>' : '') + '</div>');
  if (op.txtKommentar) teile.push('<div class="mini-hinweis">TXT: ' + escapeHtml(op.txtKommentar) + '</div>');

  if (op.kw === 'NR') {
    teile.push('<div class="eig-zeile">' + eingabe('xa', 'xa', fmtZahl(op.nr.xa)) + eingabe('ya', 'ya', fmtZahl(op.nr.ya)) + '</div>');
    teile.push('<div class="eig-zeile">' + eingabe('xe', 'xe', fmtZahl(op.nr.xe)) + eingabe('ye', 'ye', fmtZahl(op.nr.ye)) + '</div>');
    teile.push('<div class="eig-zeile">' + eingabe('Abstand a', 'a', fmtZahl(op.nr.a), 70)
      + '<label class="eig-feld"><span>Geraet i</span><input type="number" class="eingabefeld eingabefeld-klein" '
      + 'data-feld="i" list="nrIndexListe" value="' + escapeHtml(String(op.nr.i)) + '"></label>'
      + nrIndexListeHtml() + '</div>');
    const laenge = Math.hypot(op.nr.xe - op.nr.xa, op.nr.ye - op.nr.ya);
    teile.push('<div class="mini-hinweis">Laenge ' + fmtZahl(laenge) + ' mm · '
      + nagelPunkte(op).length + ' Befestigungspunkte'
      + ((op.nbr || []).length ? ' · ' + op.nbr.length + '× NBR-Versatz' : '') + '</div>');
    teile.push(eigAbschnittHtml('verschieben', 'Verschieben um',
      verschiebenBlockHtml('v-dx', 'v-dy', 'op-verschieben', 'Verschieben', ''), false));
    teile.push('<div class="eig-zeile">'
      + '<button class="schaltflaeche schaltflaeche-klein" data-aktion="nr-umkehren">⇄ Umkehren</button>'
      + '<button class="schaltflaeche schaltflaeche-klein" data-aktion="op-duplizieren">⧉ Duplizieren</button>'
      + '<button class="schaltflaeche schaltflaeche-klein schaltflaeche-gefahr" data-aktion="op-loeschen">🗑 Loeschen</button></div>');
  } else {
    /* Polygon-Bearbeitung: Punktetabelle + Steuercode-Klartext */
    const pts = (op.poly || []);
    if (op.headerParams) teile.push('<div class="mini-hinweis">Kopf: ' + escapeHtml(op.headerParams) + '</div>');
    if (pts.length) {
      const zerspanend = opIstZerspanend(op);
      /* GUI-I (Anwenderfund "ich sehe nicht alles"): SCHMALE Tabelle, die
         ohne Querscrollen ins Panel passt — r-Spalte nur wenn Kreisboegen
         vorhanden, Steuercode als EINE Zahlenspalte; die vier
         Stellen-Dropdowns erscheinen als Detail-Zeile unter dem
         MARKIERTEN Punkt (Zeile anklicken). */
      const hatRadius = pts.some(e => e.type === 'KB' || e.type === 'MP');
      const spalten = 6 + (hatRadius ? 1 : 0);
      const zeilen = pts.map((e, idx) => {
        const markiert = segIstMarkiert(op.id, idx);
        const istAnker = ui.segMark && ui.segMark.opId === op.id && ui.segMark.idx === idx;
        const zelle = (feld, wert, extra) => '<td><input class="eingabefeld eingabefeld-zelle" data-feld="' + feld
          + '" data-idx="' + idx + '" value="' + wert + '"' + (extra || '') + '></td>';
        const rZelle = hatRadius
          ? ((e.type === 'KB' || e.type === 'MP')
            ? zelle('r', fmtZahl(e.r), e.type === 'MP' ? ' title="Radius (neg. = CCW)"' : '')
            : '<td>—</td>')
          : '';
        const basis = '<tr data-idx="' + idx + '" data-seg="' + idx + '"'
          + (markiert ? ' class="seg-markiert"' : '') + '>'
          + '<td>' + (e.type === 'MP' ? 'MP' : e.type + (e.type === 'KB' ? '·' + (e.typ || '') : '')) + '</td>'
          + zelle('x', fmtZahl(e.x)) + zelle('y', fmtZahl(e.y))
          + rZelle
          + zelle('t', fmtZahl(e.t ?? 0))
          + zelle('i', e.i ?? 0, ' title="' + escapeHtml(steuercodeWorte(e.i ?? 0, op.kw)) + '"')
          + '<td><span style="cursor:pointer" data-punkt-loeschen="' + idx
          + '" title="Punkt/Linie entfernen (I-02)">✕</span></td></tr>';
        return basis + (istAnker && zerspanend
          ? '<tr class="sc-detail"><td colspan="' + spalten + '">' + scMiniReihe(op, e, idx) + '</td></tr>'
          : '');
      }).join('');
      const codes = [...new Set(pts.map(e => e.i ?? 0))];
      /* GUI-D: Punkte-Tabelle als Abschnitt (offen) — inkl. Steuercode-Klartext */
      teile.push(eigAbschnittHtml('punkte', 'Punkte (' + pts.length + ')',
        '<div class="mini-hinweis">Zeile anklicken = Linie markieren'
        + (zerspanend ? ' + Steuercode-Stellen einblenden' : '')
        + ' · Strg/Shift+Klick = mehrere Punkte, Wert-Aenderung wirkt auf alle markierten (I-02).</div>'
        + '<div class="eig-tabelle-wrap"><table class="eig-tabelle"><thead><tr>'
        + '<th>Typ</th><th>x</th><th>y</th>' + (hatRadius ? '<th>r</th>' : '') + '<th>t</th>'
        + '<th title="Steuercode i — Zeile anklicken zeigt die Stellen-Dropdowns">i</th>'
        + '<th></th></tr></thead><tbody>'
        + zeilen + '</tbody></table></div>'
        + '<div class="mini-hinweis">' + codes.map(c => c + ' = ' + escapeHtml(steuercodeWorte(c, op.kw))).join('<br>') + '</div>',
        true));
    }
    if (opIstZerspanend(op)) {
      const tMax = opMaxTiefe(op) || 0;
      const hz = lage.hz || 0;
      let bezug;
      if (Math.abs(tMax - hz) < 0.05) bezug = '= Lagendicke (durchgehend)';
      else if (tMax < hz) bezug = hz ? (Math.round((hz - tMax) * 10) / 10) + ' mm Restdicke bleibt stehen' : '';
      else bezug = '⚠ ' + (Math.round((tMax - hz) * 10) / 10) + ' mm tiefer als die Lage — schneidet in die naechste!';
      const vMp = profil.freistich.variante !== 'klassisch';
      teile.push(eigAbschnittHtml('tiefe', 'Tiefe & Korrekturen',
        '<div class="eig-zeile"><span class="mini-hinweis">t<sub>max</sub> ' + fmtZahl(tMax)
        + ' bei hz ' + fmtZahl(hz) + ' → ' + bezug + '</span></div>'
        + '<div class="eig-zeile">'
        + '<button class="schaltflaeche schaltflaeche-klein" data-aktion="t-hz" title="Tiefe aller Punkte = Lagendicke">t = hz (' + fmtZahl(hz) + ')</button>'
        + '<button class="schaltflaeche schaltflaeche-klein" data-aktion="t-hz1" title="Luftdicht-Regel: 1 mm Restdicke">t = hz−1 (' + fmtZahl(Math.max(0, hz - 1)) + ')</button></div>'
        + '<div class="eig-zeile"><label class="eig-feld" style="flex:1"><span>Freistich-Variante</span>'
        + '<select class="eingabefeld eingabefeld-klein" data-aktion="freistich-variante">'
        + '<option value="mp"' + (vMp ? ' selected' : '') + '>Rundfraesung (MP)</option>'
        + '<option value="klassisch"' + (!vMp ? ' selected' : '') + '>Klassisch (PAF-Polyzug)</option>'
        + '</select></label></div>'
        + '<div class="eig-zeile">'
        + '<button class="schaltflaeche schaltflaeche-klein" data-aktion="op-f1" title="Ueber-/Unterschnitt fuer diese Kontur automatisch setzen">Auto ⊕⊖</button>'
        + '<button class="schaltflaeche schaltflaeche-klein" data-aktion="op-f2" title="Freistiche an unterschnittenen Innenecken einfuegen">Freistiche</button>'
        + '<button class="schaltflaeche schaltflaeche-klein" data-aktion="op-f3" title="Sperrflaechen in darunterliegenden Lagen erzeugen">PSF darunter</button></div>',
        false));
    }
    if (opIstZerspanend(op) || op.kw === 'PSF' || op.kw === 'PML')
      teile.push(eigAbschnittHtml('steuercode', 'Steuercode ändern', steuercodeEditorHtml(op), false));
    /* Verschieben als Abschnitt — bei markiertem Punkt automatisch offen */
    let verschieben = verschiebenBlockHtml('v-dx', 'v-dy', 'op-verschieben', 'Verschieben', '');
    const punktMarkiert = ui.segMark && ui.segMark.opId === op.id && pts[ui.segMark.idx];
    if (punktMarkiert)
      verschieben += '<div class="karten-titel" style="font-size:0.72rem">Markierter Punkt (' + ui.segMark.idx + ') verschieben um</div>'
        + verschiebenBlockHtml('v-pdx', 'v-pdy', 'punkt-verschieben', 'Punkt verschieben', '');
    teile.push(eigAbschnittHtml('verschieben', 'Verschieben um', verschieben, !!punktMarkiert));
    teile.push('<div class="eig-zeile">'
      + '<button class="schaltflaeche schaltflaeche-klein" data-aktion="op-hoch" title="Bearbeitung in der Maschinen-Reihenfolge eins nach vorne (Alt+↑)">↑ frueher</button>'
      + '<button class="schaltflaeche schaltflaeche-klein" data-aktion="op-runter" title="Bearbeitung in der Maschinen-Reihenfolge eins nach hinten (Alt+↓)">↓ spaeter</button>'
      + '<button class="schaltflaeche schaltflaeche-klein" data-aktion="op-duplizieren">⧉ Duplizieren</button>'
      + '<button class="schaltflaeche schaltflaeche-klein schaltflaeche-gefahr" data-aktion="op-loeschen">🗑 Loeschen</button></div>');
  }
  el.innerHTML = teile.join('');
}

function eigenschaftenAktion(aktion, ziel) {
  /* Mehrfach-Aktionen */
  if (aktion.startsWith('mehr-')) {
    const ops = mehrfachOps();
    const lese = feld => {
      const inp = document.querySelector('#eigenschaften [data-feld="' + feld + '"]');
      const v = inp ? parseFloat(inp.value.replace(',', '.')) : NaN;
      return isNaN(v) ? null : v;
    };
    if (aktion === 'mehr-leeren') { ui.mehrAuswahl = []; auswahlSetzen(null); return; }
    if (aktion === 'mehr-loeschen') {
      bestaetigen(ops.length + ' Bearbeitungen wirklich loeschen?', 'Loeschen', () => {
        aenderungBeginnen();
        for (const f2 of ops) {
          if (!f2.op._neu && f2.op._lineStart >= 0) {
            f2.lage._geloeschteOps = f2.lage._geloeschteOps || [];
            f2.lage._geloeschteOps.push({ _lineStart: f2.op._lineStart, _lineEnd: f2.op._lineEnd });
          }
          const idx = f2.lage.ops.indexOf(f2.op);
          if (idx >= 0) f2.lage.ops.splice(idx, 1);
        }
        ui.mehrAuswahl = []; ui.auswahl = null;
        alleNeuRendern();
        hinweisAnzeigen(ops.length + ' Bearbeitungen geloescht.', 'erfolg');
      });
      return;
    }
    if (aktion === 'mehr-nr') {
      const a = lese('mehr-a'), iInp = document.querySelector('#eigenschaften [data-feld="mehr-i"]');
      const i = iInp && iInp.value.trim() !== '' ? parseInt(iInp.value, 10) : null;
      let n = 0;
      aenderungBeginnen();
      for (const f2 of ops) if (f2.op.kw === 'NR') {
        if (a != null) f2.op.nr.a = a;
        if (i != null) f2.op.nr.i = i;
        f2.op._modified = true; n++;
      }
      alleNeuRendern(true);
      hinweisAnzeigen(n + ' Nagelreihen aktualisiert.', 'erfolg');
      return;
    }
    if (aktion === 'mehr-t') {
      const t = lese('mehr-t');
      if (t == null) { hinweisAnzeigen('Bitte Tiefe angeben.', 'warnung'); return; }
      let n = 0;
      aenderungBeginnen();
      for (const f2 of ops) if (opIstZerspanend(f2.op)) {
        for (const e of (f2.op.poly || [])) if (e.t != null) e.t = t;
        f2.op._modified = true; n++;
      }
      alleNeuRendern(true);
      hinweisAnzeigen('Tiefe t=' + t + ' auf ' + n + ' Konturen gesetzt.', 'erfolg');
      return;
    }
    if (aktion === 'mehr-verbinden') {
      konturenVerbinden(ops.filter(f2 => opIstZerspanend(f2.op) && !f2.op.closed));
      return;
    }
    if (aktion === 'mehr-sc') {
      const code = scAusDropdownsLesen();
      let n = 0;
      aenderungBeginnen();
      for (const f2 of ops) if (opIstZerspanend(f2.op) || f2.op.kw === 'PSF' || f2.op.kw === 'PML') {
        scAufOpAnwenden(f2.op, code); n++;
      }
      alleNeuRendern(true);
      hinweisAnzeigen('Steuercode ' + code + ' (' + steuercodeWorte(code, 'PAF') + ') auf ' + n + ' Bearbeitungen angewendet.', 'erfolg');
      return;
    }
    return;
  }
  const f = auswahlAufloesen();
  if (aktion === 'kante-anwenden') {
    const eingabeEl = document.querySelector('#eigenschaften [data-feld="kanteDelta"]');
    const delta = parseFloat(eingabeEl ? eingabeEl.value.replace(',', '.') : '0');
    if (!isNaN(delta) && delta !== 0) kanteVerschieben(delta);
    return;
  }
  if (aktion === 'op-verschieben') {
    const dx = eigWertLesen('v-dx'), dy = eigWertLesen('v-dy');
    if (!dx && !dy) { hinweisAnzeigen('Bitte Δx oder Δy angeben.', 'warnung'); return; }
    const n = auswahlVerschiebenUm(dx, dy);
    if (n) hinweisAnzeigen(n + ' Bearbeitung(en) um Δx=' + dx + ' / Δy=' + dy + ' mm verschoben.', 'erfolg');
    return;
  }
  if (aktion === 'punkt-verschieben') {
    const dx = eigWertLesen('v-pdx'), dy = eigWertLesen('v-pdy');
    if (!dx && !dy) { hinweisAnzeigen('Bitte Δx oder Δy angeben.', 'warnung'); return; }
    if (!ui.segMark) return;
    const zf = opFinden(ui.segMark.opId);
    if (!zf) return;
    const ok = punktVerschiebenUm(zf.op, ui.segMark.idx, dx, dy);
    if (ok) hinweisAnzeigen('Punkt um Δx=' + dx + ' / Δy=' + dy + ' mm verschoben.', 'erfolg');
    return;
  }
  if (!f) return;
  if (aktion === 'platte-uebernehmen' && f.platte) {
    aenderungBeginnen();
    const lies = feld => {
      const inp = document.querySelector('#eigenschaften [data-feld="' + feld + '"]');
      return inp ? parseFloat(inp.value.replace(',', '.')) : NaN;
    };
    for (const feld of ['lx', 'by', 'hz', 'x', 'y']) {
      const v = lies(feld); if (!isNaN(v)) f.platte[feld] = v;
    }
    const mi = lies('materialIdx'); if (!isNaN(mi)) f.platte.materialIdx = Math.round(mi);
    if (f.platte.outlineSource === 'header') {
      f.platte.outline = [[f.platte.x, f.platte.y], [f.platte.x + f.platte.lx, f.platte.y],
        [f.platte.x + f.platte.lx, f.platte.y + f.platte.by], [f.platte.x, f.platte.y + f.platte.by],
        [f.platte.x, f.platte.y]];
    }
    f.platte._modified = true;
    alleNeuRendern(true);
    hinweisAnzeigen('Platte aktualisiert.', 'erfolg');
    return;
  }
  if (!f.op) return;
  const op = f.op, lage = f.lage;
  if (aktion === 't-hz' || aktion === 't-hz1') {
    const ziel = aktion === 't-hz' ? (lage.hz || 0) : Math.max(0, (lage.hz || 0) - 1);
    aenderungBeginnen();
    for (const e of (op.poly || [])) if (e.t != null) e.t = ziel;
    op._modified = true;
    alleNeuRendern(true);
    hinweisAnzeigen('Tiefe aller Punkte auf ' + fmtZahl(ziel) + ' mm gesetzt.', 'erfolg');
    return;
  }
  if (aktion === 'sc-anwenden') {
    const code = scAusDropdownsLesen();
    aenderungBeginnen();
    scAufOpAnwenden(op, code);
    alleNeuRendern(true);
    hinweisAnzeigen('Steuercode ' + code + ' auf alle Punkte gesetzt: ' + steuercodeWorte(code, op.kw), 'erfolg');
    return;
  }
  if (aktion === 'nr-umkehren') {
    aenderungBeginnen();
    const n = op.nr;
    [n.xa, n.xe] = [n.xe, n.xa]; [n.ya, n.ye] = [n.ye, n.ya];
    op._modified = true;
    alleNeuRendern(true);
    return;
  }
  if (aktion === 'op-duplizieren') {
    aenderungBeginnen();
    const kopie = structuredClone(op);
    kopie.id = 'op' + (++opIdZaehler);
    kopie._neu = true; kopie._modified = true;
    kopie._lineStart = -1; kopie._lineEnd = -1; kopie._opLine = null;
    if (kopie.nr) { kopie.nr.ya += 50; kopie.nr.ye += 50; }
    else for (const e of (kopie.poly || [])) { e.y += 50; }
    lage.ops.splice(lage.ops.indexOf(op) + 1, 0, kopie);
    alleNeuRendern();
    auswahlSetzen({ typ: 'op', id: kopie.id, lageId: lage.id });
    hinweisAnzeigen('Bearbeitung dupliziert (+50 mm in y).', 'erfolg');
    return;
  }
  if (aktion === 'op-loeschen') {
    bestaetigen(op.kw + ' wirklich loeschen?', 'Loeschen', () => {
      aenderungBeginnen();
      if (!op._neu && op._lineStart >= 0) {
        lage._geloeschteOps = lage._geloeschteOps || [];
        lage._geloeschteOps.push({ _lineStart: op._lineStart, _lineEnd: op._lineEnd });
      }
      lage.ops.splice(lage.ops.indexOf(op), 1);
      ui.auswahl = null;
      alleNeuRendern();
      hinweisAnzeigen(op.kw + ' geloescht.', 'erfolg');
    });
    return;
  }
  if (aktion === 'op-hoch' || aktion === 'op-runter') {
    opVerschieben(op, lage, aktion === 'op-hoch' ? -1 : +1);
    return;
  }
  if (aktion === 'op-f1') {
    const a = f1Analysieren(op);
    if (a.problem) { hinweisAnzeigen('Nicht automatisierbar: ' + a.problem, 'warnung'); return; }
    if (!a.aenderungen.length) { hinweisAnzeigen('Schnittcodes sind bereits korrekt.', 'info'); return; }
    aenderungBeginnen();
    f1Anwenden(op, a);
    alleNeuRendern(true);
    hinweisAnzeigen(a.aenderungen.length + ' Steuercode(s) angepasst.', 'erfolg');
    return;
  }
  if (aktion === 'op-f2') {
    const r = lagenMaterialAbrasiv(lage) ? profil.freistich.radius_abrasiv : profil.freistich.radius_holz;
    let anzahl = 0, gekuerzt = 0;
    aenderungBeginnen();
    for (const ecke of f2InneneckenFinden(op, true, lage))
      if (!f2FreistichVorhanden(lage, ecke, r, op)) {
        if (f2FreistichErzeugen(lage, op, ecke)._schenkelGekuerzt) gekuerzt++;
        anzahl++;
      }
    if (!anzahl) { undoStack.pop(); undoRedoKnoepfe(); }
    alleNeuRendern(true);
    hinweisAnzeigen(anzahl ? anzahl + ' Freistich(e) eingefuegt.'
        + (gekuerzt ? ' ' + gekuerzt + ' mit gekuerzten Schenkeln (kurze Kante) — bitte pruefen.' : '')
      : 'Keine unterschnittene Innenecke ohne Freistich.', anzahl ? (gekuerzt ? 'warnung' : 'erfolg') : 'info');
    return;
  }
  if (aktion === 'op-f3') { f3AutoPsf(op); return; }
}

function scMiniUebernehmen(select) {
  const f = auswahlAufloesen();
  if (!f || !f.op) return;
  const idx = parseInt(select.dataset.scidx, 10);
  if (!f.op.poly[idx]) return;
  /* Feedback M2 (Anwenderfund "gleichzeitiges Aendern nicht moeglich"):
     gehoert der Punkt zur Punkt-Mehrfachauswahl, wird die geaenderte
     STELLE auf ALLEN markierten Punkten gesetzt — jeder Punkt behaelt
     seine uebrigen Stellen (kein Kopieren des ganzen Codes). */
  const ziele = segIstMarkiert(f.op.id, idx)
    ? [...new Set([ui.segMark.idx,
        ...(ui.segMarkMehr && ui.segMarkMehr.opId === f.op.id ? ui.segMarkMehr.idxs : [])])]
    : [idx];
  const wert = parseInt(select.value, 10) || 0;
  aenderungBeginnen();
  let anzahl = 0;
  for (const k of ziele) {
    const e = f.op.poly[k];
    if (!e || (e.type !== 'PP' && e.type !== 'KB' && e.type !== 'MP')) continue;
    const t = steuercodeZerlegen(e.i ?? 0);
    t[select.dataset.scteil] = wert;
    e.i = steuercodeBauen(t);
    anzahl++;
  }
  f.op._modified = true;
  alleNeuRendern(true);
  if (anzahl > 1) hinweisAnzeigen('Steuercode-Stelle auf ' + anzahl + ' markierten Punkten gesetzt.', 'erfolg');
}
function punktLoeschen(idx) {
  const f = auswahlAufloesen();
  if (!f || !f.op || !f.op.poly) return;
  const op = f.op;
  if (op.poly.length <= 2) { hinweisAnzeigen('Eine Kontur braucht mindestens 2 Punkte — stattdessen die ganze Bearbeitung loeschen.', 'warnung'); return; }
  aenderungBeginnen();
  op.poly.splice(idx, 1);
  /* geschlossene Kontur synchron halten */
  if (op.closed && op.poly.length >= 2) {
    const a = op.poly[0], z2 = op.poly[op.poly.length - 1];
    if (a.type === 'PP' && z2.type === 'PP' && (a.x !== z2.x || a.y !== z2.y)) {
      if (idx === 0) { op.poly[op.poly.length - 1] = Object.assign({}, z2, { x: a.x, y: a.y }); }
      else if (idx === op.poly.length) { op.poly[op.poly.length - 1] = Object.assign({}, op.poly[op.poly.length - 1], { x: a.x, y: a.y }); }
    }
  }
  ui.segMark = null;
  op._modified = true;
  alleNeuRendern(true);
  hinweisAnzeigen('Punkt entfernt.', 'erfolg');
}
