# NEST V2.0.2

NEST ist ein Finanzplaner für **Mobile und Desktop/Web** mit manuellen Buchungen, Sparzielen, Challenges und optionalem Apple-Wallet-/Kurzbefehle-Import ohne direkte Bankanbindung.

## V2.0.2 – Stabilität & Datenintegrität

V2.0.2 ersetzt den gemischten Laufzeit-Stack aus älteren V1-/V2-Skripten durch einen gemeinsamen V2.0.2-Datenkern.

### Verifizierte Datenspeicherung

- Hauptspeicher bleibt kompatibel unter `selfmade-save-v1`
- jeder relevante Schreibvorgang wird direkt wieder aus dem Browser-Speicher gelesen und verifiziert
- erst nach erfolgreicher Verifikation übernimmt die UI den neuen Zustand
- schlägt das Speichern fehl, bleibt der vorherige Zustand erhalten und NEST zeigt einen Fehler
- zusätzliche lokale Sicherung unter `selfmade-save-v1-backup-v202`
- beschädigte oder nicht lesbare Hauptdaten können aus der lokalen Sicherung wiederhergestellt werden
- Einstellungen enthalten eine Schreib-/Leseprüfung des lokalen Speichers
- Änderungen aus einem zweiten Browser-Tab werden über das `storage`-Event übernommen
- Rückkehr aus dem Browser-/PWA-Back-Forward-Cache lädt den Zustand erneut

### Bereinigte Runtime

Die produktive App lädt nicht mehr gleichzeitig `app.js`, `settings-v1.3.js`, `v2-ui.js` und den alten Storage-Hook. Aktiv sind nur noch:

- `v202-core.js`
- `v202-wallet-guard.js`
- `import-v2.0.2.js`
- `app-v2.0.2.js`
- `settings-v2.0.2.js`

`Storage.prototype.setItem` wird nicht mehr überschrieben.

### Buchungen & Formulare

- manuelle Buchungen werden über den zentralen V2.0.2-Speicher geschrieben
- Erstellen, Bearbeiten und Löschen wird weiterhin im Buchungsprotokoll erfasst
- Formularwerte werden validiert, bevor gespeichert wird
- Kategorien wechseln passend zwischen Einzahlung und Auszahlung
- Datums-Vorgabe verwendet das lokale Kalenderdatum statt UTC
- zentrale Plus-Aktion in der Navigation bleibt erhalten
- neue einheitliche SVG-Icons bleiben aktiv

### Wallet-Import

- Wallet-Import verwendet denselben verifizierten Speicher wie manuelle Buchungen
- exakte Import-ID wird weiterhin gegen Duplikate geprüft
- zusätzlich werden nahezu identische Wallet-Imports innerhalb von zwei Minuten abgefangen
- ISO-Zeitpunkte mit Zeitzonen-Offset behalten ihr lokales Kalenderdatum; z. B. `2026-08-09T00:15:00+02:00` bleibt der **09.08.2026** und wird nicht durch UTC zum Vortag
- Wallet-Buchungen erhalten explizit die Quelle `wallet`

### PWA / Cache

- neuer Service-Worker-Cache `nest-v2.0.2-stability`
- alte NEST-/Selfmade-Caches werden beim Aktivieren entfernt
- API-Routen werden nicht durch den Service Worker gecacht
- `/` und `/index.html` werden mit `no-cache` ausgeliefert, damit keine gemischten App-Versionen entstehen

## V2-Funktionen

- Mobile PWA und responsive Desktop-Web-App
- Desktop-Seitenleiste und mobile Bottom-Navigation
- manuelle Ein- und Auszahlungen
- Apple-Wallet-/Kurzbefehle-Import
- Buchungsdetails mit Status, Datum, Quelle und Erfassungszeitpunkt
- Buchungsprotokoll unter `nest-audit-v2`
- Erkennung wiederkehrender/gleichartiger Buchungen
- Sparziele
- eigene Spar-Challenges und Vorlagen
- System / Hell / Dunkel
- kompakte oder komfortable Ansicht
- größere Schrift
- Datenschutzmodus
- Startseite festlegen
- vollständige JSON-Backups inklusive Audit-Protokoll

## Wallet-Endpunkt

`POST /api/import-transaction`

Benötigte Vercel Environment Variable:

`SELFMADE_IMPORT_TOKEN=<langes-zufälliges-geheimes-token>`

Beispiel:

```json
{
  "type": "expense",
  "amount": 24.90,
  "merchant": "BILLA",
  "occurredAt": "2026-08-09T00:15:00+02:00",
  "source": "Apple Wallet"
}
```

## QA

Der Build prüft Syntax und Regressionen für:

- Kernlogik
- Wallet-Endpunkt
- Zeitzonen-/Datumsverarbeitung
- verifizierte Speicherung
- Wiederherstellung aus lokaler Sicherung
- Schreibfehler ohne Zustandsverlust
- Audit-Log bei Erstellen, Ändern und Löschen
- Wallet-Duplikate
- aktive V2.0.2-Runtime ohne alten Storage-Prototyp-Hook

## Sicherheit

- keine IBAN oder Onlinebanking-Zugangsdaten erforderlich
- POST-Imports sind durch `SELFMADE_IMPORT_TOKEN` geschützt
- API-Antworten verwenden `Cache-Control: no-store`
- das geheime Token wird nicht in Import-Links geschrieben
- Finanzdaten bleiben lokal im jeweiligen NEST-App-/Browser-Speicher
