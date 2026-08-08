# NEST V2.0.0

NEST ist ein Finanzplaner für **Mobile und Desktop/Web** mit manuellen Buchungen, Sparzielen, Challenges und optionalem Apple-Wallet-/Kurzbefehle-Import ohne direkte Bankanbindung.

## V2.0.0 – großes Update

### Mobile + Desktop Web App

- bestehende mobile PWA bleibt erhalten
- responsive Desktop-Web-App für PC und große Displays
- Desktop-Navigation als feste Seitenleiste statt mobiler Bottom-Bar
- größere Arbeitsfläche und bessere Informationsdichte auf PC
- installierbar als Web-App/PWA auch auf Desktop-Browsern
- Querformat und große Displays werden unterstützt

### Neue Buchungslogik

NEST führt ab V2 zusätzlich ein separates Buchungsprotokoll unter `nest-audit-v2`.

Für neue Buchungen wird nachvollziehbar gespeichert:

- wann die Buchung erfasst wurde
- Buchungsdatum
- wie sie verbucht wurde
- manuell in NEST oder über Apple Wallet/Kurzbefehle
- welche Felder später geändert wurden
- wann eine Buchung gelöscht wurde

Bestehende Buchungen aus V1.x werden automatisch übernommen. Wo die ursprüngliche Quelle nicht sicher bekannt ist, wird sie ausdrücklich als **„Aus älterer NEST-Version“** gekennzeichnet statt eine Quelle zu erfinden.

### Bereits verbuchte / wiederkehrende Buchungen

- gleiche Buchungen werden über Art, Bezeichnung, Betrag und Kategorie erkannt
- die Detailansicht zeigt, wie oft eine gleiche Buchung bereits vorhanden ist
- vergangene Buchungsdaten werden zusammen angezeigt
- dadurch bleiben regelmäßige Zahlungen wie Miete, Streaming, Einkäufe oder andere wiederkehrende Ausgaben nachvollziehbar

### Buchungsdetails und Protokoll

Beim Öffnen einer Buchung zeigt NEST V2 zusätzlich:

- Status `Verbucht`
- Buchungsdatum
- Erfassungszeitpunkt
- Buchungsmethode
- Notiz
- ähnliche/bereits verbuchte Buchungen
- vollständigen Verlauf der Buchung

Auf der Buchungsseite gibt es außerdem eine **Buchungszentrale** mit Gesamtzahl, Wallet-Buchungen, manuellen Buchungen und wiederkehrenden Gruppen sowie Zugriff auf das globale Buchungsprotokoll.

### Formulare V2

- neu gestaltete Formulare auf Mobile und Desktop
- klarere Feldgruppen
- bessere Abstände und Typografie
- größere und konsistentere Eingabefelder
- Desktop-Formulare nutzen bei geeigneten Feldern zwei Spalten
- wichtige Felder und längere Texte bleiben über die gesamte Formularbreite
- vorhandene Funktionen zum Bearbeiten und Löschen bleiben erhalten

### Einstellungen und Backups

Die Einstellungen aus V1.3 bleiben erhalten:

- System / Hell / Dunkel
- komfortable oder kompakte Darstellung
- Standard- oder große Schrift
- Datenschutzmodus für sichtbare Beträge
- reduzierte Animationen
- Startseite festlegen
- Startbetrag bearbeiten

V2-Backups enthalten zusätzlich das Buchungsprotokoll. Beim Zurücksetzen werden auch die V2-Protokolldaten entfernt.

## Bestehende Funktionen bleiben erhalten

- manuelle Ein- und Auszahlungen
- Kategorien, Datum und Notizen
- Sparziele
- eigene Spar-Challenges und Vorlagen
- Wallet-/Kurzbefehle-Import
- stabile Import-IDs gegen versehentliche Doppelimporte
- automatische Händler-Kategorisierung
- lokale Speicherung unter `selfmade-save-v1`
- keine direkte Bankanbindung und keine Onlinebanking-Zugangsdaten

## Wallet-Import

Der Vercel-Endpunkt bleibt:

`POST /api/import-transaction`

Er benötigt die Vercel Environment Variable:

`SELFMADE_IMPORT_TOKEN=<langes-zufälliges-geheimes-token>`

Der iPhone-Kurzbefehl sendet beispielsweise:

```json
{
  "type": "expense",
  "amount": 24.90,
  "merchant": "BILLA",
  "occurredAt": "2026-08-08T19:30:00+02:00",
  "source": "Apple Wallet"
}
```

NEST erkennt diese Buchungen in V2 als **Apple Wallet / Kurzbefehle** und protokolliert den Import entsprechend.

## Sicherheit

- keine IBAN oder Onlinebanking-Zugangsdaten erforderlich
- POST-Imports sind durch `SELFMADE_IMPORT_TOKEN` geschützt
- der API-Endpoint verwendet `Cache-Control: no-store`
- der geheime Token wird nicht in den Import-Link geschrieben
- Finanzdaten und das Buchungsprotokoll bleiben lokal im NEST-App-Speicher
