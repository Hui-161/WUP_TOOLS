/* =====================================================================
   §7c WANDLISTE MIT DEM LISTEN-BAUSTEIN (v0.19, Anwenderwunsch 2026-11-11
   "schau dir den neuen Listen-Baustein an und bau ihn in das Tool ein, wie
   es passt"). Die Ansicht "Liste" zeigt eine Zeile je Wand-Karte ueber
   listeEinrichten() (46_liste_baustein.js = UNVERAENDERTE Kopie aus
   listen_baustein/ — dort aendern, hier nur nachziehen).

   Zusammenspiel mit der Kartenleiste:
   - Suche und Filter der Leiste wirken weiter VOR der Liste (zeilen() =
     die sichtbaren Karten); die Liste filtert/sortiert/gruppiert darauf.
   - Ohne eigene Sortierung der Liste gilt die Reihenfolge der Leiste.
   - Auswahl: die Liste ist mit der Karten-Auswahl (auswahl, Set der
     Schluessel) verbunden — Automatiken wirken auf die gewaehlten Waende
     wie in Detail/Kompakt.
   - Doppelklick auf eine Zeile oder "Im Editor oeffnen" im Rechtsklick.
   Die Liste schreibt nichts (keine setzen()-Spalten): Werte aendern laeuft
   weiter ueber Automatiken, Werte ersetzen und den Editor.
   ===================================================================== */
const WANDLISTE_ID = 'ovWaende';
let wandlisteZiel = null;          /* bleibt ueber gitterRendern() hinweg erhalten */
let wandlisteSynchron = false;     /* Schutz gegen Rueckkopplung beiAuswahl ↔ listeAuswahlSetzen */

function wandlisteDatum(ms) {
  if (!ms) return '';
  const t = new Date(ms), zz = n => String(n).padStart(2, '0');
  /* sortierbar als Text (JJJJ-MM-TT hh:mm), angezeigt deutsch */
  return t.getFullYear() + '-' + zz(t.getMonth() + 1) + '-' + zz(t.getDate()) + ' ' + zz(t.getHours()) + ':' + zz(t.getMinutes());
}
function wandlisteBohrungen(d) {
  const v = d._vorschau;
  if (!v) return 0;
  return v.layers.reduce((s, l) => s + (l.bohrungen || []).length, 0)
    + (v.beams || []).reduce((s, b) => s + (b.bearbeitungen || []).filter(bb => bb.kw === 'BOZ').length, 0);
}
function wandlisteSpalten() {
  const kopf = e => (e.d._vorschau && e.d._vorschau.header) || {};
  return [
    { feld: 'bild', titel: 'Bild', breite: 96, wert: () => '',
      zelle: e => '<div class="wl-bild">' + kartenSvgErzeugen(e.d._vorschau, e.wand) + '</div>',
      hilfe: 'Kleine Zeichnung (Filter-Chips oben wirken)' },
    { feld: 'datei', titel: 'Datei', breite: 170, fest: true, wert: e => e.d.name },
    { feld: 'wandname', titel: 'Wandteil', breite: 120, wert: e => e.wand.name + (e.wand.quelle ? ' · ' + e.wand.quelle : ''),
      hilfe: 'Wand innerhalb der Datei (Multiwand) und wie sie erkannt wurde' },
    { feld: 'eln', titel: 'ELN', breite: 90, wert: e => kopf(e).ELN || '' },
    { feld: 'znr', titel: 'Zeichnung', breite: 80, wert: e => kopf(e).ZNR || '', aus: true },
    { feld: 'anr', titel: 'Auftrag', breite: 120, wert: e => kopf(e).ANR || '' },
    { feld: 'elb', titel: 'Typ', breite: 100, wert: e => kopf(e).ELB || '', aus: true },
    { feld: 'lagen', titel: 'Lagen', breite: 76, zahl: true, wert: e => kartenLagenAnzahl(e.d) },
    { feld: 'bearb', titel: 'Bearb.', breite: 86, zahl: true, summe: 'summe', wert: e => e.d.bearbeitungenAnzahl || 0,
      hilfe: 'Bearbeitungen in den Lagen' },
    { feld: 'fehler', titel: 'Fehler', breite: 82, zahl: true, summe: 'summe', wert: e => e.d.fehlerAnzahl || 0,
      zelle: e => e.d.fehlerAnzahl ? '<b class="wl-fehler">' + e.d.fehlerAnzahl + '</b>' : '0' },
    { feld: 'befunde', titel: 'Befunde', breite: 96, zahl: true, summe: 'summe', wert: e => kartenBefundeAnzahl(e.d),
      hilfe: 'Gravierende Befunde P-19 … P-24' },
    { feld: 'boz', titel: 'BOZ', breite: 70, zahl: true, summe: 'summe', wert: e => wandlisteBohrungen(e.d),
      hilfe: 'Bohrungen als BOZ (Plattenlagen und Riegelwerk)' },
    { feld: 'datum', titel: 'Datum (Datei)', breite: 130, wert: e => wandlisteDatum(e.d.datum),
      zelle: e => datumText(e.d.datum), hilfe: 'Änderungsdatum der Datei (ein Erstellungsdatum gibt der Browser nicht heraus)' },
    { feld: 'status', titel: 'Status', breite: 90, wert: e => e.d.geaendert ? 'geändert' : '',
      zelle: e => e.d.geaendert ? '<span class="karte-geaendert-punkt" title="geändert, noch nicht exportiert"></span> geändert' : '' },
    { feld: 'aktion', titel: '', breite: 86, wert: () => '',
      zelle: e => '<button type="button" class="schaltflaeche schaltflaeche-neben schaltflaeche-klein" data-wl-oeffnen="'
        + e.di + '" title="Im Editor öffnen (auch per Doppelklick)">↗ Editor</button>' }
  ];
}
function wandlisteEinrichten() {
  wandlisteZiel = document.createElement('div');
  wandlisteZiel.className = 'wandliste';
  listeEinrichten({
    id: WANDLISTE_ID,
    ziel: wandlisteZiel,
    spalten: wandlisteSpalten(),
    zeilen: () => kartenEintraege().sichtbar,
    kennung: e => e.schluessel,
    speicher: 'wup_oversight_v1_liste_waende',
    zeileAttr: e => ' data-ov-schluessel="' + escapeHtml(e.schluessel) + '"',
    leer: () => 'Keine Wand passt zu Suche/Filter.',
    melden: text => hinweisAnzeigen(text, 'info'),
    beiAuswahl: zeilen => {
      if (wandlisteSynchron) return;
      auswahl = new Set(zeilen.map(e => e.schluessel));
      if (zeilen.length) auswahlAnker = zeilen[zeilen.length - 1].schluessel;
      auswahlHinweisRendern();
      quelltextStrukturAktualisieren();
    },
    zeilenMenue: (gewaehlt, e) => [
      { text: '↗ Im Editor öffnen', aktion: () => imEditorOeffnen(e.di) },
      '-'
    ]
  });
  /* Knopf und Doppelklick (Zeile) — Klicks in der Liste gehen sonst an den Baustein */
  wandlisteZiel.addEventListener('click', ev => {
    const b = ev.target.closest('[data-wl-oeffnen]');
    if (b) { ev.stopPropagation(); imEditorOeffnen(parseInt(b.dataset.wlOeffnen, 10)); }
  });
}
/* Aus gitterRendern(): die Liste ins Gitter haengen und neu zeichnen. */
function wandlisteZeichnen(gitter) {
  if (!wandlisteZiel) wandlisteEinrichten();
  gitter.appendChild(wandlisteZiel);
  listeZeichnen(WANDLISTE_ID);
  wandlisteAuswahlAbgleichen();
}
/* Karten-Auswahl → Liste (nach Klick in einer anderen Ansicht, Strg+A, Esc …) */
function wandlisteAuswahlAbgleichen() {
  if (!wandlisteZiel || kartenAnsicht !== 'liste') return;
  wandlisteSynchron = true;
  try { listeAuswahlSetzen(WANDLISTE_ID, kartenEintraege().alle.filter(e => auswahl.has(e.schluessel))); }
  finally { wandlisteSynchron = false; }
}
