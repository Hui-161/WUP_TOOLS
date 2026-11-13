/* =====================================================================
   §8 FORTSCHRITT
   ===================================================================== */
function fortschrittZeigen(titel, i, n, dateiName) {
  const overlay = document.getElementById('fortschrittOverlay');
  overlay.style.display = 'flex';
  document.getElementById('fortschrittTitel').textContent = titel;
  document.getElementById('fortschrittBalken').style.width = (n ? (i / n * 100) : 0) + '%';
  document.getElementById('fortschrittStatus').textContent = 'Datei ' + i + ' / ' + n + (dateiName ? ' — ' + dateiName : '');
}
function fortschrittVerbergen() { document.getElementById('fortschrittOverlay').style.display = 'none'; }
function warteKurz() { return new Promise(r => setTimeout(r, 0)); }

/* =====================================================================
   §9 AUTOMATIKEN UEBER ALLE DATEIEN (F1/F2/F3/Auto-Kontur)
   ===================================================================== */
/* Arbeitspaket 4 (WIRKUNG): bei vorhandener Karten-Auswahl wirkt die Automatik
   NUR auf die Dateien der ausgewaehlten Karten (ausgewaehlteDateiIndizes()),
   ohne Auswahl wie bisher auf alle geladenen Dateien. */
async function automatikUeberAlleDateien(titel, kernAufruf) {
  const indizes = ausgewaehlteDateiIndizes();
  const ziel = (indizes ? dateien.map((d, i) => i).filter(i => indizes.has(i)) : dateien.map((d, i) => i));
  if (!ziel.length) { hinweisAnzeigen(indizes ? 'Auswahl enthält keine geladene Datei.' : 'Keine Dateien geladen.', 'info'); return; }
  try { await kernSicherstellen(); }
  catch (fehler) { hinweisAnzeigen('Kern nicht verfügbar: ' + fehler.message, 'fehler'); return; }

  let geaendertAnzahl = 0;
  const vorher = aenderungStandMerken();   /* v0.13: ein Rueckgaengig-Schritt je Aktion */
  fortschrittZeigen(titel, 0, ziel.length);
  for (let n = 0; n < ziel.length; n++) {
    const i = ziel[n];
    const d = dateien[i];
    fortschrittZeigen(titel, n + 1, ziel.length, d.name);
    await warteKurz(); /* Fortschrittsbalken zeichnen lassen */
    try {
      kernModellSetzen(d.text, d.name, d.encoding, d.hatteBom);
      kernAutomatikOhneDialog(kernAufruf);
      const neuerText = kernExportText();
      if (neuerText !== d.text) { d.text = neuerText; d.geaendert = true; geaendertAnzahl++; }
      dateiAktualisieren(i);
    } catch (fehler) {
      hinweisAnzeigen('Fehler bei ' + d.name + ' (' + titel + '): ' + fehler.message, 'fehler');
    }
  }
  fortschrittVerbergen();
  aenderungAufzeichnen(titel, vorher);
  ansichtAktualisieren();
  hinweisAnzeigen(titel + ': ' + geaendertAnzahl + ' von ' + ziel.length + ' Datei(en)'
    + bereichZusatz(indizes) + ' geändert.', 'erfolg');
}

/* Benannte Handler statt anonymer Closures - werden sowohl von den Buttons
   als auch von den Zahlen-Tastenkuerzeln (1/2/3/4, Arbeitspaket 5) aufgerufen. */
function f1Klick() { automatikUeberAlleDateien('Auto Über-/Unterschnitt (F1)', () => kern.f1AlleAusfuehren()); }
function f2Klick() { automatikUeberAlleDateien('Freistiche (F2)', () => kern.f2SammelAktion()); }
function f3Klick() { automatikUeberAlleDateien('Auto-Sperrflächen (F3)', () => kern.f3AutoPsf()); }
function autoKonturKlick() { automatikUeberAlleDateien('Auto-Kontur', () => kern.autoKonturVerbinden()); }
document.getElementById('btnF1').addEventListener('click', f1Klick);
document.getElementById('btnF2').addEventListener('click', f2Klick);
document.getElementById('btnF3').addEventListener('click', f3Klick);
document.getElementById('btnAutoKontur').addEventListener('click', autoKonturKlick);

