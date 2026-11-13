/* Feedback K: gehoert ein Punkt zur Punkt-Mehrfachauswahl? (Anker segMark
   oder Zusatzliste segMarkMehr, jeweils an die Op gebunden) */
function segIstMarkiert(opId, idx) {
  if (ui.segMark && ui.segMark.opId === opId && ui.segMark.idx === idx) return true;
  return !!(ui.segMarkMehr && ui.segMarkMehr.opId === opId && ui.segMarkMehr.idxs.includes(idx));
}
function eigenschaftenWertUebernehmen(input) {
  const f = auswahlAufloesen();
  if (!f || !f.op) return;
  const op = f.op;
  const feld = input.dataset.feld;
  aenderungBeginnen();
  if (op.kw === 'NR') {
    if (feld === 'i') op.nr.i = parseInt(input.value, 10) || 0;
    else {
      const v = parseFloat(input.value.replace(',', '.'));
      if (!isNaN(v)) op.nr[feld] = v;
    }
  } else if (input.dataset.idx != null) {
    const idx = parseInt(input.dataset.idx, 10);
    /* Feedback K: Punkt in der Mehrfachauswahl -> Aenderung wirkt auf ALLE
       markierten Punkte (r nur auf Punkte, die ueberhaupt einen Radius haben) */
    const ziele = segIstMarkiert(op.id, idx)
      ? [...new Set([ui.segMark.idx,
          ...(ui.segMarkMehr && ui.segMarkMehr.opId === op.id ? ui.segMarkMehr.idxs : [])])]
      : [idx];
    for (const k of ziele) {
      const e = op.poly[k];
      if (!e) continue;
      if (feld === 'r' && e.type !== 'KB' && e.type !== 'MP') continue;
      if (feld === 'i') e.i = parseInt(input.value, 10) || 0;
      else {
        const v = parseFloat(input.value.replace(',', '.'));
        if (!isNaN(v)) e[feld] = v;
      }
    }
  }
  op._modified = true;
  alleNeuRendern(true);
}

/* =====================================================================
   §11 RECHTS-PANELS: Ansicht, Eigenschaften, Fehler-Log
   (Lagen-Liste in v2.45 entfernt — Lagen laufen ueber die Chips in der
   Werkzeugleiste, siehe lagenChipsRendern/kontextFuerLagenChip)
   ===================================================================== */
function lagenListeRendern() {
  /* GUI-M (Anwenderwunsch): die Lagen-LISTE rechts ist ENTFERNT — alle
     Informationen und Aktionen stecken in den Lagen-Chips der
     Werkzeugleiste (Klick = ein/aus, Alt+Klick = Solo, Rechtsklick =
     Material/Anzahl/NR-Auswahl). Der Funktionsname bleibt als zentraler
     Sync-Punkt aller Aufrufer bestehen. */
  lagenChipsRendern();
}
/* Aufraeumen v2.47: Standard-Folge nach einer Lagen-Sichtbarkeits-Aenderung
   (Chips nachziehen, Fangpunkte neu, Canvas neu) — vorher 4x als
   Dreifachaufruf verstreut. */
function lagenNeuZeichnen() {
  lagenListeRendern();
  snapPunkteAufbauen();
  svgRendern();
}
/* Alle NRs einer Lage in die Mehrfachauswahl — aus der Lagen-Liste UND dem
   Lagen-Chip-Kontextmenue (GUI-J) erreichbar. */
function lagenNrAuswaehlen(lage) {
  const nrs = lage.ops.filter(o => o.kw === 'NR');
  if (!nrs.length) return;
  opFilterSicherstellen('NR');
  if (!lage.sichtbar) { lage.sichtbar = true; lagenListeRendern(); snapPunkteAufbauen(); }
  ui.auswahl = { typ: 'op', id: nrs[0].id, lageId: lage.id };
  ui.mehrAuswahl = nrs.slice(1).map(o => o.id);
  svgRendern(); eigenschaftenRendern(); baumAuswahlMarkieren();
  hinweisAnzeigen(nrs.length + ' Nagelreihen von ' + lage.id + ' ausgewaehlt — Werte rechts gemeinsam aendern.', 'info');
}
function fehlerLogRendern() {
  const el = document.getElementById('fehlerLog');
  const zus = document.getElementById('logZusammenfassung');
  const pfeil = document.getElementById('logPfeil');
  if (pfeil) pfeil.textContent = ui.logZu ? '▸' : '▾';
  if (!modell) { el.innerHTML = '—'; zus.textContent = ''; return; }
  const P = modell.pruefungen || [];
  const nF = P.filter(p => p.level === 'fehler').length;
  const nW = P.filter(p => p.level === 'warnung').length;
  const nH = P.length - nF - nW;
  zus.innerHTML = (nF ? '<span class="zaehler zaehler-fehler">' + nF + '</span> ' : '')
    + (nW ? '<span class="zaehler zaehler-warnung">' + nW + '</span> ' : '')
    + (nH ? '<span class="zaehler">' + nH + ' ℹ</span>' : '')
    + (!P.length ? '<span class="zaehler-ok">✓</span>' : '');
  el.style.display = ui.logZu ? 'none' : '';
  if (ui.logZu) return;
  if (!P.length) { el.innerHTML = '<span class="mini-hinweis">✓ Keine Befunde — Datensatz sieht maschinenfertig aus.</span>'; return; }
  /* A-04: nach Code gruppieren; GUI-E: nach Schwere sortieren + Level-Filter */
  const gruppen = new Map();
  P.forEach((p, idx) => {
    if (!gruppen.has(p.code)) gruppen.set(p.code, { level: p.level, eintraege: [] });
    gruppen.get(p.code).eintraege.push({ p, idx });
  });
  const filter = ui.logFilter || (ui.logFilter = { fehler: true, warnung: true, hinweis: true });
  const chip = (level, symbol, n) => n === 0 ? '' :
    '<span class="log-filter-chip' + (filter[level] ? ' aktiv' : '') + '" data-log-filter="' + level
    + '" title="' + level + '-Befunde ein-/ausblenden">' + symbol + ' ' + n + '</span>';
  const filterHtml = '<div class="log-filter">' + chip('fehler', '⛔', nF)
    + chip('warnung', '⚠️', nW) + chip('hinweis', 'ℹ️', nH) + '</div>';
  const fixFuer = code =>
    code === 'P-03' || code === 'P-15' ? '<button class="schaltflaeche schaltflaeche-klein" data-fix="psf">Fix: PSF</button>'
    : code === 'P-10' ? '<button class="schaltflaeche schaltflaeche-klein" data-fix="freistich">Fix: Freistiche</button>'
    : code === 'P-09' ? '<button class="schaltflaeche schaltflaeche-klein" data-fix="f1">Fix: ⊕⊖</button>' : '';
  const symbol = { fehler: '⛔', warnung: '⚠️', hinweis: 'ℹ️' };
  const reihung = { fehler: 0, warnung: 1, hinweis: 2 };
  const sichtbar = [...gruppen.entries()].filter(([, g]) => filter[g.level] !== false)
    .sort((a, b) => (reihung[a[1].level] ?? 3) - (reihung[b[1].level] ?? 3) || a[0].localeCompare(b[0]));
  el.innerHTML = filterHtml + (sichtbar.length ? sichtbar.map(([code, g]) => {
    const offen = ui._logOffen && ui._logOffen[code];
    const kurz = g.eintraege[0].p.msg.split('—')[0].split(':')[0].trim();
    return '<div class="log-gruppe">'
      + '<div class="log-gruppe-kopf log-' + g.level + '" data-log-gruppe="' + code + '">'
      + '<span>' + (offen ? '▾' : '▸') + '</span>' + (symbol[g.level] || '') + ' <span class="log-code">' + code + '</span> '
      + escapeHtml(kurz) + ' <span class="log-anzahl">' + g.eintraege.length + '</span> ' + fixFuer(code) + '</div>'
      + (offen ? g.eintraege.map(e =>
          /* Detailzeile OHNE den CODE_NAME-Vorspann — der steht schon im Gruppenkopf */
          '<div class="log-zeile log-' + e.p.level + '" data-pidx="' + e.idx + '">'
          + escapeHtml(e.p.msg.replace(/^[A-Z0-9_]+:\s*/, ''))
          + (e.p.lageId ? ' <span class="mini-hinweis">[' + e.p.lageId + ']</span>' : '')
          + '</div>').join('') : '')
      + '</div>';
  }).join('') : '<span class="mini-hinweis">Alle Level ausgeblendet — Chips oben aktivieren.</span>');
}
/* Feedback K (Anwenderwunsch): beim Klick auf einen konkreten Befund
   HANDLUNGSMOEGLICHKEITEN anzeigen — Auswahl/Zoom passiert weiter beim
   Klick, darunter erscheint eine kleine Aktions-Leiste. */
function logAktionenFuer(p) {
  const a = [];
  if (p.ref) a.push({ akt: 'eigenschaften', text: '✎ Eigenschaften' });
  if (p.ref && p.ref.typ === 'op') a.push({ akt: 'op-loeschen', text: '🗑 Loeschen' });
  if (p.code === 'P-19') a.push({ akt: 'popup', text: '⚠ Index-Vorschlag (Popup)' });
  if (p.code === 'P-21') a.push({ akt: 'neigung', text: '∠ Neigungen auf 0°' });
  if (p.code === 'P-22') a.push({ akt: 'nr25', text: 'NR 25 → 20 (PLA)' });
  if (p.code === 'P-03' || p.code === 'P-15') a.push({ akt: 'psf', text: 'Fix: PSF' });
  if (p.code === 'P-10') a.push({ akt: 'freistich', text: 'Fix: Freistiche' });
  if (p.code === 'P-09') a.push({ akt: 'f1', text: 'Fix: ⊕⊖' });
  a.push({ akt: 'strgh', text: '🔁 Werte ersetzen…' });
  return a;
}
function logAktionAusfuehren(akt) {
  if (akt === 'eigenschaften') {
    const inhalt = document.getElementById('eigenschaften');
    inhalt.style.display = '';
    eigenschaftenRendern();
    inhalt.scrollIntoView({ block: 'nearest' });
  } else if (akt === 'op-loeschen') eigenschaftenAktion('op-loeschen');
  else if (akt === 'popup') { pruefungenAusfuehren(); gravierendeBefundePopup(true); }
  else if (akt === 'neigung') { const n = neigungenNullen(); hinweisAnzeigen(n + ' Neigungswinkel auf 0° gesetzt.', 'erfolg'); }
  else if (akt === 'nr25') { const n = nrIndex25PlaKorrigieren(); hinweisAnzeigen(n + ' Nagelreihe(n) auf 20 gesetzt.', 'erfolg'); }
  else if (akt === 'psf') f3AutoPsf();
  else if (akt === 'freistich') f2SammelAktion();
  else if (akt === 'f1') f1AlleAusfuehren();
  else if (akt === 'strgh') werteErsetzenOeffnen();
}
function fehlerLogKlick(ev) {
  const akt = ev.target.closest('[data-log-akt]');
  if (akt) { ev.stopPropagation(); logAktionAusfuehren(akt.dataset.logAkt); return; }
  const filterChip = ev.target.closest('[data-log-filter]');
  if (filterChip) {
    const level = filterChip.dataset.logFilter;
    ui.logFilter[level] = !ui.logFilter[level];
    fehlerLogRendern();
    return;
  }
  const fixBtn = ev.target.closest('[data-fix]');
  if (fixBtn) {
    ev.stopPropagation();
    if (fixBtn.dataset.fix === 'psf') f3AutoPsf();
    else if (fixBtn.dataset.fix === 'freistich') f2SammelAktion();
    else if (fixBtn.dataset.fix === 'f1') f1AlleAusfuehren();
    return;
  }
  const gruppe = ev.target.closest('[data-log-gruppe]');
  if (gruppe) {
    ui._logOffen = ui._logOffen || {};
    const code = gruppe.dataset.logGruppe;
    ui._logOffen[code] = !ui._logOffen[code];
    fehlerLogRendern();
    return;
  }
  const zeile = ev.target.closest('[data-pidx]');
  if (!zeile || !modell) return;
  const p = (modell.pruefungen || [])[parseInt(zeile.dataset.pidx, 10)];
  if (!p) return;
  if (p.ref && p.ref.typ === 'op') {
    const f = opFinden(p.ref.id);
    if (f) {
      ui.mehrAuswahl = [];
      auswahlSetzen({ typ: 'op', id: f.op.id, lageId: f.lage.id });
      opZoomen(f.op);                 /* SVG fokussieren */
      fehlerElementBlitzen(f.op.id);  /* SVG-Blitz */
      textZuElementScrollen();        /* Quelltext zur Zeile scrollen */
      baumAuswahlMarkieren();         /* Struktur aufklappen + scrollen */
    }
  } else if (p.ref && p.ref.typ === 'platte') {
    const f = platteFinden(p.ref.id);
    if (f) {
      ui.mehrAuswahl = [];
      auswahlSetzen({ typ: 'platte', id: f.platte.id, lageId: f.lage.id });
      textZuElementScrollen();
      baumAuswahlMarkieren();
    }
  }
  /* Feedback K: Aktions-Leiste unter dem angeklickten Befund */
  document.querySelectorAll('#fehlerLog .log-aktionen').forEach(x => x.remove());
  const aktionen = logAktionenFuer(p);
  if (aktionen.length) zeile.insertAdjacentHTML('afterend',
    '<div class="log-aktionen">' + aktionen.map(a =>
      '<button class="schaltflaeche schaltflaeche-klein" data-log-akt="' + a.akt + '">' + a.text + '</button>').join('')
    + '</div>');
}
function fehlerElementBlitzen(opId) {
  ui._flashOpId = opId;
  svgRendern();
  clearTimeout(ui._flashTimer);
  ui._flashTimer = setTimeout(() => { ui._flashOpId = null; if (modell) svgRendern(); }, 1500);
}
function opZoomen(op) {
  const pts = op.nr ? [[op.nr.xa, op.nr.ya], [op.nr.xe, op.nr.ye]] : opPolyAlsArray(op);
  if (!pts.length) return;
  const b = Geo.bbox(pts);
  const wrap = document.getElementById('canvasWrapper');
  const breite = Math.max(b.maxX - b.minX, 200), hoehe = Math.max(b.maxY - b.minY, 200);
  ui.scale = Math.min((wrap.clientWidth - 120) / breite, (wrap.clientHeight - 120) / hoehe, 2);
  const cx = (b.minX + b.maxX) / 2, cy = (b.minY + b.maxY) / 2;
  const ELM = modell.header.ELM;
  const wx = spiegelX() ? ELM.lx - cx : cx;
  const wy = spiegelY() ? cy : ELM.by - cy;
  ui.pan.x = wrap.clientWidth / 2 - wx * ui.scale;
  ui.pan.y = wrap.clientHeight / 2 - wy * ui.scale;
  svgRendern();
}

function baumRendern() {
  const el = document.getElementById('baumInhalt');
  if (!el) return;
  if (!modell) { el.innerHTML = '<div class="mini-hinweis" style="padding:8px">Keine Datei geladen.</div>'; return; }
  const h = modell.header;
  const t = [];
  /* A-03: Element-Infos einmalig als Wurzel */
  t.push('<div class="baum-wurzel"><b>' + escapeHtml(h.ELN || modell.dateiName) + '</b>'
    + (h.ZNR ? ' · ZNR ' + escapeHtml(h.ZNR) : '') + (h.ELB ? ' · ' + escapeHtml(h.ELB) : '')
    + '<br>ELM ' + fmtZahl(h.ELM.lx) + ' × ' + fmtZahl(h.ELM.by) + ' × ' + fmtZahl(h.ELM.hz)
    + ' mm · ' + escapeHtml(h.ELA || 'INNEN') + ' · V' + escapeHtml(h.VERSION || '?')
    + ' · ' + modell.encoding + (modell.hatteBom ? '+BOM' : '')
    + (h.CAD ? '<br>CAD: ' + escapeHtml((h.CAD + ' ' + (h.CADRELEASE || '')).trim()) : '')
    + (modell.multiwand ? '<br>⚠ <b>Multiwand</b>: ' + modell.subWalls.map(w =>
        escapeHtml(w.eln || ('Element ' + w.num))).join(', ') : '')
    + '</div>');
  const aufKlasse = id => (ui.auswahl && ui.auswahl.id === id) ? ' ausgewaehlt' : '';
  /* Riegelwerk */
  if (modell.beams.length) {
    t.push('<div class="baum-knoten"><div class="baum-kopf" data-baum-klapp="riegel">'
      + '<span data-pfeil>▸</span> Riegelwerk <span class="mini-hinweis">(' + modell.beams.length + ')</span></div>'
      + '<div class="baum-kinder" data-baum-kinder="riegel" style="display:none">'
      + modell.beams.map(b => '<div class="baum-blatt' + aufKlasse(b.id) + '" data-baum-beam="' + b.id + '">'
        + '<span class="baum-punkt" style="background:var(--svg-riegel)"></span>'
        + b.kw + ' ' + escapeHtml(b.name || '') + '</div>').join('')
      + '</div></div>');
  }
  /* Lagen */
  for (const lage of modell.layers) {
    const farbe = lagenFarbe(lage);
    const kinder = [];
    for (const platte of lage.plates)
      kinder.push('<div class="baum-blatt' + aufKlasse(platte.id) + '" data-baum-platte="' + platte.id
        + '" data-baum-lage="' + lage.id + '"><span class="baum-punkt" style="background:' + farbe + '"></span>'
        + platte.kw + ' ' + escapeHtml(platte.name || '') + ' <span class="mini-hinweis">'
        + fmtZahl(platte.lx) + '×' + fmtZahl(platte.by) + '</span></div>');
    for (const op of lage.ops) {
      const info = op.kw === 'NR'
        ? 'a=' + fmtZahl(op.nr.a) + ' i=' + op.nr.i
        : (op.poly || []).length + ' Pkt' + (opMaxTiefe(op) ? ' t=' + fmtZahl(opMaxTiefe(op)) : '');
      kinder.push('<div class="baum-blatt' + aufKlasse(op.id) + '" data-baum-op="' + op.id
        + '" data-baum-lage="' + lage.id + '"><span class="baum-punkt" style="background:var(--syn-'
        + op.kw.toLowerCase() + ', var(--text-gedimmt))"></span>'
        + op.kw + (op.auto ? ' <span class="abzeichen-auto">AUTO</span>' : '')
        + ' <span class="mini-hinweis">' + info + '</span></div>');
    }
    t.push('<div class="baum-knoten"><div class="baum-kopf" data-baum-klapp="' + lage.id + '">'
      + '<span data-pfeil>▸</span><span class="baum-punkt" style="background:' + farbe + '"></span> '
      + lage.id + ' <span class="mini-hinweis">(' + lage.plates.length + ' Pl, ' + lage.ops.length
      + ' Op, hz ' + fmtZahl(lage.hz) + ')</span></div>'
      + '<div class="baum-kinder" data-baum-kinder="' + lage.id + '" style="display:none">' + kinder.join('') + '</div></div>');
  }
  el.innerHTML = t.join('');
}
function baumAuswahlMarkieren() {
  const el = document.getElementById('baumInhalt');
  if (!el || !modell) return;
  el.querySelectorAll('.ausgewaehlt').forEach(n => n.classList.remove('ausgewaehlt'));
  if (!ui.auswahl) return;
  /* alle ausgewaehlten IDs (Anker + Mehrfachauswahl) markieren */
  const ids = [ui.auswahl.id, ...(ui.mehrAuswahl || [])];
  let ersterTreffer = null;
  for (const id of ids) {
    const knoten = el.querySelector('[data-baum-op="' + id + '"],[data-baum-platte="'
      + id + '"],[data-baum-beam="' + id + '"]');
    if (!knoten) continue;
    knoten.classList.add('ausgewaehlt');
    if (!ersterTreffer) ersterTreffer = knoten;
    const kinder = knoten.closest('[data-baum-kinder]');
    if (kinder && kinder.style.display === 'none') {
      kinder.style.display = '';
      const kopf = el.querySelector('[data-baum-klapp="' + kinder.dataset.baumKinder + '"] [data-pfeil]');
      if (kopf) kopf.textContent = '▾';
    }
  }
  /* Anker selbst sichtbar scrollen */
  const anker = el.querySelector('[data-baum-op="' + ui.auswahl.id + '"],[data-baum-platte="'
    + ui.auswahl.id + '"],[data-baum-beam="' + ui.auswahl.id + '"]') || ersterTreffer;
  if (anker && ui.textTab === 'struktur') anker.scrollIntoView({ block: 'nearest' });
  /* Quelltext-Markierung der (Mehrfach-)Auswahl mitziehen */
  if (ui.textTab === 'quelltext') textPanelRendern();
}
function baumKlick(ev) {
  const klapp = ev.target.closest('[data-baum-klapp]');
  if (klapp) {
    const kinder = document.querySelector('[data-baum-kinder="' + klapp.dataset.baumKlapp + '"]');
    const zu = kinder.style.display === 'none';
    kinder.style.display = zu ? '' : 'none';
    klapp.querySelector('[data-pfeil]').textContent = zu ? '▾' : '▸';
    return;
  }
  const blatt = ev.target.closest('[data-baum-op],[data-baum-platte],[data-baum-beam]');
  if (!blatt || !modell) return;
  if (blatt.dataset.baumOp) {
    const f = opFinden(blatt.dataset.baumOp);
    if (!f) return;
    if (ev.ctrlKey || ev.metaKey) { opAuswahlUmschalten(f.op.id, f.lage.id); return; }
    if (ev.shiftKey) { opAuswahlBereich(f.op.id, f.lage.id); return; }
    ui.mehrAuswahl = [];
    auswahlSetzen({ typ: 'op', id: f.op.id, lageId: f.lage.id });
    opZoomen(f.op);
  } else if (blatt.dataset.baumPlatte) {
    const f = platteFinden(blatt.dataset.baumPlatte);
    if (f) auswahlSetzen({ typ: 'platte', id: f.platte.id, lageId: f.lage.id });
  } else if (blatt.dataset.baumBeam) {
    auswahlSetzen({ typ: 'beam', id: blatt.dataset.baumBeam });
  }
}
function textTabSetzen(tab) {
  ui.textTab = tab;
  document.querySelectorAll('.text-tab').forEach(t2 =>
    t2.classList.toggle('aktiv', t2.dataset.tab === tab));
  document.getElementById('textScroller').classList.toggle('versteckt', tab !== 'quelltext');
  document.getElementById('baumScroller').classList.toggle('versteckt', tab !== 'struktur');
  if (tab === 'quelltext') textPanelRendern();
  else { baumRendern(); baumAuswahlMarkieren(); }
}


function statistikRendern() {
  const el = document.getElementById('statistik');
  if (!modell) { el.textContent = ''; return; }
  let nPl = 0, nOps = 0, nNaegel = 0, nFraes = 0;
  for (const lage of modell.layers) {
    nPl += lage.plates.length;
    for (const op of lage.ops) {
      nOps++;
      if (op.kw === 'NR') nNaegel += nagelPunkte(op).length;
      if (op.kw === 'PAF' || op.kw === 'PSG') nFraes++;
    }
  }
  el.textContent = modell.layers.length + ' Lagen · ' + nPl + ' Platten · ' + modell.beams.length
    + ' Bauteile · ' + nOps + ' Bearbeitungen · ' + nFraes + ' Saege/Fraes · ~' + nNaegel + ' Befestigungen';
}
function fehlerZaehlerRendern() {
  const el = document.getElementById('fehlerZaehler');
  if (!modell) { el.innerHTML = ''; return; }
  const P = modell.pruefungen || [];
  const nF = P.filter(p => p.level === 'fehler').length;
  const nW = P.filter(p => p.level === 'warnung').length;
  el.innerHTML = (nF ? '<span class="zaehler zaehler-fehler" title="Fehler">' + nF + '</span>' : '')
    + (nW ? '<span class="zaehler zaehler-warnung" title="Warnungen">' + nW + '</span>' : '')
    + (!nF && !nW ? '<span class="zaehler zaehler-ok" title="Keine Befunde">✓</span>' : '');
}

