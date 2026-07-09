import type { ZodError } from 'zod'

export function firstZodMessage(error: ZodError, fallback: string) {
  return error.issues[0]?.message || fallback
}
