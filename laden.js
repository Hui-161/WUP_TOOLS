/* Herunterladen von Werkzeugen und Beispieldateien.
   Der Dateiname bekommt die Version des Werkzeugs und Datum und Uhrzeit des
   Herunterladens, z. B. wup_editor_v2.65_2026-11-13_1432.html. Versionen und
   Beispielliste stehen in downloads.json (vom Export erzeugt). Ohne Skript
   oder ohne downloads.json bleiben es gewöhnliche Links. */
(function () {
  'use strict';
  var basis = document.currentScript.getAttribute('data-basis') || '';
  var deutsch = document.documentElement.lang !== 'en';

  function zwei(n) { return (n < 10 ? '0' : '') + n; }
  function stempel(d) {
    return d.getFullYear() + '-' + zwei(d.getMonth() + 1) + '-' + zwei(d.getDate()) + '_' + zwei(d.getHours()) + zwei(d.getMinutes());
  }
  function speichern(blob, name) {
    var url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
  }
  function holen(pfad) {
    return fetch(basis + pfad).then(function (r) {
      if (!r.ok) throw new Error(pfad + ': ' + r.status);
      return r.arrayBuffer();
    });
  }
  function meldung(text) {
    var m = document.getElementById('ladenMeldung');
    if (m) m.textContent = text;
  }

  /* ---- ZIP ohne Kompression (Methode 0), Namen in UTF-8 ---- */
  var CRC = (function () {
    var t = new Uint32Array(256);
    for (var n = 0; n < 256; n++) { var c = n; for (var k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
    return t;
  })();
  function crc32(b) { var c = 0xFFFFFFFF; for (var i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
  function zip(eintraege, d) {
    var zeit = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1);
    var datum = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
    var teile = [], zentral = [], versatz = 0, enc = new TextEncoder();
    eintraege.forEach(function (e) {
      var name = enc.encode(e.name), daten = new Uint8Array(e.daten), crc = crc32(daten);
      var kopf = new DataView(new ArrayBuffer(30));
      kopf.setUint32(0, 0x04034b50, true); kopf.setUint16(4, 20, true); kopf.setUint16(6, 0x0800, true);
      kopf.setUint16(8, 0, true); kopf.setUint16(10, zeit, true); kopf.setUint16(12, datum, true);
      kopf.setUint32(14, crc, true); kopf.setUint32(18, daten.length, true); kopf.setUint32(22, daten.length, true);
      kopf.setUint16(26, name.length, true); kopf.setUint16(28, 0, true);
      teile.push(kopf.buffer, name, daten);
      var z = new DataView(new ArrayBuffer(46));
      z.setUint32(0, 0x02014b50, true); z.setUint16(4, 20, true); z.setUint16(6, 20, true); z.setUint16(8, 0x0800, true);
      z.setUint16(10, 0, true); z.setUint16(12, zeit, true); z.setUint16(14, datum, true);
      z.setUint32(16, crc, true); z.setUint32(20, daten.length, true); z.setUint32(24, daten.length, true);
      z.setUint16(28, name.length, true); z.setUint32(42, versatz, true);
      zentral.push(z.buffer, name);
      versatz += 30 + name.length + daten.length;
    });
    var groesse = zentral.reduce(function (s, t) { return s + (t.byteLength || t.length); }, 0);
    var ende = new DataView(new ArrayBuffer(22));
    ende.setUint32(0, 0x06054b50, true); ende.setUint16(8, eintraege.length, true); ende.setUint16(10, eintraege.length, true);
    ende.setUint32(12, groesse, true); ende.setUint32(16, versatz, true);
    return new Blob(teile.concat(zentral, [ende.buffer]), { type: 'application/zip' });
  }

  fetch(basis + 'downloads.json').then(function (r) { return r.json(); }).then(function (d) {
    var werkzeuge = {};
    d.werkzeuge.forEach(function (w) { werkzeuge[w.id] = w; });
    document.querySelectorAll('[data-version]').forEach(function (el) {
      var w = werkzeuge[el.getAttribute('data-version')]; if (w) el.textContent = w.version;
    });
    document.querySelectorAll('a[data-werkzeug]').forEach(function (a) {
      var w = werkzeuge[a.getAttribute('data-werkzeug')]; if (!w) return;
      a.addEventListener('click', function (ev) {
        ev.preventDefault();
        holen(w.datei).then(function (b) {
          speichern(new Blob([b], { type: 'text/html' }), w.name + '_v' + w.version + '_' + stempel(new Date()) + '.html');
        }).catch(function () { location.href = basis + w.datei; });
      });
    });

    var tabelle = document.getElementById('beispiele');
    if (tabelle) {
      var zeilen = d.beispiele.map(function (b) {
        var name = b.pfad.split('/').pop();
        return '<tr><td><a href="' + basis + d.beispielOrdner + '/' + b.pfad + '" data-beispiel="' + b.pfad + '">' + name + '</a></td>'
          + '<td>' + b.stil + '</td><td>' + b.inhalt + '</td><td class="nr">' + (b.bytes / 1024).toFixed(1).replace('.', deutsch ? ',' : '.') + ' kB</td></tr>';
      }).join('');
      tabelle.innerHTML = '<thead><tr><th>' + (deutsch ? 'Datei' : 'File') + '</th><th>' + (deutsch ? 'Stil' : 'Style')
        + '</th><th>' + (deutsch ? 'Inhalt' : 'Content') + '</th><th></th></tr></thead><tbody>' + zeilen + '</tbody>';
      tabelle.hidden = false;
      tabelle.addEventListener('click', function (ev) {
        var a = ev.target.closest('a[data-beispiel]'); if (!a) return;
        ev.preventDefault();
        var pfad = a.getAttribute('data-beispiel'), name = pfad.split('/').pop(), punkt = name.lastIndexOf('.');
        holen(d.beispielOrdner + '/' + pfad).then(function (b) {
          speichern(new Blob([b], { type: 'application/octet-stream' }), name.slice(0, punkt) + '_' + stempel(new Date()) + name.slice(punkt));
        }).catch(function () { location.href = a.href; });
      });
    }

    document.querySelectorAll('[data-beispiele-zip]').forEach(function (knopf) {
      knopf.hidden = false;
      knopf.addEventListener('click', function () {
        knopf.disabled = true;
        meldung(deutsch ? 'Wird zusammengestellt …' : 'Preparing …');
        var liste = d.beispiele.map(function (b) { return b.pfad; }).concat(['README.md']);
        Promise.all(liste.map(function (p) { return holen(d.beispielOrdner + '/' + p); })).then(function (inhalte) {
          var jetzt = new Date();
          speichern(zip(liste.map(function (p, i) { return { name: 'wup_beispieldateien/' + p, daten: inhalte[i] }; }), jetzt),
            'wup_beispieldateien_' + stempel(jetzt) + '.zip');
          meldung('');
        }).catch(function (e) {
          meldung((deutsch ? 'Herunterladen fehlgeschlagen: ' : 'Download failed: ') + e.message);
        }).then(function () { knopf.disabled = false; });
      });
    });
  }).catch(function () { /* ohne downloads.json bleiben es einfache Links */ });
})();
