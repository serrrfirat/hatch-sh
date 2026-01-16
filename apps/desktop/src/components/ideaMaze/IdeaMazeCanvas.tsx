import { useRef, useCallback, useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useIdeaMazeStore } from '../../stores/ideaMazeStore'
import { IdeaCard } from './nodes/IdeaCard'
import { ConnectionsLayer } from './connections/ConnectionsLayer'
import { ConnectionLegend } from './connections/ConnectionLegend'
import { IdeaMazeMinimap } from './IdeaMazeMinimap'
import type { Position, ImageContent } from '../../lib/ideaMaze/types'

export function IdeaMazeCanvas() {
  const canvasRef = useRef<HTMLDivElement>(null)
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 })
  const [isPanning, setIsPanning] = useState(false)
  const [panStart, setPanStart] = useState<Position | null>(null)
  const [isConnecting, setIsConnecting] = useState(false)
  const [connectingFrom, setConnectingFrom] = useState<string | null>(null)
  const [connectingPosition, setConnectingPosition] = useState<Position | null>(null)

  const {
    currentMoodboard,
    viewport,
    toolMode,
    selection,
    isMinimapVisible,
    setViewport,
    pan,
    zoom,
    addNode,
    moveNode,
    resizeNode,
    selectNode,
    clearSelection,
    addConnection,
    bringNodeToFront,
  } = useIdeaMazeStore()

  // Track canvas size
  useEffect(() => {
    const updateSize = () => {
      if (canvasRef.current) {
        setCanvasSize({
          width: canvasRef.current.clientWidth,
          height: canvasRef.current.clientHeight,
        })
      }
    }

    updateSize()
    window.addEventListener('resize', updateSize)
    return () => window.removeEventListener('resize', updateSize)
  }, [])

  // Handle paste events for images
  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
      // Only handle paste when canvas or its children are focused
      const target = e.target as HTMLElement
      const isInputElement = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA'
      if (isInputElement) return // Don't intercept paste in input fields

      const items = e.clipboardData?.items
      if (!items) return

      for (const item of items) {
        if (item.type.startsWith('image/')) {
          e.preventDefault()
          const blob = item.getAsFile()
          if (!blob) continue

          // Convert blob to data URL
          const reader = new FileReader()
          reader.onload = (event) => {
            const dataUrl = event.target?.result as string
            if (!dataUrl) return

            // Get image dimensions
            const img = new Image()
            img.onload = () => {
              // Calculate position at center of current viewport
              const rect = canvasRef.current?.getBoundingClientRect()
              const centerX = rect ? (rect.width / 2 - viewport.x) / viewport.zoom : 400
              const centerY = rect ? (rect.height / 2 - viewport.y) / viewport.zoom : 300

              // Scale image to reasonable size (max 400px width)
              const maxWidth = 400
              const scale = img.width > maxWidth ? maxWidth / img.width : 1
              const width = img.width * scale
              const height = img.height * scale

              // Create image content
              const imageContent: ImageContent = {
                type: 'image',
                id: crypto.randomUUID(),
                url: dataUrl,
                width,
                height,
              }

              // Create node with image at center of viewport
              const node = addNode(
                { x: centerX - width / 2, y: centerY - height / 2 },
                [imageContent],
                'Pasted Image'
              )

              // Resize node to fit image (add padding for card chrome)
              const cardPadding = 48 // Account for card padding and header
              resizeNode(node.id, Math.max(width + 32, 280), height + cardPadding)
            }
            img.src = dataUrl
          }
          reader.readAsDataURL(blob)
          break // Only handle the first image
        }
      }
    }

    document.addEventListener('paste', handlePaste)
    return () => document.removeEventListener('paste', handlePaste)
  }, [viewport, addNode, resizeNode])

  // Convert screen position to canvas position
  const screenToCanvas = useCallback(
    (screenX: number, screenY: number): Position => {
      const rect = canvasRef.current?.getBoundingClientRect()
      if (!rect) return { x: 0, y: 0 }

      return {
        x: (screenX - rect.left - viewport.x) / viewport.zoom,
        y: (screenY - rect.top - viewport.y) / viewport.zoom,
      }
    },
    [viewport]
  )

  // Handle wheel zoom
  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault()

      if (e.ctrlKey || e.metaKey) {
        // Pinch zoom
        const delta = -e.deltaY * 0.01
        const center = screenToCanvas(e.clientX, e.clientY)
        zoom(delta, center)
      } else {
        // Pan
        pan(-e.deltaX, -e.deltaY)
      }
    },
    [pan, zoom, screenToCanvas]
  )

  // Handle mouse down
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 0) return // Only left click

      const isOnCanvas = e.target === canvasRef.current

      if (toolMode === 'pan' || (toolMode === 'select' && e.shiftKey)) {
        // Start panning
        setIsPanning(true)
        setPanStart({ x: e.clientX, y: e.clientY })
      } else if (toolMode === 'select' && isOnCanvas) {
        // Click on empty canvas - clear selection
        clearSelection()
      }
    },
    [toolMode, clearSelection]
  )

  // Handle mouse move
  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (isPanning && panStart) {
        const deltaX = e.clientX - panStart.x
        const deltaY = e.clientY - panStart.y
        setPanStart({ x: e.clientX, y: e.clientY })
        pan(deltaX, deltaY)
      }

      if (isConnecting) {
        setConnectingPosition(screenToCanvas(e.clientX, e.clientY))
      }
    },
    [isPanning, panStart, pan, isConnecting, screenToCanvas]
  )

  // Handle mouse up
  const handleMouseUp = useCallback(() => {
    setIsPanning(false)
    setPanStart(null)
    setIsConnecting(false)
    setConnectingFrom(null)
    setConnectingPosition(null)
  }, [])

  // Handle double click to create node
  const handleDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target !== canvasRef.current) return

      const position = screenToCanvas(e.clientX, e.clientY)
      addNode(position)
    },
    [screenToCanvas, addNode]
  )

  // Handle node drag
  const handleNodeDrag = useCallback(
    (nodeId: string, position: Position) => {
      moveNode(nodeId, position)
    },
    [moveNode]
  )

  // Handle node select
  const handleNodeSelect = useCallback(
    (nodeId: string, addToSelection: boolean) => {
      selectNode(nodeId, addToSelection)
      bringNodeToFront(nodeId)
    },
    [selectNode, bringNodeToFront]
  )

  // Handle connection start
  const handleConnectionStart = useCallback(
    (nodeId: string, position: Position) => {
      setIsConnecting(true)
      setConnectingFrom(nodeId)
      setConnectingPosition(position)
    },
    []
  )

  // Handle connection end
  const handleConnectionEnd = useCallback(
    (targetNodeId: string) => {
      if (connectingFrom && connectingFrom !== targetNodeId) {
        addConnection(connectingFrom, targetNodeId)
      }
      setIsConnecting(false)
      setConnectingFrom(null)
      setConnectingPosition(null)
    },
    [connectingFrom, addConnection]
  )

  const nodes = currentMoodboard?.nodes || []
  const connections = currentMoodboard?.connections || []

  return (
    <div
      ref={canvasRef}
      className={`
        w-full h-full relative overflow-hidden
        ${isPanning ? 'cursor-grabbing' : toolMode === 'pan' ? 'cursor-grab' : 'cursor-default'}
      `}
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onDoubleClick={handleDoubleClick}
    >
      {/* Canvas transform container */}
      <motion.div
        className="absolute origin-top-left"
        style={{
          transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
        }}
      >
        {/* Connections layer (SVG) */}
        <ConnectionsLayer
          connections={connections}
          nodes={nodes}
          connectingFrom={connectingFrom}
          connectingPosition={connectingPosition}
        />

        {/* Nodes */}
        {nodes
          .sort((a, b) => a.zIndex - b.zIndex)
          .map((node) => (
            <IdeaCard
              key={node.id}
              node={node}
              isSelected={selection.nodeIds.includes(node.id)}
              onSelect={handleNodeSelect}
              onDrag={handleNodeDrag}
              onConnectionStart={handleConnectionStart}
              onConnectionEnd={handleConnectionEnd}
              isConnectMode={toolMode === 'connect'}
              isConnecting={isConnecting && connectingFrom !== node.id}
            />
          ))}
      </motion.div>

      {/* Empty state */}
      {nodes.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-center">
            <p className="text-neutral-400 text-lg mb-2">Double-click to create an idea</p>
            <p className="text-neutral-500 text-sm">Press N to add a node, or Cmd/Ctrl+V to paste images</p>
          </div>
        </div>
      )}

      {/* Minimap */}
      {isMinimapVisible && (
        <IdeaMazeMinimap
          nodes={nodes}
          viewport={viewport}
          canvasSize={canvasSize}
          onViewportChange={setViewport}
        />
      )}

      {/* Connection filter legend */}
      <ConnectionLegend />
    </div>
  )
}
