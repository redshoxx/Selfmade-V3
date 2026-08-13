# NEST V4.4 auf dem iPhone mit Sideloadly

NEST wird automatisch auf GitHub als **unsignierte iOS-IPA** gebaut. Zum Erstellen der IPA brauchst du selbst keinen Mac und kein Xcode. Der Mac-Build läuft über GitHub Actions. Auf deinem Windows-PC brauchst du anschließend nur Sideloadly zum Signieren und Installieren.

## 1. IPA auf GitHub erstellen oder herunterladen

1. Öffne das Repository **redshoxx/Selfmade-V3** auf GitHub.
2. Öffne oben **Actions**.
3. Wähle links **NEST iOS IPA - Sideloadly**.
4. Falls noch kein aktueller grüner Lauf vorhanden ist, klicke **Run workflow** und anschließend erneut **Run workflow**.
5. Warte, bis der Lauf grün abgeschlossen ist.
6. Öffne den abgeschlossenen Lauf.
7. Scrolle nach unten zu **Artifacts**.
8. Lade **NEST-v4.4.0-Sideloadly** herunter.
9. Entpacke die heruntergeladene ZIP-Datei. Darin befindet sich:

   `NEST-v4.4.0-Sideloadly.ipa`

## 2. NEST mit Sideloadly installieren

1. Installiere Sideloadly auf deinem Windows-PC.
2. Verbinde dein iPhone mit USB mit dem PC und bestätige auf dem iPhone **Diesem Computer vertrauen**.
3. Öffne Sideloadly.
4. Ziehe `NEST-v4.4.0-Sideloadly.ipa` in das IPA-Feld von Sideloadly.
5. Wähle dein verbundenes iPhone aus.
6. Trage deine Apple-ID ein.
7. Klicke **Start**.
8. Gib dein Apple-ID-Passwort bzw. das von Apple/Sideloadly verlangte Anmeldeverfahren ein.
9. Warte, bis Sideloadly die Installation abgeschlossen hat.
10. Falls iOS es verlangt, aktiviere den Entwicklermodus bzw. vertraue dem Entwicklerprofil in den iPhone-Einstellungen.

## Updates ohne Datenverlust

Für spätere NEST-Versionen wiederholst du denselben Ablauf mit der neuen IPA. Verwende möglichst dieselbe Apple-ID und dieselbe NEST-Bundle-ID. Installiere die neue Version über die bestehende App, statt die alte NEST-App zuerst zu löschen.

Die native NEST-App verwendet die feste Bundle-ID:

`at.nest.selfmade`

## Daten von der bisherigen NEST-Web-App übernehmen

Die Safari-/PWA-Version und die native IPA verwenden getrennte lokale App-Speicher. Deshalb werden vorhandene Daten nicht automatisch von Safari in die IPA kopiert.

Vor dem Wechsel:

1. Öffne deine bisherige NEST-Web-App.
2. Öffne **Einstellungen**.
3. Wähle **Vollständiges Backup exportieren**.
4. Installiere und öffne anschließend die NEST-IPA.
5. Öffne dort **Einstellungen**.
6. Wähle **Backup wiederherstellen** und importiere dein vorher exportiertes NEST-Backup.

## Was in der IPA vorgesehen ist

- Übersicht und Buchungen
- Kategorien und Kategorie-Icons
- Wiederkehrende Buchungen
- Aufgaben
- Sparziele und Challenges
- Einkaufsliste
- Barcode-Scanner mit Kamera
- Produktabfrage über den bestehenden NEST-Server
- Lokale Speicherung
- Backup und Wiederherstellung

## Hinweis zu Erinnerungen

Die bestehenden Aufgaben-Erinnerungen stammen aus der Web-App. Für zuverlässig geplante iOS-Hintergrund-Benachrichtigungen bei vollständig geschlossener App ist später eine native Local-Notifications-Erweiterung sinnvoll.
