'use strict';
/* =====================================================================
   §0 KONSTANTEN & SPEICHER
   ===================================================================== */
const TOOL_NAME    = 'WUP-Editor';
const TOOL_VERSION = '2.66';
const SPEICHER_PRAEFIX = 'wup_editor_v1_';

/* EDT-3: zuvor als Magic Numbers an den jeweiligen Stellen verstreut */
const UNDO_MAX_SCHRITTE = 30;           /* Snapshots im Undo-Stack (aenderungBeginnen) */
const SNAP_FANGRADIUS_PX = 12;          /* Bildschirm-Pixel-Radius fuer Punktfang (naechsterSnap) */
const ZOOM_SCHRITT_FAKTOR = 1.08;       /* Skalierung pro Wheel-Tick (canvasWheel) */
const ZOOM_MIN_ABSOLUT = 0.002;         /* absolute Untergrenze, unabhaengig von der Einpass-Skalierung */
const ZOOM_MIN_ANTEIL_VON_FIT = 0.15;   /* Untergrenze relativ zur Einpass-Skalierung (15%) */
const ZOOM_MAX_SKALIERUNG = 60;         /* Obergrenze in px/mm */
const KW_ZEILE_MAX_LAENGE = 250;        /* ueblicher Zeilenlaengen-Richtwert im Maschinencode (kwZeile) */

document.querySelector('.versions-badge').textContent = 'v' + TOOL_VERSION;

function speicherSchluessel(name) { return SPEICHER_PRAEFIX + name; }
function speicherLaden(name, standardwert) {
  try {
    const wert = localStorage.getItem(speicherSchluessel(name));
    return wert ? JSON.parse(wert) : standardwert;
  } catch (fehler) { return standardwert; }
}
function speicherSichern(name, daten) {
  try { localStorage.setItem(speicherSchluessel(name), JSON.stringify(daten)); }
  catch (fehler) { console.warn('Speicher-Fehler:', fehler); }
}

/* Design-Wechsler */
function designWechseln() {
  const aktuell = document.documentElement.dataset.theme
    || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  const naechstes = aktuell === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = naechstes;
  speicherSichern('design', naechstes);
  if (modell) { svgRendern(); textPanelRendern(); }
}
(function designBeiLadenWiederherstellen() {
  const gespeichert = speicherLaden('design', null);
  if (gespeichert) document.documentElement.dataset.theme = gespeichert;
  else if (window.matchMedia('(prefers-color-scheme: dark)').matches)
    document.documentElement.dataset.theme = 'dark';
})();

function hinweisAnzeigen(nachricht, art) {
  const div = document.createElement('div');
  div.className = 'hinweis hinweis-' + (art || 'info');
  div.textContent = nachricht;
  document.body.appendChild(div);
  setTimeout(() => div.remove(), 4500);
}

/* Bestaetigung ohne native Dialoge */
function bestaetigen(frage, jaText, jaFn, neinFn) {
  document.querySelectorAll('.bestaetigung').forEach(b => b.remove());
  const hg = document.createElement('div');
  hg.className = 'bestaetigung';
  const fenster = document.createElement('div');
  fenster.className = 'bestaetigung-fenster';
  const span = document.createElement('p');
  span.className = 'bestaetigung-frage';
  span.textContent = frage;
  const knopfreihe = document.createElement('div');
  knopfreihe.className = 'bestaetigung-knoepfe';
  const nein = document.createElement('button');
  nein.className = 'schaltflaeche schaltflaeche-neben'; nein.textContent = 'Abbrechen';
  const ja = document.createElement('button');
  ja.className = 'schaltflaeche schaltflaeche-haupt'; ja.textContent = jaText || 'Ja';
  let erledigt = false;
  const aufraeumen = () => {
    if (erledigt) return; erledigt = true;
    document.removeEventListener('keydown', tasten, true);
    hg.remove();
  };
  const bestaetigt = () => { aufraeumen(); jaFn && jaFn(); };
  const abgebrochen = () => { aufraeumen(); neinFn && neinFn(); };
  const tasten = ev => {
    if (ev.key === 'Enter') { ev.preventDefault(); ev.stopPropagation(); bestaetigt(); }
    else if (ev.key === 'Escape') { ev.preventDefault(); ev.stopPropagation(); abgebrochen(); }
  };
  ja.onclick = bestaetigt;
  nein.onclick = abgebrochen;
  hg.addEventListener('mousedown', ev => { if (ev.target === hg) abgebrochen(); });
  document.addEventListener('keydown', tasten, true);
  knopfreihe.append(nein, ja);
  fenster.append(span, knopfreihe);
  hg.appendChild(fenster);
  document.body.appendChild(hg);
  /* Fokus auf "Ja", damit Enter sofort greift und der Knopf sichtbar hervorgehoben ist */
  ja.focus();
}

function dateiHerunterladen(inhalt, mimeTyp, dateiname) {
  const blob = inhalt instanceof Blob ? inhalt : new Blob([inhalt], { type: mimeTyp });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = dateiname;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 100);
}
function zeichenBereinigen(s) {
  return String(s || '').replace(/[^\w\-]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
}
function dateinamenErstellen(toolKuerzel, kontextTeile, endung) {
  const bereinigt = kontextTeile.filter(Boolean).map(zeichenBereinigen);
  return [toolKuerzel, ...bereinigt].join('_') + '.' + endung;
}
