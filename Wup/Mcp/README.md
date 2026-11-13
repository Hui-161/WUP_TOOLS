# WUP-MCP-Server

Stellt die Fachlogik des WUP-Editors als **MCP-Server** (Model Context
Protocol, stdio) bereit: Dateien analysieren und prüfen, Automatiken rechnen,
Werte ersetzen, Steuercodes dekodieren, in der WUP-Schnittstellenbeschreibung
nachschlagen. Der Server enthält keine eigene Fachlogik — er lädt den Editor
(`Wup/wup_editor/wup_editor.html`) ohne Browser. Keine npm-Pakete, kein
Netzwerkzugriff; an die Maschine wird nichts gesendet.

*English summary below.*

## Start

```bash
node Wup/Mcp/wup_mcp_server.js                 # als MCP-Server (stdio)
node Wup/Mcp/wup_frage.js --liste              # Werkzeuge auflisten
node Wup/Mcp/wup_frage.js wup_pruefen '{"pfad":"Wup/03_Beispiel-synthetisch/SEMA/IW01.WUP"}'
```

Node.js ab Version 18. Die `.mcp.json` im Wurzelverzeichnis meldet den Server
unter dem Namen `wup` an.

## Gerätebelegung: `profil.json`

Ohne Browser gibt es kein gespeichertes Maschinenprofil. Der Server liest
deshalb, falls vorhanden, `Wup/Mcp/profil.json` (oder die Datei aus der
Umgebungsvariable `WUP_PROFIL`) und mischt sie in das Standardprofil des
Editors. Mindestens die Gerätebelegung gehört hinein:

```json
{
  "nr_indizes": {
    "10": { "name": "Klammergerät 1", "psf_offset": 7 },
    "20": { "name": "Klammergerät 2", "psf_offset": 20 }
  }
}
```

`psf_offset` ist der Sperrflächen-Abstand in Millimetern. Ohne Belegung meldet
die Prüfregel P-20 jede Nagelreihe; `wup_server_status` und die Prüf-Ausgaben
weisen darauf hin. Eine ungültige Datei wird gemeldet, nie still übergangen.

## Konfiguration: `wup_mcp_konfig.js`

Servertitel, Vorgabe-Ordner, Schreibsperre, Dokumentquellen und
anlagenspezifische Hinweistexte stehen in `wup_mcp_konfig.js`. Eigene
Unterlagen (z. B. das Datenblatt der eigenen Anlage) lassen sich dort als
weitere Quelle eintragen.

## Schreiben

Der Server schreibt nur, wenn ein Zielpfad angegeben ist, nur `.wup`-Dateien,
nie in die Werkzeug- und Beispielordner und nur ohne offene Fehler-Befunde
(oder ausdrücklich mit `trotz_fehler`). Jede erzeugte Datei ist vor der
Fertigung fachlich zu prüfen.

---

## English summary

MCP server (stdio) exposing the WUP editor's logic to AI assistants: analyse
and check files, run automatics, replace values, decode control codes, look up
the WUP interface specification. No npm packages, no network access.

- Start: `node Wup/Mcp/wup_mcp_server.js` (Node.js 18+). `.mcp.json` registers
  it as `wup`.
- Device assignment: put your machine's nailing/stapling units into
  `Wup/Mcp/profil.json` (see the JSON example above; `psf_offset` is the
  exclusion-area distance in mm). Without it, rule P-20 reports every nail row.
- Site-specific settings live in `wup_mcp_konfig.js`.
- The server writes only to an explicit target path and never into the tool or
  example folders. Check every generated file before production.
