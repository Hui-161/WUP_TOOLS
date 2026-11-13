/* =====================================================================
   §13 ARBEITSPAKET 2 — FEEDBACK-MODUS
   1:1 aus wup_editor.html portiert (dort: "FEEDBACK-MODUS" - Funktionen
   feedbackModusUmschalten/feedbackEinrichten/feedbackPanelRendern/
   feedbackTextErzeugen/...). Nur angepasst: feedbackBereichFuer/InfoFuer auf
   die DOM-Struktur DIESER Datei (Karten/Chips/Panel statt Editor-Layout),
   Speicher-Schluessel automatisch ueber SPEICHER_PRAEFIX dieser Datei
   ('wup_oversight_v1_feedbackListe', siehe speicherLaden/speicherSichern
   § oben und feedbackListe-Deklaration in §3), Kopftext in
   feedbackTextErzeugen().
   ===================================================================== */
function feedbackSichern() { speicherSichern('feedbackListe', feedbackListe); }
function feedbackBereichFuer(el) {
  if (!el || !el.closest) return 'Allgemein';
  const karte = el.closest('.karte');
  if (karte) { const t = karte.querySelector('.karte-titel'); if (t) return t.textContent.trim().split('\n')[0].trim(); }
  if (el.closest('#chipZeile')) return 'Filter-Chips';
  if (el.closest('.kopf-zeile2')) return 'Automatik-/Werkzeugleiste';
  if (el.closest('.app-kopfzeile')) return 'Kopfzeile';
  if (el.closest('.quelltext-panel')) return 'Quelltext-/Struktur-Panel';
  if (el.closest('.modal-fenster')) return 'Dialog';
  if (el.closest('footer.fusszeile')) return 'Fusszeile';
  return 'Allgemein';
}
/* Ermittelt eine moeglichst sprechende {bereich, label}-Beschreibung fuer das
   angeklickte Element - steigt vom Klickziel im DOM auf, bis ein bekanntes
   Muster (Karte, Filter-Chip, Panel-Tab, Button, Select/Input, Abschnitts-
   titel) greift. Gleiches Prinzip wie feedbackInfoFuer() im Editor. */
function feedbackInfoFuer(el) {
  let cur = el;
  while (cur && cur !== document.body) {
    if (cur.dataset && cur.dataset.schluessel)
      return { bereich: feedbackBereichFuer(cur), label: 'Wand-Karte ' + cur.dataset.schluessel };
    if (cur.classList && cur.classList.contains('filter-chip'))
      return { bereich: feedbackBereichFuer(cur), label: 'Filter: ' + (cur.textContent || '').trim() };
    if (cur.dataset && cur.dataset.qtab)
      return { bereich: 'Quelltext-/Struktur-Panel', label: 'Tab: ' + (cur.textContent || '').trim() };
    if (cur.tagName === 'BUTTON' || cur.tagName === 'A')
      return { bereich: feedbackBereichFuer(cur), label: (cur.title || cur.textContent || cur.id || 'Button').trim().slice(0, 70) };
    if (cur.tagName === 'SELECT' || cur.tagName === 'INPUT') {
      const wrap = cur.closest('label');
      const label = (wrap ? wrap.textContent.trim() : '') || cur.title || cur.id || cur.name || cur.tagName;
      return { bereich: feedbackBereichFuer(cur), label: label.slice(0, 70) };
    }
    if (cur.classList && cur.classList.contains('karte-titel'))
      return { bereich: feedbackBereichFuer(cur), label: 'Abschnittstitel: ' + cur.textContent.trim() };
    if (cur.classList && cur.classList.contains('app-titel'))
      return { bereich: 'Kopfzeile', label: 'Titel: ' + cur.textContent.trim() };
    cur = cur.parentElement;
  }
  return { bereich: 'Allgemein', label: (el.tagName || 'Element').toString() };
}
function feedbackPopoverOeffnen(x, y, info, bestehend) {
  feedbackBearbeitetId = bestehend ? bestehend.id : null;
  feedbackAktuellesInfo = info;
  const pop = document.getElementById('feedbackPopover');
  pop.style.transform = ''; pop.style.width = '';
  pop.innerHTML =
    '<div class="fp-titel">💬 Kommentar</div>'
    + '<div class="fp-bereich">' + escapeHtml(info.bereich) + ' — ' + escapeHtml(info.label) + '</div>'
    + '<textarea id="fpText" placeholder="Kommentar/Feedback zu diesem Feld…">'
    + escapeHtml(bestehend ? bestehend.kommentar : '') + '</textarea>'
    + '<div class="fp-zeile">'
    + (bestehend ? '<button type="button" class="schaltflaeche schaltflaeche-klein schaltflaeche-gefahr" data-fp-aktion="loeschen">Löschen</button>' : '')
    + '<button type="button" class="schaltflaeche schaltflaeche-klein" data-fp-aktion="abbrechen">Abbrechen</button>'
    + '<button type="button" class="schaltflaeche schaltflaeche-klein schaltflaeche-haupt" data-fp-aktion="speichern">Speichern</button>'
    + '</div>';
  pop.classList.remove('versteckt');
  const bw = 280, bh = 170;
  let px = x + 12, py = y + 12;
  if (px + bw > window.innerWidth) px = Math.max(4, x - bw - 12);
  if (py + bh > window.innerHeight) py = Math.max(4, window.innerHeight - bh - 8);
  pop.style.left = px + 'px'; pop.style.top = py + 'px';
  const ta = document.getElementById('fpText');
  ta.focus();
  ta.setSelectionRange(ta.value.length, ta.value.length);
}
function feedbackPopoverSchliessen() {
  document.getElementById('feedbackPopover').classList.add('versteckt');
  feedbackBearbeitetId = null;
}
function feedbackPanelRendern() {
  const panel = document.getElementById('feedbackPanel');
  if (!panel) return;
  if (!feedbackModus) { panel.classList.add('versteckt'); return; }
  panel.classList.remove('versteckt');
  panel.classList.toggle('eingeklappt', feedbackPanelEin);
  const anzahl = feedbackListe.length;
  const kopf = '<div class="fp-titel" style="display:flex;justify-content:space-between;align-items:center;gap:6px">'
    + '<span>💬 Feedback (' + anzahl + ')</span>'
    + '<span style="display:flex;gap:8px">'
    + '<span style="cursor:pointer" data-fp2-aktion="einklappen" title="' + (feedbackPanelEin ? 'Ausklappen' : 'Einklappen (Feedback-Modus bleibt aktiv)') + '">' + (feedbackPanelEin ? '▸' : '▾') + '</span>'
    + '<span style="cursor:pointer" data-fp2-aktion="schliessen" title="Feedback-Modus beenden">✕</span>'
    + '</span></div>';
  if (feedbackPanelEin) { panel.innerHTML = kopf; return; }
  const rumpf = '<div class="fp-bereich">Klick auf ein beliebiges Feld/Element in der App, um einen Kommentar zu hinterlassen.</div>'
    + '<div class="fp-zeile">'
    + '<button type="button" class="schaltflaeche schaltflaeche-klein schaltflaeche-haupt" data-fp2-aktion="kopieren"' + (anzahl ? '' : ' disabled') + '>📋 Text kopieren</button>'
    + '<button type="button" class="schaltflaeche schaltflaeche-klein schaltflaeche-gefahr" data-fp2-aktion="alle-loeschen"' + (anzahl ? '' : ' disabled') + '>🗑 Alle löschen</button>'
    + '</div>';
  const zeilen = feedbackListe.map((e, i) =>
    '<div class="fp-eintrag" data-fp-id="' + e.id + '">'
    + '<div class="fp-bereich">' + (i + 1) + '. ' + escapeHtml(e.bereich) + '</div>'
    + '<div class="fp-label">' + escapeHtml(e.label) + '</div>'
    + '<div class="fp-text">' + escapeHtml(e.kommentar) + '</div>'
    + '<div class="fp-aktionen"><span data-fp2-aktion="bearbeiten">Bearbeiten</span><span data-fp2-aktion="loeschen">Löschen</span></div>'
    + '</div>').join('');
  panel.innerHTML = kopf + rumpf + '<div class="fp-liste">' + (zeilen || '<div class="fp-bereich">Noch keine Kommentare.</div>') + '</div>';
}
function feedbackTextErzeugen() {
  if (!feedbackListe.length) return 'Keine Kommentare vorhanden.';
  const kopf = 'WUP-Übersicht Feedback — v' + TOOL_VERSION
    + ' — ' + new Date().toLocaleString('de-DE') + '\n' + '='.repeat(60) + '\n\n';
  const rumpf = feedbackListe.map((e, i) =>
    (i + 1) + '. [' + e.bereich + ' — ' + e.label + ']\n   ' + e.kommentar.split('\n').join('\n   ')
  ).join('\n\n');
  return kopf + rumpf + '\n';
}
function feedbackTextFallback(text) {
  const pop = document.getElementById('feedbackPopover');
  pop.innerHTML = '<div class="fp-titel">📋 Feedback-Text (manuell kopieren, Strg+C)</div>'
    + '<textarea id="fpKopierText" readonly>' + escapeHtml(text) + '</textarea>'
    + '<div class="fp-zeile"><button type="button" class="schaltflaeche schaltflaeche-klein" data-fp-aktion="abbrechen">Schliessen</button></div>';
  pop.classList.remove('versteckt');
  pop.style.width = '440px'; pop.style.left = '50%'; pop.style.top = '50%'; pop.style.transform = 'translate(-50%,-50%)';
  const ta = document.getElementById('fpKopierText');
  ta.focus(); ta.select();
}
function feedbackTextKopieren() {
  const text = feedbackTextErzeugen();
  const ok = () => hinweisAnzeigen(feedbackListe.length + ' Kommentar(e) als Text kopiert — jetzt einfügen (Strg+V).', 'erfolg');
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(ok).catch(() => feedbackTextFallback(text));
  } else {
    feedbackTextFallback(text);
  }
}
function feedbackModusUmschalten(erzwingenAn) {
  feedbackModus = typeof erzwingenAn === 'boolean' ? erzwingenAn : !feedbackModus;
  document.body.classList.toggle('feedback-modus', feedbackModus);
  const btn = document.getElementById('btnFeedbackModus');
  if (btn) btn.classList.toggle('aktiv', feedbackModus);
  if (!feedbackModus) feedbackPopoverSchliessen();
  feedbackPanelRendern();
  hinweisAnzeigen(feedbackModus
    ? 'Feedback-Modus aktiv: Klicke ein Feld/Element an, um einen Kommentar zu hinterlassen. Normale Bedienung ist waehrenddessen deaktiviert.'
    : 'Feedback-Modus beendet.', 'info');
}
function feedbackVorabblock(ev) {
  if (!feedbackModus) return;
  if (ev.target.closest('#feedbackPopover, #feedbackPanel, #btnFeedbackModus')) return;
  ev.preventDefault();
  ev.stopPropagation();
}
function feedbackKlick(ev) {
  if (!feedbackModus) return;
  if (ev.target.closest('#feedbackPopover, #feedbackPanel, #btnFeedbackModus')) return;
  ev.preventDefault();
  ev.stopPropagation();
  const info = feedbackInfoFuer(ev.target);
  const bestehend = feedbackListe.find(e => e.bereich === info.bereich && e.label === info.label);
  feedbackPopoverOeffnen(ev.clientX, ev.clientY, info, bestehend);
}
function feedbackEinrichten() {
  const btn = document.getElementById('btnFeedbackModus');
  if (btn) btn.addEventListener('click', () => feedbackModusUmschalten());
  const panel = document.getElementById('feedbackPanel');
  if (panel) panel.addEventListener('click', ev => {
    const aktion = ev.target.closest('[data-fp2-aktion]');
    if (!aktion) return;
    const a = aktion.dataset.fp2Aktion;
    if (a === 'einklappen') { feedbackPanelEin = !feedbackPanelEin; feedbackPanelRendern(); return; }
    if (a === 'schliessen') { feedbackModusUmschalten(false); return; }
    if (a === 'kopieren') { feedbackTextKopieren(); return; }
    if (a === 'alle-loeschen') {
      if (feedbackListe.length && confirm(feedbackListe.length + ' Kommentar(e) wirklich alle löschen?')) {
        feedbackListe = []; feedbackSichern(); feedbackPanelRendern();
      }
      return;
    }
    const eintrag = ev.target.closest('[data-fp-id]');
    if (!eintrag) return;
    const id = parseInt(eintrag.dataset.fpId, 10);
    if (a === 'bearbeiten') {
      const e = feedbackListe.find(x => x.id === id);
      if (e) feedbackPopoverOeffnen(window.innerWidth / 2 - 140, window.innerHeight / 2 - 85, { bereich: e.bereich, label: e.label }, e);
      return;
    }
    if (a === 'loeschen') {
      feedbackListe = feedbackListe.filter(x => x.id !== id);
      feedbackSichern(); feedbackPanelRendern();
    }
  });
  const pop = document.getElementById('feedbackPopover');
  pop.addEventListener('click', ev => {
    const aktion = ev.target.closest('[data-fp-aktion]');
    if (!aktion) return;
    const a = aktion.dataset.fpAktion;
    if (a === 'abbrechen') { feedbackPopoverSchliessen(); return; }
    if (a === 'loeschen') {
      feedbackListe = feedbackListe.filter(x => x.id !== feedbackBearbeitetId);
      feedbackSichern(); feedbackPopoverSchliessen(); feedbackPanelRendern();
      return;
    }
    if (a === 'speichern') {
      const text = document.getElementById('fpText').value.trim();
      if (!text) { feedbackPopoverSchliessen(); return; }
      if (feedbackBearbeitetId) {
        const e = feedbackListe.find(x => x.id === feedbackBearbeitetId);
        if (e) e.kommentar = text;
      } else if (feedbackAktuellesInfo) {
        feedbackZaehler++;
        feedbackListe.push({ id: feedbackZaehler, bereich: feedbackAktuellesInfo.bereich, label: feedbackAktuellesInfo.label, kommentar: text });
      }
      feedbackSichern(); feedbackPopoverSchliessen(); feedbackPanelRendern();
    }
  });
  pop.addEventListener('keydown', ev => { if (ev.key === 'Escape') feedbackPopoverSchliessen(); });
  document.addEventListener('pointerdown', feedbackVorabblock, true);
  document.addEventListener('dblclick', feedbackVorabblock, true);
  document.addEventListener('contextmenu', feedbackVorabblock, true);
  document.addEventListener('click', feedbackKlick, true);
}

