import { copyFile, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'

const VERSION = '3.0.0'
const staticFiles = ['manifest.webmanifest', 'icon.svg', 'sw.js']

function stripModuleSyntax(core, app) {
  const classicCore = core.replace(/^export\s+/gm, '')
  const classicApp = app.replace(/^import\s*\{[\s\S]*?\}\s*from\s*['"]\.\/core\.js['"]\s*;?\s*/m, '')
  const bundle = `${classicCore}\n\n${classicApp}`
  if (/^\s*(import|export)\s/m.test(bundle)) throw new Error('Bundle enthält noch ES-Modul-Syntax.')
  return bundle
}

await rm('dist', { recursive: true, force: true })
await mkdir('dist', { recursive: true })
for (const file of staticFiles) {
  const info = await stat(file)
  if (!info.isFile() || info.size === 0) throw new Error(`Build-Datei fehlt: ${file}`)
  await copyFile(file, `dist/${file}`)
}

const [appSource, coreSource, cssSource, template] = await Promise.all([
  readFile('app.js','utf8'), readFile('core.js','utf8'), readFile('styles.css','utf8'), readFile('index.html','utf8')
])
const bundle = stripModuleSyntax(coreSource, appSource)
const html = template
  .replace('/*__SELFMADE_INLINE_CSS__*/', cssSource.replace(/<\/style/gi,'<\\/style'))
  .replace('/*__SELFMADE_INLINE_APP__*/', bundle.replace(/<\/script/gi,'<\\/script'))
if (html.includes('__SELFMADE_INLINE_')) throw new Error('Build-Platzhalter nicht vollständig ersetzt.')
await writeFile('dist/index.html', html)
await writeFile('dist/check.js', bundle)
for (const file of ['dist/check.js','core.js','app.js','sw.js']) {
  const result = spawnSync(process.execPath,['--check',file],{encoding:'utf8'})
  if (result.status !== 0) throw new Error(`${file}: Syntaxfehler\n${result.stderr||result.stdout}`)
}
await rm('dist/check.js')

const required = [
  'selfmade-version" content="3.0.0"','window.__SELFMADE_READY__=true','data-app-ready','id="app"','id="sheet"',
  'env(safe-area-inset-bottom','390px','.bottom-nav','.search-add','.store-mode','.sheet-form','Weitere Optionen',
  'autoCategory','quick-add-form','toggle-item','share-list','open-lists','weeklyStats','localStorage','selfmade-einkauf-v2'
]
for (const token of required) if (!html.includes(token)) throw new Error(`QA-Prüfung fehlt: ${token}`)
if (html.includes('app.js.gz.b64') || html.includes('styles.css.gz.b64') || html.includes('type="module"')) throw new Error('Veraltete Build-/Modulstruktur aktiv.')
console.log(`Selfmade V${VERSION}: Premium-Mobile-Build erfolgreich geprüft.`)
