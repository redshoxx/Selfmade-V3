import { copyFile, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { gunzipSync } from 'node:zlib'

const VERSION = '1.0.0'
const bundles = ['bundle-0.b64','bundle-1.b64','bundle-2.b64','bundle-3.b64']

await rm('dist',{recursive:true,force:true})
await mkdir('dist',{recursive:true})
const b64 = (await Promise.all(bundles.map(file=>readFile(file,'utf8')))).join('')
const html = gunzipSync(Buffer.from(b64,'base64')).toString('utf8')

const required = [
  'Selfmade Save',
  'Sparziele',
  'Challenges',
  'Steiermärkische Sparkasse',
  'George CSV importieren',
  'Automatisch verbinden',
  'parseBankCsv',
  'Auszahlungen',
  'selfmade-save-v1',
  'data-app-ready',
  'selfmade-version" content="1.0.0"',
  'mobile-web-app-capable" content="yes"',
  'apple-mobile-web-app-capable" content="yes"'
]
for (const token of required) if (!html.includes(token)) throw new Error(`QA-Prüfung fehlt: ${token}`)

const forbidden = ['Einkaufsliste','Was brauchst du?','Im Laden','Nicht vergessen?','Selfmade Einkauf']
for (const token of forbidden) if (html.includes(token)) throw new Error(`Alte Einkaufs-App erkannt: ${token}`)

await writeFile('dist/index.html',html)
for (const file of ['manifest.webmanifest','icon.svg','sw.js']) await copyFile(file,`dist/${file}`)

console.log(`Selfmade Save V${VERSION}: Build und QA erfolgreich.`)