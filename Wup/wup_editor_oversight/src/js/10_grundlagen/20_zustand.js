/* =====================================================================
   §3 ZUSTAND
   ===================================================================== */
/* dateien: [{ name, text, encoding, hatteBom, waende:[...], fehlerAnzahl, geaendert }] */
let dateien = [];
let sichtbarkeit = {
  bearbeitungen: { NR: true, PAF: true, PSG: true, PSF: true, PSZ: true, PML: true },
  lagen: {},  /* Lage-ID -> bool, dynamisch befuellt aus den geladenen Dateien */
  /* v0.16 (Anwenderwunsch 2026-11-10): Riegelwerk und Richtungsbohrung
     einzeln ausschaltbar — unabhaengig voneinander */
  riegel: true, richtung: true, bohrungen: true   /* bohrungen: alle BOZ/BOY/BOX ausser Richtung (v0.17) */
};
const RIEGEL_SCHALTER = [
  { schluessel: 'riegel', text: 'Riegelwerk', farbe: 'var(--svg-riegel-rand)',
    titel: 'Bauteile des Riegelwerks (Umrisse) ein-/ausblenden' },
  { schluessel: 'richtung', text: 'Richtungsbohrung', farbe: 'var(--akzent)',
    titel: 'Richtungsbohrung (BOZ Ø40 in Ober-/Untergurt, Abgleich BVN/BVX) ein-/ausblenden' },
  { schluessel: 'bohrungen', text: 'BOZ', farbe: 'var(--svg-bohrung)',
    titel: 'BOZ in Plattenlagen und uebrige Bohrungen am Riegelwerk (BOZ/BOY/BOX) ein-/ausblenden' }
];

const BEARBEITUNGS_TYPEN = ['NR', 'PAF', 'PSG', 'PSF', 'PSZ', 'PML'];
const BEARBEITUNGS_FARBEN = {
  NR: 'var(--svg-nr)', PAF: 'var(--svg-paf)', PSG: 'var(--svg-psg)',
  PSF: 'var(--svg-psf)', PSZ: 'var(--svg-psz)', PML: 'var(--svg-pml)'
};

/* Arbeitspaket 4: Mehrfachauswahl der Wand-Karten. Schluessel je Karte ist
   'dateiIndex:wandIndex' (stabil, solange Dateien nur angehaengt, nie entfernt
   werden - aktuell der einzige Fall). auswahlAnker ist der zuletzt aktiv
   angeklickte Schluessel (Basis fuer Shift-Bereich UND fuer die Anzeige im
   Quelltext/Struktur-Panel, Arbeitspaket 3). kartenReihenfolge wird bei jedem
   gitterRendern() in DOM-Reihenfolge neu aufgebaut (fuer Shift-Bereichsauswahl
   und Strg+A). */
let auswahl = new Set();
let auswahlAnker = null;
let kartenReihenfolge = [];

/* Arbeitspaket 3: Quelltext/Struktur-Panel der ausgewaehlten Karte (v1: zeigt
   immer die ganze Datei der zuletzt angeklickten Karte, kein Zeilen-Highlight
   je Wand - siehe Kopf-Kommentar im Panel-Rendern weiter unten). */
let quelltextTab = 'quelltext';
/* Struktur-Baum: welche Lagen-Knoten aufgeklappt sind (Id -> bool), je Datei
   zurueckgesetzt bei Auswahlwechsel auf eine andere Datei. */
let strukturOffen = {};

/* Arbeitspaket 2: Feedback-Modus, 1:1 aus wup_editor.html portiert (siehe dort
   "FEEDBACK-MODUS") - nur Speicher-Schluessel (ueber SPEICHER_PRAEFIX dieser
   Datei: 'wup_oversight_v1_feedbackListe') und Kopftext im exportierten Text
   unterscheiden sich. */
let feedbackModus = false;
let feedbackListe = speicherLaden('feedbackListe', []);
let feedbackZaehler = feedbackListe.reduce((m, e) => Math.max(m, e.id || 0), 0);
let feedbackBearbeitetId = null;
let feedbackAktuellesInfo = null;
let feedbackPanelEin = false;

