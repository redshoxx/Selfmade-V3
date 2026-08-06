# HaushaltKlar V20 – Grand Experience Update

HaushaltKlar V20 ist ein vollständiger Wechsel der Benutzeroberfläche und des täglichen App-Erlebnisses. Die bestehenden Bereiche für Finanzen, Einkauf, Vorrat, Rezepte, Mahlzeitenplanung, Kochmodus und Notizen bleiben erhalten, werden aber durch eine neue adaptive Oberfläche miteinander verbunden.

## Ziel von V20

Die App soll für Jugendliche, Erwachsene und ältere Menschen gleichermaßen verständlich und angenehm bedienbar sein. Statt vieler gleich gewichteter Informationen zeigt V20 zuerst, was im jeweiligen Moment relevant ist: den heutigen Essensplan, bald ablaufende Lebensmittel, offene Einkäufe, den Monatsstand oder eine schnelle Möglichkeit, etwas zu notieren.

## Neues Design: Living Canvas

- vollständig neuer visueller Auftritt mit ruhiger Grün-, Violett- und Warmton-Palette
- neue „Heute“-Startseite statt klassischem Dashboard
- deutlichere visuelle Hierarchie und größere Touchflächen
- neu gestaltete Kopfbereiche und Navigation
- schwebende universelle Schnellaktion
- neue Karten für Finanzen, Küche, Haushaltsstatus und Notizen
- vollständig angepasster Dark Mode
- neuer V20-Start- und Ladebildschirm
- optimiert für iPhone, Android-WebView, PWA und größere Browserfenster

## Adaptive Bedienprofile

V20 bietet drei gerätebezogene Darstellungen:

- **Komfort:** größere Schrift, größere Bedienelemente und weniger Inhalt gleichzeitig
- **Standard:** ausgewogene Darstellung für den täglichen Gebrauch
- **Kompakt:** mehr Informationen auf dem Bildschirm bei weiterhin klarer Bedienung

Die Auswahl wird lokal auf dem jeweiligen Gerät gespeichert. Haushaltsdaten oder die Darstellung anderer Mitglieder werden dadurch nicht verändert.

## Neue „Heute“-Ansicht

Die Startseite priorisiert automatisch:

1. eine heute geplante Mahlzeit und den direkten Start des Kochmodus
2. bald ablaufende Lebensmittel und passende Rezepte
3. offene Einträge auf der Einkaufsliste
4. eine allgemeine Schnellaktion, wenn aktuell nichts dringend ist

Zusätzlich zeigt die Seite:

- offenen Einkauf, Vorratsgröße, Rezept- und Notizanzahl
- Monatsstand, Ausgaben und Sparbetrag
- relevantes Rezept oder Küchenvorschlag
- Schnellzugriffe für Einkauf, Barcode, Sparen und Rezepte
- zuletzt bearbeitete Notizen

## Universelle Schnellaktion

Über den schwebenden Plus-Button können von jedem Hauptbereich aus direkt geöffnet werden:

- Einkaufsprodukt
- Notiz
- Einnahme oder Ausgabe
- Rezept
- Barcode-Scanner
- Kassenbon-Import

## Bestehende Funktionen bleiben erhalten

- Einnahmen, Ausgaben, Budgets und Spar-Challenge
- Einkaufsliste, Kompakt-/Listenansicht und Ladenmodus
- Vorrat, Ablaufdaten und Mindestbestände
- Barcode-Scanner und Kassenbon-Import
- persönliche Rezepte und GuteKueche-Linkimport
- Mahlzeitenplan von Montag bis Sonntag
- Vollbild-Kochmodus, Wake Lock, Sprachsteuerung und Küchentimer
- Notizen
- Supabase Auth, Cloud-Synchronisierung und Row Level Security
- Offline-Cache und vorgemerkte Änderungen
- JSON-, CSV- und Druckexporte

## Supabase-Verbindung

V20 verwendet das Supabase-Projekt `dpqhoesiniberglymdtb`.

Erforderliche Vercel-Variablen:

```env
SUPABASE_URL=https://dpqhoesiniberglymdtb.supabase.co
SUPABASE_PUBLISHABLE_KEY=<publishable-key>
SUPABASE_JWKS_URL=https://dpqhoesiniberglymdtb.supabase.co/auth/v1/.well-known/jwks.json
```

Der Publishable Key ist für Browser- und App-Zugriffe vorgesehen. Der Secret Key darf ausschließlich als geschützte serverseitige Umgebungsvariable verwendet werden und wird nicht in das Repository, den Browser-Bundle oder die Android-App geschrieben. Für normale HaushaltKlar-Benutzerzugriffe ist kein Secret Key erforderlich: Die App authentifiziert Benutzer über Supabase Auth und beschränkt Datenzugriffe über Row Level Security.

Beim Wechsel auf ein neues Supabase-Projekt müssen die Dateien unter `supabase/migrations` einmal im SQL Editor des neuen Projekts ausgeführt werden. Ohne diese Tabellen, Funktionen und RLS-Regeln kann sich die App zwar mit dem Projekt verbinden, aber keine Haushaltsdaten anlegen oder synchronisieren.

## Datenschutz und Rechte

Die Schutzmaßnahmen aus V19.3 bleiben vollständig aktiv und wurden auf V20 aktualisiert:

- proprietäre Lizenz und vollständiger Rechtevorbehalt
- Verbot von Klonen, Scraping, KI-Training und Text-/Data-Mining ohne Genehmigung
- restriktive Sicherheitsheader und Schutz vor Einbettung
- `robots.txt`, `tdm-reservation: 1` und TDMRep-Datei
- keine Service-Role- oder Secret-Schlüssel im Browser
- vertraulich gekennzeichnete Backups

Eine ausgelieferte Web-App kann technisch nicht absolut gegen Screenshots oder manuelles Nachprogrammieren geschützt werden. Das Repository ist weiterhin öffentlich und kann deshalb eingesehen werden; für maximalen Quellcodeschutz muss es privat gestellt werden.

## Technischer Aufbau

- Node.js 22
- serverseitiger App- und API-Einstieg
- modulare Quellteile unter `src/app`, `src/styles` und `src/vercel-api`
- automatische Asset-Zusammensetzung vor Entwicklung, Test und Build
- Vercel-Deployment
- Supabase als Cloud-Datenspeicher
- PWA-Service-Worker mit eigenem V20-Cache
- optionaler nativer Android-WebView-Wrapper

## Entwicklung und Test

```bash
npm install
npm test
npm run build
```

Vercel-Konfiguration:

```text
Build Command: npm run build
Output Directory: dist
Node.js: 22.x
```

Nach dem Deployment die Homescreen-App vollständig schließen und neu öffnen. Der Service Worker `haushaltklar-v20-living-canvas` entfernt ältere App-Caches automatisch.
