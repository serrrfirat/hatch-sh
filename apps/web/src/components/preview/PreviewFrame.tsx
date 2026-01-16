import { useRef, useEffect } from 'react'
import { motion } from 'framer-motion'
import { cn } from '@vibed/ui'

interface PreviewFrameProps {
  url: string
  className?: string
}

export function PreviewFrame({ url, className }: PreviewFrameProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null)

  // Force reload when URL changes
  useEffect(() => {
    if (iframeRef.current && url) {
      iframeRef.current.src = url
    }
  }, [url])

  return (
    <motion.iframe
      ref={iframeRef}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      src={url}
      title="App Preview"
      sandbox="allow-scripts allow-modals allow-forms allow-popups"
      className={cn('w-full h-full bg-white rounded-lg', className)}
    />
  )
}
