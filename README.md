# Parkplatz-Kontrolle

Web-App für den Parkplatzdienst: Fahrzeuge auf den Stellflächen erfassen, bei den
Kontrollrunden abhaken und die Standdauer im Blick behalten. Alle Daten bleiben auf dem
Gerät (IndexedDB); es gibt keinen Server. Fachliche Beschreibung: [CLAUDE.md](CLAUDE.md).

## Entwickeln

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # Tests (Vitest)
npm run build      # fertige App in dist/
```

### Auf dem iPhone im WLAN testen

```bash
npm run dev:netz
```

Dann auf dem iPhone die angezeigte Adresse `http://192.168.…:5173` öffnen (gleiches WLAN).
Kamera und Datenbank funktionieren so; Offline-Betrieb und „Zum Home-Bildschirm“
nur über die HTTPS-Adresse von GitHub Pages.

## Veröffentlichen (GitHub Pages)

1. Repository auf GitHub anlegen und den Code hochladen (`git push`).
2. Auf GitHub: *Settings → Pages → Build and deployment → Source: „GitHub Actions“*.
3. Jeder Push auf `main` baut, testet und veröffentlicht die App automatisch
   (siehe `.github/workflows/deploy.yml`). Die Adresse steht danach unter *Settings → Pages*.

## Auf dem iPhone/iPad installieren

Adresse in Safari öffnen → Teilen → „Zum Home-Bildschirm“. Danach startet die App wie eine
normale App und funktioniert auch ohne Netz. Updates werden beim nächsten Start mit Netz
automatisch geladen.

## Aufbau

| Ordner | Inhalt |
|---|---|
| `src/db/` | Datenmodell (`typen.ts`), Datenbank (`db.ts`), Schreibaktionen, Sicherung |
| `src/logik/` | Reine Fachlogik ohne Oberfläche – hier liegen die Tests |
| `src/seiten/` | Die Bildschirme der App |
| `scripts/icons.mjs` | Erzeugt die App-Symbole (`npm run icons`) |
