# HaushaltKlar V19.3 – Schutz- und Rechte-Update

HaushaltKlar ist eine proprietäre Haushalts-PWA mit Supabase-Speicherung, Vercel-Deployment, Rezeptverwaltung, Mahlzeitenplaner und Kochmodus.

## Schutzmaßnahmen in V19.3

- proprietäre `LICENSE` mit vollständigem Rechtevorbehalt
- ausdrückliches Verbot von Klonen, Weitergabe, KI-Training, Scraping und TDM
- maschinenlesbarer TDM-Vorbehalt über `tdm-reservation: 1`
- `/.well-known/tdmrep.json` nach dem W3C-TDMRep-Format
- vollständige Crawlersperre über `robots.txt`, einschließlich bekannter KI-Crawler
- `noindex`, `nosnippet` und `noimageindex` als Meta- und HTTP-Signale
- strikte Content Security Policy und Schutz vor Einbettung in fremde Websites
- keine Referrer-Weitergabe und restriktive Browser-Berechtigungen
- API-Antworten werden nicht zwischengespeichert
- sichtbarer Rechte- und Datenschutzbereich in den App-Einstellungen
- Backups enthalten eine Vertraulichkeits- und Rechtekennzeichnung
- Copyright-Banner in gebauten JavaScript-, CSS- und Serverdateien

## Wichtige technische Grenze

Eine ausgelieferte Web-App kann nicht absolut gegen Screenshots, manuelles Nachprogrammieren oder das Entfernen clientseitiger Schutzprüfungen gesichert werden. Das Repository muss deshalb **privat** sein. Solange es öffentlich ist, kann jeder den Quellcode ansehen und über GitHub forken. Bereits erstellte öffentliche Forks bleiben auch nach einer späteren Umstellung auf privat bestehen.

## Datenzugriff

Haushaltsdaten werden weiterhin über Supabase Auth und Row Level Security geschützt. Die App verwendet keinen Service-Role-Key im Browser. Benutzer- und Haushaltsdaten sind nicht für Werbung, Profilbildung, KI-Training oder Text- und Data-Mining freigegeben.

## Deployment

```bash
npm install
npm test
npm run build
```

```text
Build Command: npm run build
Output Directory: dist
Node.js: 22.x
```

Nach dem Deployment die Homescreen-App vollständig schließen und neu öffnen. Der Service Worker V19.3 entfernt ältere Caches.
