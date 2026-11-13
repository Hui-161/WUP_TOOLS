# Weinmann wupWorks — übernommene Originaldokumente

Die Dateien in diesem Ordner stammen aus dem **offiziellen Weinmann-Repository**
und sind hier **unverändert** abgelegt (zwei Ausnahmen, siehe unten), damit der
WUP-MCP-Server sie offline durchsuchen kann.

| | |
|---|---|
| Quelle | `https://github.com/HomagGroup/WEINMANN-wupWorks` |
| Stand | Commit `c197d6df95aa09fa436ca5da7f32ff9d1a9d2982` vom 2026-07-17 („Release snapshot from release/public“) |
| Geholt | 2026-11-13, auf Zuruf des Anwenders |
| Lizenz | **MIT**, Copyright (c) 2026 WEINMANN Holzbautechnik GmbH — Wortlaut in `LICENSE` (muss bei jeder Weitergabe beiliegen) |
| Status laut Weinmann | „This is preliminary documentation and is subject to change.“ |

## Was hier liegt

| Datei | Herkunft im Weinmann-Repo | Bemerkung |
|---|---|---|
| `LICENSE` | `LICENSE` | byte-gleich |
| `Interface_version_3_7.pdf` | `Documentation/wup_specification/Interface_version_3_7.pdf` | byte-gleich (SHA-256 `4e91423c…7742`); 49 Seiten, Stand 06/08/2026, englisch |
| `Interface_version_3_7.md` | `Documentation/wup_specification/3_7/Interface_version_3_7.md` | **von ISO-8859-1 nach UTF-8 umkodiert** (drei Gradzeichen), sonst zeichengleich — Rückwandlung ist byte-gleich zum Original. Die Bildverweise zeigen auf `Interface_version_3_7_images/` und `image.png` (seit 2026-11-13 übernommen, nächste Zeilen). |
| `Interface_version_3_7_images/` (35 Dateien) | `Documentation/wup_specification/3_7/Interface_version_3_7_images/` | byte-gleich. Die **34 im Text eingebundenen** Bilder (33 PNG, `tongue_groove_index_5_4_1.svg`) und die nicht eingebundene `file_structure_2_1.svg`. Drei Dateien mit Endung `.png` sind JPEG (`page_010_img_028`, `page_064_img_187`, `page_065_img_191`) — so im Original. |
| `image.png` | `Documentation/wup_specification/3_7/image.png` | byte-gleich; Zeichnung „Lagenhöhe“, im Text eingebunden |
| `sitebroker/*.md` | `Documentation/sitebroker/*.md` | byte-gleich |
| `sitebroker/.attachments/image-7d680f93-….png` | `Documentation/sitebroker/.attachments/` | byte-gleich (SHA-256 `02d3a3d0bd82a0b4…`); Architektur |
| `sitebroker/.attachments/image-0e84657a-….png` | ebenda | byte-gleich (SHA-256 `05eab447948fc35b…`); Einsatzformen |
| `sitebroker/.attachments/image-fc468b9d-….png` | ebenda | **VERÄNDERT:** Das Original (SHA-256 `8048aa1b541dde58…`) trägt auf zwei Notizzetteln einen Personennamen. Die beiden Namenszeilen sind in der Zettelfarbe übermalt (zwei Rechtecke 270 × 70 px), sonst pixelgleich; unsere Datei hat SHA-256 `d20cda1ee58f73df…`. Erzeugt mit `Wup/Mcp/werkzeuge/weinmann_bilder_erzeugen.js --weinmann <klon>`. **Das Original nicht zurückkopieren** — ein Test prüft das. |

Daraus **erzeugt** (nicht von Hand ändern):

| Erzeugnis | Werkzeug |
|---|---|
| `../Seiten/schnittstellenbeschreibung_3_7/S01…S49.png`, `../Seiten/schnittstellenbeschreibung_3_7.seiten.json` | `Wup/Mcp/werkzeuge/pdf_seiten_erzeugen.js` 1.1, aus der PDF |
| `../Seiten/weinmann_tabellen.json` (88 Tabellen: 53 der 3.7, 35 SiteBroker) | `Wup/Mcp/werkzeuge/md_tabellen_erzeugen.js`, aus den Markdown-Dateien; `--pruefen` vergleicht |
| `../Seiten/einzelbilder/*.png` (5 Vorschaubilder: 2 SVG, 3 SiteBroker-Diagramme auf höchstens 2000 px Breite) | `Wup/Mcp/werkzeuge/weinmann_bilder_erzeugen.js` |

Von Hand geschrieben und von einer KI aus den Bildern gelesen:
`Wup/Doku/weinmann-einzelbilder.md` (Beschreibung jedes Bildes). Die Auswertung
steht in `Wup/Doku/weinmann-tabellen-und-bilder.md`.

Die Kennzahl im Dateinamen `page_NNN_img_MMM` zählt die Seiten der
**3.6**-PDF, aus der Weinmann die Bilder gezogen hat — nicht die der 3.7.

## Was NICHT übernommen ist

- `Interface_version_3_5.pdf` (englisch), `Interface_version_3_6.pdf` und der
  Ordner `3_6/` — für 3.6 genügt die Änderungshistorie in 3.7 (§3.3.7:
  Einführung von PAL).
- `Interface_version_3_5_DEU.pdf` — **liegt schon vor**: sie ist byte-gleich
  zu `../Weinmann_Schnittstellenbeschreibung.pdf` (SHA-256 `4781f27d9b021b9a…`,
  geprüft 2026-11-13). Die deutsche V3.5 steht damit ebenfalls unter MIT.
- `Applications/Sitebroker/` (C#-Beispielclient, Demo-Maschine, Demo-MES) und
  die Build-Pipelines.
- **215 der 250 Bilddateien** im Ordner der 3.7: Sie sind nicht eingebunden
  und fast alle Kopien (dasselbe Logo liegt 73-mal vor; der Ordner enthält
  nur 40 verschiedene Inhalte). Darunter zwei **leere** SVG-Dateien
  (`custom_wall_elm.svg`, `custom_ceiling_roof_elm.svg`, je 0 Byte).
- Die 246 Bilder der 3.6 — sie sind in denen der 3.7 inhaltsgleich enthalten.

## Einordnung

- Für die Fertigung **maßgebend** sind die Unterlagen der eigenen Anlage und die
  dort unterstützte WUP-Version. Die 3.7 ist Ausblick und Klarstellung.
- Die englischen Fassungen übersetzen stellenweise sogar Schlüsselwörter
  (3.6-PDF: `SERIES`/`STACK` statt `REIHE`/`STAPEL`, `INSIDE` statt `INNEN`).
  Schlüsselwörter immer aus der deutschen V3.5 oder aus 3.7 nehmen.
- **Markdown und PDF der 3.7 sind nicht deckungsgleich.** Die Markdown-Fassung
  ist an mindestens einer Stelle ausführlicher: die Vorzeichenregel für `z`
  der Platten (`PLI` positiv, `PLA` negativ) steht nur dort. Umgekehrt fehlen
  in der Markdown-Fassung die griechischen Winkelzeichen (PDF: „tilt angle β
  for SG“, „positive angle δ“). Geprüft 2026-11-13 per Satzvergleich; weitere
  inhaltliche Unterschiede sind dabei nicht aufgefallen, der Vergleich ist
  aber nicht lückenlos. Die Seitenbilder und die Suche des MCP-Servers kommen
  aus der **PDF**; bei Winkeln also die PDF-Seite ansehen.
- Sitebroker (MQTT/REST-Anbindung an ein Leitsystem) ist laut Weinmann „only
  for selected machines“ — ob die Anlage hier dazugehört, ist nicht geklärt.

Aktualisieren: Weinmann-Repo neu holen, Dateien ersetzen — **das
SiteBroker-Diagramm `image-fc468b9d-…` nie roh kopieren, sondern mit
`weinmann_bilder_erzeugen.js --weinmann <klon>` übermalen lassen** —, diese
Datei nachführen, Seiten, Tabellen und Vorschaubilder neu erzeugen,
`Wup/Doku/weinmann-einzelbilder.md` um neue Bilder ergänzen,
`node Wup/Tests/alle.js`.
