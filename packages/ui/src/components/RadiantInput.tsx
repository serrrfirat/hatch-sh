'use client'
import React, { useState, useRef, useEffect } from 'react'
import { cn } from '../lib/utils'

export interface RadiantInputProps {
  placeholder?: string
  value?: string
  onChange?: (value: string) => void
  onSubmit?: (value: string) => void
  onStop?: () => void
  className?: string
  disabled?: boolean
  isLoading?: boolean
}

/**
 * RadiantInput
 *
 * A high-fidelity input with liquid metal styling.
 * Designed for AI chat interactions.
 */
export function RadiantInput({
  placeholder = "What do you want to build?",
  value: propValue,
  onChange: propOnChange,
  onSubmit,
  onStop,
  className,
  disabled,
  isLoading = false
}: RadiantInputProps) {
  const [internalValue, setInternalValue] = useState("")
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const isControlled = propValue !== undefined
  const value = isControlled ? propValue : internalValue

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 160)}px`
    }
  }, [value])

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (!isControlled) {
      setInternalValue(e.target.value)
    }
    propOnChange?.(e.target.value)
  }

  const handleSubmit = () => {
    if (value && !disabled && !isLoading) {
      onSubmit?.(value)
      if (!isControlled) setInternalValue("")
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      handleSubmit()
    }
  }

  return (
    <div className={cn("relative w-full", className)}>
      {/* Liquid Metal Container */}
      <div className={cn(
        "relative rounded-2xl transition-all duration-300",
        // Liquid metal base
        "bg-gradient-to-b from-neutral-800 via-neutral-900 to-black",
        // Border with metallic sheen
        "border border-white/20",
        // Subtle shadow for depth
        "shadow-[0_1px_0_0_rgba(255,255,255,0.1)_inset,0_-1px_0_0_rgba(0,0,0,0.5)_inset]"
      )}>
        {/* Top highlight line */}
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent rounded-t-2xl" />

        {/* Inner Content */}
        <div className="relative z-10 flex items-end gap-3 p-3">

          {/* Textarea */}
          <div className="flex-1 relative">
            <textarea
              ref={textareaRef}
              value={value}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              disabled={disabled || isLoading}
              rows={1}
              className={cn(
                "w-full bg-transparent border-none outline-none resize-none",
                "text-white placeholder:text-neutral-500",
                "text-base font-light tracking-wide",
                "min-h-[24px] max-h-40 py-1 px-1",
                "disabled:opacity-50"
              )}
            />
            <span className="absolute right-1 bottom-1 text-xs text-neutral-600 pointer-events-none">
              {'\u2318'} + Enter
            </span>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 pb-1">
            {isLoading ? (
              <button
                type="button"
                onClick={onStop}
                className={cn(
                  "flex items-center justify-center w-10 h-10 rounded-full",
                  "bg-red-500/20 text-red-400 hover:bg-red-500/30",
                  "transition-all duration-200"
                )}
                aria-label="Stop generation"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                  <rect x="3" y="3" width="10" height="10" rx="1" />
                </svg>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!value || disabled}
                className={cn(
                  "flex items-center justify-center w-10 h-10 rounded-full",
                  "transition-all duration-200",
                  value
                    ? "bg-white text-black hover:scale-105 active:scale-95"
                    : "bg-neutral-800 text-neutral-500 cursor-not-allowed"
                )}
                aria-label="Send message"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 19V5M5 12l7-7 7 7" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Bottom reflection */}
        <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-white/[0.02] to-transparent rounded-b-2xl pointer-events-none" />
      </div>
    </div>
  )
}

export default RadiantInput
