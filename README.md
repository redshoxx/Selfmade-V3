# Selfmade V14 – native iPhone-PWA

Selfmade ist eine für den iPhone-Homescreen optimierte Haushalts-App mit Supabase-Speicherung und Vercel-Deployment.

## Schwerpunkte dieser Version

- vollständige Standalone-PWA-Konfiguration
- echte iPhone-Safe-Areas für Dynamic Island, Statusleiste und Home-Indikator
- dynamische Anpassung an die iOS-Bildschirmtastatur
- Bottom Navigation wird bei geöffneter Tastatur ausgeblendet
- keine Browser-Skalierung, kein Pinch-Zoom und kein Doppeltipp-Zoom
- keine horizontale Verschiebung oder abgeschnittenen Formulare
- große Touch-Ziele für Buttons und Navigation
- hochwertige einspaltige Formulare auf iPhones
- native Eingabetastaturen über `inputmode`
- sinnvolle Autovervollständigung und Großschreibung
- dauerhafte Labels statt Informationen nur im Platzhalter
- Pflichtfeld-Markierung und verständliche Validierung
- Schutz vor doppeltem Absenden
- sichtbarer Ladezustand beim Speichern
- fixierte Formularaktionen über der iPhone-Tastatur
- destruktive Aktionen getrennt vom Speichern
- lautlose Cloud-Synchronisierung
- Barcode-Scanner mit Live-Kamera und Foto-Fallback
- keine Demo-, Beispiel- oder Platzhalterdaten

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

Nach einem Vercel-Deployment die Homescreen-App vollständig schließen und erneut öffnen. Der Service Worker Version 14 entfernt ältere App-Caches automatisch.
