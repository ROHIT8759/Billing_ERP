import { VoucherType } from '@prisma/client'
import { describe, expect, it, vi } from 'vitest'
import {
  postJournalEntry,
  recomputeInvoicePaymentState,
  recomputePurchasePaymentState,
} from './accounting'

describe('accounting edge behaviors', () => {
  it('postJournalEntry rejects single-line effective entries', async () => {
    const tx = {
      journalEntry: { count: vi.fn(), create: vi.fn() },
    }

    await expect(
      postJournalEntry(tx as any, {
        shopId: 'shop1',
        voucherType: VoucherType.SALES,
        lines: [{ accountId: 'a1', debit: 100 }],
      })
    ).rejects.toThrow('A journal entry requires at least two lines')
  })

  it('postJournalEntry rejects unbalanced entries', async () => {
    const tx = {
      journalEntry: { count: vi.fn(), create: vi.fn() },
    }

    await expect(
      postJournalEntry(tx as any, {
        shopId: 'shop1',
        voucherType: VoucherType.SALES,
        lines: [
          { accountId: 'a1', debit: 100 },
          { accountId: 'a2', credit: 90 },
        ],
      })
    ).rejects.toThrow('Journal entry is not balanced')
  })

  it('postJournalEntry creates rounded balanced entry with generated number', async () => {
    const tx = {
      journalEntry: {
        count: vi.fn().mockResolvedValue(0),
        create: vi.fn().mockResolvedValue({ id: 'je1' }),
      },
    }

    const out = await postJournalEntry(tx as any, {
      shopId: 'shop1',
      voucherType: VoucherType.SALES,
      lines: [
        { accountId: 'a1', debit: 100.005 },
        { accountId: 'a2', credit: 100.005 },
      ],
    })

    expect(tx.journalEntry.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          entryNo: 'SAL-00001',
        }),
      })
    )
    expect(out).toEqual({ id: 'je1' })
  })

  it('recomputeInvoicePaymentState throws when invoice missing', async () => {
    const tx = {
      invoiceAllocation: { aggregate: vi.fn().mockResolvedValue({ _sum: { amount: 10 } }) },
      invoice: {
        findUnique: vi.fn().mockResolvedValue(null),
        update: vi.fn(),
      },
    }

    await expect(recomputeInvoicePaymentState(tx as any, 'inv1')).rejects.toThrow('Invoice not found')
  })

  it('recomputeInvoicePaymentState marks PARTIAL with outstanding', async () => {
    const tx = {
      invoiceAllocation: { aggregate: vi.fn().mockResolvedValue({ _sum: { amount: 30 } }) },
      invoice: {
        findUnique: vi.fn().mockResolvedValue({ id: 'inv1', totalAmount: 100, dueDate: null }),
        update: vi.fn().mockResolvedValue({ id: 'inv1', paymentStatus: 'PARTIAL' }),
      },
    }

    const out = await recomputeInvoicePaymentState(tx as any, 'inv1')
    expect(tx.invoice.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          paidAmount: 30,
          outstandingAmount: 70,
          paymentStatus: 'PARTIAL',
        }),
      })
    )
    expect(out).toEqual({ id: 'inv1', paymentStatus: 'PARTIAL' })
  })

  it('recomputePurchasePaymentState marks OVERDUE when full outstanding past due', async () => {
    const tx = {
      purchaseAllocation: { aggregate: vi.fn().mockResolvedValue({ _sum: { amount: 0 } }) },
      purchase: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'p1',
          totalAmount: 100,
          dueDate: new Date('2026-03-20T00:00:00.000Z'),
        }),
        update: vi.fn().mockResolvedValue({ id: 'p1', paymentStatus: 'OVERDUE' }),
      },
    }

    const out = await recomputePurchasePaymentState(tx as any, 'p1')
    expect(tx.purchase.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          paidAmount: 0,
          outstandingAmount: 100,
          paymentStatus: 'OVERDUE',
        }),
      })
    )
    expect(out).toEqual({ id: 'p1', paymentStatus: 'OVERDUE' })
  })
})
