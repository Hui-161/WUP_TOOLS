#!/usr/bin/env node
/*
  Basis-Smoke-Test fuer wup_editor_oversight.html (headless, ohne Browser).

  Ein iframe/fetch-Kern-Ladepfad laesst sich in Node ohne echten Browser nicht
  sinnvoll pruefen — das macht der Auftraggeber im Browser. Hier wird nur
  geprueft, was headless aussagekraeftig ist:
    a) das <script>-Innere ist syntaktisch gueltiges JS (new Function).
    b) die Datei referenziert tatsaechlich die erwarteten Kern-Funktionsnamen
       (wupParsen, werteErsetzen, f3AutoPsf, ...) sowie die Uebergabe-
       localStorage-Schluessel — d.h. sie bindet sich an den WUP-Editor-Kern
       statt eigene Parser-/Automatik-Logik mitzubringen.

  Aufruf:  node Wup/Tests/oversight_smoke.js
*/
'use strict';
const fs = require('fs');
const path = require('path');

const dateiPfad = path.join(__dirname, '..', 'wup_editor_oversight', 'wup_editor_oversight.html');

function pruefen(bedingung, text, ok, fehlgeschlagen) {
  if (bedingung) { console.log('  OK      ' + text); ok.n++; }
  else { console.error('  FEHLER  ' + text); fehlgeschlagen.n++; }
}

function main() {
  const ok = { n: 0 }, fehlgeschlagen = { n: 0 };
  const html = fs.readFileSync(dateiPfad, 'utf8');

  /* a) Syntax */
  const m = html.match(/<script>([\s\S]*)<\/script>/);
  pruefen(!!m, 'genau ein <script>-Block gefunden', ok, fehlgeschlagen);
  if (m) {
    try { new Function(m[1]); pruefen(true, 'Script ist syntaktisch gueltiges JS (new Function)', ok, fehlgeschlagen); }
    catch (e) { pruefen(false, 'Script ist syntaktisch gueltiges JS — Exception: ' + e.message, ok, fehlgeschlagen); }
  }

  /* b) Referenzierte Kern-Funktionen — keine eigene Logik-Duplikation.
     wupParsen wird ueber kern.eval('...wupParsen(...)') aufgerufen (siehe
     Kopf-Kommentar: let/const-Zustand des Kerns ist von aussen nur per eval
     erreichbar), exportDateinameBestimmen laeuft intern in
     kern.exportBytesErzeugen() mit - beide daher nur als Bezeichner geprueft,
     der Rest als direkter kern.xxx(...)-Aufruf. */
  pruefen(/\bwupParsen\(/.test(html), 'ruft wupParsen(...) auf (im Kern, per kern.eval)', ok, fehlgeschlagen);
  pruefen(/\bexportDateinameBestimmen\b/.test(html), 'erwaehnt exportDateinameBestimmen (laeuft in exportBytesErzeugen mit)', ok, fehlgeschlagen);
  const kernFunktionen = [
    'dateiDekodieren', 'exportZeilenErzeugen', 'exportBytesErzeugen',
    'f1AlleAusfuehren', 'f2SammelAktion', 'f3AutoPsf',
    'autoKonturVerbinden', 'werteErsetzen', 'pruefungenAusfuehren', 'bestaetigen'
  ];
  for (const name of kernFunktionen) {
    const treffer = new RegExp('kern\\.' + name + '\\b').test(html);
    pruefen(treffer, 'referenziert kern.' + name + '(...)', ok, fehlgeschlagen);
  }

  /* Uebergabe-Schluessel (Editor <-> Oversight) */
  pruefen(html.includes("'wup_editor_v1_uebergabe'"), "verwendet den Schluessel 'wup_editor_v1_uebergabe'", ok, fehlgeschlagen);
  pruefen(html.includes('wup_editor_v1_uebergabeZurueck'), "verwendet den Rueckweg-Schluessel 'wup_editor_v1_uebergabeZurueck'", ok, fehlgeschlagen);
  pruefen(html.includes("addEventListener('storage'"), 'lauscht auf das storage-Event (Live-Ruecksynchronisation)', ok, fehlgeschlagen);

  /* Kein <script>-String in Kommentaren, der den Extraktions-Regex bricht
     (frueher Fehler in dieser Datei selbst — als Regressionsschutz belassen) */
  const scriptTags = (html.match(/<script>/g) || []).length;
  pruefen(scriptTags === 1, 'genau ein <script>-Oeffnungstag in der Datei (kein irrefuehrendes Vorkommen in Kommentaren)', ok, fehlgeschlagen);

  /* Kern-Lade-Mechanismus vorhanden (fetch + Fallback-Overlay + Poll) */
  pruefen(/EDITOR_PFADE\s*=\s*\['\.\.\/wup_editor\/wup_editor\.html',\s*'wup_editor\.html'\]/.test(html),
    "kennt beide Editor-Pfade: '../wup_editor/wup_editor.html' (Ordner je Werkzeug, seit 2026-09-07) und 'wup_editor.html' (flache Toolbox-Ablage)", ok, fehlgeschlagen);
  pruefen(/fetch\(EDITOR_PFADE\[i\]\)/.test(html), 'holt den Editor per fetch ueber die Pfadliste (Rueckfall auf den naechsten Pfad)', ok, fehlgeschlagen);
  pruefen(/window\.open\(editorPfad,/.test(html), "'Im Editor oeffnen' nutzt denselben gefundenen Pfad (editorPfad)", ok, fehlgeschlagen);
  pruefen(html.includes('contentDocument'), 'schreibt den Kern-Inhalt per contentDocument.open()/write()/close()', ok, fehlgeschlagen);

  /* c) Arbeitspaket 1 — postMessage-Kanal (origin-unabhaengig, Ergaenzung zu
     localStorage fuer file://) - Typen und Fenster-Referenz. */
  pruefen(html.includes("'wup-editor-bereit'"), "postMessage-Typ 'wup-editor-bereit' referenziert", ok, fehlgeschlagen);
  pruefen(html.includes("'wup-uebergabe'"), "postMessage-Typ 'wup-uebergabe' referenziert", ok, fehlgeschlagen);
  pruefen(html.includes("'wup-stand'"), "postMessage-Typ 'wup-stand' referenziert", ok, fehlgeschlagen);
  pruefen(/fensterRef\s*=\s*window\.open/.test(html), 'merkt sich die geoeffnete Editor-Fensterreferenz (fensterRef)', ok, fehlgeschlagen);
  pruefen(html.includes("addEventListener('message'"), 'lauscht auf das message-Event (zweiter Uebergabe-Kanal)', ok, fehlgeschlagen);

  /* d) Arbeitspaket 2 — Feedback-Modus, eigener Speicher-Schluessel (ueber
     SPEICHER_PRAEFIX -> 'wup_oversight_v1_feedbackListe') und eigener Kopftext,
     NICHT der Editor-Kopftext. */
  for (const name of ['feedbackModusUmschalten', 'feedbackEinrichten', 'feedbackPanelRendern',
    'feedbackTextErzeugen', 'feedbackInfoFuer', 'feedbackBereichFuer']) {
    pruefen(new RegExp('function\\s+' + name + '\\b').test(html), 'definiert ' + name + '(...)', ok, fehlgeschlagen);
  }
  pruefen(html.includes("speicherLaden('feedbackListe'"), "Feedback-Liste ueber speicherLaden('feedbackListe', ...) - Schluessel wird SPEICHER_PRAEFIX + 'feedbackListe' = 'wup_oversight_v1_feedbackListe'", ok, fehlgeschlagen);
  pruefen(html.includes("'WUP-Übersicht Feedback"), "eigener Kopftext 'WUP-Übersicht Feedback' (nicht der Editor-Text)", ok, fehlgeschlagen);

  /* e) Arbeitspaket 3 — Quelltext/Struktur-Panel der ausgewaehlten Karte
     (zeileFaerben 1:1 aus dem Editor uebernommen, kein eigener Parser). */
  for (const name of ['zeileFaerben', 'steuercodeHtml', 'quelltextRendern', 'strukturRendern', 'quelltextPanelUmschalten']) {
    pruefen(new RegExp('function\\s+' + name + '\\b').test(html), 'definiert ' + name + '(...)', ok, fehlgeschlagen);
  }

  /* f) Arbeitspaket 4 — Mehrfachauswahl der Karten + Wirkung auf die
     Automatiken/Werte-ersetzen (nur bei vorhandener Auswahl eingeschraenkt). */
  for (const name of ['kartenKlick', 'auswahlAlle', 'auswahlLeeren', 'ausgewaehlteDateiIndizes']) {
    pruefen(new RegExp('function\\s+' + name + '\\b').test(html), 'definiert ' + name + '(...)', ok, fehlgeschlagen);
  }
  pruefen(/automatikUeberAlleDateien[\s\S]{0,400}ausgewaehlteDateiIndizes/.test(html), 'automatikUeberAlleDateien() nutzt ausgewaehlteDateiIndizes() (Automatik wirkt nur auf Auswahl)', ok, fehlgeschlagen);
  pruefen(/werteErsetzenAusfuehren[\s\S]{0,400}ausgewaehlteDateiIndizes/.test(html), 'werteErsetzenAusfuehren() nutzt ausgewaehlteDateiIndizes() (Auswahl-Einschraenkung)', ok, fehlgeschlagen);

  /* g) Arbeitspaket 5 — Tastenkuerzel + Alt-Solo auf beiden Chip-Reihen. */
  pruefen(/function\s+tastenkuerzelEinrichten\b/.test(html), 'definiert tastenkuerzelEinrichten(...)', ok, fehlgeschlagen);
  pruefen(/function\s+chipSoloUmschalten\b/.test(html), 'definiert chipSoloUmschalten(...) (Alt+Klick = Solo, Bearbeitungen + Lagen)', ok, fehlgeschlagen);
  pruefen(html.includes('ev.altKey'), 'chip-Klick-Handler prueft ev.altKey (Solo-Umschaltung)', ok, fehlgeschlagen);

  console.log('\nOversight-Smoke: ' + ok.n + ' OK, ' + fehlgeschlagen.n + ' Fehler');
  process.exit(fehlgeschlagen.n ? 1 : 0);
}

main();
