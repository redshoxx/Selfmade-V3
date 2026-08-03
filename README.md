# Selfmade V18 – Performance-Update

Selfmade ist eine für den iPhone-Homescreen optimierte Haushalts-App mit Supabase-Speicherung und Vercel-Deployment.

## Schwerpunkte dieser Version

- vollständige Standalone-PWA-Konfiguration
- echte iPhone-Safe-Areas für Dynamic Island, Statusleiste und Home-Indikator
- dynamische Anpassung an die iOS-Bildschirmtastatur
- Bottom Navigation wird bei geöffneter Tastatur ausgeblendet
- keine Browser-Skalierung, kein Pinch-Zoom und kein Doppeltipp-Zoom
- keine horizontale Verschiebung oder abgeschnittenen Formulare
- große Touch-Ziele für Buttons und Navigation
- kompakte zweispaltige Formulargruppen auf dem iPhone 12
- native Eingabetastaturen über `inputmode`
- sinnvolle Autovervollständigung und Großschreibung
- dauerhafte Labels statt Informationen nur im Platzhalter
- Pflichtfeld-Markierung und verständliche Validierung
- Schutz vor doppeltem Absenden
- sichtbarer Ladezustand beim Speichern
- fixierte Formularaktionen über der iPhone-Tastatur
- destruktive Aktionen getrennt vom Speichern
- lautlose Cloud-Synchronisierung
- Barcode-Scanner mit begrenzter Kamerahöhe, Live-Erkennung und Foto-Fallback
- keine Demo-, Beispiel- oder Platzhalterdaten

## Einkaufsseite Version 16

- klar beschriftete Schnelleingabe direkt oben
- Mengen wie `2 kg Kartoffeln` werden automatisch erkannt
- Kategorie wird aus Katalog, Vorrat oder Produktname abgeleitet
- passende Produkte aus dem eigenen Katalog erscheinen während der Eingabe
- Barcode, Detailformular und Routinen sind direkt an der Eingabe erreichbar
- offene und erledigte Artikel sind getrennt
- keine künstlichen Beispielvorschläge

## Performance-Optimierungen in V18

- Barcode-Bibliothek wird erst beim Öffnen des Scanners geladen
- adaptive Cloud-Synchronisierung ohne Polling im Hintergrund
- kleiner Versionscheck statt vollständigem Datenabruf bei jeder Prüfung
- zusammengefasste parallele State-Anfragen
- verzögertes Offline-Cache-Schreiben außerhalb kritischer UI-Arbeit
- deduplizierte identische Render-Aufrufe
- zwischengespeicherte SVG-Icons und Datumsberechnungen
- schnellere Supabase-Bridge ohne redundante Haushaltsabfrage
- Cache-first für versionierte App-Assets mit Aktualisierung im Hintergrund
- Browser-Cache für versionierte JavaScript-, CSS- und Icon-Dateien
- Rendering-Containment für große Listen

Es wurden keine Funktionen, Formulare oder sichtbaren Layouts verändert.

## Supabase

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

Vercel-Konfiguration:

```text
Build Command: npm run build
Output Directory: dist
Node.js: 22.x
```

Erforderliche Environment Variables:

```env
SUPABASE_URL=https://ecflcrigkfyhifekwfxq.supabase.co
SUPABASE_PUBLISHABLE_KEY=sb_publishable_1EpIlW3NxMKtGL4MjF2xtg_aYacqCx3
```

## iPhone-Aktualisierung

Nach einem Vercel-Deployment die Homescreen-App vollständig schließen und erneut öffnen. Der Service Worker Version 18 entfernt ältere App-Caches automatisch.


## Einkauf in Version 17

- gruppierte Einkaufsliste ohne dauerhaft ausgeklapptes Eingabeformular
- Produkt hinzufügen als iPhone-typisches Bottom Sheet
- umschaltbare Kompakt- und Listenansicht
- einklappbare Kategorien und erledigte Produkte
- neu gestalteter Ladenmodus mit kompakten Produktkarten
- Preise werden über ein eigenes Bottom Sheet erfasst
- kompakte, Safe-Area-konforme Abschlussleiste
