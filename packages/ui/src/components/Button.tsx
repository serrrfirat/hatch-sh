import { forwardRef } from 'react'
import { motion, type HTMLMotionProps } from 'framer-motion'
import { cn } from '../lib/utils'

interface ButtonProps extends HTMLMotionProps<'button'> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  isLoading?: boolean
  glow?: boolean
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', isLoading, glow, children, disabled, ...props }, ref) => {
    const baseStyles = 'inline-flex items-center justify-center font-semibold rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed'

    const variants = {
      primary: 'bg-accent-green text-black hover:shadow-glow-green active:scale-95',
      secondary: 'bg-bg-tertiary text-white border border-border hover:border-accent-green hover:text-accent-green',
      ghost: 'bg-transparent text-gray-400 hover:text-white hover:bg-bg-tertiary',
      danger: 'bg-accent-red/10 text-accent-red border border-accent-red/20 hover:bg-accent-red/20',
    }

    const sizes = {
      sm: 'px-3 py-1.5 text-sm',
      md: 'px-4 py-2 text-base',
      lg: 'px-6 py-3 text-lg',
    }

    return (
      <motion.button
        ref={ref}
        className={cn(baseStyles, variants[variant], sizes[size], glow && 'animate-glow-pulse', className)}
        disabled={disabled || isLoading}
        whileHover={{ scale: disabled ? 1 : 1.02 }}
        whileTap={{ scale: disabled ? 1 : 0.98 }}
        {...props}
      >
        {isLoading ? (
          <>
            <LoadingSpinner className="mr-2" />
            Loading...
          </>
        ) : children}
      </motion.button>
    )
  }
)

function LoadingSpinner({ className }: { className?: string }) {
  return (
    <svg className={cn('animate-spin h-4 w-4', className)} viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  )
}

Button.displayName = 'Button'
