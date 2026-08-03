# iPhone-Kamera prüfen

## Nach dem Vercel-Deployment

1. Die Homescreen-App vollständig schließen.
2. Die App erneut öffnen. Durch den neuen Service Worker erfolgt bei Bedarf ein automatischer Reload.
3. **Start → Barcode scannen → Kamera starten** öffnen.
4. Beim iOS-Dialog den Kamerazugriff erlauben.

## Falls kein Kamerabild erscheint

- In Safari dieselbe Vercel-Adresse öffnen.
- Seitenmenü öffnen.
- **Mehr → Kamera → Erlauben** auswählen.
- Homescreen-App schließen und neu öffnen.
- Alternativ im Scanner **Foto aufnehmen** verwenden.

## Technische Scanner-Reihenfolge

1. Browser `BarcodeDetector`, sofern verfügbar
2. ZXing `BrowserMultiFormatReader`
3. Fotoaufnahme mit der iPhone-Rückkamera und Bilddecodierung
4. manuelle Barcode-Eingabe
