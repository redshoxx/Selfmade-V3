# Selfmade V11

Cloud-Synchronisierung läuft lautlos im Hintergrund. Erfolgreiche Cloud-Aktualisierungen erzeugen keine Benachrichtigung mehr. Fehler-, Offline-, Speicher- und Rückgängig-Meldungen bleiben sichtbar.

# Selfmade V8 – iPhone Barcode Scanner

Selfmade ist eine iPhone-optimierte Haushalts-PWA für Geld, Einkauf, Vorrat, Notizen, Barcode- und Kassenbon-Funktionen.

## Änderungen in V8

- der Hinweis „Als iPhone-App verwenden“ wurde vollständig entfernt
- keine Demo-, Beispiel- oder Platzhalterdaten
- neue Haushalte starten vollständig leer
- Safari-/Homescreen-kompatibler Barcode-Scanner
- Live-Kamera mit bevorzugter Rückkamera
- automatische Fokus- und Zoomoptimierung, soweit das iPhone sie freigibt
- Taschenlampen-Schalter, wenn die Kamera ihn unterstützt
- ZXing-Fallback für Safari, wenn `BarcodeDetector` nicht verfügbar ist
- native iPhone-Fotoaufnahme als zusätzlicher Scanner-Fallback
- automatische Aktualisierung der Homescreen-App nach einem neuen Service Worker
- Scannerbibliothek wird über eine gleichnamige Vercel-Route geladen und anschließend vom Service Worker gecacht

## Supabase

Bei einem bestehenden Projekt zuerst den Hotfix im Supabase SQL Editor ausführen:

```text
supabase/migrations/20260803_fix_bootstrap_household_id_ambiguity.sql
```

Bei einem neuen Projekt die vollständige Migration ausführen:

```text
supabase/migrations/20260803_selfmade_cloud.sql
```

## Vercel

```bash
npm test
npm run build
```

Danach das Projekt neu auf Vercel deployen. Die Build-Ausgabe liegt in `dist/`.

## Kamera auf dem iPhone

1. Die Website beziehungsweise Homescreen-App muss über HTTPS laufen.
2. Im Barcode-Dialog auf **Kamera starten** tippen.
3. Den Barcode gerade und vollständig in den Rahmen halten.
4. Falls iOS keinen Live-Stream bereitstellt, **Foto aufnehmen** verwenden. Das Foto wird lokal im Browser ausgewertet.
5. Bei verweigertem Zugriff die Website in Safari öffnen und unter **Seitenmenü → Mehr → Kamera → Erlauben** freigeben.

## Datenschutz

Das Kamerabild und aufgenommene Barcode-Foto werden nur lokal im Browser ausgewertet. Für den Barcode-Lookup wird ausschließlich die erkannte Nummer an die vorhandene API gesendet.

## Version 9 – echte iPhone-Statusleiste

Die zuvor im App-Layout nachgebildete Statusleiste mit Uhrzeit, Mobilfunk und Akku wurde vollständig entfernt. Im Safari-Homescreen-Modus wird ausschließlich die echte iOS-Systemstatusleiste angezeigt.


## Version 10 – Benachrichtigungen

- Toast-Meldungen erscheinen oben unterhalb der echten iPhone-Statusleiste.
- Normale Hinweise verschwinden nach 1,8 Sekunden.
- Fehlermeldungen verschwinden nach 2,8 Sekunden.
- Rückgängig-Aktionen bleiben 4,2 Sekunden sichtbar.
- Neue Statushinweise ersetzen ältere Hinweise, damit keine Meldungsstapel entstehen.


## iPhone-Homescreen: Zoom gesperrt

Version 13 sperrt Pinch-Zoom, Doppeltipp-Zoom, Fokus-Zoom bei Formularfeldern und Browser-/Trackpad-Zoom. Vertikales Scrollen innerhalb der App bleibt erhalten. Das Layout ist zusätzlich gegen horizontales Überlaufen abgesichert.
