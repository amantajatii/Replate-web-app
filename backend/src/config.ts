import { z } from 'zod'

const environmentSchema = z.object({
  AI_SERVICE_KEY: z.string().min(32).optional(),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(32),
  JWT_ISSUER: z.string().min(1).default('Replate.Api'),
  JWT_AUDIENCE: z.string().min(1).default('Replate.Client'),
  JWT_EXPIRES_MINUTES: z.coerce.number().int().min(1).max(1440).default(60),
  FRONTEND_URL: z.url().default('http://localhost:3000'),
  PORT: z.coerce.number().int().min(1).max(65535).default(5000),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().min(1).max(65535).default(587),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  SMTP_FROM: z.email().optional(),
  UPLOAD_DIR: z.string().min(1).default('uploads'),
  MENU_UPLOAD_DIR: z.string().min(1).default('menu-uploads'),
})

export function loadConfig(environment: NodeJS.ProcessEnv = process.env) {
  const value = environmentSchema.parse(environment)
  if (value.SMTP_HOST && (!value.SMTP_USER || !value.SMTP_PASSWORD || !value.SMTP_FROM)) {
    throw new Error('SMTP_USER, SMTP_PASSWORD, and SMTP_FROM are required when SMTP_HOST is set.')
  }
  return {
    aiServiceKey: value.AI_SERVICE_KEY,
    databaseUrl: value.DATABASE_URL,
    frontendUrl: value.FRONTEND_URL,
    port: value.PORT,
    smtp: value.SMTP_HOST ? {
      host: value.SMTP_HOST,
      port: value.SMTP_PORT,
      user: value.SMTP_USER!,
      password: value.SMTP_PASSWORD!,
      from: value.SMTP_FROM!,
    } : null,
    uploadDir: value.UPLOAD_DIR,
    menuUploadDir: value.MENU_UPLOAD_DIR,
    jwt: {
      secret: value.JWT_SECRET,
      issuer: value.JWT_ISSUER,
      audience: value.JWT_AUDIENCE,
      expiresMinutes: value.JWT_EXPIRES_MINUTES,
    },
  }
}
