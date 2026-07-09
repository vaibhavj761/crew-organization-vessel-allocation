import 'dotenv/config'
import { z } from 'zod'

const envBoolean = z.preprocess((value) => {
  if (typeof value !== 'string') return value
  const normalized = value.trim().toLowerCase()
  if (['true', '1', 'yes', 'on'].includes(normalized)) return true
  if (['false', '0', 'no', 'off', ''].includes(normalized)) return false
  return value
}, z.boolean())

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  SESSION_SECRET: z.string().min(32),
  PORT: z.coerce.number().int().positive().default(8081),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  COOKIE_SECURE: envBoolean.default(false),
  ENABLE_HTTPS_CSP: envBoolean.default(false),
  FRONTEND_URL: z.string().url(),
  ADMIN_SEED_EMAIL: z.string().email().optional().or(z.literal('')),
  ADMIN_SEED_PASSWORD: z.string().min(8).optional().or(z.literal('')),
  ADMIN_SEED_NAME: z.string().min(1).optional().or(z.literal('')),
})

export const env = envSchema.parse(process.env)
