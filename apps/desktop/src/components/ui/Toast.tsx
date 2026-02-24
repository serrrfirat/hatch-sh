import { useEffect } from 'react'
import { motion } from 'framer-motion'
import { CheckCircle2, Info, AlertCircle, X } from 'lucide-react'
import type { Toast } from '../../stores/toastStore'
import { useToastStore } from '../../stores/toastStore'

interface ToastProps {
  toast: Toast
}

export function ToastComponent({ toast }: ToastProps) {
  const { dismissToast, undoToast } = useToastStore()

  // Auto-dismiss after timeout
  useEffect(() => {
    const timer = setTimeout(() => {
      dismissToast(toast.id)
    }, toast.dismissTimeout)

    return () => clearTimeout(timer)
  }, [toast.id, toast.dismissTimeout, dismissToast])

  const getIcon = () => {
    switch (toast.type) {
      case 'success':
        return <CheckCircle2 className="w-5 h-5 text-green-500" />
      case 'warning':
        return <AlertCircle className="w-5 h-5 text-yellow-500" />
      case 'info':
      default:
        return <Info className="w-5 h-5 text-blue-500" />
    }
  }

  const getBgColor = () => {
    switch (toast.type) {
      case 'success':
        return 'bg-green-950 border-green-800'
      case 'warning':
        return 'bg-yellow-950 border-yellow-800'
      case 'info':
      default:
        return 'bg-blue-950 border-blue-800'
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: 100 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 100 }}
      transition={{ duration: 0.3 }}
      className={`flex items-center gap-3 px-4 py-3 rounded-lg border ${getBgColor()} text-white shadow-lg`}
    >
      <div className="flex-shrink-0">{getIcon()}</div>
      <p className="flex-1 text-sm font-medium">{toast.message}</p>
      {toast.undoCallback && (
        <button
          onClick={() => undoToast(toast.id)}
          className="text-xs font-semibold px-2 py-1 rounded hover:bg-white/10 transition-colors"
        >
          Undo
        </button>
      )}
      <button
        onClick={() => dismissToast(toast.id)}
        className="flex-shrink-0 text-gray-400 hover:text-white transition-colors"
      >
        <X className="w-4 h-4" />
      </button>
    </motion.div>
  )
}
