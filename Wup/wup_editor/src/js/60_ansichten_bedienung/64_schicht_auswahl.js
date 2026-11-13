/* =====================================================================
   WP3-P3 — SCHICHT-AUSWAHL (#btnNeuKonturLagen / #neuKonturLagenPopover)
   ===================================================================== */
/* Label je Lage im Popover/Button: Lage-Id + Material der ersten Platte
   (falls bekannt) + Seite (Innen/Aussen) — z.B. "PLI1 (Spanplatte, Innen)". */
function neuKonturLagenLabel(lage) {
  const material = lage.plates.length && lage.plates[0].name ? lage.plates[0].name : '';
  const seite = lage.side === 'innen' ? 'Innen' : 'Aussen';
  return lage.id + (material ? ' (' + material + ', ' + seite + ')' : ' (' + seite + ')');
}
/* Sorgt dafuer, dass ui.neuKonturLagen beim ersten Gebrauch (erstes Oeffnen
   des Popovers) mit der bisherigen Einzel-Lage-Vorgabe vorbelegt ist. */
function neuKonturLagenSicherstellen() {
  if (!modell) return;
  if (Array.isArray(ui.neuKonturLagen) && ui.neuKonturLagen.length) return;
  const oberste = obersteSichtbareLageMitPlatten();
  ui.neuKonturLagen = oberste ? [oberste.id] : [];
}
function neuKonturLagenButtonAktualisieren() {
  const btn = document.getElementById('btnNeuKonturLagen');
  if (!btn) return;
  neuKonturLagenSicherstellen();
  const anzahl = Array.isArray(ui.neuKonturLagen) ? ui.neuKonturLagen.length : 0;
  btn.textContent = 'Schichten (' + anzahl + ') ▾';
}
function neuKonturLagenPopoverOeffnen() {
  if (!modell) return;
  neuKonturLagenSicherstellen();
  const pop = document.getElementById('neuKonturLagenPopover');
  const btn = document.getElementById('btnNeuKonturLagen');
  if (!pop || !btn) return;
  const lagenMitPlatten = modell.layers.filter(l => l.plates.length)
    .slice().sort((a, b) => (a.side === b.side ? a.num - b.num : (a.side === 'innen' ? -1 : 1)));
  pop.innerHTML = '<div class="nkl-titel">Ziel-Schichten</div>'
    + lagenMitPlatten.map(l => '<label class="nkl-zeile"><input type="checkbox" data-nkl-lage="' + l.id + '"'
      + (ui.neuKonturLagen.includes(l.id) ? ' checked' : '') + '> ' + escapeHtml(neuKonturLagenLabel(l)) + '</label>').join('')
    + (lagenMitPlatten.length ? '' : '<div class="mini-hinweis">Keine Lagen mit Platten.</div>')
    + '<div class="nkl-aktionen">'
    + '<button class="schaltflaeche schaltflaeche-klein" data-nkl-aktion="alle">Alle</button>'
    + '<button class="schaltflaeche schaltflaeche-klein" data-nkl-aktion="keine">Keine</button>'
    + '</div>';
  const rect = btn.getBoundingClientRect();
  pop.style.left = Math.round(rect.left) + 'px';
  pop.style.top = Math.round(rect.bottom + 4) + 'px';
  pop.classList.remove('versteckt');
}
function neuKonturLagenPopoverSchliessen() {
  const pop = document.getElementById('neuKonturLagenPopover');
  if (pop) pop.classList.add('versteckt');
}
function neuKonturLagenPopoverOffen() {
  const pop = document.getElementById('neuKonturLagenPopover');
  return !!(pop && !pop.classList.contains('versteckt'));
}

/* Aktualisiert die Form-Optionen (#neueKonturForm) passend zur gewaehlten Art
   (#neueKonturTyp): NR hat keine Form (immer 2-Klick-Linie), PAF erlaubt alle
   drei Formen, PSG/PSF/PSZ nur Polygon+Rechteck (MP-Kreis ist nur fuer
   Fraesung/PAF sinnvoll). Wird bei Werkzeugwechsel und bei Art-Aenderung gerufen. */
function neueKonturFormOptionenAktualisieren() {
  const typEl = document.getElementById('neueKonturTyp');
  const formEl = document.getElementById('neueKonturForm');
  if (!typEl || !formEl) return;
  const art = typEl.value;
  if (art === 'NR') { formEl.style.display = 'none'; return; }
  formEl.style.display = '';
  const erlaubtMp = art === 'PAF';   /* PML: nur PP-Zuege erlaubt (Weinmann 3.4.2), kein MP */
  const vorher = formEl.value;
  formEl.innerHTML = '<option value="polygon">Polygon (Klicks)</option>'
    + '<option value="rechteck">Rechteck (2 Ecken)</option>'
    + (erlaubtMp ? '<option value="mp">Kreis (MP)</option>' : '');
  if (vorher === 'polygon' || vorher === 'rechteck' || (vorher === 'mp' && erlaubtMp)) formEl.value = vorher;
}
function werkzeugSetzen(name) {
  ui.werkzeug = name;
  ui.messStart = null; ui.neueNrStart = null; ui.snapAnzeige = null;
  if (name !== 'neue-kontur') {
    ui.neueKontur = null; ui._neueKonturMaus = null;
    /* WP3-P1: Werkzeugwechsel bricht eine offene Seiten-Wahl mit ab (Konturen
       bleiben bei i=311 stehen, siehe Escape-Handler) */
    ui.seitenWahl = null; seitenWahlPopupVerstecken();
    neuKonturLagenPopoverSchliessen();
  }
  if (name !== 'kante') ui.kanten = [];
  document.querySelectorAll('[data-werkzeug]').forEach(b =>
    b.classList.toggle('aktiv', b.dataset.werkzeug === name));
  const typEl = document.getElementById('neueKonturTyp');
  const formEl = document.getElementById('neueKonturForm');
  const lagenBtn = document.getElementById('btnNeuKonturLagen');
  if (typEl) typEl.style.display = name === 'neue-kontur' ? '' : 'none';
  if (lagenBtn) lagenBtn.style.display = name === 'neue-kontur' ? '' : 'none';
  if (name === 'neue-kontur') { neueKonturFormOptionenAktualisieren(); neuKonturLagenButtonAktualisieren(); }
  else if (formEl) formEl.style.display = 'none';
  const wrap = document.getElementById('canvasWrapper');
  wrap.style.cursor = name === 'messen' || name === 'neue-kontur' ? 'crosshair'
    : name === 'kante' ? 'move' : 'default';
  verschiebenOverlayRendern();
  if (modell) { svgRendern(); eigenschaftenRendern(); messPanelRendern(); }
}
function splitterEinrichten(splitterId, links) {
  /* Bug-Fix: Layout ist ein CSS-Grid — Breite ueber die Grid-Variablen steuern,
     flex-basis hatte hier keinerlei Wirkung. */
  const splitter = document.getElementById(splitterId);
  splitter.addEventListener('pointerdown', startEv => {
    startEv.preventDefault();
    const haupt = document.getElementById('hauptbereich');
    if (links && haupt.classList.contains('text-zu')) return;
    const startX = startEv.clientX;
    const panel = links ? haupt.querySelector('.text-panel') : haupt.querySelector('.rechts-panel');
    const startBreite = panel.getBoundingClientRect().width;
    const variable = links ? '--text-breite' : '--rechts-breite';
    const move = ev => {
      const delta = links ? ev.clientX - startX : startX - ev.clientX;
      haupt.style.setProperty(variable, Math.max(160, Math.min(720, startBreite + delta)) + 'px');
      if (links && ui.textTab === 'quelltext') textPanelRendern();
      if (modell) svgRendern();
    };
    const up = () => {
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerup', up);
      if (modell) { svgRendern(); if (links) textPanelRendern(); }
    };
    document.addEventListener('pointermove', move);
    document.addEventListener('pointerup', up);
  });
}
/* TASTENKUERZEL-Array als EINZIGE Quelle (Spec §7.10 / B3).
   alt:true-Eintraege werden vom zentralen keydown-Handler (§ Tastenkuerzel
   weiter unten) ausgefuehrt. alt:false-Eintraege sind bewusste Abweichungen
   vom Alt-Schema (Einbuchstaben-Werkzeugkuerzel, Sondertasten) - sie dienen
   NUR der Anzeige; ihre Logik bleibt im bestehenden Handler. */
const TASTENKUERZEL = [
  { taste: 'z', alt: true,  thema: 'Bearbeiten', beschriftung: 'Rückgängig',      aktion: () => rueckgaengig() },
  { taste: 'y', alt: true,  thema: 'Bearbeiten', beschriftung: 'Wiederholen',     aktion: () => wiederholen() },
  { taste: 'e', alt: true,  thema: 'Datei',      beschriftung: 'WUP exportieren', aktion: () => wupExportieren() },
  { taste: 'n', alt: true,  thema: 'Datei',      beschriftung: 'Datei öffnen',    aktion: () => document.getElementById('dateiInput').click() },
  { taste: 'a', alt: true,  thema: 'Automatiken', beschriftung: 'Automatiken-Menü öffnen/schließen',
    aktion: () => { const b = document.getElementById('btnAutomatiken'); if (!b.disabled) b.click(); } },
  /* Nur-Anzeige (Logik im Handler): */
  { taste: 'Alt+A, 1–7',    alt: false, thema: 'Automatiken', beschriftung: 'Automatik direkt starten (Ziffer bei offenem Menü)' },
  { taste: 'Enter',         alt: false, thema: 'Automatiken', beschriftung: 'Abfrage bestätigen; bei Ecken-PML danach: Anschlag-Vorschlag übernehmen' },
  { taste: 'V/M/K/N',       alt: false, thema: 'Werkzeuge',  beschriftung: 'Auswahl / Messen / Verschieben / Neue Kontur' },
  { taste: 'N, dann S/F/G/Z/M/N', alt: false, thema: 'Werkzeuge', beschriftung: 'Neu: Sperrfläche / Fräse / Säge / Sperrzone / Markierung / Nagelreihe — mit zuletzt genutzter Form + Schicht' },
  { taste: 'Enter/2×Klick', alt: false, thema: 'Werkzeuge',  beschriftung: 'Kontur abschließen' },
  { taste: 'Esc',           alt: false, thema: 'Werkzeuge',  beschriftung: 'Abbrechen' },
  { taste: 'Entf',          alt: false, thema: 'Bearbeiten', beschriftung: 'Löschen' },
  { taste: 'Strg+A',        alt: false, thema: 'Bearbeiten', beschriftung: 'Alle auswählen' },
  { taste: 'Strg/⇧+Klick',  alt: false, thema: 'Bearbeiten', beschriftung: 'Mehrfachauswahl (Canvas, Quelltext, Punkte)' },
  { taste: 'Strg+H',        alt: false, thema: 'Bearbeiten', beschriftung: 'Werte ersetzen' },
  { taste: 'Alt+↑/↓',       alt: false, thema: 'Bearbeiten', beschriftung: 'Maschinen-Reihenfolge' },
  { taste: 'H / ⇧H',        alt: false, thema: 'Ansicht',    beschriftung: 'Schnitt horizontal / vertikal' },
  { taste: 'D',             alt: false, thema: 'Ansicht',    beschriftung: '3D-Ansicht' },
  { taste: 'Leer',          alt: false, thema: 'Ansicht',    beschriftung: 'Einpassen' },
  { taste: 'Pfeile',        alt: false, thema: 'Ansicht',    beschriftung: 'Navigieren' },
  { taste: 'Alt+Klick',     alt: false, thema: 'Ansicht',    beschriftung: 'Lage/Chip Solo' },
  { taste: 'Strg+K',        alt: false, thema: 'Befehle',    beschriftung: 'Befehlspalette' },
];

