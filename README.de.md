# WUP-Werkzeuge

Editor, Mehrdatei-Übersicht und MCP-Server für **WUP-Maschinendateien** der
Holzrahmenbau-Elementfertigung (CAD → Multifunktionsbrücke).

> Kein Produkt der WEINMANN Holzbautechnik GmbH oder von HOMAG. „WUP" ist der
> Name des Dateiformats; Herstellernamen stehen hier nur, um zu sagen, wofür
> die Werkzeuge passen.

**English:** [README.md](README.md)

## Was hier liegt

| Werkzeug | Was es tut | Start |
|---|---|---|
| **WUP-Editor** | Öffnet eine WUP-Datei, zeigt sie in 2D/3D, prüft sie gegen 25 Regeln, ändert Bearbeitungen, rechnet Automatiken (Über-/Unterschnitt, Freistich, Sperrflächen) und exportiert wieder. Eine unveränderte Datei kommt byte-gleich zurück. | Doppelklick auf `Wup/wup_editor/wup_editor.html` |
| **WUP-Editor-Übersicht** | Lädt viele WUP-Dateien zugleich, zeigt je Wand eine Karte, prüft und rechnet Automatiken über alle, übergibt eine Datei an den Editor. | Doppelklick auf `Wup/wup_editor_oversight/wup_editor_oversight.html` |
| **WUP-MCP-Server** | Stellt dieselben Prüfungen und Automatiken KI-Assistenten über das Model Context Protocol (stdio) bereit. | `node Wup/Mcp/wup_mcp_server.js` |

Beide HTML-Werkzeuge sind Einzeldateien, laufen offline im Browser (Edge,
Chrome, Firefox) und senden nichts ins Netz.

## Erster Start: die eigene Anlage einrichten

Welches Nagel- oder Klammergerät hinter welchem NR-Index steht, ist je Anlage
verschieden. Beim ersten Start fragt der Editor nach dieser
**Gerätebelegung** (Index, Bezeichnung, Sperrflächen-Abstand). Die
mitgelieferte Beispielliste zeigt die Geräte einer einzigen Anlage — vor dem
Speichern an die eigene anpassen. Ohne Belegung meldet die Regel P-20 jede
Nagelreihe als unbekannt.

Die übrigen Maschinenwerte (größte Wand, Säge- und Frästiefe,
Freistich-Einstellungen) sind Vorgaben einer Anlage. Bitte in den
*Automatik-Einstellungen* prüfen, bevor man sich auf die Prüfungen verlässt.

Die Einstellungen liegen im Browser und gelten für Editor und Übersicht
gemeinsam, wenn beide im selben Browser geöffnet werden.

## Jede Datei vor der Fertigung prüfen

Die Werkzeuge schreiben Maschinendateien. Sie werden **ohne jede
Gewährleistung** bereitgestellt (siehe `LICENSE`). Jede exportierte Datei ist
vor dem Einsatz an der Maschine von einer fachkundigen Person zu prüfen.

## MCP-Server

Braucht Node.js ab Version 18, keine Pakete. Die `.mcp.json` im
Wurzelverzeichnis meldet den Server bei MCP-Clients an, die sie lesen. Ohne
Browser gibt es keine gespeicherte Gerätebelegung: die eigene in
`Wup/Mcp/profil.json` ablegen (siehe `Wup/Mcp/README.md`).

## Bauen und testen

Die HTML-Dateien werden aus kleinen Quellteilen gebaut und nicht von Hand
geändert:

```bash
python3 Werkzeuge/werkzeug_bauen.py --bauplan Wup/wup_editor/src/bauplan.json
python3 Werkzeuge/werkzeug_bauen.py --bauplan Wup/wup_editor_oversight/src/bauplan.json
node Wup/Tests/alle.js
```

Die Beispieldateien in `Wup/03_Beispiel-synthetisch/` sind frei erfunden und
enthalten keine echten Projektdaten.

## Mitmachen

Meldungen und Pull Requests sind willkommen. Code, Bezeichner und Kommentare
sind deutsch. Dieses Repository wird aus einem privaten Arbeits-Repository
erzeugt; angenommene Änderungen werden dort eingearbeitet und erscheinen hier
mit dem nächsten Export.

## Lizenz

Copyright (C) 2026 Lars Ojus. Lizenziert unter der **GNU General Public
License v3.0** — siehe `LICENSE`.

Die WUP-Schnittstellendokumentation in
`Wup/02_Schnittstellenbeschreibung etc/Weinmann-wupWorks/` ist © WEINMANN
Holzbautechnik GmbH und liegt unter der MIT-Lizenz bei — siehe
`THIRD-PARTY-NOTICES.md`.
