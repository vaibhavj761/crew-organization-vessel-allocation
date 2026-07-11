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
  AI_PROVIDER: z.enum(['openai', 'claude', 'gemini', 'mock', 'none']).default(process.env.NODE_ENV === 'production' ? 'none' : 'mock'),
  OPENAI_API_KEY: z.string().optional().or(z.literal('')),
  OPENAI_MODEL: z.string().min(1).default('gpt-5.5'),
  ANTHROPIC_API_KEY: z.string().optional().or(z.literal('')),
  CLAUDE_MODEL: z.string().min(1).default('claude-sonnet-5-latest'),
  GEMINI_API_KEY: z.string().optional().or(z.literal('')),
  GEMINI_MODEL: z.string().min(1).default('gemini-2.5-flash'),
  ADMIN_SEED_EMAIL: z.string().email().optional().or(z.literal('')),
  ADMIN_SEED_PASSWORD: z.string().min(8).optional().or(z.literal('')),
  ADMIN_SEED_NAME: z.string().min(1).optional().or(z.literal('')),
})

export const env = envSchema.parse(process.env)
