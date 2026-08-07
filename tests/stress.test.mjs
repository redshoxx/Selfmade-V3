import test from 'node:test'
import assert from 'node:assert/strict'
import { autoCategory, categoryCounts, createInitialState, normalizeState, progressFor, sortItems, weeklyStats } from '../core.js'

test('1000 Stressdurchläufe bleiben konsistent', () => {
  const names = ['Bananen', 'Milch', 'Brot', 'Tomaten', 'Küchenrolle', 'Wasser', 'Chips', 'Lachs', 'Apfel', 'Käse']
  for (let i = 0; i < 1000; i += 1) {
    const state = createInitialState()
    for (let j = 0; j < 25; j += 1) {
      const name = names[(i + j) % names.length]
      state.items.push({
        id: `i_${i}_${j}`,
        listId: state.activeListId,
        name,
        category: autoCategory(name),
        quantity: (j % 3) + 1,
        unit: 'Stk.',
        note: '',
        done: j % 4 === 0,
        favorite: j % 7 === 0,
        createdAt: Date.now() - j,
        updatedAt: Date.now() - j,
        completedAt: j % 4 === 0 ? Date.now() - j * 1000 : null
      })
    }
    const normalized = normalizeState(JSON.parse(JSON.stringify(state)))
    assert.equal(normalized.items.length, 25)
    const progress = progressFor(normalized.items)
    assert.equal(progress.done + progress.open, 25)
    const sorted = sortItems(normalized.items)
    let seenDone = false
    for (const item of sorted) {
      if (item.done) seenDone = true
      if (seenDone) assert.equal(item.done, true)
    }
    assert.equal(Object.values(categoryCounts(normalized.items)).reduce((a, b) => a + b, 0), 25)
    assert.equal(weeklyStats(normalized.items).length, 7)
  }
})
