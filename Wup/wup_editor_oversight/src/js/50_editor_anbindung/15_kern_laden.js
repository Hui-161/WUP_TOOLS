/* =====================================================================
   §2 KERN-LADE-MECHANISMUS
   Laedt wup_editor.html vollstaendig in ein verstecktes iframe (about:blank
   erbt die Origin der Elternseite — funktioniert auch bei file://) und
   wartet, bis die Kern-Funktionen existieren. Siehe Kopf-Kommentar fuer die
   let/const-vs-window-Feinheit, die den Rest dieser Datei bestimmt.
   ===================================================================== */
let kern = null;            /* iframe.contentWindow nach erfolgreichem Laden */
let kernLadenPromise = null;
/* Wo der Editor liegt — in dieser Reihenfolge versucht: zuerst der eigene
   Werkzeugordner des Editors (ein Ordner je Werkzeug, Quelle-und-Artefakt.md
   §11, seit 2026-09-07), dann die flache Ablage der Toolbox, in der beide
   Dateien nebeneinander liegen. Der gefundene Pfad gilt auch fuer
   "Im Editor oeffnen" (window.open). */
const EDITOR_PFADE = ['../wup_editor/wup_editor.html', 'wup_editor.html'];
let editorPfad = EDITOR_PFADE[0];

function wartenAufKern(iframeWindow) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const TIMEOUT_MS = 8000;
    (function poll() {
      let w = null;
      try { w = iframeWindow; } catch (fehler) { w = null; }
      if (w && typeof w.wupParsen === 'function' && typeof w.exportZeilenErzeugen === 'function') {
        resolve(w);
        return;
      }
      if (Date.now() - start > TIMEOUT_MS) {
        reject(new Error('wup_editor.html wurde geladen, aber die erwarteten Kern-Funktionen '
          + '(wupParsen/exportZeilenErzeugen) sind nach ' + TIMEOUT_MS + ' ms nicht vorhanden.'));
        return;
      }
      setTimeout(poll, 50);
    })();
  });
}

function kernSchreiben(html) {
  const iframe = document.getElementById('kernFrame');
  const doc = iframe.contentDocument;
  doc.open();
  doc.write(html);
  doc.close();
  return wartenAufKern(iframe.contentWindow);
}

function kernquelleUeberlayZeigen() {
  return new Promise((resolve, reject) => {
    const overlay = document.getElementById('kernquelleOverlay');
    const dropzone = document.getElementById('kernquelleDropzone');
    const input = document.getElementById('kernquelleInput');
    overlay.style.display = 'flex';
    const aufraeumen = () => { overlay.style.display = 'none'; };
    const verarbeiten = file => {
      if (!file) return;
      file.text().then(html => {
        aufraeumen();
        kernSchreiben(html).then(resolve, reject);
      }).catch(fehler => hinweisAnzeigen('Konnte Datei nicht lesen: ' + fehler.message, 'fehler'));
    };
    dropzone.onclick = () => input.click();
    input.onchange = () => { verarbeiten(input.files[0]); input.value = ''; };
    ['dragover', 'dragenter'].forEach(t => dropzone.addEventListener(t, ev => {
      ev.preventDefault(); dropzone.classList.add('ueber-drag');
    }));
    ['dragleave', 'drop'].forEach(t => dropzone.addEventListener(t, ev => {
      ev.preventDefault(); dropzone.classList.remove('ueber-drag');
    }));
    dropzone.addEventListener('drop', ev => {
      const file = ev.dataTransfer.files && ev.dataTransfer.files[0];
      verarbeiten(file);
    });
  });
}

function editorHolen(i) {
  if (i >= EDITOR_PFADE.length) return Promise.reject(new Error('wup_editor.html unter keinem der Pfade gefunden'));
  return fetch(EDITOR_PFADE[i])
    .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); editorPfad = EDITOR_PFADE[i]; return r.text(); })
    .catch(() => editorHolen(i + 1));
}
function editorKernLaden() {
  if (kernLadenPromise) return kernLadenPromise;
  kernLadenPromise = editorHolen(0)
    .then(html => kernSchreiben(html))
    .catch(() => kernquelleUeberlayZeigen())
    .then(w => { kern = w; return w; });
  return kernLadenPromise;
}
async function kernSicherstellen() {
  if (kern) return kern;
  return editorKernLaden();
}

/* Setzt/liest den lexikalischen "modell"-Zustand im Kern — siehe Kopf-
   Kommentar, warum das ueber kern.eval() laufen muss und nicht per simpler
   Property-Zuweisung. Liefert eine direkte (nicht geklonte) Referenz auf
   das Kern-Modell zurueck. */
function kernModellSetzen(text, name, encoding, hatteBom) {
  kern.__uebergabe = { text, name, encoding, hatteBom };
  return kern.eval(
    'modell = wupParsen(window.__uebergabe.text, window.__uebergabe.name, '
    + 'window.__uebergabe.encoding, window.__uebergabe.hatteBom); '
    + 'undoStack.length = 0; redoStack.length = 0; modell;'
  );
}
function kernExportText() {
  const zeilen = kern.exportZeilenErzeugen().zeilen;
  /* v0.14: Schluss-CRLF wie kern.exportBytesErzeugen() — die Zeilenliste
     endet bei einer Datei mit Schluss-CRLF schon auf ''; das fruehere
     "+ CRLF" haengte je Automatiklauf eine Leerzeile an (auch im Export). */
  const text = zeilen.join('\r\n');
  return text.endsWith('\r\n') ? text : text + '\r\n';
}
/* Fuehrt eine Kern-Automatik aus, deren evtl. bestaetigen()-Dialog fuer den
   Sammel-Lauf ueber alle Dateien uebersprungen wird (Auto-Ja). bestaetigen
   ist eine "function"-Deklaration im Kern und damit eine echte Property des
   Kern-window — reassignment von aussen wirkt sich auf alle Kern-Funktionen
   aus, die "bestaetigen(...)" aufrufen (z.B. f1AlleAusfuehren). */
function kernAutomatikOhneDialog(fn) {
  const original = kern.bestaetigen;
  kern.bestaetigen = (frage, jaText, jaFn) => { if (jaFn) jaFn(); };
  try { fn(); } finally { kern.bestaetigen = original; }
}

