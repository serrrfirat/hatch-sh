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
