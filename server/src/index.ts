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

const app = Fastify({ logger: true })

await app.register(helmet, {
  contentSecurityPolicy: {
    directives: {
      'upgrade-insecure-requests': env.ENABLE_HTTPS_CSP ? [] : null,
    },
  },
})
await app.register(cors, {
  origin: env.FRONTEND_URL,
  credentials: true,
})
await app.register(cookie)
await app.register(jwt, { secret: env.SESSION_SECRET, cookie: { cookieName: 'crew_chart_session', signed: false } })
await app.register(rateLimit, { max: 20, timeWindow: '1 minute' })

await app.register(healthRoutes)
await app.register(authRoutes)
await app.register(accessRequestRoutes)
await app.register(organizationRoutes)

const frontendDistDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../dist')
const indexHtmlPath = path.join(frontendDistDir, 'index.html')

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
    return reply.type('text/html; charset=utf-8').send(html)
  } catch {
    return reply.code(500).send({ message: 'Frontend build not found' })
  }
})

app.get('/', async (_request, reply) => {
  try {
    const html = await readFile(indexHtmlPath, 'utf8')
    return reply.type('text/html; charset=utf-8').send(html)
  } catch {
    return reply.code(500).send({ message: 'Frontend build not found' })
  }
})

const start = async () => {
  try {
    await app.listen({ port: env.PORT, host: '0.0.0.0' })
  } catch (error) {
    app.log.error(error)
    process.exit(1)
  }
}

if (process.env.NODE_ENV !== 'test') {
  void start()
}

export { app }
