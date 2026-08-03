# Vercel-Deployment

## 1. Supabase vorbereiten

Öffne im gewünschten Supabase-Projekt den SQL Editor und führe diese Datei aus:

```text
supabase/migrations/20260803_selfmade_cloud.sql
```

Die Migration erstellt:

- `selfmade_profiles`
- `selfmade_households`
- `selfmade_household_members`
- `selfmade_household_states`
- Row-Level-Security-Policies
- Bootstrap- und Update-Funktionen

## 2. Supabase-Zugangsdaten holen

Benötigt werden ausschließlich:

```env
SUPABASE_URL=https://DEIN_PROJECT_REF.supabase.co
SUPABASE_PUBLISHABLE_KEY=sb_publishable_DEIN_KEY
```

Keinen Secret- oder Service-Role-Key im Frontend oder in öffentlich sichtbaren
Dateien speichern.

## 3. Projekt zu Vercel bringen

### Variante A – GitHub

1. Projektordner in ein GitHub-Repository hochladen.
2. In Vercel `Add New → Project` öffnen.
3. Repository importieren.
4. Als Root Directory den Ordner wählen, in dem `package.json` und
   `vercel.json` liegen.

### Variante B – Vercel CLI

```bash
npm install -g vercel
vercel
```

Für das Produktionsdeployment:

```bash
vercel --prod
```

## 4. Environment Variables in Vercel

In `Project Settings → Environment Variables` eintragen:

```text
SUPABASE_URL
SUPABASE_PUBLISHABLE_KEY
```

Beide Variablen für Production, Preview und Development aktivieren.

Nicht erforderlich auf Vercel:

```text
DATABASE_PATH
HOST
PORT
```

## 5. Build-Einstellungen

Die Einstellungen werden aus `vercel.json` übernommen:

```text
Build Command: npm run build
Output Directory: dist
Node.js: 22.x
```

Die API-Aufrufe unter `/api/*` werden intern an `api/handler.mjs` weitergeleitet.

## 6. Supabase Auth URLs

Nach dem ersten Vercel-Deployment die erzeugte Domain in Supabase unter den
Auth-URL-Einstellungen eintragen.

Beispiel:

```text
Site URL:
https://selfmade-example.vercel.app

Additional Redirect URLs:
https://selfmade-example.vercel.app/**
https://*-dein-team.vercel.app/**
```

Das ist besonders relevant, wenn die E-Mail-Bestätigung in Supabase aktiviert
ist.

## 7. Funktionstest

Öffne nach dem Deployment:

```text
https://DEINE-DOMAIN.vercel.app/api/health
```

Erwartete Antwort:

```json
{
  "ok": true,
  "storage": "supabase"
}
```

Danach die App öffnen, registrieren und eine Testnotiz anlegen. Nach einem
Neuladen oder auf einem zweiten Gerät muss die Notiz weiterhin vorhanden sein.

## 8. Fehlerbehebung

### `supabase_not_configured`

Mindestens eine der beiden Vercel-Variablen fehlt oder das Deployment wurde
nach dem Setzen nicht neu gestartet.

### Registrierung funktioniert, aber keine App-Daten

Die Supabase-Migration fehlt oder wurde im falschen Projekt ausgeführt.

### 401 / Bitte zuerst anmelden

Die Sitzung ist abgelaufen. Abmelden, neu anmelden und erneut testen.

### Änderungen auf zwei Geräten kollidieren

Die App verwendet Versionskontrolle und verhindert stilles Überschreiben. Auf
dem älteren Gerät neu laden und die Änderung erneut durchführen.

### API funktioniert lokal, aber nicht auf Vercel

Prüfen:

- Node.js-Version 22.x
- `vercel.json` liegt im Root Directory
- `api/handler.mjs` wurde mit hochgeladen
- Supabase-Variablen sind für die aktuelle Deployment-Umgebung gesetzt
