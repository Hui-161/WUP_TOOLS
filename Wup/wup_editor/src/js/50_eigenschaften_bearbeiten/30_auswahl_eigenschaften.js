/* =====================================================================
   §10 AUSWAHL & EIGENSCHAFTEN-PANEL
   ===================================================================== */
function fmtZahl(v) {
  if (v == null || isNaN(v)) return '0';
  return Math.round(v * 1000) / 1000 + '';
}
function opFilterSicherstellen(kw) {
  /* Bug "neue Bearbeitungen unsichtbar": ausgeblendeter Filter-Chip war die haeufigste Ursache */
  if (ui.opFilter[kw] === false) {
    ui.opFilter[kw] = true;
    opFilterChipsRendern();
  }
}
function auswahlSetzen(sel) {
  ui.auswahl = sel;
  if (sel && sel.typ === 'op') {
    const f = opFinden(sel.id);
    if (f) opFilterSicherstellen(f.op.kw);
  }
  if (!sel) { ui.mehrAuswahl = []; ui.segMark = null; }
  if (!sel || sel.typ !== 'kante') ui.kanten = [];
  /* A-02: Lage des ausgewaehlten Elements sichtbar schalten (Auswahl aus Text/Baum/Log) */
  if (sel && sel.lageId && modell) {
    const lage = modell.layers.find(l => l.id === sel.lageId);
    if (lage && !lage.sichtbar) { lage.sichtbar = true; lagenListeRendern(); snapPunkteAufbauen(); }
  }
  svgRendern();
  eigenschaftenRendern();
  textZuElementScrollen();
  baumAuswahlMarkieren();
}
/* Flache, sichtbare Op-Liste in Render-/Lesereihenfolge — Basis fuer Shift-Bereich und Pfeiltasten */
function sichtbareOpsFlach() {
  if (!modell) return [];
  const liste = [];
  for (const lage of modell.layers.filter(lagenSichtbar))
    for (const op of lage.ops)
      if (ui.opFilter[op.kw] !== false) liste.push({ op, lage });
  return liste;
}
/* Strg/Cmd-Klick: einzelne Op zur Auswahl hinzufuegen/entfernen (Toggle) */
function opAuswahlUmschalten(opId, lageId) {
  if (ui.auswahl && ui.auswahl.typ === 'op' && ui.auswahl.id !== opId
      && !ui.mehrAuswahl.includes(ui.auswahl.id)) ui.mehrAuswahl.push(ui.auswahl.id);
  const idx = ui.mehrAuswahl.indexOf(opId);
  if (idx >= 0) ui.mehrAuswahl.splice(idx, 1);
  else if (!(ui.auswahl && ui.auswahl.typ === 'op' && ui.auswahl.id === opId))
    ui.mehrAuswahl.push(opId);
  if (!ui.auswahl || ui.auswahl.typ !== 'op')
    ui.auswahl = { typ: 'op', id: opId, lageId };
  opFilterSicherstellen((opFinden(opId) || {}).op ? opFinden(opId).op.kw : 'NR');
  svgRendern(); eigenschaftenRendern(); baumAuswahlMarkieren();
}
/* Shift-Klick: zusammenhaengenden Bereich vom Auswahlanker bis zum Ziel waehlen */
function opAuswahlBereich(opId, lageId) {
  const flach = sichtbareOpsFlach();
  const ankerId = ui.auswahl && ui.auswahl.typ === 'op' ? ui.auswahl.id : opId;
  const iAnker = flach.findIndex(e => e.op.id === ankerId);
  const iZiel = flach.findIndex(e => e.op.id === opId);
  if (iAnker < 0 || iZiel < 0) { auswahlSetzen({ typ: 'op', id: opId, lageId }); return; }
  const von = Math.min(iAnker, iZiel), bis = Math.max(iAnker, iZiel);
  const bereich = flach.slice(von, bis + 1);
  ui.auswahl = { typ: 'op', id: ankerId, lageId: (flach[iAnker].lage.id) };
  ui.mehrAuswahl = bereich.map(e => e.op.id).filter(id => id !== ankerId);
  svgRendern(); eigenschaftenRendern(); baumAuswahlMarkieren();
}
function auswahlAufloesen() {
  if (!ui.auswahl || !modell) return null;
  if (ui.auswahl.typ === 'op') return opFinden(ui.auswahl.id);
  if (ui.auswahl.typ === 'platte') return platteFinden(ui.auswahl.id);
  if (ui.auswahl.typ === 'beam') {
    const b = modell.beams.find(x => x.id === ui.auswahl.id);
    return b ? { beam: b } : null;
  }
  return null;
}

function scDropdown(feld, optionen, wert) {
  return '<label class="eig-feld"><span>' + feld.label + '</span>'
    + '<select class="eingabefeld eingabefeld-klein" data-sc="' + feld.key + '" style="width:auto;max-width:170px">'
    + optionen.map(o => '<option value="' + o.v + '"' + (o.v === wert ? ' selected' : '') + '>' + o.t + '</option>').join('')
    + '</select></label>';
}
function scMiniReihe(op, e, idx) {
  /* A-05/GUI-I: 4 Mini-Dropdowns Wz / ⊕⊖ / Korr / Lauf — als DETAIL-ZEILE
     unter dem MARKIERTEN Punkt statt 4 Dauer-Spalten. Das Panel ist zu
     schmal fuer 10 Spalten (Anwenderfund: "ich sehe nicht alles"). */
  const t = steuercodeZerlegen(e.i ?? 0);
  const mini = (teil, optionen, wert) =>
    '<select class="sc-mini" data-scidx="' + idx + '" data-scteil="' + teil + '" title="'
    + escapeHtml(steuercodeWorte(e.i ?? 0, op.kw)) + '">'
    + optionen.map(o => '<option value="' + o[0] + '"' + (o[0] === wert ? ' selected' : '') + '>'
      + o[1] + '</option>').join('') + '</select>';
  /* Feedback K: in der Detail-Zeile ist Platz — Bedeutungen AUSSCHREIBEN
     (mit Symbol), statt der frueheren Spalten-Kuerzel. */
  const wz = op.kw === 'PSG'
    ? [[1,'1 — Standard-Sägeblatt'],[2,'2 — Feinschnitt'],[3,'3 — Kettenfräser']]
    : [[1,'1 — Zylinderfräser'],[2,'2 — Fasenfräser'],[3,'3 — Nutfräser'],[4,'4 — Markierwerkzeug']];
  const schnittKl = t.schnitt === 1 ? 'sc-ueber' : t.schnitt === 2 ? 'sc-unter' : '';
  return 'Wz ' + mini('werkzeug', wz, t.werkzeug)
    + ' <span class="' + schnittKl + '">' + mini('schnitt',
      [[0,'0 — · ohne Schnittkorrektur'],[1,'10 — ⊕ überschneidend'],[2,'20 — ⊖ unterschneidend']], t.schnitt) + '</span>'
    + ' ' + mini('korrektur',
      [[1,'100 — ← Korr. links (Gutteil rechts)'],[2,'200 — → Korr. rechts (Gutteil links)'],[3,'300 — ∅ keine Korrektur']], t.korrektur)
    + ' ' + mini('lauf', [[0,'0 — ⇄ Gegenlauf'],[1,'1000 — ⇉ Gleichlauf']], t.lauf);
}
function steuercodeEditorHtml(op) {
  /* Aufgeschluesselter Steuercode nach Weinmann 5.1 — initialisiert vom ersten Punkt */
  const erster = (op.poly || []).find(e => e.i != null);
  const t = steuercodeZerlegen(erster ? erster.i : 211);
  if (op.kw === 'PSF') {
    return '<div class="sc-editor"><div class="karten-titel" style="font-size:0.72rem">Steuercode (Sperrflaeche, 5.4)</div>'
      + '<div class="eig-zeile">' + scDropdown({ key: 'psf', label: 'Geltungsbereich' },
        [{v:0,t:'0 — Befestigungen'},{v:1,t:'1 — Leimen'},{v:2,t:'2 — Verputzen'}], (erster ? erster.i : 0) % 10)
      + '<button class="schaltflaeche schaltflaeche-klein" data-aktion="sc-anwenden">Auf alle Punkte</button></div></div>';
  }
  if (op.kw === 'PML') {
    return '<div class="sc-editor"><div class="karten-titel" style="font-size:0.72rem">Steuercode (Markieren, 5.3)</div>'
      + '<div class="eig-zeile">'
      + scDropdown({ key: 'werkzeug', label: 'Geraet' },
        [{v:1,t:'1 — Tintenstrahl'},{v:2,t:'2 — Kugelschreiber'},{v:3,t:'3 — Reissnadel'}], t.werkzeug)
      + scDropdown({ key: 'schnitt', label: 'Ebene' },
        [{v:1,t:'10 — gegenueberliegend'},{v:2,t:'20 — Definitionslage'}], t.schnitt)
      + scDropdown({ key: 'korrektur', label: 'Farbe' },
        [{v:0,t:'— keine'},{v:1,t:'100 — schwarz'},{v:2,t:'200 — blau'},{v:3,t:'300 — gruen'}], t.korrektur)
      + '</div><div class="eig-zeile"><button class="schaltflaeche schaltflaeche-klein" data-aktion="sc-anwenden">Auf alle Punkte anwenden</button></div></div>';
  }
  const wzOpt = op.kw === 'PSG'
    ? [{v:1,t:'1 — Standard-Saegeblatt'},{v:2,t:'2 — fein gezahnt'},{v:3,t:'3 — Kettensaege'}]
    : [{v:1,t:'1 — zyl. Fraeser'},{v:2,t:'2 — Fraeser mit Fase'},{v:3,t:'3 — Nutfraeser'},{v:4,t:'4 — Markierfraeser'}];
  return '<div class="sc-editor"><div class="karten-titel" style="font-size:0.72rem">Steuercode aufgeschluesselt (Weinmann 5.1)</div>'
    + '<div class="eig-zeile">'
    + scDropdown({ key: 'werkzeug', label: 'Werkzeug (1er)' }, wzOpt, t.werkzeug)
    + scDropdown({ key: 'schnitt', label: 'Schnitt (10er)' },
      [{v:0,t:'0 — Maschinenregel'},{v:1,t:'10 — Ueberschnitt ⊕'},{v:2,t:'20 — Unterschnitt ⊖'}], t.schnitt)
    + '</div><div class="eig-zeile">'
    + scDropdown({ key: 'korrektur', label: 'Radiuskorrektur (100er)' },
      [{v:1,t:'100 — links (Werkstueck rechts)'},{v:2,t:'200 — rechts (Werkstueck links)'},{v:3,t:'300 — keine'}], t.korrektur)
    + scDropdown({ key: 'lauf', label: 'Lauf (1000er)' },
      [{v:0,t:'0 — Gegenlauf'},{v:1,t:'1000 — Gleichlauf'}], t.lauf)
    + '</div><div class="eig-zeile"><button class="schaltflaeche schaltflaeche-klein" data-aktion="sc-anwenden">Auf alle Punkte anwenden</button>'
    + '<span class="mini-hinweis">Einzelne Punkte weiter ueber die Tabelle.</span></div></div>';
}
function scAusDropdownsLesen() {
  const lese = key => {
    const el = document.querySelector('#eigenschaften [data-sc="' + key + '"]');
    return el ? parseInt(el.value, 10) || 0 : 0;
  };
  const psf = document.querySelector('#eigenschaften [data-sc="psf"]');
  if (psf) return parseInt(psf.value, 10) || 0;
  return steuercodeBauen({ werkzeug: lese('werkzeug'), schnitt: lese('schnitt'),
    korrektur: lese('korrektur'), lauf: lese('lauf') });
}
function scAufOpAnwenden(op, code) {
  for (const e of (op.poly || [])) if (e.i != null || e.type === 'PP' || e.type === 'KB' || e.type === 'MP') e.i = code;
  op._modified = true;
}
function mehrfachOps() {
  const ids = [];
  if (ui.auswahl && ui.auswahl.typ === 'op') ids.push(ui.auswahl.id);
  for (const id of ui.mehrAuswahl) if (!ids.includes(id)) ids.push(id);
  return ids.map(opFinden).filter(Boolean);
}
