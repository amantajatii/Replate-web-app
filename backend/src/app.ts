import { addRecommendationRoutes, type RecommendationStore } from './ai-recommendations.js'
import cors from 'cors'
import { createHash, randomBytes } from 'node:crypto'
import express, { type RequestHandler } from 'express'
import rateLimit from 'express-rate-limit'
import helmet from 'helmet'
import { z } from 'zod'
import { addRestaurantRoutes, type RestaurantStore } from './restaurant.js'
import { addMenuRoutes, type MenuStore } from './menu-production.js'
import { addListingRoutes, type ListingStore } from './surplus-listing.js'
import { addMarketplaceRoutes, type MarketplaceStore } from './marketplace.js'
import {
  createToken,
  hashPassword,
  normalizeRole,
  readToken,
  verifyPassword,
  type JwtConfig,
  type Role,
} from './auth.js'

export type User = {
  userId: number
  name: string
  email: string
  phone: string | null
  passwordHash: string
  role: Role
  createdAt: Date
}

export type NewUser = Omit<User, 'userId' | 'createdAt'>

export type UserStore = {
  findByEmail(email: string): Promise<User | null>
  create(input: NewUser): Promise<User>
}

export type PasswordResetStore = {
  create(userId: number, tokenHash: string, expiresAt: Date): Promise<void>
  consume(tokenHash: string, passwordHash: string, now: Date): Promise<boolean>
}

export class DuplicateEmailError extends Error {}

type Dependencies = {
  users: UserStore
  passwordResets?: PasswordResetStore
  sendPasswordReset?: (email: string, resetUrl: string) => Promise<void>
  restaurants?: RestaurantStore
  uploadDir?: string
  jwt: JwtConfig
  frontendUrl: string
  authRateLimit?: number
  menus?: MenuStore
  menuUploadDir?: string
  listings?: ListingStore
  recommendations?: RecommendationStore
  aiServiceKey?: string
  marketplace?: MarketplaceStore
}

const registerSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.email().max(255),
  phone: z.string().trim().min(6).max(30).optional(),
  password: z.string().min(8).max(128),
  role: z.string(),
})

const loginSchema = z.object({
  email: z.email().max(255),
  password: z.string().min(8).max(128),
})

const forgotPasswordSchema = z.object({ email: z.email().max(255) })
const resetPasswordSchema = z.object({
  token: z.string().regex(/^[a-f0-9]{64}$/),
  password: z.string().min(8).max(128),
})

function tokenHash(token: string) {
  return createHash('sha256').update(token).digest('hex')
}

function problem(status: number, title: string) {
  return { status, title }
}

function authResponse(user: User, jwtConfig: JwtConfig) {
  const { token, expiresAt } = createToken(user, jwtConfig)
  return {
    userId: user.userId,
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role,
    token,
    expiresAt,
  }
}

export function createApp({ users, passwordResets, sendPasswordReset, restaurants, uploadDir, jwt: jwtConfig, frontendUrl, authRateLimit = 10, menus, menuUploadDir, listings, marketplace, recommendations, aiServiceKey }: Dependencies) {
  if (Buffer.byteLength(jwtConfig.secret, 'utf8') < 32) throw new Error('JWT_SECRET must contain at least 32 bytes.')
  if (!jwtConfig.issuer || !jwtConfig.audience || jwtConfig.expiresMinutes < 1 || jwtConfig.expiresMinutes > 1440) {
    throw new Error('JWT issuer, audience, or expiry configuration is invalid.')
  }

  const app = express()
  app.use(helmet())
  app.use(cors({ origin: frontendUrl }))
  app.use(express.json({ limit: '16kb' }))

  app.get('/api/health', (_request, response) => response.json({ status: 'ok' }))

  const authLimiter = rateLimit({
    windowMs: 60_000,
    limit: authRateLimit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
  })

  app.post('/api/auth/register', authLimiter, async (request, response, next) => {
    try {
      const parsed = registerSchema.safeParse(request.body)
      if (!parsed.success) return response.status(400).json(problem(400, 'Invalid registration data.'))

      const role = normalizeRole(parsed.data.role)
      if (!role) return response.status(400).json(problem(400, 'Role must be Customer or RestaurantOwner.'))

      const email = parsed.data.email.trim().toLowerCase()
      if (await users.findByEmail(email)) {
        return response.status(409).json(problem(409, 'Email is already registered.'))
      }

      const user = await users.create({
        name: parsed.data.name,
        email,
        phone: parsed.data.phone ?? null,
        passwordHash: await hashPassword(parsed.data.password),
        role,
      })
      return response.status(201).json(authResponse(user, jwtConfig))
    } catch (error) {
      if (error instanceof DuplicateEmailError) {
        return response.status(409).json(problem(409, 'Email is already registered.'))
      }
      next(error)
    }
  })

  app.post('/api/auth/login', authLimiter, async (request, response) => {
    const parsed = loginSchema.safeParse(request.body)
    if (!parsed.success) return response.status(400).json(problem(400, 'Invalid login data.'))

    const user = await users.findByEmail(parsed.data.email.trim().toLowerCase())
    const validPassword = await verifyPassword(parsed.data.password, user?.passwordHash)
    if (!user || !validPassword) {
      return response.status(401).json(problem(401, 'Invalid email or password.'))
    }
    return response.json(authResponse(user, jwtConfig))
  })

  app.post('/api/auth/forgot-password', authLimiter, async (request, response, next) => {
    try {
      const parsed = forgotPasswordSchema.safeParse(request.body)
      if (!parsed.success) return response.status(400).json(problem(400, 'Invalid email.'))
      if (!passwordResets || !sendPasswordReset) return response.status(503).json(problem(503, 'Password reset is unavailable.'))

      const user = await users.findByEmail(parsed.data.email.trim().toLowerCase())
      if (user) {
        const token = randomBytes(32).toString('hex')
        await passwordResets.create(user.userId, tokenHash(token), new Date(Date.now() + 30 * 60_000))
        const url = new URL('/reset-password/', frontendUrl)
        url.searchParams.set('token', token)
        try {
          await sendPasswordReset(user.email, url.toString())
        } catch (error) {
          // Keep the response identical for known and unknown addresses.
          console.error('Password reset email failed:', error)
        }
      }
      return response.status(202).json({ status: 'accepted' })
    } catch (error) {
      next(error)
    }
  })

  app.post('/api/auth/reset-password', authLimiter, async (request, response, next) => {
    try {
      const parsed = resetPasswordSchema.safeParse(request.body)
      if (!parsed.success) return response.status(400).json(problem(400, 'Invalid reset data.'))
      if (!passwordResets) return response.status(503).json(problem(503, 'Password reset is unavailable.'))
      const updated = await passwordResets.consume(
        tokenHash(parsed.data.token),
        await hashPassword(parsed.data.password),
        new Date(),
      )
      if (!updated) return response.status(400).json(problem(400, 'Reset link is invalid or expired.'))
      return response.status(204).end()
    } catch (error) {
      next(error)
    }
  })

  const requireRole = (role: Role): RequestHandler => (request, response, next) => {
    const [scheme, token] = request.header('Authorization')?.split(' ') ?? []
    if (scheme !== 'Bearer' || !token) return response.status(401).json(problem(401, 'Unauthorized.'))
    try {
      const payload = readToken(token, jwtConfig)
      if (payload.role !== role) return response.status(403).json(problem(403, 'Forbidden.'))
      const userId = Number(payload.sub)
      if (!Number.isSafeInteger(userId) || userId < 1) return response.status(401).json(problem(401, 'Unauthorized.'))
      response.locals.ownerId = userId
      next()
    } catch {
      return response.status(401).json(problem(401, 'Unauthorized.'))
    }
  }

  app.get('/api/access/customer', requireRole('Customer'), (_request, response) => {
    response.json({ role: 'Customer' })
  })
  app.get('/api/access/restaurant-owner', requireRole('RestaurantOwner'), (_request, response) => {
    response.json({ role: 'RestaurantOwner' })
  })

  if (recommendations) addRecommendationRoutes(app, recommendations, requireRole('RestaurantOwner'), aiServiceKey)
  if (restaurants) addRestaurantRoutes(app, restaurants, requireRole('RestaurantOwner'), uploadDir ?? 'uploads')
  if (menus && menuUploadDir) addMenuRoutes(app, menus, requireRole('RestaurantOwner'), menuUploadDir)
  if (listings) addListingRoutes(app, listings, requireRole('RestaurantOwner'))
  if (marketplace) addMarketplaceRoutes(app, marketplace, requireRole('Customer'), requireRole('RestaurantOwner'))

  app.use((error: unknown, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
    if (typeof error === 'object' && error !== null && 'status' in error && error.status === 413) {
      return response.status(413).json(problem(413, 'Image exceeds 5 MB.'))
    }
    if (error instanceof SyntaxError && 'status' in error && error.status === 400) {
      return response.status(400).json(problem(400, 'Invalid JSON.'))
    }
    if (typeof error === 'object' && error !== null && 'type' in error && error.type === 'entity.too.large') {
      return response.status(413).json(problem(413, 'Image is too large.'))
    }
    response.status(500).json(problem(500, 'An unexpected error occurred.'))
  })

  return app
}
