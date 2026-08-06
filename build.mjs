import { copyFile, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import { gunzipSync } from 'node:zlib'

const staticFiles = [
  'index.html',
  'manifest.webmanifest',
  'sw.js',
  'icon-192.png',
  'icon-512.png',
  'icon-maskable-512.png'
]

async function readBinary(file) {
  const info = await stat(file)
  if (!info.isFile() || info.size === 0) throw new Error(`Ungültige Build-Datei: ${file}`)
  return readFile(file)
}

async function readBase64(file) {
  const info = await stat(file)
  if (!info.isFile() || info.size === 0) throw new Error(`Ungültige Build-Datei: ${file}`)
  const encoded = (await readFile(file, 'utf8')).replace(/\s+/g, '')
  const decoded = Buffer.from(encoded, 'base64')
  if (decoded.length === 0) throw new Error(`Base64-Dekodierung fehlgeschlagen: ${file}`)
  return decoded
}

function assertGzip(buffer, label) {
  if (buffer.length < 3 || buffer[0] !== 0x1f || buffer[1] !== 0x8b) {
    throw new Error(`${label} besitzt keinen gültigen Gzip-Header.`)
  }
}

await rm('dist', { recursive: true, force: true })
await mkdir('dist', { recursive: true })

for (const file of staticFiles) {
  const info = await stat(file)
  if (!info.isFile() || info.size === 0) throw new Error(`Ungültige Build-Datei: ${file}`)
  await copyFile(file, `dist/${file}`)
}

const appCompressed = Buffer.concat([
  await readBinary('app.bundle-0.bin'),
  await readBase64('app.bundle-1.correct.b64'),
  await readBinary('app.bundle-2.bin'),
  await readBinary('app.bundle-3.bin'),
  await readBinary('app.bundle-4.bin')
])
const stylesCompressed = Buffer.concat([
  await readBinary('styles-0.bin'),
  await readBinary('styles-1.bin')
])

assertGzip(appCompressed, 'App-Bundle')
assertGzip(stylesCompressed, 'Stylesheet')

const appSource = gunzipSync(appCompressed)
const stylesSource = gunzipSync(stylesCompressed)

if (appSource.length === 0 || stylesSource.length === 0) {
  throw new Error('Die entpackten App-Dateien sind leer.')
}

await writeFile('dist/app.bundle.js', appSource)
await writeFile('dist/styles.css', stylesSource)

const syntaxCheck = spawnSync(process.execPath, ['--check', 'dist/app.bundle.js'], { encoding: 'utf8' })
if (syntaxCheck.status !== 0) {
  throw new Error(`JavaScript-Syntaxprüfung fehlgeschlagen:\n${syntaxCheck.stderr || syntaxCheck.stdout}`)
}

console.log(`Selfmade V1.0.2: ${appSource.length} Byte JavaScript und ${stylesSource.length} Byte CSS erfolgreich rekonstruiert.`)
