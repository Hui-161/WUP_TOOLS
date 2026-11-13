/* =====================================================================
   §7 ANSICHT / KARTEN-GITTER / CHIPS
   ===================================================================== */
function ansichtAktualisieren() {
  document.getElementById('dateiZaehler').textContent = dateien.length
    ? dateien.length + ' Datei(en), ' + dateien.reduce((s, d) => s + d.waende.length, 0) + ' Wand-Karte(n)'
    : '';
  document.getElementById('leerHinweis').style.display = dateien.length ? 'none' : 'block';
  chipsRendern();
  kartenLeisteRendern();
  gitterRendern();
}

/* Arbeitspaket 5: Alt+Klick = Solo auf beide Chip-Reihen (gleiches Muster wie
   lagenKlick/opFilterChips im Editor) - schaltet nur den geklickten Chip an,
   alle anderen aus; erneutes Alt+Klick auf den einzig aktiven schaltet wieder
   alle an. */
function chipSoloUmschalten(objekt, schluessel, alleSchluessel) {
  const nurDieser = alleSchluessel.every(k => k === schluessel ? objekt[k] : !objekt[k]);
  for (const k of alleSchluessel) objekt[k] = nurDieser ? true : (k === schluessel);
}
function chipsRendern() {
  const bWrap = document.getElementById('chipsBearbeitungen');
  bWrap.querySelectorAll('.filter-chip').forEach(c => c.remove());
  for (const typ of BEARBEITUNGS_TYPEN) {
    const chip = document.createElement('span');
    chip.className = 'filter-chip' + (sichtbarkeit.bearbeitungen[typ] ? ' an' : '');
    chip.dataset.opChip = typ;   /* Angleichung: Rechtsklick-Menue je Typ */
    chip.title = typ + ' ein-/ausblenden — Alt+Klick = Solo · Rechtsklick = Menü';
    chip.innerHTML = '<span class="chip-punkt" style="background:' + BEARBEITUNGS_FARBEN[typ] + '"></span>' + typ;
    chip.onclick = ev => {
      if (ev.altKey) chipSoloUmschalten(sichtbarkeit.bearbeitungen, typ, BEARBEITUNGS_TYPEN);
      else sichtbarkeit.bearbeitungen[typ] = !sichtbarkeit.bearbeitungen[typ];
      ansichtAktualisieren();
    };
    bWrap.appendChild(chip);
  }
  /* v0.16: Riegelwerk / Richtungsbohrung als eigene Chips */
  const rWrap = document.getElementById('chipsRiegel');
  if (rWrap) {
    rWrap.querySelectorAll('.filter-chip').forEach(c => c.remove());
    for (const s of RIEGEL_SCHALTER) {
      const chip = document.createElement('span');
      chip.className = 'filter-chip' + (sichtbarkeit[s.schluessel] !== false ? ' an' : '');
      chip.dataset.riegelChip = s.schluessel;
      chip.title = s.titel;
      chip.innerHTML = '<span class="chip-punkt" style="background:' + s.farbe + '"></span>' + s.text;
      chip.onclick = () => { sichtbarkeit[s.schluessel] = sichtbarkeit[s.schluessel] === false; ansichtAktualisieren(); };
      rWrap.appendChild(chip);
    }
  }
  const lWrap = document.getElementById('chipsLagen');
  lWrap.querySelectorAll('.filter-chip, .seiten-dreieck').forEach(c => c.remove());
  /* Angleichung an Editor: INNEN (PLI/SLI) zuerst, dann AUSSEN — alphabetisch
     stuende PLA vor PLI und die Seiten-Dreiecke saessen an der falschen
     Stelle. Innerhalb einer Seite nach Lagen-Nummer. */
  const lagenIds = Object.keys(sichtbarkeit.lagen).sort();
  const istInnen = id => /^S?PLI/i.test(id);
  const sortiert = lagenIds.slice().sort((a, b) =>
    (istInnen(a) === istInnen(b) ? a.localeCompare(b, 'de', { numeric: true }) : (istInnen(a) ? -1 : 1)));
  const innen = sortiert.filter(istInnen), aussen = sortiert.filter(id => !istInnen(id));
  const chipBauen = id => {
    const chip = document.createElement('span');
    chip.className = 'filter-chip' + (sichtbarkeit.lagen[id] ? ' an' : '');
    chip.dataset.lageChip = id;
    chip.title = id + ' ein-/ausblenden — Alt+Klick = Solo · Rechtsklick = Menü';
    chip.textContent = id;
    chip.onclick = ev => {
      if (ev.altKey) chipSoloUmschalten(sichtbarkeit.lagen, id, lagenIds);
      else sichtbarkeit.lagen[id] = !sichtbarkeit.lagen[id];
      ansichtAktualisieren();
    };
    return chip;
  };
  for (const id of innen) lWrap.appendChild(chipBauen(id));
  /* Seiten-Dreiecke an der Innen/Aussen-Grenze: schalten die Lagen-Chips
     DIREKT (Editor v2.45), Aktiv-Zustand ist aus den Lagen abgeleitet. */
  if (innen.length && aussen.length) {
    const zustand = ovSeiteAktiv();
    for (const [seite, symbol, titel] of [
      ['innen', '◀', 'Nur die Innen-Seite (PLI): alle Innen-Lagen an, Außen aus — nochmal Klick: alle an'],
      ['aussen', '▶', 'Nur die Außen-Seite (PLA): alle Außen-Lagen an, Innen aus — nochmal Klick: alle an']
    ]) {
      const d = document.createElement('span');
      d.className = 'seiten-dreieck' + (zustand === seite ? ' an' : '');
      d.dataset.seiteDreieck = seite;
      d.title = titel;
      d.textContent = symbol;
      d.onclick = () => ovSeiteSetzen(ovSeiteAktiv() === seite ? 'beide' : seite);
      lWrap.appendChild(d);
    }
  }
  for (const id of aussen) lWrap.appendChild(chipBauen(id));
}

/* Arbeitspaket 4: eindeutiger Auswahl-Schluessel je Wand-Karte. */
function kartenSchluessel(di, wandIndex) { return di + ':' + wandIndex; }

function gitterRendern() {
  const gitter = document.getElementById('kartenGitter');
  gitter.innerHTML = '';
  gitter.className = 'karten-gitter ansicht-' + kartenAnsicht;
  /* v0.13: Sortierung/Filter/Suche (§7b) — kartenReihenfolge ist die
     ANGEZEIGTE Reihenfolge (Shift-Bereich und Strg+A wirken nur auf das,
     was man sieht). */
  const { alle, sichtbar } = kartenEintraege();
  kartenReihenfolge = sichtbar.map(e => e.schluessel);
  /* v0.19: Ansicht "Liste" = Listen-Baustein (48_liste_wandliste.js) */
  if (kartenAnsicht === 'liste') { if (alle.length) wandlisteZeichnen(gitter); }
  else for (const e of sichtbar) gitter.appendChild(karteElementBauen(e));
  if (alle.length && !sichtbar.length && kartenAnsicht !== 'liste') {
    const leer = document.createElement('div');
    leer.className = 'karten-leer';
    leer.innerHTML = 'Keine Wand passt zu Suche/Filter. '
      + '<button type="button" class="schaltflaeche schaltflaeche-neben schaltflaeche-klein" data-kf-reset-gitter>Zurücksetzen</button>';
    leer.querySelector('button').onclick = filterZuruecksetzen;
    gitter.appendChild(leer);
  }
  kartenZaehlerSetzen(sichtbar.length, alle.length);
  /* Auswahl von VERSCHWUNDENEN Schluesseln bereinigen (z.B. nach Neuaufbau
     der Wand-Erkennung einer Datei) — nur ausgeblendete Karten bleiben
     ausgewaehlt, wirken aber nicht (sichtbareAuswahl). */
  const vorhanden = new Set(alle.map(e => e.schluessel));
  let bereinigt = false;
  for (const schluessel of [...auswahl]) if (!vorhanden.has(schluessel)) { auswahl.delete(schluessel); bereinigt = true; }
  if (auswahlAnker && !vorhanden.has(auswahlAnker)) auswahlAnker = null;
  auswahlHinweisRendern();
  if (bereinigt) quelltextStrukturAktualisieren();
}

/* Arbeitspaket 4: Klick-Logik der Karten-Mehrfachauswahl (Strg/Cmd = toggle,
   Shift = Bereich ab dem letzten Anker, sonst Einzelauswahl). Wird von einem
   Klick-Delegate auf #kartenGitter aufgerufen (siehe init()); Klicks auf
   Buttons INNERHALB der Karte (z.B. "Im Editor öffnen") loesen dort kein
   erneutes stopPropagation aus, werden aber vom Delegate selbst ausgefiltert. */
function kartenKlick(schluessel, ev) {
  const idx = kartenReihenfolge.indexOf(schluessel);
  if (idx < 0) return;
  if (ev.shiftKey && auswahlAnker) {
    const ankerIdx = kartenReihenfolge.indexOf(auswahlAnker);
    if (ankerIdx >= 0) {
      const [a, b] = ankerIdx < idx ? [ankerIdx, idx] : [idx, ankerIdx];
      auswahl = new Set(kartenReihenfolge.slice(a, b + 1));
    } else {
      auswahl = new Set([schluessel]);
    }
  } else if (ev.ctrlKey || ev.metaKey) {
    if (auswahl.has(schluessel)) auswahl.delete(schluessel); else auswahl.add(schluessel);
    auswahlAnker = schluessel;
  } else {
    auswahl = new Set([schluessel]);
    auswahlAnker = schluessel;
  }
  auswahlAnzeigenAktualisieren();
}
function auswahlLeeren() {
  if (!auswahl.size) return false;
  auswahl = new Set();
  auswahlAnker = null;
  auswahlAnzeigenAktualisieren();
  return true;
}
function auswahlAlle() {
  auswahl = new Set(kartenReihenfolge);
  auswahlAnker = kartenReihenfolge[kartenReihenfolge.length - 1] || null;
  auswahlAnzeigenAktualisieren();
}
/* Nur die Kartenklassen + den Hinweistext/das Panel aktualisieren - kein
   voller gitterRendern() (der wuerde auch die SVGs neu erzeugen). */
function auswahlAnzeigenAktualisieren() {
  document.querySelectorAll('#kartenGitter .karte').forEach(el => {
    el.classList.toggle('ausgewaehlt', auswahl.has(el.dataset.schluessel));
  });
  wandlisteAuswahlAbgleichen();   /* v0.19: Liste zieht die Karten-Auswahl nach */
  auswahlHinweisRendern();
  quelltextStrukturAktualisieren();
}
/* v0.13: nur ANGEZEIGTE ausgewaehlte Karten wirken — eine Karte, die ein
   Filter gerade ausblendet, soll keine Automatik abbekommen. */
function sichtbareAuswahl() { return kartenReihenfolge.filter(k => auswahl.has(k)); }
function auswahlHinweisText() {
  const sichtbar = sichtbareAuswahl();
  if (sichtbar.length) return sichtbar.length + ' ausgewählt — Automatik wirkt nur darauf'
    + (auswahl.size > sichtbar.length ? ' (' + (auswahl.size - sichtbar.length) + ' weitere ausgeblendet, wirken nicht)' : '');
  if (filterAktiv() && dateien.length) {
    const n = new Set(kartenReihenfolge.map(k => k.split(':')[0])).size;
    return 'Filter aktiv — Automatik wirkt auf die ' + n + ' angezeigte(n) Datei(en)';
  }
  return '';
}
function auswahlHinweisRendern() {
  const text = auswahlHinweisText();
  const span = document.getElementById('auswahlHinweis');
  if (span) span.textContent = text;
  const dialogSpan = document.getElementById('weAuswahlHinweis');
  if (dialogSpan) dialogSpan.textContent = text;
}
/* Arbeitspaket 4 (WIRKUNG): liefert die Menge der Datei-Indizes, auf die sich
   Automatik/Werte-ersetzen beschraenken sollen - oder null, wenn keine Karte
   ausgewaehlt ist (dann wie bisher: alle geladenen Dateien). */
function ausgewaehlteDateiIndizes() {
  /* v0.13: Reihenfolge der Wirkung — sichtbare Auswahl, sonst bei aktivem
     Filter/Suche die ANGEZEIGTEN Dateien (sonst wuerde "EG20 suchen ->
     Automatik" still alle Dateien aendern), sonst null = alle. */
  let quelle = sichtbareAuswahl();
  if (!quelle.length && filterAktiv()) quelle = kartenReihenfolge;
  else if (!quelle.length) return null;
  const menge = new Set();
  for (const schluessel of quelle) menge.add(parseInt(schluessel.split(':')[0], 10));
  return menge;
}
/* Zusatz fuer Ergebnis-Meldungen: worauf hat die Aktion gewirkt? */
function bereichZusatz(indizes) {
  if (!indizes) return '';
  return sichtbareAuswahl().length ? ' (Auswahl)' : ' (gefilterte Ansicht)';
}

function escapeHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

