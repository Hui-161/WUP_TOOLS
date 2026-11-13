#!/usr/bin/env node
/*
  WUP-MCP-Frage 1.0
  Ruft ein Werkzeug des WUP-MCP-Servers einmal auf: startet einen frischen 
  Server (stdio), schickt initialize + tools/call und gibt die Antwort aus. 
  Aufruf: node Wup/Mcp/wup_frage.js --liste

  Copyright (C) 2026 Lars Ojus
  Lizenz: GNU General Public License v3.0 (GPL-3.0-only) — siehe LICENSE im Repository.
  OHNE JEDE GEWAEHRLEISTUNG / ABSOLUTELY NO WARRANTY.
  Kein Produkt von WEINMANN/HOMAG. Geschrieben mit Claude (Anthropic).
*/
'use strict';

const { spawn } = require('child_process');
const path = require('path');

const REPO = path.join(__dirname, '..', '..');
const SERVER = path.join(__dirname, 'wup_mcp_server.js');
const [, , werkzeug, argJson, auswahl] = process.argv;

if (!werkzeug) {
  console.log("Aufruf: node Wup/Mcp/wup_frage.js --liste | <werkzeug> '<json>' [<auswahl>]");
  process.exit(2);
}

/* Pfad auswerten: "a.b[2].c[id=3].d" */
function auswaehlen(wert, pfad) {
  for (const teil of pfad.match(/[^.[\]]+|\[[^\]]*\]/g) || []) {
    if (wert === null || wert === undefined) return undefined;
    const filter = teil.match(/^\[([^=\]]+)=([^\]]*)\]$/);
    const index = teil.match(/^\[(\d+)\]$/);
    if (filter) wert = Array.isArray(wert) ? wert.find(x => x && String(x[filter[1]]) === filter[2]) : undefined;
    else if (index) wert = wert[Number(index[1])];
    else wert = wert[teil];
  }
  return wert;
}

let argumente = {};
if (werkzeug !== '--liste') {
  try { argumente = JSON.parse(argJson || '{}'); }
  catch (e) { console.error('Argumente sind kein gueltiges JSON: ' + e.message); process.exit(2); }
}

const server = spawn(process.execPath, [SERVER], { cwd: REPO, stdio: ['pipe', 'pipe', 'inherit'] });
let puffer = '';
const antworten = {};
server.stdout.setEncoding('utf8');
server.stdout.on('data', d => {
  puffer += d;
  let i;
  while ((i = puffer.indexOf('\n')) >= 0) {
    const zeile = puffer.slice(0, i);
    puffer = puffer.slice(i + 1);
    if (zeile.trim()) { try { const j = JSON.parse(zeile); antworten[j.id] = j; } catch { /* Fremdzeile */ } }
  }
});
const senden = (o) => server.stdin.write(JSON.stringify(o) + '\n');

senden({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'wup_frage', version: '1.0' } } });
if (werkzeug === '--liste') senden({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} });
else senden({ jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: werkzeug, arguments: argumente } });
server.stdin.end();

const zeitgeber = setTimeout(() => { console.error('Zeitueberschreitung (120 s).'); server.kill(); process.exit(1); }, 120000);

server.on('close', () => {
  clearTimeout(zeitgeber);
  const a = antworten[2];
  if (!a) { console.error('Keine Antwort vom Server.'); process.exit(1); }
  if (a.error) { console.error('JSON-RPC-Fehler ' + a.error.code + ': ' + a.error.message); process.exit(1); }
  if (werkzeug === '--liste') {
    for (const t of a.result.tools) {
      const p = t.inputSchema && t.inputSchema.properties ? Object.keys(t.inputSchema.properties) : [];
      const pflicht = (t.inputSchema && t.inputSchema.required) || [];
      console.log(t.name + '  (' + p.map(n => pflicht.includes(n) ? n + '*' : n).join(', ') + ')');
      console.log('    ' + t.description.slice(0, 160) + (t.description.length > 160 ? '…' : ''));
    }
    return;
  }
  const text = a.result.content && a.result.content[0] ? a.result.content[0].text : '';
  if (a.result.isError) { console.error(text); process.exit(1); }
  let r;
  try { r = JSON.parse(text); } catch { console.log(text); return; }
  if (auswahl) r = auswaehlen(r, auswahl);
  console.log(typeof r === 'string' ? r : JSON.stringify(r, null, 2));
});
