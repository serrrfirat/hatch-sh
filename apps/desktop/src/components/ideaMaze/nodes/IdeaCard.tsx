import { useState, useRef, useCallback, useEffect } from 'react'
import { motion } from 'framer-motion'
import { GripVertical, Sparkles, Type, Image, Link } from 'lucide-react'
import type { IdeaNode, Position, NodeContent } from '../../../lib/ideaMaze/types'
import { CritiqueIndicator } from './CritiqueIndicator'
import {
  MIN_NODE_WIDTH,
  MAX_NODE_WIDTH,
  MIN_NODE_HEIGHT,
  MAX_NODE_HEIGHT,
} from '../../../lib/ideaMaze/types'
import {
  cardVariants,
  GLASS_STYLE,
  GLASS_HOVER_STYLE,
  PARALLAX_INTENSITY,
  COLORS,
} from '../../../lib/ideaMaze/animations'
import { useIdeaMazeStore } from '../../../stores/ideaMazeStore'

interface IdeaCardProps {
  node: IdeaNode
  isSelected: boolean
  onSelect: (nodeId: string, addToSelection: boolean) => void
  onDrag: (nodeId: string, position: Position) => void
  onConnectionStart: (nodeId: string, position: Position) => void
  onConnectionEnd: (nodeId: string) => void
  isConnectMode: boolean
  isConnecting: boolean
}

export function IdeaCard({
  node,
  isSelected,
  onSelect,
  onDrag,
  onConnectionStart,
  onConnectionEnd,
  isConnectMode,
  isConnecting,
}: IdeaCardProps) {
  const cardRef = useRef<HTMLDivElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [dragOffset, setDragOffset] = useState<Position>({ x: 0, y: 0 })
  const [isHovered, setIsHovered] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [parallax, setParallax] = useState({ x: 0, y: 0 })
  const [isResizing, setIsResizing] = useState(false)
  const [resizeDirection, setResizeDirection] = useState<string | null>(null)
  const [resizeStart, setResizeStart] = useState<{ x: number; y: number; width: number; height: number; nodeX: number; nodeY: number } | null>(null)

  const { updateNode, addContentToNode, resizeNode, moveNode: moveNodeStore, setHoveredNode, focusMode } = useIdeaMazeStore()

  // Handle mouse move for parallax effect
  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!cardRef.current || isDragging) return

      const rect = cardRef.current.getBoundingClientRect()
      const centerX = rect.left + rect.width / 2
      const centerY = rect.top + rect.height / 2

      const rotateX = ((e.clientY - centerY) / rect.height) * PARALLAX_INTENSITY.rotation
      const rotateY = ((e.clientX - centerX) / rect.width) * -PARALLAX_INTENSITY.rotation

      setParallax({ x: rotateX, y: rotateY })
    },
    [isDragging]
  )

  const handleMouseEnter = () => {
    setIsHovered(true)
    // Only update hovered node in focus mode to avoid unnecessary re-renders
    if (focusMode) {
      setHoveredNode(node.id)
    }
  }

  const handleMouseLeave = () => {
    setParallax({ x: 0, y: 0 })
    setIsHovered(false)
    if (focusMode) {
      setHoveredNode(null)
    }
  }

  // Handle drag start
  const handleDragStart = useCallback(
    (e: React.MouseEvent) => {
      if (isEditing) return
      e.stopPropagation()

      const rect = cardRef.current?.getBoundingClientRect()
      if (!rect) return

      setIsDragging(true)
      setDragOffset({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      })

      onSelect(node.id, e.shiftKey)
    },
    [node.id, onSelect, isEditing]
  )

  // Handle drag move (global event for reliable tracking)
  const handleDragMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging) return

      const parent = cardRef.current?.parentElement
      if (!parent) return

      const parentRect = parent.getBoundingClientRect()
      const scale = parent.style.transform?.match(/scale\(([^)]+)\)/)?.[1] || '1'
      const zoom = parseFloat(scale)

      const newX = (e.clientX - parentRect.left) / zoom - dragOffset.x
      const newY = (e.clientY - parentRect.top) / zoom - dragOffset.y

      onDrag(node.id, { x: newX, y: newY })
    },
    [isDragging, dragOffset, node.id, onDrag]
  )

  // Handle drag end (global event)
  const handleDragEndGlobal = useCallback(() => {
    setIsDragging(false)
  }, [])

  // Handle drag end on card (for connection completion)
  const handleDragEnd = useCallback(
    (e: React.MouseEvent) => {
      setIsDragging(false)

      // If we're in connecting mode and this is a potential target, complete the connection
      if (isConnecting) {
        e.stopPropagation() // Prevent canvas from clearing connection state
        onConnectionEnd(node.id)
      }
    },
    [isConnecting, onConnectionEnd, node.id]
  )

  // Set up global event listeners for drag
  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleDragMove)
      window.addEventListener('mouseup', handleDragEndGlobal)
      return () => {
        window.removeEventListener('mousemove', handleDragMove)
        window.removeEventListener('mouseup', handleDragEndGlobal)
      }
    }
  }, [isDragging, handleDragMove, handleDragEndGlobal])

  // Handle click for selection or connection
  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()

      if (isConnecting) {
        onConnectionEnd(node.id)
      } else if (!isDragging) {
        onSelect(node.id, e.shiftKey)
      }
    },
    [node.id, onSelect, isDragging, isConnecting, onConnectionEnd]
  )

  // Handle title change
  const handleTitleChange = useCallback(
    (title: string) => {
      updateNode(node.id, { title })
    },
    [node.id, updateNode]
  )

  // Add text content
  const addTextContent = useCallback(() => {
    const content: NodeContent = {
      type: 'text',
      id: crypto.randomUUID(),
      text: '',
    }
    addContentToNode(node.id, content)
  }, [node.id, addContentToNode])

  // Connection handles
  const handleConnectionHandleMouseDown = useCallback(
    (e: React.MouseEvent, side: 'top' | 'right' | 'bottom' | 'left') => {
      e.stopPropagation()

      const rect = cardRef.current?.getBoundingClientRect()
      if (!rect) return

      let position: Position
      switch (side) {
        case 'top':
          position = { x: node.position.x + node.dimensions.width / 2, y: node.position.y }
          break
        case 'right':
          position = { x: node.position.x + node.dimensions.width, y: node.position.y + node.dimensions.height / 2 }
          break
        case 'bottom':
          position = { x: node.position.x + node.dimensions.width / 2, y: node.position.y + node.dimensions.height }
          break
        case 'left':
          position = { x: node.position.x, y: node.position.y + node.dimensions.height / 2 }
          break
      }

      onConnectionStart(node.id, position)
    },
    [node, onConnectionStart]
  )

  // Handle resize start
  const handleResizeStart = useCallback(
    (e: React.MouseEvent, direction: string) => {
      e.stopPropagation()
      e.preventDefault()
      setIsResizing(true)
      setResizeDirection(direction)
      setResizeStart({
        x: e.clientX,
        y: e.clientY,
        width: node.dimensions.width,
        height: node.dimensions.height,
        nodeX: node.position.x,
        nodeY: node.position.y,
      })
    },
    [node.dimensions.width, node.dimensions.height, node.position.x, node.position.y]
  )

  // Handle resize move (called from parent canvas via global mouse events)
  const handleResizeMove = useCallback(
    (e: MouseEvent) => {
      if (!isResizing || !resizeStart || !resizeDirection) return

      const parent = cardRef.current?.parentElement
      if (!parent) return

      const scale = parent.style.transform?.match(/scale\(([^)]+)\)/)?.[1] || '1'
      const zoom = parseFloat(scale)

      const deltaX = (e.clientX - resizeStart.x) / zoom
      const deltaY = (e.clientY - resizeStart.y) / zoom

      let newWidth = resizeStart.width
      let newHeight = resizeStart.height
      let newX = resizeStart.nodeX
      let newY = resizeStart.nodeY

      // Calculate new dimensions based on resize direction
      if (resizeDirection.includes('e')) {
        newWidth = Math.min(MAX_NODE_WIDTH, Math.max(MIN_NODE_WIDTH, resizeStart.width + deltaX))
      }
      if (resizeDirection.includes('w')) {
        // Moving left (negative deltaX) increases width
        const potentialWidth = resizeStart.width - deltaX
        newWidth = Math.min(MAX_NODE_WIDTH, Math.max(MIN_NODE_WIDTH, potentialWidth))
        // Calculate actual width change after clamping, then adjust position
        const actualWidthChange = newWidth - resizeStart.width
        newX = resizeStart.nodeX - actualWidthChange
      }
      if (resizeDirection.includes('s')) {
        newHeight = Math.min(MAX_NODE_HEIGHT, Math.max(MIN_NODE_HEIGHT, resizeStart.height + deltaY))
      }
      if (resizeDirection.includes('n')) {
        // Moving up (negative deltaY) increases height
        const potentialHeight = resizeStart.height - deltaY
        newHeight = Math.min(MAX_NODE_HEIGHT, Math.max(MIN_NODE_HEIGHT, potentialHeight))
        // Calculate actual height change after clamping, then adjust position
        const actualHeightChange = newHeight - resizeStart.height
        newY = resizeStart.nodeY - actualHeightChange
      }

      // Update node dimensions and position
      resizeNode(node.id, newWidth, newHeight)
      if (newX !== resizeStart.nodeX || newY !== resizeStart.nodeY) {
        moveNodeStore(node.id, { x: newX, y: newY })
      }
    },
    [isResizing, resizeStart, resizeDirection, node.id, resizeNode, moveNodeStore]
  )

  // Handle resize end
  const handleResizeEnd = useCallback(() => {
    setIsResizing(false)
    setResizeDirection(null)
    setResizeStart(null)
  }, [])

  // Add global mouse event listeners for resize
  const handleGlobalMouseMove = useCallback(
    (e: MouseEvent) => {
      if (isResizing) {
        handleResizeMove(e)
      }
    },
    [isResizing, handleResizeMove]
  )

  const handleGlobalMouseUp = useCallback(() => {
    if (isResizing) {
      handleResizeEnd()
    }
  }, [isResizing, handleResizeEnd])

  // Set up global event listeners for resize
  useEffect(() => {
    if (isResizing) {
      window.addEventListener('mousemove', handleGlobalMouseMove)
      window.addEventListener('mouseup', handleGlobalMouseUp)
      return () => {
        window.removeEventListener('mousemove', handleGlobalMouseMove)
        window.removeEventListener('mouseup', handleGlobalMouseUp)
      }
    }
  }, [isResizing, handleGlobalMouseMove, handleGlobalMouseUp])

  const showHandles = (isHovered || isSelected || isConnectMode) && !isDragging && !isResizing
  const showResizeHandles = (isHovered || isSelected) && !isDragging && !isConnecting

  return (
    <motion.div
      ref={cardRef}
      variants={cardVariants}
      initial="initial"
      animate="animate"
      className="absolute select-none"
      style={{
        left: node.position.x,
        top: node.position.y,
        width: node.dimensions.width,
        minHeight: node.dimensions.height,
        zIndex: node.zIndex,
      }}
      draggable={false}
      onDragStart={(e) => e.preventDefault()}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onMouseUp={handleDragEnd}
    >
      {/* Card container with glassmorphism */}
      <motion.div
        className={`
          relative rounded-2xl p-4 cursor-pointer
          ${isDragging ? 'cursor-grabbing' : ''}
        `}
        style={{
          ...GLASS_STYLE,
          ...(isHovered && !isDragging ? GLASS_HOVER_STYLE : {}),
          ...(isSelected ? { boxShadow: `0 0 0 2px ${COLORS.primary}80` } : {}),
          ...(isConnecting ? { boxShadow: `0 0 0 2px ${COLORS.aiSuggestion}80` } : {}),
          transform: `
            perspective(1000px)
            rotateX(${parallax.x}deg)
            rotateY(${parallax.y}deg)
            translateY(${isHovered && !isDragging ? -PARALLAX_INTENSITY.elevation : 0}px)
          `,
          transition: isDragging ? 'none' : 'transform 0.2s ease-out, box-shadow 0.2s ease-out',
        }}
        onClick={handleClick}
        onMouseDown={handleDragStart}
        draggable={false}
        onDragStart={(e) => e.preventDefault()}
      >
        {/* AI indicator */}
        {node.aiGenerated && (
          <div
            className="absolute -top-2 -right-2 w-6 h-6 rounded-full flex items-center justify-center"
            style={{
              backgroundColor: COLORS.aiSuggestionGlow,
              border: `1px solid ${COLORS.aiSuggestion}50`,
            }}
          >
            <Sparkles size={12} style={{ color: COLORS.aiSuggestion }} />
          </div>
        )}

        {/* Critique indicator */}
        {node.critiques && node.critiques.length > 0 && (
          <CritiqueIndicator nodeId={node.id} critiques={node.critiques} nodeTitle={node.title} />
        )}

        {/* Header */}
        <div className="flex items-start gap-2 mb-3">
          <div className="flex-shrink-0 p-1 text-neutral-500 cursor-grab active:cursor-grabbing">
            <GripVertical size={14} />
          </div>
          <input
            type="text"
            value={node.title || ''}
            onChange={(e) => handleTitleChange(e.target.value)}
            placeholder="Untitled idea..."
            onClick={(e) => e.stopPropagation()}
            onFocus={() => setIsEditing(true)}
            onBlur={() => setIsEditing(false)}
            className="flex-1 bg-transparent text-white text-sm font-medium placeholder-neutral-500 focus:outline-none"
          />
        </div>

        {/* Content */}
        <div className="space-y-2 min-h-[60px]">
          {node.content.length === 0 ? (
            <div className="text-neutral-500 text-xs italic">
              Click to add content...
            </div>
          ) : (
            node.content.map((content) => (
              <div key={content.id} className="text-sm text-neutral-300">
                {content.type === 'text' && (
                  <textarea
                    value={content.text}
                    onChange={(e) => {
                      // Auto-resize textarea
                      e.target.style.height = 'auto'
                      e.target.style.height = `${e.target.scrollHeight}px`
                      updateNode(node.id, {
                        content: node.content.map((c) =>
                          c.id === content.id ? { ...c, text: e.target.value } : c
                        ),
                      })
                    }}
                    onClick={(e) => e.stopPropagation()}
                    onFocus={() => setIsEditing(true)}
                    onBlur={() => setIsEditing(false)}
                    placeholder="Type something..."
                    className="w-full bg-transparent resize-none focus:outline-none placeholder-neutral-600 overflow-hidden"
                    style={{ minHeight: '24px' }}
                    ref={(el) => {
                      // Auto-resize on mount/update
                      if (el) {
                        el.style.height = 'auto'
                        el.style.height = `${el.scrollHeight}px`
                      }
                    }}
                  />
                )}
                {content.type === 'image' && (
                  <img
                    src={content.url}
                    alt={content.alt || ''}
                    className="rounded-lg max-w-full pointer-events-none"
                    draggable={false}
                    onDragStart={(e) => e.preventDefault()}
                  />
                )}
                {content.type === 'url' && (
                  <a
                    href={content.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="flex items-center gap-2 p-2 bg-neutral-800/50 rounded-lg hover:bg-neutral-800 transition-colors"
                  >
                    {content.favicon && (
                      <img src={content.favicon} alt="" className="w-4 h-4" />
                    )}
                    <span className="text-xs text-blue-400 truncate">
                      {content.title || content.url}
                    </span>
                  </a>
                )}
              </div>
            ))
          )}
        </div>

        {/* Add content buttons */}
        {(isHovered || isSelected) && (
          <div className="flex items-center gap-1 mt-3 pt-3 border-t border-white/5">
            <button
              onClick={(e) => {
                e.stopPropagation()
                addTextContent()
              }}
              className="p-1.5 rounded bg-neutral-800/50 hover:bg-neutral-800 text-neutral-400 hover:text-white transition-colors"
              title="Add text"
            >
              <Type size={12} />
            </button>
            {/* TODO: Add Image button - Implementation needed
             * Expected behavior:
             * 1. Open a file picker dialog for image selection (accept: image/*)
             * 2. Read the selected file and convert to data URL
             * 3. Create an ImageContent object with the data URL and dimensions
             * 4. Call addContentToNode(node.id, imageContent) to add to the node
             * 5. Optionally resize the node to fit the image
             *
             * Considerations:
             * - Add file size validation (recommend max 5MB)
             * - Support drag-and-drop onto the button
             * - Show loading indicator during file processing
             * - Handle errors gracefully (invalid file type, too large, etc.)
             */}
            <button
              onClick={(e) => e.stopPropagation()}
              className="p-1.5 rounded bg-neutral-800/50 hover:bg-neutral-800 text-neutral-400 hover:text-white transition-colors opacity-50 cursor-not-allowed"
              title="Add image (coming soon)"
              disabled
            >
              <Image size={12} />
            </button>
            {/* TODO: Add URL button - Implementation needed
             * Expected behavior:
             * 1. Show a popover/modal with a URL input field
             * 2. Validate the entered URL format
             * 3. Optionally fetch URL metadata (title, description, favicon) using a service
             * 4. Create a UrlContent object with the URL and metadata
             * 5. Call addContentToNode(node.id, urlContent) to add to the node
             *
             * Considerations:
             * - Use URL validation regex or URL constructor for validation
             * - Consider using a metadata fetching service (e.g., Open Graph scraper)
             * - Handle CORS issues when fetching metadata (may need backend proxy)
             * - Show preview of the URL card before adding
             * - Support pasting URLs directly
             */}
            <button
              onClick={(e) => e.stopPropagation()}
              className="p-1.5 rounded bg-neutral-800/50 hover:bg-neutral-800 text-neutral-400 hover:text-white transition-colors opacity-50 cursor-not-allowed"
              title="Add URL (coming soon)"
              disabled
            >
              <Link size={12} />
            </button>
          </div>
        )}

        {/* Tags */}
        {node.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-3 pt-3" style={{ borderTop: `1px solid ${COLORS.border}30` }}>
            {node.tags.map((tag) => (
              <span
                key={tag}
                className="px-2 py-0.5 text-[10px] rounded"
                style={{
                  backgroundColor: COLORS.primaryGlow,
                  color: COLORS.primary,
                }}
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </motion.div>

      {/* Connection handles */}
      {showHandles && (
        <>
          {(['top', 'right', 'bottom', 'left'] as const).map((side) => {
            const positions = {
              top: { left: '50%', top: -6, transform: 'translateX(-50%)' },
              right: { right: -6, top: '50%', transform: 'translateY(-50%)' },
              bottom: { left: '50%', bottom: -6, transform: 'translateX(-50%)' },
              left: { left: -6, top: '50%', transform: 'translateY(-50%)' },
            }

            return (
              <motion.div
                key={side}
                className="absolute w-3 h-3 rounded-full cursor-crosshair hover:scale-125 transition-transform"
                style={{
                  ...positions[side] as React.CSSProperties,
                  backgroundColor: COLORS.primary,
                  border: `2px solid ${COLORS.backgroundAlt}`,
                }}
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.5 }}
                onMouseDown={(e) => handleConnectionHandleMouseDown(e, side)}
              />
            )
          })}
        </>
      )}

      {/* Resize handles */}
      {showResizeHandles && (
        <>
          {/* Corner handles */}
          {(['nw', 'ne', 'sw', 'se'] as const).map((corner) => {
            const positions: Record<string, React.CSSProperties> = {
              nw: { left: -4, top: -4, cursor: 'nwse-resize' },
              ne: { right: -4, top: -4, cursor: 'nesw-resize' },
              sw: { left: -4, bottom: -4, cursor: 'nesw-resize' },
              se: { right: -4, bottom: -4, cursor: 'nwse-resize' },
            }

            return (
              <motion.div
                key={corner}
                className="absolute w-2.5 h-2.5 rounded-sm hover:scale-125 transition-transform"
                style={{
                  ...positions[corner],
                  backgroundColor: COLORS.primary,
                  border: `1px solid ${COLORS.backgroundAlt}`,
                }}
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.5 }}
                onMouseDown={(e) => handleResizeStart(e, corner)}
              />
            )
          })}

          {/* Edge handles */}
          {(['n', 'e', 's', 'w'] as const).map((edge) => {
            const positions: Record<string, React.CSSProperties> = {
              n: { left: '50%', top: -4, transform: 'translateX(-50%)', cursor: 'ns-resize', width: 24, height: 8 },
              e: { right: -4, top: '50%', transform: 'translateY(-50%)', cursor: 'ew-resize', width: 8, height: 24 },
              s: { left: '50%', bottom: -4, transform: 'translateX(-50%)', cursor: 'ns-resize', width: 24, height: 8 },
              w: { left: -4, top: '50%', transform: 'translateY(-50%)', cursor: 'ew-resize', width: 8, height: 24 },
            }

            return (
              <motion.div
                key={edge}
                className="absolute rounded-sm opacity-0 hover:opacity-100 transition-opacity"
                style={{
                  ...positions[edge],
                  backgroundColor: `${COLORS.primary}60`,
                }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 0 }}
                whileHover={{ opacity: 1 }}
                onMouseDown={(e) => handleResizeStart(e, edge)}
              />
            )
          })}
        </>
      )}
    </motion.div>
  )
}
