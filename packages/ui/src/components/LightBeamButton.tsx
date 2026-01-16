'use client'
import React from 'react'
import { motion } from 'framer-motion'
import { cn } from '../lib/utils'

export interface LightBeamButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode
  className?: string
  gradientColors?: [string, string, string]
}

/**
 * LightBeamButton
 *
 * A high-performance button with a rotating light beam border effect.
 * Uses CSS @property for smooth gradient rotation animations on the border.
 */
export function LightBeamButton({
  children,
  className,
  onClick,
  gradientColors = ["#8b5cf6", "#06b6d4", "#8b5cf6"], // Violet -> Cyan -> Violet
  onAnimationStart: _onAnimationStart,
  onAnimationEnd: _onAnimationEnd,
  onDragStart: _onDragStart,
  onDragEnd: _onDragEnd,
  onDrag: _onDrag,
  ...props
}: LightBeamButtonProps) {
  // Construct the gradient string dynamically based on props
  const gradientString = `conic-gradient(from var(--gradient-angle), transparent 0%, ${gradientColors[0]} 40%, ${gradientColors[1]} 50%, transparent 60%, transparent 100%)`

  return (
    <>
      <style>{`
        @property --gradient-angle {
          syntax: "<angle>";
          initial-value: 0deg;
          inherits: false;
        }
        @keyframes border-spin {
          from { --gradient-angle: 0deg; }
          to { --gradient-angle: 360deg; }
        }
        .animate-border-spin {
          animation: border-spin 2s linear infinite;
        }
      `}</style>

      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={onClick}
        className={cn(
          "group relative isolate overflow-hidden rounded-full bg-neutral-950 px-8 py-3 text-sm font-medium text-white transition-all hover:bg-neutral-900",
          "shadow-[0_0_20px_-5px_rgba(139,92,246,0.3)] hover:shadow-[0_0_25px_-5px_rgba(139,92,246,0.5)]",
          className
        )}
        {...props}
      >
        <span className="relative z-10 flex items-center gap-2">{children}</span>

        {/* Gradient Border Simulation */}
        <div
          className="absolute inset-0 -z-10 rounded-full p-[1px] animate-border-spin"
          style={{
            '--gradient-angle': '0deg',
            background: gradientString
          } as React.CSSProperties}
        />

        {/* Inner Background (keeps text readable) */}
        <div className="absolute inset-[1px] -z-10 rounded-full bg-neutral-950" />

        {/* Shine Effect Overlay */}
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_50%_0%,rgba(139,92,246,0.15)_0%,transparent_60%)] opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
      </motion.button>
    </>
  )
}

export default LightBeamButton
