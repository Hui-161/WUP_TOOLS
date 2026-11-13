/* =====================================================================
   §5 TEXT-PANEL — virtualisiert, Syntax-Faerbung, Klick-Sync
   ===================================================================== */
const textZustand = { zeilen: [], info: [], dirty: true, auswahlZeile: -1 };

function textZeilenAktualisieren() {
  if (!modell) { textZustand.zeilen = []; textZustand.info = []; return; }
  const irgendwasGeaendert = modell.layers.some(l => l._reihenfolgeGeaendert
    || (l._geloeschteOps && l._geloeschteOps.length)
    || l.plates.some(p => p._modified) || l.ops.some(o => o._modified || o._neu));
  if (irgendwasGeaendert) {
    const erg = exportZeilenErzeugen();
    textZustand.zeilen = erg.zeilen; textZustand.info = erg.info;
  } else {
    textZustand.zeilen = modell.rawLines;
    textZustand.info = modell.rawLines.map((_, i) => ({ quelle: 'orig', origZeile: i }));
  }
  document.getElementById('textPanelInfo').textContent = textZustand.zeilen.length + ' Zeilen';
}

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
  /* Feedback L (Anwenderwunsch): beim Hover ueber einen Wert die BEDEUTUNG
     anzeigen — Feldnamen je Schluesselwort, Steuercodes zusaetzlich in
     Worten (steuercodeWorte). */
  const PARAM_NAMEN = {
    PP:  ['x', 'y', 't — Tiefe', 'i — Steuercode', 'α — Neigungswinkel', 'z — Tiefe/Hoehe der Lage'],
    KB:  ['x', 'y', 'r — Radius', 'Typ (3=im/4=gegen Uhrzeigersinn)', 't — Tiefe', 'i — Steuercode', 'α — Neigungswinkel', 'z'],
    MP:  ['x', 'y', 'r — Radius (negativ = gegen Uhrzeigersinn)', 't — Tiefe', 'i — Steuercode', 'z'],
    NR:  ['xa — Anfang x', 'ya — Anfang y', 'xe — Ende x', 'ye — Ende y', 'a — Nagelabstand', 'i — Geraeteindex'],
    NBR: ['x — Versatz', 'y — Versatz', 'i — Geraeteindex'],
    ELM: ['lx — Laenge', 'by — Breite/Hoehe', 'hz — Dicke', 'Anzahl', 'x', 'y'],
    BOZ: ['x — Mittelpunkt', 'y — Mittelpunkt', 'd — Durchmesser', 't — Tiefe']
  };
  const PLATTEN_NAMEN = ['lx — Laenge', 'by — Breite', 'hz — Dicke', 'x — Position', 'y — Position',
    'i — Materialindex', 'Name', 'z — Tiefe/Hoehe'];
  const namen = PARAM_NAMEN[kw] || ((plMatch || KW_BAUTEIL.includes(kw)) ? PLATTEN_NAMEN : null);
  const gefaerbt = params.map((p, i) => {
    const klasse = klassen ? klassen[i] : '';
    let name = namen && namen[i] ? namen[i] : '';
    if (klasse === 'sc' && (kw === 'PP' || kw === 'KB' || kw === 'MP') && /^\s*\d+\s*$/.test(p))
      name += ': ' + steuercodeWorte(parseInt(p, 10), kw);
    const titel = name ? ' title="' + escapeHtml(kw + ' — ' + name) + '"' : '';
    if (klasse === 'sc') return '<span' + titel + '>' + steuercodeHtml(p) + '</span>';
    return '<span class="' + klasse + '"' + titel + '>' + escapeHtml(p) + '</span>';
  });
  html += gefaerbt.join(',') + escapeHtml(danach);
  return html;
}

const ZEILEN_HOEHE = 18;
function ausgewaehlteOrigBereiche() {
  /* Original-Zeilenbereiche aller ausgewaehlten Bearbeitungen (Anker + Mehrfachauswahl) */
  const bereiche = [];
  if (!modell || !ui.auswahl) return bereiche;
  const ids = [ui.auswahl.id, ...(ui.mehrAuswahl || [])];
  for (const id of ids) {
    const f = opFinden(id);
    if (f && f.op._lineStart >= 0) { bereiche.push([f.op._lineStart, f.op._lineEnd]); continue; }
    const p = platteFinden(id);
    if (p && p.platte._lineStart >= 0) { bereiche.push([p.platte._lineStart, p.platte._lineEnd]); continue; }
    const b = modell.beams.find(x => x.id === id);
    if (b && b._lineStart >= 0) bereiche.push([b._lineStart, b._lineEnd]);
  }
  return bereiche;
}
function ausgewaehlteBesitzerSchluessel() {
  /* Wie ausgewaehlteOrigBereiche, aber als Schluesselmenge fuer neu erzeugte/
     bearbeitete Zeilen ohne (unveraenderte) Original-Zeile — siehe besitzer
     in exportZeilenErzeugen(). */
  const set = new Set();
  if (!modell || !ui.auswahl) return set;
  for (const id of [ui.auswahl.id, ...(ui.mehrAuswahl || [])]) {
    if (opFinden(id)) set.add('op:' + id);
    else if (platteFinden(id)) set.add('platte:' + id);
  }
  return set;
}
function textPanelRendern() {
  const scroller = document.getElementById('textScroller');
  const inhalt = document.getElementById('textInhalt');
  if (!modell) { inhalt.innerHTML = ''; return; }
  if (textZustand.dirty) { textZeilenAktualisieren(); textZustand.dirty = false; }
  const gesamt = textZustand.zeilen.length;
  scroller.firstElementChild.style.height = (gesamt * ZEILEN_HOEHE) + 'px';
  const von = Math.max(0, Math.floor(scroller.scrollTop / ZEILEN_HOEHE) - 20);
  const bis = Math.min(gesamt, von + Math.ceil(scroller.clientHeight / ZEILEN_HOEHE) + 40);
  const bereiche = ausgewaehlteOrigBereiche();
  const besitzerSchluessel = ausgewaehlteBesitzerSchluessel();
  const istAusgewaehlt = z => {
    const info = textZustand.info[z];
    if (!info) return false;
    if (info.quelle === 'orig') return bereiche.some(([a, b]) => info.origZeile >= a && info.origZeile <= b);
    /* neu erzeugte/bearbeitete Zeile: ueber den mitgefuehrten Besitzer pruefen */
    return !!(info.besitzer && besitzerSchluessel.has(info.besitzer.typ + ':' + info.besitzer.id));
  };
  const teile = [];
  for (let z = von; z < bis; z++) {
    const info = textZustand.info[z] || {};
    const neuKlasse = info.quelle === 'neu' ? ' geaendert' : '';
    const selKlasse = (z === textZustand.auswahlZeile || istAusgewaehlt(z)) ? ' ausgewaehlt' : '';
    teile.push('<div class="code-zeile' + selKlasse + '" data-zeile="' + z + '" style="position:absolute;top:'
      + (z * ZEILEN_HOEHE) + 'px;left:0;right:0">'
      + '<span class="zeilen-nr' + neuKlasse + '">' + (z + 1) + '</span>'
      + '<span>' + zeileFaerben(textZustand.zeilen[z]) + '</span></div>');
  }
  inhalt.innerHTML = teile.join('');
}

function elementZuZeile(origZeile) {
  for (const lage of modell.layers) {
    for (const op of lage.ops)
      if (op._lineStart >= 0 && origZeile >= op._lineStart && origZeile <= op._lineEnd)
        return { typ: 'op', op, lage };
    for (const platte of lage.plates)
      if (origZeile >= platte._lineStart && origZeile <= platte._lineEnd)
        return { typ: 'platte', platte, lage };
  }
  for (const beam of modell.beams)
    if (origZeile >= beam._lineStart && origZeile <= beam._lineEnd)
      return { typ: 'beam', beam };
  return null;
}
function zeileZuElementSpringen(z, ev) {
  /* Feedback L: Strg+Klick = Bearbeitung zur Mehrfachauswahl umschalten,
     Shift+Klick = Bereich — wie im Canvas. */
  const strg = !!(ev && (ev.ctrlKey || ev.metaKey));
  const shift = !!(ev && ev.shiftKey);
  const opWaehlen = (op, lage) => {
    if (strg) { opAuswahlUmschalten(op.id, lage.id); textPanelRendern(); return; }
    if (shift) { opAuswahlBereich(op.id, lage.id); textPanelRendern(); return; }
    auswahlSetzen({ typ: 'op', id: op.id, lageId: lage.id });
  };
  textZustand.auswahlZeile = z;
  const info = textZustand.info[z];
  if (info && info.quelle === 'orig') {
    const ref = elementZuZeile(info.origZeile);
    if (ref) {
      if (ref.typ === 'op') opWaehlen(ref.op, ref.lage);
      else if (ref.typ === 'platte') auswahlSetzen({ typ: 'platte', id: ref.platte.id, lageId: ref.lage.id });
      else if (ref.typ === 'beam') auswahlSetzen({ typ: 'beam', id: ref.beam.id });
      return;
    }
  }
  if (info && info.quelle === 'neu' && info.besitzer) {
    /* neu erzeugte/bearbeitete Zeile ohne Original-Zeile — ueber den
       mitgefuehrten Besitzer zurueck zur Bearbeitung/Platte springen */
    if (info.besitzer.typ === 'op') {
      const f = opFinden(info.besitzer.id);
      if (f) { opWaehlen(f.op, f.lage); return; }
    } else if (info.besitzer.typ === 'platte') {
      const f = platteFinden(info.besitzer.id);
      if (f) { auswahlSetzen({ typ: 'platte', id: f.platte.id, lageId: f.lage.id }); return; }
    }
  }
  textPanelRendern();
}
function textZuElementScrollen() {
  if (!ui.auswahl) return;
  let zielOrig = -1;
  if (ui.auswahl.typ === 'op') {
    const f = opFinden(ui.auswahl.id);
    if (f && f.op._opLine != null && f.op._lineStart >= 0) zielOrig = f.op._opLine;
  } else if (ui.auswahl.typ === 'platte') {
    const f = platteFinden(ui.auswahl.id);
    if (f) zielOrig = f.platte._lineStart;
  } else if (ui.auswahl.typ === 'beam') {
    const b = modell.beams.find(x => x.id === ui.auswahl.id);
    if (b) zielOrig = b._lineStart;
  }
  let idx = zielOrig >= 0
    ? textZustand.info.findIndex(i => i.quelle === 'orig' && i.origZeile === zielOrig)
    : -1;
  if (idx < 0 && (ui.auswahl.typ === 'op' || ui.auswahl.typ === 'platte')) {
    /* Neu erzeugte oder bearbeitete Elemente haben keine (unveraenderte)
       Original-Zeile mehr — ueber den mitgefuehrten Besitzer der ersetzten/
       angehaengten Zeilen finden (siehe exportZeilenErzeugen). */
    idx = textZustand.info.findIndex(i =>
      i.besitzer && i.besitzer.typ === ui.auswahl.typ && i.besitzer.id === ui.auswahl.id);
  }
  if (idx < 0) return;
  textZustand.auswahlZeile = idx;
  const scroller = document.getElementById('textScroller');
  const ziel = idx * ZEILEN_HOEHE - scroller.clientHeight / 2;
  scroller.scrollTop = Math.max(0, ziel);
  textPanelRendern();
}

function opFinden(opId) {
  for (const lage of modell.layers) {
    const op = lage.ops.find(o => o.id === opId);
    if (op) return { op, lage };
  }
  return null;
}
function platteFinden(plattenId) {
  for (const lage of modell.layers) {
    const platte = lage.plates.find(p => p.id === plattenId);
    if (platte) return { platte, lage };
  }
  return null;
}

