# Selfmade V1

Kompletter Neuaufbau der Selfmade-App als schnelle, local-first Progressive Web App. Die alten V21-Projektdateien und die frühere Versionslogik sind im aktiven Projektbaum nicht mehr enthalten.

## Funktionen

- Dashboard und Schnellzugriffe
- Einkaufsliste mit Kategorien, Mengen und großen Touch-Zielen
- Vorrat mit Mindestbestand, Ablaufdatum und Barcode-Feld
- Rezepte mit Zutaten, Schritten, Favoriten und Kochmodus
- Wochenplan für Frühstück, Mittagessen, Abendessen und Snacks
- Einnahmen, Ausgaben, Monatsbilanz und Budgets
- Sparziele und Challenges
- Notizen und Haushaltsmitglieder
- Offline-Betrieb, JSON-Export/Import und Supabase-Cloud-Synchronisierung
- Installierbare PWA für iPhone, Android und Desktop

## Architektur

V1 wird als statische App direkt aus dem Repository ausgeliefert. Sie benötigt keinen Paketmanager und keinen Build-Schritt. Daten werden zunächst lokal gespeichert; nach Anmeldung können sie mit Supabase synchronisiert werden.

## Supabase einrichten

1. Im richtigen Supabase-Projekt den SQL Editor öffnen.
2. `supabase/schema.sql` vollständig ausführen.
3. Unter **Authentication → URL Configuration** die veröffentlichte Domain als Site URL und Redirect URL eintragen.
4. E-Mail/Passwort-Login aktivieren.

Die Browser-App verwendet ausschließlich den Publishable Key. Secret- oder Service-Role-Keys gehören niemals in Repository oder Browsercode.

## Deployment

Das Repository ist für ein statisches Vercel-Deployment vorkonfiguriert. `vercel.json` enthält SPA-Routing, Sicherheitsheader und die Service-Worker-Regeln.

## Datenmodell

V1 verwendet `public.v1_records`. Jeder Datensatz gehört über `user_id` genau einem Supabase-Auth-Benutzer. Row Level Security begrenzt Lesen und Schreiben auf eigene Datensätze.
