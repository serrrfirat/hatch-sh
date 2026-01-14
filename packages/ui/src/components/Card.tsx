import { forwardRef } from 'react'
import { motion, type HTMLMotionProps } from 'framer-motion'
import { cn } from '../lib/utils'

interface CardProps extends HTMLMotionProps<'div'> {
  variant?: 'default' | 'glass' | 'bordered'
  hoverable?: boolean
}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant = 'default', hoverable, children, ...props }, ref) => {
    const variants = {
      default: 'bg-bg-secondary',
      glass: 'bg-bg-secondary/50 backdrop-blur-xl',
      bordered: 'bg-bg-secondary border border-border',
    }

    return (
      <motion.div
        ref={ref}
        className={cn(
          'rounded-xl p-4',
          variants[variant],
          hoverable && 'cursor-pointer hover:border-accent-green/50 transition-colors',
          className
        )}
        whileHover={hoverable ? { scale: 1.01 } : undefined}
        {...props}
      >
        {children}
      </motion.div>
    )
  }
)

Card.displayName = 'Card'
