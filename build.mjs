import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { gunzipSync } from 'node:zlib'
import { spawnSync } from 'node:child_process'

const segmentFiles = ["bundle-0.b64", "bundle-1.b64", "bundle-2.b64"]
const encoded = (await Promise.all(segmentFiles.map((file) => readFile(file, 'utf8')))).join('').replace(/\s+/g, '')
const archive = JSON.parse(gunzipSync(Buffer.from(encoded, 'base64')).toString('utf8'))

await rm('dist', { recursive: true, force: true })
await mkdir('dist', { recursive: true })

for (const [name, entry] of Object.entries(archive)) {
  const content = entry.encoding === 'base64' ? Buffer.from(entry.content, 'base64') : entry.content
  await writeFile(`dist/${name}`, content)
}

const required = ['index.html', 'styles.css', 'core.js', 'app.js', 'sw.js', 'manifest.webmanifest', 'icon.svg']
for (const file of required) {
  if (!archive[file]?.content) throw new Error(`Build-Datei fehlt: ${file}`)
}

for (const file of ['core.js', 'app.js', 'sw.js']) {
  const result = spawnSync(process.execPath, ['--check', `dist/${file}`], { encoding: 'utf8' })
  if (result.status !== 0) throw new Error(`${file} enthält einen Syntaxfehler:\n${result.stderr || result.stdout}`)
}

const html = archive['index.html'].content
const css = archive['styles.css'].content
for (const marker of ['selfmade-version" content="1.0.0"', 'id="sheet"', '/app.js?v=1.0.0']) {
  if (!html.includes(marker)) throw new Error(`HTML-Prüfung fehlgeschlagen: ${marker}`)
}
for (const marker of ['safe-area-inset-bottom', '.bottom-nav', '.quick-add', '.sheet']) {
  if (!css.includes(marker)) throw new Error(`CSS-Prüfung fehlgeschlagen: ${marker}`)
}

console.log('Selfmade Einkauf V1.0.0: neue reine Einkaufs-App erfolgreich gebaut.')
