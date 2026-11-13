# Weinmann-Originaldokumente — Katalog der Zeichnungen und Tabellenbilder

> **Was das ist:** Beschreibung der **gezeichneten Details** in der Weinmann-
> Schnittstellenbeschreibung V3.5 (8-482-47-2053) und der Interface version 3.7
> — Koordinatensysteme, Schnittrichtungen, Winkel,
> Radiuskorrektur, Einbaulagen, Werkzeugtabellen. Der Text der Dokumente ist
> über `wup_spezifikation` durchsuchbar; dieser Katalog macht die **Bildinhalte**
> auffindbar und benennt ihre fachliche Aussage.
>
> **Herkunft / Verbindlichkeit:** Die Beschreibungen hat eine KI aus den
> gerenderten Seitenbildern gelesen (`Wup/02_Schnittstellenbeschreibung etc/Seiten/`)
> — **fachlich zu prüfen; maßgebend ist das Bild, nicht die Beschreibung.**
> Jede Seite ist über `wup_spezifikation` mit `seite` + `bild:true` als Bild
> abrufbar. Seitenzahl = PDF-Seite = gedruckte Seite.
>
> **Format (wird vom MCP-Server geparst):** `## Quelle: <schluessel>` leitet eine
> Quelle ein; jede Zeichnung ist ein `### S.<n> — <Titel>`-Block mit den Zeilen
> `- Zeigt:`, `- Aussage:`, `- Stichworte:`. Zusätzliche Zeilen sind erlaubt.
>
> **Seit 2026-11-13 zusätzlich:** die von Weinmann veröffentlichte
> **Interface version 3.7** (englisch, 49 Seiten, MIT) als dritte Quelle
> `schnittstellenbeschreibung_3_7`. Katalogisiert sind dort nur die Seiten mit
> **neuen** Zeichnungen und die Kopftabelle; Koordinatensysteme, Bezugsebenen,
> Schnittrichtungen und Radiuskorrektur stehen in 3.7 auf S. 5–8, 16–17, 32,
> 37–39 und 42–44 und sind über `seite` + `bild:true` abrufbar. **3.7 gilt
> nicht für die Anlage (WUP 3.4.1)** — siehe `wup-versionen-und-quellen.md`.
>
> **Schwesterkatalog (seit 2026-11-13):** `weinmann-einzelbilder.md`
> beschreibt **jede Bilddatei** der 3.7 und die drei SiteBroker-Diagramme
> einzeln (Abruf: `einzelbild: "<Kennung>"`). Der Bildvergleich in
> `weinmann-tabellen-und-bilder.md` §3.2 zeigt: 32 der 36 Bilder der 3.7 sind
> inhaltsgleich mit den Zeichnungen der V3.5, die hier beschrieben sind.

---

## Quelle: schnittstellenbeschreibung

### S.5 — 1.1 Dateistruktur (Schachtelungsdiagramm)
- Zeigt: Verschachtelte Kästen: Dateikopf (VERSION, ANR, ELB, ELN, ZNR, REIHE, ELA, ELM, WNP, CAD, CADRELEASE) → optional Rohteile RT → (A) Bauteile des Riegelwerks UG/OG/LS/QS/BT4/BT6/EBT/BTn mit PROPERTY und Bauteilbearbeitungen (UNIT, SG, PSG, TA, KN, MPL, PAF, PZF, PSF, SZ, RBE/RBE2) → (B) Bauteillagen PLI0…PLI10, PLA0…PLA10, SLI1…SLI10, SLA0…SLA10 mit Lagenbearbeitungen (UNIT, PSG, PAF, PSF, NR, NBR, PSZ, PML, KN, RBE/RBE2) → (C) Module MODUL/ENDMODUL, die wieder (A) oder (B) enthalten.
- Aussage: Eine Kategorie endet mit dem Beginn einer neuen; mehrfache Angaben von (A), (B), (C) sind möglich. Datei im MS-DOS-Textformat (CR/LF), Kodierung ASCII oder UTF-16 LE.
- Stichworte: Dateistruktur, Reihenfolge, Kategorien, Lagen, Module, CRLF, UTF-16

### S.7 — 1.3.1 Elementkoordinatensystem / 1.3.2 Bauteile-Koordinatensystem
- Zeigt: Oben ein rechtsdrehendes Achsenkreuz (z nach oben, y nach hinten, x nach vorn) für Bauteile und Lagenbearbeitungen. Unten ein Quader (Bauteil) mit x entlang der Bauteillänge, y in die Tiefe, z nach oben; die dem Betrachter zugewandte Längsfläche trägt die Ziffer 3.
- Aussage: Alle Koordinatensysteme sind rechtsdrehend. Das Bauteile-Koordinatensystem gilt für SG, SZ, BOX, BOY, BOZ, FRY, FRZ, PFZ, PFY, REFKER; Fläche 3 ist die vordere Längsfläche.
- Stichworte: Koordinatensystem, rechtsdrehend, Elementkoordinatensystem, Bauteilkoordinatensystem, Fläche 3

### S.8 — 1.3.3 Referenzebenen / 1.3.4 Bezugskanten
- Zeigt: Zwei Quader (UG, OG, LS, QS, RT). Oben die Referenzebenen 1–6 mit Pfeilen: 1 = hintere Längsfläche, 2 = Oberseite (von oben), 3 = vordere Längsfläche (dem Betrachter zugewandt), 4 = Unterseite (von unten), 5 = linke Stirnseite (x = 0), 6 = rechte Stirnseite (x = lx). Unten die Bezugskanten 1–6: 1 obere hintere Längskante, 2 obere vordere Längskante, 3 untere vordere Längskante, 4 untere hintere Längskante, 5 linke Stirnseite (vertikale Kante vorn), 6 rechte Stirnseite (obere Kante hinten).
- Aussage: Der Parameter e (Bezugsebene 1…6) bei SG, PAF, PSG, PZF, KN, MPL bezieht sich auf diese Nummerierung; Bezugskanten gelten für SG mit s = 0 (Kantenbezug).
- Stichworte: Referenzebene, Bezugsebene, Bezugskante, e, 1-6, SG, Stirnseite, Längsfläche

### S.9 — 1.3.5 Ebenenkoordinatensystem (sechs Skizzen)
- Zeigt: Je Bezugsebene 1–6 eine Skizze mit dem Ebenen-System x_E/y_E (schwarz) gegenüber dem Element-System x/y/z (grau). Skizze 3 ist beschriftet mit „y_E = z" und „x_E = x"; die Skizzen 5 und 6 (Stirnseiten) zeigen x_E senkrecht (nach oben bzw. unten) und y_E entlang der Stirnseite, z_E aus der Fläche heraus.
- Aussage: Bearbeitungen PSG, TA, KN, MPL, PAF, PZF, PSF und RBE2 werden im Koordinatensystem der gewählten Bezugsebene angegeben. Für die vordere Längsfläche (Ebene 3) gilt x_E = x und y_E = z; für die anderen Ebenen sind die Achsen gedreht — bei Unsicherheit das Bild ansehen.
- Stichworte: Ebenenkoordinatensystem, x_E, y_E, z_E, Bezugsebene, PAF, PSG, PSF, RBE2

### S.10 — 1.3.6 Raumbearbeitungs-Koordinatensystem (Bild a, b, c)
- Zeigt: Bild a: Ursprungsebene (x-y-Ebene, schraffiert). Bild b: Drehung um die Z-Achse → x', y', z = z'. Bild c: Kippen um die X'-Achse → x' = x'', y'', z''.
- Aussage: RBE2 spannt ein neues Koordinatensystem auf: erst Verschiebung x, y, z, dann Drehung α um Z, dann Kippen γ um X', zuletzt δ um Z'' (mathematisch positiv, gegen den Uhrzeigersinn bei Blick gegen den Achspfeil). Alle Bearbeitungen in RBE2 sind mit Bezugsebene 2 zu definieren; Tiefe wirkt entgegen z''.
- Stichworte: RBE2, Raumbearbeitungsebene, Drehwinkel, Neigungswinkel, alpha, gamma, delta, Transformation

### S.15 — 3.1 Dateikopf: ELM-Skizze
- Zeigt: Rechteck im x-y-System; Bemaßung: by oben, yoffset als untere Kante, xoffset als linke Kante, lx als rechte Kante.
- Aussage: lx und by sind die **Maximalwerte** der x- bzw. y-Ordinate (nicht Längen): mit Offsets ist die Elementbreite lx − xoffset und die Höhe by − yoffset. n = Stückzahl {1}, Offsets {0}.
- Stichworte: ELM, lx, by, xoffset, yoffset, Elementmaße, Maximalwert

### S.18 — BT4 Bauteil mit 4 Eckpunkten
- Zeigt: Trapez mit den Punkten P1.1 (links oben), P1.2 (links unten), P2.1 (rechts unten), P2.2 (rechts oben); lx ist entlang der Strecke P1.1–P2.2 bemaßt, by senkrecht dazu.
- Aussage: Die Strecke P1.1–P2.2 bzw. P1.2–P2.1 bestimmt die Holzfaserrichtung und die Längenberechnung; beide Strecken müssen parallel sein. Fallen Punkte zusammen, gilt die verbleibende Strecke. Frühere Namen: Plu, Pru, Pro, Plo.
- Stichworte: BT4, Trapez, Eckpunkte, Faserrichtung, lx, by, P1.1, P2.2

### S.19 — BT6 Bauteil mit 6 Eckpunkten
- Zeigt: Sechseck mit P1.1, P1.2, P1.3 (links oben, Mitte, unten) und P2.3, P2.2, P2.1 (rechts oben, Mitte, unten).
- Aussage: Länge = maximale Distanz von P1.x zu P2.x; die Strecke P1.1–P2.3 bzw. P1.3–P2.1 bestimmt die Faserrichtung, beide parallel. Frühere Namen: Plu, Pmu, Pru, Pro, Pmo, Plo.
- Stichworte: BT6, Sechseck, Eckpunkte, Faserrichtung, Länge

### S.35 — TA Tasche (Innenausfräsung)
- Zeigt: Quader mit eingezeichneter rechteckiger Tasche: Kantenlängen lx, by; Mittel-/Drehpunkt xm, ym, z; Tiefe t; Eckenradius r; Drehwinkel α um die Hochachse; Scherwinkel δ (Schrägstellung der Taschenwand); Bezugsebene e.
- Aussage: TA ist nur innerhalb PAF zulässig und als einziges Element des Polygonzugs; α ±360°, −90° < δ < +90°, r {0}.
- Stichworte: TA, Tasche, Innenausfräsung, Eckenradius, Drehwinkel, Scherwinkel, PAF

### S.36 — 4.1 Einbaulage von UG, OG, LS, QS, EBT (Querstiele, Ansicht INNEN)
- Zeigt: Vier Querschnitte eines Stiels mit Nut im z-x-Schnitt: a „Definition" (stehend, Nut links), b „i = 11" (liegend, bündig zur Außenseite bei z = 0, Nut oben), c „i = 20" (stehend, Nut rechts — um 180° gedreht), d „i = 32" (liegend oben, bündig zur Innenseite, Nut unten — 270° gedreht).
- Aussage: Einerstelle des Materialindex = Einbaulage (0 normal, 1 flach bündig Außenseite, 2 flach bündig Innenseite, 3 flach Wandmitte — **abgekündigt**, Z-Position hat Vorrang); Zehnerstelle = Drehung um die Längsachse (0/1/2/3 = 0°/90°/180°/270°); Drehung wirkt vor der Ausrichtung; die Hunderterstelle unterscheidet Materialien.
- Stichworte: Einbaulage, Materialindex, Drehung, Zehnerstelle, Einerstelle, QS, i=11, i=20, i=32

### S.39 — 5.1.2 Unter- und Überschnitt (Steuercode-Zehnerstelle)
- Zeigt: Zwei Schnittbilder entlang einer Bearbeitungslinie von „Anfang" bis „Ende" (Pfeil = Bearbeitungsrichtung). Überschnitt (xx1x): die Werkzeugkreise stehen **mittig auf** den Anfangs-/Endlinien, der Schnitt reicht um den Werkzeugradius über beide Enden hinaus. Unterschnitt (xx2x): die Werkzeugkreise liegen **vollständig zwischen** den Linien (tangential), der Schnitt endet um den Radius vor dem Endpunkt.
- Aussage: Überschneiden = Werkzeugmitte fährt bis auf den Endpunkt (Schnitt durchgängig, Ecke frei, Überschnitt sichtbar); Unterschneiden = Werkzeugumfang berührt den Endpunkt nur (kein Überschnitt, an Innenecken bleibt Material — daher Freistich nötig).
- Stichworte: Überschnitt, Unterschnitt, Steuercode, Zehnerstelle, 10, 20, Anfang, Ende, Innenecke, Freistich

### S.40 — 5.1.3 Werkzeugradiuskorrektur (Steuercodes 300, 100, 200)
- Zeigt: Drei Skizzen mit Bearbeitungslinie (Pfeil nach rechts = Bearbeitungsrichtung) und schraffiertem Werkzeugkreis mit Drehpfeil. 300: Werkzeugmitte **auf** der Linie. 100 („links"): Werkzeug **links** der Linie (oberhalb, in Bearbeitungsrichtung gesehen). 200 („rechts"): Werkzeug **rechts** der Linie (unterhalb).
- Aussage: Referenz ist die Bearbeitungsrichtung. Der Materialabfall liegt auf der Seite des Werkzeugs: bei 100 links (Werkstück rechts der Linie), bei 200 rechts (Werkstück links der Linie). Mit 300 ist Abfall/Gutteil nicht unterscheidbar. Umkehren der Konturrichtung vertauscht die Korrekturseite — Gutteil würde zerspant.
- Stichworte: Werkzeugradiuskorrektur, Radiuskorrektur, Hunderterstelle, 100, 200, 300, links, rechts, Bearbeitungsrichtung, Abfall, Gutteil

### S.41 — 5.1.5 Beispiele: Kreis, Rechteck, Kreisbogen
- Zeigt: Kreisförmige Ausfräsung im Uhrzeigersinn (MP 3382,40,34,18,211). Geschlossene rechteckige Ausfräsung (fünf PP mit Steuercode 121, Umlauf gegen den Uhrzeigersinn: x wächst zuerst, dann y). Ausfräsung mit Kreisbogen (PP 2000,0 → PP 2000,1800 → KB 3000,1800,800,Acw → PP 3000,0: Bogen über den Scheitel).
- Aussage: Beispielzeilen und Umlaufsinn zum Nachschlagen; Steuercode 211 = zyl. Fräser, überschneidend, Korrektur rechts; 121 = zyl. Fräser, unterschneidend, Korrektur links. Taschenfräsen (5.2): Steuercode 0/1/2 = Über-/Unterschnitt nach Maschinenregeln/Überschnitt/Unterschnitt für alle vier Ecken einer Tasche.
- Stichworte: Beispiel, MP, Kreis, Rechteck, KB, Kreisbogen, Acw, 211, 121, Umlaufsinn, Taschenfräsen

### S.43 — 6.2.1 Sägeschnitt SG ohne Steigungswinkel
- Zeigt: Zwei Quader mit Sägeschnitt: links senkrecht (γ = 90°), rechts geneigt. Beschriftet: 1 Sägelinie, 2 Bezugskante, 3 Bezugsebene; Maße x (Position entlang der Kante), h (Tiefe senkrecht zur Bezugsebene), z; Winkel α (Drehwinkel der Säge in der Ebene) und γ (Neigungswinkel gegen die Bezugsebene); Achsenkreuz X/Y/Z.
- Aussage: SG x, y, z, α, γ, h, e, i [, β [, s]] — Position im Elementkoordinatensystem, α Drehwinkel, γ Neigungswinkel (Kanten- oder Flächenbezug je nach s-Bit), h Schnitttiefe senkrecht zur Bezugsebene, e Bezugsebene 1–6; SG definiert eine Halbebene entlang der Sägelinie.
- Stichworte: SG, Sägeschnitt, Drehwinkel, Neigungswinkel, alpha, gamma, h, Bezugskante, Bezugsebene, s-Bit

### S.44 — 6.2.2 Sägeschnitt SG mit Steigungswinkel β
- Zeigt: Wie S.43, zusätzlich 4 „Linie der Sägeblatt-Achse" und der Steigungswinkel β in der Schnittfläche (Sägelinie läuft schräg über die Oberseite). Beispielzeilen: LS 4519.4,100,200,0,0,10000,Kehlschifter links,0; SG 500,0,200,90.000,90.000,100,2,2,40.000,1;
- Aussage: β ist der Steigungswinkel in der Schnittfläche {0}; in der Referenzzeichnung ist β positiv. s = 1 schnittflächenbezogen, s = 0 bezugskantenbezogen (Standard).
- Stichworte: SG, Steigungswinkel, beta, Sägeblatt-Achse, Kehlschifter, s=1

### S.45 — 6.3 Neigungswinkel bei Polygonpunkten PP, KB, MP
- Zeigt: Zwei Platten mit Bearbeitungslinie (dicker Pfeil = Bearbeitungsrichtung) und geneigtem Werkzeugstrich am Punkt: positiv = im Uhrzeigersinn in Richtung der Bearbeitungslinie geneigt, negativ = gegen den Uhrzeigersinn.
- Aussage: Der Neigungswinkel α eines Polygonpunkts bezieht sich auf die Tangente der Bearbeitungslinie in Bearbeitungsrichtung an diesem Punkt; zwischen zwei Punkten mit unterschiedlichem α wird linear interpoliert. Vorzeichen wie im Bild.
- Stichworte: Neigungswinkel, alpha, PP, KB, MP, positiv, negativ, Interpolation, P-21

### S.46 — 6.4 Radius beim Polygonpunkt MP
- Zeigt: Kreis mit Drehpfeil im Uhrzeigersinn.
- Aussage: r > 0 = Kreisbogen im Uhrzeigersinn, r < 0 = gegen den Uhrzeigersinn — jeweils bei Blick **entgegen** der Z-Achse des zugehörigen Koordinatensystems.
- Stichworte: MP, Radius, Vorzeichen, Uhrzeigersinn, Drehrichtung

### S.51 — Polygonzug für seitliche Nut
- Zeigt: Schnitt durch ein Bauteil mit seitlicher Nut: Nutbreite t (Tiefe des Polygonpunkts), Lage z über der Unterkante, Einstich x in das Bauteil; Beispiel PAF; PP 40,0,35,113,0,30; PP 40,1800,35,113,0,30; (Steuercode 113, z = 30).
- Aussage: Eine seitliche Nut ist ein offener PAF-Polygonzug an einer Stirn-/Längsfläche; der z-Wert der PP positioniert die Nut in der Höhe, t ist die Nuttiefe.
- Stichworte: Nut, seitliche Nut, PAF, offener Polygonzug, z, t, 113

## Quelle: schnittstellenbeschreibung_3_7

### S.13 — 4.1 File header (Kopftabelle mit ELM-Skizze)
- Zeigt: Tabelle der Kopf-Schlüsselwörter mit Parametern und der Spalte „Optional“: VERSION (integer.integer[.integer]), ELEMENTID (GUID), CADDOKUMENTID, ANR, ELB, ELN, ZNR, ELM, CAD, CADRELEASE, BEARBEITER, BAUVORHABEN, KUNDENNAME (OBJEKT und ORT folgen auf S.14). In der ELM-Zeile eine kleine Skizze: Achsenkreuz x/y, graues Rechteck, dessen linke untere Ecke bei (xoffset, yoffset) und dessen rechte obere Ecke bei (lx, by) liegt.
- Aussage: Nur VERSION und ELM sind Pflicht, alle anderen Kopfzeilen optional. lx und by sind die Maximalwerte der Ordinaten, nicht die Kantenlängen — mit Offset ist das Element lx − xoffset breit. ELEMENTID ist eine GUID für Element und Dokument; ELB erlaubt nur a–z, A–Z, 0–9 und Unterstrich. REIHE, STAPEL, WNP und ELA stehen nicht mehr in der Tabelle.
- Stichworte: Dateikopf, VERSION, ELEMENTID, CADDOKUMENTID, ELM, xoffset, yoffset, BEARBEITER, KUNDENNAME, WUP 3.7

### S.20 — 4.2.2 Panels (Lagenhöhe bei zwei Plattendicken)
- Zeigt: Seitenansicht: unten ein durchgehender grauer Balken (Riegelwerk), darauf links eine dünnere und rechts eine dickere Platte derselben Lage; links ein Maßpfeil „h“ über Riegelwerk und Lage bis zur Oberkante der dickeren Platte. Darunter die Tabellen zu RT/ENDRT (Rohteil).
- Aussage: Ohne ausdrückliches z bestimmt die dickste Platte die Höhe der Lage und die bündige Außenfläche. Laut 3.7 gilt das rückwirkend für alle Versionen; bei gemischten Dicken soll z je Platte angegeben werden.
- Stichworte: Lagenhöhe, Plattendicke, dickste Platte, z, Versatz, PLI, PLA, WUP 3.7, RT, ENDRT

### S.30 — 4.6 Polygon paths (Geometrie der Tasche TA)
- Zeigt: Quader mit Bezugsebene e oben; darin eine schräg liegende Tasche mit Seitenlängen lx und by, Tiefe t, Eckradius r, Scherwinkel δ; senkrecht darüber die Drehachse durch den Mittelpunkt (xm, ym, z) mit Drehwinkel α. Darunter Parametertabelle (x, y, z, xm, ym, zm, t, i, alpha, r, type, lx, by, delta) und die Regel der zulässigen Kombinationen.
- Aussage: TA ist ein Einzelelement mit Mittelpunkt, zwei Seitenlängen, Tiefe, Eckradius, Drehung α und Scherung δ. Zulässig: PP gefolgt von PP/KB, KB nur nach PP/KB, MP oder TA allein. TA gilt nur innerhalb von PAF (Regel auf S.31).
- Stichworte: TA, Tasche, Taschenfräsen, lx, by, Scherwinkel, delta, alpha, Eckradius, PAF, Polygonzug

### S.35 — 5.4.1 Panels with tongue and groove edge profiles (Nut und Feder)
- Zeigt: Drei Kästen: „Plate A: Tongue on edge“ — graue Platte, deren Feder 21 mm über die rechte Kante hinausragt (Code 100 + 20 + 1 = 121); „Plate B: Groove on edge“ — Platte mit 36 mm tief eingeschnittener Nut (Code 200 + 30 + 6 = 236); „Assembled joint (section)“ — beide Platten gefügt. Darunter die Regel: control_code = feature base + tens depth + ones depth.
- Aussage: Der Steuercode steht im i-Feld des Polygonpunkts am ENDE der Kantenstrecke. 100 = Feder, 200 = Nut, Zehner und Einer = Tiefe in mm. Der Umriss beschreibt die Grundfläche; die Feder vergrößert die Platte darüber hinaus, die Nut schneidet hinein. Neu in 3.7 — bis 3.6 hat das i-Feld der Umrisspunkte keine Bedeutung (Granit schreibt dort den Materialindex).
- Stichworte: Nut, Feder, Tongue, Groove, Plattenumriss, Steuercode, 121, 236, Profilplatte, WUP 3.7, Materialindex
