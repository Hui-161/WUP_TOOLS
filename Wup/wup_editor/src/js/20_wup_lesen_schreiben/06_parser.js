/* =====================================================================
   §7 PARSER
   ===================================================================== */
const KW_BAUTEIL = ['OG','UG','LS','QS','BT4','BT6','BTN','EBT'];
const KW_BAUTEIL_BEARB = ['SG','SZ','KN','MPL','PZF','BOZ','BOY','BOX','FRZ','FRY','KER','REFKER','NC'];
const KW_LAGEN_OP = ['PAF','PSG','PSF','PSZ','NR','NBR','PML'];
const KW_POLY = ['PP','KB','MP','TA'];
const RE_PLATTE = /^(PLI|PLA|SLI|SLA)(\d+)$/;
const RE_MULTIWAND = /Beginn Kommentare Element\s+(\d+)\s*:\s*(.+?)(?:\s*\*+)?\s*;?\s*$/;

let modell = null;
let opIdZaehler = 0;

function neuesModell() {
  return {
    raw: '', rawLines: [], encoding: 'ascii', hatteBom: false, zeilenEnde: '\r\n',
    header: { VERSION: '', ELM: { lx: 0, by: 0, hz: 0, n: 1, xoffset: 0, yoffset: 0 },
              ELN: '', ELB: '', ELA: 'INNEN', ANR: '', ZNR: '', REIHE: '', STAPEL: '' },
    headerZeilen: {},          /* kw -> Zeilennummer */
    txt: [], subWalls: [],
    beams: [], layers: [],
    opaque: [],                /* unbekannte Top-Level-Zeilen */
    materialKatalog: {},       /* idx -> { idx, namen:Set, klasse } */
    warnings: [], pruefungen: [],
    stats: { parsedLines: 0, txtLines: 0 },
    dateiName: ''
  };
}

function zahl(s) {
  if (s == null) return NaN;
  const v = parseFloat(String(s).trim());
  return isNaN(v) ? NaN : v;
}

function dateiDekodieren(buffer) {
  const bytes = new Uint8Array(buffer);
  let encoding = 'ascii', hatteBom = false, text;
  if (bytes.length >= 2 && bytes[0] === 0xFF && bytes[1] === 0xFE) {
    encoding = 'utf-16le'; hatteBom = true;
    text = new TextDecoder('utf-16le').decode(buffer.slice(2));
  } else if (bytes.length >= 3 && bytes[0] === 0xEF && bytes[1] === 0xBB && bytes[2] === 0xBF) {
    encoding = 'utf-8'; hatteBom = true;
    text = new TextDecoder('utf-8').decode(buffer.slice(3));
  } else if (bytes.length >= 2 && bytes[0] === 0xFE && bytes[1] === 0xFF) {
    /* EDT-3: UTF-16BE-BOM wurde bisher nicht erkannt und fiel in den
       UTF-8/Windows-1252-Zweig - der UTF-8-Decode schlaegt dabei zwar meist
       fehl, der Windows-1252-Fallback decodiert aber JEDES Byte (keine
       ungueltigen Sequenzen moeglich) und produziert dadurch stillen
       Datenmuell statt eines erkennbaren Fehlers. Klar abbrechen. */
    throw new Error('Datei ist UTF-16BE-kodiert (BOM FE FF) - dieses Format wird nicht unterstuetzt und wuerde '
      + 'als Datenmuell geparst. Bitte die Datei als UTF-8, UTF-16LE oder Windows-1252 speichern.');
  } else {
    try { text = new TextDecoder('utf-8', { fatal: true }).decode(buffer); encoding = 'utf-8'; }
    catch (e) { text = new TextDecoder('windows-1252').decode(buffer); encoding = 'windows-1252'; }
  }
  return { text, encoding, hatteBom };
}

function materialLernen(modell, idx, name) {
  if (idx == null || isNaN(idx)) return;
  const eintrag = modell.materialKatalog[idx] ||
    (modell.materialKatalog[idx] = { idx, namen: [], klasse: materialKlasse(idx) });
  const n = String(name || '').trim();
  if (n && !eintrag.namen.includes(n)) eintrag.namen.push(n);
}

function wupParsen(text, dateiName, encoding, hatteBom) {
  const m = neuesModell();
  m.dateiName = dateiName || 'unbenannt.wup';
  m.encoding = encoding; m.hatteBom = hatteBom;
  m.zeilenEnde = text.includes('\r\n') ? '\r\n' : '\n';
  m.raw = text;
  m.rawLines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');

  let bauKontext = null;     /* aktuelles Bauteil (fuer Bauteilbearbeitungen) */
  let lagenKontext = null;   /* aktuelle Lage */
  let aktPlatte = null;      /* letzte Platte (PP danach -> outline) */
  let aktOp = null;          /* aktuelle Lagenbearbeitung (PP danach -> poly) */
  let letzteNr = null;       /* fuer NBR */
  const modulStack = [];     /* { x, y } */
  let pendingTxtStart = null;/* TXT-Zeilen direkt vor einem Op wandern mit (Export) */
  let sektion = 'header';

  const offset = () => modulStack.reduce((a, o) => [a[0]+o.x, a[1]+o.y], [0, 0]);

  function lageHolen(kw) {
    const tre = kw.match(RE_PLATTE);
    const typ = tre[1], num = parseInt(tre[2], 10);
    let lage = m.layers.find(l => l.id === kw);
    if (!lage) {
      lage = { id: kw, typ, num,
               side: (typ === 'PLI' || typ === 'SLI') ? 'innen' : 'aussen',
               z: null, hz: null, plates: [], ops: [], sichtbar: true };
      m.layers.push(lage);
    }
    return lage;
  }

  function opAbschliessen() {
    if (aktOp && aktOp.poly && aktOp.poly.length) {
      const p = aktOp.poly;
      aktOp.closed = p.length >= 3 &&
        Math.abs(p[0].x - p[p.length-1].x) < 0.01 && Math.abs(p[0].y - p[p.length-1].y) < 0.01;
    }
    aktOp = null;
  }

  for (let z = 0; z < m.rawLines.length; z++) {
    const roh = m.rawLines[z];
    if (!roh.trim()) { continue; }
    const treffer = roh.match(/^\s*([A-Za-z][A-Za-z0-9_]*)\s*(.*?)\s*$/);
    if (!treffer) { m.warnings.push({ level:'warnung', code:'PARSE', msg:'Zeile nicht lesbar: '+roh.slice(0,60), zeile:z }); continue; }
    const kw = treffer[1].toUpperCase();
    let rest = treffer[2];
    /* Begrenzer ; — dahinter Kommentar */
    const semIdx = rest.indexOf(';');
    if (semIdx >= 0) rest = rest.slice(0, semIdx);
    const params = rest.length ? rest.split(/\s*,\s*/) : [];
    m.stats.parsedLines++;

    /* ---------- TXT / Kommentare ---------- */
    if (kw === 'TXT' || kw === 'KOMMENTAR') {
      m.stats.txtLines++;
      const mw = rest.match(RE_MULTIWAND) || roh.match(RE_MULTIWAND);
      if (mw) {
        m.subWalls.push({ num: parseInt(mw[1],10), fullName: mw[2].trim(),
          eln: '', znr: '', elb: '', _zeile: z });
      } else {
        const kv = roh.match(/^\s*TXT\s+([A-Za-z\u00C4\u00D6\u00DC\u00E4\u00F6\u00FC\u00DF./ \-]+?)\s*:\s*(.+?)\s*;?\s*$/);
        if (kv) {
          m.txt.push({ line: z, key: kv[1].trim(), value: kv[2].trim() });
          /* Sub-Wall-Blockwerte: TXT ELN xy / TXT ZNR xy */
        }
        const sub = m.subWalls[m.subWalls.length - 1];
        const blk = roh.match(/^\s*TXT\s+(ELN|ZNR|ELB)\s+(.+?)\s*;?\s*$/);
        if (sub && blk) {
          const f = blk[1].toLowerCase();
          if (!sub[f]) sub[f] = blk[2].trim();
        }
      }
      if (pendingTxtStart === null) pendingTxtStart = z;
      continue;
    }

    /* ---------- Dateikopf ---------- */
    if (['VERSION','ANR','ELB','ELN','ZNR','REIHE','STAPEL','ELA','CAD','CADRELEASE','WNP',
         'AUFTRAGSNUMMER','KUNDENAME','ANSCHRIFT'].includes(kw)) {
      m.header[kw] = rest.trim();
      m.headerZeilen[kw] = z;
      pendingTxtStart = null;
      continue;
    }
    if (kw === 'ELM') {
      m.header.ELM = { lx: zahl(params[0])||0, by: zahl(params[1])||0, hz: zahl(params[2])||0,
                       n: zahl(params[3])||1, xoffset: zahl(params[4])||0, yoffset: zahl(params[5])||0 };
      m.headerZeilen.ELM = z;
      pendingTxtStart = null;
      continue;
    }

    /* ---------- Module ---------- */
    if (kw === 'MODUL') {
      /* relative Urspruenge addieren sich ueber offset() beim Punkte-Einlesen */
      modulStack.push({ x: (zahl(params[3])||0), y: (zahl(params[4])||0),
        name: params[5] || '', _zeile: z });
      opAbschliessen();
      continue;
    }
    if (kw === 'ENDMODUL') { modulStack.pop(); opAbschliessen(); continue; }
    if (kw === 'UNIT' || kw === 'ENDUNIT' || kw === 'RT' || kw === 'ENDRT' ||
        kw === 'RBE2' || kw === 'ENDRBE2' || kw === 'RBE' || kw === 'PROPERTY') {
      m.opaque.push({ kw, zeile: z });
      continue;
    }

    /* ---------- Platten / Lagen ---------- */
    const pl = kw.match(RE_PLATTE);
    if (pl) {
      opAbschliessen();
      sektion = 'lagen';
      bauKontext = null;
      const lage = lageHolen(kw);
      lagenKontext = lage;
      const off = offset();
      let platte;
      if (pl[1] === 'SLI' || pl[1] === 'SLA') {
        /* 6 Eckpunkte */
        const pts = [];
        for (let i = 0; i < 6; i++) {
          const x = zahl(params[3 + i*2]), y = zahl(params[4 + i*2]);
          if (!isNaN(x) && !isNaN(y)) pts.push([x + off[0], y + off[1]]);
        }
        platte = { id: kw + '#' + (lage.plates.length+1), kw,
          lx: zahl(params[0])||0, by: zahl(params[1])||0, hz: zahl(params[2])||0,
          x: pts.length ? Math.min(...pts.map(p=>p[0])) : 0,
          y: pts.length ? Math.min(...pts.map(p=>p[1])) : 0,
          materialIdx: zahl(params[15]), name: (params[16]||'').trim(), z: zahl(params[17]),
          outline: pts.length ? pts.concat([pts[0].slice()]) : [],
          outlineSource: 'header', fromModule: modulStack.length > 0, _off: off.slice(),
          _lineStart: z, _lineEnd: z, _modified: false };
      } else {
        platte = { id: kw + '#' + (lage.plates.length+1), kw,
          lx: zahl(params[0])||0, by: zahl(params[1])||0, hz: zahl(params[2])||0,
          x: (zahl(params[3])||0) + off[0], y: (zahl(params[4])||0) + off[1],
          materialIdx: zahl(params[5]), name: (params[6]||'').trim(),
          z: params.length > 7 ? zahl(params[7]) : null,
          outline: [], outlineSource: 'header', fromModule: modulStack.length > 0, _off: off.slice(),
          _lineStart: z, _lineEnd: z, _modified: false };
      }
      materialLernen(m, platte.materialIdx, platte.name);
      lage.plates.push(platte);
      aktPlatte = platte;
      pendingTxtStart = null;
      continue;
    }

    /* ---------- Bauteile (Riegelwerk) ---------- */
    if (KW_BAUTEIL.includes(kw)) {
      opAbschliessen();
      sektion = 'beams';
      lagenKontext = null; aktPlatte = null;
      const off = offset();
      let beam = { id: 'B' + (m.beams.length+1), kw, hz: 0, z: 0, name: '', materialIdx: 0,
        outline: [], isTrapezoid: false, fromModule: modulStack.length > 0,
        bearbeitungen: [], _lineStart: z, _lineEnd: z, _modified: false, params };
      if (kw === 'BT4' || kw === 'BT6') {
        const n = kw === 'BT4' ? 4 : 6;
        const pts = [];
        for (let i = 0; i < n; i++) pts.push([ (zahl(params[3+i*2])||0)+off[0], (zahl(params[4+i*2])||0)+off[1] ]);
        beam.lx = zahl(params[0])||0; beam.by = zahl(params[1])||0; beam.hz = zahl(params[2])||0;
        beam.materialIdx = zahl(params[3+n*2]); beam.name = (params[4+n*2]||'').trim();
        beam.z = zahl(params[5+n*2]) || 0;
        /* Reihenfolge P1.1, P1.2(,P1.3), P2.1, P2.2(,P2.3) — fuer Zeichnung: 1.x vorwaerts, 2.x rueckwaerts? 
           Doku-Skizze: Umlauf 1.1 → 1.2 → (1.3) → 2.1 → 2.2 → (2.3) ergibt das Polygon. */
        beam.outline = pts.concat([pts[0].slice()]);
        beam.isTrapezoid = true;
      } else if (kw === 'BTN') {
        beam.lx = zahl(params[0])||0; beam.by = zahl(params[1])||0; beam.hz = zahl(params[2])||0;
        beam.x = (zahl(params[3])||0)+off[0]; beam.y = (zahl(params[4])||0)+off[1];
        beam.z = zahl(params[5])||0; beam.materialIdx = zahl(params[6]); beam.name = (params[7]||'').trim();
        beam.outline = []; beam._wartetAufPoly = true;
      } else if (kw === 'QS') {
        const ly = zahl(params[0])||0, bx = zahl(params[1])||0;
        beam.hz = zahl(params[2])||0;
        const x = (zahl(params[3])||0)+off[0], y = (zahl(params[4])||0)+off[1];
        beam.materialIdx = zahl(params[5]); beam.name = (params[6]||'').trim();
        beam.z = zahl(params[7]) || 0;
        beam.lx = bx; beam.by = ly; beam.x = x; beam.y = y;
        beam.outline = [[x,y],[x+bx,y],[x+bx,y+ly],[x,y+ly],[x,y]];
      } else {
        const lx = zahl(params[0])||0, by = zahl(params[1])||0;
        beam.hz = zahl(params[2])||0;
        const x = (zahl(params[3])||0)+off[0], y = (zahl(params[4])||0)+off[1];
        beam.materialIdx = zahl(params[5]); beam.name = (params[6]||'').trim();
        beam.z = zahl(params[7]) || 0;
        beam.lx = lx; beam.by = by; beam.x = x; beam.y = y;
        beam.outline = [[x,y],[x+lx,y],[x+lx,y+by],[x,y+by],[x,y]];
      }
      materialLernen(m, beam.materialIdx > 99 ? beam.materialIdx : null, beam.name);
      m.beams.push(beam);
      bauKontext = beam;
      pendingTxtStart = null;
      continue;
    }

    /* ---------- Lagenbearbeitungen ---------- */
    if (sektion === 'lagen' && lagenKontext && KW_LAGEN_OP.includes(kw)) {
      opAbschliessen();
      const op = { id: 'op' + (++opIdZaehler), kw, headerParams: rest.trim(),
        poly: [], closed: false, auto: false, lageId: lagenKontext.id,
        _off: offset(),  /* MODUL-Offset fuer Rueckrechnung beim Export */
        _lineStart: pendingTxtStart !== null ? pendingTxtStart : z,
        _opLine: z, _lineEnd: z, _modified: false, _neu: false };
      pendingTxtStart = null;
      if (kw === 'NR') {
        op.nr = { xa: zahl(params[0])||0, ya: zahl(params[1])||0,
                  xe: zahl(params[2])||0, ye: zahl(params[3])||0,
                  a: zahl(params[4])||0, i: Math.round(zahl(params[5])||0) };
        const off = offset();
        op.nr.xa += off[0]; op.nr.ya += off[1]; op.nr.xe += off[0]; op.nr.ye += off[1];
        op.nbr = [];
        letzteNr = op;
        lagenKontext.ops.push(op);
      } else if (kw === 'NBR') {
        if (letzteNr) { letzteNr.nbr.push({ x: zahl(params[0])||0, y: zahl(params[1])||0, i: zahl(params[2])||0, _zeile: z });
          letzteNr._lineEnd = z; }
        else m.warnings.push({ level:'warnung', code:'NBR', msg:'NBR ohne vorangehende NR (Zeile '+(z+1)+')', zeile:z });
      } else {
        lagenKontext.ops.push(op);
        aktOp = op;
        letzteNr = null;
      }
      aktPlatte = null; /* PP gehen ab jetzt in Ops, nicht mehr in Plattenumriss */
      continue;
    }

    /* ---------- Bauteilbearbeitungen ---------- */
    if (sektion === 'beams' && bauKontext &&
        (KW_BAUTEIL_BEARB.includes(kw) || kw === 'PAF' || kw === 'PSG' || kw === 'PSF')) {
      opAbschliessen();
      const b = { kw, params: params.slice(), poly: [], _zeile: z, _zeileEnde: z, _beam: bauKontext };
      bauKontext.bearbeitungen.push(b);
      bauKontext._lineEnd = z;
      if (kw === 'PAF' || kw === 'PSG' || kw === 'PZF' || kw === 'PSF' || kw === 'PML') {
        aktOp = { id: 'bb' + (++opIdZaehler), kw, poly: [], _beamBearb: b, _lineEnd: z };
      }
      pendingTxtStart = null;
      continue;
    }

    /* ---------- Polygonelemente ---------- */
    if (KW_POLY.includes(kw)) {
      const off = offset();
      const el = { type: kw, raw: params.slice() };
      if (kw === 'PP') {
        el.x = (zahl(params[0])||0)+off[0]; el.y = (zahl(params[1])||0)+off[1];
        el.t = zahl(params[2]) || 0; el.i = Math.round(zahl(params[3])||0);
        el.alpha = zahl(params[4]) || 0; el.z = params.length > 5 ? zahl(params[5]) : null;
      } else if (kw === 'KB') {
        el.x = (zahl(params[0])||0)+off[0]; el.y = (zahl(params[1])||0)+off[1];
        el.r = zahl(params[2])||0; el.kbTyp = (params[3]||'Acw').trim();
        el.t = zahl(params[4])||0; el.i = Math.round(zahl(params[5])||0);
        el.alpha = zahl(params[6])||0; el.z = params.length > 7 ? zahl(params[7]) : null;
      } else if (kw === 'MP') {
        el.x = (zahl(params[0])||0)+off[0]; el.y = (zahl(params[1])||0)+off[1];
        el.r = zahl(params[2])||0; el.t = zahl(params[3])||0;
        el.i = Math.round(zahl(params[4])||0); el.z = params.length > 5 ? zahl(params[5]) : null;
      } else if (kw === 'TA') {
        el.lx = zahl(params[0])||0; el.by = zahl(params[1])||0;
        el.x = (zahl(params[2])||0)+off[0]; el.y = (zahl(params[3])||0)+off[1];
        el.z = zahl(params[4])||0; el.t = zahl(params[5])||0; el.r = zahl(params[6])||0;
        el.alpha = zahl(params[7])||0; el.delta = zahl(params[8])||0; el.i = Math.round(zahl(params[9])||0);
      }
      if (aktOp) {
        aktOp.poly.push(el);
        aktOp._lineEnd = z;
        if (aktOp._beamBearb) { aktOp._beamBearb.poly.push(el); aktOp._beamBearb._zeileEnde = z; }
        if (aktOp.lageId == null && bauKontext) bauKontext._lineEnd = z;
        else if (aktOp.lageId != null) { /* Lagen-Op Zeilenende mitfuehren */ }
      } else if (aktPlatte && kw === 'PP') {
        aktPlatte.outline.push([el.x, el.y]);
        aktPlatte.outlineSource = 'pp';
        aktPlatte._lineEnd = z;
        aktPlatte._ppMaterialHinweis = el.i; /* i-Feld bei Umriss = ggf. Material-Idx, NICHT Steuercode */
        /* AP-WE5: Zusatzfelder JE Umriss-Punkt merken (i, alpha, z; z = null,
           wenn im Original nicht vorhanden) — platteSerialisieren schrieb
           vorher hart "0.000, 0" und loeschte damit still die z-Position
           der Umrisspunkte (Spec §7A: keine stillen Datenveraenderungen). */
        (aktPlatte._ppZusatz = aktPlatte._ppZusatz || []).push({ i: el.i || 0, alpha: el.alpha || 0, z: el.z });
      } else if (aktPlatte && kw === 'KB') {
        /* Kreisbogen im Umriss: vereinfachen auf Endpunkt */
        aktPlatte.outline.push([el.x, el.y]);
        aktPlatte.outlineSource = 'pp';
        aktPlatte._lineEnd = z;
      } else if (bauKontext && bauKontext._wartetAufPoly && kw !== 'TA') {
        bauKontext.outline.push([el.x, el.y]);
        bauKontext._lineEnd = z;
      } else {
        m.warnings.push({ level:'hinweis', code:'POLY', msg: kw+' ohne Kontext (Zeile '+(z+1)+')', zeile:z });
      }
      /* v2.56 (Anwenderfund EG-02, WupWorks "PSG must at least contain two
         points"): eine TXT-Zeile MITTEN in einer Punktliste (z. B. ein
         auskommentierter Punkt "TXT PP, 5604, 5, …") gehoert zur LAUFENDEN
         Kontur, nicht als Vorlauf zur naechsten. Ohne diesen Reset begann der
         Zeilenbereich der naechsten Op bei dieser TXT-Zeile und umfasste die
         restlichen Punkte davor — loeschte Auto-Kontur jene Op, verschwanden
         die Punkte mit (leere "PSG ;"). Alle anderen Zeilenarten setzen
         pendingTxtStart schon zurueck. */
      pendingTxtStart = null;
      continue;
    }

    /* ---------- BOZ in einer Plattenlage (v2.60) ----------
       Weinmann S. 31: BOZ x, y, d, t als Plattenbearbeitung — "nicht mehr
       unterstuetzt" (PAF / MP ersetzt BOZ). Real in der Einblaslage PLI0
       (Granit/CAD: "TXT ***BOHRUNG_BOZ***" + "BOZ 60, 497, 40, 2"). Bis
       v2.59 als UNBEKANNT durchgereicht und nie gezeichnet. Jetzt je Lage
       in lage.bohrungen gemerkt (Element-Koordinaten inkl. MODUL-Offset);
       die Zeile selbst bleibt unberuehrt (Roundtrip), P-24 meldet sie. */
    if (sektion === 'lagen' && lagenKontext && kw === 'BOZ') {
      const off = offset();
      (lagenKontext.bohrungen = lagenKontext.bohrungen || []).push({ kw, params: params.slice(), _zeile: z,
        x: (zahl(params[0]) || 0) + off[0], y: (zahl(params[1]) || 0) + off[1],
        d: Math.abs(zahl(params[2]) || 0), t: zahl(params[3]) || 0 });
      pendingTxtStart = null;
      continue;
    }

    /* ---------- Unbekannt ---------- */
    m.warnings.push({ level:'hinweis', code:'UNBEKANNT', msg:'Unbekanntes Keyword "'+kw+'" (Zeile '+(z+1)+') — wird 1:1 durchgereicht', zeile:z });
    m.opaque.push({ kw, zeile: z });
    pendingTxtStart = null;
  }
  opAbschliessen();

  /* ---------- Post-Pass ---------- */
  for (const lage of m.layers) {
    for (const platte of lage.plates) {
      if (!platte.outline.length && platte.kw.startsWith('PL')) {
        platte.outline = [
          [platte.x, platte.y], [platte.x + platte.lx, platte.y],
          [platte.x + platte.lx, platte.y + platte.by], [platte.x, platte.y + platte.by],
          [platte.x, platte.y]
        ];
        platte.outlineSource = 'header';
      }
      /* offenen PP-Umriss schliessen */
      if (platte.outline.length >= 3) {
        const o = platte.outline;
        if (Math.abs(o[0][0]-o[o.length-1][0]) > 0.01 || Math.abs(o[0][1]-o[o.length-1][1]) > 0.01)
          o.push(o[0].slice());
      }
    }
    /* Lagen-hz = min, z = erstes definiertes z */
    const hzWerte = lage.plates.map(p => p.hz).filter(h => h > 0);
    lage.hz = hzWerte.length ? Math.min(...hzWerte) : 0;
    lage.hzGemischt = new Set(hzWerte).size > 1;
    const zP = lage.plates.find(p => p.z != null && !isNaN(p.z));
    lage.z = zP ? zP.z : null;
    /* Op-Zeilenenden aus Poly */
    for (const op of lage.ops) {
      if (op.poly && op.poly.length === 0 && op.kw !== 'NR') {
        /* parameterloser Header ohne Punkte bleibt; closed bleibt false */
      }
    }
  }
  /* Lagen sortieren: erst innen aufsteigend, dann aussen aufsteigend */
  m.layers.sort((a, b) => a.side === b.side ? a.num - b.num : (a.side === 'innen' ? -1 : 1));

  /* Multiwand-X-Bereiche grob aus Plattenpositionen (nur Anzeige) */
  if (m.subWalls.length > 1) {
    m.multiwand = m.subWalls.length;   /* B-08: Feld war nie gesetzt -> UI zeigte nichts */
    m.warnings.push({ level:'hinweis', code:'MULTIWAND',
      msg: m.subWalls.length + ' Sub-Waende erkannt — Editor zeigt das Gesamtelement', zeile: 0 });
  }
  return m;
}

