import { copyFile, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import { gunzipSync } from 'node:zlib'

const staticFiles = ['index.html', 'manifest.webmanifest', 'icon.svg', 'sw.js']
const encodedFiles = [
  ['app.js.gz.b64', 'app.js'],
  ['core.js.gz.b64', 'core.js'],
  ['styles.css.gz.b64', 'styles.css']
]

await rm('dist', { recursive: true, force: true })
await mkdir('dist', { recursive: true })

for (const file of staticFiles) {
  const info = await stat(file)
  if (!info.isFile() || info.size === 0) throw new Error(`Build-Datei fehlt oder ist leer: ${file}`)
  await copyFile(file, `dist/${file}`)
}

for (const [source, target] of encodedFiles) {
  const encoded = (await readFile(source, 'utf8')).replace(/\s+/g, '')
  const decoded = Buffer.from(encoded, 'base64')
  const text = gunzipSync(decoded)
  if (!text.length) throw new Error(`Entpackte Datei ist leer: ${target}`)
  await writeFile(`dist/${target}`, text)
}

for (const file of ['dist/app.js', 'dist/core.js', 'dist/sw.js']) {
  const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' })
  if (result.status !== 0) throw new Error(`${file}: JavaScript-Syntaxprüfung fehlgeschlagen\n${result.stderr || result.stdout}`)
}

const html = await readFile('dist/index.html', 'utf8')
const css = await readFile('dist/styles.css', 'utf8')
const app = await readFile('dist/app.js', 'utf8')
for (const required of ['id="app"', 'id="sheet"', '/app.js?v=2.0.0', 'selfmade-version" content="2.0.0']) {
  if (!html.includes(required)) throw new Error(`HTML-Prüfung fehlgeschlagen: ${required}`)
}
for (const required of ['--green: #70ca3b', '.bottom-nav', '.category-chip', '.sheet', 'env(safe-area-inset-bottom']) {
  if (!css.includes(required)) throw new Error(`Design-Prüfung fehlgeschlagen: ${required}`)
}
for (const required of ['autoCategory', 'toggle-store', 'share-list', 'weeklyStats', 'openListsSheet']) {
  if (!app.includes(required)) throw new Error(`App-Prüfung fehlgeschlagen: ${required}`)
}
console.log('Selfmade Einkauf V2.0.0: kompletter Dark-Green-Neuaufbau erfolgreich gebaut.')
