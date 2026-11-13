/*
  WUP-PDF-Textebene 1.0
  Liest die Textebene von PDF-Dokumenten ohne Fremdpakete (zlib + 
  PDF-Textoperatoren). Grundlage fuer das Werkzeug wup_spezifikation.

  Copyright (C) 2026 Lars Ojus
  Lizenz: GNU General Public License v3.0 (GPL-3.0-only) — siehe LICENSE im Repository.
  OHNE JEDE GEWAEHRLEISTUNG / ABSOLUTELY NO WARRANTY.
  Kein Produkt von WEINMANN/HOMAG. Geschrieben mit Claude (Anthropic).
*/
'use strict';
const fs = require('fs');
const zlib = require('zlib');

/* PDF-Literalstring "(…)" -> Text; Escapes \n \r \t \( \) \\ und oktal */
function literalDekodieren(lit) {
  let out = '';
  for (let i = 0; i < lit.length; i++) {
    const c = lit[i];
    if (c !== '\\') { out += c; continue; }
    const n = lit[++i];
    if (n === 'n') out += '\n';
    else if (n === 'r') out += '';
    else if (n === 't') out += ' ';
    else if (/[0-7]/.test(n)) {
      let okt = n;
      while (okt.length < 3 && /[0-7]/.test(lit[i + 1])) okt += lit[++i];
      out += String.fromCharCode(parseInt(okt, 8));
    } else out += n;
  }
  return out;
}

/* Text aus einem entpackten Inhaltsstrom: Strings in Reihenfolge der
   Zeichenoperatoren; Zeilenumbruch bei Textpositionierung (Td, TD, T-Stern, Tm, ET),
   Leerzeichen bei groesserem negativem TJ-Versatz (Wortabstand). */
function inhaltsstromText(strom) {
  let text = '';
  const tok = /\((?:[^()\\]|\\.)*\)|\[(?:[^\]]|\\\])*\]\s*TJ|<[0-9A-Fa-f]*>\s*Tj|-?\d+(?:\.\d+)?|[A-Za-z*'"]+/g;
  const stapel = [];
  let t, hexStrings = 0;
  while ((t = tok.exec(strom))) {
    const v = t[0];
    if (v[0] === '(') { stapel.push(v); continue; }
    if (v[0] === '<') { hexStrings++; continue; }            /* CID-Text: nicht lesbar */
    if (/\]\s*TJ$/.test(v)) {
      const innen = v.slice(1, v.lastIndexOf(']'));
      const teile = innen.match(/\((?:[^()\\]|\\.)*\)|-?\d+(?:\.\d+)?/g) || [];
      for (const p of teile) {
        if (p[0] === '(') text += literalDekodieren(p.slice(1, -1));
        else if (parseFloat(p) < -200) text += ' ';
      }
      continue;
    }
    if (v === 'Tj' || v === "'" || v === '"') {
      const lit = stapel.pop();
      if (lit) text += literalDekodieren(lit.slice(1, -1));
      if (v !== 'Tj') text += '\n';
      continue;
    }
    if (v === 'Td' || v === 'TD' || v === 'T*' || v === 'Tm' || v === 'ET') {
      if (!text.endsWith('\n')) text += '\n';
    }
    if (/^-?\d/.test(v)) continue;
    stapel.length = 0;
  }
  return { text, hexStrings };
}

/* Liest alle FlateDecode-Inhaltsstroeme mit Textoperatoren.
   Rueckgabe: { seiten: [String], stroeme, nichtLesbar, inflateFehler } */
function pdfTextLesen(pfad) {
  const puffer = fs.readFileSync(pfad);
  const s = puffer.toString('latin1');
  const seiten = [];
  let stroeme = 0, inflateFehler = 0, nichtLesbar = 0;
  const re = /stream\r?\n/g;
  let m;
  while ((m = re.exec(s))) {
    stroeme++;
    const start = m.index + m[0].length;
    const ende = s.indexOf('endstream', start);
    if (ende < 0) break;
    const dictStart = s.lastIndexOf('<<', m.index);
    const dict = s.slice(dictStart, m.index);
    if (!/FlateDecode/.test(dict)) continue;
    let roh;
    try { roh = zlib.inflateSync(puffer.subarray(start, ende)).toString('latin1'); }
    catch (e) { inflateFehler++; continue; }
    if (!/\bTj\b|\bTJ\b/.test(roh)) continue;
    const { text, hexStrings } = inhaltsstromText(roh);
    if (hexStrings) nichtLesbar++;
    seiten.push(text);
  }
  return { seiten, stroeme, inflateFehler, nichtLesbar };
}

/* Leerraum normalisieren (fuer Suche und Anzeige) */
function normalisieren(text) {
  return text.replace(/[ \t ]+/g, ' ').replace(/ ?\n ?/g, '\n').replace(/\n{2,}/g, '\n').trim();
}

/* Suche: alle Fundstellen eines Begriffs (Gross/Klein egal, Leerraum
   tolerant — "Sägeblatt" findet auch "S ägeblatt") mit Kontext je Seite. */
function suchen(seiten, begriff, optionen) {
  const o = Object.assign({ kontext: 220, maxTreffer: 12, seitenVon: 1 }, optionen || {});
  const muster = new RegExp(begriff.trim().split(/\s+/).map(w =>
    w.split('').map(z => z.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join(' ?')).join('\\s+'), 'gi');
  const treffer = [];
  let gesamt = 0;
  for (let i = o.seitenVon - 1; i < seiten.length; i++) {
    const seite = normalisieren(seiten[i]);
    let m;
    muster.lastIndex = 0;
    while ((m = muster.exec(seite))) {
      gesamt++;
      if (treffer.length < o.maxTreffer) {
        const von = Math.max(0, m.index - o.kontext), bis = Math.min(seite.length, m.index + m[0].length + o.kontext);
        treffer.push({ seite: i + 1, auszug: (von > 0 ? '…' : '') + seite.slice(von, bis).replace(/\n/g, ' ') + (bis < seite.length ? '…' : '') });
      }
      if (m[0].length === 0) muster.lastIndex++;
    }
  }
  return { gesamt, treffer };
}

module.exports = { pdfTextLesen, suchen, normalisieren, inhaltsstromText, literalDekodieren };
