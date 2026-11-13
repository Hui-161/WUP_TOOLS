/* =====================================================================
   LISTEN-BAUSTEIN (v2.7) — die eine Listen-Bauart fuer alle Werkzeuge.

   Vorbild: die Bauteil-Liste in CAMBIUM (Aufnahme "CAmbium Filter Liste.mp4").
   Fachliche Vorgabe mit allen Begruendungen: Listen-Standard.md. Die
   Schnittstelle stammt von der Liste des BVX-Nesting-Planers
   (42_liste_stufenfilter.js): listeEinrichten(def), listeZeichnen(id),
   listeAlsZeilen(id).

   Was die Liste kann (Abschnitt im Standard):
   - Sortieren (2.1): Klick auf den Spaltenkopf, nochmal = umdrehen,
     Umschalt+Klick = weitere Stufe. Leere Werte immer am Ende.
   - Spalten (2.2, 2.6a): Kopf ziehen = verschieben, rechter Rand = Breite,
     Doppelklick dort = optimale Breite, Spaltenauswahl fuer ausgeblendete,
     "links fixieren" (hoechstens 5, bleiben beim Querrollen stehen).
   - Spaltenauswahl als Baum (2.2b, v2.6): Haben Spalten eine gruppe, zeigt
     die Spaltenauswahl ALLE Spalten in einem Baum (Gruppen auf/zu, sichtbar/
     gesamt je Gruppe, Haken je Spalte, ganze Gruppe ein/aus) mit Suchfeld
     ueber Titel, Hilfe und Gruppe. Ohne gruppe bleibt sie die flache Liste
     der ausgeblendeten Spalten.
   - Eigenschafts-Spalten (2.2c, v2.7): Mit def.eigenschaften wird JEDE
     Eigenschaft, die an den Zeilen vorkommt (z. B. alle Attribute einer
     BVX-Datei), eine Spalte — anfangs aus, im Baum der Spaltenauswahl.
     Ein Katalog des Werkzeugs gibt Titel, Gruppe, Art und Erklaerung;
     Unbekanntes steht unter „Weitere …“ mit seinem Namen. Die Art erkennt
     der Baustein selbst (Zahl, ja/nein aus True/False, Text); Zahlen mit
     fuehrender Null („01“) bleiben Text.
   - Gruppieren (2.3): Spaltenkopf in das Feld ueber der Tabelle ziehen,
     beliebig viele Ebenen, Gruppen anfangs eingeklappt.
   - Filtern (2.4, 2.4d): Trichter im Kopf -> (Alle) · Benutzerdefiniert … ·
     vorkommende Werte mit Anzahl. Je Spalte eine Werteliste und/oder
     beliebig viele Bedingungen (14 Vergleiche, UND/ODER); zwischen den
     Spalten gilt UND. Jeder aktive Filter steht als Marke unter der Tabelle;
     Klick darauf oeffnet "Filter bearbeiten".
   - Suchen (2.6b): alle Woerter muessen in der Zeile vorkommen; Fundstellen
     sind markiert.
   - Auswaehlen (2.4a, 2.4b): feste Kaestchen-Spalte vor jeder Zeile, Gruppe
     und Untergruppe; Zeilenklick wie in Office (Klick, Strg+Klick,
     Umschalt+Klick). Gewaehlt sind immer ZEILEN, nie Gruppen: die Auswahl
     ueberlebt Sortieren, Umgruppieren und Filtern. Was ein Filter ausblendet,
     bleibt gewaehlt und wird unter der Tabelle gemeldet.
   - Rechtsklick (2.4c, 2.5): eigene Menues auf Spaltenkopf, Zeile/Zelle,
     Gruppenzeile, Gruppierfeld, Filterzeile, Fusszeile, leerem Bereich.
   - Unterzeilen (2.4e): fester Baum je Zeile (def.unter), beliebig tief,
     als schlanke Textzeilen. Sie zaehlen nicht als Zeilen der Liste.
   - Summen (2.6): je Spalte Summe, Mittelwert, kleinster/groesster Wert oder
     Anzahl — in der Fusszeile und in jeder Gruppenzeile.
   - CSV (2.6c): "Als CSV speichern" im Rechtsklick, genau das Angezeigte.
   - Kreuztabelle (2.11): "Kreuztabelle …" im Rechtsklick — eine Spalte in die
     Zeilen, eine in die Spalten, in den Feldern Anzahl oder Summe/Mittel/
     Min/Max einer Zahlenspalte, mit Gesamtzeile und -spalte. Rechnet ueber
     das Angezeigte; Klick auf ein Feld zeigt genau diese Zeilen in der Liste.
     "Kopieren" (oder Strg+C) legt sie zum Einfuegen in Excel in die Zwischenablage.
   - Tastatur (2.6d), wie in Excel: die Tabelle ist EIN Tab-Halt. Die
     Pfeiltasten bewegen einen Zeiger von Zelle zu Zelle; die Zeile unter dem
     Zeiger ist nur hervorgehoben, NICHT gewaehlt. Leertaste waehlt, Umschalt+
     Pfeil waehlt einen Bereich, Eingabe oeffnet/schliesst Gruppe oder
     Unterzeilen, Strg+Pfeil springt an den Rand, Pos1/Ende an Zeilenanfang
     und -ende, Bild auf/ab, Strg+A, Strg+C, Menue-Taste, Tab zellenweise.
     Pfeil auf in der ersten Zeile fuehrt in die Kopfzeile. Sind Unterzeilen
     aufgeklappt, geht der Zeiger mit Pfeil ab/auf (und Tab) auch durch sie.

   - Werte aendern (2.9) — nur wo das Werkzeug es erlaubt: eine Spalte mit
     setzen() ist aenderbar, def.aendern schaltet es fuer die ganze Liste an
     und aus. Doppelklick, F2 oder Lostippen oeffnet das Eingabefeld in der
     Zelle; Eingabe uebernimmt, Strg+Eingabe uebernimmt fuer ALLE gewaehlten
     Zeilen, Tab uebernimmt und geht weiter, Esc verwirft. Mehrere Werte auf
     einmal: "Werte aendern …" im Rechtsklick (Setzen, Erhoehen, Multiplizieren,
     Text ersetzen, Voranstellen, Anhaengen, Leeren — mit Vorschau), "Wert in
     die gewaehlten Zeilen uebernehmen" (Strg+D), Rueckgaengig (Strg+Z).

   DER BAUSTEIN SCHREIBT NIE SELBST. Sortieren, Filtern, Gruppieren aendern
   nie die Zeilen des Werkzeugs (Spec §7A). Auch beim Aendern ruft er nur
   setzen() des Werkzeugs — nach einer sichtbaren Handlung des Anwenders, nie
   still; was geaendert, gesperrt oder abgelehnt wurde, wird gemeldet.
   listeAlsZeilen(id) und listeCsv(id) liefern, was angezeigt ist.

   Gespeichert (localStorage, nur wenn def.speicher gesetzt ist): Reihenfolge,
   Sichtbarkeit, Breiten, Sortierung, Gruppen, feste Spalten, Summenarten,
   die zuletzt gewaehlte Kreuztabelle.
   BEWUSST: Filter, Suche und Auswahl werden NICHT gespeichert — ein
   vergessener Filter wuerde beim naechsten Laden Zeilen verstecken (wie
   Stangomat STA-L und WUP-Uebersicht).

   Der Baustein kennt keine Fachlogik und braucht nichts ausser dem Browser:
   alle Helfer heissen liste… und stehen in dieser Datei.

   def: {
     id,                  Kennung der Liste (eine je Liste im Werkzeug; auch Dateiname der CSV)
     ziel,                Element oder Element-Id; die Liste baut sich hinein
     spalten,             [{ feld, titel, wert(z), zahl?, stellen?, zelle?(z) -> HTML,
                             hilfe?, breite? (px), aus? (anfangs ausgeblendet),
                             summe? ('summe' | 'mittel' | 'min' | 'max' | 'anzahl'; true = 'summe'),
                             summeWert?(z) -> Zahl (was in die SUMME eingeht, wenn nicht der Zellwert:
                               z. B. Laenge x Stueckzahl in m), summeEinheit? ('m'), summeStellen?,
                               summeHilfe? (Tooltip: 'Länge × Stückzahl'),
                             fest? (anfangs links fixiert),
                             gruppe? (Ort in der Spaltenauswahl als Baum: 'Bauteil › Maße' oder
                               ['Bauteil', 'Maße'] — Ebenen von aussen nach innen; Spalten und
                               Gruppen erscheinen in der Reihenfolge der Spalten),
                             eigenschaft? (Name der Eigenschaft, die diese Spalte schon zeigt:
                               def.eigenschaften legt dafuer keine zweite an, und die Suche der
                               Spaltenauswahl findet die Spalte auch unter diesem Namen),
                             setzen?(z, wert, text) (macht die Spalte AENDERBAR: das Werkzeug
                               schreibt den Wert; wert = Zahl oder null bei zahl-Spalten, sonst
                               Text; text = die Eingabe. Rueckgabe eines Textes = abgelehnt),
                             pruefen?(wert, z) -> Fehlertext oder '', aenderbar?(z) -> bool
                               (einzelne Zeilen sperren), wahlwerte? ([…] oder (z) => […]:
                               Auswahlfeld statt freier Eingabe) }]
                          — oder eine Funktion, die sie liefert
     zeilen() -> [],      die Zeilen des Werkzeugs (werden nie veraendert)
     eigenschaften?: {    Eigenschafts-Spalten (v2.7) — ein Objekt oder eine Liste davon:
       werte(z) -> { name: wert, … } | null   die Eigenschaften einer Zeile (wird nie veraendert)
       katalog?: [{ name, titel?, gruppe?, art? ('zahl' | 'janein' | 'text'), hilfe?,
                    stellen?, breite?, summe?, an? (anfangs sichtbar) }]
                          bekannte Eigenschaften; ihre Reihenfolge ist die im Baum
       quelle?: 'BVX'     steht vor dem Namen in der Erklaerung („BVX: DimensionX“)
       gruppe?            Gruppe fuer Katalog-Eintraege ohne eigene
       weitere?           Gruppe fuer Unbekanntes (sonst gruppe, sonst „Weitere Eigenschaften“)
       hilfe?             Erklaerung fuer alle Eintraege ohne eigene
       praefix?: 'e_'     Anfang der Feldnamen (feld = praefix + name; bleibt fuer die gemerkte Ansicht)
       ohne?: [name, …]   nicht als Spalte (zusaetzlich zu den Spalten mit eigenschaft)
     }
     summe?(sicht, alle) -> Text unter der Tabelle
     gruppenInfo?(zeilen) -> Text hinter der Anzahl einer Gruppenzeile
     zeileAttr?(z) -> ' class="…" data-…="…"'
     leer?() -> HTML, wenn es keine Zeilen gibt
     sortVorgabe?: [{ feld, ab }], gruppenVorgabe?: [feld, …]
     speicher?: 'werkzeug_v1_liste_bauteile'  (Schema-Version im Namen, Spec §7.3)
     suche?: false        blendet das Suchfeld aus
     auswahl?: false      Liste ohne Auswahlspalte
     aendern?: false | () => bool   Aendern fuer die ganze Liste aus bzw. je nach Lage
                          (ohne Angabe: an, sobald eine Spalte setzen() hat)
     nachAenderung?(aenderungen)    einmal nach jedem Schwung: [{ z, feld, alt, neu }]
                          (neu rechnen, speichern …); danach zeichnet die Liste sich neu
     maxZeilen?: 200      so viele Zeilen je Stueck; weitere kommen beim Scrollen dazu
     kennung?(z) -> Text  feste Kennung der Zeile; damit ueberleben Auswahl und
                          aufgeklappte Unterzeilen ein Neuladen der Daten (ohne
                          kennung haengen sie am Zeilenobjekt)
     beiAuswahl?(zeilen)  wird nach jeder Aenderung der Auswahl gerufen
     zeilenMenue?(auswahl, z) -> [{ text, aktion(), aus? } | '-']
                          eigene Eintraege oben im Rechtsklick-Menue einer Zeile
                          (auswahl = gewaehlte Zeilen, z = die angeklickte)
     unter?: {            Unterzeilen je Zeile (Baum); ohne unter gibt es keine Pfeilspalte
       titel,             z. B. 'Bearbeitungen' (steht im Menue und im Tooltip des Pfeils)
       zeilen(z) -> [],   die Unterzeilen DIESER Zeile, in fester Reihenfolge
       spalten,           wie oben: [{ feld, titel, wert(u), stellen?, zelle?(u), hilfe?,
                             ohneName? (Wert ohne den Namen davor, z. B. Nr und Bezeichnung) }]
       text?(u) -> Text,  statt spalten: die ganze Zeile als fertiger Text
       zeileAttr?(u),
       unter?: { … }      die naechste Ebene, gleich aufgebaut (z. B. Punkte je Bearbeitung)
     }
     melden?(text)        Kurzmeldung (z. B. hinweisAnzeigen des Werkzeugs);
                          ohne melden zeigt die Liste sie selbst kurz an
   }
   Aufrufe:  listeEinrichten(def), listeZeichnen(id) (nach jeder Datenaenderung),
             listeZuruecksetzen(id), listeFilterLeeren(id)
   Abfragen: listeAuswahl(id) -> gewaehlte Zeilen in der Reihenfolge von zeilen()
             listeAuswahlSetzen(id, zeilen | null)
             listeAlsZeilen(id) -> [[Titel …], [Werte …] …] des Angezeigten
             listeCsv(id, nurAuswahl?) -> CSV-Text; listeCsvSpeichern(id, nurAuswahl?)
             listeRueckgaengig(zst) nimmt die letzte Aenderung zurueck (Strg+Z)
   ===================================================================== */

const LISTE_BAUSTEIN_VERSION = '2.7';
const LISTEN = new Map();
const LISTE_AUF_BREITE = 26;    /* feste Pfeilspalte fuer Unterzeilen (nur mit def.unter) */
const LISTE_WAHL_BREITE = 34;   /* feste Auswahlspalte ganz links */
const LISTE_STUECK = 200;   /* so viele Zeilen je Stueck (def.maxZeilen aendert das) */
const LISTE_FEST_MAX = 5;   /* so viele Spalten lassen sich links fixieren */
const LISTE_RUECK_MAX = 50; /* so viele Aenderungs-Schwuenge lassen sich zuruecknehmen */
/* Arten, mehrere Werte auf einmal zu aendern. fuer: 'alle' · 'zahl' · 'text' · 'frei' (nicht bei Auswahlfeldern) */
const LISTE_AENDER_ARTEN = [
  { id: 'setzen',   text: 'Setzen auf',         fuer: 'alle' },
  { id: 'plus',     text: 'Erhöhen um',         fuer: 'zahl' },
  { id: 'mal',      text: 'Multiplizieren mit', fuer: 'zahl' },
  { id: 'ersetzen', text: 'Text ersetzen',      fuer: 'text' },
  { id: 'vor',      text: 'Voranstellen',       fuer: 'text' },
  { id: 'nach',     text: 'Anhängen',           fuer: 'text' },
  { id: 'leeren',   text: 'Leeren',             fuer: 'frei' },
];
const LISTE_SUMMEN = [
  { id: 'summe',  text: 'Summe',               kurz: 'Σ' },
  { id: 'mittel', text: 'Mittelwert',          kurz: 'Ø' },
  { id: 'min',    text: 'Kleinster Wert',      kurz: 'min' },
  { id: 'max',    text: 'Größter Wert',        kurz: 'max' },
  { id: 'anzahl', text: 'Anzahl (nicht leer)', kurz: 'n' },
];

const LISTE_VERGLEICHE = [
  { id: 'gleich',        text: 'entspricht',              zeichen: '=' },
  { id: 'ungleich',      text: 'entspricht nicht',        zeichen: '≠' },
  { id: 'kleiner',       text: 'ist kleiner als',         zeichen: '<' },
  { id: 'kleinerGleich', text: 'ist kleiner oder gleich', zeichen: '<=' },
  { id: 'groesser',      text: 'ist größer als',          zeichen: '>' },
  { id: 'groesserGleich', text: 'ist größer oder gleich', zeichen: '>=' },
  { id: 'wie',           text: 'ist wie',                 zeichen: 'ist wie' },
  { id: 'nichtWie',      text: 'ist nicht wie',           zeichen: 'ist nicht wie' },
  { id: 'enthaelt',      text: 'enthält',                 zeichen: 'enthält' },
  { id: 'enthaeltNicht', text: 'enthält nicht',           zeichen: 'enthält nicht' },
  { id: 'beginnt',       text: 'beginnt mit',             zeichen: 'beginnt mit' },
  { id: 'endet',         text: 'endet mit',               zeichen: 'endet mit' },
  { id: 'leer',          text: 'ist leer',                zeichen: 'ist leer', ohneWert: true },
  { id: 'nichtLeer',     text: 'ist nicht leer',          zeichen: 'ist nicht leer', ohneWert: true },
];

const LISTE_TRICHTER = '<svg viewBox="0 0 12 12" width="11" height="11" aria-hidden="true"><path d="M1 2h10L7.2 6.4V10L4.8 11V6.4z" fill="currentColor"/></svg>';

/* ---------- Helfer ohne DOM (headless pruefbar) ---------- */

function listeEsc(wert) {
  return String(wert === null || wert === undefined ? '' : wert)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
function listeText(w) {
  if (w === null || w === undefined) return '';
  if (Array.isArray(w)) return w.join(', ');
  if (typeof w === 'number' && !Number.isFinite(w)) return '';
  return String(w);
}
function listeNorm(t) { return listeText(t).toLocaleLowerCase('de'); }
/* BEWUSST mit vorgehaltenen Formatierern: toLocaleString je Zelle kostete bei
   1709 Zeilen ueber 2 s je Zeichnen (gemessen 2026-11-10). */
const LISTE_FORMATE = new Map();
function listeFmt(n, stellen, ohnePunkte) {
  const schluessel = (ohnePunkte ? 'o' : 'm') + stellen;
  let f = LISTE_FORMATE.get(schluessel);
  if (!f) {
    const o = stellen === undefined ? { maximumFractionDigits: 3 } : { minimumFractionDigits: stellen, maximumFractionDigits: stellen };
    if (ohnePunkte) o.useGrouping = false;
    f = new Intl.NumberFormat('de-DE', o);
    LISTE_FORMATE.set(schluessel, f);
  }
  return f.format(n);
}
/* Deutsche und technische Schreibweise: "1.709", "284,09", "284.09", "-3". */
function listeZahl(w) {
  if (typeof w === 'number') return Number.isFinite(w) ? w : null;
  let t = listeText(w).trim().replace(/\s/g, '');
  if (!t) return null;
  if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(t)) t = t.replace(/\./g, '');
  t = t.replace(',', '.');
  if (!/^-?(\d+\.?\d*|\.\d+)$/.test(t)) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}
/* So, wie der Wert in der Zelle steht — Grundlage fuer Suche, Werteliste, Gruppen.
   BEWUSST ohne Tausenderpunkt (wie in CAMBIUM): eine Bauteil-Nr 9014 ist keine
   Menge, und "9.014" liest die Werkstatt als Kommazahl. Zaehler wie
   "1.709 Zeilen" behalten den Punkt. */
function listeAnzeige(sp, w) { return typeof w === 'number' && Number.isFinite(w) ? listeFmt(w, sp.stellen, true) : listeText(w); }

const LISTE_ORDNER = new Intl.Collator('de', { numeric: true, sensitivity: 'base' });
function listeWertVergleich(x, y) {
  if (typeof x === 'number' && typeof y === 'number') return x - y;
  return LISTE_ORDNER.compare(listeText(x), listeText(y));
}
function listeIstLeer(x) { return listeText(x) === ''; }

function listeVergleich(jeFeld, sort) {
  return (a, b) => {
    for (const s of sort) {
      const sp = jeFeld.get(s.feld);
      if (!sp) continue;
      const x = sp.wert(a), y = sp.wert(b);
      const lx = listeIstLeer(x), ly = listeIstLeer(y);
      if (lx || ly) { if (lx && ly) continue; return lx ? 1 : -1; }   /* leer immer ans Ende */
      const d = listeWertVergleich(x, y);
      if (d) return s.ab ? -d : d;
    }
    return 0;
  };
}

function listeMuster(text) {
  const kern = listeNorm(text).replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.');
  return new RegExp('^' + kern + '$');
}

/* Eine Bedingung des benutzerdefinierten Filters. Zahlen werden als Zahlen
   verglichen, sobald Zellwert UND Eingabe Zahlen sind (auch "9000" als Text). */
function listeBedingungPasst(sp, w, bed) {
  const text = listeAnzeige(sp, w), leer = text === '';
  if (bed.op === 'leer') return leer;
  if (bed.op === 'nichtLeer') return !leer;
  const soll = listeText(bed.wert);
  let a = listeZahl(w);
  const b = listeZahl(soll);
  if (a !== null && typeof w === 'number' && sp.stellen !== undefined) a = Number(a.toFixed(sp.stellen));
  const zahlen = a !== null && b !== null;
  const t = listeNorm(text), s = listeNorm(soll);
  switch (bed.op) {
    case 'gleich':        return zahlen ? a === b : t === s;
    case 'ungleich':      return zahlen ? a !== b : t !== s;
    case 'kleiner':       return !leer && (zahlen ? a < b  : LISTE_ORDNER.compare(text, soll) < 0);
    case 'kleinerGleich': return !leer && (zahlen ? a <= b : LISTE_ORDNER.compare(text, soll) <= 0);
    case 'groesser':      return !leer && (zahlen ? a > b  : LISTE_ORDNER.compare(text, soll) > 0);
    case 'groesserGleich': return !leer && (zahlen ? a >= b : LISTE_ORDNER.compare(text, soll) >= 0);
    case 'wie':           return listeMuster(soll).test(t);
    case 'nichtWie':      return !listeMuster(soll).test(t);
    case 'enthaelt':      return t.includes(s);
    case 'enthaeltNicht': return !t.includes(s);
    case 'beginnt':       return t.startsWith(s);
    case 'endet':         return t.endsWith(s);
  }
  return true;
}

/* f: { werte?: [Anzeigetext, …], bed?: [{ op, wert }, …], oder?: bool }
   werte: der Zellwert muss einer davon sein. bed: alle (oder bei oder=true
   mindestens eine) muessen passen. Steht beides da, muss beides passen. */
function listeFilterPasst(sp, z, f) {
  if (!sp || !f) return true;
  const w = sp.wert(z);
  if (f.werte && !f.werte.includes(listeAnzeige(sp, w))) return false;
  const erg = (f.bed || []).map(b => listeBedingungPasst(sp, w, b));
  if (!erg.length) return true;
  return f.oder ? erg.some(Boolean) : erg.every(Boolean);
}

function listeFilterText(sp, f) {
  const teile = [];
  if (f.werte) teile.push(sp.titel + ' = ' + f.werte.map(w => w === '' ? '(leer)' : w).join(', '));
  const bed = (f.bed || []).map(b => {
    const v = LISTE_VERGLEICHE.find(x => x.id === b.op);
    return sp.titel + ' ' + v.zeichen + (v.ohneWert ? '' : ' ' + b.wert);
  });
  if (bed.length) teile.push(f.werte && f.oder && bed.length > 1 ? '(' + bed.join(' ODER ') + ')' : bed.join(f.oder ? ' ODER ' : ' UND '));
  return teile.join(' UND ');
}

/* Summe einer Spalte ueber Zeilen. Gerechnet wird nur mit echten Zahlen;
   ohne eine einzige Zahl gibt es kein Ergebnis (null), nicht 0. */
function listeSumme(sp, zeilen, art) {
  if (art === 'anzahl') { let a = 0; for (const z of zeilen) if (!listeIstLeer(sp.wert(z))) a++; return a; }
  /* summeWert: was je Zeile in die SUMME eingeht, wenn es nicht der Zellwert ist
     (z. B. Laenge x Stueckzahl in Metern). Mittel, Min, Max bleiben beim Zellwert. */
  const wert = art === 'summe' && sp.summeWert ? sp.summeWert : sp.wert;
  let a = 0, summe = 0, min = Infinity, max = -Infinity;
  for (const z of zeilen) {
    const w = wert(z);
    if (typeof w !== 'number' || !Number.isFinite(w)) continue;
    a++; summe += w;
    if (w < min) min = w;
    if (w > max) max = w;
  }
  if (!a) return null;
  return art === 'summe' ? summe : art === 'mittel' ? summe / a : art === 'min' ? min : art === 'max' ? max : null;
}
/* Mengen bekommen den Tausenderpunkt (anders als Zellwerte). */
/* nurZahl: ohne Einheit und ohne Tausenderpunkt — damit Excel den Wert als Zahl liest. */
function listeSummeText(sp, zeilen, art, nurZahl) {
  const w = listeSumme(sp, zeilen, art);
  if (w === null) return '';
  if (art === 'anzahl') return listeFmt(w, undefined, nurZahl);
  if (art === 'summe' && sp.summeWert) return listeFmt(w, sp.summeStellen !== undefined ? sp.summeStellen : sp.stellen, nurZahl) + (sp.summeEinheit && !nurZahl ? ' ' + sp.summeEinheit : '');
  return listeFmt(w, sp.stellen !== undefined ? sp.stellen : (art === 'mittel' ? 2 : undefined), nurZahl);
}

/* Zelltext als HTML, Fundstellen der Suchwoerter in <mark>. */
function listeMarkiert(text, woerter) {
  if (!woerter || !woerter.length || text === '') return listeEsc(text);
  const klein = listeNorm(text);
  if (klein.length !== text.length) return listeEsc(text);   /* Stellen wuerden nicht mehr stimmen */
  const stellen = [];
  for (const w of woerter) {
    let i = klein.indexOf(w);
    while (i >= 0) { stellen.push([i, i + w.length]); i = klein.indexOf(w, i + w.length); }
  }
  if (!stellen.length) return listeEsc(text);
  stellen.sort((x, y) => x[0] - y[0]);
  let html = '', pos = 0;
  for (const [von, bis] of stellen) {
    if (bis <= pos) continue;
    const a = Math.max(von, pos);
    html += listeEsc(text.slice(pos, a)) + '<mark class="liste-treffer">' + listeEsc(text.slice(a, bis)) + '</mark>';
    pos = bis;
  }
  return html + listeEsc(text.slice(pos));
}

/* Ein CSV-Feld. BEWUSST: Text, der mit = + - @ beginnt und keine Zahl ist,
   bekommt ein Hochkomma davor — sonst fuehrt Excel ihn als Formel aus. */
function listeCsvFeld(t) {
  t = listeText(t);
  if (/^[=+\-@\t\r]/.test(t) && listeZahl(t) === null) t = "'" + t;
  return /[";\r\n]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t;
}

/* Kreuztabelle: Zeilen nach spZ, Spalten nach spS (null = nur Gesamt) aufteilen.
   Liefert { zeilen: [{ text, alle }], spalten: [{ text, alle }], feld(i, j) -> Zeilen }.
   Leere Werte bilden eine eigene Reihe "(leer)" am Ende. */
function listeKreuzRechnen(zeilen, spZ, spS) {
  const teilen = (sp) => {
    const reihen = new Map();
    for (const z of zeilen) {
      const w = sp.wert(z), t = listeAnzeige(sp, w);
      let e = reihen.get(t);
      if (!e) reihen.set(t, e = { text: t, wert: w, alle: [] });
      e.alle.push(z);
    }
    return [...reihen.values()].sort((a, b) => {
      const la = a.text === '', lb = b.text === '';
      if (la || lb) return la === lb ? 0 : (la ? 1 : -1);
      return listeWertVergleich(a.wert, b.wert);
    });
  };
  const reihen = teilen(spZ), spalten = spS ? teilen(spS) : [];
  const mengen = spalten.map(c => new Set(c.alle));
  return { zeilen: reihen, spalten, feld: (i, j) => reihen[i].alle.filter(z => mengen[j].has(z)) };
}
/* Der Wert eines Feldes: Anzahl der Zeilen (spW = null) oder die Rechnung ueber spW. */
function listeKreuzText(zeilen, spW, art, nurZahl) {
  if (!zeilen.length) return '';
  return spW ? listeSummeText(spW, zeilen, art, nurZahl) : listeFmt(zeilen.length, undefined, nurZahl);
}

/* ----- Aendern: Regeln ohne DOM ----- */

function listeAenderAktiv(def) { return def.aendern === false ? false : typeof def.aendern === 'function' ? !!def.aendern() : true; }
function listeAenderbar(def, sp, z) { return !!sp && typeof sp.setzen === 'function' && listeAenderAktiv(def) && (!sp.aenderbar || !!sp.aenderbar(z)); }
function listeWahlwerte(sp, z) {
  const w = typeof sp.wahlwerte === 'function' ? sp.wahlwerte(z) : sp.wahlwerte;
  return w ? w.map(listeText) : null;
}
function listeAenderArten(sp) {
  const art = sp.wahlwerte ? 'wahl' : sp.zahl ? 'zahl' : 'text';
  return LISTE_AENDER_ARTEN.filter(x => x.fuer === 'alle' || x.fuer === art || (x.fuer === 'frei' && art !== 'wahl'));
}

/* Eine Eingabe (Text) oder ein gerechneter Wert (Zahl) -> { wert, text } oder { fehler }. */
function listeEingabeLesen(sp, z, roh) {
  let wert, text;
  if (typeof roh === 'number') {
    if (!Number.isFinite(roh)) return { fehler: 'Kein Zahlenwert' };
    wert = Math.round(roh * 1e6) / 1e6;                     /* Rechenrauschen (0,1 + 0,2) weg */
    text = String(wert).replace('.', ',');
  } else {
    text = listeText(roh).trim();
    const wahl = listeWahlwerte(sp, z);
    if (wahl) { if (!wahl.includes(text)) return { fehler: '„' + text + '“ steht nicht zur Auswahl' }; wert = text; }
    else if (sp.zahl) {
      wert = text === '' ? null : listeZahl(text);
      if (text !== '' && wert === null) return { fehler: '„' + text + '“ ist keine Zahl' };
    } else wert = text;
  }
  const grund = sp.pruefen ? sp.pruefen(wert, z) : '';
  return grund ? { fehler: String(grund) } : { wert, text };
}

/* Was eine Aenderung je Zeile bewirken WUERDE — ohne etwas zu schreiben.
   fn(z, alt, altText) liefert die Eingabe (Text), einen gerechneten Wert
   (Zahl) oder { fehler }. status: 'aendert' · 'gleich' · 'gesperrt' · 'fehler'. */
function listeAenderungPlan(def, sp, zeilen, fn) {
  return zeilen.map(z => {
    const alt = sp.wert(z), altText = listeAnzeige(sp, alt);
    const e = { z, alt, altText, neu: alt, neuText: altText, status: 'gleich', grund: '' };
    if (!listeAenderbar(def, sp, z)) { e.status = 'gesperrt'; return e; }
    const roh = fn(z, alt, altText);
    /* BEWUSST: dieselbe Anzeige wie vorher ist keine Aenderung — sonst wuerde ein
       unveraendert bestaetigtes "0,33" den genaueren Wert dahinter still runden. */
    if (typeof roh === 'string' && roh.trim() === altText) return e;
    const erg = roh && typeof roh === 'object' ? roh : listeEingabeLesen(sp, z, roh);
    if (erg.fehler) { e.status = 'fehler'; e.grund = erg.fehler; return e; }
    const gleich = sp.zahl && !sp.wahlwerte ? (erg.wert === alt || (erg.wert === null && listeIstLeer(alt))) : listeText(alt) === listeText(erg.wert);
    if (!gleich) { e.status = 'aendert'; e.neu = erg.wert; e.neuText = erg.text; }
    return e;
  });
}
function listeAenderungZahlen(plan) {
  const zahl = { aendert: 0, gleich: 0, gesperrt: 0, fehler: 0 };
  for (const e of plan) zahl[e.status]++;
  return zahl;
}
function listeAenderungText(sp, plan) {
  const zahl = listeAenderungZahlen(plan), fehler = plan.find(e => e.status === 'fehler');
  return ['„' + sp.titel + '“: ' + listeFmt(zahl.aendert) + (zahl.aendert === 1 ? ' Wert geändert' : ' Werte geändert'),
    zahl.gleich ? listeFmt(zahl.gleich) + ' unverändert' : '',
    zahl.gesperrt ? listeFmt(zahl.gesperrt) + ' gesperrt' : '',
    zahl.fehler ? listeFmt(zahl.fehler) + ' abgelehnt (' + fehler.grund + ')' : ''].filter(Boolean).join(' · ');
}
/* m: { art, wert, such, durch } aus dem Fenster "Werte aendern". */
function listeMassenFn(m) {
  const zahl = listeZahl(m.wert);
  switch (m.art) {
    case 'setzen': return () => m.wert;
    case 'leeren': return () => '';
    case 'plus': case 'mal': return (z, alt) => zahl === null ? { fehler: 'Zahl fehlt' }
      : (typeof alt !== 'number' || !Number.isFinite(alt)) ? { fehler: 'kein Zahlenwert in der Zelle' }
        : (m.art === 'plus' ? alt + zahl : alt * zahl);
    case 'ersetzen': return (z, alt, text) => m.such === '' ? text : text.split(m.such).join(m.durch);
    case 'vor': return (z, alt, text) => m.wert + text;
    case 'nach': return (z, alt, text) => text + m.wert;
  }
  return (z, alt, text) => text;
}

/* ---------- Zustand ---------- */

function listeEl(x) { return typeof x === 'string' ? document.getElementById(x) : x; }
function listeSpalten(def) {
  const eigene = typeof def.spalten === 'function' ? def.spalten() : def.spalten;
  return def.eigenschaften ? eigene.concat(listeEigenschaftenFuer(def, eigene)) : eigene;
}

/* ---------- Eigenschafts-Spalten (v2.7) ---------- */

/* Zahl fuer die Art-Erkennung: technische Schreibweise (Punkt als Dezimalzeichen,
   wie in BVX/XML). Fuehrende Nullen zaehlen NICHT als Zahl („01“, „007“ sind
   Kennungen und bleiben Text). */
function listeIstTechnischeZahl(w) {
  if (typeof w === 'number') return Number.isFinite(w);
  return /^-?(0|[1-9]\d*)(\.\d+)?([eE][-+]?\d+)?$/.test(String(w).trim());
}
function listeEigenschaftWert(w, art) {
  if (w === null || w === undefined || w === '') return art === 'zahl' ? null : '';
  if (art === 'zahl') { const n = typeof w === 'number' ? w : Number(String(w).trim()); return Number.isFinite(n) ? n : String(w); }
  if (art === 'janein') { const t = String(w).trim().toLowerCase(); return t === 'true' ? 'ja' : t === 'false' ? 'nein' : String(w); }
  return String(w);
}

/* Spalten aus den Eigenschaften der Zeilen — headless pruefbar.
   belegt: Namen, die schon eine Spalte des Werkzeugs zeigt. */
function listeEigenschaftsSpalten(zeilen, quellen, belegt) {
  const spalten = [];
  for (const q of (Array.isArray(quellen) ? quellen : [quellen])) {
    if (!q || typeof q.werte !== 'function') continue;
    const katalog = new Map((q.katalog || []).map(k => [k.name, k]));
    const ohne = new Set(q.ohne || []);
    const vorkommen = new Map();
    for (const z of zeilen) {
      const o = q.werte(z);
      if (!o) continue;
      for (const name of Object.keys(o)) {
        let e = vorkommen.get(name);
        if (!e) vorkommen.set(name, e = { zahl: true, janein: true, gefuellt: false });
        const w = o[name];
        if (w === null || w === undefined || w === '') continue;
        e.gefuellt = true;
        if (!listeIstTechnischeZahl(w)) e.zahl = false;
        if (!/^(true|false)$/i.test(String(w).trim())) e.janein = false;
      }
    }
    const reihe = (q.katalog || []).map(k => k.name).filter(n => vorkommen.has(n))
      .concat([...vorkommen.keys()].filter(n => !katalog.has(n)));
    const praefix = q.praefix === undefined ? 'e_' : q.praefix;
    for (const name of reihe) {
      if (ohne.has(name) || (belegt && belegt.has(name))) continue;
      const k = katalog.get(name), e = vorkommen.get(name);
      const art = (k && k.art) || (!e.gefuellt ? 'text' : e.janein ? 'janein' : e.zahl ? 'zahl' : 'text');
      const titel = (k && k.titel) || name;
      const erkl = (k && k.hilfe) || q.hilfe || '';
      const sp = {
        feld: praefix + name, titel, eigenschaft: name, aus: !(k && k.an), zahl: art === 'zahl',
        gruppe: (k && (k.gruppe || q.gruppe)) || q.weitere || q.gruppe || 'Weitere Eigenschaften',
        breite: (k && k.breite) || Math.max(90, Math.min(220, titel.length * 9 + 40)),
        hilfe: (q.quelle ? q.quelle + ': ' : '') + name + (erkl ? ' — ' + erkl : '') + (art === 'janein' ? ' (True/False als ja/nein)' : '')
          + (k ? '' : ' · nicht im Katalog des Werkzeugs, Wert wie in der Quelle'),
        wert: (z) => { const o = q.werte(z); return listeEigenschaftWert(o ? o[name] : undefined, art); },
      };
      if (k && k.stellen !== undefined) sp.stellen = k.stellen;
      if (k && k.summe) sp.summe = k.summe;
      spalten.push(sp);
    }
  }
  return spalten;
}

/* Fuer listeSpalten: einmal je Zeilenbestand (gleiche Zeilen in gleicher Folge =
   gleiche Spalten), sonst neu — die Art haengt an allen Werten. Der Merker haengt
   in einer WeakMap, nicht an der Definition des Werkzeugs. */
const LISTE_EIGENSCHAFTEN_MERKER = new WeakMap();
function listeEigenschaftenFuer(def, eigene) {
  const zeilen = def.zeilen() || [];
  const belegt = new Set(eigene.filter(sp => sp.eigenschaft).map(sp => sp.eigenschaft));
  const schluessel = [...belegt].sort().join('\u0001');
  const m = LISTE_EIGENSCHAFTEN_MERKER.get(def);
  if (m && m.schluessel === schluessel && m.zeilen.length === zeilen.length && m.zeilen.every((z, i) => z === zeilen[i])) return m.spalten;
  const spalten = listeEigenschaftsSpalten(zeilen, def.eigenschaften, belegt);
  LISTE_EIGENSCHAFTEN_MERKER.set(def, { zeilen: zeilen.slice(), schluessel, spalten });
  return spalten;
}

function listeVorgabe(zst) {
  const spalten = listeSpalten(zst.def);
  zst.reihenfolge = spalten.map(s => s.feld);
  zst.bekannt = new Set(zst.reihenfolge);
  zst.aus = new Set(spalten.filter(s => s.aus).map(s => s.feld));
  zst.breiten = {};
  zst.sort = (zst.def.sortVorgabe || []).map(s => ({ feld: s.feld, ab: !!s.ab }));
  zst.gruppen = (zst.def.gruppenVorgabe || []).map(g => typeof g === 'string' ? { feld: g, ab: false } : { feld: g.feld, ab: !!g.ab });
  zst.feldAus = false;
  zst.offen = new Set();
  zst.fest = new Set(spalten.filter(s => s.fest).map(s => s.feld));
  zst.summen = {};
  for (const sp of spalten) if (sp.summe) zst.summen[sp.feld] = sp.summe === true ? 'summe' : sp.summe;
  zst.kreuz = null;
}

function listeLaden(zst) {
  if (!zst.def.speicher) return;
  try {
    const g = JSON.parse(localStorage.getItem(zst.def.speicher) || 'null');
    if (!g || g.v !== 1) return;
    const texte = (x) => Array.isArray(x) ? x.filter(f => typeof f === 'string') : [];
    const paare = (x) => Array.isArray(x) ? x.filter(s => s && typeof s.feld === 'string').map(s => ({ feld: s.feld, ab: !!s.ab })) : [];
    zst.reihenfolge = texte(g.reihenfolge);
    zst.bekannt = new Set(zst.reihenfolge);
    zst.aus = new Set(texte(g.aus));
    zst.breiten = {};
    if (g.breiten && typeof g.breiten === 'object') for (const f of Object.keys(g.breiten)) if (Number.isFinite(g.breiten[f])) zst.breiten[f] = g.breiten[f];
    zst.sort = paare(g.sort);
    zst.gruppen = paare(g.gruppen);
    zst.feldAus = !!g.feldAus;
    zst.fest = new Set(texte(g.fest));
    zst.summen = {};
    if (g.summen && typeof g.summen === 'object') for (const f of Object.keys(g.summen)) if (LISTE_SUMMEN.some(x => x.id === g.summen[f])) zst.summen[f] = g.summen[f];
    const k = g.kreuz;
    if (k && typeof k.zeile === 'string') zst.kreuz = { zeile: k.zeile, spalte: typeof k.spalte === 'string' ? k.spalte : '', wert: typeof k.wert === 'string' ? k.wert : '', art: LISTE_SUMMEN.some(x => x.id === k.art) ? k.art : 'summe' };
  } catch (e) { /* unlesbarer Stand: Vorgabe bleibt */ }
}

function listeSpeichern(zst) {
  if (!zst.def.speicher) return;
  try {
    localStorage.setItem(zst.def.speicher, JSON.stringify({ v: 1, reihenfolge: zst.reihenfolge, aus: [...zst.aus],
      breiten: zst.breiten, sort: zst.sort, gruppen: zst.gruppen, feldAus: zst.feldAus,
      fest: [...zst.fest], summen: zst.summen, kreuz: zst.kreuz }));
  } catch (e) { /* Speicher voll oder gesperrt: Ansicht gilt nur fuer diese Sitzung */ }
}

/* Gleicht den Zustand mit den aktuellen Spalten ab (Spalten koennen wechseln). */
function listeOrdnung(zst) {
  /* wert(z) wird je Zeichnen hoechstens EINMAL je Zeile und Spalte gerechnet
     (Suche, Filter, Sortieren, Gruppen und Zelle fragen alle danach). Der
     Merker lebt nur so lange wie dieses Ergebnis — geaenderte Daten sind beim
     naechsten Zeichnen da. */
  const spalten = listeSpalten(zst.def).map(s => {
    const merker = new Map();
    return Object.assign({}, s, { wert: (z) => {
      if (merker.has(z)) return merker.get(z);
      const w = s.wert(z);
      merker.set(z, w);
      return w;
    } });
  });
  const jeFeld = new Map(spalten.map(s => [s.feld, s]));
  for (const s of spalten) {
    if (zst.bekannt.has(s.feld)) continue;
    zst.bekannt.add(s.feld);
    zst.reihenfolge.push(s.feld);
    if (s.aus) zst.aus.add(s.feld);
    if (s.fest) zst.fest.add(s.feld);
    if (s.summe) zst.summen[s.feld] = s.summe === true ? 'summe' : s.summe;
  }
  zst.sort = zst.sort.filter(s => jeFeld.has(s.feld));
  zst.gruppen = zst.gruppen.filter(g => jeFeld.has(g.feld));
  const entfallen = Object.keys(zst.filter).filter(f => !jeFeld.has(f));
  for (const f of entfallen) delete zst.filter[f];
  const gruppiert = new Set(zst.gruppen.map(g => g.feld));
  const ordnung = zst.reihenfolge.filter(f => jeFeld.has(f) && !gruppiert.has(f));
  let sichtbar = ordnung.filter(f => !zst.aus.has(f)).map(f => jeFeld.get(f));
  if (!sichtbar.length && ordnung.length) { zst.aus.delete(ordnung[0]); sichtbar = [jeFeld.get(ordnung[0])]; }   /* nie ganz ohne Spalte */
  const versteckt = ordnung.filter(f => zst.aus.has(f)).map(f => jeFeld.get(f));
  /* feste Spalten stehen immer zuerst (in ihrer Reihenfolge) */
  const feste = sichtbar.filter(sp => zst.fest.has(sp.feld)).slice(0, LISTE_FEST_MAX);
  if (feste.length) sichtbar = feste.concat(sichtbar.filter(sp => !feste.includes(sp)));
  return { spalten, jeFeld, sichtbar, versteckt, entfallen, festZahl: feste.length };
}

function listeBreite(zst, sp) {
  if (zst.breiten[sp.feld]) return zst.breiten[sp.feld];
  if (sp.breite) return sp.breite;
  return Math.max(sp.zahl ? 84 : 72, Math.min(240, String(sp.titel).length * 8 + 46));
}

/* Zeilen nach Suche und Spaltenfiltern; ohneFeld laesst den Filter einer Spalte aus
   (fuer deren Werteliste). */
/* filter (optional): ein Entwurf aus "Filter bearbeiten" statt des aktiven Filters. */
function listeSuchwoerter(zst) { return listeNorm(zst.text).split(/\s+/).filter(Boolean); }
function listeGefiltert(zst, ord, alle, ohneFeld, filter) {
  const woerter = listeSuchwoerter(zst);
  let basis = alle;
  if (woerter.length) {
    basis = basis.filter(z => {
      const s = listeNorm(ord.spalten.map(sp => listeAnzeige(sp, sp.wert(z))).join(' '));
      return woerter.every(w => s.includes(w));
    });
  }
  const an = filter ? true : zst.filterAn, quelle = filter || zst.filter;
  if (zst.nurAuswahl && an) basis = basis.filter(z => zst.gewaehlt.has(listeWahlSchluessel(zst, z)));
  const felder = an ? Object.keys(quelle).filter(f => f !== ohneFeld) : [];
  return felder.length ? basis.filter(z => felder.every(f => listeFilterPasst(ord.jeFeld.get(f), z, quelle[f]))) : basis;
}

/* ---------- Aufbau ---------- */

function listeEinrichten(def) {
  const ziel = listeEl(def.ziel);
  const zst = { def, id: def.id, filter: {}, filterAn: true, text: '', sicht: [], stueck: 0, _posten: [], _gezeichnet: 0, _zeileHtml: null, gewaehlt: new Set(), unterOffen: new Map(), nurAuswahl: false, _anker: null, _ankerBasis: new Set(), _gruppenZeilen: [], _alle: [],
    auswahlOffen: false, auswahlSuche: '', auswahlAuf: new Set(), _baumKnoten: [], popup: null, _gezogen: false, _gruppenSchluessel: [], _alleSchluessel: [], _werte: [],
    _aktiv: null, _aktivFeld: null, _felder: [], _versatz: 0, _festZahl: 0, _festBreite: 0, _tastenMenue: 0, rueck: [], _eingabe: null, _bereichLaeuft: false };
  listeVorgabe(zst);
  listeLaden(zst);
  ziel.innerHTML = '<div class="liste' + (def.auswahl === false ? '' : ' liste-mit-wahl') + '" data-liste="' + listeEsc(def.id) + '">'
    + '<div class="liste-kopfleiste">'
    + '<div class="liste-gruppierfeld" data-gruppierfeld></div>'
    + '<div class="liste-werkzeuge">'
    + (def.suche === false ? '' : '<input class="eingabefeld liste-suche" type="search" data-liste-suche placeholder="Suchen …" title="Alle Wörter müssen in der Zeile vorkommen" aria-label="Liste durchsuchen">')
    + '<button type="button" class="schaltflaeche schaltflaeche-klein" data-liste-aktion="aufklappen" title="Alle Gruppen aufklappen" hidden>▾ Alle auf</button>'
    + '<button type="button" class="schaltflaeche schaltflaeche-klein" data-liste-aktion="zuklappen" title="Alle Gruppen zuklappen" hidden>▸ Alle zu</button>'
    + '<button type="button" class="schaltflaeche schaltflaeche-klein" data-liste-aktion="feldEin" title="Das ausgeblendete Gruppierfeld wieder einblenden" hidden>Gruppierfeld …</button>'
    + '<button type="button" class="schaltflaeche schaltflaeche-klein" data-liste-aktion="spaltenauswahl" title="Ausgeblendete Spalten anzeigen und einblenden">Spalten …</button>'
    + '</div></div>'
    + '<div class="liste-rahmen"><div class="liste-rollbereich" data-rollbereich tabindex="0"></div>'
    + '<div class="liste-auswahl" data-auswahl hidden></div></div>'
    + '<div class="liste-filterzeile" data-filterzeile hidden></div>'
    + '<div class="liste-wahlzeile" data-wahlzeile hidden></div>'
    + '<div class="liste-summe meldung-klein" data-liste-summe></div>'
    + '<div data-schwebend></div>'
    + '</div>';
  zst.wurzel = ziel.querySelector('.liste');
  LISTEN.set(def.id, zst);
  listeVerdrahten(zst);
  return zst;
}

function listeTeil(zst, name) { return zst.wurzel.querySelector('[data-' + name + ']'); }

/* Zeichnet die Liste neu: filtern, sortieren, gruppieren, dann die Teile. */
function listeZeichnen(id) {
  const zst = LISTEN.get(id);
  if (!zst) return;
  const def = zst.def, ord = listeOrdnung(zst), alle = def.zeilen() || [];
  const roll = listeTeil(zst, 'rollbereich');
  const links = roll.scrollLeft;
  let oben = roll.scrollTop;
  zst._alle = alle;
  zst._eingabe = null;                                      /* ein offenes Eingabefeld ueberlebt das Neuzeichnen nicht */
  if (def.auswahl !== false && zst.gewaehlt.size) {   /* Zeilen, die es nicht mehr gibt, koennen nicht gewaehlt sein */
    const da = new Set(alle.map(z => listeWahlSchluessel(zst, z)));
    for (const k of [...zst.gewaehlt]) if (!da.has(k)) zst.gewaehlt.delete(k);
  }
  if (zst.nurAuswahl && !zst.gewaehlt.size) zst.nurAuswahl = false;   /* ohne Auswahl gaebe es nichts zu zeigen */
  if (!zst.stueck) { zst.stueck = def.maxZeilen || LISTE_STUECK; oben = 0; }   /* neue Ansicht: von vorn */

  const gefiltert = listeGefiltert(zst, ord, alle, null);
  const sortiert = zst.sort.length ? gefiltert.slice().sort(listeVergleich(ord.jeFeld, zst.sort)) : gefiltert;
  const h = listeZeichenHilfen(zst, ord);
  listePostenBauen(zst, ord, sortiert, h);
  listeGruppierfeldZeichnen(zst, ord);

  /* Tabelle mit EINEM innerHTML (Spec §7B) */
  if (!alle.length) {
    roll.innerHTML = def.leer ? def.leer() : '<p class="meldung-klein liste-leer">Keine Daten in der Liste.</p>';
  } else {
    roll.innerHTML = listeTabelleHtml(zst, ord, h)
      + (zst.sicht.length ? '' : '<p class="meldung-klein liste-leer">Keine Zeile passt zu Suche und Filter.</p>');
    listeFestSetzen(zst);
    roll.scrollLeft = links;
    roll.scrollTop = oben;
  }

  listeFilterzeileZeichnen(zst, ord);
  listeTeil(zst, 'liste-summe').textContent = (def.summe ? def.summe(zst.sicht, alle) : listeFmt(zst.sicht.length) + ' von ' + listeFmt(alle.length) + ' Zeilen')
    + (ord.entfallen.length ? ' · Filter entfernt, weil es die Spalte nicht mehr gibt: ' + ord.entfallen.join(', ') : '');
  if (zst.auswahlOffen) listeAuswahlZeichnen(zst, ord);
  listeAuswahlAnzeigen(zst);
  listeAktivAnzeigen(zst, false);
}

/* Was Kopf, Zeilen und Fusszeile gemeinsam brauchen; legt auch den Zeilen-Bauer
   zst._zeileHtml ab (das Nachzeichnen beim Scrollen nutzt ihn weiter). */
function listeZeichenHilfen(zst, ord) {
  const def = zst.def, wahl = def.auswahl !== false, mitUnter = !!def.unter;
  const woerter = listeSuchwoerter(zst);
  const klassen = ord.sichtbar.map((sp, i) => listeZellKlasse(sp, i, ord.festZahl));
  const zelleAuf = klassen.map(k => '<td' + (k ? ' class="' + k + '"' : '') + '>');
  const aktiv = listeAenderAktiv(def);
  const stift = ord.sichtbar.map(sp => aktiv && typeof sp.setzen === 'function');
  const zelleAufStift = klassen.map(k => '<td class="' + (k ? k + ' ' : '') + 'liste-aenderbar">');
  zst._felder = ord.sichtbar.map(sp => sp.feld);
  zst._versatz = (wahl ? 1 : 0) + (mitUnter ? 1 : 0);
  zst._festZahl = ord.festZahl;
  zst._spaltenZahl = Math.max(1, ord.sichtbar.length) + zst._versatz;
  zst._zeileHtml = (z, i) => '<tr' + (def.zeileAttr ? def.zeileAttr(z) : '') + ' data-posten="' + i + '">'
    + (wahl ? '<td class="liste-wahl"><input type="checkbox" tabindex="-1" data-wahl-zeile="' + i + '" aria-label="Zeile auswählen"></td>' : '')
    + (mitUnter ? listeAufZelle(zst, z, i) : '')
    + ord.sichtbar.map((sp, nr) => (stift[nr] && (!sp.aenderbar || sp.aenderbar(z)) ? zelleAufStift[nr] : zelleAuf[nr]) + listeZelle(sp, z, woerter) + '</td>').join('') + '</tr>';
  return { wahl, mitUnter, klassen, stift, summenSp: ord.sichtbar.filter(sp => zst.summen[sp.feld]) };
}

/* Gruppen und Zeilen als Posten: { z } = Zeile, { g, nr } = fertige
   Gruppenzeile, { u } = aufgeklappte Unterzeilen von u. Eingeklappte Gruppen
   kommen nicht in die Posten (und damit nicht ins DOM), zaehlen aber in sicht. */
function listePostenBauen(zst, ord, sortiert, h) {
  const def = zst.def, posten = [], sicht = [];
  zst._gruppenSchluessel = [];
  zst._alleSchluessel = [];
  zst._gruppenZeilen = [];
  const stufe = (zeilen, ebene, pfad, zeigen) => {
    if (ebene >= zst.gruppen.length) {
      for (const z of zeilen) {
        sicht.push(z);
        if (!zeigen) continue;
        posten.push({ z });
        if (h.mitUnter && listeUnterIstOffen(zst, z, '') && (def.unter.zeilen(z) || []).length) posten.push({ u: z });
      }
      return;
    }
    const g = zst.gruppen[ebene], sp = ord.jeFeld.get(g.feld);
    const gruppen = new Map();
    for (const z of zeilen) {
      const w = sp.wert(z), t = listeAnzeige(sp, w);
      let e = gruppen.get(t);
      if (!e) gruppen.set(t, e = { text: t, wert: w, zeilen: [] });
      e.zeilen.push(z);
    }
    const liste = [...gruppen.values()].sort((a, b) => {
      const la = a.text === '', lb = b.text === '';
      if (la || lb) return la === lb ? 0 : (la ? 1 : -1);
      const d = listeWertVergleich(a.wert, b.wert);
      return g.ab ? -d : d;
    });
    for (const e of liste) {
      const schluessel = pfad + '\u0001' + g.feld + '=' + e.text;
      zst._alleSchluessel.push(schluessel);
      const offen = zst.offen.has(schluessel);
      if (zeigen) {
        const nr = zst._gruppenSchluessel.push(schluessel) - 1;
        zst._gruppenZeilen[nr] = e.zeilen;
        posten.push({ nr, g: listeGruppenZeileHtml(zst, sp, e, nr, ebene, offen, h) });
      }
      stufe(e.zeilen, ebene + 1, schluessel, zeigen && offen);
    }
  };
  stufe(sortiert, 0, '', true);
  zst.sicht = sicht;
  zst._posten = posten;
  zst._gezeichnet = Math.min(posten.length, zst.stueck);
}

function listeGruppenZeileHtml(zst, sp, e, nr, ebene, offen, h) {
  const info = zst.def.gruppenInfo ? zst.def.gruppenInfo(e.zeilen) : '';
  const name = sp.titel + ' ' + (e.text || '(leer)');
  return '<tr class="liste-gruppe" data-gruppe="' + nr + '" aria-expanded="' + offen + '">'
    + (h.wahl ? '<td class="liste-wahl"><input type="checkbox" tabindex="-1" data-wahl-gruppe="' + nr + '" aria-label="Gruppe ' + listeEsc(name) + ' auswählen"'
      + ' title="Alle ' + listeFmt(e.zeilen.length) + ' Zeilen dieser Gruppe aus- oder abwählen"></td>' : '')
    + '<td colspan="' + (zst._spaltenZahl - (h.wahl ? 1 : 0)) + '">'
    + '<span class="liste-gruppe-inhalt" style="padding-left:' + (ebene * 20) + 'px"><span class="liste-pfeil" aria-hidden="true">' + (offen ? '▾' : '▸') + '</span> '
    + '<span class="liste-gruppe-titel">' + listeEsc(sp.titel) + ' :</span> <b>' + (e.text === '' ? '(leer)' : listeEsc(e.text)) + '</b>'
    + ' <span class="liste-anzahl">(' + listeFmt(e.zeilen.length) + ')</span>'
    + (info ? ' <span class="liste-gruppe-info">' + listeEsc(info) + '</span>' : '')
    + h.summenSp.map(c => {
      const text = listeSummeText(c, e.zeilen, zst.summen[c.feld]);
      return text === '' ? '' : ' <span class="liste-gruppe-summe">' + listeSummenKurz(zst.summen[c.feld]) + ' ' + listeEsc(c.titel) + ' <b>' + listeEsc(text) + '</b></span>';
    }).join('') + '</span></td></tr>';
}

function listeGruppierfeldZeichnen(zst, ord) {
  const feld = listeTeil(zst, 'gruppierfeld');
  feld.hidden = zst.feldAus && !zst.gruppen.length;
  feld.innerHTML = zst.gruppen.length
    ? zst.gruppen.map((g, i) => {
      const titel = listeEsc(ord.jeFeld.get(g.feld).titel);
      return (i ? '<span class="liste-marke-pfeil" aria-hidden="true">›</span>' : '')
        + '<span class="liste-gruppenmarke" data-marke="' + listeEsc(g.feld) + '" title="Klick: Gruppen andersherum sortieren · Ziehen: Ebene verschieben oder zurück in die Kopfzeile">'
        + titel + ' <span class="sort-pfeil">' + (g.ab ? '▼' : '▲') + '</span>'
        + '<button type="button" class="liste-marke-weg" data-marke-weg="' + listeEsc(g.feld) + '" title="Gruppierung aufheben" aria-label="Gruppierung nach ' + titel + ' aufheben">✕</button></span>';
    }).join('')
    : '<span class="liste-gruppierhinweis">Ziehen Sie eine Spaltenüberschrift hierher, um nach dieser Spalte zu gruppieren</span>';
  for (const a of ['aufklappen', 'zuklappen']) zst.wurzel.querySelector('[data-liste-aktion="' + a + '"]').hidden = !zst.gruppen.length;
  zst.wurzel.querySelector('[data-liste-aktion="feldEin"]').hidden = !feld.hidden;   /* nur solange das Feld fehlt */
}

function listeTabelleHtml(zst, ord, h) {
  const breiten = ord.sichtbar.map(sp => listeBreite(zst, sp));
  const gesamt = breiten.reduce((s, b) => s + b, (h.wahl ? LISTE_WAHL_BREITE : 0) + (h.mitUnter ? LISTE_AUF_BREITE : 0));
  return '<table class="liste-tabelle" style="width:' + gesamt + 'px"><colgroup>'
    + (h.wahl ? '<col style="width:' + LISTE_WAHL_BREITE + 'px">' : '')
    + (h.mitUnter ? '<col style="width:' + LISTE_AUF_BREITE + 'px">' : '')
    + ord.sichtbar.map((sp, i) => '<col data-col="' + listeEsc(sp.feld) + '" style="width:' + breiten[i] + 'px">').join('') + '</colgroup>'
    + '<thead>' + listeKopfHtml(zst, ord, h) + '</thead>'
    + '<tbody>' + listePostenHtml(zst, 0, zst._gezeichnet) + listeMehrHtml(zst) + '</tbody>'
    + (h.summenSp.length && zst.sicht.length ? '<tfoot>' + listeFussHtml(zst, ord, h) + '</tfoot>' : '')
    + '</table>';
}

function listeKopfHtml(zst, ord, h) {
  const pfeil = (f) => {
    const i = zst.sort.findIndex(s => s.feld === f);
    if (i < 0) return '';
    return '<span class="sort-pfeil">' + (zst.sort[i].ab ? '▼' : '▲') + (zst.sort.length > 1 ? '<sub>' + (i + 1) + '</sub>' : '') + '</span>';
  };
  return '<tr>'
    + (h.wahl ? '<th class="liste-wahl"><input type="checkbox" tabindex="-1" data-wahl-alle aria-label="Alle angezeigten Zeilen auswählen" title="Alle angezeigten Zeilen aus- oder abwählen"></th>' : '')
    + (h.mitUnter ? '<th class="liste-auf" aria-label="' + listeEsc(zst.def.unter.titel || 'Unterzeilen') + '"></th>' : '')
    + ord.sichtbar.map((sp, nr) => {
      const feld = listeEsc(sp.feld), titel = listeEsc(sp.titel);
      const si = zst.sort.find(s => s.feld === sp.feld);
      return '<th data-feld="' + feld + '" tabindex="-1" class="liste-kopf' + (h.klassen[nr] ? ' ' + h.klassen[nr] : '') + (zst.filter[sp.feld] ? ' gefiltert' : '') + '"'
        + ' aria-sort="' + (si ? (si.ab ? 'descending' : 'ascending') : 'none') + '" title="'
        + listeEsc((sp.hilfe ? sp.hilfe + ' — ' : '') + 'Klick: sortieren · Umschalt+Klick: zusätzlich sortieren · Ziehen: verschieben oder gruppieren · Rechtsklick: Menü') + '">'
        + (h.stift[nr] ? '<span class="liste-kopf-stift" title="Werte dieser Spalte lassen sich ändern: Doppelklick, F2 oder lostippen" aria-hidden="true">✎</span>' : '')
        + '<span class="liste-kopf-titel">' + titel + '</span>' + pfeil(sp.feld)
        + '<button type="button" tabindex="-1" class="liste-trichter" data-trichter="' + feld + '" title="Filtern nach ' + titel + '" aria-label="Filtern nach ' + titel + '">' + LISTE_TRICHTER + '</button>'
        + '<span class="liste-griff" data-griff="' + feld + '" title="Ziehen: Breite ändern · Doppelklick: optimale Breite"></span></th>';
    }).join('') + '</tr>';
}

function listeFussHtml(zst, ord, h) {
  const n = listeFmt(zst.sicht.length);
  return '<tr class="liste-fuss">' + (h.wahl ? '<td class="liste-wahl"></td>' : '') + (h.mitUnter ? '<td class="liste-auf"></td>' : '')
    + ord.sichtbar.map((sp, nr) => {
      const art = LISTE_SUMMEN.find(x => x.id === zst.summen[sp.feld]);
      const eigen = art && art.id === 'summe' && sp.summeWert ? (sp.summeHilfe || 'eigene Rechnung des Werkzeugs') + ' — ' : '';
      const hilfe = art ? eigen + art.text + ' ' + sp.titel + ' über ' + n + ' angezeigte Zeilen · Rechtsklick: ändern' : 'Rechtsklick: Summe für ' + sp.titel;
      return '<td data-fuss="' + listeEsc(sp.feld) + '"' + (h.klassen[nr] ? ' class="' + h.klassen[nr] + '"' : '') + ' title="' + listeEsc(hilfe) + '">'
        + (art ? '<span class="liste-fuss-art">' + art.kurz + '</span> ' + listeEsc(listeSummeText(sp, zst.sicht, art.id)) : '') + '</td>';
    }).join('') + '</tr>';
}

function listeFilterzeileZeichnen(zst, ord) {
  const fz = listeTeil(zst, 'filterzeile');
  const marke = (text, feld, titel) => '<span class="liste-filtermarke">'
    + (feld === null ? '<span class="liste-filtermarke-text">' + listeEsc(text) + '</span>'
      : '<button type="button" class="liste-filtermarke-text" data-filter-marke="' + listeEsc(feld) + '" title="Klicken, um diesen Filter zu ändern">' + listeEsc(text) + '</button>')
    + '<button type="button" class="liste-marke-weg" data-filter-marke-weg="' + listeEsc(feld === null ? '' : feld) + '" title="Diesen Filter entfernen" aria-label="' + listeEsc(titel) + ' entfernen">✕</button></span>';
  const marken = Object.keys(zst.filter).map(f => marke(listeFilterText(ord.jeFeld.get(f), zst.filter[f]), f, 'Filter ' + ord.jeFeld.get(f).titel))
    .concat(zst.nurAuswahl ? [marke('nur ausgewählte Zeilen', null, 'Nur Auswahl anzeigen')] : []);
  fz.hidden = !marken.length;
  fz.innerHTML = marken.length
    ? '<button type="button" class="schaltflaeche schaltflaeche-klein" data-filter-knopf="loeschen" title="Alle Filter löschen" aria-label="Alle Filter löschen">✕</button>'
      + '<label class="liste-filter-an" title="Filter vorübergehend aus- und wieder einschalten"><input type="checkbox" data-filter-knopf="an"' + (zst.filterAn ? ' checked' : '') + '> Filter aktiv</label>'
      + '<span class="liste-filtertext' + (zst.filterAn ? '' : ' aus') + '">' + marken.join('<span class="liste-filter-und">UND</span>') + '</span>'
      + '<button type="button" class="schaltflaeche schaltflaeche-klein" data-filter-knopf="bearbeiten" title="Alle Filter in einem Fenster ändern, ergänzen oder entfernen">Bearbeiten …</button>'
      + '<span class="liste-filterzahl">' + listeFmt(zst.sicht.length) + ' von ' + listeFmt(zst._alle.length) + ' Zeilen</span>'
    : '';
}

function listeZellKlasse(sp, nr, festZahl) {
  return ((sp.zahl ? 'zahl' : '') + (nr < festZahl ? ' liste-fest liste-fest-' + nr + (nr === festZahl - 1 ? ' liste-fest-rand' : '') : '')).trim();
}
function listeSummenKurz(art) { const x = LISTE_SUMMEN.find(y => y.id === art); return x ? x.kurz : ''; }

/* Abstand der festen Spalten vom linken Rand — als CSS-Variablen an der Tabelle,
   damit ein Ziehen an der Breite sie ohne Neuzeichnen nachfuehren kann. */
function listeFestSetzen(zst) {
  const tab = zst.wurzel.querySelector('.liste-tabelle');
  if (!tab) return;
  let links = (zst.def.auswahl === false ? 0 : LISTE_WAHL_BREITE) + (zst.def.unter ? LISTE_AUF_BREITE : 0);
  const cols = tab.querySelectorAll('col[data-col]');
  for (let i = 0; i < zst._festZahl && i < cols.length; i++) {
    tab.style.setProperty('--fest-' + i, links + 'px');
    links += parseFloat(cols[i].style.width) || 0;
  }
  zst._festBreite = links;
}

/* BEWUSST stueckweise: 1709 Zeilen x 14 Spalten auf einmal kosteten im Browser
   rund 0,7 s reines Layout je Zeichnen (gemessen 2026-11-10). Gezeichnet wird
   darum ein Stueck; beim Scrollen ans Ende kommt das naechste dazu. Summe,
   Filterzahl und Export rechnen immer mit ALLEN Zeilen. */
function listePostenHtml(zst, von, bis) {
  const teile = [];
  for (let i = von; i < bis; i++) { const p = zst._posten[i]; teile.push(p.g !== undefined ? p.g : p.u !== undefined ? listeUnterZeileHtml(zst, p.u, i) : zst._zeileHtml(p.z, i)); }
  return teile.join('');
}
function listeMehrHtml(zst) {
  const rest = zst._posten.length - zst._gezeichnet;
  if (rest <= 0) return '';
  return '<tr class="liste-mehr"><td colspan="' + zst._spaltenZahl + '"><span class="liste-gruppe-inhalt">' + listeFmt(rest) + ' weitere Zeilen — sie erscheinen beim Weiterscrollen. '
    + '<button type="button" tabindex="-1" class="schaltflaeche schaltflaeche-klein" data-liste-aktion="alleZeigen">Alle anzeigen</button></span></td></tr>';
}
function listeNachzeichnen(zst, alles) {
  const mehr = zst.wurzel.querySelector('tr.liste-mehr');
  if (!mehr || zst._gezeichnet >= zst._posten.length) return;
  const bis = alles ? zst._posten.length : Math.min(zst._posten.length, zst._gezeichnet + (zst.def.maxZeilen || LISTE_STUECK));
  mehr.insertAdjacentHTML('beforebegin', listePostenHtml(zst, zst._gezeichnet, bis));
  zst._gezeichnet = bis;
  zst.stueck = alles ? Infinity : bis;
  mehr.insertAdjacentHTML('afterend', listeMehrHtml(zst));
  mehr.remove();
  listeAuswahlAnzeigen(zst);
}

/* ---------- Auswahl: Kaestchen vor jeder Zeile, Gruppe und Untergruppe ---------- */

function listeWahlSchluessel(zst, z) { return zst.def.kennung ? zst.def.kennung(z) : z; }
function listeWahlAnzahl(zst, zeilen) {
  let n = 0;
  for (const z of zeilen) if (zst.gewaehlt.has(listeWahlSchluessel(zst, z))) n++;
  return n;
}
function listeWahlSetzen(zst, zeilen, an) {
  for (const z of zeilen) { const k = listeWahlSchluessel(zst, z); if (an) zst.gewaehlt.add(k); else zst.gewaehlt.delete(k); }
}

/* Schreibt den Stand in die vorhandenen Kaestchen — ohne die Tabelle neu zu
   zeichnen (Spec §7B). Gruppen und Kopf: alle = Haken, ein Teil = "teilweise". */
function listeAuswahlAnzeigen(zst) {
  if (zst.def.auswahl === false) return;
  const w = zst.wurzel;
  for (const c of w.querySelectorAll('[data-wahl-zeile]')) {
    const p = zst._posten[Number(c.dataset.wahlZeile)];
    const an = !!p && p.z !== undefined && zst.gewaehlt.has(listeWahlSchluessel(zst, p.z));
    c.checked = an;
    c.closest('tr').toggleAttribute('data-gewaehlt', an);
  }
  const drei = (c, zeilen) => {
    const n = listeWahlAnzahl(zst, zeilen);
    c.checked = zeilen.length > 0 && n === zeilen.length;
    c.indeterminate = n > 0 && n < zeilen.length;
  };
  for (const c of w.querySelectorAll('[data-wahl-gruppe]')) drei(c, zst._gruppenZeilen[Number(c.dataset.wahlGruppe)] || []);
  const kopf = w.querySelector('[data-wahl-alle]');
  if (kopf) drei(kopf, zst.sicht);
  const zeile = listeTeil(zst, 'wahlzeile');
  const gesamt = zst.gewaehlt.size, versteckt = gesamt - listeWahlAnzahl(zst, zst.sicht);
  zeile.hidden = !gesamt;
  zeile.innerHTML = gesamt
    ? '<span><b>' + listeFmt(gesamt) + '</b> von ' + listeFmt(zst._alle.length) + ' ausgewählt'
      + (versteckt ? ' — davon ' + listeFmt(versteckt) + ' wegen Filter oder Suche gerade nicht in der Liste' : '') + '</span>'
      + '<span class="liste-wahlknoepfe"><button type="button" class="schaltflaeche schaltflaeche-klein" data-liste-aktion="wahlUmkehren" title="Angezeigte Zeilen: gewählt wird abgewählt und umgekehrt">Umkehren</button>'
      + '<button type="button" class="schaltflaeche schaltflaeche-klein" data-liste-aktion="wahlLeeren">Auswahl aufheben</button></span>'
    : '';
}

function listeAuswahlGeaendert(zst) {
  listeAuswahlAnzeigen(zst);
  if (zst.def.beiAuswahl) zst.def.beiAuswahl(listeAuswahl(zst.id));
}

/* Die gewaehlten Zeilen — in der Reihenfolge von zeilen(), auch solche, die
   ein Filter gerade ausblendet. */
function listeAuswahl(id) {
  const zst = LISTEN.get(id);
  if (!zst) return [];
  return (zst.def.zeilen() || []).filter(z => zst.gewaehlt.has(listeWahlSchluessel(zst, z)));
}
function listeAuswahlSetzen(id, zeilen) {
  const zst = LISTEN.get(id);
  if (!zst) return;
  zst.gewaehlt = new Set((zeilen || []).map(z => listeWahlSchluessel(zst, z)));
  listeAuswahlGeaendert(zst);
}

/* Anker = die zuletzt angeklickte Zeile; ankerBasis = was in dem Moment gewaehlt
   war. Umschalt+Klick setzt "Basis + Bereich Anker…Ziel" — so kommt der Bereich
   DAZU, und ein zweiter Umschalt+Klick kann ihn noch verkuerzen. */
function listeAnkerSetzen(zst, z) {
  zst._bereichLaeuft = false;
  zst._anker = z === null ? null : listeWahlSchluessel(zst, z);
  zst._ankerBasis = new Set(zst.gewaehlt);
}
function listeBereichWaehlen(zst, index) {
  const ziel = zst._posten[index];
  if (!ziel) return;
  const von = zst._anker === null ? -1 : zst._posten.findIndex(p => p.z !== undefined && listeWahlSchluessel(zst, p.z) === zst._anker);
  const neu = new Set(von < 0 ? zst.gewaehlt : zst._ankerBasis);
  const a = von < 0 ? index : Math.min(von, index), b = von < 0 ? index : Math.max(von, index);
  for (let i = a; i <= b; i++) {
    const p = zst._posten[i];
    if (p.z !== undefined) neu.add(listeWahlSchluessel(zst, p.z));
    else if (p.g !== undefined && (i === index || !zst.offen.has(zst._gruppenSchluessel[p.nr]))) {   /* eingeklappte Gruppe im Bereich: alle ihre Zeilen */
      for (const z of zst._gruppenZeilen[p.nr] || []) neu.add(listeWahlSchluessel(zst, z));
    }
  }
  zst.gewaehlt = neu;
  if (von < 0 && ziel.z !== undefined) { zst._anker = listeWahlSchluessel(zst, ziel.z); zst._ankerBasis = new Set(); }
}
/* Klick auf eine Zeile, wie in Office: allein · Strg = umschalten · Umschalt = Bereich. */
function listeZeileKlick(zst, index, e) {
  const p = zst._posten[index];
  if (!p || p.z === undefined) return;
  const k = listeWahlSchluessel(zst, p.z);
  if (e.shiftKey) listeBereichWaehlen(zst, index);
  else if (e.ctrlKey || e.metaKey) {
    if (zst.gewaehlt.has(k)) zst.gewaehlt.delete(k); else zst.gewaehlt.add(k);
    listeAnkerSetzen(zst, p.z);
  } else {
    zst.gewaehlt = new Set([k]);
    listeAnkerSetzen(zst, p.z);
  }
  listeAuswahlGeaendert(zst);
}
/* Alle Zeilen einer Gruppe dazu — oder weg, wenn schon alle gewaehlt sind. */
function listeGruppeWaehlen(zst, nr) {
  const zeilen = zst._gruppenZeilen[nr] || [];
  listeWahlSetzen(zst, zeilen, listeWahlAnzahl(zst, zeilen) < zeilen.length);
  zst._ankerBasis = new Set(zst.gewaehlt);
  listeAuswahlGeaendert(zst);
}
function listeAllesWaehlen(zst) {
  listeWahlSetzen(zst, zst.sicht, true);
  zst._ankerBasis = new Set(zst.gewaehlt);
  listeAuswahlGeaendert(zst);
}
/* Kehrt die Auswahl der ANGEZEIGTEN Zeilen um; was ein Filter ausblendet, bleibt wie es ist. */
function listeAuswahlUmkehren(zst) {
  for (const z of zst.sicht) { const k = listeWahlSchluessel(zst, z); if (zst.gewaehlt.has(k)) zst.gewaehlt.delete(k); else zst.gewaehlt.add(k); }
  zst._ankerBasis = new Set(zst.gewaehlt);
  listeAuswahlGeaendert(zst);
}

/* ---------- Rechtsklick-Menues ausserhalb des Spaltenkopfs ---------- */

function listeMelden(zst, text) {
  if (zst.def.melden) { zst.def.melden(text); return; }
  const el = document.createElement('div');
  el.className = 'liste-meldung';
  el.setAttribute('role', 'status');
  el.textContent = text;
  listeTeil(zst, 'schwebend').appendChild(el);
  setTimeout(() => el.remove(), 2600);
}

function listeKopieren(zst, text, meldung) {
  const fertig = (ok) => listeMelden(zst, ok ? meldung : 'Kopieren hat der Browser nicht erlaubt.');
  const ersatz = () => {
    const feld = document.createElement('textarea');
    feld.value = text;
    feld.style.cssText = 'position:fixed;left:-9999px;top:0';
    document.body.appendChild(feld);
    feld.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
    feld.remove();
    fertig(ok);
  };
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(() => fertig(true), ersatz);
  else ersatz();
}

/* eintraege: [{ text, aktion(), aus?, kuerzel? } | '-' | null]; Striche am Rand und doppelte fallen weg. */
function listeMenueFrei(zst, eintraege, x, y) {
  const liste = [];
  for (const e of eintraege) {
    if (!e) continue;
    if (e === '-') { if (liste.length && liste[liste.length - 1] !== '-') liste.push(e); continue; }
    liste.push(e);
  }
  while (liste.length && liste[liste.length - 1] === '-') liste.pop();
  if (!liste.length) return;
  const aktionen = [];
  listePopup(zst, 'menue', null, '<div role="menu">' + liste.map(e => e === '-' ? '<hr>'
    : '<button type="button" role="menuitem" data-menue-nr="' + (aktionen.push(e.aktion) - 1) + '"' + (e.aus ? ' disabled' : '') + '>'
      + '<span>' + listeEsc(e.text) + '</span>' + (e.kuerzel ? '<span class="liste-kuerzel">' + listeEsc(e.kuerzel) + '</span>' : '') + '</button>').join('') + '</div>', x, y);
  zst.popup.aktionen = aktionen;
}

function listeWahlEintraege(zst) {
  if (zst.def.auswahl === false) return [];
  const n = zst.gewaehlt.size;
  return [
    { text: 'Alles auswählen', kuerzel: 'Strg+A', aus: !zst.sicht.length, aktion: () => listeAllesWaehlen(zst) },
    { text: 'Auswahl umkehren', aus: !zst.sicht.length, aktion: () => listeAuswahlUmkehren(zst) },
    { text: 'Auswahl aufheben', aus: !n, aktion: () => { zst.gewaehlt = new Set(); listeAuswahlGeaendert(zst); } },
    { text: zst.nurAuswahl ? 'Wieder alle Zeilen anzeigen' : 'Nur Auswahl anzeigen', aus: !n && !zst.nurAuswahl,
      aktion: () => { zst.nurAuswahl = !zst.nurAuswahl; zst.filterAn = true; zst.stueck = 0; listeZeichnen(zst.id); } },
  ];
}
function listeGruppenEintraege(zst) {
  /* Das ausgeblendete Gruppierfeld muss von UEBERALL wieder erreichbar sein
     (Anwender 2026-11-10: ausblenden ging, einblenden fand sich nicht). */
  if (!zst.gruppen.length) return zst.feldAus ? [{ text: 'Gruppierfeld einblenden', aktion: () => listeFeldZeigen(zst, true) }] : [];
  return [
    { text: 'Alle Gruppen aufklappen', aktion: () => listeAktion(zst, 'aufklappen') },
    { text: 'Alle Gruppen zuklappen', aktion: () => listeAktion(zst, 'zuklappen') },
    { text: 'Gruppierung ganz aufheben', aktion: () => { zst.gruppen = []; zst.offen = new Set(); listeNeu(zst, true); } },
  ];
}

function listeZeilenMenue(zst, index, td) {
  const p = zst._posten[index];
  if (!p || p.z === undefined) return [];
  const z = p.z, wahl = zst.def.auswahl !== false;
  if (wahl && !zst.gewaehlt.has(listeWahlSchluessel(zst, z))) {   /* wie im Explorer: Rechtsklick ausserhalb der Auswahl waehlt diese Zeile */
    zst.gewaehlt = new Set([listeWahlSchluessel(zst, z)]);
    listeAnkerSetzen(zst, z);
    listeAuswahlGeaendert(zst);
  }
  const ord = listeOrdnung(zst);
  const nr = td ? td.cellIndex - (wahl ? 1 : 0) - (zst.def.unter ? 1 : 0) : -1;
  const sp = nr >= 0 ? ord.sichtbar[nr] : null;
  const e = [];
  if (zst.def.zeilenMenue) { for (const x of zst.def.zeilenMenue(listeAuswahl(zst.id), z) || []) e.push(x); e.push('-'); }
  if (sp && listeAenderbar(zst.def, sp, z)) {
    const gew = listeGewaehlteSicht(zst), jetzt = listeAnzeige(sp, sp.wert(z));
    const hier = () => zst._posten.findIndex(x => x.z === z);
    e.push({ text: '„' + sp.titel + '“ ändern', kuerzel: 'F2', aktion: () => listeEingabeStart(zst, hier(), sp.feld) });
    if (gew.length > 1) {
      e.push({ text: '„' + sp.titel + '“ für ' + listeFmt(gew.length) + ' gewählte Zeilen ändern …', aktion: () => listeMassenOeffnen(zst, gew, 'gewählte Zeilen', sp.feld) });
      e.push({ text: 'Wert „' + (jetzt === '' ? '(leer)' : jetzt.length > 20 ? jetzt.slice(0, 19) + '…' : jetzt) + '“ in die gewählten Zeilen übernehmen', kuerzel: 'Strg+D', aktion: () => listeWertUebernehmen(zst, hier(), sp.feld) });
    }
    for (const x of listeRueckEintraege(zst)) e.push(x);
    e.push('-');
  }
  for (const x of listeUnterEintraege(zst, z)) e.push(x);
  e.push('-');
  if (sp) {
    const text = listeAnzeige(sp, sp.wert(z));
    const kurz = text === '' ? '(leer)' : (text.length > 26 ? text.slice(0, 25) + '…' : text);
    const filtern = (f) => { zst.filter[sp.feld] = f; zst.filterAn = true; zst.stueck = 0; listeZeichnen(zst.id); };
    e.push({ text: 'Filtern: ' + sp.titel + ' = ' + kurz, aktion: () => filtern({ werte: [text] }) });
    e.push({ text: 'Ausschließen: ' + sp.titel + ' ≠ ' + kurz, aktion: () => filtern({ bed: [text === '' ? { op: 'nichtLeer', wert: '' } : { op: 'ungleich', wert: text }], oder: false }) });
    e.push({ text: 'Filter dieser Spalte löschen', aus: !zst.filter[sp.feld], aktion: () => { delete zst.filter[sp.feld]; zst.stueck = 0; listeZeichnen(zst.id); } });
    e.push({ text: 'Nach „' + sp.titel + '“ gruppieren', aktion: () => listeGruppeSetzen(zst, sp.feld) });
    e.push('-');
    e.push({ text: 'Zelle kopieren', aktion: () => listeKopieren(zst, text, 'Zelle kopiert: ' + kurz) });
  }
  if (wahl) {
    const zahl = zst.gewaehlt.size;
    e.push({ text: zahl === 1 ? 'Zeile kopieren' : listeFmt(zahl) + ' gewählte Zeilen kopieren', kuerzel: 'Strg+C', aktion: () => listeZeilenKopieren(zst) });
  }
  for (const x of listeExportEintraege(zst)) e.push(x);
  e.push('-');
  for (const x of listeWahlEintraege(zst)) e.push(x);
  e.push('-');
  for (const x of listeGruppenEintraege(zst)) e.push(x);
  return e;
}

function listeGruppeUmschalten(zst, nr) {
  const s = zst._gruppenSchluessel[nr];
  if (zst.offen.has(s)) zst.offen.delete(s); else zst.offen.add(s);
  listeZeichnen(zst.id);
}
function listeGruppenMenue(zst, nr) {
  const zeilen = zst._gruppenZeilen[nr] || [], s = zst._gruppenSchluessel[nr];
  const wahl = zst.def.auswahl !== false;
  const alle = wahl && zeilen.length > 0 && listeWahlAnzahl(zst, zeilen) === zeilen.length;
  const unter = zst._alleSchluessel.filter(x => x.startsWith(s + '\u0001'));
  const e = [];
  if (wahl) {
    e.push({ text: alle ? 'Gruppe abwählen' : 'Gruppe auswählen (' + listeFmt(zeilen.length) + ')', aktion: () => { listeWahlSetzen(zst, zeilen, !alle); zst._ankerBasis = new Set(zst.gewaehlt); listeAuswahlGeaendert(zst); } });
    e.push({ text: 'Nur diese Gruppe auswählen', aktion: () => { zst.gewaehlt = new Set(zeilen.map(z => listeWahlSchluessel(zst, z))); zst._ankerBasis = new Set(zst.gewaehlt); listeAuswahlGeaendert(zst); } });
    e.push('-');
  }
  if (listeAenderAktiv(zst.def) && listeSpalten(zst.def).some(c => typeof c.setzen === 'function')) {
    e.push({ text: 'Werte der Gruppe ändern … (' + listeFmt(zeilen.length) + ')', aktion: () => listeMassenOeffnen(zst, zeilen, 'Zeilen der Gruppe', null) });
    e.push('-');
  }
  e.push({ text: zst.offen.has(s) ? 'Gruppe zuklappen' : 'Gruppe aufklappen', aktion: () => listeGruppeUmschalten(zst, nr) });
  if (unter.length) e.push({ text: 'Mit allen Untergruppen aufklappen', aktion: () => { zst.offen.add(s); for (const x of unter) zst.offen.add(x); listeZeichnen(zst.id); } });
  for (const x of listeGruppenEintraege(zst)) e.push(x);
  e.push('-');
  for (const x of listeWahlEintraege(zst)) e.push(x);
  e.push('-');
  for (const x of listeExportEintraege(zst)) e.push(x);
  return e;
}

/* ---------- Unterzeilen: der feste Baum unter einer Zeile (def.unter) ---------- */

/* Offen-Stand je Zeile: Menge von Pfaden. '' = die Zeile selbst ist aufgeklappt,
   '3' = ihre 4. Unterzeile, '3/1' = deren 2. Unterzeile … (Platz in der festen
   Reihenfolge von unter.zeilen). */
function listeUnterSatz(zst, z, anlegen) {
  const k = listeWahlSchluessel(zst, z);
  let satz = zst.unterOffen.get(k);
  if (!satz && anlegen) zst.unterOffen.set(k, satz = new Set());
  return satz || null;
}
function listeUnterIstOffen(zst, z, pfad) {
  const satz = listeUnterSatz(zst, z, false);
  return !!satz && satz.has(pfad);
}
/* Zuklappen nimmt alles darunter mit zu. */
function listeUnterUmschalten(zst, z, pfad) {
  const satz = listeUnterSatz(zst, z, true);
  if (satz.has(pfad)) { for (const p of [...satz]) if (pfad === '' || p === pfad || p.startsWith(pfad + '/')) satz.delete(p); }
  else satz.add(pfad);
  if (!satz.size) zst.unterOffen.delete(listeWahlSchluessel(zst, z));
  listeZeichnen(zst.id);
}
function listeAufKnopf(i, pfad, offen, anzahl, titel) {
  return '<button type="button" tabindex="-1" class="liste-auf-knopf" data-unter="' + i + '" data-pfad="' + listeEsc(pfad) + '" aria-expanded="' + offen + '" title="'
    + listeEsc(listeFmt(anzahl) + ' ' + titel + (offen ? ' ausblenden' : ' anzeigen')) + '">' + (offen ? '▾' : '▸') + '</button>';
}
function listeAufZelle(zst, z, i) {
  const kinder = zst.def.unter.zeilen(z) || [];
  return '<td class="liste-auf">' + (kinder.length ? listeAufKnopf(i, '', listeUnterIstOffen(zst, z, ''), kinder.length, zst.def.unter.titel || 'Unterzeilen') : '') + '</td>';
}
/* Die aufgeklappte Zeile unter einer Hauptzeile: EINE Zelle ueber die ganze Breite, darin die Textzeilen. */
function listeUnterZeileHtml(zst, z, i) {
  const ebene = zst.def.unter;
  return '<tr class="liste-unter" data-block="' + i + '"><td colspan="' + zst._spaltenZahl + '"><div class="liste-unter-inhalt">'
    + listeUnterEbene(ebene, ebene.zeilen(z) || [], i, '', listeUnterSatz(zst, z, false) || new Set()) + '</div></td></tr>';
}
/* Eine Ebene Unterzeilen: je Unterzeile eine Textzeile. Leere Werte entfallen. */
function listeUnterEbene(ebene, zeilen, i, pfad, offen) {
  const spalten = ebene.text ? [] : (typeof ebene.spalten === 'function' ? ebene.spalten() : ebene.spalten);
  const tiefer = ebene.unter || null;
  return '<div class="liste-unterzeilen" role="group" aria-label="' + listeEsc(ebene.titel || 'Unterzeilen') + '">'
    + zeilen.map((u, nr) => {
      const p = pfad === '' ? String(nr) : pfad + '/' + nr;
      const kinder = tiefer ? (tiefer.zeilen(u) || []) : [];
      const auf = kinder.length > 0 && offen.has(p);
      const inhalt = ebene.text ? '<span class="liste-uz-feld">' + listeEsc(ebene.text(u)) + '</span>'
        : spalten.map(sp => {
          const html = listeZelle(sp, u);
          if (html === '') return '';
          return '<span class="liste-uz-feld"' + (sp.hilfe ? ' title="' + listeEsc(sp.hilfe) + '"' : '') + '>'
            + (sp.ohneName ? '' : '<span class="liste-uz-name">' + listeEsc(sp.titel) + '</span> ') + html + '</span>';
        }).join('');
      return '<div class="liste-uz" data-uz="' + p + '"' + (ebene.zeileAttr ? ebene.zeileAttr(u) : '') + '>'
        + (tiefer ? (kinder.length ? listeAufKnopf(i, p, auf, kinder.length, tiefer.titel || 'Unterzeilen') : '<span class="liste-uz-luecke"></span>') : '')
        + inhalt + '</div>'
        + (auf ? listeUnterEbene(tiefer, kinder, i, p, offen) : '');
    }).join('') + '</div>';
}
/* Die sichtbaren Unterzeilen einer Zeile als Pfade, in der Reihenfolge der Anzeige. */
function listeUnterPfade(zst, z) {
  const offen = listeUnterSatz(zst, z, false), pfade = [];
  if (!zst.def.unter || !offen || !offen.has('')) return pfade;
  const ebene = (def, zeilen, vor) => zeilen.forEach((u, nr) => {
    const p = vor === '' ? String(nr) : vor + '/' + nr;
    pfade.push(p);
    const kinder = def.unter ? (def.unter.zeilen(u) || []) : [];
    if (kinder.length && offen.has(p)) ebene(def.unter, kinder, p);
  });
  ebene(zst.def.unter, zst.def.unter.zeilen(z) || [], '');
  return pfade;
}
/* Wie viele Unterzeilen hat die Unterzeile mit diesem Pfad selbst? */
function listeUnterKinder(zst, z, pfad) {
  let def = zst.def.unter, zeilen = def.zeilen(z) || [];
  for (const nr of pfad.split('/')) {
    const u = zeilen[Number(nr)];
    if (!u) return 0;
    def = def.unter;
    zeilen = def ? (def.zeilen(u) || []) : [];
  }
  return zeilen.length;
}
function listeUnterEintraege(zst, z) {
  const ebene = zst.def.unter;
  if (!ebene) return [];
  const name = ebene.titel || 'Unterzeilen', e = [];
  if (z !== null && z !== undefined && (ebene.zeilen(z) || []).length) {
    e.push({ text: name + (listeUnterIstOffen(zst, z, '') ? ' ausblenden' : ' anzeigen'), aktion: () => listeUnterUmschalten(zst, z, '') });
  }
  e.push({ text: 'Alle ' + name + ' anzeigen', aus: !zst.sicht.length, aktion: () => {
    for (const r of zst.sicht) if ((ebene.zeilen(r) || []).length) listeUnterSatz(zst, r, true).add('');
    listeZeichnen(zst.id);
  } });
  e.push({ text: 'Alle ' + name + ' ausblenden', aus: !zst.unterOffen.size, aktion: () => { zst.unterOffen = new Map(); listeZeichnen(zst.id); } });
  return e;
}

function listeZelle(sp, z, woerter) {
  if (sp.zelle) return sp.zelle(z);
  return listeMarkiert(listeAnzeige(sp, sp.wert(z)), woerter);
}

/* Das Angezeigte als Zeilen mit ROHEN Werten (Zahlen bleiben Zahlen): erst die
   Gruppenspalten, dann die sichtbaren Spalten; Zeilen so gefiltert und sortiert
   wie angezeigt (auch die in eingeklappten Gruppen). */
function listeExportSpalten(zst) {
  const ord = listeOrdnung(zst);
  return zst.gruppen.map(g => ord.jeFeld.get(g.feld)).concat(ord.sichtbar);
}
function listeAlsZeilen(id) {
  const zst = LISTEN.get(id);
  if (!zst) return [];
  const sp = listeExportSpalten(zst);
  return [sp.map(s => s.titel)].concat(zst.sicht.map(z => sp.map(s => {
    const w = s.wert(z);
    return Array.isArray(w) ? w.join(', ') : (w === undefined || w === null ? '' : w);
  })));
}

/* CSV des Angezeigten: Gruppenspalten zuerst, dann die sichtbaren Spalten;
   Werte so, wie sie in der Zelle stehen (Dezimalkomma, kein Tausenderpunkt). */
function listeCsvBau(zst, nurAuswahl) {
  const sp = listeExportSpalten(zst);
  const zeilen = nurAuswahl ? zst.sicht.filter(z => zst.gewaehlt.has(listeWahlSchluessel(zst, z))) : zst.sicht;
  const text = [sp.map(c => c.titel)].concat(zeilen.map(z => sp.map(c => listeAnzeige(c, c.wert(z)))))
    .map(r => r.map(listeCsvFeld).join(';')).join('\r\n') + '\r\n';
  return { text, anzahl: zeilen.length };
}
function listeCsv(id, nurAuswahl) {
  const zst = LISTEN.get(id);
  return zst ? listeCsvBau(zst, nurAuswahl).text : '';
}
/* Legt text als CSV-Datei ab: <name>_JJJJ-MM-TT.csv, UTF-8 mit BOM (Excel liest es so richtig). */
function listeDateiSpeichern(zst, name, text, meldung) {
  const d = new Date(), zwei = (x) => String(x).padStart(2, '0');
  const datei = String(name).replace(/[^\wäöüÄÖÜß-]+/g, '_') + '_' + d.getFullYear() + '-' + zwei(d.getMonth() + 1) + '-' + zwei(d.getDate()) + '.csv';
  try {
    const url = URL.createObjectURL(new Blob(['\uFEFF' + text], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url; a.download = datei;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    listeMelden(zst, meldung + ': ' + datei);
  } catch (e) { listeMelden(zst, 'Speichern hat der Browser nicht erlaubt.'); }
}
function listeCsvSpeichern(id, nurAuswahl) {
  const zst = LISTEN.get(id);
  if (!zst) return;
  const c = listeCsvBau(zst, nurAuswahl);
  if (!c.anzahl) { listeMelden(zst, 'Keine Zeilen zum Speichern.'); return; }
  listeDateiSpeichern(zst, zst.def.id, c.text, listeFmt(c.anzahl) + ' Zeilen als CSV gespeichert');
}
function listeExportEintraege(zst) {
  const gewaehlt = zst.def.auswahl === false ? 0 : listeWahlAnzahl(zst, zst.sicht);
  return listeKreuzEintraege(zst, null).concat([{ text: 'Als CSV speichern (' + listeFmt(zst.sicht.length) + ' angezeigte Zeilen)', aus: !zst.sicht.length, aktion: () => listeCsvSpeichern(zst.id, false) }]
    , gewaehlt ? [{ text: 'Auswahl als CSV speichern (' + listeFmt(gewaehlt) + ')', aktion: () => listeCsvSpeichern(zst.id, true) }] : []);
}
function listeZeilenKopieren(zst) {
  const ord = listeOrdnung(zst);
  const sauber = (t) => String(t).replace(/[\t\r\n]+/g, ' ');
  const zeilen = zst.sicht.filter(r => zst.gewaehlt.has(listeWahlSchluessel(zst, r)));
  const text = [ord.sichtbar.map(c => sauber(c.titel)).join('\t')].concat(zeilen.map(r => ord.sichtbar.map(c => sauber(listeAnzeige(c, c.wert(r)))).join('\t'))).join('\r\n');
  const fehlen = zst.gewaehlt.size - zeilen.length;
  listeKopieren(zst, text, listeFmt(zeilen.length) + ' Zeilen mit Kopfzeile kopiert' + (fehlen ? ' (' + listeFmt(fehlen) + ' gewählte sind ausgefiltert und fehlen)' : ''));
}
/* Die Auswahl fuer die Fusszeile einer Spalte (Rechtsklick auf Kopf oder Fusszeile). */
function listeSummenEintraege(zst, feld) {
  const sp = listeOrdnung(zst).jeFeld.get(feld);
  if (!sp) return [];
  const jetzt = zst.summen[feld] || '';
  const setzen = (art) => () => { if (art) zst.summen[feld] = art; else delete zst.summen[feld]; listeNeu(zst); };
  return [{ text: 'Fußzeile „' + sp.titel + '“', aus: true }, '-', { text: (jetzt === '' ? '● ' : '○ ') + 'Keine', aktion: setzen('') }]
    .concat(LISTE_SUMMEN.filter(x => sp.zahl || x.id === 'anzahl').map(x => ({ text: (jetzt === x.id ? '● ' : '○ ') + x.text, aktion: setzen(x.id) })));
}

/* ---------- Kreuztabelle ---------- */

function listeKreuzEintraege(zst, feld) {
  return [{ text: 'Kreuztabelle …', aus: !zst.sicht.length, aktion: () => listeKreuzOeffnen(zst, feld) }];
}
/* feld (optional): diese Spalte kommt in die Zeilen. Sonst gilt die zuletzt gewaehlte
   Aufteilung, sonst die Gruppierung der Liste, sonst die erste Textspalte. */
function listeKreuzOeffnen(zst, feld) {
  const ord = listeOrdnung(zst), da = (f) => !!f && ord.jeFeld.has(f);
  const k = zst.kreuz && da(zst.kreuz.zeile) ? zst.kreuz : null;
  const ersteSumme = ord.spalten.find(sp => sp.zahl && zst.summen[sp.feld] && zst.summen[sp.feld] !== 'anzahl');
  const text = ord.spalten.find(sp => !sp.zahl) || ord.spalten[0];
  const zeile = da(feld) ? feld : k ? k.zeile : zst.gruppen.length ? zst.gruppen[0].feld : text.feld;
  let spalte = k && da(k.spalte) ? k.spalte : zst.gruppen.length > 1 ? zst.gruppen[1].feld : '';
  if (spalte === zeile) spalte = '';
  zst.kreuz = { zeile, spalte, wert: k ? (da(k.wert) ? k.wert : '') : ersteSumme ? ersteSumme.feld : '', art: k ? k.art : ersteSumme ? zst.summen[ersteSumme.feld] : 'summe' };
  listePopup(zst, 'dialog', null, '<div class="liste-dialog liste-editor liste-kreuz" role="dialog" aria-modal="true" aria-label="Kreuztabelle"></div>');
  zst.popup.kreuz = true;
  listeKreuzZeichnen(zst, '[data-kz="zeile"]');
}
function listeKreuzZeichnen(zst, fokus) {
  const k = zst.kreuz, ord = listeOrdnung(zst);
  const spZ = ord.jeFeld.get(k.zeile), spS = k.spalte ? ord.jeFeld.get(k.spalte) : null, spW = k.wert ? ord.jeFeld.get(k.wert) : null;
  const nachTitel = ord.spalten.slice().sort((a, b) => LISTE_ORDNER.compare(a.titel, b.titel));
  const wahl = (name, jetzt, liste, titel) => '<label>' + titel + '<select class="eingabefeld" data-kz="' + name + '">'
    + liste.map(([wert, text]) => '<option value="' + listeEsc(wert) + '"' + (wert === jetzt ? ' selected' : '') + '>' + listeEsc(text) + '</option>').join('') + '</select></label>';
  const d = listeKreuzRechnen(zst.sicht, spZ, spS);
  const zuViele = d.spalten.length > 30;                    /* mehr Spalten liest niemand mehr quer */
  const zelle = (zeilen, i, j, klasse) => {
    const text = listeKreuzText(zeilen, spW, k.art);
    return '<td class="zahl' + (klasse ? ' ' + klasse : '') + '"' + (zeilen.length ? ' data-kz-feld data-i="' + i + '" data-j="' + j + '" title="' + listeFmt(zeilen.length)
      + (zeilen.length === 1 ? ' Zeile' : ' Zeilen') + ' — Klick: in der Liste zeigen"' : '') + '>' + listeEsc(text) + '</td>';
  };
  const leer = (t) => t === '' ? '(leer)' : listeEsc(t);
  const tabelle = zuViele
    ? '<p class="meldung-klein">„' + listeEsc(spS.titel) + '“ hat ' + listeFmt(d.spalten.length) + ' verschiedene Werte — zu viele für die Spalten der Kreuztabelle. Bitte eine andere Spalte wählen oder die beiden tauschen.</p>'
    : '<div class="liste-kz-rahmen"><table class="liste-kz-tabelle"><thead><tr><th>' + listeEsc(spZ.titel) + (spS ? ' \\ ' + listeEsc(spS.titel) : '') + '</th>'
      + d.spalten.map(c => '<th class="zahl">' + leer(c.text) + '</th>').join('') + '<th class="zahl liste-kz-gesamt">Gesamt</th></tr></thead><tbody>'
      + d.zeilen.map((r, i) => '<tr><th>' + leer(r.text) + '</th>' + d.spalten.map((c, j) => zelle(d.feld(i, j), i, j, '')).join('') + zelle(r.alle, i, -1, 'liste-kz-gesamt') + '</tr>').join('')
      + '</tbody><tfoot><tr><th>Gesamt</th>' + d.spalten.map((c, j) => zelle(c.alle, -1, j, '')).join('') + zelle(zst.sicht, -1, -1, 'liste-kz-gesamt') + '</tr></tfoot></table></div>';
  const gefiltert = zst.sicht.length < zst._alle.length;
  zst.popup.daten = d;
  zst.popup.el.querySelector('.liste-kreuz').innerHTML = '<div class="liste-ed-kopf"><h3>Kreuztabelle</h3><span class="liste-ed-zahl">aus <b>' + listeFmt(zst.sicht.length) + '</b> '
    + (gefiltert ? 'angezeigten von ' + listeFmt(zst._alle.length) + ' Zeilen (Filter oder Suche wirken)' : 'Zeilen') + '</span></div>'
    + '<div class="liste-ed-rumpf"><div class="liste-kz-wahl">'
    + wahl('zeile', k.zeile, nachTitel.map(sp => [sp.feld, sp.titel]), 'Zeilen')
    + wahl('spalte', k.spalte, [['', '(keine — nur Gesamt)']].concat(nachTitel.filter(sp => sp.feld !== k.zeile).map(sp => [sp.feld, sp.titel])), 'Spalten')
    + wahl('wert', k.wert, [['', 'Anzahl Zeilen']].concat(nachTitel.filter(sp => sp.zahl).map(sp => [sp.feld, sp.titel])), 'In den Feldern')
    + (spW ? wahl('art', k.art, LISTE_SUMMEN.filter(x => x.id !== 'anzahl').map(x => [x.id, x.text]), 'Rechnung') : '')
    + '</div>' + tabelle + '</div>'
    + '<div class="liste-dialog-knoepfe"><button type="button" class="schaltflaeche" data-kz="csv"' + (zuViele ? ' disabled' : '') + '>Als CSV speichern</button>'
    + '<button type="button" class="schaltflaeche" data-kz="kopieren" title="In die Zwischenablage, zum Einfügen in Excel (Strg+C)"' + (zuViele ? ' disabled' : '') + '>Kopieren</button><span></span>'
    + '<button type="button" class="schaltflaeche schaltflaeche-haupt" data-kz="zu">Schließen</button></div>';
  const ziel = fokus ? zst.popup.el.querySelector(fokus) : null;
  if (ziel) ziel.focus();
}
/* Klick auf ein Feld: genau diese Zeilen in der Liste zeigen (Filter auf die beiden Werte). */
function listeKreuzZeigen(zst, i, j) {
  const k = zst.kreuz, d = zst.popup.daten;
  if (i >= 0) zst.filter[k.zeile] = { werte: [d.zeilen[i].text] };
  if (j >= 0) zst.filter[k.spalte] = { werte: [d.spalten[j].text] };
  zst.filterAn = true; zst.stueck = 0;
  listePopupZu(zst);
  listeZeichnen(zst.id);
}
/* Die Kreuztabelle als Zeilen von Texten: Kopf, Reihen, Gesamt. BEWUSST mit reinen
   Zahlen (Anwender 2026-11-10: Einheit weglassen) — "453,4 m" liest Excel als Text.
   Was gerechnet wurde und in welcher Einheit, steht dafuer im ersten Feld. */
function listeKreuzZeilen(zst) {
  const k = zst.kreuz, d = zst.popup.daten, ord = listeOrdnung(zst);
  const spZ = ord.jeFeld.get(k.zeile), spS = k.spalte ? ord.jeFeld.get(k.spalte) : null, spW = k.wert ? ord.jeFeld.get(k.wert) : null;
  const leer = (t) => t === '' ? '(leer)' : t, w = (zeilen) => listeKreuzText(zeilen, spW, k.art, true);
  const art = LISTE_SUMMEN.find(x => x.id === k.art);
  const was = spW ? art.text + ' ' + spW.titel + (k.art === 'summe' && spW.summeWert && spW.summeEinheit ? ' in ' + spW.summeEinheit : '') : 'Anzahl Zeilen';
  return [[spZ.titel + (spS ? ' \\ ' + spS.titel : '') + ' [' + was + ']'].concat(d.spalten.map(c => leer(c.text)), ['Gesamt'])]
    .concat(d.zeilen.map((r, i) => [leer(r.text)].concat(d.spalten.map((c, j) => w(d.feld(i, j))), [w(r.alle)])))
    .concat([['Gesamt'].concat(d.spalten.map(c => w(c.alle)), [w(zst.sicht)])]);
}
function listeKreuzCsv(zst) { return listeKreuzZeilen(zst).map(r => r.map(listeCsvFeld).join(';')).join('\r\n') + '\r\n'; }
/* In die Zwischenablage, mit Tabulatoren getrennt: laesst sich in Excel als Tabelle einfuegen. */
function listeKreuzKopieren(zst) {
  const zeilen = listeKreuzZeilen(zst);
  listeKopieren(zst, zeilen.map(r => r.map(t => String(t).replace(/[\t\r\n]+/g, ' ')).join('\t')).join('\r\n'),
    'Kreuztabelle kopiert (' + listeFmt(zeilen.length - 2) + (zeilen.length - 2 === 1 ? ' Reihe' : ' Reihen') + ' mit Kopf und Gesamt)');
}

/* ---------- Bedienung: Sortieren, Gruppen, Spalten ---------- */

/* vonVorn: Sortierung/Gruppen geaendert — wieder das erste Stueck, Rollstand oben. */
function listeNeu(zst, vonVorn) { if (vonVorn) zst.stueck = 0; listeSpeichern(zst); listeZeichnen(zst.id); }

/* Klick: diese Spalte allein (nochmal = umdrehen); Umschalt+Klick: dazu. */
function listeSortieren(id, feld, zusatz) {
  const zst = LISTEN.get(id);
  if (!zst) return;
  const i = zst.sort.findIndex(s => s.feld === feld);
  if (zusatz) {
    if (i >= 0) zst.sort[i].ab = !zst.sort[i].ab;
    else zst.sort.push({ feld, ab: false });
  } else if (i === 0 && zst.sort.length === 1) zst.sort[0].ab = !zst.sort[0].ab;
  else zst.sort = [{ feld, ab: i === 0 ? !zst.sort[0].ab : false }];
  listeNeu(zst, true);
}

function listeFeldZeigen(zst, an) { zst.feldAus = !an; listeNeu(zst); }

function listeGruppeSetzen(zst, feld, index) {
  const alt = zst.gruppen.find(g => g.feld === feld);
  const altIndex = zst.gruppen.indexOf(alt);
  if (alt) { zst.gruppen.splice(altIndex, 1); if (index !== undefined && altIndex < index) index--; }
  zst.gruppen.splice(index === undefined ? zst.gruppen.length : index, 0, alt || { feld, ab: false });
  zst.offen = new Set();   /* Pfade haengen an der Ebenenfolge */
  listeNeu(zst, true);
}
function listeGruppeEntfernen(zst, feld) {
  zst.gruppen = zst.gruppen.filter(g => g.feld !== feld);
  zst.offen = new Set();
  listeNeu(zst, true);
}
/* Spalte vor vorFeld setzen (null = ans Ende). Vor eine feste Spalte gesetzt
   wird sie selbst fest, sonst verliert sie die Fixierung — ausser eine feste
   Spalte landet direkt hinter dem festen Bereich: dann wird sie dessen letzte. */
function listeSpalteSetzen(zst, feld, vorFeld) {
  const ord = listeOrdnung(zst);
  const letzteFeste = ord.festZahl ? ord.sichtbar[ord.festZahl - 1].feld : null;
  const ersteFreie = ord.sichtbar[ord.festZahl] ? ord.sichtbar[ord.festZahl].feld : null;
  const ansEnde = zst.fest.has(feld) && !!vorFeld && vorFeld === ersteFreie;
  if (ansEnde && letzteFeste === feld) return;              /* steht schon dort */
  zst.gruppen = zst.gruppen.filter(g => g.feld !== feld);
  zst.aus.delete(feld);
  zst.reihenfolge = zst.reihenfolge.filter(f => f !== feld);
  if (ansEnde) zst.reihenfolge.splice(zst.reihenfolge.indexOf(letzteFeste) + 1, 0, feld);
  else {
    const i = vorFeld ? zst.reihenfolge.indexOf(vorFeld) : -1;
    zst.reihenfolge.splice(i < 0 ? zst.reihenfolge.length : i, 0, feld);
    if (vorFeld && zst.fest.has(vorFeld) && (zst.fest.has(feld) || zst.fest.size < LISTE_FEST_MAX)) zst.fest.add(feld); else zst.fest.delete(feld);
  }
  listeNeu(zst);
}
function listeSpalteAusblenden(zst, feld) {
  const ord = listeOrdnung(zst);
  if (ord.sichtbar.length <= 1 && ord.sichtbar[0] && ord.sichtbar[0].feld === feld) return;   /* letzte Spalte bleibt */
  zst.gruppen = zst.gruppen.filter(g => g.feld !== feld);
  zst.aus.add(feld);
  listeNeu(zst);
}

function listeOptimaleBreite(zst, feld) {
  const sp = listeOrdnung(zst).jeFeld.get(feld);
  const zelle = zst.wurzel.querySelector('.liste-tabelle td:not([colspan])') || zst.wurzel.querySelector('.liste-tabelle th');
  if (!sp || !zelle) return;
  const stil = getComputedStyle(zelle);
  const ctx = (listeOptimaleBreite._flaeche || (listeOptimaleBreite._flaeche = document.createElement('canvas'))).getContext('2d');
  ctx.font = stil.fontWeight + ' ' + stil.fontSize + ' ' + stil.fontFamily;
  let b = ctx.measureText(sp.titel).width * 1.08 + 50;
  const n = Math.min(zst.sicht.length, 3000);
  for (let i = 0; i < n; i++) b = Math.max(b, ctx.measureText(listeAnzeige(sp, sp.wert(zst.sicht[i]))).width + 22);
  zst.breiten[feld] = Math.round(Math.min(600, Math.max(48, b)));
}

function listeZuruecksetzen(id) {
  const zst = LISTEN.get(id);
  if (!zst) return;
  listeVorgabe(zst);
  zst.filter = {}; zst.filterAn = true; zst.nurAuswahl = false; zst.text = ''; zst.stueck = 0;
  const such = listeTeil(zst, 'liste-suche');
  if (such) such.value = '';
  listeNeu(zst);
}

function listeFilterLeeren(id) {
  const zst = LISTEN.get(id);
  if (!zst) return;
  zst.filter = {}; zst.filterAn = true; zst.nurAuswahl = false; zst.stueck = 0;
  listeZeichnen(id);
}

/* ---------- Schwebende Teile: Menue, Werteliste, Dialog, Spaltenauswahl ---------- */

function listePopupZu(zst) {
  if (zst.popup) { zst.popup.el.remove(); zst.popup = null; }
}

function listePopup(zst, art, feld, html, x, y) {
  listePopupZu(zst);
  const el = document.createElement('div');
  el.className = art === 'dialog' ? 'liste-dialog-huelle' : 'liste-popup liste-' + art;
  el.innerHTML = html;
  listeTeil(zst, 'schwebend').appendChild(el);
  zst.popup = { art, feld, el };
  if (art !== 'dialog') {
    const r = el.getBoundingClientRect();
    el.style.left = Math.max(4, Math.min(x, window.innerWidth - r.width - 8)) + 'px';
    el.style.top = Math.max(4, Math.min(y, window.innerHeight - r.height - 8)) + 'px';
  }
  return el;
}

function listeMenue(zst, feld, x, y, istMarke) {
  const ord = listeOrdnung(zst);
  const sp = ord.jeFeld.get(feld);
  if (!sp) return;
  const p = (aktion, text, aus) => '<button type="button" role="menuitem" data-menue="' + aktion + '"' + (aus ? ' disabled' : '') + '>' + text + '</button>';
  const strich = '<hr>';
  const sortiert = zst.sort.some(s => s.feld === feld);
  listePopup(zst, 'menue', feld, '<div role="menu" aria-label="' + listeEsc(sp.titel) + '">'
    + (istMarke
      ? p('gruppeAuf', 'Gruppierung aufheben') + p('aufklappen', 'Alle Gruppen aufklappen') + p('zuklappen', 'Alle Gruppen zuklappen')
      : p('auf', 'Aufsteigend sortieren') + p('ab', 'Absteigend sortieren') + p('sortLoeschen', 'Sortierung löschen', !sortiert && !zst.sort.length)
        + strich + p('gruppieren', 'Nach dieser Spalte gruppieren')
        + p('feld', zst.feldAus ? 'Gruppierfeld einblenden' : 'Gruppierfeld ausblenden', !!zst.gruppen.length)
        + strich + p('filtern', 'Filtern …') + p('filterWeg', 'Filter dieser Spalte löschen', !zst.filter[feld])
        + strich + p('ausblenden', 'Diese Spalte ausblenden', ord.sichtbar.length <= 1) + p('auswahl', 'Spaltenauswahl …')
        + p('fest', zst.fest.has(feld) ? 'Fixierung lösen' : 'Spalte links fixieren') + p('festAlle', 'Alle Fixierungen lösen', !zst.fest.size)
        + strich + p('summe', 'Fußzeile: Summe …') + p('kreuz', 'Kreuztabelle nach dieser Spalte …', !zst.sicht.length)
        + (typeof sp.setzen === 'function' && listeAenderAktiv(zst.def)
          ? p('massen', 'Werte ändern … (' + (listeGewaehlteSicht(zst).length > 1 ? listeFmt(listeGewaehlteSicht(zst).length) + ' gewählte' : listeFmt(zst.sicht.length) + ' angezeigte') + ' Zeilen)', !zst.sicht.length) : '')
        + strich + p('breite', 'Optimale Breite') + p('breiteAlle', 'Optimale Breite (alle Spalten)')
        + strich + p('standard', 'Standard wiederherstellen'))
    + '</div>', x, y);
}

function listeMenueAktion(zst, aktion, feld) {
  const ort = zst.popup ? zst.popup.el.getBoundingClientRect() : { left: 40, top: 40 };
  listePopupZu(zst);
  switch (aktion) {
    case 'fest':
      if (zst.fest.has(feld)) zst.fest.delete(feld);
      else if (zst.fest.size >= LISTE_FEST_MAX) { listeMelden(zst, 'Höchstens ' + LISTE_FEST_MAX + ' Spalten lassen sich fixieren.'); return; }
      else zst.fest.add(feld);
      break;
    case 'festAlle': zst.fest = new Set(); break;
    case 'summe': listeMenueFrei(zst, listeSummenEintraege(zst, feld), ort.left, ort.top); return;
    case 'kreuz': listeKreuzOeffnen(zst, feld); return;
    case 'massen': {
      const gew = listeGewaehlteSicht(zst);
      listeMassenOeffnen(zst, gew.length > 1 ? gew : zst.sicht, gew.length > 1 ? 'gewählte Zeilen' : 'angezeigte Zeilen', feld);
      return;
    }
    case 'auf': zst.sort = [{ feld, ab: false }]; zst.stueck = 0; break;
    case 'ab': zst.sort = [{ feld, ab: true }]; zst.stueck = 0; break;
    case 'sortLoeschen': zst.sort = []; zst.stueck = 0; break;
    case 'gruppieren': listeGruppeSetzen(zst, feld); return;
    case 'gruppeAuf': listeGruppeEntfernen(zst, feld); return;
    case 'feld': listeFeldZeigen(zst, zst.feldAus); return;
    case 'filtern': listeEditorOeffnen(zst, feld); return;
    case 'filterWeg': delete zst.filter[feld]; zst.stueck = 0; break;
    case 'ausblenden': listeSpalteAusblenden(zst, feld); return;
    case 'auswahl': zst.auswahlOffen = true; listeTeil(zst, 'auswahl').hidden = false; break;
    case 'breite': listeOptimaleBreite(zst, feld); break;
    case 'breiteAlle': for (const sp of listeOrdnung(zst).sichtbar) listeOptimaleBreite(zst, sp.feld); break;
    case 'standard': listeZuruecksetzen(zst.id); return;
    case 'aufklappen': case 'zuklappen': listeAktion(zst, aktion); return;
  }
  listeNeu(zst);
}

function listeAktion(zst, aktion) {
  if (aktion === 'aufklappen') { zst.offen = new Set(zst._alleSchluessel); zst.stueck = 0; }
  else if (aktion === 'zuklappen') { zst.offen = new Set(); zst.stueck = 0; }
  else if (aktion === 'alleZeigen') { listeNachzeichnen(zst, true); return; }
  else if (aktion === 'feldEin') { listeFeldZeigen(zst, true); return; }
  else if (aktion === 'wahlLeeren') { zst.gewaehlt = new Set(); listeAuswahlGeaendert(zst); return; }
  else if (aktion === 'wahlUmkehren') { listeAuswahlUmkehren(zst); return; }
  else if (aktion === 'spaltenauswahl') { zst.auswahlOffen = !zst.auswahlOffen; listeTeil(zst, 'auswahl').hidden = !zst.auswahlOffen; }
  listeZeichnen(zst.id);
}

function listeAuswahlZeichnen(zst, ord) {
  const el = listeTeil(zst, 'auswahl');
  const baum = ord.spalten.some(sp => listeSpaltenPfad(sp).length);
  el.classList.toggle('liste-auswahl-baum', baum);
  const kopf = '<div class="liste-auswahl-kopf"><b>Spaltenauswahl</b>'
    + '<button type="button" class="liste-marke-weg" data-liste-aktion="spaltenauswahl" title="Schließen" aria-label="Spaltenauswahl schließen">✕</button></div>';
  if (!baum) {
    el.innerHTML = kopf
      + (ord.versteckt.length
        ? '<p class="meldung-klein">Klicken oder in die Kopfzeile ziehen, um einzublenden.</p>'
          + ord.versteckt.slice().sort((a, b) => LISTE_ORDNER.compare(a.titel, b.titel)).map(sp =>
            '<button type="button" class="liste-auswahl-feld" data-auswahl-feld="' + listeEsc(sp.feld) + '">' + listeEsc(sp.titel) + '</button>').join('')
        : '<p class="meldung-klein">Alle Spalten sind eingeblendet. Zum Ausblenden einen Spaltenkopf hierher ziehen.</p>');
    return;
  }
  /* Baum: Kopf und Suchfeld nur EINMAL schreiben (das Suchfeld behaelt den Fokus) */
  if (!el.querySelector('[data-auswahl-baum]')) {
    el.innerHTML = kopf
      + '<input class="eingabefeld liste-auswahl-suche" type="search" data-auswahl-suche placeholder="Spalte suchen …" aria-label="Spalte suchen"'
      + ' title="Sucht in Spaltenname, Erklärung und Gruppe; alle Wörter müssen vorkommen">'
      + '<p class="meldung-klein">Klick blendet ein oder aus · ziehen setzt die Spalte an eine Stelle der Kopfzeile.</p>'
      + '<div class="liste-baum" data-auswahl-baum role="tree" aria-label="Spalten"></div>';
    el.querySelector('[data-auswahl-suche]').value = zst.auswahlSuche;
  }
  el.querySelector('[data-auswahl-baum]').innerHTML = listeAuswahlBaumHtml(zst, ord);
}

/* Ort einer Spalte im Baum der Spaltenauswahl: ['Bauteil', 'Maße'] (leer = oberste Ebene). */
function listeSpaltenPfad(sp) {
  const g = sp && sp.gruppe;
  if (!g) return [];
  return (Array.isArray(g) ? g : String(g).split('›')).map(x => String(x).trim()).filter(Boolean);
}

/* Baum aus den Spalten bauen — Reihenfolge der Spalten-Definition (das Werkzeug
   legt die logische Ordnung fest), Gruppen in der Reihenfolge ihres ersten
   Auftretens. Headless pruefbar. */
function listeSpaltenBaum(spalten) {
  const wurzel = { name: '', pfad: [], gruppen: [], spalten: [] };
  const jePfad = new Map([['', wurzel]]);
  for (const sp of spalten) {
    let k = wurzel;
    const pfad = listeSpaltenPfad(sp);
    pfad.forEach((teil, i) => {
      const schluessel = pfad.slice(0, i + 1).join(' › ');
      let n = jePfad.get(schluessel);
      if (!n) { n = { name: teil, pfad: pfad.slice(0, i + 1), schluessel, gruppen: [], spalten: [] }; jePfad.set(schluessel, n); k.gruppen.push(n); }
      k = n;
    });
    k.spalten.push(sp);
  }
  return wurzel;
}
function listeBaumSpalten(knoten) { return knoten.spalten.concat(...knoten.gruppen.map(listeBaumSpalten)); }

function listeAuswahlStand(ord, feld) {
  if (ord.sichtbar.some(s => s.feld === feld)) return 'an';
  if (ord.versteckt.some(s => s.feld === feld)) return 'aus';
  return 'gruppiert';
}

function listeAuswahlBaumHtml(zst, ord) {
  const woerter = listeNorm(zst.auswahlSuche).split(/\s+/).filter(Boolean);
  const passt = (sp) => !woerter.length || (() => {
    const t = listeNorm([sp.titel, sp.hilfe || '', listeSpaltenPfad(sp).join(' '), sp.feld, sp.eigenschaft || ''].join(' '));
    return woerter.every(w => t.includes(w));
  })();
  const stand = new Map(ord.spalten.map(sp => [sp.feld, listeAuswahlStand(ord, sp.feld)]));
  const wurzel = listeSpaltenBaum(ord.spalten);
  zst._baumKnoten = [];
  const alleKnoten = (k) => { for (const g of k.gruppen) { zst._baumKnoten.push(g); alleKnoten(g); } };
  alleKnoten(wurzel);
  const blatt = (sp, tiefe) => {
    const st = stand.get(sp.feld);
    return '<button type="button" class="liste-baum-spalte" role="treeitem" data-auswahl-feld="' + listeEsc(sp.feld) + '" data-auswahl-stand="' + st + '"'
      + ' aria-checked="' + (st === 'an') + '" style="--tiefe:' + tiefe + '"'
      + ' title="' + listeEsc((sp.hilfe ? sp.hilfe + ' — ' : '') + (st === 'an' ? 'Klick: ausblenden' : st === 'aus' ? 'Klick: einblenden (hinten)' : 'steht im Gruppierfeld')) + '">'
      + '<span class="liste-baum-haken" aria-hidden="true">' + (st === 'an' ? '☑' : st === 'aus' ? '☐' : '⧉') + '</span>'
      + '<span class="liste-baum-titel">' + listeMarkiert(sp.titel, woerter) + '</span></button>';
  };
  const knoten = (g, tiefe) => {
    const alle = listeBaumSpalten(g);
    const treffer = alle.filter(passt);
    if (woerter.length && !treffer.length) return '';
    const an = alle.filter(sp => stand.get(sp.feld) === 'an').length;
    const offen = woerter.length > 0 || zst.auswahlAuf.has(g.schluessel);
    const nr = zst._baumKnoten.indexOf(g);
    const schaltbar = alle.filter(sp => stand.get(sp.feld) !== 'gruppiert').length;
    return '<div class="liste-baum-knoten" role="treeitem" aria-expanded="' + offen + '">'
      + '<div class="liste-baum-gruppe" style="--tiefe:' + tiefe + '">'
      + '<button type="button" class="liste-baum-auf" data-auswahl-auf="' + nr + '" aria-expanded="' + offen + '" title="' + (offen ? 'zuklappen' : 'aufklappen') + '">'
      + '<span class="liste-baum-pfeil" aria-hidden="true">' + (offen ? '▾' : '▸') + '</span>'
      + '<span class="liste-baum-name">' + listeMarkiert(g.name, woerter) + '</span>'
      + '<span class="liste-anzahl" title="sichtbar / Spalten in der Gruppe">' + an + '/' + alle.length + '</span></button>'
      + (schaltbar ? '<button type="button" class="liste-baum-alle" data-auswahl-alle="' + nr + '" title="' + (an === alle.length ? 'ganze Gruppe ausblenden' : 'ganze Gruppe einblenden') + '"'
        + ' aria-label="' + listeEsc(g.name) + ': ' + (an === alle.length ? 'alle ausblenden' : 'alle einblenden') + '">' + (an === alle.length ? '☑' : an ? '▣' : '☐') + '</button>' : '')
      + '</div>'
      + (offen ? '<div role="group">' + g.spalten.filter(passt).map(sp => blatt(sp, tiefe + 1)).join('') + g.gruppen.map(x => knoten(x, tiefe + 1)).join('') + '</div>' : '')
      + '</div>';
  };
  const html = wurzel.spalten.filter(passt).map(sp => blatt(sp, 0)).join('') + wurzel.gruppen.map(g => knoten(g, 0)).join('');
  return html || '<p class="meldung-klein">Keine Spalte passt zur Suche.</p>';
}

function listeAuswahlBaumZeichnen(zst) {
  const baum = listeTeil(zst, 'auswahl').querySelector('[data-auswahl-baum]');
  if (baum) baum.innerHTML = listeAuswahlBaumHtml(zst, listeOrdnung(zst));
}

/* Klick auf eine Spalte in der Spaltenauswahl: einblenden (hinten) oder, im
   Baum, eine sichtbare ausblenden. Gruppierte bleiben im Gruppierfeld. */
function listeAuswahlKlick(zst, feld) {
  const ord = listeOrdnung(zst), st = listeAuswahlStand(ord, feld);
  if (st === 'aus') listeSpalteSetzen(zst, feld, null);
  else if (st === 'an') {
    if (ord.sichtbar.length <= 1) { listeMelden(zst, 'Die letzte sichtbare Spalte bleibt stehen.'); return; }
    listeSpalteAusblenden(zst, feld);
  } else listeMelden(zst, '„' + ord.jeFeld.get(feld).titel + '“ steht im Gruppierfeld — dort herausziehen, um sie als Spalte zu zeigen.');
  const knopf = listeTeil(zst, 'auswahl').querySelector('[data-auswahl-feld="' + CSS.escape(feld) + '"]');
  if (knopf) knopf.focus({ preventScroll: true });
}

/* Ganze Gruppe: sind alle sichtbar, werden alle ausgeblendet (die letzte
   sichtbare Spalte der Liste bleibt); sonst werden die ausgeblendeten hinten
   angefuegt, in der Reihenfolge des Baums. */
function listeAuswahlGruppe(zst, nr) {
  const g = zst._baumKnoten[nr];
  if (!g) return;
  const ord = listeOrdnung(zst);
  const felder = listeBaumSpalten(g).map(sp => sp.feld).filter(f => listeAuswahlStand(ord, f) !== 'gruppiert');
  const aus = felder.filter(f => listeAuswahlStand(ord, f) === 'aus');
  if (aus.length) {
    for (const f of aus) { zst.reihenfolge = zst.reihenfolge.filter(x => x !== f); zst.reihenfolge.push(f); zst.aus.delete(f); zst.fest.delete(f); }
  } else {
    let rest = ord.sichtbar.length;
    for (const f of felder) { if (rest <= 1) { listeMelden(zst, 'Die letzte sichtbare Spalte bleibt stehen.'); break; } zst.aus.add(f); rest--; }
  }
  listeNeu(zst);
  const knopf = listeTeil(zst, 'auswahl').querySelector('[data-auswahl-alle="' + nr + '"]');
  if (knopf) knopf.focus({ preventScroll: true });
}

/* Werteliste unter dem Trichter. Angeboten wird, was nach Suche und den Filtern
   der ANDEREN Spalten uebrig ist — mit Anzahl. */
function listeAufklappOeffnen(zst, feld, anker) {
  if (zst.popup && zst.popup.art === 'aufklapp' && zst.popup.feld === feld) { listePopupZu(zst); return; }
  const ord = listeOrdnung(zst);
  const sp = ord.jeFeld.get(feld);
  if (!sp) return;
  const basis = listeGefiltert(zst, ord, zst.def.zeilen() || [], feld);
  const zaehler = new Map();
  for (const z of basis) {
    const w = sp.wert(z), t = listeAnzeige(sp, w);
    const e = zaehler.get(t);
    if (e) e.n++; else zaehler.set(t, { text: t, wert: w, n: 1 });
  }
  const f = zst.filter[feld];
  if (f && f.werte) for (const t of f.werte) if (!zaehler.has(t)) zaehler.set(t, { text: t, wert: t, n: 0 });   /* gewaehlt, aber gerade ohne Treffer */
  const werte = [...zaehler.values()].sort((a, b) => {
    const la = a.text === '', lb = b.text === '';
    if (la || lb) return la === lb ? 0 : (la ? 1 : -1);
    return listeWertVergleich(a.wert, b.wert);
  });
  zst._werte = werte.map(w => w.text);
  const gewaehlt = new Set(f && f.werte ? f.werte : []);
  const r = anker.getBoundingClientRect();
  const el = listePopup(zst, 'aufklapp', feld,
    (werte.length > 10 ? '<input class="eingabefeld" type="search" data-werte-suche placeholder="Werte suchen …" aria-label="Werte suchen">' : '')
    + '<button type="button" data-filter-knopf="alle">(Alle)</button>'
    + '<button type="button" data-filter-knopf="eigen">Benutzerdefiniert …' + (f && f.bed && f.bed.length ? ' ✓' : '') + '</button>'
    + '<div class="liste-werte">' + werte.map((w, i) => '<label><input type="checkbox" data-wert="' + i + '"' + (gewaehlt.has(w.text) ? ' checked' : '') + '>'
      + '<span>' + (w.text === '' ? '(leer)' : listeEsc(w.text)) + '</span><span class="liste-anzahl">' + listeFmt(w.n) + '</span></label>').join('') + '</div>',
    r.left, r.bottom + 2);
  const such = el.querySelector('[data-werte-suche]');
  if (such) such.focus();
}

/* ---------- Filter bearbeiten: alle aktiven Filter in einem Fenster ---------- */

function listeEditorVorgabe(sp) { return { op: sp.zahl ? 'gleich' : 'enthaelt', wert: '' }; }

/* feld (optional): die Spalte, um die es gerade geht — sie bekommt bei Bedarf
   eine leere Bedingung und den Fokus. */
function listeEditorOeffnen(zst, feld) {
  const ord = listeOrdnung(zst);
  const entwurf = {};
  for (const f of Object.keys(zst.filter)) {
    const q = zst.filter[f];
    entwurf[f] = { werte: q.werte ? q.werte.slice() : null, bed: (q.bed || []).map(x => ({ op: x.op, wert: x.wert })), oder: !!q.oder };
  }
  if (feld && ord.jeFeld.has(feld) && !entwurf[feld]) entwurf[feld] = { werte: null, bed: [listeEditorVorgabe(ord.jeFeld.get(feld))], oder: false };
  listePopup(zst, 'dialog', feld || null, '<div class="liste-dialog liste-editor" role="dialog" aria-modal="true" aria-label="Filter bearbeiten"></div>');
  zst.popup.entwurf = entwurf;
  listeEditorZeichnen(zst, feld ? '[data-ed-feld="' + CSS.escape(feld) + '"] [data-ed-wert], [data-ed-feld="' + CSS.escape(feld) + '"] [data-ed-wert-neu]' : '[data-ed-wert], [data-ed-wert-neu], [data-ed-spalte]');
}

/* Der Entwurf ohne Unfertiges: Bedingungen ohne Wert und leere Wertelisten zaehlen nicht. */
function listeEditorErgebnis(entwurf) {
  const filter = {};
  let unfertig = 0;
  for (const f of Object.keys(entwurf)) {
    const e = entwurf[f];
    const bed = e.bed.filter(x => {
      const v = LISTE_VERGLEICHE.find(y => y.id === x.op);
      const ok = !!v && (v.ohneWert || String(x.wert).trim() !== '');
      if (!ok) unfertig++;
      return ok;
    }).map(x => ({ op: x.op, wert: LISTE_VERGLEICHE.find(y => y.id === x.op).ohneWert ? '' : String(x.wert).trim() }));
    const werte = e.werte && e.werte.length ? e.werte.slice() : null;
    if (e.werte && !e.werte.length) unfertig++;
    if (!bed.length && !werte) continue;
    filter[f] = {};
    if (werte) filter[f].werte = werte;
    if (bed.length) { filter[f].bed = bed; filter[f].oder = e.oder && bed.length > 1; }
  }
  return { filter, unfertig };
}

function listeEditorZahl(zst) {
  const el = zst.popup.el.querySelector('[data-ed-zahl]');
  if (!el) return;
  const ord = listeOrdnung(zst), alle = zst.def.zeilen() || [];
  const erg = listeEditorErgebnis(zst.popup.entwurf);
  el.innerHTML = '<b>' + listeFmt(listeGefiltert(zst, ord, alle, null, erg.filter).length) + '</b> von ' + listeFmt(alle.length) + ' Zeilen passen'
    + (erg.unfertig ? ' · ' + erg.unfertig + (erg.unfertig === 1 ? ' unfertige Angabe zählt' : ' unfertige Angaben zählen') + ' nicht mit' : '');
}

/* Baut das Fenster neu (nur bei Aenderungen am Aufbau — beim Tippen bleibt es stehen). */
function listeEditorZeichnen(zst, fokus) {
  const ord = listeOrdnung(zst), entwurf = zst.popup.entwurf;
  const alle = zst.def.zeilen() || [];
  const felder = Object.keys(entwurf).filter(f => ord.jeFeld.has(f));
  const karten = felder.map((f, nr) => {
    const sp = ord.jeFeld.get(f), e = entwurf[f];
    const vorhanden = new Set();
    for (const z of alle) { vorhanden.add(listeAnzeige(sp, sp.wert(z))); if (vorhanden.size > 400) break; }
    const liste = 'listeEd_' + zst.id + '_' + nr;
    const name = 'listeEdOder_' + zst.id + '_' + nr;
    return (nr ? '<div class="liste-ed-und"><span>UND</span></div>' : '')
      + '<section class="liste-ed-karte" data-ed-feld="' + listeEsc(f) + '">'
      + '<header><b>' + listeEsc(sp.titel) + '</b>'
      + (e.bed.length > 1 ? '<span class="liste-ed-schalter" role="radiogroup" aria-label="Verknüpfung der Bedingungen">'
        + '<label><input type="radio" name="' + listeEsc(name) + '" data-ed-oder value="und"' + (e.oder ? '' : ' checked') + '><span>alle (UND)</span></label>'
        + '<label><input type="radio" name="' + listeEsc(name) + '" data-ed-oder value="oder"' + (e.oder ? ' checked' : '') + '><span>mindestens eine (ODER)</span></label></span>' : '<span></span>')
      + '<button type="button" class="liste-marke-weg" data-ed="karteWeg" title="Filter dieser Spalte entfernen" aria-label="Filter ' + listeEsc(sp.titel) + ' entfernen">✕</button></header>'
      + (e.werte ? '<div class="liste-ed-werte"><span class="liste-ed-vorsatz">ist einer von</span>'
        + e.werte.map((w, i) => '<span class="liste-ed-wert">' + (w === '' ? '(leer)' : listeEsc(w))
          + '<button type="button" class="liste-marke-weg" data-ed="wertWeg" data-i="' + i + '" title="Wert entfernen" aria-label="Wert ' + listeEsc(w === '' ? '(leer)' : w) + ' entfernen">✕</button></span>').join('')
        + '<input class="eingabefeld" type="text" data-ed-wert-neu list="' + listeEsc(liste) + '" placeholder="Wert hinzufügen + Enter" aria-label="Wert hinzufügen"></div>'
        + (e.bed.length ? '<div class="liste-ed-dazu">und zusätzlich</div>' : '') : '')
      + e.bed.map((x, i) => {
        const ohne = (LISTE_VERGLEICHE.find(v => v.id === x.op) || {}).ohneWert;
        return '<div class="liste-ed-zeile" data-i="' + i + '">'
          + (i ? '<span class="liste-ed-vorsatz">' + (e.oder ? 'oder' : 'und') + '</span>' : '<span class="liste-ed-vorsatz"></span>')
          + '<select class="eingabefeld" data-ed-op aria-label="Vergleich">' + LISTE_VERGLEICHE.map(v => '<option value="' + v.id + '"' + (v.id === x.op ? ' selected' : '') + '>' + listeEsc(v.text) + '</option>').join('') + '</select>'
          + '<input class="eingabefeld" type="text" data-ed-wert list="' + listeEsc(liste) + '" value="' + listeEsc(x.wert) + '" aria-label="Wert"' + (ohne ? ' disabled placeholder="—"' : ' placeholder="Wert"') + '>'
          + '<button type="button" class="liste-marke-weg" data-ed="bedWeg" title="Bedingung entfernen" aria-label="Bedingung entfernen">✕</button></div>';
      }).join('')
      + '<div class="liste-ed-fuss"><button type="button" class="liste-ed-plus" data-ed="bedNeu">+ Bedingung</button>'
      + (e.werte ? '' : '<button type="button" class="liste-ed-plus" data-ed="werteNeu">+ Werteliste</button>') + '</div>'
      + '<datalist id="' + listeEsc(liste) + '">' + [...vorhanden].slice(0, 400).sort(LISTE_ORDNER.compare).map(w => '<option value="' + listeEsc(w === '' ? '(leer)' : w) + '">').join('') + '</datalist>'
      + '</section>';
  }).join('');
  const frei = ord.spalten.filter(sp => !entwurf[sp.feld]).sort((x, y) => LISTE_ORDNER.compare(x.titel, y.titel));
  zst.popup.el.querySelector('.liste-editor').innerHTML = '<div class="liste-ed-kopf"><h3>Filter bearbeiten</h3><span class="liste-ed-zahl" data-ed-zahl></span></div>'
    + '<div class="liste-ed-rumpf">'
    + (felder.length ? karten : '<p class="meldung-klein">Kein Filter gesetzt. Unten eine Spalte wählen, um zu beginnen.</p>')
    + '<select class="eingabefeld liste-ed-spalte" data-ed-spalte aria-label="Spalte zum Filter hinzufügen"><option value="">+ Spalte hinzufügen …</option>'
    + frei.map(sp => '<option value="' + listeEsc(sp.feld) + '">' + listeEsc(sp.titel) + '</option>').join('') + '</select>'
    + '<p class="meldung-klein">Bei „ist wie“: * steht für beliebig viele Zeichen, ? für genau ein Zeichen. Groß- und Kleinschreibung spielt keine Rolle.</p>'
    + '</div>'
    + '<div class="liste-dialog-knoepfe"><button type="button" class="schaltflaeche" data-ed="leeren"' + (felder.length ? '' : ' disabled') + '>Alle entfernen</button>'
    + '<span></span><button type="button" class="schaltflaeche" data-ed="abbrechen">Abbrechen</button>'
    + '<button type="button" class="schaltflaeche" data-ed="anwenden" title="Filter anwenden, Fenster bleibt offen">Übernehmen</button>'
    + '<button type="button" class="schaltflaeche schaltflaeche-haupt" data-ed="ok">OK</button></div>';
  listeEditorZahl(zst);
  const ziel = fokus ? zst.popup.el.querySelector(fokus) : null;
  if (ziel) { ziel.focus(); if (ziel.select && ziel.matches('[data-ed-wert]')) ziel.select(); }
}

function listeEditorAnwenden(zst) {
  zst.filter = listeEditorErgebnis(zst.popup.entwurf).filter;
  zst.filterAn = true;
  zst.stueck = 0;
  const popup = zst.popup;            /* listeZeichnen laesst das Fenster stehen */
  listeZeichnen(zst.id);
  zst.popup = popup;
}

function listeEditorWertDazu(zst, feld, text) {
  const e = zst.popup.entwurf[feld];
  let w = String(text).trim();
  if (!e || !e.werte || w === '') return;
  if (w === '(leer)') w = '';
  if (!e.werte.includes(w)) e.werte.push(w);
  listeEditorZeichnen(zst, '[data-ed-feld="' + CSS.escape(feld) + '"] [data-ed-wert-neu]');
}

function listeEditorAktion(zst, el) {
  const aktion = el.dataset.ed, entwurf = zst.popup.entwurf;
  const karte = el.closest('[data-ed-feld]'), feld = karte ? karte.dataset.edFeld : null;
  const e = feld ? entwurf[feld] : null;
  const zeile = el.closest('[data-i]'), i = zeile ? Number(zeile.dataset.i) : -1;
  const hier = feld ? '[data-ed-feld="' + CSS.escape(feld) + '"] ' : '';
  const leerWeg = () => { if (e && !e.bed.length && !e.werte) delete entwurf[feld]; };
  switch (aktion) {
    case 'abbrechen': listePopupZu(zst); return;
    case 'anwenden': listeEditorAnwenden(zst); return;
    case 'ok': listeEditorAnwenden(zst); listePopupZu(zst); return;
    case 'leeren': for (const f of Object.keys(entwurf)) delete entwurf[f]; listeEditorZeichnen(zst, '[data-ed-spalte]'); return;
    case 'karteWeg': delete entwurf[feld]; listeEditorZeichnen(zst, null); return;
    case 'bedNeu': e.bed.push(listeEditorVorgabe(listeOrdnung(zst).jeFeld.get(feld))); listeEditorZeichnen(zst, hier + '.liste-ed-zeile:last-of-type [data-ed-wert]'); return;
    case 'bedWeg': e.bed.splice(i, 1); leerWeg(); listeEditorZeichnen(zst, null); return;
    case 'werteNeu': e.werte = []; listeEditorZeichnen(zst, hier + '[data-ed-wert-neu]'); return;
    case 'wertWeg': e.werte.splice(i, 1); if (!e.werte.length) e.werte = null; leerWeg(); listeEditorZeichnen(zst, null); return;
  }
}

/* ---------- Ziehen: Spalten verschieben, gruppieren, ein-/ausblenden ---------- */

function listeZiehZiel(zst, x, y, quelle) {
  const drin = (r, rand) => x >= r.left - rand && x <= r.right + rand && y >= r.top - rand && y <= r.bottom + rand;
  const auswahl = listeTeil(zst, 'auswahl');
  if (zst.auswahlOffen && drin(auswahl.getBoundingClientRect(), 0)) return quelle.art === 'auswahl' ? null : { art: 'aus' };
  const feld = listeTeil(zst, 'gruppierfeld');
  if (!feld.hidden) {
    const r = feld.getBoundingClientRect();
    if (drin(r, 2)) {
      const marken = [...feld.querySelectorAll('[data-marke]')];
      let index = 0, kante = r.left + 8;
      for (const m of marken) {
        const mr = m.getBoundingClientRect();
        if (x > mr.left + mr.width / 2) { index++; kante = mr.right + 3; }
      }
      return { art: 'gruppe', index, x: kante, oben: r.top + 4, hoehe: r.height - 8 };
    }
  }
  const kopf = zst.wurzel.querySelector('.liste-tabelle thead');
  if (kopf) {
    const r = kopf.getBoundingClientRect(), roll = listeTeil(zst, 'rollbereich').getBoundingClientRect();
    if (x >= roll.left && x <= roll.right && y >= r.top - 10 && y <= r.bottom + 14) {
      let vorFeld = null, kante = null;
      const koepfe = [...kopf.querySelectorAll('th[data-feld]')];
      for (const th of koepfe) {
        const tr = th.getBoundingClientRect();
        if (x < tr.left + tr.width / 2) { vorFeld = th.dataset.feld; kante = tr.left; break; }
      }
      if (kante === null && koepfe.length) kante = koepfe[koepfe.length - 1].getBoundingClientRect().right;
      return { art: 'kopf', vorFeld, x: Math.max(roll.left, Math.min(roll.right, kante)), oben: r.top, hoehe: r.height };
    }
    /* Kopf weit nach unten oder aus der Liste gezogen = ausblenden (wie in CAMBIUM) */
    if (quelle.art === 'kopf' && (y > r.bottom + 60 || !drin(zst.wurzel.getBoundingClientRect(), 0))) return { art: 'aus' };
  }
  if (quelle.art === 'marke') return { art: 'kopf', vorFeld: null, still: true };
  return null;
}

function listeZiehen(zst, e, quelle, titel) {
  const start = { x: e.clientX, y: e.clientY };
  let aktiv = false, geist = null, marke = null, ziel = null;
  const bewegen = (ev) => {
    if (!aktiv) {
      if (Math.hypot(ev.clientX - start.x, ev.clientY - start.y) < 6) return;
      aktiv = true;
      listePopupZu(zst);
      geist = document.createElement('div');
      geist.className = 'liste-geist';
      geist.textContent = titel;
      marke = document.createElement('div');
      marke.className = 'liste-einfuegemarke';
      const sch = listeTeil(zst, 'schwebend');
      sch.appendChild(geist); sch.appendChild(marke);
      zst.wurzel.classList.add('liste-zieht');
      if (quelle.art !== 'marke') listeTeil(zst, 'gruppierfeld').hidden = false;   /* ausgeblendetes Feld zeigt sich waehrend des Ziehens als Ziel */
    }
    geist.style.left = (ev.clientX + 10) + 'px';
    geist.style.top = (ev.clientY + 12) + 'px';
    ziel = listeZiehZiel(zst, ev.clientX, ev.clientY, quelle);
    geist.classList.toggle('entfernen', !!ziel && ziel.art === 'aus');
    const zeigen = !!ziel && ziel.x !== undefined && !ziel.still;
    marke.hidden = !zeigen;
    if (zeigen) { marke.style.left = (ziel.x - 1) + 'px'; marke.style.top = ziel.oben + 'px'; marke.style.height = ziel.hoehe + 'px'; }
    listeTeil(zst, 'gruppierfeld').classList.toggle('ziel', !!ziel && ziel.art === 'gruppe');
  };
  const ende = () => {
    window.removeEventListener('pointermove', bewegen);
    window.removeEventListener('pointerup', ende);
    window.removeEventListener('pointercancel', ende);
    if (!aktiv) return;
    geist.remove(); marke.remove();
    zst.wurzel.classList.remove('liste-zieht');
    listeTeil(zst, 'gruppierfeld').classList.remove('ziel');
    listeTeil(zst, 'gruppierfeld').hidden = zst.feldAus && !zst.gruppen.length;
    zst._gezogen = true;                     /* der folgende Klick ist kein Sortier-Klick */
    setTimeout(() => { zst._gezogen = false; }, 0);
    if (!ziel) return;
    if (ziel.art === 'gruppe') listeGruppeSetzen(zst, quelle.feld, ziel.index);
    else if (ziel.art === 'kopf') { if (ziel.vorFeld !== quelle.feld || quelle.art !== 'kopf') listeSpalteSetzen(zst, quelle.feld, ziel.vorFeld); }
    else if (ziel.art === 'aus') listeSpalteAusblenden(zst, quelle.feld);
  };
  window.addEventListener('pointermove', bewegen);
  window.addEventListener('pointerup', ende);
  window.addEventListener('pointercancel', ende);
}

function listeBreiteZiehen(zst, e, feld) {
  const col = zst.wurzel.querySelector('col[data-col="' + CSS.escape(feld) + '"]');
  const tabelle = zst.wurzel.querySelector('.liste-tabelle');
  if (!col || !tabelle) return;
  const startX = e.clientX, startB = parseFloat(col.style.width), startT = parseFloat(tabelle.style.width);
  e.preventDefault();
  zst.wurzel.classList.add('liste-breite-zieht');
  const bewegen = (ev) => {
    const b = Math.max(40, Math.round(startB + ev.clientX - startX));
    zst.breiten[feld] = b;
    col.style.width = b + 'px';                         /* nur die eine Spalte, kein Neuzeichnen */
    tabelle.style.width = (startT + b - startB) + 'px';
    listeFestSetzen(zst);
  };
  const ende = () => {
    window.removeEventListener('pointermove', bewegen);
    window.removeEventListener('pointerup', ende);
    window.removeEventListener('pointercancel', ende);
    zst.wurzel.classList.remove('liste-breite-zieht');
    listeSpeichern(zst);
  };
  window.addEventListener('pointermove', bewegen);
  window.addEventListener('pointerup', ende);
  window.addEventListener('pointercancel', ende);
}

/* ---------- Werte aendern ---------- */

function listeGewaehlteSicht(zst) { return zst.sicht.filter(z => zst.gewaehlt.has(listeWahlSchluessel(zst, z))); }

/* Schreibt, was der Plan als 'aendert' fuehrt — ueber setzen() des Werkzeugs —,
   merkt es fuer Rueckgaengig, zeichnet neu und meldet das Ergebnis.
   leise: die einzelne, glatt uebernommene Zelle braucht keine Meldung. */
function listeAenderungAusfuehren(zst, sp, plan, leise) {
  const getan = [];
  for (const e of plan) {
    if (e.status !== 'aendert') continue;
    const antwort = sp.setzen(e.z, e.neu, e.neuText);
    if (typeof antwort === 'string' && antwort) { e.status = 'fehler'; e.grund = antwort; }
    else getan.push({ z: e.z, feld: sp.feld, alt: e.alt, neu: e.neu });
  }
  if (getan.length) {
    zst.rueck.push({ feld: sp.feld, titel: sp.titel, eintraege: getan });
    if (zst.rueck.length > LISTE_RUECK_MAX) zst.rueck.shift();
    if (zst.def.nachAenderung) zst.def.nachAenderung(getan);
  }
  listeZeichnen(zst.id);
  if (!leise || plan.some(e => e.status === 'gesperrt' || e.status === 'fehler')) listeMelden(zst, listeAenderungText(sp, plan));
  else if (getan.length === 1 && !zst.sicht.includes(getan[0].z)) listeMelden(zst, 'Geändert. Die Zeile passt nicht mehr zu Filter oder Suche und ist jetzt ausgeblendet.');
  return getan.length;
}

/* Nimmt den letzten Schwung zurueck (alte Werte wieder ueber setzen()). */
function listeRueckgaengig(zst) {
  const schwung = zst.rueck.pop();
  if (!schwung) { listeMelden(zst, 'Nichts rückgängig zu machen.'); return; }
  const sp = listeOrdnung(zst).jeFeld.get(schwung.feld);
  const da = new Set(zst.def.zeilen() || []);
  const getan = [];
  if (sp && typeof sp.setzen === 'function') {
    for (const e of schwung.eintraege) {
      if (!da.has(e.z)) continue;                           /* die Zeile gibt es nicht mehr */
      const antwort = sp.setzen(e.z, e.alt, listeAnzeige(sp, e.alt));
      if (!(typeof antwort === 'string' && antwort)) getan.push({ z: e.z, feld: schwung.feld, alt: e.neu, neu: e.alt });
    }
  }
  if (getan.length && zst.def.nachAenderung) zst.def.nachAenderung(getan);
  listeZeichnen(zst.id);
  const fehlen = schwung.eintraege.length - getan.length;
  listeMelden(zst, 'Rückgängig: „' + schwung.titel + '“ in ' + listeFmt(getan.length) + (getan.length === 1 ? ' Zeile' : ' Zeilen')
    + (fehlen ? ' · ' + listeFmt(fehlen) + ' nicht zurückgesetzt' : ''));
}
function listeRueckEintraege(zst) {
  const letzter = zst.rueck[zst.rueck.length - 1];
  return letzter ? [{ text: 'Rückgängig: „' + letzter.titel + '“ (' + listeFmt(letzter.eintraege.length) + ')', kuerzel: 'Strg+Z', aktion: () => listeRueckgaengig(zst) }] : [];
}

/* Der Wert der Zelle (Zeile index, Spalte feld) in alle ANDEREN gewaehlten Zeilen. */
function listeWertUebernehmen(zst, index, feld) {
  const p = zst._posten[index], sp = listeOrdnung(zst).jeFeld.get(feld);
  if (!p || p.z === undefined || !sp || typeof sp.setzen !== 'function' || !listeAenderAktiv(zst.def)) return false;
  const zeilen = listeGewaehlteSicht(zst).filter(z => z !== p.z);
  if (!zeilen.length) return false;
  const wert = sp.wert(p.z), text = listeAnzeige(sp, wert);
  listeAenderungAusfuehren(zst, sp, listeAenderungPlan(zst.def, sp, zeilen, () => (typeof wert === 'number' && !sp.wahlwerte ? wert : text)), false);
  return true;
}

/* Eingabefeld in der Zelle oeffnen. vorgabe: das erste getippte Zeichen (ersetzt den Inhalt). */
function listeEingabeStart(zst, index, feld, vorgabe) {
  const ziel = zst._posten[index], z = ziel ? ziel.z : undefined;
  if (zst._eingabe && !listeEingabeFertig(zst, 'eine')) return false;
  if (z === undefined) return false;
  index = zst._posten.findIndex(x => x.z === z);            /* das Uebernehmen davor kann neu gezeichnet haben */
  const sp = listeOrdnung(zst).jeFeld.get(feld), nr = zst._felder.indexOf(feld);
  const tr = index < 0 ? null : zst.wurzel.querySelector('tr[data-posten="' + index + '"]');
  const td = tr && nr >= 0 ? tr.cells[nr + zst._versatz] : null;
  if (!td || !listeAenderbar(zst.def, sp, z)) return false;
  const text = listeAnzeige(sp, sp.wert(z)), wahl = listeWahlwerte(sp, z);
  const html = td.innerHTML, name = listeEsc(sp.titel + ' ändern');
  td.classList.add('liste-in-eingabe');
  td.innerHTML = wahl
    ? '<select class="liste-eingabe" data-eingabe aria-label="' + name + '">'
      + (wahl.includes(text) ? wahl : [text].concat(wahl)).map(w => '<option' + (w === text ? ' selected' : '') + '>' + listeEsc(w) + '</option>').join('') + '</select>'
    : '<input class="liste-eingabe' + (sp.zahl ? ' zahl' : '') + '" data-eingabe type="text" autocomplete="off"' + (sp.zahl ? ' inputmode="decimal"' : '')
      + ' value="' + listeEsc(vorgabe !== undefined ? vorgabe : text) + '" aria-label="' + name + '" title="Eingabe: übernehmen · Strg+Eingabe: für alle gewählten Zeilen · Esc: verwerfen">';
  const el = td.firstChild;
  zst._eingabe = { z, feld, el, td, html };
  listeAktivMerken(zst, index, feld);
  listeAktivAnzeigen(zst, true);
  el.focus();
  if (!wahl) { if (vorgabe !== undefined) el.setSelectionRange(el.value.length, el.value.length); else el.select(); }
  return true;
}

/* Eingabefeld schliessen. weise: 'eine' = diese Zelle · 'auswahl' = alle gewaehlten
   Zeilen · 'verlassen' = Fokus ist weg (ein Fehler verwirft dann) · 'abbruch'.
   Liefert false, wenn das Feld wegen eines Fehlers offen bleibt. */
function listeEingabeFertig(zst, weise) {
  const ed = zst._eingabe;
  if (!ed) return true;
  const zurueck = () => { zst._eingabe = null; ed.td.innerHTML = ed.html; ed.td.classList.remove('liste-in-eingabe'); };
  const sp = listeOrdnung(zst).jeFeld.get(ed.feld);
  if (weise === 'abbruch' || !sp) { zurueck(); return true; }
  const gewaehlt = listeGewaehlteSicht(zst);
  const zeilen = weise === 'auswahl' && gewaehlt.length > 1 && gewaehlt.includes(ed.z) ? gewaehlt : [ed.z];
  const text = ed.el.value;
  const plan = listeAenderungPlan(zst.def, sp, zeilen, () => text);
  const eigen = plan.find(e => e.z === ed.z);
  if (eigen.status === 'fehler') {
    if (weise === 'verlassen') { zurueck(); listeMelden(zst, 'Nicht übernommen: ' + eigen.grund); return true; }
    ed.el.classList.add('fehler');
    ed.el.title = eigen.grund;
    listeMelden(zst, eigen.grund);
    ed.el.focus();
    return false;
  }
  if (zeilen.length === 1 && eigen.status !== 'aendert') { zurueck(); return true; }   /* nichts geaendert: nichts zu tun */
  zst._eingabe = null;
  listeAenderungAusfuehren(zst, sp, plan, zeilen.length === 1);
  return true;
}

/* Tasten im Eingabefeld. */
function listeEingabeTaste(zst, e) {
  const zurueckInDieTabelle = () => {
    zst.wurzel.classList.add('liste-tasten');
    listeTeil(zst, 'rollbereich').focus({ preventScroll: true });
    listeAktivAnzeigen(zst, true);
  };
  if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); listeEingabeFertig(zst, 'abbruch'); zurueckInDieTabelle(); }
  else if (e.key === 'Enter') { e.preventDefault(); if (listeEingabeFertig(zst, e.ctrlKey || e.metaKey ? 'auswahl' : 'eine')) zurueckInDieTabelle(); }
  else if (e.key === 'Tab') { e.preventDefault(); if (listeEingabeFertig(zst, 'eine')) { zurueckInDieTabelle(); listeTabSchritt(zst, e.shiftKey ? -1 : 1); } }
}

/* Fenster "Werte aendern": eine Spalte fuer viele Zeilen auf einmal, mit Vorschau. */
function listeMassenOeffnen(zst, zeilen, woher, feld) {
  const ord = listeOrdnung(zst);
  const felder = ord.spalten.filter(c => typeof c.setzen === 'function');
  if (!felder.length || !zeilen.length || !listeAenderAktiv(zst.def)) return;
  const start = feld && ord.jeFeld.get(feld) && typeof ord.jeFeld.get(feld).setzen === 'function' ? feld : felder[0].feld;
  listePopup(zst, 'dialog', null, '<div class="liste-dialog liste-editor liste-massen" role="dialog" aria-modal="true" aria-label="Werte ändern"></div>');
  zst.popup.massen = { zeilen, woher, feld: start, art: 'setzen', wert: '', such: '', durch: '' };
  listeMassenZeichnen(zst, '[data-ms-wert]');
}
function listeMassenZeichnen(zst, fokus) {
  const m = zst.popup.massen, ord = listeOrdnung(zst), sp = ord.jeFeld.get(m.feld);
  const felder = ord.spalten.filter(c => typeof c.setzen === 'function').sort((a, b) => LISTE_ORDNER.compare(a.titel, b.titel));
  const arten = listeAenderArten(sp);
  if (!arten.some(a => a.id === m.art)) m.art = 'setzen';
  const wahl = sp.wahlwerte ? [...new Set(m.zeilen.flatMap(z => listeWahlwerte(sp, z) || []))] : null;
  if (wahl && !wahl.includes(m.wert)) m.wert = wahl.length ? wahl[0] : '';
  const eingabe = m.art === 'leeren' ? ''
    : m.art === 'ersetzen' ? '<input class="eingabefeld" type="text" data-ms-such value="' + listeEsc(m.such) + '" placeholder="Suchen nach" aria-label="Suchen nach">'
      + '<input class="eingabefeld" type="text" data-ms-durch value="' + listeEsc(m.durch) + '" placeholder="Ersetzen durch" aria-label="Ersetzen durch">'
      : wahl ? '<select class="eingabefeld" data-ms-wert aria-label="Neuer Wert">' + wahl.map(x => '<option' + (x === m.wert ? ' selected' : '') + '>' + listeEsc(x) + '</option>').join('') + '</select>'
        : '<input class="eingabefeld" type="text" data-ms-wert value="' + listeEsc(m.wert) + '" placeholder="' + (sp.zahl ? 'Zahl' : 'Text') + '" aria-label="Wert"' + (sp.zahl ? ' inputmode="decimal"' : '') + '>';
  zst.popup.el.querySelector('.liste-massen').innerHTML = '<div class="liste-ed-kopf"><h3>Werte ändern</h3>'
    + '<span class="liste-ed-zahl"><b>' + listeFmt(m.zeilen.length) + '</b> ' + listeEsc(m.woher) + '</span></div>'
    + '<div class="liste-ed-rumpf"><div class="liste-ms-zeile">'
    + '<select class="eingabefeld" data-ms-feld aria-label="Spalte">' + felder.map(c => '<option value="' + listeEsc(c.feld) + '"' + (c.feld === m.feld ? ' selected' : '') + '>' + listeEsc(c.titel) + '</option>').join('') + '</select>'
    + '<select class="eingabefeld" data-ms-art aria-label="Art der Änderung">' + arten.map(a => '<option value="' + a.id + '"' + (a.id === m.art ? ' selected' : '') + '>' + listeEsc(a.text) + '</option>').join('') + '</select>'
    + eingabe + '</div><div class="liste-ms-vorschau" data-ms-vorschau aria-live="polite"></div></div>'
    + '<div class="liste-dialog-knoepfe"><span></span><button type="button" class="schaltflaeche" data-ms="abbrechen">Abbrechen</button>'
    + '<button type="button" class="schaltflaeche schaltflaeche-haupt" data-ms="ok"></button></div>';
  listeMassenVorschau(zst);
  const ziel = fokus ? zst.popup.el.querySelector(fokus) : null;
  if (ziel) ziel.focus();
}
function listeMassenPlan(zst) {
  const m = zst.popup.massen, ord = listeOrdnung(zst), sp = ord.jeFeld.get(m.feld);
  return { sp, kennspalte: ord.sichtbar[0], plan: listeAenderungPlan(zst.def, sp, m.zeilen, listeMassenFn(m)) };
}
/* Vorschau und Knopf — beim Tippen nur das, das Fenster bleibt stehen. */
function listeMassenVorschau(zst) {
  const { sp, kennspalte, plan } = listeMassenPlan(zst), zahl = listeAenderungZahlen(plan);
  const fehler = plan.find(e => e.status === 'fehler');
  const beispiele = plan.filter(e => e.status === 'aendert').slice(0, 5);
  const leer = (t) => t === '' ? '<i>(leer)</i>' : listeEsc(t);
  zst.popup.el.querySelector('[data-ms-vorschau]').innerHTML = '<p><b>' + listeFmt(zahl.aendert) + '</b> von ' + listeFmt(plan.length) + ' Werten in „' + listeEsc(sp.titel) + '“ ändern sich'
    + (zahl.gleich ? ' · ' + listeFmt(zahl.gleich) + ' bleiben gleich' : '')
    + (zahl.gesperrt ? ' · ' + listeFmt(zahl.gesperrt) + ' gesperrt' : '')
    + (zahl.fehler ? ' · <span class="liste-ms-fehler">' + listeFmt(zahl.fehler) + ' abgelehnt: ' + listeEsc(fehler.grund) + '</span>' : '') + '</p>'
    + (beispiele.length ? '<table class="liste-ms-beispiele">' + beispiele.map(e => '<tr><td>' + listeEsc(listeAnzeige(kennspalte, kennspalte.wert(e.z))) + '</td><td>' + leer(e.altText) + '</td><td>→</td><td><b>' + leer(e.neuText) + '</b></td></tr>').join('')
      + (zahl.aendert > beispiele.length ? '<tr><td colspan="4">… und ' + listeFmt(zahl.aendert - beispiele.length) + ' weitere</td></tr>' : '') + '</table>' : '');
  const knopf = zst.popup.el.querySelector('[data-ms="ok"]');
  knopf.disabled = !zahl.aendert;
  knopf.textContent = zahl.aendert ? listeFmt(zahl.aendert) + (zahl.aendert === 1 ? ' Wert ändern' : ' Werte ändern') : 'Nichts zu ändern';
}
function listeMassenAnwenden(zst) {
  const { sp, plan } = listeMassenPlan(zst);
  if (!plan.some(e => e.status === 'aendert')) return;
  listePopupZu(zst);
  listeAenderungAusfuehren(zst, sp, plan, false);
}

/* ---------- Tastatur: Zeiger auf einer Zeile (und Zelle) ---------- */

/* Der Zeiger haengt an der Zeile selbst (Kennung) oder am Schluessel der
   Gruppe — so ueberlebt er Sortieren, Auf- und Zuklappen. */
function listeAktivIndex(zst) {
  const a = zst._aktiv;
  if (!a) return -1;
  return zst._posten.findIndex(p => a.art === 'z' ? p.z !== undefined && listeWahlSchluessel(zst, p.z) === a.k
    : p.g !== undefined && zst._gruppenSchluessel[p.nr] === a.s);
}
function listeAktivMerken(zst, index, feld) {
  const p = zst._posten[index];
  if (!p || p.u !== undefined) return false;
  zst._aktiv = p.z !== undefined ? { art: 'z', k: listeWahlSchluessel(zst, p.z) } : { art: 'g', s: zst._gruppenSchluessel[p.nr] };
  if (feld !== undefined) zst._aktivFeld = feld;
  return true;
}
/* Naechste Zeile oder Gruppenzeile in einer Richtung; Unterzeilen-Bloecke werden uebersprungen. */
function listeAktivNachbar(zst, i, richtung) {
  let j = i + richtung;
  while (j >= 0 && j < zst._posten.length && zst._posten[j].u !== undefined) j += richtung;
  return j >= 0 && j < zst._posten.length ? j : -1;
}
function listeInSicht(zst, tr, td, fest) {
  const roll = listeTeil(zst, 'rollbereich'), rr = roll.getBoundingClientRect();
  const kopf = roll.querySelector('thead'), fuss = roll.querySelector('tfoot');
  const oben = rr.top + roll.clientTop + (kopf ? kopf.offsetHeight : 0);
  const unten = rr.top + roll.clientTop + roll.clientHeight - (fuss ? fuss.offsetHeight : 0);
  const r = tr.getBoundingClientRect();
  if (r.top < oben) roll.scrollTop -= oben - r.top;
  else if (r.bottom > unten) roll.scrollTop += r.bottom - unten;
  if (td && !fest) {
    const c = td.getBoundingClientRect();
    const li = rr.left + roll.clientLeft + zst._festBreite, re = rr.left + roll.clientLeft + roll.clientWidth;
    if (c.left < li) roll.scrollLeft -= li - c.left;
    else if (c.right > re) roll.scrollLeft += Math.min(c.right - re, c.left - li);
  }
}
/* Setzt die Marke in die vorhandene Tabelle (kein Neuzeichnen). rollen: Zeile in Sicht holen. */
function listeAktivAnzeigen(zst, rollen) {
  const w = zst.wurzel;
  for (const el of w.querySelectorAll('[data-aktiv], [data-aktiv-zelle]')) { el.removeAttribute('data-aktiv'); el.removeAttribute('data-aktiv-zelle'); }
  const i = listeAktivIndex(zst);
  if (i < 0) return;
  const a = zst._aktiv, bis = i + (a.u !== undefined ? 1 : 0);          /* der Block der Unterzeilen ist der Posten danach */
  if (bis >= zst._gezeichnet) {
    if (!rollen) return;
    while (bis >= zst._gezeichnet) { const vor = zst._gezeichnet; listeNachzeichnen(zst, false); if (zst._gezeichnet === vor) break; }
  }
  const p = zst._posten[i];
  if (a.u !== undefined) {
    const block = w.querySelector('tr[data-block="' + (i + 1) + '"]');
    const uz = block ? block.querySelector('[data-uz="' + a.u + '"]') : null;
    if (uz) { uz.setAttribute('data-aktiv', ''); if (rollen) listeInSicht(zst, uz, null, true); return; }
    delete a.u;                                                           /* die Unterzeile ist nicht mehr zu sehen: der Zeiger steht auf ihrer Zeile */
  }
  const tr = w.querySelector(p.z !== undefined ? 'tr[data-posten="' + i + '"]' : 'tr[data-gruppe="' + p.nr + '"]');
  if (!tr) return;
  tr.setAttribute('data-aktiv', '');
  const nr = p.z !== undefined && zst._aktivFeld ? zst._felder.indexOf(zst._aktivFeld) : -1;
  const td = nr >= 0 ? tr.cells[nr + zst._versatz] : null;
  if (td) td.setAttribute('data-aktiv-zelle', '');
  if (rollen) listeInSicht(zst, tr, td, nr < zst._festZahl);
}
/* Zeiger bewegen. BEWUSST wie in Excel (Anwender 2026-11-10): die Zeile unter
   dem Zeiger ist nur hervorgehoben, gewaehlt wird sie dadurch nicht — dafuer
   ist die Leertaste da. bereich (Umschalt gehalten): die Auswahl waechst von
   der Zeile aus mit, auf der der Zeiger beim ersten Schritt stand. */
function listeAktivGehen(zst, index, bereich, feld) {
  const vorher = listeAktivIndex(zst);
  if (!listeAktivMerken(zst, index, feld)) return;
  if (bereich && zst.def.auswahl !== false) {
    if (!zst._bereichLaeuft) {
      const start = vorher >= 0 ? zst._posten[vorher] : null;
      listeAnkerSetzen(zst, start && start.z !== undefined ? start.z : null);
      zst._bereichLaeuft = true;
    }
    listeBereichWaehlen(zst, index);
    listeAuswahlGeaendert(zst);
  } else zst._bereichLaeuft = false;
  listeAktivAnzeigen(zst, true);
}

/* Zeiger auf die Unterzeile pfad der Zeile index setzen. */
function listeAktivUnter(zst, index, pfad) {
  if (!listeAktivMerken(zst, index)) return;
  zst._aktiv.u = pfad;
  zst._bereichLaeuft = false;
  listeAktivAnzeigen(zst, true);
}
/* Fuehrt ein Schritt von Posten i (r = 1 ab, -1 auf) in aufgeklappte Unterzeilen?
   Dann steht der Zeiger danach auf deren erster bzw. letzter. */
function listeUnterEinstieg(zst, i, r) {
  const block = zst._posten[r > 0 ? i + 1 : i - 1];
  if (!block || block.u === undefined) return false;
  const pfade = listeUnterPfade(zst, block.u);
  if (!pfade.length) return false;
  zst.wurzel.classList.add('liste-tasten');
  listeTeil(zst, 'rollbereich').focus({ preventScroll: true });
  listeAktivUnter(zst, r > 0 ? i : i - 2, pfade[r > 0 ? 0 : pfade.length - 1]);
  return true;
}
/* Tasten, solange der Zeiger auf einer Unterzeile steht. Unterzeilen haben keine
   Zellen und lassen sich nicht waehlen. Liefert null fuer Tasten, die die Zeile selbst meinen. */
function listeTasteUnter(zst, e, i) {
  const k = e.key, z = zst._posten[i].z, pfad = zst._aktiv.u;
  const pfade = listeUnterPfade(zst, z), nr = pfade.indexOf(pfad);
  const vor = () => { zst.wurzel.classList.add('liste-tasten'); listeTeil(zst, 'rollbereich').focus({ preventScroll: true }); };
  const hin = (p) => { vor(); listeAktivUnter(zst, i, p); };
  const zurZeile = (j) => { vor(); listeAktivGehen(zst, j, false); };
  const naechste = listeAktivNachbar(zst, i, 1);
  const weiter = (r) => {
    if (r > 0) { if (nr + 1 < pfade.length) hin(pfade[nr + 1]); else if (naechste >= 0) zurZeile(naechste); }
    else if (nr > 0) hin(pfade[nr - 1]);
    else zurZeile(i);
  };
  const kinder = listeUnterKinder(zst, z, pfad), offen = kinder > 0 && listeUnterIstOffen(zst, z, pfad);
  const umklappen = () => { vor(); listeUnterUmschalten(zst, z, pfad); };
  switch (k) {
    case 'ArrowDown': weiter(1); return true;
    case 'ArrowUp': weiter(-1); return true;
    case 'Tab':
      if (e.ctrlKey || e.altKey || e.metaKey) return false;
      if (!e.shiftKey && nr + 1 >= pfade.length) {                              /* nach der letzten Unterzeile: erste Zelle der naechsten Zeile */
        if (naechste < 0) return false;                                          /* Ende der Liste */
        vor(); listeAktivGehen(zst, naechste, false, zst._felder[0]);
      } else if (e.shiftKey && nr === 0) { vor(); listeAktivGehen(zst, i, false, zst._felder[zst._felder.length - 1]); }   /* zurueck: letzte Zelle der Zeile */
      else weiter(e.shiftKey ? -1 : 1);
      return true;
    case 'Enter': if (kinder) umklappen(); else weiter(1); return true;
    case 'ArrowRight': if (kinder && !offen) umklappen(); return true;
    case 'ArrowLeft':
      if (offen) umklappen();
      else if (pfad.includes('/')) hin(pfad.slice(0, pfad.lastIndexOf('/')));
      else zurZeile(i);
      return true;
    case 'Escape': zurZeile(i); return true;
    case ' ': case 'F2': return true;
  }
  if (k.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) return true;      /* Lostippen aendert hier nichts */
  return null;
}

/* Zeiger sichtbar machen; gibt es noch keinen, steht er auf der ersten Zeile. Die Auswahl bleibt. */
function listeTastaturAn(zst) {
  zst.wurzel.classList.add('liste-tasten');
  if (listeAktivIndex(zst) < 0) listeAktivMerken(zst, listeAktivNachbar(zst, -1, 1), zst._felder[0]);
  listeAktivAnzeigen(zst, true);
}

/* Tasten in der Kopfzeile (dorthin fuehrt Pfeil auf aus der ersten Zeile). */
function listeTasteKopf(zst, e, roll) {
  const th = e.target.closest('th[data-feld]');
  const k = e.key;
  if (!th) return false;
  if (k === 'ArrowLeft' || k === 'ArrowRight') {
    let n = th;
    do { n = k === 'ArrowLeft' ? n.previousElementSibling : n.nextElementSibling; } while (n && !n.matches('th[data-feld]'));
    if (n) n.focus();
    return true;
  }
  if (k === 'ArrowDown' && e.altKey) {                                     /* wie in Excel: Filterliste der Spalte */
    zst.wurzel.classList.add('liste-tasten');
    listeAufklappOeffnen(zst, th.dataset.feld, th.querySelector('[data-trichter]'));
    const erstes = zst.popup && zst.popup.el.querySelector('input, button');
    if (erstes) erstes.focus();
    return true;
  }
  if (k === 'ArrowDown') {
    const i = listeAktivIndex(zst);
    zst.wurzel.classList.add('liste-tasten');
    roll.focus({ preventScroll: true });
    listeAktivGehen(zst, i < 0 ? listeAktivNachbar(zst, -1, 1) : i, false, th.dataset.feld);
    return true;
  }
  if (k === 'ContextMenu' || (k === 'F10' && e.shiftKey)) {
    const r = th.getBoundingClientRect();
    zst._tastenMenue = Date.now();
    listeMenue(zst, th.dataset.feld, r.left + 8, r.bottom - 2, false);
    listeMenueFokus(zst);
    return true;
  }
  return false;
}
function listeMenueFokus(zst) {
  const b = zst.popup && zst.popup.el.querySelector('button:not(:disabled)');
  if (b) b.focus();
}

/* Tasten in der Tabelle. Liefert true, wenn die Taste verbraucht ist. */
function listeTaste(zst, e) {
  const t = e.target, roll = listeTeil(zst, 'rollbereich');
  if (zst.popup || !roll.contains(t) || !zst._posten.length) return false;
  if (t.matches('input:not([type="checkbox"]), textarea, select')) return false;
  if (t.closest('thead')) return listeTasteKopf(zst, e, roll);
  const k = e.key, wahl = zst.def.auswahl !== false;
  const bedien = t !== roll && !!t.closest('button, a, input, label');   /* Leertaste/Eingabe gehoeren dort dem Element */
  const i = listeAktivIndex(zst), p = i >= 0 ? zst._posten[i] : null;
  if (p && zst._aktiv.u !== undefined) {                                   /* der Zeiger steht auf einer Unterzeile */
    const erledigt = listeTasteUnter(zst, e, i);
    if (erledigt !== null) return erledigt;
  }
  const strg = e.ctrlKey || e.metaKey, felder = zst._felder;
  const erster = () => listeAktivNachbar(zst, -1, 1);
  const letzter = () => { listeNachzeichnen(zst, true); return listeAktivNachbar(zst, zst._posten.length, -1); };
  const zeigen = () => { zst.wurzel.classList.add('liste-tasten'); };
  /* Zeile wechseln (Umschalt = Bereich waehlen) */
  const gehen = (j, feld) => {
    if (j < 0) return;
    zeigen();
    roll.focus({ preventScroll: true });
    listeAktivGehen(zst, j, e.shiftKey, feld);
  };
  /* Zelle in derselben Zeile wechseln */
  const zelle = (nr) => {
    zeigen();
    roll.focus({ preventScroll: true });
    listeAktivMerken(zst, i, felder[Math.max(0, Math.min(felder.length - 1, nr))]);
    listeAktivAnzeigen(zst, true);
  };
  switch (k) {
    case 'ArrowDown':
      if (i >= 0 && !strg && !e.shiftKey && listeUnterEinstieg(zst, i, 1)) return true;   /* aufgeklappte Unterzeilen: hinein */
      gehen(i < 0 ? erster() : strg ? letzter() : listeAktivNachbar(zst, i, 1));
      return true;
    case 'ArrowUp': {
      if (i < 0 || strg) { gehen(erster()); return true; }
      if (!e.shiftKey && listeUnterEinstieg(zst, i, -1)) return true;                       /* von unten in die Unterzeilen der Zeile darueber */
      const j = listeAktivNachbar(zst, i, -1);
      if (j >= 0) { gehen(j); return true; }
      if (e.shiftKey) return true;
      const th = (zst._aktivFeld && roll.querySelector('th[data-feld="' + CSS.escape(zst._aktivFeld) + '"]')) || roll.querySelector('th[data-feld]');   /* ganz oben: in die Kopfzeile */
      if (th) th.focus();
      return true;
    }
    case 'ArrowRight': case 'ArrowLeft': {
      if (!p || e.altKey) return false;
      const r = k === 'ArrowRight' ? 1 : -1;
      if (p.g !== undefined) {                                               /* eine Gruppenzeile hat keine Zellen: rechts klappt auf, links zu */
        if ((r > 0) !== zst.offen.has(zst._gruppenSchluessel[p.nr])) { zeigen(); listeGruppeUmschalten(zst, p.nr); }
        return true;
      }
      const nr = felder.indexOf(zst._aktivFeld);
      zelle(strg ? (r > 0 ? felder.length - 1 : 0) : nr < 0 ? 0 : nr + r);
      return true;
    }
    case 'Home': case 'End': {
      const anfang = k === 'Home';
      if (strg || !p || p.z === undefined) gehen(anfang ? erster() : letzter(), felder[anfang ? 0 : felder.length - 1]);   /* Strg: Anfang/Ende der Liste */
      else zelle(anfang ? 0 : felder.length - 1);                                                                              /* sonst: Anfang/Ende der Zeile */
      return true;
    }
    case 'PageDown': case 'PageUp': {
      const zeile = roll.querySelector('tbody tr[data-posten]');
      let schritte = Math.max(1, Math.floor(roll.clientHeight / (zeile ? zeile.offsetHeight : 28)) - 2), j = i < 0 ? erster() : i;
      while (schritte-- > 0) { const x = listeAktivNachbar(zst, j, k === 'PageDown' ? 1 : -1); if (x < 0) break; j = x; }
      gehen(j);
      return true;
    }
    case 'Tab': return !(e.ctrlKey || e.altKey || e.metaKey) && listeTabSchritt(zst, e.shiftKey ? -1 : 1);
    case 'F2': return !!p && p.z !== undefined && !!zst._aktivFeld && listeEingabeStart(zst, i, zst._aktivFeld);
    case 'z': case 'Z': {
      if (!(e.ctrlKey || e.metaKey) || e.altKey || !zst.rueck.length) break;
      listeRueckgaengig(zst);
      return true;
    }
    case 'd': case 'D': {
      if (!(e.ctrlKey || e.metaKey) || e.altKey) break;
      return !!p && !!zst._aktivFeld && listeWertUebernehmen(zst, i, zst._aktivFeld);
    }
    case ' ': {
      if (bedien || !p || !wahl) return false;
      zeigen();
      if (p.g !== undefined) { listeGruppeWaehlen(zst, p.nr); return true; }
      const s = listeWahlSchluessel(zst, p.z);
      if (zst.gewaehlt.has(s)) zst.gewaehlt.delete(s); else zst.gewaehlt.add(s);
      listeAnkerSetzen(zst, p.z);
      listeAuswahlGeaendert(zst);
      return true;
    }
    case 'Enter': {
      if (bedien || !p) return false;
      zeigen();
      if (p.g !== undefined) { listeGruppeUmschalten(zst, p.nr); return true; }                                   /* Struktur oeffnen/schliessen */
      if (zst.def.unter && (zst.def.unter.zeilen(p.z) || []).length) { listeUnterUmschalten(zst, p.z, ''); return true; }
      const j = listeAktivNachbar(zst, i, e.shiftKey ? -1 : 1);                                                    /* nichts zu oeffnen: wie in Excel eine Zeile weiter */
      if (j >= 0) listeAktivGehen(zst, j, false);
      return true;
    }
    case 'ContextMenu': case 'F10': {
      if ((k === 'F10' && !e.shiftKey) || !p) return false;
      const tr = roll.querySelector('[data-aktiv]');
      if (!tr) return false;
      const td = tr.querySelector('[data-aktiv-zelle]'), r = (td || tr).getBoundingClientRect(), rr = roll.getBoundingClientRect();
      zst._tastenMenue = Date.now();
      listeMenueFrei(zst, p.z !== undefined ? listeZeilenMenue(zst, i, td) : listeGruppenMenue(zst, p.nr), Math.max(r.left, rr.left) + 12, r.bottom - 2);
      listeMenueFokus(zst);
      return true;
    }
    case 'c': case 'C': {
      if (!(e.ctrlKey || e.metaKey) || e.altKey) break;
      if (String(window.getSelection ? window.getSelection() : '') !== '') return false;   /* markierter Text: der Browser kopiert */
      if (wahl && zst.gewaehlt.size > 1) { listeZeilenKopieren(zst); return true; }
      if (p && p.z !== undefined && zst._aktivFeld) {
        const sp = listeOrdnung(zst).jeFeld.get(zst._aktivFeld);
        if (sp) { const text = listeAnzeige(sp, sp.wert(p.z)); listeKopieren(zst, text, 'Zelle kopiert: ' + (text === '' ? '(leer)' : text)); return true; }
      }
      if (wahl && zst.gewaehlt.size) { listeZeilenKopieren(zst); return true; }
      return false;
    }
  }
  /* Lostippen auf einer aenderbaren Zelle oeffnet das Eingabefeld mit diesem Zeichen (wie in Excel). */
  if (k.length === 1 && k !== ' ' && !e.ctrlKey && !e.altKey && !e.metaKey && !bedien && p && p.z !== undefined && zst._aktivFeld) {
    return listeEingabeStart(zst, i, zst._aktivFeld, k);
  }
  return false;
}

/* Tab: eine Zelle weiter (r = 1) oder zurueck (r = -1); am Zeilenende in die
   naechste Zeile. Liefert false am Ende der Liste — dann geht Tab zum naechsten Bedienteil. */
function listeTabSchritt(zst, r) {
  const roll = listeTeil(zst, 'rollbereich'), felder = zst._felder;
  const i = listeAktivIndex(zst), p = i >= 0 ? zst._posten[i] : null;
  const gehen = (j, feld) => {
    zst.wurzel.classList.add('liste-tasten');
    roll.focus({ preventScroll: true });
    listeAktivGehen(zst, j, false, feld);
  };
  if (i < 0) {
    const erster = listeAktivNachbar(zst, -1, 1);
    if (r < 0 || erster < 0) return false;
    gehen(erster, felder[0]);
    return true;
  }
  if (p.z !== undefined) {
    const nr = felder.indexOf(zst._aktivFeld);
    const ziel = nr < 0 ? (r > 0 ? 0 : -1) : nr + r;
    if (ziel >= 0 && ziel < felder.length) {                /* naechste Zelle derselben Zeile: Auswahl bleibt */
      zst.wurzel.classList.add('liste-tasten');
      roll.focus({ preventScroll: true });
      listeAktivMerken(zst, i, felder[ziel]);
      listeAktivAnzeigen(zst, true);
      return true;
    }
  }
  if (listeUnterEinstieg(zst, i, r)) return true;           /* aufgeklappte Unterzeilen liegen auf dem Weg */
  const j = listeAktivNachbar(zst, i, r);
  if (j < 0) return false;
  gehen(j, r > 0 ? felder[0] : felder[felder.length - 1]);
  return true;
}

/* ---------- Verdrahtung: alle Listener EINMAL am Rahmen (Spec §7B) ---------- */

/* Klick irgendwo in der Liste. Reihenfolge = Vorrang: das Innerste zuerst. */
function listeBeiKlick(zst, e) {
  if (zst._gezogen) return;
  const t = e.target;
  let el;
  const wahl = zst.def.auswahl !== false;
  if (t.closest('.liste-tabelle tfoot')) return;                          /* Fusszeile der Liste: nur Rechtsklick */
  if ((el = t.closest('.liste-wahl'))) {                                  /* ganze Zelle ist Klickflaeche; nie sortieren/aufklappen */
    const k = el.querySelector('input');
    if (e.shiftKey && k.matches('[data-wahl-zeile]')) {                   /* Umschalt am Kaestchen = Bereich */
      e.preventDefault();
      listeBereichWaehlen(zst, Number(k.dataset.wahlZeile));
      setTimeout(() => listeAuswahlGeaendert(zst), 0);                    /* nach dem Zuruecksetzen des Hakens durch den Browser */
      return;
    }
    if (t === el) k.click();
    return;
  }
  if ((el = t.closest('[data-unter]'))) {                                 /* Pfeil: Unterzeilen auf/zu */
    const p = zst._posten[Number(el.dataset.unter)];
    if (p) listeUnterUmschalten(zst, p.z !== undefined ? p.z : p.u, el.dataset.pfad);
    return;
  }
  if ((el = t.closest('[data-uz]'))) {                                    /* Klick auf eine Unterzeile: waehlt nichts, die Tastatur macht hier weiter */
    const block = el.closest('tr[data-block]');
    if (block && listeAktivMerken(zst, Number(block.dataset.block) - 1)) { zst._aktiv.u = el.dataset.uz; listeAktivAnzeigen(zst, false); }
    return;
  }
  if (t.closest('.liste-auf')) return;                                    /* Pfeilspalte waehlt nicht aus */
  if ((el = t.closest('[data-menue-nr]'))) {
    if (!el.disabled) {
      const f = zst.popup.aktionen[Number(el.dataset.menueNr)];
      listePopupZu(zst);
      f();
      if (zst.wurzel.classList.contains('liste-tasten') && !zst.popup) listeTeil(zst, 'rollbereich').focus({ preventScroll: true });   /* Tastatur: zurueck in die Tabelle */
    }
    return;
  }
  if ((el = t.closest('[data-trichter]'))) { listeAufklappOeffnen(zst, el.dataset.trichter, el); return; }
  if (t.closest('[data-griff]')) return;
  if ((el = t.closest('[data-menue]'))) { if (!el.disabled) listeMenueAktion(zst, el.dataset.menue, zst.popup.feld); return; }
  if ((el = t.closest('[data-ed]'))) { listeEditorAktion(zst, el); return; }
  if ((el = t.closest('[data-kz-feld]'))) { listeKreuzZeigen(zst, Number(el.dataset.i), Number(el.dataset.j)); return; }
  if ((el = t.closest('button[data-kz]'))) {
    if (el.dataset.kz === 'csv') listeDateiSpeichern(zst, zst.def.id + '_kreuztabelle', listeKreuzCsv(zst), 'Kreuztabelle als CSV gespeichert');
    else if (el.dataset.kz === 'kopieren') listeKreuzKopieren(zst);
    else { listeSpeichern(zst); listePopupZu(zst); }
    return;
  }
  if ((el = t.closest('[data-ms]'))) { if (el.dataset.ms === 'ok') listeMassenAnwenden(zst); else listePopupZu(zst); return; }
  if ((el = t.closest('[data-filter-marke]'))) { listeEditorOeffnen(zst, el.dataset.filterMarke); return; }
  if ((el = t.closest('[data-filter-marke-weg]'))) {
    if (el.dataset.filterMarkeWeg === '') zst.nurAuswahl = false; else delete zst.filter[el.dataset.filterMarkeWeg];
    zst.stueck = 0;
    listeZeichnen(zst.id);
    return;
  }
  if ((el = t.closest('[data-filter-knopf]'))) {
    const k = el.dataset.filterKnopf;
    if (k === 'an') return;                                              /* Haekchen: siehe change */
    if (k === 'loeschen') { listeFilterLeeren(zst.id); return; }
    if (k === 'bearbeiten') { listeEditorOeffnen(zst, null); return; }
    const feld = zst.popup.feld;
    if (k === 'eigen') { listeEditorOeffnen(zst, feld); return; }
    if (k === 'alle') { delete zst.filter[feld]; zst.stueck = 0; listePopupZu(zst); listeZeichnen(zst.id); }
    return;
  }
  if ((el = t.closest('[data-marke-weg]'))) { listeGruppeEntfernen(zst, el.dataset.markeWeg); return; }
  if ((el = t.closest('[data-marke]'))) {
    const g = zst.gruppen.find(x => x.feld === el.dataset.marke);
    if (g) { g.ab = !g.ab; listeNeu(zst, true); }
    return;
  }
  if ((el = t.closest('[data-liste-aktion]'))) { listeAktion(zst, el.dataset.listeAktion); return; }
  if ((el = t.closest('[data-auswahl-auf]'))) {                          /* Spaltenauswahl als Baum: Gruppe auf/zu */
    const g = zst._baumKnoten[Number(el.dataset.auswahlAuf)];
    if (g) {
      if (zst.auswahlAuf.has(g.schluessel)) zst.auswahlAuf.delete(g.schluessel); else zst.auswahlAuf.add(g.schluessel);
      listeAuswahlBaumZeichnen(zst);
      const k = listeTeil(zst, 'auswahl').querySelector('[data-auswahl-auf="' + el.dataset.auswahlAuf + '"]');
      if (k) k.focus({ preventScroll: true });
    }
    return;
  }
  if ((el = t.closest('[data-auswahl-alle]'))) { listeAuswahlGruppe(zst, Number(el.dataset.auswahlAlle)); return; }
  if ((el = t.closest('[data-auswahl-feld]'))) { listeAuswahlKlick(zst, el.dataset.auswahlFeld); return; }
  if ((el = t.closest('tr[data-gruppe]'))) {
    const nr = Number(el.dataset.gruppe);
    listeAktivMerken(zst, zst._posten.findIndex(p => p.nr === nr));
    if (wahl && e.shiftKey) { listeBereichWaehlen(zst, zst._posten.findIndex(p => p.nr === nr)); listeAuswahlGeaendert(zst); return; }
    if (wahl && (e.ctrlKey || e.metaKey)) { listeGruppeWaehlen(zst, nr); return; }   /* Strg+Klick: ganze Gruppe dazu oder weg */
    listeGruppeUmschalten(zst, nr);
    return;
  }
  if (wahl && (el = t.closest('tr[data-posten]'))) {
    if (t.closest('button, a, input, select, textarea, label')) return;   /* Bedienelemente in der Zelle gehoeren dem Werkzeug */
    const td = t.closest('td'), nr = td ? td.cellIndex - zst._versatz : -1;
    listeAktivMerken(zst, Number(el.dataset.posten), nr >= 0 ? zst._felder[nr] : undefined);   /* die Tastatur macht hier weiter */
    listeAktivAnzeigen(zst, false);
    listeZeileKlick(zst, Number(el.dataset.posten), e);
    return;
  }
  if ((el = t.closest('th[data-feld]'))) listeSortieren(zst.id, el.dataset.feld, e.shiftKey);
}

/* Haken und Auswahlfelder: Auswahl-Kaestchen, "Filter aktiv", Filterfenster, Werteliste. */
function listeBeiAenderung(zst, e) {
  const t = e.target;
  if (t.matches('[data-wahl-zeile]')) {
    const z = zst._posten[Number(t.dataset.wahlZeile)].z;
    listeAktivMerken(zst, Number(t.dataset.wahlZeile));
    listeAktivAnzeigen(zst, false);
    listeWahlSetzen(zst, [z], t.checked);
    listeAnkerSetzen(zst, z);
    listeAuswahlGeaendert(zst);
    return;
  }
  if (t.matches('[data-wahl-gruppe]')) { listeWahlSetzen(zst, zst._gruppenZeilen[Number(t.dataset.wahlGruppe)] || [], t.checked); listeAuswahlGeaendert(zst); return; }
  if (t.matches('[data-wahl-alle]')) { listeWahlSetzen(zst, zst.sicht, t.checked); listeAuswahlGeaendert(zst); return; }
  if (t.matches('[data-filter-knopf="an"]')) { zst.filterAn = t.checked; zst.stueck = 0; listeZeichnen(zst.id); return; }
  if (t.matches('select[data-eingabe]')) { listeEingabeFertig(zst, 'eine'); return; }   /* Auswahlfeld in der Zelle: Wahl = uebernehmen */
  if (zst.popup && zst.popup.kreuz && t.matches('select[data-kz]')) {    /* Kreuztabelle: andere Aufteilung */
    zst.kreuz[t.dataset.kz] = t.value;
    if (zst.kreuz.spalte === zst.kreuz.zeile) zst.kreuz.spalte = '';
    listeSpeichern(zst);
    listeKreuzZeichnen(zst, '[data-kz="' + t.dataset.kz + '"]');
    return;
  }
  if (zst.popup && zst.popup.massen) {                                   /* Fenster "Werte aendern" */
    const m = zst.popup.massen;
    if (t.matches('[data-ms-feld]')) { m.feld = t.value; m.art = 'setzen'; m.wert = ''; listeMassenZeichnen(zst, '[data-ms-wert]'); return; }
    if (t.matches('[data-ms-art]')) { m.art = t.value; listeMassenZeichnen(zst, '[data-ms-wert], [data-ms-such]'); return; }
    if (t.matches('select[data-ms-wert]')) { m.wert = t.value; listeMassenVorschau(zst); return; }
  }
  if (zst.popup && zst.popup.entwurf) {                                  /* Fenster "Filter bearbeiten" */
    const karte = t.closest('[data-ed-feld]'), ef = karte ? zst.popup.entwurf[karte.dataset.edFeld] : null;
    if (t.matches('[data-ed-op]')) { ef.bed[Number(t.closest('[data-i]').dataset.i)].op = t.value; listeEditorZeichnen(zst, '[data-ed-feld="' + CSS.escape(karte.dataset.edFeld) + '"] [data-i="' + t.closest('[data-i]').dataset.i + '"] [data-ed-wert]'); return; }
    if (t.matches('[data-ed-oder]')) { ef.oder = t.value === 'oder'; listeEditorZeichnen(zst, null); return; }
    if (t.matches('[data-ed-wert-neu]')) { listeEditorWertDazu(zst, karte.dataset.edFeld, t.value); return; }
    if (t.matches('[data-ed-spalte]') && t.value) {
      const sp = listeOrdnung(zst).jeFeld.get(t.value);
      zst.popup.entwurf[t.value] = { werte: null, bed: [listeEditorVorgabe(sp)], oder: false };
      listeEditorZeichnen(zst, '[data-ed-feld="' + CSS.escape(t.value) + '"] [data-ed-wert]');
      return;
    }
  }
  if (t.matches('[data-wert]') && zst.popup) {
    const feld = zst.popup.feld;
    const gewaehlt = [...zst.popup.el.querySelectorAll('[data-wert]:checked')].map(c => zst._werte[Number(c.dataset.wert)]);
    const alt = zst.filter[feld] || {};
    if (gewaehlt.length) { zst.filter[feld] = Object.assign({}, alt, { werte: gewaehlt }); zst.filterAn = true; }
    else if (alt.bed && alt.bed.length) zst.filter[feld] = { bed: alt.bed, oder: !!alt.oder };   /* Bedingungen der Spalte bleiben */
    else delete zst.filter[feld];
    zst.stueck = 0;
    listeZeichnen(zst.id);                                               /* die Werteliste bleibt offen */
  }
}

/* Tippen: Suchfeld, Werte im Filterfenster, Suche in der Werteliste. */
function listeBeiEingabe(zst, e) {
  const t = e.target;
  if (t.matches('[data-liste-suche]')) { zst.text = t.value; zst.stueck = 0; listeZeichnen(zst.id); return; }
  if (t.matches('[data-auswahl-suche]')) { zst.auswahlSuche = t.value; listeAuswahlBaumZeichnen(zst); return; }
  if (zst.popup && zst.popup.massen && t.matches('[data-ms-wert], [data-ms-such], [data-ms-durch]')) {   /* Tippen: nur die Vorschau */
    const m = zst.popup.massen;
    if (t.matches('[data-ms-wert]')) m.wert = t.value; else if (t.matches('[data-ms-such]')) m.such = t.value; else m.durch = t.value;
    listeMassenVorschau(zst);
    return;
  }
  if (t.matches('[data-ed-wert]') && zst.popup && zst.popup.entwurf) {     /* Tippen: nur Entwurf und Zahl, kein Neuaufbau */
    zst.popup.entwurf[t.closest('[data-ed-feld]').dataset.edFeld].bed[Number(t.closest('[data-i]').dataset.i)].wert = t.value;
    listeEditorZahl(zst);
    return;
  }
  if (t.matches('[data-werte-suche]')) {
    const s = listeNorm(t.value);
    for (const l of zst.popup.el.querySelectorAll('.liste-werte label')) l.classList.toggle('weg', !!s && !listeNorm(l.children[1].textContent).includes(s));
  }
}

/* Rechtsklick: je Bereich das passende Menue. */
function listeBeiRechtsklick(zst, e) {
  const t = e.target;
  if (t.closest('.liste-popup, .liste-dialog-huelle, input[type="search"], input[type="text"], textarea')) return;   /* dort gilt das Menue des Browsers */
  if (Date.now() - zst._tastenMenue < 600) { e.preventDefault(); return; }   /* die Menue-Taste hat ihr Menue schon geoeffnet */
  const th = t.closest('th[data-feld]'), m = t.closest('[data-marke]');
  if (th || m) {
    e.preventDefault();
    listeMenue(zst, th ? th.dataset.feld : m.dataset.marke, e.clientX, e.clientY, !th);
    return;
  }
  let el, eintraege = null;
  if ((el = t.closest('[data-fuss]'))) eintraege = listeSummenEintraege(zst, el.dataset.fuss);
  else if (t.closest('tfoot')) return;
  else if ((el = t.closest('tr[data-gruppe]'))) eintraege = listeGruppenMenue(zst, Number(el.dataset.gruppe));
  else if ((el = t.closest('tr[data-posten]'))) eintraege = listeZeilenMenue(zst, Number(el.dataset.posten), t.closest('td'));
  else if (t.closest('[data-gruppierfeld]')) {
    eintraege = listeGruppenEintraege(zst).concat(['-', { text: 'Gruppierfeld ausblenden', aus: !!zst.gruppen.length, aktion: () => listeFeldZeigen(zst, false) },
      { text: 'Spaltenauswahl …', aktion: () => { if (!zst.auswahlOffen) listeAktion(zst, 'spaltenauswahl'); } }]);
  } else if (t.closest('[data-filterzeile]')) {
    eintraege = [{ text: 'Filter bearbeiten …', aktion: () => listeEditorOeffnen(zst, null) }, '-', { text: 'Alle Filter löschen', aktion: () => listeFilterLeeren(zst.id) },
      { text: zst.filterAn ? 'Filter vorübergehend ausschalten' : 'Filter wieder einschalten', aktion: () => { zst.filterAn = !zst.filterAn; zst.stueck = 0; listeZeichnen(zst.id); } }];
  } else if (t.closest('[data-rollbereich], [data-wahlzeile]')) {
    eintraege = listeRueckEintraege(zst).concat(['-'], listeWahlEintraege(zst), ['-'], listeGruppenEintraege(zst), ['-'], listeUnterEintraege(zst, null), ['-'], listeExportEintraege(zst));
  }
  if (!eintraege || !eintraege.length) return;
  e.preventDefault();
  listeMenueFrei(zst, eintraege, e.clientX, e.clientY);
}

/* Zeiger gedrueckt: Breite ziehen oder Kopf/Marke/Spaltenfeld ziehen. */
function listeBeiZeigerAb(zst, e) {
  const w = zst.wurzel;
  w.classList.remove('liste-tasten');                                     /* Maus: der Tastatur-Zeiger tritt zurueck */
  if (e.button !== 0) return;
  const t = e.target;
  let el;
  if ((el = t.closest('[data-griff]'))) { listeBreiteZiehen(zst, e, el.dataset.griff); return; }
  if (t.closest('[data-trichter], [data-marke-weg]')) return;
  const titel = (f) => { const sp = listeOrdnung(zst).jeFeld.get(f); return sp ? sp.titel : f; };
  if ((el = t.closest('th[data-feld]'))) listeZiehen(zst, e, { art: 'kopf', feld: el.dataset.feld }, titel(el.dataset.feld));
  else if ((el = t.closest('[data-marke]'))) listeZiehen(zst, e, { art: 'marke', feld: el.dataset.marke }, titel(el.dataset.marke));
  else if ((el = t.closest('[data-auswahl-feld]'))) listeZiehen(zst, e, { art: 'auswahl', feld: el.dataset.auswahlFeld }, titel(el.dataset.auswahlFeld));
}

/* Doppelklick: auf den Rand eines Kopfs = optimale Breite, auf eine aenderbare Zelle = aendern. */
function listeBeiDoppelklick(zst, e) {
  const t = e.target, el = t.closest('[data-griff]');
  if (el) { listeOptimaleBreite(zst, el.dataset.griff); listeNeu(zst); return; }
  const tr = t.closest('tr[data-posten]'), td = t.closest('td');           /* Doppelklick auf eine aenderbare Zelle: Eingabefeld */
  if (!tr || !td || t.closest('button, a, input, select, textarea, label')) return;
  const nr = td.cellIndex - zst._versatz;
  if (nr >= 0) listeEingabeStart(zst, Number(tr.dataset.posten), zst._felder[nr]);
}

/* Tasten: erst offene Menues und Fenster, dann die Tabelle (listeTaste). */
function listeBeiTaste(zst, e) {
  const w = zst.wurzel;
  if (e.target.matches('[data-eingabe]')) { listeEingabeTaste(zst, e); return; }
  if (zst.popup && zst.popup.kreuz && (e.ctrlKey || e.metaKey) && !e.altKey && (e.key === 'c' || e.key === 'C')) {   /* Kreuztabelle: Strg+C kopiert alles */
    if (String(window.getSelection ? window.getSelection() : '') !== '' || !zst.popup.el.querySelector('.liste-kz-tabelle')) return;   /* markierter Text: der Browser kopiert */
    e.preventDefault();
    listeKreuzKopieren(zst);
    return;
  }
  if (e.key === 'Enter' && zst.popup && zst.popup.massen && e.target.matches('input')) { e.preventDefault(); listeMassenAnwenden(zst); return; }
  if (e.key === 'Escape' && !zst.popup && zst.auswahlOffen && e.target.closest('[data-auswahl]')) {   /* Spaltenauswahl schliessen */
    e.preventDefault(); e.stopPropagation();
    listeAktion(zst, 'spaltenauswahl');
    const k = zst.wurzel.querySelector('.liste-werkzeuge [data-liste-aktion="spaltenauswahl"]');
    if (k) k.focus({ preventScroll: true });
    return;
  }
  if (e.key === 'Escape' && zst.popup) {
    e.preventDefault(); e.stopPropagation();
    listePopupZu(zst);
    if (w.classList.contains('liste-tasten')) listeTeil(zst, 'rollbereich').focus({ preventScroll: true });
    return;
  }
  if (zst.popup && zst.popup.art === 'menue' && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {   /* Menue mit Pfeiltasten */
    const knoepfe = [...zst.popup.el.querySelectorAll('button:not(:disabled)')];
    if (knoepfe.length) {
      const nr = knoepfe.indexOf(document.activeElement);
      knoepfe[(nr + (e.key === 'ArrowDown' ? 1 : -1) + knoepfe.length) % knoepfe.length].focus();
      e.preventDefault();
    }
    return;
  }
  if (e.key === 'Enter' && zst.popup && zst.popup.entwurf) {
    if (e.target.matches('[data-ed-wert-neu]')) { e.preventDefault(); listeEditorWertDazu(zst, e.target.closest('[data-ed-feld]').dataset.edFeld, e.target.value); return; }
    if (e.target.matches('[data-ed-wert]')) { e.preventDefault(); listeEditorAnwenden(zst); listePopupZu(zst); return; }
  }
  if ((e.ctrlKey || e.metaKey) && (e.key === 'a' || e.key === 'A') && zst.def.auswahl !== false && !zst.popup
      && !e.target.matches('input:not([type="checkbox"]), textarea, select')) { e.preventDefault(); listeAllesWaehlen(zst); return; }
  if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('th[data-feld]')) {
    e.preventDefault();
    const feld = e.target.dataset.feld;
    listeSortieren(zst.id, feld, e.shiftKey);
    const th = w.querySelector('th[data-feld="' + CSS.escape(feld) + '"]');   /* der Kopf ist neu gezeichnet: Fokus zurueck */
    if (th) th.focus();
    return;
  }
  if (listeTaste(zst, e)) e.preventDefault();
}

/* Rollen: Menue schliessen, naechstes Stueck Zeilen nachladen. */
function listeBeiRollen(zst, roll) {
  if (zst.popup && zst.popup.art !== 'dialog') listePopupZu(zst);
  if (zst._gezeichnet < zst._posten.length && roll.scrollTop + roll.clientHeight > roll.scrollHeight - 900) listeNachzeichnen(zst, false);
}

/* Alle Listener EINMAL am Rahmen der Liste (Spec §7B). */
function listeVerdrahten(zst) {
  const w = zst.wurzel, roll = listeTeil(zst, 'rollbereich');
  w.addEventListener('click', (e) => listeBeiKlick(zst, e));
  w.addEventListener('change', (e) => listeBeiAenderung(zst, e));
  w.addEventListener('input', (e) => listeBeiEingabe(zst, e));
  w.addEventListener('contextmenu', (e) => listeBeiRechtsklick(zst, e));
  /* Umschalt+Klick soll Zeilen waehlen, nicht Text markieren */
  w.addEventListener('mousedown', (e) => { if (e.shiftKey && e.target.closest('.liste-tabelle tbody')) e.preventDefault(); });
  w.addEventListener('pointerdown', (e) => listeBeiZeigerAb(zst, e));
  w.addEventListener('dblclick', (e) => listeBeiDoppelklick(zst, e));
  w.addEventListener('keydown', (e) => listeBeiTaste(zst, e));
  /* Mit der Tastatur in die Tabelle gekommen (nicht per Mausklick): Zeiger zeigen. */
  roll.addEventListener('focus', (e) => { if (e.currentTarget.matches(':focus-visible')) listeTastaturAn(zst); });
  roll.addEventListener('scroll', () => listeBeiRollen(zst, roll));
  /* Eingabefeld verlassen (Klick woandershin): uebernehmen. */
  w.addEventListener('focusout', (e) => { if (zst._eingabe && e.target === zst._eingabe.el) listeEingabeFertig(zst, 'verlassen'); });
}

/* Klick ausserhalb schliesst Menue und Werteliste — ein Listener fuer alle Listen. */
if (typeof document !== 'undefined') {
  /* Gezeichnet wird stueckweise — gedruckt werden sollen aber ALLE Zeilen. */
  window.addEventListener('beforeprint', () => { for (const zst of LISTEN.values()) listeNachzeichnen(zst, true); });
  document.addEventListener('pointerdown', (e) => {
    for (const zst of LISTEN.values()) {
      if (!zst.popup || zst.popup.art === 'dialog') continue;
      if (zst.popup.el.contains(e.target)) continue;
      if (e.target.closest && e.target.closest('[data-trichter]') && zst.wurzel.contains(e.target)) continue;
      listePopupZu(zst);
    }
  }, true);
}

/* Headless-Tests (Node) pruefen die Helfer ohne DOM. */
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { listeKreuzRechnen, listeKreuzText, listeAenderungPlan, listeEingabeLesen, listeMassenFn, listeAenderArten, LISTE_BAUSTEIN_VERSION, LISTE_VERGLEICHE, LISTE_SUMMEN, listeSumme, listeSummeText, listeMarkiert, listeCsvFeld, listeZahl, listeAnzeige, listeBedingungPasst, listeFilterPasst, listeFilterText, listeVergleich, listeWertVergleich, listeSpaltenPfad, listeSpaltenBaum, listeBaumSpalten, listeEigenschaftsSpalten, listeIstTechnischeZahl, listeEigenschaftWert };
}
