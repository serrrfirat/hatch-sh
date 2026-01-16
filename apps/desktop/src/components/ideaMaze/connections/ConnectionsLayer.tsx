import { motion } from 'framer-motion'
import type { IdeaConnection, IdeaNode, Position } from '../../../lib/ideaMaze/types'
import { connectionVariants, COLORS } from '../../../lib/ideaMaze/animations'
import { useIdeaMazeStore } from '../../../stores/ideaMazeStore'

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

interface ConnectionProps {
  connection: IdeaConnection
  sourceNode: IdeaNode
  targetNode: IdeaNode
  isSelected: boolean
  onClick: () => void
}

function Connection({ connection, sourceNode, targetNode, isSelected, onClick }: ConnectionProps) {
  const { source, target } = getConnectionPoints(sourceNode, targetNode)
  const path = generateBezierPath(source, target)
  const color = COLORS.connection[connection.relationship] || COLORS.connection.related

  return (
    <g onClick={onClick} className="cursor-pointer">
      {/* Hit area (invisible, wider for easier clicking) */}
      <path
        d={path}
        fill="none"
        stroke="transparent"
        strokeWidth={20}
        className="pointer-events-auto"
      />

      {/* Glow effect for selected */}
      {isSelected && (
        <motion.path
          d={path}
          fill="none"
          stroke={color}
          strokeWidth={6}
          strokeOpacity={0.3}
          filter="blur(4px)"
        />
      )}

      {/* Main connection line */}
      <motion.path
        d={path}
        fill="none"
        stroke={color}
        strokeWidth={isSelected ? 3 : 2}
        strokeDasharray={connection.type === 'dashed' ? '8,4' : undefined}
        strokeLinecap="round"
        variants={connectionVariants}
        initial="initial"
        animate="animate"
        whileHover="hover"
      />

      {/* AI suggestion indicator */}
      {connection.aiSuggested && (
        <circle
          cx={(source.x + target.x) / 2}
          cy={(source.y + target.y) / 2}
          r={8}
          fill={COLORS.aiSuggestion}
          opacity={0.8}
        />
      )}

      {/* Relationship label */}
      {connection.label && (
        <text
          x={(source.x + target.x) / 2}
          y={(source.y + target.y) / 2 - 10}
          textAnchor="middle"
          className="text-[10px] fill-neutral-400 pointer-events-none"
        >
          {connection.label}
        </text>
      )}
    </g>
  )
}

export function ConnectionsLayer({
  connections,
  nodes,
  connectingFrom,
  connectingPosition,
}: ConnectionsLayerProps) {
  const { selection, selectConnection } = useIdeaMazeStore()

  // Find connecting source node
  const connectingSourceNode = connectingFrom
    ? nodes.find((n) => n.id === connectingFrom)
    : null

  // Calculate canvas bounds from nodes to size the SVG appropriately
  const canvasSize = 10000 // Large enough to cover most use cases
  const canvasOffset = -canvasSize / 2

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
      </defs>

      {/* Existing connections */}
      {connections.map((connection) => {
        const sourceNode = nodes.find((n) => n.id === connection.sourceId)
        const targetNode = nodes.find((n) => n.id === connection.targetId)

        if (!sourceNode || !targetNode) return null

        return (
          <Connection
            key={connection.id}
            connection={connection}
            sourceNode={sourceNode}
            targetNode={targetNode}
            isSelected={selection.connectionIds.includes(connection.id)}
            onClick={() => selectConnection(connection.id)}
          />
        )
      })}

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
