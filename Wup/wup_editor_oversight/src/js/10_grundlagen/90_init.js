/* =====================================================================
   §15 INIT / DATEI-LADEN-VERDRAHTUNG
   ===================================================================== */
function init() {
  document.getElementById('btnDesign').addEventListener('click', designWechseln);

  const dateiInput = document.getElementById('dateiInput');
  document.getElementById('btnOeffnen').addEventListener('click', () => dateiInput.click());
  document.getElementById('dropZone').addEventListener('click', () => dateiInput.click());
  document.getElementById('dropZoneGross').addEventListener('click', () => dateiInput.click());
  dateiInput.addEventListener('change', () => { handleFiles(dateiInput.files); dateiInput.value = ''; });

  ['dragover', 'dragenter'].forEach(t => document.body.addEventListener(t, ev => ev.preventDefault()));
  document.body.addEventListener('drop', ev => {
    ev.preventDefault();
    if (ev.dataTransfer.files && ev.dataTransfer.files.length) handleFiles(ev.dataTransfer.files);
  });

  feedbackEinrichten();
  kartenGitterEinrichten();
  kartenLeisteEinrichten();     /* v0.13: Suche, Filter, Sortierung, Ansicht */
  rueckKnoepfeAktualisieren();  /* v0.13: Rueckgaengig/Wiederholen */
  sitzungEinrichten();          /* v0.14: Sitzungssicherung + Angebot im Leer-Bildschirm */
  quelltextPanelEinrichten();
  tastenkuerzelEinrichten();
  ovKuerzelLeisteFuellen();   /* Angleichung: schlanke Fusszeile + Kuerzel-Panel */

  editorKernLaden().then(geraeteHinweisAktualisieren)
    .catch(fehler => hinweisAnzeigen('Kern-Ladefehler: ' + fehler.message, 'fehler'));
  ansichtAktualisieren();
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();
