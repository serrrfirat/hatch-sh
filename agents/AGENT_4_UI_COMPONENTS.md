# Agent Task: UI Component Library (Degen Design System)

## Priority: HIGH - Needed by all UI modules
## Depends on: Module 1 (Foundation)
## Estimated Time: 3-4 hours

## Objective
Build a shared UI component library with the degen aesthetic - neon colors, glow effects, dark theme, and micro-interactions using Framer Motion.

## Tasks

### 1. Initialize UI Package
```bash
mkdir -p packages/ui/src
cd packages/ui
pnpm init
pnpm add react framer-motion clsx tailwind-merge
pnpm add -D typescript @types/react tailwindcss
```

Create `packages/ui/package.json`:
```json
{
  "name": "@vibed/ui",
  "version": "0.0.1",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "sideEffects": false,
  "dependencies": {
    "clsx": "^2.1.0",
    "framer-motion": "^11.0.0",
    "tailwind-merge": "^2.2.0"
  },
  "peerDependencies": {
    "react": "^18.0.0",
    "react-dom": "^18.0.0"
  },
  "devDependencies": {
    "@types/react": "^18.2.0",
    "typescript": "^5.4.0"
  }
}
```

### 2. Create Utility Functions
Create `packages/ui/src/lib/utils.ts`:
```typescript
import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

### 3. Create Button Component
Create `packages/ui/src/components/Button.tsx`:
```typescript
import { forwardRef, type ButtonHTMLAttributes } from 'react'
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
```

### 4. Create Input Component
Create `packages/ui/src/components/Input.tsx`:
```typescript
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
```

### 5. Create Card Component
Create `packages/ui/src/components/Card.tsx`:
```typescript
import { forwardRef, type HTMLAttributes } from 'react'
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
```

### 6. Create Badge Component
Create `packages/ui/src/components/Badge.tsx`:
```typescript
import { cn } from '../lib/utils'

interface BadgeProps {
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info'
  size?: 'sm' | 'md'
  children: React.ReactNode
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
```

### 7. Create Modal Component
Create `packages/ui/src/components/Modal.tsx`:
```typescript
import { useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '../lib/utils'

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title?: string
  children: React.ReactNode
  className?: string
}

export function Modal({ isOpen, onClose, title, children, className }: ModalProps) {
  // Close on escape
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    if (isOpen) {
      document.addEventListener('keydown', handleEscape)
      document.body.style.overflow = 'hidden'
    }
    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.body.style.overflow = ''
    }
  }, [isOpen, onClose])

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className={cn(
              'fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50',
              'bg-bg-secondary border border-border rounded-xl',
              'w-full max-w-md p-6',
              className
            )}
          >
            {title && (
              <h2 className="text-xl font-bold mb-4">{title}</h2>
            )}
            {children}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
```

### 8. Create Tabs Component
Create `packages/ui/src/components/Tabs.tsx`:
```typescript
import { useState } from 'react'
import { motion } from 'framer-motion'
import { cn } from '../lib/utils'

interface Tab {
  id: string
  label: string
  content: React.ReactNode
}

interface TabsProps {
  tabs: Tab[]
  defaultTab?: string
  className?: string
}

export function Tabs({ tabs, defaultTab, className }: TabsProps) {
  const [activeTab, setActiveTab] = useState(defaultTab || tabs[0]?.id)

  return (
    <div className={className}>
      {/* Tab list */}
      <div className="flex border-b border-border">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'relative px-4 py-2 text-sm font-medium transition-colors',
              activeTab === tab.id ? 'text-white' : 'text-gray-500 hover:text-gray-300'
            )}
          >
            {tab.label}
            {activeTab === tab.id && (
              <motion.div
                layoutId="activeTab"
                className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent-green"
              />
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="mt-4">
        {tabs.find(t => t.id === activeTab)?.content}
      </div>
    </div>
  )
}
```

### 9. Create Layout Components
Create `packages/ui/src/layout/Panel.tsx`:
```typescript
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
```

### 10. Create Animation Utilities
Create `packages/ui/src/animations/variants.ts`:
```typescript
import { type Variants } from 'framer-motion'

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
}

export const slideUp: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
}

export const slideIn: Variants = {
  hidden: { opacity: 0, x: -20 },
  visible: { opacity: 1, x: 0 },
}

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: { opacity: 1, scale: 1 },
}

export const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1 },
  },
}

export const glitch: Variants = {
  idle: { x: 0 },
  glitch: {
    x: [0, -2, 2, -2, 2, 0],
    transition: { duration: 0.3 },
  },
}
```

### 11. Create Confetti Component
Create `packages/ui/src/animations/Confetti.tsx`:
```typescript
import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface ConfettiProps {
  trigger: boolean
  duration?: number
}

export function Confetti({ trigger, duration = 2000 }: ConfettiProps) {
  const [particles, setParticles] = useState<{ id: number; x: number; color: string }[]>([])

  useEffect(() => {
    if (trigger) {
      const colors = ['#00ff88', '#ff6b35', '#a855f7', '#ffffff']
      const newParticles = Array.from({ length: 50 }, (_, i) => ({
        id: i,
        x: Math.random() * 100,
        color: colors[Math.floor(Math.random() * colors.length)],
      }))
      setParticles(newParticles)

      const timer = setTimeout(() => setParticles([]), duration)
      return () => clearTimeout(timer)
    }
  }, [trigger, duration])

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-50">
      <AnimatePresence>
        {particles.map((particle) => (
          <motion.div
            key={particle.id}
            initial={{ y: -20, x: `${particle.x}vw`, opacity: 1, rotate: 0 }}
            animate={{
              y: '100vh',
              rotate: 360 * (Math.random() > 0.5 ? 1 : -1),
            }}
            exit={{ opacity: 0 }}
            transition={{
              duration: 2 + Math.random(),
              ease: 'linear',
            }}
            className="absolute w-2 h-2"
            style={{ backgroundColor: particle.color }}
          />
        ))}
      </AnimatePresence>
    </div>
  )
}
```

### 12. Create Index Export
Create `packages/ui/src/index.ts`:
```typescript
// Components
export { Button } from './components/Button'
export { Input } from './components/Input'
export { Card } from './components/Card'
export { Badge } from './components/Badge'
export { Modal } from './components/Modal'
export { Tabs } from './components/Tabs'

// Layout
export { Panel, PanelHeader, PanelContent } from './layout/Panel'

// Animations
export { Confetti } from './animations/Confetti'
export * from './animations/variants'

// Utils
export { cn } from './lib/utils'
```

## Directory Structure
```
packages/ui/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts
│   ├── lib/
│   │   └── utils.ts
│   ├── components/
│   │   ├── Button.tsx
│   │   ├── Input.tsx
│   │   ├── Card.tsx
│   │   ├── Badge.tsx
│   │   ├── Modal.tsx
│   │   └── Tabs.tsx
│   ├── layout/
│   │   └── Panel.tsx
│   └── animations/
│       ├── variants.ts
│       └── Confetti.tsx
```

## Definition of Done
- [ ] All base components built and typed
- [ ] Components use degen color palette
- [ ] Hover/focus states have glow effects
- [ ] Animations working with Framer Motion
- [ ] Components exported from packages/ui
- [ ] Can import `@vibed/ui` in web app

## Usage in Web App
```typescript
// apps/web/src/components/SomeComponent.tsx
import { Button, Card, Input, Badge } from '@vibed/ui'

export function SomeComponent() {
  return (
    <Card variant="bordered" hoverable>
      <Input label="Token Name" placeholder="My Cool Token" />
      <Button variant="primary" glow>
        Launch Token
      </Button>
      <Badge variant="success">Live</Badge>
    </Card>
  )
}
```

## Notes
- All components should work with TailwindCSS preset from packages/config
- Use CSS variables from the tailwind preset for consistency
- Keep components simple and composable
- Add more components as needed (Dropdown, Avatar, Tooltip, etc.)
