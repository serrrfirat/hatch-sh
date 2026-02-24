import { AnimatePresence } from 'framer-motion'
import { useToastStore } from '../../stores/toastStore'
import { ToastComponent } from './Toast'

export function ToastContainer() {
  const toasts = useToastStore((state) => state.toasts)

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
      <AnimatePresence mode="popLayout">
        {toasts.map((toast) => (
          <div key={toast.id} className="pointer-events-auto">
            <ToastComponent toast={toast} />
          </div>
        ))}
      </AnimatePresence>
    </div>
  )
}
