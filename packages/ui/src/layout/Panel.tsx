import { forwardRef, type HTMLAttributes } from 'react'
import { cn } from '../lib/utils'

interface PanelProps extends HTMLAttributes<HTMLDivElement> {
  resizable?: boolean
  defaultWidth?: number
  minWidth?: number
  maxWidth?: number
}

export const Panel = forwardRef<HTMLDivElement, PanelProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          'bg-bg-secondary border-border overflow-hidden flex flex-col',
          className
        )}
        {...props}
      >
        {children}
      </div>
    )
  }
)

Panel.displayName = 'Panel'

export function PanelHeader({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('px-4 py-3 border-b border-border', className)} {...props}>
      {children}
    </div>
  )
}

export function PanelContent({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('flex-1 overflow-auto', className)} {...props}>
      {children}
    </div>
  )
}
