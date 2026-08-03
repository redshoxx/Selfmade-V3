# HaushaltKlar V19.2

HaushaltKlar ist eine für den iPhone-Homescreen optimierte Haushalts-PWA mit Supabase-Speicherung und Vercel-Deployment.

## Neues in Version 19.2

- neuer professioneller Markenname **HaushaltKlar**
- neues App-Icon mit Haus- und Klarheits-/Check-Symbol
- hochwertiger Splashscreen beim Öffnen der App
- neu gestaltete Startseite mit Begrüßung und Haushaltsübersicht
- kompakte schwebende Bottom Navigation für sechs Hauptbereiche
- aktive Navigation als kleine blaue Icon-Fläche statt großer Karte
- verbesserte Light- und Dark-Mode-Farben
- neue Startkarten für Einkauf, Vorrat, Essensplanung, ablaufende Produkte und Notizen
- iPhone-Safe-Areas und Bildschirmtastatur bleiben vollständig berücksichtigt

## Bestehende Funktionen

- Geld und Budgets
- Einkaufsliste und Ladenmodus
- Vorrat
- Rezepte und GuteKueche-Linkimport
- Mahlzeitenplaner
- Vollbild-Kochmodus und Küchentimer
- Notizen
- Barcode-Scanner und Kassenbon-Import
- Supabase-Cloudspeicherung

## Supabase

V19.2 verwendet weiterhin den bestehenden JSONB-Haushaltsdatenstand. Eine zusätzliche Migration ist nicht erforderlich.

## Vercel

```bash
npm install
npm test
npm run build
```

```text
Build Command: npm run build
Output Directory: dist
Node.js: 22.x
```

Nach einem Deployment die Homescreen-App vollständig schließen und erneut öffnen. Der Service Worker V19.2 entfernt ältere App-Caches automatisch.
