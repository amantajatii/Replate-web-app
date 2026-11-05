import { createHash, timingSafeEqual } from 'node:crypto'
import type { Express, RequestHandler } from 'express'
import { z } from 'zod'

export const dateSchema = z.iso.date().refine(value => Number.isFinite(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value)
const id = z.coerce.number().int().positive().max(2147483647)
const recommendationSchema = z.object({
  menuId: id,
  targetDate: dateSchema,
  predictedDemand: z.number().finite().min(0).max(100000).multipleOf(0.01),
  recommendedQuantity: z.number().int().min(0).max(100000),
  insight: z.string().trim().min(1).max(1000),
  modelVersion: z.enum(['weekday-v1', 'random-forest-v1']),
}).strict().refine(value => value.recommendedQuantity === Math.ceil(value.predictedDemand))
export type RecommendationInput = z.infer<typeof recommendationSchema>
export type TrainingMenu = {
  menuId: number; name: string; restaurantId: number; synthetic: boolean
  records: { productionDate: string; producedQuantity: number; soldQuantity: number; surplusQuantity: number }[]
}
export type RecommendationStore = {
  training(targetDate: string, afterMenuId: number): Promise<TrainingMenu[]>
  save(input: RecommendationInput): Promise<boolean>
  dashboard(ownerId: number, restaurantId: number, targetDate: string): Promise<unknown | null>
}

export function addRecommendationRoutes(app: Express, store: RecommendationStore, owner: RequestHandler, serviceKey?: string) {
  const internal: RequestHandler = (request, response, next) => {
    if (!serviceKey) return response.status(503).json({ title: 'AI batch service is not configured.' })
    const digest = (value: string) => createHash('sha256').update(value).digest()
    if (!timingSafeEqual(digest(request.header('X-AI-Key') ?? ''), digest(serviceKey))) {
      return response.status(401).json({ title: 'Unauthorized.' })
    }
    next()
  }
  app.get('/api/internal/ai/training-data', internal, async (request, response) => {
    const query = z.object({ targetDate: dateSchema, afterMenuId: z.coerce.number().int().min(0).max(2147483647).default(0) }).safeParse(request.query)
    if (!query.success) return response.status(400).json({ title: 'Invalid training query.' })
    const menus = await store.training(query.data.targetDate, query.data.afterMenuId)
    return response.json({ menus, nextMenuId: menus.length === 50 ? menus.at(-1)!.menuId : null })
  })
  app.post('/api/internal/ai/recommendations', internal, async (request, response) => {
    const input = recommendationSchema.safeParse(request.body)
    if (!input.success) return response.status(400).json({ title: 'Invalid recommendation.' })
    if (!await store.save(input.data)) return response.status(404).json({ title: 'Active menu not found.' })
    return response.json({ saved: true })
  })
  app.get('/api/owner/restaurants/:restaurantId/recommendations', owner, async (request, response) => {
    const restaurantId = id.safeParse(request.params.restaurantId)
    const date = dateSchema.safeParse(request.query.date)
    if (!restaurantId.success || !date.success) return response.status(400).json({ title: 'Invalid restaurant or date.' })
    const dashboard = await store.dashboard(response.locals.ownerId, restaurantId.data, date.data)
    if (!dashboard) return response.status(404).json({ title: 'Restaurant not found.' })
    return response.json(dashboard)
  })
}
