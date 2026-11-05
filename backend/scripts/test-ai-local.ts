import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { once } from 'node:events'
import { createApp } from '../src/app.js'
import { createDatabase } from '../src/database.js'
import { createToken } from '../src/auth.js'

const databaseUrl = process.env.DATABASE_URL
assert.ok(databaseUrl?.startsWith('sqlserver://localhost:14339;database=ReplateLocal;'), 'Restricted to local demo DB.')
const db = createDatabase(databaseUrl)
const key = randomBytes(32).toString('hex')
const jwt = { secret: randomBytes(32).toString('hex'), issuer: 'local-ai-test', audience: 'local-ai-test', expiresMinutes: 5 }
const app = createApp({ users: db.users, recommendations: db.recommendations, aiServiceKey: key, jwt, frontendUrl: 'http://localhost:3000' })
const server = app.listen(0, '127.0.0.1')
try {
  await once(server, 'listening')
  const address = server.address()
  assert.ok(address && typeof address !== 'string')
  const base = `http://127.0.0.1:${address.port}`
  const owner = await db.prisma.user.findUniqueOrThrow({ where: { email: 'analytics-demo@replate.test' } })
  const restaurant = await db.prisma.restaurant.findFirstOrThrow({ where: { ownerId: owner.userId, name: '[DEMO SINTETIS] Dapur Analitik' } })
  const targetDate = process.env.AI_TEST_DATE ?? '2026-11-04'
  const run = async () => {
    await promisify(execFile)(process.env.AI_PYTHON ?? '../AI/.venv/bin/python', ['../AI/recommend.py', '--target-date', targetDate, '--report', '../AI/artifacts/evaluation-api.json'],
      { env: { ...process.env, AI_API_URL: base, AI_SERVICE_KEY: key }, timeout: 120000 })
  }
  await run()
  const rows = async () => db.prisma.productionRecommendation.findMany({ where: { targetDate: new Date(`${targetDate}T00:00:00Z`), menu: { restaurantId: restaurant.restaurantId } }, orderBy: { menuId: 'asc' } })
  const first = await rows()
  assert.equal(first.length, 2)
  assert.ok(first.every(row => row.insight.includes('Data demo sintetis.') && row.recommendedQuantity === Math.ceil(row.predictedDemand.toNumber())))
  await run()
  const second = await rows()
  assert.deepEqual(second.map(row => row.productionRecommendationId), first.map(row => row.productionRecommendationId))
  const token = createToken({ ...owner, role: 'RestaurantOwner' }, jwt).token
  const dashboard = await fetch(`${base}/api/owner/restaurants/${restaurant.restaurantId}/recommendations?date=${targetDate}`, { headers: { Authorization: `Bearer ${token}` } })
  assert.equal(dashboard.status, 200)
  const data = await dashboard.json() as { synthetic: boolean; menus: { recommendation: unknown; records: unknown[] }[] }
  assert.equal(data.synthetic, true)
  assert.ok(data.menus.every(menu => menu.recommendation && menu.records.length === 90))
  const stranger = createToken({ ...owner, userId: owner.userId + 100000, role: 'RestaurantOwner' }, jwt).token
  assert.equal((await fetch(`${base}/api/owner/restaurants/${restaurant.restaurantId}/recommendations?date=${targetDate}`, { headers: { Authorization: `Bearer ${stranger}` } })).status, 404)
  assert.equal((await fetch(`${base}/api/internal/ai/training-data?targetDate=${targetDate}`)).status, 401)
  console.log(JSON.stringify({ synthetic: true, persistedMenus: first.length, repeatedRunPreservedIds: true, ownerIsolation: true, targetDate }))
} finally {
  await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()))
  await db.prisma.$disconnect()
}
