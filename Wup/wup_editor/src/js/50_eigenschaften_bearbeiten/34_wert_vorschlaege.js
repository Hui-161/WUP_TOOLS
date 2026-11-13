/* =====================================================================
   AP-WE6: WERT-VORSCHLAEGE im Strg+H-Dialog (Anwenderwunsch).
   weVorhandeneWerte(feld): sammelt die IN DER DATEI vorkommenden Werte des
   Felds mit Haeufigkeit + Erklaerung — Vorschlaege fuer den SUCHWERT.
   weErsatzVorschlaege(feld): die wahrscheinlich sinnvollen ERSATZWERTE —
   bei nrIndex die bekannten Geraete aus dem Maschinenprofil (10/11/20/25/32
   mit Klartext), bei platteIdx die bekannten Material-Indizes; sonst die
   vorhandenen Werte. Beide headless testbar; x/y-Felder liefern bewusst
   nichts (zu viele Einzelwerte). */
function weWertErklaerung(feld, wert) {
  if (feld === 'nrIndex') {
    const g = profil.nr_indizes[wert];
    return g ? g.name : 'unbekanntes Geraet (PSF-Offset konservativ ' + profil.default_offset_unbekannt + ' mm)';
  }
  if (feld === 'steuercode') return steuercodeWorte(wert);
  if (feld === 'platteIdx') return materialKlasse(wert);
  return '';
}
function weVorhandeneWerte(feld) {
  if (!modell) return [];
  const zaehler = new Map();
  const plus = w => {
    if (w == null || isNaN(w)) return;
    const k = Math.round(w * 1000) / 1000;
    zaehler.set(k, (zaehler.get(k) || 0) + 1);
  };
  const alleOps = modell.layers.flatMap(l => l.ops);
  const allePlatten = modell.layers.flatMap(l => l.plates);
  if (feld === 'nrIndex') { for (const op of alleOps) if (op.nr) plus(op.nr.i); }
  else if (feld === 'nrAbstand') { for (const op of alleOps) if (op.nr) plus(op.nr.a); }
  else if (feld === 'steuercode') {
    for (const op of alleOps) for (const e of (op.poly || []))
      if ((e.type === 'PP' || e.type === 'KB' || e.type === 'MP') && e.i != null) plus(e.i);
  } else if (feld === 't') {
    for (const op of alleOps) for (const e of (op.poly || [])) if (e.t != null) plus(e.t);
  } else if (feld === 'z') {
    for (const op of alleOps) for (const e of (op.poly || [])) if (e.z != null) plus(e.z);
  } else if (feld === 'radius') {
    for (const op of alleOps) for (const e of (op.poly || []))
      if ((e.type === 'KB' || e.type === 'MP') && e.r != null) plus(e.r);
  } else if (feld === 'winkel') {
    for (const op of alleOps) for (const e of (op.poly || []))
      if (e.type === 'PP' || e.type === 'KB') plus(e.alpha == null ? 0 : e.alpha);
  } else if (feld === 'platteIdx') { for (const p of allePlatten) plus(p.materialIdx); }
  else if (feld === 'platteHz') { for (const p of allePlatten) plus(p.hz); }
  else if (feld === 'platteZ') { for (const p of allePlatten) if (p.z != null) plus(p.z); }
  else if (feld === 'bozWert') {
    for (const beam of modell.beams) for (const bb of (beam.bearbeitungen || []))
      if (bb.kw === 'BOZ' && bb.params.length >= 3) plus(zahl(bb.params[2]));
  } else return [];
  const liste = Array.from(zaehler.entries()).map(([wert, anzahl]) =>
    ({ wert, anzahl, text: weWertErklaerung(feld, wert) }));
  liste.sort((a, b) => b.anzahl - a.anzahl || a.wert - b.wert);
  return liste.slice(0, 18);
}
function weErsatzVorschlaege(feld) {
  if (feld === 'nrIndex')
    return Object.keys(profil.nr_indizes).map(i =>
      ({ wert: Number(i), anzahl: null, text: profil.nr_indizes[i].name }));
  if (feld === 'platteIdx') {
    /* bekannte Indizes: aus der Datei gelernter Katalog + reale Standardwerte */
    const bekannt = new Map();
    for (const idx of Object.keys(modell && modell.materialKatalog || {})) {
      const e = modell.materialKatalog[idx];
      bekannt.set(Number(idx), materialKlasse(Number(idx)) + (e.namen.length ? ' — ' + e.namen[0] : ''));
    }
    for (const idx of [10, 20, 30, 40, 60, 240]) if (!bekannt.has(idx)) bekannt.set(idx, materialKlasse(idx));
    return Array.from(bekannt.entries()).sort((a, b) => a[0] - b[0])
      .map(([wert, text]) => ({ wert, anzahl: null, text }));
  }
  return weVorhandeneWerte(feld);
}
/* AP-WE6: eine Dropdown-Reihe (100er/10er/1er) fuer die Steuercode-Eingabe
   nach Stellen — Bedeutungen aus Weinmann 5.1 (PAF- und PSG-Werkzeug
   kombiniert benannt, weil der Dialog beide Typen gleichzeitig treffen kann).
   Die 1000er-Stelle (Gleich-/Gegenlauf) bleibt der Zahleneingabe erhalten. */
function weScStellenReiheHtml(ziel, label) {
  const sel = (stelle, optionen, titel) =>
    '<select class="eingabefeld eingabefeld-klein" data-sc-stelle="' + ziel + stelle + '" title="' + titel + '" style="width:auto;max-width:210px">'
    + '<option value="">— ' + titel + ' —</option>'
    + optionen.map(([v, t]) => '<option value="' + v + '">' + t + '</option>').join('')
    + '</select>';
  return '<div class="eig-zeile"><span class="we-chip-label">' + label + ':</span>'
    + sel(100, [[1, '100 — Korr. links (Gutteil rechts)'], [2, '200 — Korr. rechts (Gutteil links)'], [3, '300 — keine Korrektur']], 'Radiuskorrektur (100er)')
    + sel(10, [[1, '10 — Ueberschnitt ⊕'], [2, '20 — Unterschnitt ⊖'], [0, '0 — Maschinenregel']], 'Schnittende (10er)')
    + sel(1, [[1, '1 — zyl. Fraeser / Standard-Saegeblatt'], [2, '2 — Fraeser m. Fase / fein gezahnt'],
              [3, '3 — Nutfraeser / Kettensaege'], [4, '4 — Markierfraeser']], 'Werkzeug (1er)')
    + '</div>';
}
/* AP-WE6: Chip-Liste fuer Wert-Vorschlaege (Suchwert = vorhandene Werte mit
   Haeufigkeit, Ersatzwert = wahrscheinliche Werte mit Erklaerung). */
function weVorschlagChipsHtml(ziel, liste, label) {
  if (!liste.length) return '';
  return '<span class="we-chip-label">' + label + ':</span>' + liste.map(v =>
    '<button type="button" class="we-chip" data-chip-ziel="' + ziel + '" data-chip-wert="' + v.wert + '"'
    + ' title="' + escapeHtml((v.text || '') + (v.anzahl ? (v.text ? ' — ' : '') + v.anzahl + '× vorhanden' : '')) + '">'
    + '<b>' + v.wert + '</b>'
    + (v.anzahl ? '<span class="we-chip-anzahl">×' + v.anzahl + '</span>' : '')
    + (v.text ? '<span class="we-chip-text">' + escapeHtml(v.text) + '</span>' : '')
    + '</button>').join('');
}
function werteErsetzenOeffnen() {
  if (!modell) return;
  document.querySelectorAll('.modal-hintergrund').forEach(m => m.remove());
  const hatAuswahl = !!(ui.auswahl && (ui.auswahl.typ === 'op' || ui.auswahl.typ === 'platte' || ui.auswahl.typ === 'beam'));
  const lagenIds = modell.layers.map(l => l.id);
  /* AP-WE4: vorhandene Platten-Namen fuer den Namensfilter (eindeutig, sortiert) */
  const plattenNamen = Array.from(new Set(
    modell.layers.flatMap(l => l.plates.map(p => (p.name || '').trim()).filter(Boolean)))).sort();
  const feldGruppen = [
    { titel: 'Bearbeitungen (NR/PAF/PSG/PSF/PSZ/PML)', gruppe: 'op' },
    { titel: 'Platten (Kopfzeile + Umriss)', gruppe: 'platte' },
    { titel: 'Bauteile (Riegelwerk)', gruppe: 'beam' }
  ];
  const feldSelectHtml = feldGruppen.map(g =>
    '<optgroup label="' + g.titel + '">'
    + WE_FELDER.filter(f => (WE_FELD_INFO[f.v] || {}).gruppe === g.gruppe)
      .map(f => '<option value="' + f.v + '">' + f.t + '</option>').join('')
    + '</optgroup>').join('');
  const hg = document.createElement('div');
  hg.className = 'modal-hintergrund';
  hg.innerHTML =
    '<div class="modal-fenster we-fenster" role="dialog" aria-label="Suchen und Ersetzen">'
    + '<h2>Suchen &amp; Ersetzen</h2>'
    + '<div class="modal-untertitel">Feld-Ersetzung (kein Rohtext) — geprueft werden nur die Datenfelder des '
    + 'gewaehlten Feld-Typs, niemals aus Versehen andere Werte. Die Vorschau rechts zeigt die betroffenen '
    + 'WUP-Zeilen vor/nach der Ersetzung.</div>'
    + '<div class="we-layout">'
    + '<div class="we-formular">'
    +   '<div class="modal-abschnitt" style="margin-top:0">'
    +   '<label>Feld: <select id="weFeld" style="width:auto">' + feldSelectHtml + '</select></label>'
    +   '<div class="mini-hinweis" id="weFeldHinweis"></div>'
    +   '</div>'
    +   '<div class="modal-abschnitt">'
    +   '<label id="weSuchLabel"><span id="weSuchText">Suchwert [mm]</span>: <input type="number" step="any" id="weSuchwert"></label>'
    +   '<label id="weErsatzLabel"><span id="weErsatzText">Ersatzwert [mm]</span>: <input type="number" step="any" id="weErsatzwert"></label>'
    +   '<span id="weTextModusBlock" style="display:none">'
    +   '<label><input type="radio" name="weTextModus" value="exakt" checked> exakt</label> '
    +   '<label><input type="radio" name="weTextModus" value="enthaelt"> enthaelt</label>'
    +   '</span>'
    +   '<label id="weToleranzLabel">Toleranz [mm]: <input type="number" step="any" min="0" id="weToleranz" value="0.01"></label>'
    +   '<div class="mini-hinweis" id="weScInfo" style="display:none"></div>'
    +   '</div>'
    +   '<div class="we-vorschlaege" id="weSuchVorschlaege" style="display:none"></div>'
    +   '<div class="modal-abschnitt" id="weScStellen" style="display:none">'
    +   '<div class="mini-hinweis">Steuercode nach Stellen — 100er = Radiuskorrektur, 10er = Ueber-/Unterschnitt, 1er = Werkzeug:</div>'
    +   weScStellenReiheHtml('Such', 'Suchen')
    +   weScStellenReiheHtml('Ersatz', 'Ersetzen durch')
    +   '</div>'
    +   '<div class="we-vorschlaege" id="weErsatzVorschlaege" style="display:none"></div>'
    +   '<div class="modal-abschnitt">'
    +   '<label>Bereich: <select id="weBereich" style="width:auto">'
    +   '<option value="auswahl"' + (!hatAuswahl ? ' disabled' : '') + '>Auswahl</option>'
    +   '<option value="sichtbar" selected>Sichtbare Bearbeitungen</option>'
    +   '<option value="alle">Alle Bearbeitungen</option>'
    +   '</select></label>'
    +   '</div>'
    +   '<div class="modal-abschnitt" id="weNameFilterBlock" style="display:none">'
    +   '<label>Nur Platten mit Name: <select id="weNameFilter" style="width:auto;max-width:340px">'
    +   weNameFilterOptionenHtml(plattenNamen)
    +   '</select></label>'
    +   '<div class="mini-hinweis">„Beginnend mit" ignoriert die laufende Nummer am Namensende; sonst zaehlt der exakte Name.</div>'
    +   '</div>'
    +   '<div class="modal-abschnitt" id="weLagenBlock">'
    +   '<div class="mini-hinweis">Lagen:</div><div class="eig-zeile">'
    +   lagenIds.map(id => '<label><input type="checkbox" class="we-lage" value="' + id + '" checked> ' + id + '</label>').join(' ')
    +   '</div></div>'
    +   '<div class="modal-abschnitt" id="weTypBlock">'
    +   '<div class="mini-hinweis">Bearbeitungstypen:</div><div class="eig-zeile">'
    +   WE_TYPEN.map(kw => '<label><input type="checkbox" class="we-typ" value="' + kw + '" checked> ' + kw + '</label>').join(' ')
    +   '</div></div>'
    +   '<div class="modal-untertitel" id="weHinweis" style="display:none"></div>'
    +   '<div class="we-treffer" id="weTreffer">Werte eingeben, um die Trefferzahl zu sehen.</div>'
    + '</div>'
    + '<div class="we-vorschau" id="weVorschauPanel">'
    +   '<div class="we-vorschau-kopf"><span id="weVorschauTitel">Quelltext-Vorschau</span></div>'
    +   '<div class="we-vorschau-liste" id="weVorschauListe">'
    +   '<div class="we-vorschau-leer">Noch keine Treffer — Werte links eingeben.</div></div>'
    + '</div>'
    + '</div>'
    + '<div class="modal-fuss">'
    + '<button class="schaltflaeche schaltflaeche-klein schaltflaeche-neben" id="weVorschauToggle" '
    + 'style="margin-right:auto" title="Quelltext-Vorschau ein-/ausklappen">⯆ Quelltext einklappen</button>'
    + '<button class="schaltflaeche schaltflaeche-neben schaltflaeche-klein" data-we-modal="abbrechen">Abbrechen</button>'
    + '<button class="schaltflaeche schaltflaeche-haupt schaltflaeche-klein" data-we-modal="ersetzen" disabled>Ersetzen</button>'
    + '</div></div>';
  document.body.appendChild(hg);
  ui._weVorschlagFeld = null;   /* AP-WE6: Chips beim (Wieder-)Oeffnen neu aufbauen */
  hg.querySelector('#weBereich').value = hatAuswahl ? 'auswahl' : 'sichtbar';
  const schliessen = () => hg.remove();
  hg.addEventListener('click', ev => { if (ev.target === hg) schliessen(); });
  hg.querySelector('[data-we-modal="abbrechen"]').addEventListener('click', schliessen);
  const ersetzenBtn = hg.querySelector('[data-we-modal="ersetzen"]');

  /* Vorschau-Panel ein-/ausklappbar; Zustand bleibt fuer die Sitzung erhalten */
  const vorschauPanel = hg.querySelector('#weVorschauPanel');
  const vorschauToggle = hg.querySelector('#weVorschauToggle');
  const fenster = hg.querySelector('.we-fenster');
  const vorschauZeigen = offen => {
    ui._weVorschauOffen = offen;
    vorschauPanel.classList.toggle('zu', !offen);
    fenster.classList.toggle('ohne-vorschau', !offen);
    vorschauToggle.textContent = offen ? '⯆ Quelltext einklappen' : '⯈ Quelltext anzeigen';
  };
  vorschauToggle.addEventListener('click', () => vorschauZeigen(!!vorschauPanel.classList.contains('zu')));
  vorschauZeigen(ui._weVorschauOffen !== false);

  /* Feldabhaengige Ein-/Ausblendung. Lagen-Filter gilt fuer Lagen-Ops UND
     Platten-Felder; Typ-Filter nur fuer Lagen-Ops; bei 'bozWert' beides aus. */
  const feldUmschalten = () => {
    const feld = hg.querySelector('#weFeld').value;
    const info = WE_FELD_INFO[feld] || {};
    const istText = !!info.text;
    const suchEl = hg.querySelector('#weSuchwert'), ersatzEl = hg.querySelector('#weErsatzwert');
    suchEl.type = istText ? 'text' : 'number';
    ersatzEl.type = istText ? 'text' : 'number';
    const einheit = info.einheit ? ' [' + info.einheit + ']' : '';
    hg.querySelector('#weSuchText').textContent = istText ? 'Suchtext' : 'Suchwert' + einheit;
    hg.querySelector('#weErsatzText').textContent = istText ? 'Ersatztext' : 'Ersatzwert' + einheit;
    hg.querySelector('#weTextModusBlock').style.display = istText ? '' : 'none';
    hg.querySelector('#weToleranzLabel').style.display = (istText || info.exakt) ? 'none' : '';
    hg.querySelector('#weFeldHinweis').textContent = info.hinweis || '';
    hg.querySelector('#weLagenBlock').style.display = info.gruppe === 'beam' ? 'none' : '';
    hg.querySelector('#weTypBlock').style.display = info.gruppe === 'op' ? '' : 'none';
    /* AP-WE4: Namensfilter nur bei Platten-Feldern (beim Feld 'name' ist der
       Suchtext selbst schon der Name — Filter dort ueberfluessig) */
    hg.querySelector('#weNameFilterBlock').style.display = (info.gruppe === 'platte' && feld !== 'name') ? '' : 'none';
    const hinweisEl = hg.querySelector('#weHinweis');
    const hinweisText = feld === 'bozWert'
      ? 'Hinweis: Andere Bauteil-Werte (Position, Name) aendert diese Version nicht — Bauteilzeilen werden nicht re-serialisiert.' : '';
    hinweisEl.style.display = hinweisText ? '' : 'none';
    hinweisEl.textContent = hinweisText;
    hg.querySelector('#weScStellen').style.display = feld === 'steuercode' ? '' : 'none';
    /* AP-WE6: Wert-Vorschlaege nur beim Feldwechsel neu aufbauen */
    if (feld !== ui._weVorschlagFeld) {
      ui._weVorschlagFeld = feld;
      const such = info.text ? [] : weVorhandeneWerte(feld);
      const ersatz = info.text ? [] : weErsatzVorschlaege(feld);
      const suchEl = hg.querySelector('#weSuchVorschlaege'), ersatzEl = hg.querySelector('#weErsatzVorschlaege');
      suchEl.innerHTML = weVorschlagChipsHtml('Such', such, 'Vorhanden');
      suchEl.style.display = such.length ? '' : 'none';
      ersatzEl.innerHTML = weVorschlagChipsHtml('Ersatz', ersatz, 'Ersatz-Vorschlaege');
      ersatzEl.style.display = ersatz.length ? '' : 'none';
    }
  };
  /* AP-WE6: Steuercode-Stellen <-> Zahlenfeld synchron halten.
     Dropdown-Aenderung baut die Zahl (1000er-Stelle des Feldes bleibt
     erhalten), Zahlen-Aenderung zieht die Dropdowns nach. */
  const scStellenLesen = ziel => {
    const lese = st => {
      const el = hg.querySelector('[data-sc-stelle="' + ziel + st + '"]');
      return !el || el.value === '' ? null : parseInt(el.value, 10);
    };
    return { korrektur: lese(100), schnitt: lese(10), werkzeug: lese(1) };
  };
  const scStellenBauen = ziel => {
    const t = scStellenLesen(ziel);
    if (t.korrektur == null || t.schnitt == null || t.werkzeug == null) return; /* erst wenn alle 3 gesetzt */
    const feldEl = hg.querySelector(ziel === 'Such' ? '#weSuchwert' : '#weErsatzwert');
    const alt = parseFloat(feldEl.value);
    const lauf = isNaN(alt) ? 0 : steuercodeZerlegen(alt).lauf;
    feldEl.value = steuercodeBauen({ lauf, korrektur: t.korrektur, schnitt: t.schnitt, werkzeug: t.werkzeug });
    vorschauAktualisieren();
  };
  const scStellenNachziehen = () => {
    for (const [ziel, sel] of [['Such', '#weSuchwert'], ['Ersatz', '#weErsatzwert']]) {
      const w = parseFloat(hg.querySelector(sel).value);
      const t = isNaN(w) ? null : steuercodeZerlegen(w);
      for (const [st, key] of [[100, 'korrektur'], [10, 'schnitt'], [1, 'werkzeug']]) {
        const el = hg.querySelector('[data-sc-stelle="' + ziel + st + '"]');
        if (el) el.value = t == null ? '' : String(t[key]);
      }
    }
  };
  hg.querySelectorAll('[data-sc-stelle]').forEach(el =>
    el.addEventListener('change', () => scStellenBauen(el.dataset.scStelle.indexOf('Such') === 0 ? 'Such' : 'Ersatz')));
  /* Chip-Klick uebernimmt den Wert ins zugehoerige Feld */
  hg.addEventListener('click', ev => {
    const chip = ev.target.closest('[data-chip-ziel]');
    if (!chip) return;
    hg.querySelector(chip.dataset.chipZiel === 'Such' ? '#weSuchwert' : '#weErsatzwert').value = chip.dataset.chipWert;
    scStellenNachziehen();
    vorschauAktualisieren();
  });
  const optionenAusFeldern = () => {
    const feld = hg.querySelector('#weFeld').value;
    const info = WE_FELD_INFO[feld] || {};
    const suchwert = info.text ? hg.querySelector('#weSuchwert').value : parseFloat(hg.querySelector('#weSuchwert').value);
    const ersatzwert = info.text ? hg.querySelector('#weErsatzwert').value : parseFloat(hg.querySelector('#weErsatzwert').value);
    const toleranz = parseFloat(hg.querySelector('#weToleranz').value);
    const bereich = hg.querySelector('#weBereich').value;
    const textModusEl = hg.querySelector('input[name="weTextModus"]:checked');
    const textModus = textModusEl ? textModusEl.value : 'exakt';
    const lagenFilter = info.gruppe !== 'beam' ? Array.from(hg.querySelectorAll('.we-lage:checked')).map(el => el.value) : null;
    const typFilter = info.gruppe === 'op' ? Array.from(hg.querySelectorAll('.we-typ:checked')).map(el => el.value) : null;
    const nameFilter = (info.gruppe === 'platte' && feld !== 'name')
      ? weNameFilterLesen(hg.querySelector('#weNameFilter').value)
      : { plattenNameFilter: null, plattenNameModus: 'exakt' };
    return Object.assign({ feld, suchwert, ersatzwert, toleranz: isNaN(toleranz) ? 0.01 : toleranz,
      bereich, textModus, lagenFilter, typFilter }, nameFilter);
  };
  const werteFehlen = opt => (WE_FELD_INFO[opt.feld] || {}).text ? (opt.suchwert == null || opt.suchwert === '') : isNaN(opt.suchwert);
  const ersatzFehlt = opt => (WE_FELD_INFO[opt.feld] || {}).text ? false : isNaN(opt.ersatzwert);
  const scInfoAktualisieren = opt => {
    const el = hg.querySelector('#weScInfo');
    if (opt.feld !== 'steuercode' || (isNaN(opt.suchwert) && isNaN(opt.ersatzwert))) {
      el.style.display = 'none'; el.textContent = ''; return;
    }
    const teile = [];
    if (!isNaN(opt.suchwert)) teile.push(Math.round(opt.suchwert) + ' = ' + steuercodeWorte(opt.suchwert));
    if (!isNaN(opt.ersatzwert)) teile.push('→ ' + Math.round(opt.ersatzwert) + ' = ' + steuercodeWorte(opt.ersatzwert));
    el.textContent = teile.join('  ');
    el.style.display = '';
  };
  const vorschauListeRendern = opt => {
    const liste = hg.querySelector('#weVorschauListe');
    const titelEl = hg.querySelector('#weVorschauTitel');
    if (werteFehlen(opt)) {
      titelEl.textContent = 'Quelltext-Vorschau';
      liste.innerHTML = '<div class="we-vorschau-leer">Noch keine Treffer — Werte links eingeben.</div>';
      return { treffer: 0, objekte: 0 };
    }
    /* Ohne Ersatzwert: Fundstellen trotzdem zeigen — so funktioniert der
       Dialog auch als reines SUCHEN-Werkzeug. Fuer die Positionsbestimmung
       laeuft intern eine Sentinel-Ersetzung (suchwert+1), angezeigt werden
       aber nur die markierten Original-Zeilen. */
    const ohneNeu = ersatzFehlt(opt);
    const vorschauOpt = ohneNeu ? Object.assign({}, opt, { ersatzwert: opt.suchwert + 1 }) : opt;
    const v = werteErsetzenVorschauHunks(vorschauOpt, 60);
    titelEl.textContent = 'Quelltext-Vorschau — ' + v.objekte + ' Objekt(e)';
    if (!v.treffer) {
      liste.innerHTML = '<div class="we-vorschau-leer">Keine Treffer fuer die aktuellen Werte/Filter.</div>';
      return v;
    }
    let html = v.hunks.map(h => ohneNeu ? weHunkFundHtml(h) : weHunkHtml(h)).join('');
    if (ohneNeu) html = '<div class="we-vorschau-leer">Nur Fundstellen — Ersatzwert eingeben fuer die Vorher/Nachher-Ansicht.</div>' + html;
    if (v.mehr) html += '<div class="we-zeile-dim">… +' + v.mehr + ' weitere Objekt(e) (Vorschau gekuerzt — ersetzt werden ALLE Treffer)</div>';
    liste.innerHTML = html;
    return v;
  };
  const vorschauAktualisieren = () => {
    feldUmschalten();
    const opt = optionenAusFeldern();
    scInfoAktualisieren(opt);
    const trefferEl = hg.querySelector('#weTreffer');
    if (werteFehlen(opt)) {
      trefferEl.textContent = 'Werte eingeben, um die Trefferzahl zu sehen.';
      trefferEl.classList.remove('hat-treffer');
      ersetzenBtn.disabled = true;
      vorschauListeRendern(opt);
      return;
    }
    const { treffer, ops } = werteErsetzen(Object.assign({}, opt, { nurVorschau: true }));
    trefferEl.textContent = treffer + ' Wert(e) in ' + ops.length + ' Objekt(en) '
      + (ersatzFehlt(opt) ? 'gefunden.' : 'wuerden ersetzt.');
    trefferEl.classList.toggle('hat-treffer', treffer > 0);
    ersetzenBtn.disabled = !(treffer > 0 && !ersatzFehlt(opt));
    vorschauListeRendern(opt);
    if (opt.feld === 'steuercode') scStellenNachziehen();
  };
  hg.querySelectorAll('#weSuchwert, #weErsatzwert, #weFeld, #weToleranz, #weBereich, #weNameFilter, input[name="weTextModus"], .we-lage, .we-typ')
    .forEach(el => el.addEventListener('input', vorschauAktualisieren));
  vorschauAktualisieren();
  hg.querySelector('#weSuchwert').focus();
  ersetzenBtn.addEventListener('click', () => {
    const opt = optionenAusFeldern();
    if (werteFehlen(opt) || ersatzFehlt(opt)) return;
    const { treffer, ops } = werteErsetzen(opt);
    schliessen();
    hinweisAnzeigen(treffer + ' Wert(e) in ' + ops.length + ' Objekt(en) ersetzt.', treffer ? 'erfolg' : 'info');
  });
}
