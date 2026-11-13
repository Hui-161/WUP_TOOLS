/* =====================================================================
   §1 GRUNDLAGEN / KONSTANTEN
   ===================================================================== */
const TOOL_NAME = 'WUP-Editor-Übersicht';
const TOOL_VERSION = '0.23';
const SPEICHER_PRAEFIX = 'wup_oversight_v1_';
const UEBERGABE_SCHLUESSEL = 'wup_editor_v1_uebergabe';
const UEBERGABE_ZURUECK_SCHLUESSEL = 'wup_editor_v1_uebergabeZurueck';

document.getElementById('versionsBadge').textContent = 'v' + TOOL_VERSION;

function speicherLaden(name, standardwert) {
  try { const w = localStorage.getItem(SPEICHER_PRAEFIX + name); return w ? JSON.parse(w) : standardwert; }
  catch (fehler) { return standardwert; }
}
function speicherSichern(name, daten) {
  try { localStorage.setItem(SPEICHER_PRAEFIX + name, JSON.stringify(daten)); } catch (fehler) {}
}
function designWechseln() {
  const aktuell = document.documentElement.dataset.theme
    || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  const naechstes = aktuell === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = naechstes;
  speicherSichern('design', naechstes);
}
(function designBeiLadenWiederherstellen() {
  const gespeichert = speicherLaden('design', null);
  if (gespeichert) document.documentElement.dataset.theme = gespeichert;
  else if (window.matchMedia('(prefers-color-scheme: dark)').matches) document.documentElement.dataset.theme = 'dark';
})();

function hinweisAnzeigen(nachricht, art) {
  const div = document.createElement('div');
  div.className = 'hinweis hinweis-' + (art || 'info');
  div.textContent = nachricht;
  document.body.appendChild(div);
  setTimeout(() => div.remove(), 4500);
}
function dateiHerunterladen(inhalt, mimeTyp, dateiname) {
  const blob = inhalt instanceof Blob ? inhalt : new Blob([inhalt], { type: mimeTyp });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url; link.download = dateiname;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 100);
}

