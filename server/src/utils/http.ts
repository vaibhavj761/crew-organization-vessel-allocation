import type { FastifyReply } from 'fastify'

export function created(reply: FastifyReply, payload: unknown) {
  return reply.code(201).send(payload)
}

export function noContent(reply: FastifyReply) {
  return reply.code(204).send()
}

export function badRequest(reply: FastifyReply, message: string, details?: unknown) {
  return reply.code(400).send({ message, details })
}

export function forbidden(reply: FastifyReply, message = 'Forbidden') {
  return reply.code(403).send({ message })
}

export function notFound(reply: FastifyReply, message = 'Not found') {
  return reply.code(404).send({ message })
}
