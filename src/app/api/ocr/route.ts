import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { parseOCRText } from '@/lib/ocr/parser'

// Note: Ensure GOOGLE_VISION_API_KEY is set in your .env.local
const GOOGLE_VISION_API_URL = 'https://vision.googleapis.com/v1/images:annotate'

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
    //    We need to make sure this bucket exists or is created here.
    const fileExt = file.name.split('.').pop()
    const fileName = `${user.id}/${Date.now()}.${fileExt}`
    
    // We assume an 'invoices' bucket exists. If not, this might fail, 
    // but the user would need to create it in the Supabase Dashboard.
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
      // We can still process OCR even if storage fails by using base64 directly
    }

    // 2. Prepare Base64 string for Google Vision API
    const buffer = Buffer.from(await file.arrayBuffer())
    const base64Image = buffer.toString('base64')

    const visionApiKey = process.env.GOOGLE_VISION_API_KEY
    if (!visionApiKey) {
      return NextResponse.json(
        { error: 'Google Vision API key not configured' },
        { status: 500 }
      )
    }

    // 3. Call Google Vision API (Document Text Detection)
    const visionRes = await fetch(`${GOOGLE_VISION_API_URL}?key=${visionApiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requests: [
          {
            image: { content: base64Image },
            features: [{ type: 'DOCUMENT_TEXT_DETECTION' }],
          },
        ],
      }),
    })

    if (!visionRes.ok) {
      const errorData = await visionRes.json()
      console.error('Vision API Error:', errorData)
      return NextResponse.json({ error: 'Failed to process image with OCR' }, { status: 500 })
    }

    const visionData = await visionRes.json()
    const fullTextAnnotation = visionData.responses[0]?.fullTextAnnotation

    if (!fullTextAnnotation || !fullTextAnnotation.text) {
      return NextResponse.json({ error: 'No text detected in the image' }, { status: 400 })
    }

    // 4. Parse OCR text using our heuristic parser
    const parsedInvoice = parseOCRText(fullTextAnnotation.text)

    // Return structured data along with the uploaded image URL
    return NextResponse.json({
      parsed: parsedInvoice,
      imageUrl,
      rawText: fullTextAnnotation.text // Useful for debugging if needed
    })
  } catch (error: any) {
    console.error('OCR Processing error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
