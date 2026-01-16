import type { ReactNode } from 'react'
import { cn } from '../lib/utils'

interface BadgeProps {
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info'
  size?: 'sm' | 'md'
  children: ReactNode
  className?: string
}

export function Badge({ variant = 'default', size = 'md', children, className }: BadgeProps) {
  const variants = {
    default: 'bg-bg-tertiary text-gray-300',
    success: 'bg-accent-green/10 text-accent-green',
    warning: 'bg-accent-orange/10 text-accent-orange',
    danger: 'bg-accent-red/10 text-accent-red',
    info: 'bg-accent-purple/10 text-accent-purple',
  }

  const sizes = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-2.5 py-1 text-sm',
  }

  return (
    <span className={cn(
      'inline-flex items-center font-medium rounded-full',
      variants[variant],
      sizes[size],
      className
    )}>
      {children}
    </span>
  )
}
