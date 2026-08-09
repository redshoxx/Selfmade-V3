const assert = require('node:assert/strict')
const api = require('./api/import-transaction.js')._test

assert.equal(api.inferCategory('BILLA Kalsdorf'), 'Lebensmittel')
assert.equal(api.inferCategory('Netflix.com'), 'Abos & Verträge')
assert.equal(api.normalizeDate('2026-08-08T17:41:00+02:00'), '2026-08-08')
assert.equal(api.normalizeDate('2026-08-09T00:15:00+02:00'), '2026-08-09', 'Lokales Wallet-Datum darf nicht durch UTC auf den Vortag rutschen')
assert.equal(api.normalizeDate('2026-02-30T10:00:00+01:00'), null)
assert.equal(api.validCalendarDate(2026, 8, 9), true)

const id1 = api.stableImportId({ transactionId: 'wallet-abc' })
const id2 = api.stableImportId({ transactionId: 'wallet-abc' })
assert.equal(id1, id2)
assert.ok(id1.startsWith('imp_'))

const encoded = api.encodePayload({ version: 1, transaction: { id: id1 } })
assert.ok(encoded.length > 10)

console.log('Wallet Import: Endpoint- und Zeitzonen-Tests bestanden.')
