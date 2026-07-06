import type { SafeUser } from '../types.js'

declare module 'fastify' {
  interface FastifyRequest {
    currentUser?: SafeUser | null
  }
}
