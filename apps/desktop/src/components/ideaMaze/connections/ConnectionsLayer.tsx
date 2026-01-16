import { motion, AnimatePresence } from 'framer-motion'
import { useState } from 'react'
import type { IdeaConnection, IdeaNode, Position, ConnectionRelationship } from '../../../lib/ideaMaze/types'
import { connectionVariants, COLORS } from '../../../lib/ideaMaze/animations'
import { useIdeaMazeStore } from '../../../stores/ideaMazeStore'

// Relationship descriptions for tooltip
const RELATIONSHIP_INFO: Record<ConnectionRelationship, { label: string; description: string }> = {
  related: {
    label: 'Related',
    description: 'Semantically connected concepts',
  },
  'depends-on': {
    label: 'Depends On',
    description: 'Causal or prerequisite relationship',
  },
  contradicts: {
    label: 'Contradicts',
    description: 'Opposing or conflicting ideas',
  },
  extends: {
    label: 'Extends',
    description: 'Builds upon or elaborates',
  },
  alternative: {
    label: 'Alternative',
    description: 'Different approach to same goal',
  },
}

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
  const [isHovered, setIsHovered] = useState(false)
  const { source, target } = getConnectionPoints(sourceNode, targetNode)
  const path = generateBezierPath(source, target)
  const color = COLORS.connection[connection.relationship] || COLORS.connection.related
  const relationshipInfo = RELATIONSHIP_INFO[connection.relationship]

  // Calculate midpoint for tooltip positioning
  const midX = (source.x + target.x) / 2
  const midY = (source.y + target.y) / 2

  return (
    <g
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="cursor-pointer"
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
      {(isSelected || isHovered) && (
        <motion.path
          d={path}
          fill="none"
          stroke={color}
          strokeWidth={6}
          strokeOpacity={isSelected ? 0.3 : 0.2}
          filter="blur(4px)"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        />
      )}

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
        animate="animate"
        whileHover="hover"
      />

      {/* AI suggestion indicator */}
      {connection.aiSuggested && (
        <circle
          cx={midX}
          cy={midY}
          r={8}
          fill={COLORS.aiSuggestion}
          opacity={0.8}
        />
      )}

      {/* Relationship tooltip on hover */}
      <AnimatePresence>
        {isHovered && (
          <motion.g
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 5 }}
            transition={{ duration: 0.15 }}
          >
            {/* Tooltip background */}
            <rect
              x={midX - 70}
              y={midY - 42}
              width={140}
              height={36}
              rx={6}
              fill="rgba(17, 17, 17, 0.95)"
              stroke={color}
              strokeWidth={1}
              strokeOpacity={0.5}
            />
            {/* Color indicator dot */}
            <circle
              cx={midX - 54}
              cy={midY - 24}
              r={4}
              fill={color}
            />
            {/* Relationship label */}
            <text
              x={midX - 44}
              y={midY - 20}
              className="text-[11px] font-medium fill-white pointer-events-none"
            >
              {relationshipInfo.label}
            </text>
            {/* Description */}
            <text
              x={midX}
              y={midY - 8}
              textAnchor="middle"
              className="text-[9px] fill-neutral-400 pointer-events-none"
            >
              {relationshipInfo.description}
            </text>
          </motion.g>
        )}
      </AnimatePresence>

      {/* Manual label if set */}
      {connection.label && !isHovered && (
        <text
          x={midX}
          y={midY - 10}
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
  const { selection, selectConnection, connectionFilters, focusMode } = useIdeaMazeStore()

  // Filter connections based on connection filters
  const filteredConnections = connections.filter((connection) => {
    // Filter by relationship type
    if (!connectionFilters[connection.relationship]) {
      return false
    }

    // Filter by AI suggested
    if (connection.aiSuggested && !connectionFilters.showAISuggested) {
      return false
    }

    // Focus mode: only show connections to/from selected nodes
    if (focusMode && selection.nodeIds.length > 0) {
      const isConnectedToSelection =
        selection.nodeIds.includes(connection.sourceId) ||
        selection.nodeIds.includes(connection.targetId)
      if (!isConnectedToSelection) {
        return false
      }
    }

    return true
  })

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

      {/* Existing connections (filtered) */}
      {filteredConnections.map((connection) => {
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
