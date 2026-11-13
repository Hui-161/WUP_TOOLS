/* =====================================================================
   F8 — PRUEFUNGEN P-01 .. P-25
   ===================================================================== */
/* P-25 (v2.64, Anwender 2026-11-13: "Nagelreihe direkt auf Plattenkante" —
   "Warnung, nur genau auf der Kante"): liegt eine NR GENAU auf einer Kante
   einer Platte ihrer Lage (Aussenkante oder Stoss), treffen die Naegel die
   Kante statt der Platte. BEWUSST kein Mindest-Randabstand: nur deckungs-
   gleich (Rechentoleranz 0,01 mm). Eine NR, die eine Kante nur KREUZT oder
   nur mit einem Endpunkt beruehrt, ist kein Befund.
   Rueckgabe: Liste der betroffenen Platten (leer = kein Befund). */
const NR_KANTE_TOLERANZ = 0.01;
function plattenUmrissFuerPruefung(platte) {
  if (platte.outline && platte.outline.length >= 3) return platte.outline;
  if (!(platte.lx > 0) || !(platte.by > 0)) return [];
  const x = platte.x, y = platte.y;
  return [[x, y], [x + platte.lx, y], [x + platte.lx, y + platte.by], [x, y + platte.by], [x, y]];
}
function nrAufPlattenkante(op, lage) {
  const a = [op.nr.xa, op.nr.ya], e = [op.nr.xe, op.nr.ye], tol = NR_KANTE_TOLERANZ;
  const punkt = Geo.dist(a, e) < tol;
  const treffer = [];
  for (const platte of (lage.plates || [])) {
    const umriss = plattenUmrissFuerPruefung(platte);
    let aufKante = false;
    for (let i = 0; i + 1 < umriss.length && !aufKante; i++) {
      const p = umriss[i], q = umriss[i + 1];
      const laenge = Geo.dist(p, q);
      if (laenge < tol) continue;
      const u = [(q[0] - p[0]) / laenge, (q[1] - p[1]) / laenge];
      const quer = w => Math.abs(u[0] * (w[1] - p[1]) - u[1] * (w[0] - p[0]));
      const laengs = w => u[0] * (w[0] - p[0]) + u[1] * (w[1] - p[1]);
      if (quer(a) > tol || quer(e) > tol) continue;
      const ta = laengs(a), te = laengs(e);
      if (punkt) aufKante = ta >= -tol && ta <= laenge + tol;
      else aufKante = Math.min(Math.max(ta, te), laenge) - Math.max(Math.min(ta, te), 0) > tol;
    }
    if (aufKante) treffer.push(platte);
  }
  return treffer;
}
/* P-23: Punkte einer Kontur so zaehlen, wie die Maschine sie liest — PP und
   KB je ein Punkt, ein Kreis (MP) oder Rechteck (TA) ist fuer sich eine
   vollstaendige Kontur. TXT-Zeilen sind gar nicht erst in op.poly. */
const KONTUR_KW_MIT_PUNKTEN = ['PAF', 'PSG', 'PSF', 'PSZ', 'PML'];
function konturPunktAnzahl(poly) {
  let n = 0;
  for (const e of (poly || [])) {
    if (e.type === 'PP' || e.type === 'KB') n++;
    else if (e.type === 'MP' || e.type === 'TA') n += 2;
  }
  return n;
}
function konturOhnePunkteText(ort, kw, n, zeile) {
  return 'KONTUR_OHNE_PUNKTE: ' + ort + ' ' + kw + ' hat nur ' + n + ' Punkt(e)' + (zeile ? ' (Quelltext-Zeile ' + zeile + ')' : '')
    + ' — die Maschine verwirft sie (WupWorks: "must at least contain two points"), die Bearbeitung fehlt; '
    + 'Punkte aus der Originaldatei wiederherstellen';
}
function pruefungenAusfuehren() {
  if (!modell) return;
  const P = [];
  /* ref-Konvention {typ,id}: alle Aufrufer unten uebergeben ein rohes Op-Objekt
     (hat .id) oder null - hier auf {typ:'op', id} normalisieren, statt dass
     fehlerLogKlick auf nie existierende Felder wie ref.opId prueft. */
  const melde = (level, code, msg, ref, lageId) => P.push({ level, code, msg, ref: ref ? { typ: 'op', id: ref.id } : null, lageId });
  const ELM = modell.header.ELM;

  /* P-04 Wand zu gross */
  if (ELM.lx > profil.wand_max.lx || ELM.by > profil.wand_max.by || ELM.hz > profil.wand_max.hz)
    melde('fehler', 'P-04', 'WAND_ZU_GROSS: ELM ' + ELM.lx + '×' + ELM.by + '×' + ELM.hz
      + ' ueberschreitet Maschinenprofil ' + profil.wand_max.lx + '×' + profil.wand_max.by + '×' + profil.wand_max.hz, null, null);

  const alleKonturen = [];
  for (const lage of modell.layers) {
    /* P-07 gemischte hz */
    if (lage.hzGemischt)
      melde('warnung', 'P-07', 'LAGE_HZ_GEMISCHT: ' + lage.id + ' hat Platten mit unterschiedlichem hz — '
        + 'geringste Hoehe (' + lage.hz + ' mm) gilt fuer die ganze Lage, Kollisionsgefahr!', null, lage.id);

    /* P-19 (Anwenderwunsch): Platten-Materialindex 0/fehlend ist ein
       GRAVIERENDER Fehler — die Maschine kann das Material nicht zuordnen.
       Meldung je Namens-Gruppe (nicht je Platte), mit Index-Vorschlag nach
       der Weinmann-Materialindextabelle (4.3). Popup: gravierendeBefundePopup(). */
    const nullGruppen = new Map();
    for (const p of lage.plates) {
      if ((p.materialIdx || 0) !== 0) continue;
      const praefix = (p.name || '(ohne Name)').replace(/-\d+$/, '');
      nullGruppen.set(praefix, (nullGruppen.get(praefix) || 0) + 1);
    }
    for (const [praefix, anzahl] of nullGruppen) {
      const v = materialIndexVorschlag(praefix);
      melde('fehler', 'P-19', 'PLATTEN_IDX_NULL: ' + lage.id + ' — ' + anzahl + ' Platte(n) "' + praefix
        + '…" ohne Materialindex (i=0)' + (v ? ' — Vorschlag: ' + v.idx + ' (' + v.klasse + ')' : ' — Index manuell setzen (Strg+H)'),
        null, lage.id);
    }

    const psfPolys = lage.ops.filter(o => o.kw === 'PSF').map(o => ({ op: o, poly: opPolyAlsArray(o) }));

    for (const op of lage.ops) {
      const tMax = opMaxTiefe(op);

      if (op.kw === 'PSG' && tMax > profil.saege.tiefe_max)
        melde('fehler', 'P-01', 'SAEGE_ZU_TIEF: ' + lage.id + ' PSG |t|=' + tMax + ' > ' + profil.saege.tiefe_max + ' mm', op, lage.id);
      if (op.kw === 'PAF' && tMax > profil.fraeser.tiefe_max)
        melde('fehler', 'P-02', 'FRAESER_ZU_TIEF: ' + lage.id + ' PAF |t|=' + tMax + ' > ' + profil.fraeser.tiefe_max + ' mm', op, lage.id);

      /* P-23 (Anwenderwunsch nach Fund EG-02): Kontur mit < 2 Punkten — die
         Maschine verwirft sie still als Warnung, die Bearbeitung FEHLT
         (z. B. ein Saegeschnitt). Kein Korrektur-Knopf: die fehlenden
         Punkte lassen sich nicht rekonstruieren. */
      const punktAnzahl = KONTUR_KW_MIT_PUNKTEN.includes(op.kw) ? konturPunktAnzahl(op.poly) : 2;
      if (punktAnzahl < 2)
        melde('fehler', 'P-23', konturOhnePunkteText(lage.id, op.kw, punktAnzahl,
          !op._neu && op._opLine >= 0 ? op._opLine + 1 : null), op, lage.id);

      /* P-08 offene PSF/PSZ (bei < 2 Punkten meldet schon P-23 genauer) */
      if ((op.kw === 'PSF' || op.kw === 'PSZ') && punktAnzahl >= 2) {
        const pts = opPolyAlsArray(op);
        const mp = (op.poly||[]).some(e => e.type === 'MP');
        if (!mp && (pts.length < 4 || Geo.dist(pts[0], pts[pts.length-1]) > 0.01))
          melde('fehler', 'P-08', 'OFFENE_PSF: ' + lage.id + ' ' + op.kw + '-Polygon ist nicht geschlossen', op, lage.id);
      }

      /* P-06 ausserhalb */
      const pts = opPunkte(op);
      if (pts.length) {
        const b = Geo.bbox(pts);
        if (b.minX < -50 || b.minY < -50 || b.maxX > ELM.lx + 50 || b.maxY > ELM.by + 50)
          melde('warnung', 'P-06', 'OP_AUSSERHALB: ' + lage.id + ' ' + op.kw + ' ragt > 50 mm ueber die Element-Bbox', op, lage.id);
      }

      /* P-09 Korrektur 300 / P-11 / P-12 */
      if (opIstZerspanend(op)) {
        const punkte = (op.poly||[]).filter(e => e.type === 'PP' || e.type === 'KB');
        if (punkte.some(p => steuercodeZerlegen(p.i).korrektur === 3))
          melde('hinweis', 'P-09', 'KORREKTUR_300: ' + lage.id + ' ' + op.kw + ' — kein Gutteil/Abfall unterscheidbar', op, lage.id);
        const ana = f1Analysieren(op);
        if (!ana.problem) {
          for (const a of ana.aenderungen) {
            if (a.art === 'innen')
              melde('warnung', 'P-11', 'INNENECKE_UEBERSCHNITTEN: ' + lage.id + ' ' + op.kw + ' Punkt ' + (a.punktIdx+1)
                + ' — Ueberschnitt ins Gutteil', op, lage.id);
            else if (a.art === 'aussen')
              melde('hinweis', 'P-12', 'AUSSENECKE_UNTERSCHNITTEN: ' + lage.id + ' ' + op.kw + ' Punkt ' + (a.punktIdx+1)
                + ' — Material bleibt stehen', op, lage.id);
          }
          /* P-10 unterschnittene Innenecke ohne Freistich */
          const fraeserR = lagenMaterialAbrasiv(lage) ? profil.freistich.radius_abrasiv : profil.freistich.radius_holz;
          for (const ecke of f2InneneckenFinden(op, true, lage)) {
            if (!f2FreistichVorhanden(lage, ecke, fraeserR, op))
              melde('hinweis', 'P-10', 'INNENECKE_OHNE_FREISTICH: ' + lage.id + ' ' + op.kw + ' bei ('
                + Math.round(ecke.punkt.x) + '/' + Math.round(ecke.punkt.y) + ')', op, lage.id);
          }
        }
        alleKonturen.push({ lage, op, pts: opPunkte(op) });
      }

      /* P-13 NR-Abstand (Einzelnagel Start==Ende ist OK!) */
      if (op.kw === 'NR') {
        const einzel = Geo.dist([op.nr.xa,op.nr.ya],[op.nr.xe,op.nr.ye]) < 0.01;
        if (!einzel && (op.nr.a < 20 || op.nr.a > 300))
          melde('hinweis', 'P-13', 'NR_ABSTAND: ' + lage.id + ' a=' + op.nr.a + ' mm (ueblich 20–300)', op, lage.id);
        /* P-05 NR in PSF derselben Lage */
        for (const { op: psfOp, poly } of psfPolys) {
          if (poly.length < 3) continue;
          if (nagelPunkte(op).some(p => Geo.punktInPolygon(p, poly))) {
            melde('warnung', 'P-05', 'NR_IN_PSF: ' + lage.id + ' Nagelpunkte innerhalb Sperrflaeche — Maschine laesst aus, Befestigung fehlt dort', op, lage.id);
            break;
          }
        }
        /* P-20 (Anwenderwunsch, vorher P-13-Hinweis): NR-Geraeteindex muss
           einer der bekannten Maschinenprofil-Indizes sein (10/11/20/25/32) —
           alles andere ist ein FEHLER, die Maschine kennt das Geraet nicht. */
        /* P-25 NR genau auf einer Plattenkante der eigenen Lage (Warnung) */
        const kantenPlatten = nrAufPlattenkante(op, lage);
        if (kantenPlatten.length)
          melde('warnung', 'P-25', 'NR_AUF_PLATTENKANTE: ' + lage.id + ' Nagelreihe ('
            + op.nr.xa + ',' + op.nr.ya + ' → ' + op.nr.xe + ',' + op.nr.ye + ') liegt genau auf '
            + (kantenPlatten.length > 1 ? 'dem Stoss von ' + kantenPlatten.length + ' Platten'
              : 'einer Kante der Platte ' + kantenPlatten[0].id + (kantenPlatten[0].name ? ' "' + kantenPlatten[0].name + '"' : ''))
            + ' — die Naegel treffen die Kante statt der Platte; Reihe mit Randabstand in die Platte legen', op, lage.id);
        if (!profil.nr_indizes[op.nr.i])
          melde('fehler', 'P-20', 'NR_INDEX_UNBEKANNT: ' + lage.id + ' Geraeteindex ' + op.nr.i
            + ' ist keiner der bekannten Indizes (' + Object.keys(profil.nr_indizes).join('/') + ')', op, lage.id);
        /* P-22 (Anwenderwunsch): Fuer die AUSSENLAGE liest die Maschine
           Geraeteindex 20 aus dem Datensatz und stellt SELBST auf Geraet 25
           um. Steht bereits 25 im Datensatz einer PLA-Lage, greift diese
           Umstellung nicht wie vorgesehen — in den Datensatz gehoert 20. */
        if (lage.side === 'aussen' && op.nr.i === 25)
          melde('fehler', 'P-22', 'NR_INDEX_25_IN_PLA: ' + lage.id + ' Nagelreihe mit Geraeteindex 25 — '
            + 'in Aussenlagen gehoert 20 in den Datensatz, die Maschine stellt 20 selbst auf 25 um', op, lage.id);
      }

      /* P-21 (Anwenderwunsch): PAF/PSG mit Neigungswinkel != 0 — die Anlage
         saegt/fraest nur senkrecht, geneigte Linien sind ein FEHLER.
         Korrektur: Popup beim Laden bzw. neigungenNullen(). */
      if ((op.kw === 'PAF' || op.kw === 'PSG')) {
        const geneigt = (op.poly || []).filter(e =>
          (e.type === 'PP' || e.type === 'KB') && e.alpha && Math.abs(e.alpha) > 0.001);
        if (geneigt.length)
          melde('fehler', 'P-21', 'NEIGUNG: ' + lage.id + ' ' + op.kw + ' hat ' + geneigt.length
            + ' Punkt(e) mit Neigungswinkel != 0° (z.B. ' + fmtZahl(geneigt[0].alpha) + '°) — auf 0° stellen', op, lage.id);
      }

      /* P-14 Tiefe vs. Lagen-hz / Luftdicht-Regel */
      if (opIstZerspanend(op) && lage.hz > 0 && tMax > 0) {
        const darunter = lagenUnter(lage).sort((a,b) => b.num - a.num)[0];
        const darunterOsb = darunter && darunter.plates.some(p => p.materialIdx >= 30 && p.materialIdx <= 39);
        if (profil.luftdicht_regel_aktiv && darunterOsb && Math.abs(tMax - lage.hz) < 0.01)
          melde('hinweis', 'P-14', 'TIEFE: ' + lage.id + ' ' + op.kw + ' |t|=' + tMax + ' = Lagen-hz ueber OSB-Lage — '
            + 'Luftdicht-Korrektur (−1 mm) pruefen (Luftdicht-Regel)', op, lage.id);
        else if (tMax > 0.01 && tMax < lage.hz - 0.01 && tMax !== lage.hz)
          ; /* Teiltiefe ist legitim (Nut) — keine Meldung */
      }
    }

    /* P-15 PSF ohne NR */
    if (psfPolys.length && !lage.ops.some(o => o.kw === 'NR'))
      melde('hinweis', 'P-15', 'PSF_OHNE_NR: ' + lage.id + ' enthaelt Sperrflaechen, aber keine Nagelreihen', psfPolys[0].op, lage.id);

    /* P-16 identische Konturen doppelt */
    const zers = lage.ops.filter(opIstZerspanend);
    for (let i = 0; i < zers.length; i++) for (let j = i+1; j < zers.length; j++) {
      const a = opPolyAlsArray(zers[i]), b = opPolyAlsArray(zers[j]);
      if (a.length && a.length === b.length &&
          a.every((p, k) => Math.abs(p[0]-b[k][0]) <= 0.5 && Math.abs(p[1]-b[k][1]) <= 0.5)) {
        melde('warnung', 'P-16', 'OP_DOPPELT: ' + lage.id + ' — identische ' + zers[i].kw + '-Kontur doppelt vorhanden', zers[j], lage.id);
      }
    }
  }

  /* P-03 zerspanender Op ueber NR ohne abdeckende PSF (Klammerkollision!)
     — geprueft in der GLEICHEN Schicht und in allen Schichten darunter.
     PSG je Liniensegment, Fraesung je Flaeche (gleiche Logik wie Auto-PSF). */
  for (const { lage, op } of alleKonturen) {
    if (!f3KonturBbox(op)) continue;
    for (const ziel of [lage, ...lagenUnter(lage)]) {
      const nrs = ziel.ops.filter(o => o.kw === 'NR');
      if (!nrs.length) continue;
      const { off } = f3OffsetFuerLage(ziel);
      const psfs = ziel.ops.filter(o => o.kw === 'PSF').map(o => opPolyAlsArray(o)).filter(p => p.length >= 3);
      const gleiche = ziel === lage;
      const regionen = f3SchnittRegionen(op, off);
      let gemeldet = false;
      for (const region of regionen) {
        for (const nr of nrs) {
          if (nrRegionUngeschuetzt(nr, region, psfs)) {
            melde('fehler', 'P-03', 'PSF_FEHLT: ' + op.kw + ' in ' + lage.id + ' faehrt ueber Klammern (NR i=' + nr.nr.i
              + ') ' + (gleiche ? 'in derselben Schicht' : 'in ' + ziel.id)
              + ' ohne abdeckende Sperrflaeche — Kollisionsgefahr!', op, lage.id);
            gemeldet = true;
            break;
          }
        }
        if (gemeldet) break;
      }
    }
  }

  /* P-03b NR auf Riegel-Saegeschnitten (SG) ohne abdeckende PSF */
  const sgSchnitte = f3BauteilSchnitte();
  for (const ziel of (sgSchnitte.length ? modell.layers : [])) {
    const nrs = ziel.ops.filter(o => o.kw === 'NR');
    if (!nrs.length) continue;
    const { off } = f3OffsetFuerLage(ziel);
    const psfs = ziel.ops.filter(o => o.kw === 'PSF').map(o => opPolyAlsArray(o)).filter(p => p.length >= 3);
    for (const seg of sgSchnitte) {
      const region = { poly: f3StreifenUmSegment(seg.a, seg.b, off) };
      for (const nr of nrs) {
        if (nrRegionUngeschuetzt(nr, region, psfs)) {
          melde('fehler', 'P-03', 'PSF_FEHLT: Saegeschnitt (SG) faehrt ueber Klammern (NR i=' + nr.nr.i
            + ') in ' + ziel.id + ' ohne abdeckende Sperrflaeche — Kollisionsgefahr!', nr, ziel.id);
          break;
        }
      }
    }
  }

  /* P-03c (v2.61) BOZ in einer Plattenlage ueber NR ohne abdeckende PSF —
     eigene Lage + Lagen darunter, gleiche Region wie Auto-PSF */
  for (const lage of modell.layers) {
    for (const b of (lage.bohrungen || [])) {
      let gemeldet = false;
      for (const ziel of [lage, ...lagenUnter(lage)]) {
        const nrs = ziel.ops.filter(o => o.kw === 'NR');
        if (!nrs.length) continue;
        const { off } = f3OffsetFuerLage(ziel);
        const psfs = ziel.ops.filter(o => o.kw === 'PSF').map(o => opPolyAlsArray(o)).filter(p => p.length >= 3);
        const region = f3BohrungRegion(b, off);
        const nr = nrs.find(n => nrRegionUngeschuetzt(n, region, psfs));
        if (nr) {
          melde('fehler', 'P-03', 'PSF_FEHLT: BOZ in ' + lage.id + ' bei (' + fmtZahl(b.x) + '/' + fmtZahl(b.y)
            + ') bohrt ueber Klammern (NR i=' + nr.nr.i + ') ' + (ziel === lage ? 'in derselben Schicht' : 'in ' + ziel.id)
            + ' ohne abdeckende Sperrflaeche — Kollisionsgefahr! (Automatik: Auto-Sperrflaechen)', nr, ziel.id);
          gemeldet = true;
        }
        if (gemeldet) break;
      }
    }
  }

  /* P-17 Material-Index mehrdeutig */
  for (const idx of Object.keys(modell.materialKatalog)) {
    const e = modell.materialKatalog[idx];
    if (e.namen.length > 1)
      melde('hinweis', 'P-17', 'MATERIAL_IDX_AMBIG: Index ' + idx + ' mit Namen: ' + e.namen.join(' / '), null, null);
  }

  /* P-18 Richtungsbearbeitung (WP-D): je Ober-/Untergurt muss eine
     Richtungsbohrung vorhanden sein — noetig fuer den Abgleich mit der
     Abbund-Datei (BVN/BVX). Zu mittig = Anfang/Ende nicht eindeutig. */
  for (const beam of modell.beams) {
    if (beam.kw !== 'OG' && beam.kw !== 'UG') continue;
    const wo = (beam.kw === 'OG' ? 'Obergurt (Raehm)' : 'Untergurt (Schwelle)')
      + (beam.name ? ' "' + beam.name + '"' : '') + (beam.fromModule ? ' [MODUL]' : '');
    const gefunden = richtungsbearbeitungFinden(beam);
    if (!gefunden.length)
      melde('warnung', 'P-18', 'RICHTUNG_FEHLT: ' + wo + ' hat keine Richtungsbearbeitung (BOZ Ø'
        + profil.richtung.durchmesser + ' mm, Tiefe ' + profil.richtung.tiefe_min + '-' + profil.richtung.tiefe_max
        + ' mm) — noetig fuer den Abgleich mit der Abbund-Datei (BVN/BVX). Automatik: Knopf "Richtung".', null, null);
    else if (!gefunden.some(g => g.eindeutig))
      melde('hinweis', 'P-18', 'RICHTUNG_MITTIG: ' + wo + ': Richtungsbearbeitung liegt zu nah an der '
        + 'Bauteilmitte — Anfang/Ende nicht eindeutig zuordenbar, bitte weiter zum Bauteilende setzen.', null, null);
  }

  /* P-23 auch fuer Kontur-Bearbeitungen an Bauteilen (Riegelwerk) */
  for (const beam of modell.beams) {
    for (const bb of (beam.bearbeitungen || [])) {
      if (!KONTUR_KW_MIT_PUNKTEN.includes(bb.kw) || !Array.isArray(bb.poly)) continue;
      const n = konturPunktAnzahl(bb.poly);
      if (n < 2)
        melde('fehler', 'P-23', konturOhnePunkteText('Bauteil ' + beam.kw + (beam.name ? ' "' + beam.name + '"' : ''),
          bb.kw, n, bb._zeile >= 0 ? bb._zeile + 1 : null), null, null);
    }
  }

  /* P-24 (v2.60, Anwenderwunsch: "als gravierenden Befund melden" — "nur
     die BOZ in den Plattenlagen"): BOZ als Plattenbearbeitung ist seit
     Schnittstelle 3.4 abgekuendigt ("PAF / MP ersetzt BOZ", S. 31).
     Riegelwerk-BOZ (Richtungsbohrung) sind BEWUSST ausgenommen.
     Korrektur: bozAlleErsetzen() (Popup). Warnung, kein Fehler. */
  for (const lage of modell.layers) {
    for (const b of (lage.bohrungen || [])) {
      if (b._umgestellt) continue;
      melde('warnung', 'P-24', 'BOZ_ABGEKUENDIGT: ' + lage.id + ' BOZ ' + b.params.join(',').trim()
        + ' (Quelltext-Zeile ' + (b._zeile + 1) + '): BOZ in einer Plattenlage wird seit WUP 3.4 nicht mehr '
        + 'unterstuetzt — Ersatz PAF 2 + MP (Korrektur im Befunde-Popup)', null, lage.id);
    }
  }

  modell.pruefungen = P;
}

