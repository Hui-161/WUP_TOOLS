/* Gemeinsames Test-Geruest: laedt das Editor-Script aus wup_editor.html in
   einen Node-vm-Kontext mit minimalen DOM-Stubs. Wird von roundtrip.js und
   den Smoke-Tests verwendet. */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const htmlPfad = path.join(__dirname, '..', 'wup_editor', 'wup_editor.html');

/* REFERENZDATEIEN
   Die synthetischen Dateien (frei erfunden, aus erzeugen.js) liegen immer bei.
   Ein zweiter, interner Ordner mit weiteren Referenzdateien wird zusaetzlich
   durchlaufen, WENN es ihn gibt — fehlt er, laufen die Tests allein mit den
   synthetischen Dateien. Die folgende Zeile wird beim Export in den
   oeffentlichen Stand per Regel ersetzt; nicht umformulieren. */
const SYNTHETISCHER_ORDNER = path.join(__dirname, '..', '03_Beispiel-synthetisch');
const INTERNER_REFERENZ_ORDNER = null;

function stubElement() {
  const el = {};
  const handler = {
    get(ziel, prop) {
      if (prop === 'style' || prop === 'classList' || prop === 'dataset') return proxy;
      /* document.readyState = 'loading' -> der neue Start-Guard im Editor
         (readyState==='loading' ? DOMContentLoaded : init()) waehlt den
         DOMContentLoaded-Pfad; das Event feuert im Harness nie, init() laeuft
         also nicht automatisch (gewuenscht: nur die Funktionen laden). */
      if (prop === 'readyState') return 'loading';
      /* Navigations-Eigenschaften: gleiche Proxy zurueckgeben (statt einer Funktion),
         damit z.B. `el.firstElementChild.style.height = ...` nicht auf einer
         Funktion landet — wird von der vollen alleNeuRendern()-Rendering-Kette
         (Text-/Baum-/Fehlerlog-Panels) beim Headless-Testen angefasst. */
      if (prop === 'firstElementChild' || prop === 'lastElementChild' || prop === 'parentNode'
          || prop === 'parentElement' || prop === 'nextElementSibling' || prop === 'previousElementSibling'
          || prop === 'firstChild' || prop === 'lastChild'
          || prop === 'body' || prop === 'documentElement' || prop === 'head') return proxy;
      if (prop === 'children') return [];
      if (prop in ziel) return ziel[prop];
      return (...args) => {
        if (prop === 'querySelector' || prop === 'getElementById' ||
            prop === 'createElement' || prop === 'appendChild' ||
            prop === 'closest') return proxy;
        if (prop === 'querySelectorAll' || prop === 'getElementsByClassName') return [];
        if (prop === 'getBoundingClientRect') return { left: 0, top: 0, width: 1280, height: 800 };
        if (prop === 'add' || prop === 'remove' || prop === 'toggle' || prop === 'contains') return false;
        return undefined;
      };
    },
    set(ziel, prop, wert) { ziel[prop] = wert; return true; },
  };
  const proxy = new Proxy(el, handler);
  return proxy;
}

function kontextErzeugen() {
  const speicher = {
    _d: {},
    getItem(k) { return k in this._d ? this._d[k] : null; },
    setItem(k, v) { this._d[k] = String(v); },
    removeItem(k) { delete this._d[k]; },
  };
  const ctx = {
    document: stubElement(),
    localStorage: speicher,
    navigator: { platform: 'test' },
    requestAnimationFrame: (fn) => { fn(); return 0; },
    cancelAnimationFrame: () => {},
    setTimeout, clearTimeout, setInterval, clearInterval,
    console,
    TextDecoder, TextEncoder, structuredClone,
    Blob: class { constructor(teile) { this.teile = teile; } },
    URL: { createObjectURL: () => 'blob:test', revokeObjectURL: () => {} },
    alert: () => {}, confirm: () => true,
    performance: { now: () => Date.now() },
    matchMedia: () => ({ matches: false, addEventListener: () => {} }),
    getComputedStyle: () => ({ getPropertyValue: () => '' }),
    /* window.addEventListener/postMessage: der Editor lauscht seit dem
       Oversight-Uebergabe-Kanal 2 (postMessage) global auf 'message' und meldet
       sich ggf. beim opener - im Headless-Test gibt es weder ein Opener-Fenster
       noch echte Nachrichten, daher genuegen No-op-Stubs. */
    addEventListener: () => {},
    removeEventListener: () => {},
    postMessage: () => {},
    opener: null,
  };
  ctx.window = ctx;
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  return ctx;
}

let _script = null;
function editorScriptLaden() {
  if (_script) return _script;
  const html = fs.readFileSync(htmlPfad, 'utf8');
  const m = html.match(/<script>([\s\S]*)<\/script>/);
  if (!m) throw new Error('Kein <script>-Block in wup_editor.html gefunden');
  _script = m[1];
  return _script;
}

/* Frischer Kontext mit geladenem Editor-Script */
function editorKontext(optionen) {
  const ctx = kontextErzeugen();
  vm.runInContext(editorScriptLaden(), ctx, { filename: 'wup_editor.html#script' });
  /* v2.62: Die Tests rechnen mit einer eingerichteten Anlage. Traegt das
     Standardprofil keine Geraetebelegung (oeffentlicher Stand: dort wird sie
     beim ersten Start abgefragt), gilt hier die Beispielbelegung.
     { ohneGeraete: true } laesst das Profil, wie es ist. Der MCP-Server laedt
     das Script selbst und ist davon NICHT betroffen. */
  if (!(optionen && optionen.ohneGeraete))
    vm.runInContext(`if (!Object.keys(profil.nr_indizes || {}).length)
      profil.nr_indizes = JSON.parse(JSON.stringify(NR_INDIZES_BEISPIEL));`, ctx);
  return ctx;
}

/* WUP-Text (LF oder CRLF) im Kontext parsen und als modell setzen */
function wupLaden(ctx, text, name) {
  ctx.__text = text;
  ctx.__name = name || 'test.wup';
  return vm.runInContext(
    `modell = wupParsen(__text, __name, 'windows-1252', false); modell`, ctx);
}

/* Ordner mit Referenzdateien: immer der synthetische, dazu der interne,
   wenn vorhanden. */
function referenzOrdner() {
  const ordner = [SYNTHETISCHER_ORDNER];
  if (INTERNER_REFERENZ_ORDNER && fs.existsSync(INTERNER_REFERENZ_ORDNER)) ordner.push(INTERNER_REFERENZ_ORDNER);
  return ordner;
}

/* Alle .wup-Dateien aller Referenzordner (rekursiv, sortiert):
   [{ pfad, name }] — name = Pfad ab dem Referenzordner, fuer Meldungen. */
function referenzDateien() {
  const suchen = ordner => {
    const gefunden = [];
    for (const eintrag of fs.readdirSync(ordner, { withFileTypes: true })) {
      const p = path.join(ordner, eintrag.name);
      if (eintrag.isDirectory()) gefunden.push(...suchen(p));
      else if (/\.wup$/i.test(eintrag.name)) gefunden.push(p);
    }
    return gefunden.sort();
  };
  const dateien = [];
  for (const ordner of referenzOrdner())
    for (const pfad of suchen(ordner))
      dateien.push({ pfad, name: path.join(path.basename(ordner), path.relative(ordner, pfad)) });
  return dateien;
}

/* Pfad einer synthetischen Referenzdatei, z. B. synthetischeDatei('SEMA', 'IW02.WUP') */
function synthetischeDatei(...teile) {
  return path.join(SYNTHETISCHER_ORDNER, ...teile);
}

module.exports = { kontextErzeugen, editorScriptLaden, editorKontext, wupLaden, vm,
  referenzOrdner, referenzDateien, synthetischeDatei, SYNTHETISCHER_ORDNER };
