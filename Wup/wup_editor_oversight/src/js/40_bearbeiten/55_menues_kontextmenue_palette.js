/* =====================================================================
   ANGLEICHUNG an wup_editor.html — Automatiken-Menue, Kontextmenue,
   Befehlspalette, Kuerzel-Panel. Aufbau und Klassen absichtlich identisch
   zum Editor (v2.35–v2.45), damit beide Werkzeuge gleich zu bedienen sind.
   ===================================================================== */
/* Automatiken-Menue: Eintraege behalten ihre IDs (Listener oben), hier nur
   Auf/Zu. Klick daneben per pointerdown — Karten/Canvas unterdruecken click. */
const ovAutoMenue = document.getElementById('automatikMenue');
document.getElementById('btnAutomatiken').addEventListener('click', ev => {
  ev.stopPropagation();
  ovAutoMenue.classList.toggle('versteckt');
});
ovAutoMenue.addEventListener('click', ev => {
  if (ev.target.closest('.menue-eintrag')) ovAutoMenue.classList.add('versteckt');
});
document.addEventListener('pointerdown', ev => {
  if (!ovAutoMenue.classList.contains('versteckt') && !ev.target.closest('.menue-wrap'))
    ovAutoMenue.classList.add('versteckt');
});

/* --- Kontextmenue (wie Editor §17, hier fuer die Chip-Reihen) --- */
function kontextmenueSchliessen() {
  document.getElementById('kontextmenue').classList.add('versteckt');
}
function kontextmenueOeffnen(x, y, kopf, eintraege) {
  const km = document.getElementById('kontextmenue');
  const teile = kopf ? ['<div class="km-kopf">' + escapeHtml(kopf) + '</div>'] : [];
  km._aktionen = {};
  eintraege.forEach((e, i) => {
    if (e.trenner) { teile.push('<div class="km-trenner"></div>'); return; }
    const id = 'km' + i;
    if (e.aktion && !e.aus) km._aktionen[id] = e.aktion;
    teile.push('<div class="km-eintrag' + (e.aus ? ' deaktiviert' : '') + '" data-km="' + id + '">'
      + '<span class="km-icon">' + (e.icon || '') + '</span>' + escapeHtml(e.text) + '</div>');
  });
  km.innerHTML = teile.join('');
  km.classList.remove('versteckt');
  const r = km.getBoundingClientRect();
  km.style.left = Math.max(4, Math.min(x, window.innerWidth - r.width - 6)) + 'px';
  km.style.top = Math.max(4, Math.min(y, window.innerHeight - r.height - 6)) + 'px';
}
/* Anzahl je Bearbeitungstyp bzw. je Lage ueber ALLE geladenen Dateien —
   speist die Info-Zeilen der Chip-Menues (Editor: kontextFuerLagenChip). */
function ovAnzahlJeTyp(typ) {
  let n = 0;
  for (const d of dateien) for (const l of ((d._vorschau && d._vorschau.layers) || []))
    n += l.ops.filter(o => o.kw === typ).length;
  return n;
}
function ovLagenInfo(lageId) {
  let platten = 0, ops = 0, name = '', idx = null;
  for (const d of dateien) for (const l of ((d._vorschau && d._vorschau.layers) || [])) {
    if (l.id !== lageId) continue;
    platten += l.plates.length; ops += l.ops.length;
    if (!name && l.plates[0]) { name = l.plates[0].name || ''; idx = l.plates[0].materialIdx; }
  }
  return { platten, ops, name, idx };
}
function ovChipKontextmenue(ev) {
  const lagenChip = ev.target.closest('#chipsLagen .filter-chip');
  const opChip = ev.target.closest('#chipsBearbeitungen .filter-chip');
  const dreieck = ev.target.closest('[data-seite-dreieck]');
  let menue = null;
  if (dreieck) {
    const z = ovSeiteAktiv();
    menue = { kopf: 'Seiten-Anzeige', eintraege: [
      { icon: z === 'beide' ? '●' : '○', text: 'Beide Seiten', aktion: () => ovSeiteSetzen('beide') },
      { icon: z === 'innen' ? '●' : '○', text: 'Nur Innen (PLI)', aktion: () => ovSeiteSetzen('innen') },
      { icon: z === 'aussen' ? '●' : '○', text: 'Nur Aussen (PLA)', aktion: () => ovSeiteSetzen('aussen') }
    ]};
  } else if (lagenChip) {
    const id = lagenChip.dataset.lageChip;
    const info = ovLagenInfo(id);
    const alle = Object.keys(sichtbarkeit.lagen);
    menue = { kopf: id, eintraege: [
      { icon: 'ℹ', aus: true, text: info.name
        ? info.name + (info.idx != null ? ' · Index ' + info.idx : '') : 'Keine Platten' },
      { icon: '·', aus: true, text: info.platten + ' Platten · ' + info.ops + ' Bearbeitungen (alle Dateien)' },
      { trenner: true },
      { icon: '👁', text: sichtbarkeit.lagen[id] ? 'Ausblenden' : 'Einblenden',
        aktion: () => { sichtbarkeit.lagen[id] = !sichtbarkeit.lagen[id]; ansichtAktualisieren(); } },
      { icon: '◉', text: 'Solo (nur diese)', aktion: () => {
        for (const k of alle) sichtbarkeit.lagen[k] = (k === id);
        ansichtAktualisieren(); } },
      { icon: '☰', text: 'Alle Lagen anzeigen', aktion: () => {
        for (const k of alle) sichtbarkeit.lagen[k] = true;
        ansichtAktualisieren(); } }
    ]};
  } else if (opChip) {
    const typ = opChip.dataset.opChip;
    menue = { kopf: typ + ' — ' + (OV_KW_KLARTEXT[typ] || ''), eintraege: [
      { icon: 'ℹ', aus: true, text: ovAnzahlJeTyp(typ) + '× in allen geladenen Dateien' },
      { trenner: true },
      { icon: '◉', text: 'Solo (nur ' + typ + ' anzeigen)', aktion: () => {
        for (const t of BEARBEITUNGS_TYPEN) sichtbarkeit.bearbeitungen[t] = (t === typ);
        ansichtAktualisieren(); } },
      { icon: '☰', text: 'Alle Typen anzeigen', aktion: () => {
        for (const t of BEARBEITUNGS_TYPEN) sichtbarkeit.bearbeitungen[t] = true;
        ansichtAktualisieren(); } }
    ]};
  }
  if (!menue) return;
  ev.preventDefault();
  kontextmenueOeffnen(ev.clientX, ev.clientY, menue.kopf, menue.eintraege);
}
const OV_KW_KLARTEXT = { NR: 'Nagelreihe', PAF: 'Fraeskontur', PSG: 'Saegekontur',
  PSF: 'Sperrflaeche', PSZ: 'Sperrzone', PML: 'Markierlinie' };
document.addEventListener('contextmenu', ev => {
  if (ev.target.closest('#chipZeile')) ovChipKontextmenue(ev);
});
document.getElementById('kontextmenue').addEventListener('click', ev => {
  const eintrag = ev.target.closest('[data-km]');
  if (!eintrag) return;
  const km = document.getElementById('kontextmenue');
  const aktion = km._aktionen && km._aktionen[eintrag.dataset.km];
  kontextmenueSchliessen();
  if (aktion) aktion();
});
document.addEventListener('pointerdown', ev => {
  if (!ev.target.closest('.kontextmenue')) kontextmenueSchliessen();
}, true);

/* --- Seiten-Zustand aus den Lagen-Chips abgeleitet (Editor v2.45) --- */
function ovSeiteAktiv() {
  const ids = Object.keys(sichtbarkeit.lagen);
  if (!ids.length) return 'beide';
  const innen = ids.filter(id => /^S?PLI/i.test(id)), aussen = ids.filter(id => !/^S?PLI/i.test(id));
  const alleAn = ls => ls.length > 0 && ls.every(id => sichtbarkeit.lagen[id]);
  const alleAus = ls => ls.every(id => !sichtbarkeit.lagen[id]);
  if (alleAn(innen) && aussen.length && alleAus(aussen)) return 'innen';
  if (alleAn(aussen) && innen.length && alleAus(innen)) return 'aussen';
  return 'beide';
}
function ovSeiteSetzen(seite) {
  for (const id of Object.keys(sichtbarkeit.lagen))
    sichtbarkeit.lagen[id] = seite === 'beide' ? true : (/^S?PLI/i.test(id) === (seite === 'innen'));
  ansichtAktualisieren();
}

/* --- Befehlspalette (Strg+K, Editor v2.39) --- */
function ovPaletteBefehle() {
  const b = (titel, hinweis, kuerzel, aktion, brauchtDateien) => ({ titel, hinweis, kuerzel, aktion, brauchtDateien });
  return [
    b('Dateien öffnen…', 'mehrere .wup-Dateien laden', '', () => document.getElementById('dateiInput').click(), false),
    b('Rückgängig', rueckStapel.length ? rueckStapel[rueckStapel.length - 1].titel : 'nichts zu tun', 'Alt+Z', rueckgaengig, true),
    b('Wiederholen', vorStapel.length ? vorStapel[vorStapel.length - 1].titel : 'nichts zu tun', 'Alt+Y', wiederholen, true),
    b('Wand suchen…', 'Suchfeld über den Karten (Name, ELN, ZNR, Auftrag)', 'Strg+F', sucheFokussieren, true),
    ...KARTEN_ANSICHTEN.map(a => b('Ansicht: ' + a.text, a.titel, '', () => ansichtSetzen(a.id), true)),
    ...KARTEN_SORTIERUNGEN.map(x => b('Sortieren nach ' + x.text, x.ab ? 'absteigend' : 'aufsteigend', '', () => sortierungSetzen(x.id, false), true)),
    b('Filter: nur Wände mit Fehlern', '', '', () => { kartenFilter.fehler = 'mit'; ansichtAktualisieren(); }, true),
    b('Filter: nur geänderte Wände', 'noch nicht exportiert', '', () => { kartenFilter.nurGeaendert = true; ansichtAktualisieren(); }, true),
    b('Suche und Filter zurücksetzen', 'alle Wände anzeigen', '', filterZuruecksetzen, true),
    b('Alle exportieren', 'geänderte Dateien herunterladen', 'E', alleExportieren, true),
    b('Werte ersetzen…', 'Suchen & Ersetzen über alle Dateien', 'Strg+H', werteErsetzenOeffnen, true),
    b('Befunde prüfen', 'gravierende Befunde (P-19 bis P-23) erneut melden', '', () => {
      if (!gravierendeBefundePopupOversight())
        hinweisAnzeigen('Keine gravierenden Befunde in den geladenen Dateien.', 'erfolg');
    }, true),
    b('Automatik: Auto Über-/Unterschnitt', 'alle Konturen prüfen und korrigieren', '1', f1Klick, true),
    b('Automatik: Freistiche', 'an unterschnittenen Innenecken einfügen', '2', f2Klick, true),
    b('Automatik: Auto-Sperrflächen', 'PSF unter zerspanenden Bearbeitungen', '3', f3Klick, true),
    b('Automatik: Auto-Kontur', 'Konturen verketten, PSG zusammenfassen', '4', autoKonturKlick, true),
    b('Quelltext/Struktur umschalten', 'Panel links ein-/ausklappen', 'Q', () => quelltextPanelUmschalten(), true),
    b('Alle Karten auswählen', '', 'Strg+A', () => { auswahlAlle(); hinweisAnzeigen(auswahl.size + ' Karte(n) ausgewählt.', 'info'); }, true),
    b('Auswahl leeren', '', 'Esc', () => auswahlLeeren(), true),
    b('Lagen: nur Innen (PLI)', 'Außenlagen ausblenden', '', () => ovSeiteSetzen('innen'), true),
    b('Lagen: nur Außen (PLA)', 'Innenlagen ausblenden', '', () => ovSeiteSetzen('aussen'), true),
    b('Lagen: alle anzeigen', '', '', () => ovSeiteSetzen('beide'), true),
    b('Hell/Dunkel umschalten', '', '', designWechseln, false)
  ];
}
/* Umlaut-tolerante Suche: erst auf Digraphen, dann auf Einzelvokale falten —
   beide Seiten gleich behandelt trifft "uber" = "ueber" = "über". */
function ovPaletteNormal(s) {
  return String(s).toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .replace(/ae/g, 'a').replace(/oe/g, 'o').replace(/ue/g, 'u');
}
let ovPaletteAktiv = 0;
function ovPaletteRendern() {
  const filterText = ovPaletteNormal(document.getElementById('paletteEingabe').value.trim());
  const liste = ovPaletteBefehle().filter(x => !x.brauchtDateien || dateien.length)
    .filter(x => !filterText || ovPaletteNormal(x.titel + ' ' + x.hinweis).includes(filterText))
    .sort((a, b) => (filterText ? (ovPaletteNormal(a.titel).includes(filterText) ? 0 : 1)
      - (ovPaletteNormal(b.titel).includes(filterText) ? 0 : 1) : 0));
  ovPaletteAktiv = Math.max(0, Math.min(ovPaletteAktiv, liste.length - 1));
  document.getElementById('paletteListe').innerHTML = liste.length ? liste.map((x, i) =>
    '<div class="palette-eintrag' + (i === ovPaletteAktiv ? ' aktiv' : '') + '" data-palette="' + i + '">'
    + escapeHtml(x.titel) + (x.hinweis ? ' <span class="palette-hinweis">' + escapeHtml(x.hinweis) + '</span>' : '')
    + (x.kuerzel ? '<span class="palette-kuerzel">' + escapeHtml(x.kuerzel) + '</span>' : '') + '</div>').join('')
    : '<div class="klein" style="padding:6px 10px">Kein Befehl passt.</div>';
  const aktivEl = document.querySelector('.palette-eintrag.aktiv');
  if (aktivEl) aktivEl.scrollIntoView({ block: 'nearest' });
  return liste;
}
function ovPaletteOeffnen() {
  document.getElementById('palette').classList.remove('versteckt');
  const inp = document.getElementById('paletteEingabe');
  inp.value = ''; ovPaletteAktiv = 0;
  ovPaletteRendern();
  inp.focus();
}
function ovPaletteSchliessen() {
  document.getElementById('palette').classList.add('versteckt');
  /* Fokus loesen — ein fokussiertes verstecktes Feld blockiert sonst die
     globalen Kuerzel (inEingabe-Guard in tastenkuerzelEinrichten). */
  document.getElementById('paletteEingabe').blur();
}
function ovPaletteAusfuehren(liste) {
  const befehl = liste[ovPaletteAktiv];
  if (!befehl) return;
  ovPaletteSchliessen();
  befehl.aktion();
}
document.getElementById('paletteEingabe').addEventListener('input', () => { ovPaletteAktiv = 0; ovPaletteRendern(); });
document.getElementById('paletteEingabe').addEventListener('keydown', ev => {
  ev.stopPropagation();
  if (ev.key === 'Escape') { ovPaletteSchliessen(); return; }
  if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'k') { ev.preventDefault(); ovPaletteSchliessen(); return; }
  if (ev.key === 'ArrowDown') { ev.preventDefault(); ovPaletteAktiv++; ovPaletteRendern(); return; }
  if (ev.key === 'ArrowUp') { ev.preventDefault(); ovPaletteAktiv = Math.max(0, ovPaletteAktiv - 1); ovPaletteRendern(); return; }
  if (ev.key === 'Enter') { ev.preventDefault(); ovPaletteAusfuehren(ovPaletteRendern()); }
});
document.getElementById('paletteListe').addEventListener('click', ev => {
  const zeile = ev.target.closest('[data-palette]');
  if (!zeile) return;
  ovPaletteAktiv = parseInt(zeile.dataset.palette, 10);
  ovPaletteAusfuehren(ovPaletteRendern());
});
document.addEventListener('pointerdown', ev => {
  if (!document.getElementById('palette').classList.contains('versteckt')
      && !ev.target.closest('.palette')) ovPaletteSchliessen();
}, true);

/* --- Kuerzel-Panel nach Themen, Zustand in localStorage (Editor v2.44) --- */
const OV_KUERZEL = [
  { taste: '1 / 2 / 3 / 4', thema: 'Automatiken', text: 'Über-/Unterschnitt · Freistiche · Sperrflächen · Auto-Kontur' },
  { taste: 'Alt+Z / Alt+Y', thema: 'Bearbeiten',  text: 'Rückgängig / Wiederholen' },
  { taste: 'Strg+H',        thema: 'Bearbeiten',  text: 'Werte ersetzen (alle Dateien)' },
  { taste: 'Strg+Klick',    thema: 'Bearbeiten',  text: 'Karte zur Auswahl hinzufügen' },
  { taste: 'Shift+Klick',   thema: 'Bearbeiten',  text: 'Karten-Bereich auswählen' },
  { taste: 'Strg+A',        thema: 'Bearbeiten',  text: 'Alle Karten auswählen' },
  { taste: 'Esc',           thema: 'Bearbeiten',  text: 'Auswahl leeren / Dialog zu' },
  { taste: 'Strg+F',        thema: 'Ansicht',     text: 'Wand suchen (Enter = erster Treffer, Esc = leeren)' },
  { taste: 'Doppelklick',   thema: 'Ansicht',     text: 'Karte/Zeile im Editor öffnen' },
  { taste: 'Q',             thema: 'Ansicht',     text: 'Quelltext/Struktur-Panel' },
  { taste: 'Alt+Klick',     thema: 'Ansicht',     text: 'Chip Solo (nur dieser Typ/diese Lage)' },
  { taste: 'Rechtsklick',   thema: 'Ansicht',     text: 'Chip-Menü (Material, Anzahl, Solo)' },
  { taste: 'E',             thema: 'Datei',       text: 'Alle exportieren' },
  { taste: 'Strg+K',        thema: 'Befehle',     text: 'Befehlspalette' }
];
function ovKuerzelPanelHtml() {
  const gruppen = new Map();
  for (const k of OV_KUERZEL) {
    if (!gruppen.has(k.thema)) gruppen.set(k.thema, []);
    gruppen.get(k.thema).push(k);
  }
  return [...gruppen.entries()].map(([thema, ks]) =>
    '<div class="kuerzel-gruppe"><div class="kuerzel-thema">' + thema + '</div>'
    + ks.map(k => '<div class="kuerzel-zeile"><span class="kuerzel-taste"><kbd>'
      + k.taste + '</kbd></span><span>' + k.text + '</span></div>').join('')
    + '</div>').join('');
}
function ovKuerzelLeisteFuellen() {
  const offen = speicherLaden('kuerzelPanelOffen', false);
  document.getElementById('kuerzelLeiste').innerHTML =
    '<span class="klein"><kbd>Strg</kbd>+<kbd>K</kbd> Befehle · Rechtsklick auf Chip = Menü</span> '
    + '<button type="button" class="schaltflaeche schaltflaeche-neben schaltflaeche-klein" id="btnKuerzel" '
    + 'title="Tastenkuerzel-Uebersicht ein-/ausblenden (bleibt fuer die naechste Sitzung gespeichert)">⌨ Kürzel '
    + (offen ? '▾' : '▸') + '</button>';
  const panel = document.getElementById('kuerzelPanel');
  panel.classList.toggle('versteckt', !offen);
  if (offen) panel.innerHTML = ovKuerzelPanelHtml();
  document.getElementById('btnKuerzel').onclick = () => {
    speicherSichern('kuerzelPanelOffen', !offen);
    ovKuerzelLeisteFuellen();
  };
}

