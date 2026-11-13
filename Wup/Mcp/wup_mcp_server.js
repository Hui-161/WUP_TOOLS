#!/usr/bin/env node
/*
  WUP-MCP-Server 1.8
  Stellt die Fachlogik des WUP-Editors (Parsen, Pruefregeln, Automatiken, 
  Werte ersetzen, Format-Referenz) als MCP-Server ueber stdio bereit. Keine 
  Fremdpakete, kein Netzwerkzugriff. Anlagen- und ortsspezifische Angaben 
  stehen in wup_mcp_konfig.js, die Geraetebelegung in profil.json (siehe 
  README.md).

  Copyright (C) 2026 Lars Ojus
  Lizenz: GNU General Public License v3.0 (GPL-3.0-only) — siehe LICENSE im Repository.
  OHNE JEDE GEWAEHRLEISTUNG / ABSOLUTELY NO WARRANTY.
  Kein Produkt von WEINMANN/HOMAG. Geschrieben mit Claude (Anthropic).
*/
'use strict';

const fs = require('fs');
const path = require('path');
const { kontextErzeugen, editorScriptLaden, vm } = require('../Tests/harness.js');
const pdfText = require('./wup_pdf_text.js');
/* Alles Anlagen- und Repo-Spezifische (v1.8): Titel, Ordner, Schreibsperre,
   Dokumentquellen, Anlagen-Hinweis, Textbausteine der Referenz, Ressourcen.
   Dieser Server traegt davon nichts selbst — siehe Kopf von wup_mcp_konfig.js. */
const KONFIG = require('./wup_mcp_konfig.js');
const KONFIG_TEXTE = KONFIG.texte || {};
/* Textbaustein aus der Konfiguration, woertlich; fehlt er, bleibt die Stelle leer */
function baustein(name) { return typeof KONFIG_TEXTE[name] === 'string' ? KONFIG_TEXTE[name] : ''; }

const SERVER_NAME = 'wup';
const SERVER_VERSION = '1.8.0';
/* 2025-03-26 wird nicht mehr angeboten: diese Version verlangt JSON-RPC-
   Batches; wir beantworten Arrays nur tolerant (siehe Transport). */
const PROTOKOLL_VERSIONEN = ['2025-06-18', '2024-11-05'];
const VM_ZEITLIMIT_MS = 120000;
const REPO_ROOT = path.join(__dirname, '..', '..');
/* Vorgabe-Ordner fuer wup_ordner_pruefen und den Selbsttest (Konfiguration) */
const VORGABE_ORDNER_REL = KONFIG.vorgabeOrdner || 'Wup';
const BEISPIEL_ORDNER = path.join(REPO_ROOT, ...VORGABE_ORDNER_REL.split('/'));
const EDITOR_PFAD = path.join(REPO_ROOT, 'Wup', 'wup_editor', 'wup_editor.html');
const PDF_ORDNER = path.join(REPO_ROOT, 'Wup', '02_Schnittstellenbeschreibung etc');
/* Einmalig gerenderte Seitenbilder + Seitentext (Wup/Mcp/werkzeuge/pdf_seiten_erzeugen.js) */
const SEITEN_ORDNER = path.join(PDF_ORDNER, 'Seiten');
/* Abbildungskatalog: KI-gelesene Beschreibungen der Zeichnungen (fachlich zu pruefen) */
const ABBILDUNGEN_PFAD = path.join(REPO_ROOT, 'Wup', 'Doku', 'weinmann-abbildungen.md');
const PROFIL_HINWEIS = 'PROFIL_STANDARD des Editors (Browser-Anwenderprofil wird headless nicht gelesen)';

/* Ordner, in die der Server NIE schreibt (relativ zum Repo-Root) — aus der
   Konfiguration. Der eigene Ordner und .git sind immer gesperrt, auch wenn
   die Konfiguration sie nicht nennt. */
const SCHREIBSPERRE = (Array.isArray(KONFIG.schreibsperre) ? KONFIG.schreibsperre.slice() : []);
for (const immer of ['Wup/Mcp', '.git']) if (!SCHREIBSPERRE.includes(immer)) SCHREIBSPERRE.push(immer);

/* Dokumentquellen von wup_spezifikation — vollstaendig aus der Konfiguration
   (Titel, Dateien, seitenVon, zusatz, versionsHinweis, anlagenHinweis,
   einzelbilderUndTabellen). Eine Quelle, die dort fehlt, gibt es nicht:
   Schema, 'beide'/'alle', Kataloge und Ressourcen leiten sich hieraus ab. */
const PDF_QUELLEN = KONFIG.quellen || {};
const QUELLEN_NAMEN = Object.keys(PDF_QUELLEN);
/* 'sitebroker': Markdown-Dokumente ohne Seiten — nur, wenn konfiguriert */
const SITEBROKER = KONFIG.sitebroker && KONFIG.sitebroker.ordner ? KONFIG.sitebroker : null;
/* Erlaubte Werte von 'quelle' (Schema und Fehlermeldung) */
const QUELLE_ENUM = QUELLEN_NAMEN.concat(SITEBROKER ? ['sitebroker'] : [], ['beide', 'alle']);
/* Hinweis zur Zuordnung der Unterlagen zur Anlage (leer = keiner) */
const ANLAGEN_HINWEIS = typeof KONFIG.anlagenHinweis === 'string' ? KONFIG.anlagenHinweis : '';

/* =====================================================================
   Live aus dem Editor-Script abgelesen (eine Quelle der Wahrheit)
   ===================================================================== */

function editorVersion() {
  const m = editorScriptLaden().match(/const TOOL_VERSION\s*=\s*'([^']+)'/);
  return m ? m[1] : 'unbekannt';
}

/* Pruefregeln aus den melde('level', 'P-nn', 'NAME: …')-Aufrufen des Editors.
   Traegt eine Regel ihren Namen ueber eine Hilfsfunktion (P-23:
   konturOhnePunkteText), wird deren erster 'NAME: '-Text genommen. */
let _pruefregeln = null;
function pruefregelnAusEditor() {
  if (_pruefregeln) return _pruefregeln;
  const script = editorScriptLaden();
  const regeln = {};
  const re = /melde\(\s*'(fehler|warnung|hinweis)'\s*,\s*'(P-\d+)'\s*,\s*(?:'([A-Z][A-Z_0-9]*):|([A-Za-z_]\w*)\()/g;
  let m;
  while ((m = re.exec(script))) {
    const [, level, code, nameLiteral, fnName] = m;
    let name = nameLiteral || null;
    if (!name && fnName) {
      const fn = script.match(new RegExp('function ' + fnName + '\\([^)]*\\)\\s*\\{([\\s\\S]{0,800})'));
      const n = fn && fn[1].match(/'([A-Z][A-Z_0-9]*): /);
      if (n) name = n[1];
    }
    const r = regeln[code] || (regeln[code] = { code, namen: [], levels: [] });
    if (name && !r.namen.includes(name)) r.namen.push(name);
    if (!r.levels.includes(level)) r.levels.push(level);
  }
  const liste = Object.values(regeln).sort((a, b) => parseInt(a.code.slice(2), 10) - parseInt(b.code.slice(2), 10));
  _pruefregeln = { anzahl: liste.length, von: liste[0] ? liste[0].code : null,
    bis: liste.length ? liste[liste.length - 1].code : null, regeln: liste };
  return _pruefregeln;
}
function pruefregelnSpanne() {
  const p = pruefregelnAusEditor();
  return p.anzahl ? p.von + '..' + p.bis : 'P-??';
}

/* =====================================================================
   Hilfen: Pfade, Eingaben, Datenschutz, Editor-Kern laden
   ===================================================================== */

function pfadAufloesen(p, erlaubtOrdner) {
  if (!p || typeof p !== 'string') throw new Error("Parameter 'pfad' fehlt oder ist kein String.");
  const voll = path.isAbsolute(p) ? p : path.join(REPO_ROOT, p);
  if (!fs.existsSync(voll)) throw new Error('Datei nicht gefunden: ' + voll);
  const istOrdner = fs.statSync(voll).isDirectory();
  if (istOrdner && !erlaubtOrdner)
    throw new Error("'" + p + "' ist ein Ordner, keine Datei — fuer Ordner das Tool 'wup_ordner_pruefen' verwenden.");
  if (!istOrdner && erlaubtOrdner)
    throw new Error("'" + p + "' ist eine Datei, kein Ordner.");
  return voll;
}

/* Ganzzahl-Parameter: Zahl oder Ziffern-String; sonst klarer Fehler */
function ganzzahl(wert, name, min, max) {
  let z = wert;
  if (typeof z === 'string' && /^-?\d+$/.test(z.trim())) z = parseInt(z, 10);
  if (typeof z !== 'number' || !Number.isInteger(z))
    throw new Error("Parameter '" + name + "' muss eine Ganzzahl sein (erhalten: " + JSON.stringify(wert) + ').');
  if ((min != null && z < min) || (max != null && z > max)) {
    const bereich = max == null ? 'mindestens ' + min : (min == null ? 'hoechstens ' + max : 'zwischen ' + min + ' und ' + max);
    throw new Error("Parameter '" + name + "' muss " + bereich + ' sein (erhalten: ' + z + ').');
  }
  return z;
}

/* Datenschutz: Zeilen mit Personen-/Kundenbezug in Quelltext-Ausgaben
   maskieren (Roundtrip-Abweichung, Werte-Ersetzen-Hunks). Die Datei selbst
   bleibt unveraendert — maskiert wird nur, was der Server AUSGIBT.
   Zwei Arten: TXT-Felder der CAD-Kopfbloecke ("TXT Bearbeiter : …") und
   Kopf-Keywords — KUNDENAME/ANSCHRIFT (Editor kennt sie) sowie die der
   WUP 3.7 (KUNDENNAME, BEARBEITER, BAUVORHABEN, OBJEKT, ORT), die der Editor
   NICHT kennt und 1:1 durchreicht (v1.5; Wup/Doku/wup-versionen-und-quellen.md).
   Ein leeres Feld bleibt sichtbar leer — "leer lassen" ist die Regel. */
const PERSONEN_TXT_RE = /^(\s*TXT\s+(?:Bearbeiter|Sachbearbeiter|Operator|Kundenname|KUNDENAME|Kunde|Anschrift|ANSCHRIFT|Bauherr|Bauvorhaben|Objekt|Ort|Wohnort|Stra(?:ss|\u00df)e|PLZ)\b\s*:?\s*)(.*)$/i;
const PERSONEN_KOPF = ['KUNDENAME', 'KUNDENNAME', 'ANSCHRIFT', 'BEARBEITER', 'BAUVORHABEN', 'OBJEKT', 'ORT'];
const PERSONEN_KOPF_RE = new RegExp('^(\\s*(?:TXT\\s+)?(?:' + PERSONEN_KOPF.join('|') + ')\\b\\s*:?\\s*)(.*)$', 'i');
function zeileMaskieren(z) {
  const m = PERSONEN_TXT_RE.exec(z) || PERSONEN_KOPF_RE.exec(z);
  if (!m || !m[2].replace(/[\s;]/g, '')) return z;
  return m[1] + '[ausgeblendet: personenbezogen];';
}
const KOPF_MASKIERT_AUSDRUCK = `(() => {
  const h = Object.assign({}, modell.header);
  for (const k of ${JSON.stringify(PERSONEN_KOPF)}) if (h[k] != null && h[k] !== '') h[k] = '[ausgeblendet: personenbezogen]';
  return h;
})()`;

/* ---------------------------------------------------------------------
   Profildatei (v1.8): Headless gibt es kein Browser-Anwenderprofil. Damit der
   Server trotzdem mit der Geraetebelegung der eigenen Anlage rechnen kann,
   liest er OPTIONAL eine Profildatei im Format des Editor-Profils (Teilmenge
   genuegt, z.B. nur {"nr_indizes": {...}}):
     1. Umgebungsvariable WUP_PROFIL (absolut oder relativ zum Repo-Root) —
        ist sie gesetzt, MUSS die Datei lesbar sein;
     2. sonst Wup/Mcp/profil.json, wenn vorhanden;
     3. sonst nichts: PROFIL_STANDARD des Editors, wie bisher.
   Gemischt wird nach dem Laden des Kerns mit der Logik des Editors selbst
   (profilNeuLaden(): flach ueber PROFIL_STANDARD, die Bloecke freistich,
   autoKontur, export, wupworks, richtung feldweise) — keine zweite Mischregel
   hier. Gelesen wird die Datei einmal je Prozess (wie das Editor-Script).
   Ungueltige Datei: KEIN stilles Weiterrechnen — jeder Aufruf, der den Kern
   braucht, endet mit der Fehlermeldung; wup_server_status nennt sie.
   --------------------------------------------------------------------- */
const PROFIL_DATEI_VORGABE = path.join(__dirname, 'profil.json');
let _profilDatei;
function profilDatei() {
  if (_profilDatei !== undefined) return _profilDatei;
  const ausUmgebung = (process.env.WUP_PROFIL || '').trim();
  const pfad = ausUmgebung ? (path.isAbsolute(ausUmgebung) ? ausUmgebung : path.join(REPO_ROOT, ausUmgebung)) : PROFIL_DATEI_VORGABE;
  if (!ausUmgebung && !fs.existsSync(pfad)) return (_profilDatei = null);
  const rel = path.relative(REPO_ROOT, pfad);
  const d = { pfad, anzeige: rel && !rel.startsWith('..') && !path.isAbsolute(rel) ? rel.split(path.sep).join('/') : pfad,
    herkunft: ausUmgebung ? 'Umgebungsvariable WUP_PROFIL' : 'Vorgabe (profil.json neben dem Server)' };
  try {
    if (!fs.existsSync(pfad) || !fs.statSync(pfad).isFile()) throw new Error('Datei nicht gefunden');
    let daten;
    try { daten = JSON.parse(fs.readFileSync(pfad, 'utf8').replace(/^﻿/, '')); }
    catch (err) { throw new Error('kein gueltiges JSON (' + err.message + ')'); }
    if (!daten || typeof daten !== 'object' || Array.isArray(daten))
      throw new Error('muss ein JSON-Objekt im Format des Editor-Profils sein, z.B. {"nr_indizes": {"10": {"name": "Klammergeraet", "psf_offset": 7}}}');
    if (daten.nr_indizes != null) {
      if (typeof daten.nr_indizes !== 'object' || Array.isArray(daten.nr_indizes))
        throw new Error("'nr_indizes' muss ein Objekt sein (Geraeteindex -> { name, psf_offset })");
      for (const [index, geraet] of Object.entries(daten.nr_indizes))
        if (!/^\d+$/.test(index) || !geraet || typeof geraet !== 'object' || Array.isArray(geraet))
          throw new Error("'nr_indizes." + index + "' muss ein Geraet { name, psf_offset } unter einem ganzzahligen Index sein");
    }
    d.json = JSON.stringify(daten);
    d.schluessel = Object.keys(daten);
  } catch (err) {
    d.fehler = 'Profildatei ' + d.anzeige + ' (' + d.herkunft + '): ' + err.message
      + ' — es wird NICHT mit dem Standardprofil weitergerechnet. Datei berichtigen oder entfernen, dann den Server neu starten.';
  }
  return (_profilDatei = d);
}
/* Profildatei mit der Mischlogik des Editors in das Profil des Kontexts bringen */
function profilEinmischen(ctx, pd) {
  ctx.__profilJson = pd.json;
  vm.runInContext(`(() => {
    if (typeof profilNeuLaden !== 'function' || typeof speicherSchluessel !== 'function')
      throw new Error('Der Editor kennt profilNeuLaden() nicht (aelter als v2.63) — eine Profildatei kann nicht eingemischt werden.');
    localStorage.setItem(speicherSchluessel('profil'), __profilJson);
    profilNeuLaden();
  })()`, ctx, { timeout: VM_ZEITLIMIT_MS });
}
/* Stand des wirksamen Profils (einmal je Prozess): Profildatei, Zahl der
   Geraete, Schluessel der Datei, die PROFIL_STANDARD nicht kennt. */
const GERAETE_FEHLEN_HINWEIS = 'Im Profil ist KEINE Geraetebelegung hinterlegt (nr_indizes leer): P-20 meldet jede Nagelreihe als '
  + 'unbekanntes Geraet, Auto-PSF rechnet mit dem konservativen Standard-Offset. Die Belegung der eigenen Anlage als Profildatei '
  + 'mitgeben: Wup/Mcp/profil.json oder Umgebungsvariable WUP_PROFIL, Format des Editor-Profils, z.B. '
  + '{"nr_indizes": {"10": {"name": "Klammergeraet", "psf_offset": 7}}} (Wup/Mcp/README.md, Abschnitt "Konfiguration und Profil").';
let _profilStand = null;
function profilStand() {
  if (_profilStand) return _profilStand;
  const pd = profilDatei();
  const stand = { datei: pd ? pd.anzeige : null, herkunft: pd ? pd.herkunft : null };
  if (pd && pd.fehler) { stand.fehler = pd.fehler; stand.geraete = null; return (_profilStand = stand); }
  try {
    const r = ausKontext(editorKontextFrisch(), `({ geraete: Object.keys(profil.nr_indizes || {}), standard: Object.keys(PROFIL_STANDARD) })`);
    stand.geraete = r.geraete.length;
    stand.geraeteIndizes = r.geraete;
    if (pd) {
      stand.schluessel = pd.schluessel;
      const fremd = pd.schluessel.filter(k => !r.standard.includes(k));
      if (fremd.length) stand.unbekannteSchluessel = fremd;
    }
  } catch (err) { stand.fehler = 'Profil nicht lesbar: ' + err.message; stand.geraete = null; }
  return (_profilStand = stand);
}
/* Womit der Server rechnet — ohne Profildatei woertlich wie bisher */
function profilHinweis() {
  const pd = profilDatei();
  if (!pd || pd.fehler) return PROFIL_HINWEIS;
  return 'PROFIL_STANDARD des Editors, ergaenzt um die Profildatei ' + pd.anzeige + ' (Browser-Anwenderprofil wird headless nicht gelesen)';
}

/* Frischer Kontext mit geladenem Editor-Kern und eingefangenen UI-Rueckkanaelen.
   { ohneProfil: true } laesst die Profildatei weg (fuer Aufrufe, die nur
   Konstanten und profilunabhaengige Funktionen des Kerns brauchen). */
function editorKontextFrisch(optionen) {
  const ctx = kontextErzeugen();
  vm.runInContext(editorScriptLaden(), ctx, { filename: 'wup_editor.html#script' });
  if (!(optionen && optionen.ohneProfil)) {
    const pd = profilDatei();
    if (pd && pd.fehler) throw new Error(pd.fehler);
    if (pd) profilEinmischen(ctx, pd);
  }
  ctx.__meldungen = [];
  const melden = (art) => (...teile) => { ctx.__meldungen.push({ art, text: teile.map(t => String(t)).join(' ') }); };
  /* Funktionsdeklarationen des Scripts sind beschreibbare Eigenschaften des
     Kontext-Globals — Aufrufe im Editor landen auf der neuen Bindung. */
  ctx.hinweisAnzeigen = (text, art) => melden(art || 'info')(text);
  ctx.bestaetigen = (frage, jaText, jaFn) => { melden('bestaetigt')(frage); if (typeof jaFn === 'function') jaFn(); };
  ctx.console = { log: melden('console'), info: melden('console'), warn: melden('console-warn'),
    error: melden('console-error'), debug: () => {} };
  /* Bytes kompakt aus dem Kontext holen (Base64 statt JSON-Zahlenliste) */
  ctx.__b64 = (u8) => Buffer.from(u8).toString('base64');
  return ctx;
}

/* Laedt den Editor-Kern in einen frischen Kontext und parst die WUP-Datei
   (Pfad ODER direkter Text). Rueckgabe: der vm-Kontext mit gesetztem modell. */
function wupKontext(args) {
  const ctx = editorKontextFrisch();
  if (args.pfad) {
    const voll = pfadAufloesen(args.pfad);
    wupPufferLaden(ctx, fs.readFileSync(voll), path.basename(voll));
    ctx.__quellPfad = voll;
  } else if (typeof args.text === 'string' && args.text.length) {
    /* BOM-Zeichen am Anfang entfernen und merken — der Export schreibt es
       dann wie bei einer Datei mit BOM wieder vor den Text. */
    const hatteBom = args.text.charCodeAt(0) === 0xFEFF;
    const encoding = args.encoding || 'windows-1252';
    if (!['windows-1252', 'utf-8', 'ascii', 'utf-16le'].includes(encoding))
      throw new Error("'encoding' muss windows-1252, utf-8, ascii oder utf-16le sein.");
    ctx.__text = hatteBom ? args.text.slice(1) : args.text;
    ctx.__name = args.datei_name || 'eingabe.wup';
    ctx.__bom = hatteBom;
    ctx.__enc = encoding;
    vm.runInContext(`modell = wupParsen(__text, __name, __enc, __bom);`, ctx, { timeout: VM_ZEITLIMIT_MS });
  } else {
    throw new Error("Entweder 'pfad' (Datei im Repo/Dateisystem) oder 'text' (WUP-Inhalt) angeben.");
  }
  return ctx;
}
function wupPufferLaden(ctx, puffer, name) {
  ctx.__buffer = puffer.buffer.slice(puffer.byteOffset, puffer.byteOffset + puffer.byteLength);
  ctx.__name = name;
  vm.runInContext(`
    (() => {
      const dek = dateiDekodieren(__buffer);
      modell = wupParsen(dek.text, __name, dek.encoding, dek.hatteBom);
    })()
  `, ctx, { timeout: VM_ZEITLIMIT_MS });
}

/* JSON-sicher aus dem vm-Kontext holen (Rundreise ueber JSON.stringify im
   Kontext — vermeidet Cross-Realm-Objekte; NaN/undefined werden dabei zu
   null bzw. weggelassen). Zeitlimit gegen Endlosschleifen im Kern. */
function ausKontext(ctx, ausdruck) {
  return JSON.parse(vm.runInContext(`JSON.stringify((() => (${ausdruck}))())`, ctx, { timeout: VM_ZEITLIMIT_MS }));
}
function meldungen(ctx) { return ctx.__meldungen ? ctx.__meldungen.slice() : []; }
function kontextInfo() {
  const k = { editorVersion: editorVersion(), profil: profilHinweis() };
  /* v1.8: ohne Geraetebelegung sind P-20 und die Geraete-Klartexte nicht aussagekraeftig — kurz dazusagen */
  if (profilStand().geraete === 0)
    k.geraetebelegung = 'KEINE Geraetebelegung im Profil — P-20 meldet jede Nagelreihe; Profildatei mitgeben (wup_server_status nennt den Weg).';
  return k;
}

/* =====================================================================
   Fachbausteine (jeweils reine Ausleser ueber dem Editor-Kern)
   ===================================================================== */

/* Plausibilitaet: Ist das ueberhaupt eine WUP-Datei? Der Parser ist bewusst
   tolerant (unbekannte Zeilen werden 1:1 durchgereicht) — deshalb muss der
   Server benennen, was fehlt, statt eine 0x0-Wand als Ergebnis auszugeben. */

/* Stand je Keyword laut Aenderungshistorie (v1.6) — Weinmann "Interface
   version 3.7" Kap. 3 (Stand 06/08/2026, MIT-Lizenz, HomagGroup/WEINMANN-
   wupWorks), gegengelesen mit der deutschen V3.5 Kap. 2.3 und S.28.
     seit         eingefuehrt mit dieser Version
     abgekuendigt "soll nicht mehr verwendet werden" seit dieser Version
     entfernt     in dieser Version gestrichen
     ersatz       laut V3.5 S.28 bzw. 3.7
   Nur Keywords mit Versionsbezug ab 3.1; alles andere gilt seit 3.0 oder
   frueher. Mit welcher Version die Anlage arbeitet, steht in der
   Konfiguration (anlage: version, keywordsBis, versionMin, versionMax);
   ohne Angabe entfallen die Vergleiche mit der Anlage. */
const ANLAGE = KONFIG.anlage || {};
const WUP_ANLAGE_VERSION = ANLAGE.version || '';
const zahlOderNull = (w) => (typeof w === 'number' && isFinite(w)) ? w : null;
/* "3.4" -> 304 (wie zahl() im Versionslage-Ausdruck); null = kein Vergleich */
const ANLAGE_KEYWORD_STAND = (() => { const m = /^(\d+)\.(\d+)/.exec(String(ANLAGE.keywordsBis || '')); return m ? parseInt(m[1], 10) * 100 + parseInt(m[2], 10) : null; })();
const WUP_KEYWORD_STAND = {
  BOZ: { abgekuendigt: '3.4', entfernt: '3.7', ersatz: 'PAF + MP' },
  BOY: { abgekuendigt: '3.4', entfernt: '3.7', ersatz: 'PAF + MP' },
  BOX: { abgekuendigt: '3.4', entfernt: '3.7', ersatz: 'PAF + MP' },
  FRZ: { abgekuendigt: '3.4', entfernt: '3.7', ersatz: 'PAF + PP' },
  FRY: { abgekuendigt: '3.4', entfernt: '3.7', ersatz: 'PAF + PP' },
  PFZ: { abgekuendigt: '3.3', entfernt: '3.7', ersatz: 'PAF + PP (mit Bezugsebene)' },
  PFY: { abgekuendigt: '3.3', entfernt: '3.7', ersatz: 'PAF + PP (mit Bezugsebene)' },
  KER: { abgekuendigt: '3.4', entfernt: '3.7', ersatz: '2x SG' },
  RBE: { seit: '3.3', abgekuendigt: '3.4', entfernt: '3.7', ersatz: 'RBE2 … ENDRBE2' },
  NC: { seit: '3.1', abgekuendigt: '3.5 oder frueher', entfernt: '3.7' },
  WNP: { seit: '3.2', abgekuendigt: '3.4', entfernt: '3.7' },
  REIHE: { entfernt: '3.7' },
  SLI: { abgekuendigt: '3.5', entfernt: '3.7', ersatz: 'PLI' },
  SLA: { abgekuendigt: '3.5', entfernt: '3.7', ersatz: 'PLA' },
  ELA: { abgekuendigt: '3.7', hinweis: '3.7 liest jedes Element als Innenansicht' },
  REFKER: { abgekuendigt: '3.4', wiederSeit: '3.7', hinweis: 'in 3.7 wieder aufgenommen, mit optionaler Bezugsebene e' },
  PSZ: { seit: '3.1' }, PML: { seit: '3.1' }, KB: { seit: '3.2' },
  UNIT: { seit: '3.3' }, ENDUNIT: { seit: '3.3' }, PZF: { seit: '3.3' },
  CAD: { seit: '3.4' }, CADRELEASE: { seit: '3.4' }, RT: { seit: '3.4' }, BTN: { seit: '3.4' },
  RBE2: { seit: '3.4' }, ENDRBE2: { seit: '3.4' }, TA: { seit: '3.4' }, PROPERTY: { seit: '3.4' },
  ENDRT: { seit: '3.5' }, STAPEL: { seit: '3.5', hinweis: 'steht in 3.7 nicht mehr in der Kopftabelle (nicht ausdruecklich entfernt)' },
  PAL: { seit: '3.6' },
  ELEMENTID: { seit: '3.7' }, CADDOKUMENTID: { seit: '3.7' },
  CADDOCUMENTID: { seit: '3.7', hinweis: 'Schreibweise nur im Beispiel der Spezifikation (S.45); die Kopftabelle sagt CADDOKUMENTID' },
  BEARBEITER: { seit: '3.7' }, BAUVORHABEN: { seit: '3.7' }, KUNDENNAME: { seit: '3.7' }, OBJEKT: { seit: '3.7' }, ORT: { seit: '3.7' },
  MODELLREF: { seit: '3.7' }, CADMODELLREF: { seit: '3.7' }, TEILENR: { seit: '3.7' },
};
/* Keywords, die erst NACH V3.5 dazukamen (fuer den Plausibilitaetshinweis) */
const WUP_NACH_V35 = Object.keys(WUP_KEYWORD_STAND).filter(k => ['3.6', '3.7'].includes(WUP_KEYWORD_STAND[k].seit));
const PLAUSIBILITAET_AUSDRUCK = `(() => {
  const h = [];
  const E = modell.header.ELM || {};
  if (!modell.header.VERSION) h.push('Keine VERSION-Kopfzeile (Pflicht, 1. Zeile) — vermutlich keine WUP-Datei.');
  const v = parseFloat(String(modell.header.VERSION || '').replace(',', '.'));
  const vMax = ${JSON.stringify(zahlOderNull(ANLAGE.versionMax))}, vMin = ${JSON.stringify(zahlOderNull(ANLAGE.versionMin))};
  if (vMax != null && v > vMax) h.push('VERSION ' + modell.header.VERSION + ${JSON.stringify(baustein('plausibelNeuer'))});
  else if (vMin != null && v > 0 && v < vMin) h.push('VERSION ' + modell.header.VERSION + ${JSON.stringify(baustein('plausibelAelter'))});
  if (!(E.lx > 0 && E.by > 0)) h.push('ELM fehlt oder 0 — Elementmasse unbekannt; P-04/P-06 sind nicht aussagekraeftig.');
  if (!modell.layers.length && !modell.beams.length) h.push('Weder Lagen (PLI/PLA) noch Bauteile erkannt.');
  const unbekannt = (modell.warnings || []).filter(w => w.code === 'UNBEKANNT');
  if (unbekannt.length) h.push(unbekannt.length + ' Zeile(n) mit unbekanntem Keyword — werden beim Export 1:1 durchgereicht.');
  const nachV35 = [...new Set(unbekannt.map(w => ((modell.rawLines[w.zeile] || '').trim().split(/[\\s;,]+/)[0] || '').toUpperCase()))]
    .filter(k => ${JSON.stringify(WUP_NACH_V35)}.includes(k));
  if (nachV35.length) h.push('Davon neu in WUP 3.6/3.7 (Weinmann-Spezifikation 3.7 Kap. 3, nicht in V3.5): ' + nachV35.join(', ') + '.');
  const leereLagen = modell.layers.filter(l => !l.plates.length).map(l => l.id);
  if (leereLagen.length) h.push('Lage(n) ohne Platte: ' + leereLagen.join(', ') + '.');
  return { istWup: !!modell.header.VERSION && E.lx > 0 && E.by > 0, hinweise: h };
})()`;

/* Versionslage einer Datei (v1.6): welche Keywords sind abgekuendigt oder in
   3.7 entfernt, welche neuer als die Anlage — und drei Abgleiche mit dem
   Wortlaut der Spezifikation, die der Editor nicht prueft. Reine Zaehlung
   ueber die Rohzeilen und das Editor-Modell; es werden keine Werte
   ausgegeben, nur Keywords, Codes und Anzahlen. KEINE vollstaendige
   Konformitaetspruefung und KEINE Editor-Pruefregel — Hinweise. */
const PSF_KLASSEN = { 0: 'Befestigungen', 1: 'Leimen', 2: 'Verputzen', 3: 'Applikationslinie (erst 3.7)' };
const VERSIONSLAGE_AUSDRUCK = `(() => {
  const STAND = ${JSON.stringify(WUP_KEYWORD_STAND)};
  const KLASSEN = ${JSON.stringify(PSF_KLASSEN)};
  const ANLAGE_STAND = ${JSON.stringify(ANLAGE_KEYWORD_STAND)};
  const zaehl = {};
  for (const roh of (modell.rawLines || [])) {
    const z = String(roh).trim();
    if (!z) continue;
    const kw = (z.split(/[\\s;,]+/)[0] || '').toUpperCase();
    if (!kw || kw === 'TXT') continue;
    zaehl[kw] = (zaehl[kw] || 0) + 1;
  }
  const zahl = v => { const m = /^(\\d+)\\.(\\d+)/.exec(String(v)); return m ? parseInt(m[1], 10) * 100 + parseInt(m[2], 10) : NaN; };
  const dateiVersion = String(modell.header.VERSION || '').replace(',', '.').trim();
  const abgekuendigt = [], neuerAlsAnlage = [], gruende37 = [], hinweise = [];
  for (const kw of Object.keys(zaehl).sort()) {
    const s = STAND[kw];
    if (!s) continue;
    if (s.abgekuendigt || s.entfernt) {
      const e = { keyword: kw, zeilen: zaehl[kw], abgekuendigtSeit: s.abgekuendigt || null, entferntIn: s.entfernt || null };
      if (s.ersatz) e.ersatz = s.ersatz;
      if (s.wiederSeit) e.wiederSeit = s.wiederSeit;
      if (s.hinweis) e.hinweis = s.hinweis;
      abgekuendigt.push(e);
      if (s.entfernt) gruende37.push(kw + ' (' + zaehl[kw] + ' Zeile(n)) ist in 3.7 entfernt' + (s.ersatz ? ' — Ersatz: ' + s.ersatz : '') + '.');
    }
    if (s.seit && ANLAGE_STAND != null && zahl(s.seit) > ANLAGE_STAND) {
      const e = { keyword: kw, zeilen: zaehl[kw], seit: s.seit };
      if (s.hinweis) e.hinweis = s.hinweis;
      neuerAlsAnlage.push(e);
    }
  }
  const ela = String(modell.header.ELA || '').toUpperCase();
  if (zaehl.ELA && /^(AUSSEN|EXTERIOR|EXTERNAL|OUTSIDE)/.test(ela))
    gruende37.push('ELA ' + ela + ': 3.7 wertet ELA nicht mehr aus und liest jedes Element als Innenansicht.');
  /* Plattenumriss: Steuercode der Punkte (4. Parameter). Bis 3.6 ohne Bedeutung
     (Granit schreibt dort den Materialindex), in 3.7 Nut/Feder ab 100. */
  const umriss = {};
  for (const l of (modell.layers || [])) for (const p of (l.plates || [])) {
    if (!(p._lineStart >= 0) || !(p._lineEnd >= p._lineStart)) continue;
    for (let z = p._lineStart + 1; z <= p._lineEnd; z++) {
      const t = String(modell.rawLines[z] || '').trim();
      if (!/^PP\\b/i.test(t)) continue;
      const i = parseInt(t.replace(/;.*$/, '').replace(/^PP\\s*/i, '').split(',')[3], 10);
      if (i >= 100) umriss[i] = (umriss[i] || 0) + 1;
    }
  }
  const umrissCodes = Object.keys(umriss).map(Number).sort((a, b) => a - b);
  if (umrissCodes.length)
    gruende37.push('Plattenumriss-Punkte mit Steuercode ab 100 (' + umrissCodes.map(c => c + ': ' + umriss[c] + 'x').join(', ')
      + '): 3.7 liest 1xx als Feder und 2xx als Nut mit Tiefe in mm — bis 3.6 steht hier oft der Materialindex.');
  /* Sperrflaechen: Klasse je Steuercode; TA ist nur in PAF zulaessig */
  const psfCodes = {}; let taInSperre = 0;
  for (const l of (modell.layers || [])) for (const op of (l.ops || [])) {
    if (op.kw !== 'PSF' && op.kw !== 'PSZ') continue;
    const poly = op.poly || [];
    if (poly.some(q => q.type === 'TA')) taInSperre++;
    if (op.kw === 'PSF')
      for (const c of [...new Set(poly.map(q => q.i).filter(i => i != null && !isNaN(i) && i !== 0))]) psfCodes[c] = (psfCodes[c] || 0) + 1;
  }
  for (const c of Object.keys(psfCodes).map(Number).sort((a, b) => a - b))
    hinweise.push(psfCodes[c] + ' Sperrflaeche(n) PSF mit Steuercode ' + c + ' (' + (KLASSEN[c] || 'nicht definiert') + '): laut Weinmann '
      + '(V3.5 S.42, 3.7 S.41) sperrt nur Code 0 das Nageln/Klammern. Der Editor wertet den Code nicht aus und zaehlt '
      + 'diese Flaeche(n) trotzdem als Deckung (Auto-PSF, P-03) — von Hand pruefen.');
  if (taInSperre) hinweise.push(taInSperre + ' Sperrflaeche(n)/Schutzzone(n) mit TA: laut Weinmann ist TA nur in PAF zulaessig; '
    + 'PSF und PSZ erlauben nur PP-PP oder MP (V3.5 S.31 und S.35, 3.7 S.27 und S.31).');
  /* Unbekannte Bearbeitung mit eigenen Punkten (z.B. PAL ab 3.6): der Editor-
     Parser haengt die Punktzeilen an die VORHERIGE Bearbeitung — deren
     Geometrie stimmt dann im Modell nicht mehr (Fund 2026-11-13). */
  const fremd = {};
  const leer = z => /^\\s*$/.test(z) || /^\\s*TXT\\b/i.test(z);
  for (const w of (modell.warnings || [])) {
    if (w.code !== 'UNBEKANNT') continue;
    let n = w.zeile + 1;
    while (n < modell.rawLines.length && leer(String(modell.rawLines[n]))) n++;
    if (!/^\\s*(PP|KB|MP|TA)\\b/i.test(String(modell.rawLines[n] || ''))) continue;
    const kw = (String(modell.rawLines[w.zeile] || '').trim().split(/[\\s;,]+/)[0] || '').toUpperCase();
    for (const l of (modell.layers || [])) for (const op of (l.ops || []))
      if (op._lineStart >= 0 && op._lineStart < w.zeile && op._lineEnd >= n) fremd[kw + ' -> ' + op.kw] = (fremd[kw + ' -> ' + op.kw] || 0) + 1;
  }
  for (const k of Object.keys(fremd).sort()) {
    const [neu, alt] = k.split(' -> ');
    hinweise.push('Punkte nach dem unbekannten Keyword ' + neu + ' rechnet der Editor der vorherigen Bearbeitung ' + alt + ' zu (' + fremd[k]
      + 'x): Geometrie, Pruefregeln und Automatiken dieser Bearbeitung sind fuer diese Datei NICHT verlaesslich. '
      + 'Der Export einer unveraenderten Datei bleibt identisch.');
  }
  return {
    dateiVersion: dateiVersion || null,
    anlage: ${baustein('versionslageAnlage') ? JSON.stringify(baustein('versionslageAnlage')) : 'undefined'},
    abgekuendigt, neuerAlsAnlage,
    version37: { konform: gruende37.length === 0, gruende: gruende37,
      umfang: 'Geprueft: in 3.7 entfernte Keywords, ELA, Steuercode der Plattenumriss-Punkte. Keine vollstaendige Konformitaetspruefung.' },
    spezifikationsHinweise: hinweise,
    quelle: 'Aenderungshistorie Weinmann Interface version 3.7 Kap. 3 und V3.5 Kap. 2.3 (wup_referenz thema=aenderungshistorie). '
      + 'Hinweise, keine Editor-Pruefregeln.'
  };
})()`;

function uebersichtErzeugen(ctx) {
  const u = ausKontext(ctx, `({
    dateiName: modell.dateiName,
    encoding: modell.encoding,
    hatteBom: !!modell.hatteBom,
    zeilenEnde: modell.zeilenEnde || null,
    plausibilitaet: ${PLAUSIBILITAET_AUSDRUCK},
    versionslage: ${VERSIONSLAGE_AUSDRUCK},
    header: ${KOPF_MASKIERT_AUSDRUCK},
    subWaende: (modell.subWalls || []).map(w => ({ nr: w.num, eln: w.eln, znr: w.znr, elb: w.elb })),
    statistik: (() => {
      let platten = 0, ops = 0, befestigungen = 0, saegeFraes = 0;
      for (const l of modell.layers) {
        platten += l.plates.length;
        for (const op of l.ops) {
          ops++;
          if (op.kw === 'NR') befestigungen += nagelPunkte(op).length;
          if (opIstZerspanend(op)) saegeFraes++;
        }
      }
      return { lagen: modell.layers.length, platten, bauteile: (modell.beams || []).length,
               bearbeitungen: ops, saegeFraes, befestigungenCa: befestigungen };
    })(),
    bauteile: (() => {
      const nachKw = {};
      for (const b of (modell.beams || [])) nachKw[b.kw] = (nachKw[b.kw] || 0) + 1;
      return { anzahl: (modell.beams || []).length, nachKw,
               bearbeitungen: (modell.beams || []).reduce((n, b) => n + ((b.bearbeitungen || []).length), 0) };
    })(),
    lagen: (modell.layers || []).map(l => {
      const opsNachKw = {};
      for (const op of l.ops) opsNachKw[op.kw] = (opsNachKw[op.kw] || 0) + 1;
      const nrGruppen = {};
      for (const op of l.ops) if (op.kw === 'NR' && op.nr) {
        const k = op.nr.a + '/' + op.nr.i;
        if (!nrGruppen[k]) nrGruppen[k] = { abstand_a: op.nr.a, index_i: op.nr.i, anzahl: 0,
          geraet: (profil.nr_indizes[op.nr.i] || {}).name || 'UNBEKANNT — Offset konservativ ' + profil.default_offset_unbekannt + ' mm' };
        nrGruppen[k].anzahl++;
      }
      return { id: l.id, seite: l.side, nummer: l.num, z: l.z, hz: l.hz, hzGemischt: !!l.hzGemischt,
               platten: l.plates.length, opsNachKw, nrGruppen: Object.values(nrGruppen) };
    }),
    materialien: (() => {
      const m = {};
      for (const l of (modell.layers || [])) for (const p of l.plates)
        if (p.materialIdx != null && !isNaN(p.materialIdx))
          m[p.materialIdx + '|' + p.name] = { idx: p.materialIdx, name: p.name, klasse: materialKlasse(p.materialIdx) };
      return Object.values(m);
    })(),
    parserWarnungen: modell.warnings || [],
    zeilen: (modell.rawLines || []).length
  })`);
  u.geraeteHinweis = 'Geraete-Klartext aus ' + profilHinweis() + (baustein('geraeteHinweis') || '.');
  u.meldungen = meldungen(ctx);
  u.kontext = kontextInfo();
  return u;
}

function pruefungenErzeugen(ctx, filter) {
  vm.runInContext('pruefungenAusfuehren()', ctx, { timeout: VM_ZEITLIMIT_MS });
  const f = filter || {};
  ctx.__filterLevel = f.level ? JSON.stringify(f.level) : null;
  ctx.__filterCodes = f.codes ? JSON.stringify(f.codes) : null;
  ctx.__maxEintraege = f.maxEintraege || 500;
  const r = ausKontext(ctx, `(() => {
    const alle = modell.pruefungen || [];
    const anzahl = { fehler: 0, warnung: 0, hinweis: 0 };
    const nachCode = {};
    for (const p of alle) { anzahl[p.level] = (anzahl[p.level] || 0) + 1; nachCode[p.code] = (nachCode[p.code] || 0) + 1; }
    const zeileVon = {};
    for (const l of modell.layers) for (const op of l.ops) zeileVon[op.id] = (op._lineStart >= 0) ? op._lineStart + 1 : null;
    const level = __filterLevel ? JSON.parse(__filterLevel) : null;
    const codes = __filterCodes ? JSON.parse(__filterCodes) : null;
    const P = alle.filter(p => (!level || level.includes(p.level)) && (!codes || codes.includes(p.code)));
    return { anzahl, nachCode, gesamt: alle.length, gefiltert: P.length !== alle.length ? P.length : undefined,
             weggelassen: Math.max(0, P.length - __maxEintraege) || undefined,
             eintraege: P.slice(0, __maxEintraege).map(p => ({ level: p.level, code: p.code, meldung: p.msg, lage: p.lageId || null,
               zeile: (p.ref && p.ref.id != null && zeileVon[p.ref.id] != null) ? zeileVon[p.ref.id] : null })) };
  })()`);
  if (!r.gesamt) r.hinweis = 'Keine Befunde — das heisst "keine der Pruefregeln hat angeschlagen", nicht "maschinentauglich geprueft".';
  return r;
}

/* Export-Bytes aus dem Kontext (Base64) */
function exportBytes(ctx) {
  const e = ausKontext(ctx, `(() => {
    const r = exportBytesErzeugen();
    return { name: r.name, datenverlust: r.datenverlust, ueberlaengen: r.ueberlaengen, b64: __b64(r.bytes), encoding: modell.encoding };
  })()`);
  return { name: e.name, datenverlust: e.datenverlust, ueberlaengen: e.ueberlaengen, encoding: e.encoding, bytes: Buffer.from(e.b64, 'base64') };
}

/* Roundtrip: Zeilen (die etablierte Garantie des Regressionstests) UND Bytes
   (Encoding, BOM, Zeilenende). Byte-Vergleich nur bei Dateien — bei 'text'
   gibt es keine Originalbytes. Schluss-CRLF wird auf beiden Seiten toleriert. */
function roundtripPruefen(ctx) {
  const z = ausKontext(ctx, `(() => {
    kwZeileUeberlaenge = [];
    const { zeilen } = exportZeilenErzeugen();
    const orig = [...modell.rawLines];
    while (orig.length && orig[orig.length - 1] === '') orig.pop();
    const exp = [...zeilen];
    while (exp.length && exp[exp.length - 1] === '') exp.pop();
    if (orig.length !== exp.length)
      return { identisch: false, grund: 'Zeilenzahl ' + orig.length + ' -> ' + exp.length, zeilen: orig.length };
    for (let i = 0; i < orig.length; i++)
      if (orig[i] !== exp[i])
        return { identisch: false, grund: 'Erste Abweichung Zeile ' + (i + 1), zeile: i + 1, original: orig[i], export: exp[i], zeilen: orig.length };
    return { identisch: true, zeilen: orig.length };
  })()`);
  if (z.original != null) { z.original = zeileMaskieren(z.original); z.export = zeileMaskieren(z.export); }
  const ergebnis = { zeilenIdentisch: z.identisch, identisch: z.identisch, zeilen: z.zeilen };
  if (!z.identisch) Object.assign(ergebnis, { grund: z.grund, zeile: z.zeile, original: z.original, export: z.export });
  if (ctx.__quellPfad) {
    const exp = exportBytes(ctx);
    const crlfKuerzen = (b) => { let n = b.length; while (n >= 2 && b[n - 2] === 0x0D && b[n - 1] === 0x0A) n -= 2; return b.subarray(0, n); };
    const orig = fs.readFileSync(ctx.__quellPfad);
    const o = crlfKuerzen(orig), e = crlfKuerzen(exp.bytes);
    let pos = -1;
    const n = Math.min(o.length, e.length);
    for (let i = 0; i < n; i++) if (o[i] !== e[i]) { pos = i; break; }
    if (pos < 0 && o.length !== e.length) pos = n;
    ergebnis.byteIdentisch = pos < 0;
    ergebnis.bytesOriginal = orig.length;
    ergebnis.bytesExport = exp.bytes.length;
    ergebnis.encoding = exp.encoding;
    if (pos >= 0) {
      ergebnis.ersteAbweichungByte = pos;
      const hinweise = [];
      if (orig.includes(0x0A) && !orig.includes(0x0D)) hinweise.push('Original hat LF-Zeilenenden, der Export schreibt CRLF (Weinmann-Pflicht).');
      if (exp.encoding === 'utf-8' && orig.some(b => b > 0x7F)) hinweise.push('UTF-8-Original mit Nicht-ASCII-Zeichen — der Editor schreibt Zeichen > 127 byteweise (Latin-1); bitte Editor-Befund pruefen.');
      ergebnis.byteHinweis = hinweise.length ? hinweise.join(' ') : 'Bytes weichen ab, Zeilen ' + (z.identisch ? 'nicht' : 'ebenfalls') + ' — Encoding/BOM/Zeilenende pruefen.';
    }
  } else {
    ergebnis.byteIdentisch = null;
    ergebnis.byteHinweis = "Byte-Vergleich nur bei 'pfad' moeglich (bei 'text' gibt es keine Originalbytes).";
  }
  return ergebnis;
}

/* Zielpfad fuer Exporte pruefen — Schutzregeln (Spec §7A sinngemaess:
   lieber klar ablehnen als still etwas Falsches ueberschreiben). */
function zielPfadPruefen(zielPfad, quellPfad, ueberschreiben) {
  if (typeof zielPfad !== 'string' || !zielPfad.trim()) throw new Error("'ziel_pfad' muss ein nicht-leerer String sein.");
  if (!/\.wup$/i.test(zielPfad)) throw new Error("'ziel_pfad' muss auf .wup enden (erhalten: " + zielPfad + ').');
  const voll = path.resolve(path.isAbsolute(zielPfad) ? zielPfad : path.join(REPO_ROOT, zielPfad));
  /* realpath des naechsten existierenden Elternordners (Symlinks aufloesen) */
  let eltern = path.dirname(voll);
  while (!fs.existsSync(eltern) && path.dirname(eltern) !== eltern) eltern = path.dirname(eltern);
  const real = path.join(fs.realpathSync(eltern), path.relative(eltern, voll));
  const repoReal = fs.realpathSync(REPO_ROOT);
  const norm = (p) => p.toLowerCase().split(path.sep).join('/');
  for (const sperre of SCHREIBSPERRE) {
    const s = norm(path.join(repoReal, sperre));
    if (norm(real) === s || norm(real).startsWith(s + '/'))
      throw new Error("Schreiben nach '" + sperre + "' ist gesperrt (Referenzdateien, Werkzeug-Quellen, Doku). Bitte einen Arbeitsordner waehlen.");
  }
  if (quellPfad && norm(real) === norm(fs.realpathSync(quellPfad)))
    throw new Error('ziel_pfad darf nicht die Quelldatei sein — bitte einen neuen Dateinamen angeben.');
  if (fs.existsSync(real) && !ueberschreiben)
    throw new Error('Zieldatei existiert bereits: ' + real + " — zum Ersetzen 'ueberschreiben: true' setzen.");
  return real;
}

/* Export-Bytes erzeugen und — nur mit ziel_pfad — schreiben.
   Wie der Editor vor dem Export: offene FEHLER-Befunde (und Datenverlust)
   sperren das Schreiben, bis der Aufrufer 'trotz_fehler: true' setzt. */
function exportUndSchreiben(ctx, opt) {
  const exp = exportBytes(ctx);
  const ergebnis = { export: { dateiname: exp.name, encoding: exp.encoding,
    datenverlust: exp.datenverlust, ueberlaengen: exp.ueberlaengen, bytes: exp.bytes.length } };
  if (exp.datenverlust)
    ergebnis.export.hinweis = exp.datenverlust + ' Zeichen ausserhalb des Zeichensatzes auf ein Byte gekuerzt (gezaehlt, nicht still).';
  if (exp.ueberlaengen)
    ergebnis.export.hinweisUeberlaenge = exp.ueberlaengen + ' Maschinencode-Zeile(n) ueber der Weinmann-Laengengrenze — nicht gekuerzt, bitte pruefen.';
  if (!opt.zielPfad) {
    ergebnis.geschrieben = null;
    ergebnis.hinweis = "Probelauf: nichts geschrieben. Zum Speichern 'ziel_pfad' angeben.";
    return ergebnis;
  }
  const ziel = zielPfadPruefen(opt.zielPfad, ctx.__quellPfad, opt.ueberschreiben === true);
  const sperren = [];
  if (opt.fehlerAnzahl > 0) sperren.push(opt.fehlerAnzahl + ' FEHLER-Befund(e) offen');
  if (exp.datenverlust > 0) sperren.push(exp.datenverlust + ' Zeichen Datenverlust');
  if (sperren.length && opt.trotzFehler !== true) {
    ergebnis.geschrieben = null;
    ergebnis.nichtGeschrieben = sperren.join(', ') + " — nichts geschrieben. Wie im Editor ('Trotzdem exportieren?'): "
      + "zum Schreiben 'trotz_fehler: true' setzen.";
    return ergebnis;
  }
  if (sperren.length) ergebnis.trotzFehlerGeschrieben = sperren.join(', ');
  fs.mkdirSync(path.dirname(ziel), { recursive: true });
  const tmp = ziel + '.tmp-' + process.pid;
  fs.writeFileSync(tmp, exp.bytes);
  fs.renameSync(tmp, ziel);
  ergebnis.geschrieben = ziel;
  return ergebnis;
}

/* Automatiken: ORIGINAL-Funktionen des Editors; bestaetigen() ist headless
   ein Ja (siehe editorKontextFrisch). Gezaehlt wird vorher/nachher, damit
   die Rueckgabe nicht von Meldungstexten abhaengt. */
const AUTOMATIK_SKRIPTE = {
  auto_schnitt: `(() => {
    const codes = () => modell.layers.flatMap(l => l.ops.filter(opIstZerspanend).map(op => (op.poly || []).map(e => e.i | 0)));
    const vorher = codes();
    f1AlleAusfuehren();
    const nachher = codes();
    let eckpunkte = 0, konturen = 0;
    for (let k = 0; k < Math.min(vorher.length, nachher.length); k++) {
      let d = 0;
      for (let i = 0; i < Math.min(vorher[k].length, nachher[k].length); i++) if (vorher[k][i] !== nachher[k][i]) d++;
      if (d) { eckpunkte += d; konturen++; }
    }
    return { geaenderteEckpunkte: eckpunkte, konturen };
  })()`,
  freistiche: `(() => {
    const zaehl = () => modell.layers.reduce((n, l) => n + l.ops.filter(o => o.auto === 'freistich').length, 0);
    const vorher = zaehl();
    f2SammelAktion();
    return { neueFreistiche: zaehl() - vorher };
  })()`,
  auto_psf: `(() => {
    const vorher = modell.layers.reduce((n, l) => n + l.ops.filter(o => o.kw === 'PSF').length, 0);
    f3AutoPsf();
    const nachher = modell.layers.reduce((n, l) => n + l.ops.filter(o => o.kw === 'PSF').length, 0);
    return { neueSperrflaechen: nachher - vorher, sperrflaechenGesamt: nachher };
  })()`,
  auto_kontur: `(() => {
    const zaehl = () => modell.layers.reduce((n, l) => n + l.ops.filter(o => o.kw === 'PAF' || o.kw === 'PSG' || o.kw === 'PSF').length, 0);
    const vorher = zaehl();
    autoKonturVerbinden();
    const nachher = zaehl();
    return { konturenVorher: vorher, konturenNachher: nachher, zusammengefasst: vorher - nachher };
  })()`,
  neigungen_nullen: `(() => ({ genullteNeigungen: neigungenNullen() }))()`,
  nr_index_25_pla: `(() => ({ umgestellteNagelreihen: nrIndex25PlaKorrigieren() }))()`,
};

function automatikAusfuehren(ctx, args) {
  const ergebnis = { aktionen: {} };
  for (const aktion of args.aktionen) {
    if (!AUTOMATIK_SKRIPTE[aktion])
      throw new Error("Unbekannte Aktion '" + aktion + "'. Erlaubt: " + Object.keys(AUTOMATIK_SKRIPTE).join(', '));
    ergebnis.aktionen[aktion] = ausKontext(ctx, AUTOMATIK_SKRIPTE[aktion]);
  }
  ergebnis.pruefungenNachAutomatik = pruefungenErzeugen(ctx);
  ergebnis.meldungen = meldungen(ctx);
  Object.assign(ergebnis, exportUndSchreiben(ctx, { zielPfad: args.ziel_pfad, ueberschreiben: args.ueberschreiben,
    trotzFehler: args.trotz_fehler, fehlerAnzahl: ergebnis.pruefungenNachAutomatik.anzahl.fehler }));
  ergebnis.kontext = kontextInfo();
  return ergebnis;
}

/* Strg+H headless: Felder live aus WE_FELDER des Editors; bereich immer
   'alle' (im Editor heisst der Standard 'sichtbar' = UI-Zustand, den es
   headless nicht gibt). Vorschau IMMER vor dem Anwenden — die Hunks zeigen
   exakt die Zeilen, die der Export schreiben wuerde. */
function werteErsetzenAusfuehren(ctx, args) {
  const felder = ausKontext(ctx, 'WE_FELDER');
  const gueltig = felder.map(f => f.v);
  if (!args.feld || !gueltig.includes(args.feld))
    throw new Error("Parameter 'feld' fehlt oder ist unbekannt. Erlaubt: "
      + felder.map(f => f.v + ' (' + f.t + ')').join(', '));
  const textFeld = args.feld === 'name';
  if (args.suchwert == null) throw new Error("Parameter 'suchwert' fehlt.");
  if (!textFeld && typeof args.suchwert !== 'number')
    throw new Error("Parameter 'suchwert' muss fuer das Feld '" + args.feld + "' eine Zahl sein.");
  const anwenden = args.anwenden === true;
  if (anwenden && args.ersatzwert == null) throw new Error("Zum Anwenden fehlt 'ersatzwert'.");
  if (!textFeld && args.ersatzwert != null && typeof args.ersatzwert !== 'number')
    throw new Error("Parameter 'ersatzwert' muss fuer das Feld '" + args.feld + "' eine Zahl sein.");
  if (args.lagen != null && (!Array.isArray(args.lagen) || !args.lagen.every(l => typeof l === 'string')))
    throw new Error("'lagen' muss eine Liste von Lagen-Ids sein (z.B. [\"PLI1\"]).");
  if (args.typen != null && (!Array.isArray(args.typen) || !args.typen.every(t => typeof t === 'string')))
    throw new Error("'typen' muss eine Liste von Keywords sein (z.B. [\"NR\"]).");
  const opt = {
    feld: args.feld, suchwert: args.suchwert, ersatzwert: args.ersatzwert,
    toleranz: typeof args.toleranz === 'number' ? args.toleranz : 0.01,
    bereich: 'alle', lagenFilter: args.lagen || null, typFilter: args.typen || null,
    textModus: args.text_modus === 'enthaelt' ? 'enthaelt' : 'exakt',
  };
  ctx.__opt = JSON.stringify(opt);
  ctx.__maxHunks = ganzzahl(args.max_hunks == null ? 40 : args.max_hunks, 'max_hunks', 1, 500);
  const vorschau = ausKontext(ctx, `(() => {
    const opt = JSON.parse(__opt);
    const lagenIds = modell.layers.map(l => l.id);
    const unbekannteLagen = (opt.lagenFilter || []).filter(id => !lagenIds.includes(id));
    const v = werteErsetzenVorschauHunks(opt, __maxHunks);
    return { treffer: v.treffer, objekte: v.objekte, hunks: v.hunks, weitereObjekte: v.mehr, unbekannteLagen, lagenIds };
  })()`);
  for (const h of vorschau.hunks) { h.alt = h.alt.map(zeileMaskieren); h.neu = h.neu.map(zeileMaskieren); }
  const lagenIds = vorschau.lagenIds; delete vorschau.lagenIds;
  const ergebnis = { feld: args.feld, suchwert: args.suchwert, ersatzwert: args.ersatzwert == null ? null : args.ersatzwert,
    toleranz: opt.toleranz, vorschau, angewendet: false };
  if (vorschau.unbekannteLagen.length)
    ergebnis.hinweis = 'Unbekannte Lagen im Filter: ' + vorschau.unbekannteLagen.join(', ') + ' (vorhanden: ' + lagenIds.join(', ') + ').';
  if (!anwenden) {
    ergebnis.hinweisAnwenden = "Nur Vorschau. Zum Aendern 'anwenden: true' (und zum Speichern 'ziel_pfad') setzen.";
    ergebnis.kontext = kontextInfo();
    return ergebnis;
  }
  const r = ausKontext(ctx, `(() => { const r = werteErsetzen(Object.assign(JSON.parse(__opt), { nurVorschau: false })); return { treffer: r.treffer, objekte: r.ops.length }; })()`);
  ergebnis.angewendet = r.treffer > 0;
  ergebnis.geaendert = r;
  ergebnis.meldungen = meldungen(ctx);
  if (!r.treffer) { ergebnis.hinweis = 'Keine Treffer — nichts geaendert, nichts geschrieben.'; ergebnis.kontext = kontextInfo(); return ergebnis; }
  ergebnis.pruefungenNachAenderung = pruefungenErzeugen(ctx);
  Object.assign(ergebnis, exportUndSchreiben(ctx, { zielPfad: args.ziel_pfad, ueberschreiben: args.ueberschreiben,
    trotzFehler: args.trotz_fehler, fehlerAnzahl: ergebnis.pruefungenNachAenderung.anzahl.fehler }));
  ergebnis.kontext = kontextInfo();
  return ergebnis;
}

/* Stapel: alle WUP-Dateien eines Ordners mit frischem Kontext je Datei */
function wupDateienFinden(ordner, rekursiv, endungRe) {
  const out = [];
  for (const e of fs.readdirSync(ordner, { withFileTypes: true })) {
    const p = path.join(ordner, e.name);
    if (e.isDirectory()) { if (rekursiv) out.push(...wupDateienFinden(p, rekursiv, endungRe)); }
    else if (endungRe.test(e.name)) out.push(p);
  }
  return out.sort();
}
function ordnerPruefen(args) {
  const ordnerRel = args.ordner || VORGABE_ORDNER_REL;
  const ordner = pfadAufloesen(ordnerRel, true);
  const rekursiv = args.rekursiv !== false;
  const roundtrip = args.roundtrip !== false;
  const maxDateien = ganzzahl(args.max_dateien == null ? 200 : args.max_dateien, 'max_dateien', 1, 2000);
  const befunde = args.befunde === 'alle' ? 'alle' : (args.befunde === 'fehler' ? 'fehler' : 'keine');
  const alle = wupDateienFinden(ordner, rekursiv, /\.wup$/i);
  const dateien = alle.slice(0, maxDateien);
  const eintraege = [];
  const gesamt = { fehler: 0, warnung: 0, hinweis: 0, roundtripAbweichend: 0, byteAbweichend: 0, nichtPlausibel: 0, ausnahmen: 0, meldungen: 0 };
  const nachCode = {};
  for (const d of dateien) {
    const rel = path.relative(REPO_ROOT, d);
    try {
      const ctx = editorKontextFrisch();
      wupPufferLaden(ctx, fs.readFileSync(d), path.basename(d));
      ctx.__quellPfad = d;
      vm.runInContext('pruefungenAusfuehren()', ctx, { timeout: VM_ZEITLIMIT_MS });
      const k = ausKontext(ctx, `(() => {
        const E = modell.header.ELM || {};
        const P = modell.pruefungen || [];
        const z = { fehler: 0, warnung: 0, hinweis: 0 }; const codes = {};
        for (const p of P) { z[p.level] = (z[p.level] || 0) + 1; codes[p.code] = (codes[p.code] || 0) + 1; }
        let nr = 0, platten = 0;
        for (const l of modell.layers) { platten += l.plates.length; nr += l.ops.filter(o => o.kw === 'NR').length; }
        return { eln: modell.header.ELN || '', elb: modell.header.ELB || '', version: modell.header.VERSION || '',
                 encoding: modell.encoding, elm: [E.lx, E.by, E.hz].join('x'), subWaende: (modell.subWalls || []).length,
                 lagen: modell.layers.length, platten, nr, bauteile: modell.beams.length,
                 zaehler: z, codes, plausibilitaet: ${PLAUSIBILITAET_AUSDRUCK},
                 befunde: P.map(p => ({ level: p.level, code: p.code, meldung: p.msg, lage: p.lageId || null })) };
      })()`);
      const e = { datei: rel, eln: k.eln, elb: k.elb, version: k.version, encoding: k.encoding, elm: k.elm, subWaende: k.subWaende,
        lagen: k.lagen, platten: k.platten, nr: k.nr, bauteile: k.bauteile,
        fehler: k.zaehler.fehler, warnung: k.zaehler.warnung, hinweis: k.zaehler.hinweis,
        codes: Object.keys(k.codes).sort() };
      for (const lvl of ['fehler', 'warnung', 'hinweis']) gesamt[lvl] += k.zaehler[lvl];
      for (const [c, n] of Object.entries(k.codes)) nachCode[c] = (nachCode[c] || 0) + n;
      if (!k.plausibilitaet.istWup) { e.plausibilitaet = k.plausibilitaet; gesamt.nichtPlausibel++; }
      if (roundtrip) {
        const rt = roundtripPruefen(ctx);
        e.roundtrip = rt.zeilenIdentisch ? 'identisch' : rt.grund;
        if (!rt.zeilenIdentisch) gesamt.roundtripAbweichend++;
        if (rt.byteIdentisch === false) { e.bytes = 'abweichend ab Byte ' + rt.ersteAbweichungByte + (rt.byteHinweis ? ' — ' + rt.byteHinweis : ''); gesamt.byteAbweichend++; }
      }
      const m = meldungen(ctx);
      if (m.length) { e.meldungen = m; gesamt.meldungen += m.length; }
      if (befunde === 'alle') e.befunde = k.befunde;
      else if (befunde === 'fehler') e.befunde = k.befunde.filter(b => b.level === 'fehler');
      eintraege.push(e);
    } catch (err) {
      gesamt.ausnahmen++;
      eintraege.push({ datei: rel, ausnahme: err.message });
    }
  }
  const ergebnis = { ordner: path.relative(REPO_ROOT, ordner) || '.', rekursiv, gefunden: alle.length,
    geprueft: dateien.length, gesamt, nachCode, eintraege, kontext: kontextInfo() };
  if (alle.length > dateien.length)
    ergebnis.hinweis = (alle.length - dateien.length) + " Datei(en) nicht geprueft — 'max_dateien' erhoehen.";
  return ergebnis;
}

/* Steuercode: dekodieren mit Plausibilitaet je Stelle (Spec §3 / Weinmann 5.1) */
const STELLEN_BEREICH = { werkzeug: [1, 4], schnitt: [1, 2], korrektur: [1, 3], lauf: [0, 1] };
function steuercodePruefen(teile, code) {
  const hinweise = [];
  for (const [stelle, [min, max]] of Object.entries(STELLEN_BEREICH))
    if (teile[stelle] < min || teile[stelle] > max)
      hinweise.push(stelle + '=' + teile[stelle] + ' liegt ausserhalb ' + min + '..' + max
        + (stelle === 'werkzeug' || stelle === 'schnitt' ? ' (Weinmann: gesperrt/undefiniert)' : ''));
  if (code != null && code >= 10000) hinweise.push('Code hat mehr als vier Stellen.');
  if (code != null && code < 100 && hinweise.length)
    hinweise.push('Werte < 100 sind bei Umriss-/PSF-Punkten oft ein Material-Index (30/60/20), kein Steuercode.');
  return { plausibel: hinweise.length === 0, hinweise };
}
function steuercodeAusfuehren(args) {
  const ctx = editorKontextFrisch({ ohneProfil: true });   /* Steuercodes haengen nicht am Profil */
  const kw = args.kw === 'PSG' ? 'PSG' : 'PAF';
  ctx.__kw = kw;
  if (args.code != null) {
    const code = ganzzahl(args.code, 'code', 0, null);
    ctx.__code = code;
    const r = ausKontext(ctx, `(() => { const t = steuercodeZerlegen(__code); return { code: __code, teile: t, klartext: steuercodeWorte(__code, __kw) }; })()`);
    return Object.assign(r, { kontext: kw }, steuercodePruefen(r.teile, code));
  }
  if (args.teile && typeof args.teile === 'object') {
    const t = Object.assign({ werkzeug: 1, schnitt: 1, korrektur: 3, lauf: 0 }, args.teile);
    for (const stelle of Object.keys(STELLEN_BEREICH)) t[stelle] = ganzzahl(t[stelle], 'teile.' + stelle, 0, 9);
    const pr = steuercodePruefen(t, null);
    if (!pr.plausibel) throw new Error('Unplausible Stellen: ' + pr.hinweise.join('; ') + '. Erlaubt: '
      + Object.entries(STELLEN_BEREICH).map(([k, [a, b]]) => k + ' ' + a + '..' + b).join(', '));
    ctx.__teile = JSON.stringify(t);
    const r = ausKontext(ctx, `(() => { const t = JSON.parse(__teile); const code = steuercodeBauen(t); return { code, teile: t, klartext: steuercodeWorte(code, __kw) }; })()`);
    return Object.assign(r, { kontext: kw }, pr);
  }
  throw new Error("Entweder 'code' (Ganzzahl) oder 'teile' (Objekt mit werkzeug/schnitt/korrektur/lauf) angeben.");
}

/* WupWorks5: nur den curl-Befehl bauen — Adresse/Port validiert */
function wupworksBefehl(args) {
  if (!args.adresse || typeof args.adresse !== 'string')
    throw new Error("Parameter 'adresse' fehlt (Maschinen-IP/Hostname).");
  const adresse = args.adresse.trim();
  if (!/^(\[[0-9A-Fa-f:.]+\]|[A-Za-z0-9](?:[A-Za-z0-9.-]*[A-Za-z0-9])?)$/.test(adresse))
    throw new Error("'adresse' muss ein Hostname oder eine IP sein (Buchstaben, Ziffern, Punkt, Bindestrich; IPv6 in eckigen Klammern) — erhalten: " + JSON.stringify(args.adresse));
  const port = args.port == null ? 45070 : ganzzahl(args.port, 'port', 1, 65535);
  const datei = args.pfad ? pfadAufloesen(args.pfad) : 'export.wup';
  const url = 'http://' + adresse + ':' + port + '/api/1/documents';
  return {
    url,
    curl: 'curl -X POST ' + url + ' -F file=@' + JSON.stringify(datei),
    hinweis: 'Der Befehl wird NICHT ausgefuehrt — bitte im Maschinennetz manuell absetzen (Windows: curl.exe, nicht der '
      + 'PowerShell-Alias).' + baustein('wupworksBefehl'),
  };
}

/* =====================================================================
   Statische Referenz (kondensiert aus Wup/Doku/wup-editor-spec-v2.md;
   bei Widerspruch gilt die dortige Quellen-Hierarchie). Alles, was der
   Editor selbst weiss (Regeln, Profil), wird live angehaengt.

   v1.8: Hier steht nur ALLGEMEINES Formatwissen. Was an der Anlage, an den
   eigenen Referenzdateien oder an internen Unterlagen haengt, kommt als
   Textbaustein aus der Konfiguration — baustein('<thema>_<name>') — und
   wird woertlich an der bezeichneten Stelle eingesetzt (leer, wenn die
   Konfiguration ihn nicht fuehrt). Neue anlagenspezifische Saetze gehoeren
   in die Konfiguration, nicht hierher.
   ===================================================================== */

const REFERENZ = {
  /* Quellen-Hierarchie: ganz aus der Konfiguration (sie haengt an den
     vorhandenen Unterlagen), dahinter der Anlagen-Hinweis */
  quellen: baustein('quellen') + (ANLAGEN_HINWEIS ? (baustein('quellen') ? '\n\n' : '') + ANLAGEN_HINWEIS : ''),
  keywords:
    'WUP-Keyword-Referenz (Weinmann V3.5, kondensiert aus Spec §2):\n'
    + 'Kopf:    VERSION (Pflicht, 1. Zeile) · ANR/ELB/ELN/ZNR/REIHE/STAPEL · ELA (INNEN|AUSSEN) ·\n'
    + '         ELM lx, by, hz [, n [, xoffset [, yoffset]]] · CAD/CADRELEASE/WNP (durchreichen)\n'
    + 'Bauteile: OG|UG|LS lx,by,hz,x,y,i,name[,z] · QS ly,bx,hz,x,y,i,name[,z] (ly = Laenge in Y!) ·\n'
    + '         BT4/BT6 (Trapez, explizite Punktpaare) · BTn (+PP/KB) · EBT · RT..ENDRT ·\n'
    + '         MODUL..ENDMODUL (Koordinaten relativ -> Offset-Stack)\n'
    + 'Bauteilbearb.: SG (Saegeschnitt/Halbebene) · PAF/PSG/PZF/SZ/KN/MPL/PML ·\n'
    + '         abgekuendigt aber real in Gebrauch: BOZ/BOY/BOX/FRZ/FRY (parsen, Export 1:1)\n'
    + 'Lagen:   PLI0..PLI10 (innen) / PLA0..PLA10 (aussen): lx,by,hz,x,y,i,name[,z] ·\n'
    + '         Lage 0 = im Riegelwerk (Gefachdaemmung, nur m3) · innen waechst +Z, aussen -Z ·\n'
    + '         Umriss: PP-Punkte nach Plattenheader haben Vorrang, sonst Rechteck aus Header\n'
    + 'Lagenbearb.: PAF (Ausfraesung) · PSG (SAEGEpolygon) · PSF (SPERRflaeche: nicht nageln/klammern,\n'
    + '         geschlossen, PPs nur x,y) · PSZ (Schutzzone) · NR xa,ya,xe,ye,a,i (Nagelreihe;\n'
    + '         Einzelnagel Start==Ende ist LEGITIM) · NBR (Nagelbild, nur nach NR)\n'
    + 'Polygon: PP x,y,t,i,alpha[,z] · KB (Kreisbogen) · MP xm,ym,r,t,i[,zm] (Vollkreis) · TA (Tasche, nur PAF)\n'
    + 'Koordinaten: PP/NR/MP ABSOLUT im Elementkoordinatensystem (nicht plattenrelativ);\n'
    + 'mm, Ursprung unten links, Y nach oben. Tiefe t: |t| = Schnitttiefe, Vorzeichen im Export erhalten.\n'
    + 'ELM-Skizze (Weinmann S.15): lx/by sind MAXIMALWERTE der Ordinaten, nicht Laengen — mit xoffset/yoffset\n'
    + 'ist die Breite lx-xoffset. Referenzebenen 1-6 (S.8): 1 hinten, 2 oben, 3 vorn (Betrachter), 4 unten,\n'
    + '5 linke Stirn (x=0), 6 rechte Stirn (x=lx). Zeichnungen: wup_spezifikation abbildungen:true.\n'
    + 'Multiwand: Marker "Beginn Kommentare Element n" MIT und OHNE Sternchen; Granit traegt die\n'
    + 'Original-Koepfe der Sub-Waende als TXT-Block (ELM/ELN/ZNR/ELB). Granit-Nummer steht in ELN.\n'
    + 'Encoding real: ASCII/Windows-1252, CRLF, meist ohne BOM; Umlaute als "?" kaputt -> NIE "reparieren".\n'
    + 'Es gibt KEIN Erstellungsdatum und KEIN Geschoss im Format (nur heuristisch aus Namen).',
  steuercodes:
    'Steuercode-Stellensystem (PP/KB/MP-Feld i bei PAF & PSG, Spec §3 / Weinmann Kap. 5.1):\n'
    + 'Einer   (1-4): Werkzeug — PAF: 1 zyl. Fraeser, 2 Fraeser m. Fase, 3 Nutfraeser, 4 Markierfraeser;\n'
    + '               PSG: 1 Standard-Saegeblatt, 2 fein gezahnt, 3 Kettensaege\n'
    + 'Zehner  (1|2): Schnittende — 1 = UEBERSCHNEIDEND, 2 = UNTERSCHNEIDEND\n'
    + 'Hundert (1-3): Radiuskorrektur — 1 = links (Werkstueck RECHTS der Linie),\n'
    + '               2 = rechts (Werkstueck LINKS), 3 = keine (kein Gutteil/Abfall unterscheidbar)\n'
    + 'Tausend (0|1): 0 = Gegenlauf, 1 = Gleichlauf — laut V3.5 S.38 nur bei PAF (bei PSG "frei"), 2000-9000\n'
    + '               gesperrt. Die Tabelle der 3.7 (S.36, v37-T45) sperrt 1000-9000 ganz, der Text 6.1.4 (S.39)\n'
    + '               beschreibt Gleich-/Gegenlauf weiter — Widerspruch in der 3.7; fuer die Anlage gilt V3.5.\n'
    + baustein('steuercodes_tausender')
    + 'Referenzpunkt ist der ENDPUNKT einer Teilstrecke: Code an PP[n] regelt die Strecke\n'
    + 'PP[n-1]->PP[n] und den Schnitt AN diesem Punkt. Innenecken-Muster real: 211 -> 221 -> 211.\n'
    + 'ACHTUNG: Bei Plattenumriss/PSF-Punkten kann im i-Feld ein Material-Index stehen\n'
    + '(30/60/20 beobachtet) — dort NICHT als Steuercode interpretieren.\n'
    + 'Zeichnungen (Weinmann S.39/S.40, als Bild: wup_spezifikation seite=39|40 bild=true):\n'
    + 'Ueberschnitt xx1x = Werkzeugmitte faehrt bis AUF den Endpunkt (Schnitt um r ueber das Ende hinaus);\n'
    + 'Unterschnitt xx2x = Werkzeugumfang beruehrt den Endpunkt nur (an Innenecken bleibt Material -> Freistich).\n'
    + 'Korrektur 100 = Werkzeug LINKS der Linie in Bearbeitungsrichtung (Abfall links, Werkstueck rechts);\n'
    + '200 = Werkzeug RECHTS (Abfall rechts, Werkstueck links); 300 = Mitte, Abfall/Gutteil nicht unterscheidbar.\n'
    + 'Neigungswinkel alpha (S.45): positiv = im Uhrzeigersinn in Richtung der Bearbeitungslinie, Bezug Tangente.\n'
    + 'MP-Radius (S.46): r>0 im Uhrzeigersinn, r<0 dagegen — bei Blick ENTGEGEN der Z-Achse.\n'
    + 'Dekodieren/bauen mit Plausibilitaetspruefung: Tool wup_steuercode. Originaltabelle: wup_spezifikation "Steuercode".\n'
    + 'Weitere Steuercode-Tabellen (V3.5 Kap. 5.2-5.4 = S.41-42; 3.7 Kap. 6.2-6.5 = S.39-41; wup_steuercode kennt nur PAF/PSG):\n'
    + 'Tasche TA (i): 0 = Ueber-/Unterschnitt nach Maschinenregel, 1 = Ueberschnitt, 2 = Unterschnitt (alle vier Ecken).\n'
    + 'Markieren MPL/PML: Einer 1 Tintenstrahl, 2 Kugelschreiber, 3 Reissnadel; Zehner 10 = auf der Gegenebene,\n'
    + '  20 = auf der Definitionsebene/-lage; Hunderter 100 schwarz, 200 blau, 300 gruen. Beispiel 122. Die\n'
    + '  Tausenderstelle ist bei Markierlinien seit 3.4 entfernt.\n'
    + 'Sperrflaeche PSF (i der Punkte): 0 = Befestigungen, 1 = Leimen, 2 = Verputzen, 3 = Applikationslinie (3 erst\n'
    + '  in 3.7). NUR Code 0 sperrt das Nageln/Klammern. ' + baustein('steuercodes_psfReal')
    + 'der Editor wertet den Code vorhandener Sperrflaechen nicht aus (thema offen).\n'
    + 'Applikationslinie PAL (ab 3.6' + baustein('steuercodes_palAnlage') + '): 1 = Dichtband 60 mm, 2 = Dichtband 50 mm,\n'
    + '  3 = Leimen (3.7); Hunderter = Radiuskorrektur wie bei PAF; Tiefe t der Punkte muss 0 sein.\n'
    + 'Plattenumriss (nur 3.7): 100 = Feder, 200 = Nut, + Tiefe in mm — thema version37.\n'
    + baustein('steuercodes_realVerwendet')
    + 'Die Tabellen im Wortlaut: wup_spezifikation tabelle="v37-T44" (PAF/PSG), "v37-T45" (Korrektur), "v37-T48" (TA),\n'
    + '  "v37-T49" (Markieren), "v37-T50" (PAL), "v37-T51" (PSF), "v37-T43" (Nut/Feder) — 3.7 englisch.',
  wupworks:
    'WupWorks5-Anbindung (Weinmann-Maschinensoftware' + baustein('wupworks_quelle') + '):\n'
    + 'WUP-Dateien werden per HTTP angenommen: POST http://<adresse>:45070/api/1/documents,\n'
    + "multipart/form-data, Feld 'file'." + baustein('wupworks_stand') + ' Dieser MCP-Server sendet selbst NICHTS.',
  sicherheit:
    'Sicherheitsgrundsaetze' + baustein('sicherheit_quelle') + ':\n'
    + '- Der Roundtrip ist heilig: unveraenderte Dateien muessen byte-identisch wieder\n'
    + '  herauskommen' + baustein('sicherheit_referenzdateien') + '. Tool: wup_roundtrip_pruefen / wup_ordner_pruefen.\n'
    + '- Auto-PSF (F3) verhindert, dass Saege/Fraese in Klammern/Naegel fahren. Luecken\n'
    + '  zwischen Saegelinien werden nur ueberbrueckt, wenn Segmente exakt kollinear sind\n'
    + '  und die Luecke unter dem Grenzwert (Standard 150 mm) liegt — NIE lockern.\n'
    + '- PAF/PSG-Konturen NIE umkehren: Richtungsumkehr invertiert die Radiuskorrektur-\n'
    + '  Seite (links<->rechts) -> Gutteil wuerde zerspant. (F5-Sortierung wurde deshalb\n'
    + '  entfernt — Anwenderwunsch: volle Kontrolle statt Greedy.)\n'
    + '- Befunde aendern den Export nie; der Editor fragt bei FEHLER-Befunden vor dem Export\n'
    + "  nach — dieser Server verlangt dafuer 'trotz_fehler: true'.\n"
    + '- Verlustbehaftete Transformationen zaehlen und melden, nie still (Spec §7A).\n'
    + '- Dieser Server schreibt nur .wup-Ziele ausserhalb von Referenz-/Werkzeugordnern und\n'
    + '  nie in die Quelldatei.',
  versionen:
    'WUP-Versionslage (Wup/Doku/wup-versionen-und-quellen.md, Stand 2026-11-13) — gegen die Primaerquellen geprueft:\n'
    + baustein('versionen_anlage')
    + baustein('versionen_spezifikationen')
    + baustein('versionen_referenzdateien')
    + '- Nach 3.4 dazugekommen: 3.5 ENDRT, STAPEL · 3.6 PAL (Applikationslinie), Materialindex 260-269 · 3.7 Kopf\n'
    + '  ELEMENTID, CADDOKUMENTID, BEARBEITER, BAUVORHABEN, KUNDENNAME, OBJEKT, ORT; je Bauteil MODELLREF,\n'
    + '  CADMODELLREF, TEILENR; REFKER wieder aufgenommen; Nut/Feder-Steuercode am Plattenumriss; PAL-Code Leimen.\n'
    + '- 3.7 STREICHT: BOZ, BOY, BOX, FRZ, FRY, PFZ, PFY, KER, RBE, NC, WNP, REIHE, SLI, SLA; ELA wird nicht mehr\n'
    + '  ausgewertet (immer Innenansicht).' + baustein('versionen_exporteHeute')
    + ' Ersatz laut V3.5 S.28: PAF + MP fuer Bohrungen, PAF + PP fuer FRZ/FRY, 2x SG fuer KER.\n'
    + '- Falle beim Umstieg: Granit schreibt in die Umrisspunkte der Platten den Materialindex (30/60/20). 3.7 liest\n'
    + '  dieses Feld als Nut/Feder-Code (100 = Feder, 200 = Nut, Zehner + Einer = Tiefe in mm) — ein Materialindex\n'
    + '  ab 100 wuerde als Feder oder Nut verstanden.\n'
    + '- Exporteure: SEMA schreibt 3.5; Granit 3.4/3.5; cadwork-API export_weinmann_mfb mit Enum wup_2_0,\n'
    + '  wup_3_1..wup_3_4 (cwapi3d 33.333.2).\n'
    + 'Regeln: (1) ' + baustein('versionen_regel1') + ' (2) Personen-Kopffelder (BEARBEITER, KUNDENNAME, BAUVORHABEN, OBJEKT, ORT, KUNDENAME, ANSCHRIFT)\n'
    + 'leer lassen; dieser Server maskiert sie. (3) Unbekannte Keywords bleiben erhalten (Roundtrip). (4) Je Datei:\n'
    + 'wup_datei_analysieren liefert den Block versionslage (abgekuendigte/entfernte Keywords, 3.7-Konformitaet,\n'
    + 'Hinweise aus der Spezifikation). Historie je Version: thema aenderungshistorie; 3.7 im Einzelnen: thema version37.',
  aenderungshistorie:
    'WUP-Aenderungshistorie (Weinmann Interface version 3.7 Kap. 3 = S.9-12, gegengelesen mit V3.5 deutsch S.11-14):\n'
    + '1.x  VERSION eingefuehrt; BT4/BT6 ersetzen QSS; SG ersetzt SGO/SGU; PLI1-9/PLA1-9 ersetzen SPI/SPA/RPI;\n'
    + '     Sperrzone SZ; Markierlinie MPL; MODUL/ENDMODUL; Einbauteile EBT.\n'
    + '2.1  PFZ/PFY (Polygonfraesung an Bauteilen) · 2.2 Schalungen SLI/SLA · 2.3 nicht dokumentiert.\n'
    + '3.0  REIHE; ABE/ABB, NBA, PNR entfallen; Bauteilbearbeitungen im Bauteil-, Plattenbearbeitungen im Element-\n'
    + '     koordinatensystem; NBR nur bei Holzbauteilen; Standardkerve REFKER; Materialindex + Name bei Platten und\n'
    + '     Bauteilen; Umriss-Polygon nach der Plattendefinition; "PP, PP" bei Sperrflaechen nicht mehr zulaessig.\n'
    + '3.1  NC-Programmaufruf; SG fuer Bauteile; Schutzzone PSZ; Tiefe/Index bei MP; Markierlinie PML; Neigungswinkel\n'
    + '     fuer Saege-/Fraeslinien; Gleitkommazahlen fuer Winkel und Radien.\n'
    + '3.2  Kreisbogen KB; Z-Koordinate der Polygonpunkte; WNP im Kopf; KN mit y, z, i und auch fuer Lagen.\n'
    + '3.3  Z-Ordinate bei OG/UG/LS/QS/EBT/BT4/BT6/PLI/PLA/MODUL; Bauteilname Pflicht; Neigungswinkel bei SG; PAF und\n'
    + '     PSG auch fuer Balken; Zapfen PZF; Ebenen 5/6 (BT6: 7/8); UNIT/ENDUNIT; PLZ entfaellt; PFY/PFZ veraltet;\n'
    + '     RBE; Tiefe 0 = ganze Lagen-/Bauteildicke; Lagen 0 und 10; WNP nur noch "links unten".\n'
    + '3.4  UTF-16 (BMP); CAD, CADRELEASE; WNP abgekuendigt; RT, BTn; RBE2/ENDRBE2; TA; PROPERTY; PSF auch an\n'
    + '     Bauteilen; Werkzeugnummer T bei PAF; ABGEKUENDIGT: BOX, BOY, BOZ, FRZ, FRY, PFY, PFZ, KER, RBE (V3.5\n'
    + '     deutsch nennt hier auch REFKER); Z-Ausrichtung in der Einbaulage abgekuendigt; KN an Platten ohne\n'
    + '     Bezugsebene; Zerspanen bei PAF per Parameter; frueher optionale Parameter Pflicht; Tausenderstelle im\n'
    + '     Steuercode der Markierlinien entfernt.\n'
    + '3.5  ENDRT, STAPEL; SLA abgekuendigt (3.7-Text: SLA und SLI).\n'
    + '3.6  PAL (Polygon-Applikationslinie).\n'
    + '3.7  NEU: Kopf ELEMENTID, CADDOKUMENTID, BEARBEITER, BAUVORHABEN, KUNDENNAME, OBJEKT, ORT; MODELLREF,\n'
    + '     CADMODELLREF, TEILENR; REFKER und PAL als Bauteilbearbeitung; Steuercode Leimen (PAL); Nut/Feder am\n'
    + '     Plattenumriss. ENTFERNT: WNP, REIHE, SLI, SLA, KER, BOZ, BOY, BOX, FRZ, FRY, PFZ, PFY, NC, RBE.\n'
    + '     ABGEKUENDIGT: ELA (Elemente werden immer als Innenansicht gelesen). GEAENDERT: Lagenhoehe = dickste\n'
    + '     Platte der Lage (gilt rueckwirkend); Klarstellungen zu VERSION, ANR, ELB, ELN, ZNR, CAD.\n'
    + 'Grundsatz (3.7 S.9): Neue Parameter stehen immer am Zeilenende und ersetzen nie vorhandene; fehlende\n'
    + 'Parameter werden mit dem Standardwert in geschweiften Klammern ergaenzt; bei Widerspruch gilt der rechte.\n'
    + 'Innerhalb einer Hauptversion (3.0-3.9) bleiben die Schluesselwoerter konstant (3.7 S.5) — 3.7 streicht\n'
    + 'trotzdem abgekuendigte. Je Datei auswerten: wup_datei_analysieren -> versionslage.',
  version37:
    'WUP 3.7 im Einzelnen (Weinmann Interface version 3.7, Stand 06/08/2026, englisch; Seiten = wup_spezifikation\n'
    + 'quelle=schnittstellenbeschreibung_3_7).' + baustein('version37_geltung') + '\n'
    + 'Kopf (S.13): VERSION, ELEMENTID (GUID, eindeutig fuer Element UND Dokument), CADDOKUMENTID (im Beispiel S.45\n'
    + '  "CADDOCUMENTID" geschrieben — Widerspruch in der Spezifikation selbst), ANR, ELB (nur a-z, A-Z, 0-9, _),\n'
    + '  ELN, ZNR, ELM, CAD, CADRELEASE, BEARBEITER, BAUVORHABEN, KUNDENNAME, OBJEKT, ORT. Optionale Kopfzeilen\n'
    + '  brauchen einen nicht-leeren Wert. STAPEL steht nicht mehr in der Kopftabelle.\n'
    + 'Identifikation (S.17): direkt nach Bauteil/Platte/RT/MODUL optional MODELLREF (UUID, noetig fuer die\n'
    + '  Materialbestellung an vorgelagerten Maschinen), CADMODELLREF (Text), TEILENR (Ganzzahl, z.B. fuer Druck).\n'
    + 'Platten (S.18-20): z bei PLI positiv, bei PLA negativ (steht NUR in der Markdown-Fassung, nicht in der PDF —\n'
    + '  die beiden 3.7-Fassungen weichen hier ab); Umriss-Polygon geschlossen, hat Vorrang vor lx/by, alle\n'
    + '  Punkte in EINER Ebene; KEINE sich schneidenden oder deckungsgleichen Linien — ein Ausschnitt darf nicht\n'
    + '  ueber eine hin und zurueck laufende Kante an den Aussenumriss gehaengt werden; die dickste Platte bestimmt\n'
    + '  die Lagenhoehe (rueckwirkend), bei gemischten Dicken z ausdruecklich angeben; Platten bis 1 mm zaehlen\n'
    + '  nicht fuer den Versatz.\n'
    + 'Nut/Feder (S.34-35): Steuercode im i-Feld der Umriss-PP: 100 = Feder, 200 = Nut, + Tiefe in mm (Zehner +\n'
    + '  Einer). 121 = Feder 21 mm, 236 = Nut 36 mm. Die Feder VERGROESSERT die Platte ueber den Umriss hinaus.\n'
    + 'Bauteilbearbeitungen (S.24-26): SG, KN, MPL, PML, PAF, PSG, PZF, SZ, REFKER x, txt [, e], PAL e [, T]. PSG darf\n'
    + '  ein Bauteil nicht laengs teilen. REFKER ist keine Bearbeitung und muss an JEDEM geschnittenen Bauteil stehen.\n'
    + 'Plattenbearbeitungen (S.26-27): PAF, PSG, NR, NBR, PSF, PSZ, PML, PAL, KN. Nagelpunkt: xa = xe und ya = ye,\n'
    + '  empfohlen a = 1 (a wird dann ignoriert). Widersprechen sich Abstand und Start/Ende einer Reihe, gilt der\n'
    + '  Abstand a. PSF/PSZ: geschlossen, nur PP-PP oder MP. TA nur in PAF (S.31).\n'
    + 'PROPERTY (S.28-29): direkt nach dem Bauteil/der Bearbeitung, mehrfach erlaubt; Daemmplatte mit Einblas-\n'
    + '  volumen: PROPERTY Volume, <m3>. Reservierte Namen (Liste unvollstaendig): Count, ProducedCount,\n'
    + '  SingleMemberNumber, StackSize, Group, Package, Storey, StoreyType, Designation, Annotation, AssemblyNumber,\n'
    + '  OrderNumber, Volume, UserAttribute:Process, UserAttribute:ELB.\n'
    + 'Materialindex Platten (S.33-34): wie V3.5, dazu 260-269 Gefachdaemmung Glasfaser (seit 3.6). Die Liste ist\n'
    + '  eine EMPFEHLUNG und wird mit dem Maschinenhersteller abgestimmt — fuer die Anlage gilt das Datenblatt.\n'
    + 'Beispiele (S.45-48): Kopf, Bauteile mit MODELLREF, Platten mit Nut/Feder, Lattung mit Nagelpunkten + NBR.\n'
    + 'Steuercodes fuer PAL und Sperrflaechen-Klasse 3: thema steuercodes.\n'
    + 'Bilder und Tabellen (Wup/Doku/weinmann-tabellen-und-bilder.md): 32 der 36 Bilder sind inhaltsgleich mit\n'
    + '  Zeichnungen der V3.5; NEU sind nur die Lagenhoehe (einzelbild "image", S.20) und Nut/Feder (einzelbild\n'
    + '  "tongue_groove_index_5_4_1", S.35). Die Parameterfolgen aller gemeinsamen Keywords sind in V3.5 und 3.7\n'
    + '  gleich; anders nur VERSION (Ganzzahl.Ganzzahl[.Ganzzahl]), ANR/ZNR (Zeichenkette), REFKER (+ optional e).\n'
    + 'Unstimmigkeiten der veroeffentlichten 3.7 ("preliminary" — nicht als Abnahmegrundlage lesen): Tabelle 6.1\n'
    + '  Zeile 3 ohne Spaltentrenner; 1000-9000 gesperrt (Tabelle S.36) gegen Gleich-/Gegenlauf (Text S.39);\n'
    + '  CADDOKUMENTID gegen CADDOCUMENTID; Kap. 2.3.2 (S.6) nennt PFZ trotz Streichung; Ueberschrift "bocked"\n'
    + '  (PDF Kap. 6.5); Strukturgrafik zeigt Stand 3.6; Markdown weicht von der PDF ab (z-Vorzeichen nur im\n'
    + '  Markdown, griechische Winkelzeichen fehlen dort); STAPEL fehlt in der Kopftabelle ohne Streichvermerk;\n'
    + '  im Bildordner zwei leere SVG und drei ".png" mit JPEG-Inhalt.',
  sitebroker:
    'Weinmann SiteBroker (github.com/HomagGroup/WEINMANN-wupWorks, Documentation/sitebroker — sechs Dokumente\n'
    + 'liegen als Ressourcen bei). "Preliminary" und laut Weinmann NUR FUER AUSGEWAEHLTE MASCHINEN — ob die Anlage\n'
    + 'hier dazugehoert, ist NICHT geklaert; bei Weinmann erfragen:\n'
    + '- Zweck: einheitliche Schnittstelle zwischen Maschinen/wupWorks und einem Leitsystem (MES, productionManager);\n'
    + '  soll die bisherige MES-Schnittstelle ersetzen (Altanlagen ueber UDP-/REST-Adapter).\n'
    + '- Aufbau: MQTT v5 (Port 1883, unverschluesselt, QoS 2, retained) NUR fuer Befehle und Status. Die Daten\n'
    + '  (Dokumente, Auftragsstruktur) holt die Maschine per REST aus der "Central Database" (GET /order/{orderId}).\n'
    + '  Einzelmaschine: Broker + Datenbank auf der Maschine; Verbund: zentraler Server.\n'
    + '- Ablauf: Auftrag laden (order/<orderId>/load -> loaded: Preparing, Imported, Aborted) · Batch vorbereiten\n'
    + '  (batch/<batchId>/prepare -> prepared: Incomplete, Preparing, Ready, Aborted) · Variante fertigen\n'
    + '  (batch-variant/<id>/produce -> produced: Inactive, Active, Done, Aborted) · Online-Modus der Maschine.\n'
    + '  Topic-Muster {Sender}/{Empfaenger}/{Ressource}/{ID}/{Aktion}; IDs sind GUIDs. Variante im PSLV-Format\n'
    + '  (Place/Side/Layer/Variant, z.B. 1-I-1-1).\n'
    + '- Telemetrie: Maschinenzustand, Stueck-/Zyklen-/Meterzaehler, Programm, Fehler/Warnungen/Wartung, Lager-\n'
    + '  fuellstand und Material, Werkzeugzaehler; je laufender Variante Fortschritt in %, Start, Ende.\n'
    + '- Bezug zu WUP 3.7: ELEMENTID ist die GUID von Element UND Dokument; "Order" ist im SiteBroker das Dokument\n'
    + '  mit seiner GUID. Die Verbindung liegt nahe, steht aber in keinem der Dokumente ausdruecklich.\n'
    + (baustein('sitebroker_bezug') ? baustein('sitebroker_bezug') + ' ' : '- ') + 'Dieser Server spricht kein MQTT und sendet nichts.\n'
    + '- NUR IN DEN DREI DIAGRAMMEN zu lesen (wup_spezifikation einzelbild="sitebroker_architektur" |\n'
    + '  "sitebroker_einsatzformen" | "sitebroker_altanlagen"), in keinem der sechs Texte:\n'
    + '  · wupWorks 5 haengt DIREKT am SiteBroker; wupWorks 3/4 ueber "mesClient", einen UDP-Server und einen\n'
    + '    "Site-Broker Client (wupx2wup)". Ein altes Leitsystem (Legacy MES) kommt ueber einen UDP-Client.\n'
    + '  · granIT steht als System der Fabrik neben dem Orchestrator (Einsatzform "Connected local environment").\n'
    + baustein('sitebroker_granit')
    + '  · Vier Einsatzformen: Software Only, Standalone machine, Connected local environment, Connected cloud\n'
    + '    environment (HI Cloud). "wupx2wup" deutet auf ein Format wupx neben WUP; nicht beschrieben.\n'
    + baustein('sitebroker_unsereAnlage')
    + '- Wertelisten (Tabellen: wup_spezifikation quelle="sitebroker" tabellen=true; einzeln tabelle="sbi-T04"):\n'
    + '  OrderStatus 0 Requested, 1 Preparing, 2 Imported, 3 Aborted · BatchStatus 0 Requested, 1 Incomplete,\n'
    + '  2 Preparing, 3 Ready, 4 Aborted · RunStatus 0 Requested, 1 Inactive, 2 Active, 3 Done, 4 Aborted ·\n'
    + '  OnlineMode 1 Offline, 2 Online · MachineState 1 Off, 2 Idle, 3 Working, 4 Error, 5 Test · ToolType\n'
    + '  1 Milling, 2 Drilling, 3 Marking, 4 Fastening, 5 Sawing, 6 Glueing, 7 Other · CounterType 1 Shoots\n'
    + '  (Befestigen), 2 Distance in m (Fraesen, Markieren, Saegen, Leimen), 3 Hits (Bohren).\n'
    + '  Betriebsregeln (sbm-T01): gespeicherte Befehle sofort loeschen, Online-Modus ist Voraussetzung, eindeutige\n'
    + '  Maschinennummer, im Fehlerfall immer Aborted melden.',
  offen:
    'OFFENE Fachfragen — nicht raten, beim Anwender klaeren' + baustein('offen_quelle') + ':\n'
    + '- F-01 PSF-Offset-Geometrie: vom Schnitt aus gemessen oder Zone um die Klammerposition? (sicherheitsrelevant)\n'
    + '- F-03 PSF auch unter Bohrungen (BOZ/MP) ab welchem Durchmesser? (Vorschlag > 10 mm)\n'
    + baustein('offen_f05f06')
    + baustein('offen_geraete')
    + baustein('offen_fraestiefe')
    + baustein('offen_freistich')
    + baustein('offen_nrIndex25')
    + '- P-08 meldet eine PSF/PSZ als TA-Rechteck faelschlich als offen (bekannt, nicht behoben).\n'
    + baustein('offen_anlage')
    + baustein('offen_umstieg37')
    + '- Funde aus der Spezifikation fuer Editor/Creator (NICHT umgesetzt — Anwender entscheidet):\n'
    + '  (a) PSF-Steuercode: nur 0 sperrt Befestigungen (1 Leimen, 2 Verputzen; V3.5 S.42). Auto-PSF und P-03 werten\n'
    + '      den Code vorhandener Sperrflaechen nicht aus — eine PSF mit 1 oder 2 gaelte dem Editor als Deckung.\n'
    + '      ' + baustein('offen_fundA') + 'Vorschlag: eigene Pruefregel. wup_datei_analysieren meldet den Fall.\n'
    + '  (b) TA ist nur in PAF zulaessig, PSF/PSZ nur als PP-PP oder MP (V3.5 S.31/S.35) — der bekannte P-08-Fall\n'
    + '      "PSF als TA-Rechteck" ist laut Spezifikation keine erlaubte Form.\n'
    + '  (c) Materialklasse 260-269 (Gefachdaemmung Glasfaser, seit 3.6) fehlt in MATERIAL_KLASSEN des Editors.\n'
    + '  (d) Markierlinien: Tausenderstelle im Steuercode seit 3.4 entfernt (Beispiel 122).' + baustein('offen_fundD') + '\n'
    + baustein('offen_fundE')
    + '  (f) 3.7: Lagenhoehe = dickste Platte der Lage (rueckwirkend); Plattenumriss ohne sich schneidende oder\n'
    + '      deckungsgleiche Linien; bei NR gilt im Widerspruch der Abstand a.\n'
    + '  (g) Unbekannte Bearbeitung mit eigenen Punkten (PAL ab 3.6): Der Editor-Parser haengt die Punktzeilen an die\n'
    + '      VORHERIGE Bearbeitung — im Versuch wurde eine geschlossene PSF so zur "offenen" (P-08). Kennungen nach\n'
    + '      einer Platte (MODELLREF, TEILENR) stoeren dagegen nicht.' + baustein('offen_fundG') + ' wup_datei_analysieren meldet den Fall.\n'
    + '  (h) Der Editor-Parser kennt PML an BAUTEILEN und KN an PLATTEN nicht (beide in V3.5 gueltig: S.26 bzw. S.31).\n'
    + '      Die Zeilen bleiben erhalten (Roundtrip), werden aber nicht geprueft und nicht gezeichnet; nach PML am\n'
    + '      Bauteil melden die Punkte "PP ohne Kontext".' + baustein('offen_fundH') + '\n'
    + '  (i) Tausenderstelle bei PAF/PSG: V3.5 erlaubt 1000 = Gleichlauf (PAF), die Tabelle der 3.7 sperrt 1000-9000\n'
    + '      (thema steuercodes).' + baustein('offen_fundI') + '\n'
    + '  (j) BTn: Die Spezifikation schreibt das Keyword woertlich so ("Bauteil mit N Eckpunkten" + Polygonpunkte).\n'
    + '      Ob ein Exporteur BTn oder BT5/BT8 schreibt, ist ungeklaert; der Editor liest BT4, BT6 und woertlich BTn.'
    + baustein('offen_fundJ') + '\n'
    + '  (k) SiteBroker-Diagramme: wupWorks 5 direkt angebunden, granIT als System der Fabrik (thema sitebroker).\n'
    + '  Auswertung der Tabellen und Bilder: Wup/Doku/weinmann-tabellen-und-bilder.md.\n'
    + '- cadwork: Die Oberflaeche nennt laut Recherche WUP bis 3.6, die API nur bis 3.4.\n'
    + '- SiteBroker: Ist die Anbindung fuer die Anlage verfuegbar? (thema sitebroker).',
};

function pruefregelnText() {
  const p = pruefregelnAusEditor();
  const zeilen = p.regeln.map(r => r.code + ' ' + (r.namen.join(' / ') || '(Name im Code nicht als Literal)')
    + ' [' + r.levels.join('/') + ']');
  return 'Pruefregeln ' + pruefregelnSpanne() + ' — LIVE aus wup_editor.html v' + editorVersion()
    + ' (Levels fehler/warnung/hinweis):\n' + zeilen.join('\n')
    + "\n\nLive-Auswertung fuer eine konkrete Datei: Tool 'wup_pruefen'; fuer einen Ordner: 'wup_ordner_pruefen'."
    + '\nP-03 PSF_FEHLT ist die Klammerkollisions-Pruefung (sicherheitskritisch). P-19..P-23 behandelt der'
    + ' Editor als "gravierend" (Befunde-Popup); Korrekturen per wup_automatik: neigungen_nullen (P-21),'
    + ' nr_index_25_pla (P-22). P-19 (Materialindex 0) wird bewusst NICHT automatisch gesetzt — Vorschlag'
    + ' nur im Editor-Popup; P-23 bewusst ohne Korrektur (fehlende Punkte sind ein CAD-Problem).';
}

function referenzErzeugen(thema) {
  if (thema === 'pruefregeln') return pruefregelnText();
  if (thema === 'maschinenprofil') {
    /* PROFIL_STANDARD ist eine Konstante des Editors — dafuer genuegt der Kern
       ohne Profildatei (eine defekte Profildatei sperrt die Referenz nicht). */
    const ctx = editorKontextFrisch({ ohneProfil: true });
    let text = (ANLAGEN_HINWEIS ? ANLAGEN_HINWEIS + '\n\n' : '')
      + 'Maschinenprofil-Standard (PROFIL_STANDARD aus wup_editor.html v' + editorVersion() + ', live):\n'
      + JSON.stringify(ausKontext(ctx, 'PROFIL_STANDARD'), null, 2)
      + '\n\nMaterial-Klassen (Weinmann 4.3):\n'
      + JSON.stringify(ausKontext(ctx, 'MATERIAL_KLASSEN'), null, 1);
    /* v1.8: Profildatei und fehlende Geraetebelegung benennen (ohne beides bleibt der Text wie bisher) */
    const ps = profilStand();
    if (ps.fehler) text += '\n\nACHTUNG: ' + ps.fehler;
    else if (ps.datei) text += '\n\nProfildatei ' + ps.datei + ' ist eingemischt — WIRKSAMES Profil dieses Servers:\n'
      + JSON.stringify(ausKontext(editorKontextFrisch(), 'profil'), null, 2);
    if (ps.geraete === 0) text += '\n\n' + GERAETE_FEHLEN_HINWEIS;
    return text;
  }
  const themen = Object.keys(REFERENZ).concat(['pruefregeln', 'maschinenprofil', 'alle']);
  if (thema && thema !== 'alle') {
    if (!REFERENZ[thema]) throw new Error("Unbekanntes Thema '" + thema + "'. Erlaubt: " + themen.join(', '));
    return REFERENZ[thema];
  }
  return Object.entries(REFERENZ).map(([k, v]) => '## ' + k + '\n\n' + v).join('\n\n')
    + '\n\n## pruefregeln\n\n' + pruefregelnText()
    + '\n\n## maschinenprofil\n\n' + referenzErzeugen('maschinenprofil');
}

/* =====================================================================
   Weinmann-Original-PDFs (Primaerquelle) durchsuchen
   ===================================================================== */

/* Quelle laden — bevorzugt die einmalig erzeugte Seiten-JSON (pdf.js-Text,
   echte Seitennummern, Seitenbilder); Rueckfall ist der Byte-Extraktor
   (Inhaltsstrom-Nummern, kein Bild). Index seiten[n-1] = Seite n; nicht
   erzeugte Seiten (Datenblatt 1-2) sind null. */
const _pdfCache = {};
function pdfQuelleLaden(schluessel) {
  if (_pdfCache[schluessel]) return _pdfCache[schluessel];
  const q = PDF_QUELLEN[schluessel];
  const datei = q.dateien.map(d => path.join(PDF_ORDNER, d)).find(p => fs.existsSync(p));
  const jsonPfad = path.join(SEITEN_ORDNER, schluessel + '.seiten.json');
  const jsonDa = fs.existsSync(jsonPfad);
  /* Die Seiten-JSON genuegt (v1.4): ein Dokument kann auch nur als
     bereinigte Seiten abgelegt sein. Ohne PDF UND ohne JSON gibt es nichts zu lesen. */
  if (!datei && !jsonDa) throw new Error('PDF fuer "' + schluessel + '" nicht gefunden unter ' + PDF_ORDNER);
  let ergebnis;
  if (jsonDa) {
    const meta = JSON.parse(fs.readFileSync(jsonPfad, 'utf8'));
    const seiten = new Array(meta.seitenGesamt).fill(null);
    const bilder = new Array(meta.seitenGesamt).fill(null);
    const gedruckt = new Array(meta.seitenGesamt).fill(null);
    for (const s of meta.seiten) {
      seiten[s.seite - 1] = s.text;
      const bildPfad = path.join(REPO_ROOT, s.bild);
      bilder[s.seite - 1] = fs.existsSync(bildPfad) ? s.bild : null;
      gedruckt[s.seite - 1] = s.gedruckteSeite;
    }
    ergebnis = { datei: path.relative(REPO_ROOT, datei || jsonPfad), pdfVorhanden: !!datei, titel: q.titel, seitenVon: Math.max(q.seitenVon, meta.von),
      seiten, bilder, gedruckt, seitenGesamt: meta.seitenGesamt, nichtLesbar: 0, textQuelle: 'pdf.js-Textebene (' + meta.werkzeug + ', ' + meta.erzeugt + ')'
        + (datei ? '' : ' — Original-PDF nicht abgelegt, Text und Bilder aus der Seiten-JSON'),
      seitenbilder: bilder.filter(Boolean).length };
  } else {
    const r = pdfText.pdfTextLesen(datei);
    if (!r.seiten.length) throw new Error('Keine Textebene in ' + path.basename(datei) + ' lesbar.');
    ergebnis = { datei: path.relative(REPO_ROOT, datei), titel: q.titel, seitenVon: q.seitenVon,
      seiten: r.seiten, bilder: r.seiten.map(() => null), gedruckt: r.seiten.map(t => gedruckteSeite(t)),
      seitenGesamt: r.seiten.length, nichtLesbar: r.nichtLesbar,
      textQuelle: 'Byte-Extraktor (Rueckfall: Seiten-JSON fehlt — Seitenzahl = Inhaltsstrom-Nummer, keine Bilder)', seitenbilder: 0 };
  }
  return (_pdfCache[schluessel] = ergebnis);
}

/* Abbildungskatalog (Wup/Doku/weinmann-abbildungen.md) parsen:
   "## Quelle: <schluessel>" und "### S.<n> — <Titel>" mit "- Zeigt:/Aussage:/Stichworte:" */
let _abbildungen = null;
function abbildungenLaden() {
  if (_abbildungen) return _abbildungen;
  const liste = [];
  if (fs.existsSync(ABBILDUNGEN_PFAD)) {
    let quelle = null, aktuell = null;
    for (const zeile of fs.readFileSync(ABBILDUNGEN_PFAD, 'utf8').split('\n')) {
      let m;
      if ((m = zeile.match(/^## Quelle:\s*(\S+)/))) { quelle = m[1]; aktuell = null; continue; }
      if ((m = zeile.match(/^### S\.(\d+)\s*[—-]+\s*(.+)$/))) {
        aktuell = { quelle, seite: parseInt(m[1], 10), titel: m[2].trim(), zeigt: '', aussage: '', stichworte: [] };
        liste.push(aktuell); continue;
      }
      if (!aktuell) continue;
      if ((m = zeile.match(/^- Zeigt:\s*(.*)$/))) aktuell.zeigt = m[1].trim();
      else if ((m = zeile.match(/^- Aussage:\s*(.*)$/))) aktuell.aussage = m[1].trim();
      else if ((m = zeile.match(/^- Stichworte:\s*(.*)$/))) aktuell.stichworte = m[1].split(',').map(s => s.trim()).filter(Boolean);
    }
  }
  /* Eintraege zu Quellen, die die Konfiguration nicht fuehrt, gibt es nicht */
  return (_abbildungen = liste.filter(a => QUELLEN_NAMEN.includes(a.quelle)));
}
const ABBILDUNG_HERKUNFT = 'KI-gelesene Beschreibung des Seitenbilds (Wup/Doku/weinmann-abbildungen.md) — fachlich zu pruefen; massgebend ist das Bild (seite + bild:true).';
function abbildungMitHerkunft(a) { return Object.assign({}, a, { herkunft: ABBILDUNG_HERKUNFT }); }

/* =====================================================================
   Weinmann-Einzelbilder und -Tabellen (v1.7)
   Einzelbilder: die Bilddateien der 3.7 und der SiteBroker-Dokumente, mit
   KI-gelesener Beschreibung (Wup/Doku/weinmann-einzelbilder.md).
   Tabellen: alle Tabellen der 3.7 und der SiteBroker-Dokumente als
   Zeilenlisten (erzeugt von werkzeuge/md_tabellen_erzeugen.js).
   ===================================================================== */
const EINZELBILDER_PFAD = path.join(REPO_ROOT, 'Wup', 'Doku', 'weinmann-einzelbilder.md');
const TABELLEN_PFAD = path.join(SEITEN_ORDNER, 'weinmann_tabellen.json');
const SITEBROKER_ORDNER = SITEBROKER ? path.join(PDF_ORDNER, ...String(SITEBROKER.ordner).split('/')) : null;
/* Quellen mit Einzelbildern und Tabellen (Konfiguration: einzelbilderUndTabellen).
   'sitebroker' hat keine Seiten — seine Dokumente sind Markdown und werden
   abschnittsweise durchsucht. */
const BILD_TABELLEN_QUELLEN = QUELLEN_NAMEN.filter(k => PDF_QUELLEN[k].einzelbilderUndTabellen).concat(SITEBROKER ? ['sitebroker'] : []);
/* "a, b oder c" fuer Meldungen und Beschreibungen */
function oderListe(namen) { return namen.length > 1 ? namen.slice(0, -1).join(', ') + ' oder ' + namen[namen.length - 1] : namen.join(''); }
const EINZELBILD_HERKUNFT = 'KI-gelesene Beschreibung der Bilddatei (Wup/Doku/weinmann-einzelbilder.md) — fachlich zu pruefen; massgebend ist das Bild (einzelbild: "<kennung>").';

let _einzelbilder = null;
function einzelbilderLaden() {
  if (_einzelbilder) return _einzelbilder;
  const liste = [];
  if (fs.existsSync(EINZELBILDER_PFAD)) {
    let quelle = null, akt = null;
    for (const zeile of fs.readFileSync(EINZELBILDER_PFAD, 'utf8').split('\n')) {
      let m;
      if ((m = zeile.match(/^## Quelle:\s*(\S+)/))) { quelle = m[1]; akt = null; continue; }
      if ((m = zeile.match(/^### (\S+)\s+[—-]+\s+(.+)$/))) {
        akt = { kennung: m[1], quelle, titel: m[2].trim(), datei: null, vorschau: null, abschnitt: '', seite: null, zeigt: '', aussage: '', stichworte: [] };
        liste.push(akt); continue;
      }
      if (!akt) continue;
      if ((m = zeile.match(/^- Datei:\s*(.*)$/))) akt.datei = m[1].trim();
      else if ((m = zeile.match(/^- Vorschau:\s*(.*)$/))) akt.vorschau = m[1].trim();
      else if ((m = zeile.match(/^- Abschnitt:\s*(.*)$/))) akt.abschnitt = m[1].trim();
      else if ((m = zeile.match(/^- Seite:\s*(\d+)/))) akt.seite = parseInt(m[1], 10);
      else if ((m = zeile.match(/^- Zeigt:\s*(.*)$/))) akt.zeigt = m[1].trim();
      else if ((m = zeile.match(/^- Aussage:\s*(.*)$/))) akt.aussage = m[1].trim();
      else if ((m = zeile.match(/^- Stichworte:\s*(.*)$/))) akt.stichworte = m[1].split(',').map(s => s.trim()).filter(Boolean);
    }
  }
  return (_einzelbilder = liste.filter(e => BILD_TABELLEN_QUELLEN.includes(e.quelle)));
}
/* Bildformat am Inhalt erkennen — drei Weinmann-Dateien heissen .png und sind JPEG */
function bildMime(puffer) {
  if (puffer.length > 8 && puffer[0] === 0x89 && puffer.toString('latin1', 1, 4) === 'PNG') return 'image/png';
  if (puffer.length > 3 && puffer[0] === 0xFF && puffer[1] === 0xD8) return 'image/jpeg';
  const kopf = puffer.toString('utf8', 0, 400).replace(/^\uFEFF/, '').trimStart();
  if (kopf.startsWith('<svg') || kopf.startsWith('<?xml')) return 'image/svg+xml';
  return null;
}
/* Ausgeliefert wird die Vorschau, wenn es eine gibt (SVG -> PNG, sehr grosse
   PNG verkleinert), sonst die Datei selbst. null = Datei fehlt. */
function einzelbildLesen(e) {
  for (const rel of [e.vorschau, e.datei]) {
    if (!rel) continue;
    const voll = path.join(REPO_ROOT, rel);
    if (!fs.existsSync(voll)) continue;
    const puffer = fs.readFileSync(voll);
    const mime = bildMime(puffer);
    if (mime === 'image/png' || mime === 'image/jpeg') return { mimeType: mime, data: puffer.toString('base64'), pfad: rel, bytes: puffer.length };
  }
  return null;
}
function einzelbildText(e) { return [e.kennung, e.titel, e.abschnitt, e.zeigt, e.aussage, e.stichworte.join(' ')].join(' ').toLowerCase(); }
function einzelbildAusgabe(e) {
  return { kennung: e.kennung, quelle: e.quelle, titel: e.titel, abschnitt: e.abschnitt, seite: e.seite || undefined, zeigt: e.zeigt, aussage: e.aussage,
    stichworte: e.stichworte, datei: e.datei, abruf: { einzelbild: e.kennung }, herkunft: EINZELBILD_HERKUNFT };
}

let _tabellen = null;
function tabellenLaden() {
  if (_tabellen) return _tabellen;
  if (!fs.existsSync(TABELLEN_PFAD)) return (_tabellen = { tabellen: [], dokumente: [], fehlt: true });
  const t = JSON.parse(fs.readFileSync(TABELLEN_PFAD, 'utf8'));
  /* nur Tabellen und Dokumente konfigurierter Quellen */
  t.tabellen = (t.tabellen || []).filter(x => BILD_TABELLEN_QUELLEN.includes(x.quelle));
  if (Array.isArray(t.dokumente)) t.dokumente = t.dokumente.filter(d => d.quelle == null || BILD_TABELLEN_QUELLEN.includes(d.quelle));
  return (_tabellen = t);
}
function tabelleText(t) { return [t.id, t.abschnitt || '', t.titel || '', t.kopf.join(' '), t.zeilen.map(r => r.join(' ')).join(' ')].join(' ').toLowerCase(); }
function tabelleAusgabe(t, zeilenMax) {
  const a = { id: t.id, quelle: t.quelle, dokument: t.dokument, abschnitt: t.abschnitt, seite: t.seite == null ? undefined : t.seite, titel: t.titel,
    kopf: t.kopf, zeilenAnzahl: t.zeilen.length, zeilen: zeilenMax == null ? t.zeilen : t.zeilen.slice(0, zeilenMax) };
  if (zeilenMax != null && t.zeilen.length > zeilenMax) { a.weitereZeilen = t.zeilen.length - zeilenMax; a.abruf = { tabelle: t.id }; }
  if (t.unregelmaessig) a.unregelmaessig = 'Zellenzahl je Zeile weicht ab — so steht es bei Weinmann (z.B. fehlender Spaltentrenner).';
  if (PDF_QUELLEN[t.quelle] && PDF_QUELLEN[t.quelle].versionsHinweis) a.versionsHinweis = PDF_QUELLEN[t.quelle].versionsHinweis;
  return a;
}

/* SiteBroker-Dokumente abschnittsweise (Markdown-Ueberschriften) fuer die Suche */
let _sitebroker = null;
function sitebrokerAbschnitte() {
  if (_sitebroker) return _sitebroker;
  const liste = [];
  if (SITEBROKER_ORDNER && fs.existsSync(SITEBROKER_ORDNER)) {
    for (const f of fs.readdirSync(SITEBROKER_ORDNER).filter(n => /\.md$/i.test(n)).sort()) {
      let abschnitt = '(Anfang)', puffer = [], inCode = false;
      const ablegen = () => { const text = puffer.join('\n').trim(); if (text) liste.push({ dokument: 'sitebroker/' + f, abschnitt, text }); puffer = []; };
      for (const z of fs.readFileSync(path.join(SITEBROKER_ORDNER, f), 'utf8').replace(/^\uFEFF/, '').split(/\r?\n/)) {
        if (/^\s*```/.test(z)) inCode = !inCode;
        const m = !inCode && z.match(/^#{1,6}\s+(.*?)\s*$/);
        if (m) { ablegen(); abschnitt = m[1]; continue; }
        puffer.push(z);
      }
      ablegen();
    }
  }
  return (_sitebroker = liste);
}
function sitebrokerSuchen(begriff, kontext, maxTreffer) {
  const b = begriff.toLowerCase(); const treffer = []; let gesamt = 0;
  for (const a of sitebrokerAbschnitte()) {
    const klein = a.text.toLowerCase(); let pos = klein.indexOf(b), ersteStelle = true;
    while (pos >= 0) {
      gesamt++;
      if (ersteStelle && treffer.length < maxTreffer) {
        treffer.push({ dokument: a.dokument, abschnitt: a.abschnitt,
          auszug: a.text.slice(Math.max(0, pos - kontext), pos + b.length + kontext).replace(/\s+/g, ' ').trim() });
        ersteStelle = false;
      }
      pos = klein.indexOf(b, pos + b.length);
    }
  }
  return { gesamt, treffer };
}

/* Seitenbild als Base64 (PNG) — null, wenn nicht erzeugt */
function seitenbildLesen(pq, seite) {
  const rel = pq.bilder[seite - 1];
  if (!rel) return null;
  return { mimeType: 'image/png', data: fs.readFileSync(path.join(REPO_ROOT, rel)).toString('base64'), pfad: rel };
}
/* Gedruckte Seitenzahl aus der Kopf-/Fusszeile des Seitentextes ("38 / 52"
   bzw. "Seite 4 von 11") — die Inhaltsstrom-Nummer zaehlt Deckblatt und
   Inhaltsverzeichnis mit und weicht davon ab. */
function gedruckteSeite(text) {
  const t = pdfText.normalisieren(text).replace(/\n/g, ' ');
  let m = t.match(/\bSeite\s*(\d+)\s*von\s*\d+/i);
  if (!m) m = t.match(/\b(\d+)\s*\/\s*\d+\s*Schnittstellenbeschreibung/);
  return m ? parseInt(m[1], 10) : null;
}
function spezifikationSuchen(args) {
  const quelle = args.quelle || 'beide';
  /* 'beide' = die massgebenden Quellen der Konfiguration (alle ohne 'zusatz');
     Zusatzquellen nur auf ausdruecklichen Wunsch oder mit 'alle'. */
  const standardQuellen = QUELLEN_NAMEN.filter(k => !PDF_QUELLEN[k].zusatz);
  /* 'sitebroker' hat keine Seiten: Markdown-Abschnitte, Tabellen und Diagramme (v1.7) */
  const quellen = quelle === 'beide' ? standardQuellen : quelle === 'alle' ? QUELLEN_NAMEN : (quelle === 'sitebroker' && SITEBROKER) ? [] : [quelle];
  for (const q of quellen)
    if (!QUELLEN_NAMEN.includes(q)) throw new Error("Unbekannte 'quelle'. Erlaubt: " + QUELLE_ENUM.join(', '));
  /* Einzelbilder und Tabellen gibt es nur fuer die Quellen in BILD_TABELLEN_QUELLEN —
     gehoert keine davon zur Auswahl (z.B. 'beide' ohne solche Quelle), bleiben sie aussen vor */
  const mitZusatz = quelle === 'alle' || BILD_TABELLEN_QUELLEN.includes(quelle) || quellen.some(q => BILD_TABELLEN_QUELLEN.includes(q));
  const zusatzPasst = (q) => quelle === 'alle' || q === quelle || quellen.includes(q);
  const katalog = abbildungenLaden();

  /* --- ein Einzelbild (v1.7): Bilddatei der 3.7 oder der SiteBroker-Dokumente --- */
  if (args.einzelbild != null) {
    const kennung = String(args.einzelbild).trim();
    const alle = einzelbilderLaden();
    const e = alle.find(x => x.kennung === kennung) || alle.find(x => x.kennung.toLowerCase() === kennung.toLowerCase())
      || alle.find(x => x.datei && path.basename(x.datei).toLowerCase() === kennung.toLowerCase());
    if (!e) throw new Error("Unbekanntes Einzelbild '" + kennung + "'. Liste: wup_spezifikation mit abbildungen:true und quelle "
      + oderListe(BILD_TABELLEN_QUELLEN) + ' (' + alle.length + ' Bilder im Katalog).');
    const ergebnis = einzelbildAusgabe(e);
    delete ergebnis.abruf;
    if (PDF_QUELLEN[e.quelle] && PDF_QUELLEN[e.quelle].versionsHinweis) ergebnis.versionsHinweis = PDF_QUELLEN[e.quelle].versionsHinweis;
    const bild = einzelbildLesen(e);
    if (bild) {
      ergebnis.bild = { pfad: bild.pfad, mimeType: bild.mimeType, bytes: bild.bytes,
        hinweis: 'Das Bild liegt als Bildinhalt der Antwort bei' + (e.vorschau ? ' (Vorschau; Original: ' + e.datei + ')' : '') + '.' };
      ergebnis._bilder = [{ data: bild.data, mimeType: bild.mimeType }];
    } else ergebnis.bild = { fehlt: true, hinweis: 'Bilddatei nicht gefunden oder nicht als PNG/JPEG lieferbar: ' + (e.vorschau || e.datei) };
    if (e.seite) ergebnis.seitenAbruf = { quelle: e.quelle, seite: e.seite, bild: true };
    return ergebnis;
  }
  /* --- eine Tabelle vollstaendig (v1.7) --- */
  if (args.tabelle != null) {
    const id = String(args.tabelle).trim().toLowerCase();
    const t = tabellenLaden().tabellen.find(x => x.id.toLowerCase() === id);
    if (!t) throw new Error("Unbekannte Tabelle '" + args.tabelle + "'. Liste: wup_spezifikation mit tabellen:true (Kennungen wie v37-T42, sbi-T04).");
    return tabelleAusgabe(t, null);
  }
  /* --- Tabellen auflisten/durchsuchen (v1.7) --- */
  if (args.tabellen === true) {
    const tl = tabellenLaden();
    if (args.quelle != null && !mitZusatz)
      throw new Error('Strukturierte Tabellen gibt es fuer quelle ' + BILD_TABELLEN_QUELLEN.map(q => "'" + q + "'").join(' und ') + " (oder 'alle'). "
        + baustein('tabellenAndereQuellen'));
    const begriff = typeof args.suchbegriff === 'string' && args.suchbegriff.trim().length >= 2 ? args.suchbegriff.trim().toLowerCase() : null;
    const seiteFilter = args.seite != null ? ganzzahl(args.seite, 'seite', 1, 9999) : null;
    const maxT = ganzzahl(args.max_treffer == null ? 12 : args.max_treffer, 'max_treffer', 1, 100);
    const passend = tl.tabellen.filter(t => (args.quelle == null || zusatzPasst(t.quelle))
      && (seiteFilter == null || t.seite === seiteFilter) && (!begriff || tabelleText(t).includes(begriff)));
    return { tabellen: passend.slice(0, maxT).map(t => tabelleAusgabe(t, begriff ? 12 : 3)), anzahl: passend.length, gezeigt: Math.min(passend.length, maxT),
      imVerzeichnis: tl.tabellen.length, dokumente: tl.dokumente,
      hinweis: 'Zeilen als Listen, aus den Markdown-Fassungen von Weinmann erzeugt (werkzeuge/md_tabellen_erzeugen.js) — nichts gedeutet. '
        + 'Ganze Tabelle: tabelle:"<id>". Bei der 3.7 ist "seite" die PDF-Seite, auf der der Abschnitt beginnt.'
        + (tl.fehlt ? ' ACHTUNG: weinmann_tabellen.json fehlt.' : '') };
  }

  /* --- Katalog der Zeichnungen auflisten (optional nach Begriff/Quelle/Seite gefiltert) --- */
  if (args.abbildungen === true) {
    const begriff = typeof args.suchbegriff === 'string' && args.suchbegriff.trim().length >= 2 ? args.suchbegriff.trim().toLowerCase() : null;
    const seiteFilter = args.seite != null ? ganzzahl(args.seite, 'seite', 1, 9999) : null;
    const eintraege = katalog.filter(a => quellen.includes(a.quelle)
      && (seiteFilter == null || a.seite === seiteFilter)
      && (!begriff || [a.titel, a.zeigt, a.aussage, a.stichworte.join(' ')].join(' ').toLowerCase().includes(begriff)))
      .map(a => Object.assign({}, a, { bildAbruf: { quelle: a.quelle, seite: a.seite, bild: true } }));
    const ergebnisA = { abbildungen: eintraege, anzahl: eintraege.length, imKatalog: katalog.length,
      herkunft: ABBILDUNG_HERKUNFT,
      hinweis: 'Zum Ansehen einer Zeichnung: wup_spezifikation mit quelle, seite und bild:true. Katalog: Wup/Doku/weinmann-abbildungen.md.' };
    if (mitZusatz) {
      const einzel = einzelbilderLaden().filter(e => zusatzPasst(e.quelle)
        && (seiteFilter == null || e.seite === seiteFilter) && (!begriff || einzelbildText(e).includes(begriff)));
      ergebnisA.einzelbilder = einzel.map(einzelbildAusgabe);
      ergebnisA.einzelbilderAnzahl = einzel.length;
      ergebnisA.hinweis += ' Einzelbilder (Bilddateien der 3.7 und der SiteBroker-Dokumente): einzelbild:"<kennung>"; Katalog: Wup/Doku/weinmann-einzelbilder.md.';
    }
    return ergebnisA;
  }

  /* --- eine ganze Seite (Text, Katalogeintraege, optional das Seitenbild) --- */
  if (args.seite != null) {
    if (quelle === 'beide' || quelle === 'alle') throw new Error("Fuer 'seite' bitte genau eine 'quelle' angeben.");
    if (quelle === 'sitebroker') throw new Error('Die SiteBroker-Dokumente haben keine Seiten: Volltext als Ressource (wup-doku://…/sitebroker/…), '
      + 'Suche mit suchbegriff, Tabellen mit tabellen:true, Diagramme mit abbildungen:true.');
    const pq = pdfQuelleLaden(quelle);
    const seite = ganzzahl(args.seite, 'seite', pq.seitenVon, pq.seitenGesamt);
    if (pq.seiten[seite - 1] == null)
      throw new Error('Seite ' + seite + ' von "' + quelle + '" ist nicht verfuegbar' + baustein('seiteNichtVerfuegbar') + '.');
    const ergebnis = { quelle, titel: pq.titel, datei: pq.datei, seite, gedruckteSeite: pq.gedruckt[seite - 1],
      seitenGesamt: pq.seitenGesamt, textQuelle: pq.textQuelle, text: pdfText.normalisieren(pq.seiten[seite - 1]),
      abbildungen: katalog.filter(a => a.quelle === quelle && a.seite === seite).map(abbildungMitHerkunft) };
    if (PDF_QUELLEN[quelle].versionsHinweis) ergebnis.versionsHinweis = PDF_QUELLEN[quelle].versionsHinweis;
    if (BILD_TABELLEN_QUELLEN.includes(quelle)) {
      const eb = einzelbilderLaden().filter(e => e.quelle === quelle && e.seite === seite);
      if (eb.length) ergebnis.einzelbilder = eb.map(e => ({ kennung: e.kennung, titel: e.titel, abruf: { einzelbild: e.kennung } }));
      const tb = tabellenLaden().tabellen.filter(t => t.quelle === quelle && t.seite === seite);
      if (tb.length) ergebnis.tabellen = tb.map(t => ({ id: t.id, abschnitt: t.abschnitt, titel: t.titel, kopf: t.kopf, zeilenAnzahl: t.zeilen.length, abruf: { tabelle: t.id } }));
    }
    if (args.bild === true) {
      const bild = seitenbildLesen(pq, seite);
      if (bild) { ergebnis.bild = { pfad: bild.pfad, mimeType: bild.mimeType, hinweis: 'Seitenbild liegt als Bildinhalt der Antwort bei (4-Bit-Graustufen-PNG, rund 1190x1684).' };
        ergebnis._bilder = [{ data: bild.data, mimeType: bild.mimeType }]; }
      else ergebnis.bild = { fehlt: true, hinweis: 'Fuer diese Seite ist kein Seitenbild erzeugt (Wup/Mcp/werkzeuge/pdf_seiten_erzeugen.js).' };
    } else if (pq.bilder[seite - 1]) {
      ergebnis.bildHinweis = "Diese Seite liegt als Bild vor — mit bild:true wird es mitgeliefert (fuer Zeichnungen und Tabellen massgebend).";
    }
    ergebnis.hinweis = 'Textebene maschinell gelesen — Wort-/Zeilenumbrueche koennen abweichen; bei Zeichnungen das Bild ansehen.';
    return ergebnis;
  }

  /* --- Volltextsuche in Text UND Abbildungskatalog --- */
  if (!args.suchbegriff || typeof args.suchbegriff !== 'string' || args.suchbegriff.trim().length < 2)
    throw new Error("Parameter 'suchbegriff' (mind. 2 Zeichen) fehlt — oder 'seite' + 'quelle' fuer eine ganze Seite, oder abbildungen:true fuer den Zeichnungskatalog.");
  const kontext = ganzzahl(args.kontext == null ? 220 : args.kontext, 'kontext', 40, 2000);
  const maxTreffer = ganzzahl(args.max_treffer == null ? 12 : args.max_treffer, 'max_treffer', 1, 100);
  const begriff = args.suchbegriff.trim();
  const ergebnis = { suchbegriff: begriff, quellen: [], gesamtTreffer: 0, abbildungen: [] };
  for (const q of quellen) {
    const pq = pdfQuelleLaden(q);
    const seitenText = pq.seiten.map(t => t == null ? '' : t);
    const s = pdfText.suchen(seitenText, begriff, { kontext, maxTreffer, seitenVon: pq.seitenVon });
    ergebnis.gesamtTreffer += s.gesamt;
    for (const t of s.treffer) {
      t.gedruckteSeite = pq.gedruckt[t.seite - 1];
      const abb = katalog.filter(a => a.quelle === q && a.seite === t.seite);
      if (abb.length) t.zeichnungenAufSeite = abb.map(a => a.titel);
      if (pq.bilder[t.seite - 1]) t.bildAbruf = { quelle: q, seite: t.seite, bild: true };
    }
    const eintrag = { quelle: q, titel: pq.titel, datei: pq.datei, seitenGesamt: pq.seitenGesamt, textQuelle: pq.textQuelle,
      durchsuchtAbSeite: pq.seitenVon, treffer: s.gesamt, gezeigt: s.treffer.length, auszuege: s.treffer };
    if (pq.nichtLesbar) eintrag.hinweis = pq.nichtLesbar + ' Textstrom/-stroeme mit nicht lesbarer Schriftcodierung uebersprungen.';
    if (PDF_QUELLEN[q].versionsHinweis) eintrag.versionsHinweis = PDF_QUELLEN[q].versionsHinweis;
    ergebnis.quellen.push(eintrag);
    const b = begriff.toLowerCase();
    for (const a of katalog.filter(a => a.quelle === q))
      if ([a.titel, a.zeigt, a.aussage, a.stichworte.join(' ')].join(' ').toLowerCase().includes(b))
        ergebnis.abbildungen.push(Object.assign(abbildungMitHerkunft(a), { bildAbruf: { quelle: q, seite: a.seite, bild: true } }));
  }
  /* Zusatzquellen nicht still uebergehen: bei 'beide' die Trefferzahl nennen
     (PAL, MODELLREF, ELEMENTID … stehen nur in 3.7) */
  if (quelle === 'beide') {
    const weitere = [];
    for (const q of Object.keys(PDF_QUELLEN).filter(k => PDF_QUELLEN[k].zusatz)) {
      let pq; try { pq = pdfQuelleLaden(q); } catch { continue; }
      const s = pdfText.suchen(pq.seiten.map(t => t == null ? '' : t), begriff, { kontext: 40, maxTreffer: 1, seitenVon: pq.seitenVon });
      if (s.gesamt) weitere.push({ quelle: q, titel: pq.titel, treffer: s.gesamt, versionsHinweis: PDF_QUELLEN[q].versionsHinweis,
        abruf: { suchbegriff: begriff, quelle: q } });
    }
    if (weitere.length) ergebnis.weitereQuellen = weitere;
  }
  /* v1.7: SiteBroker-Text, Einzelbilder und Tabellen (nur 3.7, sitebroker, alle) */
  if (mitZusatz) {
    const b = begriff.toLowerCase();
    if (SITEBROKER && (quelle === 'sitebroker' || quelle === 'alle')) {
      const sb = sitebrokerSuchen(begriff, kontext, maxTreffer);
      ergebnis.gesamtTreffer += sb.gesamt;
      ergebnis.quellen.push({ quelle: 'sitebroker', titel: SITEBROKER.titel || 'Weinmann SiteBroker',
        treffer: sb.gesamt, gezeigt: sb.treffer.length, auszuege: sb.treffer,
        hinweis: 'Abschnittsweise durchsucht (keine Seiten), je Abschnitt die erste Fundstelle. Nur fuer ausgewaehlte Maschinen — wup_referenz thema=sitebroker.' });
    }
    const eb = einzelbilderLaden().filter(e => zusatzPasst(e.quelle) && einzelbildText(e).includes(b));
    if (eb.length) ergebnis.einzelbilder = eb.slice(0, 12).map(einzelbildAusgabe);
    const tb = tabellenLaden().tabellen.filter(t => zusatzPasst(t.quelle) && tabelleText(t).includes(b));
    if (tb.length) ergebnis.tabellen = tb.slice(0, 12).map(t => ({ id: t.id, quelle: t.quelle, abschnitt: t.abschnitt, titel: t.titel, kopf: t.kopf,
      zeilenAnzahl: t.zeilen.length, abruf: { tabelle: t.id } }));
  }
  if (ANLAGEN_HINWEIS && quellen.some(q => PDF_QUELLEN[q].anlagenHinweis)) ergebnis.anlagenHinweis = ANLAGEN_HINWEIS;
  ergebnis.hinweis = "Auszuege aus der Textebene (Leerraum normalisiert); 'seite' = PDF-Seite, 'gedruckteSeite' = Fusszeile. "
    + "'abbildungen' = Zeichnungen aus dem Katalog, deren Beschreibung den Begriff enthaelt — Bild ansehen mit 'bildAbruf'. "
    + "'einzelbilder' und 'tabellen' (nur 3.7/sitebroker/alle) = Bilddateien und strukturierte Tabellen, die den Begriff tragen."
    + (baustein('rechte') ? ' ' + baustein('rechte') : '');
  return ergebnis;
}

/* =====================================================================
   MCP-Ressourcen: die massgebliche WUP-Doku direkt lesbar machen
   ===================================================================== */

/* Liste aus der Konfiguration (rel, name, beschreibung) */
const RESSOURCEN_ALLE = (Array.isArray(KONFIG.ressourcen) ? KONFIG.ressourcen : []).filter(r => r && typeof r.rel === 'string');
const RESSOURCEN = RESSOURCEN_ALLE.filter(r => fs.existsSync(path.join(REPO_ROOT, r.rel)));
const RESSOURCEN_FEHLEND = RESSOURCEN_ALLE.filter(r => !fs.existsSync(path.join(REPO_ROOT, r.rel))).map(r => r.rel);
function mimeTyp(rel) { return /\.md$/i.test(rel) ? 'text/markdown' : 'text/plain'; }
/* Leerzeichen im Pfad (Ordner "02_Schnittstellenbeschreibung etc") kodieren — eine URI mit Leerzeichen
   lehnen manche Clients ab. Pfade ohne Leerzeichen behalten ihre bisherige Adresse. */
function dokuUri(rel) { return 'wup-doku://' + rel.replace(/ /g, '%20'); }

/* Seitenbilder mit Zeichnung als Bild-Ressourcen (wup-abbildung://<quelle>/S<nn>) */
let _bildRessourcen = null;
function bildRessourcen() {
  if (_bildRessourcen) return _bildRessourcen;
  const liste = [];
  /* v1.7: Einzelbilder (wup-einzelbild://<kennung>) — PNG oder JPEG, je nach Inhalt */
  for (const e of einzelbilderLaden()) {
    const b = einzelbildLesen(e);
    if (!b) continue;
    liste.push({ uri: 'wup-einzelbild://' + e.kennung, name: e.titel, description: (PDF_QUELLEN[e.quelle] ? PDF_QUELLEN[e.quelle].titel : 'Weinmann SiteBroker')
      + ' — Einzelbild. ' + e.aussage.slice(0, 160), mimeType: b.mimeType, einzelbild: e.kennung });
  }
  for (const a of abbildungenLaden()) {
    let pq; try { pq = pdfQuelleLaden(a.quelle); } catch { continue; }
    if (!pq.bilder[a.seite - 1]) continue;
    const uri = 'wup-abbildung://' + a.quelle + '/S' + String(a.seite).padStart(2, '0');
    if (liste.some(r => r.uri === uri)) continue;
    liste.push({ uri, name: 'S.' + a.seite + ' ' + a.titel, description: PDF_QUELLEN[a.quelle].titel + ' — Seitenbild mit Zeichnung (4-Bit-Grau-PNG). '
      + a.aussage.slice(0, 160), mimeType: 'image/png', quelle: a.quelle, seite: a.seite });
  }
  return (_bildRessourcen = liste);
}

/* =====================================================================
   Selbsttest
   ===================================================================== */

const BENOETIGTE_FUNKTIONEN = ['dateiDekodieren', 'wupParsen', 'pruefungenAusfuehren', 'exportZeilenErzeugen', 'exportBytesErzeugen',
  'f1AlleAusfuehren', 'f2SammelAktion', 'f3AutoPsf', 'autoKonturVerbinden', 'neigungenNullen', 'nrIndex25PlaKorrigieren',
  'werteErsetzen', 'werteErsetzenVorschauHunks', 'steuercodeZerlegen', 'steuercodeBauen', 'steuercodeWorte',
  'nagelPunkte', 'opIstZerspanend', 'materialKlasse', 'hinweisAnzeigen', 'bestaetigen'];
const BENOETIGTE_KONSTANTEN = ['PROFIL_STANDARD', 'MATERIAL_KLASSEN', 'WE_FELDER', 'TOOL_VERSION'];

function harnessPruefen() {
  try {
    const ctx = kontextErzeugen();
    vm.runInContext(editorScriptLaden(), ctx, { filename: 'wup_editor.html#script' });
    const fehlend = BENOETIGTE_FUNKTIONEN.filter(f => vm.runInContext('typeof ' + f, ctx) !== 'function')
      .concat(BENOETIGTE_KONSTANTEN.filter(k => vm.runInContext('typeof ' + k, ctx) === 'undefined'));
    const scriptBloecke = (fs.readFileSync(EDITOR_PFAD, 'utf8').match(/<script\b/g) || []).length;
    return { ok: !fehlend.length && scriptBloecke === 1, fehlend, scriptBloecke,
      hinweis: scriptBloecke === 1 ? undefined : 'Harness erwartet GENAU EINEN <script>-Block im Editor (gieriger Regex) — hier ' + scriptBloecke + '.' };
  } catch (e) { return { ok: false, fehler: e.message }; }
}

function serverStatus(args) {
  const status = {
    server: { name: SERVER_NAME, version: SERVER_VERSION, node: process.version, profil: profilHinweis(),
      hinweis: 'Ein laufender Server sieht Editor-Aenderungen erst nach Neustart (Script je Prozess einmal geladen).' },
    /* v1.8: wirksames Profil — Profildatei (oder null), Zahl der Geraete, ggf. Fehler/Hinweis */
    profil: (() => {
      const ps = Object.assign({}, profilStand());
      if (ps.geraete === 0) ps.hinweis = GERAETE_FEHLEN_HINWEIS;
      if (ps.unbekannteSchluessel) ps.hinweisSchluessel = 'Die Profildatei traegt Schluessel, die PROFIL_STANDARD nicht kennt (' + ps.unbekannteSchluessel.join(', ') + ') — sie werden uebernommen, vom Editor aber nicht ausgewertet.';
      return ps;
    })(),
    editor: { pfad: path.relative(REPO_ROOT, EDITOR_PFAD), vorhanden: fs.existsSync(EDITOR_PFAD), version: editorVersion() },
    pruefregeln: (() => { const p = pruefregelnAusEditor(); return { anzahl: p.anzahl, spanne: pruefregelnSpanne(), codes: p.regeln.map(r => r.code) }; })(),
    harness: harnessPruefen(),
    ressourcen: { vorhanden: RESSOURCEN.length, fehlend: RESSOURCEN_FEHLEND },
    referenzdateien: { ordner: path.relative(REPO_ROOT, BEISPIEL_ORDNER),
      anzahl: fs.existsSync(BEISPIEL_ORDNER) ? wupDateienFinden(BEISPIEL_ORDNER, true, /\.wup$/i).length : 0 },
    pdfs: {},
  };
  for (const q of QUELLEN_NAMEN) {
    try { const pq = pdfQuelleLaden(q); status.pdfs[q] = { datei: pq.datei, seiten: pq.seitenGesamt, seitenbilder: pq.seitenbilder, textQuelle: pq.textQuelle, durchsuchtAbSeite: pq.seitenVon }; }
    catch (e) { status.pdfs[q] = { fehler: e.message }; }
  }
  const katalog = abbildungenLaden();
  status.abbildungen = { katalog: path.relative(REPO_ROOT, ABBILDUNGEN_PFAD), eintraege: katalog.length,
    ohneSeitenbild: katalog.filter(a => { try { return !pdfQuelleLaden(a.quelle).bilder[a.seite - 1]; } catch { return true; } }).map(a => a.quelle + ' S.' + a.seite),
    bildRessourcen: bildRessourcen().length };
  const ebAlle = einzelbilderLaden(), tl = tabellenLaden();
  status.einzelbilder = { katalog: path.relative(REPO_ROOT, EINZELBILDER_PFAD), eintraege: ebAlle.length,
    ohneDatei: ebAlle.filter(e => !einzelbildLesen(e)).map(e => e.kennung) };
  status.tabellen = { datei: path.relative(REPO_ROOT, TABELLEN_PFAD), vorhanden: !tl.fehlt, anzahl: tl.tabellen.length,
    jeDokument: (tl.dokumente || []).map(d => d.kuerzel + ' ' + d.tabellen).join(', ') };
  if (args.roundtrip === true) {
    const t0 = Date.now();
    const r = ordnerPruefen({ ordner: path.relative(REPO_ROOT, BEISPIEL_ORDNER), roundtrip: true, max_dateien: 2000 });
    status.roundtrip = { dateien: r.geprueft, zeilenAbweichend: r.gesamt.roundtripAbweichend, byteAbweichend: r.gesamt.byteAbweichend,
      ausnahmen: r.gesamt.ausnahmen,
      abweichendeDateien: r.eintraege.filter(e => (e.roundtrip && e.roundtrip !== 'identisch') || e.bytes)
        .map(e => e.datei + ': ' + (e.roundtrip !== 'identisch' ? e.roundtrip : '') + (e.bytes ? ' / ' + e.bytes : '')),
      dauerMs: Date.now() - t0 };
  }
  status.ok = status.editor.vorhanden && status.harness.ok && status.pruefregeln.anzahl > 0 && !status.profil.fehler
    && !RESSOURCEN_FEHLEND.length && Object.values(status.pdfs).every(p => !p.fehler)
    && status.abbildungen.eintraege > 0 && !status.abbildungen.ohneSeitenbild.length
    && !status.einzelbilder.ohneDatei.length && (status.tabellen.vorhanden || !status.einzelbilder.eintraege)
    && (!status.roundtrip || (status.roundtrip.zeilenAbweichend === 0 && status.roundtrip.ausnahmen === 0));
  return status;
}

/* =====================================================================
   Tool-Definitionen (MCP tools/list)
   ===================================================================== */

const DATEI_EINGABE = {
  pfad: { type: 'string', description: 'Pfad zur WUP-Datei (absolut oder relativ zum Repo-Root' + (KONFIG.beispielPfad ? ', z.B. "' + KONFIG.beispielPfad + '"' : '') + ')' },
  text: { type: 'string', description: 'Alternativ: WUP-Inhalt direkt als Text (BOM wird erkannt)' },
  datei_name: { type: 'string', description: 'Optionaler Dateiname, wenn "text" verwendet wird' },
  encoding: { type: 'string', enum: ['windows-1252', 'utf-8', 'ascii', 'utf-16le'], description: 'Nur mit "text": Encoding, das der Export verwenden soll (Standard windows-1252)' },
};
const SCHREIB_PARAMETER = {
  ziel_pfad: { type: 'string', description: 'Optional: Zieldatei (.wup) fuer den Export — sonst Probelauf. Gesperrt: Referenz-, Werkzeug- und Doku-Ordner, Quelldatei' },
  ueberschreiben: { type: 'boolean', description: 'Bestehende Zieldatei ersetzen (Standard: false)' },
  trotz_fehler: { type: 'boolean', description: 'Auch bei offenen FEHLER-Befunden oder Datenverlust schreiben (Standard: false — wie die Rueckfrage des Editors)' },
};
const NUR_LESEN = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false };
const SCHREIBT_OPTIONAL = { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false };

const TOOLS = [
  {
    name: 'wup_datei_analysieren', title: 'WUP-Datei analysieren',
    description: 'Parst eine WUP-Datei mit dem Original-Parser des WUP-Editors und liefert eine strukturierte Uebersicht: Plausibilitaet (ist das eine WUP-Datei?), Versionslage (abgekuendigte und in WUP 3.7 entfernte Keywords mit Ersatz, Keywords neuer als die Anlage' + (WUP_ANLAGE_VERSION ? ' ' + WUP_ANLAGE_VERSION : '') + ', 3.7-Konformitaet, Hinweise aus dem Wortlaut der Weinmann-Spezifikation zu Sperrflaechen), Kopf (ELM/ELN/ELA/...; Personenfelder maskiert), Sub-Waende (Multiwand), Statistik, Riegelwerk, Lagen (PLI/PLA) mit Platten, Bearbeitungen (PAF/PSG/PSF/PSZ) und Nagelreihen-Gruppen inkl. Geraete-Klartext, Materialien mit Weinmann-Klasse, Parser-Warnungen und eingefangene Editor-Meldungen.',
    inputSchema: { type: 'object', properties: DATEI_EINGABE }, annotations: NUR_LESEN,
  },
  {
    name: 'wup_pruefen', title: 'WUP-Datei pruefen',
    description: 'Fuehrt die Weinmann-Pruefregeln ' + pruefregelnSpanne() + ' des WUP-Editors (v' + editorVersion() + ', live gelesen) auf einer WUP-Datei aus — u.a. P-03 Klammerkollision, P-01/P-02 Schnitttiefen, P-08 offene Sperrflaechen, P-19..P-23 gravierende Befunde — und liefert alle Befunde mit Level (fehler/warnung/hinweis), Code, Meldung und Quelltext-Zeile, Zaehler je Level und je Code sowie einen Plausibilitaetsblock. Optional nach Level oder Codes filtern. Rechnet mit PROFIL_STANDARD.',
    inputSchema: { type: 'object', properties: Object.assign({}, DATEI_EINGABE, {
      level: { type: 'array', items: { type: 'string', enum: ['fehler', 'warnung', 'hinweis'] }, description: 'Nur diese Levels ausgeben (Zaehler bleiben vollstaendig)' },
      codes: { type: 'array', items: { type: 'string' }, description: 'Nur diese Codes ausgeben, z.B. ["P-03"]' },
      max_eintraege: { type: 'integer', description: 'Hoechstens so viele Eintraege (Standard 500; Zaehler bleiben vollstaendig)' },
    }) }, annotations: NUR_LESEN,
  },
  {
    name: 'wup_roundtrip_pruefen', title: 'Export-Treue pruefen',
    description: 'Kontrolliert die Export-Treue: Datei unveraendert einlesen und re-exportieren muss ZEILENidentisch sein (Garantie des Roundtrip-Regressionstests) — zusaetzlich BYTEweise (Encoding, BOM, Zeilenende; nur bei pfad). Meldet die erste Abweichung (Zeile bzw. Byteposition) mit Hinweis auf die wahrscheinliche Ursache.',
    inputSchema: { type: 'object', properties: DATEI_EINGABE }, annotations: NUR_LESEN,
  },
  {
    name: 'wup_ordner_pruefen', title: 'Ordner im Stapel pruefen',
    description: 'Stapelpruefung aller WUP-Dateien eines Ordners (Standard: ' + VORGABE_ORDNER_REL + ', rekursiv): je Datei Kopfdaten (ELN, ELM, Encoding, Lagen, Platten, NR), Befund-Zaehler je Level, Pruefcodes, Plausibilitaet, Roundtrip (Zeilen und Bytes) und Editor-Meldungen; dazu Summen und Haeufigkeit je Code ueber den Ordner. Optional Befunde je Datei mit ausgeben.',
    inputSchema: { type: 'object', properties: {
      ordner: { type: 'string', description: 'Ordner (absolut oder relativ zum Repo-Root). Standard: ' + VORGABE_ORDNER_REL },
      rekursiv: { type: 'boolean', description: 'Unterordner einschliessen (Standard true)' },
      roundtrip: { type: 'boolean', description: 'Roundtrip je Datei pruefen (Standard true)' },
      befunde: { type: 'string', enum: ['keine', 'fehler', 'alle'], description: 'Befunde je Datei ausgeben (Standard keine)' },
      max_dateien: { type: 'integer', description: 'Obergrenze (Standard 200, max 2000)' },
    } }, annotations: NUR_LESEN,
  },
  {
    name: 'wup_automatik', title: 'Editor-Automatiken ausfuehren',
    description: 'Fuehrt Automatiken des WUP-Editors headless mit den ORIGINAL-Funktionen aus: auto_schnitt (F1 Ueber-/Unterschnitt-Korrektur), freistiche (F2 an unterschnittenen Innenecken), auto_psf (F3 Sperrflaechen unter Bearbeitungen — sicherheitsrelevant, konservative Editor-Logik), auto_kontur (offene PAF/PSF-Ketten verbinden, kollineare PSG zusammenfassen, Luecke <= Profilgrenze), neigungen_nullen (P-21: Neigung alpha auf 0 bei PAF/PSG), nr_index_25_pla (P-22: NR-Index 25 -> 20 in PLA-Lagen). Liefert Zaehler je Aktion, Pruefung danach und die Editor-Meldungen (z.B. Auto-PSF: "unbekannter NR-Index, konservativ"). Ohne ziel_pfad Probelauf; mit ziel_pfad Export als .wup — nur ohne offene FEHLER-Befunde/Datenverlust oder mit trotz_fehler:true.',
    inputSchema: {
      type: 'object',
      properties: Object.assign({}, DATEI_EINGABE, {
        aktionen: { type: 'array', items: { type: 'string', enum: Object.keys(AUTOMATIK_SKRIPTE) },
          description: 'Auszufuehrende Automatiken in dieser Reihenfolge' },
      }, SCHREIB_PARAMETER),
      required: ['aktionen'],
    }, annotations: SCHREIBT_OPTIONAL,
  },
  {
    name: 'wup_werte_ersetzen', title: 'Werte suchen/ersetzen (Strg+H)',
    description: 'Suchen & Ersetzen des WUP-Editors (Strg+H) headless: findet in einer WUP-Datei alle Vorkommen eines Werts in einem Feld (x/y/xy/z/t/steuercode/radius/winkel/nrIndex/nrAbstand, Platten: name/platteIdx/platteHz/platteZ/platteX/platteY/platteXY, Bauteile: bozWert — Liste live aus dem Editor) und zeigt die Vorschau als Quelltext-Hunks (alt/neu je Objekt, exakt die Export-Zeilen). Ohne anwenden:true nur Vorschau; mit anwenden:true wird ersetzt, geprueft und exportiert (ziel_pfad/trotz_fehler wie bei wup_automatik). Steuercode/nrIndex/platteIdx werden exakt (ganzzahlig) verglichen, Radius inklusive Vorzeichen (Drehrichtung); platteZ nur bei Platten MIT z-Angabe.',
    inputSchema: {
      type: 'object',
      properties: Object.assign({}, DATEI_EINGABE, {
        feld: { type: 'string', description: 'Feld (siehe Beschreibung; unbekannte Werte liefern die gueltige Liste)' },
        suchwert: { description: 'Gesuchter Wert (Zahl; bei feld=name Text)' },
        ersatzwert: { description: 'Neuer Wert (Zahl; bei feld=name Text) — fuer die Vorschau optional' },
        toleranz: { type: 'number', description: 'Toleranz fuer Zahlenvergleich in mm (Standard 0.01; exakte Felder ignorieren sie)' },
        lagen: { type: 'array', items: { type: 'string' }, description: 'Nur diese Lagen, z.B. ["PLI1","PLA2"]' },
        typen: { type: 'array', items: { type: 'string' }, description: 'Nur diese Bearbeitungstypen, z.B. ["NR"]' },
        text_modus: { type: 'string', enum: ['exakt', 'enthaelt'], description: 'Nur feld=name: exakter Name oder Teiltext (Standard exakt)' },
        anwenden: { type: 'boolean', description: 'true = wirklich ersetzen (Standard false = nur Vorschau)' },
        max_hunks: { type: 'integer', description: 'Vorschau-Hunks hoechstens (Standard 40)' },
      }, SCHREIB_PARAMETER),
      required: ['feld', 'suchwert'],
    }, annotations: SCHREIBT_OPTIONAL,
  },
  {
    name: 'wup_steuercode', title: 'Steuercode dekodieren/bauen',
    description: 'Dekodiert einen Weinmann-Steuercode (PP/KB/MP-Feld i bei PAF/PSG) in seine vier Stellen (Werkzeug, Ueber-/Unterschnitt, Radiuskorrektur, Gleich-/Gegenlauf) inkl. Klartext und Plausibilitaet je Stelle (Weinmann Kap. 5.1: Werkzeug 1-4, Schnitt 1-2, Korrektur 1-3, Lauf 0-1) — oder baut umgekehrt aus den vier Stellen den Code (unplausible Stellen werden abgelehnt).',
    inputSchema: {
      type: 'object',
      properties: {
        code: { type: 'integer', description: 'Zu dekodierender Steuercode, z.B. 221 (Ziffern-String wird akzeptiert)' },
        teile: { type: 'object', description: 'Alternativ: Code aus Stellen bauen (fehlende Stellen: werkzeug 1, schnitt 1, korrektur 3, lauf 0)',
          properties: { werkzeug: { type: 'integer' }, schnitt: { type: 'integer' },
                        korrektur: { type: 'integer' }, lauf: { type: 'integer' } } },
        kw: { type: 'string', enum: ['PAF', 'PSG'], description: 'Kontext fuer den Werkzeug-Klartext (Standard: PAF)' },
      },
    }, annotations: NUR_LESEN,
  },
  {
    name: 'wup_referenz', title: 'WUP-Format-Referenz',
    description: 'Liefert die kondensierte Weinmann/WUP-Format-Referenz: Quellen-Hierarchie, ' + (baustein('toolReferenzVersionslage') || 'WUP-Versionslage') + ', Aenderungshistorie 1.x bis 3.7, WUP 3.7 im Einzelnen, Keywords, Steuercode-System, Pruefregeln (live aus dem Editor), Maschinenprofil (live), WupWorks5-Stand, SiteBroker (MQTT/REST-Anbindung an ein Leitsystem), Sicherheitsgrundsaetze und die OFFENEN Fachfragen (nicht raten!)' + baustein('toolReferenzWarnung') + '. Fuer den Originalwortlaut der Weinmann-Dokumente: wup_spezifikation.',
    inputSchema: {
      type: 'object',
      properties: { thema: { type: 'string',
        enum: ['quellen', 'versionen', 'aenderungshistorie', 'version37', 'keywords', 'steuercodes', 'pruefregeln', 'maschinenprofil', 'wupworks', 'sitebroker', 'sicherheit', 'offen', 'alle'],
        description: "Teilthema (Standard: 'alle')" } },
    }, annotations: NUR_LESEN,
  },
  {
    name: 'wup_spezifikation', title: 'In den Weinmann-PDFs nachschlagen (Text UND Zeichnungen)',
    description: 'Nachschlagen in den Weinmann-Originaldokumenten (Primaerquelle): ' + (baustein('toolSpezifikationQuellen') || 'Quellen: ' + QUELLE_ENUM.join(', ') + '.') + ' Fuer 3.7 und SiteBroker gibt es zusaetzlich EINZELBILDER (einzelbild:"<kennung>" — jede Zeichnung als eigene Datei, 39 Stueck) und STRUKTURIERTE TABELLEN (tabellen:true / tabelle:"<id>" — 88 Tabellen als Zeilenlisten). Drei Betriebsarten: (1) suchbegriff: Volltextsuche im Seitentext UND im Katalog der Zeichnungen, Fundstellen mit Seitenzahl, Kontext und Hinweis auf Zeichnungen auf der Seite. (2) quelle + seite: ganze Seite als Text mit Katalogeintraegen; mit bild:true zusaetzlich das SEITENBILD (PNG) als Bildinhalt — fuer Koordinatensysteme, Schnittrichtungen, Radiuskorrektur, Winkel, Einbaulagen und Tabellen massgebend, weil der Text die Zeichnung nicht traegt. (3) abbildungen:true: Katalog aller Zeichnungen (Zeigt/Aussage/Stichworte, KI-gelesen, fachlich zu pruefen), optional nach suchbegriff/quelle/seite gefiltert.',
    inputSchema: {
      type: 'object',
      properties: {
        suchbegriff: { type: 'string', description: 'Gesuchter Begriff, z.B. "Nagelreihe", "Radiuskorrektur", "Index 25", "Bezugsebene"' },
        quelle: { type: 'string', enum: QUELLE_ENUM, description: baustein('toolSpezifikationQuelleParam') || 'Standard: beide (alle Quellen ohne Zusatzquellen); alle = alles' },
        kontext: { type: 'integer', description: 'Zeichen Kontext je Seite des Treffers (Standard 220)' },
        max_treffer: { type: 'integer', description: 'Hoechstens so viele Auszuege je Quelle (Standard 12)' },
        seite: { type: 'integer', description: 'Statt Suche: diese PDF-Seite der angegebenen Quelle komplett ausgeben (= gedruckte Seite)' },
        bild: { type: 'boolean', description: 'Nur mit seite: das Seitenbild (PNG, ~20-60 KB) als Bildinhalt mitliefern (Standard false)' },
        abbildungen: { type: 'boolean', description: 'Katalog der Zeichnungen ausgeben statt zu suchen (Standard false); mit quelle ' + oderListe(BILD_TABELLEN_QUELLEN.concat(['alle'])) + ' zusaetzlich die Einzelbilder' },
        einzelbild: { type: 'string', description: 'Kennung einer Bilddatei der 3.7 oder der SiteBroker-Dokumente (z.B. "page_010_img_028", "tongue_groove_index_5_4_1", "sitebroker_einsatzformen") — liefert das Bild mit Beschreibung' },
        tabellen: { type: 'boolean', description: 'Strukturierte Tabellen der 3.7 und der SiteBroker-Dokumente auflisten; mit suchbegriff, quelle oder seite gefiltert (Standard false)' },
        tabelle: { type: 'string', description: 'Kennung einer Tabelle (z.B. "v37-T42" Materialindex, "v37-T25" Bauteilbearbeitungen, "sbi-T04" OrderStatus) — liefert sie vollstaendig als Zeilenliste' },
      },
    }, annotations: NUR_LESEN,
  },
  {
    name: 'wupworks_befehl', title: 'WupWorks5-Upload-Befehl',
    description: 'Erzeugt den curl-Befehl fuer den WUP-Upload an WupWorks5 (Weinmann-Maschinensoftware, POST /api/1/documents). Sendet selbst NICHTS. Adresse (Hostname/IP) und Port (1-65535) werden validiert; der Dateipfad wird absolut und in Anfuehrungszeichen eingesetzt.',
    inputSchema: {
      type: 'object',
      properties: {
        pfad: DATEI_EINGABE.pfad,
        adresse: { type: 'string', description: 'IP/Hostname der Maschine (Pflicht)' },
        port: { type: 'integer', description: 'Port (Standard 45070)' },
      },
      required: ['adresse'],
    }, annotations: NUR_LESEN,
  },
  {
    name: 'wup_server_status', title: 'Selbsttest des Servers',
    description: 'Selbsttest: Server- und Editor-Version, live gelesene Pruefregeln, Harness-Waechter (benoetigte Editor-Funktionen, genau ein <script>-Block), Ressourcen, Referenzdateien, PDF-Textebenen; mit roundtrip:true zusaetzlich der komplette Roundtrip ueber alle Referenzdateien (Zeilen muessen 0 Abweichungen liefern; Byte-Abweichungen werden benannt).',
    inputSchema: { type: 'object', properties: { roundtrip: { type: 'boolean', description: 'Roundtrip ueber alle Referenzdateien mitlaufen lassen (Standard false)' } } },
    annotations: NUR_LESEN,
  },
];

/* =====================================================================
   Tool-Ausfuehrung
   ===================================================================== */

function toolAusfuehren(name, args) {
  args = args || {};
  switch (name) {
    case 'wup_datei_analysieren':
      return uebersichtErzeugen(wupKontext(args));
    case 'wup_pruefen': {
      const ctx = wupKontext(args);
      const maxEintraege = args.max_eintraege == null ? 500 : ganzzahl(args.max_eintraege, 'max_eintraege', 1, 100000);
      return { datei: ctx.__name, plausibilitaet: ausKontext(ctx, PLAUSIBILITAET_AUSDRUCK),
        pruefungen: pruefungenErzeugen(ctx, { level: args.level, codes: args.codes, maxEintraege }),
        meldungen: meldungen(ctx), kontext: kontextInfo() };
    }
    case 'wup_roundtrip_pruefen': {
      const ctx = wupKontext(args);
      return Object.assign({ datei: ctx.__name }, roundtripPruefen(ctx), { kontext: kontextInfo() });
    }
    case 'wup_ordner_pruefen':
      return ordnerPruefen(args);
    case 'wup_automatik': {
      if (!Array.isArray(args.aktionen) || !args.aktionen.length)
        throw new Error("Parameter 'aktionen' (Array) fehlt — z.B. [\"auto_psf\"]. Erlaubt: " + Object.keys(AUTOMATIK_SKRIPTE).join(', '));
      const ctx = wupKontext(args);
      return Object.assign({ datei: ctx.__name }, automatikAusfuehren(ctx, args));
    }
    case 'wup_werte_ersetzen': {
      const ctx = wupKontext(args);
      return Object.assign({ datei: ctx.__name }, werteErsetzenAusfuehren(ctx, args));
    }
    case 'wup_steuercode':
      return steuercodeAusfuehren(args);
    case 'wup_referenz':
      return referenzErzeugen(args.thema || 'alle');
    case 'wup_spezifikation':
      return spezifikationSuchen(args);
    case 'wupworks_befehl':
      return wupworksBefehl(args);
    case 'wup_server_status':
      return serverStatus(args);
    default:
      throw new Error('Unbekanntes Tool: ' + name + '. Verfuegbar: ' + TOOLS.map(t => t.name).join(', '));
  }
}

/* =====================================================================
   MCP/JSON-RPC-Transport (stdio, eine Nachricht pro Zeile)
   ===================================================================== */

function senden(obj) {
  process.stdout.write(JSON.stringify(obj) + '\n');
}

/* Eine Nachricht beantworten; sendeFn erlaubt das Sammeln fuer Batches */
function anfrageBehandeln(msg, sendeFn) {
  const antwort = (id, result) => sendeFn({ jsonrpc: '2.0', id, result });
  const fehlerAntwort = (id, code, message) => sendeFn({ jsonrpc: '2.0', id, error: { code, message } });
  if (!msg || typeof msg !== 'object' || Array.isArray(msg)) {
    fehlerAntwort(null, -32600, 'Ungueltige Anfrage: JSON-RPC-Nachricht muss ein Objekt sein.');
    return;
  }
  const { id, method, params } = msg;
  const istAnfrage = id !== undefined && id !== null;
  if (typeof method !== 'string') {
    if (istAnfrage) fehlerAntwort(id, -32600, "Ungueltige Anfrage: 'method' fehlt.");
    return;
  }
  try {
    switch (method) {
      case 'initialize': {
        const gewuenscht = params && params.protocolVersion;
        antwort(id, {
          protocolVersion: PROTOKOLL_VERSIONEN.includes(gewuenscht) ? gewuenscht : PROTOKOLL_VERSIONEN[0],
          capabilities: { tools: {}, resources: {} },
          serverInfo: { name: SERVER_NAME, title: KONFIG.servertitel || 'WUP-Werkzeuge', version: SERVER_VERSION },
          instructions: 'WUP-Fachlogik des ' + (KONFIG.editorName || 'WUP-Editors') + ' v' + editorVersion() + ' (headless, eine Quelle der Wahrheit): '
            + 'Dateien analysieren/pruefen (' + pruefregelnSpanne() + ' live)/automatisch nachbearbeiten, Werte ersetzen, '
            + 'Ordner im Stapel pruefen, Steuercodes dekodieren, Format-Referenz abrufen und in den Weinmann-Original-PDFs '
            + 'nachschlagen (' + (baustein('instructionsQuellen') || 'wup_spezifikation') + '). ' + baustein('instructionsAnlage')
            + 'wup_datei_analysieren nennt je Datei abgekuendigte und in 3.7 entfernte Keywords (versionslage). Fachliche Primaerquellen liegen als Ressourcen bei '
            + '(wup-editor-spec-v2.md ist massgebend). Rechnet mit ' + profilHinweis() + '. Schreibt nur mit ziel_pfad '
            + '(.wup, ausserhalb der Referenz-/Werkzeugordner, nur ohne offene FEHLER-Befunde oder mit trotz_fehler), '
            + 'sendet nichts ins Netz, maskiert personenbezogene Kopf-/TXT-Felder. Ein laufender Server sieht '
            + 'Editor-Aenderungen erst nach Neustart. Offene Fachfragen: wup_referenz thema=offen — nicht raten.',
        });
        return;
      }
      case 'ping': { if (istAnfrage) antwort(id, {}); return; }
      case 'tools/list': { antwort(id, { tools: TOOLS }); return; }
      case 'tools/call': {
        const name = params && params.name;
        if (typeof name !== 'string' || !name) { fehlerAntwort(id, -32602, "Ungueltige Parameter: 'name' des Tools fehlt."); return; }
        try {
          const ergebnis = toolAusfuehren(name, params && params.arguments);
          /* _bilder: Bildinhalte (z.B. Seitenbild) kommen als eigene content-Bloecke,
             nicht in den Text und nicht in structuredContent */
          let bilder = [];
          if (ergebnis && typeof ergebnis === 'object' && Array.isArray(ergebnis._bilder)) { bilder = ergebnis._bilder; delete ergebnis._bilder; }
          const text = typeof ergebnis === 'string' ? ergebnis : JSON.stringify(ergebnis, null, 2);
          const result = { content: [{ type: 'text', text }], isError: false };
          for (const b of bilder) result.content.push({ type: 'image', data: b.data, mimeType: b.mimeType });
          if (ergebnis && typeof ergebnis === 'object' && !Array.isArray(ergebnis)) result.structuredContent = ergebnis;
          antwort(id, result);
        } catch (e) {
          antwort(id, { content: [{ type: 'text', text: 'Fehler: ' + e.message }], isError: true });
        }
        return;
      }
      case 'resources/list': {
        antwort(id, {
          resources: RESSOURCEN.map(r => ({
            uri: dokuUri(r.rel), name: r.name, description: r.beschreibung, mimeType: mimeTyp(r.rel),
          })).concat(bildRessourcen().map(r => ({ uri: r.uri, name: r.name, description: r.description, mimeType: r.mimeType }))),
        });
        return;
      }
      case 'resources/read': {
        const uri = params && params.uri;
        if (typeof uri !== 'string') { fehlerAntwort(id, -32602, "Ungueltige Parameter: 'uri' fehlt."); return; }
        const eintrag = RESSOURCEN.find(r => dokuUri(r.rel) === uri || 'wup-doku://' + r.rel === uri);
        if (eintrag) {
          const inhalt = fs.readFileSync(path.join(REPO_ROOT, eintrag.rel), 'utf8');
          antwort(id, { contents: [{ uri, mimeType: mimeTyp(eintrag.rel), text: inhalt }] });
          return;
        }
        const bild = bildRessourcen().find(r => r.uri === uri);
        if (bild && bild.einzelbild) {
          const b = einzelbildLesen(einzelbilderLaden().find(e => e.kennung === bild.einzelbild));
          antwort(id, { contents: [{ uri, mimeType: b.mimeType, blob: b.data }] });
          return;
        }
        if (bild) {
          const b = seitenbildLesen(pdfQuelleLaden(bild.quelle), bild.seite);
          antwort(id, { contents: [{ uri, mimeType: 'image/png', blob: b.data }] });
          return;
        }
        fehlerAntwort(id, -32002, 'Unbekannte Ressource: ' + uri);
        return;
      }
      /* Tolerant fuer Clients, die trotz fehlender Capability anfragen: */
      case 'prompts/list': { antwort(id, { prompts: [] }); return; }
      case 'resources/templates/list': { antwort(id, { resourceTemplates: [] }); return; }
      default:
        if (istAnfrage) fehlerAntwort(id, -32601, 'Methode nicht unterstuetzt: ' + method);
        /* Notifications (z.B. notifications/initialized) still ignorieren */
        return;
    }
  } catch (e) {
    if (istAnfrage) fehlerAntwort(id, -32603, 'Interner Fehler: ' + e.message);
  }
}

/* Eine Zeile: Objekt oder (tolerant) Batch-Array */
function zeileVerarbeiten(zeile) {
  let msg;
  try { msg = JSON.parse(zeile); }
  catch { senden({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Ungueltiges JSON' } }); return; }
  if (Array.isArray(msg)) {
    if (!msg.length) { senden({ jsonrpc: '2.0', id: null, error: { code: -32600, message: 'Leerer Batch' } }); return; }
    const gesammelt = [];
    for (const einzel of msg) anfrageBehandeln(einzel, (a) => gesammelt.push(a));
    if (gesammelt.length) senden(gesammelt);
    return;
  }
  anfrageBehandeln(msg, senden);
}

function hauptschleife() {
  /* Ein unerwarteter Fehler darf den Server nicht still beenden — melden
     (stderr ist der einzige Kanal, der den JSON-RPC-Strom nicht stoert). */
  process.on('uncaughtException', (e) => { process.stderr.write('wup-mcp: unerwarteter Fehler: ' + (e && e.stack || e) + '\n'); });
  process.stdout.on('error', (e) => { if (e && e.code === 'EPIPE') process.exit(0); });
  let puffer = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (teil) => {
    puffer += teil;
    let nl;
    while ((nl = puffer.indexOf('\n')) >= 0) {
      const zeile = puffer.slice(0, nl).trim();
      puffer = puffer.slice(nl + 1);
      if (!zeile) continue;
      zeileVerarbeiten(zeile);
    }
  });
  process.stdin.on('end', () => {
    if (puffer.trim()) zeileVerarbeiten(puffer.trim());
    /* NICHT sofort process.exit(): stdout ist als Pipe auf POSIX asynchron,
       und process.exit() verwirft alles, was noch in der Warteschlange
       steht. Wenn ein Client mehrere Anfragen in einem Rutsch sendet und
       stdin schliesst, laeuft die Ereignisschleife zwischen den Antworten
       gar nicht — dann geht die GANZE Ausgabe verloren, nicht nur der Rest
       einer grossen Antwort (reproduziert: 16 Anfragen, 0 Antworten).
       Der write-Rueckruf feuert erst, wenn die Daten an das Betriebssystem
       uebergeben sind. Abgesichert durch Wup/Tests/mcp_ausgabe_smoke.js. */
    process.stdout.write('', () => process.exit(0));
  });
}

if (require.main === module) hauptschleife();
module.exports = { toolAusfuehren, TOOLS, pruefregelnAusEditor, editorVersion, zeileMaskieren, AUTOMATIK_SKRIPTE, RESSOURCEN, WUP_KEYWORD_STAND, PDF_QUELLEN,
  abbildungenLaden, pdfQuelleLaden, bildRessourcen, KONFIG, profilStand, anfrageBehandeln };
