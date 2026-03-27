export type ParsedItem = {
  name: string
  quantity: number
  price: number
}

export type ParsedInvoice = {
  vendorName: string
  gstNumber: string
  totalAmount: number
  items: ParsedItem[]
}

export function parseOCRText(text: string): ParsedInvoice {
  const result: ParsedInvoice = {
    vendorName: '',
    gstNumber: '',
    totalAmount: 0,
    items: [],
  }

  if (!text) return result

  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean)

  // 1. Extract GST Number
  // Standard format: 22AAAAA0000A1Z5
  const gstRegex = /\b[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}\b/
  const gstMatch = text.match(gstRegex)
  if (gstMatch) {
    result.gstNumber = gstMatch[0]
  }

  // 2. Heuristics for Vendor Name (Usually at the top)
  // Look at the first 3 lines, ignore common header words like "INVOICE", "TAX INVOICE", "CASH MEMO"
  const ignoreHeaderWords = ['INVOICE', 'TAX INVOICE', 'BILL', 'CASH MEMO', 'RECEIPT', 'ORIGINAL FOR RECIPIENT']
  for (let i = 0; i < Math.min(5, lines.length); i++) {
    const lineUpper = lines[i].toUpperCase()
    if (!ignoreHeaderWords.some(w => lineUpper.includes(w)) && lines[i].length > 3) {
      result.vendorName = lines[i]
      break
    }
  }

  // 3. Extract Total Amount
  // Look for keywords: "Total", "Grand Total", "Amount Payable"
  // And grab the largest currency number around it or at the bottom.
  const amountRegex = /(?:Rs\.?|INR|₹)?\s*([0-9,]+(?:\.[0-9]{2})?)/g
  let maxAmount = 0
  
  lines.forEach((line, idx) => {
    const isTotalLine = /(?:total|grand total|amount due|balance due|amount payable)/i.test(line)
    if (isTotalLine) {
      const amounts = Array.from(line.matchAll(amountRegex)).map(m => parseFloat(m[1].replace(/,/g, '')))
      if (amounts.length > 0) {
        maxAmount = Math.max(maxAmount, ...amounts.filter(a => !isNaN(a)))
      } else {
        // Look at next few lines just in case
        for(let j=1; j<=3; j++) {
           if (lines[idx+j]) {
              const nextAmounts = Array.from(lines[idx+j].matchAll(amountRegex)).map(m => parseFloat(m[1].replace(/,/g, '')))
              if (nextAmounts.length > 0) {
                 maxAmount = Math.max(maxAmount, ...nextAmounts.filter(a => !isNaN(a)))
              }
           }
        }
      }
    }
  })
  
  // Fallback: Just find the largest number on the entire receipt with 2 decimal places that's reasonably large
  if (maxAmount === 0) {
    const allAmountsStr = text.match(/[0-9,]+\.[0-9]{2}/g) || []
    const allAmounts = allAmountsStr.map(a => parseFloat(a.replace(/,/g, '')))
    if (allAmounts.length > 0) {
      maxAmount = Math.max(...allAmounts.filter(a => !isNaN(a)))
    }
  }
  
  result.totalAmount = maxAmount

  // 4. Line Items Extraction Heuristics
  // This is the hardest part. Usually looks like:
  // [Item Name] [Qty] [Rate] [Total]
  // We'll look for lines that contain a product name string, a small integer (qty), and float(s) (rate/total)
  
  let inItemTable = false
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].toLowerCase()
    
    // Detect start of table
    if (/(?:description|item|particulars|product)\b/i.test(line) && /(?:qty|quantity|rate|price|amount|total)\b/i.test(line)) {
      inItemTable = true
      continue
    }

    // Stop table at totals
    if (inItemTable && /(?:total|subtotal|gst|tax|discount|amount due)/i.test(line)) {
      inItemTable = false
      continue
    }

    if (inItemTable) {
      // Try to parse a typical line item: "Wireless Mouse 2 500.00 1000.00"
      // or "2 Wireless Mouse 500.00"
      
      const nums = lines[i].match(/[0-9]+(?:\.[0-9]{2})?/g)
      
      if (nums && nums.length >= 2) {
        // We have numbers. Let's guess Qty and Price.
        // Usually qty is integer without decimals or whole number.
        const parsedNums = nums.map(n => parseFloat(n.replace(/,/g, '')))
        
        // Find quantity (assuming it's a small integer, or the first number)
        let qtyIdx = nums.findIndex(n => !n.includes('.') || n.endsWith('.00') || n.endsWith('.0'))
        if (qtyIdx === -1) qtyIdx = 0 // fallback first number
        
        let qty = parseInt(nums[qtyIdx], 10)
        if (isNaN(qty) || qty === 0) qty = 1
        
        // Find price (usually the other number)
        let priceArr = parsedNums.filter((_, idx) => idx !== qtyIdx)
        let price = priceArr.length > 0 ? priceArr[0] : 0

        // The text part is the name
        let nameMatch = lines[i].replace(/[0-9,.]+/g, '').replace(/[^a-zA-Z\s\-]/g, '').trim()
        
        // Sometimes receipt splits name and numbers to different lines
        if (nameMatch.length < 3 && i > 0) {
           // Look at previous line
           nameMatch = lines[i-1].replace(/[^a-zA-Z\s\-]/g, '').trim()
        }

        if (nameMatch.length > 2 && price > 0) {
          result.items.push({
            name: nameMatch,
            quantity: qty,
            price: price
          })
        }
      }
    }
  }

  // If table detection failed but we need items, let's just make a generic "Vendor Items" entry
  if (result.items.length === 0 && result.totalAmount > 0) {
    result.items.push({
      name: 'Scanned Items (Auto)',
      quantity: 1,
      price: result.totalAmount
    })
  }

  return result
}
