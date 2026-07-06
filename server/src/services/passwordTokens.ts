import { env } from '../config/env.js'
import { prisma } from '../db/prisma.js'
import { generateRawToken, hashToken } from '../utils/token.js'

const ONE_DAY_MS = 24 * 60 * 60 * 1000

function frontendUrl(path: string, token: string) {
  const base = env.FRONTEND_URL.replace(/\/$/, '')
  return `${base}${path}?token=${encodeURIComponent(token)}`
}

export async function createPasswordToken(userId: string, type: 'SET_PASSWORD' | 'RESET_PASSWORD') {
  const rawToken = generateRawToken()
  const tokenHash = hashToken(rawToken)
  const record = await prisma.passwordToken.create({
    data: {
      userId,
      tokenHash,
      type,
      expiresAt: new Date(Date.now() + ONE_DAY_MS),
    },
  })

  return {
    record,
    rawToken,
    link: frontendUrl(type === 'SET_PASSWORD' ? '/set-password' : '/reset-password', rawToken),
  }
}

export async function consumePasswordToken(token: string, type: 'SET_PASSWORD' | 'RESET_PASSWORD') {
  const tokenHash = hashToken(token)
  const record = await prisma.passwordToken.findFirst({
    where: { tokenHash, type },
    include: { user: true },
  })

  if (!record) return { ok: false as const, reason: 'invalid' as const }
  if (record.usedAt) return { ok: false as const, reason: 'used' as const }
  if (record.expiresAt.getTime() < Date.now()) return { ok: false as const, reason: 'expired' as const }

  return { ok: true as const, record }
}
