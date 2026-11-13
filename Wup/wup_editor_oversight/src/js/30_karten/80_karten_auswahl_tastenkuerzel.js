/* =====================================================================
   §14 ARBEITSPAKET 4/5 — KARTEN-MEHRFACHAUSWAHL: KLICK-DELEGATE + TASTENKUERZEL
   ===================================================================== */
function kartenGitterEinrichten() {
  document.getElementById('kartenGitter').addEventListener('click', ev => {
    if (feedbackModus) return;   /* Feedback-Modus blockt normale Klicks selbst (capture-Phase) */
    if (ev.target.closest('button')) return;   /* "Im Editor öffnen" behandelt sich selbst */
    const karte = ev.target.closest('.karte');
    if (!karte) return;
    kartenKlick(karte.dataset.schluessel, ev);
  });
}
function quelltextPanelEinrichten() {
  document.getElementById('btnQuelltextZu').addEventListener('click', () => quelltextPanelUmschalten());
  document.querySelectorAll('#quelltextPanel .text-tab').forEach(tab =>
    tab.addEventListener('click', () => quelltextTabSetzen(tab.dataset.qtab)));
  document.getElementById('strukturInhalt').addEventListener('click', strukturKlick);
}
/* Arbeitspaket 5: Tastenkuerzel (Oversight) - 1=F1, 2=F2, 3=F3, 4=Auto-Kontur,
   Strg+H=Werte ersetzen, E=Alle exportieren, Q=Quelltext/Struktur-Panel,
   Esc=Auswahl leeren/Dialog zu; dazu Strg/Cmd+A fuer "alle Karten auswaehlen"
   (Arbeitspaket 4). Ziffern/Buchstaben-Kuerzel nur ausserhalb von Eingabe-
   feldern, damit z.B. "e" im Werte-ersetzen-Dialog normal getippt werden kann. */
function tastenkuerzelEinrichten() {
  document.addEventListener('keydown', ev => {
    const inEingabe = /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName);
    /* v0.13: Alt+Z / Alt+Y = Rueckgaengig / Wiederholen (wie im Editor) —
       nicht bei offenem Dialog, nicht beim Tippen in einem Feld. */
    if (ev.altKey && !ev.ctrlKey && !ev.metaKey && !ev.shiftKey && !inEingabe
        && document.getElementById('werteErsetzenModal').style.display !== 'flex'
        && !document.querySelector('.modal-hintergrund.grav-popup')) {
      const k = ev.key.toLowerCase();
      if (k === 'z') { ev.preventDefault(); rueckgaengig(); return; }
      if (k === 'y') { ev.preventDefault(); wiederholen(); return; }
    }
    /* v0.13: Strg/Cmd+F = Wand-Suche (nur mit geladenen Dateien, sonst
       bleibt die Browser-Suche) */
    if ((ev.ctrlKey || ev.metaKey) && !ev.altKey && ev.key.toLowerCase() === 'f' && dateien.length) {
      if (sucheFokussieren()) { ev.preventDefault(); return; }
    }
    if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'h') {
      ev.preventDefault(); werteErsetzenOeffnen(); return;
    }
    /* Angleichung an Editor v2.39: Strg/Cmd+K oeffnet/schliesst die Palette */
    if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'k') {
      ev.preventDefault();
      if (document.getElementById('palette').classList.contains('versteckt')) ovPaletteOeffnen();
      else ovPaletteSchliessen();
      return;
    }
    /* v0.19: in der Wandliste (Listen-Baustein) gelten dessen Tasten —
       Strg+A, Esc, Ziffern usw. nicht zusaetzlich als Uebersicht-Kuerzel */
    if (ev.target && ev.target.closest && ev.target.closest('.liste')) return;
    if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'a' && !inEingabe) {
      ev.preventDefault(); auswahlAlle();
      hinweisAnzeigen(auswahl.size + ' Karte(n) ausgewählt.', 'info');
      return;
    }
    if (ev.key === 'Escape') {
      if (!document.getElementById('palette').classList.contains('versteckt')) { ovPaletteSchliessen(); return; }
      if (!document.getElementById('kartenFilterMenue').classList.contains('versteckt')) {
        document.getElementById('kartenFilterMenue').classList.add('versteckt'); return;
      }
      if (!document.getElementById('automatikMenue').classList.contains('versteckt')) {
        document.getElementById('automatikMenue').classList.add('versteckt'); return;
      }
      kontextmenueSchliessen();
      const modal = document.getElementById('werteErsetzenModal');
      if (modal.style.display !== 'none') { modal.style.display = 'none'; return; }
      if (feedbackModus && !document.getElementById('feedbackPopover').classList.contains('versteckt')) {
        feedbackPopoverSchliessen(); return;
      }
      if (auswahlLeeren()) hinweisAnzeigen('Auswahl geleert.', 'info');
      return;
    }
    if (inEingabe || ev.ctrlKey || ev.metaKey || ev.altKey) return;
    const k = ev.key.toLowerCase();
    if (k === '1') { ev.preventDefault(); f1Klick(); }
    else if (k === '2') { ev.preventDefault(); f2Klick(); }
    else if (k === '3') { ev.preventDefault(); f3Klick(); }
    else if (k === '4') { ev.preventDefault(); autoKonturKlick(); }
    else if (k === 'e') { ev.preventDefault(); alleExportieren(); }
    else if (k === 'q') { ev.preventDefault(); quelltextPanelUmschalten(); }
  });
}

