import { randomUUID } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import express, { type RequestHandler } from 'express'
import { z } from 'zod'

const photoUrl = z
  .string()
  .regex(/^\/menu-uploads\/[1-9]\d*-[a-f0-9-]+\.(png|jpg|webp)$/)
const menuSchema = z.object({
  name: z.string().trim().min(2).max(150),
  description: z.string().trim().min(2).max(1000),
  category: z.string().trim().min(2).max(80),
  normalPrice: z.number().finite().min(0).max(1_000_000_000),
  allergens: z.array(z.string().trim().min(1).max(50)).max(12),
  dietTags: z.array(z.string().trim().min(1).max(50)).max(12),
  allergenNote: z.string().trim().max(500).nullable(),
  isActive: z.boolean(),
  photos: z.array(photoUrl).max(8),
})
const productionSchema = z
  .object({
    producedQuantity: z.number().int().min(0),
    soldQuantity: z.number().int().min(0),
    surplusQuantity: z.number().int().min(0),
  })
  .refine(
    ({ producedQuantity, soldQuantity, surplusQuantity }) =>
      soldQuantity + surplusQuantity === producedQuantity,
  )
const datePattern = /^\d{4}-\d{2}-\d{2}$/

export type MenuInput = z.infer<typeof menuSchema>
export type MenuChanges = z.infer<ReturnType<typeof menuSchema.partial>>
export type MenuRecord = MenuInput & {
  menuId: number
  restaurantId: number
  createdAt: Date
}
export type ProductionInput = z.infer<typeof productionSchema>
export type ProductionRecord = ProductionInput & {
  productionRecordId: number
  menuId: number
  productionDate: string
  recordedAt: Date
}
export type ProductionFilters = { menuId?: number; from?: string; to?: string }
export type MenuStore = {
  list(ownerId: number, restaurantId: number): Promise<MenuRecord[] | null>
  create(
    ownerId: number,
    restaurantId: number,
    input: MenuInput,
  ): Promise<MenuRecord | null>
  update(
    ownerId: number,
    menuId: number,
    input: MenuChanges,
  ): Promise<MenuRecord | null>
  production(
    ownerId: number,
    restaurantId: number,
    date: string,
  ): Promise<ProductionRecord[] | null>
  productionHistory(ownerId: number, restaurantId: number, filters: ProductionFilters): Promise<ProductionRecord[] | null>
  upsertProduction(
    ownerId: number,
    menuId: number,
    date: string,
    input: ProductionInput,
  ): Promise<ProductionRecord | null | 'invalid'>
  gallery(ownerId: number): Promise<string[]>
}

function id(value: string | undefined) {
  const number = Number(value)
  return Number.isSafeInteger(number) && number > 0 ? number : null
}

function date(value: string | undefined) {
  if (!value || !datePattern.test(value)) return null
  const parsed = new Date(`${value}T00:00:00.000Z`)
  return !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value
    ? value
    : null
}

function imageExtension(bytes: Buffer, contentType: string) {
  if (
    contentType === 'image/png' &&
    bytes.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex'))
  )
    return 'png'
  if (
    contentType === 'image/jpeg' &&
    bytes.subarray(0, 3).equals(Buffer.from('ffd8ff', 'hex'))
  )
    return 'jpg'
  if (
    contentType === 'image/webp' &&
    bytes.toString('ascii', 0, 4) === 'RIFF' &&
    bytes.toString('ascii', 8, 12) === 'WEBP'
  )
    return 'webp'
  return null
}

export function addMenuRoutes(
  app: express.Express,
  store: MenuStore,
  ownerOnly: RequestHandler,
  uploadDir: string,
) {
  app.use(
    '/menu-uploads',
    express.static(uploadDir, {
      dotfiles: 'deny',
      immutable: true,
      maxAge: '1y',
      setHeaders(response) {
        response.setHeader('Cross-Origin-Resource-Policy', 'cross-origin')
      },
    }),
  )
  app.get(
    '/api/owner/restaurants/:restaurantId/menus',
    ownerOnly,
    async (request, response, next) => {
      try {
        const restaurantId = id(request.params.restaurantId as string)
        if (!restaurantId)
          return response.status(400).json({ title: 'Invalid restaurant ID.' })
        const menus = await store.list(
          response.locals.ownerId as number,
          restaurantId,
        )
        return menus
          ? response.json(menus)
          : response.status(404).json({ title: 'Restaurant not found.' })
      } catch (error) {
        next(error)
      }
    },
  )
  app.post(
    '/api/owner/restaurants/:restaurantId/menus',
    ownerOnly,
    async (request, response, next) => {
      try {
        const restaurantId = id(request.params.restaurantId as string)
        const parsed = menuSchema.safeParse(request.body)
        const ownerId = response.locals.ownerId as number
        if (
          !restaurantId ||
          !parsed.success ||
          !parsed.data.photos.every((url) =>
            url.startsWith(`/menu-uploads/${ownerId}-`),
          )
        )
          return response.status(400).json({ title: 'Invalid menu data.' })
        const menu = await store.create(ownerId, restaurantId, parsed.data)
        return menu
          ? response.status(201).json(menu)
          : response.status(404).json({ title: 'Restaurant not found.' })
      } catch (error) {
        next(error)
      }
    },
  )
  app.patch(
    '/api/owner/menus/:menuId',
    ownerOnly,
    async (request, response, next) => {
      try {
        const menuId = id(request.params.menuId as string)
        const parsed = menuSchema.partial().safeParse(request.body)
        if (
          !menuId ||
          !parsed.success ||
          !Object.keys(parsed.data).length ||
          parsed.data.photos?.some(
            (url) =>
              !url.startsWith(
                `/menu-uploads/${response.locals.ownerId as number}-`,
              ),
          )
        )
          return response.status(400).json({ title: 'Invalid menu data.' })
        const menu = await store.update(
          response.locals.ownerId as number,
          menuId,
          parsed.data,
        )
        return menu
          ? response.json(menu)
          : response.status(404).json({ title: 'Menu not found.' })
      } catch (error) {
        next(error)
      }
    },
  )
  app.get(
    '/api/owner/restaurants/:restaurantId/production',
    ownerOnly,
    async (request, response, next) => {
      try {
        const restaurantId = id(request.params.restaurantId as string)
        const day = date(request.query.date as string)
        if (!restaurantId || !day)
          return response
            .status(400)
            .json({ title: 'Invalid date or restaurant ID.' })
        const records = await store.production(
          response.locals.ownerId as number,
          restaurantId,
          day,
        )
        return records
          ? response.json(records)
          : response.status(404).json({ title: 'Restaurant not found.' })
      } catch (error) {
        next(error)
      }
    },
  )
  app.get('/api/owner/restaurants/:restaurantId/production/history', ownerOnly, async (request, response, next) => {
    try {
      const restaurantId = id(request.params.restaurantId as string)
      const query = z.object({ menuId: z.string().optional(), from: z.string().optional(), to: z.string().optional() }).safeParse(request.query)
      if (!restaurantId || !query.success) return response.status(400).json({ title: 'Invalid production filters.' })
      const { menuId, from, to } = query.data
      if ((menuId !== undefined && !id(menuId)) || (from !== undefined && !date(from)) || (to !== undefined && !date(to)) || (from && to && from > to)) {
        return response.status(400).json({ title: 'Invalid production filters.' })
      }
      const records = await store.productionHistory(response.locals.ownerId as number, restaurantId, {
        ...(menuId !== undefined ? { menuId: id(menuId)! } : {}),
        ...(from !== undefined ? { from } : {}),
        ...(to !== undefined ? { to } : {}),
      })
      return records ? response.json(records) : response.status(404).json({ title: 'Restaurant not found.' })
    } catch (error) { next(error) }
  })
  app.put(
    '/api/owner/menus/:menuId/production/:date',
    ownerOnly,
    async (request, response, next) => {
      try {
        const menuId = id(request.params.menuId as string)
        const day = date(request.params.date as string)
        const parsed = productionSchema.safeParse(request.body)
        if (!menuId || !day || !parsed.success)
          return response
            .status(400)
            .json({ title: 'Invalid production quantities.' })
        const record = await store.upsertProduction(
          response.locals.ownerId as number,
          menuId,
          day,
          parsed.data,
        )
        if (record === 'invalid')
          return response.status(400).json({ title: 'Surplus cannot be below allocated listing quantity.' })
        return record
          ? response.json(record)
          : response.status(404).json({ title: 'Menu not found.' })
      } catch (error) {
        next(error)
      }
    },
  )
  app.get(
    '/api/owner/menu-media',
    ownerOnly,
    async (_request, response, next) => {
      try {
        response.json(await store.gallery(response.locals.ownerId as number))
      } catch (error) {
        next(error)
      }
    },
  )
  app.post(
    '/api/owner/menu-media',
    ownerOnly,
    express.raw({
      type: ['image/png', 'image/jpeg', 'image/webp'],
      limit: '5mb',
    }),
    async (request, response, next) => {
      try {
        if (!Buffer.isBuffer(request.body))
          return response.status(415).json({ title: 'Unsupported image type.' })
        const extension = imageExtension(
          request.body,
          request.header('Content-Type')?.split(';')[0] ?? '',
        )
        if (!extension)
          return response.status(400).json({ title: 'Invalid image.' })
        const filename = `${response.locals.ownerId as number}-${randomUUID()}.${extension}`
        await mkdir(uploadDir, { recursive: true })
        await writeFile(path.join(uploadDir, filename), request.body, {
          flag: 'wx',
        })
        return response.status(201).json({ url: `/menu-uploads/${filename}` })
      } catch (error) {
        next(error)
      }
    },
  )
}
