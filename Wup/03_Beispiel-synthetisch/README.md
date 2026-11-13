# Synthetische WUP-Referenzdateien

Die Dateien in `SEMA/` und `Granit/` sind **frei erfunden**. Sie stammen aus
keinem Bauvorhaben: Maße, Raster, Materialnamen, Projekt-, Auftrags- und
Elementnamen (`MUSTER-…`, `IW01`, `syn0001` …) stehen als Beschreibung in
`erzeugen.js` und werden von dort geschrieben. Nachgebildet ist nur die
Schreibweise zweier üblicher CAD-Exporte — Zeilenende CRLF, Kodierung
Windows-1252.

| Datei | Stil | Inhalt |
|---|---|---|
| `SEMA/IW01.WUP` | SEMA, 3.5 | kleine Innenwand ohne Öffnung, eine Lage, reines ASCII |
| `SEMA/IW02.WUP` | SEMA, 3.5 | Innenwand mit Tür (unten offene Sägekontur), zwei Balkentaschen mit Sperrflächen, Markierlinie |
| `SEMA/AW01.WUP` | SEMA, 3.5 | Außenwand mit Fenster: Einblasdämmung, Innen- und Außenbeplankung, Lattung, Rundfräsung mit runder Sperrfläche |
| `SEMA/GW01.WUP` | SEMA, 3.5 | Giebelwand mit schrägem Rähm, Stiele als `BT4`, schräge Sägelinie |
| `Granit/syn0001.wup` | Granit, 3.4 | nur Riegelwerk, mit Strebe |
| `Granit/syn0002.wup` | Granit, 3.4 | Innenwand mit Tür, beidseitig beplankt, Freistiche |
| `Granit/syn0003.wup` | Granit, 3.4 | Außenwand mit Fenster, fünf Lagen, Bearbeitungen am Holz (`BOY`, `FRZ`, `SG`), Sperrflächen |
| `Granit/syn0004.wup` | Granit, 3.4 | lange Wand, 18 Sparrenausschnitte als eine Sägekontur mit 77 Punkten, 36 Sperrflächen |
| `Granit/syn_mit_fehlern.wup` | Granit, 3.4 | **absichtlich fehlerhaft**, siehe unten |

Alle Dateien kommen unverändert byte-gleich wieder aus dem Editor
(`Wup/Tests/roundtrip.js`). Bis auf die letzte hat keine einen Befund der
Stufe „Fehler"; Warnungen und Hinweise kommen vor und sind gewollt (zum
Beispiel Klammern innerhalb einer Sperrfläche).

## Die absichtlich fehlerhafte Datei

`Granit/syn_mit_fehlern.wup` dient Tests, die Fehler-Befunde brauchen:

- **P-19** — die Innenbeplankung trägt den Materialindex 0
- **P-22** — die Klammerreihen der Außenlage tragen den Geräteindex 25
- **P-03** — zwei Klammerreihen laufen über die Fensteröffnung, Sperrflächen fehlen

Nicht „reparieren".

## Neu erzeugen

```bash
node erzeugen.js            # schreibt alle Dateien neu
node erzeugen.js --pruefen  # vergleicht nur; Rückgabe 1 bei Abweichung
```

Der Generator braucht nur Node, keine Fremdpakete, und rechnet ohne Zufall
und ohne Datum — derselbe Stand ergibt dieselben Bytes. Wer eine Wand ändert
oder ergänzt, ändert `erzeugen.js`, erzeugt neu und checkt Generator **und**
Dateien zusammen ein; `Wup/Tests/roundtrip.js` ruft `--pruefen` auf und
meldet, wenn beide auseinanderlaufen. Einige Tests rechnen mit festen Maßen
dieser Wände (Tür in `IW02`, Sturzriegel in `syn0003`, Sägekontur in
`syn0004`) — nach einer Änderung `node Wup/Tests/alle.js` laufen lassen.

Die Sperrflächen-Abstände je Gerät (`PSF_ABSTAND` im Generator) entsprechen
der Beispiel-Gerätebelegung des Editors (10, 11, 20, 25, 32).
