'use client'
import React, { useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { cn } from '../lib/utils'

export interface GlowButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode
  className?: string
  showArrow?: boolean
  glowColor?: string
  disableGlow?: boolean
}

/**
 * GlowButton
 *
 * Interactive call-to-action button with liquid metal styling and
 * custom glow effect driven by CSS variables for cursor position.
 * Features a right-arrow SVG icon option.
 */
export function GlowButton({
  children,
  className,
  showArrow = false,
  glowColor = 'rgba(255, 255, 255, 0.15)',
  disableGlow = false,
  disabled,
  ...props
}: GlowButtonProps) {
  const buttonRef = useRef<HTMLButtonElement>(null)
  const [cursorPos, setCursorPos] = useState({ x: 0, y: 0 })
  const [isHovered, setIsHovered] = useState(false)

  const handleMouseMove = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (!buttonRef.current || disabled) return
    const rect = buttonRef.current.getBoundingClientRect()
    setCursorPos({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    })
  }

  return (
    <motion.button
      ref={buttonRef}
      whileHover={{ scale: disabled ? 1 : 1.02 }}
      whileTap={{ scale: disabled ? 1 : 0.98 }}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      disabled={disabled}
      className={cn(
        'group relative isolate overflow-hidden rounded-full',
        'px-6 py-3 text-sm font-medium text-white',
        'transition-all duration-300',
        // Liquid metal base - dark with subtle metallic gradient
        'bg-gradient-to-b from-neutral-800 via-neutral-900 to-black',
        // Border with metallic sheen
        'border border-white/20',
        // Subtle shadow for depth
        'shadow-[0_1px_0_0_rgba(255,255,255,0.1)_inset,0_-1px_0_0_rgba(0,0,0,0.5)_inset]',
        // Hover state - more metallic
        'hover:border-white/30 hover:from-neutral-700 hover:via-neutral-800 hover:to-neutral-900',
        // Disabled state
        'disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100',
        className
      )}
      style={{
        '--cursor-x': `${cursorPos.x}px`,
        '--cursor-y': `${cursorPos.y}px`,
        '--glow-color': glowColor,
      } as React.CSSProperties}
      {...props}
    >
      {/* Cursor-tracking glow effect */}
      {!disableGlow && (
        <div
          className={cn(
            'pointer-events-none absolute -inset-px rounded-full transition-opacity duration-300',
            isHovered && !disabled ? 'opacity-100' : 'opacity-0'
          )}
          style={{
            background: `radial-gradient(120px circle at var(--cursor-x) var(--cursor-y), var(--glow-color), transparent 40%)`,
          }}
        />
      )}

      {/* Liquid metal highlight at top */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />

      {/* Content */}
      <span className="relative z-10 flex items-center justify-center gap-2">
        {children}
        {showArrow && (
          <svg
            className={cn(
              'w-4 h-4 transition-transform duration-300',
              'group-hover:translate-x-1'
            )}
            viewBox="0 0 16 16"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M6.5 3.5L11 8L6.5 12.5"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </span>

      {/* Bottom reflection for liquid metal effect */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-white/[0.02] to-transparent" />
    </motion.button>
  )
}

export default GlowButton
