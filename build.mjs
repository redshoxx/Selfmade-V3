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

async function readBase64Parts(parts) {
  const chunks = []
  for (const part of parts) {
    const info = await stat(part)
    if (!info.isFile() || info.size === 0) throw new Error(`Ungültige Build-Datei: ${part}`)
    chunks.push(await readFile(part, 'utf8'))
  }

  const encoded = chunks.join('').replace(/\s+/g, '')
  if (!encoded || !/^[A-Za-z0-9+/=]+$/.test(encoded)) {
    throw new Error(`Ungültige Base64-Daten in ${parts.join(', ')}`)
  }

  const compressed = Buffer.from(encoded, 'base64')
  if (compressed.length < 3 || compressed[0] !== 0x1f || compressed[1] !== 0x8b) {
    throw new Error(`Kein gültiger Gzip-Header in ${parts.join(', ')}`)
  }
  return compressed
}

await rm('dist', { recursive: true, force: true })
await mkdir('dist', { recursive: true })

for (const file of staticFiles) {
  const info = await stat(file)
  if (!info.isFile() || info.size === 0) throw new Error(`Ungültige Build-Datei: ${file}`)
  await copyFile(file, `dist/${file}`)
}

const appCompressed = await readBase64Parts([
  'app.bundle-0.bin',
  'app.bundle-1.bin',
  'app.bundle-2.bin',
  'app.bundle-3.bin',
  'app.bundle-4.bin'
])
const stylesCompressed = await readBase64Parts(['styles-0.bin', 'styles-1.bin'])

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

console.log(`Selfmade V1.0.2: ${appSource.length} Byte JavaScript und ${stylesSource.length} Byte CSS dekodiert und geprüft.`)
