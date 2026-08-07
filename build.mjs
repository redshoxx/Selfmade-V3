import { copyFile, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import { gunzipSync } from 'node:zlib'

const VERSION = '2.1.0'
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

function prepareAppSource(app) {
  const prepared = app.replace(
    "const selectedCategory = item?.category || preCategory || 'other'",
    "const selectedCategory = item?.category || preCategory || 'auto'"
  )
  if (!prepared.includes("const selectedCategory = item?.category || preCategory || 'auto'")) {
    throw new Error('Automatische Kategorie ist im Artikelformular nicht als Standard aktiv.')
  }
  return prepared
}

function neutralizeCss(css) {
  const neutral = css
    .replace('--green: #70ca3b;', '--green: #eceeeb;')
    .replace('--green-2: #86db4b;', '--green-2: #ffffff;')
    .replace('--green-dark: #336b1a;', '--green-dark: #343735;')

  return `${neutral}\n\n/* neutral-v2-1: bewusst reduzierte Schwarz/Grau/Weiß-Oberfläche */\n.category-chip.is-active { border-color: var(--line-strong); background: var(--surface-3); color: var(--text); box-shadow: none; }\n.category-chip.is-active .category-icon { background: #f1f2ef; color: #101210; }\n.store-card { background: var(--surface); border-color: var(--line-strong); }\n.store-card span, .store-card > b, .text-button, .item-edit.is-favorite, .settings-row .checkmark { color: var(--text); }\n.progress i, .bar-col i, .top-category > i em { background: #f1f2ef; box-shadow: none; }\n.empty-check { background: #f1f2ef; color: #101210; box-shadow: none; }\n.primary-button, .wide-add { background: #f1f2ef; color: #101210; box-shadow: none; }\n.category-row.is-active, .category-hero { background: var(--surface-3); }\n.list-choice.is-active { border-color: var(--line-strong); background: var(--surface-2); }\n.nav-item.is-active { color: #ffffff; }\n.nav-add { background: #f1f2ef; color: #101210; box-shadow: 0 0 0 5px var(--bg); }\n.toggle-row input:checked + i { background: #e6e8e5; }\n.brand-bag::before { background: linear-gradient(160deg, #f0f1ee, #b8bcb8); box-shadow: 0 18px 44px rgba(0,0,0,.28); }\n.brand-bag::after { border-color: #d8dbd7; }\n.onboarding { background: radial-gradient(circle at 50% 31%, rgba(255,255,255,.045), transparent 24%), linear-gradient(#0b0d0c, #0e100f); }\n.quick-add:focus-within { border-color: rgba(255,255,255,.24); box-shadow: 0 0 0 3px rgba(255,255,255,.055); }\n`
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

const [rawAppSource, coreSource, rawCssSource, htmlTemplate] = await Promise.all([
  decode(encodedFiles.app),
  readFile('core.js', 'utf8'),
  decode(encodedFiles.css),
  readFile('index.html', 'utf8')
])

const appSource = prepareAppSource(rawAppSource)
const cssSource = neutralizeCss(rawCssSource)
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
  'selfmade-version" content="2.1.0',
  'window.__SELFMADE_READY__ = true',
  'data-app-ready',
  'id="app"',
  'id="sheet"',
  '<style>',
  '--green: #eceeeb',
  'neutral-v2-1',
  '.bottom-nav',
  '.category-chip',
  'env(safe-area-inset-bottom',
  "const selectedCategory = item?.category || preCategory || 'auto'",
  "name: 'Tiefkühl'",
  "name: 'Drogerie'",
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

console.log(`Selfmade Einkauf V${VERSION}: neutrale Oberfläche und Auto-Kategorien erfolgreich gebaut und geprüft.`)
