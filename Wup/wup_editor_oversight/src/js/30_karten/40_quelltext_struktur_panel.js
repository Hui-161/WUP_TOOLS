/* =====================================================================
   §6b ARBEITSPAKET 3 — QUELLTEXT/STRUKTUR DER AUSGEWAEHLTEN WAND
   zeileFaerben()/steuercodeHtml() + die Konstanten sind 1:1 aus
   wup_editor.html portiert (dort: "function zeileFaerben"/"function
   steuercodeHtml"). Diese Datei bringt fuer die reine Anzeige keine eigene
   Parser-Logik mit, nur diese kleine Text-Einfaerbung fuer den Quelltext-Tab.
   ===================================================================== */
const KW_BAUTEIL = ['OG','UG','LS','QS','BT4','BT6','BTN','EBT'];
const KW_BAUTEIL_BEARB = ['SG','SZ','KN','MPL','PZF','BOZ','BOY','BOX','FRZ','FRY','KER','REFKER','NC'];
const KW_POLY = ['PP','KB','MP','TA'];
const RE_PLATTE = /^(PLI|PLA|SLI|SLA)(\d+)$/;

function steuercodeHtml(wert) {
  const s = String(wert).trim();
  if (!/^\d{1,4}$/.test(s)) return escapeHtml(s);
  const pad = s.padStart(4, '0');
  let html = '';
  const klassen = ['sc-t','sc-h','sc-z','sc-e'];
  let begonnen = false;
  for (let i = 0; i < 4; i++) {
    const c = pad[i];
    if (c === '0' && !begonnen && i < 4 - s.length) continue;
    begonnen = true;
    html += '<span class="' + klassen[i] + '">' + c + '</span>';
  }
  return html || '<span class="sc-e">0</span>';
}
function zeileFaerben(roh) {
  const m = roh.match(/^(\s*)([A-Za-z][A-Za-z0-9_]*)(\s*)(.*)$/);
  if (!m) return escapeHtml(roh);
  const [, fuehrend, kwRoh, abstand, rest] = m;
  const kw = kwRoh.toUpperCase();
  let kwKlasse = '';
  if (kw === 'PSG') kwKlasse = 'kw-psg';
  else if (kw === 'PAF' || kw === 'PML') kwKlasse = 'kw-paf';
  else if (kw === 'PSF') kwKlasse = 'kw-psf';
  else if (kw === 'PSZ') kwKlasse = 'kw-psz';
  else if (kw === 'NR' || kw === 'NBR') kwKlasse = 'kw-nr';
  else if (KW_POLY.includes(kw)) kwKlasse = 'kw-poly';
  else if (RE_PLATTE.test(kw)) kwKlasse = 'kw-platte';
  else if (KW_BAUTEIL.includes(kw) || kw === 'BTN' || KW_BAUTEIL_BEARB.includes(kw)) kwKlasse = 'kw-bauteil';
  else if (kw === 'TXT') return '<span class="zl-txt">' + escapeHtml(roh) + '</span>';
  else kwKlasse = 'kw-kopf';

  let html = escapeHtml(fuehrend) + '<span class="' + kwKlasse + '">' + escapeHtml(kwRoh) + '</span>' + escapeHtml(abstand);

  const semIdx = rest.indexOf(';');
  const params = (semIdx >= 0 ? rest.slice(0, semIdx) : rest).split(',');
  const danach = semIdx >= 0 ? rest.slice(semIdx) : '';
  const paramKlassen = {
    PP:  ['p-x','p-y','p-z','sc','p-a','p-z'],
    KB:  ['p-x','p-y','p-t','','p-z','sc','p-a','p-z'],
    MP:  ['p-x','p-y','p-t','p-z','sc','p-z'],
    NR:  ['p-x','p-y','p-x','p-y','p-t','sc'],
    NBR: ['p-x','p-y','sc'],
    ELM: ['p-x','p-y','p-z','','p-x','p-y']
  };
  const plMatch = kw.match(RE_PLATTE);
  let klassen = paramKlassen[kw];
  if (plMatch) klassen = ['p-x','p-y','p-z','p-x','p-y','p-mat','p-mat','p-z'];
  if (KW_BAUTEIL.includes(kw)) klassen = ['p-x','p-y','p-z','p-x','p-y','p-mat','p-mat','p-z'];
  const gefaerbt = params.map((p, i) => {
    const klasse = klassen ? klassen[i] : '';
    if (klasse === 'sc') return steuercodeHtml(p);
    if (klasse) return '<span class="' + klasse + '">' + escapeHtml(p) + '</span>';
    return escapeHtml(p);
  });
  html += gefaerbt.join(',') + escapeHtml(danach);
  return html;
}

const QUELLTEXT_ZEILEN_KAPPUNG = 20000;   /* v1: kein virtuelles Rendern noetig (Spec Arbeitspaket 3) */

/* Ermittelt die aktuell im Panel zu zeigende Karte: der Auswahl-Anker, falls
   noch gueltig, sonst das erste Element der Mehrfachauswahl, sonst nichts. */
function panelDatei() {
  const kandidaten = [auswahlAnker, ...auswahl].filter(Boolean);
  for (const schluessel of kandidaten) {
    if (!auswahl.has(schluessel)) continue;
    const [di, wi] = schluessel.split(':').map(Number);
    const d = dateien[di];
    if (d && d.waende[wi]) return { d, di, wand: d.waende[wi] };
  }
  return null;
}

function quelltextRendern(d) {
  const el = document.getElementById('quelltextInhalt');
  const zeilenRoh = d.text.split(/\r\n|\r|\n/);
  const gekappt = zeilenRoh.length > QUELLTEXT_ZEILEN_KAPPUNG;
  const zeilen = gekappt ? zeilenRoh.slice(0, QUELLTEXT_ZEILEN_KAPPUNG) : zeilenRoh;
  const breite = String(zeilen.length).length;
  el.innerHTML = zeilen.map((z, i) =>
    '<div class="code-zeile"><span class="zeilen-nr">' + String(i + 1).padStart(breite, ' ') + '</span>'
    + zeileFaerben(z) + '</div>').join('')
    + (gekappt ? '<div class="mini-hinweis" style="padding:6px 8px">… gekappt bei '
      + QUELLTEXT_ZEILEN_KAPPUNG + ' von ' + zeilenRoh.length + ' Zeilen.</div>' : '');
}

/* Einfacher Struktur-Baum aus _vorschau (Kern-Modell-Klon, siehe
   dateiAktualisieren): je Lage (Id, Plattenzahl) aufklappbar die Ops
   (kw + id + Punktzahl), dazu eine Bauteile-Gruppe. Nur Anzeige, kein Edit
   (Spec Arbeitspaket 3, v1). */
function strukturRendern(d) {
  const el = document.getElementById('strukturInhalt');
  const frei = d._vorschau;
  if (!frei) { el.innerHTML = '<div class="mini-hinweis" style="padding:8px">Keine Struktur verfügbar.</div>'; return; }
  const h = frei.header || {};
  const t = [];
  t.push('<div class="baum-wurzel"><b>' + escapeHtml(h.ELN || d.name) + '</b>'
    + (h.ZNR ? ' · ZNR ' + escapeHtml(h.ZNR) : '')
    + (frei.multiwand ? '<br>⚠ <b>Multiwand</b>' : '') + '</div>');
  if ((frei.beams || []).length) {
    const offen = !!strukturOffen.bauteile;
    t.push('<div class="baum-knoten"><div class="baum-kopf" data-struktur-klapp="bauteile">'
      + '<span data-pfeil>' + (offen ? '▾' : '▸') + '</span> Bauteile <span class="mini-hinweis">('
      + frei.beams.length + ')</span></div>'
      + '<div class="baum-kinder"' + (offen ? '' : ' style="display:none"') + '>'
      + frei.beams.map(b => '<div class="baum-blatt"><span class="baum-punkt" style="background:var(--svg-riegel)"></span>'
        + escapeHtml(b.kw || 'Bauteil') + ' ' + escapeHtml(b.name || b.id || '') + '</div>').join('')
      + '</div></div>');
  }
  for (const lage of frei.layers) {
    const offen = !!strukturOffen[lage.id];
    const kinder = lage.ops.map(op => {
      const punkte = (op.poly || []).length;
      return '<div class="baum-blatt"><span class="baum-punkt" style="background:'
        + (BEARBEITUNGS_FARBEN[op.kw] || 'var(--text-gedimmt)') + '"></span>'
        + escapeHtml(op.kw) + ' ' + escapeHtml(op.id || '') + ' <span class="mini-hinweis">' + punkte + ' Pkt</span></div>';
    }).join('');
    t.push('<div class="baum-knoten"><div class="baum-kopf" data-struktur-klapp="' + lage.id + '">'
      + '<span data-pfeil>' + (offen ? '▾' : '▸') + '</span> ' + escapeHtml(lage.id)
      + ' <span class="mini-hinweis">(' + lage.plates.length + ' Platte(n), ' + lage.ops.length + ' Op)</span></div>'
      + '<div class="baum-kinder"' + (offen ? '' : ' style="display:none"') + '>' + (kinder || '<div class="mini-hinweis" style="padding:2px 8px">Keine Bearbeitungen.</div>') + '</div></div>');
  }
  el.innerHTML = t.join('');
}
function strukturKlick(ev) {
  const kopf = ev.target.closest('[data-struktur-klapp]');
  if (!kopf) return;
  const id = kopf.dataset.strukturKlapp;
  strukturOffen[id] = !strukturOffen[id];
  const kinder = kopf.nextElementSibling;
  const zu = kinder.style.display === 'none';
  kinder.style.display = zu ? '' : 'none';
  kopf.querySelector('[data-pfeil]').textContent = zu ? '▾' : '▸';
}

/* Nur beim Auswahlwechsel gerufen (Performance-Hinweis Spec Arbeitspaket 3) -
   nicht bei jedem allgemeinen Re-Render. Solange das Panel eingeklappt ist
   (Standardzustand), wird das (potenziell teure) Faerben/Rendern gar nicht
   erst ausgefuehrt - es passiert beim naechsten Ausklappen. */
function quelltextStrukturAktualisieren() {
  const panel = document.getElementById('quelltextPanel');
  if (panel && panel.classList.contains('eingeklappt')) return;
  const info = document.getElementById('quelltextPanelInfo');
  const gefunden = panelDatei();
  if (!gefunden) {
    info.textContent = '';
    document.getElementById('quelltextInhalt').innerHTML = '<div class="mini-hinweis" style="padding:8px">Keine Karte ausgewählt.</div>';
    document.getElementById('strukturInhalt').innerHTML = '';
    return;
  }
  const { d, wand } = gefunden;
  info.textContent = wand.name + ' — ' + d.name;
  strukturOffen = {};
  quelltextRendern(d);
  strukturRendern(d);
}
function quelltextTabSetzen(tab) {
  quelltextTab = tab;
  document.querySelectorAll('#quelltextPanel .text-tab').forEach(t2 =>
    t2.classList.toggle('aktiv', t2.dataset.qtab === tab));
  document.getElementById('quelltextScroller').classList.toggle('versteckt', tab !== 'quelltext');
  document.getElementById('strukturScroller').classList.toggle('versteckt', tab !== 'struktur');
}
function quelltextPanelUmschalten(erzwingenOffen) {
  const offen = typeof erzwingenOffen === 'boolean' ? erzwingenOffen : document.getElementById('quelltextPanel').classList.contains('eingeklappt');
  document.getElementById('quelltextPanel').classList.toggle('eingeklappt', !offen);
  const btn = document.getElementById('btnQuelltextZu');
  btn.textContent = offen ? '⟨' : '⟩';
  btn.title = (offen ? 'Einklappen' : 'Ausklappen') + ' (Q)';
  if (offen) quelltextStrukturAktualisieren();
}

