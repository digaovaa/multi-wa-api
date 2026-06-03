import { z } from 'zod'

export const loginInputSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
})
export type LoginInput = z.infer<typeof loginInputSchema>

export const refreshInputSchema = z.object({
  refreshToken: z.string().min(1)
})
export type RefreshInput = z.infer<typeof refreshInputSchema>

export const tokenPairSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  expiresIn: z.number()
})
export type TokenPair = z.infer<typeof tokenPairSchema>

export const createApiKeyInputSchema = z.object({
  name: z.string().min(1).max(120)
})
export type CreateApiKeyInput = z.infer<typeof createApiKeyInputSchema>

export const apiKeySchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  prefix: z.string(),
  createdAt: z.string(),
  lastUsedAt: z.string().nullable()
})
export type ApiKey = z.infer<typeof apiKeySchema>

export const apiKeyCreatedSchema = apiKeySchema.extend({
  key: z.string()
})
export type ApiKeyCreated = z.infer<typeof apiKeyCreatedSchema>
