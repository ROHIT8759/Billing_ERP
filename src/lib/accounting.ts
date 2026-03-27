import {
  AccountCategory,
  AccountType,
  Prisma,
  VoucherType,
} from '@prisma/client'
import { prisma } from '@/lib/prisma'

const DEFAULT_ACCOUNTS = [
  {
    code: '1000',
    name: 'Cash',
    category: AccountCategory.ASSET,
    type: AccountType.CASH,
  },
  {
    code: '1010',
    name: 'Bank',
    category: AccountCategory.ASSET,
    type: AccountType.BANK,
  },
  {
    code: '1100',
    name: 'Accounts Receivable',
    category: AccountCategory.ASSET,
    type: AccountType.CUSTOMER,
  },
  {
    code: '1200',
    name: 'Inventory Stock',
    category: AccountCategory.ASSET,
    type: AccountType.INVENTORY,
  },
  {
    code: '2000',
    name: 'Accounts Payable',
    category: AccountCategory.LIABILITY,
    type: AccountType.SUPPLIER,
  },
  {
    code: '3000',
    name: 'Owner Equity',
    category: AccountCategory.EQUITY,
    type: AccountType.EQUITY,
  },
  {
    code: '4000',
    name: 'Sales',
    category: AccountCategory.INCOME,
    type: AccountType.SALES,
  },
  {
    code: '4010',
    name: 'Sales Returns',
    category: AccountCategory.EXPENSE,
    type: AccountType.SALES_RETURN,
  },
  {
    code: '5000',
    name: 'Purchases',
    category: AccountCategory.EXPENSE,
    type: AccountType.PURCHASE,
  },
  {
    code: '5010',
    name: 'Purchase Returns',
    category: AccountCategory.INCOME,
    type: AccountType.PURCHASE_RETURN,
  },
  {
    code: '6000',
    name: 'General Expenses',
    category: AccountCategory.EXPENSE,
    type: AccountType.EXPENSE,
  },
  {
    code: '6010',
    name: 'Inventory Loss / Wastage',
    category: AccountCategory.EXPENSE,
    type: AccountType.STOCK_WRITE_OFF,
  },
] as const

type Tx = Prisma.TransactionClient | typeof prisma

type JournalLineInput = {
  accountId: string
  debit?: number
  credit?: number
}

function round2(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

export function derivePaymentStatus(
  totalAmount: number,
  outstandingAmount: number,
  dueDate?: Date | null,
  now = new Date()
) {
  const normalizedTotal = round2(totalAmount)
  const normalizedOutstanding = round2(outstandingAmount)

  if (normalizedOutstanding <= 0) {
    return 'PAID'
  }

  if (normalizedOutstanding > 0 && normalizedOutstanding < normalizedTotal) {
    return 'PARTIAL'
  }

  if (normalizedOutstanding === normalizedTotal && dueDate && dueDate < now) {
    return 'OVERDUE'
  }

  return 'UNPAID'
}

export function assertAllocationAmountValid(amount: number, outstanding: number) {
  const normalizedAmount = round2(amount)
  const normalizedOutstanding = round2(outstanding)

  if (normalizedAmount <= 0) {
    throw new Error('Allocation amount must be greater than zero')
  }

  if (normalizedAmount > normalizedOutstanding) {
    throw new Error('Allocation amount cannot exceed outstanding amount')
  }
}

export async function recomputeInvoicePaymentState(tx: Tx, invoiceId: string) {
  const [allocationTotal, invoice] = await Promise.all([
    tx.invoiceAllocation.aggregate({
      where: { invoiceId },
      _sum: { amount: true },
    }),
    tx.invoice.findUnique({
      where: { id: invoiceId },
      select: {
        id: true,
        totalAmount: true,
        dueDate: true,
      },
    }),
  ])

  if (!invoice) {
    throw new Error('Invoice not found')
  }

  const now = new Date()
  const paidAmount = round2(Number(allocationTotal._sum.amount || 0))
  const outstandingAmount = Math.max(round2(invoice.totalAmount - paidAmount), 0)
  const paymentStatus = derivePaymentStatus(
    invoice.totalAmount,
    outstandingAmount,
    invoice.dueDate,
    now
  )

  return tx.invoice.update({
    where: { id: invoiceId },
    data: {
      paidAmount,
      outstandingAmount,
      paymentStatus,
      lastPaymentAt: paidAmount > 0 ? now : null,
    },
  })
}

export async function recomputePurchasePaymentState(tx: Tx, purchaseId: string) {
  const [allocationTotal, purchase] = await Promise.all([
    tx.purchaseAllocation.aggregate({
      where: { purchaseId },
      _sum: { amount: true },
    }),
    tx.purchase.findUnique({
      where: { id: purchaseId },
      select: {
        id: true,
        totalAmount: true,
        dueDate: true,
      },
    }),
  ])

  if (!purchase) {
    throw new Error('Purchase not found')
  }

  const now = new Date()
  const paidAmount = round2(Number(allocationTotal._sum.amount || 0))
  const outstandingAmount = Math.max(round2(purchase.totalAmount - paidAmount), 0)
  const paymentStatus = derivePaymentStatus(
    purchase.totalAmount,
    outstandingAmount,
    purchase.dueDate,
    now
  )

  return tx.purchase.update({
    where: { id: purchaseId },
    data: {
      paidAmount,
      outstandingAmount,
      paymentStatus,
      lastPaymentAt: paidAmount > 0 ? now : null,
    },
  })
}

export async function createInvoiceAllocation(
  tx: Tx,
  input: {
    shopId: string
    invoiceId: string
    journalEntryId: string
    amount: number
    allocatedAt?: Date
  }
) {
  return tx.invoiceAllocation.create({
    data: {
      shopId: input.shopId,
      invoiceId: input.invoiceId,
      journalEntryId: input.journalEntryId,
      amount: round2(input.amount),
      allocatedAt: input.allocatedAt || new Date(),
    },
  })
}

export async function createPurchaseAllocation(
  tx: Tx,
  input: {
    shopId: string
    purchaseId: string
    journalEntryId: string
    amount: number
    allocatedAt?: Date
  }
) {
  return tx.purchaseAllocation.create({
    data: {
      shopId: input.shopId,
      purchaseId: input.purchaseId,
      journalEntryId: input.journalEntryId,
      amount: round2(input.amount),
      allocatedAt: input.allocatedAt || new Date(),
    },
  })
}

async function nextSequenceCode(tx: Tx, shopId: string, prefix: 'CUS' | 'SUP') {
  const accounts = await tx.account.findMany({
    where: {
      shopId,
      code: {
        startsWith: `${prefix}-`,
      },
    },
    select: { code: true },
  })

  const maxCode = accounts.reduce((max, account) => {
    const seq = Number.parseInt(account.code.split('-')[1] || '0', 10)
    return Number.isFinite(seq) ? Math.max(max, seq) : max
  }, 0)

  return `${prefix}-${String(maxCode + 1).padStart(4, '0')}`
}

export async function ensureAccountingSetup(shopId: string, tx: Tx = prisma) {
  for (const account of DEFAULT_ACCOUNTS) {
    await tx.account.upsert({
      where: {
        shopId_code: {
          shopId,
          code: account.code,
        },
      },
      update: {
        name: account.name,
        category: account.category,
        type: account.type,
        isSystem: true,
        isActive: true,
      },
      create: {
        shopId,
        code: account.code,
        name: account.name,
        category: account.category,
        type: account.type,
        isSystem: true,
      },
    })
  }

  const customers = await tx.customer.findMany({
    where: { shopId, accountId: null },
    select: { id: true, name: true },
  })

  for (const customer of customers) {
    await ensureCustomerAccount(tx, shopId, customer.id, customer.name)
  }

  const suppliers = await tx.supplier.findMany({
    where: { shopId, accountId: null },
    select: { id: true, name: true },
  })

  for (const supplier of suppliers) {
    await ensureSupplierAccount(tx, shopId, supplier.id, supplier.name)
  }
}

export async function getSystemAccount(tx: Tx, shopId: string, type: AccountType) {
  await ensureAccountingSetup(shopId, tx)

  const account = await tx.account.findFirst({
    where: { shopId, type, isSystem: true },
  })

  if (!account) {
    throw new Error(`System account missing for ${type}`)
  }

  return account
}

export async function ensureCustomerAccount(
  tx: Tx,
  shopId: string,
  customerId: string,
  customerName: string
) {
  const existingCustomer = await tx.customer.findUnique({
    where: { id: customerId },
    include: { account: true },
  })

  if (!existingCustomer) {
    throw new Error('Customer not found')
  }

  if (existingCustomer.account) {
    if (existingCustomer.account.name !== customerName) {
      await tx.account.update({
        where: { id: existingCustomer.account.id },
        data: { name: `${customerName} (Debtor)` },
      })
    }

    return existingCustomer.account
  }

  const code = await nextSequenceCode(tx, shopId, 'CUS')
  const account = await tx.account.create({
    data: {
      shopId,
      code,
      name: `${customerName} (Debtor)`,
      category: AccountCategory.ASSET,
      type: AccountType.CUSTOMER,
    },
  })

  await tx.customer.update({
    where: { id: customerId },
    data: { accountId: account.id },
  })

  return account
}

export async function ensureSupplierAccount(
  tx: Tx,
  shopId: string,
  supplierId: string,
  supplierName: string
) {
  const existingSupplier = await tx.supplier.findUnique({
    where: { id: supplierId },
    include: { account: true },
  })

  if (!existingSupplier) {
    throw new Error('Supplier not found')
  }

  if (existingSupplier.account) {
    if (existingSupplier.account.name !== `${supplierName} (Creditor)`) {
      await tx.account.update({
        where: { id: existingSupplier.account.id },
        data: { name: `${supplierName} (Creditor)` },
      })
    }

    return existingSupplier.account
  }

  const code = await nextSequenceCode(tx, shopId, 'SUP')
  const account = await tx.account.create({
    data: {
      shopId,
      code,
      name: `${supplierName} (Creditor)`,
      category: AccountCategory.LIABILITY,
      type: AccountType.SUPPLIER,
    },
  })

  await tx.supplier.update({
    where: { id: supplierId },
    data: { accountId: account.id },
  })

  return account
}

export async function findOrCreateSupplier(
  tx: Tx,
  shopId: string,
  supplierName: string
) {
  let supplier = await tx.supplier.findFirst({
    where: {
      shopId,
      name: {
        equals: supplierName,
        mode: 'insensitive',
      },
    },
    include: { account: true },
  })

  if (!supplier) {
    supplier = await tx.supplier.create({
      data: {
        shopId,
        name: supplierName,
      },
      include: { account: true },
    })
  }

  const account = await ensureSupplierAccount(tx, shopId, supplier.id, supplier.name)
  return { supplier, account }
}

function voucherPrefix(voucherType: VoucherType) {
  const prefixes: Record<VoucherType, string> = {
    SALES: 'SAL',
    PURCHASE: 'PUR',
    RECEIPT: 'RCP',
    PAYMENT: 'PAY',
    CREDIT_NOTE: 'CRN',
    DEBIT_NOTE: 'DBN',
    OPENING: 'OPN',
  }

  return prefixes[voucherType]
}

async function nextEntryNo(tx: Tx, shopId: string, voucherType: VoucherType) {
  const prefix = voucherPrefix(voucherType)
  const count = await tx.journalEntry.count({
    where: { shopId, voucherType },
  })
  return `${prefix}-${String(count + 1).padStart(5, '0')}`
}

export async function postJournalEntry(
  tx: Tx,
  input: {
    shopId: string
    voucherType: VoucherType
    entryDate?: Date
    reference?: string | null
    narration?: string | null
    sourceModel?: string | null
    sourceId?: string | null
    lines: JournalLineInput[]
  }
) {
  const lines = input.lines
    .map((line) => ({
      accountId: line.accountId,
      debit: round2(line.debit || 0),
      credit: round2(line.credit || 0),
    }))
    .filter((line) => line.debit > 0 || line.credit > 0)

  if (lines.length < 2) {
    throw new Error('A journal entry requires at least two lines')
  }

  const totalDebit = round2(lines.reduce((sum, line) => sum + line.debit, 0))
  const totalCredit = round2(lines.reduce((sum, line) => sum + line.credit, 0))

  if (totalDebit <= 0 || totalCredit <= 0 || totalDebit !== totalCredit) {
    throw new Error('Journal entry is not balanced')
  }

  return tx.journalEntry.create({
    data: {
      shopId: input.shopId,
      entryNo: await nextEntryNo(tx, input.shopId, input.voucherType),
      voucherType: input.voucherType,
      entryDate: input.entryDate || new Date(),
      reference: input.reference || null,
      narration: input.narration || null,
      sourceModel: input.sourceModel || null,
      sourceId: input.sourceId || null,
      lines: {
        create: lines,
      },
    },
    include: {
      lines: {
        include: {
          account: true,
        },
      },
    },
  })
}

export async function deleteJournalEntriesForSource(
  tx: Tx,
  shopId: string,
  sourceModel: string,
  sourceId: string
) {
  await tx.journalEntry.deleteMany({
    where: {
      shopId,
      sourceModel,
      sourceId,
    },
  })
}
