export const APP_VERSION = '2.1.0'

export const CATEGORIES = [
  { id: 'all', name: 'Alle', icon: '▦' },
  { id: 'fruit', name: 'Obst', icon: '🍎' },
  { id: 'vegetables', name: 'Gemüse', icon: '🥕' },
  { id: 'dairy', name: 'Milchprodukte', icon: '🥛' },
  { id: 'bakery', name: 'Backwaren', icon: '🥖' },
  { id: 'meat', name: 'Fleisch & Fisch', icon: '🥩' },
  { id: 'frozen', name: 'Tiefkühl', icon: '❄️' },
  { id: 'pantry', name: 'Vorrat', icon: '🥫' },
  { id: 'drinks', name: 'Getränke', icon: '🥤' },
  { id: 'snacks', name: 'Snacks', icon: '🍫' },
  { id: 'drugstore', name: 'Drogerie', icon: '🧴' },
  { id: 'household', name: 'Haushalt', icon: '🧽' },
  { id: 'pets', name: 'Tierbedarf', icon: '🐾' },
  { id: 'other', name: 'Sonstiges', icon: '·' }
]

const CATEGORY_RULES = [
  ['frozen', /\b(tk|tiefkuhl\w*|tiefgefrier\w*|eiscreme\w*|speiseeis\w*|frozen)\b|tiefkuhlpizza|tiefkuhlgemuse|tiefkuhlbeeren/i],
  ['drinks', /\b(wasser|mineralwasser|saft|nektar|cola|limonade|limo|kaffee|espresso|cappuccino|tee|energy|sirup|bier|wein|sekt|prosecco|getrank\w*)\b|apfelsaft|orangensaft|multivitaminsaft|eistee/i],
  ['dairy', /\b(milch\w*|kase\w*|jogh?urt\w*|butter\w*|sahne\w*|obers\w*|topfen\w*|quark\w*|mozzarella\w*|feta\w*|parmesan\w*|frischkase\w*|pudding\w*|kefir\w*|eier?\w*)\b/i],
  ['bakery', /\b(brot\w*|semmel\w*|brotchen\w*|baguette\w*|toast\w*|croissant\w*|geback\w*|kuchen\w*|torte\w*|muffin\w*|backware\w*)\b/i],
  ['meat', /\b(fleisch\w*|huhn\w*|hahnchen\w*|pute\w*|truthahn\w*|rind\w*|schwein\w*|wurst\w*|schinken\w*|speck\w*|fisch\w*|lachs\w*|thunfisch\w*|forelle\w*|garnel\w*|hack\w*|faschiert\w*|schnitzel\w*|steak\w*)\b/i],
  ['pantry', /\b(nudel\w*|pasta\w*|reis\w*|mehl\w*|zucker\w*|salz\w*|pfeffer\w*|gewurz\w*|olivenol\w*|sonnenblumenol\w*|essig\w*|konserve\w*|dose\w*|bohne\w*|linsen\w*|kichererbse\w*|mais\w*|tomatenmark\w*|passata\w*|sauce\w*|bruh\w*|cornflakes\w*|muesli\w*|haferflock\w*)\b/i],
  ['snacks', /\b(chips\w*|schokolade\w*|keks\w*|snack\w*|nuss\w*|nusse\w*|gummibar\w*|popcorn\w*|cracker\w*|bonbon\w*|praline\w*|riegel\w*)\b/i],
  ['drugstore', /\b(shampoo\w*|duschgel\w*|zahnpasta\w*|zahnburste\w*|deo\w*|creme\w*|bodylotion\w*|rasierer\w*|rasier\w*|tampon\w*|binde\w*|windel\w*|kosmetik\w*|makeup\w*|parfum\w*)\b/i],
  ['household', /\b(spulmittel\w*|waschmittel\w*|weichspuler\w*|reiniger\w*|putzmittel\w*|kuchenrolle\w*|toilettenpapier\w*|klopapier\w*|mullbeutel\w*|schwamm\w*|seife\w*|geschirrspul\w*|spultab\w*|alufolie\w*|frischhaltefolie\w*|backpapier\w*|batterie\w*)\b/i],
  ['pets', /\b(katzenfutter\w*|hundefutter\w*|tierfutter\w*|katzenstreu\w*|leckerl\w*|hunde\w*snack\w*|katzen\w*snack\w*)\b/i],
  ['fruit', /\b(apfel\w*|banan\w*|birn\w*|orange\w*|zitrone\w*|limette\w*|traub\w*|erdbeer\w*|heidelbeer\w*|himbeer\w*|brombeer\w*|kiwi\w*|mango\w*|ananas\w*|pfirsich\w*|nektarin\w*|melone\w*|kirsche\w*|zwetsch\w*|pflaume\w*|avocado\w*)\b/i],
  ['vegetables', /\b(tomate\w*|gurke\w*|karotte\w*|mohre\w*|kartoffel\w*|zwiebel\w*|paprika\w*|salat\w*|brokkoli\w*|blumenkohl\w*|zucchini\w*|kurbis\w*|knoblauch\w*|spinat\w*|sellerie\w*|lauch\w*|radies\w*|champignon\w*|pilz\w*)\b/i]
]

export function uid(prefix = 'id') {
  if (globalThis.crypto && globalThis.crypto.randomUUID) return `${prefix}_${globalThis.crypto.randomUUID()}`
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`
}

export function normalizeProductName(name = '') {
  return String(name)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/ß/g, 'ss')
    .replace(/\b\d+(?:[.,]\d+)?\s?(?:kg|g|l|ml|cl|stk|stuck|pack|pkg|%)\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function autoCategory(name = '') {
  const text = normalizeProductName(name)
  if (!text) return 'other'
  for (const [category, rule] of CATEGORY_RULES) {
    if (rule.test(text)) return category
  }
  return 'other'
}

export function categoryById(id) {
  return CATEGORIES.find((category) => category.id === id) || CATEGORIES[CATEGORIES.length - 1]
}

export function createInitialState() {
  const listId = uid('list')
  return {
    version: APP_VERSION,
    lists: [{ id: listId, name: 'Meine Liste', createdAt: Date.now() }],
    activeListId: listId,
    items: [],
    settings: { theme: 'dark', onboarded: false, compact: false }
  }
}

export function normalizeState(raw) {
  const fallback = createInitialState()
  if (!raw || typeof raw !== 'object') return fallback
  const lists = Array.isArray(raw.lists) && raw.lists.length
    ? raw.lists.filter((list) => list && list.id && list.name).map((list) => ({ id: String(list.id), name: String(list.name).slice(0, 40), createdAt: Number(list.createdAt) || Date.now() }))
    : fallback.lists
  const activeListId = lists.some((list) => list.id === raw.activeListId) ? raw.activeListId : lists[0].id
  const items = Array.isArray(raw.items) ? raw.items.filter((item) => item && item.id && lists.some((list) => list.id === item.listId)).map((item) => normalizeItem(item)) : []
  const theme = ['dark', 'light', 'system'].includes(raw.settings?.theme) ? raw.settings.theme : 'dark'
  return { version: APP_VERSION, lists, activeListId, items, settings: { theme, onboarded: Boolean(raw.settings?.onboarded), compact: Boolean(raw.settings?.compact) } }
}

export function normalizeItem(item = {}) {
  const name = String(item.name || '').trim().slice(0, 80)
  const category = CATEGORIES.some((cat) => cat.id === item.category && cat.id !== 'all') ? item.category : autoCategory(name)
  return { id: String(item.id || uid('item')), listId: String(item.listId || ''), name, category, quantity: Math.max(0.01, Number(item.quantity) || 1), unit: String(item.unit || 'Stk.').slice(0, 12), note: String(item.note || '').trim().slice(0, 160), done: Boolean(item.done), favorite: Boolean(item.favorite), createdAt: Number(item.createdAt) || Date.now(), updatedAt: Number(item.updatedAt) || Date.now(), completedAt: item.completedAt ? Number(item.completedAt) : null }
}

export function listItems(state, listId = state.activeListId) { return state.items.filter((item) => item.listId === listId) }

export function progressFor(items = []) {
  if (!items.length) return { total: 0, done: 0, open: 0, percent: 0 }
  const done = items.filter((item) => item.done).length
  return { total: items.length, done, open: items.length - done, percent: Math.round((done / items.length) * 100) }
}

export function sortItems(items = []) {
  return [...items].sort((a, b) => {
    if (a.done !== b.done) return Number(a.done) - Number(b.done)
    if (a.category !== b.category) {
      const ai = CATEGORIES.findIndex((category) => category.id === a.category)
      const bi = CATEGORIES.findIndex((category) => category.id === b.category)
      return ai - bi
    }
    return b.updatedAt - a.updatedAt
  })
}

export function frequentSuggestions(state, listId = state.activeListId, limit = 6) {
  const counts = new Map()
  for (const item of state.items) {
    if (item.listId !== listId && !item.favorite) continue
    const key = item.name.trim().toLocaleLowerCase('de')
    if (!key) continue
    const current = counts.get(key) || { name: item.name, count: 0, last: 0, favorite: false, category: item.category }
    current.count += 1
    current.last = Math.max(current.last, item.updatedAt)
    current.favorite = current.favorite || item.favorite
    counts.set(key, current)
  }
  return [...counts.values()].sort((a, b) => Number(b.favorite) - Number(a.favorite) || b.count - a.count || b.last - a.last).slice(0, limit)
}

export function categoryCounts(items = []) {
  const map = Object.fromEntries(CATEGORIES.filter((cat) => cat.id !== 'all').map((cat) => [cat.id, 0]))
  for (const item of items) map[item.category] = (map[item.category] || 0) + 1
  return map
}

export function weeklyStats(items = [], now = Date.now()) {
  const dayMs = 86400000
  const start = new Date(now)
  start.setHours(0, 0, 0, 0)
  const days = []
  for (let offset = 6; offset >= 0; offset -= 1) {
    const date = new Date(start.getTime() - offset * dayMs)
    const dayStart = date.getTime()
    const dayEnd = dayStart + dayMs
    const count = items.filter((item) => item.completedAt && item.completedAt >= dayStart && item.completedAt < dayEnd).length
    days.push({ date: dayStart, label: new Intl.DateTimeFormat('de-AT', { weekday: 'short' }).format(date).slice(0, 2), count })
  }
  return days
}

export function topCategories(items = [], limit = 3) {
  const completed = items.filter((item) => item.done || item.completedAt)
  const counts = categoryCounts(completed)
  return Object.entries(counts).map(([id, count]) => ({ id, count, ...categoryById(id) })).filter((entry) => entry.count > 0).sort((a, b) => b.count - a.count).slice(0, limit)
}
