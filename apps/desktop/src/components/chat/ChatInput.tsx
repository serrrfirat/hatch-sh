import {
  useState,
  useRef,
  useEffect,
  useCallback,
  type KeyboardEvent,
  type ChangeEvent,
  type ReactNode,
  type DragEvent,
} from 'react'
import { motion } from 'framer-motion'
import { cn } from '@hatch/ui'
import { useSettingsStore } from '../../stores/settingsStore'
import { AgentPicker } from './AgentPicker'
import { MentionPopover, type MentionItem } from './MentionPopover'
import { buildMentionContent } from '../../lib/fileMentionContent'
import { isImageFile, isImageTooLarge, imageToBase64 } from '../../lib/imageAttachment'
import type { ImageAttachmentData } from '../../lib/imageAttachment'
import { ImagePreviewBar } from './ImageAttachment'

interface ChatInputProps {
  onSend: (message: string, images?: ImageAttachmentData[]) => void
  isLoading: boolean
  onStop?: () => void
  placeholder?: string
  disabled?: boolean
}

function BrainIcon({ className }: { className?: string }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z" />
      <path d="M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z" />
      <path d="M15 13a4.5 4.5 0 0 1-3-4 4.5 4.5 0 0 1-3 4" />
      <path d="M17.599 6.5a3 3 0 0 0 .399-1.375" />
      <path d="M6.003 5.125A3 3 0 0 0 6.401 6.5" />
      <path d="M3.477 10.896a4 4 0 0 1 .585-.396" />
      <path d="M19.938 10.5a4 4 0 0 1 .585.396" />
      <path d="M6 18a4 4 0 0 1-1.967-.516" />
      <path d="M19.967 17.484A4 4 0 0 1 18 18" />
    </svg>
  )
}

function MapIcon({ className }: { className?: string }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M14.106 5.553a2 2 0 0 0 1.788 0l3.659-1.83A1 1 0 0 1 21 4.619v12.764a1 1 0 0 1-.553.894l-4.553 2.277a2 2 0 0 1-1.788 0l-4.212-2.106a2 2 0 0 0-1.788 0l-3.659 1.83A1 1 0 0 1 3 19.381V6.618a1 1 0 0 1 .553-.894l4.553-2.277a2 2 0 0 1 1.788 0z" />
      <path d="M15 5.764v15" />
      <path d="M9 3.236v15" />
    </svg>
  )
}

function ModeToggle({
  label,
  icon,
  isActive,
  onToggle,
}: {
  label: string
  icon: ReactNode
  isActive: boolean
  onToggle: () => void
}) {
  return (
    <motion.button
      onClick={onToggle}
      className={cn(
        'flex items-center gap-1.5 py-1 px-2.5 rounded-lg transition-colors duration-200',
        isActive ? 'bg-white/10 text-white' : 'text-neutral-500 hover:text-white hover:bg-white/5'
      )}
      whileTap={{ scale: 0.95 }}
    >
      {icon}
      <span className="text-[10px] font-medium uppercase tracking-wider">{label}</span>
    </motion.button>
  )
}

const ACCEPTED_IMAGE_TYPES = 'image/png,image/jpeg,image/gif,image/webp,image/svg+xml'

export function ChatInput({ onSend, isLoading, onStop, placeholder, disabled }: ChatInputProps) {
  const [message, setMessage] = useState('')
  const [showMentionPopover, setShowMentionPopover] = useState(false)
  const [mentionQuery, setMentionQuery] = useState('')
  const [mentionStartIndex, setMentionStartIndex] = useState(-1)
  const [fileAttachments, setFileAttachments] = useState<string[]>([])
  const [imageAttachments, setImageAttachments] = useState<ImageAttachmentData[]>([])
  const [isDragOver, setIsDragOver] = useState(false)
  const [imageError, setImageError] = useState<string | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const { planModeEnabled, thinkingEnabled, setPlanModeEnabled, setThinkingEnabled } =
    useSettingsStore()

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 160)}px`
    }
  }, [message])

  useEffect(() => {
    if (imageError) {
      const timer = setTimeout(() => setImageError(null), 4000)
      return () => clearTimeout(timer)
    }
  }, [imageError])

  const processImageFiles = useCallback(async (files: FileList | File[]) => {
    const fileArray = Array.from(files)
    for (const file of fileArray) {
      if (!isImageFile(file.name)) {
        setImageError(`"${file.name}" is not a supported image type`)
        continue
      }
      if (isImageTooLarge(file.size)) {
        setImageError(`"${file.name}" exceeds 5MB limit`)
        continue
      }
      const base64 = await imageToBase64(file)
      const attachment: ImageAttachmentData = {
        id: crypto.randomUUID(),
        fileName: file.name,
        mimeType: file.type,
        base64,
        sizeBytes: file.size,
      }
      setImageAttachments((prev) => [...prev, attachment])
    }
  }, [])

  const handleDragOver = useCallback((e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
  }, [])

  const handleDrop = useCallback(
    async (e: DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setIsDragOver(false)
      if (e.dataTransfer.files.length > 0) {
        await processImageFiles(e.dataTransfer.files)
      }
    },
    [processImageFiles]
  )

  const handleFileInputChange = useCallback(
    async (e: ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
        await processImageFiles(e.target.files)
        e.target.value = ''
      }
    },
    [processImageFiles]
  )

  const removeImageAttachment = useCallback((id: string) => {
    setImageAttachments((prev) => prev.filter((img) => img.id !== id))
  }, [])

  const handleSend = () => {
    const hasContent = message.trim() || imageAttachments.length > 0
    if (hasContent && !isLoading && !showMentionPopover) {
      const contentPrefix = fileAttachments.join('')
      onSend(
        contentPrefix + message.trim(),
        imageAttachments.length > 0 ? imageAttachments : undefined
      )
      setMessage('')
      setFileAttachments([])
      setImageAttachments([])
    }
  }

  const handleChange = useCallback((e: ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value
    const cursorPos = e.target.selectionStart || 0
    setMessage(value)
    const textBeforeCursor = value.slice(0, cursorPos)
    const lastAtIndex = textBeforeCursor.lastIndexOf('@')
    if (lastAtIndex !== -1) {
      const textAfterAt = textBeforeCursor.slice(lastAtIndex + 1)
      if (!textAfterAt.includes(' ')) {
        setShowMentionPopover(true)
        setMentionStartIndex(lastAtIndex)
        setMentionQuery(textAfterAt)
        return
      }
    }
    setShowMentionPopover(false)
    setMentionQuery('')
    setMentionStartIndex(-1)
  }, [])

  const handleMentionSelect = useCallback(
    (item: MentionItem) => {
      if (mentionStartIndex === -1) return
      let mentionText = ''
      switch (item.type) {
        case 'files': {
          if (item.fileContent !== undefined && item.fileSize !== undefined && item.path) {
            const result = buildMentionContent(item.path, item.fileContent, item.fileSize)
            if (result.type === 'content') {
              setFileAttachments((prev) => [...prev, result.text])
            }
            mentionText = `@${item.path} `
          } else {
            mentionText = `@${item.path} `
          }
          break
        }
        case 'skills':
          mentionText = `${item.name} `
          break
        case 'agents':
          mentionText = `@${item.name} `
          break
      }
      const beforeMention = message.slice(0, mentionStartIndex)
      const afterMention = message.slice(mentionStartIndex + mentionQuery.length + 1)
      const newMessage = beforeMention + mentionText + afterMention
      setMessage(newMessage)
      setShowMentionPopover(false)
      setMentionQuery('')
      setMentionStartIndex(-1)
      setTimeout(() => {
        if (textareaRef.current) {
          const newCursorPos = beforeMention.length + mentionText.length
          textareaRef.current.focus()
          textareaRef.current.setSelectionRange(newCursorPos, newCursorPos)
        }
      }, 0)
    },
    [message, mentionStartIndex, mentionQuery]
  )

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (
      showMentionPopover &&
      (e.key === 'Enter' ||
        e.key === 'Escape' ||
        e.key === 'ArrowUp' ||
        e.key === 'ArrowDown' ||
        e.key === 'Tab')
    ) {
      return
    }

    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      handleSend()
    }
  }

  const hasContent = message.trim() || imageAttachments.length > 0

  return (
    <div className="flex justify-center p-4 bg-neutral-950">
      <div className="w-full max-w-3xl">
        <div
          className={cn(
            'relative rounded-2xl',
            'bg-gradient-to-b from-neutral-900 to-neutral-950',
            'shadow-[0_8px_32px_rgba(0,0,0,0.4),0_0_0_1px_rgba(255,255,255,0.05)]',
            isDragOver && 'ring-2 ring-blue-500/50'
          )}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <MentionPopover
            isOpen={showMentionPopover}
            searchQuery={mentionQuery}
            onSelect={handleMentionSelect}
            onClose={() => {
              setShowMentionPopover(false)
              setMentionQuery('')
              setMentionStartIndex(-1)
            }}
          />

          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

          {isDragOver && (
            <div className="absolute inset-0 z-10 flex items-center justify-center rounded-2xl bg-blue-500/10 border-2 border-dashed border-blue-500/30">
              <span className="text-blue-400 text-sm font-medium">Drop images here</span>
            </div>
          )}

          <div className="p-4">
            <ImagePreviewBar images={imageAttachments} onRemove={removeImageAttachment} />

            {imageError && (
              <div className="mb-2 px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
                {imageError}
              </div>
            )}

            <textarea
              ref={textareaRef}
              value={message}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              placeholder={
                placeholder ||
                'What do you want to build? Type @ to mention files, skills, or agents'
              }
              disabled={isLoading || disabled}
              rows={1}
              className={cn(
                'w-full bg-transparent text-white placeholder:text-neutral-600',
                'focus:outline-none resize-none text-sm leading-relaxed max-h-40',
                'disabled:opacity-50'
              )}
            />

            <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/5">
              <div className="flex items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={ACCEPTED_IMAGE_TYPES}
                  multiple
                  onChange={handleFileInputChange}
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="p-2 rounded-lg text-neutral-500 hover:text-white hover:bg-white/5 transition-colors"
                  title="Attach images"
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                  </svg>
                </button>

                <button
                  onClick={() => {
                    if (textareaRef.current) {
                      const cursorPos = textareaRef.current.selectionStart || message.length
                      const newMessage =
                        message.slice(0, cursorPos) + '@' + message.slice(cursorPos)
                      setMessage(newMessage)
                      setMentionStartIndex(cursorPos)
                      setMentionQuery('')
                      setShowMentionPopover(true)
                      setTimeout(() => {
                        if (textareaRef.current) {
                          textareaRef.current.focus()
                          textareaRef.current.setSelectionRange(cursorPos + 1, cursorPos + 1)
                        }
                      }, 0)
                    }
                  }}
                  className={cn(
                    'p-2 rounded-lg transition-colors',
                    showMentionPopover
                      ? 'text-white bg-white/10'
                      : 'text-neutral-500 hover:text-white hover:bg-white/5'
                  )}
                  title="Mention files, skills, or agents (@)"
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <circle cx="12" cy="12" r="4" />
                    <path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-4 8" />
                  </svg>
                </button>

                <div className="w-px h-4 bg-white/10" />

                <AgentPicker />

                <div className="w-px h-4 bg-white/10" />

                <ModeToggle
                  label="Plan"
                  icon={<MapIcon />}
                  isActive={planModeEnabled}
                  onToggle={() => setPlanModeEnabled(!planModeEnabled)}
                />
                <ModeToggle
                  label="Think"
                  icon={<BrainIcon />}
                  isActive={thinkingEnabled}
                  onToggle={() => setThinkingEnabled(!thinkingEnabled)}
                />

                <div className="w-px h-4 bg-white/10" />

                <span className="text-[10px] text-neutral-700 px-1">\u2318+Enter</span>
              </div>

              {isLoading ? (
                <motion.button
                  onClick={onStop}
                  className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-medium bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-all"
                  whileTap={{ scale: 0.95 }}
                >
                  <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
                    <rect x="3" y="3" width="10" height="10" rx="1" />
                  </svg>
                  Stop
                </motion.button>
              ) : (
                <motion.button
                  onClick={handleSend}
                  disabled={!hasContent}
                  className={cn(
                    'flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-medium transition-all',
                    hasContent
                      ? 'bg-white text-black hover:bg-neutral-200'
                      : 'bg-white/5 text-neutral-600 cursor-not-allowed'
                  )}
                  whileHover={hasContent ? { scale: 1.02 } : {}}
                  whileTap={hasContent ? { scale: 0.98 } : {}}
                >
                  Send
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                  >
                    <path d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                </motion.button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
