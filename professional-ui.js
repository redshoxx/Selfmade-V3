(() => {
  'use strict'

  const appRoot = document.getElementById('app')
  if (!appRoot) return

  const state = {
    shoppingQuery: '',
    shoppingView: localStorage.getItem('selfmade-shopping-view') || 'grid',
    scheduled: false
  }

  const ICONS = {
    search: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"></circle><path d="m20 20-3.7-3.7"></path></svg>',
    grid: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="7" height="7" rx="2"></rect><rect x="14" y="3" width="7" height="7" rx="2"></rect><rect x="3" y="14" width="7" height="7" rx="2"></rect><rect x="14" y="14" width="7" height="7" rx="2"></rect></svg>',
    list: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 6h13M8 12h13M8 18h13"></path><circle cx="3" cy="6" r="1"></circle><circle cx="3" cy="12" r="1"></circle><circle cx="3" cy="18" r="1"></circle></svg>',
    plus: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"></path></svg>',
    sun: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"></circle><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"></path></svg>',
    moon: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.5 15.5A8.5 8.5 0 0 1 8.5 3.5a8.5 8.5 0 1 0 12 12Z"></path></svg>'
  }

  const PRODUCT_ICONS = {
    bread: '<svg viewBox="0 0 64 64"><path d="M13 27c0-9 8-16 19-16s19 7 19 16v23H13V27Z"></path><path d="M23 20c3 3 4 6 4 10M34 18c3 3 4 7 4 11"></path></svg>',
    milk: '<svg viewBox="0 0 64 64"><path d="M23 10h18l-3 9 6 8v27H20V27l6-8-3-9Z"></path><path d="M26 19h12M20 31h24"></path></svg>',
    fruit: '<svg viewBox="0 0 64 64"><path d="M32 21c-12-7-23 1-20 15 2 12 11 19 20 19s18-7 20-19c3-14-8-22-20-15Z"></path><path d="M32 21c0-7 4-11 11-12M33 14c-5-5-10-5-14-3"></path></svg>',
    vegetable: '<svg viewBox="0 0 64 64"><path d="M32 15c8 8 14 17 14 26a14 14 0 0 1-28 0c0-9 6-18 14-26Z"></path><path d="M32 15c-1-6-5-9-11-10M32 15c2-6 7-9 13-9"></path></svg>',
    drink: '<svg viewBox="0 0 64 64"><path d="M21 12h22l-3 42H24l-3-42Z"></path><path d="M23 22h18M28 6h17M39 6l-5 16"></path></svg>',
    hygiene: '<svg viewBox="0 0 64 64"><path d="M25 12h14v11l6 7v24H19V30l6-7V12Z"></path><path d="M25 18h14M23 36h18"></path></svg>',
    household: '<svg viewBox="0 0 64 64"><path d="m13 30 19-17 19 17v23H13V30Z"></path><path d="M25 53V37h14v16"></path></svg>',
    frozen: '<svg viewBox="0 0 64 64"><path d="M32 8v48M11 20l42 24M53 20 11 44"></path><path d="m26 13 6-5 6 5M26 51l6 5 6-5M14 27l-3-7 8-1M45 45l8-1-3-7M50 27l3-7-8-1M19 45l-8-1 3-7"></path></svg>',
    default: '<svg viewBox="0 0 64 64"><path d="M17 20h30l-3 35H20l-3-35Z"></path><path d="M24 20c0-8 3-12 8-12s8 4 8 12"></path></svg>'
  }

  function setTheme(theme) {
    const resolved = theme === 'dark' ? 'dark' : 'light'
    document.documentElement.dataset.theme = resolved
    localStorage.setItem('selfmade-theme', resolved)
    const meta = document.querySelector('meta[name="theme-color"]')
    if (meta) meta.content = resolved === 'dark' ? '#1f292f' : '#26343c'
  }

  function initialTheme() {
    const stored = localStorage.getItem('selfmade-theme')
    if (stored) return stored
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }

  function routeName() {
    const active = document.querySelector('.bottom-nav__item.is-active')
    return active?.dataset.route || 'home'
  }

  function productType(text) {
    const value = text.toLowerCase()
    if (/brot|semmel|toast|baguette|gebäck|mehl/.test(value)) return 'bread'
    if (/milch|joghurt|käse|butter|sahne|topfen|quark/.test(value)) return 'milk'
    if (/apfel|birne|banane|orange|zitrone|beere|obst|traube/.test(value)) return 'fruit'
    if (/salat|tomate|gurke|karotte|kartoffel|zwiebel|gemüse|paprika/.test(value)) return 'vegetable'
    if (/wasser|saft|cola|limonade|kaffee|tee|getränk/.test(value)) return 'drink'
    if (/shampoo|seife|zahnpasta|deo|creme|drogerie|hygiene/.test(value)) return 'hygiene'
    if (/reiniger|papier|müll|haushalt|spül|waschmittel/.test(value)) return 'household'
    if (/tiefkühl|eis|pizza|frozen/.test(value)) return 'frozen'
    return 'default'
  }

  function categoryTone(category) {
    const value = category.toLowerCase()
    if (/obst|gemüse/.test(value)) return '#55a889'
    if (/getränk/.test(value)) return '#5d8fb8'
    if (/drogerie/.test(value)) return '#9b79b7'
    if (/haushalt/.test(value)) return '#d58a54'
    if (/lebensmittel/.test(value)) return '#e46f65'
    return '#607b84'
  }

  function enhanceHeader() {
    const actions = document.querySelector('.topbar__actions')
    if (!actions || actions.querySelector('[data-pro-action="theme"]')) return
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'icon-button pro-theme-toggle'
    button.dataset.proAction = 'theme'
    button.setAttribute('aria-label', 'Darstellung wechseln')
    button.innerHTML = document.documentElement.dataset.theme === 'dark' ? ICONS.sun : ICONS.moon
    actions.insertBefore(button, actions.lastElementChild)
  }

  function enhanceNavigation() {
    document.querySelectorAll('.bottom-nav__item').forEach((button) => {
      button.classList.add('pro-nav-item')
    })
  }

  function buildShoppingCommand() {
    const section = document.createElement('section')
    section.className = 'pro-shopping-command'
    section.dataset.proShoppingCommand = 'true'
    section.innerHTML = `
      <div class="pro-list-overview">
        <div>
          <span class="pro-kicker">Aktive Liste</span>
          <strong>Wocheneinkauf</strong>
          <small><b data-pro-open-count>0</b> Artikel offen</small>
        </div>
        <button class="pro-primary-icon" type="button" data-action="shopping-add" aria-label="Artikel hinzufügen">${ICONS.plus}</button>
      </div>
      <div class="pro-shopping-tools">
        <label class="pro-search">
          ${ICONS.search}
          <input type="search" inputmode="search" autocomplete="off" placeholder="Was möchtest du einkaufen?" aria-label="Einkaufsliste durchsuchen">
          <button type="button" data-pro-action="clear-search" aria-label="Suche leeren">×</button>
        </label>
        <div class="pro-view-switch" role="group" aria-label="Darstellung">
          <button type="button" data-pro-view="grid" aria-label="Kachelansicht">${ICONS.grid}</button>
          <button type="button" data-pro-view="list" aria-label="Listenansicht">${ICONS.list}</button>
        </div>
      </div>`

    const input = section.querySelector('input')
    input.value = state.shoppingQuery
    input.addEventListener('input', () => {
      state.shoppingQuery = input.value
      applyShoppingFilter()
    })
    return section
  }

  function enhanceShopping() {
    const heading = document.querySelector('.page-heading')
    const summary = document.querySelector('.shopping-summary')
    if (!heading || !summary) return

    document.body.dataset.proRoute = 'shopping'
    appRoot.classList.toggle('shopping-view-grid', state.shoppingView === 'grid')
    appRoot.classList.toggle('shopping-view-list', state.shoppingView === 'list')

    if (!document.querySelector('[data-pro-shopping-command]')) {
      heading.insertAdjacentElement('afterend', buildShoppingCommand())
    }

    document.querySelectorAll('.shopping-group').forEach((group) => {
      const category = group.querySelector('h2')?.childNodes?.[0]?.textContent?.trim() || 'Sonstiges'
      group.style.setProperty('--category-tone', categoryTone(category))
      group.dataset.category = category
    })

    document.querySelectorAll('.shopping-item').forEach((item) => {
      if (!item.querySelector('.pro-product-glyph')) {
        const name = item.querySelector('.shopping-item__body strong')?.textContent || ''
        const glyph = document.createElement('span')
        glyph.className = 'pro-product-glyph'
        glyph.innerHTML = PRODUCT_ICONS[productType(name)]
        glyph.setAttribute('aria-hidden', 'true')
        item.insertBefore(glyph, item.querySelector('.shopping-item__body'))
      }
    })

    document.querySelectorAll('[data-pro-view]').forEach((button) => {
      button.classList.toggle('is-active', button.dataset.proView === state.shoppingView)
      button.setAttribute('aria-pressed', String(button.dataset.proView === state.shoppingView))
    })

    applyShoppingFilter()
    updateShoppingCount()
  }

  function applyShoppingFilter() {
    const query = state.shoppingQuery.trim().toLocaleLowerCase('de')
    document.querySelectorAll('.shopping-group').forEach((group) => {
      let visible = 0
      group.querySelectorAll('.shopping-item').forEach((item) => {
        const haystack = `${item.textContent} ${group.dataset.category || ''}`.toLocaleLowerCase('de')
        const show = !query || haystack.includes(query)
        item.hidden = !show
        if (show) visible += 1
      })
      group.hidden = visible === 0
    })

    const clear = document.querySelector('[data-pro-action="clear-search"]')
    if (clear) clear.hidden = !query
  }

  function updateShoppingCount() {
    const count = [...document.querySelectorAll('.shopping-groups .shopping-item')]
      .filter((item) => !item.classList.contains('is-done')).length
    const node = document.querySelector('[data-pro-open-count]')
    if (node) node.textContent = String(count)
  }

  function enhanceRoute() {
    const route = routeName()
    document.body.dataset.proRoute = route
    document.body.classList.add('selfmade-pro')

    if (route === 'shopping') enhanceShopping()

    document.querySelectorAll('.segment').forEach((segment) => {
      segment.classList.add('pro-segment')
    })

    document.querySelectorAll('.panel, .metric-card, .list-card, .recipe-card, .savings-card, .note-card, .challenge-card').forEach((card) => {
      card.classList.add('pro-surface')
    })
  }

  function enhanceDialog() {
    const dialog = document.getElementById('dialog')
    if (!dialog) return
    dialog.classList.toggle('pro-dialog-open', dialog.open)
    document.body.classList.toggle('has-dialog', dialog.open)
  }

  function enhance() {
    state.scheduled = false
    enhanceHeader()
    enhanceNavigation()
    enhanceRoute()
    enhanceDialog()
  }

  function scheduleEnhance() {
    if (state.scheduled) return
    state.scheduled = true
    requestAnimationFrame(enhance)
  }

  setTheme(initialTheme())
  scheduleEnhance()

  const observer = new MutationObserver(scheduleEnhance)
  observer.observe(appRoot, { childList: true, subtree: true })
  const dialog = document.getElementById('dialog')
  if (dialog) observer.observe(dialog, { childList: true, subtree: true, attributes: true, attributeFilter: ['open'] })

  document.addEventListener('click', (event) => {
    const themeButton = event.target.closest('[data-pro-action="theme"]')
    if (themeButton) {
      const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'
      setTheme(next)
      themeButton.innerHTML = next === 'dark' ? ICONS.sun : ICONS.moon
      return
    }

    const clearButton = event.target.closest('[data-pro-action="clear-search"]')
    if (clearButton) {
      state.shoppingQuery = ''
      const input = document.querySelector('.pro-search input')
      if (input) input.value = ''
      applyShoppingFilter()
      input?.focus()
      return
    }

    const viewButton = event.target.closest('[data-pro-view]')
    if (viewButton) {
      state.shoppingView = viewButton.dataset.proView === 'list' ? 'list' : 'grid'
      localStorage.setItem('selfmade-shopping-view', state.shoppingView)
      enhanceShopping()
    }
  }, true)

  window.addEventListener('pageshow', scheduleEnhance)
  window.addEventListener('resize', scheduleEnhance)
})()
