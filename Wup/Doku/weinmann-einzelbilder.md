# Weinmann wupWorks — Katalog der Einzelbilder

> **Was das ist:** Beschreibung **jedes einzelnen Bildes** aus dem
> Weinmann-Repository `github.com/HomagGroup/WEINMANN-wupWorks` (MIT), das
> hier übernommen ist: die 36 Bilder der **Interface version 3.7** und die
> drei Diagramme der **SiteBroker**-Dokumente. Der Schwesterkatalog
> `weinmann-abbildungen.md` beschreibt ganze **Seiten** (V3.5, Datenblatt,
> 3.7); dieser hier die **Bilddateien** — so findet man eine Zeichnung auch
> dann, wenn sie mit anderen auf einer Seite steht.
>
> **Herkunft / Verbindlichkeit:** Die Beschreibungen hat eine KI aus den
> Bildern gelesen — **fachlich zu prüfen; maßgebend ist das Bild.** Bei den
> Koordinatensystemen sind die Achsrichtungen aus einer Schrägansicht
> abgelesen; im Zweifel das Bild ansehen. Abruf über den MCP-Server:
> `wup_spezifikation` mit `einzelbild: "<Kennung>"`.
>
> **3.7 gilt nicht für die Anlage (WUP 3.4.1).** 32 der 36 Bilder sind
> inhaltsgleich mit Zeichnungen der deutschen V3.5 und gelten damit auch
> dort (Bildvergleich vom 2026-11-13, `weinmann-tabellen-und-bilder.md`
> §3.2). **Neu in 3.7** sind nur `image` (Lagenhöhe) und
> `tongue_groove_index_5_4_1` (Nut/Feder). Das Titelbild zeigt ein anderes
> Motiv; die Strukturgrafik wurde nicht verglichen.
>
> **Zu den Dateinamen:** `page_NNN_img_MMM` zählt die Seiten der **3.6**-PDF
> (73 Seiten), aus der Weinmann die Bilder gezogen hat — nicht die der 3.7.
> Die Seite der 3.7-PDF steht je Eintrag unter „Seite“. Drei Dateien mit der
> Endung `.png` sind in Wahrheit JPEG (`page_010_img_028`, `page_064_img_187`,
> `page_065_img_191`); der Server erkennt das Format am Inhalt.
>
> **Bestand im Weinmann-Repo:** 250 Bilddateien im Ordner der 3.7, aber nur
> 40 verschiedene Inhalte (ein Logo liegt 73-mal vor). 35 Dateien sind im
> Text eingebunden und hier übernommen, dazu die nicht eingebundene
> Strukturgrafik. Zwei weitere SVG-Dateien (`custom_wall_elm.svg`,
> `custom_ceiling_roof_elm.svg`) sind dort **leer** (0 Byte). Die 246 Bilder
> der 3.6 sind inhaltsgleich enthalten.
>
> **Format (wird vom MCP-Server geparst):** `## Quelle: <schluessel>` leitet
> eine Quelle ein; jedes Bild ist ein `### <Kennung> — <Titel>`-Block mit den
> Zeilen `- Datei:`, optional `- Vorschau:`, `- Abschnitt:`, optional
> `- Seite:`, `- Zeigt:`, `- Aussage:`, `- Stichworte:`.

---

## Quelle: schnittstellenbeschreibung_3_7

### page_001_img_004 — Titelbild: Riegelwerk eines Gebäudes
- Datei: Wup/02_Schnittstellenbeschreibung etc/Weinmann-wupWorks/Interface_version_3_7_images/page_001_img_004.png
- Abschnitt: 1 Intended use
- Seite: 3
- Zeigt: Schrägansicht der Ständerwerke mehrerer Wände eines Gebäudes (schwarz), in der Mitte ein hell abgesetztes Element.
- Aussage: Illustration zum Zweck der Schnittstelle („Interface description for prefabricated house elements“). Keine fachliche Regel.
- Stichworte: Titelbild, Riegelwerk, Fertighaus, Wandelement, Illustration

### page_008_img_020 — Elementkoordinatensystem (Achsenkreuz)
- Datei: Wup/02_Schnittstellenbeschreibung etc/Weinmann-wupWorks/Interface_version_3_7_images/page_008_img_020.png
- Abschnitt: 2.3.1 Element coordinate system
- Seite: 5
- Zeigt: Rechtsdrehendes Achsenkreuz in Schrägansicht: z nach oben (blau), y nach hinten rechts (grün), x nach vorn rechts (rot).
- Aussage: Grundlage für die Bemaßung der Bauteile und der Lagenbearbeitungen. Bei Wandelementen liegt x entlang UG und OG, bei Dach- und Deckenelementen entlang LS — auch wenn ELM kleiner ist als die Elementbreite. Alle Koordinatensysteme sind rechtsdrehend.
- Stichworte: Elementkoordinatensystem, Achsenkreuz, rechtsdrehend, x, y, z, Wand, Dach, Decke

### page_024_img_078 — ELM-Bezug (lx, by, xoffset, yoffset)
- Datei: Wup/02_Schnittstellenbeschreibung etc/Weinmann-wupWorks/Interface_version_3_7_images/page_024_img_078.png
- Abschnitt: 2.3.1 Element coordinate system (und 4.1 File header)
- Seite: 6
- Zeigt: x/y-Achsen; ein graues Rechteck, dessen linke untere Ecke bei (xoffset, yoffset) und dessen rechte obere Ecke bei (lx, by) liegt; gestrichelte Hilfslinien zu den Achsen.
- Aussage: lx und by sind die Maximalwerte der Ordinaten, nicht die Kantenlängen. Mit Offset ist das Element lx − xoffset breit und by − yoffset hoch. Das Bild steht zweimal im Text (Koordinatensystem und Kopftabelle, dort S. 13).
- Stichworte: ELM, lx, by, xoffset, yoffset, Elementmaße, Maximalwert, Dateikopf

### page_009_img_024 — Bauteil-Koordinatensystem
- Datei: Wup/02_Schnittstellenbeschreibung etc/Weinmann-wupWorks/Interface_version_3_7_images/page_009_img_024.png
- Abschnitt: 2.3.2 Component coordinate system
- Seite: 6
- Zeigt: Quader (Bauteil) mit Ursprung an der linken unteren vorderen Ecke: x entlang der Bauteillänge nach rechts (rot), z nach oben (blau), y in die Tiefe (grün). Die graue Vorderfläche trägt die Nummer 3.
- Aussage: Die Bauteilbearbeitungen SG, SZ und REFKER sind in diesem System bemaßt. Der 3.7-Text nennt hier noch PFZ, obwohl 3.7 das Keyword streicht.
- Stichworte: Bauteilkoordinatensystem, SG, SZ, REFKER, PFZ, Quader, Ursprung, Bezugsebene 3

### page_010_img_028 — Bezugsebenen 1–6 des Quaders
- Datei: Wup/02_Schnittstellenbeschreibung etc/Weinmann-wupWorks/Interface_version_3_7_images/page_010_img_028.png
- Abschnitt: 2.3.3 Reference planes
- Seite: 6
- Zeigt: Quader im Bauteil-Koordinatensystem mit nummerierten Flächen: 1 Rückseite (die Ziffer steht gespiegelt, also von hinten gesehen), 2 Oberseite (Pfeil von oben), 3 Vorderseite zum Betrachter, 4 Unterseite (Pfeil von unten, gestrichelt), 5 linke Stirnfläche bei x = 0, 6 rechte Stirnfläche (gestrichelter Pfeil von rechts).
- Aussage: Bezugsebenen der quaderförmigen Bauteile UG, OG, LS, QS und RT. Der Parameter e der Bearbeitungen wählt eine dieser Ebenen; 5 und 6 sind die Stirnseiten (seit 3.3).
- Stichworte: Bezugsebene, Referenzebene, e, 1 bis 6, Stirnfläche, UG, OG, LS, QS, RT

### page_011_img_032 — Bezugskanten 1–6 des Quaders
- Datei: Wup/02_Schnittstellenbeschreibung etc/Weinmann-wupWorks/Interface_version_3_7_images/page_011_img_032.png
- Abschnitt: 2.3.4 Reference edges
- Seite: 7
- Zeigt: Quader mit Pfeilen auf seine Längskanten: 1 obere hintere, 2 obere vordere, 3 untere vordere, 4 untere hintere (gestrichelt). 5 zeigt auf das linke Ende am Ursprung, 6 auf das rechte Ende.
- Aussage: Bezugskanten der Bauteile UG, OG, LS, QS und RT. Beim Sägeschnitt SG beziehen sich Winkel mit s = 0 auf diese Kanten, mit s = 1 auf die Schnittflächen.
- Stichworte: Bezugskante, Referenzkante, Längskante, SG, s-Bit, UG, OG, LS, QS

### page_012_img_041 — Ebenen-Koordinatensystem der Bezugsebene 1
- Datei: Wup/02_Schnittstellenbeschreibung etc/Weinmann-wupWorks/Interface_version_3_7_images/page_012_img_041.png
- Abschnitt: 2.3.5 Plane coordinate system
- Seite: 7
- Zeigt: Bauteilachsen xE nach rechts und yE nach oben (fett). Dazu grau das lokale System der Ebene 1 (Rückseite): x nach rechts, z nach unten, y schräg nach vorn.
- Aussage: PSG, TA, KN, MPL, PAF, PZF, PSF und RBE2 an Bauteilen werden im lokalen System der gewählten Bezugsebene bemaßt. Auf Ebene 1 läuft das lokale x mit dem Bauteil-x.
- Stichworte: Ebenenkoordinatensystem, Bezugsebene 1, lokale Achsen, xE, yE, PAF, PSG, Bauteil

### page_012_img_042 — Ebenen-Koordinatensystem der Bezugsebene 2
- Datei: Wup/02_Schnittstellenbeschreibung etc/Weinmann-wupWorks/Interface_version_3_7_images/page_012_img_042.png
- Abschnitt: 2.3.5 Plane coordinate system
- Seite: 7
- Zeigt: Bauteilachsen xE nach rechts, yE nach oben. Lokales System der Ebene 2 (Oberseite) grau: x nach rechts, y nach oben parallel zu yE, z schräg nach vorn unten.
- Aussage: Ebene 2 ist die Standardebene der Plattenbearbeitungen (e = 2) und die Pflichtebene innerhalb einer Raumbearbeitungsebene RBE2.
- Stichworte: Ebenenkoordinatensystem, Bezugsebene 2, Standardebene, Platte, RBE2, lokale Achsen

### page_012_img_043 — Ebenen-Koordinatensystem der Bezugsebene 3
- Datei: Wup/02_Schnittstellenbeschreibung etc/Weinmann-wupWorks/Interface_version_3_7_images/page_012_img_043.png
- Abschnitt: 2.3.5 Plane coordinate system
- Seite: 7
- Zeigt: Beschriftung „xE = x“ und „yE = z“: auf der Vorderseite fällt das lokale x mit xE zusammen und das lokale z mit yE; das lokale y zeigt schräg nach hinten in die Tiefe.
- Aussage: Auf Ebene 3 ist die Zuordnung direkt ablesbar — lokales z ist die Bauteil-y-Achse der Zeichnung. Die Tiefe einer Bearbeitung wirkt entgegen dem lokalen z.
- Stichworte: Ebenenkoordinatensystem, Bezugsebene 3, Vorderseite, xE gleich x, yE gleich z

### page_012_img_044 — Ebenen-Koordinatensystem der Bezugsebene 4
- Datei: Wup/02_Schnittstellenbeschreibung etc/Weinmann-wupWorks/Interface_version_3_7_images/page_012_img_044.png
- Abschnitt: 2.3.5 Plane coordinate system
- Seite: 8
- Zeigt: Bauteilachsen xE nach rechts, yE nach oben. Lokales System der Ebene 4 (Unterseite) grau: x nach rechts, y nach unten, z schräg nach hinten oben.
- Aussage: Auf der Unterseite ist das lokale y gegenüber der Oberseite umgekehrt; x bleibt in Bauteillängsrichtung.
- Stichworte: Ebenenkoordinatensystem, Bezugsebene 4, Unterseite, lokale Achsen, gespiegelt

### page_012_img_045 — Ebenen-Koordinatensystem der Bezugsebene 5
- Datei: Wup/02_Schnittstellenbeschreibung etc/Weinmann-wupWorks/Interface_version_3_7_images/page_012_img_045.png
- Abschnitt: 2.3.5 Plane coordinate system
- Seite: 8
- Zeigt: Graue Stirnfläche mit der Nummer 5. Bauteilachsen an der rechten unteren Ecke: xE nach oben, yE nach links, zE schräg zum Betrachter. Lokales System grau: y nach links, x schräg nach hinten rechts, eine dritte Achse nach oben.
- Aussage: Koordinatensystem der linken Stirnfläche (x = 0), eingeführt mit 3.3 für die Balkenbearbeitung. Bei SG gilt die Korrektur im Steuercode auf den Ebenen 5 und 6 relativ zur Y-Achse.
- Stichworte: Ebenenkoordinatensystem, Bezugsebene 5, Stirnfläche, Hirnholz, Balkenbearbeitung, zE

### page_012_img_046 — Ebenen-Koordinatensystem der Bezugsebene 6
- Datei: Wup/02_Schnittstellenbeschreibung etc/Weinmann-wupWorks/Interface_version_3_7_images/page_012_img_046.png
- Abschnitt: 2.3.5 Plane coordinate system
- Seite: 8
- Zeigt: Graue Stirnfläche mit der Nummer 6. Bauteilachsen an der linken oberen Ecke: yE nach rechts, xE nach unten, zE schräg zum Betrachter. Lokales System grau: y nach rechts, x schräg nach vorn links, eine dritte Achse nach oben.
- Aussage: Koordinatensystem der rechten Stirnfläche. Gegenstück zu Ebene 5; die Achsen sind gegenüber Ebene 5 gespiegelt angeordnet.
- Stichworte: Ebenenkoordinatensystem, Bezugsebene 6, Stirnfläche, Hirnholz, Balkenbearbeitung, zE

### page_013_img_051 — Raumbearbeitungsebene: Ausgangsebene
- Datei: Wup/02_Schnittstellenbeschreibung etc/Weinmann-wupWorks/Interface_version_3_7_images/page_013_img_051.png
- Abschnitt: 2.3.6 Spatial processing coordinate system
- Seite: 8
- Zeigt: Achsen x, y, z; in der x/y-Ebene ein schraffiertes Parallelogramm (die Ausgangsebene).
- Aussage: Ausgangslage vor der Transformation. Eine Raumbearbeitungsebene (RBE2) legt ein neues Koordinatensystem fest; alle Bearbeitungen darin sind mit Bezugsebene 2 anzugeben.
- Stichworte: RBE2, Raumbearbeitungsebene, Ausgangsebene, Transformation, Bezugsebene 2

### page_013_img_052 — Raumbearbeitungsebene: Drehung um die Z-Achse
- Datei: Wup/02_Schnittstellenbeschreibung etc/Weinmann-wupWorks/Interface_version_3_7_images/page_013_img_052.png
- Abschnitt: 2.3.6 Spatial processing coordinate system
- Seite: 8
- Zeigt: Die schraffierte Ausgangsebene und die gedrehte Ebene (grau); z bleibt (z = z′), die neuen Achsen x′ und y′ sind um die z-Achse gedreht; Drehpfeil an der z-Achse.
- Aussage: Erste Drehung der RBE2 um den Winkel α um die Z-Achse. Reihenfolge laut Text: erst verschieben (x, y, z), dann α, dann γ, dann δ.
- Stichworte: RBE2, Drehwinkel, alpha, Z-Achse, x Strich, y Strich, Transformationsreihenfolge

### page_014_img_056 — Raumbearbeitungsebene: Neigung um die X′-Achse
- Datei: Wup/02_Schnittstellenbeschreibung etc/Weinmann-wupWorks/Interface_version_3_7_images/page_014_img_056.png
- Abschnitt: 2.3.6 Spatial processing coordinate system
- Seite: 9
- Zeigt: Die bereits gedrehte Ebene wird um die x′-Achse gekippt: x′ = x″ bleibt, y″ und z″ sind neu; Drehpfeil an der x′-Achse; die vorherigen Achsen grau.
- Aussage: Zweite Drehung der RBE2 um den Winkel γ. Ein dritter Winkel δ dreht danach um die neue z″-Achse. Tiefen sind positiv und wirken entgegen z″.
- Stichworte: RBE2, Neigungswinkel, gamma, delta, X-Achse, gekippte Ebene, z Doppelstrich

### page_027_img_086 — BT4: Bauteil mit vier Eckpunkten
- Datei: Wup/02_Schnittstellenbeschreibung etc/Weinmann-wupWorks/Interface_version_3_7_images/page_027_img_086.png
- Abschnitt: 4.2.1 Single components, single bars
- Seite: 16
- Zeigt: Schräg liegendes Viereck im x/y-System mit den Punkten P1.1 (oben links), P1.2 (darunter), P2.1 (unten rechts) und P2.2 (rechts). Maß lx entlang der Kante P1.1–P2.2, Maß by quer dazu zwischen den beiden parallelen Längskanten.
- Aussage: Reihenfolge im Befehl: x11, y11, x12, y12, x21, y21, x22, y22. Die Faserrichtung geben die Linien P1.1–P2.2 und P1.2–P2.1 vor; beide müssen parallel sein. lx ist die Länge entlang dieser Richtung, nicht die Ausdehnung in x.
- Stichworte: BT4, Trapez, Eckpunkte, P1.1, P2.2, lx, by, Faserrichtung, Schrägstab

### page_028_img_090 — BT6: Bauteil mit sechs Eckpunkten
- Datei: Wup/02_Schnittstellenbeschreibung etc/Weinmann-wupWorks/Interface_version_3_7_images/page_028_img_090.png
- Abschnitt: 4.2.1 Single components, single bars
- Seite: 17
- Zeigt: Sechseck im x/y-System: P1.1 oben links, P1.2 linke Spitze, P1.3 unten links, P2.1 unten rechts, P2.2 rechte Spitze, P2.3 oben rechts.
- Aussage: Zwei Punktreihen P1.x (ein Ende) und P2.x (anderes Ende). Die Faserrichtung geben P1.1–P2.3 und P1.3–P2.1 vor; die Bauteillänge ist der größte Abstand zwischen einem P1- und einem P2-Punkt.
- Stichworte: BT6, sechs Eckpunkte, P1.2, P2.2, Spitze, Faserrichtung, Bauteillänge

### image — Lagenhöhe bei zwei Plattendicken
- Datei: Wup/02_Schnittstellenbeschreibung etc/Weinmann-wupWorks/image.png
- Abschnitt: 4.2.2 Panels
- Seite: 20
- Zeigt: Seitenansicht: unten ein durchgehender grauer Balken (Riegelwerk), darauf links eine dünnere und rechts eine dickere Platte derselben Lage; Maßpfeil h vom Riegelwerk bis zur Oberkante der dickeren Platte.
- Aussage: Ohne ausdrückliches z bestimmt die dickste Platte die Höhe der Lage und die bündige Außenfläche. Laut 3.7 gilt das rückwirkend; bei gemischten Dicken z je Platte angeben. **Neu in 3.7.**
- Stichworte: Lagenhöhe, Plattendicke, dickste Platte, z, Versatz, PLI, PLA, neu in 3.7

### page_047_img_130 — Geometrie der Tasche TA
- Datei: Wup/02_Schnittstellenbeschreibung etc/Weinmann-wupWorks/Interface_version_3_7_images/page_047_img_130.png
- Abschnitt: 4.6 Polygon paths
- Seite: 30
- Zeigt: Quader mit Bezugsebene e oben; darin eine schräg liegende Tasche mit Seitenlängen lx und by, Tiefe t, Eckradius r und Scherwinkel δ; senkrecht darüber die Drehachse durch den Mittelpunkt (xm, ym, z) mit Drehwinkel α.
- Aussage: TA lx, by, xm, ym, z, t, r, alpha, delta, i. Die Tasche ist ein Einzelelement und nur in PAF zulässig. Steuercode i: 0 nach Maschinenregel, 1 Überschnitt, 2 Unterschnitt — für alle vier Ecken.
- Stichworte: TA, Tasche, Taschenfräsen, lx, by, Scherwinkel, delta, Eckradius, alpha, PAF

### page_048_img_134 — Einbaulage: vier Querschnitte a bis d
- Datei: Wup/02_Schnittstellenbeschreibung etc/Weinmann-wupWorks/Interface_version_3_7_images/page_048_img_134.png
- Abschnitt: 5.1 Installation position of UG, OG, LS, QS, EBT
- Seite: 32
- Zeigt: Vier schraffierte Querschnitte eines genuteten Riegels im x/z-System, eine gestrichelte Linie markiert die Oberkante: a hochkant, Nut links; b flach auf der Grundlinie, Nut oben; c hochkant, Nut rechts; d flach oben an der gestrichelten Linie, Nut unten.
- Aussage: Beispiel „Querriegel, Ansicht INNEN“ zum Materialindex: Einerstelle = Einbaulage (0 normal, 1 flach bündig außen, 2 flach bündig innen, 3 flach mittig), Zehnerstelle = Drehung um die Längsachse (0, 90, 180, 270 Grad). Die Zeile unter dem Bild lautet „Definition · i = 11 · i = 20 · i = 32“: a ist die Ausgangslage, b, c und d die drei Beispielwerte (Zuordnung aus der Anordnung gelesen; sie passt: 11 = flach außen und 90 Grad, 20 = 180 Grad, 32 = flach innen und 270 Grad). Die Auswertung der Einerstelle ist abgekündigt; ein angegebenes z hat Vorrang.
- Stichworte: Einbaulage, Materialindex, Einerstelle, Zehnerstelle, Drehung, flach, hochkant, Querriegel, Nut

### tongue_groove_index_5_4_1 — Nut und Feder am Plattenumriss
- Datei: Wup/02_Schnittstellenbeschreibung etc/Weinmann-wupWorks/Interface_version_3_7_images/tongue_groove_index_5_4_1.svg
- Vorschau: Wup/02_Schnittstellenbeschreibung etc/Seiten/einzelbilder/v37_tongue_groove_index_5_4_1.png
- Abschnitt: 5.4.1 Control codes for panels with defined polygon points
- Seite: 35
- Zeigt: Drei Kästen: „Plate A: Tongue on edge“ — die Feder ragt 21 mm über die rechte Kante hinaus (Code 100 + 20 + 1 = 121); „Plate B: Groove on edge“ — 36 mm tief eingeschnittene Nut (Code 200 + 30 + 6 = 236); „Assembled joint (section)“ — beide gefügt. Darunter die Regel control_code = feature base + tens depth + ones depth.
- Aussage: Der Code steht im i-Feld des Umrisspunkts am ENDE der Kantenstrecke: 100 = Feder, 200 = Nut, Zehner und Einer = Tiefe in mm. Die Feder vergrößert die Platte über den Umriss hinaus. **Neu in 3.7** — bis 3.6 hat das Feld dort keine Bedeutung, Granit schreibt dort den Materialindex.
- Stichworte: Nut, Feder, Tongue, Groove, Plattenumriss, Steuercode, 121, 236, neu in 3.7, Materialindex

### page_053_img_147 — Überschnitt (Steuercode xx1x)
- Datei: Wup/02_Schnittstellenbeschreibung etc/Weinmann-wupWorks/Interface_version_3_7_images/page_053_img_147.png
- Abschnitt: 6.1.2 Undercut and overcut
- Seite: 37
- Zeigt: Zwei Werkzeugkreise am Anfang und am Ende einer Strecke; die senkrechten Linien durch Anfangs- und Endpunkt laufen durch die Kreismitten; Pfeil von Anfang zu Ende.
- Aussage: Überschneidend: Die Werkzeugmitte fährt bis auf den Endpunkt, das Werkzeug schneidet also um seinen Radius über das Ende hinaus.
- Stichworte: Überschnitt, überschneidend, Zehnerstelle, 10, Werkzeugmitte, Endpunkt, PAF, PSG

### page_053_img_148 — Unterschnitt (Steuercode xx2x)
- Datei: Wup/02_Schnittstellenbeschreibung etc/Weinmann-wupWorks/Interface_version_3_7_images/page_053_img_148.png
- Abschnitt: 6.1.2 Undercut and overcut
- Seite: 37
- Zeigt: Dieselbe Strecke; die beiden Werkzeugkreise liegen innerhalb, ihr Umfang berührt die Linie durch Anfangs- bzw. Endpunkt.
- Aussage: Unterschneidend: Das Werkzeug bleibt innerhalb der Strecke, an Innenecken bleibt Material stehen — daher der Freistich.
- Stichworte: Unterschnitt, unterschneidend, Zehnerstelle, 20, Werkzeugumfang, Innenecke, Freistich

### page_054_img_153 — Keine Werkzeugradiuskorrektur (Steuercode 300)
- Datei: Wup/02_Schnittstellenbeschreibung etc/Weinmann-wupWorks/Interface_version_3_7_images/page_054_img_153.png
- Abschnitt: 6.1.3 Tool radius correction
- Seite: 38
- Zeigt: Bearbeitungslinie mit Pfeil nach rechts; der schraffierte Werkzeugkreis sitzt mittig auf der Linie; gestrichelte Linien an Ober- und Unterkante des Werkzeugs; Drehpfeil.
- Aussage: Bei 300 fährt die Werkzeugmitte auf der Linie. Abfall und Gutteil lassen sich nicht unterscheiden.
- Stichworte: Radiuskorrektur, 300, keine Korrektur, mittig, Hunderterstelle, Abfall, Gutteil

### page_054_img_154 — Radiuskorrektur links (Steuercode 100)
- Datei: Wup/02_Schnittstellenbeschreibung etc/Weinmann-wupWorks/Interface_version_3_7_images/page_054_img_154.png
- Abschnitt: 6.1.3 Tool radius correction
- Seite: 38
- Zeigt: Bearbeitungslinie mit Pfeil nach rechts; der Werkzeugkreis liegt oberhalb und berührt die Linie von oben — in Fahrtrichtung links.
- Aussage: Bei 100 fährt das Werkzeug links der Linie, das Werkstück liegt rechts. Der Abfall liegt auf der Seite des Werkzeugs. Links und rechts gelten in Bearbeitungsrichtung und von einer festen Ansichtsseite aus.
- Stichworte: Radiuskorrektur, 100, links, Werkstück rechts, Bearbeitungsrichtung, Ansichtsseite

### page_055_img_160 — Radiuskorrektur rechts (Steuercode 200)
- Datei: Wup/02_Schnittstellenbeschreibung etc/Weinmann-wupWorks/Interface_version_3_7_images/page_055_img_160.png
- Abschnitt: 6.1.3 Tool radius correction
- Seite: 38
- Zeigt: Bearbeitungslinie mit Pfeil nach rechts; der Werkzeugkreis liegt unterhalb und berührt die Linie von unten — in Fahrtrichtung rechts.
- Aussage: Bei 200 fährt das Werkzeug rechts der Linie, das Werkstück liegt links. Eine Kontur umzukehren vertauscht die Seite — deshalb kehrt der Editor PAF/PSG-Konturen nie um.
- Stichworte: Radiuskorrektur, 200, rechts, Werkstück links, Bearbeitungsrichtung, Konturrichtung

### page_057_img_169 — Beispiel: kreisförmige Ausfräsung
- Datei: Wup/02_Schnittstellenbeschreibung etc/Weinmann-wupWorks/Interface_version_3_7_images/page_057_img_169.png
- Abschnitt: 6.1.5 Examples
- Seite: 39
- Zeigt: Kreis mit Mittelpunkt und Pfeilspitze im Uhrzeigersinn.
- Aussage: Beispiel `PAF` mit `MP 3382,40,34,18,211;` — Vollkreis im Uhrzeigersinn (positiver Radius), Tiefe 18, Code 211.
- Stichworte: Beispiel, PAF, MP, Kreis, Uhrzeigersinn, 211, Bohrungsersatz

### page_057_img_170 — Beispiel: geschlossene rechteckige Ausfräsung
- Datei: Wup/02_Schnittstellenbeschreibung etc/Weinmann-wupWorks/Interface_version_3_7_images/page_057_img_170.png
- Abschnitt: 6.1.5 Examples
- Seite: 39
- Zeigt: Rechteckiger Linienzug mit Pfeilspitzen an den Ecken, Start unten links.
- Aussage: Beispiel `PAF` mit fünf `PP` (erster = letzter Punkt), Code 121: zylindrischer Fräser, unterschneidend, Korrektur links.
- Stichworte: Beispiel, PAF, PP, Rechteck, geschlossen, 121, Unterschnitt

### page_057_img_171 — Beispiel: Ausfräsung mit Kreisbogen
- Datei: Wup/02_Schnittstellenbeschreibung etc/Weinmann-wupWorks/Interface_version_3_7_images/page_057_img_171.png
- Abschnitt: 6.1.5 Examples
- Seite: 39
- Zeigt: Linie links nach oben, Halbkreisbogen über die Oberseite, Linie rechts nach unten.
- Aussage: Beispiel `PAF` mit `PP`, `KB 3000,1800,800,Acw,16,211,0;` und `PP` — der Bogen im Uhrzeigersinn bis 180 Grad (Typ Acw) verbindet zwei Geraden.
- Stichworte: Beispiel, PAF, KB, Kreisbogen, Acw, 211, offener Zug

### page_064_img_187 — Sägeschnitt SG ohne Steigungswinkel
- Datei: Wup/02_Schnittstellenbeschreibung etc/Weinmann-wupWorks/Interface_version_3_7_images/page_064_img_187.png
- Abschnitt: 7.2.1 Saw cut without gradient angle
- Seite: 42
- Zeigt: Zwei Quader mit roter Schnittfläche. Links ein senkrechter Schnitt, rechts ein schräger. Eingetragen: x entlang der vorderen unteren Kante, z in die Tiefe, h als Schnitttiefe, α als Winkel der Schnittlinie zur Bezugskante, γ als Winkel am Fußpunkt; rechts ein Achsenkreuz X, Y, Z.
- Aussage: SG x, y, z, alpha, gamma, h, e, i: Position, Drehwinkel α, Neigungswinkel γ und Tiefe h senkrecht zur Bezugsebene. Ob sich der Neigungswinkel auf Kanten oder Flächen bezieht, bestimmt das s-Bit. SG beschreibt eine Halbebene, keinen Punkt-zu-Punkt-Schnitt.
- Stichworte: SG, Sägeschnitt, alpha, gamma, Drehwinkel, Neigungswinkel, Schnitttiefe h, Bezugskante, s-Bit

### page_065_img_191 — Sägeschnitt SG mit Steigungswinkel β
- Datei: Wup/02_Schnittstellenbeschreibung etc/Weinmann-wupWorks/Interface_version_3_7_images/page_065_img_191.png
- Abschnitt: 7.2.2 Saw cut with gradient angle
- Seite: 43
- Zeigt: Wie zuvor, zusätzlich der Winkel β in der Schnittfläche und rote Linien der Sägeblattachse; links senkrechter, rechts geneigter Schnitt.
- Aussage: Der optionale Steigungswinkel β liegt in der Schnittfläche; in der Zeichnung ist er positiv. Beispiel im Text: `SG 500,0,200,90.000,90.000,100,2,2,40.000,1;` an einem Kehlschifter.
- Stichworte: SG, Steigungswinkel, beta, Sägeblattachse, Kehlschifter, Dach, s-Bit

### page_066_img_196 — Neigungswinkel am Polygonpunkt: positiv
- Datei: Wup/02_Schnittstellenbeschreibung etc/Weinmann-wupWorks/Interface_version_3_7_images/page_066_img_196.png
- Abschnitt: 7.3 Tilt angle for polygon points PP, KB, and MP
- Seite: 44
- Zeigt: Platte in Schrägansicht mit fettem Pfeil der Bearbeitungsrichtung; am Startpunkt eine kurze, nach einer Seite geneigte Werkzeuglinie; ein dünner Pfeil zeigt die Blickrichtung, eine Marke die Tiefe.
- Aussage: Der Neigungswinkel bezieht sich auf die Tangente der Bearbeitungslinie in Bearbeitungsrichtung. Positiv = im Uhrzeigersinn. Zwischen zwei Punkten mit verschiedenen Winkeln wird linear interpoliert.
- Stichworte: Neigungswinkel, alpha, positiv, Uhrzeigersinn, Tangente, Interpolation, PP, KB, MP

### page_066_img_197 — Neigungswinkel am Polygonpunkt: negativ
- Datei: Wup/02_Schnittstellenbeschreibung etc/Weinmann-wupWorks/Interface_version_3_7_images/page_066_img_197.png
- Abschnitt: 7.3 Tilt angle for polygon points PP, KB, and MP
- Seite: 44
- Zeigt: Dieselbe Platte; die Werkzeuglinie ist zur anderen Seite geneigt.
- Aussage: Negativ = gegen den Uhrzeigersinn in Bearbeitungsrichtung. Gegenstück zum vorigen Bild.
- Stichworte: Neigungswinkel, alpha, negativ, Gegenuhrzeigersinn, Schrägschnitt, P-21

### page_067_img_201 — Radius am Kreismittelpunkt MP
- Datei: Wup/02_Schnittstellenbeschreibung etc/Weinmann-wupWorks/Interface_version_3_7_images/page_067_img_201.png
- Abschnitt: 7.4 Radius for polygon point MP
- Seite: 44
- Zeigt: Kreis mit Mittelpunkt und Pfeilspitze im Uhrzeigersinn.
- Aussage: Positiver Radius = Bearbeitung im Uhrzeigersinn, negativer = dagegen — gesehen entgegen der Z-Achse des jeweiligen Koordinatensystems.
- Stichworte: MP, Radius, Vorzeichen, Uhrzeigersinn, Blickrichtung, Z-Achse, Vollkreis

### page_073_img_215 — Polygonzug für eine seitliche Nut
- Datei: Wup/02_Schnittstellenbeschreibung etc/Weinmann-wupWorks/Interface_version_3_7_images/page_073_img_215.png
- Abschnitt: 8.5 Polygon paths
- Seite: 49
- Zeigt: Kante einer Platte im Schnitt mit einer von der Seite eingefrästen Nut: Maß X als Eindringtiefe von der Kante, t als Nutbreite in Dickenrichtung, z als Höhe der Nut über der Unterseite; daneben ein Achsenkreuz x, y, z.
- Aussage: Beispiel für eine Nut in der Plattenkante: Polygonpunkte mit Werkzeug 3 (Fräser für horizontale Nut) und einer z-Angabe, im Text `PP 40,1800,35,113,0,30;`.
- Stichworte: seitliche Nut, Nutfräser, Werkzeug 3, 113, z-Angabe, Plattenkante, PAF

### file_structure_2_1 — Dateistruktur (nicht eingebunden, Stand 3.6)
- Datei: Wup/02_Schnittstellenbeschreibung etc/Weinmann-wupWorks/Interface_version_3_7_images/file_structure_2_1.svg
- Vorschau: Wup/02_Schnittstellenbeschreibung etc/Seiten/einzelbilder/v37_file_structure_2_1.png
- Abschnitt: 2.1 File structure
- Zeigt: Verschachtelte Kästen: Dateikopf (VERSION, ANR, ELB, ELN, ZNR, REIHE, ELA, ELM, WNP, CAD, CADRELEASE) → optional Rohteile RT → (A) Bauteile des Riegelwerks mit PROPERTY und Bauteilbearbeitungen → (B) Lagen PLI0–PLI10, PLA0–PLA10 mit Lagenbearbeitungen einschließlich PAL → (C) Module MODUL/ENDMODUL.
- Aussage: Die Grafik liegt im 3.7-Ordner, ist im 3.7-Text aber **nicht eingebunden** und zeigt den Stand **3.6**: Der Kopf nennt noch REIHE, ELA und WNP und keine der neuen 3.7-Kopfzeilen, bei den Bearbeitungen steht noch RBE. Für 3.7 gilt die Liste im Text (S. 3). Als Übersicht der Schachtelung (A)/(B)/(C) bleibt sie brauchbar: Eine Kategorie endet, wenn eine neue beginnt.
- Stichworte: Dateistruktur, Schachtelung, Kategorien, Dateikopf, RT, Lagen, Module, veraltet, Stand 3.6

---

## Quelle: sitebroker

### sitebroker_architektur — SiteBroker: Architektur
- Datei: Wup/02_Schnittstellenbeschreibung etc/Weinmann-wupWorks/sitebroker/.attachments/image-7d680f93-1357-4c25-985d-db893de04bd8.png
- Vorschau: Wup/02_Schnittstellenbeschreibung etc/Seiten/einzelbilder/sitebroker_architektur.png
- Abschnitt: General Concept — Architecture, Central Database
- Zeigt: „Upstream system“ oben schickt „Command“ an den Site-Broker (Mitte), dieser gibt „Command“ an wupWorks (unten) weiter. Gestrichelt: Das Upstream-System legt Daten in der „Central DB“ ab („Add data“); wupWorks holt sie von dort („Load data“).
- Aussage: Befehle und Daten gehen getrennte Wege. Über den Broker (MQTT) laufen nur Befehle und Statusmeldungen; die Dokumente legt das übergeordnete System in der zentralen Datenbank ab, und wupWorks lädt sie per REST. Wer Dateien an die Maschine geben will, braucht also beides.
- Stichworte: SiteBroker, Architektur, MQTT, Central DB, REST, Upstream system, wupWorks, Befehl, Daten

### sitebroker_einsatzformen — SiteBroker: vier Einsatzformen
- Datei: Wup/02_Schnittstellenbeschreibung etc/Weinmann-wupWorks/sitebroker/.attachments/image-0e84657a-e2ec-4766-ba8f-473c031da80d.png
- Vorschau: Wup/02_Schnittstellenbeschreibung etc/Seiten/einzelbilder/sitebroker_einsatzformen.png
- Abschnitt: General Concept — Deployment scenarios
- Zeigt: Vier Spalten. „Software Only“: DocDB und Site-Broker in der „HI Cloud“, darunter ein Maschinen-PC mit Tablet. „Standalone machine“: DocDB und Site-Broker auf dem Maschinen-PC neben der Maschine. „Connected local environment“: im Kasten „Fabrik“ stehen **granIT** und **Orchestrator** über DocDB und Site-Broker; darunter eine Maschine, deren eigene DocDB und Site-Broker ausgegraut sind, und ein weiterer Maschinen-PC mit Tablet. „Connected cloud environment“: dasselbe mit der HI Cloud statt der Fabrik.
- Aussage: Der Text nennt nur zwei Einsatzformen (Einzelmaschine, Verbund); das Bild zeigt vier. In der vernetzten Fabrik zeichnet Weinmann **granIT als übergeordnetes System** neben dem Orchestrator — das ist die Konstellation mit Granit-Umlaufsteuerung. Der lokale Broker der Maschine ist dann abgeschaltet, sie hängt am zentralen. „granIT“ steht nur im Bild, in keinem der Texte.
- Stichworte: SiteBroker, Einsatzformen, granIT, Granit, Orchestrator, Fabrik, HI Cloud, DocDB, Standalone, Verbund

### sitebroker_altanlagen — SiteBroker: Altanlagen und altes Leitsystem
- Datei: Wup/02_Schnittstellenbeschreibung etc/Weinmann-wupWorks/sitebroker/.attachments/image-fc468b9d-ec31-4b7b-88f7-7058a95b5ba1.png
- Vorschau: Wup/02_Schnittstellenbeschreibung etc/Seiten/einzelbilder/sitebroker_altanlagen.png
- Abschnitt: General Concept — Legacy systems
- Zeigt: Links „Legacy machines“: Site-Broker ↔ Adapter aus „Site-Broker Client (wupx2wup)“ und „UDP Server“ ↔ mesClient ↔ **wupWorks 3/4** ↔ Maschine; ein Notizzettel „Simulates granIT“ hängt am UDP-Server. Rechts „Legacy MES“: ein Adapter aus „UDP Client“ und „Site-Broker Client“ verbindet ein altes MES mit dem Site-Broker; darunter **wupWorks 5** ↔ Maschine; Notizzettel „Simulates machine“.
- Aussage: wupWorks 5 spricht den Site-Broker direkt; wupWorks 3/4 braucht einen Adapter über UDP und den mesClient. Der Adapter heißt „wupx2wup“ — ein Hinweis auf ein Format wupx neben wup, das in keinem der Texte erklärt wird. Das bisherige Protokoll zwischen Leitsystem und Maschine ist UDP; der Adapter „simuliert granIT“ gegenüber der Altanlage. **In unserer Kopie sind auf beiden Notizzetteln die Namenszeilen übermalt** (Personenname im Original).
- Stichworte: SiteBroker, Altanlage, Legacy, wupWorks 5, wupWorks 3/4, mesClient, UDP, wupx2wup, wupx, granIT, MES
