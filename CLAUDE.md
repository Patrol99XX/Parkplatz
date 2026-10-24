# Parkplatz-Kontrolle – Projektbeschreibung

## Ziel
Web-App für den Parkplatzdienst eines Autohauses (Aftersales). Sie schafft Überblick über die
Stellflächen im Parkhaus und auf den Außenflächen, misst die Standdauer jedes Fahrzeugs und
macht sichtbar, welche Fahrzeuge zu lange stehen und warum. Die Daten dienen dem Controlling
des Aftersales und als Grundlage für Gespräche mit den Serviceberatern.

Das Projekt ist zugleich ein Lernprojekt für Claude Code. Erkläre deshalb bei wichtigen
Entscheidungen kurz, warum du etwas so löst, und halte die Lösung einfach und nachvollziehbar.

## Fachlicher Hintergrund
- Kundenfahrzeuge, die abgestellt werden, sollen noch am gleichen Tag bearbeitet werden,
  also den Stellplatz in Richtung Werkstatt verlassen.
- Fertige Fahrzeuge sollen möglichst am gleichen Tag, spätestens innerhalb von 24 Stunden
  abgeholt werden.
- Stellplätze werden regelmäßig durch Fremdparker und andere Fahrzeuge blockiert.
- Der Parkplatzdienst kontrolliert zweimal täglich (morgens und nachmittags).
- Der Parkplatzdienst kennt den Bearbeitungsstatus eines Fahrzeugs NICHT und weiß nicht,
  welcher Serviceberater zuständig ist. Er stellt nur fest, was dasteht und seit wann.
- Den Grund für eine lange Standdauer liefert der Serviceberater nach Rückfrage
  (Klärungsgrund). Erst damit kommt ein Status in die Daten.

## Nutzer und Gerät
- Hauptnutzer: Parkplatzdienst, auf einem iPad (Safari, als Home-Bildschirm-App).
- Gelegentlich: Serviceannahme trägt Klärungsgründe auf demselben iPad ein.
- Stufe 1–3: genau ein Gerät, alle Daten lokal. Kein Server, kein Login.
- Bedienung im Stehen und im Freien: große Touch-Flächen (mind. 44 px), hoher Kontrast,
  wenige Eingaben pro Fahrzeug, funktioniert auch ohne Netz.

## Technik
- Vite + React + TypeScript
- Lokale Datenhaltung in IndexedDB über Dexie.js (Fotos als Blob, vorher verkleinert)
- PWA (vite-plugin-pwa), offline-fähig, auf dem iPad zum Home-Bildschirm hinzufügbar
- Fotos über `<input type="file" accept="image/*" capture="environment">`
- PDF/Druck: zunächst über Druckansicht mit Print-CSS (`window.print()`), keine schwere Bibliothek
- Tests: Vitest, mindestens für Eskalationslogik und Kennzeichen-Normalisierung
- Hosting: GitHub Pages (statische Seite; die Daten verlassen das Gerät nicht)
- Oberfläche komplett auf Deutsch, Datums-/Zeitformat deutsch (TT.MM.JJJJ, HH:MM)

## Datenmodell
Alle IDs als UUID, alle Zeitpunkte als ISO-String. Das Modell ist so angelegt, dass später
ohne Umbau auf eine zentrale Datenbank mit mehreren Geräten umgestellt werden kann
(deshalb UUIDs, Zeitstempel `erstelltAm`/`geaendertAm` an jedem Datensatz, keine
fortlaufenden Nummern).

- **Runde** (Kontrolle): id, typ (`morgens` | `nachmittags` | `sonder`), gestartetAm,
  beendetAm, durchgefuehrtVon (Name, Freitext)
- **Vorgang** (ein Aufenthalt eines Fahrzeugs auf dem Gelände): id, kennzeichen
  (normalisiert), kennzeichenAnzeige, modell, ebeneId, kategorie (`kunde` | `mitarbeiter` |
  `fremdparker` | `unbekannt`, Standard `unbekannt`), fotoIds[], ersterfasstAm,
  ersterfasstInRundeId, beendetAm, beendetInRundeId, offen (bool), notiz
- **Sichtung**: id, vorgangId, rundeId, zeitpunkt, ergebnis (`neu` | `noch_da` | `weg`)
- **Klaerung**: id, vorgangId, grund (siehe unten), serviceberater (Freitext),
  eingetragenAm, notiz. Ein Vorgang kann mehrere Klärungen haben; die neueste gilt.
- **Massnahme**: id, vorgangId, typ (`hinweiszettel` | `sb_angesprochen` |
  `kunde_kontaktiert` | `eskalation_leitung` | `sonstiges`), zeitpunkt, notiz
- **Foto**: id, vorgangId, blob, aufgenommenAm
- **Einstellungen**: Ebenen (Liste, frei benennbar), Eskalationsschwellen,
  Aufbewahrungsfristen

Standard-Ebenen (in den Einstellungen änderbar): „Parkhaus Ebene 0“, „Parkhaus Ebene −1“,
„Fläche neu“, „Fläche ganz neu“. Die genauen Bezeichnungen legt der Nutzer fest.

### Klärungsgründe
- `nicht_bearbeitet` – Fahrzeug wurde noch nicht in die Werkstatt geholt
- `wartet_auf_teile`
- `in_bearbeitung_extern` – z. B. Fremdleistung, Lack
- `fertig_kunde_informiert` – ab Eintrag läuft die Abholfrist
- `fertig_kunde_nicht_erreicht` – ab Eintrag läuft die Abholfrist
- `kein_kunde` – setzt Kategorie auf Fremdparker oder Mitarbeiter
- `sonstiges` (Notiz Pflicht)

## Kernabläufe

### Rundgang
1. „Kontrolle starten“ → Typ wird anhand der Uhrzeit vorgeschlagen (vor 12 Uhr morgens).
2. App zeigt alle offenen Vorgänge, gruppiert nach Ebene. Pro Fahrzeug ein Tipp:
   „noch da“ oder „weg“. Nicht bestätigte Fahrzeuge werden am Ende der Runde angezeigt
   und müssen entschieden werden, bevor die Runde abgeschlossen wird.
3. Neue Fahrzeuge erfassen: Kennzeichen, Modell, Ebene, optional Foto und Kategorie.
4. Nach Abschluss zeigt die App die Klärungsliste dieser Runde.

### Kennzeichen-Erkennung
- Normalisierung: Großbuchstaben, Leerzeichen und Bindestriche entfernen
  („HH-AB 123“ → „HHAB123“), Anzeige bleibt wie eingegeben.
- Kennzeichen hat einen offenen Vorgang → keinen neuen anlegen, Hinweis anzeigen und auf
  „noch da“ setzen.
- Kennzeichen hatte am gleichen Tag einen beendeten Vorgang → Hinweis „vermutlich zurück
  aus der Werkstatt“ am neuen Vorgang. Das ist nur ein Hinweis, kein Status.
- Kennzeichen hatte in den letzten 30 Tagen Vorgänge → Hinweis „Wiederholer“ mit Anzahl
  und Historie.

### Ampel und Eskalation
Gezählt wird in Kontrollrunden und Kalendertagen, nicht in exakten Stunden, weil die
Erfassungszeit nur so genau ist wie die Rundgänge. Alle Schwellen in den Einstellungen änderbar.

Ohne Klärung (Kunde oder unbekannt):
- grün: erstmals erfasst
- gelb: bei der nächsten Kontrolle noch da
- rot: bei der Morgenkontrolle des Folgetages oder später noch da → Klärungsliste

Mit Klärung `fertig_*` (Abholfrist ab Zeitpunkt der Klärung):
- grün: bis 24 h
- gelb: über 24 h → SB soll Kunden kontaktieren, Klärungsliste
- rot: über 48 h → Eskalation an Leitung, Klärungsliste

Mit Klärung `nicht_bearbeitet`, `wartet_auf_teile`, `in_bearbeitung_extern`, `sonstiges`:
- gelb, erscheint bei jeder Morgenkontrolle erneut auf der Klärungsliste, bis sich der
  Grund ändert oder das Fahrzeug weg ist
- rot ab dem dritten Kalendertag nach Ersterfassung

Fremdparker:
- 2. Antreffen → Maßnahme Hinweiszettel vorschlagen
- 3. Antreffen → rot, Eskalation vorschlagen

Mitarbeiter:
- wie Fremdparker, aber ohne Hinweiszettel; stattdessen Maßnahme „intern angesprochen“

### Klärungsliste
- Wird nach jeder Runde erzeugt, sortiert nach Ampel (rot zuerst), dann nach Standdauer.
- Inhalt je Fahrzeug: Kennzeichen, Modell, Ebene, Standdauer, letzter Klärungsgrund,
  letzte Maßnahme, Vorschaubild.
- Druckansicht/PDF über die Teilen-Funktion des iPads, damit die Liste an die
  Serviceannahme gehen kann.
- Klärungsgrund direkt aus der Liste eintragbar.

### Hinweiszettel
- Druckvorlage DIN A5 mit Kennzeichen, Datum, Ebene und einem festen Text (in den
  Einstellungen bearbeitbar). Erzeugt automatisch eine Maßnahme `hinweiszettel`.

## Datenschutz und Datensicherung
- Kennzeichen und Fotos sind personenbezogene Daten. Es werden keine Namen von Kunden
  erfasst.
- Aufbewahrung: Fotos 30 Tage nach Ende des Vorgangs löschen, Vorgänge 90 Tage
  (beide Fristen einstellbar). Automatische Bereinigung beim App-Start.
- Export als JSON (komplette Sicherung) und CSV (Auswertung in Excel) sowie Import der
  JSON-Sicherung. Hinweis in der App, wenn die letzte Sicherung älter als 7 Tage ist,
  weil Safari Website-Daten löschen kann.

## Stufenplan
Immer nur eine Stufe gleichzeitig umsetzen. Am Ende jeder Stufe muss die App lauffähig sein.

**Stufe 1 – Erfassung und Rundgang**
Projekt-Setup, Datenmodell, Ebenen-Einstellungen, Fahrzeug erfassen inkl. Foto,
Rundgang-Modus, Kennzeichen-Erkennung, Übersicht offener Fahrzeuge mit laufender
Standdauer, JSON-Export/Import, PWA, Deployment auf GitHub Pages.

**Stufe 2 – Klärung und Eskalation**
Ampel-Logik mit Tests, Klärungsliste, Klärungsgründe, Maßnahmen, Hinweiszettel,
Druckansichten, einstellbare Schwellen, Aufbewahrungsfristen.

**Stufe 3 – Auswertung**
Belegung je Ebene und Tag, durchschnittliche Standdauer je Kategorie und Klärungsgrund,
Überschreitungen je Serviceberater, häufigste Wiederholer, Anzahl durchgeführter
Kontrollen je Tag, CSV-Export der Auswertungen.

**Später, nicht jetzt umsetzen**
Mehrere Geräte mit zentraler Datenbank und Login, Kennzeichenerkennung per Kamera,
Abgleich des Auftragsstatus mit dem Dealer-Management-System (CARE).

## Arbeitsweise
- Vor jeder Stufe zuerst einen Plan vorlegen und auf Freigabe warten, dann umsetzen.
- Bei fachlichen Unklarheiten nachfragen statt annehmen.
- Kleine, nachvollziehbare Commits mit deutschen Commit-Nachrichten.
- Keine zusätzlichen Bibliotheken ohne Begründung.
- Nach jeder Stufe kurz zusammenfassen: was gebaut wurde, wie man es testet, was offen ist.
