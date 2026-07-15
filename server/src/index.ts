import Fastify from 'fastify'
import cookie from '@fastify/cookie'
import cors from '@fastify/cors'
import helmet from '@fastify/helmet'
import jwt from '@fastify/jwt'
import rateLimit from '@fastify/rate-limit'
import { readFile, stat } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { env } from './config/env.js'
import { authRoutes } from './routes/auth.js'
import { accessRequestRoutes } from './routes/accessRequests.js'
import { healthRoutes } from './routes/health.js'
import { organizationRoutes } from './routes/organization.js'
import { aiRoutes } from './routes/ai.js'
import { getCurrentUser } from './auth/context.js'

const app = Fastify({ logger: true })

function allowedOrigins() {
  const configured = new URL(env.FRONTEND_URL)
  const origins = new Set([env.FRONTEND_URL])

  if (env.NODE_ENV === 'development' && configured.protocol === 'http:' && (configured.hostname === 'localhost' || configured.hostname === '127.0.0.1')) {
    origins.add('http://localhost:5173')
    origins.add('http://127.0.0.1:5173')
  }

  return origins
}

const corsAllowedOrigins = allowedOrigins()

await app.register(helmet, {
  hsts: env.ENABLE_HTTPS_CSP ? undefined : false,
  contentSecurityPolicy: {
    directives: {
      'upgrade-insecure-requests': env.ENABLE_HTTPS_CSP ? [] : null,
    },
  },
})
await app.register(cors, {
  origin: (origin, callback) => {
    if (!origin || corsAllowedOrigins.has(origin)) {
      callback(null, true)
      return
    }
    callback(new Error('Origin not allowed'), false)
  },
  credentials: true,
})
await app.register(cookie)
await app.register(jwt, { secret: env.SESSION_SECRET, cookie: { cookieName: 'crew_chart_session', signed: false } })
await app.register(rateLimit, {
  max: 200,
  timeWindow: '1 minute',
  keyGenerator: async (request) => {
    const user = await getCurrentUser(request)
    if (user?.id) return `user:${user.id}`
    const forwarded = request.headers['x-forwarded-for']
    const ip = Array.isArray(forwarded) ? forwarded[0] : typeof forwarded === 'string' ? forwarded.split(',')[0]?.trim() : request.ip
    return `ip:${ip || 'unknown'}`
  },
})

app.addHook('onSend', async (request, reply, payload) => {
  if (new URL(request.url, 'http://localhost').pathname.startsWith('/api/')) {
    reply.header('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
    reply.header('Pragma', 'no-cache')
    reply.header('Expires', '0')
    reply.header('Surrogate-Control', 'no-store')
    reply.header('Vary', 'Origin, Cookie')
  }
  return payload
})

await app.register(healthRoutes)
await app.register(authRoutes)
await app.register(accessRequestRoutes)
await app.register(organizationRoutes)
await app.register(aiRoutes)

const frontendDistDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../dist')
const indexHtmlPath = path.join(frontendDistDir, 'index.html')

function sendIndexHtml(reply: import('fastify').FastifyReply, html: string) {
  return reply
    .header('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
    .header('Pragma', 'no-cache')
    .header('Expires', '0')
    .type('text/html; charset=utf-8')
    .send(html)
}

function isApiPath(url: string) {
  return new URL(url, 'http://localhost').pathname.startsWith('/api/')
}

function contentTypeFor(filePath: string) {
  if (filePath.endsWith('.js')) return 'application/javascript'
  if (filePath.endsWith('.css')) return 'text/css'
  if (filePath.endsWith('.svg')) return 'image/svg+xml'
  if (filePath.endsWith('.png')) return 'image/png'
  if (filePath.endsWith('.jpg') || filePath.endsWith('.jpeg')) return 'image/jpeg'
  if (filePath.endsWith('.ico')) return 'image/x-icon'
  if (filePath.endsWith('.json')) return 'application/json'
  if (filePath.endsWith('.woff')) return 'font/woff'
  if (filePath.endsWith('.woff2')) return 'font/woff2'
  return 'application/octet-stream'
}

app.setNotFoundHandler(async (request, reply) => {
  if (isApiPath(request.url)) {
    return reply.code(404).send({ message: 'Not found' })
  }

  const pathname = new URL(request.url, 'http://localhost').pathname
  const staticPath = path.normalize(path.join(frontendDistDir, pathname))
  if (staticPath.startsWith(frontendDistDir)) {
    try {
      const fileStats = await stat(staticPath)
      if (fileStats.isFile()) {
        const content = await readFile(staticPath)
        return reply.type(contentTypeFor(staticPath)).send(content)
      }
    } catch {
      // fall through to index.html
    }
  }

  try {
    const html = await readFile(indexHtmlPath, 'utf8')
    return sendIndexHtml(reply, html)
  } catch {
    return reply.code(500).send({ message: 'Frontend build not found' })
  }
})

app.get('/', async (_request, reply) => {
  try {
    const html = await readFile(indexHtmlPath, 'utf8')
    return sendIndexHtml(reply, html)
  } catch {
    return reply.code(500).send({ message: 'Frontend build not found' })
  }
})

const start = async () => {
  try {
    await app.listen({ port: env.PORT, host: '0.0.0.0' })
    app.log.info({
      port: env.PORT,
      nodeEnv: env.NODE_ENV,
      frontendOrigins: Array.from(corsAllowedOrigins),
      secureCookies: env.COOKIE_SECURE,
      httpsCsp: env.ENABLE_HTTPS_CSP,
    }, 'Server configuration')
  } catch (error) {
    app.log.error(error)
    process.exit(1)
  }
}

if (process.env.NODE_ENV !== 'test') {
  void start()
}

export { app }
