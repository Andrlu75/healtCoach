import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence, useDragControls, type PanInfo } from 'framer-motion'
import { cn } from '../../lib/cn'

interface BottomSheetProps {
  isOpen: boolean
  onClose: () => void
  children: React.ReactNode
  title?: string
  className?: string
}

export function BottomSheet({ isOpen, onClose, children, title, className }: BottomSheetProps) {
  const dragControls = useDragControls()
  const sheetRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  const handleDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.y > 100 || info.velocity.y > 500) {
      onClose()
    }
  }

  const content = (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-40"
            onClick={onClose}
          />
          <motion.div
            ref={sheetRef}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            drag="y"
            dragControls={dragControls}
            dragConstraints={{ top: 0 }}
            dragElastic={{ top: 0, bottom: 0.5 }}
            onDragEnd={handleDragEnd}
            className={cn(
              'fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-gray-900 rounded-t-3xl max-h-[90vh] overflow-hidden',
              className
            )}
          >
            <div className="flex justify-center pt-3 pb-2">
              <div className="w-10 h-1 rounded-full bg-gray-300 dark:bg-gray-700" />
            </div>
            {title && (
              <div className="px-4 pb-3 border-b border-gray-100 dark:border-gray-800">
                <h2 className="text-lg font-semibold text-center">{title}</h2>
              </div>
            )}
            <div className="overflow-y-auto max-h-[calc(90vh-60px)] overscroll-contain">
              {children}
            </div>
            <div className="safe-area-bottom" />
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )

  return createPortal(content, document.body)
}
