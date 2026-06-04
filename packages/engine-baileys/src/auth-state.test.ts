import type { Pool } from '@multi-wa/db'
import { describe, expect, it } from 'vitest'
import { reviveBuffers, usePostgresAuthState } from './auth-state'

interface Captured {
  text: string
  values: unknown[]
}

function fakePool(): { pool: Pool; queries: Captured[] } {
  const queries: Captured[] = []
  const record = (text: string | { text: string }, values?: unknown[]) => {
    queries.push({ text: typeof text === 'string' ? text : text.text, values: values ?? [] })
    return { rows: [], rowCount: 0 }
  }
  const client = {
    query: async (t: string | { text: string }, v?: unknown[]) => record(t, v),
    release: () => undefined
  }
  const pool = {
    query: async (t: string | { text: string }, v?: unknown[]) => record(t, v),
    connect: async () => client
  }
  return { pool: pool as unknown as Pool, queries }
}

describe('usePostgresAuthState', () => {
  it('writes key sets atomically in a single batched transaction', async () => {
    const { pool, queries } = fakePool()
    const { state } = await usePostgresAuthState(pool, 'session-1')

    await state.keys.set({ 'device-list': { '5511@s.whatsapp.net': ['34', '0'] } })

    expect(queries.some((q) => q.text === 'BEGIN')).toBe(true)
    expect(queries.some((q) => q.text === 'COMMIT')).toBe(true)
    const insert = queries.find((q) => q.text.includes('INSERT INTO baileys_auth'))
    expect(insert).toBeDefined()
    const values = insert!.values[3] as string[]
    expect(Array.isArray(values)).toBe(true)
    expect(JSON.parse(values[0]!)).toEqual(['34', '0'])
  })

  it('persists credentials as a JSON string', async () => {
    const { pool, queries } = fakePool()
    const { saveCreds } = await usePostgresAuthState(pool, 'session-1')
    await saveCreds()
    const insert = queries.find((q) => q.text.includes('INSERT INTO baileys_auth'))
    expect(insert).toBeDefined()
    const values = insert!.values[3] as string[]
    expect(typeof values[0]).toBe('string')
    expect(() => JSON.parse(values[0]!)).not.toThrow()
  })
})

describe('reviveBuffers', () => {
  it('restores buffers from the BufferJSON shape without a JSON round-trip', () => {
    const serialized = {
      nested: { key: { type: 'Buffer', data: Buffer.from('hello').toString('base64') } },
      list: [{ type: 'Buffer', data: Buffer.from('hi').toString('base64') }],
      plain: 'value'
    }
    const revived = reviveBuffers<{
      nested: { key: Buffer }
      list: Buffer[]
      plain: string
    }>(serialized)
    expect(Buffer.isBuffer(revived.nested.key)).toBe(true)
    expect(revived.nested.key.toString()).toBe('hello')
    expect(Buffer.isBuffer(revived.list[0])).toBe(true)
    expect(revived.plain).toBe('value')
  })
})
