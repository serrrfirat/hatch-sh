import { forwardRef, type InputHTMLAttributes } from 'react'
import { cn } from '../lib/utils'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  prefix?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, prefix, ...props }, ref) => {
    return (
      <div className="space-y-1.5">
        {label && (
          <label className="block text-sm font-medium text-gray-400">
            {label}
          </label>
        )}
        <div className="relative">
          {prefix && (
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
              {prefix}
            </span>
          )}
          <input
            ref={ref}
            className={cn(
              'w-full bg-bg-tertiary border border-border rounded-lg px-4 py-2.5',
              'text-white placeholder:text-gray-600',
              'focus:outline-none focus:border-accent-green focus:ring-1 focus:ring-accent-green/20',
              'transition-all duration-200',
              prefix && 'pl-8',
              error && 'border-accent-red focus:border-accent-red focus:ring-accent-red/20',
              className
            )}
            {...props}
          />
        </div>
        {error && (
          <p className="text-sm text-accent-red">{error}</p>
        )}
      </div>
    )
  }
)

Input.displayName = 'Input'
