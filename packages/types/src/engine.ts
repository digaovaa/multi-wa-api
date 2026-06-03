import { z } from 'zod'

export const engineKindSchema = z.enum(['zapo', 'baileys'])
export type EngineKind = z.infer<typeof engineKindSchema>

export const engineStatusSchema = z.enum([
  'created',
  'connecting',
  'qr',
  'connected',
  'disconnected',
  'logged_out'
])
export type EngineStatus = z.infer<typeof engineStatusSchema>

export const engineEventSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('qr'), qr: z.string() }),
  z.object({
    type: z.literal('status'),
    status: engineStatusSchema,
    meJid: z.string().optional()
  }),
  z.object({
    type: z.literal('message'),
    id: z.string().optional(),
    chat: z.string(),
    from: z.string(),
    fromMe: z.boolean(),
    text: z.string().optional(),
    timestamp: z.number().optional()
  })
])
export type EngineEvent = z.infer<typeof engineEventSchema>
