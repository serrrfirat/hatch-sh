import { COLORS } from '../../lib/ideaMaze/animations'

interface DotGridBackgroundProps {
  zoom?: number
  offsetX?: number
  offsetY?: number
}

export function AtmosphericBackground({ zoom = 1, offsetX = 0, offsetY = 0 }: DotGridBackgroundProps) {
  // Base dot spacing - will scale with zoom
  const baseSpacing = 24
  const spacing = baseSpacing * zoom

  // Dot size scales slightly with zoom but stays small
  const dotSize = Math.max(1, 1.5 * Math.min(zoom, 1.5))

  return (
    <div
      className="absolute inset-0 overflow-hidden pointer-events-none"
      style={{ background: COLORS.background }}
    >
      {/* Dot grid pattern */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `radial-gradient(circle, rgba(255, 255, 255, 0.08) ${dotSize}px, transparent ${dotSize}px)`,
          backgroundSize: `${spacing}px ${spacing}px`,
          backgroundPosition: `${offsetX % spacing}px ${offsetY % spacing}px`,
        }}
      />
    </div>
  )
}
