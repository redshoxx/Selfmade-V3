import test from 'node:test'
import assert from 'node:assert/strict'
import { autoCategory, categoryCounts, normalizeProductName, progressFor, sortItems, topCategories, weeklyStats } from '../core.js'

test('automatische Kategorien erkennen typische Produkte zuverlässig', () => {
  const cases = {
    'Bananen': 'fruit',
    'Bio Äpfel 1kg': 'fruit',
    'Tomaten': 'vegetables',
    'Vollmilch 3,5% 1l': 'dairy',
    'Mozzarella': 'dairy',
    'Semmeln': 'bakery',
    'Lachsfilet': 'meat',
    'TK Tiefkühlpizza': 'frozen',
    'Spaghetti Nudeln 500g': 'pantry',
    'Apfelsaft 1l': 'drinks',
    'Mineralwasser': 'drinks',
    'Schokolade': 'snacks',
    'Duschgel': 'drugstore',
    'Küchenrolle': 'household',
    'Katzenfutter': 'pets'
  }
  for (const [name, category] of Object.entries(cases)) {
    assert.equal(autoCategory(name), category, `${name} sollte ${category} sein`)
  }
})

test('Produktnamen werden für die Erkennung normalisiert', () => {
  assert.equal(normalizeProductName('  Bio ÄPFEL 1kg  '), 'bio apfel')
  assert.equal(normalizeProductName('Dusch-Gel 250ml'), 'dusch gel')
})

test('unbekannte Produkte landen kontrolliert in Sonstiges', () => {
  assert.equal(autoCategory('Spezialartikel XYZ'), 'other')
  assert.equal(autoCategory(''), 'other')
})

test('Fortschritt berechnet offene und erledigte Artikel', () => {
  assert.deepEqual(progressFor([{ done: true }, { done: false }, { done: false }]), { total: 3, done: 1, open: 2, percent: 33 })
})

test('Sortierung zeigt offene Artikel zuerst', () => {
  const result = sortItems([
    { done: true, category: 'fruit', updatedAt: 2 },
    { done: false, category: 'dairy', updatedAt: 1 }
  ])
  assert.equal(result[0].done, false)
})

test('Kategorien zählen Artikel', () => {
  const counts = categoryCounts([{ category: 'fruit' }, { category: 'fruit' }, { category: 'dairy' }, { category: 'drugstore' }])
  assert.equal(counts.fruit, 2)
  assert.equal(counts.dairy, 1)
  assert.equal(counts.drugstore, 1)
})

test('Wochenstatistik und Top-Kategorien funktionieren', () => {
  const now = new Date('2026-08-07T12:00:00+02:00').getTime()
  const items = [
    { category: 'fruit', done: true, completedAt: now - 1000 },
    { category: 'fruit', done: true, completedAt: now - 2000 },
    { category: 'dairy', done: true, completedAt: now - 86400000 }
  ]
  assert.equal(weeklyStats(items, now).reduce((sum, day) => sum + day.count, 0), 3)
  assert.equal(topCategories(items)[0].id, 'fruit')
})
