import assert from 'node:assert/strict'
import { readFile, writeFile } from 'node:fs/promises'
import { randomBytes } from 'node:crypto'
import { hashPassword } from '../src/auth.js'
import { createDatabase } from '../src/database.js'

const databaseUrl = process.env.DATABASE_URL
assert.ok(databaseUrl?.startsWith('sqlserver://localhost:14339;database=ReplateLocal;'), 'Restricted to ReplateLocal on localhost:14339.')
const input = JSON.parse(await readFile(process.argv[2] ?? '../AI/artifacts/demo-data.json', 'utf8')) as {
  menus: { name: string; synthetic: boolean; records: { productionDate: string; producedQuantity: number; soldQuantity: number; surplusQuantity: number }[] }[]
}
assert.equal(input.menus.length, 2)
for (const menu of input.menus) {
  assert.equal(menu.synthetic, true)
  assert.equal(menu.records.length, 90)
  for (const row of menu.records) {
    assert.match(row.productionDate, /^\d{4}-\d{2}-\d{2}$/)
    assert.ok([row.producedQuantity, row.soldQuantity, row.surplusQuantity].every(n => Number.isInteger(n) && n >= 0 && n <= 100000))
    assert.equal(row.soldQuantity + row.surplusQuantity, row.producedQuantity)
  }
}
const { prisma } = createDatabase(databaseUrl)
try {
  const email = 'analytics-demo@replate.test'
  let owner = await prisma.user.findUnique({ where: { email } })
  if (!owner) {
    const password = randomBytes(18).toString('base64url')
    owner = await prisma.user.create({ data: { email, name: 'Demo Analitik', role: 'RestaurantOwner', passwordHash: await hashPassword(password) } })
    await writeFile('.env.ai-demo-account', `DEMO_EMAIL=${email}\nDEMO_PASSWORD=${password}\n`, { mode: 0o600, flag: 'wx' })
  }
  assert.equal(owner.role, 'RestaurantOwner')
  const restaurant = await prisma.restaurant.findFirst({ where: { ownerId: owner.userId, name: '[DEMO SINTETIS] Dapur Analitik' } })
    ?? await prisma.restaurant.create({ data: { ownerId: owner.userId, name: '[DEMO SINTETIS] Dapur Analitik', address: 'Lingkungan demo lokal', phone: '000000000000', tagsJson: '["synthetic-demo"]', isOpen: false, description: 'Riwayat sintetis untuk demo portofolio. Bukan data bisnis nyata.' } })
  const menuIds: number[] = []
  for (const menu of input.menus) {
    const saved = await prisma.menu.findFirst({ where: { restaurantId: restaurant.restaurantId, name: menu.name } })
      ?? await prisma.menu.create({ data: { restaurantId: restaurant.restaurantId, name: menu.name, description: 'Menu sintetis untuk evaluasi pipeline.', normalPrice: 25000 } })
    menuIds.push(saved.menuId)
    for (const row of menu.records) {
      const productionDate = new Date(`${row.productionDate}T00:00:00Z`)
      await prisma.productionRecord.upsert({ where: { menuId_productionDate: { menuId: saved.menuId, productionDate } },
        update: {}, create: { ...row, productionDate, menuId: saved.menuId } })
    }
  }
  console.log(JSON.stringify({ restaurantId: restaurant.restaurantId, menuIds, synthetic: true, note: 'Credentials in ignored backend/.env.ai-demo-account; reruns preserve existing history.' }))
} finally { await prisma.$disconnect() }
