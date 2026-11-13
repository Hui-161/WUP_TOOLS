function canvasPointerDown(ev) {
  if (!modell) return;
  /* AP2: rechte Maustaste gedrueckt halten + ziehen = Mehrfachauswahl per
     Linie/Kasten (nur in den Werkzeugen 'auswahl'/'kante', nicht im 3D/Mess-
     /Neue-Kontur-Modus). Ein Rechtsklick OHNE Ziehen bleibt unveraendert das
     Kontextmenue (siehe contextmenu-Handler + ui._rechtsauswahlWar unten). */
  if (ev.button === 2) {
    if (ui.dreiD || (ui.werkzeug !== 'auswahl' && ui.werkzeug !== 'kante')) return;
    if (ev.target.closest('#messPanel')) return;
    const weltR = svgWeltPunkt(ev);
    if (!weltR) return;
    ui.dragging = { art: 'rechtsauswahl', start: weltR, aktuell: weltR, bewegt: false };
    ev.preventDefault();
    return;
  }
  if (ev.button !== 0) return;
  /* Klicks im Mess-Panel (✕ je Zeile, "alle ✕") nicht als Canvas-Klick werten —
     sonst startet/beendet das Mess-Werkzeug eine Messung, bevor der Loesch-Klick greift. */
  if (ev.target.closest('#messPanel')) return;
  const welt = svgWeltPunkt(ev);
  if (!welt) return;

  /* WP3-P1: waehrend der Seiten-Wahl (nach PAF/PSG-Erzeugung) hat ein Klick
     Vorrang vor ALLEN anderen Werkzeug-Zweigen — er setzt die Korrektur und
     beendet den Zwischenschritt, statt eine neue Aktion des aktiven
     Werkzeugs auszuloesen. */
  if (ui.seitenWahl) { seitenWahlBestaetigen(welt); return; }

  /* WP-G: aktiver Ecken-Markierungs-Modus faengt den Klick ab */
  if (ui.eckenPml) { eckenPmlKlick(welt); ev.preventDefault(); return; }

  /* Schnittlinie anfassen (hat Vorrang) */
  let zielEl = ev.target;
  while (zielEl && zielEl !== svgEl()) {
    if (zielEl.dataset && zielEl.dataset.schnittlinie) {
      ui.dragging = { art: 'schnitt' };
      ev.preventDefault();
      return;
    }
    zielEl = zielEl.parentNode;
  }
  if (ui.dreiD) {
    /* 3D: ziehen dreht (az/el), Shift+ziehen verschiebt */
    if (ev.shiftKey)
      ui.dragging = { art: 'dreiDpan', startClient: [ev.clientX, ev.clientY], panStart: { ...ui.dreiDPan } };
    else
      ui.dragging = { art: 'dreiDdrehen', startClient: [ev.clientX, ev.clientY], winkelStart: { ...ui.dreiDWinkel } };
    return;
  }
  const treffer = elementUnterMaus(ev);

  if (ui.werkzeug === 'messen') {
    let snap;
    /* I-04 + Feedback 7: Klick im Schnittprofil misst entlang der Schnittlinie,
       faengt dabei auf Feature-Ziele (Nagelreihen, Kanten, Saegeschnitte). */
    const imProfil = mausImProfil(ev);
    if (imProfil) snap = profilSnapPunkt(welt).punkt;
    else snap = naechsterSnap(welt) || welt;
    if (!ui.messStart) { ui.messStart = snap; ui.snapAnzeige = snap; }
    else {
      ui.messungen.push({ a: ui.messStart, b: snap, profil: imProfil || undefined });
      ui.messStart = null;
    }
    svgRendern();
    messPanelRendern();
    return;
  }
  if (ui.werkzeug === 'neue-kontur') {
    const typEl = document.getElementById('neueKonturTyp');
    const typ = typEl ? typEl.value : 'PAF';
    /* Art NR: immer 2-Klick-Linie (kein Form-Dropdown noetig) — Logik wie
       frueher im eigenstaendigen Werkzeug 'neue-nr', jetzt unter 'neue-kontur'
       mit Art=NR eingegliedert (Feedback-Punkt 1). */
    if (typ === 'NR') {
      let p = welt.slice();
      if (ui.neueNrStart && ev.shiftKey) {
        /* Ortho-Fang an Startpunkt */
        if (Math.abs(p[0] - ui.neueNrStart[0]) > Math.abs(p[1] - ui.neueNrStart[1])) p[1] = ui.neueNrStart[1];
        else p[0] = ui.neueNrStart[0];
      }
      const snap = naechsterSnap(p) || p;
      if (!ui.neueNrStart) { ui.neueNrStart = snap; svgRendern(); return; }
      /* WP3-P3: auf jeder gewaehlten Ziel-Lage eine eigene NR erzeugen */
      for (const lage of zielLagenFuerNeu()) neueNagelreiheErzeugen(ui.neueNrStart, snap, lage);
      ui.neueNrStart = null;
      return;
    }
    const formEl = document.getElementById('neueKonturForm');
    const form = formEl ? formEl.value : 'polygon';
    if (form === 'mp') {
      if (!ui.neueKontur || !('zentrum' in ui.neueKontur)) {
        const snap = naechsterSnap(welt) || welt;
        ui.neueKontur = { zentrum: snap.slice() };
        svgRendern();
        return;
      }
      const zentrum = ui.neueKontur.zentrum;
      ui.neueKontur = null; ui._neueKonturMaus = null;
      const radius = Math.round(Geo.dist(zentrum, welt));
      if (radius < 1) { hinweisAnzeigen('Radius zu klein (mind. 1 mm) — Kreis verworfen.', 'warnung'); svgRendern(); return; }
      const lagen = zielLagenFuerNeu();
      if (!lagen.length) { hinweisAnzeigen('Keine sichtbare Lage fuer die Kontur.', 'warnung'); return; }
      /* MP/Kreis: keine Seiten-Wahl (Punkt 1 gilt nur fuer PAF/PSG-Polygon/Rechteck) */
      for (const lage of lagen) neuerKreisErzeugen(zentrum, radius, lage);
      return;
    }
    if (form === 'rechteck') {
      const snap = naechsterSnapZeichnen(welt) || welt;
      if (!ui.neueKontur || !('rechteckStart' in ui.neueKontur)) {
        ui.neueKontur = { rechteckStart: snap.slice() };
        svgRendern();
        return;
      }
      const eckeA = ui.neueKontur.rechteckStart;
      ui.neueKontur = null; ui._neueKonturMaus = null;
      const lagen = zielLagenFuerNeu();
      if (!lagen.length) { hinweisAnzeigen('Keine sichtbare Lage fuer die Kontur.', 'warnung'); svgRendern(); return; }
      if (Math.abs(snap[0] - eckeA[0]) < 1 || Math.abs(snap[1] - eckeA[1]) < 1) {
        hinweisAnzeigen('Rechteck zu klein (mind. 1 mm je Seite) — verworfen.', 'warnung'); svgRendern(); return;
      }
      const ops = lagen.map(lage => neuesRechteckErzeugen(eckeA, snap, typ, lage)).filter(Boolean);
      seitenWahlStartenFallsNoetig(typ, ops, lagen[0].id);
      return;
    }
    /* Form Polygon (Standard) */
    if (!ui.neueKontur || !('punkte' in ui.neueKontur)) ui.neueKontur = { punkte: [] };
    const best = zeichenPunktBestimmen(welt, ev.shiftKey);
    const p = best.p;
    const pkte = ui.neueKontur.punkte;
    /* Fang auf den Startpunkt (ab 3 Punkten) schliesst die Kontur direkt ab —
       explizit als geschlossen markieren (Feedback-Punkt 10: sonst fehlt die
       Schliesslinie, weil der Startpunkt selbst nicht in die Punktliste
       uebernommen wird und startEndeNah damit nicht zutrifft). */
    if (pkte.length >= 3 && Geo.dist(p, pkte[0]) < 1) {
      ui.snapAnzeige = null;
      neueKonturVersuchAbschliessen(true);
      return;
    }
    pkte.push(p);
    ui.snapAnzeige = best.gefangen ? p.slice() : null;
    svgRendern();
    return;
  }
  if (ui.werkzeug === 'kante') {
    /* WP-C: Gehoert die angefasste Bearbeitung zur Mehrfachauswahl, zieht die
       GRUPPE gemeinsam (ohne die Auswahl zu verwerfen). Endpunkt-Griff bei
       >= 2 ausgewaehlten NRs verschiebt die gleichseitigen Endpunkte.
       Strg/Shift bleiben fuer die Auswahl-Bearbeitung frei. */
    if (treffer && (treffer.typ === 'nr-ende' || treffer.typ === 'op')
        && !ev.ctrlKey && !ev.metaKey && !ev.shiftKey) {
      const fG = opFinden(treffer.opId);
      if (fG && opInMehrfachauswahl(fG.op.id)) {
        if (treffer.typ === 'nr-ende' && fG.op.kw === 'NR'
            && mehrfachOps().filter(g => g.op.kw === 'NR' && g.op.nr).length >= 2) {
          nrGruppenEndeDragStarten(welt, fG.op, treffer.ende);
        } else {
          opsGruppeDragStarten(welt, fG.op);
        }
        ev.preventDefault();
        return;
      }
    }
    /* NR im Verschieben-Modus: anfassen und ziehen (ganze NR oder Endpunkt) */
    if (treffer && (treffer.typ === 'nr-ende' || treffer.typ === 'op')) {
      const f = opFinden(treffer.opId);
      if (f && f.op.kw === 'NR') {
        if (ev.ctrlKey || ev.metaKey) { opAuswahlUmschalten(f.op.id, f.lage.id); return; }
        if (ev.shiftKey) { opAuswahlBereich(f.op.id, f.lage.id); return; }
        ui.kanten = [];
        ui.mehrAuswahl = [];
        auswahlSetzen({ typ: 'op', id: f.op.id, lageId: f.lage.id });
        /* WP-B: Snap-Kandidaten frisch aufbauen (Modell kann seit dem letzten
           Aufbau durch andere Drags veraendert worden sein), gezogenen
           Endpunkt von den Fangzielen ausschliessen (sonst klebt er fest). */
        snapPunkteAufbauen();
        const nrAusschluss = treffer.typ === 'nr-ende'
          ? [treffer.ende === 'a' ? [f.op.nr.xa, f.op.nr.ya] : [f.op.nr.xe, f.op.nr.ye]] : null;
        ui.dragging = {
          art: treffer.typ === 'nr-ende' ? 'nr-ende' : 'nr-ganz',
          opId: f.op.id, ende: treffer.ende, ausschluss: nrAusschluss,
          start: welt, nrStart: structuredClone(f.op.nr), bewegt: false, zuletztSnap: null
        };
        ev.preventDefault();
        return;
      }
    }
    /* WP2: Einzelpunkt (PP/KB-Punkt, MP-Zentrum) einer Op greifen — hat Vorrang
       vor Kante/ganzer Op, wirkt unabhaengig vom DOM-Treffer (Fangradius). */
    const punkt = naechsterOpPunktFinden(welt);
    if (punkt) {
      ui.kanten = []; ui.mehrAuswahl = [];
      auswahlSetzen({ typ: 'op', id: punkt.op.id, lageId: punkt.lage.id });
      /* WP-B: siehe oben — frischer Snap-Aufbau + Ausschluss des gezogenen Punkts
         (bei geschlossener Kontur liegt der Duplikat-Partner zu Dragbeginn an
         derselben Koordinate und wird durch den Koordinatenvergleich mitgefiltert). */
      snapPunkteAufbauen();
      ui.dragging = {
        art: 'op-punkt', opId: punkt.op.id, punkt: punkt.punkt,
        ausschluss: [[punkt.punkt.x, punkt.punkt.y]], zuletztSnap: null,
        start: welt, punktStart: { x: punkt.punkt.x, y: punkt.punkt.y }, bewegt: false
      };
      ev.preventDefault();
      return;
    }
    if (treffer && (treffer.typ === 'op' || treffer.typ === 'platte')) {
      const kante = naechsteKanteFinden(welt, treffer);
      if (kante) {
        if (ev.shiftKey) {
          /* Shift-Klick baut nur die Mehrfachauswahl auf (kein Drag) — wie bisher */
          const neu = kollineareKantenFinden(kante);
          for (const k of neu)
            if (!ui.kanten.some(v => v.besitzer === k.besitzer && v.id === k.id && v.segIdx === k.segIdx))
              ui.kanten.push(k);
          svgRendern();
          eigenschaftenRendern();
          verschiebenOverlayRendern();
          return;
        }
        /* War die angefasste Kante bereits Teil einer (per Shift) markierten
           Mehrfachauswahl, ziehen sich alle markierten gemeinsam; sonst wird
           die Auswahl auf die angefasste Kante zurueckgesetzt. */
        const bereitsMarkiert = ui.kanten.some(v => v.besitzer === kante.besitzer && v.id === kante.id && v.segIdx === kante.segIdx);
        if (!bereitsMarkiert) ui.kanten = [kante];
        const urspruenge = kantenUrsprungErfassen(ui.kanten);
        /* Feedback-Punkt 6: Snap-Kandidaten frisch aufbauen, die Punkte der
           gezogenen Kante(n) selbst als Fangziel ausschliessen (sonst faengt
           sich die Kante an ihren eigenen Endpunkten). */
        snapPunkteAufbauen();
        const kanteAusschluss = urspruenge.flatMap(u => [u.a0, u.b0]);
        ui.dragging = { art: 'kante-ganz', urspruenge, startWelt: welt, bewegt: false, ausschluss: kanteAusschluss, zuletztSnap: null };
        svgRendern();
        eigenschaftenRendern();
        verschiebenOverlayRendern();
        ev.preventDefault();
        return;
      }
      if (treffer.typ === 'op') {
        /* Kein Punkt, keine Kante im Fangradius, aber auf der Op-Flaeche/-Linie
           getroffen: ganze Op verschieben */
        const f = opFinden(treffer.opId);
        if (f) {
          ui.kanten = []; ui.mehrAuswahl = [];
          auswahlSetzen({ typ: 'op', id: f.op.id, lageId: f.lage.id });
          /* Feedback-Punkt 6 (Bonus): Anker = der Op-Punkt, der der Maus beim
             Dragstart am naechsten liegt — er wird beim Verschieben auf einen
             Snap-Punkt eingerastet. Snap-Kandidaten frisch aufbauen, alle
             Op-Punkte selbst als Fangziel ausschliessen. */
          snapPunkteAufbauen();
          const opPunkte = opPolyAlsArray(f.op)
            .concat(f.op.nr ? [[f.op.nr.xa, f.op.nr.ya], [f.op.nr.xe, f.op.nr.ye]] : [])
            .concat((f.op.nbr || []).map(n => [n.x, n.y]));
          let anker = null, besteDist = Infinity;
          for (const p of opPunkte) {
            const dd = Geo.dist(welt, p);
            if (dd < besteDist) { besteDist = dd; anker = { x: p[0], y: p[1] }; }
          }
          ui.dragging = {
            art: 'op-ganz', opId: f.op.id, start: welt,
            opStart: { poly: structuredClone(f.op.poly || []), nr: structuredClone(f.op.nr || null), nbr: structuredClone(f.op.nbr || []) },
            anker, ausschluss: opPunkte, zuletztSnap: null,
            bewegt: false
          };
          ev.preventDefault();
          return;
        }
      }
      ui.kanten = []; svgRendern(); eigenschaftenRendern(); verschiebenOverlayRendern();
    } else { ui.kanten = []; svgRendern(); eigenschaftenRendern(); verschiebenOverlayRendern(); }
    return;
  }

  /* Auswahl-Werkzeug — markiert nur, verschiebt NICHT (Verschieben = K-Modus) */
  if (treffer) {
    if (treffer.typ === 'nr-ende' || treffer.typ === 'op') {
      const f = opFinden(treffer.opId);
      if (f) {
        if (ev.ctrlKey || ev.metaKey) {
          opAuswahlUmschalten(f.op.id, f.lage.id);
          return;
        }
        if (ev.shiftKey) {
          opAuswahlBereich(f.op.id, f.lage.id);
          return;
        }
        ui.mehrAuswahl = [];
        auswahlSetzen({ typ: 'op', id: f.op.id, lageId: f.lage.id });
      }
    } else if (treffer.typ === 'platte') {
      const f = platteFinden(treffer.plattenId);
      if (f) auswahlSetzen({ typ: 'platte', id: f.platte.id, lageId: f.lage.id });
    } else if (treffer.typ === 'beam') {
      auswahlSetzen({ typ: 'beam', id: treffer.beamId });
    }
    return;
  }
  /* Leerflaeche: Shift = Gummiband-Mehrfachauswahl, sonst Pan */
  if (ev.shiftKey && ui.werkzeug === 'auswahl') {
    const svgC = svgEl().getScreenCTM();
    const sp = new DOMPoint(ev.clientX, ev.clientY).matrixTransform(svgC.inverse());
    ui.gummiband = { s: { x: sp.x, y: sp.y }, e: { x: sp.x, y: sp.y } };
    ui.dragging = { art: 'gummiband' };
    ev.preventDefault();
    return;
  }
  ui.dragging = { art: 'pan', startClient: [ev.clientX, ev.clientY], panStart: { ...ui.pan } };
  auswahlSetzen(null);
}
