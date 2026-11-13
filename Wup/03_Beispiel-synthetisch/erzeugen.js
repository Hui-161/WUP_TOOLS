#!/usr/bin/env node
/*
  Erzeugt die synthetischen WUP-Referenzdateien dieses Ordners.

  Alle Waende sind FREI ERFUNDEN: Masse, Raster, Material-, Projekt- und
  Elementnamen stammen aus den Beschreibungen weiter unten (Abschnitt
  "WAENDE"), nicht aus einem echten Bauvorhaben. Nachgebildet ist nur die
  SCHREIBWEISE zweier ueblicher CAD-Exporte:
    - "SEMA"-Stil   (Unterordner SEMA/):   VERSION 3.5, Kopfblock mit
      Sternzeilen, Zahlen in festen Spaltenbreiten, " ;" am Ende von
      Bearbeitungszeilen, Plattenpunkte "PP x, y, hz;"
    - "Granit"-Stil (Unterordner Granit/): VERSION  3.4, INFOBEGIN/PROJECT-
      Kopf, Schluesselwort auf 8 Zeichen aufgefuellt, Punkte
      "PP x, y, t, code, 0, z;"
  Zeilenende CRLF, Kodierung Windows-1252 (Umlaute als ein Byte).

  Aufruf:
    node erzeugen.js            schreibt die Dateien neu
    node erzeugen.js --pruefen  vergleicht nur; Rueckgabe 1 bei Abweichung

  Deterministisch: kein Zufall, kein Datum, keine Fremdpakete.
*/
'use strict';
const fs = require('fs');
const path = require('path');

/* =====================================================================
   GEOMETRIE-HELFER (alles achsparallel, Masse in mm)
   ===================================================================== */

/* Rechteck r = [x0,y0,x1,y1] ohne die Rechtecke in "loecher": Liste
   geschlossener Polygone (gegen den Uhrzeigersinn, Start unten links,
   erster Punkt am Ende wiederholt). Ein Loch mitten in der Flaeche laesst
   sich als Plattenumriss nicht schreiben -> Abbruch. */
function flaechenOhne(r, loecher) {
  const xs = new Set([r[0], r[2]]), ys = new Set([r[1], r[3]]);
  for (const l of loecher) {
    for (const x of [l[0], l[2]]) if (x > r[0] && x < r[2]) xs.add(x);
    for (const y of [l[1], l[3]]) if (y > r[1] && y < r[3]) ys.add(y);
  }
  const X = [...xs].sort((a, b) => a - b), Y = [...ys].sort((a, b) => a - b);
  const kanten = new Map();
  const kante = (a, b) => {
    const hin = a + '>' + b, zurueck = b + '>' + a;
    if (kanten.has(zurueck)) kanten.delete(zurueck); else kanten.set(hin, [a, b]);
  };
  for (let i = 0; i + 1 < X.length; i++) for (let j = 0; j + 1 < Y.length; j++) {
    const mx = (X[i] + X[i + 1]) / 2, my = (Y[j] + Y[j + 1]) / 2;
    if (loecher.some(l => mx > l[0] && mx < l[2] && my > l[1] && my < l[3])) continue;
    const a = X[i] + ',' + Y[j], b = X[i + 1] + ',' + Y[j], c = X[i + 1] + ',' + Y[j + 1], d = X[i] + ',' + Y[j + 1];
    kante(a, b); kante(b, c); kante(c, d); kante(d, a);
  }
  const nach = new Map();
  for (const [a, b] of kanten.values()) {
    if (nach.has(a)) throw new Error('Flaeche beruehrt sich nur an einer Ecke — Wand anders einteilen');
    nach.set(a, b);
  }
  const polygone = [];
  while (nach.size) {
    const start = [...nach.keys()].sort((p, q) => {
      const [px, py] = p.split(',').map(Number), [qx, qy] = q.split(',').map(Number);
      return py - qy || px - qx;
    })[0];
    let pts = [], akt = start;
    do { pts.push(akt.split(',').map(Number)); const n = nach.get(akt); nach.delete(akt); akt = n; } while (akt !== start);
    /* Punkte auf gerader Strecke entfernen */
    pts = pts.filter((p, i) => {
      const v = pts[(i + pts.length - 1) % pts.length], n = pts[(i + 1) % pts.length];
      return (p[0] - v[0]) * (n[1] - p[1]) - (p[1] - v[1]) * (n[0] - p[0]) !== 0;
    });
    let flaeche = 0;
    pts.forEach((p, i) => { const n = pts[(i + 1) % pts.length]; flaeche += p[0] * n[1] - n[0] * p[1]; });
    if (flaeche < 0) throw new Error('Oeffnung liegt mitten in einer Platte — Wand anders einteilen');
    /* Start = unterster, dann linkester Eckpunkt */
    let s = 0;
    pts.forEach((p, i) => { if (p[1] < pts[s][1] || (p[1] === pts[s][1] && p[0] < pts[s][0])) s = i; });
    pts = pts.slice(s).concat(pts.slice(0, s));
    polygone.push(pts.concat([pts[0].slice()]));
  }
  return polygone.sort((p, q) => p[0][0] - q[0][0] || p[0][1] - q[0][1]);
}

/* Achsparallele Strecke a->b ohne die Rechtecke in "loecher" (schon um den
   gewuenschten Rand vergroessert): Liste von Teilstrecken [a,b]. */
function streckeOhne(a, b, loecher) {
  const senkrecht = a[0] === b[0];
  const fest = senkrecht ? a[0] : a[1];
  let stuecke = [[Math.min(senkrecht ? a[1] : a[0], senkrecht ? b[1] : b[0]),
                  Math.max(senkrecht ? a[1] : a[0], senkrecht ? b[1] : b[0])]];
  for (const l of loecher) {
    const [q0, q1, l0, l1] = senkrecht ? [l[0], l[2], l[1], l[3]] : [l[1], l[3], l[0], l[2]];
    if (fest <= q0 || fest >= q1) continue;
    const neu = [];
    for (const [s0, s1] of stuecke) {
      if (l1 <= s0 || l0 >= s1) { neu.push([s0, s1]); continue; }
      if (l0 > s0) neu.push([s0, l0]);
      if (l1 < s1) neu.push([l1, s1]);
    }
    stuecke = neu;
  }
  return stuecke.filter(s => s[1] - s[0] >= 150)
    .map(s => senkrecht ? [[fest, s[0]], [fest, s[1]]] : [[s[0], fest], [s[1], fest]]);
}

const r3 = n => Math.round(n * 1000) / 1000;
const kasten = pts => ({
  x0: Math.min(...pts.map(p => p[0])), y0: Math.min(...pts.map(p => p[1])),
  x1: Math.max(...pts.map(p => p[0])), y1: Math.max(...pts.map(p => p[1]))
});

/* Streifen um eine Strecke: quer um "abstand" aufgeweitet, an beiden Enden
   um "abstand" verlaengert (so sichert eine Sperrflaeche eine Saegelinie). */
function streifen(a, b, abstand) {
  const dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy);
  const tx = dx / len, ty = dy / len, nx = -ty, ny = tx;
  const ax = a[0] - tx * abstand, ay = a[1] - ty * abstand, bx = b[0] + tx * abstand, by = b[1] + ty * abstand;
  return [[ax + nx * abstand, ay + ny * abstand], [bx + nx * abstand, by + ny * abstand],
          [bx - nx * abstand, by - ny * abstand], [ax - nx * abstand, ay - ny * abstand]].map(p => [r3(p[0]), r3(p[1])]);
}

/* Beruehrt oder kreuzt die Strecke a->b das (konvexe) Vieleck? */
function streckeTrifftVieleck(a, b, poly) {
  const kreuz = (o, p1, p2) => (p1[0] - o[0]) * (p2[1] - o[1]) - (p1[1] - o[1]) * (p2[0] - o[0]);
  const innen = q => {
    let plus = false, minus = false;
    poly.forEach((p1, i) => { const k = kreuz(p1, poly[(i + 1) % poly.length], q); if (k > 1e-9) plus = true; if (k < -1e-9) minus = true; });
    return !(plus && minus);
  };
  if (innen(a) || innen(b)) return true;
  return poly.some((p1, i) => {
    const p2 = poly[(i + 1) % poly.length];
    const d1 = kreuz(a, b, p1), d2 = kreuz(a, b, p2), d3 = kreuz(p1, p2, a), d4 = kreuz(p1, p2, b);
    return d1 * d2 <= 0 && d3 * d4 <= 0 && !(d1 === 0 && d2 === 0 && d3 === 0 && d4 === 0);
  });
}

/* =====================================================================
   WANDMODELL
   ===================================================================== */

/* Sicherheitsabstand der Sperrflaeche je Nagel-/Klammergeraet (NR-Index).
   Entspricht der Beispielbelegung des Editors (NR_INDIZES_BEISPIEL). */
const PSF_ABSTAND = { 10: 7, 11: 7, 20: 20, 25: 20, 32: 20 };

/* Riegelwerk einer rechteckigen Wand: Schwelle, Raehm, Stiele im Raster,
   an jeder Oeffnung Wechselstiele, Sturz- und Bruestungsriegel. */
function riegelwerk(w) {
  const { L, H, gurt, stiel, raster } = w, oeff = w.oeffnungen || [], riegel = w.riegel || stiel;
  const teile = [{ rolle: 'UG', x: 0, y: 0, dx: L, dy: gurt }];
  const stiele = [];
  const achsen = [stiel / 2];
  for (let x = raster; x < L - stiel * 1.5; x += raster) achsen.push(x);
  achsen.push(L - stiel / 2);
  for (const o of oeff) {
    stiele.push({ x: o.x0 - stiel, y: gurt, dy: H - 2 * gurt, wechsel: true });
    stiele.push({ x: o.x1, y: gurt, dy: H - 2 * gurt, wechsel: true });
  }
  for (const a of achsen) {
    const x = a - stiel / 2;
    const o = oeff.find(q => x + stiel > q.x0 - stiel && x < q.x1 + stiel);
    if (!o) { stiele.push({ x, y: gurt, dy: H - 2 * gurt }); continue; }
    if (x < o.x0 || x + stiel > o.x1) continue;            /* stoesst an einen Wechselstiel */
    if (o.y0 - riegel - gurt >= 200) stiele.push({ x, y: gurt, dy: o.y0 - riegel - gurt });
    if (H - gurt - o.y1 - riegel >= 200) stiele.push({ x, y: o.y1 + riegel, dy: H - gurt - o.y1 - riegel });
  }
  stiele.sort((p, q) => p.x - q.x || p.y - q.y);
  for (const s of stiele) teile.push({ rolle: 'stiel', x: s.x, y: s.y, dx: stiel, dy: s.dy });
  for (const o of oeff) {
    teile.push({ rolle: 'riegel', x: o.x0, y: o.y1, dx: o.x1 - o.x0, dy: riegel });
    if (o.y0 > gurt) teile.push({ rolle: 'riegel', x: o.x0, y: o.y0 - riegel, dx: o.x1 - o.x0, dy: riegel });
  }
  teile.push({ rolle: 'OG', x: 0, y: H - gurt, dx: L, dy: gurt });
  return teile;
}

/* Gefache: freie Felder zwischen den Hoelzern (fuer die Daemmlage). */
function gefache(w, teile) {
  const voll = [0, 0, w.L, w.H];
  const belegt = teile.map(t => [t.x, t.y, t.x + t.dx, t.y + t.dy]).concat((w.oeffnungen || []).map(o => [o.x0, o.y0, o.x1, o.y1]));
  return flaechenOhne(voll, belegt).filter(p => p.length === 5);
}

/* Beplankungslage: Platten im Raster, Oeffnungen ausgespart. */
function platten(w, lage) {
  const [x0, y0, x1, y1] = lage.flaeche;
  const loecher = lage.durchgehend ? [] : (w.oeffnungen || []).map(o => [o.x0, o.y0 === 0 ? y0 - 1 : o.y0, o.x1, o.y1]);
  const liste = [];
  for (let x = x0; x < x1; x += lage.plattenB) for (let y = y0; y < y1; y += lage.plattenL) {
    const r = [x, y, Math.min(x + lage.plattenB, x1), Math.min(y + lage.plattenL, y1)];
    for (const umriss of flaechenOhne(r, loecher)) liste.push({ umriss });
  }
  return liste;
}

/* Nagelreihen einer Beplankungslage: je Stiel eine senkrechte Reihe (am
   Plattenstoss zwei, je 12 mm neben dem Stoss), je Gurt/Riegel eine
   waagrechte. Um Oeffnungen bleibt "nrRand" frei. */
function nagelreihen(w, teile, lage) {
  const [x0, y0, x1, y1] = lage.flaeche, rand = lage.nrRand || 30;
  const loecher = lage.nrDurchOeffnung ? [] : (w.oeffnungen || []).map(o => [o.x0 - rand, o.y0 === 0 ? y0 - 1 : o.y0 - rand, o.x1 + rand, o.y1 + rand]);
  const stoesse = [];
  for (let x = x0 + lage.plattenB; x < x1; x += lage.plattenB) stoesse.push(x);
  const reihen = [];
  for (const t of teile) {
    if (t.rolle === 'stiel') {
      const mitte = t.x + t.dx / 2;
      const stoss = stoesse.find(s => s > t.x + 15 && s < t.x + t.dx - 15);
      const a = Math.max(t.y - 20, y0 + rand), b = Math.min(t.y + t.dy + 20, y1 - rand);
      for (const x of (stoss != null ? [stoss - 12, stoss + 12] : [mitte]))
        if (x > x0 + 10 && x < x1 - 10) reihen.push(...streckeOhne([x, a], [x, b], loecher));
    } else {
      const y = t.y + t.dy / 2;
      if (y <= y0 + 10 || y >= y1 - 10) continue;
      reihen.push(...streckeOhne([Math.max(t.x + 25, x0 + rand), y], [Math.min(t.x + t.dx - 25, x1 - rand), y], loecher));
    }
  }
  return reihen.map((s, i) => ({ kw: 'NR', a: i % 2 ? s[1] : s[0], e: i % 2 ? s[0] : s[1], abstand: lage.abstand, geraet: lage.geraet }));
}

/* Saegeschnitte einer Lage: Umriss (um Tueren unterbrochen) und Oeffnungen. */
function saegen(w, lage) {
  const [x0, y0, x1, y1] = lage.flaeche, t = lage.hz, ops = [];
  const pkt = (x, y, code) => [x, y, t, code];
  const tueren = (w.oeffnungen || []).filter(o => o.y0 === 0 && !lage.durchgehend).sort((a, b) => a.x0 - b.x0);
  const unten = [];
  let x = x0;
  for (const o of tueren) { unten.push([x, o.x0]); x = o.x1; }
  unten.push([x, x1]);
  if (lage.umriss === 'zug') {
    /* ein offener Zug je Stueck des Umrisses (Granit-Art) */
    const letzte = unten.pop();
    for (const [a, b] of unten) ops.push({ kw: 'PSG', punkte: [pkt(a, y0, 211), pkt(b, y0, 211)] });
    ops.push({ kw: 'PSG', punkte: [pkt(letzte[0], y0, 211), pkt(x1, y0, 211), pkt(x1, y1, 211), pkt(x0, y1, 211), pkt(x0, y0, 211)].slice(0, tueren.length ? 4 : 5) });
    if (tueren.length) ops.push({ kw: 'PSG', punkte: [pkt(x0, y1, 211), pkt(x0, y0, 211)] });
  } else {
    /* jede Kante einzeln (SEMA-Art) */
    for (const [a, b] of unten) ops.push({ kw: 'PSG', txt: 'linie', punkte: [pkt(a, y0, 211), pkt(b, y0, 211)] });
    ops.push({ kw: 'PSG', txt: 'linie', punkte: [pkt(x0, y1, 211), pkt(x0, y0, 211)] });
    ops.push({ kw: 'PSG', txt: 'linie', punkte: [pkt(x1, y1, 211), pkt(x0, y1, 211)] });
    ops.push({ kw: 'PSG', txt: 'linie', punkte: [pkt(x1, y0, 211), pkt(x1, y1, 211)] });
  }
  if (lage.durchgehend) return ops;
  for (const o of (w.oeffnungen || [])) {
    if (o.y0 === 0) {
      /* Tuer: unten offener Zug in Form eines Tors */
      ops.push({ kw: 'PSG', txt: 'rechteck', auskommentiert: [o.x0, y0 - 5, t, 121],
        punkte: [pkt(o.x1, y0 - 5, 111), pkt(o.x1, o.y1, 121), pkt(o.x0, o.y1, 121), pkt(o.x0, y0 - 5, 111)] });
    } else {
      ops.push({ kw: 'PSG', txt: 'rechteck', punkte: [pkt(o.x0, o.y0, 121), pkt(o.x1, o.y0, 121), pkt(o.x1, o.y1, 121),
        pkt(o.x0, o.y1, 121), pkt(o.x0, o.y0, 121)] });
    }
    /* Freistiche in den oberen Ecken */
    const s = lage.freistich;
    if (s && lage.freistichArt === 'winkel') {
      ops.push({ kw: 'PAF', txt: 'freistich', punkte: [pkt(o.x0, o.y1 - s, 212), pkt(o.x0, o.y1, 222), pkt(o.x0 + s, o.y1, 212)] });
      ops.push({ kw: 'PAF', txt: 'freistich', punkte: [pkt(o.x1 - s, o.y1, 212), pkt(o.x1, o.y1, 222), pkt(o.x1, o.y1 - s, 212)] });
    } else if (s) {
      ops.push({ kw: 'PAF', txt: 'fraesung', punkte: [pkt(o.x0, o.y1, 111), pkt(o.x0 + s, o.y1, 111)] });
      ops.push({ kw: 'PAF', txt: 'fraesung', punkte: [pkt(o.x0, o.y1 - s, 121), pkt(o.x0, o.y1, 121)] });
      ops.push({ kw: 'PAF', txt: 'fraesung', punkte: [pkt(o.x1, o.y1, 111), pkt(o.x1 - s, o.y1, 111)] });
      ops.push({ kw: 'PAF', txt: 'fraesung', punkte: [pkt(o.x1, o.y1 - s, 121), pkt(o.x1, o.y1, 121)] });
    }
  }
  return ops;
}

const seite = id => id.startsWith('PLI') ? 'innen' : 'aussen';
const nummer = id => parseInt(id.slice(3), 10);

/* Sperrflaechen: wo Saege oder Fraese ueber eine Nagelreihe derselben oder
   einer tieferen Lage derselben Wandseite faehrt, bekommt DIESE Lage eine
   Sperrflaeche. Saegelinie und offene Fraesbahn: Streifen je Teilstrecke;
   geschlossene Fraesung: die gefraeste Flaeche; Rundfraesung: Quadrat um
   den Kreis; Saegeschnitt am Riegel (SG): Streifen ueber die Bauteilbreite. */
function sperrflaechenErgaenzen(wand) {
  const lagen = wand.lagen.filter(l => l.ops);
  const eintragen = (ziel, poly, rund) => {
    const k = kasten(poly);
    const nrs = ziel.ops.filter(o => o.kw === 'NR');
    if (!nrs.some(n => streckeTrifftVieleck(n.a, n.e, poly))) return;
    const gedeckt = ziel.ops.some(o => o.kw === 'PSF' && o.kasten && o.kasten.x0 <= k.x0 && o.kasten.y0 <= k.y0
      && o.kasten.x1 >= k.x1 && o.kasten.y1 >= k.y1);
    if (gedeckt) return;
    const achsparallel = poly.every(p => p[0] === k.x0 || p[0] === k.x1) && poly.every(p => p[1] === k.y0 || p[1] === k.y1);
    /* Rundfraesung: runde Sperrflaeche (wie die CAD-Exporte sie schreiben) UND
       das Quadrat darum — der Editor wertet nur Sperrflaechen aus Punkten */
    if (rund) ziel.ops.push({ kw: 'PSF', txt: 'rund', kreis: rund });
    ziel.ops.push({ kw: 'PSF', txt: 'sperr', kasten: achsparallel && poly.length === 4 ? k : null,
      punkte: poly.concat([poly[0]]).map(p => [p[0], p[1], 0, 0]) });
  };
  const abstandVon = ziel => Math.max(0, ...ziel.ops.filter(o => o.kw === 'NR').map(o => PSF_ABSTAND[o.geraet]));
  for (const lage of lagen) {
    for (const op of lage.ops.slice()) {
      if (op.kw !== 'PSG' && op.kw !== 'PAF') continue;
      for (const ziel of lagen) {
        if (ziel !== lage && !(seite(ziel.id) === seite(lage.id) && nummer(ziel.id) < nummer(lage.id))) continue;
        if (!ziel.ops.some(o => o.kw === 'NR')) continue;
        const abstand = abstandVon(ziel);
        if (op.kreis) {
          const [x, y, r] = op.kreis, a = r + abstand;
          eintragen(ziel, [[x - a, y - a], [x + a, y - a], [x + a, y + a], [x - a, y + a]], ziel === lage ? [x, y, a] : null);
          continue;
        }
        const pts = op.punkte.map(p => [p[0], p[1]]);
        const zu = pts.length >= 4 && pts[0][0] === pts[pts.length - 1][0] && pts[0][1] === pts[pts.length - 1][1];
        if (op.kw === 'PAF' && zu) { eintragen(ziel, pts.slice(0, -1)); continue; }
        for (let i = 0; i + 1 < pts.length; i++) eintragen(ziel, streifen(pts[i], pts[i + 1], abstand));
      }
    }
  }
  for (const b of wand.hoelzer) for (const bb of (b.bearb || [])) {
    if (bb.kw !== 'SG') continue;
    const x = b.x + bb.p[0];
    for (const ziel of lagen) {
      if (!ziel.ops.some(o => o.kw === 'NR')) continue;
      eintragen(ziel, streifen([x, b.y], [x, b.y + b.dy], abstandVon(ziel)));
    }
  }
}

/* Aus einer Wandbeschreibung das vollstaendige Modell bauen. */
function wandBauen(w) {
  const teile = w.teile || riegelwerk(w);
  let pos = w.ersteNummer || 101;
  const hoelzer = teile.map(t => Object.assign({ nr: pos++, bearb: [] }, t));
  /* Richtungsbohrung in Schwelle und Raehm (Durchmesser 40, nah am Anfang) */
  for (const h of hoelzer) if (h.rolle === 'UG' || h.rolle === 'OG')
    h.bearb.push({ kw: 'BOZ', p: [w.richtungX || 100, h.dy / 2, 40, w.richtungT || 2] });
  const wand = { def: w, hoelzer, lagen: [] };
  for (const l of (w.lagen || [])) {
    const lage = Object.assign({}, l);
    if (l.art === 'gefach') lage.platten = gefache(w, teile).map(umriss => ({ umriss }));
    else if (l.art === 'latten') {
      lage.platten = teile.filter(t => t.rolle === 'stiel' && t.dy > 1000).map(t => {
        const x = t.x + (t.dx - l.plattenB) / 2, ya = l.flaeche[1], yb = l.flaeche[3];
        return { umriss: [[x, ya], [x + l.plattenB, ya], [x + l.plattenB, yb], [x, yb], [x, ya]] };
      });
    } else {
      lage.platten = l.platten || platten(w, l);
      lage.ops = [];
      if (l.geraet) lage.ops.push(...nagelreihen(w, teile, l));
      if (l.saege !== false) lage.ops.push(...saegen(w, l));
    }
    wand.lagen.push(lage);
  }
  if (w.zusatz) w.zusatz(wand);
  if (!w.ohneSperrflaechen) sperrflaechenErgaenzen(wand);
  return wand;
}

/* =====================================================================
   SCHREIBER "SEMA"-STIL
   ===================================================================== */
/* rechtsbuendig in fester Breite; ist die Zahl zu lang, bleibt mindestens ein Leerzeichen */
const p = (n, breite) => { const t = String(n); return t.length < breite ? t.padStart(breite) : ' ' + t; };
const STERNE = 'TXT ' + '*'.repeat(45) + ';';

function semaSchreiben(wand) {
  const w = wand.def, k = w.kopf, z = [];
  const kopfZeile = (name, wert) => z.push('TXT ' + (name + wert).padEnd(45) + ';');
  const titel = text => z.push(STERNE, 'TXT ' + text.slice(0, 44).padEnd(44) + '*;', STERNE);
  z.push('VERSION 3.5;', STERNE);
  kopfZeile('Lfnd. Nr.     : ', k.lfd);
  kopfZeile('BV / Kunden Nr: ', k.auftrag);
  kopfZeile('Bauvorhaben   : ', k.bauvorhaben);
  kopfZeile('Ort           : ', k.ort);
  kopfZeile('Bearbeiter    : ', 'XX');
  kopfZeile('BV Alt        : ', '');
  kopfZeile('Kundenname    : ', '');
  z.push(STERNE);
  kopfZeile('Objekt     : ', k.objekt);
  kopfZeile('Zeichnung  : ', w.datei);
  z.push(STERNE);
  z.push('ANR ' + k.auftrag + ' ;', 'ELB ' + k.elb + ';', 'ELN ' + k.eln + ';', 'ZNR ' + k.znr + ';', 'ELA INNEN;');
  z.push('ELM ' + p(w.L, 5) + ',' + p(w.H, 5) + ',' + p(w.D_gesamt, 5) + ', 1;');
  z.push('REIHE ' + k.znr + ';');
  titel('bauteilor. Bearb. (Hoelzer)');
  z.push('TXT HOELZER ;', 'TXT Laenge Breite Hoehe    X:   Y: ; ');
  const D = w.D;
  for (const h of wand.hoelzer) {
    const ende = ',  0,' + p(h.nr, 5) + ',' + p(0, 4) + ';';
    if (h.rolle === 'BT4')
      z.push('BT4 ' + p(h.laenge, 5) + ',' + p(h.breite, 5) + ',' + p(D, 5) + ',' + p(h.ecken[0][0], 5) + ',' + p(h.ecken[0][1], 5)
        + ',' + h.ecken.slice(1).map(e => e[0] + ',' + e[1]).join(',') + ende);
    else if (h.rolle === 'stiel')
      z.push('QS  ' + p(h.dy, 5) + ',' + p(h.dx, 5) + ',' + p(D, 5) + ',' + p(h.x, 5) + ',' + p(h.y, 5) + ende);
    else
      z.push((h.rolle === 'riegel' ? 'LS  ' : h.rolle + '  ') + p(h.dx, 5) + ',' + p(h.dy, 5) + ',' + p(D, 5) + ',' + p(h.x, 5) + ',' + p(h.y, 5) + ende);
    for (const b of h.bearb) {
      z.push('TXT ***BOHRUNG_BOZ*** ;');
      z.push('BOZ' + p(b.p[0], 7) + ',' + p(b.p[1], 7) + ',' + p(b.p[2], 7) + ', ' + b.p[3] + ' ;');
    }
  }
  const OP_TXT = { linie: '***SÄGELINIE, -, PSG** ;', rechteck: '***SAEGEPOLYGON_PSG_RECHTECK*** ;', fraesung: '***AUSFRAESUNG_PAF** ;',
    tasche: '***AUSFRAESUNG_PAF** ;', rund: null, sperr: '***SPERRFLAECHE_PSF*** ;', marke: '***MARKIERLINIE_PML*** ;' };
  for (const l of wand.lagen) {
    const kurz = (seite(l.id) === 'aussen' ? 'R' : 'L') + nummer(l.id);
    titel((l.art === 'gefach' ? 'bauteilor.' : 'elementor.') + ' Bearb. (Platten) ' + kurz + ' ' + l.material);
    z.push('TXT ' + l.id + ' ' + l.material + ';', 'TXT Breite Laenge Hoehe    X:   Y: ; ');
    for (const pl of l.platten) {
      const b = kasten(pl.umriss);
      z.push(l.id + ' ' + p(b.x1 - b.x0, 5) + ',' + p(b.y1 - b.y0, 5) + ',' + p(l.hz, 5) + ',' + p(b.x0, 5) + ',' + p(b.y0, 5)
        + ',' + p(l.idx, 6) + ', ' + l.material + ',' + p(l.z, 5) + ';');
      for (const q of pl.umriss) z.push('PP' + p(q[0], 8) + ',' + p(q[1], 5) + ',' + p(l.hz, 5) + ';');
    }
    const ops = l.ops || [];
    const reihenfolge = ['PML', 'PSF', 'NR', 'PSG', 'PAF'];
    for (const kw of reihenfolge) for (const op of ops.filter(o => o.kw === kw)) {
      if (op.kw === 'NR') {
        z.push('NR' + p(op.a[0], 7) + ',' + p(op.a[1], 7) + ',' + p(op.e[0], 7) + ',' + p(op.e[1], 7) + ', ' + op.abstand + ', ' + op.geraet + ' ;');
        continue;
      }
      if (op.kreis) {
        z.push('TXT ' + (op.kw === 'PSF' ? '***SPERRFLAECHE_PSF_RUND*** ;' : '***AUSFRAESUNG_PAF_RUND*** ;'), op.kw + ' ;');
        z.push('MP' + p(op.kreis[0], 7) + ',' + p(op.kreis[1], 7) + ',' + p(op.kreis[2], 7)
          + (op.kw === 'PSF' ? ', 0, 0, 0 ;' : ',' + p(op.kreis[3], 7) + ', ' + op.kreis[4] + ', 0 ;'));
        continue;
      }
      if (OP_TXT[op.txt]) z.push('TXT ' + OP_TXT[op.txt]);
      z.push(op.kw + ' ;');
      const punkt = q => p(q[0], 7) + ',' + p(q[1], 7) + ',' + (q[2] === 0 ? ' 0' : p(q[2], 7)) + ', ' + q[3] + ', 0, 0 ;';
      if (op.auskommentiert) z.push('TXT PP,' + punkt(op.auskommentiert));
      for (const q of op.punkte) z.push('PP' + punkt(q));
    }
  }
  return z;
}

/* =====================================================================
   SCHREIBER "GRANIT"-STIL
   ===================================================================== */
function granitSchreiben(wand) {
  const w = wand.def, k = w.kopf, z = [];
  const zeile = (kw, werte) => z.push(werte == null ? kw + ';' : kw.padEnd(8) + werte.join(', ') + ';');
  const txt = text => z.push('TXT     ' + text + ';');
  z.push('VERSION  ' + (w.version || '3.4') + ';');
  txt('INFOBEGIN: ' + '*'.repeat(73));
  txt('PROJECT: ' + k.projekt);
  txt('SUBPROJECT: ' + k.projekt);
  txt('ELEMENT: ' + k.projekt + '_' + k.znr);
  txt('FILENAME: ' + k.projekt + '_' + k.znr + '.wup');
  txt('INFOEND: ' + '*'.repeat(75));
  txt('KOPFDATEN');
  txt('WAND INSGESAMT ' + w.L);
  zeile('ELM', [w.L, w.H, w.D_gesamt, 1]);
  zeile('ELB', [k.elb]);
  zeile('ELN', [k.eln]);
  zeile('ELA', ['INNEN']);
  zeile('ANR', [k.auftrag]);
  zeile('ZNR', [k.znr]);
  const D = w.D;
  const NAME = { UG: 'KVH_C24-Schwelle-', OG: 'KVH_C24-Rähm-', stiel: 'KVH_C24-Stiel-', riegel: 'KVH_C24-Riegel-', BT4: 'KVH_C24-Strebe-' };
  for (const h of wand.hoelzer) {
    const name = NAME[h.rolle] + h.nr;
    if (h.rolle === 'BT4') zeile('BT4', [h.laenge, h.breite, D].concat(...h.ecken, [0, name]));
    else if (h.rolle === 'stiel') zeile('QS', [h.dy, h.dx, D, h.x, h.y, 0, name]);
    else zeile(h.rolle === 'riegel' ? 'LS' : h.rolle, [h.dx, h.dy, D, h.x, h.y, 0, name]);
    for (const b of h.bearb) zeile(b.kw, b.p);
  }
  for (const l of wand.lagen) {
    const innen = seite(l.id) === 'innen';
    let lfd = l.ersteNummer || 0;
    for (const pl of l.platten) {
      const b = kasten(pl.umriss);
      /* volle Rechteckplatten teilen sich eine Nummer, Zuschnitte zaehlen weiter */
      const name = l.material + (l.ersteNummer ? '-' + (pl.umriss.length === 5 ? l.ersteNummer : ++lfd) : '');
      const kopf = [b.x1 - b.x0, b.y1 - b.y0, l.hz, b.x0, b.y0, l.idx, name];
      if (l.art !== 'gefach') kopf.push(l.z);
      zeile(l.id, kopf);
      for (const q of pl.umriss) zeile('PP', l.art === 'gefach' ? [q[0], q[1], l.hz, 0, 0] : [q[0], q[1], l.hz, l.idx, 0, l.z]);
    }
    const ops = l.ops || [];
    const zOp = innen ? l.z + l.hz : l.z;
    for (const kw of ['NR', 'PSF', 'PML', 'PSG', 'PAF']) for (const op of ops.filter(o => o.kw === kw)) {
      if (op.kw === 'NR') { zeile('NR', [op.a[0], op.a[1], op.e[0], op.e[1], op.abstand, op.geraet]); continue; }
      if (op.kw === 'PSF') txt('SPERRFLAECHE FUER BEFESTIGUNG');
      else if (op.bemerkung) txt(op.bemerkung);
      zeile(op.kw);
      if (op.kreis) { zeile('MP', op.kw === 'PSF' ? [op.kreis[0], op.kreis[1], op.kreis[2], 0, 0] : [op.kreis[0], op.kreis[1], op.kreis[2], innen ? -op.kreis[3] : op.kreis[3], op.kreis[4], zOp]); continue; }
      for (const q of op.punkte)
        zeile('PP', op.kw === 'PSF' ? [q[0], q[1], 0, 0, 0] : [q[0], q[1], innen ? -q[2] : q[2], q[3], 0, zOp]);
    }
  }
  return z;
}

/* =====================================================================
   WAENDE — alle Masse frei gewaehlt
   ===================================================================== */
const OSB = { material: 'OSB-3 18 mm', idx: 30, hz: 18 };
const SEMA_KOPF = { auftrag: 'MUSTER-0001', bauvorhaben: 'Musterhaus Typ A', ort: 'Musterstadt', objekt: 'Beispielwand' };

const WAENDE = [];

/* --- SEMA/IW01: kleine Innenwand ohne Oeffnung, einseitig beplankt ------- */
WAENDE.push({
  stil: 'SEMA', datei: 'IW01.WUP', L: 2740, H: 2620, D: 100, D_gesamt: 118, gurt: 60, stiel: 60, raster: 670,
  kopf: Object.assign({ lfd: '0001', elb: 'INNENWAND', eln: 'IW01', znr: '01' }, SEMA_KOPF),
  lagen: [Object.assign({ id: 'PLI1', z: 100, flaeche: [0, 10, 2740, 2610], plattenB: 1340, plattenL: 2600,
    geraet: 10, abstand: 80, saege: false }, OSB)]
});

/* --- SEMA/IW02: Innenwand mit Tuer, zwei Balkentaschen, Markierlinie ----- */
WAENDE.push({
  stil: 'SEMA', datei: 'IW02.WUP', L: 5720, H: 2860, D: 140, D_gesamt: 158, gurt: 70, stiel: 70, raster: 660,
  oeffnungen: [{ x0: 2240, x1: 3340, y0: 0, y1: 2130 }],
  kopf: Object.assign({ lfd: '0002', elb: 'INNENWAND', eln: 'IW02', znr: '02' }, SEMA_KOPF),
  lagen: [Object.assign({ id: 'PLA1', z: -18, flaeche: [0, 10, 5720, 2860], plattenB: 1320, plattenL: 2400,
    geraet: 10, abstand: 90, freistich: 80 }, OSB)],
  zusatz(wand) {
    const ops = wand.lagen[0].ops;
    /* zwei Balkentaschen am oberen Rand; die Klammerreihe im Raehm laeuft
       durch -> der Generator setzt dort je eine Sperrflaeche */
    for (const x of [820, 4410]) ops.push({ kw: 'PAF', txt: 'tasche',
      punkte: [[x, 2700, 18, 121], [x + 170, 2700, 18, 121], [x + 170, 2860, 18, 121], [x, 2860, 18, 121], [x, 2700, 18, 121]] });
    /* Anschluss einer Querwand anzeichnen */
    ops.push({ kw: 'PML', txt: 'marke', punkte: [[4985, 80, 0, 1122], [4985, 2780, 0, 1122]] });
  }
});

/* --- SEMA/AW01: Aussenwand mit Fenster, vier Lagen ---------------------- */
WAENDE.push({
  stil: 'SEMA', datei: 'AW01.WUP', L: 6380, H: 2740, D: 180, D_gesamt: 288, gurt: 60, stiel: 60, raster: 640, riegel: 80,
  oeffnungen: [{ x0: 2610, x1: 4050, y0: 930, y1: 2190 }],
  kopf: Object.assign({ lfd: '0003', elb: 'AUSSENWAND', eln: 'AW01', znr: '03' }, SEMA_KOPF),
  lagen: [
    { id: 'PLI0', art: 'gefach', material: 'Zellulose Einblasdämmung', idx: 230, hz: 180, z: 0 },
    Object.assign({ id: 'PLI1', z: 180, flaeche: [0, 0, 6380, 2740], plattenB: 1280, plattenL: 2500,
      geraet: 10, abstand: 75, freistich: 90 }, OSB),
    { id: 'PLA1', material: 'Holzfaserplatte 60 mm', idx: 20, hz: 60, z: -60, flaeche: [0, 0, 6380, 2740],
      plattenB: 1920, plattenL: 1370, geraet: 20, abstand: 110, nrRand: 45 },
    { id: 'PLA2', art: 'latten', material: 'Traglatte 30x50', idx: 1, hz: 30, z: -90, flaeche: [0, 40, 6380, 2700], plattenB: 50 }
  ],
  zusatz(wand) {
    /* Durchfuehrung in der Innenbeplankung, knapp unter der Klammerreihe des
       Bruestungsriegels -> runde Sperrflaeche */
    wand.lagen[1].ops.push({ kw: 'PAF', kreis: [3330, 868, 34, 18, 211] });
  }
});

/* --- SEMA/GW01: Giebelwand mit schraegem Raehm (BT4) --------------------- */
(function () {
  const L = 4960, D = 120, gurt = 60, stiel = 60, h0 = 1480, h1 = 3340;   /* Oberkante steigt von h0 auf h1 */
  const oben = x => Math.round(h0 + (h1 - h0) * x / L);
  const teile = [{ rolle: 'UG', x: 0, y: 0, dx: L, dy: gurt }];
  const achsen = [30, 650, 1270, 1890, 2510, 3130, 3750, 4370, 4930];
  for (const a of achsen) {
    const x = a - stiel / 2, ya = oben(x) - gurt, yb = oben(x + stiel) - gurt;
    teile.push({ rolle: 'BT4', stiel: true, x, y: gurt, dx: stiel, dy: yb - gurt, laenge: yb - gurt, breite: stiel,
      ecken: [[x, gurt], [x + stiel, gurt], [x + stiel, yb], [x, ya]] });
  }
  teile.push({ rolle: 'BT4', x: 0, y: h0 - gurt, dx: L, dy: h1 - h0 + gurt, laenge: Math.round(Math.hypot(L, h1 - h0)), breite: gurt,
    ecken: [[0, h0 - gurt], [L, h1 - gurt], [L, h1], [0, h0]] });
  const hz = 15, plattenB = 1240, plattenL = 2480, y0 = 5;
  const liste = [];
  for (let x = 0; x < L; x += plattenB) {
    const xe = Math.min(x + plattenB, L);
    if (oben(x) <= y0 + plattenL) { liste.push({ umriss: [[x, y0], [xe, y0], [xe, oben(xe)], [x, oben(x)], [x, y0]] }); continue; }
    liste.push({ umriss: [[x, y0], [xe, y0], [xe, y0 + plattenL], [x, y0 + plattenL], [x, y0]] });
    liste.push({ umriss: [[x, y0 + plattenL], [xe, y0 + plattenL], [xe, oben(xe)], [x, oben(x)], [x, y0 + plattenL]] });
  }
  WAENDE.push({
    stil: 'SEMA', datei: 'GW01.WUP', L, H: h1, D, D_gesamt: D + hz, teile, ersteNummer: 301,
    kopf: Object.assign({ lfd: '0004', elb: 'INNENWAND', eln: 'GW01', znr: '04' }, SEMA_KOPF),
    lagen: [{ id: 'PLI1', material: 'Gipsfaserplatte 15 mm', idx: 10, hz, z: D, platten: liste, saege: false }],
    zusatz(wand) {
      const ops = wand.lagen[0].ops;
      achsen.forEach((a, i) => {
        const s = [[a, 40], [a, oben(a) - 90]];
        ops.push({ kw: 'NR', a: s[i % 2], e: s[1 - i % 2], abstand: 60, geraet: 11 });
      });
      ops.push({ kw: 'NR', a: [40, 30], e: [L - 40, 30], abstand: 60, geraet: 11 });
      ops.push({ kw: 'NR', a: [L - 80, oben(L - 80) - 30], e: [80, oben(80) - 30], abstand: 60, geraet: 11 });
      const pkt = (x, y) => [x, y, hz, 211];
      ops.push({ kw: 'PSG', txt: 'linie', punkte: [pkt(0, y0), pkt(L, y0)] });
      ops.push({ kw: 'PSG', txt: 'linie', punkte: [pkt(0, h0), pkt(0, y0)] });
      ops.push({ kw: 'PSG', txt: 'linie', punkte: [pkt(L, h1), pkt(0, h0)] });
      ops.push({ kw: 'PSG', txt: 'linie', punkte: [pkt(L, y0), pkt(L, h1)] });
    }
  });
})();

/* --- Granit/syn0001: nur Riegelwerk, mit Strebe ------------------------- */
WAENDE.push({
  stil: 'Granit', datei: 'syn0001.wup', L: 3180, H: 2460, D: 100, D_gesamt: 100, gurt: 60, stiel: 60, raster: 780,
  richtungX: 150, richtungT: -3,
  kopf: { projekt: 'MUSTER_Halle_B', auftrag: 'MUSTER-0002', elb: 'INNENWAND', eln: 'syn0001', znr: 'W01' },
  zusatz(wand) {
    /* Windrispen-Strebe als Viereck (BT4) zwischen den ersten beiden Stielen */
    wand.hoelzer.push({ rolle: 'BT4', nr: 190, bearb: [], laenge: 2440, breite: 60,
      ecken: [[60, 60], [130, 60], [750, 2400], [680, 2400]] });
  }
});

/* --- Granit/syn0002: Innenwand, beidseitig beplankt, mit Tuer ----------- */
WAENDE.push({
  stil: 'Granit', datei: 'syn0002.wup', L: 4460, H: 2720, D: 120, D_gesamt: 150, gurt: 60, stiel: 60, raster: 610,
  richtungX: 150, richtungT: -3, ersteNummer: 201,
  oeffnungen: [{ x0: 1530, x1: 2540, y0: 0, y1: 2090 }],
  kopf: { projekt: 'MUSTER_Halle_B', auftrag: 'MUSTER-0002', elb: 'INNENWAND', eln: 'syn0002', znr: 'W02' },
  lagen: [
    { id: 'PLI1', material: 'Gipsfaser_15-Beplankung', ersteNummer: 410, idx: 10, hz: 15, z: 120, flaeche: [0, 0, 4460, 2720],
      plattenB: 1220, plattenL: 2720, geraet: 11, abstand: 65, umriss: 'zug', freistich: 70, freistichArt: 'winkel' },
    { id: 'PLA1', material: 'Gipsfaser_15-Beplankung', ersteNummer: 430, idx: 10, hz: 15, z: -15, flaeche: [0, 0, 4460, 2720],
      plattenB: 1220, plattenL: 2720, geraet: 11, abstand: 65, umriss: 'zug', freistich: 70, freistichArt: 'winkel' }
  ]
});

/* --- Granit/syn0003: Aussenwand mit Fenster, alle Lagenarten ------------ */
WAENDE.push({
  stil: 'Granit', datei: 'syn0003.wup', L: 5140, H: 2880, D: 160, D_gesamt: 271, gurt: 60, stiel: 80, raster: 620, riegel: 100,
  richtungX: 180, richtungT: -3, ersteNummer: 301,
  oeffnungen: [{ x0: 1890, x1: 3110, y0: 860, y1: 2240 }],
  kopf: { projekt: 'MUSTER_Halle_B', auftrag: 'MUSTER-0002', elb: 'AUSSENWAND', eln: 'syn0003', znr: 'W03' },
  lagen: [
    { id: 'PLI1', material: 'OSB3_18-Beplankung', ersteNummer: 510, idx: 30, hz: 18, z: 160, flaeche: [0, 0, 5140, 2880],
      plattenB: 1270, plattenL: 2560, geraet: 10, abstand: 70, umriss: 'zug', freistich: 70, freistichArt: 'winkel' },
    { id: 'PLI2', material: 'Gipsfaser_13-Beplankung', ersteNummer: 530, idx: 12, hz: 13, z: 178, flaeche: [0, 0, 5100, 2880],
      plattenB: 1540, plattenL: 2880, geraet: 11, abstand: 85, nrRand: 40, umriss: 'zug' },
    { id: 'PLA0', art: 'gefach', material: 'Holzfaser_160-Gefachdämmung', ersteNummer: 550, idx: 240, hz: 160, z: 0 },
    { id: 'PLA1', material: 'Holzfaser_60-Beplankung', ersteNummer: 570, idx: 20, hz: 60, z: -60, flaeche: [-40, 0, 5140, 2880],
      plattenB: 1850, plattenL: 1440, geraet: 20, abstand: 120, nrRand: 50, umriss: 'zug' },
    { id: 'PLA2', material: 'Putzträger_20-Beplankung', ersteNummer: 590, idx: 52, hz: 20, z: -80, flaeche: [-40, 0, 5140, 2880],
      plattenB: 2590, plattenL: 2880, saege: false }
  ],
  zusatz(wand) {
    /* Bearbeitungen am Holz: Bohrungen, Ausfraesungen und Trennschnitte */
    const stiele = wand.hoelzer.filter(h => h.rolle === 'stiel' && h.dy > 2000);
    stiele[1].bearb.push({ kw: 'BOY', p: [420, 80, 14, 60] }, { kw: 'BOY', p: [2310, 80, 14, 60] });
    stiele[2].bearb.push({ kw: 'FRZ', p: [1150, 90, 12, 160] }, { kw: 'FRZ', p: [1760, 90, 12, 160] });
    const sturz = wand.hoelzer.find(h => h.rolle === 'riegel');
    sturz.bearb.push({ kw: 'SG', p: [0, 0, 0, 90, 90, 160, 4, 3] }, { kw: 'SG', p: [sturz.dx, 0, 0, 90, 90, 160, 4, 3] });
    /* Installationsbohrung in der inneren Gipsfaserlage, dicht an einem Stiel */
    wand.lagen[1].ops.push({ kw: 'PAF', bemerkung: 'Installation', kreis: [4375, 370, 36, 13, 211] });
  }
});

/* --- Granit/syn0004: lange Wand, Sparrenausschnitte als EINE Saegekontur - */
(function () {
  const L = 11480, H = 2520, tiefe = 130, breite = 90;
  const pkt = (x, y) => [x, y, 22, 211];
  const kontur = [pkt(0, 0), pkt(L, 0), pkt(L, H)];
  for (let i = 17; i >= 0; i--) {            /* 18 Ausschnitte, von rechts nach links */
    const x = 350 + i * 630;
    kontur.push(pkt(x + breite, H), [x + breite, H - tiefe, 22, 221], [x, H - tiefe, 22, 221], pkt(x, H));
  }
  kontur.push(pkt(0, H), pkt(0, 0));          /* 3 + 18*4 + 2 = 77 Punkte */
  WAENDE.push({
    stil: 'Granit', datei: 'syn0004.wup', L, H, D: 200, D_gesamt: 222, gurt: 80, stiel: 60, raster: 630,
    richtungX: 200, richtungT: -3, ersteNummer: 601,
    kopf: { projekt: 'MUSTER_Halle_B', auftrag: 'MUSTER-0002', elb: 'AUSSENWAND', eln: 'syn0004', znr: 'W04' },
    lagen: [{ id: 'PLA1', material: 'Holzfaser_22-Beplankung', ersteNummer: 710, idx: 20, hz: 22, z: -22, flaeche: [0, 0, L, H],
      plattenB: 2500, plattenL: 2520, geraet: 20, abstand: 100, nrRand: 45, saege: false }],
    zusatz(wand) { wand.lagen[0].ops.push({ kw: 'PSG', bemerkung: 'Sparrenausschnitte', punkte: kontur }); }
  });
})();

/* --- Granit/syn_mit_fehlern: ABSICHTLICH fehlerhaft ----------------------
   P-19: Innenbeplankung mit Materialindex 0
   P-22: Geraeteindex 25 in einer Aussenlage (PLA)
   P-03: Klammerreihen laufen ueber die Fensteroeffnung, Sperrflaechen fehlen */
WAENDE.push({
  stil: 'Granit', datei: 'syn_mit_fehlern.wup', L: 3840, H: 2680, D: 140, D_gesamt: 198, gurt: 60, stiel: 60, raster: 640, riegel: 80,
  richtungX: 160, richtungT: -3, ersteNummer: 801, ohneSperrflaechen: true,
  oeffnungen: [{ x0: 1370, x1: 2450, y0: 940, y1: 2060 }],
  kopf: { projekt: 'MUSTER_Halle_B', auftrag: 'MUSTER-0002', elb: 'AUSSENWAND', eln: 'syn0009', znr: 'W09' },
  lagen: [
    { id: 'PLI1', material: 'OSB3_18-Beplankung', ersteNummer: 910, idx: 0, hz: 18, z: 140, flaeche: [0, 0, 3840, 2680],
      plattenB: 1200, plattenL: 2680, geraet: 10, abstand: 70, umriss: 'zug', nrDurchOeffnung: true },
    { id: 'PLA1', material: 'Holzfaser_40-Beplankung', ersteNummer: 930, idx: 20, hz: 40, z: -40, flaeche: [0, 0, 3840, 2680],
      plattenB: 1900, plattenL: 1340, geraet: 25, abstand: 110, nrRand: 45, umriss: 'zug' }
  ],
  zusatz(wand) {
    /* zwei Klammerreihen im Stielraster, die das Fenster nicht aussparen */
    wand.lagen[0].ops.unshift({ kw: 'NR', a: [1920, 40], e: [1920, 2640], abstand: 70, geraet: 10 },
      { kw: 'NR', a: [2240, 2640], e: [2240, 40], abstand: 70, geraet: 10 });
  }
});

/* =====================================================================
   AUSGABE
   ===================================================================== */
function dateiInhalt(w) {
  const wand = wandBauen(w);
  const zeilen = w.stil === 'SEMA' ? semaSchreiben(wand) : granitSchreiben(wand);
  const text = zeilen.join('\r\n') + '\r\n';
  for (let i = 0; i < text.length; i++)
    if (text.charCodeAt(i) > 255) throw new Error(w.datei + ': Zeichen ausserhalb von Latin-1');
  return Buffer.from(text, 'latin1');
}

function main() {
  const pruefen = process.argv.includes('--pruefen');
  let abweichungen = 0;
  for (const w of WAENDE) {
    const ziel = path.join(__dirname, w.stil, w.datei);
    const inhalt = dateiInhalt(w);
    if (pruefen) {
      const gleich = fs.existsSync(ziel) && fs.readFileSync(ziel).equals(inhalt);
      if (!gleich) { abweichungen++; console.error('ABWEICHUNG  ' + w.stil + '/' + w.datei); }
    } else {
      fs.mkdirSync(path.dirname(ziel), { recursive: true });
      fs.writeFileSync(ziel, inhalt);
      console.log('geschrieben  ' + w.stil + '/' + w.datei + '  (' + inhalt.length + ' Bytes)');
    }
  }
  if (pruefen) {
    /* auch melden, wenn im Ordner eine Datei liegt, die der Generator nicht kennt */
    for (const stil of ['SEMA', 'Granit']) {
      const ordner = path.join(__dirname, stil);
      if (!fs.existsSync(ordner)) continue;
      for (const f of fs.readdirSync(ordner))
        if (!WAENDE.some(w => w.stil === stil && w.datei === f)) { abweichungen++; console.error('UNBEKANNT   ' + stil + '/' + f); }
    }
    console.log(abweichungen ? abweichungen + ' Abweichung(en) — "node erzeugen.js" ausfuehren und Ergebnis pruefen'
      : 'gleich: ' + WAENDE.length + ' Dateien entsprechen dem Generator');
    process.exit(abweichungen ? 1 : 0);
  }
}

if (require.main === module) main();
module.exports = { WAENDE, dateiInhalt };
