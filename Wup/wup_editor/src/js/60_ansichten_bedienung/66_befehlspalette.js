/* =====================================================================
   GUI-F — BEFEHLSPALETTE (Strg+K): ein Suchfeld ueber alle Funktionen.
   Das Register speist sich aus den bestehenden Funktionen — hier stehen
   nur Verweise, keine eigene Logik. brauchtModell filtert Befehle aus,
   solange keine Datei geladen ist.
   ===================================================================== */
function paletteBefehle() {
  const b = (titel, hinweis, kuerzel, aktion, brauchtModell) => ({ titel, hinweis, kuerzel, aktion, brauchtModell });
  return [
    b('Datei oeffnen…', 'WUP-Datei laden', 'Alt+N', () => document.getElementById('dateiInput').click(), false),
    b('WUP exportieren', 'aktuellen Stand als .wup speichern', 'Alt+E', wupExportieren, true),
    b('An WupWorks5 senden', 'direkt per HTTP uebertragen', '', wupworksSendenKlick, true),
    b('Export-Einstellungen…', 'Dateiname, Diff-Ansicht, WupWorks5', '', exportEinstellungenOeffnen, true),
    b('Werte ersetzen…', 'Suchen & Ersetzen ueber Datenfelder', 'Strg+H', werteErsetzenOeffnen, true),
    b('Gravierende Befunde anzeigen', 'P-19/P-21/P-22/P-23/P-24-Popup erneut oeffnen', '', () => {
      pruefungenAusfuehren(); fehlerLogRendern();
      if (!gravierendeBefundePopup(true)) hinweisAnzeigen('Keine gravierenden Befunde.', 'erfolg');
    }, true),
    b('Automatik: Auto-Über-/Unterschnitt', 'alle Konturen pruefen und korrigieren', 'Alt+A 1', f1AlleAusfuehren, true),
    b('Automatik: Auto-Sperrflaechen', 'PSF unter zerspanenden Bearbeitungen', 'Alt+A 2', () => f3AutoPsf(), true),
    b('Automatik: Auto-Kontur', 'Konturen verketten, PSG zusammenfassen', 'Alt+A 3', autoKonturVerbinden, true),
    b('Automatik: Richtung', 'Richtungs-Bohrung BOZ in Ober-/Untergurten', 'Alt+A 4', autoRichtungAusfuehren, true),
    b('Automatik: Ecken-PML', 'zwei 50-mm-Markierlinien zum Winkelpunkt vor einer Riegelwerk-Ecke (Ruecksprung automatisch aus der Platte oder fester Wert)', 'Alt+A 5', eckenPmlStarten, true),
    b('Automatik: Freistiche', 'an unterschnittenen Innenecken ohne Freistich (vorhandene werden erkannt)', 'Alt+A 6', f2SammelAktion, true),
    b('Automatik-Einstellungen…', 'Parameter aller sechs Automatiken', 'Alt+A 7', automatikEinstellungenOeffnen, true),
    b('Gerätebelegung…', 'Nagel-/Klammergeräte je NR-Index und ihr Sperrflächen-Abstand', '', () => geraetebelegungOeffnen(false), false),
    b('Werkzeug: Auswahl', '', 'V', () => werkzeugSetzen('auswahl'), true),
    b('Werkzeug: Messen', '', 'M', () => werkzeugSetzen('messen'), true),
    b('Werkzeug: Verschieben', '', 'K', () => werkzeugSetzen('kante'), true),
    b('Werkzeug: Neue Kontur', 'Art/Form oben waehlen, Klicks setzen Punkte', 'N', () => werkzeugSetzen('neue-kontur'), true),
    ...Object.entries(NEU_FOLGE_TASTEN).map(([taste, art]) => b('Neu: ' + NEU_ART_TEXT[art] + ' (' + art + ')',
      'mit zuletzt genutzter Form und Schicht', 'N ' + taste.toUpperCase(), () => neuKonturMitArtStarten(art), true)),
    b('Ansicht einpassen', 'Zoom auf das ganze Element', 'Leer', () => { zoomEinpassen(); svgRendern(); }, true),
    b('Horizontalschnitt umschalten', '', 'H', () => schnittUmschalten('h'), true),
    b('Vertikalschnitt umschalten', '', '⇧H', () => schnittUmschalten('v'), true),
    b('3D-Ansicht umschalten', '', 'D', dreiDUmschalten, true),
    b('Ansicht: rgw_Innenansicht', 'Anschlag unten links', '', () => paletteAnsicht('innen'), true),
    b('Ansicht: pla_Aussenansicht (X-Spiegel)', 'Anschlag unten links', '', () => paletteAnsicht('aussen'), true),
    b('Ansicht: pli_Innenansicht (Y-Spiegel)', 'Anschlag oben links', '', () => paletteAnsicht('spiegel-y'), true),
    b('Rueckgaengig', '', 'Alt+Z', rueckgaengig, true),
    b('Wiederholen', '', 'Alt+Y', wiederholen, true),
    /* GUI-H: die Anzeige-Umschalter der Werkzeugleiste auch per Palette */
    ...ANSICHT_SCHALTER.map(s => b('Anzeige: ' + s.text.replace('☐ ', '') + ' umschalten', s.titel, '',
      () => { ui[s.flag] = !ui[s.flag]; ansichtChipsRendern(); s.neu(); }, true))
  ];
}
function paletteAnsicht(wert) {
  const sel = document.getElementById('selAnsicht');
  sel.value = wert;
  sel.dispatchEvent(new Event('change'));
}
/* Suche unabhaengig von Gross/Klein und Umlaut-Schreibweise: Umlaute erst
   auf Digraphen (ü→ue), dann Digraphen auf Einzelvokale (ue→u) falten —
   beide Seiten gleich behandelt treffen "uber", "ueber" und "über" identisch. */
function paletteNormal(s) {
  return String(s).toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .replace(/ae/g, 'a').replace(/oe/g, 'o').replace(/ue/g, 'u');
}
let paletteAktiv = 0;
function paletteRendern() {
  const filterText = paletteNormal(document.getElementById('paletteEingabe').value.trim());
  const liste = paletteBefehle().filter(b => !b.brauchtModell || modell)
    .filter(b => !filterText || paletteNormal(b.titel + ' ' + b.hinweis).includes(filterText))
    /* Titel-Treffer vor reinen Hinweis-Treffern (stabile Sortierung) */
    .sort((a, b) => (filterText ? (paletteNormal(a.titel).includes(filterText) ? 0 : 1)
      - (paletteNormal(b.titel).includes(filterText) ? 0 : 1) : 0));
  paletteAktiv = Math.max(0, Math.min(paletteAktiv, liste.length - 1));
  document.getElementById('paletteListe').innerHTML = liste.length ? liste.map((b, i) =>
    '<div class="palette-eintrag' + (i === paletteAktiv ? ' aktiv' : '') + '" data-palette="' + i + '">'
    + escapeHtml(b.titel) + (b.hinweis ? ' <span class="palette-hinweis">' + escapeHtml(b.hinweis) + '</span>' : '')
    + (b.kuerzel ? '<span class="palette-kuerzel">' + escapeHtml(b.kuerzel) + '</span>' : '') + '</div>').join('')
    : '<div class="mini-hinweis" style="padding:6px 10px">Kein Befehl passt.</div>';
  const aktivEl = document.querySelector('.palette-eintrag.aktiv');
  if (aktivEl) aktivEl.scrollIntoView({ block: 'nearest' });
  return liste;
}
function paletteOeffnen() {
  const p = document.getElementById('palette');
  p.classList.remove('versteckt');
  const inp = document.getElementById('paletteEingabe');
  inp.value = '';
  paletteAktiv = 0;
  paletteRendern();
  inp.focus();
}
function paletteSchliessen() {
  document.getElementById('palette').classList.add('versteckt');
  /* Fokus loesen — ein fokussiertes (verstecktes) Eingabefeld wuerde sonst
     alle globalen Tastenkuerzel blockieren (inEingabe-Guard) */
  document.getElementById('paletteEingabe').blur();
}
function paletteAusfuehren(liste) {
  const befehl = liste[paletteAktiv];
  if (!befehl) return;
  paletteSchliessen();
  befehl.aktion();
}
/* Feedback L (Anwenderwunsch): die frueher ueberlange Kuerzel-Zeile ist
   jetzt ein KLAPPBARES PANEL, nach Themen sortiert; der Auf/Zu-Zustand
   ueberlebt die Sitzung (localStorage). Die Fusszeile bleibt schlank. */
function kuerzelPanelHtml() {
  const gruppen = new Map();
  for (const k of TASTENKUERZEL) {
    const thema = k.thema || 'Allgemein';
    if (!gruppen.has(thema)) gruppen.set(thema, []);
    gruppen.get(thema).push(k);
  }
  return [...gruppen.entries()].map(([thema, ks]) =>
    '<div class="kuerzel-gruppe"><div class="kuerzel-thema">' + thema + '</div>'
    + ks.map(k => '<div class="kuerzel-zeile"><span class="kuerzel-taste">'
      + (k.alt ? '<kbd>Alt</kbd>+<kbd>' + k.taste.toUpperCase() + '</kbd>' : '<kbd>' + k.taste + '</kbd>')
      + '</span><span>' + k.beschriftung + '</span></div>').join('')
    + '</div>').join('');
}
function kuerzelLeisteFuellen() {
  const offen = speicherLaden('kuerzelPanelOffen', false);
  document.getElementById('kuerzelLeiste').innerHTML =
    '<span class="mini-hinweis"><kbd>Strg</kbd>+<kbd>K</kbd> Befehle · Rechtsklick Menü</span> '
    + '<button class="schaltflaeche schaltflaeche-klein schaltflaeche-neben" id="btnKuerzel" '
    + 'title="Tastenkuerzel-Uebersicht ein-/ausblenden (bleibt fuer die naechste Sitzung gespeichert)">⌨ Kürzel '
    + (offen ? '▾' : '▸') + '</button>';
  const panel = document.getElementById('kuerzelPanel');
  panel.classList.toggle('versteckt', !offen);
  if (offen) panel.innerHTML = kuerzelPanelHtml();
  document.getElementById('btnKuerzel').onclick = () => {
    speicherSichern('kuerzelPanelOffen', !offen);
    kuerzelLeisteFuellen();
  };
}

