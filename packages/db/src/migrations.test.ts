import { describe, expect, it } from 'vitest'
import { migrations } from './migrations/index'

describe('migrations', () => {
  it('has at least one migration', () => {
    expect(migrations.length).toBeGreaterThan(0)
  })

  it('uses unique ids', () => {
    const ids = migrations.map((migration) => migration.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('has non-empty sql for every migration', () => {
    for (const migration of migrations) {
      expect(migration.sql.trim().length).toBeGreaterThan(0)
    }
  })
})
