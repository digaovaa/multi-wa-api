import type { EngineOptions, EngineSnapshotAdapter } from '@multi-wa/core'
import type { Pool, PoolClient } from '@multi-wa/db'
import {
  BufferJSON,
  initAuthCreds,
  proto,
  type AuthenticationCreds,
  type AuthenticationState,
  type SignalDataTypeMap
} from 'baileys'

const CREDS_CATEGORY = 'creds'
const CREDS_ID = 'creds'

type Queryable = Pick<Pool, 'query'> | Pick<PoolClient, 'query'>

interface AuthRow {
  category: string
  itemId: string
  value: string
}

function serialize(value: unknown): string {
  return JSON.stringify(value, BufferJSON.replacer)
}

export function reviveBuffers<T>(value: unknown): T {
  if (value === null || typeof value !== 'object') return value as T
  if (Array.isArray(value)) return value.map((item) => reviveBuffers(item)) as T
  const record = value as Record<string, unknown>
  if (record.type === 'Buffer' && typeof record.data === 'string') {
    return Buffer.from(record.data, 'base64') as T
  }
  const revived: Record<string, unknown> = {}
  for (const key of Object.keys(record)) revived[key] = reviveBuffers(record[key])
  return revived as T
}

async function writeRows(executor: Queryable, sessionId: string, rows: AuthRow[]): Promise<void> {
  if (rows.length === 0) return
  await executor.query(
    `INSERT INTO baileys_auth (session_id, category, item_id, value)
     SELECT $1, src.category, src.item_id, src.value::jsonb
     FROM unnest($2::text[], $3::text[], $4::text[]) AS src(category, item_id, value)
     ON CONFLICT (session_id, category, item_id) DO UPDATE SET value = EXCLUDED.value`,
    [sessionId, rows.map((r) => r.category), rows.map((r) => r.itemId), rows.map((r) => r.value)]
  )
}

async function deleteRows(
  executor: Queryable,
  sessionId: string,
  rows: { category: string; itemId: string }[]
): Promise<void> {
  if (rows.length === 0) return
  await executor.query(
    `DELETE FROM baileys_auth
     WHERE session_id = $1
       AND (category, item_id) IN (
         SELECT d.category, d.item_id FROM unnest($2::text[], $3::text[]) AS d(category, item_id)
       )`,
    [sessionId, rows.map((r) => r.category), rows.map((r) => r.itemId)]
  )
}

async function loadCreds(pool: Pool, sessionId: string): Promise<AuthenticationCreds | null> {
  const { rows } = await pool.query<{ value: unknown }>(
    `SELECT value FROM baileys_auth WHERE session_id = $1 AND category = $2 AND item_id = $3`,
    [sessionId, CREDS_CATEGORY, CREDS_ID]
  )
  return rows[0] ? reviveBuffers<AuthenticationCreds>(rows[0].value) : null
}

export interface PostgresAuthState {
  state: AuthenticationState
  saveCreds: () => Promise<void>
}

export async function usePostgresAuthState(
  pool: Pool,
  sessionId: string
): Promise<PostgresAuthState> {
  const creds = (await loadCreds(pool, sessionId)) ?? initAuthCreds()

  return {
    state: {
      creds,
      keys: {
        async get(type, ids) {
          const { rows } = await pool.query<{ item_id: string; value: unknown }>(
            `SELECT item_id, value FROM baileys_auth
             WHERE session_id = $1 AND category = $2 AND item_id = ANY($3::text[])`,
            [sessionId, type, ids]
          )
          const result: { [id: string]: SignalDataTypeMap[typeof type] } = {}
          for (const row of rows) {
            const revived = reviveBuffers<unknown>(row.value)
            const value =
              type === 'app-state-sync-key' && revived
                ? proto.Message.AppStateSyncKeyData.fromObject(revived as Record<string, unknown>)
                : revived
            result[row.item_id] = value as SignalDataTypeMap[typeof type]
          }
          return result
        },
        async set(data) {
          const upserts: AuthRow[] = []
          const deletes: { category: string; itemId: string }[] = []
          for (const category of Object.keys(data)) {
            const entries = data[category as keyof typeof data]
            if (!entries) continue
            for (const itemId of Object.keys(entries)) {
              const value = entries[itemId]
              if (value) upserts.push({ category, itemId, value: serialize(value) })
              else deletes.push({ category, itemId })
            }
          }
          if (upserts.length === 0 && deletes.length === 0) return
          const client = await pool.connect()
          try {
            await client.query('BEGIN')
            await writeRows(client, sessionId, upserts)
            await deleteRows(client, sessionId, deletes)
            await client.query('COMMIT')
          } catch (error) {
            await client.query('ROLLBACK')
            throw error
          } finally {
            client.release()
          }
        }
      }
    },
    async saveCreds() {
      await writeRows(pool, sessionId, [
        { category: CREDS_CATEGORY, itemId: CREDS_ID, value: serialize(creds) }
      ])
    }
  }
}

export interface BaileysSnapshot {
  creds: AuthenticationCreds
  keys: Record<string, Record<string, unknown>>
}

export async function readBaileysSnapshot(pool: Pool, sessionId: string): Promise<BaileysSnapshot> {
  const creds = await loadCreds(pool, sessionId)
  if (!creds) throw new Error('no baileys credentials to migrate')
  const { rows } = await pool.query<{ category: string; item_id: string; value: unknown }>(
    `SELECT category, item_id, value FROM baileys_auth WHERE session_id = $1 AND category <> $2`,
    [sessionId, CREDS_CATEGORY]
  )
  const keys: Record<string, Record<string, unknown>> = {}
  for (const row of rows) {
    ;(keys[row.category] ??= {})[row.item_id] = reviveBuffers(row.value)
  }
  return { creds, keys }
}

export async function writeBaileysSnapshot(
  pool: Pool,
  sessionId: string,
  data: BaileysSnapshot
): Promise<void> {
  const rows: AuthRow[] = [
    { category: CREDS_CATEGORY, itemId: CREDS_ID, value: serialize(data.creds) }
  ]
  for (const category of Object.keys(data.keys)) {
    const entries = data.keys[category] ?? {}
    for (const itemId of Object.keys(entries)) {
      rows.push({ category, itemId, value: serialize(entries[itemId]) })
    }
  }
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await client.query(`DELETE FROM baileys_auth WHERE session_id = $1`, [sessionId])
    await writeRows(client, sessionId, rows)
    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

export async function clearBaileys(pool: Pool, sessionId: string): Promise<void> {
  await pool.query(`DELETE FROM baileys_auth WHERE session_id = $1`, [sessionId])
}

export const baileysSnapshotAdapter: EngineSnapshotAdapter = {
  read: (options: EngineOptions) => readBaileysSnapshot(options.pool, options.sessionId),
  write: (options: EngineOptions, data: unknown) =>
    writeBaileysSnapshot(options.pool, options.sessionId, data as BaileysSnapshot),
  clear: (options: EngineOptions) => clearBaileys(options.pool, options.sessionId)
}
