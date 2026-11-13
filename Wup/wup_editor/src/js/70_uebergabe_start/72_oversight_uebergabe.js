/* =====================================================================
   OVERSIGHT-UEBERGABE (kleine Ergaenzung fuer wup_editor_oversight.html)
   Die Uebersicht schreibt den Text einer Datei nach
   localStorage['wup_editor_v1_uebergabe'] und oeffnet diesen Editor in einem
   neuen Tab. uebergabeUebernehmen() (aus init() aufgerufen) liest den Eintrag
   EINMALIG (Key wird sofort entfernt), parst ihn wie eine geladene Datei und
   merkt sich den Namen in uebergabeAktivName. Solange dieser Merker gesetzt
   ist, spiegelt alleNeuRendern() den aktuellen Bearbeitungsstand (gedrosselt
   auf max. alle 2s) nach localStorage['wup_editor_v1_uebergabeZurueck'] —
   die Uebersicht lauscht dort per storage-Event und bleibt so "live". Reine
   Uebergabe-Logik, aendert nichts am eigentlichen Editor-Verhalten ohne
   Uebergabe (uebergabeAktivName bleibt dann null).

   ZWEITER KANAL (postMessage, origin-unabhaengig): bei file://-Aufruf isoliert
   Chrome localStorage teils je Datei — der obige Kanal kommt dort nie an. Als
   Fallback/Ergaenzung meldet sich dieser Editor nach init() beim opener (falls
   vorhanden, d.h. via window.open aus der Uebersicht gestartet) mit
   { typ:'wup-editor-bereit' }; die Uebersicht antwortet darauf mit
   { typ:'wup-uebergabe', name, text }, was hier ueber denselben Anwende-Pfad
   (uebergabeAnwenden) wie der localStorage-Fund verarbeitet wird. Der Rueckweg
   (gedrosselter Bearbeitungsstand) laeuft ebenfalls doppelt: zusaetzlich zum
   localStorage-Eintrag wird { typ:'wup-stand', name, text } an den opener
   gesendet. uebergabeSchonGeladen verhindert ein doppeltes Anwenden, falls
   BEIDE Kanaele (fast) gleichzeitig ankommen.

   v2.65: Rueckweg mit Nachlauf (uebergabeZurueckVormerken) und weitere
   Uebergaben in ein laufendes Fenster mit { erneut: true }. */
let uebergabeAktivName = null, uebergabeLetzteSicherung = 0;
let uebergabeSchonGeladen = false;
let uebergabeNachlauf = null;   /* v2.65: Timer fuer den letzten Stand */

/* Rueckweg: aktuellen Stand der uebergebenen Datei an die Uebersicht melden
   (localStorage + postMessage an den opener). */
function uebergabeZurueckSchreiben() {
  if (uebergabeNachlauf) { clearTimeout(uebergabeNachlauf); uebergabeNachlauf = null; }
  if (!uebergabeAktivName || !modell) return;
  const jetzt = Date.now();
  /* v2.55: Schluss-CRLF wie exportBytesErzeugen() — vorher kam je
     Rundlauf Editor → Uebersicht eine Leerzeile am Dateiende dazu */
  const text = sitzungAktuellerText();
  try {
    localStorage.setItem('wup_editor_v1_uebergabeZurueck', JSON.stringify({
      name: uebergabeAktivName, text, zeit: jetzt
    }));
  } catch (fehler) { /* still schlucken (z.B. Speicher-Quota) */ }
  /* Zweiter Rueckweg-Kanal (postMessage), siehe Kopf-Kommentar. Getrennter
     try/catch: opener kann inzwischen geschlossen worden sein, ohne dass der
     localStorage-Rueckweg leidet. */
  try {
    if (window.opener) window.opener.postMessage({ typ: 'wup-stand', name: uebergabeAktivName, text }, '*');
  } catch (fehler) { /* opener weg o.ae. - egal */ }
  uebergabeLetzteSicherung = jetzt;
}
/* Gedrosselt (hoechstens alle 2 s). v2.65: mit NACHLAUF — faellt eine
   Aenderung in die Sperrzeit, wird sie nach Ablauf geschrieben. Vorher kam
   die letzte Aenderung erst beim naechsten Rendern nach 2 s an, also u. U.
   nie, wenn danach nichts mehr geschah. */
function uebergabeZurueckVormerken() {
  const rest = 2000 - (Date.now() - uebergabeLetzteSicherung);
  if (rest < 0) { uebergabeZurueckSchreiben(); return; }
  if (!uebergabeNachlauf) uebergabeNachlauf = setTimeout(uebergabeZurueckSchreiben, rest + 10);
}
function uebergabeAnwenden(name, text) {
  try {
    if (!text) return false;
    /* v2.65: Kommt eine weitere Datei, waehrend noch eine uebergebene offen
       ist, geht deren letzter Stand zuerst zurueck an die Uebersicht. */
    if (uebergabeAktivName && modell) uebergabeZurueckSchreiben();
    modell = wupParsen(text, name || 'unbenannt.wup', 'windows-1252', false);
    undoStack.length = 0; redoStack.length = 0;
    sitzungBasisSetzen();   /* v2.55 */
    ui.auswahl = null; ui.kanten = []; ui.messungen = []; ui.messStart = null; ui.neueNrStart = null;
    ui.neueKontur = null; ui._neueKonturMaus = null;
    neuVorgabenNachLaden(); ui.seitenWahl = null;   /* v2.54: gemerkte Schichten statt null */
    document.getElementById('startOverlay').classList.add('versteckt');
    zoomEinpassen();
    alleNeuRendern();
    uebergabeAktivName = name || modell.dateiName;
    uebergabeSchonGeladen = true;
    hinweisAnzeigen('Von Übersicht übernommen: ' + (name || ''), 'erfolg');
    gravierendeBefundePopup();
    return true;
  } catch (fehler) { return false; /* still schlucken - Uebergabe ist best effort */ }
}
function uebergabeUebernehmen() {
  try {
    const roh = localStorage.getItem('wup_editor_v1_uebergabe');
    if (!roh) return;
    localStorage.removeItem('wup_editor_v1_uebergabe');   /* Einmal-Uebergabe: sofort entfernen */
    if (uebergabeSchonGeladen) return;   /* bereits per postMessage geladen - Key nur aufraeumen */
    const daten = JSON.parse(roh);
    if (!daten || !daten.text) return;
    uebergabeAnwenden(daten.name, daten.text);
  } catch (fehler) { /* still schlucken - Uebergabe ist best effort */ }
}
/* Zweiter Kanal: postMessage-Nachrichten von der Uebersicht (bzw. deren
   Antwort auf 'wup-editor-bereit'). '*' als targetOrigin, weil file://-Seiten
   keine gemeinsame Origin haben - fuer dieses lokale Werkstatt-Tool bewusst
   in Kauf genommen (siehe Arbeitspaket "Uebergabe robust machen"). */
window.addEventListener('message', ev => {
  const daten = ev.data;
  if (!daten || typeof daten !== 'object' || daten.typ !== 'wup-uebergabe') return;
  /* v2.65: { erneut: true } = bewusst weitere Datei in ein laufendes Fenster
     (Website: Editor und Uebersicht nebeneinander auf einer Seite). Ohne
     den Merker bleibt es bei der Einmal-Uebergabe (zwei Kanaele beim Start). */
  if (!uebergabeSchonGeladen || daten.erneut === true) uebergabeAnwenden(daten.name, daten.text);
  try { localStorage.removeItem('wup_editor_v1_uebergabe'); } catch (fehler) { /* egal */ }
});

