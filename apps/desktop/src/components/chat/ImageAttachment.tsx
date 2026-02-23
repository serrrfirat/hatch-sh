import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { ImageAttachmentData } from '../../lib/imageAttachment'

interface ImageThumbnailProps {
  image: ImageAttachmentData
  onRemove?: () => void
}

export function ImageThumbnail({ image, onRemove }: ImageThumbnailProps) {
  return (
    <div className="relative group w-16 h-16 rounded-lg overflow-hidden border border-white/10 bg-neutral-800 shrink-0">
      <img
        src={image.base64}
        alt={image.fileName}
        className="w-full h-full object-cover"
      />
      {onRemove && (
        <button
          onClick={onRemove}
          className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500/90 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-xs leading-none"
        >
          ×
        </button>
      )}
    </div>
  )
}

interface ImagePreviewBarProps {
  images: ImageAttachmentData[]
  onRemove: (id: string) => void
}

export function ImagePreviewBar({ images, onRemove }: ImagePreviewBarProps) {
  if (images.length === 0) return null

  return (
    <div className="flex gap-2 px-4 pt-3 overflow-x-auto">
      <AnimatePresence>
        {images.map((img) => (
          <motion.div
            key={img.id}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.15 }}
          >
            <ImageThumbnail image={img} onRemove={() => onRemove(img.id)} />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}

interface InlineImageProps {
  image: ImageAttachmentData
}

export function InlineImage({ image }: InlineImageProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  return (
    <div className="my-2">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="block rounded-lg overflow-hidden border border-white/10 hover:border-white/20 transition-colors max-w-sm"
      >
        <img
          src={image.base64}
          alt={image.fileName}
          className={isExpanded ? 'max-w-full' : 'max-h-48 object-contain'}
        />
      </button>
      <span className="text-[10px] text-white/30 mt-1 block">{image.fileName}</span>
    </div>
  )
}

interface MessageImagesProps {
  images: ImageAttachmentData[]
}

export function MessageImages({ images }: MessageImagesProps) {
  if (!images || images.length === 0) return null

  return (
    <div className="flex flex-wrap gap-2 py-1">
      {images.map((img) => (
        <InlineImage key={img.id} image={img} />
      ))}
    </div>
  )
}