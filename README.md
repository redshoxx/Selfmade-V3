# Selfmade V12 – vollständig stille Cloud-Synchronisierung

Diese Version entfernt die sichtbare Meldung „Cloud-Daten aktualisiert“ dauerhaft.

## Technische Korrekturen

- Cloud-Hintergrundabgleich erzeugt keine Toast-Meldung.
- Der Toast-Renderer blockiert alle reinen Cloud-Synchronisationshinweise zusätzlich zentral.
- Ein DOM-Wächter entfernt versehentlich verbliebene alte Synchronisations-Toasts.
- Der Service Worker verwendet für HTML, JavaScript, CSS und Manifest jetzt Network-first.
- Alte PWA-Caches werden beim Aktivieren vollständig gelöscht.
- `app.js`, `styles.css` und Manifest verwenden Version 12 als Cache-Buster.
- Die Service-Worker-Aktualisierung wird bei jedem Start mit `updateViaCache: "none"` geprüft.
- Nach Übernahme eines neuen Service Workers wird die App einmal automatisch neu geladen.

## Deployment

```bash
npm run build
```

Vercel verwendet anschließend den Ordner `dist`.

Nach dem Deployment die Homescreen-App vollständig aus dem App-Umschalter schließen und neu öffnen. Ein Entfernen vom Homescreen ist mit dieser Version normalerweise nicht mehr nötig.
