import { z } from 'zod'
import { engineKindSchema, engineStatusSchema } from './engine'

export const createSessionInputSchema = z.object({
  name: z.string().min(1).max(120),
  engine: engineKindSchema
})
export type CreateSessionInput = z.infer<typeof createSessionInputSchema>

export const migrateSessionInputSchema = z.object({
  to: engineKindSchema
})
export type MigrateSessionInput = z.infer<typeof migrateSessionInputSchema>

export const sessionSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  engine: engineKindSchema,
  status: engineStatusSchema,
  meJid: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string()
})
export type Session = z.infer<typeof sessionSchema>

export const qrSchema = z.object({
  qr: z.string().nullable(),
  dataUrl: z.string().nullable()
})
export type Qr = z.infer<typeof qrSchema>
