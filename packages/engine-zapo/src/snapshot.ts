import type { EngineOptions, EngineSnapshotAdapter } from '@multi-wa/core'
import type { WaStore } from 'zapo-js'
import { buildZapoStore } from './store'

type ZapoSession = ReturnType<WaStore['session']>
type Credentials = Parameters<ZapoSession['auth']['save']>[0]
type PreKey = Parameters<ZapoSession['preKey']['putPreKey']>[0]
type IdentityList = Parameters<ZapoSession['identity']['setRemoteIdentities']>[0]
type SessionList = Parameters<ZapoSession['session']['setSessionsBatch']>[0]
type SessionEntry = SessionList[number]
type SenderKeyRecord = Parameters<ZapoSession['senderKey']['upsertSenderKey']>[0]
type SyncKeys = Parameters<ZapoSession['appState']['upsertSyncKeys']>[0]
type CollectionStates = Parameters<ZapoSession['appState']['setCollectionStates']>[0]
type CollectionName = CollectionStates[number]['collection']
type PrivacyTokens = Parameters<ZapoSession['privacyToken']['upsertBatch']>[0]
type DeviceLists = Parameters<ZapoSession['deviceList']['upsertUserDevicesBatch']>[0]

interface ZapoSnapshot {
  credentials: Credentials
  preKeys?: readonly PreKey[]
  identities?: IdentityList
  sessions?: readonly { address: SessionEntry['address']; record: SessionEntry['session'] }[]
  senderKeys?: readonly { record: SenderKeyRecord }[]
  appState?: {
    keys: SyncKeys
    collections: Record<
      string,
      { version: number; hash: Uint8Array; indexValueMap: Record<string, Uint8Array> }
    >
  }
  privacyTokens?: PrivacyTokens
  deviceLists?: DeviceLists
}

export async function readZapoSnapshot(options: EngineOptions): Promise<unknown> {
  const { store } = buildZapoStore(options.pool, options.tablePrefix)
  const session = store.session(options.sessionId)
  const credentials = await session.auth.load()
  if (!credentials) throw new Error('no zapo credentials to migrate')
  const appState = await session.appState.exportData()
  return { credentials, appState }
}

export async function writeZapoSnapshot(options: EngineOptions, data: unknown): Promise<void> {
  const snapshot = data as ZapoSnapshot
  const { store } = buildZapoStore(options.pool, options.tablePrefix)
  const session = store.session(options.sessionId)

  await session.auth.save(snapshot.credentials)

  for (const preKey of snapshot.preKeys ?? []) {
    await session.preKey.putPreKey(preKey)
  }

  if (snapshot.identities?.length) {
    await session.identity.setRemoteIdentities(snapshot.identities)
  }

  if (snapshot.sessions?.length) {
    await session.session.setSessionsBatch(
      snapshot.sessions.map((item) => ({ address: item.address, session: item.record }))
    )
  }

  for (const senderKey of snapshot.senderKeys ?? []) {
    await session.senderKey.upsertSenderKey(senderKey.record)
  }

  if (snapshot.appState) {
    await session.appState.upsertSyncKeys(snapshot.appState.keys)
    const updates: CollectionStates = Object.entries(snapshot.appState.collections).map(
      ([collection, value]) => ({
        collection: collection as CollectionName,
        version: value.version,
        hash: value.hash,
        indexValueMap: new Map(Object.entries(value.indexValueMap))
      })
    )
    if (updates.length > 0) await session.appState.setCollectionStates(updates)
  }

  if (snapshot.privacyTokens?.length) {
    await session.privacyToken.upsertBatch(snapshot.privacyTokens)
  }

  if (snapshot.deviceLists?.length) {
    await session.deviceList.upsertUserDevicesBatch(snapshot.deviceLists)
  }
}

export async function clearZapo(options: EngineOptions): Promise<void> {
  const { store } = buildZapoStore(options.pool, options.tablePrefix)
  const session = store.session(options.sessionId)
  await Promise.allSettled([
    session.auth.clear(),
    session.signal.clear(),
    session.preKey.clear(),
    session.session.clear(),
    session.identity.clear(),
    session.senderKey.clear(),
    session.appState.clear(),
    session.privacyToken.clear(),
    session.deviceList.clear()
  ])
}

export const zapoSnapshotAdapter: EngineSnapshotAdapter = {
  read: readZapoSnapshot,
  write: writeZapoSnapshot,
  clear: clearZapo
}
