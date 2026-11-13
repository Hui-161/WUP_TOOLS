/* =====================================================================
   §11 ALLE EXPORTIEREN (gestaffelt, Einzeldownloads statt ZIP)
   ===================================================================== */
async function alleExportieren() {
  const nurGeaenderte = document.getElementById('chkNurGeaenderte').checked;
  const liste = dateien.filter(d => !nurGeaenderte || d.geaendert);
  if (!liste.length) { hinweisAnzeigen('Nichts zu exportieren.', 'info'); return; }
  try { await kernSicherstellen(); } catch (fehler) { hinweisAnzeigen('Kern nicht verfügbar: ' + fehler.message, 'fehler'); return; }
  liste.forEach((d, idx) => {
    setTimeout(() => {
      try {
        kernModellSetzen(d.text, d.name, d.encoding, d.hatteBom);
        /* exportBytesErzeugen() ruft intern exportDateinameBestimmen() auf
           (beachtet profil.export.dateiname, z.B. 'original') - der
           Dateiname kommt daher unveraendert aus dem Kern. */
        const { bytes, name } = kern.exportBytesErzeugen();
        dateiHerunterladen(new Blob([bytes], { type: 'application/octet-stream' }), 'application/octet-stream', name);
      } catch (fehler) {
        hinweisAnzeigen('Export-Fehler bei ' + d.name + ': ' + fehler.message, 'fehler');
      }
    }, idx * 300);
  });
  hinweisAnzeigen(liste.length + ' Datei(en) werden heruntergeladen…', 'erfolg');
}
document.getElementById('btnAlleExport').addEventListener('click', alleExportieren);

