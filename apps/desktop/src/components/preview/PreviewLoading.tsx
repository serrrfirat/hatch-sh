import { motion } from 'framer-motion'

export function PreviewLoading() {
  return (
    <div className="flex flex-col items-center justify-center h-full">
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
        className="w-8 h-8 border-2 border-accent-green border-t-transparent rounded-full"
      />
      <p className="mt-4 text-gray-500 text-sm">Building preview...</p>
    </div>
  )
}
