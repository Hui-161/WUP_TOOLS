/* =====================================================================
   §4b SITZUNG WIEDERHERSTELLEN (v0.14, Anwenderwunsch: "wenn ich aus
   Versehen den Browser schliesse oder F5 druecke — die letzte Session
   zurueckholen"; ausdruecklich OHNE Warnung beim Schliessen)
   Gleiche Bauart wie im Editor (dort 73_sitzung_wiederherstellen.js),
   eigene Datenbank: alle geladenen Dateien (Text, Kodierung, Geaendert-
   Kennzeichen, Dateidatum) gedrosselt in IndexedDB. localStorage reicht
   hier NICHT — 50 Waende sind schnell mehrere MB, localStorage hat ~5 MB
   und teilt sie unter file:// mit dem Editor.
   Nach dem Neuladen bietet der Leer-Bildschirm "Letzte Sitzung gefunden"
   an; wiederhergestellt wird nur auf Klick. NICHT gesichert: der
   Rueckgaengig-Verlauf, Auswahl, Suche/Filter.
   ===================================================================== */
const SITZUNG_DB = 'wup_oversight_v1_sitzung';
const SITZUNG_STORE = 'sitzung';
const SITZUNG_SCHLUESSEL = 'aktuell';
const SITZUNG_TAKT_MS = 2000;
let sitzungAus = typeof indexedDB === 'undefined';
let sitzungTimer = null;
let sitzungGefunden = null;
let sitzungWirdHergestellt = false;

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

/* Von dateiAktualisieren() gerufen (Laden, Automatik, Werte ersetzen,
   Rueckgaengig, Editor-Rueckweg) — Drossel: der laufende Timer sichert
   beim Ausloesen den DANN aktuellen Stand. */
function sitzungVormerken() {
  if (sitzungAus || sitzungWirdHergestellt || sitzungTimer) return;
  sitzungTimer = setTimeout(sitzungJetztSichern, SITZUNG_TAKT_MS);
}
function sitzungJetztSichern() {
  clearTimeout(sitzungTimer);
  sitzungTimer = null;
  if (sitzungAus || !dateien.length) return Promise.resolve();
  const daten = {
    version: 1, zeit: Date.now(),
    dateien: dateien.map(d => ({ name: d.name, text: d.text, encoding: d.encoding, hatteBom: !!d.hatteBom,
      geaendert: !!d.geaendert, datum: d.datum || 0 }))
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
function sitzungAngebotZeigen() {
  if (sitzungAus || dateien.length) return Promise.resolve();
  return sitzungLesen().then(s => {
    const karte = document.getElementById('sitzungKarte');
    if (!karte || !s || !Array.isArray(s.dateien) || !s.dateien.length || dateien.length) return;
    sitzungGefunden = s;
    const geaendert = s.dateien.filter(d => d.geaendert).length;
    karte.innerHTML = '<div class="sitzung-titel">↺ Letzte Sitzung gefunden</div>'
      + '<div class="sitzung-zeile"><b>' + s.dateien.length + ' Datei(en)</b>'
      + (geaendert ? ', davon <span class="sitzung-geaendert">' + geaendert + ' bearbeitet</span>' : ', keine bearbeitet')
      + ' · ' + sitzungAlterText(s.zeit) + '</div>'
      + '<div class="sitzung-namen klein">' + s.dateien.slice(0, 6).map(d => escapeHtml(d.name)).join(', ')
      + (s.dateien.length > 6 ? ' …' : '') + '</div>'
      + '<div class="sitzung-knoepfe">'
      + '<button type="button" class="schaltflaeche schaltflaeche-haupt schaltflaeche-klein" data-sitzung="wiederherstellen">Wiederherstellen</button>'
      + '<button type="button" class="schaltflaeche schaltflaeche-neben schaltflaeche-klein" data-sitzung="verwerfen">Verwerfen</button>'
      + '</div><div class="klein">Nur in diesem Browser gespeichert — ersetzt nicht den Export. Rückgängig-Verlauf beginnt neu.</div>';
    karte.classList.remove('versteckt');
  }).catch(() => {});
}
async function sitzungWiederherstellen() {
  const s = sitzungGefunden;
  if (!s || dateien.length) return;
  document.getElementById('sitzungKarte').classList.add('versteckt');
  try { await kernSicherstellen(); }
  catch (fehler) { hinweisAnzeigen('Kern konnte nicht geladen werden: ' + fehler.message, 'fehler'); return; }
  sitzungWirdHergestellt = true;
  fortschrittZeigen('Sitzung wiederherstellen', 0, s.dateien.length);
  let fehlerAnzahl = 0;
  for (let i = 0; i < s.dateien.length; i++) {
    const g = s.dateien[i];
    fortschrittZeigen('Sitzung wiederherstellen', i + 1, s.dateien.length, g.name);
    await warteKurz();
    try {
      dateien.push({ name: g.name, text: g.text, encoding: g.encoding, hatteBom: g.hatteBom,
        waende: [], fehlerAnzahl: 0, geaendert: !!g.geaendert, datum: g.datum || 0, ladeNr: dateien.length });
      dateiAktualisieren(dateien.length - 1);
    } catch (fehler) {
      fehlerAnzahl++;
      dateien.pop();
      hinweisAnzeigen('Nicht wiederhergestellt: ' + g.name + ' (' + fehler.message + ')', 'fehler');
    }
  }
  sitzungWirdHergestellt = false;
  fortschrittVerbergen();
  ansichtAktualisieren();
  const geaendert = dateien.filter(d => d.geaendert).length;
  hinweisAnzeigen('Sitzung wiederhergestellt: ' + dateien.length + ' Datei(en)' + (geaendert ? ', ' + geaendert + ' bearbeitet — bitte exportieren' : '')
    + (fehlerAnzahl ? ' · ' + fehlerAnzahl + ' fehlgeschlagen' : '') + '.', fehlerAnzahl ? 'warnung' : 'erfolg');
  gravierendeBefundePopupOversight();
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
  const sofort = () => { if (sitzungTimer) sitzungJetztSichern(); };
  window.addEventListener('pagehide', sofort);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') sofort(); });
  sitzungAngebotZeigen();
}
