# Supabase-Einrichtung für Selfmade V7

Die App kann weiterhin lokal mit SQLite laufen. Sobald `SUPABASE_URL` und
`SUPABASE_PUBLISHABLE_KEY` gesetzt sind, wechselt sie automatisch in den
Supabase-Cloud-Modus und verlangt eine Anmeldung.

## 1. Eigenes Supabase-Projekt verwenden

Für Selfmade sollte ein eigenes Supabase-Projekt verwendet werden. Ein bereits
für andere Anwendungen genutztes Projekt sollte nicht ohne Prüfung verwendet
werden.

## 2. Datenbankschema installieren

Im Supabase-Dashboard den **SQL Editor** öffnen und den vollständigen Inhalt
folgender Datei ausführen:

```text
supabase/migrations/20260803_selfmade_cloud.sql
```

Die Migration erstellt:

- Benutzerprofile
- Haushalte
- Haushaltsmitgliedschaften
- versionierte JSONB-App-Zustände
- Row-Level-Security-Policies
- Bootstrap- und Update-RPCs
- Realtime-Publication für Zustandsänderungen


## Bestehende Installation: Fehler `household_id is ambiguous`

Wurde die frühere Migration bereits ausgeführt und erscheint beim Anmelden
`column reference "household_id" is ambiguous`, im SQL Editor nur diese
Hotfix-Datei ausführen:

```text
supabase/migrations/20260803_fix_bootstrap_household_id_ambiguity.sql
```

Danach die App neu laden und erneut anmelden. Bestehende Benutzer- und
Haushaltsdaten werden dabei nicht gelöscht.

## 3. Auth konfigurieren

Unter **Authentication → Providers → Email** die E-Mail-/Passwort-Anmeldung
aktivieren.

Bei aktivierter E-Mail-Bestätigung erhält ein neu registrierter Benutzer zuerst
eine Bestätigungs-E-Mail. Danach kann er sich anmelden.

## 4. URL und Publishable Key eintragen

Die Datei `.env.example` nach `.env` kopieren oder die Werte beim Deployment als
Umgebungsvariablen setzen:

```env
SUPABASE_URL=https://DEIN_PROJECT_REF.supabase.co
SUPABASE_PUBLISHABLE_KEY=sb_publishable_DEIN_KEY
```

Der Publishable Key darf im Anwendungskontext verwendet werden. Der
`service_role`- beziehungsweise Secret-Key darf niemals in Frontend-Dateien
oder öffentlich erreichbare Konfigurationen geschrieben werden.

## 5. App starten

```bash
npm start
```

Danach:

```text
http://127.0.0.1:4173
```

## 6. Erste Cloud-Anmeldung

Beim ersten registrierten Benutzer wird automatisch ein Haushalt erzeugt. Die
vorhandenen lokalen SQLite-Daten werden dabei als initialer Cloud-Datenstand
übernommen.

Danach werden Änderungen über Supabase gespeichert. Die App lädt ungefähr alle
15 Sekunden eine neuere Cloud-Version und verwendet eine Versionsprüfung, um
überschriebene Änderungen zwischen Geräten zu verhindern.

## Sicherheitsmodell

- Supabase Auth identifiziert den Benutzer.
- Jeder App-Zustand gehört zu genau einem Haushalt.
- RLS erlaubt Zugriff nur auf Haushalte, in denen der Benutzer Mitglied ist.
- Schreibvorgänge laufen über eine RPC mit optimistischer Versionsprüfung.
- Es wird kein Service-Role-Key benötigt.
- Ohne Supabase-Konfiguration bleibt SQLite als lokale Fallback-Datenbank aktiv.

## Bestehende Daten migrieren

1. App zunächst ohne Supabase starten und vorhandene Daten prüfen.
2. App stoppen.
3. Supabase-Variablen setzen.
4. App neu starten.
5. Registrieren oder anmelden.
6. Beim ersten Cloud-Aufruf wird die lokale Datenbank als Startstand kopiert.

## Einschränkung bei Kassenbonbildern

Die strukturierten Kassenbondaten werden in Supabase gespeichert. Die Bilddatei
selbst liegt in dieser Version weiterhin auf dem App-Server. Für horizontal
skalierte Deployments sollte als nächster Schritt ein privater Supabase-Storage-
Bucket ergänzt werden.
