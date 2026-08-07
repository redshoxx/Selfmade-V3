export const APP_VERSION = '2.0.1'

export const CATEGORIES = [
  { id: 'all', name: 'Alle', icon: '▦' },
  { id: 'fruit', name: 'Obst', icon: '🍋' },
  { id: 'vegetables', name: 'Gemüse', icon: '🥕' },
  { id: 'dairy', name: 'Milchprodukte', icon: '🥛' },
  { id: 'bakery', name: 'Backwaren', icon: '🥐' },
  { id: 'meat', name: 'Fleisch & Fisch', icon: '🥩' },
  { id: 'drinks', name: 'Getränke', icon: '🧃' },
  { id: 'snacks', name: 'Snacks', icon: '🍿' },
  { id: 'household', name: 'Haushalt', icon: '🧽' },
  { id: 'other', name: 'Sonstiges', icon: '✦' }
]

const CATEGORY_RULES = [
  ['fruit', /(apfel|äpfel|banane|birne|orange|zitrone|limette|traube|erdbeer|heidelbeer|kiwi|mango|ananas|obst|pfirsich|nektarine|melone)/i],
  ['vegetables', /(tomate|gurke|karotte|möhre|kartoffel|zwiebel|paprika|salat|brokkoli|blumenkohl|zucchini|kürbis|gemüse|knoblauch|spinat)/i],
  ['dairy', /(milch|käse|joghurt|jogurt|butter|sahne|obers|topfen|quark|mozzarella|feta|eier|ei\b)/i],
  ['bakery', /(brot|semmel|brötchen|baguette|toast|croissant|gebäck|kuchen|mehl|backware)/i],
  ['meat', /(fleisch|huhn|hähnchen|pute|rind|schwein|wurst|schinken|fisch|lachs|thunfisch|hack|faschiert)/i],
  ['drinks', /(wasser|saft|cola|limonade|limo|kaffee|tee|energy|bier|wein|getränk)/i],
  ['snacks', /(chips|schokolade|keks|kekse|snack|nüsse|gummibär|popcorn|cracker)/i],
  ['household', /(spülmittel|waschmittel|reiniger|küchenrolle|toilettenpapier|müllbeutel|schwamm|seife|shampoo|zahnpasta|deo|haushalt)/i]
]

export function uid(prefix = 'id') {
  if (globalThis.crypto && globalThis.crypto.randomUUID) return `${prefix}_${globalThis.crypto.randomUUID()}`
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`
}

export function autoCategory(name = '') {
  const text = String(name).trim()
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
