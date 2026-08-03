# Selfmade Haushalts-App V4

Moderne iPhone-optimierte Full-Stack-PWA für Haushaltsorganisation mit
wahlweise lokaler SQLite- oder Supabase-Cloud-Speicherung.

## Funktionen

- Start-Dashboard mit Prioritäten und Vorschlägen
- Geldverwaltung mit Budgets und Preisverlauf
- gemeinsame Einkaufsliste und Ladenmodus
- Vorrat, Lagerorte, Mindestbestände und Ablaufwarnungen
- Notizen, Tags, Checklisten und Fälligkeiten
- Barcode-Katalog und Open-Food-Facts-Suche
- Kassenbon-Import und strukturierte Positionen
- wiederkehrende Artikel
- Haushaltsmitglieder
- Backup-Import und -Export
- iPhone-PWA mit Safe Areas, App-Icon und Homescreen-Modus
- Supabase Auth, RLS, Cloud-Synchronisierung und Konflikterkennung

## Voraussetzungen

- Node.js 22.5 oder neuer
- optional: eigenes Supabase-Projekt

## Lokaler Start

```bash
npm start
```

```text
http://127.0.0.1:4173
```

Ohne Supabase-Konfiguration verwendet die App SQLite:

```env
PORT=4173
HOST=127.0.0.1
DATABASE_PATH=./data/selfmade.sqlite
```

## Supabase-Cloud-Modus

```env
SUPABASE_URL=https://DEIN_PROJECT_REF.supabase.co
SUPABASE_PUBLISHABLE_KEY=sb_publishable_DEIN_KEY
```

Vorher muss die Migration ausgeführt werden:

```text
supabase/migrations/20260803_selfmade_cloud.sql
```

Die vollständige Anleitung steht in [SUPABASE_SETUP.md](./SUPABASE_SETUP.md).

## Datenmodell im Cloud-Modus

Die vorhandene App-API bleibt unverändert. Der Server lädt den versionierten
Haushaltszustand aus Supabase, führt eine Änderung in einer kurzlebigen
SQLite-Transaktion aus und speichert das Ergebnis als JSONB-Snapshot zurück.
Dadurch bleiben bestehende Funktionen und Backups kompatibel.

Supabase speichert:

- Profile
- Haushalte
- Mitgliedschaften
- vollständigen versionierten App-Zustand

Der Zugriff wird über Supabase Auth und Row Level Security abgesichert.

## Tests

```bash
npm test
```

Enthalten sind Tests für:

- sämtliche lokalen CRUD-Funktionen
- Barcode und Kassenbons
- Backup und Wiederherstellung
- Cloud-Konfiguration
- Auth-Schutz
- Bootstrap und persistente Cloud-Mutationen über einen Supabase-Testserver

## Zurücksetzen

Im lokalen Modus:

```bash
npm run reset
```

Im Cloud-Modus sollte ein Reset nur bewusst über die App oder über ein neues
Supabase-Projekt erfolgen.
