/* =====================================================================
   §9b RUECKGAENGIG / WIEDERHOLEN (v0.13, Anwenderwunsch "Vor- und
   Zurueck-Button, Alt+Z / Alt+Y")
   Ein Schritt = eine Aktion ueber mehrere Dateien (Automatik, Werte
   ersetzen, Befunde-Korrektur). Gespeichert werden NUR die Dateien, deren
   Text sich geaendert hat, jeweils vorher UND nachher — JS-Strings sind
   unveraenderlich, die Kopien kosten also nur Verweise.
   Konfliktregel: Wurde eine Datei nach dem Schritt anderweitig veraendert
   (z. B. Rueckweg aus dem Editor), steht ihr Text nicht mehr auf dem
   erwarteten Stand — sie wird dann UEBERSPRUNGEN und gemeldet, statt die
   spaetere Arbeit still zu ueberschreiben (Spec §7A). Der Editor-Rueckweg
   selbst ist kein Schritt hier: der Editor hat sein eigenes Rueckgaengig.
   ===================================================================== */
const RUECK_MAX = 30;
let rueckStapel = [];
let vorStapel = [];

/* Vor einer Aktion aufrufen; Ergebnis an aenderungAufzeichnen() geben. */
function aenderungStandMerken() {
  return dateien.map(d => ({ text: d.text, geaendert: d.geaendert }));
}
function aenderungAufzeichnen(titel, vorher) {
  const eintraege = [];
  vorher.forEach((v, i) => {
    const d = dateien[i];
    if (!d || d.text === v.text) return;
    eintraege.push({ i, name: d.name, vorherText: v.text, vorherGeaendert: v.geaendert,
      nachherText: d.text, nachherGeaendert: d.geaendert });
  });
  if (!eintraege.length) return;
  rueckStapel.push({ titel, eintraege });
  if (rueckStapel.length > RUECK_MAX) rueckStapel.shift();
  vorStapel = [];
  rueckKnoepfeAktualisieren();
}
/* richtung 'zurueck' stellt "vorher" her, 'vor' stellt "nachher" her. */
function rueckSchrittAnwenden(schritt, richtung) {
  const zurueck = richtung === 'zurueck';
  let angewendet = 0;
  const uebersprungen = [];
  for (const e of schritt.eintraege) {
    const d = dateien[e.i];
    if (!d || d.text !== (zurueck ? e.nachherText : e.vorherText)) { uebersprungen.push(e.name); continue; }
    d.text = zurueck ? e.vorherText : e.nachherText;
    d.geaendert = zurueck ? e.vorherGeaendert : e.nachherGeaendert;
    dateiAktualisieren(e.i);
    angewendet++;
  }
  return { angewendet, uebersprungen };
}
function rueckMelden(symbol, schritt, erg) {
  hinweisAnzeigen(symbol + ' ' + schritt.titel + ' — ' + erg.angewendet + ' Datei(en)', erg.angewendet ? 'info' : 'warnung');
  if (erg.uebersprungen.length)
    hinweisAnzeigen(erg.uebersprungen.length + ' Datei(en) übersprungen, weil seitdem anderweitig geändert '
      + '(z. B. im Editor): ' + erg.uebersprungen.slice(0, 4).join(', ')
      + (erg.uebersprungen.length > 4 ? ' …' : ''), 'warnung');
}
function rueckgaengig() {
  const schritt = rueckStapel.pop();
  if (!schritt) { hinweisAnzeigen('Nichts rückgängig zu machen.', 'info'); return; }
  const erg = rueckSchrittAnwenden(schritt, 'zurueck');
  vorStapel.push(schritt);
  ansichtAktualisieren();
  rueckKnoepfeAktualisieren();
  rueckMelden('↶ Rückgängig:', schritt, erg);
}
function wiederholen() {
  const schritt = vorStapel.pop();
  if (!schritt) { hinweisAnzeigen('Nichts zu wiederholen.', 'info'); return; }
  const erg = rueckSchrittAnwenden(schritt, 'vor');
  rueckStapel.push(schritt);
  ansichtAktualisieren();
  rueckKnoepfeAktualisieren();
  rueckMelden('↷ Wiederholt:', schritt, erg);
}
function rueckKnoepfeAktualisieren() {
  const zurueck = document.getElementById('btnUndo'), vor = document.getElementById('btnRedo');
  if (!zurueck || !vor) return;
  const r = rueckStapel[rueckStapel.length - 1], w = vorStapel[vorStapel.length - 1];
  zurueck.disabled = !r;
  vor.disabled = !w;
  zurueck.title = r ? 'Rückgängig: ' + r.titel + ' (' + r.eintraege.length + ' Datei(en)) — Alt+Z' : 'Rückgängig (Alt+Z) — nichts zu tun';
  vor.title = w ? 'Wiederholen: ' + w.titel + ' (' + w.eintraege.length + ' Datei(en)) — Alt+Y' : 'Wiederholen (Alt+Y) — nichts zu tun';
}
document.getElementById('btnUndo').addEventListener('click', rueckgaengig);
document.getElementById('btnRedo').addEventListener('click', wiederholen);
