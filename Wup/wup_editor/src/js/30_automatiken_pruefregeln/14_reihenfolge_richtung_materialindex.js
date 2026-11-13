/* =====================================================================
   F5 — BEARBEITUNGS-REIHENFOLGE (manuell)
   Die fruehere automatische Nearest-Neighbor-Sortierung wurde entfernt
   (lieferte in der Praxis keine brauchbaren Wege). Stattdessen verschiebt
   der Anwender Bearbeitungen einzeln in der Maschinen-Reihenfolge.
   ===================================================================== */
function opVerschieben(op, lage, richtung) {
  const i = lage.ops.indexOf(op);
  if (i < 0) return;
  const j = i + richtung;
  if (j < 0 || j >= lage.ops.length) {
    hinweisAnzeigen(richtung < 0 ? 'Bereits die erste Bearbeitung der Lage.'
      : 'Bereits die letzte Bearbeitung der Lage.', 'info');
    return;
  }
  aenderungBeginnen();
  [lage.ops[i], lage.ops[j]] = [lage.ops[j], lage.ops[i]];
  lage._reihenfolgeGeaendert = true;
  /* beide getauschten Ops als geaendert markieren, damit der Export sie an
     neuer Position schreibt (Line-Replacement) */
  lage.ops[i]._modified = true;
  lage.ops[j]._modified = true;
  alleNeuRendern(true);
  hinweisAnzeigen('Reihenfolge geaendert: ' + op.kw + ' '
    + (richtung < 0 ? 'frueher' : 'spaeter') + '.', 'erfolg');
}

/* =====================================================================
   WP-D: RICHTUNGSBEARBEITUNG erkennen (Hauskonvention, siehe Profil).
   Kennzeichnet Lage/Richtung eines Bauteils fuer den Abgleich WUP <->
   Abbund-Datei (BVN/BVX). Kriterien: BOZ (oder PAF mit einzelnem MP) im
   Ober-/Untergurt, Durchmesser ~profil.richtung.durchmesser, geringe Tiefe,
   und EINDEUTIG einem Bauteilende zugeordnet (nicht nahe der Mitte).
   Rueckgabe je Treffer: { bb, bx, d, t, eindeutig, ende:'anfang'|'ende' }.
   ===================================================================== */
function richtungsbearbeitungFinden(beam) {
  const r = profil.richtung;
  const laenge = beam.lx || 0;
  const treffer = [];
  for (const bb of (beam.bearbeitungen || [])) {
    let bx = null, byPos = 0, d = null, t = null;
    if (bb.kw === 'BOZ' && bb.params.length >= 4) {
      bx = zahl(bb.params[0]); byPos = zahl(bb.params[1]) || 0;
      d = Math.abs(zahl(bb.params[2])); t = Math.abs(zahl(bb.params[3]));
    } else if (bb.kw === 'PAF' && (bb.poly || []).length === 1 && bb.poly[0].type === 'MP') {
      /* Zukunftsvariante PAF+MP (siehe beamBozErsetzen): x dort bauteilrelativ
         gehalten; falls er doch absolut aussieht, auf beam.x zurueckrechnen */
      const mp = bb.poly[0];
      bx = mp.x; byPos = mp.y || 0;
      if (laenge > 0 && (bx < -1 || bx > laenge + 1) && beam.x != null) { bx = mp.x - beam.x; byPos = (mp.y || 0) - (beam.y || 0); }
      d = Math.abs(mp.r || 0) * 2; t = Math.abs(mp.t || 0);
    } else continue;
    if (bx == null || isNaN(bx) || isNaN(d) || isNaN(t)) continue;
    if (Math.abs(d - r.durchmesser) > r.d_toleranz) continue;
    if (t < r.tiefe_min || t > r.tiefe_max) continue;
    const eindeutig = laenge > 0 && Math.abs(bx - laenge / 2) >= laenge * r.mitte_sperrzone;
    treffer.push({ bb, bx, byPos, d, t, eindeutig, ende: bx <= laenge / 2 ? 'anfang' : 'ende' });
  }
  return treffer;
}
/* =====================================================================
   WP-H: Materialindex-VORSCHLAG aus dem Platten-Namen — Zuordnung nach der
   Weinmann-Materialindextabelle (Schnittstellenbeschreibung 4.3), ergaenzt
   um real belegte Zuordnungen (Gipsfaser -> 10 wie in den
   SEMA-Exporten). Reihenfolge zaehlt (gipsfaser VOR gips pruefen).
   ===================================================================== */
const MATERIAL_NAME_VORSCHLAG = [
  [/osb/i, 30], [/fermacell/i, 10], [/gipsfaser/i, 10], [/gipskarton|gkb|gkp/i, 70], [/gips/i, 60],
  [/weichfaser|gutex|steico|dwd/i, 20], [/spanplatte|span/i, 40], [/putztr/i, 50], [/sperrholz/i, 90],
  [/multiplex/i, 190], [/hartfaser/i, 200], [/dreischicht/i, 120], [/folie|dampf/i, 180],
  [/zellulose/i, 230], [/mineralwolle/i, 250], [/holzfaser|isocell|daemm|d.mmung/i, 240],
  [/porenbeton|beton/i, 220], [/latt|verschal/i, 110]
];
function materialIndexVorschlag(name) {
  for (const [muster, idx] of MATERIAL_NAME_VORSCHLAG)
    if (muster.test(name || '')) return { idx, klasse: materialKlasse(idx) };
  return null;
}
/* Platten mit Index 0, gruppiert nach Namens-Praefix (Nummer am Ende
   ignoriert) — Grundlage fuer P-19 UND das Popup mit Uebernehmen-Knopf. */
function plattenIdxNullGruppen() {
  const gruppen = new Map();
  for (const lage of (modell ? modell.layers : [])) {
    for (const p of lage.plates) {
      if ((p.materialIdx || 0) !== 0) continue;
      const praefix = (p.name || '(ohne Name)').replace(/-\d+$/, '');
      if (!gruppen.has(praefix))
        gruppen.set(praefix, { praefix, anzahl: 0, vorschlag: materialIndexVorschlag(praefix) });
      gruppen.get(praefix).anzahl++;
    }
  }
  return Array.from(gruppen.values());
}
/* WP-H: alle Neigungswinkel (alpha) an PAF/PSG-Punkten auf 0° setzen —
   Korrektur-Aktion zu P-21. Rueckgabe: Anzahl genullter Punkte. */
function neigungenNullen() {
  if (!modell) return 0;
  let anzahl = 0, begonnen = false;
  for (const lage of modell.layers) {
    for (const op of lage.ops) {
      if (op.kw !== 'PAF' && op.kw !== 'PSG') continue;
      for (const e of (op.poly || [])) {
        if ((e.type === 'PP' || e.type === 'KB') && e.alpha && Math.abs(e.alpha) > 0.001) {
          if (!begonnen) { aenderungBeginnen(); begonnen = true; }
          e.alpha = 0;
          op._modified = true;
          anzahl++;
        }
      }
    }
  }
  if (anzahl) alleNeuRendern(true);
  return anzahl;
}
/* WP-I: NR-Geraeteindex 25 in allen PLA-Lagen auf 20 stellen — Korrektur zu
   P-22 (die Maschine stellt 20 fuer die Aussenlage selbst auf 25 um; steht
   schon 25 im Datensatz, greift die Umstellung nicht wie vorgesehen).
   Laeuft ueber werteErsetzen mit Lagen-Filter (ein Undo-Schritt, nur bei
   Treffern). Rueckgabe: Anzahl geaenderter Nagelreihen. */
function nrIndex25PlaKorrigieren() {
  if (!modell) return 0;
  const plaLagen = modell.layers.filter(l => l.side === 'aussen').map(l => l.id);
  if (!plaLagen.length) return 0;
  return werteErsetzen({ feld: 'nrIndex', suchwert: 25, ersatzwert: 20,
    bereich: 'alle', lagenFilter: plaLagen }).treffer;
}
/* WP-H: Popup fuer GRAVIERENDE Befunde direkt nach dem Laden (Anwenderwunsch):
   P-19 Platten ohne Materialindex (mit Namens-Praefix + Index-Vorschlag nach
   Weinmann 4.3 und Uebernehmen-Knopf je Gruppe), P-21 geneigte PAF/PSG-
   Punkte (mit "alle auf 0°"-Knopf) und P-22 NR-Index 25 in PLA (mit
   "25 -> 20"-Knopf). Jeder Befund wird ERKLAERT (Anwenderwunsch): warum er
   die Fertigung stoert und was der Korrektur-Knopf genau tut.
   Erscheint einmal je geladener Datei. */
function gravierendeBefundePopup(erzwingen) {
  /* erzwingen = true (Knopf im Fehler-Log): auch zeigen, wenn das Popup fuer
     diese Datei schon einmal gemeldet wurde. Rueckgabe: true = Popup offen. */
  if (!modell || (modell._gravierendGemeldet && !erzwingen)) return false;
  const gruppen = plattenIdxNullGruppen();
  const geneigte = modell.pruefungen ? modell.pruefungen.filter(p => p.code === 'P-21') : [];
  const nr25 = modell.pruefungen ? modell.pruefungen.filter(p => p.code === 'P-22') : [];
  const ohnePunkte = modell.pruefungen ? modell.pruefungen.filter(p => p.code === 'P-23') : [];
  const boz = modell.pruefungen ? modell.pruefungen.filter(p => p.code === 'P-24') : [];
  if (!gruppen.length && !geneigte.length && !nr25.length && !ohnePunkte.length && !boz.length) return false;
  modell._gravierendGemeldet = true;
  document.querySelectorAll('.modal-hintergrund').forEach(m => m.remove());
  const hg = document.createElement('div');
  hg.className = 'modal-hintergrund';
  /* Anwenderwunsch: kurze Befund-Zeile, die GENAUE Erklaerung klappt erst
     ueber den ?-Knopf aus (data-hilfe im Klick-Handler unten). */
  const hilfe = (kurz, lang) => '<div class="modal-untertitel">' + kurz
    + ' <button type="button" class="grav-hilfe" data-hilfe title="Genaue Erklaerung ein-/ausblenden">?</button>'
    + '<span class="grav-hilfe-text versteckt">' + lang + '</span></div>';
  const teile = ['<div class="modal-fenster" role="dialog" aria-label="Gravierende Befunde">'
    + '<h2>⚠ Gravierende Befunde in dieser Datei</h2>'
    + '<div class="modal-untertitel">Diese Punkte verhindern eine saubere Fertigung und sollten VOR dem Export behoben werden.</div>'];
  if (gruppen.length) {
    teile.push('<div class="karten-titel" style="margin-top:10px">Platten ohne Materialindex (i = 0)</div>');
    teile.push(hilfe('Ohne Materialindex kann die Maschine das Plattenmaterial nicht zuordnen.',
      'Ueber den Materialindex ordnet die Maschine der Platte ihr Material und damit Werkzeug- und '
      + 'Bearbeitungsparameter zu. Mit i = 0 kann sie das Material nicht bestimmen — die Lage wird falsch oder gar '
      + 'nicht gefertigt. Der Vorschlag ist aus dem Platten-Namen nach der Weinmann-Materialindextabelle (4.3) '
      + 'abgeleitet; „uebernehmen" setzt ihn NUR bei Platten, deren Name mit dem gezeigten Praefix beginnt '
      + '(laufende Nummer am Ende wird ignoriert) — andere Platten bleiben unberuehrt.'));
    teile.push('<table class="modal-tabelle"><tr><th>Platten-Name (beginnend mit)</th><th>Anzahl</th><th>Vorschlag (Weinmann 4.3)</th><th></th></tr>'
      + gruppen.map((g, i) =>
        '<tr><td>' + escapeHtml(g.praefix) + '…</td><td>' + g.anzahl + '×</td>'
        + '<td>' + (g.vorschlag ? '<b>' + g.vorschlag.idx + '</b> — ' + escapeHtml(g.vorschlag.klasse) : '<span class="mini-hinweis">kein Vorschlag — Strg+H nutzen</span>') + '</td>'
        + '<td>' + (g.vorschlag
          ? '<button class="schaltflaeche schaltflaeche-klein schaltflaeche-haupt" data-idx-fix="' + i + '">Index ' + g.vorschlag.idx + ' uebernehmen</button>'
          : '') + '</td></tr>').join('')
      + '</table>');
  }
  if (geneigte.length) {
    const punkte = geneigte.reduce((s, p) => s + (parseInt((p.msg.match(/hat (\d+) Punkt/) || [])[1], 10) || 0), 0);
    teile.push('<div class="karten-titel" style="margin-top:14px">PAF/PSG mit Neigungswinkel ≠ 0°</div>'
      + hilfe(geneigte.length + ' Kontur(en) mit ' + punkte + ' geneigten Punkt(en) — die Anlage saegt/fraest nur senkrecht.',
        'Einen Neigungswinkel ≠ 0° kann die Anlage nicht ausfuehren, die Kontur wird abgewiesen oder falsch '
        + 'gefertigt. Der Knopf setzt den Winkel an allen betroffenen PAF/PSG-Punkten auf 0° (ein Undo-Schritt); '
        + 'Lage und Verlauf der Konturen bleiben unveraendert, andere Winkel (z.B. an Sperrflaechen) werden '
        + 'nicht angefasst.')
      + '<button class="schaltflaeche schaltflaeche-klein schaltflaeche-haupt" data-neigung-fix>Alle Neigungswinkel auf 0° setzen</button>'
      + '<span class="mini-hinweis" id="neigungFixErgebnis" style="margin-left:8px"></span>');
  }
  if (nr25.length) {
    teile.push('<div class="karten-titel" style="margin-top:14px">Nagelreihen mit Geraeteindex 25 in der Aussenlage (PLA)</div>'
      + hilfe(nr25.length + ' Nagelreihe(n) — in Aussenlagen gehoert Geraeteindex 20 in den Datensatz.',
        'Fuer die Aussenlage liest die Maschine Geraeteindex 20 aus dem Datensatz und stellt SELBST auf Geraet 25 '
        + 'um. Steht dort bereits 25, greift diese automatische Umstellung nicht wie vorgesehen und die Befestigung '
        + 'laeuft mit falscher Geraetezuordnung. Der Knopf setzt den Index 25 → 20 fuer alle Nagelreihen in '
        + 'PLA-Lagen (ein Undo-Schritt); Innenlagen (PLI) bleiben unberuehrt.')
      + '<button class="schaltflaeche schaltflaeche-klein schaltflaeche-haupt" data-nr25-fix>NR-Index 25 → 20 in PLA setzen</button>'
      + '<span class="mini-hinweis" id="nr25FixErgebnis" style="margin-left:8px"></span>');
  }
  if (ohnePunkte.length) {
    /* v2.57 P-23: bewusst OHNE Korrektur-Knopf — die fehlenden Punkte sind
       nicht rekonstruierbar; "leere Kontur loeschen" wuerde nur die
       WupWorks-Warnung unterdruecken, die Bearbeitung fehlte weiter. */
    teile.push('<div class="karten-titel" style="margin-top:14px">Konturen ohne Punkte (weniger als 2)</div>'
      + hilfe(ohnePunkte.length + ' Kontur(en) ohne ausreichende Punkte — dort fehlt die Bearbeitung (z. B. ein Sägeschnitt).',
        'Eine PSG/PAF/PSF/PSZ/PML braucht mindestens zwei Punkte (ein Kreis MP oder Rechteck TA zählt als vollständig). '
        + 'Mit weniger meldet WupWorks5 „must at least contain two points" und LÄSST DIE BEARBEITUNG WEG — die Wand wird '
        + 'ohne diesen Schnitt gefertigt. Die fehlenden Punkte lassen sich nicht erraten, darum gibt es hier keinen '
        + 'Korrektur-Knopf: Bitte von der Originaldatei (CAD-Export) neu ausgehen oder die Punkte im Quelltext ergänzen. '
        + 'Bekannte Ursache bis v2.55: Auto-Kontur bei einer auskommentierten Punktzeile („TXT PP, …") in einer PSG.')
      + '<ul class="grav-liste">' + ohnePunkte.slice(0, 12).map(p =>
        '<li>' + escapeHtml(p.msg.replace(/^KONTUR_OHNE_PUNKTE: /, '').split(' — ')[0]) + '</li>').join('')
      + (ohnePunkte.length > 12 ? '<li>… und ' + (ohnePunkte.length - 12) + ' weitere (Fehler-Log)</li>' : '') + '</ul>');
  }
  if (boz.length) {
    teile.push('<div class="karten-titel" style="margin-top:14px">BOZ in Plattenlagen (abgekündigt)</div>'
      + hilfe(boz.length + ' Bohrung(en) als BOZ in Plattenlagen — seit WUP 3.4 nicht mehr unterstützt, Ersatz ist PAF + MP.',
        'Weinmann führt BOZ als Plattenbearbeitung seit Schnittstellenversion 3.4 unter „nicht mehr unterstützte '
        + 'Bearbeitungen" („PAF / MP ersetzt BOZ"). Der Knopf schreibt jede BOZ x, y, d, t einer Plattenlage als „PAF 2" + '
        + '„MP x, y, d/2, |t|, 211" (ein Undo-Schritt) — immer Bezugsebene 2, Lage x/y und Durchmesser bleiben gleich. '
        + 'BOZ am Riegelwerk (Richtungsbohrung) werden NICHT angefasst.')
      + '<button class="schaltflaeche schaltflaeche-klein schaltflaeche-haupt" data-boz-fix>BOZ → PAF/MP umstellen</button>'
      + '<span class="mini-hinweis" id="bozFixErgebnis" style="margin-left:8px"></span>');
  }
  teile.push('<div class="modal-fuss">'
    + '<button class="schaltflaeche schaltflaeche-neben schaltflaeche-klein" data-grav-schliessen>Schliessen (Befunde bleiben im Fehler-Log)</button>'
    + '</div></div>');
  hg.innerHTML = teile.join('');
  document.body.appendChild(hg);
  hg.querySelector('[data-grav-schliessen]').addEventListener('click', () => hg.remove());
  hg.addEventListener('click', ev => {
    if (ev.target === hg) { hg.remove(); return; }
    const h = ev.target.closest('[data-hilfe]');
    if (h) { if (h.nextElementSibling) h.nextElementSibling.classList.toggle('versteckt'); return; }
    const fix = ev.target.closest('[data-idx-fix]');
    if (fix) {
      const g = gruppen[parseInt(fix.dataset.idxFix, 10)];
      const r = werteErsetzen({ feld: 'platteIdx', suchwert: 0, ersatzwert: g.vorschlag.idx, bereich: 'alle',
        plattenNameFilter: g.praefix === '(ohne Name)' ? null : g.praefix, plattenNameModus: 'beginnt' });
      fix.replaceWith(Object.assign(document.createElement('span'),
        { textContent: '✓ ' + r.treffer + '× auf ' + g.vorschlag.idx + ' gesetzt', className: 'mini-hinweis' }));
      return;
    }
    if (ev.target.closest('[data-neigung-fix]')) {
      const n = neigungenNullen();
      const erg = hg.querySelector('#neigungFixErgebnis');
      if (erg) erg.textContent = '✓ ' + n + ' Punkt(e) auf 0° gesetzt';
      ev.target.closest('[data-neigung-fix]').disabled = true;
      return;
    }
    if (ev.target.closest('[data-boz-fix]')) {
      const r = bozAlleErsetzen();
      const erg = hg.querySelector('#bozFixErgebnis');
      if (erg) erg.textContent = '✓ ' + r.ersetzt + ' BOZ umgestellt' + (r.uebersprungen.length
        ? ' · ' + r.uebersprungen.length + ' nicht: ' + r.uebersprungen.join(' | ') : '');
      ev.target.closest('[data-boz-fix]').disabled = true;
      return;
    }
    if (ev.target.closest('[data-nr25-fix]')) {
      const n = nrIndex25PlaKorrigieren();
      const erg = hg.querySelector('#nr25FixErgebnis');
      if (erg) erg.textContent = '✓ ' + n + ' Nagelreihe(n) auf 20 gesetzt';
      ev.target.closest('[data-nr25-fix]').disabled = true;
    }
  });
  return true;
}
