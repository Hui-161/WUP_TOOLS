/* =====================================================================
   §17 KONTEXTMENUE (Rechtsklick, global)
   ===================================================================== */
function kontextmenueSchliessen() {
  document.getElementById('kontextmenue').classList.add('versteckt');
}
function kontextmenueOeffnen(x, y, kopf, eintraege) {
  const km = document.getElementById('kontextmenue');
  const teile = kopf ? ['<div class="km-kopf">' + escapeHtml(kopf) + '</div>'] : [];
  km._aktionen = {};
  eintraege.forEach((e, i) => {
    if (e.trenner) { teile.push('<div class="km-trenner"></div>'); return; }
    if (e.html) { teile.push(e.html); return; }   /* GUI-C: rohes Formular-Markup */
    const id = 'km' + i;
    if (e.aktion && !e.aus) km._aktionen[id] = e.aktion;
    teile.push('<div class="km-eintrag' + (e.gefahr ? ' gefahr' : '') + (e.aus ? ' deaktiviert' : '')
      + '" data-km="' + id + '"><span class="km-icon">' + (e.icon || '') + '</span>'
      + escapeHtml(e.text) + (e.kuerzel ? '<span class="km-kuerzel">' + e.kuerzel + '</span>' : '') + '</div>');
  });
  km.innerHTML = teile.join('');
  km.classList.remove('versteckt');
  /* Position, am Viewport-Rand einklappen */
  const r = km.getBoundingClientRect();
  const px = Math.min(x, window.innerWidth - r.width - 6);
  const py = Math.min(y, window.innerHeight - r.height - 6);
  km.style.left = Math.max(4, px) + 'px';
  km.style.top = Math.max(4, py) + 'px';
}
function kontextAllgemein() {
  /* immer verfuegbare Aktionen am Ende jedes Menues */
  return [
    { trenner: true },
    { icon: '↶', text: 'Rueckgaengig', kuerzel: 'Alt+Z', aus: !undoStack.length, aktion: rueckgaengig },
    { icon: '↷', text: 'Wiederholen', kuerzel: 'Alt+Y', aus: !redoStack.length, aktion: wiederholen },
    { trenner: true },
    { icon: '⊡', text: 'Ansicht einpassen', aktion: () => { zoomEinpassen(); svgRendern(); } },
    { icon: '🔁', text: 'Werte ersetzen…', kuerzel: 'Strg+H', aktion: werteErsetzenOeffnen },
    { icon: '💾', text: 'WUP exportieren', kuerzel: 'Alt+E', aktion: wupExportieren }
  ];
}
/* GUI-C (Anwenderwunsch): die wichtigsten Eigenschaften der angeklickten
   Bearbeitung DIREKT im Kontextmenue editierbar — NR: Geraeteindex/Abstand,
   Konturen: Steuercode/Tiefe (fuer alle Punkte der Kontur). Bei aktiver
   Mehrfachauswahl wirkt die Aenderung auf ALLE ausgewaehlten Bearbeitungen. */
function kmEigenschaftenFelder(op, anzahl) {
  const felder = [];
  const feld = (feld, label, wert, extra) => felder.push('<label class="km-feld"><span>' + label
    + (anzahl > 1 ? ' <b>(' + anzahl + ' gemeinsam)</b>' : '') + '</span>'
    + '<input class="eingabefeld eingabefeld-klein" data-km-feld="' + feld + '" value="'
    + escapeHtml(String(wert)) + '"' + (extra || '') + '></label>');
  if (op.kw === 'NR') {
    feld('i', 'Geraeteindex i', op.nr.i, ' list="nrIndexListe"');
    feld('a', 'Abstand a [mm]', fmtZahl(op.nr.a));
  } else if (op.kw !== 'PSF' && op.kw !== 'PSZ') {
    const p = (op.poly || []).find(e => e.type === 'PP' || e.type === 'KB' || e.type === 'MP');
    if (p) {
      feld('i', 'Steuercode i (alle Punkte)', p.i == null ? 0 : p.i,
        ' title="' + escapeHtml(typeof steuercodeWorte === 'function' ? steuercodeWorte(p.i || 0) : '') + '"');
      feld('t', 'Tiefe t [mm] (alle Punkte)', fmtZahl(p.t == null ? 0 : p.t));
    }
  }
  if (!felder.length) return null;
  return { html: '<div class="km-form">' + felder.join('') + '</div>' + nrIndexListeHtml() };
}
function kmEigenschaftUebernehmen(input) {
  const f = auswahlAufloesen();
  if (!f || !f.op) return;
  /* doppelte change-Events (z.B. Fokuswechsel nach programmatischem Setzen)
     erzeugen sonst Leer-Undo-Schritte — nur bei echtem neuen Wert arbeiten */
  if (input._kmLetzter === input.value) return;
  input._kmLetzter = input.value;
  const feld = input.dataset.kmFeld;
  const wert = feld === 'i' ? parseInt(input.value, 10) : parseFloat(input.value.replace(',', '.'));
  if (isNaN(wert)) { hinweisAnzeigen('Ungueltiger Wert.', 'warnung'); return; }
  const ziele = opInMehrfachauswahl(f.op.id) ? mehrfachOps().map(g => g.op) : [f.op];
  aenderungBeginnen();
  let treffer = 0;
  for (const op of ziele) {
    if (op.kw === 'NR') {
      if (feld === 'i' || feld === 'a') { op.nr[feld] = wert; op._modified = true; treffer++; }
    } else if (op.kw !== 'PSF' && op.kw !== 'PSZ' && (feld === 'i' || feld === 't')) {
      for (const e of (op.poly || []))
        if (e.type === 'PP' || e.type === 'KB' || e.type === 'MP') e[feld] = wert;
      op._modified = true; treffer++;
    }
  }
  alleNeuRendern(true);
  hinweisAnzeigen(treffer + ' Bearbeitung(en): ' + (feld === 'i' ? 'Index/Steuercode' : feld === 'a' ? 'Abstand' : 'Tiefe')
    + ' → ' + wert + '.', 'erfolg');
}
function kontextFuerOp(f) {
  const op = f.op, lage = f.lage;
  const mehr = opInMehrfachauswahl(op.id);
  const anzahl = mehr ? mehrfachOps().length : 1;
  const eintraege = [];
  const form = kmEigenschaftenFelder(op, mehr ? anzahl : 1);
  if (form) eintraege.push(form);
  eintraege.push({ icon: '🎯', text: 'Auf Element zoomen', aktion: () => opZoomen(op) });
  if (op.kw === 'NR') {
    eintraege.push({ icon: '⇄', text: 'Richtung umkehren', aktion: () => eigenschaftenAktion('nr-umkehren') });
  }
  if (opIstZerspanend(op)) {
    eintraege.push({ icon: '⊕', text: 'Auto Ueber-/Unterschnitt', aktion: () => eigenschaftenAktion('op-f1') });
    eintraege.push({ icon: '◷', text: 'Freistiche einfuegen', aktion: () => eigenschaftenAktion('op-f2') });
    eintraege.push({ icon: '▦', text: 'Sperrflaechen darunter', aktion: () => eigenschaftenAktion('op-f3') });
  }
  eintraege.push({ trenner: true });
  eintraege.push({ icon: '⧉', text: 'Duplizieren', aktion: () => eigenschaftenAktion('op-duplizieren') });
  if (mehr && anzahl > 1) {
    eintraege.push({ icon: '☑', text: anzahl + ' gemeinsam loeschen', gefahr: true,
      aktion: () => eigenschaftenAktion('mehr-loeschen') });
  } else {
    eintraege.push({ icon: '🗑', text: 'Loeschen', kuerzel: 'Entf', gefahr: true,
      aktion: () => eigenschaftenAktion('op-loeschen') });
  }
  return { kopf: (mehr && anzahl > 1 ? anzahl + ' Bearbeitungen' : op.kw + ' · ' + lage.id), eintraege };
}
function kontextFuerPlatte(f) {
  return { kopf: f.platte.kw + ' · ' + f.lage.id, eintraege: [
    { icon: '🎯', text: 'Auf Platte zoomen', aktion: () => { /* grobes Zoom ueber bbox */
      const op = { nr: null, poly: f.platte.outline.map(p => ({ x: p[0], y: p[1], type: 'PP' })) };
      opZoomen(op); } },
    { icon: '👁', text: (f.lage.sichtbar ? 'Lage ausblenden' : 'Lage einblenden'),
      aktion: () => { f.lage.sichtbar = !f.lage.sichtbar; lagenNeuZeichnen(); } }
  ]};
}
function kontextFuerBeam(beam) {
  const eintraege = [];
  (beam.bearbeitungen || []).forEach((bb, i) => {
    if (bb.kw === 'BOZ')
      eintraege.push({ icon: '→', text: 'BOZ #' + (i + 1) + ' → PAF/MP', aktion: () => beamBozErsetzen(i) });
  });
  if (eintraege.length) eintraege.push({ trenner: true });
  eintraege.push({ icon: 'ℹ', text: (beam.bearbeitungen || []).length + ' Bauteilbearbeitung(en)', aus: true });
  return { kopf: beam.kw + ' ' + (beam.name || ''), eintraege };
}
/* GUI-J (Anwenderwunsch): Rechtsklick auf einen LAGEN-CHIP — kleines Menue
   mit Material-Info, Anzahl Bearbeitungen, Solo, Ein/Aus und NR-Auswahl. */
function kontextFuerLagenChip(lage) {
  const p0 = lage.plates[0];
  const klasse = p0 ? materialKlasse(p0.materialIdx) : null;
  const nrs = lage.ops.filter(o => o.kw === 'NR').length;
  const arten = {};
  for (const o of lage.ops) arten[o.kw] = (arten[o.kw] || 0) + 1;
  const eintraege = [
    { icon: 'ℹ', aus: true, text: p0
      ? (p0.name || '(ohne Name)') + ' · Index ' + p0.materialIdx + (klasse ? ' (' + klasse.name + ')' : '')
      : 'Keine Platten' },
    { icon: '·', aus: true, text: lage.plates.length + ' Platten · hz ' + fmtZahl(lage.hz) + ' · '
      + (Object.entries(arten).map(([k, n]) => n + '×' + k).join(', ') || 'keine Bearbeitungen') },
    { trenner: true },
    { icon: '👁', text: lage.sichtbar ? 'Ausblenden' : 'Einblenden', aktion: () => {
      lage.sichtbar = !lage.sichtbar; lagenNeuZeichnen(); } },
    { icon: '◉', text: 'Solo (nur diese)', aktion: () => {
      for (const l of modell.layers) l.sichtbar = (l === lage);
      lagenNeuZeichnen(); } },
    { icon: '☑', text: nrs + ' Nagelreihen auswaehlen', aus: !nrs, aktion: () => lagenNrAuswaehlen(lage) }
  ];
  return { kopf: lage.id, eintraege };
}
/* GUI-J: Rechtsklick auf einen BEARBEITUNGS-CHIP (NR/PAF/...) */
const KW_KLARTEXT = { NR: 'Nagelreihe', PAF: 'Fraeskontur', PSG: 'Saegekontur',
  PSF: 'Sperrflaeche', PSZ: 'Sperrzone', PML: 'Markierlinie' };
function kontextFuerOpChip(kw) {
  const sichtbare = sichtbareOpsFlach().filter(f => f.op.kw === kw);
  return { kopf: kw + ' — ' + (KW_KLARTEXT[kw] || ''), eintraege: [
    { icon: 'ℹ', aus: true, text: sichtbare.length + '× in den sichtbaren Lagen' },
    { trenner: true },
    { icon: '◉', text: 'Solo (nur ' + kw + ' anzeigen)', aktion: () => {
      for (const k of Object.keys(ui.opFilter)) ui.opFilter[k] = (k === kw);
      opFilterChipsRendern(); svgRendern(); } },
    { icon: '👁', text: 'Alle Typen anzeigen', aktion: () => {
      for (const k of Object.keys(ui.opFilter)) ui.opFilter[k] = true;
      opFilterChipsRendern(); svgRendern(); } },
    { icon: '☑', text: sichtbare.length + '× ' + kw + ' auswaehlen', aus: !sichtbare.length, aktion: () => {
      opFilterSicherstellen(kw);
      ui.auswahl = { typ: 'op', id: sichtbare[0].op.id, lageId: sichtbare[0].lage.id };
      ui.mehrAuswahl = sichtbare.slice(1).map(f => f.op.id);
      svgRendern(); eigenschaftenRendern(); baumAuswahlMarkieren(); } }
  ]};
}
function kontextLeer() {
  return { kopf: 'Ansicht', eintraege: [
    { icon: '▸', text: 'Auswahl-Werkzeug', kuerzel: 'V', aktion: () => werkzeugSetzen('auswahl') },
    { icon: '📏', text: 'Messen', kuerzel: 'M', aktion: () => werkzeugSetzen('messen') },
    { icon: '✎', text: 'Neue Kontur', kuerzel: 'N', aktion: () => werkzeugSetzen('neue-kontur') },
    { trenner: true },
    { icon: '—', text: 'Horizontalschnitt', kuerzel: 'H', aktion: () => schnittUmschalten('h') },
    { icon: '|', text: 'Vertikalschnitt', kuerzel: '⇧H', aktion: () => schnittUmschalten('v') },
    { icon: '⬡', text: '3D-Ansicht', kuerzel: 'D', aktion: dreiDUmschalten },
    { trenner: true },
    { icon: '☑', text: 'Alle Bearbeitungen waehlen', kuerzel: 'Strg+A', aktion: () => {
      const flach = sichtbareOpsFlach();
      if (flach.length) { ui.auswahl = { typ: 'op', id: flach[0].op.id, lageId: flach[0].lage.id };
        ui.mehrAuswahl = flach.slice(1).map(e => e.op.id); svgRendern(); eigenschaftenRendern(); baumAuswahlMarkieren(); }
    } }
  ]};
}
function kontextmenueAnzeigen(ev) {
  if (!modell) return;
  /* Treffer im Canvas? */
  let menue = null;
  const imCanvas = ev.target.closest('#canvasWrapper');
  const imBaum = ev.target.closest('[data-baum-op],[data-baum-platte],[data-baum-beam]');
  /* Chips gezielt per Container-Selektor — die SVG-Elemente im Canvas
     tragen ebenfalls data-lage/data-*-Attribute und duerfen das
     Bearbeitungs-Menue nicht verdecken (Altbug aus v2.36). */
  const imLagenChip = ev.target.closest('#lagenChips [data-lage-chip]');
  const imOpChip = ev.target.closest('#opFilterChips [data-filter]');
  const imDreieck = ev.target.closest('[data-seite-dreieck]');

  if (imLagenChip) {
    const lage = modell.layers.find(l => l.id === imLagenChip.dataset.lageChip);
    if (lage) menue = kontextFuerLagenChip(lage);
  } else if (imOpChip) {
    menue = kontextFuerOpChip(imOpChip.dataset.filter);
  } else if (imDreieck) {
    const z = seiteAktiv();
    menue = { kopf: 'Seiten-Anzeige', eintraege: [
      { icon: z === 'beide' ? '●' : '○', text: 'Beide Seiten', aktion: () => seiteSetzen('beide') },
      { icon: z === 'innen' ? '●' : '○', text: 'Nur Innen (PLI)', aktion: () => seiteSetzen('innen') },
      { icon: z === 'aussen' ? '●' : '○', text: 'Nur Aussen (PLA)', aktion: () => seiteSetzen('aussen') }
    ]};
  } else if (imBaum) {
    if (imBaum.dataset.baumOp) {
      const f = opFinden(imBaum.dataset.baumOp);
      if (f) { if (!(ui.auswahl && ui.auswahl.id === f.op.id) && !ui.mehrAuswahl.includes(f.op.id))
        auswahlSetzen({ typ: 'op', id: f.op.id, lageId: f.lage.id }); menue = kontextFuerOp(f); }
    } else if (imBaum.dataset.baumPlatte) {
      const f = platteFinden(imBaum.dataset.baumPlatte);
      if (f) { auswahlSetzen({ typ: 'platte', id: f.platte.id, lageId: f.lage.id }); menue = kontextFuerPlatte(f); }
    } else if (imBaum.dataset.baumBeam) {
      const b = modell.beams.find(x => x.id === imBaum.dataset.baumBeam);
      if (b) { auswahlSetzen({ typ: 'beam', id: b.id }); menue = kontextFuerBeam(b); }
    }
  } else if (imCanvas) {
    const treffer = elementUnterMaus(ev);
    if (treffer && (treffer.typ === 'op' || treffer.typ === 'nr-ende')) {
      const f = opFinden(treffer.opId);
      if (f) {
        if (!(ui.auswahl && ui.auswahl.typ === 'op' && ui.auswahl.id === f.op.id) && !ui.mehrAuswahl.includes(f.op.id)) {
          ui.mehrAuswahl = []; auswahlSetzen({ typ: 'op', id: f.op.id, lageId: f.lage.id });
        }
        menue = kontextFuerOp(f);
      }
    } else if (treffer && treffer.typ === 'platte') {
      const f = platteFinden(treffer.plattenId);
      if (f) { auswahlSetzen({ typ: 'platte', id: f.platte.id, lageId: f.lage.id }); menue = kontextFuerPlatte(f); }
    } else if (treffer && treffer.typ === 'beam') {
      const b = modell.beams.find(x => x.id === treffer.beamId);
      if (b) { auswahlSetzen({ typ: 'beam', id: b.id }); menue = kontextFuerBeam(b); }
    } else {
      menue = kontextLeer();
    }
  }
  if (!menue) return;
  ev.preventDefault();
  kontextmenueOeffnen(ev.clientX, ev.clientY, menue.kopf, menue.eintraege.concat(kontextAllgemein()));
}

