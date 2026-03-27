'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { INDIA_STATES } from '@/lib/utils'
import { Store, MapPin, Building2, CheckCircle2 } from 'lucide-react'

const steps = [
  { id: 1, title: 'Business Info', icon: Store },
  { id: 2, title: 'Contact Details', icon: Building2 },
  { id: 3, title: 'Address Details', icon: MapPin },
]

export default function OnboardingPage() {
  const router = useRouter()
  const [currentStep, setCurrentStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [formData, setFormData] = useState({
    shopName: '',
    ownerName: '',
    gstNumber: '',
    email: '',
    phone: '',
    address: '',
    state: '',
    pincode: '',
  })

  const handleNext = () => {
    setError('')
    if (currentStep === 1 && !formData.shopName.trim()) {
      setError('Shop Name is required.')
      return
    }
    if (currentStep === 2) {
      if (!formData.ownerName.trim()) { setError('Owner Name is required.'); return }
      if (!formData.phone.trim()) { setError('Phone Number is required.'); return }
    }
    if (currentStep < 3) setCurrentStep(currentStep + 1)
  }

  const handleBack = () => {
    if (currentStep > 1) setCurrentStep(currentStep - 1)
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { id, value } = e.target
    setFormData((prev) => ({ ...prev, [id]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/shop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to finish setup')
      }

      router.push('/dashboard')
      router.refresh()
    } catch (err: any) {
      setError(err.message)
      setLoading(false)
    }
  }

  return (
    <div className="max-w-3xl mx-auto w-full px-4 mb-20">
      <div className="text-center mb-10">
        <h1 className="text-3xl font-bold text-slate-900 mb-2">Set up your shop</h1>
        <p className="text-slate-500">Let&apos;s get your business details ready to start billing.</p>
      </div>

      {/* Progress Stepper */}
      <div className="flex justify-between items-center mb-12 relative">
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-1 bg-slate-200 z-0 rounded-full overflow-hidden">
          <div 
            className="h-full bg-indigo-600 transition-all duration-500 ease-in-out" 
            style={{ width: `${((currentStep - 1) / 2) * 100}%` }}
          />
        </div>
        
        {steps.map((step) => {
          const isCompleted = currentStep > step.id
          const isCurrent = currentStep === step.id
          
          return (
            <div key={step.id} className="relative z-10 flex flex-col items-center">
              <div
                className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-300 shadow-sm
                  ${isCompleted ? 'bg-indigo-600 text-white shadow-indigo-200 block' 
                    : isCurrent ? 'bg-white border-2 border-indigo-600 text-indigo-600'
                    : 'bg-white border-2 border-slate-200 text-slate-400'}`}
              >
                {isCompleted ? <CheckCircle2 size={20} /> : <step.icon size={20} />}
              </div>
              <span className={`absolute -bottom-7 text-xs font-semibold whitespace-nowrap 
                ${isCurrent ? 'text-indigo-900' : 'text-slate-500'}`}>
                {step.title}
              </span>
            </div>
          )
        })}
      </div>

      {/* Form Card */}
      <div className="bg-white p-8 rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-100">
        {error && (
          <div className="mb-6 p-4 bg-red-50 text-red-600 rounded-xl text-sm border border-red-100 flex items-center gap-2">
            <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5 flex-shrink-0" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* Step 1: Business Info */}
          <div className={currentStep === 1 ? 'block animate-in fade-in slide-in-from-right-4 duration-500' : 'hidden'}>
            <div className="space-y-5">
              <Input
                id="shopName"
                label="Shop Name *"
                placeholder="e.g. Acme Electronics"
                value={formData.shopName}
                onChange={handleChange}
                required
              />
              <Input
                id="gstNumber"
                label="GST Number (Optional)"
                placeholder="22AAAAA0000A1Z5"
                value={formData.gstNumber}
                onChange={handleChange}
                pattern="^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$"
                title="Please enter a valid GST format"
              />
            </div>
          </div>

          {/* Step 2: Contact Details */}
          <div className={currentStep === 2 ? 'block animate-in fade-in slide-in-from-right-4 duration-500' : 'hidden'}>
            <div className="space-y-5">
              <Input
                id="ownerName"
                label="Owner Name *"
                placeholder="John Doe"
                value={formData.ownerName}
                onChange={handleChange}
                required
              />
              <div className="grid grid-cols-2 gap-4">
                <Input
                  id="phone"
                  label="Phone Number *"
                  placeholder="9876543210"
                  type="tel"
                  value={formData.phone}
                  onChange={handleChange}
                  required
                />
                <Input
                  id="email"
                  label="Business Email (Optional)"
                  placeholder="contact@shop.com"
                  type="email"
                  value={formData.email}
                  onChange={handleChange}
                />
              </div>
            </div>
          </div>

          {/* Step 3: Address */}
          <div className={currentStep === 3 ? 'block animate-in fade-in slide-in-from-right-4 duration-500' : 'hidden'}>
            <div className="space-y-5">
              <Input
                id="address"
                label="Complete Address *"
                placeholder="Shop No. 12, Main Market..."
                value={formData.address}
                onChange={handleChange}
                required
              />
              <div className="grid grid-cols-2 gap-4">
                <Select
                  id="state"
                  label="State *"
                  value={formData.state}
                  onChange={handleChange}
                  options={INDIA_STATES.map(s => ({ value: s, label: s }))}
                  placeholder="Select State"
                  required
                />
                <Input
                  id="pincode"
                  label="Pincode *"
                  placeholder="400001"
                  type="text"
                  pattern="[0-9]{6}"
                  value={formData.pincode}
                  onChange={handleChange}
                  required
                />
              </div>
            </div>
          </div>

          {/* Navigation Buttons */}
          <div className="mt-10 flex items-center justify-between pt-6 border-t border-slate-100">
            <Button
              type="button"
              variant="ghost"
              onClick={handleBack}
              disabled={currentStep === 1 || loading}
              className={currentStep === 1 ? 'opacity-0 pointer-events-none' : ''}
            >
              Back
            </Button>
            
            {currentStep < 3 ? (
              <Button type="button" onClick={handleNext} className="min-w-[120px]">
                Continue
              </Button>
            ) : (
              <Button type="submit" loading={loading} className="min-w-[120px] bg-indigo-600 hover:bg-indigo-700">
                Complete Setup
              </Button>
            )}
          </div>
        </form>
      </div>
    </div>
  )
}
