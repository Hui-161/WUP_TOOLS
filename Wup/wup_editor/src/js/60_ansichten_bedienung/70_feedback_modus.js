/* =====================================================================
   FEEDBACK-MODUS: auf jedes Feld/Element klicken, Kommentar hinterlassen,
   am Ende als zusammenhaengender Text kopierbar (z.B. fuer Rueckmeldung an
   die Entwicklung). Reine Kommentar-Ebene UEBER der App — im aktiven Modus
   wird jede normale Klick-Aktion (Werkzeuge, Buttons, Drag, Kontextmenue)
   unterdrueckt, damit man beim Review nichts versehentlich veraendert.
   ===================================================================== */
let feedbackModus = false;
let feedbackListe = speicherLaden('feedbackListe', []);
let feedbackZaehler = feedbackListe.reduce((m, e) => Math.max(m, e.id || 0), 0);
let feedbackBearbeitetId = null;   /* id des Eintrags, der im Popover bearbeitet wird (null = neuer Kommentar) */
let feedbackAktuellesInfo = null;  /* {bereich, label} des zuletzt angeklickten Elements */
let feedbackPanelEin = false;      /* Panel eingeklappt (Feedback-Modus bleibt aktiv) */
function feedbackSichern() { speicherSichern('feedbackListe', feedbackListe); }
function feedbackBereichFuer(el) {
  if (!el || !el.closest) return 'Allgemein';
  const karte = el.closest('.karte');
  if (karte) { const t = karte.querySelector('.karten-titel'); if (t) return t.textContent.trim().split('\n')[0].trim(); }
  if (el.closest('header.app-kopfzeile')) return 'Kopfzeile';
  if (el.closest('.werkzeugleiste')) return 'Werkzeugleiste';
  if (el.closest('.kontextmenue')) return 'Kontextmenue';
  if (el.closest('#canvasWrapper')) return 'Ansicht (Canvas)';
  if (el.closest('.text-panel')) return 'Text-/Struktur-Panel';
  if (el.closest('.rechts-panel')) return 'Rechts-Panel';
  if (el.closest('footer.fusszeile')) return 'Fusszeile';
  return 'Allgemein';
}
/* Ermittelt eine moeglichst sprechende {bereich, label}-Beschreibung fuer das
   angeklickte Element — steigt vom Klickziel im DOM auf, bis ein bekanntes
   Muster (data-op/-platte/-beam/-feld/-aktion/-werkzeug, Button, Select,
   Input, Tabellenzelle, Abschnittstitel) greift. */
function feedbackInfoFuer(el) {
  let cur = el;
  while (cur && cur !== document.body) {
    if (cur.dataset && cur.dataset.op) {
      const f = opFinden(cur.dataset.op);
      const label = (f ? (f.op.kw + ' (' + f.op.id + ')') : ('Bearbeitung ' + cur.dataset.op))
        + (cur.dataset.nrEnde ? ' — Endpunkt ' + cur.dataset.nrEnde : '');
      return { bereich: f ? ('Ansicht (Canvas) — Lage ' + f.lage.id) : 'Ansicht (Canvas)', label };
    }
    if (cur.dataset && cur.dataset.platte) return { bereich: 'Ansicht (Canvas)', label: 'Platte ' + cur.dataset.platte };
    if (cur.dataset && cur.dataset.beam) return { bereich: 'Ansicht (Canvas)', label: 'Bauteil ' + cur.dataset.beam };
    if (cur.dataset && cur.dataset.feld) {
      const wrap = cur.closest('label');
      const span = wrap ? wrap.querySelector('span') : null;
      return { bereich: feedbackBereichFuer(cur), label: (span && span.textContent.trim()) || cur.dataset.feld };
    }
    if (cur.dataset && cur.dataset.werkzeug)
      return { bereich: 'Werkzeugleiste', label: (cur.textContent || '').trim() || cur.dataset.werkzeug };
    if (cur.dataset && cur.dataset.aktion)
      return { bereich: feedbackBereichFuer(cur), label: (cur.textContent || '').trim() || cur.dataset.aktion };
    if (cur.dataset && cur.dataset.seg != null)
      return { bereich: feedbackBereichFuer(cur), label: 'Punktzeile #' + cur.dataset.seg };
    if (cur.tagName === 'BUTTON' || cur.tagName === 'A')
      return { bereich: feedbackBereichFuer(cur), label: (cur.title || cur.textContent || cur.id || 'Button').trim().slice(0, 70) };
    if (cur.tagName === 'SELECT' || cur.tagName === 'INPUT') {
      const wrap = cur.closest('label');
      const label = (wrap ? wrap.textContent.trim() : '') || cur.title || cur.id || cur.name || cur.tagName;
      return { bereich: feedbackBereichFuer(cur), label: label.slice(0, 70) };
    }
    if (cur.tagName === 'TH' || cur.tagName === 'TD')
      return { bereich: feedbackBereichFuer(cur), label: (cur.textContent || 'Tabellenzelle').trim().slice(0, 50) };
    if (cur.classList && cur.classList.contains('karten-titel'))
      return { bereich: feedbackBereichFuer(cur), label: 'Abschnittstitel: ' + cur.textContent.trim() };
    if (cur.id === 'canvas') return { bereich: 'Ansicht (Canvas)', label: 'Leerer Bereich / Hintergrund' };
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
    + (bestehend ? '<button class="schaltflaeche schaltflaeche-klein schaltflaeche-gefahr" data-fp-aktion="loeschen">Löschen</button>' : '')
    + '<button class="schaltflaeche schaltflaeche-klein" data-fp-aktion="abbrechen">Abbrechen</button>'
    + '<button class="schaltflaeche schaltflaeche-klein schaltflaeche-haupt" data-fp-aktion="speichern">Speichern</button>'
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
  /* Einklapp-/Ausklapp-Pfeil + Schliessen. Eingeklappt bleibt der Feedback-Modus
     aktiv, nur die Liste/Aktionen werden ausgeblendet (Panel verdeckt dann nicht
     mehr die Ansicht). */
  const kopf = '<div class="fp-titel" style="display:flex;justify-content:space-between;align-items:center;gap:6px">'
    + '<span>💬 Feedback (' + anzahl + ')</span>'
    + '<span style="display:flex;gap:8px">'
    + '<span style="cursor:pointer" data-fp2-aktion="einklappen" title="' + (feedbackPanelEin ? 'Ausklappen' : 'Einklappen (Feedback-Modus bleibt aktiv)') + '">' + (feedbackPanelEin ? '▸' : '▾') + '</span>'
    + '<span style="cursor:pointer" data-fp2-aktion="schliessen" title="Feedback-Modus beenden">✕</span>'
    + '</span></div>';
  if (feedbackPanelEin) { panel.innerHTML = kopf; return; }
  const rumpf = '<div class="fp-bereich">Klick auf ein beliebiges Feld/Element in der App, um einen Kommentar zu hinterlassen.</div>'
    + '<div class="fp-zeile">'
    + '<button class="schaltflaeche schaltflaeche-klein schaltflaeche-haupt" data-fp2-aktion="kopieren"' + (anzahl ? '' : ' disabled') + '>📋 Text kopieren</button>'
    + '<button class="schaltflaeche schaltflaeche-klein schaltflaeche-gefahr" data-fp2-aktion="alle-loeschen"' + (anzahl ? '' : ' disabled') + '>🗑 Alle löschen</button>'
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
  const kopf = 'WUP-Editor Feedback — ' + TOOL_NAME + ' v' + TOOL_VERSION
    + (modell && modell.header ? ' — Datei ' + (modell.header.ELN || '') + '/' + (modell.header.ZNR || '') : '')
    + ' — ' + new Date().toLocaleString('de-DE') + '\n' + '='.repeat(60) + '\n\n';
  const rumpf = feedbackListe.map((e, i) =>
    (i + 1) + '. [' + e.bereich + ' — ' + e.label + ']\n   ' + e.kommentar.split('\n').join('\n   ')
  ).join('\n\n');
  return kopf + rumpf + '\n';
}
function feedbackTextFallback(text) {
  /* Clipboard-API evtl. blockiert (unsicherer Kontext/Berechtigung) — Text
     stattdessen in einem auswaehlbaren Feld anzeigen, manuell mit Strg+C kopierbar. */
  const pop = document.getElementById('feedbackPopover');
  pop.innerHTML = '<div class="fp-titel">📋 Feedback-Text (manuell kopieren, Strg+C)</div>'
    + '<textarea id="fpKopierText" readonly>' + escapeHtml(text) + '</textarea>'
    + '<div class="fp-zeile"><button class="schaltflaeche schaltflaeche-klein" data-fp-aktion="abbrechen">Schliessen</button></div>';
  pop.classList.remove('versteckt');
  pop.style.width = '440px'; pop.style.left = '50%'; pop.style.top = '50%'; pop.style.transform = 'translate(-50%,-50%)';
  const ta = document.getElementById('fpKopierText');
  ta.focus(); ta.select();
}
function feedbackTextKopieren() {
  const text = feedbackTextErzeugen();
  const ok = () => hinweisAnzeigen(feedbackListe.length + ' Kommentar(e) als Text kopiert — jetzt einfuegen (Strg+V).', 'erfolg');
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
/* Capture-Phase-Blockade: unterdrueckt im Feedback-Modus jede normale Klick-
   Aktion (Werkzeuge, Drag, Checkboxen, Kontextmenue) VOR dem eigentlichen
   Ziel-Handler — Ausnahme sind das Popover/Panel selbst und der Umschalt-
   Knopf. Das eigentliche OEFFNEN des Kommentar-Popovers passiert separat
   auf 'click' (feedbackKlick), damit ein Drag nicht versehentlich als Klick
   gewertet wird. */
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
      bestaetigen(feedbackListe.length + ' Kommentar(e) wirklich alle loeschen?', 'Alle löschen', () => {
        feedbackListe = []; feedbackSichern(); feedbackPanelRendern();
      });
      return;
    }
    const eintrag = ev.target.closest('.fp-eintrag');
    if (!eintrag) return;
    const id = parseInt(eintrag.dataset.fpId, 10);
    const e = feedbackListe.find(x => x.id === id);
    if (!e) return;
    if (a === 'bearbeiten') {
      const rect = eintrag.getBoundingClientRect();
      feedbackPopoverOeffnen(rect.left, rect.top, { bereich: e.bereich, label: e.label }, e);
    } else if (a === 'loeschen') {
      feedbackListe = feedbackListe.filter(x => x.id !== id);
      feedbackSichern(); feedbackPanelRendern();
    }
  });
  const pop = document.getElementById('feedbackPopover');
  if (pop) {
    pop.addEventListener('pointerdown', ev => ev.stopPropagation());
    pop.addEventListener('click', ev => {
      const b = ev.target.closest('[data-fp-aktion]');
      if (!b) return;
      const a = b.dataset.fpAktion;
      if (a === 'abbrechen') { feedbackPopoverSchliessen(); return; }
      if (a === 'loeschen') {
        feedbackListe = feedbackListe.filter(x => x.id !== feedbackBearbeitetId);
        feedbackSichern(); feedbackPanelRendern(); feedbackPopoverSchliessen();
        return;
      }
      if (a === 'speichern') {
        const feld = document.getElementById('fpText');
        const text = feld ? feld.value.trim() : '';
        if (!text) { feedbackPopoverSchliessen(); return; }
        if (feedbackBearbeitetId != null) {
          const e = feedbackListe.find(x => x.id === feedbackBearbeitetId);
          if (e) e.kommentar = text;
        } else {
          feedbackListe.push({ id: ++feedbackZaehler, bereich: feedbackAktuellesInfo.bereich,
            label: feedbackAktuellesInfo.label, kommentar: text, zeit: new Date().toISOString() });
        }
        feedbackSichern();
        feedbackPanelRendern();
        feedbackPopoverSchliessen();
        hinweisAnzeigen('Kommentar gespeichert.', 'erfolg');
      }
    });
    pop.addEventListener('keydown', ev => {
      if (ev.key === 'Escape') { ev.stopPropagation(); feedbackPopoverSchliessen(); }
    });
  }
  /* Hover-Hervorhebung: zeigt, welches Element beim naechsten Klick kommentiert wird */
  let hoverEl = null;
  document.addEventListener('mouseover', ev => {
    if (!feedbackModus) return;
    if (ev.target.closest('#feedbackPopover, #feedbackPanel, #btnFeedbackModus')) return;
    if (hoverEl) hoverEl.classList.remove('feedback-hover-highlight');
    hoverEl = ev.target;
    hoverEl.classList.add('feedback-hover-highlight');
  });
  document.addEventListener('mouseout', ev => {
    if (hoverEl && ev.target === hoverEl) { hoverEl.classList.remove('feedback-hover-highlight'); hoverEl = null; }
  });
  document.addEventListener('pointerdown', feedbackVorabblock, true);
  document.addEventListener('dblclick', feedbackVorabblock, true);
  document.addEventListener('contextmenu', feedbackVorabblock, true);
  document.addEventListener('click', feedbackKlick, true);
}

