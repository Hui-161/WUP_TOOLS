/* =====================================================================
   GERAETEBELEGUNG TEILEN (v0.21)
   Die Belegung der Nagel-/Klammergeraete gehoert zum Maschinenprofil des
   Editors (Browser-Speicher, Schluessel wup_editor_v1_profil). Der Kern in
   dieser Uebersicht liest dasselbe Profil — eingerichtet wird es im Editor.
     - Keine Geraete hinterlegt -> Hinweisleiste mit "Im Editor einrichten".
     - Speichert der Editor das Profil (storage-Ereignis), liest der Kern es
       neu ein und alle geladenen Dateien werden neu geprueft.
   ===================================================================== */
const PROFIL_SCHLUESSEL = 'wup_editor_v1_profil';

function geraeteFehlen() {
  return !!(kern && typeof kern.geraeteAbfrageNoetig === 'function' && kern.geraeteAbfrageNoetig());
}

function geraeteHinweisAktualisieren() {
  let leiste = document.getElementById('geraeteHinweis');
  if (!geraeteFehlen()) { if (leiste) leiste.remove(); return; }
  if (leiste) return;
  leiste = document.createElement('div');
  leiste.id = 'geraeteHinweis';
  leiste.setAttribute('role', 'status');
  leiste.style.cssText = 'padding:8px 16px;background:var(--warnung-hintergrund);border-left:4px solid var(--warnung);color:var(--text);'
    + 'border-bottom:1px solid var(--rahmen);font-size:0.85rem;display:flex;gap:12px;align-items:center;flex-wrap:wrap';
  const text = document.createElement('span');
  text.textContent = 'Noch keine Gerätebelegung hinterlegt: Die Prüfung meldet jede Nagelreihe als unbekannt (P-20). '
    + 'Die Belegung wird im Editor eingerichtet und gilt dann auch hier.';
  const knopf = document.createElement('button');
  knopf.type = 'button';
  knopf.className = 'schaltflaeche schaltflaeche-haupt schaltflaeche-klein';
  knopf.id = 'btnGeraeteEinrichten';
  knopf.textContent = 'Im Editor einrichten';
  knopf.addEventListener('click', () => { if (!editorInUmgebungZeigen()) window.open(editorPfad, '_blank'); });
  leiste.append(text, knopf);
  const haupt = document.getElementById('hauptbereich');
  haupt.parentNode.insertBefore(leiste, haupt);
}

/* Profil im Kern neu einlesen und alle Dateien neu pruefen. Rueckgabe:
   true, wenn neu eingelesen wurde. */
function profilAusEditorUebernehmen() {
  if (!kern || typeof kern.profilNeuLaden !== 'function') return false;
  kern.profilNeuLaden();
  for (let i = 0; i < dateien.length; i++) dateiAktualisieren(i);
  ansichtAktualisieren();
  geraeteHinweisAktualisieren();
  return true;
}

window.addEventListener('storage', ev => {
  if (ev.key !== PROFIL_SCHLUESSEL) return;
  if (profilAusEditorUebernehmen())
    hinweisAnzeigen('Maschinenprofil aus dem Editor übernommen' + (dateien.length ? ' — ' + dateien.length + ' Datei(en) neu geprüft.' : '.'), 'erfolg');
});
