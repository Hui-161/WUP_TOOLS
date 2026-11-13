# WUP Tools

Editor, multi-file overview and MCP server for **WUP machine files** used in
timber-frame element production (CAD → multifunction bridge).

> Not a product of WEINMANN Holzbautechnik GmbH or HOMAG. "WUP" is the name of
> the file format; manufacturer names are used only to describe compatibility.

**Deutsch:** [README.de.md](README.de.md)

## What is in here

| Tool | What it does | Start |
|---|---|---|
| **WUP Editor** | Opens a WUP file, shows it in 2D/3D, checks it against 25 rules, edits operations, runs automatics (overcut/undercut, relief cuts, nailing exclusion areas) and exports again. An unchanged file is written back byte-identical. | Double-click `Wup/wup_editor/wup_editor.html` |
| **WUP Editor Overview** | Loads many WUP files at once, shows one card per wall, runs checks and automatics over all of them, hands a file to the editor. | Double-click `Wup/wup_editor_oversight/wup_editor_oversight.html` |
| **WUP MCP server** | Makes the same checks and automatics available to AI assistants via the Model Context Protocol (stdio). | `node Wup/Mcp/wup_mcp_server.js` |

Both HTML tools are single files, run offline in the browser (Edge, Chrome,
Firefox) and send nothing to the network. The user interface is German.

## First start: set up your machine

Which nailing or stapling unit sits behind which NR index differs from machine
to machine. On first start the editor asks for this **device assignment**
(index, name, exclusion-area distance). The list shipped as an example shows
the units of one machine only — adapt it to yours before saving. Without an
assignment, rule P-20 reports every nail row as unknown.

The other machine values (maximum wall size, saw and router depth, relief-cut
settings) are defaults of one machine. Check them in *Automatik-Einstellungen*
before you rely on the checks.

The settings are stored in the browser and shared by editor and overview when
both are opened in the same browser.

## Check every file before production

The tools write machine files. They are provided **without any warranty**
(see `LICENSE`). Every exported file must be checked by a qualified person
before it is used on a machine.

## MCP server

Requires Node.js 18 or newer, no packages to install. `.mcp.json` in the
repository root registers the server for MCP clients that read it. Without a
browser there is no stored device assignment: put yours into
`Wup/Mcp/profil.json` (see `Wup/Mcp/README.md`).

## Build and test

The HTML files are built from small source parts and must not be edited by
hand:

```bash
python3 Werkzeuge/werkzeug_bauen.py --bauplan Wup/wup_editor/src/bauplan.json
python3 Werkzeuge/werkzeug_bauen.py --bauplan Wup/wup_editor_oversight/src/bauplan.json
node Wup/Tests/alle.js
```

The example files in `Wup/03_Beispiel-synthetisch/` are invented; they contain
no real project data.

## Contributing

Issues and pull requests are welcome. Code, identifiers and comments are in
German. This repository is generated from a private working repository, so
accepted changes are applied there and appear here with the next export.

## License

Copyright (C) 2026 Lars Ojus. Licensed under the **GNU General Public License
v3.0** — see `LICENSE`.

The WUP interface documentation in
`Wup/02_Schnittstellenbeschreibung etc/Weinmann-wupWorks/` is © WEINMANN
Holzbautechnik GmbH and included under the MIT License — see
`THIRD-PARTY-NOTICES.md`.
