/* =====================================================================
   GERAETEBELEGUNG (v2.62) — welches Nagel-/Klammergeraet hinter welchem
   NR-Index steht und welchen Sicherheitsabstand Auto-Sperrflaechen dafuer
   rechnet. Je Anlage verschieden, deshalb ein eigener Dialog:
     - oeffnet sich beim Start, solange im Profil KEINE Geraete stehen
       (sonst meldet P-20 jede Nagelreihe als unbekannt),
     - jederzeit ueber Befehlspalette und Automatik-Einstellungen.
   "Beispiel einsetzen" fuellt NR_INDIZES_BEISPIEL (02_maschinenprofil.js).
   ===================================================================== */

/* Reine Pruefung der Dialogzeilen (ohne DOM — headless testbar).
   zeilen: [{ index, name, offset }] als Texte. Ganz leere Zeilen zaehlen
   nicht. Jede ungueltige Zeile wird BENANNT; der Aufrufer speichert dann
   nichts (nie still verwerfen, nie auf einen Ersatzwert ausweichen). */
function geraeteZeilenPruefen(zeilen) {
  const belegung = {}, verworfen = [];
  (zeilen || []).forEach((z, nr) => {
    const index = String(z.index == null ? '' : z.index).trim();
    const name = String(z.name == null ? '' : z.name).trim();
    const offset = String(z.offset == null ? '' : z.offset).trim().replace(',', '.');
    if (index === '' && name === '' && offset === '') return;
    const wo = 'Zeile ' + (nr + 1);
    if (!/^\d+$/.test(index)) { verworfen.push(wo + ': NR-Index "' + index + '" ist keine ganze Zahl ab 0'); return; }
    const schluessel = String(parseInt(index, 10));
    if (belegung[schluessel]) { verworfen.push(wo + ': NR-Index ' + schluessel + ' steht doppelt in der Liste'); return; }
    const abstand = parseFloat(offset);
    if (offset === '' || isNaN(abstand) || !/^\d+(\.\d+)?$/.test(offset)) {
      verworfen.push(wo + ' (Index ' + schluessel + '): Sperrflächen-Abstand fehlt oder ist keine Zahl ab 0');
      return;
    }
    belegung[schluessel] = { name: name, psf_offset: abstand };
  });
  return { belegung: belegung, verworfen: verworfen };
}

function geraeteAbfrageNoetig() {
  return !Object.keys(profil.nr_indizes || {}).length;
}

function geraetebelegungBeimStart() {
  if (geraeteAbfrageNoetig()) geraetebelegungOeffnen(true);
}

function geraetebelegungOeffnen(beimStart) {
  document.querySelectorAll('.modal-hintergrund').forEach(m => m.remove());
  const hg = document.createElement('div');
  hg.className = 'modal-hintergrund';
  hg.id = 'geraeteDialog';
  hg.innerHTML =
    '<div class="modal-fenster" role="dialog" aria-label="Gerätebelegung">'
    + '<h2>Gerätebelegung' + (beimStart ? ' einrichten' : '') + '</h2>'
    + '<div class="modal-untertitel">Welches Nagel- oder Klammergerät steht an der Anlage hinter welchem '
    + 'NR-Index (letzter Wert einer NR-Zeile)? Der Sperrflächen-Abstand ist der Sicherheitsabstand, den '
    + 'Auto-Sperrflächen um eine Nagelreihe dieses Geräts legt. Es können beliebig viele Geräte eingetragen '
    + 'werden; welche Indizes es gibt, legt die Anlage fest. Die Belegung steht in den Herstellerunterlagen der Anlage und gilt '
    + 'für diesen Browser.</div>'
    + (beimStart
      ? '<div class="modal-untertitel"><b>Noch keine Geräte hinterlegt.</b> Ohne Belegung meldet die Prüfung '
        + 'P-20 jede Nagelreihe als unbekannt, und Auto-Sperrflächen rechnet überall mit dem vorsichtigen '
        + 'Sperrflächen-Abstand von ' + profil.default_offset_unbekannt + ' mm.</div>'
      : '')
    + '<table class="modal-tabelle"><thead><tr><th>NR-Index</th><th>Bezeichnung</th><th>Sperrflächen-Abstand</th><th></th></tr></thead>'
    + '<tbody id="geraeteZeilen"></tbody></table>'
    + '<div class="modal-abschnitt">'
    + '<button class="schaltflaeche schaltflaeche-neben schaltflaeche-klein" data-geraete="neu">+ Gerät</button> '
    + '<button class="schaltflaeche schaltflaeche-neben schaltflaeche-klein" data-geraete="beispiel">Beispiel einsetzen</button>'
    + ' <span class="mini-hinweis">Das Beispiel zeigt die Geräte EINER Anlage, andere Anlagen haben andere und mehr — vor dem Speichern an die eigene anpassen.</span>'
    + '</div>'
    + '<div class="mini-hinweis" id="geraeteMeldung" role="alert"></div>'
    + '<div class="modal-fuss">'
    + '<button class="schaltflaeche schaltflaeche-neben schaltflaeche-klein" data-geraete="abbrechen">'
    + (beimStart ? 'Später' : 'Abbrechen') + '</button>'
    + '<button class="schaltflaeche schaltflaeche-haupt schaltflaeche-klein" data-geraete="speichern">Speichern</button>'
    + '</div></div>';
  document.body.appendChild(hg);
  const tbody = hg.querySelector('#geraeteZeilen');
  const meldung = hg.querySelector('#geraeteMeldung');

  const zeileAnhaengen = (index, name, offset) => {
    const tr = document.createElement('tr');
    tr.innerHTML =
      '<td><input type="number" min="0" step="1" data-feld="index" style="width:5em" aria-label="NR-Index"></td>'
      + '<td><input type="text" data-feld="name" style="width:22em" aria-label="Bezeichnung"></td>'
      + '<td style="white-space:nowrap"><input type="number" min="0" step="0.5" data-feld="offset" style="width:5em" aria-label="Sperrflächen-Abstand in mm"> mm</td>'
      + '<td><button class="schaltflaeche schaltflaeche-neben schaltflaeche-klein" data-geraete="weg" '
      + 'title="Gerät aus der Liste nehmen" aria-label="Gerät aus der Liste nehmen">✕</button></td>';
    tr.querySelector('[data-feld="index"]').value = index == null ? '' : index;
    tr.querySelector('[data-feld="name"]').value = name == null ? '' : name;
    tr.querySelector('[data-feld="offset"]').value = offset == null ? '' : offset;
    tbody.appendChild(tr);
    return tr;
  };
  const fuellen = belegung => {
    tbody.innerHTML = '';
    Object.keys(belegung || {}).map(Number).sort((a, b) => a - b).forEach(i =>
      zeileAnhaengen(i, belegung[i].name || '', belegung[i].psf_offset));
  };
  const zeilenLesen = () => Array.from(tbody.querySelectorAll('tr')).map(tr => ({
    index: tr.querySelector('[data-feld="index"]').value,
    name: tr.querySelector('[data-feld="name"]').value,
    offset: tr.querySelector('[data-feld="offset"]').value
  }));
  const hatEingaben = () => zeilenLesen().some(z => (z.index + z.name + z.offset).trim() !== '');

  fuellen(profil.nr_indizes);
  if (!tbody.children.length) zeileAnhaengen();

  const schliessen = () => hg.remove();
  hg.addEventListener('click', ev => {
    const knopf = ev.target.closest('[data-geraete]');
    if (!knopf) return;
    const was = knopf.dataset.geraete;
    if (was === 'abbrechen') { schliessen(); return; }
    if (was === 'neu') { zeileAnhaengen().querySelector('input').focus(); return; }
    if (was === 'weg') { knopf.closest('tr').remove(); return; }
    if (was === 'beispiel') {
      const einsetzen = () => { fuellen(NR_INDIZES_BEISPIEL); meldung.textContent = 'Beispielbelegung eingesetzt — noch nicht gespeichert.'; };
      if (hatEingaben()) bestaetigen('Die eingetragenen Geräte durch die Beispielbelegung ersetzen?', 'Ersetzen', einsetzen);
      else einsetzen();
      return;
    }
    if (was === 'speichern') {
      const erg = geraeteZeilenPruefen(zeilenLesen());
      if (erg.verworfen.length) {
        meldung.textContent = 'Nicht gespeichert — ' + erg.verworfen.join('; ') + '.';
        return;
      }
      profil.nr_indizes = erg.belegung;
      profilSichern();
      schliessen();
      if (modell) { pruefungenAusfuehren(); alleNeuRendern(true); }
      const anzahl = Object.keys(erg.belegung).length;
      if (anzahl) hinweisAnzeigen('Gerätebelegung gespeichert: ' + anzahl + ' Gerät(e).', 'erfolg');
      else hinweisAnzeigen('Gerätebelegung ist leer gespeichert — die Prüfung meldet jede Nagelreihe als unbekannt.', 'warnung');
    }
  });
}
