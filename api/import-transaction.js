const crypto = require('node:crypto')

const MAX_AMOUNT = 1000000
const ALLOWED_TYPES = new Set(['expense', 'income'])
const CATEGORY_RULES = [
  [/\b(billa|spar|hofer|lidl|penny|interspar|merkur|adeg)\b/i, 'Lebensmittel'],
  [/\b(netflix|spotify|disney|youtube|amazon prime|dazn|sky)\b/i, 'Abos & Verträge'],
  [/\b(shell|omv|eni|bp|jet|avanti|tankstelle)\b/i, 'Mobilität'],
  [/\b(ikea|mömax|xxxlutz|obi|hornbach|bauhaus)\b/i, 'Haushalt'],
  [/\b(apotheke|dm|bipa|müller)\b/i, 'Gesundheit'],
  [/\b(h&m|zara|zalando|amazon|mediamarkt|saturn)\b/i, 'Shopping'],
  [/\b(miete|immobilien|hausverwaltung)\b/i, 'Wohnen']
]

function json(res, status, body) {
  res.status(status)
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  return res.json(body)
}

function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body
  if (typeof req.body === 'string' && req.body.trim()) {
    try { return JSON.parse(req.body) } catch { return null }
  }
  return req.body == null ? {} : null
}

function cleanText(value, max = 180) {
  return String(value == null ? '' : value).replace(/\s+/g, ' ').trim().slice(0, max)
}

function normalizeDate(value) {
  const raw = cleanText(value, 64)
  if (!raw) return new Date().toISOString().slice(0, 10)
  const parsed = new Date(raw)
  if (!Number.isFinite(parsed.getTime())) return null
  return parsed.toISOString().slice(0, 10)
}

function inferCategory(title, requested) {
  const explicit = cleanText(requested, 50)
  if (explicit) return explicit
  for (const [pattern, category] of CATEGORY_RULES) if (pattern.test(title)) return category
  return 'Sonstiges'
}

function stableImportId(input) {
  const supplied = cleanText(input.transactionId || input.idempotencyKey, 120)
  if (supplied) return `imp_${crypto.createHash('sha256').update(supplied).digest('hex').slice(0, 24)}`
  const occurredAt = cleanText(input.occurredAt || input.timestamp || input.date, 64)
  const canonical = [input.type, input.amount, input.title, occurredAt, input.note].join('|')
  return `imp_${crypto.createHash('sha256').update(canonical).digest('hex').slice(0, 24)}`
}

function encodePayload(payload) {
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url')
}

function appOrigin(req) {
  const proto = cleanText(req.headers['x-forwarded-proto'] || 'https', 10).split(',')[0]
  const host = cleanText(req.headers['x-forwarded-host'] || req.headers.host, 200).split(',')[0]
  return host ? `${proto}://${host}` : ''
}

module.exports = function handler(req, res) {
  if (req.method === 'GET') {
    return json(res, 200, {
      ok: true,
      endpoint: '/api/import-transaction',
      method: 'POST',
      auth: 'Authorization: Bearer <SELFMADE_IMPORT_TOKEN>'
    })
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST')
    return json(res, 405, { ok: false, error: 'method_not_allowed' })
  }

  const secret = process.env.SELFMADE_IMPORT_TOKEN
  if (!secret) return json(res, 503, { ok: false, error: 'import_not_configured' })

  const authorization = cleanText(req.headers.authorization, 500)
  const expected = `Bearer ${secret}`
  const authBuffer = Buffer.from(authorization)
  const expectedBuffer = Buffer.from(expected)
  const authenticated = authBuffer.length === expectedBuffer.length && crypto.timingSafeEqual(authBuffer, expectedBuffer)
  if (!authenticated) return json(res, 401, { ok: false, error: 'unauthorized' })

  const body = readBody(req)
  if (!body) return json(res, 400, { ok: false, error: 'invalid_json' })

  const amount = Number(body.amount)
  if (!Number.isFinite(amount) || amount <= 0 || amount > MAX_AMOUNT) {
    return json(res, 400, { ok: false, error: 'invalid_amount' })
  }

  const type = ALLOWED_TYPES.has(body.type) ? body.type : 'expense'
  const title = cleanText(body.merchant || body.title || body.description, 80)
  if (!title) return json(res, 400, { ok: false, error: 'missing_merchant' })

  const date = normalizeDate(body.occurredAt || body.timestamp || body.date)
  if (!date) return json(res, 400, { ok: false, error: 'invalid_date' })

  const note = cleanText(body.note || (body.source ? `Import: ${body.source}` : 'Apple Wallet Import'), 180)
  const category = inferCategory(title, body.category)
  const id = stableImportId({
    transactionId: body.transactionId,
    idempotencyKey: req.headers['x-idempotency-key'],
    occurredAt: body.occurredAt || body.timestamp || body.date,
    type,
    amount: Math.round(amount * 100) / 100,
    title,
    note
  })

  const transaction = {
    id,
    type,
    amount: Math.round(amount * 100) / 100,
    title,
    category,
    date,
    note,
    createdAt: Date.now()
  }

  const token = encodePayload({ version: 1, transaction })
  const origin = appOrigin(req)
  const importUrl = `${origin || ''}/?nestImport=${encodeURIComponent(token)}`

  return json(res, 200, { ok: true, importUrl, transaction })
}

module.exports._test = { cleanText, normalizeDate, inferCategory, stableImportId, encodePayload }
