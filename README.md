# NEST V1.2.0

Finanzplaner für Ein- und Auszahlungen, Sparziele und Spar-Challenges. Buchungen können weiterhin manuell erfasst werden; zusätzlich gibt es jetzt einen optionalen Apple-Wallet-/Kurzbefehle-Import ohne direkte Bankanbindung.

## V1.2.0
- Eigene Spar-Challenges erstellen
- Name, Zielbetrag, Anzahl Schritte und optionales Zieldatum
- Challenge-Fortschritt Schritt für Schritt
- eigene Challenges bearbeiten und löschen
- bestehende NEST-Challenge-Vorlagen bleiben erhalten
- manuelle Ein- und Auszahlungen mit Verwendungszweck und Kategorien
- optionaler Wallet-/Kurzbefehle-Import für neue Transaktionen
- Duplikatschutz über stabile Import-IDs
- automatische Händler-Kategorisierung für häufige Händler
- Sparziele mit Einzahlen und Entnehmen
- lokale Speicherung unter `selfmade-save-v1`
- keine direkte Bankanbindung und keine Onlinebanking-Zugangsdaten

## Wallet-Import

Der Vercel-Endpunkt lautet:

`POST /api/import-transaction`

Er speichert keine Bank-Zugangsdaten. Der iPhone-Kurzbefehl schickt nur die Transaktionsdaten an den Endpoint. Dieser validiert und normalisiert sie und gibt anschließend einen Import-Link zurück. Beim Öffnen dieses Links übernimmt NEST die Buchung in den bestehenden lokalen App-Speicher.

### 1. Vercel Secret setzen

Im Vercel-Projekt eine Environment Variable anlegen:

`SELFMADE_IMPORT_TOKEN=<langes-zufälliges-geheimes-token>`

Das Token niemals in GitHub committen.

### 2. Request aus Kurzbefehle

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

`occurredAt` sollte möglichst Datum und Uhrzeit enthalten. Falls Wallet/Kurzbefehle eine eindeutige Transaktions-ID liefert, sollte sie als `transactionId` mitgesendet werden. Dadurch kann derselbe Import sicher als Duplikat erkannt werden.

Der Endpoint antwortet unter anderem mit:

```json
{
  "ok": true,
  "importUrl": "https://DEINE-DOMAIN/?nestImport=..."
}
```

Im Kurzbefehl anschließend den Wert `importUrl` aus der JSON-Antwort öffnen. NEST importiert die Buchung und entfernt den Import-Parameter wieder aus der URL.

### Automatische Kategorien

Unter anderem werden diese Händlergruppen erkannt:
- BILLA, SPAR, Hofer, Lidl, Penny → Lebensmittel
- Netflix, Spotify, Disney, YouTube, Amazon Prime → Abos & Verträge
- Shell, OMV, Eni, BP, Jet, Avanti → Mobilität
- IKEA, Mömax, XXXLutz, OBI, Hornbach, Bauhaus → Haushalt
- Apotheken, dm, BIPA, Müller → Gesundheit

Andere Händler landen zunächst unter `Sonstiges`, sofern der Kurzbefehl keine Kategorie mitsendet.

## Sicherheit

- Keine IBAN oder Onlinebanking-Zugangsdaten erforderlich.
- POST-Imports sind durch `SELFMADE_IMPORT_TOKEN` geschützt.
- Der API-Endpoint verwendet `Cache-Control: no-store`.
- Das geheime Token wird nicht in den erzeugten Import-Link geschrieben.
- Finanzdaten bleiben nach dem Import im bestehenden lokalen NEST-Speicher.
