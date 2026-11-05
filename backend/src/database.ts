import type { RecommendationStore } from './ai-recommendations.js'
import { PrismaMssql } from '@prisma/adapter-mssql'
import { timingSafeEqual } from 'node:crypto'
import { DuplicateEmailError, type NewUser, type PasswordResetStore, type UserStore } from './app.js'
import { Prisma, PrismaClient } from './generated/prisma/client.js'
import type { ProfileChanges, RestaurantRecord, RestaurantStore } from './restaurant.js'
import { createPickupCode, type CustomerOrder, type MarketplaceListing, type MarketplaceStore, type OwnerOrder } from './marketplace.js'

function restaurantData(input: ProfileChanges): Prisma.RestaurantUncheckedUpdateManyInput {
  const { tags, ...fields } = input
  const data = Object.fromEntries(Object.entries(fields).filter(([, value]) => value !== undefined)) as Prisma.RestaurantUncheckedUpdateManyInput
  if (tags !== undefined) data.tagsJson = JSON.stringify(tags)
  return data
}

function restaurantRecord(record: Awaited<ReturnType<PrismaClient['restaurant']['findUnique']>>): RestaurantRecord {
  if (!record) throw new Error('Restaurant not found after write.')
  const { tagsJson, latitude, longitude, ...fields } = record
  return {
    ...fields,
    tags: JSON.parse(tagsJson) as string[],
    latitude: latitude?.toNumber() ?? null,
    longitude: longitude?.toNumber() ?? null,
  }
}

import type { MenuChanges, MenuRecord, MenuStore, ProductionRecord } from './menu-production.js'
import type { ListingRecord, ListingStore } from './surplus-listing.js'

function menuData(input: MenuChanges): Prisma.MenuUncheckedUpdateInput {
  const { allergens, dietTags, photos, ...fields } = input
  const data = Object.fromEntries(Object.entries(fields).filter(([, value]) => value !== undefined)) as Prisma.MenuUncheckedUpdateInput
  if (allergens !== undefined) data.allergensJson = JSON.stringify(allergens)
  if (dietTags !== undefined) data.dietTagsJson = JSON.stringify(dietTags)
  if (photos !== undefined) data.photos = { deleteMany: {}, create: photos.map((url, sortOrder) => ({ url, sortOrder })) }
  return data
}

type MenuWithPhotos = Awaited<ReturnType<PrismaClient['menu']['findFirst']>> & { photos: { url: string; sortOrder: number }[] }
function menuRecord(menu: MenuWithPhotos): MenuRecord {
  const { allergensJson, dietTagsJson, normalPrice, photos, ...fields } = menu
  return { ...fields, normalPrice: normalPrice.toNumber(), allergens: JSON.parse(allergensJson) as string[],
    dietTags: JSON.parse(dietTagsJson) as string[], photos: photos.map((photo) => photo.url) }
}

function productionRecord(record: { productionRecordId: number; menuId: number; productionDate: Date; producedQuantity: number; soldQuantity: number; surplusQuantity: number; recordedAt: Date }): ProductionRecord {
  return { ...record, productionDate: record.productionDate.toISOString().slice(0, 10) }
}

type ListingWithMenu = Prisma.SurplusListingGetPayload<{ include: { productionRecord: { include: { menu: true } } } }>
function listingRecord(listing: ListingWithMenu): ListingRecord {
  const { productionRecord, rescuePrice, pickupStart, pickupEnd, ...fields } = listing
  return { ...fields, rescuePrice: rescuePrice.toNumber(), pickupStart: pickupStart.toISOString(),
    pickupEnd: pickupEnd.toISOString(), restaurantId: productionRecord.menu.restaurantId,
    menuId: productionRecord.menuId, menuName: productionRecord.menu.name,
    productionDate: productionRecord.productionDate.toISOString().slice(0, 10),
    normalPrice: productionRecord.menu.normalPrice.toNumber(),
    status: listing.status as ListingRecord['status'] }
}

const listingInclude = { productionRecord: { include: { menu: true } } } as const
const marketplaceListingInclude = {
  productionRecord: {
    include: {
      menu: {
        include: {
          photos: { orderBy: { sortOrder: 'asc' as const } },
          restaurant: true,
        },
      },
    },
  },
}
const orderInclude = {
  items: { include: { surplusListing: { include: marketplaceListingInclude } } },
  pickup: true,
}
const ownerOrderInclude = { ...orderInclude, customer: { select: { name: true } }, restaurant: { select: { name: true } } } as const

function marketplaceListing(record: Prisma.SurplusListingGetPayload<{ include: typeof marketplaceListingInclude }>): MarketplaceListing {
  const { productionRecord, ...listing } = record
  const { menu } = productionRecord
  const { photos, restaurant, allergensJson, dietTagsJson, normalPrice, ...menuFields } = menu
  const normal = normalPrice.toNumber()
  const rescue = listing.rescuePrice.toNumber()
  return {
    surplusListingId: listing.surplusListingId,
    menuId: menu.menuId,
    menuName: menu.name,
    description: menu.description,
    category: menu.category,
    normalPrice: normal,
    rescuePrice: rescue,
    discountPercent: normal > 0 ? Math.round((1 - rescue / normal) * 100) : 0,
    photos: photos.map((photo) => photo.url),
    allergens: JSON.parse(allergensJson) as string[],
    dietTags: JSON.parse(dietTagsJson) as string[],
    allergenNote: menuFields.allergenNote,
    restaurant: {
      restaurantId: restaurant.restaurantId,
      name: restaurant.name,
      address: restaurant.address,
      latitude: restaurant.latitude?.toNumber() ?? null,
      longitude: restaurant.longitude?.toNumber() ?? null,
      logoUrl: restaurant.logoUrl,
    },
    availableQuantity: listing.availableQuantity,
    pickupStart: listing.pickupStart.toISOString(),
    pickupEnd: listing.pickupEnd.toISOString(),
    pickupDirections: restaurant.pickupDirections,
  }
}

function customerOrder(record: Prisma.OrderGetPayload<{ include: typeof orderInclude }>): CustomerOrder {
  return {
    orderId: record.orderId,
    status: record.status,
    totalAmount: record.totalAmount.toNumber(),
    orderedAt: record.orderedAt.toISOString(),
    pickupCode: record.pickup?.pickupCode ?? null,
    estimatedPickupAt: record.pickup?.estimatedPickupAt.toISOString() ?? null,
    restaurantName: record.items[0]?.surplusListing.productionRecord.menu.restaurant.name ?? '',
    items: record.items.map((item) => ({
      photoUrl: item.surplusListing.productionRecord.menu.photos[0]?.url ?? null,
      menuName: item.surplusListing.productionRecord.menu.name,
      quantity: item.quantity,
      unitPrice: item.unitPrice.toNumber(),
      subtotal: item.subtotal.toNumber(),
    })),
  }
}

function ownerOrder(record: Prisma.OrderGetPayload<{ include: typeof ownerOrderInclude }>): OwnerOrder {
  return {
    ...customerOrder(record),
    pickupCode: null,
    customerName: record.customer.name,
    restaurantName: record.restaurant.name,
    pickupStatus: record.pickup?.status ?? null,
    verifiedAt: record.pickup?.verifiedAt?.toISOString() ?? null,
  }
}

class CheckoutUnavailable extends Error {}

export function createDatabase(databaseUrl: string) {
  const prisma = new PrismaClient({ adapter: new PrismaMssql(databaseUrl) })
  const users: UserStore = {
    async findByEmail(email) {
      const user = await prisma.user.findUnique({ where: { email } })
      return user ? { ...user, role: user.role as 'Customer' | 'RestaurantOwner' } : null
    },
    async create(input: NewUser) {
      try {
        const user = await prisma.user.create({ data: input })
        return { ...user, role: user.role as 'Customer' | 'RestaurantOwner' }
      } catch (error) {
        if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002') {
          throw new DuplicateEmailError()
        }
        throw error
      }
    },
  }
  const passwordResets: PasswordResetStore = {
    async create(userId, tokenHash, expiresAt) {
      await prisma.passwordResetToken.create({ data: { userId, tokenHash, expiresAt } })
    },
    async consume(tokenHash, passwordHash, now) {
      return prisma.$transaction(async (tx) => {
        const token = await tx.passwordResetToken.findUnique({ where: { tokenHash } })
        if (!token || token.usedAt || token.expiresAt <= now) return false
        const consumed = await tx.passwordResetToken.updateMany({
          where: { passwordResetTokenId: token.passwordResetTokenId, usedAt: null, expiresAt: { gt: now } },
          data: { usedAt: now },
        })
        if (consumed.count !== 1) return false
        await tx.user.update({ where: { userId: token.userId }, data: { passwordHash } })
        return true
      })
    },
  }
  const restaurants: RestaurantStore = {
    async list(ownerId) {
      const records = await prisma.restaurant.findMany({ where: { ownerId }, orderBy: { createdAt: 'asc' } })
      return records.map(restaurantRecord)
    },
    async create(ownerId, input) {
      const record = await prisma.restaurant.create({ data: { ...restaurantData(input), ownerId, name: input.name, address: input.address, phone: input.phone } as Prisma.RestaurantUncheckedCreateInput })
      return restaurantRecord(record)
    },
    async update(ownerId, restaurantId, input) {
      const changed = await prisma.restaurant.updateMany({
        where: { ownerId, restaurantId },
        data: restaurantData(input),
      })
      if (changed.count === 0) return null
      return restaurantRecord(await prisma.restaurant.findUnique({ where: { restaurantId } }))
    },
  }
  const menus: MenuStore = {
    async list(ownerId, restaurantId) {
      if (!await prisma.restaurant.findFirst({ where: { restaurantId, ownerId }, select: { restaurantId: true } })) return null
      const records = await prisma.menu.findMany({ where: { restaurantId }, include: { photos: { orderBy: { sortOrder: 'asc' } } }, orderBy: { createdAt: 'desc' } })
      return records.map(menuRecord)
    },
    async create(ownerId, restaurantId, input) {
      if (!await prisma.restaurant.findFirst({ where: { restaurantId, ownerId }, select: { restaurantId: true } })) return null
      const { photos, allergens, dietTags, ...fields } = input
      const record = await prisma.menu.create({ data: { ...fields, restaurantId,
        allergensJson: JSON.stringify(allergens), dietTagsJson: JSON.stringify(dietTags),
        photos: { create: photos.map((url, sortOrder) => ({ url, sortOrder })) } },
      include: { photos: { orderBy: { sortOrder: 'asc' } } } })
      return menuRecord(record)
    },
    async update(ownerId, menuId, input) {
      return prisma.$transaction(async (tx) => {
        const current = await tx.menu.findFirst({ where: { menuId, restaurant: { ownerId } }, select: { menuId: true } })
        if (!current) return null
        const record = await tx.menu.update({ where: { menuId }, data: menuData(input), include: { photos: { orderBy: { sortOrder: 'asc' } } } })
        return menuRecord(record)
      })
    },
    async production(ownerId, restaurantId, date) {
      if (!await prisma.restaurant.findFirst({ where: { restaurantId, ownerId }, select: { restaurantId: true } })) return null
      const records = await prisma.productionRecord.findMany({ where: { menu: { restaurantId }, productionDate: new Date(`${date}T00:00:00.000Z`) } })
      return records.map(productionRecord)
    },
    async productionHistory(ownerId, restaurantId, filters) {
      if (!await prisma.restaurant.findFirst({ where: { restaurantId, ownerId }, select: { restaurantId: true } })) return null
      const records = await prisma.productionRecord.findMany({
        where: { menu: { restaurantId },
          ...(filters.menuId ? { menuId: filters.menuId } : {}),
          productionDate: {
            ...(filters.from ? { gte: new Date(`${filters.from}T00:00:00.000Z`) } : {}),
            ...(filters.to ? { lte: new Date(`${filters.to}T00:00:00.000Z`) } : {}),
          },
        }, orderBy: [{ productionDate: 'desc' }, { productionRecordId: 'desc' }],
      })
      return records.map(productionRecord)
    },
    async upsertProduction(ownerId, menuId, date, input) {
      return prisma.$transaction(async (tx) => {
        if (!await tx.menu.findFirst({ where: { menuId, restaurant: { ownerId } }, select: { menuId: true } })) return null
        const productionDate = new Date(`${date}T00:00:00.000Z`)
        const existing = await tx.productionRecord.findUnique({ where: { menuId_productionDate: { menuId, productionDate } }, select: { productionRecordId: true } })
        if (existing) {
          const listings = await tx.surplusListing.findMany({ where: { productionRecordId: existing.productionRecordId }, select: { initialQuantity: true, availableQuantity: true, status: true } })
          const reserved = listings.reduce((total, row) => total + (row.status === 'Active' ? row.initialQuantity : row.initialQuantity - row.availableQuantity), 0)
          if (input.surplusQuantity < reserved) return 'invalid'
        }
        const record = await tx.productionRecord.upsert({ where: { menuId_productionDate: { menuId, productionDate } },
          create: { menuId, productionDate, ...input }, update: input })
        return productionRecord(record)
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
    },
    async gallery(ownerId) {
      const photos = await prisma.menuPhoto.findMany({ where: { menu: { restaurant: { ownerId } } }, select: { url: true }, distinct: ['url'] })
      return photos.map((photo) => photo.url)
    },
  }
  const listings: ListingStore = {
    async list(ownerId, restaurantId) {
      if (!await prisma.restaurant.findFirst({ where: { restaurantId, ownerId }, select: { restaurantId: true } })) return null
      const rows = await prisma.surplusListing.findMany({ where: { productionRecord: { menu: { restaurantId } } }, include: listingInclude, orderBy: { createdAt: 'desc' } })
      return rows.map(listingRecord)
    },
    async get(ownerId, listingId) {
      const row = await prisma.surplusListing.findFirst({ where: { surplusListingId: listingId, productionRecord: { menu: { restaurant: { ownerId } } } }, include: listingInclude })
      return row ? listingRecord(row) : null
    },
    async create(ownerId, restaurantId, input) {
      return prisma.$transaction(async (tx) => {
        const production = await tx.productionRecord.findFirst({
          where: { productionRecordId: input.productionRecordId, menu: { restaurant: { restaurantId, ownerId }, isActive: true } },
          select: { surplusQuantity: true, menu: { select: { normalPrice: true } } },
        })
        if (!production) return null
        if (input.rescuePrice >= production.menu.normalPrice.toNumber()) return 'invalid'
        const existing = await tx.surplusListing.findMany({ where: { productionRecordId: input.productionRecordId }, select: { initialQuantity: true, availableQuantity: true, status: true } })
        const reserved = existing.reduce((total, row) => total + (row.status === 'Active' ? row.initialQuantity : row.initialQuantity - row.availableQuantity), 0)
        if (input.status !== 'Draft' && reserved + input.initialQuantity > production.surplusQuantity) return 'invalid'
        const row = await tx.surplusListing.create({ data: {
          productionRecordId: input.productionRecordId, rescuePrice: input.rescuePrice,
          initialQuantity: input.initialQuantity, availableQuantity: input.initialQuantity,
          pickupStart: new Date(input.pickupStart), pickupEnd: new Date(input.pickupEnd),
          pickupInstructions: input.pickupInstructions ?? null, status: input.status ?? 'Active',
        }, include: listingInclude })
        return listingRecord(row)
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
    },
    async update(ownerId, listingId, input) {
      return prisma.$transaction(async (tx) => {
        const current = await tx.surplusListing.findFirst({ where: { surplusListingId: listingId, productionRecord: { menu: { restaurant: { ownerId } } } }, include: listingInclude })
        if (!current) return null
        if (current.status === 'Closed') return 'invalid'
        if ((input.rescuePrice ?? current.rescuePrice.toNumber()) >= current.productionRecord.menu.normalPrice.toNumber()) return 'invalid'
        const sold = current.initialQuantity - current.availableQuantity
        if (sold > 0 && (input.pickupStart !== undefined || input.pickupEnd !== undefined)) return 'invalid'
        const initialQuantity = input.initialQuantity ?? current.initialQuantity
        if (initialQuantity < sold) return 'invalid'
        const start = input.pickupStart ?? current.pickupStart.toISOString()
        const end = input.pickupEnd ?? current.pickupEnd.toISOString()
        if (new Date(start).getTime() <= Date.now() || new Date(end).getTime() <= new Date(start).getTime()) return 'invalid'
        const siblings = await tx.surplusListing.findMany({ where: { productionRecordId: current.productionRecordId, surplusListingId: { not: listingId } }, select: { initialQuantity: true, availableQuantity: true, status: true } })
        const reserved = siblings.reduce((total, row) => total + (row.status === 'Active' ? row.initialQuantity : row.initialQuantity - row.availableQuantity), 0)
        const status = input.status ?? current.status
        if (status === 'Active' && reserved + initialQuantity > current.productionRecord.surplusQuantity) return 'invalid'
        const row = await tx.surplusListing.update({ where: { surplusListingId: listingId }, data: {
          ...(input.rescuePrice === undefined ? {} : { rescuePrice: input.rescuePrice }),
          initialQuantity, availableQuantity: initialQuantity - sold,
          pickupStart: new Date(start), pickupEnd: new Date(end),
          ...(input.pickupInstructions === undefined ? {} : { pickupInstructions: input.pickupInstructions }),
          status,
        }, include: listingInclude })
        return listingRecord(row)
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
    },
    async close(ownerId, listingId) {
      const result = await prisma.surplusListing.updateMany({ where: { surplusListingId: listingId, productionRecord: { menu: { restaurant: { ownerId } } } }, data: { status: 'Closed' } })
      if (!result.count) return null
      const row = await prisma.surplusListing.findUniqueOrThrow({ where: { surplusListingId: listingId }, include: listingInclude })
      return listingRecord(row)
    },
  }
  const marketplace: MarketplaceStore = {
    async listListings(filter, now) {
      const menu: Prisma.MenuWhereInput = { isActive: true, restaurant: { isOpen: true } }
      if (filter.category) menu.category = { equals: filter.category }
      if (filter.search) menu.OR = [
        { name: { contains: filter.search } },
        { description: { contains: filter.search } },
        { restaurant: { name: { contains: filter.search } } },
      ]
      const rows = await prisma.surplusListing.findMany({
        where: {
          status: 'Active', availableQuantity: { gt: 0 }, pickupStart: { gt: now }, pickupEnd: { gt: now },
          productionRecord: { menu },
        },
        include: marketplaceListingInclude,
        orderBy: { pickupStart: 'asc' },
        take: 100,
      })
      return rows.map(marketplaceListing)
    },
    async getListing(listingId, now) {
      const row = await prisma.surplusListing.findFirst({
        where: {
          surplusListingId: listingId, status: 'Active', availableQuantity: { gt: 0 },
          pickupStart: { gt: now }, pickupEnd: { gt: now },
          productionRecord: { menu: { isActive: true, restaurant: { isOpen: true } } },
        },
        include: marketplaceListingInclude,
      })
      return row ? marketplaceListing(row) : null
    },
    async createOrder(customerId, items, now) {
      try {
        return await prisma.$transaction(async (tx) => {
          const rows = []
          let restaurantId: number | null = null
          for (const item of items) {
            const row = await tx.surplusListing.findFirst({
              where: {
                surplusListingId: item.surplusListingId, status: 'Active', availableQuantity: { gte: item.quantity },
                pickupStart: { gt: now }, pickupEnd: { gt: now },
                productionRecord: { menu: { isActive: true, restaurant: { isOpen: true } } },
              },
              include: marketplaceListingInclude,
            })
            if (!row) return null
            const currentRestaurantId = row.productionRecord.menu.restaurantId
            if (restaurantId !== null && restaurantId !== currentRestaurantId) return null
            restaurantId = currentRestaurantId
            rows.push({ row, item })
          }

          const starts = rows.map(({ row }) => row.pickupStart.getTime())
          const ends = rows.map(({ row }) => row.pickupEnd.getTime())
          const pickupStart = new Date(Math.max(...starts))
          const pickupEnd = Math.min(...ends)
          if (pickupStart.getTime() >= pickupEnd) return null

          const orderItems = []
          for (const { row, item } of rows) {
            const allocated = await tx.surplusListing.updateMany({
              where: {
                surplusListingId: item.surplusListingId, status: 'Active', availableQuantity: { gte: item.quantity },
                pickupStart: { gt: now }, pickupEnd: { gt: now },
                productionRecord: { menu: { isActive: true, restaurant: { isOpen: true } } },
              },
              data: { availableQuantity: { decrement: item.quantity } },
            })
            if (allocated.count !== 1) throw new CheckoutUnavailable()
            const unitPrice = row.rescuePrice
            orderItems.push({ surplusListingId: item.surplusListingId, quantity: item.quantity, unitPrice, subtotal: unitPrice.mul(item.quantity) })
          }
          const totalAmount = orderItems.slice(1).reduce((total, item) => total.add(item.subtotal), orderItems[0]!.subtotal)
          const order = await tx.order.create({
            data: {
              customerId,
              restaurantId: restaurantId!,
              status: 'Pending',
              totalAmount,
              items: { create: orderItems },
              pickup: { create: { pickupCode: createPickupCode(), estimatedPickupAt: pickupStart, status: 'Pending' } },
            },
            include: orderInclude,
          })
          return customerOrder(order)
        })
      } catch (error) {
        if (error instanceof CheckoutUnavailable) return null
        throw error
      }
    },
    async listOrders(customerId) {
      const rows = await prisma.order.findMany({ where: { customerId }, include: orderInclude, orderBy: { orderedAt: 'desc' } })
      return rows.map(customerOrder)
    },
    async getOrder(customerId, orderId) {
      const row = await prisma.order.findFirst({ where: { orderId, customerId }, include: orderInclude })
      return row ? customerOrder(row) : null
    },
    async listOwnerOrders(ownerId) {
      const rows = await prisma.order.findMany({ where: { restaurant: { ownerId } }, include: ownerOrderInclude, orderBy: { orderedAt: 'desc' } })
      return rows.map(ownerOrder)
    },
    async verifyPickup(ownerId, orderId, pickupCode, now) {
      return prisma.$transaction(async (tx) => {
        const order = await tx.order.findFirst({ where: { orderId, restaurant: { ownerId } }, include: ownerOrderInclude })
        if (!order) return 'not-found'
        if (!order.pickup) return 'invalid-status'
        const storedCode = Buffer.from(order.pickup.pickupCode)
        const submittedCode = Buffer.from(pickupCode)
        if (storedCode.length !== submittedCode.length || !timingSafeEqual(storedCode, submittedCode)) return 'invalid-code'
        if (order.pickup.verifiedAt || order.pickup.status !== 'Pending') return 'already-verified'
        if (order.status !== 'Pending') return 'invalid-status'

        const pickup = await tx.pickup.updateMany({
          where: { pickupId: order.pickup.pickupId, pickupCode, verifiedAt: null, status: 'Pending' },
          data: { verifiedAt: now, status: 'Verified' },
        })
        if (pickup.count !== 1) return 'already-verified'
        const changed = await tx.order.updateMany({ where: { orderId, status: 'Pending' }, data: { status: 'Completed' } })
        if (changed.count !== 1) throw new Error('Order status changed while verifying pickup.')
        const updated = await tx.order.findUniqueOrThrow({ where: { orderId }, include: ownerOrderInclude })
        return ownerOrder(updated)
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
    },
  }
  const historyRange = (targetDate: string, days: number) => {
    const end = new Date(`${targetDate}T00:00:00Z`)
    return { gte: new Date(end.getTime() - days * 86400000), lt: end }
  }
  const recommendations: RecommendationStore = {
    async training(targetDate, afterMenuId) {
      const rows = await prisma.menu.findMany({
        where: { isActive: true, menuId: { gt: afterMenuId } }, take: 50, orderBy: { menuId: 'asc' },
        select: { menuId: true, name: true, restaurantId: true, restaurant: { select: { tagsJson: true } },
          productionRecords: { where: { productionDate: historyRange(targetDate, 180) }, orderBy: { productionDate: 'asc' } } },
      })
      return rows.map(row => ({ menuId: row.menuId, name: row.name, restaurantId: row.restaurantId,
        synthetic: (JSON.parse(row.restaurant.tagsJson) as string[]).includes('synthetic-demo'),
        records: row.productionRecords.map(record => ({ productionDate: record.productionDate.toISOString().slice(0, 10),
          producedQuantity: record.producedQuantity, soldQuantity: record.soldQuantity, surplusQuantity: record.surplusQuantity })) }))
    },
    async save(input) {
      if (!await prisma.menu.findFirst({ where: { menuId: input.menuId, isActive: true }, select: { menuId: true } })) return false
      const targetDate = new Date(`${input.targetDate}T00:00:00Z`)
      const data = { ...input, targetDate, generatedAt: new Date() }
      await prisma.productionRecommendation.upsert({
        where: { menuId_targetDate: { menuId: input.menuId, targetDate } }, create: data, update: data,
      })
      return true
    },
    async dashboard(ownerId, restaurantId, targetDate) {
      const restaurant = await prisma.restaurant.findFirst({ where: { restaurantId, ownerId }, select: { name: true, tagsJson: true } })
      if (!restaurant) return null
      const rows = await prisma.menu.findMany({ where: { restaurantId, isActive: true }, orderBy: { name: 'asc' },
        select: { menuId: true, name: true,
          productionRecords: { where: { productionDate: historyRange(targetDate, 180) }, orderBy: { productionDate: 'asc' } },
          productionRecommendations: { where: { targetDate: new Date(`${targetDate}T00:00:00Z`) }, take: 1 } } })
      return { restaurantId, name: restaurant.name, targetDate,
        synthetic: (JSON.parse(restaurant.tagsJson) as string[]).includes('synthetic-demo'),
        menus: rows.map(menu => ({ menuId: menu.menuId, name: menu.name,
          records: menu.productionRecords.map(productionRecord),
          recommendation: menu.productionRecommendations[0] ? {
            ...menu.productionRecommendations[0], predictedDemand: menu.productionRecommendations[0].predictedDemand.toNumber(),
          } : null })) }
    },
  }
  return { prisma, users, passwordResets, restaurants, menus, listings, marketplace, recommendations }
}
