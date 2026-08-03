# Selfmade V15 – Stability & Smart Receipt

Selfmade ist eine installierbare Haushalts-PWA für Finanzen, Einkäufe, Vorräte, Notizen, Barcodes und Kassenbons. Version **15.0.0** modernisiert den bestehenden V14-Stand, ohne das Snapshotformat oder bestehende Supabase-Nutzer zu ersetzen.

## Funktionen

- Dashboard mit Einnahmen, Ausgaben, Restbetrag, Sparbetrag und Fälligkeiten
- Einnahmen und Ausgaben erstellen, vollständig bearbeiten und löschen
- Monatsbudgets und Finanzbericht mit CSV-Export
- vollständige Spar-Challenge mit Feldern, Zielbetrag, Verlauf und Fortschritt
- Einkaufsliste, Mengensteuerung, Ladenmodus und Checkout
- wiederkehrende Einkäufe und Preisverlauf
- Vorrat, Ablaufdaten, Mindestbestand und Einräum-Eingang
- Notizen, Vorlagen, Checklisten, Tags, Farben und Archiv
- Haushaltsmitglieder
- lokaler Offline-Barcode-Scanner mit Kamera-, Foto- und manueller Alternative
- Smart-Receipt-Workflow mit Bildkomprimierung, OCR-Fallback, bearbeitbaren Positionen, Duplikaterkennung, Finanz- und Vorratsübernahme
- Supabase Auth, Realtime, private Storage-Dateien und RLS
- IndexedDB-Offline-Warteschlange mit Operations-IDs, Konflikten und maximal fünf Versuchen
- Backup-Export und validierter Backup-Import
- Dark Mode und iPhone-Homescreen-App

## V14-Daten und Migrationsstrategie

V15 liest weiterhin das bestehende Snapshotformat `version: 3`. Vorhandene Tabellen und IDs bleiben erhalten. Neue interne Bereiche wie Operationsprotokoll, Konflikte und Benachrichtigungsprotokoll werden beim Laden ergänzt.

Vor dem ersten V15-Schreibvorgang legt die App einmalig ein lokales V14-Sicherheitsbackup in IndexedDB ab. Trotzdem sollte vor dem Update zusätzlich ein JSON-Backup über **Einstellungen → Backup exportieren** erstellt werden.

Die V15-Storage-Migration ist nicht destruktiv. Sie löscht keine Nutzer, Haushalte oder Snapshots.

## Lokale Installation

Voraussetzungen:

- Node.js 22
- npm
- ein Supabase-Projekt für Cloud-Betrieb

```bash
npm install
npm run dev
```

`npm install` kopiert die fest angegebene Version `@zxing/browser@0.2.1` nach `public/vendor/zxing-browser.min.js`. Die App benötigt beim Scannen danach kein CDN.

Standardmäßig startet der lokale Server unter `http://127.0.0.1:4173`.

## Environment Variables

In `.env` lokal beziehungsweise in Vercel unter **Project Settings → Environment Variables**:

```env
SUPABASE_URL=https://DEIN_PROJEKT.supabase.co
SUPABASE_PUBLISHABLE_KEY=sb_publishable_DEIN_KEY
```

Im Browser darf ausschließlich der Publishable Key verwendet werden. Ein Service-Role- oder Secret-Key gehört niemals in Frontend, Repository oder Vercel-Variablen dieser App.

## Supabase-Einrichtung

### Bestehende V14-Datenbank

1. Vorher JSON-Backup exportieren.
2. Prüfen, dass die V14-Tabellen und RPCs vorhanden sind.
3. Im SQL Editor die Migration ausführen:

```text
supabase/migrations/20260803_v15_receipt_storage.sql
```

Die Migration erstellt beziehungsweise konfiguriert:

- privaten Bucket `selfmade-receipts`
- Dateigrößenlimit von 6 MB
- erlaubte Bildtypen
- RLS-Regeln für Haushaltsmitglieder
- Realtime-Konfiguration für `selfmade_household_states`

### Neues Supabase-Projekt

Zuerst die bestehende Selfmade-Cloud-Basismigration aus V14 anwenden und danach die V15-Storage-Migration. RLS muss auf allen exponierten Tabellen aktiv sein.

## Kassenbon-Speicher

Bonbilder werden vor dem Upload im Browser auf JPEG komprimiert. Offline bleiben sie als Blob in IndexedDB. Nach erfolgreicher Synchronisierung wird der Blob in den privaten Supabase-Bucket geladen und lokal entfernt. Im Haushaltszustand wird nur der Storage-Pfad gespeichert, niemals das Bild als Data-URL.

OCR verwendet die verfügbare Browser-Texterkennung. Auf iOS-Versionen ohne entsprechende API bleibt das manuelle Bontextfeld vollständig nutzbar. Erkannte Positionen müssen vor dem Speichern geprüft werden.

## Vercel

Das Repository kann direkt als Vercel-Projekt importiert werden.

```text
Build Command: npm run build
Output Directory: dist
Node.js: 22.x
```

Die API läuft über `api/handler.mjs`. Die Datei `vercel.json` enthält Rewrites, Content Security Policy, Größen- und Sicherheitsheader sowie die Function-Konfiguration.

Nach dem Deployment prüfen:

```text
/api/health
```

Erwartet werden `ok: true` und `version: 15.0.0`.

## Tests und Qualitätsprüfung

```bash
npm test
npm run lint
npm run build
```

Die GitHub-Actions-Pipeline führt bei Push und Pull Request aus:

```bash
npm install
npm test
npm run lint
npm run build
```

Zusätzlich prüft CI Manifest, Service Worker, lokale Scannerbibliothek, fehlende Assets und externe CDN-Abhängigkeiten.

## iPhone-PWA installieren

1. Produktionsadresse in Safari öffnen.
2. Teilen-Schaltfläche wählen.
3. **Zum Home-Bildschirm** auswählen.
4. Selfmade danach über das Homescreen-Symbol öffnen.

Die Oberfläche ist für das iPhone 12 mit 390 × 844 CSS-Pixeln abgesichert. Dialoge berücksichtigen Notch, Statusleiste, Home-Indikator und Bildschirmtastatur. Eingabefelder sind mindestens 16 px groß, sodass iOS nicht automatisch hineinzoomt.

## Update von V14 auf V15

1. V14-Backup exportieren.
2. V15-Storage-Migration ausführen.
3. V15 deployen.
4. Homescreen-App vollständig schließen und neu öffnen.
5. Anmeldung, Einkauf, Bearbeitungsformular und Synchronisierungsstatus kontrollieren.
6. Einen Testbon importieren und danach wieder löschen.

Der neue Service Worker lädt ein Update nicht automatisch neu, solange ein Formular geöffnet oder geändert ist. Über **Neue Version verfügbar → Jetzt aktualisieren** wird erst nach dem Speichern oder Schließen aktualisiert.

## Offline und Synchronisierung

Jede Änderung erhält eine eindeutige Operations-ID und einen Status:

- `pending`
- `syncing`
- `synced`
- `conflict`
- `failed`

Nach fünf fehlgeschlagenen automatischen Versuchen stoppt die Wiederholung. Unter **Einstellungen → Synchronisierung** können Status und Fehler geprüft und erneut versucht werden. Erfolgreiche Cloud-Aktualisierungen erzeugen keine Toast-Meldung.

Supabase Realtime beobachtet nur den aktiven Haushalt. Polling läuft ausschließlich als Fallback und höchstens alle 60 Sekunden.

## Fehlerbehebung

### Kamera öffnet nicht

- App über HTTPS oder die Vercel-Domain öffnen.
- Kamera in den Safari-Website-Einstellungen erlauben.
- Homescreen-App schließen und neu starten.
- Foto-Fallback verwenden.

### Scannerbibliothek fehlt

`npm install` erneut ausführen. Danach muss `public/vendor/zxing-browser.min.js` deutlich größer als 100 KB sein.

### Bonbild kann nicht hochgeladen werden

- V15-Storage-Migration prüfen.
- Bucket muss privat heißen: `selfmade-receipts`.
- Nutzer muss Mitglied des Haushalts sein.
- Komprimierte Datei darf höchstens 6 MB groß sein.

### Synchronisierungskonflikt

Unter **Einstellungen → Synchronisierung** beziehungsweise im Konfliktbereich zwischen Cloud-Version, lokaler Version oder beiden Versionen wählen.

### Alte PWA-Version sichtbar

Homescreen-App schließen und erneut öffnen. Bei offenem Formular zuerst speichern oder schließen und danach die Update-Meldung bestätigen.

## Bekannte Einschränkungen

- Die Datenhaltung bleibt in V15 als sichere Zwischenstufe ein versionierter Haushalts-Snapshot. Operationsbasierte Zusammenführung reduziert Konflikte; eine spätere Hauptversion kann die Fachbereiche in getrennte Tabellen überführen.
- Browser-OCR ist auf iOS nicht in jeder Version verfügbar. Der manuelle Text-Fallback bleibt deshalb erforderlich.
- Web Push benötigt zusätzlich eine serverseitige Push-Subscription- und Versandkomponente. V15 enthält Einstellungen, Service-Worker-Empfang, Deep Links und In-App-Fallback als Vorbereitung.
- Barcode-Erkennung hängt von Kameraqualität, Licht und Druckqualität ab. Manuelle Eingabe und Fotoerkennung bleiben verfügbar.

## Sicherheit

- ausschließlich Publishable Key im Client
- RLS-basierter Haushaltszugriff
- privater Receipt-Bucket
- Content Security Policy und sichere HTTP-Header
- begrenzte Request- und Dateigrößen
- MIME-Type-Prüfung
- validierter Backup-Import
- numerische und UUID-basierte ID-Prüfung
- Session-Erneuerung und Passwort-Reset-Flow

## Version

**Selfmade 15.0.0**  
Service-Worker-Cache: `selfmade-v15-stability-smart-receipt`
