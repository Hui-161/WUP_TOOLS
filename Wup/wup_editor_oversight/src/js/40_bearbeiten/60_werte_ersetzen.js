/* =====================================================================
   §10 WERTE ERSETZEN UEBER ALLE DATEIEN
   ===================================================================== */
/* AP-WE2 (Anwenderwunsch: nicht nur x/y, auch Index/Name/Steuercode/z/BOZ,
   je Lage/Bearbeitungstyp einschraenkbar): dieselben Optionen wie im Editor-
   Dialog (wup_editor.html werteErsetzenOeffnen) — der Kern (iframe) fuehrt
   die eigentliche Logik aus, hier NUR Optionen sammeln + je Datei durchreichen.
   Lagen-Filter-Liste ist die Vereinigung aller Lagen-IDs ueber alle geladenen
   Dateien (sichtbarkeit.lagen wird beim Laden je Datei befuellt, siehe §3/§4). */
/* Feld-Metadaten — INHALTLICH SYNCHRON zu WE_FELD_INFO in wup_editor.html
   halten (dort const, daher nicht ueber das Kern-window erreichbar). */
const WE_FELD_INFO = {
  x:          { gruppe: 'op', einheit: 'mm', hinweis: 'X von PP/KB/MP/TA-Punkten, NR-Endpunkten (xa/xe) und NBR-Nagelbildern.' },
  y:          { gruppe: 'op', einheit: 'mm', hinweis: 'Y von PP/KB/MP/TA-Punkten, NR-Endpunkten (ya/ye) und NBR-Nagelbildern.' },
  xy:         { gruppe: 'op', einheit: 'mm', hinweis: 'X und Y gemeinsam — trifft beide Achsen unabhaengig voneinander.' },
  z:          { gruppe: 'op', einheit: 'mm', hinweis: 'Z-Position von Polygonpunkten (nur Punkte, die ein z tragen).' },
  t:          { gruppe: 'op', einheit: 'mm', hinweis: 'Tiefe t von Polygonpunkten (PP/KB/MP/TA). Vorzeichen wird mitverglichen.' },
  steuercode: { gruppe: 'op', exakt: true, hinweis: 'Steuercode i an PP/KB/MP — exakter Vergleich, trifft NIE benachbarte Codes.' },
  radius:     { gruppe: 'op', einheit: 'mm', hinweis: 'Radius r von KB-Kreisboegen und MP-Vollkreisen. Vorzeichen bei MP = Drehrichtung, wird mitverglichen.' },
  winkel:     { gruppe: 'op', einheit: '°', hinweis: 'Neigungswinkel α an PP/KB. Punkte ohne Winkelangabe zaehlen als 0°.' },
  nrIndex:    { gruppe: 'op', exakt: true, hinweis: 'Nagel-/Klammergeraet i von Nagelreihen — exakter Vergleich.' },
  nrAbstand:  { gruppe: 'op', einheit: 'mm', hinweis: 'Nagelabstand a von Nagelreihen.' },
  name:       { gruppe: 'platte', text: true, hinweis: 'Platten-Namen. Bauteil-Namen (Riegelwerk) aendert diese Version nicht.' },
  platteIdx:  { gruppe: 'platte', exakt: true, hinweis: 'Material-Index der Platten-Kopfzeile — exakter Vergleich. Steuercodes von Bearbeitungspunkten bleiben unberuehrt.' },
  platteHz:   { gruppe: 'platte', einheit: 'mm', hinweis: 'Plattenstaerke hz der Kopfzeile. Achtung: bei PP-Umrissen wird hz auch in die Umriss-Punkte geschrieben.' },
  platteZ:    { gruppe: 'platte', einheit: 'mm', hinweis: 'Z-Position der Platten-Kopfzeile. Platten ohne z-Angabe werden nicht angefasst.' },
  platteX:    { gruppe: 'platte', einheit: 'mm', hinweis: 'X der Umriss-Punkte; x/lx der Kopfzeile werden aus dem Umriss nachgefuehrt.' },
  platteY:    { gruppe: 'platte', einheit: 'mm', hinweis: 'Y der Umriss-Punkte; y/by der Kopfzeile werden aus dem Umriss nachgefuehrt.' },
  platteXY:   { gruppe: 'platte', einheit: 'mm', hinweis: 'X und Y der Umriss-Punkte; Kopfzeile wird nachgefuehrt.' },
  bozWert:    { gruppe: 'beam', einheit: 'mm', hinweis: 'Durchmesser d von BOZ-Bohrungen an Bauteilen (abgekuendigtes Kuerzel, bleibt BOZ-Zeile).' }
};
function weFeldUmschalten() {
  const feld = document.getElementById('weFeld').value;
  const info = WE_FELD_INFO[feld] || {};
  const istText = !!info.text;
  const suchEl = document.getElementById('weSuchwert'), ersatzEl = document.getElementById('weErsatzwert');
  suchEl.type = istText ? 'text' : 'number';
  ersatzEl.type = istText ? 'text' : 'number';
  const einheit = info.einheit ? ' (' + info.einheit + ')' : '';
  document.getElementById('weSuchText').textContent = istText ? 'Suchtext' : 'Suchwert' + einheit;
  document.getElementById('weErsatzText').textContent = istText ? 'Ersatztext' : 'Ersatzwert' + einheit;
  document.getElementById('weTextModusBlock').style.display = istText ? '' : 'none';
  document.getElementById('weToleranzLabel').style.display = (istText || info.exakt) ? 'none' : '';
  document.getElementById('weFeldHinweis').textContent = info.hinweis || '';
  document.getElementById('weLagenBlock').style.display = info.gruppe === 'beam' ? 'none' : '';
  document.getElementById('weTypBlock').style.display = info.gruppe === 'op' ? '' : 'none';
  document.getElementById('weNameFilterBlock').style.display = (info.gruppe === 'platte' && feld !== 'name') ? '' : 'none';
  const hinweisEl = document.getElementById('weHinweis');
  const hinweisText = feld === 'bozWert'
    ? 'Hinweis: Andere Bauteil-Werte (Position, Name) aendert diese Version nicht — Bauteilzeilen werden nicht re-serialisiert.' : '';
  hinweisEl.style.display = hinweisText ? '' : 'none';
  hinweisEl.textContent = hinweisText;
  weScInfoAktualisieren();
  ovVorschlaegeAktualisieren();
}
/* Steuercode-Eingaben in Worten aufschluesseln (Kern-Funktion steuercodeWorte,
   nur wenn der Kern schon geladen ist — sonst still weglassen). */
function weScInfoAktualisieren() {
  const el = document.getElementById('weScInfo');
  const feld = document.getElementById('weFeld').value;
  const such = parseFloat(document.getElementById('weSuchwert').value);
  const ersatz = parseFloat(document.getElementById('weErsatzwert').value);
  if (feld !== 'steuercode' || !kern || typeof kern.steuercodeWorte !== 'function'
      || (isNaN(such) && isNaN(ersatz))) {
    el.style.display = 'none'; el.textContent = ''; return;
  }
  const teile = [];
  if (!isNaN(such)) teile.push(Math.round(such) + ' = ' + kern.steuercodeWorte(such));
  if (!isNaN(ersatz)) teile.push('→ ' + Math.round(ersatz) + ' = ' + kern.steuercodeWorte(ersatz));
  el.textContent = teile.join('  ');
  el.style.display = '';
}
function weLagenChipsRendern() {
  const wrap = document.getElementById('weLagenChips');
  const lagenIds = Object.keys(sichtbarkeit.lagen).sort();
  wrap.innerHTML = lagenIds.map(id =>
    '<label><input type="checkbox" class="we-lage" value="' + id + '" checked> ' + id + '</label>').join('');
}
/* AP-WE4/WE5: Namensfilter-Dropdown mit den Platten-Namen aller geladenen
   Dateien befuellen (Auswahl bleibt erhalten, wenn der Wert noch existiert).
   Aufbau + Wert-Kodierung ('anfang:…'/'exakt:…') SYNCHRON zu
   weNameFilterOptionenHtml/weNameFilterLesen in wup_editor.html halten. */
function weNameFilterRendern() {
  const sel = document.getElementById('weNameFilter');
  const vorher = sel.value;
  const namen = Array.from(bekanntePlattenNamen).sort();
  const praefixe = Array.from(new Set(
    namen.filter(n => /-\d+$/.test(n)).map(n => n.replace(/-\d+$/, '')).filter(Boolean))).sort();
  let html = '<option value="">— alle Namen —</option>';
  if (praefixe.length)
    html += '<optgroup label="Beginnend mit (Nummer am Ende ignorieren)">'
      + praefixe.map(p => '<option value="anfang:' + escapeHtml(p) + '">' + escapeHtml(p) + '-…</option>').join('')
      + '</optgroup>';
  html += '<optgroup label="Exakter Name">'
    + namen.map(n => '<option value="exakt:' + escapeHtml(n) + '">' + escapeHtml(n) + '</option>').join('')
    + '</optgroup>';
  sel.innerHTML = html;
  if (Array.from(sel.options).some(o => o.value === vorher)) sel.value = vorher;
}
function weNameFilterLesen(wert) {
  if (!wert) return { plattenNameFilter: null, plattenNameModus: 'exakt' };
  if (wert.indexOf('anfang:') === 0) return { plattenNameFilter: wert.slice(7), plattenNameModus: 'beginnt' };
  return { plattenNameFilter: wert.replace(/^exakt:/, ''), plattenNameModus: 'exakt' };
}
/* =====================================================================
   AP-WE6: Wert-Vorschlaege — Aggregation ueber ALLE geladenen Dateien.
   Die Sammel-Logik arbeitet direkt auf den _vorschau-Klonen (kein
   Kern-Parse noetig, millisekundenschnell) und ist INHALTLICH SYNCHRON zu
   weVorhandeneWerte() in wup_editor.html zu halten. Erklaerungstexte kommen
   aus dem Kern (steuercodeWorte/materialKlasse/profil), wenn er schon
   geladen ist — sonst Chips ohne Text. */
function ovWertErklaerung(feld, wert) {
  try {
    if (feld === 'nrIndex' && kern && kern.eval) {
      const g = JSON.parse(kern.eval('JSON.stringify(profil.nr_indizes)'))[wert];
      return g ? g.name : 'unbekanntes Geraet';
    }
    if (feld === 'steuercode' && kern && typeof kern.steuercodeWorte === 'function') return kern.steuercodeWorte(wert);
    if (feld === 'platteIdx' && kern && typeof kern.materialKlasse === 'function') return kern.materialKlasse(wert);
  } catch (fehler) { /* Kern (noch) nicht verfuegbar — Chips ohne Text */ }
  return '';
}
function ovVorhandeneWerte(feld) {
  const zaehler = new Map();
  const plus = w => {
    if (w == null || isNaN(w)) return;
    const k = Math.round(w * 1000) / 1000;
    zaehler.set(k, (zaehler.get(k) || 0) + 1);
  };
  for (const d of dateien) {
    const frei = d._vorschau;
    if (!frei) continue;
    const alleOps = frei.layers.flatMap(l => l.ops);
    const allePlatten = frei.layers.flatMap(l => l.plates);
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
      for (const beam of (frei.beams || [])) for (const bb of (beam.bearbeitungen || []))
        if (bb.kw === 'BOZ' && bb.params && bb.params.length >= 3) plus(parseFloat(bb.params[2]));
    } else return [];
  }
  const liste = Array.from(zaehler.entries()).map(([wert, anzahl]) =>
    ({ wert, anzahl, text: ovWertErklaerung(feld, wert) }));
  liste.sort((a, b) => b.anzahl - a.anzahl || a.wert - b.wert);
  return liste.slice(0, 18);
}
function ovErsatzVorschlaege(feld) {
  if (feld === 'nrIndex') {
    try {
      if (kern && kern.eval) {
        const idx = JSON.parse(kern.eval('JSON.stringify(profil.nr_indizes)'));
        return Object.keys(idx).map(i => ({ wert: Number(i), anzahl: null, text: idx[i].name }));
      }
    } catch (fehler) { /* Kern fehlt: unten Fallback */ }
  }
  return ovVorhandeneWerte(feld);
}
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
/* Steuercode-Stellen (synchron zur Editor-Fassung weScStellenReiheHtml) */
function weScStellenReiheHtml(ziel, label) {
  const sel = (stelle, optionen, titel) =>
    '<select class="eingabefeld" data-sc-stelle="' + ziel + stelle + '" title="' + titel + '" style="width:auto;max-width:210px">'
    + '<option value="">— ' + titel + ' —</option>'
    + optionen.map(([v, t]) => '<option value="' + v + '">' + t + '</option>').join('')
    + '</select>';
  return '<div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin-top:4px"><span class="we-chip-label" style="flex-basis:auto">' + label + ':</span>'
    + sel(100, [[1, '100 — Korr. links (Gutteil rechts)'], [2, '200 — Korr. rechts (Gutteil links)'], [3, '300 — keine Korrektur']], 'Radiuskorrektur (100er)')
    + sel(10, [[1, '10 — Ueberschnitt ⊕'], [2, '20 — Unterschnitt ⊖'], [0, '0 — Maschinenregel']], 'Schnittende (10er)')
    + sel(1, [[1, '1 — zyl. Fraeser / Standard-Saegeblatt'], [2, '2 — Fraeser m. Fase / fein gezahnt'],
              [3, '3 — Nutfraeser / Kettensaege'], [4, '4 — Markierfraeser']], 'Werkzeug (1er)')
    + '</div>';
}
function ovScZerlegen(i) {
  i = Math.max(0, Math.round(Number(i) || 0));
  return { werkzeug: i % 10, schnitt: Math.floor(i / 10) % 10,
           korrektur: Math.floor(i / 100) % 10, lauf: Math.floor(i / 1000) % 10 };
}
let ovVorschlagFeld = null;
function ovVorschlaegeAktualisieren() {
  const feld = document.getElementById('weFeld').value;
  const info = WE_FELD_INFO[feld] || {};
  document.getElementById('weScStellen').style.display = feld === 'steuercode' ? '' : 'none';
  if (feld === ovVorschlagFeld) return;
  ovVorschlagFeld = feld;
  const such = info.text ? [] : ovVorhandeneWerte(feld);
  const ersatz = info.text ? [] : ovErsatzVorschlaege(feld);
  const suchEl = document.getElementById('weSuchVorschlaege'), ersatzEl = document.getElementById('weErsatzVorschlaege');
  suchEl.innerHTML = weVorschlagChipsHtml('Such', such, 'Vorhanden (alle Dateien)');
  suchEl.style.display = such.length ? '' : 'none';
  ersatzEl.innerHTML = weVorschlagChipsHtml('Ersatz', ersatz, 'Ersatz-Vorschlaege');
  ersatzEl.style.display = ersatz.length ? '' : 'none';
}
function ovScStellenBauen(ziel) {
  const lese = st => {
    const el = document.querySelector('[data-sc-stelle="' + ziel + st + '"]');
    return !el || el.value === '' ? null : parseInt(el.value, 10);
  };
  const korrektur = lese(100), schnitt = lese(10), werkzeug = lese(1);
  if (korrektur == null || schnitt == null || werkzeug == null) return;
  const feldEl = document.getElementById(ziel === 'Such' ? 'weSuchwert' : 'weErsatzwert');
  const alt = parseFloat(feldEl.value);
  const lauf = isNaN(alt) ? 0 : ovScZerlegen(alt).lauf;
  feldEl.value = lauf * 1000 + korrektur * 100 + schnitt * 10 + werkzeug;
  werteErsetzenVorschauAktualisieren();
}
function ovScStellenNachziehen() {
  for (const [ziel, id] of [['Such', 'weSuchwert'], ['Ersatz', 'weErsatzwert']]) {
    const w = parseFloat(document.getElementById(id).value);
    const t = isNaN(w) ? null : ovScZerlegen(w);
    for (const [st, key] of [[100, 'korrektur'], [10, 'schnitt'], [1, 'werkzeug']]) {
      const el = document.querySelector('[data-sc-stelle="' + ziel + st + '"]');
      if (el) el.value = t == null ? '' : String(t[key]);
    }
  }
}
function werteErsetzenOptionenLesen() {
  const feld = document.getElementById('weFeld').value;
  const info = WE_FELD_INFO[feld] || {};
  const suchwert = info.text ? document.getElementById('weSuchwert').value : parseFloat(document.getElementById('weSuchwert').value);
  const ersatzwert = info.text ? document.getElementById('weErsatzwert').value : parseFloat(document.getElementById('weErsatzwert').value);
  const textModusEl = document.querySelector('input[name="weTextModus"]:checked');
  return Object.assign({
    feld, suchwert, ersatzwert,
    toleranz: parseFloat(document.getElementById('weToleranz').value) || 0.01,
    textModus: textModusEl ? textModusEl.value : 'exakt',
    lagenFilter: info.gruppe !== 'beam' ? Array.from(document.querySelectorAll('.we-lage:checked')).map(el => el.value) : null,
    typFilter: info.gruppe === 'op' ? Array.from(document.querySelectorAll('.we-typ:checked')).map(el => el.value) : null,
    bereich: 'alle'
  }, (info.gruppe === 'platte' && feld !== 'name')
    ? weNameFilterLesen(document.getElementById('weNameFilter').value)
    : { plattenNameFilter: null, plattenNameModus: 'exakt' });
}
function weWerteFehlen(opt) { return (WE_FELD_INFO[opt.feld] || {}).text ? (opt.suchwert == null || opt.suchwert === '') : isNaN(opt.suchwert); }
function weErsatzFehlt(opt) { return (WE_FELD_INFO[opt.feld] || {}).text ? false : isNaN(opt.ersatzwert); }
/* Arbeitspaket 4 (WIRKUNG): gleiche Auswahl-Einschraenkung wie bei den
   Automatiken oben - ohne Auswahl unveraendert "alle geladenen Dateien". */
function weVorschauLeeren(text) {
  document.getElementById('weVorschauTitel').textContent = 'Quelltext-Vorschau';
  document.getElementById('weVorschauListe').innerHTML =
    '<div class="we-vorschau-leer">' + escapeHtml(text) + '</div>';
}
async function werteErsetzenVorschauAktualisieren() {
  weFeldUmschalten();
  const opt = werteErsetzenOptionenLesen();
  const anzeige = document.getElementById('weVorschau');
  const indizes = ausgewaehlteDateiIndizes();
  const ziel = indizes ? dateien.filter((d, i) => indizes.has(i)) : dateien;
  if (weWerteFehlen(opt)) { anzeige.textContent = 'Treffer: —'; weVorschauLeeren('Noch keine Treffer — Werte links eingeben.'); return; }
  if (!ziel.length) { anzeige.textContent = 'Treffer: 0 (keine Dateien ' + (indizes ? 'in Auswahl/Filter' : 'geladen') + ')'; weVorschauLeeren('Keine Dateien geladen.'); return; }
  try { await kernSicherstellen(); } catch (fehler) { anzeige.textContent = 'Kern nicht verfügbar.'; weVorschauLeeren('Kern nicht verfügbar.'); return; }
  weScInfoAktualisieren();
  /* Fundstellen-Modus ohne Ersatzwert: Sentinel-Ersetzung (suchwert+1) nur
     zur Positionsbestimmung — gleiche Mechanik wie im Editor-Dialog. */
  const ohneNeu = weErsatzFehlt(opt);
  const vorschauOpt = ohneNeu ? Object.assign({}, opt, { ersatzwert: opt.suchwert + 1 }) : opt;
  const MAX_HUNKS = 40;
  let summe = 0, dateienBetroffen = 0, objekte = 0, mehr = 0;
  const teile = [];
  for (const d of ziel) {
    kernModellSetzen(d.text, d.name, d.encoding, d.hatteBom);
    const v = kern.werteErsetzenVorschauHunks(vorschauOpt, Math.max(1, MAX_HUNKS - objekte));
    if (!v.treffer) continue;
    summe += v.treffer; dateienBetroffen++;
    if (objekte < MAX_HUNKS) {
      teile.push('<div class="we-datei-kopf">📄 ' + escapeHtml(d.name) + ' — ' + v.treffer + ' Treffer</div>');
      teile.push(v.hunks.map(h => ohneNeu ? kern.weHunkFundHtml(h) : kern.weHunkHtml(h)).join(''));
      mehr += v.mehr;
    } else {
      mehr += v.objekte;
    }
    objekte += v.objekte;
  }
  anzeige.textContent = 'Treffer: ' + summe + ' in ' + dateienBetroffen + ' von ' + ziel.length + ' Datei(en)' + bereichZusatz(indizes);
  document.getElementById('weVorschauTitel').textContent = 'Quelltext-Vorschau — ' + objekte + ' Objekt(e)';
  if (!summe) { weVorschauLeeren('Keine Treffer fuer die aktuellen Werte/Filter.'); return; }
  let html = teile.join('');
  if (ohneNeu) html = '<div class="we-vorschau-leer">Nur Fundstellen — Ersatzwert eingeben fuer die Vorher/Nachher-Ansicht.</div>' + html;
  if (mehr) html += '<div class="we-zeile-dim">… +' + mehr + ' weitere Objekt(e) (Vorschau gekuerzt — ersetzt werden ALLE Treffer)</div>';
  document.getElementById('weVorschauListe').innerHTML = html;
}
async function werteErsetzenAusfuehren() {
  const opt = werteErsetzenOptionenLesen();
  if (weWerteFehlen(opt) || weErsatzFehlt(opt)) { hinweisAnzeigen('Such- und Ersatzwert angeben.', 'warnung'); return; }
  const indizes = ausgewaehlteDateiIndizes();
  const ziel = indizes ? dateien.map((d, i) => i).filter(i => indizes.has(i)) : dateien.map((d, i) => i);
  if (!ziel.length) { hinweisAnzeigen('Keine Dateien geladen.', 'info'); return; }
  try { await kernSicherstellen(); } catch (fehler) { hinweisAnzeigen('Kern nicht verfügbar: ' + fehler.message, 'fehler'); return; }
  let summe = 0, geaendertAnzahl = 0;
  const vorher = aenderungStandMerken();   /* v0.13: ein Rueckgaengig-Schritt */
  fortschrittZeigen('Werte ersetzen', 0, ziel.length);
  for (let n = 0; n < ziel.length; n++) {
    const i = ziel[n];
    const d = dateien[i];
    fortschrittZeigen('Werte ersetzen', n + 1, ziel.length, d.name);
    await warteKurz();
    kernModellSetzen(d.text, d.name, d.encoding, d.hatteBom);
    const r = kern.werteErsetzen(Object.assign({}, opt, { nurVorschau: false }));
    if (r.treffer) {
      summe += r.treffer; geaendertAnzahl++;
      d.text = kernExportText(); d.geaendert = true;
      dateiAktualisieren(i);
    }
  }
  fortschrittVerbergen();
  aenderungAufzeichnen('Werte ersetzen', vorher);
  document.getElementById('werteErsetzenModal').style.display = 'none';
  ansichtAktualisieren();
  hinweisAnzeigen(summe + ' Wert(e) in ' + geaendertAnzahl + ' Datei(en)' + bereichZusatz(indizes) + ' ersetzt.', summe ? 'erfolg' : 'info');
}
function werteErsetzenOeffnen() {
  document.getElementById('werteErsetzenModal').style.display = 'flex';
  /* AP-WE6: Stellen-Dropdowns einmalig einsetzen, Chips beim Oeffnen neu */
  const reihen = document.getElementById('weScStellenReihen');
  if (reihen && !reihen.childElementCount) {
    reihen.innerHTML = weScStellenReiheHtml('Such', 'Suchen') + weScStellenReiheHtml('Ersatz', 'Ersetzen durch');
    document.querySelectorAll('[data-sc-stelle]').forEach(el =>
      el.addEventListener('change', () => ovScStellenBauen(el.dataset.scStelle.indexOf('Such') === 0 ? 'Such' : 'Ersatz')));
  }
  ovVorschlagFeld = null;
  weLagenChipsRendern();
  weNameFilterRendern();
  weFeldUmschalten();
  auswahlHinweisRendern();
  werteErsetzenVorschauAktualisieren();
}
document.getElementById('btnWerteErsetzen').addEventListener('click', werteErsetzenOeffnen);
/* WP-J (Anwenderwunsch): das weggeklickte Befunde-Popup jederzeit wieder
   oeffnen — die Zaehlung ist immer aktuell, weil dateiAktualisieren die
   Kern-Pruefungen nach jeder Aenderung neu laufen laesst. */
document.getElementById('btnGravPopup').addEventListener('click', () => {
  if (!dateien.length) { hinweisAnzeigen('Keine Dateien geladen.', 'warnung'); return; }
  if (!gravierendeBefundePopupOversight())
    hinweisAnzeigen('Keine gravierenden Befunde (P-19 bis P-23) in den geladenen Dateien.', 'erfolg');
});
document.getElementById('weAbbrechen').addEventListener('click', () => { document.getElementById('werteErsetzenModal').style.display = 'none'; });
document.getElementById('weAusfuehren').addEventListener('click', werteErsetzenAusfuehren);
/* Quelltext-Vorschau ein-/ausklappbar (Zustand haelt fuer die Sitzung) */
document.getElementById('weVorschauToggle').addEventListener('click', () => {
  const panel = document.getElementById('weVorschauPanel');
  const offen = panel.classList.contains('zu');
  panel.classList.toggle('zu', !offen);
  document.querySelector('#werteErsetzenModal .we-fenster').classList.toggle('ohne-vorschau', !offen);
  document.getElementById('weVorschauToggle').textContent = offen ? '⯆ Quelltext einklappen' : '⯈ Quelltext anzeigen';
});
['weSuchwert', 'weErsatzwert', 'weFeld', 'weToleranz', 'weNameFilter'].forEach(id =>
  document.getElementById(id).addEventListener('input', werteErsetzenVorschauAktualisieren));
/* Lagen-/Typ-Checkboxen und Textmodus-Radios sind dynamisch (Lagen) bzw. erst
   nach dem Feld-Umschalten sichtbar — Delegation auf das Modal-Fenster statt
   Einzel-Listener je Element. */
document.querySelector('#werteErsetzenModal .modal-fenster').addEventListener('input', ev => {
  if (ev.target.classList.contains('we-lage') || ev.target.classList.contains('we-typ')
      || ev.target.name === 'weTextModus') werteErsetzenVorschauAktualisieren();
});
/* AP-WE6: Chip-Klick uebernimmt den Wert; Zahlen-Eingabe zieht die
   Steuercode-Stellen-Dropdowns nach */
document.querySelector('#werteErsetzenModal .modal-fenster').addEventListener('click', ev => {
  const chip = ev.target.closest('[data-chip-ziel]');
  if (!chip) return;
  document.getElementById(chip.dataset.chipZiel === 'Such' ? 'weSuchwert' : 'weErsatzwert').value = chip.dataset.chipWert;
  ovScStellenNachziehen();
  werteErsetzenVorschauAktualisieren();
});
['weSuchwert', 'weErsatzwert'].forEach(id =>
  document.getElementById(id).addEventListener('input', () => {
    if (document.getElementById('weFeld').value === 'steuercode') ovScStellenNachziehen();
  }));
/* Das globale Tastenkuerzel (Strg/Cmd+H) ist Teil des zentralen Kuerzel-
   Handlers weiter unten (Arbeitspaket 5, tastenkuerzelEinrichten()) - hier
   nicht mehr doppelt registriert. */

