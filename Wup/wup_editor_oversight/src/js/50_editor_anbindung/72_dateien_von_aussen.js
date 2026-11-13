/* =====================================================================
   §12b DATEIEN VON EINEM ANDEREN WERKZEUG UEBERNEHMEN (v0.20)
   Anwenderwunsch 2026-11-12: der WupCreator oeffnet die Uebersicht in einem
   neuen Tab und reicht ihr das ganze erzeugte Gebaeude ("Button zum direkten
   Oeffnen im WUP-Oversight fuer das ganze Gebaeude").

   Ablauf (postMessage, wie zwischen Uebersicht und Editor — unter file://
   gibt es keinen gemeinsamen Ursprung, deshalb '*' als Ziel):
     1. Diese Seite meldet sich nach dem Laden beim oeffnenden Fenster mit
        { typ:'wup-uebersicht-bereit', version }.
     2. Das oeffnende Werkzeug antwortet mit
        { typ:'wup-dateien', quelle, dateien:[{ name, bytes }] } — bytes =
        Dateiinhalt wie auf der Platte (Uint8Array/ArrayBuffer, Windows-1252).
     3. Die Dateien laufen durch handleFiles(), GENAU wie hineingezogene
        Dateien (Dekodieren, Parsen, Pruefen, Befunde-Popup). Danach geht
        { typ:'wup-dateien-angekommen', anzahl } zurueck.
   Angenommen wird nur vom Fenster, das diese Seite geoeffnet hat
   (window.opener), nur .wup-Namen, nur Bytes. Ohne oeffnendes Fenster tut
   dieser Abschnitt nichts — die Uebersicht verhaelt sich wie bisher.
   ===================================================================== */
window.addEventListener('message', ev => {
  const daten = ev.data;
  if (!daten || typeof daten !== 'object' || daten.typ !== 'wup-dateien') return;
  if (!window.opener || ev.source !== window.opener) return;
  const files = [];
  for (const d of Array.isArray(daten.dateien) ? daten.dateien : []) {
    if (!d || typeof d.name !== 'string' || !/\.wup$/i.test(d.name)) continue;
    if (!(d.bytes instanceof Uint8Array) && !(d.bytes instanceof ArrayBuffer)) continue;
    files.push(new File([d.bytes], d.name.replace(/[\\/:*?"<>|]+/g, '_'), { lastModified: Date.now() }));
  }
  if (!files.length) { hinweisAnzeigen('Uebergabe ohne lesbare .wup-Datei — nichts geladen.', 'warnung'); return; }
  const quelle = typeof daten.quelle === 'string' ? daten.quelle.slice(0, 40) : 'anderem Werkzeug';
  hinweisAnzeigen(files.length + ' Datei(en) von ' + quelle + ' übernommen.', 'info');
  const absender = ev.source;
  Promise.resolve(handleFiles(files)).then(() => {
    try { absender.postMessage({ typ: 'wup-dateien-angekommen', anzahl: files.length }, '*'); } catch (fehler) { /* Fenster evtl. schon zu - egal */ }
  });
});
/* Nach dem Laden der Seite (init() ist dann durch) beim oeffnenden Fenster melden. */
window.addEventListener('load', () => {
  try { if (window.opener) window.opener.postMessage({ typ: 'wup-uebersicht-bereit', version: TOOL_VERSION }, '*'); }
  catch (fehler) { /* kein oeffnendes Fenster erreichbar - egal */ }
});
