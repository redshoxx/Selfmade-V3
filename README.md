# Selfmade Haushalts-App V5 – Vercel + Supabase

Moderne iPhone-optimierte Haushalts-PWA für Vercel. Das Frontend wird als
statische Website über das Vercel-CDN ausgeliefert. Die vorhandene REST-API
läuft als Vercel Function und speichert sämtliche produktiven App-Daten in
Supabase.

## Funktionen

- Dashboard mit Prioritäten und intelligenten Vorschlägen
- Geldverwaltung, Budgets und Preisverlauf
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
- Vercel Functions und statischer Vercel-Build

## Architektur auf Vercel

```text
Browser / iPhone PWA
        │
        ├── statische Dateien aus dist/
        │
        └── /api/*
              │
              └── Vercel Function api/handler.mjs
                        │
                        └── Supabase Auth + Postgres
```

Auf Vercel wird keine lokale Datenbank als dauerhafter Speicher verwendet.
SQLite läuft ausschließlich kurzzeitig im Speicher der Function, damit die
bestehende Transaktionslogik kompatibel bleibt. Die dauerhafte Speicherung
erfolgt in Supabase.

## Vercel-Deployment

Die vollständige Anleitung befindet sich in:

```text
VERCEL_DEPLOY.md
```

Kurzablauf:

1. Supabase-Migration ausführen.
2. Projekt zu GitHub hochladen oder in Vercel importieren.
3. In Vercel die Environment Variables setzen:

```env
SUPABASE_URL=https://DEIN_PROJECT_REF.supabase.co
SUPABASE_PUBLISHABLE_KEY=sb_publishable_DEIN_KEY
```

4. Deployment starten.

Vercel erkennt `vercel.json` und führt automatisch aus:

```bash
npm run build
```

Der statische Build wird in `dist/` erzeugt.

## Lokal entwickeln

Klassischer lokaler Node-Server:

```bash
npm start
```

```text
http://127.0.0.1:4173
```

Vercel-kompatibler lokaler Test mit installierter Vercel CLI:

```bash
npm run dev:vercel
```

## Build und Tests

```bash
npm run build
npm test
```

## Wichtige Dateien

- `vercel.json` – Vercel-Build, API-Rewrite und Header
- `api/handler.mjs` – zentrale Vercel Function
- `scripts/build-vercel.mjs` – kopiert die PWA nach `dist/`
- `supabase/migrations/20260803_selfmade_cloud.sql` – Cloud-Datenmodell und RLS
- `.env.example` – benötigte Umgebungsvariablen
- `VERCEL_DEPLOY.md` – Schritt-für-Schritt-Anleitung
