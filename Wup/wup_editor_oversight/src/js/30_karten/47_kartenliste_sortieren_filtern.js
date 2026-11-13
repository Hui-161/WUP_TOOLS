/* =====================================================================
   §7b KARTENLISTE: ANSICHT, SORTIERUNG, FILTER, SUCHE (v0.13,
   Anwenderwunsch: "zwischen kompakter und detaillierter Ansicht
   umschalten, auch nur eine Listenansicht; Sortierung nach Name,
   Erstellungsdatum, Fehlern, Anzahl Lagen; kleines Filtermenue; Suche —
   ich suche Wand EG20")
   gitterRendern() (§7) holt sich hier die sichtbaren Karten in
   Anzeige-Reihenfolge. Ansicht und Sortierung bleiben gespeichert; Suche
   und Filter bewusst NICHT — nach dem Neuladen waeren sonst Waende
   unsichtbar, ohne dass man weiss warum.
   DATUM: Browser geben kein Erstellungsdatum einer Datei heraus, nur das
   Aenderungsdatum (File.lastModified). Im Datensatz selbst steht ein
   Datum nur selten (17 von 58 Referenzdateien, WupConverter-Importzeit)
   — darum sortiert "Datum" nach dem Dateidatum und sagt das auch so.
   ===================================================================== */
const KARTEN_ANSICHTEN = [
  { id: 'detail',  symbol: '▦', text: 'Detail',  titel: 'Große Karten mit Zeichnung und Kennzahlen' },
  { id: 'kompakt', symbol: '▤', text: 'Kompakt', titel: 'Kleine Karten — viele Wände auf einen Blick (Doppelklick = im Editor öffnen)' },
  { id: 'liste',   symbol: '☰', text: 'Liste',   titel: 'Eine Zeile je Wand — sortieren, gruppieren, filtern wie in CAMBIUM (Listen-Baustein)' }
];
/* ab = absteigend. Standardrichtung je Feld: Name A→Z, sonst "das
   Auffaelligste zuerst" (neueste Datei, meiste Fehler, meiste Lagen). */
const KARTEN_SORTIERUNGEN = [
  { id: 'name',   text: 'Name',                 ab: false },
  { id: 'datum',  text: 'Datum (Datei)',        ab: true },
  { id: 'fehler', text: 'Fehler',               ab: true },
  { id: 'lagen',  text: 'Anzahl Lagen',         ab: true },
  { id: 'laden',  text: 'Reihenfolge (Laden)',  ab: false }
];
const ANSICHT_IDS = KARTEN_ANSICHTEN.map(a => a.id);
let kartenAnsicht = ANSICHT_IDS.includes(speicherLaden('kartenAnsicht', 'detail')) ? speicherLaden('kartenAnsicht', 'detail') : 'detail';
let kartenSortierung = (() => {
  const s = speicherLaden('kartenSortierung', null);
  return s && KARTEN_SORTIERUNGEN.some(x => x.id === s.feld) ? { feld: s.feld, ab: !!s.ab } : { feld: 'name', ab: false };
})();
let kartenSuche = '';
let kartenFilter = { fehler: 'alle', nurGeaendert: false, nurBefunde: false, lagen: [] };

/* ---------- Daten je Karte ---------- */
function kartenLagenAnzahl(d) { return d._vorschau ? d._vorschau.layers.length : 0; }
function kartenBefundeAnzahl(d) {
  const P = (d._vorschau && d._vorschau.pruefungen) || [];
  return P.filter(p => /^P-(19|20|21|22|23|24)$/.test(p.code)).length;
}
/* Suche tolerant gegen Gross/Klein, Leerzeichen, _ - . und Umlaut-
   Schreibweise: "EG 20" = "eg_20" = "EG-20" = "EG20". Leerzeichen gehoeren
   zum Begriff (NICHT "eg" UND "20" — das traf EG-02 ueber ZNR "02"). Jedes
   Feld wird EINZELN durchsucht, damit nichts ueber Feldgrenzen hinweg
   zusammenwaechst. Felder: Dateiname, Wandname, ELN, ZNR, ANR. */
function sucheNormal(s) {
  return ovPaletteNormal(String(s || '')).replace(/[\s_\-.]+/g, '');
}
function kartenSuchFelder(d, wand) {
  const h = (d._vorschau && d._vorschau.header) || {};
  return [d.name, wand.name, h.ELN, h.ZNR, h.ANR].map(sucheNormal).filter(Boolean);
}
function filterAktiv() {
  return !!(kartenSuche.trim() || kartenFilter.fehler !== 'alle' || kartenFilter.nurGeaendert
    || kartenFilter.nurBefunde || kartenFilter.lagen.length);
}
function filterAnzahlAktiv() {
  return (kartenFilter.fehler !== 'alle' ? 1 : 0) + (kartenFilter.nurGeaendert ? 1 : 0)
    + (kartenFilter.nurBefunde ? 1 : 0) + (kartenFilter.lagen.length ? 1 : 0);
}
function kartePasst(e) {
  const d = e.d;
  if (kartenFilter.fehler === 'mit' && !d.fehlerAnzahl) return false;
  if (kartenFilter.fehler === 'ohne' && d.fehlerAnzahl) return false;
  if (kartenFilter.nurGeaendert && !d.geaendert) return false;
  if (kartenFilter.nurBefunde && !kartenBefundeAnzahl(d)) return false;
  if (kartenFilter.lagen.length && !kartenFilter.lagen.includes(Math.min(kartenLagenAnzahl(d), 6))) return false;
  const begriff = sucheNormal(kartenSuche);
  if (begriff && !kartenSuchFelder(d, e.wand).some(f => f.includes(begriff))) return false;
  return true;
}
const kartenNameVergleich = (a, b) =>
  (a.d.name + ' ' + a.wand.name).localeCompare(b.d.name + ' ' + b.wand.name, 'de', { numeric: true, sensitivity: 'base' });
function kartenVergleich(a, b) {
  const feld = kartenSortierung.feld;
  let v = 0;
  if (feld === 'name') v = kartenNameVergleich(a, b);
  else if (feld === 'datum') v = (a.d.datum || 0) - (b.d.datum || 0);
  else if (feld === 'fehler') v = a.d.fehlerAnzahl - b.d.fehlerAnzahl;
  else if (feld === 'lagen') v = kartenLagenAnzahl(a.d) - kartenLagenAnzahl(b.d);
  else v = (a.di - b.di) || (a.wi - b.wi);
  if (kartenSortierung.ab) v = -v;
  /* Gleichstand immer nach Name A→Z — sonst springt die Reihenfolge */
  return v || kartenNameVergleich(a, b) || (a.wi - b.wi);
}
/* Alle Karten (auch ausgeblendete) + die sichtbaren in Anzeige-Reihenfolge. */
function kartenEintraege() {
  const alle = [];
  dateien.forEach((d, di) => {
    if (!d._vorschau) return;
    d.waende.forEach((wand, wi) => alle.push({ d, di, wand, wi, schluessel: kartenSchluessel(di, wi) }));
  });
  const sichtbar = alle.filter(kartePasst).sort(kartenVergleich);
  return { alle, sichtbar };
}

/* ---------- Markup je Ansicht ---------- */
function datumText(ms) {
  if (!ms) return '—';
  const t = new Date(ms);
  const zz = n => String(n).padStart(2, '0');
  return zz(t.getDate()) + '.' + zz(t.getMonth() + 1) + '.' + t.getFullYear() + ' ' + zz(t.getHours()) + ':' + zz(t.getMinutes());
}
function karteElementBauen(e) {
  const { d, di, wand, schluessel } = e;
  const karte = document.createElement('div');
  karte.className = 'karte' + (auswahl.has(schluessel) ? ' ausgewaehlt' : '');
  karte.dataset.schluessel = schluessel;
  const svg = kartenSvgErzeugen(d._vorschau, wand);
  const geaendertPunkt = d.geaendert ? '<span class="karte-geaendert-punkt" title="geändert, noch nicht exportiert"></span>' : '';
  const oeffnen = '<button type="button" class="schaltflaeche schaltflaeche-neben schaltflaeche-klein" data-oeffnen="' + di
    + '" title="Im Editor öffnen (auch per Doppelklick)">' + (kartenAnsicht === 'detail' ? 'Im Editor öffnen' : '↗ Editor') + '</button>';
  karte.innerHTML =
    '<div class="karte-kopf">'
    + '<div><div class="karte-titel" title="' + escapeHtml(d.name) + '">' + escapeHtml(d.name) + '</div>'
    + '<div class="karte-untertitel">' + escapeHtml(wand.name) + ' · ' + wand.quelle + '</div></div>'
    + geaendertPunkt
    + '</div>'
    + '<div class="karte-svg-wrap">' + svg + '</div>'
    + '<div class="karte-kennzahlen">'
    + '<span title="Lagen">' + (kartenAnsicht === 'kompakt' ? 'L ' : 'Lagen: ') + '<b>' + kartenLagenAnzahl(d) + '</b></span>'
    + '<span title="Bearbeitungen">' + (kartenAnsicht === 'kompakt' ? 'B ' : 'Bearbeitungen: ') + '<b>' + (d.bearbeitungenAnzahl || 0) + '</b></span>'
    + '<span class="kz-fehler" title="Fehler">' + (kartenAnsicht === 'kompakt' ? 'F ' : 'Fehler: ') + '<b>' + d.fehlerAnzahl + '</b></span>'
    + (kartenAnsicht === 'kompakt' ? '<span class="kz-aktion">' + oeffnen + '</span>' : '')
    + '</div>'
    + (kartenAnsicht === 'detail' ? '<div class="karte-fuss">' + oeffnen + '</div>' : '');
  karte.querySelector('[data-oeffnen]').onclick = ev => { ev.stopPropagation(); imEditorOeffnen(di); };
  return karte;
}
/* ---------- Steuerung ---------- */
function ansichtSetzen(id) {
  if (!ANSICHT_IDS.includes(id)) return;
  kartenAnsicht = id;
  speicherSichern('kartenAnsicht', id);
  kartenLeisteRendern();
  gitterRendern();
}
/* umkehrenWennGleich: Klick auf das schon aktive Feld dreht die Richtung. */
function sortierungSetzen(feld, umkehrenWennGleich) {
  const def = KARTEN_SORTIERUNGEN.find(x => x.id === feld);
  if (!def) return;
  if (kartenSortierung.feld === feld && umkehrenWennGleich) kartenSortierung.ab = !kartenSortierung.ab;
  else kartenSortierung = { feld, ab: def.ab };
  speicherSichern('kartenSortierung', kartenSortierung);
  kartenLeisteRendern();
  gitterRendern();
}
function filterZuruecksetzen() {
  kartenSuche = '';
  kartenFilter = { fehler: 'alle', nurGeaendert: false, nurBefunde: false, lagen: [] };
  const inp = document.getElementById('kartenSuche');
  if (inp) inp.value = '';
  kartenLeisteRendern();
  gitterRendern();
}
function sucheFokussieren() {
  const inp = document.getElementById('kartenSuche');
  if (!inp || !dateien.length) return false;
  inp.focus(); inp.select();
  return true;
}

/* Leiste ueber dem Gitter: Suche · Filter-Menue · Sortierung · Ansicht ·
   Treffer-Zaehler. Das Suchfeld wird NICHT neu gebaut (Fokus/Cursor
   blieben sonst beim Tippen nicht stehen) — nur die Teile daneben. */
function kartenLeisteRendern() {
  const leiste = document.getElementById('kartenLeiste');
  if (!leiste) return;
  leiste.hidden = !dateien.length;
  document.getElementById('kartenAnsichtUmschalter').innerHTML = KARTEN_ANSICHTEN.map(a =>
    '<button type="button" class="segment' + (a.id === kartenAnsicht ? ' an' : '') + '" data-ansicht="' + a.id
    + '" title="' + a.titel + '">' + a.symbol + ' ' + a.text + '</button>').join('');
  document.getElementById('kartenSortFeld').innerHTML = KARTEN_SORTIERUNGEN.map(s =>
    '<option value="' + s.id + '"' + (s.id === kartenSortierung.feld ? ' selected' : '') + '>' + s.text + '</option>').join('');
  const richtung = document.getElementById('kartenSortRichtung');
  richtung.textContent = kartenSortierung.ab ? '↓' : '↑';
  richtung.title = kartenSortierung.ab ? 'absteigend — Klick: aufsteigend' : 'aufsteigend — Klick: absteigend';
  const n = filterAnzahlAktiv();
  const knopf = document.getElementById('btnKartenFilter');
  knopf.textContent = '⏷ Filter' + (n ? ' (' + n + ')' : '');
  knopf.classList.toggle('filter-an', !!n);
  kartenFilterMenueRendern();
}
function kartenFilterMenueRendern() {
  const menue = document.getElementById('kartenFilterMenue');
  const anzahlen = [...new Set(dateien.filter(d => d._vorschau).map(d => Math.min(kartenLagenAnzahl(d), 6)))].sort((a, b) => a - b);
  const radio = (wert, text) => '<label class="filter-option"><input type="radio" name="kfFehler" value="' + wert + '"'
    + (kartenFilter.fehler === wert ? ' checked' : '') + '> ' + text + '</label>';
  menue.innerHTML =
    '<div class="filter-gruppe"><div class="filter-titel">Fehler</div>'
    + radio('alle', 'alle Wände') + radio('mit', 'nur mit Fehlern') + radio('ohne', 'nur fehlerfrei') + '</div>'
    + '<div class="filter-gruppe"><div class="filter-titel">Status</div>'
    + '<label class="filter-option"><input type="checkbox" data-kf="nurGeaendert"' + (kartenFilter.nurGeaendert ? ' checked' : '')
    + '> nur geänderte (noch nicht exportiert)</label>'
    + '<label class="filter-option"><input type="checkbox" data-kf="nurBefunde"' + (kartenFilter.nurBefunde ? ' checked' : '')
    + '> nur mit gravierenden Befunden (P-19–P-24)</label></div>'
    + '<div class="filter-gruppe"><div class="filter-titel">Anzahl Lagen <span class="klein">(keine gewählt = alle)</span></div>'
    + '<div class="filter-chips">' + (anzahlen.length ? anzahlen.map(a => '<span class="filter-chip' + (kartenFilter.lagen.includes(a) ? ' an' : '')
      + '" data-kf-lagen="' + a + '">' + (a >= 6 ? '6+' : a) + '</span>').join('') : '<span class="klein">—</span>') + '</div></div>'
    + '<div class="filter-fuss"><button type="button" class="schaltflaeche schaltflaeche-neben schaltflaeche-klein" data-kf-reset>'
    + 'Suche und Filter zurücksetzen</button></div>';
}
function kartenZaehlerSetzen(sichtbar, gesamt) {
  const z = document.getElementById('kartenTreffer');
  if (z) z.textContent = filterAktiv() ? sichtbar + ' von ' + gesamt + ' Wand-Karte(n)' : gesamt + ' Wand-Karte(n)';
}
function kartenLeisteEinrichten() {
  const suche = document.getElementById('kartenSuche');
  suche.addEventListener('input', () => { kartenSuche = suche.value; gitterRendern(); });
  suche.addEventListener('keydown', ev => {
    if (ev.key === 'Escape') {
      ev.stopPropagation();
      if (suche.value) { suche.value = ''; kartenSuche = ''; gitterRendern(); }
      else suche.blur();
    } else if (ev.key === 'Enter') {
      /* Enter: die erste Treffer-Karte auswaehlen (Quelltext-Panel zeigt sie) */
      ev.preventDefault();
      if (kartenReihenfolge.length) { kartenKlick(kartenReihenfolge[0], {}); suche.blur(); }
    }
  });
  document.getElementById('kartenAnsichtUmschalter').addEventListener('click', ev => {
    const b = ev.target.closest('[data-ansicht]');
    if (b) ansichtSetzen(b.dataset.ansicht);
  });
  document.getElementById('kartenSortFeld').addEventListener('change', ev => sortierungSetzen(ev.target.value, false));
  document.getElementById('kartenSortRichtung').addEventListener('click', () => sortierungSetzen(kartenSortierung.feld, true));
  const menue = document.getElementById('kartenFilterMenue');
  document.getElementById('btnKartenFilter').addEventListener('click', ev => {
    ev.stopPropagation();
    kartenFilterMenueRendern();
    menue.classList.toggle('versteckt');
  });
  /* Menue bleibt beim Anklicken offen (mehrere Filter nacheinander setzen) */
  menue.addEventListener('change', ev => {
    const t = ev.target;
    if (t.name === 'kfFehler') kartenFilter.fehler = t.value;
    else if (t.dataset.kf) kartenFilter[t.dataset.kf] = t.checked;
    kartenLeisteRendern();
    gitterRendern();
  });
  menue.addEventListener('click', ev => {
    const chip = ev.target.closest('[data-kf-lagen]');
    if (chip) {
      const a = parseInt(chip.dataset.kfLagen, 10);
      kartenFilter.lagen = kartenFilter.lagen.includes(a) ? kartenFilter.lagen.filter(x => x !== a) : kartenFilter.lagen.concat(a);
      kartenLeisteRendern(); gitterRendern();
      return;
    }
    if (ev.target.closest('[data-kf-reset]')) { filterZuruecksetzen(); menue.classList.add('versteckt'); }
  });
  /* pointerdown statt click (wie beim Automatiken-Menue): Karten/SVG
     schlucken sonst den click */
  document.addEventListener('pointerdown', ev => {
    if (!menue.classList.contains('versteckt') && !ev.target.closest('#kartenFilterWrap')) menue.classList.add('versteckt');
  });
  /* Doppelklick auf Karte/Zeile = im Editor oeffnen (Kompakt/Liste haben
     nur einen kleinen Knopf) */
  document.getElementById('kartenGitter').addEventListener('dblclick', ev => {
    if (feedbackModus || ev.target.closest('button')) return;
    const karte = ev.target.closest('.karte, [data-ov-schluessel]');
    if (karte) imEditorOeffnen(parseInt((karte.dataset.schluessel || karte.dataset.ovSchluessel).split(':')[0], 10));
  });
  kartenLeisteRendern();
}
