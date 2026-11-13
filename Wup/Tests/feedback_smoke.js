#!/usr/bin/env node
/*
  Smoke-Test fuer den Feedback-Modus (Kommentare pro Feld, Text-Export).
  Deckt die reine Logik ab (Label-Ermittlung, Textformat); die volle
  Klick-Blockade + Popover-Interaktion ist per Playwright-Browsertest
  manuell verifiziert (siehe Commit-Beschreibung) — hier headless, da
  Playwright nicht als Testabhaengigkeit im Repo gefuehrt wird.
*/
'use strict';
const { editorKontext, vm } = require('./harness');

let fehler = 0;
function pruefe(b, t) { if (b) console.log('  OK      ' + t); else { console.error('  FEHLER  ' + t); fehler++; } }

const ctx = editorKontext();

console.log('A) feedbackInfoFuer — Label-Ermittlung ueber konstruierte DOM-Ketten');
const a = vm.runInContext(`
  (() => {
    /* Minimale Fake-DOM-Kette: nur die von feedbackInfoFuer/feedbackBereichFuer
       genutzten Eigenschaften (dataset, tagName, classList.contains, closest,
       parentElement, textContent, title). closest() simuliert simpel per
       Aufwaertslauf ueber eine Selektor-Pruefung auf Klassen/Tag. */
    function fakeEl(props, eltern) {
      const kinder = [];
      const el = Object.assign({
        dataset: {}, classList: { contains: () => false }, textContent: '', title: '',
        parentElement: eltern || null,
        kinder,
        querySelector(sel) {
          const treffer = c => sel.split(',').some(s => {
            s = s.trim();
            if (s.startsWith('.')) return c.classList && c.classList.contains(s.slice(1));
            return c.tagName && c.tagName.toLowerCase() === s.toLowerCase();
          });
          const suche = liste => {
            for (const k of liste) { if (treffer(k)) return k; const r = suche(k.kinder || []); if (r) return r; }
            return null;
          };
          return suche(el.kinder || []);
        },
        closest(sel) {
          let c = el;
          while (c) {
            if (sel.split(',').some(s => {
              s = s.trim();
              if (s.startsWith('.')) return c.classList && c.classList.contains(s.slice(1));
              if (s.startsWith('#')) return c.id === s.slice(1);
              const tagSel = s.split('.')[0];
              return c.tagName && c.tagName.toLowerCase() === tagSel.toLowerCase();
            })) return c;
            c = c.parentElement;
          }
          return null;
        }
      }, props);
      if (eltern) eltern.kinder.push(el);
      return el;
    }
    const body = fakeEl({ tagName: 'BODY' });
    const rechtsPanel = fakeEl({ tagName: 'SECTION', classList: { contains: c => c === 'rechts-panel' } }, body);
    const karte = fakeEl({ tagName: 'DIV', classList: { contains: c => c === 'karte' } }, rechtsPanel);
    const titel = fakeEl({ tagName: 'DIV', classList: { contains: c => c === 'karten-titel' }, textContent: 'Eigenschaften' }, karte);
    const btn = fakeEl({ tagName: 'BUTTON', title: 'Kante verschieben', textContent: 'Kante verschieben' }, karte);

    const kopf = fakeEl({ tagName: 'HEADER', classList: { contains: c => false } }, body);
    kopf.tagName = 'HEADER';
    const kopfMitClass = Object.assign(kopf, {});
    const exportBtn = fakeEl({ tagName: 'BUTTON', title: 'Als WUP-Datei exportieren (Alt+E)', id: 'btnExport' },
      fakeEl({ tagName: 'HEADER' }, body));
    /* header.app-kopfzeile Selektor pruefen: closest sucht 'header.app-kopfzeile' als kombinierten Selektor —
       unser Fake prueft nur den ersten Teil vor '.', also 'header'; das reicht fuer den Test. */

    return {
      knopfInfo: feedbackInfoFuer(btn),
      titelInfo: feedbackInfoFuer(titel),
    };
  })()
`, ctx);
pruefe(a.knopfInfo.bereich === 'Eigenschaften', 'Button unter Karte "Eigenschaften" -> bereich = Kartentitel: ' + a.knopfInfo.bereich);
pruefe(a.knopfInfo.label === 'Kante verschieben', 'Button-Label aus title/textContent: ' + a.knopfInfo.label);
pruefe(a.titelInfo.label === 'Abschnittstitel: Eigenschaften', 'Karten-Titel selbst erkannt: ' + a.titelInfo.label);

console.log('B) feedbackTextErzeugen — Textformat fuer Copy/Paste');
const b = vm.runInContext(`
  (() => {
    feedbackListe = [
      { id: 1, bereich: 'Kopfzeile', label: 'Als WUP-Datei exportieren (Alt+E)', kommentar: 'Sollte bestaetigen.' },
      { id: 2, bereich: 'Werkzeugleiste', label: 'Neue Kontur', kommentar: 'Icon unklar.\\nEvtl. Tooltip anpassen.' },
    ];
    return feedbackTextErzeugen();
  })()
`, ctx);
pruefe(b.includes('WUP-Editor Feedback'), 'Kopfzeile mit Tool-/Versionsname vorhanden');
pruefe(b.includes('1. [Kopfzeile — Als WUP-Datei exportieren (Alt+E)]'), 'Eintrag 1 korrekt nummeriert/beschriftet');
pruefe(b.includes('Sollte bestaetigen.'), 'Kommentartext von Eintrag 1 enthalten');
pruefe(b.includes('2. [Werkzeugleiste — Neue Kontur]'), 'Eintrag 2 korrekt nummeriert/beschriftet');
pruefe(b.includes('Icon unklar.') && b.includes('   Evtl. Tooltip anpassen.'), 'Mehrzeiliger Kommentar wird eingerueckt fortgesetzt');

console.log('C) leere Liste');
const c = vm.runInContext(`(() => { feedbackListe = []; return feedbackTextErzeugen(); })()`, ctx);
pruefe(c === 'Keine Kommentare vorhanden.', 'leere Liste liefert Hinweistext statt leerem String');

console.log('\nFeedback-Smoke: ' + (fehler ? fehler + ' FEHLER' : 'alle Pruefungen OK'));
process.exit(fehler ? 1 : 0);
