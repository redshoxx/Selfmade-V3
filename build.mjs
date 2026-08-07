import { copyFile, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import { gunzipSync } from 'node:zlib'

const VERSION = '2.0.1'
const staticFiles = ['manifest.webmanifest', 'icon.svg', 'sw.js']
const encodedFiles = {
  app: 'app.js.gz.b64',
  css: 'styles.css.gz.b64'
}

function decode(file) {
  return readFile(file, 'utf8').then((encoded) => {
    const bytes = Buffer.from(encoded.replace(/\s+/g, ''), 'base64')
    return gunzipSync(bytes).toString('utf8')
  })
}

function stripModuleSyntax(core, app) {
  const classicCore = core.replace(/^export\s+/gm, '')
  const classicApp = app.replace(/^import\s*\{[\s\S]*?\}\s*from\s*['"]\.\/core\.js['"]\s*;?\s*/m, '')
  if (/^\s*(import|export)\s/m.test(classicCore + '\n' + classicApp)) {
    throw new Error('Classic-Bundle enthält noch ES-Modul-Syntax.')
  }
  return `${classicCore}\n\n${classicApp}\nwindow.__SELFMADE_READY__ = true;\ndocument.documentElement.setAttribute('data-app-ready', 'true');\n`
}

await rm('dist', { recursive: true, force: true })
await mkdir('dist', { recursive: true })

for (const file of staticFiles) {
  const info = await stat(file)
  if (!info.isFile() || info.size === 0) throw new Error(`Build-Datei fehlt oder ist leer: ${file}`)
  await copyFile(file, `dist/${file}`)
}

const [appSource, coreSource, cssSource, htmlTemplate] = await Promise.all([
  decode(encodedFiles.app),
  readFile('core.js', 'utf8'),
  decode(encodedFiles.css),
  readFile('index.html', 'utf8')
])

const appBundle = stripModuleSyntax(coreSource, appSource)
const safeCss = cssSource.replace(/<\/style/gi, '<\\/style')
const safeJs = appBundle.replace(/<\/script/gi, '<\\/script')
const html = htmlTemplate
  .replace('/*__SELFMADE_INLINE_CSS__*/', safeCss)
  .replace('/*__SELFMADE_INLINE_APP__*/', safeJs)

if (html.includes('__SELFMADE_INLINE_')) throw new Error('Inline-Platzhalter wurden nicht vollständig ersetzt.')
await writeFile('dist/index.html', html)
await writeFile('dist/app.bundle.check.js', appBundle)

for (const file of ['dist/app.bundle.check.js', 'dist/sw.js', 'core.js']) {
  const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' })
  if (result.status !== 0) throw new Error(`${file}: JavaScript-Syntaxprüfung fehlgeschlagen\n${result.stderr || result.stdout}`)
}
await rm('dist/app.bundle.check.js')

for (const required of [
  'selfmade-version" content="2.0.1',
  'window.__SELFMADE_READY__ = true',
  'data-app-ready',
  'id="app"',
  'id="sheet"',
  '<style>',
  '--green: #70ca3b',
  '.bottom-nav',
  '.category-chip',
  'env(safe-area-inset-bottom',
  'toggle-store',
  'share-list',
  'weeklyStats',
  'openListsSheet'
]) {
  if (!html.includes(required)) throw new Error(`Build-Prüfung fehlgeschlagen: ${required}`)
}

if (html.includes('type="module"') || html.includes('src="/app.js')) {
  throw new Error('Externe Modul-Ladung ist noch aktiv.')
}

console.log(`Selfmade Einkauf V${VERSION}: Inline-Startbundle erfolgreich gebaut und geprüft.`)
