/* =====================================================================
   §4 DATEIEN LADEN
   ===================================================================== */
async function handleFiles(fileList) {
  const alle = Array.from(fileList || []);
  const wup = alle.filter(f => /\.wup$/i.test(f.name));
  if (!wup.length) { hinweisAnzeigen('Keine .wup-Dateien in der Auswahl.', 'warnung'); return; }
  try { await kernSicherstellen(); }
  catch (fehler) { hinweisAnzeigen('Kern konnte nicht geladen werden: ' + fehler.message, 'fehler'); return; }

  fortschrittZeigen('Lade Dateien', 0, wup.length);
  for (let i = 0; i < wup.length; i++) {
    const file = wup[i];
    fortschrittZeigen('Lade Dateien', i + 1, wup.length, file.name);
    try {
      const buffer = await file.arrayBuffer();
      const dek = kern.dateiDekodieren(buffer);
      dateien.push({
        name: file.name, text: dek.text, encoding: dek.encoding, hatteBom: dek.hatteBom,
        waende: [], fehlerAnzahl: 0, geaendert: false,
        /* v0.13: Dateidatum fuer Sortierung/Liste. Browser liefern nur das
           AENDERUNGSdatum der Datei (lastModified), kein Erstellungsdatum. */
        datum: file.lastModified || 0, ladeNr: dateien.length
      });
      /* WP-E: der teure synchrone Teil (Parsen + Pruefen + Wand-Clusterung)
         kommt JETZT — Status aktualisieren und dem Browser einen Frame Zeit
         geben, damit der Balken das auch anzeigt. */
      fortschrittZeigen('Lade Dateien', i + 1, wup.length, file.name + ' — Waende lesen …');
      await warteKurz();
      dateiAktualisieren(dateien.length - 1);
    } catch (fehler) {
      hinweisAnzeigen('Fehler bei ' + file.name + ': ' + fehler.message, 'fehler');
    }
  }
  fortschrittVerbergen();
  ansichtAktualisieren();
  gravierendeBefundePopupOversight();   /* WP-H: P-19..P-24 sammeln + melden */
}

/* WP-H (Anwenderwunsch): Sammel-Popup fuer GRAVIERENDE Befunde nach dem
   Laden — P-19 Platten ohne Materialindex, P-20 unbekannter NR-Index,
   P-21 geneigte PAF/PSG-Punkte. Die Befunde stammen aus
   kern.pruefungenAusfuehren() je Datei (siehe dateiAktualisieren); der
   Neigungs-Sammel-Fix laeuft ueber kern.neigungenNullen() je Datei. */
function gravierendeBefundePopupOversight() {
  const zeilen = [];
  for (const d of dateien) {
    const P = (d._vorschau && d._vorschau.pruefungen) || [];
    const anz = code => P.filter(p => p.code === code).length;
    const p19 = anz('P-19'), p20 = anz('P-20'), p21 = anz('P-21'), p22 = anz('P-22'), p23 = anz('P-23'), p24 = anz('P-24');
    if (p19 || p20 || p21 || p22 || p23 || p24) zeilen.push({ name: d.name, p19, p20, p21, p22, p23, p24 });
  }
  if (!zeilen.length) return false;
  document.querySelectorAll('.modal-hintergrund.grav-popup').forEach(m => m.remove());
  const mitNeigung = zeilen.filter(z => z.p21).length;
  const mitNr25 = zeilen.filter(z => z.p22).length;
  const mitBoz = zeilen.filter(z => z.p24).length;   /* v0.18 P-24 BOZ abgekuendigt */
  const hg = document.createElement('div');
  hg.className = 'modal-hintergrund grav-popup';
  hg.style.display = 'flex';
  /* Erklaerungs-Legende (Anwenderwunsch): KURZE Zeile je vorhandener
     Pruefung, die genaue Erklaerung klappt erst ueber den ?-Knopf aus. */
  const hilfe = (kurz, lang) => '<span><b>' + kurz + '</b> '
    + '<button type="button" class="grav-hilfe" data-hilfe title="Genaue Erklaerung ein-/ausblenden">?</button>'
    + '<span class="grav-hilfe-text versteckt">' + lang + '</span></span>';
  const legende = [];
  if (zeilen.some(z => z.p19)) legende.push(hilfe('P-19 — Platte ohne Materialindex (i=0)',
    'Ohne Index kann die Maschine der Platte kein Material und keine Bearbeitungsparameter zuordnen. Korrektur im '
    + 'Editor-Popup oder per „Werte ersetzen" (Feld Platten-Materialindex, Suchwert 0 — Vorschlaege nach '
    + 'Weinmann 4.3 werden angezeigt).'));
  if (zeilen.some(z => z.p20)) legende.push(hilfe('P-20 — NR-Geraeteindex unbekannt',
    'Der Index ist keines der bekannten Geraete (10/11/20/25/32) — die Maschine kann das Befestigungsgeraet nicht '
    + 'zuordnen. Korrektur per „Werte ersetzen" (Feld NR-Geraeteindex, die Ersatz-Chips zeigen die gueltigen Geraete).'));
  if (mitNeigung) legende.push(hilfe('P-21 — PAF/PSG mit Neigung ≠ 0°',
    'Die Anlage saegt/fraest nur senkrecht zur Platte, geneigte Punkte kann sie nicht ausfuehren. Der Knopf unten '
    + 'setzt alle Neigungswinkel auf 0° (Konturverlauf bleibt unveraendert).'));
  if (mitNr25) legende.push(hilfe('P-22 — NR-Index 25 in der Aussenlage (PLA)',
    'Fuer die Aussenlage liest die Maschine Index 20 aus dem Datensatz und stellt SELBST auf Geraet 25 um — in den '
    + 'Datensatz gehoert 20. Steht dort schon 25, greift die Umstellung nicht wie vorgesehen. Der Knopf unten setzt '
    + '25 → 20 nur in PLA-Lagen (PLI bleibt unberuehrt).'));
  if (zeilen.some(z => z.p23)) legende.push(hilfe('P-23 — Kontur ohne Punkte (weniger als 2)',
    'Eine PSG/PAF/PSF/PSZ/PML braucht mindestens zwei Punkte (Kreis MP / Rechteck TA zaehlen als vollstaendig). Mit '
    + 'weniger meldet WupWorks5 „must at least contain two points" und LAESST DIE BEARBEITUNG WEG — z. B. fehlt ein '
    + 'Saegeschnitt. Die Punkte lassen sich nicht erraten, darum kein Sammel-Knopf: von der Originaldatei neu ausgehen '
    + '(Fundstellen im Editor-Fehler-Log). Bekannte Ursache bis Editor v2.55: Auto-Kontur bei „TXT PP, …" in einer PSG.'));
  if (mitBoz) legende.push(hilfe('P-24 — BOZ in einer Plattenlage (abgekündigt)',
    'Weinmann führt BOZ als Plattenbearbeitung seit WUP 3.4 als „nicht mehr unterstützt" (Ersatz PAF + MP). Der Knopf '
    + 'unten schreibt jede BOZ x, y, d, t einer Plattenlage als „PAF 2" + „MP x, y, d/2, |t|, 211" — immer Bezugsebene 2, '
    + 'Lage und Durchmesser bleiben. BOZ am Riegelwerk (Richtungsbohrung) bleiben unberührt.'));
  hg.innerHTML = '<div class="modal-fenster">'
    + '<h2>⚠ Gravierende Befunde in ' + zeilen.length + ' Datei(en)</h2>'
    + '<div class="mini-hinweis">Diese Punkte verhindern eine saubere Fertigung und sollten VOR dem Export behoben '
    + 'werden — Details je Datei im Editor (Fehler-Log).</div>'
    + '<div class="mini-hinweis" style="margin-top:6px;display:grid;gap:4px">' + legende.map(t => '<span>' + t + '</span>').join('') + '</div>'
    + '<div style="max-height:40vh;overflow:auto;margin-top:10px"><table class="modal-tabelle">'
    + '<tr><th>Datei</th><th>P-19</th><th>P-20</th><th>P-21</th><th>P-22</th><th>P-23</th><th>P-24</th></tr>'
    + zeilen.map(z => '<tr><td>' + escapeHtml(z.name) + '</td><td>' + (z.p19 || '—') + '</td><td>'
      + (z.p20 || '—') + '</td><td>' + (z.p21 || '—') + '</td><td>' + (z.p22 || '—') + '</td><td>'
      + (z.p23 ? '<b style="color:var(--fehler)">' + z.p23 + '</b>' : '—') + '</td><td>' + (z.p24 || '—') + '</td></tr>').join('')
    + '</table></div>'
    + (mitNeigung ? '<div style="margin-top:10px"><button class="schaltflaeche schaltflaeche-haupt schaltflaeche-klein" id="gravNeigungFix">'
      + 'Neigungen in ' + mitNeigung + ' Datei(en) auf 0° setzen</button>'
      + '<span class="mini-hinweis" id="gravNeigungErgebnis" style="margin-left:8px"></span></div>' : '')
    + (mitNr25 ? '<div style="margin-top:6px"><button class="schaltflaeche schaltflaeche-haupt schaltflaeche-klein" id="gravNr25Fix">'
      + 'NR-Index 25 → 20 (PLA) in ' + mitNr25 + ' Datei(en) setzen</button>'
      + '<span class="mini-hinweis" id="gravNr25Ergebnis" style="margin-left:8px"></span></div>' : '')
    + (mitBoz ? '<div style="margin-top:6px"><button class="schaltflaeche schaltflaeche-haupt schaltflaeche-klein" id="gravBozFix">'
      + 'BOZ → PAF/MP in ' + mitBoz + ' Datei(en) umstellen</button>'
      + '<span class="mini-hinweis" id="gravBozErgebnis" style="margin-left:8px"></span></div>' : '')
    + '<div class="modal-fuss"><button class="schaltflaeche schaltflaeche-neben" id="gravSchliessen">Schliessen</button></div>'
    + '</div>';
  document.body.appendChild(hg);
  document.getElementById('gravSchliessen').addEventListener('click', () => hg.remove());
  hg.addEventListener('click', ev => {
    if (ev.target === hg) { hg.remove(); return; }
    const h = ev.target.closest('[data-hilfe]');
    if (h && h.nextElementSibling) h.nextElementSibling.classList.toggle('versteckt');
  });
  const fixBtn = document.getElementById('gravNeigungFix');
  if (fixBtn) fixBtn.addEventListener('click', async () => {
    fixBtn.disabled = true;
    try { await kernSicherstellen(); } catch (fehler) { hinweisAnzeigen('Kern nicht verfuegbar.', 'fehler'); return; }
    let punkte = 0, geaendert = 0;
    const vorher = aenderungStandMerken();   /* v0.13: ein Rueckgaengig-Schritt */
    for (let i = 0; i < dateien.length; i++) {
      const d = dateien[i];
      const P = (d._vorschau && d._vorschau.pruefungen) || [];
      if (!P.some(p => p.code === 'P-21')) continue;
      kernModellSetzen(d.text, d.name, d.encoding, d.hatteBom);
      const n = kern.neigungenNullen();
      if (n > 0) {
        punkte += n; geaendert++;
        d.text = kernExportText();
        d.geaendert = true;
        dateiAktualisieren(i);
      }
      await warteKurz();
    }
    aenderungAufzeichnen('Befunde: Neigungen auf 0°', vorher);
    ansichtAktualisieren();
    const erg = document.getElementById('gravNeigungErgebnis');
    if (erg) erg.textContent = '✓ ' + punkte + ' Punkt(e) in ' + geaendert + ' Datei(en) auf 0° gesetzt';
    hinweisAnzeigen(punkte + ' Neigungswinkel in ' + geaendert + ' Datei(en) auf 0° gesetzt.', 'erfolg');
  });
  const nr25Btn = document.getElementById('gravNr25Fix');
  if (nr25Btn) nr25Btn.addEventListener('click', async () => {
    nr25Btn.disabled = true;
    try { await kernSicherstellen(); } catch (fehler) { hinweisAnzeigen('Kern nicht verfuegbar.', 'fehler'); return; }
    let reihen = 0, geaendert = 0;
    const vorher = aenderungStandMerken();   /* v0.13: ein Rueckgaengig-Schritt */
    for (let i = 0; i < dateien.length; i++) {
      const d = dateien[i];
      const P = (d._vorschau && d._vorschau.pruefungen) || [];
      if (!P.some(p => p.code === 'P-22')) continue;
      kernModellSetzen(d.text, d.name, d.encoding, d.hatteBom);
      const n = kern.nrIndex25PlaKorrigieren();
      if (n > 0) {
        reihen += n; geaendert++;
        d.text = kernExportText();
        d.geaendert = true;
        dateiAktualisieren(i);
      }
      await warteKurz();
    }
    aenderungAufzeichnen('Befunde: NR-Index 25 → 20 (PLA)', vorher);
    ansichtAktualisieren();
    const erg = document.getElementById('gravNr25Ergebnis');
    if (erg) erg.textContent = '✓ ' + reihen + ' Nagelreihe(n) in ' + geaendert + ' Datei(en) auf 20 gesetzt';
    hinweisAnzeigen(reihen + ' NR-Index-25-Reihen (PLA) in ' + geaendert + ' Datei(en) auf 20 gesetzt.', 'erfolg');
  });
  const bozBtn = document.getElementById('gravBozFix');
  if (bozBtn) bozBtn.addEventListener('click', async () => {
    bozBtn.disabled = true;
    try { await kernSicherstellen(); } catch (fehler) { hinweisAnzeigen('Kern nicht verfuegbar.', 'fehler'); return; }
    if (typeof kern.bozAlleErsetzen !== 'function') { hinweisAnzeigen('Der geladene Editor ist zu alt (BOZ-Umstellung ab v2.60).', 'fehler'); return; }
    let ersetzt = 0, geaendert = 0;
    const offen = [];
    const vorher = aenderungStandMerken();   /* ein Rueckgaengig-Schritt */
    for (let i = 0; i < dateien.length; i++) {
      const d = dateien[i];
      const P = (d._vorschau && d._vorschau.pruefungen) || [];
      if (!P.some(p => p.code === 'P-24')) continue;
      kernModellSetzen(d.text, d.name, d.encoding, d.hatteBom);
      const r = kern.bozAlleErsetzen();
      for (const u of r.uebersprungen) offen.push(d.name + ': ' + u);
      if (r.ersetzt > 0) {
        ersetzt += r.ersetzt; geaendert++;
        d.text = kernExportText();
        d.geaendert = true;
        dateiAktualisieren(i);
      }
      await warteKurz();
    }
    aenderungAufzeichnen('Befunde: BOZ → PAF/MP', vorher);
    ansichtAktualisieren();
    const erg = document.getElementById('gravBozErgebnis');
    if (erg) erg.textContent = '✓ ' + ersetzt + ' BOZ in ' + geaendert + ' Datei(en) umgestellt'
      + (offen.length ? ' · ' + offen.length + ' nicht: ' + offen.join(' | ') : '');
    hinweisAnzeigen(ersetzt + ' BOZ in ' + geaendert + ' Datei(en) auf PAF 2 + MP umgestellt.'
      + (offen.length ? ' ' + offen.length + ' nicht umgestellt (siehe Popup).' : ''), offen.length ? 'warnung' : 'erfolg');
  });
  return true;
}

/* Parst/prueft Datei i neu (nach Laden, Automatik, Werte-ersetzen oder
   Rueckmeldung aus dem Editor) und ermittelt die Wand-Karten. */
function dateiAktualisieren(i) {
  const d = dateien[i];
  const m = kernModellSetzen(d.text, d.name, d.encoding, d.hatteBom);
  kern.pruefungenAusfuehren();
  const frei = strukturKlonen(m);
  d.fehlerAnzahl = (frei.pruefungen || []).filter(p => p.level === 'fehler').length;
  d.bearbeitungenAnzahl = frei.layers.reduce((s, l) => s + l.ops.length, 0);
  const bereiche = waendeErmitteln(frei);
  d.waende = bereiche.map((w, idx) => ({
    dateiIndex: i, wandIndex: idx, name: w.name, xMin: w.xMin, xMax: w.xMax, quelle: w.quelle
  }));
  d._vorschau = frei; /* nicht in localStorage-relevanten Export einbezogen, nur RAM */
  lagenSammeln(frei);
  /* AP-WE4: vorhandene Platten-Namen fuer den Namensfilter im Werte-Ersetzen-Dialog */
  for (const l of frei.layers) for (const p of l.plates)
    if (p.name && p.name.trim()) bekanntePlattenNamen.add(p.name.trim());
  sitzungVormerken();   /* v0.14: Sitzung gedrosselt sichern (F5/Schliessen) */
}
const bekanntePlattenNamen = new Set();

function strukturKlonen(m) {
  /* structuredClone loest die Kern-Objekte aus dem iframe-Realm und macht sie
     zu reinen, unabhaengigen Daten (kein Funktions-/DOM-Anteil im Modell). */
  try { return structuredClone(m); }
  catch (fehler) { return JSON.parse(JSON.stringify(m)); }
}

function lagenSammeln(frei) {
  for (const lage of frei.layers) if (!(lage.id in sichtbarkeit.lagen)) sichtbarkeit.lagen[lage.id] = true;
}

