/* =====================================================================
   SITZUNG WIEDERHERSTELLEN (v2.55, Anwenderwunsch: "wenn ich aus
   Versehen den Browser schliesse oder F5 druecke — die letzte Session
   zurueckholen"; ausdruecklich OHNE Warnung beim Schliessen)
   - Der Stand der geladenen Wand wird nach jeder Aenderung gedrosselt
     (hoechstens alle SITZUNG_TAKT_MS) in IndexedDB des Browsers gesichert
     — kein Netzwerk (Spec §1), bleibt auf DIESEM Rechner in DIESEM Browser.
     Gesichert wird der Export-Text (wie beim Uebersicht-Rueckweg) plus der
     Stand beim Laden/letzten Export, damit "nicht exportiert" stimmt.
   - Beim naechsten Start OHNE geladene Wand zeigt der Startbildschirm eine
     Karte "Letzte Sitzung gefunden" — wiederhergestellt wird NUR auf Klick
     (sonst bekaeme man beim bewussten Neuanfang eine alte Wand
     untergeschoben). Laedt man stattdessen eine andere Wand, ersetzt deren
     Stand die Sicherung.
   - NICHT gesichert: der Rueckgaengig-Verlauf (beginnt nach dem
     Wiederherstellen neu). Eine Sicherung je Browser — zwei Editor-Tabs
     ueberschreiben sich gegenseitig (der zuletzt geaenderte gewinnt).
   - Ohne IndexedDB (Headless-Harness, gesperrter Speicher) schaltet sich
     die Sicherung still ab; das Werkzeug arbeitet unveraendert.
   ===================================================================== */
const SITZUNG_DB = 'wup_editor_v1_sitzung';
const SITZUNG_STORE = 'sitzung';
const SITZUNG_SCHLUESSEL = 'aktuell';
const SITZUNG_TAKT_MS = 2000;
let sitzungAus = typeof indexedDB === 'undefined';
let sitzungBasisText = null;   /* Export-Text beim Laden bzw. letzten Export */
let sitzungTimer = null;
let sitzungGefunden = null;    /* angebotene Sicherung (Startkarte) */

function sitzungDbAufruf(modus, arbeit) {
  return new Promise((ok, fehl) => {
    if (sitzungAus) { fehl(new Error('IndexedDB nicht verfuegbar')); return; }
    let anfrage;
    try { anfrage = indexedDB.open(SITZUNG_DB, 1); } catch (fehler) { sitzungAus = true; fehl(fehler); return; }
    anfrage.onupgradeneeded = () => anfrage.result.createObjectStore(SITZUNG_STORE);
    anfrage.onerror = () => { sitzungAus = true; fehl(anfrage.error); };
    anfrage.onsuccess = () => {
      const db = anfrage.result;
      let tx, r;
      try { tx = db.transaction(SITZUNG_STORE, modus); r = arbeit(tx.objectStore(SITZUNG_STORE)); }
      catch (fehler) { db.close(); fehl(fehler); return; }
      tx.oncomplete = () => { db.close(); ok(r ? r.result : undefined); };
      tx.onerror = tx.onabort = () => { db.close(); fehl(tx.error); };
    };
  });
}
function sitzungLesen() { return sitzungDbAufruf('readonly', st => st.get(SITZUNG_SCHLUESSEL)); }
function sitzungLoeschen() { return sitzungDbAufruf('readwrite', st => st.delete(SITZUNG_SCHLUESSEL)); }

/* Gleiche Regel wie exportBytesErzeugen(): die Zeilenliste endet bei einer
   Datei mit Schluss-CRLF schon auf '' — nur anhaengen, wenn es fehlt
   (sonst waechst die Datei je Rundlauf um eine Leerzeile). */
function sitzungAktuellerText() {
  const text = exportZeilenErzeugen().zeilen.join('\r\n');
  return text.endsWith('\r\n') ? text : text + '\r\n';
}
/* Nach Laden und nach Export: dieser Stand gilt als "gesichert". */
function sitzungBasisSetzen() {
  if (!modell) return;
  try { sitzungBasisText = sitzungAktuellerText(); } catch (fehler) { sitzungBasisText = null; }
}
/* Von alleNeuRendern() nach jeder Aenderung gerufen: ein laufender Timer
   nimmt beim Ausloesen den DANN aktuellen Stand mit (Drossel, kein
   Verschieben — auch beim Dauerziehen wird alle 2 s gesichert). */
function sitzungVormerken() {
  if (sitzungAus || !modell || sitzungTimer) return;
  sitzungTimer = setTimeout(sitzungJetztSichern, SITZUNG_TAKT_MS);
}
function sitzungJetztSichern() {
  clearTimeout(sitzungTimer);
  sitzungTimer = null;
  if (sitzungAus || !modell) return Promise.resolve();
  let text;
  try { text = sitzungAktuellerText(); } catch (fehler) { return Promise.resolve(); }
  const basis = sitzungBasisText == null ? text : sitzungBasisText;
  const daten = {
    version: 1, zeit: Date.now(), name: modell.dateiName || 'unbenannt.wup',
    encoding: modell.encoding, hatteBom: !!modell.hatteBom, text,
    basisText: basis === text ? null : basis,   /* nur bei Unterschied — spart Platz */
    geaendert: basis !== text,
    uebergabeName: uebergabeAktivName || null
  };
  return sitzungDbAufruf('readwrite', st => st.put(daten, SITZUNG_SCHLUESSEL)).catch(() => {});
}
function sitzungAlterText(ms) {
  const min = Math.round((Date.now() - ms) / 60000);
  if (min < 1) return 'gerade eben';
  if (min < 60) return 'vor ' + min + ' Min.';
  const t = new Date(ms), zz = n => String(n).padStart(2, '0');
  return 'vom ' + zz(t.getDate()) + '.' + zz(t.getMonth() + 1) + '. ' + zz(t.getHours()) + ':' + zz(t.getMinutes());
}
/* Startkarte im Startbildschirm (nur ohne geladene Wand). */
function sitzungAngebotZeigen() {
  if (sitzungAus || modell) return Promise.resolve();
  return sitzungLesen().then(s => {
    const karte = document.getElementById('sitzungKarte');
    if (!karte || !s || !s.text || modell) return;
    sitzungGefunden = s;
    karte.innerHTML = '<div class="sitzung-titel">↺ Letzte Sitzung gefunden</div>'
      + '<div class="sitzung-zeile"><b>' + escapeHtml(s.name) + '</b> · '
      + (s.geaendert ? '<span class="sitzung-geaendert">mit nicht exportierten Änderungen</span>' : 'unverändert seit Laden/Export')
      + ' · ' + sitzungAlterText(s.zeit) + '</div>'
      + '<div class="sitzung-knoepfe">'
      + '<button type="button" class="schaltflaeche schaltflaeche-haupt schaltflaeche-klein" data-sitzung="wiederherstellen">Wiederherstellen</button>'
      + '<button type="button" class="schaltflaeche schaltflaeche-neben schaltflaeche-klein" data-sitzung="verwerfen">Verwerfen</button>'
      + '</div><div class="mini-hinweis">Nur in diesem Browser gespeichert — ersetzt nicht den Export. Rückgängig-Verlauf beginnt neu.</div>';
    karte.classList.remove('versteckt');
  }).catch(() => {});
}
function sitzungWiederherstellen() {
  const s = sitzungGefunden;
  if (!s) return;
  document.getElementById('sitzungKarte').classList.add('versteckt');
  mitLadebalken('Stelle Sitzung „' + s.name + '“ wieder her …', () => {
    try { modell = wupParsen(s.text, s.name, s.encoding || 'windows-1252', !!s.hatteBom); }
    catch (fehler) { hinweisAnzeigen('Sitzung konnte nicht gelesen werden: ' + fehler.message, 'fehler'); return; }
    undoStack.length = 0; redoStack.length = 0;
    ui.auswahl = null; ui.kanten = []; ui.messungen = []; ui.messStart = null; ui.neueNrStart = null;
    ui.neueKontur = null; ui._neueKonturMaus = null;
    neuVorgabenNachLaden(); ui.seitenWahl = null;
    /* Basis = Stand beim Laden/Export aus der Sicherung — "nicht exportiert"
       bleibt also erhalten */
    sitzungBasisText = s.basisText == null ? s.text : s.basisText;
    /* aus der Uebersicht geoeffnet? Rueckweg wieder aufnehmen (die
       Uebersicht ordnet ueber den Dateinamen zu) */
    uebergabeAktivName = s.uebergabeName || null;
    document.getElementById('startOverlay').classList.add('versteckt');
    zoomEinpassen();
    alleNeuRendern();
    hinweisAnzeigen('Sitzung wiederhergestellt: ' + s.name + ' (Stand ' + sitzungAlterText(s.zeit) + ')'
      + (s.geaendert ? ' — mit nicht exportierten Änderungen, bitte exportieren' : '') + '.', 'erfolg');
  });
}
function sitzungVerwerfen() {
  sitzungGefunden = null;
  document.getElementById('sitzungKarte').classList.add('versteckt');
  sitzungLoeschen().catch(() => {});
  hinweisAnzeigen('Gesicherte Sitzung verworfen.', 'info');
}
function sitzungEinrichten() {
  const karte = document.getElementById('sitzungKarte');
  if (karte) karte.addEventListener('click', ev => {
    ev.stopPropagation();   /* nicht die Drop-Zone (Dateidialog) ausloesen */
    const b = ev.target.closest('[data-sitzung]');
    if (!b) return;
    if (b.dataset.sitzung === 'wiederherstellen') sitzungWiederherstellen();
    else sitzungVerwerfen();
  });
  /* Beim Verlassen einen noch ausstehenden Stand sofort sichern (Drossel
     nicht abwarten) — best effort, ersetzt den 2-s-Takt nicht. */
  const sofort = () => { if (sitzungTimer) sitzungJetztSichern(); };
  window.addEventListener('pagehide', sofort);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') sofort(); });
  sitzungAngebotZeigen();
}
