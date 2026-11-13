/* =====================================================================
   §12 IM EDITOR OEFFNEN + LIVE-RUECKWEG (storage-Event)
   ===================================================================== */
/* Arbeitspaket 1: robuste Uebergabe an den Editor. localStorage funktioniert
   nur ueber http(s) zuverlaessig - unter file:// isoliert Chrome localStorage
   teils je Datei/Origin, der Schluessel kommt beim Editor nie an ("laedt
   nicht automatisch"-Bug). Zweiter, origin-unabhaengiger Kanal: postMessage
   ueber die Fenster-Referenz (fensterRef). Beide Kanaele laufen parallel;
   der Editor konsumiert nur einmal (siehe uebergabeSchonGeladen dort). */
let fensterRef = null;          /* zuletzt per "Im Editor öffnen" geoeffnetes Fenster */
let letzteUebergabe = null;     /* { name, text } der zuletzt geschickten Datei - fuer den postMessage-Kanal */

/* v0.22 EINGEBETTET MIT EDITOR (Website): Haelt eine Seite Uebersicht UND
   Editor zugleich, meldet sie sich mit { typ: 'wup-umgebung', editor: true }.
   Dann oeffnen "Im Editor oeffnen" und "Im Editor einrichten" den Editor dort
   ({ typ: 'wup-editor-zeigen', name?, text? } an die Seite) statt in einem
   neuen Fenster. Nur vom direkten Elternfenster; ohne diese Meldung bleibt
   alles wie bisher. */
let umgebungMitEditor = false;
window.addEventListener('message', ev => {
  const daten = ev.data;
  if (window.parent === window || ev.source !== window.parent) return;
  if (daten && typeof daten === 'object' && daten.typ === 'wup-umgebung') umgebungMitEditor = daten.editor === true;
});
function editorInUmgebungZeigen(datei) {
  if (!umgebungMitEditor) return false;
  const ziel = location.origin && location.origin !== 'null' ? location.origin : '*';
  try { window.parent.postMessage(Object.assign({ typ: 'wup-editor-zeigen' }, datei || {}), ziel); return true; }
  catch (fehler) { return false; }
}

function imEditorOeffnen(dateiIndex) {
  const d = dateien[dateiIndex];
  letzteUebergabe = { name: d.name, text: d.text };
  if (editorInUmgebungZeigen({ name: d.name, text: d.text })) return;
  try {
    localStorage.setItem(UEBERGABE_SCHLUESSEL, JSON.stringify({ name: d.name, text: d.text, zeit: Date.now() }));
  } catch (fehler) {
    hinweisAnzeigen('Konnte nicht an den Editor übergeben werden: ' + fehler.message, 'fehler');
    return;
  }
  fensterRef = window.open(editorPfad, '_blank');
}
/* Gemeinsame Anwende-Logik fuer beide Rueckweg-Kanaele (storage-Event UND
   postMessage 'wup-stand') - Datei im State aktualisieren + Karte neu bauen. */
function uebergabeZurueckAnwenden(name, text) {
  const idx = dateien.findIndex(d => d.name === name);
  if (idx < 0) return;
  dateien[idx].text = text;
  dateien[idx].geaendert = true;
  dateiAktualisieren(idx);
  ansichtAktualisieren();
  hinweisAnzeigen('Aktualisiert aus Editor: ' + name, 'info');
}
window.addEventListener('storage', ev => {
  if (ev.key !== UEBERGABE_ZURUECK_SCHLUESSEL || !ev.newValue) return;
  try {
    const daten = JSON.parse(ev.newValue);
    if (daten && daten.name && daten.text) uebergabeZurueckAnwenden(daten.name, daten.text);
  } catch (fehler) { /* ignorieren - best effort */ }
});
/* Zweiter Kanal (postMessage): der Editor meldet sich nach seiner init() mit
   { typ:'wup-editor-bereit' } - darauf antworten wir mit den Uebergabe-Daten
   der zuletzt geoeffneten Datei; den laufenden Bearbeitungsstand meldet der
   Editor gedrosselt per { typ:'wup-stand', name, text }. '*' als targetOrigin
   aus demselben Grund wie beim Editor (file://-Seiten ohne gemeinsame
   Origin) - fuer dieses lokale Werkstatt-Tool bewusst in Kauf genommen. */
window.addEventListener('message', ev => {
  const daten = ev.data;
  if (!daten || typeof daten !== 'object') return;
  if (daten.typ === 'wup-editor-bereit') {
    if (letzteUebergabe && fensterRef) {
      try { fensterRef.postMessage({ typ: 'wup-uebergabe', name: letzteUebergabe.name, text: letzteUebergabe.text }, '*'); }
      catch (fehler) { /* Fenster evtl. schon zu - egal */ }
    }
    return;
  }
  if (daten.typ === 'wup-stand' && daten.name && daten.text) uebergabeZurueckAnwenden(daten.name, daten.text);
});

