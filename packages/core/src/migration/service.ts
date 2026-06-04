import type { EngineKind } from '@multi-wa/types'
import { migrate } from 'wa-store-migrate'
import type { EngineOptions, SnapshotRegistry } from '../engine/types'
import type { Logger } from '../lib/logger'

export interface MigrationLoss {
  domain: string
  severity: string
  count: number
}

export class MigrationService {
  constructor(
    private readonly snapshots: SnapshotRegistry,
    private readonly logger: Logger
  ) {}

  async migrate(
    options: EngineOptions,
    from: EngineKind,
    to: EngineKind
  ): Promise<MigrationLoss[]> {
    const source = await this.snapshots[from].read(options)
    const result = migrate({ from, to, data: source })
    await this.snapshots[to].write(options, result.data)
    await this.snapshots[from].clear(options).catch((error) => {
      this.logger.warn({ err: error }, 'failed to clear source store after migration')
    })
    return (result.losses ?? []) as MigrationLoss[]
  }
}
