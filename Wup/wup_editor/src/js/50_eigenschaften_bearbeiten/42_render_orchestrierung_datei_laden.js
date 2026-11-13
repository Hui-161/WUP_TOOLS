/* =====================================================================
   §12 RENDER-ORCHESTRIERUNG
   ===================================================================== */
function alleNeuRendern(behalteAuswahl) {
  if (!modell) return;
  for (const id of ['btnAutomatiken', 'btnAutoSchnitt', 'btnAutoPsf', 'btnAutoKontur', 'btnAutoRichtung', 'btnEckenPml', 'btnAutoFreistich', 'btnWerteErsetzen', 'btnPsfEinstell', 'btnExport', 'btnWupworksSenden', 'btnExportEinstell']) {
    const b = document.getElementById(id);
    if (b) b.disabled = false;
  }
  if (!behalteAuswahl) ui.auswahl = null;
  else if (ui.auswahl && !auswahlAufloesen()) ui.auswahl = null;
  pruefungenAusfuehren();
  textZustand.dirty = true;
  snapPunkteAufbauen();
  svgRendern();
  textPanelRendern();
  eigenschaftenRendern();
  lagenListeRendern();
  fehlerLogRendern();
  baumRendern();
  messPanelRendern();
  verschiebenOverlayRendern();
  statistikRendern();
  fehlerZaehlerRendern();
  undoRedoKnoepfe();
  kopfMetadatenRendern();   /* v2.59: Wandname, Bauvorhaben … in der Kopfzeile */
  opFilterChipsRendern();   /* v2.59: BOZ-Chip nur bei Bohrungen in der Wand */

  /* Oversight-Ergaenzung: gedrosselte Ruecksynchronisation, siehe
     uebergabeUebernehmen() weiter oben. Ohne aktive Uebergabe (Normalfall)
     ist uebergabeAktivName null und dieser Block ist ein no-op. */
  if (uebergabeAktivName) uebergabeZurueckVormerken();
  sitzungVormerken();   /* v2.55: Sitzung gedrosselt sichern (F5/Schliessen) */
}

/* =====================================================================
   §13 DATEI LADEN  (Drop, Dialog, JSON-Sicherung)
   ===================================================================== */
/* WP-E: unbestimmter Ladebalken fuer das synchrone Einlesen (Parsen +
   Pruefungen + Erst-Rendering blockieren den Haupt-Thread). Die Arbeit wird
   per setTimeout vom Ereignis entkoppelt, damit der Browser das Overlay
   VOR der Blockade ueberhaupt zeichnen kann. */
function mitLadebalken(text, arbeit) {
  let ov = document.getElementById('ladeOverlay');
  if (!ov) {
    ov = document.createElement('div');
    ov.className = 'lade-overlay';
    ov.id = 'ladeOverlay';
    ov.innerHTML = '<div class="lade-fenster"><div class="lade-titel" id="ladeTitel"></div>'
      + '<div class="lade-balken-aussen"><div class="lade-balken-innen"></div></div></div>';
    document.body.appendChild(ov);
  }
  ov.style.display = 'flex';
  document.getElementById('ladeTitel').textContent = text;
  setTimeout(() => {
    try { arbeit(); } finally { ov.style.display = 'none'; }
  }, 40);
}
function dateiVerarbeiten(file) {
  if (!file) return;
  file.arrayBuffer().then(buffer => mitLadebalken('Lese Wand „' + file.name + '“ …', () => {
    let text, encoding, hatteBom;
    try {
      ({ text, encoding, hatteBom } = dateiDekodieren(buffer));
      modell = wupParsen(text, file.name, encoding, hatteBom);
    } catch (e) {
      hinweisAnzeigen('Parser-Fehler: ' + e.message, 'fehler');
      console.error(e);
      return;
    }
    undoStack.length = 0; redoStack.length = 0;
    sitzungBasisSetzen();   /* v2.55: frisch geladen = nichts "nicht exportiert" */
    uebergabeAktivName = null;   /* eigenstaendig geladen — kein Uebersicht-Rueckweg mehr fuer die alte Wand */
    ui.auswahl = null; ui.kanten = []; ui.messungen = []; ui.messStart = null; ui.neueNrStart = null;
    ui.neueKontur = null; ui._neueKonturMaus = null;
    neuVorgabenNachLaden(); ui.seitenWahl = null;   /* v2.54: gemerkte Schichten statt null */
    neuKonturLagenPopoverSchliessen(); seitenWahlPopupVerstecken();
    document.getElementById('startOverlay').classList.add('versteckt');
    zoomEinpassen();
    alleNeuRendern();
    const txtN = modell.stats.txtLines;
    hinweisAnzeigen('Geladen: ' + modell.layers.length + ' Lagen, ' + modell.beams.length
      + ' Bauteile, ' + modell.stats.parsedLines + ' Zeilen'
      + (txtN ? ' (' + txtN + ' TXT)' : '') + ' · ' + encoding + '.', 'erfolg');
    if (modell.multiwand)
      hinweisAnzeigen('Achtung: Datei enthaelt mehrere Elemente (Multiwand). Bearbeitung erfolgt am Gesamtdatensatz.', 'warnung');
    gravierendeBefundePopup();   /* WP-H: P-19/P-21/P-22 direkt beim Laden melden */
  })).catch(e => hinweisAnzeigen('Datei konnte nicht gelesen werden: ' + e.message, 'fehler'));
}
