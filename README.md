# NEST V1.3.0

Finanzplaner für Ein- und Auszahlungen, Sparziele und Spar-Challenges mit optionalem Apple-Wallet-/Kurzbefehle-Import ohne direkte Bankanbindung.

## V1.3.0 – Einstellungen

Die Einstellungen wurden zu einem eigenen Bereich ausgebaut:

- Erscheinungsbild: System, Hell oder Dunkel
- komfortable oder kompakte Darstellung
- Standard- oder große Schrift
- Datenschutzmodus zum Verbergen sichtbarer Beträge
- Animationen und Übergänge reduzieren
- Startseite festlegen: Übersicht, Buchungen, Sparziele oder Challenges
- Startbetrag direkt in den Einstellungen bearbeiten
- vollständiges lokales NEST-Backup als JSON exportieren
- Backup wieder importieren
- alle lokalen App-Daten gezielt zurücksetzen
- bestehende v1.2-Daten unter `selfmade-save-v1` bleiben kompatibel

## Bestehende Funktionen

- manuelle Ein- und Auszahlungen mit Verwendungszweck und Kategorien
- eigene Spar-Challenges mit Name, Zielbetrag, Schritten und optionalem Zieldatum
- bestehende NEST-Challenge-Vorlagen
- Sparziele mit Einzahlen und Entnehmen
- optionaler Wallet-/Kurzbefehle-Import für neue Transaktionen
- Duplikatschutz über stabile Import-IDs
- automatische Händler-Kategorisierung für häufige Händler
- lokale Speicherung
- keine direkte Bankanbindung und keine Onlinebanking-Zugangsdaten

## Wallet-Import

Der Vercel-Endpunkt lautet:

`POST /api/import-transaction`

Er speichert keine Bank-Zugangsdaten. Der iPhone-Kurzbefehl schickt nur die Transaktionsdaten an den Endpoint. Dieser validiert und normalisiert sie und gibt anschließend einen Import-Link zurück. Beim Öffnen dieses Links übernimmt NEST die Buchung in den bestehenden lokalen App-Speicher.

### Vercel Secret

Im Vercel-Projekt muss folgende Environment Variable gesetzt sein:

`SELFMADE_IMPORT_TOKEN=<langes-zufälliges-geheimes-token>`

Das Token niemals in GitHub committen.

### Request aus Kurzbefehle

Header:

`Authorization: Bearer <SELFMADE_IMPORT_TOKEN>`

JSON-Beispiel:

```json
{
  "type": "expense",
  "amount": 24.90,
  "merchant": "BILLA",
  "occurredAt": "2026-08-08T19:30:00+02:00",
  "transactionId": "wallet-optional-id",
  "source": "Apple Wallet"
}
```

Der Endpoint antwortet unter anderem mit:

```json
{
  "ok": true,
  "importUrl": "https://DEINE-DOMAIN/?nestImport=..."
}
```

Im Kurzbefehl anschließend den Wert `importUrl` aus der JSON-Antwort öffnen. NEST importiert die Buchung und entfernt den Import-Parameter wieder aus der URL.

## Sicherheit

- Keine IBAN oder Onlinebanking-Zugangsdaten erforderlich.
- POST-Imports sind durch `SELFMADE_IMPORT_TOKEN` geschützt.
- Der API-Endpoint verwendet `Cache-Control: no-store`.
- Das geheime Token wird nicht in den erzeugten Import-Link geschrieben.
- Finanzdaten bleiben nach dem Import im bestehenden lokalen NEST-Speicher.
