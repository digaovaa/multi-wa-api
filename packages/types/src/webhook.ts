import { z } from 'zod'

export const webhookEventTypeSchema = z.enum(['qr', 'status', 'message'])
export type WebhookEventType = z.infer<typeof webhookEventTypeSchema>

export const createWebhookInputSchema = z.object({
  url: z.string().url(),
  events: z.array(webhookEventTypeSchema).min(1),
  secret: z.string().min(16).max(256).optional()
})
export type CreateWebhookInput = z.infer<typeof createWebhookInputSchema>

export const webhookSchema = z.object({
  id: z.string().uuid(),
  url: z.string(),
  events: z.array(webhookEventTypeSchema),
  active: z.boolean(),
  createdAt: z.string()
})
export type Webhook = z.infer<typeof webhookSchema>

export const webhookCreatedSchema = webhookSchema.extend({
  secret: z.string()
})
export type WebhookCreated = z.infer<typeof webhookCreatedSchema>
