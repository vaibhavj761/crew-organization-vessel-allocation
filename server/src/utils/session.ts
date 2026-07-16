import { env } from '../config/env.js'
import type { FastifyReply } from 'fastify'
import '@fastify/cookie'

export const authCookieName = 'crew_chart_session'
export const authSessionVersion = 2

function secureCookie() {
  return env.NODE_ENV === 'production' || env.COOKIE_SECURE
}

export function setAuthCookie(reply: FastifyReply, token: string) {
  reply.setCookie(authCookieName, token, {
    httpOnly: true,
    secure: secureCookie(),
    sameSite: 'lax',
    path: '/',
    maxAge: env.SESSION_TTL_HOURS * 60 * 60,
  })
}

export function clearAuthCookie(reply: FastifyReply) {
  reply.clearCookie(authCookieName, {
    httpOnly: true,
    secure: secureCookie(),
    sameSite: 'lax',
    path: '/',
  })
}
