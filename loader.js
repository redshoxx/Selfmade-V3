(() => {
  const appParts = [0, 1, 2, 3, 4].map((i) => `/app.bundle-${i}.bin`)
  const styleParts = [0, 1].map((i) => `/styles-${i}.bin`)

  async function readParts(paths) {
    const responses = await Promise.all(paths.map(async (path) => {
      const response = await fetch(path)
      if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`)
      return new Uint8Array(await response.arrayBuffer())
    }))
    const length = responses.reduce((total, value) => total + value.length, 0)
    const merged = new Uint8Array(length)
    let offset = 0
    for (const value of responses) {
      merged.set(value, offset)
      offset += value.length
    }
    return merged
  }

  async function gunzip(paths) {
    if (!('DecompressionStream' in window)) {
      throw new Error('Dieser Browser unterstützt die benötigte Dekomprimierung nicht.')
    }
    const compressed = await readParts(paths)
    const stream = new Blob([compressed]).stream().pipeThrough(new DecompressionStream('gzip'))
    return new TextDecoder().decode(await new Response(stream).arrayBuffer())
  }

  async function start() {
    const [css, script] = await Promise.all([gunzip(styleParts), gunzip(appParts)])
    const style = document.createElement('style')
    style.textContent = css
    document.head.append(style)
    Function(`${script}\n//# sourceURL=/app.bundle.js`)()
  }

  start().catch((error) => {
    console.error(error)
    document.getElementById('app').innerHTML = `<main style="font:16px system-ui;padding:32px;max-width:620px;margin:auto"><h1>Selfmade konnte nicht geladen werden</h1><p>${String(error.message || error)}</p><button onclick="location.reload()">Erneut versuchen</button></main>`
  })
})()
