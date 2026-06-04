import { describe, expect, it } from 'vitest'
import { parseCorsOrigins } from './env'

describe('parseCorsOrigins', () => {
  it('returns true for wildcard or blank values', () => {
    expect(parseCorsOrigins('*')).toBe(true)
    expect(parseCorsOrigins('')).toBe(true)
    expect(parseCorsOrigins('   ')).toBe(true)
  })

  it('splits a comma separated list and trims entries', () => {
    expect(parseCorsOrigins('https://a.com, https://b.com')).toEqual([
      'https://a.com',
      'https://b.com'
    ])
  })

  it('drops empty entries', () => {
    expect(parseCorsOrigins('https://a.com, ,https://b.com,')).toEqual([
      'https://a.com',
      'https://b.com'
    ])
  })
})
