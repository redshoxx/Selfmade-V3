# Selfmade auf Vercel bereitstellen

## 1. Supabase-Migration ausführen

Im Supabase-Dashboard des Projekts `ecflcrigkfyhifekwfxq` den **SQL Editor** öffnen und den kompletten Inhalt dieser Datei ausführen:

```text
supabase/migrations/20260803_selfmade_cloud.sql
```

Ohne diese Migration funktionieren Registrierung und Anmeldung, aber Selfmade kann noch keinen Haushalt speichern. Die App meldet dann gezielt `migration_required`.

## 2. Zu Vercel hochladen

Entweder das Projekt mit GitHub verbinden oder die Vercel CLI verwenden:

```bash
npm install
npm run build
vercel
```

Vercel erkennt die Konfiguration in `vercel.json`.

## 3. Supabase-Konfiguration

Die mitgelieferte **öffentliche** Publishable-Konfiguration ist bereits hinterlegt. Optional können im Vercel-Dashboard unter **Settings → Environment Variables** dieselben Werte gesetzt werden; Umgebungsvariablen überschreiben die mitgelieferten Werte:

```env
SUPABASE_URL=https://ecflcrigkfyhifekwfxq.supabase.co
SUPABASE_PUBLISHABLE_KEY=sb_publishable_1EpIlW3NxMKtGL4MjF2xtg_aYacqCx3
```

Niemals einen `service_role`- oder `sb_secret_...`-Key in der App oder in öffentlich zugänglichen Dateien eintragen.

## 4. Deployment prüfen

```text
https://DEINE-DOMAIN.vercel.app/api/health
```

Erwartet:

```json
{"ok":true,"storage":"supabase"}
```

Danach die App öffnen, registrieren und anmelden.

## Fehlerdiagnose

- **500 direkt beim Start:** alte Version mit SQLite-Vercel-Function deployed. Diese V6 neu deployen.
- **migration_required:** SQL-Migration wurde noch nicht ausgeführt.
- **401:** nicht angemeldet oder Sitzung abgelaufen.
- **Invalid login credentials:** E-Mail/Passwort falsch oder E-Mail muss erst bestätigt werden.
