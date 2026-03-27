import { describe, expect, it } from 'vitest'
import { applyTradeDiscount, calcGST, cn, formatCurrency, formatDate } from './utils'

describe('utils', () => {
  it('cn merges class names safely', () => {
    expect(cn('px-2', false && 'hidden', 'px-4')).toContain('px-4')
    expect(cn('text-sm', undefined, 'font-medium')).toContain('font-medium')
  })

  it('formatCurrency formats INR', () => {
    expect(formatCurrency(1234.5)).toMatch(/₹\s?1,234\.50/)
  })

  it('formatDate formats date in en-IN format', () => {
    expect(formatDate('2026-03-27')).toMatch(/27\s+Mar\s+2026/)
  })

  it('calcGST splits CGST/SGST for same state', () => {
    const out = calcGST(1000, 18, true)
    expect(out).toEqual({
      gstAmount: 180,
      cgstAmount: 90,
      sgstAmount: 90,
      igstAmount: 0,
    })
  })

  it('calcGST returns IGST for interstate', () => {
    const out = calcGST(1000, 12, false)
    expect(out).toEqual({
      gstAmount: 120,
      cgstAmount: 0,
      sgstAmount: 0,
      igstAmount: 120,
    })
  })

  it('applyTradeDiscount reduces unit price by percent', () => {
    expect(applyTradeDiscount(250, 10)).toBe(225)
  })
})
