import { describe, expect, it } from 'vitest'
import { assertAllocationAmountValid, derivePaymentStatus } from './accounting'

describe('accounting helpers', () => {
  it('derivePaymentStatus returns PAID when outstanding <= 0', () => {
    expect(derivePaymentStatus(1000, 0)).toBe('PAID')
    expect(derivePaymentStatus(1000, -1)).toBe('PAID')
  })

  it('derivePaymentStatus returns PARTIAL when partly paid', () => {
    expect(derivePaymentStatus(1000, 200)).toBe('PARTIAL')
  })

  it('derivePaymentStatus returns OVERDUE when due date passed and nothing paid', () => {
    const now = new Date('2026-03-27T00:00:00.000Z')
    const due = new Date('2026-03-20T00:00:00.000Z')
    expect(derivePaymentStatus(1000, 1000, due, now)).toBe('OVERDUE')
  })

  it('derivePaymentStatus returns UNPAID when due date not passed', () => {
    const now = new Date('2026-03-20T00:00:00.000Z')
    const due = new Date('2026-03-27T00:00:00.000Z')
    expect(derivePaymentStatus(1000, 1000, due, now)).toBe('UNPAID')
  })

  it('assertAllocationAmountValid throws for invalid inputs', () => {
    expect(() => assertAllocationAmountValid(0, 100)).toThrow('Allocation amount must be greater than zero')
    expect(() => assertAllocationAmountValid(101, 100)).toThrow('Allocation amount cannot exceed outstanding amount')
  })

  it('assertAllocationAmountValid accepts valid amount', () => {
    expect(() => assertAllocationAmountValid(99.99, 100)).not.toThrow()
  })
})
