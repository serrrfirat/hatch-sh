import { useEffect, useMemo, useRef } from 'react'

interface LetterGlitchBackgroundProps {
  className?: string
  glitchColors?: string[]
  glitchSpeed?: number
  centerVignette?: boolean
  outerVignette?: boolean
  smooth?: boolean
  characters?: string
  brandPhrase?: string
  phraseIntervalMs?: number
}

interface Cell {
  char: string
  color: string
  targetColor: string
  colorProgress: number
  lockUntil: number
}

const DEFAULT_CHARACTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ!@#$&*()-_+=/[]{};:<>.,0123456789'
const DEFAULT_COLORS = ['#1a1a2e', '#2d2d3d', '#4a4a5a']

const hexToRgb = (hex: string): { r: number; g: number; b: number } | null => {
  const expanded = hex.replace(
    /^#?([a-f\d])([a-f\d])([a-f\d])$/i,
    (_m, r, g, b) => r + r + g + g + b + b
  )
  const match = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(expanded)
  if (!match) return null
  return { r: parseInt(match[1], 16), g: parseInt(match[2], 16), b: parseInt(match[3], 16) }
}

const interpolateColor = (
  start: { r: number; g: number; b: number },
  end: { r: number; g: number; b: number },
  factor: number
): string => {
  const r = Math.round(start.r + (end.r - start.r) * factor)
  const g = Math.round(start.g + (end.g - start.g) * factor)
  const b = Math.round(start.b + (end.b - start.b) * factor)
  return `rgb(${r}, ${g}, ${b})`
}

const parseRgb = (color: string): { r: number; g: number; b: number } | null => {
  if (color.startsWith('rgb')) {
    const parts = color.match(/\d+/g)
    if (parts && parts.length >= 3) {
      return { r: parseInt(parts[0], 10), g: parseInt(parts[1], 10), b: parseInt(parts[2], 10) }
    }
  }
  return hexToRgb(color)
}

const randomIndex = (max: number): number => Math.floor(Math.random() * Math.max(1, max))

export function LetterGlitchBackground({
  className,
  glitchColors = DEFAULT_COLORS,
  glitchSpeed = 50,
  centerVignette = false,
  outerVignette = true,
  smooth = true,
  characters = DEFAULT_CHARACTERS,
  brandPhrase = 'hatch.sh',
  phraseIntervalMs = 3600,
}: LetterGlitchBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const animationRef = useRef<number>(0)
  const cellsRef = useRef<Cell[]>([])
  const gridRef = useRef({ columns: 0, rows: 0 })
  const contextRef = useRef<CanvasRenderingContext2D | null>(null)
  const lastGlitchTimeRef = useRef(Date.now())
  const lastPhraseTimeRef = useRef(Date.now())

  const palette = useMemo(
    () => (glitchColors.length > 0 ? glitchColors : DEFAULT_COLORS),
    [glitchColors]
  )

  const symbols = useMemo(
    () => Array.from(characters.length > 0 ? characters : DEFAULT_CHARACTERS),
    [characters]
  )

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const root = canvas.parentElement
    if (!root) return

    contextRef.current = canvas.getContext('2d')
    if (!contextRef.current) return

    const fontSize = 16
    const charWidth = 10
    const charHeight = 20

    const getRandomChar = (): string => symbols[randomIndex(symbols.length)] ?? 'A'
    const getRandomColor = (): string => palette[randomIndex(palette.length)] ?? '#2d2d3d'

    const calculateGrid = (width: number, height: number) => ({
      columns: Math.max(1, Math.ceil(width / charWidth)),
      rows: Math.max(1, Math.ceil(height / charHeight)),
    })

    const initializeLetters = (columns: number, rows: number) => {
      gridRef.current = { columns, rows }
      cellsRef.current = Array.from({ length: columns * rows }, () => ({
        char: getRandomChar(),
        color: getRandomColor(),
        targetColor: getRandomColor(),
        colorProgress: 1,
        lockUntil: 0,
      }))
    }

    const drawLetters = () => {
      const ctx = contextRef.current
      if (!ctx || !canvas || cellsRef.current.length === 0) return
      const rect = canvas.getBoundingClientRect()
      ctx.clearRect(0, 0, rect.width, rect.height)
      ctx.font = `${fontSize}px monospace`
      ctx.textBaseline = 'top'

      cellsRef.current.forEach((cell, index) => {
        const x = (index % gridRef.current.columns) * charWidth
        const y = Math.floor(index / gridRef.current.columns) * charHeight
        ctx.fillStyle = cell.color
        ctx.fillText(cell.char, x, y)
      })
    }

    const resizeCanvas = () => {
      const ctx = contextRef.current
      if (!ctx) return

      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const rect = root.getBoundingClientRect()
      canvas.width = Math.max(1, Math.floor(rect.width * dpr))
      canvas.height = Math.max(1, Math.floor(rect.height * dpr))
      canvas.style.width = `${rect.width}px`
      canvas.style.height = `${rect.height}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

      const { columns, rows } = calculateGrid(rect.width, rect.height)
      initializeLetters(columns, rows)
      drawLetters()
    }

    const stampBrandPhrase = () => {
      const phrase = brandPhrase.trim()
      if (phrase.length === 0) return
      const chars = Array.from(phrase)
      if (chars.length > gridRef.current.columns) return

      const row = randomIndex(gridRef.current.rows)
      const startCol = randomIndex(gridRef.current.columns - chars.length + 1)
      const holdUntil = Date.now() + 500

      chars.forEach((character, offset) => {
        const index = row * gridRef.current.columns + (startCol + offset)
        const cell = cellsRef.current[index]
        if (!cell) return
        cell.char = character
        cell.targetColor = '#ffffff'
        cell.colorProgress = 0
        cell.lockUntil = holdUntil
      })
    }

    const updateLetters = () => {
      if (cellsRef.current.length === 0) return
      const now = Date.now()
      const updateCount = Math.max(1, Math.floor(cellsRef.current.length * 0.05))

      for (let i = 0; i < updateCount; i++) {
        const index = randomIndex(cellsRef.current.length)
        const cell = cellsRef.current[index]
        if (!cell || now < cell.lockUntil) continue

        cell.char = getRandomChar()
        cell.targetColor = getRandomColor()

        if (!smooth) {
          cell.color = cell.targetColor
          cell.colorProgress = 1
        } else {
          cell.colorProgress = 0
        }
      }
    }

    const handleSmoothTransitions = () => {
      let needsRedraw = false

      for (const cell of cellsRef.current) {
        if (cell.colorProgress >= 1) continue

        cell.colorProgress = Math.min(1, cell.colorProgress + 0.05)

        const currentRgb = parseRgb(cell.color)
        const endRgb = hexToRgb(cell.targetColor)

        if (currentRgb && endRgb) {
          cell.color = interpolateColor(currentRgb, endRgb, 0.1)
          needsRedraw = true
        }
      }

      if (needsRedraw) {
        drawLetters()
      }
    }

    const animate = () => {
      const now = Date.now()

      if (now - lastGlitchTimeRef.current >= glitchSpeed) {
        updateLetters()
        drawLetters()
        lastGlitchTimeRef.current = now
      }

      if (now - lastPhraseTimeRef.current >= phraseIntervalMs) {
        stampBrandPhrase()
        lastPhraseTimeRef.current = now
      }

      if (smooth) {
        handleSmoothTransitions()
      }

      animationRef.current = requestAnimationFrame(animate)
    }

    resizeCanvas()
    animate()

    const resizeObserver = new ResizeObserver(() => {
      cancelAnimationFrame(animationRef.current)
      resizeCanvas()
      animate()
    })
    resizeObserver.observe(root)

    return () => {
      cancelAnimationFrame(animationRef.current)
      resizeObserver.disconnect()
    }
  }, [brandPhrase, glitchSpeed, palette, phraseIntervalMs, smooth, symbols])

  return (
    <div className={`relative h-full w-full overflow-hidden bg-black ${className ?? ''}`}>
      <canvas ref={canvasRef} className="block h-full w-full" />
      {outerVignette && (
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle,transparent_60%,black_100%)]" />
      )}
      {centerVignette && (
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle,rgba(0,0,0,0.8)_0%,transparent_60%)]" />
      )}
    </div>
  )
}

export default LetterGlitchBackground
