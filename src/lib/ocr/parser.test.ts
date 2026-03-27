import { describe, expect, it } from 'vitest'
import { parseOCRText } from './parser'

describe('parseOCRText', () => {
  it('returns empty structure for empty input', () => {
    expect(parseOCRText('')).toEqual({
      vendorName: '',
      gstNumber: '',
      totalAmount: 0,
      items: [],
    })
  })

  it('extracts vendor, GST, total and at least one item', () => {
    const text = [
      'ABC MEDICALS',
      'TAX INVOICE',
      'GSTIN: 29ABCDE1234F1Z5',
      'Description Qty Rate Amount',
      'Paracetamol 2 50.00 100.00',
      'Grand Total 100.00',
    ].join('\n')

    const out = parseOCRText(text)
    expect(out.vendorName).toBe('ABC MEDICALS')
    expect(out.gstNumber).toBe('29ABCDE1234F1Z5')
    expect(out.totalAmount).toBe(100)
    expect(out.items.length).toBeGreaterThan(0)
  })

  it('falls back to generic item when no table is found', () => {
    const out = parseOCRText('Simple receipt\nAmount Payable 249.00')
    expect(out.totalAmount).toBe(249)
    expect(out.items).toEqual([
      {
        name: 'Scanned Items (Auto)',
        quantity: 1,
        price: 249,
      },
    ])
  })
})
