import { env } from '../config/env.js'
import type { FastifyReply } from 'fastify'

export const authCookieName = 'crew_chart_session'

export function setAuthCookie(reply: FastifyReply, token: string) {
  reply.setCookie(authCookieName, token, {
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    sameSite: 'lax',
    path: '/',
  })
}

export function clearAuthCookie(reply: FastifyReply) {
  reply.clearCookie(authCookieName, {
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    sameSite: 'lax',
    path: '/',
  })
}
