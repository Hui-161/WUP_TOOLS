#!/usr/bin/env python3
"""
werkzeug_bauen.py — aus kleinen Quelldateien (src/) EINE Werkzeug-HTML bauen.

Warum (Anwender-Entscheidung 2026-09-05, "wie beim Kompilieren einer APK"):
Die QUELLE eines Werkzeugs liegt in kleinen, nach Thema geschnittenen Dateien
(CSS, Markup-Teile, JS-Module). Das ARTEFAKT ist weiterhin eine einzige HTML,
die per Doppelklick laeuft und so weitergegeben wird. Kleine Dateien
liest eine KI-Sitzung gezielt (Token), zwei Sitzungen kollidieren seltener,
und ein Thema hat einen Ort. Die Auslieferung aendert sich nicht.

WIE GEBAUT WIRD — bewusst dumm, damit es beweisbar bleibt:
  * Ein Bauplan (JSON) nennt die Bloecke in Reihenfolge.
  * Block "html":   eine Datei, wird UNVERAENDERT eingefuegt.
  * Block "text":   ein Literal (z. B. eine Leerzeile zwischen zwei Skripten).
  * Block "style":  <style>\n + Inhalt der Teile hintereinander + </style>\n
  * Block "script": <script>\n + Inhalt der Teile hintereinander + </script>\n
  * Block "erzeugt": der Hinweis, dass die Datei gebaut ist.
  Mehrere JS-Teile landen in EINEM <script>-Block. Das ist die entscheidende
  Zusage: fuer den Browser ist es weiterhin ein Skript, Funktionen hoisten wie
  vorher, nichts aendert sich an der Semantik. Die Teilung ist nur eine Frage,
  in wie vielen Dateien die Quelle liegt.
  Kein Minifizieren, kein Umschreiben, kein Netzwerk (Spec §1).

DETERMINISTISCH: gleiche Quelle -> byte-identisches Ergebnis. Zeilenenden
werden so uebernommen, wie sie in den Teilen stehen (newline='').

DAS ARTEFAKT WIRD NICHT VON HAND BEARBEITET. --pruefen meldet jede Abweichung
zwischen Ziel und Bau (Rueckgabe 1) — Tests rufen genau das auf. Wer die
erzeugte Datei aendert, verliert die Aenderung beim naechsten Bau; deshalb
steht das auch in der Datei selbst (Block "erzeugt").

Aufruf:
  python3 Werkzeuge/werkzeug_bauen.py                     # Bauplan src/bauplan.json, Ziel laut Plan
  python3 Werkzeuge/werkzeug_bauen.py --pruefen           # nichts schreiben, Abweichung melden
  python3 Werkzeuge/werkzeug_bauen.py --bauplan PFAD      # anderer Bauplan (anderes Werkzeug)
  python3 Werkzeuge/werkzeug_bauen.py --ziel PFAD         # anderes Ziel
  python3 Werkzeuge/werkzeug_bauen.py --groessen          # Zeilen je Teil ausgeben (Uebersicht)

Bauplan (src/bauplan.json):
  { "werkzeug": "PDF-Grundriss-Aufmass",
    "ziel": "pdf_grundriss_aufmass.html",          relativ zum Bauplan-Ordner-Elternteil
    "bloecke": [
      { "art": "html",   "datei": "html/00_kopf.html" },
      { "art": "erzeugt" },
      { "art": "style",  "teile": ["css/10_grund.css", "css/20_leiste.css"] },
      { "art": "html",   "datei": "html/10_markup.html" },
      { "art": "script", "teile": ["js/00_waechter.js"] },
      { "art": "text",   "inhalt": "\\n" },
      { "art": "script", "teile": ["js/10_zustand.js", "js/20_zeichnen.js"] },
      { "art": "html",   "datei": "html/90_fuss.html" } ] }
  Pfade in "datei"/"teile" sind relativ zum Ordner des Bauplans.

WAS DER BAUER ABLEHNT (seit 2026-09-08, Auftrag "bauwerkzeuge-haerten",
Befunde R3/R3f aus dem Review). Jeder Punkt ist FEHLER mit Rueckgabe 1, und
es wird NICHTS geschrieben — alle Pruefungen laufen vor dem ersten Schreiben.
Bis dahin ging jeder dieser Faelle STILL durch, teils mit einem Artefakt, in
dem kein Skript mehr laeuft (Spec §7A: nie still):
  * Teil ohne Zeilenumbruch am Ende — ein Zeilenkommentar am Dateiende zieht
    die erste Zeile des Folgeteils in den Kommentar. --pruefen bleibt dabei
    "gleich", weil Bau und Ziel denselben Fehler tragen.
  * Teil mit BOM (U+FEFF) — in einem style-Block wird daraus ein Typselektor,
    in einem script-Block ein Syntaxfehler.
  * derselbe Teil zweimal im Bauplan — der ganze Skriptblock stirbt an
    "already declared".
  * Bauplan ohne "bloecke" (oder mit vertipptem Schluessel) — vorher entstand
    eine Datei mit 0 Bytes und Rueckgabe 0.
  * fehlende Datei, fehlender Schluessel, "teile" als Text statt Liste —
    vorher ein Traceback, jetzt eine Fehlerzeile.
  * "</script"/"</style" im Teil (seit der Erstfassung) und zusaetzlich
    "<!--" gefolgt von "<script" in einem Skriptblock (HTML-Tokenizer
    "double escaped": es laeuft KEIN Skript und es gibt KEINE Meldung).
  * Pfade mit "../" oder absolute Pfade in "datei"/"teile". Zwei GUIs aus
    einer Quelle werden deshalb NICHT ueber "../"-Teile gebaut, sondern ueber
    einen ZWEITEN Bauplan im selben src/-Ordner (bauplan_<name>.json) und
    --bauplan. Ein Test prueft gegen die Vereinigung aller
    Bauplaene eines src/-Ordners.
"""
import json
import os
import sys

WURZEL = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ZEILEN_HINWEIS = 600   # Hinweis (kein Fehler), wenn ein Teil darueber liegt

# Bewusst OHNE Pfad zum Skript: dieselbe Datei wird aus dem Kern-Repo
# (Werkzeuge/), aus dem Spiegel (Werkzeuge/) und aus dem Skill
# (Werkzeuge/) gebaut — der Hinweis muss
# ueberall zeichengleich ausfallen, sonst meldet --pruefen der einen Kopie
# das Ergebnis der anderen als Abweichung.
ERZEUGT_HINWEIS = (
    '<!-- ERZEUGTE DATEI — NICHT HIER BEARBEITEN.\n'
    '     Gebaut von werkzeug_bauen.py aus den Quellteilen unter src/ (Reihenfolge:\n'
    '     bauplan.json dort). Aenderungen gehoeren in die Teile; danach neu bauen.\n'
    '     Pruefen: werkzeug_bauen.py --pruefen  (Werkzeuge/\n'
    '     oder Werkzeuge/ des Repos). -->\n')


def fehler(text):
    """Eine FEHLER-Zeile und Rueckgabe 1 — nie ein Traceback und nie still."""
    raise SystemExit('FEHLER: ' + text)


def lesen(pfad, wer=None):
    try:
        with open(pfad, encoding='utf-8', newline='') as f:
            return f.read()
    except FileNotFoundError:
        fehler('Teil fehlt — ' + (wer or pfad) + ' (im Bauplan genannt, nicht vorhanden)')
    except IsADirectoryError:
        fehler((wer or pfad) + ' ist ein Ordner, kein Teil')
    except UnicodeDecodeError as e:
        fehler((wer or pfad) + ' ist nicht UTF-8 lesbar: ' + str(e))


def pfad_pruefen(rel, wer):
    """Teile liegen UNTER dem Bauplan-Ordner. Kein "../", kein absoluter Pfad.

    Sonst zeigt ein Bauplan aus einem src/-Ordner auf Teile eines anderen
    Werkzeugs, und keiner der Tests bemerkt es (qart T3 prueft je Ordner).
    Zwei GUIs aus einer Quelle gehen ueber einen zweiten Bauplan, nicht
    ueber "../" (Auftrag bauwerkzeuge-haerten, R3f)."""
    if not isinstance(rel, str) or not rel.strip():
        fehler(wer + ': Pfad fehlt oder ist kein Text (' + repr(rel) + ')')
    if os.path.isabs(rel) or (len(rel) > 1 and rel[1] == ':'):
        fehler(wer + ': absoluter Pfad ist nicht erlaubt — ' + rel)
    teile = rel.replace('\\', '/').split('/')
    if '..' in teile:
        fehler(wer + ': "../" ist nicht erlaubt — ' + rel
               + '. Zwei Artefakte aus einer Quelle: zweiter Bauplan im selben '
                 'src/-Ordner (bauplan_<name>.json) und --bauplan.')


def teil_pruefen(rel, inhalt, art):
    """Die Fallen, die ein Artefakt still kaputt machen (R3a/R3b/R3e)."""
    if inhalt.startswith('﻿'):
        fehler(rel + ' beginnt mit einem BOM (U+FEFF) — in CSS wird daraus ein '
               'Typselektor, in JS ein Syntaxfehler. Datei ohne BOM speichern.')
    if inhalt and not inhalt.endswith('\n'):
        fehler(rel + ' endet ohne Zeilenumbruch — der Bauer haengt die Teile '
               'unveraendert aneinander, dadurch rutscht die erste Zeile des '
               'naechsten Teils in die letzte Zeile dieses Teils (bei einem '
               'Zeilenkommentar am Ende ist sie damit weg). Zeilenumbruch anfuegen.')
    if art == 'script' and '</script' in inhalt.lower():
        fehler(rel + ' enthaelt "</script" — Einbetten unsicher')
    if art == 'style' and '</style' in inhalt.lower():
        fehler(rel + ' enthaelt "</style" — Einbetten unsicher')


def skriptblock_pruefen(stuecke, namen):
    """"<!--" und danach "<script" in EINEM Skriptblock (R3e).

    Der HTML-Tokenizer geht bei "<!--" in "script data escaped" und bei einem
    folgenden "<script" in "double escaped": ab da beendet "</script>" das
    Element nicht mehr — es laeuft KEIN Skript, und die Konsole sagt nichts.
    Geprueft wird der ZUSAMMENGESETZTE Block, weil der Zustand ueber die
    Teilgrenzen hinweg gilt."""
    ganz = ''.join(stuecke).lower()
    auf = ganz.find('<!--')
    if auf < 0:
        return
    if '<script' in ganz[auf:]:
        wo = next((n for n, s in zip(namen, stuecke) if '<!--' in s.lower()), namen[0])
        fehler(wo + ': in einem Skriptblock steht "<!--" und danach "<script". '
               'Der HTML-Tokenizer schaltet damit in den Zustand "double escaped" — '
               'es laeuft KEIN Skript und es gibt KEINE Fehlermeldung. '
               'Zeichenfolge aufbrechen (z. B. "<" + "!--").')


def bauen(bauplan_pfad):
    basis = os.path.dirname(os.path.abspath(bauplan_pfad))
    try:
        with open(bauplan_pfad, encoding='utf-8') as f:
            plan = json.load(f)
    except json.JSONDecodeError as e:
        fehler('Bauplan ist kein gueltiges JSON — ' + bauplan_pfad + ': ' + str(e))
    if not isinstance(plan, dict):
        fehler('Bauplan ist kein Objekt — ' + bauplan_pfad)
    if 'ziel' not in plan:
        fehler('Bauplan ohne "ziel" — ' + bauplan_pfad)
    # R3d: fehlende/vertippte "bloecke" ergaben vorher eine Datei mit 0 Bytes.
    if 'bloecke' not in plan:
        fehler('Bauplan ohne "bloecke" — ' + bauplan_pfad + '. Vorhandene '
               'Schluessel: ' + ', '.join(sorted(plan.keys())) + ' (vertippt?)')
    if not isinstance(plan['bloecke'], list) or not plan['bloecke']:
        fehler('Bauplan hat keine Bloecke — ' + bauplan_pfad
               + ' (das Ergebnis waere eine leere Datei)')
    teile_gesehen = []
    ausgabe = []
    for i, block in enumerate(plan['bloecke']):
        if not isinstance(block, dict):
            fehler('Block ' + str(i) + ' ist kein Objekt: ' + repr(block))
        art = block.get('art')
        wo = 'Block ' + str(i) + ' (' + str(art) + ')'
        if art == 'html':
            if 'datei' not in block:
                fehler(wo + ' ohne "datei"')
            pfad_pruefen(block['datei'], wo)
            inhalt = lesen(os.path.join(basis, block['datei']), block['datei'])
            teil_pruefen(block['datei'], inhalt, art)
            teile_gesehen.append((block['datei'], inhalt))
            ausgabe.append(inhalt)
        elif art == 'text':
            if 'inhalt' not in block:
                fehler(wo + ' ohne "inhalt"')
            if not isinstance(block['inhalt'], str):
                fehler(wo + ': "inhalt" muss Text sein, ist ' + type(block['inhalt']).__name__)
            ausgabe.append(block['inhalt'])
        elif art == 'erzeugt':
            ausgabe.append(ERZEUGT_HINWEIS)
        elif art in ('style', 'script'):
            if 'teile' not in block:
                fehler(wo + ' ohne "teile"')
            if not isinstance(block['teile'], list) or not block['teile']:
                fehler(wo + ': "teile" muss eine nicht leere Liste sein')
            stuecke = []
            for rel in block['teile']:
                pfad_pruefen(rel, wo)
                inhalt = lesen(os.path.join(basis, rel), rel)
                teil_pruefen(rel, inhalt, art)
                teile_gesehen.append((rel, inhalt))
                stuecke.append(inhalt)
            if art == 'script':
                skriptblock_pruefen(stuecke, list(block['teile']))
            ausgabe.append('<' + art + '>\n' + ''.join(stuecke) + '</' + art + '>\n')
        else:
            fehler('Block ' + str(i) + ' hat unbekannte Art: ' + repr(art)
                   + ' — erlaubt sind html, text, style, script, erzeugt')
    # R3c: derselbe Teil zweimal — der Skriptblock stirbt an "already declared".
    namen = [rel for rel, _ in teile_gesehen]
    doppelt = sorted({n for n in namen if namen.count(n) > 1})
    if doppelt:
        fehler('Teil(e) stehen mehrfach im Bauplan: ' + ', '.join(doppelt)
               + ' — der Inhalt wuerde zweimal eingebaut (bei JS "already declared").')
    if not isinstance(plan['ziel'], str) or not plan['ziel'].strip():
        fehler('Bauplan-"ziel" ist kein Pfad: ' + repr(plan['ziel']))
    ziel = os.path.normpath(os.path.join(os.path.dirname(basis), plan['ziel']))
    return ''.join(ausgabe), ziel, teile_gesehen, plan


def groessen_melden(teile):
    print('Teile (Zeilen):')
    for rel, inhalt in teile:
        n = inhalt.count('\n')
        marke = '  <-- ueber ' + str(ZEILEN_HINWEIS) + ' Zeilen' if n > ZEILEN_HINWEIS else ''
        print('  %5d  %s%s' % (n, rel, marke))
    print('  %5d  gesamt in %d Teil(en)' % (sum(t[1].count('\n') for t in teile), len(teile)))


def main():
    argv = sys.argv[1:]
    nur_pruefen = '--pruefen' in argv
    groessen = '--groessen' in argv
    bauplan = os.path.join(WURZEL, 'src', 'bauplan.json')
    if '--bauplan' in argv:
        bauplan = argv[argv.index('--bauplan') + 1]
    if not os.path.exists(bauplan):
        print('FEHLER: Bauplan nicht gefunden —', bauplan)
        return 2

    neu, ziel, teile, plan = bauen(bauplan)
    if '--ziel' in argv:
        ziel = argv[argv.index('--ziel') + 1]
    if groessen:
        # R6d: --groessen ist eine AUSKUNFT. Vorher schrieb der Lauf das
        # Artefakt gleich mit — wer nur nach den Zeilen je Teil fragte,
        # veraenderte damit eine Datei. Jetzt endet er hier.
        groessen_melden(teile)
        groesse = str(round(len(neu.encode('utf-8')) / 1024)) + ' kB'
        print('(nur Auskunft — nichts geschrieben; Bau ergaebe ' + groesse + ')')
        return 0

    alt = lesen(ziel) if os.path.exists(ziel) else None
    groesse = str(round(len(neu.encode('utf-8')) / 1024)) + ' kB'
    if alt == neu:
        print('gleich  ', os.path.relpath(ziel, os.getcwd()), '(' + groesse + ', '
              + str(len(teile)) + ' Teile)')
        return 0
    if nur_pruefen:
        # Erste abweichende Zeile nennen — das spart die Suche.
        a_zeilen = (alt or '').split('\n')
        n_zeilen = neu.split('\n')
        stelle = next((k for k in range(min(len(a_zeilen), len(n_zeilen)))
                       if a_zeilen[k] != n_zeilen[k]), min(len(a_zeilen), len(n_zeilen)))
        print('ABWEICHUNG', os.path.relpath(ziel, os.getcwd()),
              '— Ziel und Bau unterscheiden sich ab Zeile ' + str(stelle + 1)
              + (' (Ziel fehlt)' if alt is None else '')
              + '. Nicht das Ziel bearbeiten: Quelle in src/ aendern und neu bauen.')
        return 1
    os.makedirs(os.path.dirname(os.path.abspath(ziel)), exist_ok=True)
    with open(ziel, 'w', encoding='utf-8', newline='') as f:
        f.write(neu)
    print('geschrieben', os.path.relpath(ziel, os.getcwd()), '(' + groesse + ', '
          + str(len(teile)) + ' Teile)')
    return 0


if __name__ == '__main__':
    sys.exit(main())
