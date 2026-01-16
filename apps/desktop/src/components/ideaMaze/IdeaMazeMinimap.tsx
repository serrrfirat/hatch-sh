import { useCallback, useMemo } from 'react'
import { motion } from 'framer-motion'
import type { IdeaNode, Viewport } from '../../lib/ideaMaze/types'
import { minimapVariants, COLORS } from '../../lib/ideaMaze/animations'

interface IdeaMazeMinimapProps {
  nodes: IdeaNode[]
  viewport: Viewport
  canvasSize: { width: number; height: number }
  onViewportChange: (viewport: Viewport) => void
}

const MINIMAP_WIDTH = 160
const MINIMAP_HEIGHT = 100
const MINIMAP_PADDING = 10

export function IdeaMazeMinimap({
  nodes,
  viewport,
  canvasSize,
  onViewportChange,
}: IdeaMazeMinimapProps) {
  // Calculate bounds of all nodes
  const bounds = useMemo(() => {
    if (nodes.length === 0) {
      return { minX: 0, minY: 0, maxX: 1000, maxY: 800, width: 1000, height: 800 }
    }

    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity

    for (const node of nodes) {
      minX = Math.min(minX, node.position.x)
      minY = Math.min(minY, node.position.y)
      maxX = Math.max(maxX, node.position.x + node.dimensions.width)
      maxY = Math.max(maxY, node.position.y + node.dimensions.height)
    }

    // Add padding
    const padding = 100
    minX -= padding
    minY -= padding
    maxX += padding
    maxY += padding

    return {
      minX,
      minY,
      maxX,
      maxY,
      width: maxX - minX,
      height: maxY - minY,
    }
  }, [nodes])

  // Calculate scale factor
  const scale = Math.min(
    (MINIMAP_WIDTH - MINIMAP_PADDING * 2) / bounds.width,
    (MINIMAP_HEIGHT - MINIMAP_PADDING * 2) / bounds.height
  )

  // Convert world coordinates to minimap coordinates
  const toMinimap = useCallback(
    (x: number, y: number) => ({
      x: (x - bounds.minX) * scale + MINIMAP_PADDING,
      y: (y - bounds.minY) * scale + MINIMAP_PADDING,
    }),
    [bounds, scale]
  )

  // Calculate viewport rectangle in minimap coordinates
  const viewportRect = useMemo(() => {
    const topLeft = toMinimap(-viewport.x / viewport.zoom, -viewport.y / viewport.zoom)
    const width = (canvasSize.width / viewport.zoom) * scale
    const height = (canvasSize.height / viewport.zoom) * scale

    return {
      x: topLeft.x,
      y: topLeft.y,
      width,
      height,
    }
  }, [viewport, canvasSize, toMinimap, scale])

  // Handle click on minimap to pan
  const handleClick = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      const rect = e.currentTarget.getBoundingClientRect()
      const clickX = e.clientX - rect.left
      const clickY = e.clientY - rect.top

      // Convert minimap click to world coordinates
      const worldX = (clickX - MINIMAP_PADDING) / scale + bounds.minX
      const worldY = (clickY - MINIMAP_PADDING) / scale + bounds.minY

      // Center viewport on clicked point
      onViewportChange({
        x: -worldX * viewport.zoom + canvasSize.width / 2,
        y: -worldY * viewport.zoom + canvasSize.height / 2,
        zoom: viewport.zoom,
      })
    },
    [scale, bounds, viewport, canvasSize, onViewportChange]
  )

  return (
    <motion.div
      variants={minimapVariants}
      initial="hidden"
      animate="visible"
      exit="hidden"
      className="absolute bottom-4 right-4 bg-neutral-900/80 backdrop-blur-lg rounded-lg border border-white/10 overflow-hidden shadow-xl"
    >
      <svg
        width={MINIMAP_WIDTH}
        height={MINIMAP_HEIGHT}
        onClick={handleClick}
        className="cursor-pointer"
      >
        {/* Background */}
        <rect
          x={0}
          y={0}
          width={MINIMAP_WIDTH}
          height={MINIMAP_HEIGHT}
          fill={COLORS.background}
          fillOpacity={0.5}
        />

        {/* Nodes */}
        {nodes.map((node) => {
          const pos = toMinimap(node.position.x, node.position.y)
          return (
            <rect
              key={node.id}
              x={pos.x}
              y={pos.y}
              width={node.dimensions.width * scale}
              height={node.dimensions.height * scale}
              rx={2}
              fill={node.aiGenerated ? COLORS.aiSuggestion : COLORS.primary}
              fillOpacity={0.6}
            />
          )
        })}

        {/* Viewport indicator */}
        <rect
          x={viewportRect.x}
          y={viewportRect.y}
          width={viewportRect.width}
          height={viewportRect.height}
          fill="transparent"
          stroke="white"
          strokeWidth={1}
          strokeOpacity={0.5}
          rx={2}
        />
      </svg>

      {/* Zoom indicator */}
      <div className="absolute bottom-1 right-1 px-1 py-0.5 bg-neutral-800/80 rounded text-[8px] text-neutral-400 font-mono">
        {Math.round(viewport.zoom * 100)}%
      </div>
    </motion.div>
  )
}
