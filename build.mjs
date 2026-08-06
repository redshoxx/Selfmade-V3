import { copyFile, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises'

const staticFiles = [
  'index.html',
  'manifest.webmanifest',
  'sw.js',
  'icon-192.png',
  'icon-512.png',
  'icon-maskable-512.png'
]

async function concatenate(parts, destination) {
  const buffers = []
  for (const part of parts) {
    const info = await stat(part)
    if (!info.isFile() || info.size === 0) throw new Error(`Ungültige Build-Datei: ${part}`)
    buffers.push(await readFile(part))
  }
  await writeFile(destination, Buffer.concat(buffers))
}

await rm('dist', { recursive: true, force: true })
await mkdir('dist', { recursive: true })

for (const file of staticFiles) {
  const info = await stat(file)
  if (!info.isFile() || info.size === 0) throw new Error(`Ungültige Build-Datei: ${file}`)
  await copyFile(file, `dist/${file}`)
}

await concatenate(
  ['app.bundle-0.bin', 'app.bundle-1.bin', 'app.bundle-2.bin', 'app.bundle-3.bin', 'app.bundle-4.bin'],
  'dist/app.bundle.js'
)
await concatenate(['styles-0.bin', 'styles-1.bin'], 'dist/styles.css')

console.log('Selfmade V1.0.1: statische PWA mit HTTP-Gzip-Auslieferung gebaut.')
