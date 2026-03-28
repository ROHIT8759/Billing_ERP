'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { formatCurrency, cn } from '@/lib/utils'
import {
  UploadCloud,
  FileText,
  AlertCircle,
  Plus,
  Trash2,
  ArrowLeft,
  CheckCircle2,
  Image as ImageIcon,
  Camera as CameraIcon,
  Sparkles,
  PackagePlus,
} from 'lucide-react'
import Link from 'next/link'
import { CameraScanner } from '@/components/scanner/CameraScanner'

type LineItem = {
  name: string
  quantity: number
  freeQty: number
  price: number
  discountPct: number
  batchNo: string
  pack: string
}

const emptyItem = (): LineItem => ({
  name: '',
  quantity: 1,
  freeQty: 0,
  price: 0,
  discountPct: 0,
  batchNo: '',
  pack: '',
})

export default function AIScannerPage() {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [file, setFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  const [isScanning, setIsScanning] = useState(false)
  const [scanStep, setScanStep] = useState<'upload' | 'scanning' | 'review'>('upload')
  const [inputMode, setInputMode] = useState<'upload' | 'camera'>('upload')
  const [error, setError] = useState('')

  // Form State (auto-filled by AI)
  const [vendorName, setVendorName] = useState('')
  const [billNo, setBillNo] = useState('')
  const [totalAmount, setTotalAmount] = useState<number>(0)
  const [items, setItems] = useState<LineItem[]>([])
  const [imageUrl, setImageUrl] = useState<string | null>(null)

  const [isSaving, setIsSaving] = useState(false)
  const [savedProducts, setSavedProducts] = useState<string[]>([])

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

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault() }

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

  const startScan = async (fileToScan?: File) => {
    const targetFile = fileToScan || file
    if (!targetFile) return

    setIsScanning(true)
    setScanStep('scanning')
    setError('')

    const formData = new FormData()
    formData.append('file', targetFile)

    try {
      const res = await fetch('/api/ocr', { method: 'POST', body: formData })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to scan invoice')

      const parsed = data.parsed || {}
      setVendorName(parsed.vendorName || '')
      setBillNo(parsed.billNo || '')
      setTotalAmount(parsed.totalAmount || 0)

      if (parsed.items && parsed.items.length > 0) {
        setItems(parsed.items.map((i: any) => ({
          name: i.name || '',
          quantity: Number(i.quantity) || 1,
          freeQty: Number(i.freeQty) || 0,
          price: Number(i.price) || 0,
          discountPct: Number(i.discountPct) || 0,
          batchNo: i.batchNo || '',
          pack: i.pack || '',
        })))
      } else {
        setItems([{ ...emptyItem(), price: parsed.totalAmount || 0 }])
      }

      if (data.imageUrl) setImageUrl(data.imageUrl)
      setScanStep('review')
    } catch (err: any) {
      setError(err.message)
      setScanStep('upload')
    } finally {
      setIsScanning(false)
    }
  }

  const handleItemChange = (index: number, field: keyof LineItem, value: any) => {
    const newItems = [...items]
    newItems[index] = { ...newItems[index], [field]: value }
    setItems(newItems)
    if (field === 'price' || field === 'quantity' || field === 'discountPct') {
      const newTotal = newItems.reduce((sum, it) => {
        const gross = Number(it.price) * Number(it.quantity)
        return sum + gross * (1 - (Number(it.discountPct) || 0) / 100)
      }, 0)
      setTotalAmount(Math.round(newTotal * 100) / 100)
    }
  }

  const addItem = () => setItems([...items, emptyItem()])
  const removeItem = (index: number) => {
    const newItems = items.filter((_, i) => i !== index)
    setItems(newItems)
    const newTotal = newItems.reduce((sum, it) => {
      return sum + Number(it.price) * Number(it.quantity) * (1 - (Number(it.discountPct) || 0) / 100)
    }, 0)
    setTotalAmount(Math.round(newTotal * 100) / 100)
  }

  const handleCameraCapture = (capturedFile: File, dataUrl: string) => {
    setFile(capturedFile)
    setPreviewUrl(dataUrl)
    startScan(capturedFile)
  }

  const handleSavePurchase = async () => {
    if (!vendorName.trim()) return setError('Vendor Name is required')
    if (items.some(i => !i.name.trim())) return setError('All items need a product name')

    setIsSaving(true)
    setError('')

    try {
      const res = await fetch('/api/purchases/scan-create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vendorName: vendorName.trim(),
          billNo: billNo.trim() || null,
          items: items.map(it => ({
            name: it.name.trim(),
            quantity: Number(it.quantity) || 1,
            freeQty: Number(it.freeQty) || 0,
            price: Number(it.price) || 0,
            discountPct: Number(it.discountPct) || 0,
            batchNo: it.batchNo.trim() || null,
            pack: it.pack.trim() || null,
          })),
          totalAmount,
          imageUrl: imageUrl || null,
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to record purchase')

      if (data.createdProducts?.length > 0) {
        setSavedProducts(data.createdProducts)
        // Short delay to show success message, then redirect
        setTimeout(() => router.push(`/purchases/${data.purchase.id}`), 1500)
      } else {
        router.push(`/purchases/${data.purchase.id}`)
      }
    } catch (err: any) {
      setError(err.message)
      setIsSaving(false)
    }
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-20">
      <div className="flex items-center gap-4 mb-8">
        <Link href="/purchases">
          <Button variant="ghost" className="p-2"><ArrowLeft size={20} /></Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Sparkles size={22} className="text-indigo-500" />
            AI Invoice Scanner
          </h1>
          <p className="text-slate-500 text-sm">Scan or upload a bill — AI extracts all data automatically</p>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 text-red-600 rounded-xl border border-red-100 flex items-center gap-2">
          <AlertCircle size={18} className="shrink-0" />
          {error}
        </div>
      )}

      {savedProducts.length > 0 && (
        <div className="p-4 bg-emerald-50 text-emerald-700 rounded-xl border border-emerald-100 flex items-start gap-3">
          <PackagePlus size={20} className="shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-sm">New products added to inventory</p>
            <p className="text-xs mt-0.5">{savedProducts.join(', ')}</p>
          </div>
        </div>
      )}

      {/* ── UPLOAD / CAMERA STEP ── */}
      {scanStep === 'upload' && (
        <div className="space-y-6">
          <div className="flex p-1 bg-slate-100 rounded-xl w-full max-w-md mx-auto">
            <button
              onClick={() => setInputMode('upload')}
              className={cn(
                'flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium rounded-lg transition-all',
                inputMode === 'upload' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              )}
            >
              <UploadCloud size={18} /> Upload Image
            </button>
            <button
              onClick={() => setInputMode('camera')}
              className={cn(
                'flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium rounded-lg transition-all',
                inputMode === 'camera' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              )}
            >
              <CameraIcon size={18} /> Live Camera
            </button>
          </div>

          {inputMode === 'camera' ? (
            <CameraScanner onCapture={handleCameraCapture} onClose={() => setInputMode('upload')} />
          ) : (
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
                      <Button variant="outline" className="text-white border-white hover:bg-white/20" onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click() }}>
                        Change File
                      </Button>
                      <Button onClick={(e) => { e.stopPropagation(); startScan() }}>
                        Scan Now
                      </Button>
                    </div>
                  </div>
                )}

                {file && (
                  <div className="mt-8 flex gap-4 w-full max-w-md justify-center">
                    <Button variant="outline" onClick={() => { setFile(null); setPreviewUrl(null) }}>Cancel</Button>
                    <Button onClick={() => startScan()} disabled={isScanning}>
                      <Sparkles size={16} className="mr-2" />
                      Start AI Extraction
                    </Button>
                  </div>
                )}
              </div>
            </Card>
          )}
        </div>
      )}

      {/* ── SCANNING STEP ── */}
      {scanStep === 'scanning' && (
        <Card className="p-16 flex flex-col items-center justify-center min-h-[400px]">
          <div className="relative mb-8">
            <div className="w-24 h-24 border-4 border-indigo-100 rounded-full animate-pulse" />
            <div className="w-24 h-24 border-4 border-indigo-600 rounded-full absolute top-0 left-0 border-t-transparent animate-spin" />
            <div className="absolute inset-0 flex items-center justify-center text-indigo-600">
              <FileText size={32} />
            </div>
          </div>
          <h3 className="text-xl font-bold text-slate-900 mb-2">Analyzing Invoice...</h3>
          <p className="text-slate-500 max-w-sm text-center">
            AI is reading vendor details, extracting line items, batch numbers, and amounts. This may take a few seconds.
          </p>
          <div className="mt-10 w-full max-w-md">
            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full bg-indigo-600 w-2/3 animate-pulse rounded-full" />
            </div>
          </div>
        </Card>
      )}

      {/* ── REVIEW STEP ── */}
      {scanStep === 'review' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          {/* Left: Image */}
          <Card className="p-2 sticky top-6 overflow-hidden bg-slate-900 h-[calc(100vh-140px)]">
            <div className="w-full h-full relative group rounded-xl overflow-hidden flex flex-col">
              <div className="p-4 bg-black/40 backdrop-blur flex items-center justify-between text-white absolute top-0 left-0 w-full z-10">
                <div className="flex items-center gap-2">
                  <ImageIcon size={16} />
                  <span className="text-sm font-medium">Source Document</span>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-white border-white/20 bg-white/10 hover:bg-white/20 py-1 h-7 text-xs"
                  onClick={() => { setScanStep('upload'); setFile(null); setPreviewUrl(null) }}
                >
                  Upload Different
                </Button>
              </div>
              <div className="flex-1 overflow-auto p-4 pt-16 flex items-start justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={previewUrl!} alt="Scanned Invoice" className="w-full max-w-full h-auto object-contain rounded-lg shadow-2xl" />
              </div>
            </div>
          </Card>

          {/* Right: Editable Data */}
          <div className="space-y-4">
            {/* Header + success badge */}
            <Card className="p-5 border-indigo-100 shadow-lg shadow-indigo-50">
              <div className="flex items-center gap-3 mb-5 bg-indigo-50 p-3 rounded-xl">
                <CheckCircle2 size={22} className="text-indigo-600 shrink-0" />
                <div>
                  <p className="text-sm font-bold text-indigo-900">Extraction Complete — review before saving</p>
                  <p className="text-xs text-indigo-600 mt-0.5">Missing products will be auto-created in your inventory.</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <Input
                    label="Vendor Name *"
                    value={vendorName}
                    onChange={(e) => setVendorName(e.target.value)}
                    required
                  />
                </div>
                <Input
                  label="Bill / Invoice No"
                  value={billNo}
                  onChange={(e) => setBillNo(e.target.value)}
                  placeholder="Optional"
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

            {/* Line Items */}
            <Card className="p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Line Items</h3>
                <span className="text-xs font-semibold px-2 py-1 bg-amber-100 text-amber-700 rounded-lg">
                  {items.length} detected
                </span>
              </div>

              <div className="space-y-3">
                {items.map((item, index) => (
                  <div key={index} className="relative bg-slate-50 p-4 rounded-xl border border-slate-100 group space-y-3">
                    <button
                      type="button"
                      onClick={() => removeItem(index)}
                      className="absolute right-2 top-2 p-1.5 text-slate-400 hover:text-red-600 hover:bg-white rounded-md opacity-0 group-hover:opacity-100 transition-opacity"
                      disabled={items.length === 1}
                    >
                      <Trash2 size={14} />
                    </button>

                    <Input
                      label="Product Name *"
                      value={item.name}
                      onChange={(e) => handleItemChange(index, 'name', e.target.value)}
                      required
                    />

                    <div className="grid grid-cols-3 gap-2">
                      <Input
                        label="Qty"
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) => handleItemChange(index, 'quantity', parseInt(e.target.value, 10) || 1)}
                      />
                      <Input
                        label="Free"
                        type="number"
                        min="0"
                        value={item.freeQty}
                        onChange={(e) => handleItemChange(index, 'freeQty', parseInt(e.target.value, 10) || 0)}
                      />
                      <Input
                        label="Rate (₹)"
                        type="number"
                        step="0.01"
                        min="0"
                        value={item.price}
                        onChange={(e) => handleItemChange(index, 'price', parseFloat(e.target.value) || 0)}
                      />
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <Input
                        label="Disc %"
                        type="number"
                        step="0.01"
                        min="0"
                        max="100"
                        value={item.discountPct}
                        onChange={(e) => handleItemChange(index, 'discountPct', parseFloat(e.target.value) || 0)}
                      />
                      <Input
                        label="Batch No"
                        value={item.batchNo}
                        onChange={(e) => handleItemChange(index, 'batchNo', e.target.value)}
                        placeholder="Optional"
                      />
                      <Input
                        label="Pack"
                        value={item.pack}
                        onChange={(e) => handleItemChange(index, 'pack', e.target.value)}
                        placeholder="e.g. 10x10"
                      />
                    </div>

                    {/* Line total */}
                    <div className="text-right text-xs text-slate-500">
                      Amount:{' '}
                      <span className="font-semibold text-slate-700">
                        {formatCurrency(
                          Number(item.price) *
                          Math.max(1, Number(item.quantity)) *
                          (1 - (Number(item.discountPct) || 0) / 100)
                        )}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              <Button type="button" variant="ghost" onClick={addItem} className="w-full mt-4 text-slate-500 border-2 border-dashed border-slate-200">
                <Plus size={16} className="mr-2" /> Add Missing Item
              </Button>
            </Card>

            {/* Total summary */}
            <div className="flex items-center justify-between bg-slate-900 text-white px-5 py-4 rounded-xl">
              <span className="text-sm font-medium text-slate-300">Grand Total</span>
              <span className="text-xl font-bold">{formatCurrency(totalAmount)}</span>
            </div>

            <Button
              size="lg"
              className="w-full bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20"
              onClick={handleSavePurchase}
              loading={isSaving}
            >
              <CheckCircle2 size={18} className="mr-2" />
              Approve & Save Purchase
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
