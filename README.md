# Selfmade V6 – Vercel + Supabase

Selfmade ist eine iPhone-optimierte Haushalts-PWA für Geld, Einkauf, Vorrat, Notizen, Barcode- und Kassenbon-Funktionen.

## V6-Korrekturen

- Vercel Function vollständig ohne `node:sqlite`
- keine persistente lokale Datei in der Serverless-Runtime
- Supabase als alleinige dauerhafte Cloud-Speicherung
- öffentliche Supabase-Konfiguration bereits hinterlegt
- Vercel Environment Variables können die Standardwerte überschreiben
- verständliche Fehlermeldung, wenn die Supabase-Migration fehlt
- PWA, Homescreen-Modus und iPhone Safe Areas bleiben erhalten

## Lokal prüfen

```bash
npm install
npm test
npm run build
```

## Vercel

Siehe [VERCEL_DEPLOY.md](./VERCEL_DEPLOY.md).

## Supabase

Vor dem ersten produktiven Login muss folgende Migration im Supabase SQL Editor ausgeführt werden:

```text
supabase/migrations/20260803_selfmade_cloud.sql
```

## Sicherheit

Der eingetragene `sb_publishable_...`-Key ist ein öffentlicher App-Key. Die Sicherheit der Haushaltsdaten erfolgt über Supabase Auth und Row Level Security. Ein Service-Role- oder Secret-Key wird nicht verwendet.
