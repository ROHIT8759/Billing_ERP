import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions'

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll() },
          setAll() {},
        },
      }
    )

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // 1. Upload file to Supabase Storage (bucket: "invoices")
    const fileExt = file.name.split('.').pop()
    const fileName = `${user.id}/${Date.now()}.${fileExt}`
    
    const { data: uploadData, error: uploadError } = await supabase
      .storage
      .from('invoices')
      .upload(fileName, file, { contentType: file.type })

    let imageUrl = null
    if (!uploadError) {
      const { data: { publicUrl } } = supabase.storage.from('invoices').getPublicUrl(fileName)
      imageUrl = publicUrl
    } else {
      console.warn('Failed to upload image to Supabase Storage:', uploadError)
    }

    // 2. Prepare Base64 string for Groq Vision API
    const buffer = Buffer.from(await file.arrayBuffer())
    const base64Image = buffer.toString('base64')

    const groqApiKey = process.env.GROQ_API_KEY
    if (!groqApiKey) {
      return NextResponse.json(
        { error: 'Groq API key not configured' },
        { status: 500 }
      )
    }

    // 3. Call Groq Llama 3.2 Vision API
    const groqRes = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: { 
        'Authorization': `Bearer ${groqApiKey}`,
        'Content-Type': 'application/json' 
      },
      body: JSON.stringify({
        model: 'llama-3.2-90b-vision-preview',
        temperature: 0.1,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `Extract all data from this purchase invoice/bill image and return ONLY a valid raw JSON object (no markdown, no backticks, no explanation).

The JSON MUST exactly match this structure:
{
  "vendorName": "string (supplier/vendor/company name)",
  "billNo": "string or null (invoice number / bill number)",
  "totalAmount": number (final total amount payable),
  "items": [
    {
      "name": "string (product/item name)",
      "quantity": number (quantity purchased, integer),
      "freeQty": number (free/bonus quantity, 0 if none),
      "price": number (unit rate/price per unit),
      "discountPct": number (discount percentage, 0 if none),
      "batchNo": "string or null (batch number if printed)",
      "pack": "string or null (pack size like '10x10', '1x10' if printed)"
    }
  ]
}

Rules:
- Use 0 for any missing numeric fields (freeQty, discountPct)
- Use null for missing string fields (batchNo, pack, billNo)
- price is per unit (rate), NOT total line amount
- totalAmount is the grand total of the bill
- Include ALL line items you can see`
              },
              { 
                type: 'image_url', 
                image_url: { url: `data:${file.type};base64,${base64Image}` } 
              }
            ]
          }
        ]
      })
    })

    if (!groqRes.ok) {
      const errorData = await groqRes.json()
      console.error('Groq API Error:', errorData)
      return NextResponse.json({ error: 'Failed to process image with Groq OCR' }, { status: 500 })
    }

    const groqData = await groqRes.json()
    let textResponse = groqData.choices[0]?.message?.content || ''

    if (!textResponse) {
      return NextResponse.json({ error: 'No text extracted from the image' }, { status: 400 })
    }

    // 4. Parse the LLM's JSON
    // Strip markdown code block wrappers if the LLM adds them despite instructions
    textResponse = textResponse.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()

    let parsedInvoice
    try {
      parsedInvoice = JSON.parse(textResponse)
    } catch (parseError) {
      console.error('Failed to parse Groq JSON output:', textResponse)
      // Fallback
      parsedInvoice = { vendorName: 'Unknown Vendor', totalAmount: 0, items: [] }
    }

    // Return structured data along with the uploaded image URL
    return NextResponse.json({
      parsed: parsedInvoice,
      imageUrl,
      rawText: textResponse
    })
  } catch (error: any) {
    console.error('OCR Processing error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
