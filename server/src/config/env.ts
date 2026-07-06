import 'dotenv/config'
import { z } from 'zod'

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  SESSION_SECRET: z.string().min(32),
  PORT: z.coerce.number().int().positive().default(8080),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  COOKIE_SECURE: z.coerce.boolean().default(false),
  ENABLE_HTTPS_CSP: z.coerce.boolean().default(false),
  FRONTEND_URL: z.string().url(),
  ADMIN_SEED_EMAIL: z.string().email().optional().or(z.literal('')),
  ADMIN_SEED_PASSWORD: z.string().min(8).optional().or(z.literal('')),
  ADMIN_SEED_NAME: z.string().min(1).optional().or(z.literal('')),
})

export const env = envSchema.parse(process.env)
