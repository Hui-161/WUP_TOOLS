/* =====================================================================
   §8 EXPORT / SERIALISIERUNG  (Line-Replacement, Originaltreue)
   ===================================================================== */
/* EDT-3: Zeilen > KW_ZEILE_MAX_LAENGE Zeichen wurden bisher STILL auf 249
   Zeichen abgeschnitten (zeile.slice(0,249)+';') - das kappt Parameter
   mitten im Wert und erzeugt eine scheinbar gueltige, aber inhaltlich
   falsche Maschinencode-Zeile. Die Zeile wird jetzt IMMER vollstaendig
   (unveraendert) zurueckgegeben; Ueberlaengen werden stattdessen gesammelt
   und beim Export als Warnung angezeigt (siehe wupExportieren()). */
let kwZeileUeberlaenge = [];
function kwZeile(kw, params) {
  const p = params.filter(v => v !== undefined && v !== null).join(', ');
  const zeile = kw.padEnd(8, ' ') + p + ';';
  if (zeile.length > KW_ZEILE_MAX_LAENGE) kwZeileUeberlaenge.push({ kw, laenge: zeile.length });
  return zeile;
}
function polyElementSerialisieren(e, off) {
  off = off || [0, 0];
  if (off[0] || off[1]) {
    e = Object.assign({}, e, { x: e.x - off[0], y: e.y - off[1] });
  }
  if (e.type === 'PP') {
    if ((e.t || 0) === 0 && (e.i || 0) === 0 && (e.alpha || 0) === 0 && (e.z == null || e.z === 0))
      return kwZeile('PP', [fmtZahl(e.x), fmtZahl(e.y), 0, 0, 0, 0]);
    const p = [fmtZahl(e.x), fmtZahl(e.y), fmtZahl(e.t||0), e.i||0, fmtZahl(e.alpha||0)];
    if (e.z != null) p.push(fmtZahl(e.z));
    return kwZeile('PP', p);
  }
  if (e.type === 'KB') {
    const p = [fmtZahl(e.x), fmtZahl(e.y), fmtZahl(e.r), e.kbTyp, fmtZahl(e.t||0), e.i||0, fmtZahl(e.alpha||0)];
    if (e.z != null) p.push(fmtZahl(e.z));
    return kwZeile('KB', p);
  }
  if (e.type === 'MP') {
    const p = [fmtZahl(e.x), fmtZahl(e.y), fmtZahl(e.r), fmtZahl(e.t||0), e.i||0];
    if (e.z != null) p.push(fmtZahl(e.z));
    return kwZeile('MP', p);
  }
  if (e.type === 'TA')
    return kwZeile('TA', [fmtZahl(e.lx), fmtZahl(e.by), fmtZahl(e.x), fmtZahl(e.y),
      fmtZahl(e.z||0), fmtZahl(e.t||0), fmtZahl(e.r||0), fmtZahl(e.alpha||0),
      fmtZahl(e.delta||0), e.i||0]);
  return '';
}
function opSerialisieren(op) {
  const zeilen = [];
  const off = op._off || [0, 0];   /* B-03: innerhalb MODUL relative Koordinaten schreiben */
  if (op.txtKommentar) zeilen.push('TXT'.padEnd(8,' ') + op.txtKommentar + ';');
  if (op.kw === 'NR') {
    zeilen.push(kwZeile('NR', [fmtZahl(op.nr.xa - off[0]), fmtZahl(op.nr.ya - off[1]),
      fmtZahl(op.nr.xe - off[0]), fmtZahl(op.nr.ye - off[1]), fmtZahl(op.nr.a), op.nr.i]));
    for (const n of (op.nbr || []))
      zeilen.push(kwZeile('NBR', [fmtZahl(n.x), fmtZahl(n.y), n.i]));
  } else {
    zeilen.push(kwZeile(op.kw, op.headerParams ? [op.headerParams] : []));
    for (const e of (op.poly || [])) zeilen.push(polyElementSerialisieren(e, off));
  }
  if (op.txtNach) zeilen.push('TXT'.padEnd(8, ' ') + op.txtNach + ';');
  return zeilen;
}
function platteSerialisieren(platte) {
  const zeilen = [];
  const off = platte._off || [0, 0];   /* B-03 */
  const kopf = [fmtZahl(platte.lx), fmtZahl(platte.by), fmtZahl(platte.hz),
    fmtZahl(platte.x - off[0]), fmtZahl(platte.y - off[1]),
    isNaN(platte.materialIdx) ? 0 : platte.materialIdx, platte.name];
  if (platte.z != null && !isNaN(platte.z)) kopf.push(fmtZahl(platte.z));
  zeilen.push(kwZeile(platte.kw, kopf));
  if (platte.outlineSource === 'pp') {
    /* AP-WE5: Original-Zusatzfelder (i, alpha, z) der Umriss-PPs erhalten —
       vorher wurden alpha/z hart als "0.000, 0" geschrieben und damit die
       z-Position der Umrisspunkte STILL geloescht. t bleibt bewusst
       platte.hz (zieht bei hz-Aenderungen mit, siehe Feld-Hinweis platteHz).
       Fallback aufs alte Format, wenn keine 1:1-Zuordnung existiert
       (z. B. Umriss per Kanten-Edit aus Kopfdaten entstanden oder KB im
       Umriss vereinfacht). */
    const zusatz = (platte._ppZusatz && platte._ppZusatz.length === platte.outline.length)
      ? platte._ppZusatz : null;
    for (let k = 0; k < platte.outline.length; k++) {
      const x = platte.outline[k][0], y = platte.outline[k][1];
      const zk = zusatz ? zusatz[k] : null;
      if (zk) {
        const p = [fmtZahl(x - off[0]), fmtZahl(y - off[1]), fmtZahl(platte.hz), zk.i || 0, fmtZahl(zk.alpha || 0)];
        if (zk.z != null && !isNaN(zk.z)) p.push(fmtZahl(zk.z));
        zeilen.push(kwZeile('PP', p));
      } else {
        zeilen.push(kwZeile('PP', [fmtZahl(x - off[0]), fmtZahl(y - off[1]),
          fmtZahl(platte.hz), platte._ppMaterialHinweis || 0, '0.000', 0]));
      }
    }
  }
  return zeilen;
}
function exportZeilenErzeugen() {
  /* Plan: ersetzte/geloeschte Zeilbereiche + Einfuegungen. Jede erzeugte Zeile
     traegt zusaetzlich einen "besitzer" ({typ:'op'|'platte', id}), damit das
     Text-Panel neu erzeugte/bearbeitete Zeilen (die keine Original-Zeilennummer
     mehr haben) trotzdem der ausloesenden Bearbeitung zuordnen kann (Sprung/
     Hervorhebung bei "Neue Kontur" u.ae. — sonst findet textZuElementScrollen
     keine passende Zeile, siehe Feedback). */
  const ersetzungen = []; /* { von, bis, zeilen[], besitzer[] } — bis inklusiv */
  const anhaenge = [];    /* { nachZeile, zeilen[], besitzer[] } */
  const markiert = (zeilen, besitzer) => ({ zeilen, besitzer: zeilen.map(() => besitzer) });

  /* Rohe Zeilen-Ersetzungen (Riegelwerk: Bearbeitung loeschen / BOZ ersetzen) */
  for (const e of (modell._zeilenErsetzungen || []))
    ersetzungen.push({ von: e.von, bis: e.bis, ...markiert(e.zeilen, null) });

  for (const lage of modell.layers) {
    for (const platte of lage.plates) {
      if (platte._modified && platte._lineStart >= 0)
        ersetzungen.push({ von: platte._lineStart, bis: platte._lineEnd,
          ...markiert(platteSerialisieren(platte), { typ: 'platte', id: platte.id }) });
    }
    if (lage._reihenfolgeGeaendert) {
      /* alle Op-Bereiche der Lage entfernen, an Position des ersten neu schreiben */
      const alteBereiche = lage.ops.filter(o => o._lineStart >= 0)
        .map(o => ({ von: o._lineStart, bis: o._lineEnd }));
      const geloeschte = (lage._geloeschteOps || []).filter(o => o._lineStart >= 0)
        .map(o => ({ von: o._lineStart, bis: o._lineEnd }));
      const alle = alteBereiche.concat(geloeschte);
      if (alle.length) {
        const erste = Math.min(...alle.map(b => b.von));
        const neueZeilen = [], neueBesitzer = [];
        for (const op of lage.ops) {
          let opZeilen;
          if (!op._modified && op._lineStart >= 0) {
            opZeilen = [];
            for (let z = op._lineStart; z <= op._lineEnd; z++) opZeilen.push(modell.rawLines[z]);
          } else opZeilen = opSerialisieren(op);
          for (const nz of opZeilen) { neueZeilen.push(nz); neueBesitzer.push({ typ: 'op', id: op.id }); }
        }
        /* alle alten Bereiche leeren, am ersten einfuegen */
        for (const b of alle) ersetzungen.push({ von: b.von, bis: b.bis, zeilen: [], besitzer: [] });
        anhaenge.push({ nachZeile: erste - 1, zeilen: neueZeilen, besitzer: neueBesitzer });
      } else {
        const anker = lage.plates.length ? Math.max(...lage.plates.map(p => p._lineEnd)) : modell.rawLines.length - 1;
        const zeilen = [], besitzer = [];
        for (const op of lage.ops)
          for (const nz of opSerialisieren(op)) { zeilen.push(nz); besitzer.push({ typ: 'op', id: op.id }); }
        anhaenge.push({ nachZeile: anker, zeilen, besitzer });
      }
    } else {
      for (const op of (lage._geloeschteOps || []))
        if (op._lineStart >= 0) ersetzungen.push({ von: op._lineStart, bis: op._lineEnd, zeilen: [], besitzer: [] });
      for (const op of lage.ops) {
        if (op._neu) {
          /* Einfuege-Anker: nach Vorgaenger-Op in lage.ops, sonst nach letzter Platte */
          const pos = lage.ops.indexOf(op);
          let anker = -1;
          for (let i = pos - 1; i >= 0; i--)
            if (lage.ops[i]._lineEnd >= 0) { anker = lage.ops[i]._lineEnd; break; }
          if (anker < 0 && lage.plates.length) anker = Math.max(...lage.plates.map(p => p._lineEnd));
          if (anker < 0) anker = modell.rawLines.length - 1;
          anhaenge.push({ nachZeile: anker, ...markiert(opSerialisieren(op), { typ: 'op', id: op.id }) });
        } else if (op._modified && op._lineStart >= 0) {
          ersetzungen.push({ von: op._lineStart, bis: op._lineEnd,
            ...markiert(opSerialisieren(op), { typ: 'op', id: op.id }) });
        }
      }
    }
  }

  /* zusammenbauen */
  const ersatzVon = new Map(); /* zeile -> { bis, zeilen, besitzer } */
  for (const e of ersetzungen) ersatzVon.set(e.von, e);
  const anhangNach = new Map();
  for (const a of anhaenge) {
    if (!anhangNach.has(a.nachZeile)) anhangNach.set(a.nachZeile, { zeilen: [], besitzer: [] });
    const slot = anhangNach.get(a.nachZeile);
    slot.zeilen.push(...a.zeilen);
    slot.besitzer.push(...a.besitzer);
  }
  const aus = [];
  const zeilenInfo = []; /* parallel: { quelle:'orig'|'neu', origZeile, besitzer } fuer Text-Panel */
  const anhangSchreiben = nz => {
    if (!anhangNach.has(nz)) return;
    const slot = anhangNach.get(nz);
    for (let i = 0; i < slot.zeilen.length; i++) {
      aus.push(slot.zeilen[i]);
      zeilenInfo.push({ quelle: 'neu', besitzer: slot.besitzer[i] || null });
    }
  };
  let z = 0;
  anhangSchreiben(-1);
  while (z < modell.rawLines.length) {
    const e = ersatzVon.get(z);
    if (e) {
      for (let i = 0; i < e.zeilen.length; i++) {
        aus.push(e.zeilen[i]);
        zeilenInfo.push({ quelle: 'neu', besitzer: e.besitzer[i] || null });
      }
      const bis = e.bis;
      for (let k = z; k <= bis; k++) anhangSchreiben(k);
      z = bis + 1;
      continue;
    }
    aus.push(modell.rawLines[z]);
    zeilenInfo.push({ quelle: 'orig', origZeile: z });
    anhangSchreiben(z);
    z++;
  }
  return { zeilen: aus, info: zeilenInfo, ersetzungen, anhaenge };
}

/* EDT-V: baut aus den intern in exportZeilenErzeugen() ermittelten
   ersetzungen/anhaengen eine nach Original-Zeilenposition sortierte
   Hunk-Liste fuer die Export-Diff-Ansicht (rein additiv, aendert nichts an
   zeilen/info bzw. am eigentlichen Export-Ergebnis). */
function exportDiffErzeugen() {
  const { ersetzungen, anhaenge } = exportZeilenErzeugen();
  const hunks = [];
  for (const e of ersetzungen) {
    const alt = modell.rawLines.slice(e.von, e.bis + 1);
    hunks.push({ pos: e.von, typ: e.zeilen.length === 0 ? 'geloescht' : 'geaendert', alt, neu: e.zeilen });
  }
  for (const a of anhaenge) {
    if (!a.zeilen.length) continue;
    hunks.push({ pos: a.nachZeile + 0.5, typ: 'neu', alt: [], neu: a.zeilen });
  }
  hunks.sort((x, y) => x.pos - y.pos);
  return hunks;
}

/* EDT-V: zeigt die Export-Diff-Ansicht (alt/neu-Gegenueberstellung) vor dem
   eigentlichen Export. weiterFn wird nur bei Klick auf "Exportieren"
   aufgerufen (bzw. Enter) - "Abbrechen"/Escape/Klick auf den Hintergrund
   bricht ohne Export ab. */
function diffAnzeigen(hunks, weiterFn) {
  document.querySelectorAll('.diff-hintergrund').forEach(el => el.remove());
  const anzahl = { geloescht: 0, geaendert: 0, neu: 0 };
  hunks.forEach(h => anzahl[h.typ]++);
  const titel = { geloescht: 'Gelöscht', geaendert: 'Geändert', neu: 'Neu' };

  const hunksHtml = hunks.map(h => {
    const altZeilen = h.alt.map(z => `<div class="diff-zeile diff-zeile-alt">${escapeHtml(z)}</div>`).join('');
    const neuZeilen = h.neu.map(z => `<div class="diff-zeile diff-zeile-neu">${escapeHtml(z)}</div>`).join('');
    return `<div class="diff-hunk diff-hunk-${h.typ}">
      <div class="diff-hunk-kopf">${titel[h.typ]} — Zeile ${Math.floor(h.pos) + 1}</div>
      ${altZeilen}${neuZeilen}
    </div>`;
  }).join('');

  const hg = document.createElement('div');
  hg.className = 'diff-hintergrund';
  const fenster = document.createElement('div');
  fenster.className = 'diff-fenster';
  fenster.innerHTML = `
    <h2>Änderungen vor dem Export</h2>
    <div class="diff-zusammenfassung">${anzahl.geaendert} geändert · ${anzahl.neu} neu · ${anzahl.geloescht} gelöscht</div>
    <div class="diff-liste">${hunksHtml}</div>
    <div class="diff-fuss">
      <span class="mini-hinweis" data-haftung style="margin-right:auto;align-self:center">Ohne Gewähr — Datei vor der Fertigung prüfen.</span>
      <button type="button" class="schaltflaeche schaltflaeche-neben" data-diff-abbrechen>Abbrechen</button>
      <button type="button" class="schaltflaeche schaltflaeche-haupt" data-diff-exportieren>Exportieren</button>
    </div>
  `;
  hg.appendChild(fenster);
  document.body.appendChild(hg);

  let erledigt = false;
  const aufraeumen = () => {
    if (erledigt) return; erledigt = true;
    document.removeEventListener('keydown', tasten, true);
    hg.remove();
  };
  const exportierenKlick = () => { aufraeumen(); weiterFn(); };
  const abbrechenKlick = () => aufraeumen();
  const tasten = ev => {
    if (ev.key === 'Enter') { ev.preventDefault(); ev.stopPropagation(); exportierenKlick(); }
    else if (ev.key === 'Escape') { ev.preventDefault(); ev.stopPropagation(); abbrechenKlick(); }
  };
  fenster.querySelector('[data-diff-exportieren]').onclick = exportierenKlick;
  fenster.querySelector('[data-diff-abbrechen]').onclick = abbrechenKlick;
  hg.addEventListener('mousedown', ev => { if (ev.target === hg) abbrechenKlick(); });
  document.addEventListener('keydown', tasten, true);
  fenster.querySelector('[data-diff-exportieren]').focus();
}

/* P-4: ermittelt den Export-Dateinamen gemaess profil.export.dateiname —
   headless testbar (nur von modell.dateiName/header und profil abhaengig).
   'original': exakter Originalname der geladenen Datei; ist keiner bekannt
   (leer oder Platzhalter 'unbenannt.wup'), faellt es auf das bearbeitet-
   Muster zurueck, damit nie eine sinnlose Datei "unbenannt.wup" exportiert wird.
   'bearbeitet': das bisherige WUP_[ELN]_[ZNR]_bearbeitet.wup-Muster. */
function exportDateinameBestimmen() {
  const bearbeitetName = () => dateinamenErstellen('WUP', [modell.header.ELN, modell.header.ZNR, 'bearbeitet'], 'wup');
  const modus = (profil.export && profil.export.dateiname) || PROFIL_STANDARD.export.dateiname;
  if (modus === 'original') {
    const original = modell.dateiName;
    if (original && original !== 'unbenannt.wup') return original;
    return bearbeitetName();
  }
  return bearbeitetName();
}
/* AP1: erzeugt die Export-Bytes GENAU wie der Export-Pfad (CRLF-Text +
   Encoding-Zweig utf-16le bzw. windows-1252/ASCII inkl. Datenverlust-Zaehlung),
   aber headless testbar (kein Blob/Download) — Basis fuer wupExportieren()
   UND fuer die WupWorks5-Anbindung (AP1), die dieselben Bytes per HTTP
   verschickt statt sie herunterzuladen. */
function exportBytesErzeugen() {
  kwZeileUeberlaenge = [];
  const { zeilen } = exportZeilenErzeugen();
  let text = zeilen.join('\r\n');
  if (!text.endsWith('\r\n')) text += '\r\n';
  let bytes;
  let datenverlust = 0;
  if (modell.encoding === 'utf-16le') {
    const buf = new ArrayBuffer(2 + text.length * 2);
    const view = new DataView(buf);
    view.setUint8(0, 0xFF); view.setUint8(1, 0xFE);
    for (let i = 0; i < text.length; i++) view.setUint16(2 + i*2, text.charCodeAt(i), true);
    bytes = new Uint8Array(buf);
  } else {
    /* ASCII/latin1-treu: Zeichen > 127 wie eingelesen byteweise zurueck.
       EDT-3: & 0xFF verwirft bei Zeichen > 255 stillschweigend die oberen
       Bits (z.B. wenn im Editor ein Unicode-Zeichen ausserhalb Latin-1
       eingegeben wurde) - wird jetzt gezaehlt und nach dem Export gemeldet
       statt unbemerkt zu bleiben. */
    bytes = new Uint8Array(text.length);
    for (let i = 0; i < text.length; i++) {
      const code = text.charCodeAt(i);
      if (code > 255) datenverlust++;
      bytes[i] = code & 0xFF;
    }
  }
  return { bytes, name: exportDateinameBestimmen(), datenverlust, ueberlaengen: kwZeileUeberlaenge.length };
}
function wupExportieren() {
  if (!modell) return;
  pruefungenAusfuehren();
  const fehler = modell.pruefungen.filter(p => p.level === 'fehler');
  const exportieren = () => {
    const { bytes, name, datenverlust, ueberlaengen } = exportBytesErzeugen();
    const blob = new Blob([bytes], { type: 'application/octet-stream' });
    dateiHerunterladen(blob, 'application/octet-stream', name);
    sitzungBasisSetzen(); sitzungVormerken();   /* v2.55: exportiert = gesichert */
    hinweisAnzeigen('Exportiert: ' + name + ' (CRLF, ' + modell.encoding + ')', 'erfolg');
    if (ueberlaengen)
      hinweisAnzeigen(ueberlaengen + ' Maschinencode-Zeile(n) ueberschreiten '
        + KW_ZEILE_MAX_LAENGE + ' Zeichen (' + [...new Set(kwZeileUeberlaenge.map(u => u.kw))].join(', ')
        + ') - NICHT gekuerzt, bitte pruefen ob die Maschine damit umgehen kann.', 'warnung');
    if (datenverlust)
      hinweisAnzeigen(datenverlust + ' Zeichen ausserhalb des ' + modell.encoding + '-Zeichensatzes wurden beim '
        + 'Export auf ein Byte gekuerzt (moeglicher Datenverlust) - bitte Text-Felder pruefen.', 'warnung');
  };
  /* EDT-V: nach dem Fehler-Gate, vor dem eigentlichen Export - zeigt bei
     vorhandenen Aenderungen die Diff-Ansicht; bei einer frisch geladenen,
     unveraenderten Datei (keine Hunks) wird kein leeres Diff-Modal
     aufgedraengt, sondern direkt exportiert. */
  const mitDiffBestaetigen = () => {
    if (profil.export && profil.export.diffZeigen === false) { exportieren(); return; }
    const hunks = exportDiffErzeugen();
    if (!hunks.length) { exportieren(); return; }
    diffAnzeigen(hunks, exportieren);
  };
  if (fehler.length)
    bestaetigen(fehler.length + ' FEHLER-Pruefung(en) offen (z.B. ' + fehler[0].code + '). Trotzdem exportieren?',
      'Trotzdem exportieren', mitDiffBestaetigen);
  else mitDiffBestaetigen();
}

