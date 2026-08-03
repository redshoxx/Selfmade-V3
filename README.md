# Selfmade V19 – Rezepte, Mahlzeitenplaner und Kochmodus

Selfmade ist eine für den iPhone-Homescreen optimierte Haushalts-PWA mit Supabase-Speicherung und Vercel-Deployment.

## Version 19

### Rezepte

- persönliche Rezepte mit Bild, Beschreibung, Kategorie und Schwierigkeitsgrad
- Zubereitungs- und Gesamtzeit
- strukturierte Zutaten mit Menge, Einheit, Kategorie und Alternativen
- beliebig viele Zubereitungsschritte mit optionalem Bild oder Video
- Favoriten, Suche nach Namen und Zutaten sowie persönliche Notizen
- variable Portionsanzahl mit automatischer Mengenskalierung
- automatische Anzeige, welche Zutaten bereits im Vorrat vorhanden sind

### Mahlzeitenplaner

- Wochenplan von Montag bis Sonntag
- Frühstück, Mittagessen, Abendessen und Snacks
- Rezepte direkt einem Tag zuweisen
- vergangene Woche übernehmen
- bald ablaufende Vorräte als Planungshinweis
- geplante Mahlzeiten direkt im Kochmodus öffnen

### Einkaufsliste

- Zutatenübersicht vor der Übernahme
- einzelne Zutaten auswählen oder abwählen
- Menge, Einheit und Portionen anpassen
- Vorräte berücksichtigen
- fehlende Mengen berechnen
- doppelte Einkaufsprodukte zusammenfassen
- Kategorien automatisch zuordnen

### Kochmodus

- Vollbildansicht mit großer Schrift und klarer Schrittanzeige
- Schritte- und Zutatenansicht
- benötigte Zutaten pro Arbeitsschritt
- Zurück/Weiter, große Touchflächen und Wischgesten
- optional Sprachbefehle „Weiter“, „Zurück“ und „Timer starten“
- Bildschirm-Wake-Lock, sofern vom Gerät unterstützt
- automatische Erkennung von Zeitangaben in Rezeptschritten
- mehrere parallele Timer mit Bezeichnung, Pause, Verlängerung und Abbruch
- akustisches Signal, Vibration und Benachrichtigung nach Timerablauf
- automatische Gramm/Kilogramm- und Milliliter/Liter-Darstellung
- Umschaltung Celsius/Fahrenheit
- Zutaten abhaken und fehlende Zutaten direkt zur Einkaufsliste hinzufügen
- Notizen während des Kochens

### Abschluss

- tatsächliche Kochzeit
- Bewertung mit Sternen
- Foto des fertigen Gerichts
- persönliche Notiz
- verwendete Vorräte reduzieren
- Rezept für eine kommende Woche vormerken

## Bestehende Bereiche

- Start-Dashboard
- Geld und Budgets
- Einkaufsliste und Ladenmodus
- Vorrat
- Rezepte und Mahlzeitenplaner
- Notizen
- Barcode-Scanner und Kassenbon-Import
- Supabase-Cloudspeicherung

## Supabase

V19 erweitert den bestehenden JSONB-Haushaltsdatenstand. Es ist **keine zusätzliche Supabase-Migration** erforderlich.

Für ein neues Projekt:

```text
supabase/migrations/20260803_selfmade_cloud.sql
```

Für eine bestehende Installation mit dem früheren `household_id`-Fehler zusätzlich:

```text
supabase/migrations/20260803_fix_bootstrap_household_id_ambiguity.sql
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

## iPhone-Aktualisierung

Nach dem Deployment die Homescreen-App vollständig schließen und erneut öffnen. Service Worker Version 19 entfernt ältere App-Caches automatisch.
