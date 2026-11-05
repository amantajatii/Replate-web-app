import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import jwt from 'jsonwebtoken'
import request from 'supertest'
import { expect, it, onTestFinished } from 'vitest'
import { createApp, type UserStore } from './app.js'
import type {
  MenuRecord,
  MenuStore,
  ProductionRecord,
} from './menu-production.js'

const config = {
  secret: 'test-only-key-that-is-at-least-32-characters-long',
  issuer: 'Replate.Api',
  audience: 'Replate.Client',
  expiresMinutes: 60,
}
const users: UserStore = {
  findByEmail: async () => null,
  create: async () => {
    throw new Error('unused')
  },
}
const auth = (id: number) =>
  `Bearer ${jwt.sign({ role: 'RestaurantOwner' }, config.secret, { subject: String(id), issuer: config.issuer, audience: config.audience })}`

it('scopes menu writes to the owner and rejects surplus beyond production', async () => {
  const uploadDir = await mkdtemp(path.join(tmpdir(), 'replate-menu-test-'))
  onTestFinished(() => rm(uploadDir, { recursive: true, force: true }))
  const menus: MenuRecord[] = []
  const records: ProductionRecord[] = []
  const store: MenuStore = {
    list: async (ownerId, restaurantId) =>
      ownerId === restaurantId
        ? menus.filter((menu) => menu.restaurantId === restaurantId)
        : null,
    create: async (ownerId, restaurantId, input) => {
      if (ownerId !== restaurantId) return null
      const menu = {
        ...input,
        menuId: menus.length + 1,
        restaurantId,
        createdAt: new Date(),
      }
      menus.push(menu)
      return menu
    },
    update: async (ownerId, menuId, input) => {
      const menu = menus.find(
        (item) => item.menuId === menuId && item.restaurantId === ownerId,
      )
      if (!menu) return null
      Object.assign(menu, input)
      return menu
    },
    production: async (ownerId, restaurantId) =>
      ownerId === restaurantId ? records : null,
    productionHistory: async (ownerId, restaurantId, filters) =>
      ownerId === restaurantId
        ? records.filter((r) => (!filters.menuId || r.menuId === filters.menuId) && (!filters.from || r.productionDate >= filters.from) && (!filters.to || r.productionDate <= filters.to))
        : null,
    upsertProduction: async (ownerId, menuId, date, input) => {
      if (
        !menus.some(
          (menu) => menu.menuId === menuId && menu.restaurantId === ownerId,
        )
      )
        return null
      if (records.length && input.surplusQuantity < 2) return 'invalid'
      const record = {
        ...input,
        productionRecordId: 1,
        menuId,
        productionDate: date,
        recordedAt: new Date(),
      }
      records.push(record)
      return record
    },
    gallery: async () => [],
  }
  const app = createApp({
    users,
    jwt: config,
    frontendUrl: 'http://localhost:3000',
    menus: store,
    menuUploadDir: uploadDir,
  })
  const data = {
    name: 'Veggie Bowl',
    description: 'Nasi dan sayuran',
    category: 'Salad',
    normalPrice: 35000,
    allergens: [],
    dietTags: ['Vegetarian'],
    allergenNote: null,
    isActive: true,
    photos: [],
  }
  expect(
    (
      await request(app)
        .post('/api/owner/restaurants/2/menus')
        .set('Authorization', auth(1))
        .send(data)
    ).status,
  ).toBe(404)
  const created = await request(app)
    .post('/api/owner/restaurants/1/menus')
    .set('Authorization', auth(1))
    .send(data)
  expect(created.status).toBe(201)
  expect(
    (
      await request(app)
        .patch('/api/owner/menus/1')
        .set('Authorization', auth(2))
        .send({ name: 'Stolen' })
    ).status,
  ).toBe(404)
  expect(menus[0]?.name).toBe('Veggie Bowl')
  expect(
    (
      await request(app)
        .put('/api/owner/menus/1/production/2026-09-24')
        .set('Authorization', auth(1))
        .send({ producedQuantity: 10, soldQuantity: 8, surplusQuantity: 3 })
    ).status,
  ).toBe(400)
  expect(
    (
      await request(app)
        .put('/api/owner/menus/1/production/2026-09-24')
        .set('Authorization', auth(2))
        .send({ producedQuantity: 10, soldQuantity: 8, surplusQuantity: 2 })
    ).status,
  ).toBe(404)
  expect(
    (
      await request(app)
        .put('/api/owner/menus/1/production/2026-09-24')
        .set('Authorization', auth(1))
        .send({ producedQuantity: 10, soldQuantity: 8, surplusQuantity: 2 })
    ).status,
  ).toBe(200)
  expect(records).toHaveLength(1)
  expect(
    (
      await request(app)
        .put('/api/owner/menus/1/production/2026-09-24')
        .set('Authorization', auth(1))
        .send({ producedQuantity: 10, soldQuantity: 9, surplusQuantity: 1 })
    ).status,
  ).toBe(400)

  for (const input of [
    { producedQuantity: -1, soldQuantity: 0, surplusQuantity: 0 },
    { producedQuantity: 1.5, soldQuantity: 1, surplusQuantity: 0.5 },
    { producedQuantity: 10, soldQuantity: 5 },
  ]) {
    expect((await request(app).put('/api/owner/menus/1/production/2026-09-25')
      .set('Authorization', auth(1)).send(input)).status).toBe(400)
  }
  expect((await request(app).put('/api/owner/menus/1/production/2026-02-30')
    .set('Authorization', auth(1)).send({ producedQuantity: 10, soldQuantity: 8, surplusQuantity: 2 })).status).toBe(400)

  // Unaccounted production must not enter the AI dataset.
  expect((await request(app)
    .put('/api/owner/menus/1/production/2026-09-25')
    .set('Authorization', auth(1))
    .send({ producedQuantity: 10, soldQuantity: 5, surplusQuantity: 2 })).status).toBe(400)
  expect(records).toHaveLength(1)

  const historyPath = '/api/owner/restaurants/1/production/history'
  const history = await request(app).get(historyPath + '?from=2026-09-01&to=2026-09-30&menuId=1').set('Authorization', auth(1))
  expect(history.status).toBe(200)
  expect(history.body).toHaveLength(1)
  expect((await request(app).get(historyPath + '?menuId=2').set('Authorization', auth(1))).body).toEqual([])
  expect((await request(app).get(historyPath).set('Authorization', auth(2))).status).toBe(404)
  for (const query of ['?from=2026-02-30', '?from=2026-10-01&to=2026-09-01', '?menuId=0', '?from=bad', '?menuId=1&menuId=2']) {
    expect((await request(app).get(historyPath + query).set('Authorization', auth(1))).status).toBe(400)
  }
  expect((await request(app).get(historyPath)).status).toBe(401)

  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9uN1sAAAAASUVORK5CYII=',
    'base64',
  )
  expect(
    (await request(app).post('/api/owner/menu-media').set('Content-Type', 'image/png').send(png)).status,
  ).toBe(401)
  const uploaded = await request(app)
    .post('/api/owner/menu-media')
    .set('Authorization', auth(1))
    .set('Content-Type', 'image/png')
    .send(png)
  expect(uploaded.status).toBe(201)
  expect(uploaded.body.url).toMatch(/^\/menu-uploads\/1-[a-f0-9-]+\.png$/)
  const photo = await request(app).get(uploaded.body.url)
  expect(photo.body).toEqual(png)
  expect(photo.headers['cross-origin-resource-policy']).toBe('cross-origin')
  expect(
    (
      await request(app)
        .post('/api/owner/menu-media')
        .set('Authorization', auth(1))
        .set('Content-Type', 'image/png')
        .send(Buffer.from('not a png'))
    ).status,
  ).toBe(400)
  expect(
    (
      await request(app)
        .post('/api/owner/menu-media')
        .set('Authorization', auth(1))
        .set('Content-Type', 'image/png')
        .send(Buffer.concat([png, Buffer.alloc(5 * 1024 * 1024)]))
    ).status,
  ).toBe(413)
  expect(
    (
      await request(app)
        .post('/api/owner/restaurants/1/menus')
        .set('Authorization', auth(1))
        .send({ ...data, photos: [uploaded.body.url.replace('/1-', '/2-')] })
    ).status,
  ).toBe(400)
})
