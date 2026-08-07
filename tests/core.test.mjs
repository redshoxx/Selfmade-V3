import test from 'node:test'
import assert from 'node:assert/strict'
import { autoCategory, categoryCounts, progressFor, sortItems, topCategories, weeklyStats } from '../core.js'

test('automatische Kategorien ordnen typische Artikel korrekt zu', () => {
  assert.equal(autoCategory('Bananen'), 'fruit')
  assert.equal(autoCategory('Vollmilch'), 'dairy')
  assert.equal(autoCategory('Küchenrolle'), 'household')
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
  const counts = categoryCounts([{ category: 'fruit' }, { category: 'fruit' }, { category: 'dairy' }])
  assert.equal(counts.fruit, 2)
  assert.equal(counts.dairy, 1)
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
