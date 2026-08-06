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

async function readParts(parts) {
  const buffers = []
  for (const part of parts) {
    const info = await stat(part)
    if (!info.isFile() || info.size === 0) throw new Error(`Ungültige Build-Datei: ${part}`)
    buffers.push(await readFile(part))
  }
  return Buffer.concat(buffers)
}

await rm('dist', { recursive: true, force: true })
await mkdir('dist', { recursive: true })

for (const file of staticFiles) {
  const info = await stat(file)
  if (!info.isFile() || info.size === 0) throw new Error(`Ungültige Build-Datei: ${file}`)
  await copyFile(file, `dist/${file}`)
}

const appCompressed = await readParts([
  'app.bundle-0.bin',
  'app.bundle-1.bin',
  'app.bundle-2.bin',
  'app.bundle-3.bin',
  'app.bundle-4.bin'
])
const stylesCompressed = await readParts(['styles-0.bin', 'styles-1.bin'])

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

console.log(`Selfmade V1.0.2: ${appSource.length} Byte JavaScript und ${stylesSource.length} Byte CSS unkomprimiert veröffentlicht.`)
