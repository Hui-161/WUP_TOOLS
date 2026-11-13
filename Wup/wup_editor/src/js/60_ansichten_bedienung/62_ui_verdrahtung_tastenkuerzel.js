/* =====================================================================
   §15 UI-VERDRAHTUNG, TASTENKUERZEL, SPLITTER, INIT
   ===================================================================== */

function opFilterChipsRendern() {
  const ziel = document.getElementById('opFilterChips');
  const farben = { NR: '--svg-nr', PAF: '--svg-paf', PSG: '--svg-psg', PSF: '--svg-psf',
    PSZ: '--syn-psz', PML: '--text-gedimmt', BOZ: '--svg-bohrung' };
  /* v2.59 (Anwenderwunsch): Bohrungen am Riegelwerk (BOZ/BOY/BOX, auch die
     Richtungsbohrung) als eigener Chip — nur wenn die Wand welche hat */
  const titel = { BOZ: 'Bohrungen: BOZ in Plattenlagen und am Riegelwerk (BOY/BOX, Richtungsbohrung)' };
  ziel.innerHTML = Object.keys(ui.opFilter).filter(kw => kw !== 'BOZ' || modellHatBohrungen()).map(kw =>
    '<span class="filter-chip' + (ui.opFilter[kw] ? ' an' : '') + '" data-filter="' + kw
    + '" title="' + (titel[kw] || kw) + ' ein-/ausblenden — Alt+Klick = Solo"><span class="chip-punkt" style="background:var('
    + farben[kw] + ')"></span>' + kw + '</span>').join('');
}
/* GUI-H (Anwenderwunsch "zusammenfassen und verkleinern"): die fruehere
   Kontrollkaestchen-Zeile als kompakte Chips im Stil der Bearbeitungs-
   Filter. Ein Eintrag je ui-Flag; 'neu' = Folgearbeit nach dem Umschalten. */
const ANSICHT_SCHALTER = [
  { flag: 'nurOps',            text: '☐ nur Bearb. waehlbar', titel: 'Platten und Bauteile ignorieren — Klicks treffen nur NR/PAF/PSG/PSF usw.', neu: () => {} },
  { flag: 'schnittdetails',    text: 'Details ⊕/⊖',           titel: 'Schnittdetails Ueber-/Unterschnitt anzeigen', neu: () => { if (modell) svgRendern(); } },
  { flag: 'zeigeRiegel',       text: 'Riegelwerk',            titel: 'Riegelwerk anzeigen', neu: () => { if (modell) { snapPunkteAufbauen(); svgRendern(); } } },
  { flag: 'zeigeBauteilBearb', text: 'Bauteil-Bearb.',        titel: 'Bauteilbearbeitungen anzeigen', neu: () => { if (modell) svgRendern(); } },
  { flag: 'zeigeUeberstand',   text: 'Überstand',             titel: 'Bemassung: Plattenueberstand ueber das Riegelwerk je Lage', neu: () => { if (modell) svgRendern(); } }
];
function ansichtChipsRendern() {
  document.getElementById('ansichtChips').innerHTML = ANSICHT_SCHALTER.map(s =>
    '<span class="filter-chip' + (ui[s.flag] ? ' an' : '') + '" data-ansicht-chip="' + s.flag
    + '" title="' + s.titel + '">' + s.text + '</span>').join('');
}
/* GUI-H (Anwenderwunsch): Lagen-Sichtbarkeit DIREKT NEBEN den Bearbeitungs-
   Chips, im gleichen Stil (Farb-Punkt = Lagenfarbe, Alt+Klick = Solo).
   Wird aus lagenListeRendern() mitgezogen — eine Quelle der Wahrheit. */
function lagenChipsRendern() {
  const ziel = document.getElementById('lagenChips');
  if (!modell || !modell.layers.length) { ziel.innerHTML = '<span class="mini-hinweis">—</span>'; return; }
  const sortiert = modell.layers.slice().sort((a, b) =>
    (a.side === b.side ? a.num - b.num : (a.side === 'innen' ? -1 : 1)));
  const chip = l => '<span class="filter-chip' + (l.sichtbar ? ' an' : '') + '" data-lage-chip="' + l.id
    + '" title="' + l.id + ' ein-/ausblenden — Alt+Klick = Solo · Rechtsklick = Menue"><span class="chip-punkt" style="background:'
    + lagenFarbe(l) + '"></span>' + l.id + '</span>';
  const innen = sortiert.filter(l => l.side === 'innen'), aussen = sortiert.filter(l => l.side !== 'innen');
  /* GUI-J/M (Anwender-Skizze + Praezisierung): die Dreiecke stehen IMMER an
     der Innen/Aussen-Grenze (zwischen dem letzten PLI- und dem ersten
     PLA-Chip) und SCHALTEN DIE LAGEN-CHIPS DIREKT: ▶ = alle Aussen-Lagen
     an, alle Innen-Lagen aus (Chips zeigen das sofort). Der Aktiv-Zustand
     ist aus den Lagen ABGELEITET — wird zusaetzlich eine Lage der anderen
     Seite eingeschaltet, loest sich das Dreieck von selbst. Nochmal Klick
     auf ein aktives Dreieck = alle Lagen an. */
  const zustand = seiteAktiv();
  const dreieck = (seite, symbol, titel) =>
    '<span class="seiten-dreieck' + (zustand === seite ? ' an' : '')
    + ((seite === 'innen' ? innen : aussen).length ? '' : ' leer')
    + '" data-seite-dreieck="' + seite + '" title="' + titel + '">' + symbol + '</span>';
  ziel.innerHTML = innen.map(chip).join('')
    + dreieck('innen', '◀', 'Nur die Innen-Seite (PLI): alle Innen-Lagen an, Aussen aus — nochmal Klick: alle an')
    + dreieck('aussen', '▶', 'Nur die Aussen-Seite (PLA): alle Aussen-Lagen an, Innen aus — nochmal Klick: alle an')
    + aussen.map(chip).join('');
}
/* Abgeleiteter Seiten-Zustand aus den Lagen selbst: 'innen'/'aussen' nur,
   wenn die eine Seite komplett an und die andere komplett aus ist. */
function seiteAktiv() {
  if (!modell || !modell.layers.length) return 'beide';
  const innen = modell.layers.filter(l => l.side === 'innen');
  const aussen = modell.layers.filter(l => l.side !== 'innen');
  const alleAn = ls => ls.length > 0 && ls.every(l => l.sichtbar);
  const alleAus = ls => ls.every(l => !l.sichtbar);
  if (alleAn(innen) && aussen.length && alleAus(aussen)) return 'innen';
  if (alleAn(aussen) && innen.length && alleAus(innen)) return 'aussen';
  return 'beide';
}
function seiteSetzen(seite) {
  if (!modell) return;
  for (const l of modell.layers)
    l.sichtbar = seite === 'beide' ? true : ((l.side === 'innen') === (seite === 'innen'));
  lagenNeuZeichnen();
}

