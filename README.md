# HaushaltKlar V21 – Clean Rebuild

V21 ist kein weiteres visuelles Update der bisherigen Oberfläche. Das Frontend wurde unabhängig von den alten App- und Style-Fragmenten vollständig neu aufgebaut.

## Grundidee

HaushaltKlar soll auf dem Handy und am Desktop ruhig, lesbar und sofort verständlich sein. Statt vieler gleich wichtiger Menüpunkte gibt es fünf klare Hauptbereiche:

1. **Heute** – zeigt nur die aktuell wichtigste Aufgabe und wenige relevante Kennzahlen.
2. **Einkauf** – Einkaufsliste, Kategorien, Preise und Ladenmodus.
3. **Küche** – Rezepte, Vorrat und Wochenplanung.
4. **Geld** – Einnahmen, Ausgaben, Budgets, Sparbetrag und Spar-Challenge.
5. **Mehr** – Notizen, Challenges und Einstellungen.

## Komplett neue Oberfläche

- neue responsive App-Shell
- Seitenleiste auf Desktop, kompakte Bottom-Navigation auf Mobilgeräten
- neues minimalistisches Designsystem ohne die bisherigen V19/V20-Komponenten
- deutlich größere Schrift, Touch-Ziele und Formulare
- konsequente Hell-/Dunkel-Darstellung
- neue Login- und Registrierungsansicht
- neue modale Eingabeformulare
- neues App-Icon und neuer Startbildschirm

## Funktionen

### Einkauf

- Produkte mit Menge, Kategorie, Preis und Notiz
- offen/alle/erledigt filtern
- Ladenmodus mit größeren Bedienelementen
- Einkauf abschließen und in Vorrat sowie Ausgaben übernehmen

### Küche

- eigene Rezepte mit Zutaten und Schritten
- Rezeptdetail und Übergabe fehlender Zutaten an die Einkaufsliste
- Vorrat mit Ablaufdatum, Lagerort und Mindestbestand
- Nachkaufen-Markierung
- Wochenplan für Frühstück, Mittagessen, Abendessen und Snacks

### Geld und Sparen

- Einnahmen und Ausgaben
- Monatsstand
- Budgets mit Fortschrittsanzeige
- gespeicherter Sparbetrag
- frei definierbare Spar-Challenge mit Ziel und Anzahl der Schritte

Die Challenge wird als interner Systemeintrag in den vorhandenen Notizen gespeichert. Dadurch bleibt sie in der Supabase-Cloud synchronisiert, ohne eine zusätzliche Datenbankmigration zu benötigen.

### Notizen und Einstellungen

- Notizen mit Titel, Inhalt, Schlagwort, Fälligkeit und Pin-Funktion
- Haushaltsname und Anzeigename
- Hell, Dunkel oder Systemdarstellung
- sichere Abmeldung

## Technischer Aufbau

- neues Frontend unter `src/v21/`
- `scripts/assemble-assets.mjs` veröffentlicht ausschließlich das neue V21-Frontend
- vorhandene Supabase-API und Datenstruktur bleiben als Backend erhalten
- keine Service-Role- oder Secret-Schlüssel im Browser
- PWA-Service-Worker mit eigenem V21-Cache

## Entwicklung

```bash
npm install
npm test
npm run build
```

Vercel:

```text
Build Command: npm run build
Output Directory: dist
Node.js: 22.x
```
