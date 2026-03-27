'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { formatCurrency } from '@/lib/utils'
import {
  UploadCloud,
  FileText,
  AlertCircle,
  Plus,
  Trash2,
  ArrowLeft,
  CheckCircle2,
  Image as ImageIcon
} from 'lucide-react'
import Link from 'next/link'

type LineItem = { productName: string; quantity: number; price: number }

export default function AIScannerPage() {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  const [file, setFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  
  const [isScanning, setIsScanning] = useState(false)
  const [scanStep, setScanStep] = useState<'upload' | 'scanning' | 'review'>('upload')
  const [error, setError] = useState('')

  // Form State (auto-filled by AI)
  const [vendorName, setVendorName] = useState('')
  const [totalAmount, setTotalAmount] = useState<number>(0)
  const [items, setItems] = useState<LineItem[]>([])
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  
  const [isSaving, setIsSaving] = useState(false)

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (!selectedFile) return
    
    if (!selectedFile.type.startsWith('image/')) {
      setError('Please upload an image file (JPEG, PNG, etc)')
      return
    }

    setFile(selectedFile)
    setPreviewUrl(URL.createObjectURL(selectedFile))
    setError('')
  }
  
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
  }
  
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const droppedFile = e.dataTransfer.files?.[0]
    if (!droppedFile) return
    
    if (!droppedFile.type.startsWith('image/')) {
      setError('Please upload an image file')
      return
    }

    setFile(droppedFile)
    setPreviewUrl(URL.createObjectURL(droppedFile))
    setError('')
  }

  const startScan = async () => {
    if (!file) return
    
    setIsScanning(true)
    setScanStep('scanning')
    setError('')

    const formData = new FormData()
    formData.append('file', file)

    try {
      const res = await fetch('/api/ocr', {
        method: 'POST',
        body: formData,
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to scan invoice')
      }

      // Auto-fill form with extracted data
      setVendorName(data.parsed.vendorName || 'Extracted Vendor')
      setTotalAmount(data.parsed.totalAmount || 0)
      
      if (data.parsed.items && data.parsed.items.length > 0) {
        setItems(data.parsed.items.map((i: any) => ({
          productName: i.name,
          quantity: i.quantity,
          price: i.price
        })))
      } else {
        // Fallback item if none detected
        setItems([{
          productName: 'Scanned Item (Auto)',
          quantity: 1,
          price: data.parsed.totalAmount || 0
        }])
      }
      
      if (data.imageUrl) {
        setImageUrl(data.imageUrl)
      }

      setScanStep('review')
    } catch (err: any) {
      setError(err.message)
      setScanStep('upload')
    } finally {
      setIsScanning(false)
    }
  }

  // Edit Handlers for Review Step
  const handleItemChange = (index: number, field: keyof LineItem, value: any) => {
    const newItems = [...items]
    newItems[index] = { ...newItems[index], [field]: value }
    setItems(newItems)
    
    // Auto-update total amount
    if (field === 'price' || field === 'quantity') {
      const newTotal = newItems.reduce((sum, item) => sum + (item.price * item.quantity), 0)
      setTotalAmount(newTotal)
    }
  }

  const addItem = () => setItems([...items, { productName: '', quantity: 1, price: 0 }])
  const removeItem = (index: number) => setItems(items.filter((_, i) => i !== index))

  const handleSavePurchase = async () => {
    if (!vendorName) return setError('Vendor Name is required')
    if (items.some(i => !i.productName)) return setError('All items need a name')
    
    setIsSaving(true)
    setError('')
    
    try {
      const res = await fetch('/api/purchases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vendorName,
          items,
          totalAmount,
          imageUrl: previewUrl // Or the supabase returned URL if available
        })
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to record purchase')
      }

      router.push('/purchases')
    } catch (err: any) {
      setError(err.message)
      setIsSaving(false)
    }
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-20">
      <div className="flex items-center gap-4 mb-8">
        <Link href="/purchases">
          <Button variant="ghost" className="p-2">
            <ArrowLeft size={20} />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">AI Invoice Scanner</h1>
          <p className="text-slate-500 text-sm">Upload a bill to automatically extract data</p>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 text-red-600 rounded-xl border border-red-100 flex items-center gap-2">
          <AlertCircle size={18} />
          {error}
        </div>
      )}

      {scanStep === 'upload' && (
        <Card className="p-10 border-dashed border-2 bg-slate-50">
          <div 
            className="flex flex-col items-center justify-center py-16 text-center cursor-pointer"
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onClick={() => !file && fileInputRef.current?.click()}
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileSelect}
              accept="image/*"
              className="hidden"
            />
            
            {!file ? (
              <>
                <div className="w-20 h-20 bg-indigo-100 rounded-full flex items-center justify-center mb-6 text-indigo-600 shadow-inner">
                  <UploadCloud size={40} />
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-2">Upload Invoice Image</h3>
                <p className="text-slate-500 max-w-sm mb-6">
                  Drag and drop your bill image here, or click to browse files. Let AI do the data entry.
                </p>
                <Button>Select File</Button>
              </>
            ) : (
              <div className="w-full max-w-md mx-auto relative rounded-2xl overflow-hidden shadow-lg group">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={previewUrl!} alt="Invoice Preview" className="w-full h-auto object-cover max-h-[400px]" />
                <div className="absolute inset-0 bg-black/50 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4">
                  <Button variant="outline" className="text-white border-white hover:bg-white/20" onClick={(e) => {
                    e.stopPropagation()
                    fileInputRef.current?.click()
                  }}>
                    Change File
                  </Button>
                  <Button variant="primary" onClick={(e) => {
                    e.stopPropagation()
                    startScan()
                  }}>
                    Scan Now
                  </Button>
                </div>
              </div>
            )}
            
            {file && (
              <div className="mt-8 flex gap-4 w-full max-w-md justify-center">
                <Button variant="outline" onClick={() => { setFile(null); setPreviewUrl(null); }}>
                  Cancel
                </Button>
                <Button onClick={startScan} disabled={isScanning}>
                  Start AI Extraction
                </Button>
              </div>
            )}
          </div>
        </Card>
      )}

      {scanStep === 'scanning' && (
        <Card className="p-16 flex flex-col items-center justify-center min-h-[400px]">
          <div className="relative mb-8">
            <div className="w-24 h-24 border-4 border-indigo-100 rounded-full animate-pulse"></div>
            <div className="w-24 h-24 border-4 border-indigo-600 rounded-full absolute top-0 left-0 border-t-transparent animate-spin"></div>
            <div className="absolute inset-0 flex items-center justify-center text-indigo-600">
              <FileText size={32} />
            </div>
          </div>
          <h3 className="text-xl font-bold text-slate-900 mb-2">Analyzing Invoice...</h3>
          <p className="text-slate-500 max-w-sm text-center">
            Our AI is reading vendor details, extracting line items, and calculating amounts. This may take a few seconds.
          </p>
          
          <div className="mt-10 w-full max-w-md space-y-3">
            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full bg-indigo-600 w-1/3 animate-[pulse_2s_ease-in-out_infinite]"></div>
            </div>
            <div className="flex justify-between text-xs text-slate-400 font-medium px-1 uppercase tracking-wider">
              <span>Extracting Data</span>
              <span>Processing</span>
            </div>
          </div>
        </Card>
      )}

      {scanStep === 'review' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          {/* Left side: Image Proof */}
          <Card className="p-2 sticky top-6 overflow-hidden bg-slate-900 h-[calc(100vh-140px)]">
            <div className="w-full h-full relative group rounded-xl overflow-hidden flex flex-col">
              <div className="p-4 bg-black/40 backdrop-blur flex items-center justify-between text-white absolute top-0 left-0 w-full z-10">
                <div className="flex items-center gap-2">
                  <ImageIcon size={16} />
                  <span className="text-sm font-medium">Source Document</span>
                </div>
                <Button size="sm" variant="outline" className="text-white border-white/20 bg-white/10 hover:bg-white/20 py-1 h-7 text-xs" onClick={() => setScanStep('upload')}>
                  Upload Different
                </Button>
              </div>
              <div className="flex-1 overflow-auto p-4 pt-16 flex items-start justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={previewUrl!} alt="Scanned Invoice" className="w-full max-w-full h-auto object-contain rounded-lg shadow-2xl" />
              </div>
            </div>
          </Card>

          {/* Right side: Editable Data */}
          <div className="space-y-6">
            <Card className="p-6 border-indigo-100 shadow-lg shadow-indigo-100">
              <div className="flex items-center gap-3 mb-6 bg-indigo-50 p-3 rounded-xl">
                <CheckCircle2 size={24} className="text-indigo-600 shrink-0" />
                <div>
                  <h3 className="text-sm font-bold text-indigo-900">Extraction Complete</h3>
                  <p className="text-xs text-indigo-700">Please review and edit the data below before saving.</p>
                </div>
              </div>

              <div className="space-y-5">
                <Input
                  label="Vendor Name *"
                  value={vendorName}
                  onChange={(e) => setVendorName(e.target.value)}
                  required
                />
                
                <Input
                  label="Total Amount (₹) *"
                  type="number"
                  step="0.01"
                  min="0"
                  value={totalAmount}
                  onChange={(e) => setTotalAmount(parseFloat(e.target.value) || 0)}
                  required
                />
              </div>
            </Card>

            <Card className="p-6">
               <div className="flex items-center justify-between mb-4">
                 <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Line Items extracted</h3>
                 <span className="text-xs font-semibold px-2 py-1 bg-amber-100 text-amber-700 rounded-lg">{items.length} detected</span>
               </div>
               
               <div className="space-y-4">
                 {items.map((item, index) => (
                   <div key={index} className="grid gap-3 relative bg-slate-50 p-4 rounded-xl border border-slate-100 group">
                     <button
                        type="button"
                        onClick={() => removeItem(index)}
                        className="absolute right-2 top-2 p-1.5 text-slate-400 hover:text-red-600 hover:bg-white rounded-md opacity-0 group-hover:opacity-100 transition-opacity"
                        disabled={items.length === 1}
                      >
                       <Trash2 size={14} />
                     </button>
                     <Input
                        label="Product Name"
                        value={item.productName}
                        onChange={(e) => handleItemChange(index, 'productName', e.target.value)}
                        required
                     />
                     <div className="grid grid-cols-2 gap-3">
                       <Input
                          label="Quantity"
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={(e) => handleItemChange(index, 'quantity', parseInt(e.target.value, 10))}
                          required
                       />
                       <Input
                          label="Price (₹)"
                          type="number"
                          step="0.01"
                          min="0"
                          value={item.price}
                          onChange={(e) => handleItemChange(index, 'price', parseFloat(e.target.value))}
                          required
                       />
                     </div>
                   </div>
                 ))}
               </div>

               <Button type="button" variant="ghost" onClick={addItem} className="w-full mt-4 text-slate-500 border-2 border-dashed border-slate-200">
                 <Plus size={16} /> Add Missing Item
               </Button>
            </Card>

            <Button 
               size="lg" 
               className="w-full bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20" 
               onClick={handleSavePurchase}
               loading={isSaving}
            >
               Approve and Save to Purchases
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
