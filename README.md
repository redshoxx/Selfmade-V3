# Selfmade V19.1 – GuteKueche-Linkimport

Selfmade ist eine für den iPhone-Homescreen optimierte Haushalts-PWA mit Supabase-Speicherung und Vercel-Deployment.

## GuteKueche.at-Linkimport

- einzelner, benutzergesteuerter Import über einen direkten Rezeptlink
- ausschließlich HTTPS-Rezeptseiten von `gutekueche.at`
- Prüfansicht im vorhandenen Rezeptformular vor dem Speichern
- Übernahme von Name, Beschreibung, Zeiten, Portionen, Zutaten und Zubereitungsschritten
- Quellenkennzeichnung bleibt am Rezept gespeichert
- kein Massenimport, keine automatische Katalogspiegelung und keine Bildkopie
- Zeitlimit und Größenbegrenzung beim Abrufen der Rezeptseite

## Rezepte und Kochen

- persönliche Rezepte mit Zutaten und strukturierten Schritten
- Suche, Kategorien, Favoriten und variable Portionen
- Wochenplan für Frühstück, Mittagessen, Abendessen und Snacks
- Zutatenübernahme mit Vorratsabgleich und Zusammenfassung doppelter Produkte
- Vollbild-Kochmodus mit Wischgesten, optionaler Sprachsteuerung und parallelen Timern
- Kochabschluss mit Bewertung, Notiz, Foto und Vorratsreduzierung

## Supabase

V19.1 erweitert den vorhandenen JSONB-Haushaltsdatenstand. Eine zusätzliche Migration ist nicht erforderlich.

Für ein neues Supabase-Projekt:

```text
supabase/migrations/20260803_selfmade_cloud.sql
```

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

Environment Variables:

```env
SUPABASE_URL=https://ecflcrigkfyhifekwfxq.supabase.co
SUPABASE_PUBLISHABLE_KEY=sb_publishable_1EpIlW3NxMKtGL4MjF2xtg_aYacqCx3
```

Nach einem Deployment die Homescreen-App vollständig schließen und erneut öffnen. Service Worker V19.1 entfernt ältere App-Caches automatisch.
