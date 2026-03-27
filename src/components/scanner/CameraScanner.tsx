'use client'

import React, { useEffect, useRef, useState, useCallback } from 'react'
import { Camera, RefreshCw, X, Maximize, AlertCircle, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'

interface CameraScannerProps {
  onCapture: (file: File, previewUrl: string) => void
  onClose: () => void
}

type ScanQuality = 'analyzing' | 'good' | 'bad'

export const CameraScanner: React.FC<CameraScannerProps> = ({ onCapture, onClose }) => {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animationFrameRef = useRef<number>(0)
  const lastAnalyzeTimeRef = useRef<number>(0)
  
  const [hasPermission, setHasPermission] = useState<boolean | null>(null)
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment')
  
  const [quality, setQuality] = useState<ScanQuality>('analyzing')
  const [qualityMsg, setQualityMsg] = useState('Position invoice in frame')
  
  const [capturedImage, setCapturedImage] = useState<string | null>(null)
  const [capturedBlob, setCapturedBlob] = useState<Blob | null>(null)
  
  // Track consecutive good frames for auto-capture
  const goodFramesRef = useRef<number>(0)
  const REQUIRED_GOOD_TIME_MS = 1500
  const firstGoodTimeRef = useRef<number>(0)

  const stopCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop())
      setStream(null)
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
    }
  }, [stream])

  const startCamera = useCallback(async () => {
    stopCamera()
    setCapturedImage(null)
    setCapturedBlob(null)
    setQuality('analyzing')
    setQualityMsg('Initializing camera...')
    goodFramesRef.current = 0
    firstGoodTimeRef.current = 0

    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode,
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        },
        audio: false
      })
      
      setStream(mediaStream)
      setHasPermission(true)
      
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play()
          analyzeLoop()
        }
      }
    } catch (err) {
      console.error('Camera error:', err)
      setHasPermission(false)
    }
  }, [facingMode, stopCamera])

  useEffect(() => {
    startCamera()
    return () => stopCamera()
  }, [facingMode])

  const toggleCamera = () => {
    setFacingMode(prev => prev === 'environment' ? 'user' : 'environment')
  }

  // --- Frame Analysis Logic ---
  const analyzeLoop = () => {
    // Only analyze a frame every ~300ms to save CPU
    const now = Date.now()
    if (now - lastAnalyzeTimeRef.current > 300) {
      performAnalysis()
      lastAnalyzeTimeRef.current = now
    }
    
    // Only continue looping if we haven't captured an image
    if (!capturedImage) {
      animationFrameRef.current = requestAnimationFrame(analyzeLoop)
    }
  }

  const performAnalysis = () => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas || video.readyState < 2) return

    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) return

    // Draw current frame to hidden canvas
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

    // Sample the center area of the image (Region of Interest)
    const roiW = Math.floor(canvas.width * 0.6)
    const roiH = Math.floor(canvas.height * 0.6)
    const startX = Math.floor((canvas.width - roiW) / 2)
    const startY = Math.floor((canvas.height - roiH) / 2)

    const imageData = ctx.getImageData(startX, startY, roiW, roiH)
    const { data } = imageData

    let totalLuma = 0
    let gradientSum = 0
    let pixelCount = 0

    // Downsample loop (check every 4th pixel to make it extremely fast)
    for (let i = 0; i < data.length - 16; i += 16) {
      const r = data[i], g = data[i+1], b = data[i+2]
      // Standard perceptive luminance
      const luma = 0.299*r + 0.587*g + 0.114*b
      totalLuma += luma
      
      // Look at neighbor pixel to approximate edge strength / blur
      const r2 = data[i+4], g2 = data[i+5], b2 = data[i+6]
      const luma2 = 0.299*r2 + 0.587*g2 + 0.114*b2
      
      gradientSum += Math.abs(luma - luma2)
      pixelCount++
    }

    const avgBrightness = totalLuma / pixelCount
    const blurScore = gradientSum / pixelCount // Higher means sharper

    // Thresholds (easily tunable)
    const isTooDark = avgBrightness < 40
    const isTooBright = avgBrightness > 220
    const isBlurry = blurScore < 8 // 8 is a good heuristic for decent mobile camera sharpness

    if (isTooDark) {
      setQuality('bad')
      setQualityMsg('Too dark. Move to better light.')
      goodFramesRef.current = 0
    } else if (isTooBright) {
      setQuality('bad')
      setQualityMsg('Too bright or glare.')
      goodFramesRef.current = 0
    } else if (isBlurry) {
      setQuality('bad')
      setQualityMsg('Blurry. Hold camera steady.')
      goodFramesRef.current = 0
    } else {
      setQuality('good')
      setQualityMsg('Hold still... capturing')
      
      const now = Date.now()
      if (goodFramesRef.current === 0) {
        firstGoodTimeRef.current = now
      }
      goodFramesRef.current++

      // Auto capture if continuous good frames for REQUIRED_GOOD_TIME_MS
      if (now - firstGoodTimeRef.current >= REQUIRED_GOOD_TIME_MS) {
        handleCapture()
      }
    }
  }

  const handleCapture = () => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    
    // Convert to webp/jpeg and show preview
    const dataUrl = canvas.toDataURL('image/jpeg', 0.9)
    setCapturedImage(dataUrl)
    
    canvas.toBlob((blob) => {
      if (blob) setCapturedBlob(blob)
    }, 'image/jpeg', 0.9)
    
    stopCamera()
  }

  const handleConfirm = () => {
    if (capturedBlob && capturedImage) {
      const file = new File([capturedBlob], `scan_${Date.now()}.jpg`, { type: 'image/jpeg' })
      onCapture(file, capturedImage)
    }
  }

  if (hasPermission === false) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center bg-slate-900 rounded-2xl border border-slate-800 h-[500px]">
        <AlertCircle size={48} className="text-red-500 mb-4" />
        <h3 className="text-xl font-bold text-white mb-2">Camera Access Denied</h3>
        <p className="text-slate-400 mb-6 max-w-sm">
          Please allow camera access in your browser settings to scan invoices directly.
        </p>
        <Button variant="outline" onClick={onClose} className="text-slate-900">Close Scanner</Button>
      </div>
    )
  }

  return (
    <div className="relative overflow-hidden bg-black rounded-2xl h-[600px] w-full max-w-2xl mx-auto shadow-2xl flex flex-col">
      {/* Hidden canvas for processing */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Header */}
      <div className="absolute top-0 left-0 w-full p-4 flex justify-between items-center z-20 bg-gradient-to-b from-black/80 to-transparent">
        <span className="text-white font-medium flex items-center gap-2">
          <Camera size={18} /> Live Scanner
        </span>
        <button onClick={onClose} className="p-2 text-white/80 hover:text-white bg-black/40 rounded-full backdrop-blur">
          <X size={20} />
        </button>
      </div>

      <div className="relative flex-1 bg-black flex items-center justify-center overflow-hidden">
        {capturedImage ? (
          // --- Review State ---
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={capturedImage} alt="Captured" className="w-full h-full object-contain" />
        ) : (
          // --- Live Camera State ---
          <>
            <video 
              ref={videoRef} 
              playsInline 
              muted 
              className="w-full h-full object-cover"
            />
            
            {/* Target Overlay (The Border) */}
            <div className="absolute inset-4 md:inset-10 z-10 pointer-events-none flex items-center justify-center">
              <div 
                className={cn(
                  "w-full h-full max-w-sm border-4 rounded-xl transition-colors duration-300 relative",
                  quality === 'analyzing' ? "border-white/40 border-dashed" : 
                  quality === 'good' ? "border-emerald-500 shadow-[0_0_30px_rgba(16,185,129,0.3)] shadow-emerald-500/20" : 
                  "border-red-500"
                )}
              >
                {/* Visual Corners */}
                <div className="absolute -top-1 -left-1 w-8 h-8 border-t-4 border-l-4 border-inherit rounded-tl-xl" />
                <div className="absolute -top-1 -right-1 w-8 h-8 border-t-4 border-r-4 border-inherit rounded-tr-xl" />
                <div className="absolute -bottom-1 -left-1 w-8 h-8 border-b-4 border-l-4 border-inherit rounded-bl-xl" />
                <div className="absolute -bottom-1 -right-1 w-8 h-8 border-b-4 border-r-4 border-inherit rounded-br-xl" />
              </div>
            </div>

            {/* Quality Message Badge */}
            <div className="absolute top-20 left-1/2 -translate-x-1/2 z-20">
               <div className={cn(
                  "px-4 py-1.5 rounded-full text-sm font-medium backdrop-blur transition-colors",
                  quality === 'analyzing' ? "bg-black/60 text-white" :
                  quality === 'good' ? "bg-emerald-500/80 text-white" :
                  "bg-red-500/80 text-white"
               )}>
                 {quality === 'good' && <CheckCircle2 size={16} className="inline mr-2 -mt-0.5" />}
                 {qualityMsg}
               </div>
            </div>
          </>
        )}
      </div>

      {/* Footer Controls */}
      <div className="bg-black p-6 z-20 border-t border-white/10 flex items-center justify-center gap-6">
        {capturedImage ? (
          <>
            <Button variant="outline" size="lg" onClick={startCamera} className="w-full max-w-[160px] text-slate-900">
              <RefreshCw size={18} className="mr-2" /> Retake
            </Button>
            <Button size="lg" onClick={handleConfirm} className="w-full max-w-[160px] bg-emerald-600 hover:bg-emerald-700 text-white border-0">
              <CheckCircle2 size={18} className="mr-2" /> Use Image
            </Button>
          </>
        ) : (
          <>
            <button onClick={toggleCamera} className="p-4 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors">
              <RefreshCw size={24} />
            </button>
            <button 
              onClick={handleCapture} 
              className="w-20 h-20 rounded-full border-4 border-white/30 flex items-center justify-center hover:border-white/50 transition-all group"
            >
              <div className="w-16 h-16 bg-white rounded-full group-hover:scale-95 transition-transform" />
            </button>
            <button onClick={onClose} className="p-4 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors">
              <X size={24} />
            </button>
          </>
        )}
      </div>
    </div>
  )
}
