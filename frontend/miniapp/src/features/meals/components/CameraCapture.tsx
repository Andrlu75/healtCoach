import { useRef, useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Camera, X, RotateCcw } from 'lucide-react'
import { createPortal } from 'react-dom'

interface CameraCaptureProps {
  isOpen: boolean
  onClose: () => void
  onCapture: (file: File) => void
}

export function CameraCapture({ isOpen, onClose, onCapture }: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment')

  const startCamera = useCallback(async () => {
    try {
      // Остановить предыдущий стрим
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop())
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: facingMode,
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      })

      streamRef.current = stream

      if (videoRef.current) {
        videoRef.current.srcObject = stream
      }

      setError(null)
    } catch (err) {
      console.error('Camera error:', err)
      setError('Не удалось получить доступ к камере')
    }
  }, [facingMode])

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }
  }, [])

  useEffect(() => {
    if (isOpen) {
      startCamera()
    } else {
      stopCamera()
    }

    return () => stopCamera()
  }, [isOpen, startCamera, stopCamera])

  const handleCapture = () => {
    if (!videoRef.current || !canvasRef.current) return

    const video = videoRef.current
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')

    if (!ctx) return

    // Ресайз до 1500px по длинной стороне
    const MAX_SIDE = 1500
    let width = video.videoWidth
    let height = video.videoHeight
    if (width > MAX_SIDE || height > MAX_SIDE) {
      if (width > height) {
        height = Math.round((height * MAX_SIDE) / width)
        width = MAX_SIDE
      } else {
        width = Math.round((width * MAX_SIDE) / height)
        height = MAX_SIDE
      }
    }

    canvas.width = width
    canvas.height = height

    // Нарисовать кадр с ресайзом
    ctx.drawImage(video, 0, 0, width, height)

    // Конвертировать в blob (JPEG 85%)
    canvas.toBlob(
      (blob) => {
        if (blob) {
          const file = new File([blob], `photo_${Date.now()}.jpg`, {
            type: 'image/jpeg',
          })
          onCapture(file)
          onClose()
        }
      },
      'image/jpeg',
      0.85
    )
  }

  const toggleCamera = () => {
    setFacingMode(prev => prev === 'environment' ? 'user' : 'environment')
  }

  const content = (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-black flex flex-col"
        >
          {/* Header */}
          <div className="absolute top-0 left-0 right-0 z-10 flex justify-between items-center p-4">
            <button
              onClick={onClose}
              className="w-10 h-10 bg-black/50 rounded-full flex items-center justify-center"
            >
              <X size={24} className="text-white" />
            </button>
            <button
              onClick={toggleCamera}
              className="w-10 h-10 bg-black/50 rounded-full flex items-center justify-center"
            >
              <RotateCcw size={20} className="text-white" />
            </button>
          </div>

          {/* Video */}
          {error ? (
            <div className="flex-1 flex items-center justify-center text-white text-center p-4">
              <p>{error}</p>
            </div>
          ) : (
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="flex-1 object-cover"
            />
          )}

          {/* Canvas для захвата (скрытый) */}
          <canvas ref={canvasRef} className="hidden" />

          {/* Capture button */}
          <div className="absolute bottom-8 left-0 right-0 flex justify-center safe-area-bottom">
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={handleCapture}
              disabled={!!error}
              className="w-20 h-20 bg-white rounded-full flex items-center justify-center shadow-lg disabled:opacity-50"
            >
              <div className="w-16 h-16 border-4 border-gray-300 rounded-full flex items-center justify-center">
                <Camera size={28} className="text-gray-700" />
              </div>
            </motion.button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )

  return createPortal(content, document.body)
}
