/* =====================================================================
   NEU-KONTUR: TASTENFOLGE N → ART + VORGABEN MERKEN (v2.54,
   Anwenderwunsch: "sehr schnell Sperrflaechen erzeugen mit der Tastenfolge
   N und dann S … auch wenn ich den Editor schliesse und aus der Uebersicht
   eine neue Wand lade, sollen sich Schicht, Zeichenmodus und
   Bearbeitungsvariante von davor merken")
   - N schaltet wie bisher auf 'neue-kontur' und oeffnet ein kurzes Fenster
     fuer eine FOLGETASTE (NEU_FOLGE_TASTEN). M bedeutet nur INNERHALB der
     Folge "Markierlinie" — allein bleibt M "Messen".
   - Gemerkt wird JE ART (Form + Ziel-Schichten als Lage-Ids) und die zuletzt
     genutzte Art, in localStorage ('neuKonturVorgaben') — ueberlebt also
     Schliessen und Neuladen. Beim Laden einer anderen Wand greifen nur die
     Schichten, die es dort (mit Platten) gibt; fehlen alle, gilt wie bisher
     obersteSichtbareLageMitPlatten().
   ===================================================================== */
const NEU_FOLGE_TASTEN = { s: 'PSF', f: 'PAF', g: 'PSG', z: 'PSZ', m: 'PML', n: 'NR' };
const NEU_ART_TEXT = { NR: 'Nagelreihe', PAF: 'Fräskontur', PSG: 'Sägekontur', PSF: 'Sperrfläche', PSZ: 'Sperrzone', PML: 'Markierlinie' };
const NEU_FORM_TEXT = { polygon: 'Polygon', rechteck: 'Rechteck', mp: 'Kreis' };
const NEU_FOLGE_FENSTER_MS = 1500;
let neuFolgeBis = 0;

function neuVorgabenLesen() {
  const v = speicherLaden('neuKonturVorgaben', null);
  const jeArt = v && v.jeArt && typeof v.jeArt === 'object' ? v.jeArt : {};
  return { art: v && NEU_ART_TEXT[v.art] ? v.art : null, jeArt };
}
/* Stand der Bedienelemente fuer die aktuelle Art merken. */
function neuVorgabenSichern() {
  const typEl = document.getElementById('neueKonturTyp');
  const formEl = document.getElementById('neueKonturForm');
  if (!typEl || !NEU_ART_TEXT[typEl.value]) return;
  const v = neuVorgabenLesen();
  const art = typEl.value;
  const alt = v.jeArt[art] || {};
  v.jeArt[art] = {
    form: art === 'NR' ? null : (formEl ? formEl.value : alt.form || null),
    lagen: Array.isArray(ui.neuKonturLagen) && ui.neuKonturLagen.length ? ui.neuKonturLagen.slice() : (alt.lagen || [])
  };
  v.art = art;
  speicherSichern('neuKonturVorgaben', v);
}
/* Gemerkte Schichten fuer eine Art, auf das AKTUELLE Modell eingeschraenkt
   (nur Lagen mit Platten) — null, wenn keine davon existiert. */
function neuVorgabenLagenFuer(art) {
  if (!modell) return null;
  const e = neuVorgabenLesen().jeArt[art];
  if (!e || !Array.isArray(e.lagen)) return null;
  const vorhanden = e.lagen.filter(id => modell.layers.some(l => l.id === id && l.plates.length));
  return vorhanden.length ? vorhanden : null;
}
/* Art + gemerkte Form + gemerkte Schichten in die Bedienelemente setzen. */
function neuVorgabenAnwenden(art) {
  const typEl = document.getElementById('neueKonturTyp');
  const formEl = document.getElementById('neueKonturForm');
  if (!typEl || !NEU_ART_TEXT[art]) return;
  typEl.value = art;
  neueKonturFormOptionenAktualisieren();
  const e = neuVorgabenLesen().jeArt[art];
  if (e && e.form && formEl && Array.from(formEl.options).some(o => o.value === e.form)) formEl.value = e.form;
  const lagen = neuVorgabenLagenFuer(art);
  if (lagen) ui.neuKonturLagen = lagen;
  neuKonturLagenButtonAktualisieren();
}
/* Beim Start des Editors: zuletzt genutzte Art in die Auswahl. */
function neuVorgabenBeimStart() {
  const v = neuVorgabenLesen();
  if (v.art) neuVorgabenAnwenden(v.art);
}
/* Nach dem Laden einer Wand (Datei oder Uebersicht): Schichten der
   aktuellen Art wiederherstellen — Ersatz fuer das fruehere
   "ui.neuKonturLagen = null" in beiden Ladewegen. */
function neuVorgabenNachLaden() {
  const typEl = document.getElementById('neueKonturTyp');
  ui.neuKonturLagen = typEl ? neuVorgabenLagenFuer(typEl.value) : null;
}
function neuVorgabenBeschreibung() {
  const typEl = document.getElementById('neueKonturTyp');
  const formEl = document.getElementById('neueKonturForm');
  const art = typEl.value;
  const lagen = modell ? zielLagenFuerNeu().map(l => l.id) : [];
  return NEU_ART_TEXT[art] + ' (' + art + ')' + (art !== 'NR' && formEl ? ' · ' + (NEU_FORM_TEXT[formEl.value] || formEl.value) : '')
    + ' · Schicht' + (lagen.length === 1 ? ' ' : 'en ') + (lagen.join(', ') || '—');
}
/* Taste N (allein): Werkzeug an + Folgefenster oeffnen. */
function neuKonturTasteN() {
  werkzeugSetzen('neue-kontur');
  neuFolgeBis = Date.now() + NEU_FOLGE_FENSTER_MS;
  hinweisAnzeigen('Neue Kontur: ' + neuVorgabenBeschreibung() + ' — Art per Folgetaste: S Sperrfläche · F Fräsen · '
    + 'G Säge · Z Sperrzone · M Markierung · N Nagelreihe', 'info');
}
/* Liefert true, wenn ev als Folgetaste verbraucht wurde. */
function neuFolgeTasteVerarbeiten(ev) {
  if (!neuFolgeBis) return false;
  const imFenster = Date.now() <= neuFolgeBis;
  neuFolgeBis = 0;
  if (!imFenster || ev.ctrlKey || ev.metaKey || ev.altKey || !modell) return false;
  const art = NEU_FOLGE_TASTEN[ev.key.toLowerCase()];
  if (!art) return false;
  ev.preventDefault();
  neuKonturMitArtStarten(art);
  return true;
}
/* Werkzeug 'neue-kontur' mit Art + deren gemerkten Vorgaben (auch fuer
   Palette/Kontextmenue). */
function neuKonturMitArtStarten(art) {
  if (!modell) return;
  if (ui.werkzeug !== 'neue-kontur') werkzeugSetzen('neue-kontur');
  ui.neueKontur = null; ui._neueKonturMaus = null; ui.neueNrStart = null;
  neuVorgabenAnwenden(art);
  neuVorgabenSichern();
  svgRendern();
  hinweisAnzeigen('Neu: ' + neuVorgabenBeschreibung() + ' — zuletzt genutzte Einstellungen', 'erfolg');
}
