# Selfmade Save V1

Kompletter Neuaufbau als mobile Spar- und Challenges-App.

## Funktionen
- Sparziele mit Zielbetrag, aktuellem Stand, optionalem Zieldatum und Fortschritt
- Sparbeträge direkt zu Zielen hinzufügen
- Challenges: 52-Wochen, 30 Tage × 5 €, 1.000-€-Challenge und No-Spend
- Eigene Challenge-Schritte und Fortschritt
- Bankbereich für Steiermärkische Sparkasse
- George-CSV-Import für reale lokale Transaktionen
- Auszahlungen, Eingänge, Saldo und Monatsauswertung
- automatische Transaktionskategorien
- lokale Datenspeicherung, JSON-Backup, Light/Dark Mode, Offline-PWA

## Bank-Sicherheit
Selfmade speichert keine George-Zugangsdaten, PINs oder Freigabecodes. Eine automatische Live-Verbindung darf nur über einen offiziellen PSD2/Open-Banking-Provider mit ausdrücklicher Zustimmung des Kontoinhabers erfolgen. Ohne produktive TPP-/Provider-Konfiguration bleibt die automatische Verbindung bewusst deaktiviert. Der George-CSV-Import funktioniert vollständig lokal im Browser.

## Build
`npm run build` rekonstruiert die geprüfte Produktionsseite und blockiert Builds, in denen Reste der früheren Einkaufs-App gefunden werden.