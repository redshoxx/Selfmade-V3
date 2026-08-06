import { copyFile, mkdir, rm, stat } from 'node:fs/promises'

const files = [
  'index.html',
  'loader.js',
  'manifest.webmanifest',
  'sw.js',
  'icon-192.png',
  'icon-512.png',
  'icon-maskable-512.png',
  'app.bundle-0.bin',
  'app.bundle-1.bin',
  'app.bundle-2.bin',
  'app.bundle-3.bin',
  'app.bundle-4.bin',
  'styles-0.bin',
  'styles-1.bin'
]

await rm('dist', { recursive: true, force: true })
await mkdir('dist', { recursive: true })

for (const file of files) {
  const info = await stat(file)
  if (!info.isFile() || info.size === 0) throw new Error(`Ungültige Build-Datei: ${file}`)
  await copyFile(file, `dist/${file}`)
}

console.log(`Selfmade V1: ${files.length} statische Dateien nach dist kopiert.`)
