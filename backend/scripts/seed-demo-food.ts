import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { copyFile, mkdir } from 'node:fs/promises'
import path from 'node:path'
import { hashPassword } from '../src/auth.js'
import { createDatabase } from '../src/database.js'

const databaseUrl = process.env.DATABASE_URL
assert.ok(databaseUrl?.startsWith('sqlserver://localhost:14339;database=ReplateLocal;'), 'Demo food is restricted to ReplateLocal on localhost:14339.')
const uploadDir = path.resolve(process.env.MENU_UPLOAD_DIR ?? 'menu-uploads')

const restaurants = [
  { name: 'Dapur Hijau · Demo', address: 'Area demo, Yogyakarta', menus: [
    { name: 'Nasi Ayam Panggang', description: 'Nasi dengan ayam panggang, sayuran, dan sambal terpisah. Data makanan untuk demo lokal.', category: 'Meals', normalPrice:35000, rescuePrice:17500, quantity:8, image:'chicken', allergens:[], dietTags:[] },
    { name: 'Salad Sayur Segar', description: 'Sayuran segar dengan dressing terpisah. Data makanan untuk demo lokal.', category:'Meals', normalPrice:30000, rescuePrice:18000, quantity:6, image:'veggie', allergens:[], dietTags:['Vegetarian'] },
  ] },
  { name: 'Roti Sore · Demo', address: 'Area demo, Sleman', menus: [
    { name:'Butter Croissant', description:'Croissant berlapis dengan aroma mentega. Data makanan untuk demo lokal.', category:'Bakery', normalPrice:24000, rescuePrice:12000, quantity:10, image:'pastry', allergens:['Gluten', 'Susu'], dietTags:[] },
    { name:'Paket Pastry Sore', description:'Paket pastry untuk dinikmati bersama. Data makanan untuk demo lokal.', category:'Bakery', normalPrice:50000, rescuePrice:25000, quantity:4, image:'pastry', allergens:['Gluten', 'Susu', 'Telur'], dietTags:[] },
  ] },
  { name: 'Kopi Sore · Demo', address:'Area demo, Bantul', menus:[
    { name:'Kopi Susu', description:'Kopi dengan susu, disiapkan saat pickup. Data makanan untuk demo lokal.', category:'Lainnya', normalPrice:24000, rescuePrice:14000, quantity:7, image:'coffee', allergens:['Susu'], dietTags:[] },
    { name:'Paket Kopi Berdua', description:'Dua porsi kopi untuk teman soremu. Data makanan untuk demo lokal.', category:'Lainnya', normalPrice:48000, rescuePrice:26000, quantity:3, image:'coffee', allergens:['Susu'], dietTags:[] },
  ] },
]
const now = new Date()
const date = new Intl.DateTimeFormat('en-CA', { timeZone:'Asia/Jakarta', year:'numeric', month:'2-digit', day:'2-digit' }).format(now)
const productionDate = new Date(`${date}T00:00:00Z`)
const pickupStart = new Date(now.getTime() + 24 * 60 * 60_000)
const pickupEnd = new Date(pickupStart.getTime() + 2 * 60 * 60_000)
const passwordHash = await hashPassword(randomBytes(32).toString('hex'))
const { prisma, marketplace } = createDatabase(databaseUrl)

try {
  const owner = await prisma.user.upsert({ where:{email:'mock-food@replate.test'}, update:{}, create:{name:'Pemilik Makanan Demo', email:'mock-food@replate.test', passwordHash, role:'RestaurantOwner'} })
  assert.equal(owner.role, 'RestaurantOwner')
  await mkdir(uploadDir, { recursive: true })
  const images = ['chicken', 'veggie', 'pastry', 'coffee']
  for (const [index, image] of images.entries()) {
    await copyFile(`../frontend/public/menu/${image}.jpg`, path.join(uploadDir, `${owner.userId}-de00000${index}.jpg`))
  }
  const ids = await prisma.$transaction(async (tx) => {
    const result: number[] = []
    for (const restaurant of restaurants) {
      const saved = await tx.restaurant.findFirst({where:{ownerId:owner.userId, name:restaurant.name}}) ?? await tx.restaurant.create({data:{ownerId:owner.userId, name:restaurant.name, address:restaurant.address, phone:'000000000000', description:'Restoran fiktif untuk pengujian lokal Replate.', pickupDirections:'Data demo: pengambilan disimulasikan di kasir.', isOpen:true}})
      for (const food of restaurant.menus) {
        assert.ok(food.rescuePrice < food.normalPrice && food.quantity > 0)
        const photoUrl = `/menu-uploads/${owner.userId}-de00000${images.indexOf(food.image)}.jpg`
        const menu = await tx.menu.findFirst({where:{restaurantId:saved.restaurantId, name:food.name}}) ?? await tx.menu.create({data:{restaurantId:saved.restaurantId, name:food.name, description:food.description, category:food.category, normalPrice:food.normalPrice, allergensJson:JSON.stringify(food.allergens), dietTagsJson:JSON.stringify(food.dietTags)}})
        await tx.menuPhoto.upsert({where:{menuId_sortOrder:{menuId:menu.menuId, sortOrder:0}}, update:{url:photoUrl}, create:{menuId:menu.menuId, sortOrder:0, url:photoUrl}})
        const production = await tx.productionRecord.upsert({where:{menuId_productionDate:{menuId:menu.menuId, productionDate}}, update:{}, create:{menuId:menu.menuId, productionDate, producedQuantity:food.quantity + 12, soldQuantity:12, surplusQuantity:food.quantity}})
        const listing = await tx.surplusListing.findFirst({where:{productionRecordId:production.productionRecordId}}) ?? await tx.surplusListing.create({data:{productionRecordId:production.productionRecordId, rescuePrice:food.rescuePrice, initialQuantity:food.quantity, availableQuantity:food.quantity, pickupStart, pickupEnd, status:'Active', pickupInstructions:'Listing demo lokal, bukan penawaran restoran sebenarnya.'}})
        result.push(listing.surplusListingId)
      }
    }
    assert.equal(new Set(result).size, 6)
    return result
  }, { timeout:20_000 })
  const visible = (await marketplace.listListings({}, new Date())).filter((item) => ids.includes(item.surplusListingId))
  console.log(JSON.stringify({database:'ReplateLocal', listingIds:ids, visibleListings:visible.length, pickupStart:visible[0]?.pickupStart, pickupEnd:visible[0]?.pickupEnd, note:'Existing demo listings and order stock are preserved on rerun.'}, null, 2))
} finally { await prisma.$disconnect() }
