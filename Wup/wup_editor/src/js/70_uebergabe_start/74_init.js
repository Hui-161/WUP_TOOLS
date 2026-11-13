function init() {
  kuerzelLeisteFuellen();
  document.getElementById('versionsBadge').textContent = 'v' + TOOL_VERSION;
  feedbackEinrichten();

  /* Datei oeffnen */
  const dateiInput = document.getElementById('dateiInput');
  document.getElementById('btnOeffnen').addEventListener('click', () => dateiInput.click());
  document.getElementById('dropZone').addEventListener('click', () => dateiInput.click());
  dateiInput.addEventListener('change', () => { dateiVerarbeiten(dateiInput.files[0]); dateiInput.value = ''; });

  const wrapper = document.getElementById('canvasWrapper');
  ['dragover', 'dragenter'].forEach(t => document.body.addEventListener(t, ev => ev.preventDefault()));
  document.body.addEventListener('drop', ev => {
    ev.preventDefault();
    const file = ev.dataTransfer.files && ev.dataTransfer.files[0];
    if (!file) return;
    dateiVerarbeiten(file);
  });

  /* Kopfzeile */
  document.getElementById('selAnsicht').addEventListener('change', ev => {
    ui.ansicht = ev.target.value;
    if (modell) { zoomEinpassen(); svgRendern(); }
  });
  document.getElementById('btnUndo').addEventListener('click', rueckgaengig);
  document.getElementById('btnRedo').addEventListener('click', wiederholen);
  /* GUI-B: Automatiken-Menue — die Eintraege behalten ihre alten IDs und
     Listener; hier nur Auf/Zu-Logik (Knopf, Eintrag-Klick, Klick daneben). */
  const autoMenue = document.getElementById('automatikMenue');
  document.getElementById('btnAutomatiken').addEventListener('click', ev => {
    ev.stopPropagation();
    autoMenue.classList.toggle('versteckt');
  });
  autoMenue.addEventListener('click', ev => {
    if (ev.target.closest('.menue-eintrag')) autoMenue.classList.add('versteckt');
  });
  /* pointerdown statt click: der Canvas unterdrueckt per preventDefault()
     auf pointerdown die nachlaufenden click-Events — das Menue soll aber
     auch bei einem Klick in die Zeichnung zugehen. */
  document.addEventListener('pointerdown', ev => {
    if (!autoMenue.classList.contains('versteckt') && !ev.target.closest('.menue-wrap'))
      autoMenue.classList.add('versteckt');
  });
  document.getElementById('btnAutoSchnitt').addEventListener('click', f1AlleAusfuehren);
  document.getElementById('btnAutoPsf').addEventListener('click', () => f3AutoPsf());
  document.getElementById('btnAutoKontur').addEventListener('click', autoKonturVerbinden);
  document.getElementById('btnAutoRichtung').addEventListener('click', autoRichtungAusfuehren);
  document.getElementById('btnWerteErsetzen').addEventListener('click', werteErsetzenOeffnen);
  document.getElementById('btnEckenPml').addEventListener('click', eckenPmlStarten);
  document.getElementById('btnAutoFreistich').addEventListener('click', f2SammelAktion);
  document.getElementById('btnPsfEinstell').addEventListener('click', automatikEinstellungenOeffnen);
  document.getElementById('btnExport').addEventListener('click', wupExportieren);
  document.getElementById('btnWupworksSenden').addEventListener('click', wupworksSendenKlick);
  document.getElementById('btnExportEinstell').addEventListener('click', exportEinstellungenOeffnen);

  /* Werkzeugleiste */
  document.querySelectorAll('[data-werkzeug]').forEach(b =>
    b.addEventListener('click', () => werkzeugSetzen(b.dataset.werkzeug)));
  document.getElementById('neueKonturTyp').addEventListener('change', ev => {
    /* v2.54: gemerkte Form/Schichten dieser Art uebernehmen und merken */
    neuVorgabenAnwenden(ev.target.value);
    neuVorgabenSichern();
    if (ui.werkzeug === 'neue-kontur') { ui.neueKontur = null; ui._neueKonturMaus = null; ui.neueNrStart = null; svgRendern(); }
  });
  document.getElementById('neueKonturForm').addEventListener('change', neuVorgabenSichern);
  /* WP3-P3: Schicht-Auswahl-Knopf + Popover (Checkboxen je Lage mit Platten) */
  document.getElementById('btnNeuKonturLagen').addEventListener('click', ev => {
    ev.stopPropagation();
    if (neuKonturLagenPopoverOffen()) neuKonturLagenPopoverSchliessen();
    else neuKonturLagenPopoverOeffnen();
  });
  document.getElementById('neuKonturLagenPopover').addEventListener('click', ev => {
    ev.stopPropagation();
    const aktion = ev.target.closest('[data-nkl-aktion]');
    if (aktion && modell) {
      const lagenMitPlatten = modell.layers.filter(l => l.plates.length);
      ui.neuKonturLagen = aktion.dataset.nklAktion === 'alle' ? lagenMitPlatten.map(l => l.id) : [];
      neuKonturLagenPopoverOeffnen();
      neuKonturLagenButtonAktualisieren();
      neuVorgabenSichern();
    }
  });
  document.getElementById('neuKonturLagenPopover').addEventListener('change', ev => {
    const chk = ev.target.closest('[data-nkl-lage]');
    if (!chk) return;
    const id = chk.dataset.nklLage;
    ui.neuKonturLagen = Array.isArray(ui.neuKonturLagen) ? ui.neuKonturLagen.slice() : [];
    if (chk.checked) { if (!ui.neuKonturLagen.includes(id)) ui.neuKonturLagen.push(id); }
    else ui.neuKonturLagen = ui.neuKonturLagen.filter(x => x !== id);
    neuKonturLagenButtonAktualisieren();
    neuVorgabenSichern();
  });
  document.addEventListener('pointerdown', ev => {
    if (!ev.target.closest('#neuKonturLagenPopover, #btnNeuKonturLagen')) neuKonturLagenPopoverSchliessen();
  }, true);
  /* GUI-H: Ansicht-Umschalter + Lagen-Sichtbarkeit als Chips */
  document.getElementById('ansichtChips').addEventListener('click', ev => {
    const chip = ev.target.closest('[data-ansicht-chip]');
    if (!chip) return;
    const s = ANSICHT_SCHALTER.find(x => x.flag === chip.dataset.ansichtChip);
    ui[s.flag] = !ui[s.flag];
    ansichtChipsRendern();
    s.neu();
  });
  document.getElementById('lagenChips').addEventListener('click', ev => {
    const dreieck = ev.target.closest('[data-seite-dreieck]');
    if (dreieck) {
      const seite = dreieck.dataset.seiteDreieck;
      seiteSetzen(seiteAktiv() === seite ? 'beide' : seite);
      return;
    }
    const chip = ev.target.closest('[data-lage-chip]');
    if (!chip || !modell) return;
    const lage = modell.layers.find(l => l.id === chip.dataset.lageChip);
    if (!lage) return;
    if (ev.altKey) {
      const nurDiese = modell.layers.every(l => l === lage ? l.sichtbar : !l.sichtbar);
      for (const l of modell.layers) l.sichtbar = nurDiese ? true : (l === lage);
    } else {
      lage.sichtbar = !lage.sichtbar;
    }
    lagenNeuZeichnen();
  });
  document.querySelectorAll('.text-tab').forEach(tab =>
    tab.addEventListener('click', () => textTabSetzen(tab.dataset.tab)));
  document.getElementById('baumInhalt').addEventListener('click', baumKlick);
  document.getElementById('logTitel').addEventListener('click', ev => {
    if (ev.target.closest('button')) return;
    ui.logZu = !ui.logZu;
    fehlerLogRendern();
  });
  /* GUI-H: Lagen&Ansicht + Eigenschaften ein-/ausklappbar (wie Fehler-Log) */
  document.querySelectorAll('.karten-klapp').forEach(kopf => kopf.addEventListener('click', ev => {
    if (ev.target.closest('button, select, input')) return;
    const ziel = document.getElementById(kopf.dataset.karteKlapp);
    if (!ziel) return;
    const warZu = ziel.style.display === 'none';
    ziel.style.display = warZu ? '' : 'none';
    const pfeil = kopf.querySelector('.karten-pfeil');
    if (pfeil) pfeil.textContent = warZu ? '▾' : '▸';
  }));
  document.getElementById('messPanel').addEventListener('click', ev => {
    const eins = ev.target.closest('[data-mess-loeschen]');
    if (eins) { ui.messungen.splice(parseInt(eins.dataset.messLoeschen, 10), 1); svgRendern(); messPanelRendern(); return; }
    if (ev.target.closest('[data-mess-alle]')) { ui.messungen = []; ui.messStart = null; svgRendern(); messPanelRendern(); }
  });
  document.getElementById('btnZoomFit').addEventListener('click', () => { if (modell) { zoomEinpassen(); svgRendern(); } });
  document.getElementById('btnMessLoeschen').addEventListener('click', () => {
    ui.messungen = []; ui.messStart = null; if (modell) { svgRendern(); messPanelRendern(); }
  });
  document.getElementById('btnSchnittH').addEventListener('click', () => schnittUmschalten('h'));
  document.getElementById('btnSchnittV').addEventListener('click', () => schnittUmschalten('v'));
  document.getElementById('btn3d').addEventListener('click', dreiDUmschalten);
  document.getElementById('chk3dExplosion').addEventListener('change', ev => {
    ui.dreiDExplosion = ev.target.checked; if (modell && ui.dreiD) svgRendern();
  });
  opFilterChipsRendern();
  ansichtChipsRendern();
  lagenChipsRendern();
  document.getElementById('opFilterChips').addEventListener('click', ev => {
    const chip = ev.target.closest('[data-filter]');
    if (!chip) return;
    const kw = chip.dataset.filter;
    if (ev.altKey) {
      /* Alt+Klick = Solo (gleiches Muster wie lagenKlick): nur dieser Typ an,
         erneutes Alt+Klick auf den einzig aktiven schaltet wieder alle an. */
      const nurDieser = Object.keys(ui.opFilter).every(k => k === kw ? ui.opFilter[k] : !ui.opFilter[k]);
      for (const k of Object.keys(ui.opFilter)) ui.opFilter[k] = nurDieser ? true : (k === kw);
    } else {
      ui.opFilter[kw] = !ui.opFilter[kw];
    }
    opFilterChipsRendern();
    if (modell) { snapPunkteAufbauen(); svgRendern(); }
  });
  const btnTextZu = document.getElementById('btnTextZu');
  if (btnTextZu) btnTextZu.addEventListener('click', () => {
    const haupt = document.getElementById('hauptbereich');
    haupt.classList.toggle('text-zu');
    const zu = haupt.classList.contains('text-zu');
    btnTextZu.textContent = zu ? '⟩' : '⟨';
    btnTextZu.title = zu ? 'Text-Panel ausklappen' : 'Text-Panel einklappen';
    if (modell) {
      svgRendern();
      if (!zu) { if (ui.textTab === 'quelltext') textPanelRendern(); else baumRendern(); }
    }
  });
  /* Text-Panel beim Start eingeklappt anzeigen */
  document.getElementById('hauptbereich').classList.add('text-zu');
  if (btnTextZu) { btnTextZu.textContent = '⟩'; btnTextZu.title = 'Text-Panel ausklappen'; }

  /* Canvas */
  wrapper.addEventListener('wheel', canvasWheel, { passive: false });
  wrapper.addEventListener('pointerdown', canvasPointerDown);
  document.addEventListener('pointermove', canvasPointerMove);
  document.addEventListener('pointerup', canvasPointerUp);
  wrapper.addEventListener('pointerleave', () => document.getElementById('svgTooltip').classList.add('versteckt'));
  /* WP3: Doppelklick schliesst eine Polygon-Kontur ab (MP braucht keinen Doppelklick — 2 Klicks reichen) */
  wrapper.addEventListener('dblclick', ev => {
    if (!modell) return;
    /* 3D: Doppelklick setzt Blickwinkel + Verschiebung zurueck */
    if (ui.dreiD) { ev.preventDefault(); ui.dreiDWinkel = { az: 0.55, el: 0.42 }; ui.dreiDPan = { x: 0, y: 0 }; svgRendern(); return; }
    if (ui.werkzeug !== 'neue-kontur' || !ui.neueKontur || !ui.neueKontur.punkte) return;
    ev.preventDefault();
    neueKonturVersuchAbschliessen(false);
  });

  /* Text-Panel */
  document.getElementById('textScroller').addEventListener('scroll', () => textPanelRendern());
  document.getElementById('textInhalt').addEventListener('click', ev => {
    const zeile = ev.target.closest('[data-zeile]');
    if (zeile) zeileZuElementSpringen(parseInt(zeile.dataset.zeile, 10), ev);
  });

  /* Rechts-Panels (Delegation) */
  document.getElementById('fehlerLog').addEventListener('click', fehlerLogKlick);
  /* WP-J (Anwenderwunsch): das weggeklickte Befunde-Popup jederzeit wieder
     oeffnen — vorher frisch pruefen, damit die Zaehlung aktuell ist.
     stopPropagation: der Kopf selbst klappt sonst den Log ein/aus. */
  document.getElementById('btnGravPopup').addEventListener('click', ev => {
    ev.stopPropagation();
    if (!modell) { hinweisAnzeigen('Keine Datei geladen.', 'warnung'); return; }
    pruefungenAusfuehren();
    fehlerLogRendern();
    if (!gravierendeBefundePopup(true))
      hinweisAnzeigen('Keine gravierenden Befunde (P-19/P-21/P-22/P-23/P-24) in dieser Datei.', 'erfolg');
  });
  /* Verschieben-Overlay: Richtungswahl + mm-Verschiebung. pointerdown wird
     gestoppt, damit der Klick nicht als Canvas-Interaktion durchschlaegt. */
  const ov = document.getElementById('verschiebenOverlay');
  ov.addEventListener('pointerdown', ev => ev.stopPropagation());
  ov.addEventListener('click', ev => {
    const rb = ev.target.closest('[data-kante-richtung]');
    if (rb) { ui.kanteRichtung = rb.dataset.kanteRichtung; verschiebenOverlayRendern(); return; }
    const vb = ev.target.closest('[data-aktion="vo-verschieben"]');
    if (vb) {
      const feld = document.getElementById('voDelta');
      const delta = feld ? parseFloat(feld.value) : 0;
      if (!delta || isNaN(delta)) { hinweisAnzeigen('Kein Verschiebeweg eingegeben.', 'warnung'); return; }
      if (!ui.kanten.length) { hinweisAnzeigen('Keine Kante gewaehlt.', 'warnung'); return; }
      kanteVerschieben(delta, ui.kanteRichtung || 'senkrecht');
    }
  });
  ov.addEventListener('keydown', ev => {
    if (ev.key === 'Enter') { ev.preventDefault();
      const vb = ov.querySelector('[data-aktion="vo-verschieben"]');
      if (vb && !vb.disabled) vb.click(); }
  });

  const eig = document.getElementById('eigenschaften');
  eig.addEventListener('click', ev => {
    /* GUI-D: Abschnitte auf-/zuklappen (Zustand haelt ueber Renderings) */
    const abschnitt = ev.target.closest('[data-eig-abschnitt]');
    if (abschnitt) {
      ui._eigOffen = ui._eigOffen || {};
      const s = abschnitt.dataset.eigAbschnitt;
      const offen = ui._eigOffen[s] != null ? ui._eigOffen[s]
        : abschnitt.parentElement.querySelector('.eig-abschnitt-inhalt') != null;
      ui._eigOffen[s] = !offen;
      eigenschaftenRendern();
      return;
    }
    const btn = ev.target.closest('[data-aktion]');
    if (btn) { eigenschaftenAktion(btn.dataset.aktion, btn); return; }
    const del = ev.target.closest('[data-punkt-loeschen]');
    if (del) { punktLoeschen(parseInt(del.dataset.punktLoeschen, 10)); return; }
    const bozBtn = ev.target.closest('[data-boz-ersetzen]');
    if (bozBtn) { beamBozErsetzen(parseInt(bozBtn.dataset.bozErsetzen, 10)); return; }
    const bbDel = ev.target.closest('[data-beam-bearb-loeschen]');
    if (bbDel) { beamBearbLoeschen(parseInt(bbDel.dataset.beamBearbLoeschen, 10)); return; }
    /* I-02: Zeilenklick markiert die Linie im Canvas.
       Feedback K: Strg+Klick sammelt weitere Punkte, Shift+Klick markiert
       den Bereich vom Anker bis hier — Wert-Aenderungen wirken dann auf
       alle markierten Punkte (eigenschaftenWertUebernehmen). */
    const zeile = ev.target.closest('tr[data-seg]');
    if (zeile && !ev.target.closest('input,select') && ui.auswahl && ui.auswahl.typ === 'op') {
      const idx = parseInt(zeile.dataset.seg, 10);
      const opId = ui.auswahl.id;
      const ankerDa = ui.segMark && ui.segMark.opId === opId;
      if ((ev.ctrlKey || ev.metaKey) && ankerDa) {
        const idxs = (ui.segMarkMehr && ui.segMarkMehr.opId === opId) ? ui.segMarkMehr.idxs.slice() : [];
        if (idx !== ui.segMark.idx) {
          const pos = idxs.indexOf(idx);
          if (pos >= 0) idxs.splice(pos, 1); else idxs.push(idx);
        }
        ui.segMarkMehr = idxs.length ? { opId, idxs } : null;
      } else if (ev.shiftKey && ankerDa) {
        const [von, bis] = [Math.min(ui.segMark.idx, idx), Math.max(ui.segMark.idx, idx)];
        const idxs = [];
        for (let k = von; k <= bis; k++) if (k !== ui.segMark.idx) idxs.push(k);
        ui.segMarkMehr = idxs.length ? { opId, idxs } : null;
      } else {
        const mehrAktiv = ui.segMarkMehr && ui.segMarkMehr.opId === opId && ui.segMarkMehr.idxs.length;
        ui.segMark = (ankerDa && ui.segMark.idx === idx && !mehrAktiv) ? null : { opId, idx };
        ui.segMarkMehr = null;
      }
      svgRendern();
      eigenschaftenRendern();
    }
  });
  eig.addEventListener('change', ev => {
    const fv = ev.target.closest('select[data-aktion="freistich-variante"]');
    if (fv) {
      profil.freistich.variante = fv.value;
      profilSichern();
      hinweisAnzeigen('Freistich-Variante: ' + (fv.value === 'klassisch'
        ? 'Klassisch (PAF-Polyzug)' : 'Rundfraesung (MP)') + '.', 'info');
      return;
    }
    const sc = ev.target.closest('select[data-scidx]');
    if (sc) { scMiniUebernehmen(sc); return; }
    const input = ev.target.closest('input[data-feld],select[data-feld]');
    if (input && input.dataset.feld !== 'kanteDelta' && !input.dataset.feld.startsWith('mehr-')
        && !input.dataset.feld.startsWith('v-'))
      eigenschaftenWertUebernehmen(input);
  });
  eig.addEventListener('keydown', ev => {
    if (ev.key === 'Enter' && ev.target.matches('input[data-feld]')) {
      ev.target.blur();
      const feld = ev.target.dataset.feld;
      if (feld === 'v-dx' || feld === 'v-dy') eigenschaftenAktion('op-verschieben');
      else if (feld === 'v-pdx' || feld === 'v-pdy') eigenschaftenAktion('punkt-verschieben');
    }
  });

  /* Tastenkuerzel */
  document.addEventListener('keydown', ev => {
    /* Bei offenem Bestaetigungs- oder Einstell-Dialog keine Editor-Tastenkuerzel */
    if (document.querySelector('.bestaetigung, .modal-hintergrund')) return;
    const inEingabe = /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName);
    /* Alt+A-Schema (Anwenderwunsch "alt a eins fuer die erste Automatik"):
       bei OFFENEM Automatiken-Menue startet die Ziffer 1–7 den Eintrag
       (feste Nummerierung wie die <kbd>-Ziffern im Menue). */
    {
      const am = document.getElementById('automatikMenue');
      if (am && !am.classList.contains('versteckt') && /^[1-9]$/.test(ev.key)
          && !ev.altKey && !ev.ctrlKey && !ev.metaKey) {
        ev.preventDefault();
        const eintrag = am.querySelectorAll('.menue-eintrag')[+ev.key - 1];
        if (eintrag && !eintrag.disabled) eintrag.click();
        else am.classList.add('versteckt');
        return;
      }
    }
    if (ev.altKey && !ev.ctrlKey) {
      /* Alt-Kuerzel aus dem TASTENKUERZEL-Array (einzige Quelle, Spec §7.10).
         Meta/Shift-Kombis ausgenommen - wie im B3-Standard-Listener. */
      if (!ev.metaKey && !ev.shiftKey) {
        const k = ev.key.toLowerCase();
        for (const kuerzel of TASTENKUERZEL) {
          if (kuerzel.alt && kuerzel.aktion && kuerzel.taste === k) {
            ev.preventDefault();
            kuerzel.aktion();
            return;
          }
        }
      }
      /* Alt+↑ / Alt+↓: ausgewaehlte Bearbeitung in der Maschinen-Reihenfolge verschieben */
      if ((ev.key === 'ArrowUp' || ev.key === 'ArrowDown') && modell
          && ui.auswahl && ui.auswahl.typ === 'op') {
        const f = opFinden(ui.auswahl.id);
        if (f) { ev.preventDefault(); opVerschieben(f.op, f.lage, ev.key === 'ArrowUp' ? -1 : +1); return; }
      }
    }
    if (inEingabe) return;
    /* Pfeiltasten: durch Bearbeitungen navigieren; Shift erweitert die Auswahl,
       Strg/Cmd bewegt eine NR um 1 mm (10 mm mit Shift). */
    if (modell && (ev.key === 'ArrowDown' || ev.key === 'ArrowUp'
        || ev.key === 'ArrowLeft' || ev.key === 'ArrowRight')) {
      if ((ev.ctrlKey || ev.metaKey) && ui.auswahl && ui.auswahl.typ === 'op') {
        const f = opFinden(ui.auswahl.id);
        if (f && f.op.kw === 'NR') {
          ev.preventDefault();
          const schritt = ev.shiftKey ? 10 : 1;
          const dx = ev.key === 'ArrowLeft' ? -schritt : ev.key === 'ArrowRight' ? schritt : 0;
          const dy = ev.key === 'ArrowUp' ? schritt : ev.key === 'ArrowDown' ? -schritt : 0;
          aenderungBeginnen();
          const ziele = mehrfachOps().filter(o => o.op.kw === 'NR');
          for (const z of ziele) {
            z.op.nr.xa += dx; z.op.nr.xe += dx; z.op.nr.ya += dy; z.op.nr.ye += dy;
            z.op._modified = true;
          }
          alleNeuRendern(true);
          return;
        }
      }
      ev.preventDefault();
      const flach = sichtbareOpsFlach();
      if (!flach.length) return;
      const aktuell = ui.auswahl && ui.auswahl.typ === 'op'
        ? flach.findIndex(e => e.op.id === ui.auswahl.id) : -1;
      const vor = ev.key === 'ArrowDown' || ev.key === 'ArrowRight';
      let neu = aktuell < 0 ? (vor ? 0 : flach.length - 1)
        : (aktuell + (vor ? 1 : -1) + flach.length) % flach.length;
      const ziel = flach[neu];
      if (ev.shiftKey && ui.auswahl && ui.auswahl.typ === 'op') {
        opAuswahlBereich(ziel.op.id, ziel.lage.id);
      } else {
        ui.mehrAuswahl = [];
        auswahlSetzen({ typ: 'op', id: ziel.op.id, lageId: ziel.lage.id });
      }
      const f = opFinden(ziel.op.id);
      if (f) opZoomen(f.op);
      return;
    }
    /* Strg/Cmd+A: alle sichtbaren Bearbeitungen auswaehlen */
    if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'a' && modell) {
      ev.preventDefault();
      const flach = sichtbareOpsFlach();
      if (flach.length) {
        ui.auswahl = { typ: 'op', id: flach[0].op.id, lageId: flach[0].lage.id };
        ui.mehrAuswahl = flach.slice(1).map(e => e.op.id);
        svgRendern(); eigenschaftenRendern(); baumAuswahlMarkieren();
        hinweisAnzeigen(flach.length + ' Bearbeitungen ausgewaehlt.', 'info');
      }
      return;
    }
    /* AP3: Strg/Cmd+H — Werte ersetzen (Notepad++-Ersatz fuer Koordinaten) */
    if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'h' && modell) {
      ev.preventDefault();
      werteErsetzenOeffnen();
      return;
    }
    /* GUI-F: Strg/Cmd+K — Befehlspalette umschalten */
    if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'k') {
      ev.preventDefault();
      if (document.getElementById('palette').classList.contains('versteckt')) paletteOeffnen();
      else paletteSchliessen();
      return;
    }
    if (ev.key === ' ' || ev.code === 'Space') {
      ev.preventDefault();
      if (modell) { zoomEinpassen(); svgRendern(); }
      return;
    }
    /* WP-G: Enter im Ecken-Markierungs-Modus uebernimmt die vorgeschlagene
       Anschlag-Ecke (Anwenderwunsch: Alt+A, 5, Enter, Enter — ohne Maus) */
    if (ev.key === 'Enter' && modell && ui.eckenPml) {
      ev.preventDefault();
      eckenPmlKlick(anschlagEckeVorschlag());
      return;
    }
    /* WP3: Enter schliesst die im Bau befindliche Kontur ab (Polygon-Varianten) */
    if (ev.key === 'Enter' && modell && ui.werkzeug === 'neue-kontur' && ui.neueKontur && ui.neueKontur.punkte) {
      ev.preventDefault();
      neueKonturVersuchAbschliessen(false);
      return;
    }
    /* v2.54: Folgetaste nach N (S/F/G/Z/M/N) — VOR den Einzeltasten, weil
       M und N dort eine andere Bedeutung haben */
    if (neuFolgeTasteVerarbeiten(ev)) return;
    const k = ev.key.toLowerCase();
    if (k === 'v') werkzeugSetzen('auswahl');
    else if (k === 'm') werkzeugSetzen('messen');
    else if (k === 'n') { if (modell) neuKonturTasteN(); else werkzeugSetzen('neue-kontur'); }
    else if (k === 'k') werkzeugSetzen('kante');
    else if (k === 'h') schnittUmschalten(ev.shiftKey ? 'v' : 'h');
    else if (k === 'd') dreiDUmschalten();
    else if (ev.key === 'Escape') {
      ui.messStart = null; ui.neueNrStart = null;
      /* WP3-P1: aktive Seiten-Wahl zuerst abbrechen (hohe Prioritaet) — die
         erzeugten Konturen bleiben dabei bei i=311 (keine Korrektur) stehen,
         nur der interaktive Zwischenschritt wird verworfen. */
      if (ui.seitenWahl) { ui.seitenWahl = null; seitenWahlPopupVerstecken(); svgRendern(); return; }
      /* WP-G: Ecken-Markierungs-Modus abbrechen */
      { const am = document.getElementById('automatikMenue');
        if (am && !am.classList.contains('versteckt')) { am.classList.add('versteckt'); return; } }
      if (ui.eckenPml) { ui.eckenPml = null; hinweisAnzeigen('Ecken-Markierung abgebrochen.', 'info'); svgRendern(); return; }
      /* WP3: Entwurf einer neuen Kontur zuerst verwerfen, ohne das Werkzeug zu verlassen */
      if (ui.neueKontur) { ui.neueKontur = null; ui._neueKonturMaus = null; ui.snapAnzeige = null; svgRendern(); return; }
      if (ui.schnitt.aktiv) { ui.schnitt.aktiv = null;
        document.getElementById('btnSchnittH').classList.remove('umschalt-aktiv');
        document.getElementById('btnSchnittV').classList.remove('umschalt-aktiv');
        svgRendern(); }
      else if (ui.dreiD) dreiDUmschalten();
      else if (ui.werkzeug !== 'auswahl') werkzeugSetzen('auswahl');
      else auswahlSetzen(null);
    } else if (ev.key === 'Delete' && ui.auswahl && ui.auswahl.typ === 'op') {
      eigenschaftenAktion(ui.mehrAuswahl.length ? 'mehr-loeschen' : 'op-loeschen');
    }
  });

  splitterEinrichten('splitterLinks', true);
  splitterEinrichten('splitterRechts', false);
  window.addEventListener('resize', () => { if (modell) { svgRendern(); textPanelRendern(); } });

  /* Kontextmenue (Rechtsklick) — global */
  document.addEventListener('contextmenu', ev => {
    /* AP2: nach einem Rechtsklick-Ziehen (Mehrfachauswahl per Linie/Kasten)
       darf das Kontextmenue NICHT zusaetzlich aufgehen — Flag einmalig
       konsumieren, danach normales Verhalten. */
    if (ui._rechtsauswahlWar) { ui._rechtsauswahlWar = false; ev.preventDefault(); return; }
    if (ev.target.closest('input, textarea, select, .kontextmenue')) return;
    kontextmenueAnzeigen(ev);
  });
  const km = document.getElementById('kontextmenue');
  km.addEventListener('click', ev => {
    const eintrag = ev.target.closest('[data-km]');
    if (!eintrag) return;
    const aktion = km._aktionen && km._aktionen[eintrag.dataset.km];
    kontextmenueSchliessen();
    if (aktion) aktion();
  });
  /* GUI-C: Eigenschafts-Felder im Menue — Aendern uebernimmt sofort,
     Enter uebernimmt und schliesst; das Menue bleibt sonst offen, damit
     mehrere Felder nacheinander einstellbar sind. */
  km.addEventListener('change', ev => {
    const inp = ev.target.closest('input[data-km-feld]');
    if (inp) kmEigenschaftUebernehmen(inp);
  });
  km.addEventListener('keydown', ev => {
    if (ev.key === 'Enter' && ev.target.matches('input[data-km-feld]')) {
      ev.target.blur();
      kontextmenueSchliessen();
    }
  });
  document.addEventListener('pointerdown', ev => {
    if (!ev.target.closest('.kontextmenue')) kontextmenueSchliessen();
  }, true);
  /* GUI-F: Befehlspalette — Eingabe filtert, Pfeile waehlen, Enter fuehrt aus */
  const paletteEingabe = document.getElementById('paletteEingabe');
  paletteEingabe.addEventListener('input', () => { paletteAktiv = 0; paletteRendern(); });
  paletteEingabe.addEventListener('keydown', ev => {
    ev.stopPropagation();
    if (ev.key === 'Escape') { paletteSchliessen(); return; }
    if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'k') { ev.preventDefault(); paletteSchliessen(); return; }
    if (ev.key === 'ArrowDown') { ev.preventDefault(); paletteAktiv++; paletteRendern(); return; }
    if (ev.key === 'ArrowUp') { ev.preventDefault(); paletteAktiv = Math.max(0, paletteAktiv - 1); paletteRendern(); return; }
    if (ev.key === 'Enter') { ev.preventDefault(); paletteAusfuehren(paletteRendern()); }
  });
  document.getElementById('paletteListe').addEventListener('click', ev => {
    const zeile = ev.target.closest('[data-palette]');
    if (!zeile) return;
    paletteAktiv = parseInt(zeile.dataset.palette, 10);
    paletteAusfuehren(paletteRendern());
  });
  document.addEventListener('pointerdown', ev => {
    if (!document.getElementById('palette').classList.contains('versteckt')
        && !ev.target.closest('.palette')) paletteSchliessen();
  }, true);
  document.addEventListener('keydown', ev => { if (ev.key === 'Escape') kontextmenueSchliessen(); });
  window.addEventListener('scroll', kontextmenueSchliessen, true);
  document.getElementById('canvasWrapper').addEventListener('wheel', kontextmenueSchliessen, { passive: true });

  neuVorgabenBeimStart();   /* v2.54: zuletzt genutzte Neu-Kontur-Art (vor der Uebergabe!) */
  uebergabeUebernehmen();   /* Oversight-Ergaenzung: siehe Definition oben init() */
  sitzungEinrichten();      /* v2.55: Sitzungssicherung + Startkarte (nach der Uebergabe!) */
  geraetebelegungBeimStart(); /* v2.62: fragt nur, wenn im Profil keine Geraete stehen */
  /* Zweiter Kanal (postMessage): meldet sich beim opener, falls per window.open
     aus der Uebersicht gestartet - no-op bei normalem/eigenstaendigem Aufruf. */
  try { if (window.opener) window.opener.postMessage({ typ: 'wup-editor-bereit' }, '*'); }
  catch (fehler) { /* egal - Uebergabe ist best effort */ }
}

/* Robust gegen Laden nach DOM-Ready (z.B. wenn das Tool als eingebettetes
   Fragment/Artefakt erst nach dem DOMContentLoaded-Event injiziert wird —
   dann feuert das Event nicht mehr und init() muss direkt laufen). */
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();
