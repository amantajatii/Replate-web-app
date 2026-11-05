import jwt from 'jsonwebtoken'
import request from 'supertest'
import { expect, it, vi } from 'vitest'
import { createApp } from './app.js'
import type { RecommendationStore } from './ai-recommendations.js'

const config = { secret: 'test-secret-is-at-least-thirty-two-characters', issuer: 'Replate.Api', audience: 'Replate.Client', expiresMinutes: 60 }
const key = 'internal-test-key-at-least-thirty-two-characters'
const token = (id: number, role = 'RestaurantOwner') => `Bearer ${jwt.sign({ role }, config.secret, { subject: String(id), issuer: config.issuer, audience: config.audience })}`
function fixture(serviceKey: string | undefined = key) {
  const store: RecommendationStore = {
    training: vi.fn(async () => []), save: vi.fn(async () => true),
    dashboard: vi.fn(async (ownerId, restaurantId) => ownerId === restaurantId ? { menus: [] } : null),
  }
  const app = createApp({ users: { findByEmail: async () => null, create: async () => { throw new Error('unused') } },
    jwt: config, frontendUrl: 'http://localhost:3000', recommendations: store,
    ...(serviceKey ? { aiServiceKey: serviceKey } : {}) })
  return { app, store }
}
const input = { menuId: 1, targetDate: '2026-11-04', predictedDemand: 20.25, recommendedQuantity: 21, modelVersion: 'weekday-v1', insight: 'Test evaluation.' }
it('requires the private service key; owner tokens do not grant batch access', async () => {
  const { app, store } = fixture()
  await request(app).get('/api/internal/ai/training-data?targetDate=2026-11-04').set('Authorization', token(1)).expect(401)
  await request(app).post('/api/internal/ai/recommendations').set('X-AI-Key', 'wrong').send(input).expect(401)
  expect(store.save).not.toHaveBeenCalled()
  await request(fixture('').app).get('/api/internal/ai/training-data?targetDate=2026-11-04').expect(503)
})
it('validates calendar dates, pagination, finite quantities and rounding before writes', async () => {
  const { app, store } = fixture()
  for (const date of ['2026-02-30', 'garbage']) {
    await request(app).get(`/api/internal/ai/training-data?targetDate=${date}`).set('X-AI-Key', key).expect(400)
  }
  await request(app).get('/api/internal/ai/training-data?targetDate=2026-11-04&afterMenuId=-1').set('X-AI-Key', key).expect(400)
  for (const change of [{ recommendedQuantity: 20 }, { predictedDemand: -1 }, { predictedDemand: null }, { menuId: 0 }, { insight: 'x'.repeat(1001) }]) {
    await request(app).post('/api/internal/ai/recommendations').set('X-AI-Key', key).send({ ...input, ...change }).expect(400)
  }
  expect(store.save).not.toHaveBeenCalled()
  await request(app).post('/api/internal/ai/recommendations').set('X-AI-Key', key).send(input).expect(200)
  expect(store.save).toHaveBeenCalledWith(input)
  vi.mocked(store.save).mockResolvedValue(false)
  await request(app).post('/api/internal/ai/recommendations').set('X-AI-Key', key).send(input).expect(404)
})
it('bounds training pagination and scopes dashboard reads to the signed in owner', async () => {
  const { app, store } = fixture()
  await request(app).get('/api/internal/ai/training-data?targetDate=2026-11-04&afterMenuId=50').set('X-AI-Key', key).expect(200, { menus: [], nextMenuId: null })
  expect(store.training).toHaveBeenCalledWith('2026-11-04', 50)
  const path = '/api/owner/restaurants/1/recommendations?date=2026-11-04'
  await request(app).get(path).expect(401)
  await request(app).get(path).set('Authorization', token(1, 'Customer')).expect(403)
  await request(app).get(path).set('Authorization', token(2)).expect(404)
  await request(app).get(path).set('Authorization', token(1)).expect(200)
  expect(store.dashboard).toHaveBeenLastCalledWith(1, 1, '2026-11-04')
})
