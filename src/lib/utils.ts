import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
  }).format(amount)
}

export function formatDate(date: Date | string): string {
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(date))
}

export const INDIA_STATES = [
  'Andhra Pradesh',
  'Arunachal Pradesh',
  'Assam',
  'Bihar',
  'Chhattisgarh',
  'Goa',
  'Gujarat',
  'Haryana',
  'Himachal Pradesh',
  'Jharkhand',
  'Karnataka',
  'Kerala',
  'Madhya Pradesh',
  'Maharashtra',
  'Manipur',
  'Meghalaya',
  'Mizoram',
  'Nagaland',
  'Odisha',
  'Punjab',
  'Rajasthan',
  'Sikkim',
  'Tamil Nadu',
  'Telangana',
  'Tripura',
  'Uttar Pradesh',
  'Uttarakhand',
  'West Bengal',
  'Andaman and Nicobar Islands',
  'Chandigarh',
  'Dadra and Nagar Haveli and Daman and Diu',
  'Delhi',
  'Jammu and Kashmir',
  'Ladakh',
  'Lakshadweep',
  'Puducherry',
]

export const GST_RATE = 0.18 // Default fallback GST rate

/** Calculate GST breakdown based on same-state (CGST+SGST) vs inter-state (IGST) rules */
export function calcGST(
  taxableAmount: number,
  gstRatePct: number,  // e.g. 18 for 18%
  sameState: boolean
): { gstAmount: number; cgstAmount: number; sgstAmount: number; igstAmount: number } {
  const gstAmount = (taxableAmount * gstRatePct) / 100
  if (sameState) {
    const half = gstAmount / 2
    return { gstAmount, cgstAmount: half, sgstAmount: half, igstAmount: 0 }
  }
  return { gstAmount, cgstAmount: 0, sgstAmount: 0, igstAmount: gstAmount }
}

/** Apply trade discount to a unit price */
export function applyTradeDiscount(price: number, discountPct: number): number {
  return price * (1 - discountPct / 100)
}

