/* =====================================================================
   v2.59 KOPF-METADATEN (Anwenderwunsch 2026-11-10: "im Header immer die
   Metadaten anzeigen — Wandnamen, Bauvorhaben etc., was du herauslesen
   kannst"). Quellen: Dateikopf (ELN, ZNR, ANR, ELB, ELA, ELM, REIHE,
   STAPEL) und die TXT-Kopfzeilen der Exporteure (SEMA: "BV / Kunden Nr",
   "Bauvorhaben", "Ort", "Objekt"; Granit: "PROJECT", "ELEMENT").
   BEWUSST NICHT angezeigt: Bearbeiter und Kundenname (personenbezogen —
   stehen weiter im Text-Panel). Nur Anzeige, nichts wird geschrieben.
   ===================================================================== */
const KOPF_TXT_FELDER = [
  /* [Schluessel im TXT (klein, ohne Leerzeichen), Anzeige-Name] */
  ['bauvorhaben', 'Bauvorhaben'], ['bv/kundennr', 'BV-Nr.'], ['ort', 'Ort'],
  ['objekt', 'Objekt'], ['project', 'Projekt'], ['element', 'Element']
];
function kopfTxtWert(schluessel) {
  for (const t of (modell.txt || [])) {
    if (t.key.toLowerCase().replace(/\s+/g, '') !== schluessel) continue;
    const v = t.value.replace(/[;\s]+$/, '').trim();
    if (v) return v;
  }
  return '';
}
function kopfMetadaten() {
  if (!modell) return [];
  const h = modell.header, felder = [];
  const dazu = (name, wert, wichtig) => {
    wert = String(wert == null ? '' : wert).trim();
    if (wert && !felder.some(f => f.wert === wert)) felder.push({ name, wert, wichtig: !!wichtig });
  };
  dazu('Wand', h.ELN || modell.dateiName, true);
  if (h.ZNR && h.ZNR !== h.ELN) dazu('Zeichnung', h.ZNR);
  const bv = kopfTxtWert('bauvorhaben');
  dazu('Bauvorhaben', bv, true);
  dazu('Auftrag', h.ANR || kopfTxtWert('bv/kundennr'), !bv);
  for (const [k, name] of KOPF_TXT_FELDER)
    if (k !== 'bauvorhaben' && k !== 'bv/kundennr') dazu(name, kopfTxtWert(k));
  dazu('Typ', [h.ELB, h.ELA].filter(Boolean).join(' · '));
  if (h.ELM && h.ELM.lx) dazu('Maße', fmtZahl(h.ELM.lx) + ' × ' + fmtZahl(h.ELM.by) + ' × ' + fmtZahl(h.ELM.hz) + ' mm');
  if (h.REIHE) dazu('Reihe', h.REIHE);
  if (h.STAPEL) dazu('Stapel', h.STAPEL);
  return felder;
}
function kopfMetadatenRendern() {
  const el = document.getElementById('kopfMeta');
  if (!el) return;
  const felder = kopfMetadaten();
  el.hidden = !felder.length;
  el.innerHTML = felder.map(f => '<span class="kopf-meta-feld' + (f.wichtig ? ' wichtig' : '') + '" title="'
    + escapeHtml(f.name + ': ' + f.wert) + '"><span class="kopf-meta-name">' + escapeHtml(f.name)
    + '</span> ' + escapeHtml(f.wert) + '</span>').join('');
  el.title = felder.map(f => f.name + ': ' + f.wert).join('\n');
}
