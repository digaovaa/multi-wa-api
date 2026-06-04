import type { Pool } from '@multi-wa/db'
import { describe, expect, it } from 'vitest'
import { usePostgresAuthState } from './auth-state'

interface Captured {
  text: string
  values: unknown[]
}

function fakePool(): { pool: Pool; queries: Captured[] } {
  const queries: Captured[] = []
  const pool = {
    query: async (text: string | { text: string }, values?: unknown[]) => {
      const sql = typeof text === 'string' ? text : text.text
      queries.push({ text: sql, values: values ?? [] })
      return { rows: [], rowCount: 0 }
    }
  }
  return { pool: pool as unknown as Pool, queries }
}

describe('usePostgresAuthState', () => {
  it('serializes array values as JSON strings (not pg array literals)', async () => {
    const { pool, queries } = fakePool()
    const { state } = await usePostgresAuthState(pool, 'session-1')

    await state.keys.set({ 'device-list': { '5511@s.whatsapp.net': ['34', '0'] } })

    const insert = queries.find((q) => q.text.includes('INSERT INTO baileys_auth'))
    expect(insert).toBeDefined()
    const value = insert!.values[3]
    expect(typeof value).toBe('string')
    expect(JSON.parse(value as string)).toEqual(['34', '0'])
  })

  it('persists credentials as a JSON string', async () => {
    const { pool, queries } = fakePool()
    const { saveCreds } = await usePostgresAuthState(pool, 'session-1')
    await saveCreds()
    const insert = queries.find(
      (q) => q.text.includes('INSERT INTO baileys_auth') && q.values[1] === 'creds'
    )
    expect(insert).toBeDefined()
    expect(typeof insert!.values[3]).toBe('string')
    expect(() => JSON.parse(insert!.values[3] as string)).not.toThrow()
  })
})
