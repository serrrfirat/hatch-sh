import { motion, AnimatePresence } from 'framer-motion'
import { useState } from 'react'
import type { IdeaConnection, IdeaNode, Position, ConnectionRelationship } from '../../../lib/ideaMaze/types'
import { connectionVariants, COLORS, TRANSITION_FAST, PREMIUM_EASING } from '../../../lib/ideaMaze/animations'
import { useIdeaMazeStore, type ConnectionFilters } from '../../../stores/ideaMazeStore'

interface ConnectionsLayerProps {
  connections: IdeaConnection[]
  nodes: IdeaNode[]
  connectingFrom: string | null
  connectingPosition: Position | null
}

interface ConnectionPoint {
  x: number
  y: number
}

function getConnectionPoints(
  sourceNode: IdeaNode,
  targetNode: IdeaNode
): { source: ConnectionPoint; target: ConnectionPoint } {
  // Calculate center points
  const sourceCenter = {
    x: sourceNode.position.x + sourceNode.dimensions.width / 2,
    y: sourceNode.position.y + sourceNode.dimensions.height / 2,
  }
  const targetCenter = {
    x: targetNode.position.x + targetNode.dimensions.width / 2,
    y: targetNode.position.y + targetNode.dimensions.height / 2,
  }

  // Determine which sides to connect from/to based on relative positions
  const dx = targetCenter.x - sourceCenter.x
  const dy = targetCenter.y - sourceCenter.y

  let source: ConnectionPoint
  let target: ConnectionPoint

  if (Math.abs(dx) > Math.abs(dy)) {
    // Horizontal connection
    if (dx > 0) {
      source = {
        x: sourceNode.position.x + sourceNode.dimensions.width,
        y: sourceCenter.y,
      }
      target = {
        x: targetNode.position.x,
        y: targetCenter.y,
      }
    } else {
      source = {
        x: sourceNode.position.x,
        y: sourceCenter.y,
      }
      target = {
        x: targetNode.position.x + targetNode.dimensions.width,
        y: targetCenter.y,
      }
    }
  } else {
    // Vertical connection
    if (dy > 0) {
      source = {
        x: sourceCenter.x,
        y: sourceNode.position.y + sourceNode.dimensions.height,
      }
      target = {
        x: targetCenter.x,
        y: targetNode.position.y,
      }
    } else {
      source = {
        x: sourceCenter.x,
        y: sourceNode.position.y,
      }
      target = {
        x: targetCenter.x,
        y: targetNode.position.y + targetNode.dimensions.height,
      }
    }
  }

  return { source, target }
}

function generateBezierPath(source: ConnectionPoint, target: ConnectionPoint): string {
  const dx = target.x - source.x
  const dy = target.y - source.y

  // Control point offset based on distance
  const controlOffset = Math.min(Math.abs(dx), Math.abs(dy), 100) * 0.5 + 50

  // Determine control points for smooth curve
  const controlX1 = source.x + (Math.abs(dx) > Math.abs(dy) ? controlOffset * Math.sign(dx) : 0)
  const controlY1 = source.y + (Math.abs(dy) > Math.abs(dx) ? controlOffset * Math.sign(dy) : 0)
  const controlX2 = target.x - (Math.abs(dx) > Math.abs(dy) ? controlOffset * Math.sign(dx) : 0)
  const controlY2 = target.y - (Math.abs(dy) > Math.abs(dx) ? controlOffset * Math.sign(dy) : 0)

  return `M ${source.x} ${source.y} C ${controlX1} ${controlY1}, ${controlX2} ${controlY2}, ${target.x} ${target.y}`
}

// Relationship display names
const RELATIONSHIP_LABELS: Record<ConnectionRelationship, string> = {
  related: 'Related',
  'depends-on': 'Depends on',
  contradicts: 'Contradicts',
  extends: 'Extends',
  alternative: 'Alternative',
}

/**
 * Wrap text into multiple lines for SVG rendering
 */
function wrapText(text: string, maxCharsPerLine: number): string[] {
  const words = text.split(' ')
  const lines: string[] = []
  let currentLine = ''

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word
    if (testLine.length > maxCharsPerLine && currentLine) {
      lines.push(currentLine)
      currentLine = word
    } else {
      currentLine = testLine
    }
  }

  if (currentLine) {
    lines.push(currentLine)
  }

  // Limit to 5 lines max to fit in tooltip
  return lines.slice(0, 5)
}

interface ConnectionProps {
  connection: IdeaConnection
  sourceNode: IdeaNode
  targetNode: IdeaNode
  isSelected: boolean
  isRelevant: boolean  // True if connected to selected/hovered node
  isDimmed: boolean    // True if focus mode is on and not relevant
  onClick: () => void
}

function Connection({
  connection,
  sourceNode,
  targetNode,
  isSelected,
  isRelevant,
  isDimmed,
  onClick
}: ConnectionProps) {
  const [isHovered, setIsHovered] = useState(false)
  const { source, target } = getConnectionPoints(sourceNode, targetNode)
  const path = generateBezierPath(source, target)
  const color = COLORS.connection[connection.relationship] || COLORS.connection.related

  // Calculate midpoint for labels and indicators
  const midX = (source.x + target.x) / 2
  const midY = (source.y + target.y) / 2

  // Determine opacity based on state
  const getOpacity = () => {
    if (isDimmed && !isHovered && !isSelected) return 0.15
    if (isRelevant || isSelected || isHovered) return 1
    return 0.6
  }

  const opacity = getOpacity()

  return (
    <g
      onClick={onClick}
      className="cursor-pointer"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Hit area (invisible, wider for easier clicking) */}
      <path
        d={path}
        fill="none"
        stroke="transparent"
        strokeWidth={20}
        className="pointer-events-auto"
      />

      {/* Glow effect for selected or hovered */}
      <AnimatePresence>
        {(isSelected || (isHovered && !isDimmed)) && (
          <motion.path
            d={path}
            fill="none"
            stroke={color}
            strokeWidth={8}
            strokeOpacity={0.3}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={TRANSITION_FAST}
            style={{ filter: 'blur(6px)' }}
          />
        )}
      </AnimatePresence>

      {/* Main connection line */}
      <motion.path
        d={path}
        fill="none"
        stroke={color}
        strokeWidth={isSelected || isHovered ? 3 : 2}
        strokeDasharray={connection.type === 'dashed' ? '8,4' : undefined}
        strokeLinecap="round"
        variants={connectionVariants}
        initial="initial"
        animate={{
          pathLength: 1,
          opacity,
          strokeWidth: isSelected || isHovered ? 3 : 2,
        }}
        transition={{
          opacity: { duration: 0.3, ease: PREMIUM_EASING },
          strokeWidth: { duration: 0.15 },
        }}
        whileHover="hover"
      />

      {/* AI suggestion indicator - pulsing dot */}
      {connection.aiSuggested && (
        <motion.circle
          cx={midX}
          cy={midY}
          r={6}
          fill={COLORS.aiSuggestion}
          initial={{ opacity: 0, scale: 0 }}
          animate={{
            opacity: isDimmed ? 0.2 : 0.9,
            scale: 1,
          }}
          transition={{ duration: 0.3 }}
        />
      )}

      {/* Hover tooltip with connection details */}
      <AnimatePresence>
        {isHovered && !isDimmed && (
          <motion.g
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 5 }}
            transition={{ duration: 0.15 }}
          >
            {/* Tooltip background */}
            <rect
              x={midX - 150}
              y={midY - 70}
              width={300}
              height={connection.reasoning ? 120 : 50}
              rx={12}
              fill="rgba(17, 17, 17, 0.95)"
              stroke="rgba(255, 255, 255, 0.1)"
              strokeWidth={1}
              style={{ filter: 'drop-shadow(0 8px 32px rgba(0, 0, 0, 0.4))' }}
            />

            {/* Relationship label */}
            <text
              x={midX - 138}
              y={midY - 45}
              fill={color}
              fontSize={12}
              fontWeight={600}
              fontFamily="system-ui, -apple-system, sans-serif"
            >
              {RELATIONSHIP_LABELS[connection.relationship]}
            </text>

            {/* Confidence badge */}
            {connection.confidence && (
              <>
                <rect
                  x={midX + 60}
                  y={midY - 60}
                  width={75}
                  height={20}
                  rx={10}
                  fill={`${color}20`}
                />
                <text
                  x={midX + 97}
                  y={midY - 46}
                  fill={color}
                  fontSize={10}
                  fontFamily="system-ui, -apple-system, sans-serif"
                  textAnchor="middle"
                >
                  {Math.round(connection.confidence * 100)}%
                </text>
              </>
            )}

            {/* Reasoning text - wrapped across multiple lines */}
            {connection.reasoning && (
              <text
                x={midX - 138}
                y={midY - 22}
                fill="rgba(255, 255, 255, 0.7)"
                fontSize={11}
                fontFamily="system-ui, -apple-system, sans-serif"
              >
                {wrapText(connection.reasoning, 50).map((line, i) => (
                  <tspan key={i} x={midX - 138} dy={i === 0 ? 0 : 15}>
                    {line}
                  </tspan>
                ))}
              </text>
            )}
          </motion.g>
        )}
      </AnimatePresence>
    </g>
  )
}

/**
 * Check if a connection passes the current filters
 */
function passesFilters(
  connection: IdeaConnection,
  filters: ConnectionFilters
): boolean {
  // Check relationship type filter
  if (!filters[connection.relationship]) {
    return false
  }

  // Check AI suggested filter
  if (connection.aiSuggested && !filters.showAISuggested) {
    return false
  }

  return true
}

/**
 * Check if a connection is relevant to the current selection/hover
 */
function isConnectionRelevant(
  connection: IdeaConnection,
  selectedNodeIds: string[],
  hoveredNodeId: string | null
): boolean {
  const relevantNodeIds = new Set([
    ...selectedNodeIds,
    ...(hoveredNodeId ? [hoveredNodeId] : []),
  ])

  if (relevantNodeIds.size === 0) return true

  return relevantNodeIds.has(connection.sourceId) || relevantNodeIds.has(connection.targetId)
}

export function ConnectionsLayer({
  connections,
  nodes,
  connectingFrom,
  connectingPosition,
}: ConnectionsLayerProps) {
  const {
    selection,
    selectConnection,
    connectionFilters,
    focusMode,
    hoveredNodeId
  } = useIdeaMazeStore()

  // Find connecting source node
  const connectingSourceNode = connectingFrom
    ? nodes.find((n) => n.id === connectingFrom)
    : null

  // Calculate canvas bounds from nodes to size the SVG appropriately
  const canvasSize = 10000 // Large enough to cover most use cases
  const canvasOffset = -canvasSize / 2

  // Filter and categorize connections
  const filteredConnections = connections.filter(c => passesFilters(c, connectionFilters))

  // Determine if we should show focus mode dimming
  const hasFocusTarget = focusMode && (selection.nodeIds.length > 0 || hoveredNodeId !== null)

  return (
    <svg
      className="pointer-events-none overflow-visible"
      style={{
        position: 'absolute',
        left: canvasOffset,
        top: canvasOffset,
        width: canvasSize,
        height: canvasSize,
      }}
      viewBox={`${canvasOffset} ${canvasOffset} ${canvasSize} ${canvasSize}`}
    >
      <defs>
        {/* Arrow marker */}
        <marker
          id="arrowhead"
          markerWidth="10"
          markerHeight="7"
          refX="9"
          refY="3.5"
          orient="auto"
        >
          <polygon
            points="0 0, 10 3.5, 0 7"
            fill={COLORS.primary}
          />
        </marker>

        {/* Gradient for AI suggestions */}
        <linearGradient id="aiGradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor={COLORS.aiSuggestion} stopOpacity={0.2} />
          <stop offset="50%" stopColor={COLORS.aiSuggestion} stopOpacity={0.8} />
          <stop offset="100%" stopColor={COLORS.aiSuggestion} stopOpacity={0.2} />
        </linearGradient>

        {/* Blur filter for glow effects */}
        <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="4" result="coloredBlur"/>
          <feMerge>
            <feMergeNode in="coloredBlur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
      </defs>

      {/* Existing connections - render dimmed ones first, then relevant ones on top */}
      <AnimatePresence>
        {filteredConnections.map((connection) => {
          const sourceNode = nodes.find((n) => n.id === connection.sourceId)
          const targetNode = nodes.find((n) => n.id === connection.targetId)

          if (!sourceNode || !targetNode) return null

          const isRelevant = isConnectionRelevant(
            connection,
            selection.nodeIds,
            hoveredNodeId
          )
          const isDimmed = hasFocusTarget && !isRelevant

          return (
            <Connection
              key={connection.id}
              connection={connection}
              sourceNode={sourceNode}
              targetNode={targetNode}
              isSelected={selection.connectionIds.includes(connection.id)}
              isRelevant={isRelevant}
              isDimmed={isDimmed}
              onClick={() => selectConnection(connection.id)}
            />
          )
        })}
      </AnimatePresence>

      {/* Temporary connection while drawing */}
      {connectingSourceNode && connectingPosition && (
        <motion.path
          d={generateBezierPath(
            {
              x: connectingSourceNode.position.x + connectingSourceNode.dimensions.width / 2,
              y: connectingSourceNode.position.y + connectingSourceNode.dimensions.height / 2,
            },
            connectingPosition
          )}
          fill="none"
          stroke={COLORS.primary}
          strokeWidth={2}
          strokeDasharray="8,4"
          strokeLinecap="round"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        />
      )}
    </svg>
  )
}
