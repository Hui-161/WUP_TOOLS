/*
  Modul:     Konfiguration des WUP MCP-Servers
  Zweck:     Alles, was an der eigenen Anlage und an der Ablage dieses Repos
             haengt, steht hier und nur hier: Servertitel, Vorgabe-Ordner und
             Beispielpfad, Schreibsperre, die Dokumentquellen von
             wup_spezifikation, ein optionaler Anlagen-Hinweis, die Version der
             Anlage, anlagenspezifische Textbausteine der Referenz
             (wup_referenz) und die Ressourcenliste.

  Diese Fassung ist neutral: Sie kennt nur die Dokumente, die Weinmann selbst
  unter MIT veroeffentlicht hat (github.com/HomagGroup/WEINMANN-wupWorks,
  abgelegt unter "Wup/02_Schnittstellenbeschreibung etc/Weinmann-wupWorks",
  siehe dort HERKUNFT.md und LICENSE). Maschinenspezifische Werte stehen in
  den Unterlagen der eigenen Anlage.

  Anpassen:  - Eigene Dokumente als weitere Eintraege unter 'quellen' fuehren
               (Dateien relativ zu "Wup/02_Schnittstellenbeschreibung etc").
               Eine Quelle, die hier nicht steht, kennt der Server nicht.
             - 'anlage' und die Textbausteine unter 'texte' mit den Angaben
               der eigenen Anlage fuellen. Die Bausteine setzt der Server
               WOERTLICH an festen Stellen ein; ein fehlender Baustein ist ein
               leerer Text.
             - Die Geraetebelegung (welches Nagel-/Klammergeraet hinter welchem
               NR-Index steht) gehoert NICHT hierher, sondern in die
               Profildatei: Wup/Mcp/profil.json oder Umgebungsvariable
               WUP_PROFIL (Wup/Mcp/README.md).

  Nur Daten, keine Logik. CommonJS, keine Abhaengigkeiten.
*/
'use strict';

/* Neutraler Satz fuer alle Stellen, an denen sonst Angaben der Anlage stehen */
const ANLAGE_NEUTRAL = 'Maschinenspezifische Werte stehen in den Unterlagen der eigenen Anlage.';

module.exports = {
  /* serverInfo.title und der Namensteil der instructions
     ("WUP-Fachlogik des <editorName> v…") */
  servertitel: 'WUP-Werkzeuge',
  editorName: 'WUP-Editors',

  /* Vorgabe fuer wup_ordner_pruefen und wup_server_status (Referenzdateien)
     und der Beispielpfad in den Tool-Beschreibungen — relativ zum Repo-Root */
  vorgabeOrdner: 'Wup/03_Beispiel-synthetisch',
  beispielPfad: '',

  /* Ordner, in die der Server NIE schreibt (relativ zum Repo-Root) */
  schreibsperre: ['Wup/wup_editor', 'Wup/wup_editor_oversight', 'Wup/Mcp', 'Wup/Tests', 'Wup/03_Beispiel-synthetisch',
    'Wup/02_Schnittstellenbeschreibung etc', 'Werkzeuge', '.git'],

  /* Version der eigenen Anlage — hier unbekannt.
       version      Anzeige in Tool-Beschreibungen, z.B. '3.5'
       keywordsBis  Keywords, die NACH dieser Version eingefuehrt wurden, fuehrt
                    wup_datei_analysieren unter 'neuerAlsAnlage' (null = aus)
       versionMin   Dateien darunter bekommen den Hinweis texte.plausibelAelter
       versionMax   Dateien darueber bekommen den Hinweis texte.plausibelNeuer */
  anlage: { version: '', keywordsBis: null, versionMin: null, versionMax: 3.7 },

  /* Hinweis zur Zuordnung von Unterlagen zur Anlage (leer = keiner) */
  anlagenHinweis: '',

  /* Dokumentquellen von wup_spezifikation.
       seitenVon               erste durchsuchte Seite
       zusatz                  true = nicht Teil von 'beide', nur auf Wunsch
       versionsHinweis         liegt jeder Antwort aus dieser Quelle bei
       anlagenHinweis          true = Suchen tragen den Anlagen-Hinweis
       einzelbilderUndTabellen true = es gibt Einzelbilder und Tabellen dazu */
  quellen: {
    schnittstellenbeschreibung: {
      titel: 'Weinmann Schnittstellenbeschreibung V3.5 (8-482-47-2053, deutsch, MIT — HomagGroup/WEINMANN-wupWorks: Interface_version_3_5_DEU.pdf)',
      dateien: ['Weinmann_Schnittstellenbeschreibung.pdf'],
      seitenVon: 1,
    },
    schnittstellenbeschreibung_3_7: {
      titel: 'Weinmann Interface version 3.7 (Stand 06/08/2026, englisch, MIT — HomagGroup/WEINMANN-wupWorks)',
      dateien: ['Weinmann-wupWorks/Interface_version_3_7.pdf'],
      seitenVon: 1,
      einzelbilderUndTabellen: true,
      versionsHinweis: 'Gilt fuer WUP 3.7 ("preliminary"). Welche Version die eigene Anlage verarbeitet, steht in ihren Unterlagen.',
    },
  },

  /* SiteBroker-Dokumente (Markdown, keine Seiten): quelle 'sitebroker' */
  sitebroker: {
    ordner: 'Weinmann-wupWorks/sitebroker',
    titel: 'Weinmann SiteBroker — sechs Markdown-Dokumente (MIT, HomagGroup/WEINMANN-wupWorks)',
  },

  /* MCP-Ressourcen (wup-doku://…), relativ zum Repo-Root. Fehlendes nennt
     wup_server_status. */
  ressourcen: [
    { rel: 'Wup/02_Schnittstellenbeschreibung etc/Weinmann-wupWorks/HERKUNFT.md', name: 'Weinmann wupWorks — Herkunft und Lizenz', beschreibung: 'Woher die 3.7-Spezifikation und die SiteBroker-Dokumente stammen (HomagGroup/WEINMANN-wupWorks, Commit, MIT), was uebernommen ist und was nicht' },
    { rel: 'Wup/02_Schnittstellenbeschreibung etc/Weinmann-wupWorks/LICENSE', name: 'MIT-Lizenz der Weinmann-Dokumente', beschreibung: 'Lizenztext (Copyright 2026 WEINMANN Holzbautechnik GmbH) — muss bei Weitergabe beiliegen' },
    { rel: 'Wup/02_Schnittstellenbeschreibung etc/Weinmann-wupWorks/Interface_version_3_7.md', name: 'Weinmann Interface version 3.7 (Markdown)', beschreibung: 'Vollstaendige WUP-Spezifikation 3.7, englisch, Stand 06/08/2026; seitenweise mit Bild: wup_spezifikation quelle=schnittstellenbeschreibung_3_7' },
    { rel: 'Wup/02_Schnittstellenbeschreibung etc/Weinmann-wupWorks/sitebroker/General_Concept.md', name: 'SiteBroker — Grundkonzept', beschreibung: 'MQTT fuer Befehle/Status, REST + Central Database fuer Daten, Rollen, Einsatzformen (nur fuer ausgewaehlte Maschinen)' },
    { rel: 'Wup/02_Schnittstellenbeschreibung etc/Weinmann-wupWorks/sitebroker/Interface_Specification.md', name: 'SiteBroker — Schnittstellenspezifikation', beschreibung: 'Topics, Payload, Statusmodelle (Order/Batch/Run), Clear-Mechanismus, Konfiguration' },
    { rel: 'Wup/02_Schnittstellenbeschreibung etc/Weinmann-wupWorks/sitebroker/Data_Specification.md', name: 'SiteBroker — Telemetrie', beschreibung: 'Maschinenzustand, Zaehler, Meldungen, Lager, Werkzeuge, Fortschritt je Batch-Variante' },
    { rel: 'Wup/02_Schnittstellenbeschreibung etc/Weinmann-wupWorks/sitebroker/Integration_Guide.md', name: 'SiteBroker — Integrationsleitfaden', beschreibung: 'Einbindung eines eigenen Clients (.NET-Bibliothek), Fehlerbehandlung, Checkliste' },
    { rel: 'Wup/02_Schnittstellenbeschreibung etc/Weinmann-wupWorks/sitebroker/Integration_ManualWorkstation.md', name: 'SiteBroker — Handarbeitsplatz', beschreibung: 'Anbindung eines manuellen Arbeitsplatzes mit eigener Dokumentdatenbank' },
    { rel: 'Wup/02_Schnittstellenbeschreibung etc/Weinmann-wupWorks/sitebroker/Demo_Application.md', name: 'SiteBroker — Demo-Anwendungen', beschreibung: 'Demo-Maschine und Demo-MES aus dem Weinmann-Repo (dort, nicht hier abgelegt)' },
    { rel: 'Wup/Mcp/README.md', name: 'MCP-Server-Anleitung', beschreibung: 'Registrierung, Tools, Konfiguration und Profil, Schutzregeln dieses Servers' },
  ],

  /* Textbausteine. Der Server setzt sie woertlich ein; wo, steht am Baustein.
     Nicht genannte Bausteine sind leer. */
  texte: {
    /* --- initialize: instructions --- */
    instructionsQuellen: 'wup_spezifikation: Weinmann Interface version 3.7 und SiteBroker samt Einzelbildern und strukturierten Tabellen',
    instructionsAnlage: '',

    /* --- Tool-Beschreibungen (tools/list) --- */
    toolReferenzVersionslage: 'WUP-Versionslage (Spezifikationen 3.5 bis 3.7)',
    toolReferenzWarnung: '',
    toolSpezifikationQuellen: 'Weinmann Interface version 3.7 (49 Seiten, englisch, von Weinmann unter MIT veroeffentlicht) — das ist '
      + '"beide"; "sitebroker" sind die sechs SiteBroker-Dokumente, "alle" durchsucht alles. ' + ANLAGE_NEUTRAL,
    toolSpezifikationQuelleParam: 'Standard: beide (= Interface version 3.7). sitebroker = die sechs SiteBroker-Dokumente '
      + '(Abschnitte, Tabellen, Diagramme — keine Seiten); alle = alles',

    /* --- wup_datei_analysieren / wup_pruefen --- */
    /* nach "VERSION <x>" (Datei neuer als anlage.versionMax bzw. aelter als anlage.versionMin) */
    plausibelNeuer: ' ist neuer als die beiliegende Weinmann-Spezifikation 3.7 — vor dem Senden an der Anlage klaeren.',
    plausibelAelter: '',
    /* Feld versionslage.anlage (leer = Feld entfaellt) */
    versionslageAnlage: '',
    /* nach "Geraete-Klartext aus <Profil>" (leer = Punkt) */
    geraeteHinweis: '',

    /* --- wupworks_befehl: nach dem allgemeinen Hinweis --- */
    wupworksBefehl: '',

    /* --- wup_spezifikation --- */
    seiteNichtVerfuegbar: '',
    tabellenAndereQuellen: '',
    rechte: 'Rechte: Die Spezifikation 3.7 und die SiteBroker-Dokumente hat Weinmann unter MIT veroeffentlicht (LICENSE und '
      + 'HERKUNFT.md im Ordner Weinmann-wupWorks).',

    /* --- wup_referenz thema=quellen: der ganze Text --- */
    quellen:
      'Quellen-Hierarchie bei Widerspruechen:\n'
      + '1. Unterlagen der eigenen Anlage (Datenblatt des Herstellers, Abnahme) — ' + ANLAGE_NEUTRAL + '\n'
      + '2. Weinmann Schnittstellenbeschreibung V3.5 (deutsch) und Interface version 3.7 (englisch), beide von\n'
      + '   Weinmann unter MIT veroeffentlicht — durchsuchbar mit dem Tool wup_spezifikation, samt Seitenbildern;\n'
      + '   zur 3.7 auch Einzelbilder und Tabellen. Die 3.6 liegt hier nicht bei. Versionslage: thema versionen\n'
      + '3. Analyse eigener, real gefertigter Dateien\n'
      + '4. Die Pruefregeln und das Profil des Editors (live: thema pruefregeln, maschinenprofil)',

    /* --- thema=wupworks: nach "… multipart/form-data, Feld 'file'." --- */
    wupworks_stand: '\nAus dem Browser scheitert der Aufruf oft an CORS oder Mixed Content; unter Windows curl.exe\n'
      + "statt des PowerShell-Alias nehmen — dafuer der curl-Befehl, den das Tool 'wupworks_befehl' erzeugt.",

    /* --- thema=versionen --- */
    versionen_anlage: '- Anlage: ' + ANLAGE_NEUTRAL + '\n',
    versionen_spezifikationen:
      '- Spezifikationen: Weinmann hat 3.5/3.6/3.7 unter MIT veroeffentlicht (github.com/HomagGroup/WEINMANN-wupWorks,\n'
      + '  "preliminary"); hier liegen die V3.5 deutsch und die 3.7 englisch (Stand 06/08/2026) bei. Nachschlagen: wup_spezifikation.\n',
    versionen_regel1: 'Nichts ungeprueft senden, was neuer ist als die Version der eigenen Anlage — vorher eine Testdatei an\n'
      + 'der Anlage.',

    /* --- thema=sitebroker --- */
    sitebroker_bezug: '- Der Upload ueber POST :45070/api/1/documents (thema wupworks) ist in diesen Dokumenten NICHT beschrieben.',
  },
};
