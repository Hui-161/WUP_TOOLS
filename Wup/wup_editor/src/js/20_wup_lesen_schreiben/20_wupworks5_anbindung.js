/* =====================================================================
   AP1: WUPWORKS5-ANBINDUNG (Grundstein)
   WupWorks5 (Weinmann-Maschinensoftware) nimmt WUP-Dateien per HTTP entgegen:
   POST http://<adresse>:<port>/api/1/documents, multipart/form-data Feld "file".
   Beispiel: curl -X POST http://localhost:45070/api/1/documents -F file=@C:\Temp\Test1.wup

   CORS-Realitaet: wir wissen NICHT, ob WupWorks5 CORS-Antwortheader sendet.
   Der fetch()-Weg unten ist der Grundstein (funktioniert sofort, wenn die
   Maschinensoftware CORS erlaubt oder der Editor selbst z.B. lokal ueber
   file:// ohne Same-Origin-Einschraenkung laeuft); schlaegt er fehl (Netzwerk-
   fehler ODER von CORS blockierte Antwort — beides landet im Browser als
   derselbe TypeError, nicht unterscheidbar), bleibt der curl-Befehl als
   garantierter Fallback, den der Nutzer manuell ausfuehren kann. */
function wupworksUrl() {
  const w = profil.wupworks || PROFIL_STANDARD.wupworks;
  return 'http://' + w.adresse + ':' + (w.port || PROFIL_STANDARD.wupworks.port) + '/api/1/documents';
}
/* Headless testbar: liefert den fertigen curl-Fallback-Befehl (nutzt den
   aktuellen Export-Dateinamen, damit der Nutzer ihn 1:1 aus dem zuvor
   heruntergeladenen Export uebernehmen kann). */
function wupworksCurlBefehl() {
  const w = profil.wupworks || PROFIL_STANDARD.wupworks;
  const name = modell ? exportDateinameBestimmen() : 'Test1.wup';
  return 'curl -X POST http://' + w.adresse + ':' + (w.port || PROFIL_STANDARD.wupworks.port)
    + '/api/1/documents -F file=@' + name;
}
function wupworksCurlKopieren() {
  const text = wupworksCurlBefehl();
  const ok = () => hinweisAnzeigen('curl-Befehl kopiert.', 'erfolg');
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(ok).catch(() => feedbackTextFallback(text));
  } else {
    feedbackTextFallback(text);
  }
}
function wupworksSenden() {
  const { bytes, name } = exportBytesErzeugen();
  const url = wupworksUrl();
  /* v2.53 (Anwenderfund am Anlagen-PC): Laeuft der Editor ueber https
     blockiert der Browser JEDE http://-Anfrage komplett
     (Mixed Content) — es wird gar nichts gesendet. Das klar sagen statt
     des raetselhaften "nicht erreichbar ODER CORS". */
  if (location.protocol === 'https:' && url.startsWith('http:')) {
    hinweisAnzeigen('Senden vom Browser BLOCKIERT (Mixed Content): Diese Seite laeuft ueber https, '
      + 'WupWorks5 nur ueber http — die Anfrage wird gar nicht erst abgeschickt. Auswege: (1) den Editor '
      + 'als HTML-Datei auf dem Anlagen-PC speichern und lokal oeffnen (Doppelklick), oder (2) den '
      + 'curl-Befehl aus den Export-Einstellungen kopieren und in der Eingabeaufforderung ausfuehren.', 'warnung');
    return;
  }
  const formData = new FormData();
  const datei = new Blob([bytes], { type: 'application/octet-stream' });
  formData.append('file', datei, name);
  fetch(url, { method: 'POST', body: formData }).then(res => {
    if (res.ok) {
      hinweisAnzeigen('An WupWorks5 gesendet: ' + name + ' (' + res.status + ' ' + (res.statusText || '') + ').', 'erfolg');
    } else {
      hinweisAnzeigen('WupWorks5 hat mit ' + res.status + ' ' + (res.statusText || '') + ' geantwortet - '
        + 'bitte pruefen. Alternativ curl-Befehl in den Export-Einstellungen kopieren.', 'warnung');
    }
  }).catch(() => {
    /* TypeError = Netzwerkfehler ODER von CORS verborgene Antwort — fuer
       das Script identisch. Ein multipart-POST ist aber ein CORS-"simple
       request": bei reiner CORS-Sperre wurde die Datei bereits UEBERTRAGEN,
       nur die Antwort bleibt unlesbar. Erreichbarkeit deshalb getrennt per
       no-cors-Ping pruefen (opake Antwort loest auf, sobald der Server
       ueberhaupt antwortet; nur echter Netzwerkfehler lehnt ab). */
    fetch(url, { method: 'GET', mode: 'no-cors' }).then(() => {
      hinweisAnzeigen('WupWorks5 ist ERREICHBAR, verbirgt aber die Antwort (keine CORS-Freigabe der '
        + 'Maschinensoftware). Die Datei ' + name + ' wurde sehr wahrscheinlich trotzdem uebertragen — '
        + 'Eingang in WupWorks5 pruefen und NICHT mehrfach senden. Weg mit echter Rueckmeldung: '
        + 'curl-Befehl aus den Export-Einstellungen.', 'warnung');
    }).catch(() => {
      hinweisAnzeigen('WupWorks5 nicht erreichbar (' + url + ') — laeuft die Maschinensoftware, stimmen '
        + 'Adresse und Port in den Export-Einstellungen? Alternativ curl-Befehl dort kopieren und manuell ausfuehren.', 'warnung');
    });
  });
}
function wupworksSendenKlick() {
  if (!modell) return;
  const w = profil.wupworks || PROFIL_STANDARD.wupworks;
  if (!w.adresse) { exportEinstellungenOeffnen(); hinweisAnzeigen('Bitte zuerst die Maschinen-Adresse eintragen.', 'info'); return; }
  pruefungenAusfuehren();
  const fehler = modell.pruefungen.filter(p => p.level === 'fehler');
  if (fehler.length)
    bestaetigen(fehler.length + ' FEHLER-Pruefung(en) offen (z.B. ' + fehler[0].code + '). Trotzdem an WupWorks5 senden?',
      'Trotzdem senden', wupworksSenden);
  else wupworksSenden();
}

/* P-4: Export-Einstellungen (Zahnrad neben Export) — Dateiname-Muster und
   ob die Diff-Ansicht vor dem Export gezeigt wird. Gleiches Modal-Muster
   wie automatikEinstellungenOeffnen(). */
function exportEinstellungenOeffnen() {
  if (!modell) return;
  document.querySelectorAll('.modal-hintergrund').forEach(m => m.remove());
  const exp = profil.export;
  const bearbeitetVorschau = dateinamenErstellen('WUP', [modell.header.ELN, modell.header.ZNR, 'bearbeitet'], 'wup');
  const originalVorschau = (modell.dateiName && modell.dateiName !== 'unbenannt.wup') ? modell.dateiName : bearbeitetVorschau;
  const hg = document.createElement('div');
  hg.className = 'modal-hintergrund';
  hg.innerHTML =
    '<div class="modal-fenster" role="dialog" aria-label="Export-Einstellungen">'
    + '<h2>Export-Einstellungen</h2>'
    + '<div class="modal-untertitel">Dateiname und Diff-Ansicht beim WUP-Export.</div>'

    + '<div class="karten-titel" style="margin-top:0">Dateiname</div>'
    + '<div class="modal-abschnitt" style="margin-top:0">'
    + '<label><input type="radio" name="expDateiname" value="original"'
    + (exp.dateiname !== 'bearbeitet' ? ' checked' : '') + '> Originalname beibehalten'
    + ' <span class="modal-untertitel" style="margin:0">(' + escapeHtml(originalVorschau) + ')</span></label>'
    + '<label><input type="radio" name="expDateiname" value="bearbeitet"'
    + (exp.dateiname === 'bearbeitet' ? ' checked' : '') + '> WUP_[ELN]_[ZNR]_bearbeitet'
    + ' <span class="modal-untertitel" style="margin:0">(' + escapeHtml(bearbeitetVorschau) + ')</span></label>'
    + '</div>'

    + '<div class="karten-titel" style="margin-top:16px">Vor dem Export</div>'
    + '<div class="modal-abschnitt"><label><input type="checkbox" id="expDiffZeigen"'
    + (exp.diffZeigen !== false ? ' checked' : '') + '> Diff-Ansicht vor Export zeigen</label></div>'

    + '<div class="karten-titel" style="margin-top:16px">WupWorks5</div>'
    + '<div class="modal-untertitel">Direkt-Versand an die Weinmann-Maschinensoftware per HTTP '
    + '(POST auf /api/1/documents). Ob der Browser das zulaesst, haengt von der CORS-Konfiguration der '
    + 'Maschine ab — der curl-Befehl unten funktioniert immer, notfalls manuell in einer Konsole ausfuehren.</div>'
    + '<div class="modal-abschnitt">'
    + '<label>Maschinen-Adresse (IP/Hostname): <input type="text" id="wwAdresse" placeholder="z.B. 192.168.1.50" '
    + 'value="' + escapeHtml(profil.wupworks.adresse || '') + '"></label>'
    + '<label>Port: <input type="number" min="1" step="1" id="wwPort" value="' + (profil.wupworks.port || PROFIL_STANDARD.wupworks.port) + '"></label>'
    + '<button class="schaltflaeche schaltflaeche-neben schaltflaeche-klein" data-exp-modal="ww-curl" style="margin-top:6px">📋 curl-Befehl kopieren</button>'
    + '</div>'

    + '<div class="modal-fuss">'
    + '<button class="schaltflaeche schaltflaeche-neben schaltflaeche-klein" data-exp-modal="abbrechen">Abbrechen</button>'
    + '<button class="schaltflaeche schaltflaeche-neben schaltflaeche-klein" data-exp-modal="standard">Standard</button>'
    + '<button class="schaltflaeche schaltflaeche-haupt schaltflaeche-klein" data-exp-modal="speichern">Speichern</button>'
    + '</div></div>';
  document.body.appendChild(hg);
  const schliessen = () => hg.remove();
  hg.addEventListener('click', ev => { if (ev.target === hg) schliessen(); });
  hg.querySelector('[data-exp-modal="abbrechen"]').addEventListener('click', schliessen);
  hg.querySelector('[data-exp-modal="standard"]').addEventListener('click', () => {
    hg.querySelector('input[name="expDateiname"][value="' + PROFIL_STANDARD.export.dateiname + '"]').checked = true;
    hg.querySelector('#expDiffZeigen').checked = PROFIL_STANDARD.export.diffZeigen !== false;
    hg.querySelector('#wwAdresse').value = PROFIL_STANDARD.wupworks.adresse;
    hg.querySelector('#wwPort').value = PROFIL_STANDARD.wupworks.port;
  });
  hg.querySelector('[data-exp-modal="ww-curl"]').addEventListener('click', () => {
    /* aktuellen Feldstand (noch ungespeichert) uebernehmen, damit der Befehl
       nicht erst nach "Speichern" die richtige Adresse zeigt, dann ueber die
       gemeinsame, headless testbare wupworksCurlBefehl() erzeugen. */
    profil.wupworks.adresse = hg.querySelector('#wwAdresse').value.trim();
    const port = parseInt(hg.querySelector('#wwPort').value, 10);
    profil.wupworks.port = (!isNaN(port) && port > 0) ? port : PROFIL_STANDARD.wupworks.port;
    wupworksCurlKopieren();
  });
  hg.querySelector('[data-exp-modal="speichern"]').addEventListener('click', () => {
    const gewaehlt = hg.querySelector('input[name="expDateiname"]:checked');
    profil.export.dateiname = gewaehlt && gewaehlt.value === 'bearbeitet' ? 'bearbeitet' : 'original';
    profil.export.diffZeigen = hg.querySelector('#expDiffZeigen').checked;
    profil.wupworks.adresse = hg.querySelector('#wwAdresse').value.trim();
    const port = parseInt(hg.querySelector('#wwPort').value, 10);
    profil.wupworks.port = (!isNaN(port) && port > 0) ? port : PROFIL_STANDARD.wupworks.port;
    profilSichern();
    schliessen();
    hinweisAnzeigen('Export-Einstellungen gespeichert.', 'erfolg');
  });
}

