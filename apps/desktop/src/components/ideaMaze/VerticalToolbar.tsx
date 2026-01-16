import { motion } from 'framer-motion'
import {
  MousePointer2,
  Hand,
  Plus,
  Link2,
  Sparkles,
  Map,
  PanelRightOpen,
  PanelRightClose,
  ZoomIn,
  ZoomOut,
  Maximize2,
} from 'lucide-react'
import { useIdeaMazeStore } from '../../stores/ideaMazeStore'
import { toolbarButtonVariants, COLORS } from '../../lib/ideaMaze/animations'
import { MoodboardSelector } from './MoodboardSelector'
import type { ToolMode } from '../../lib/ideaMaze/types'

interface ToolButtonProps {
  icon: React.ElementType
  label: string
  isActive?: boolean
  onClick: () => void
  shortcut?: string
}

function ToolButton({ icon: Icon, label, isActive, onClick, shortcut }: ToolButtonProps) {
  return (
    <motion.button
      variants={toolbarButtonVariants}
      initial="initial"
      whileHover="hover"
      whileTap="tap"
      animate={isActive ? 'active' : 'initial'}
      onClick={onClick}
      className="relative w-10 h-10 flex items-center justify-center rounded-lg transition-colors group"
      style={{
        backgroundColor: isActive ? COLORS.primaryGlow : 'transparent',
        color: isActive ? COLORS.primary : COLORS.textMuted,
      }}
      title={`${label}${shortcut ? ` (${shortcut})` : ''}`}
    >
      <Icon size={18} />

      {/* Tooltip */}
      <div
        className="absolute left-full ml-2 px-2 py-1 rounded text-xs text-white whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50"
        style={{ backgroundColor: COLORS.surface }}
      >
        {label}
        {shortcut && <span className="ml-2" style={{ color: COLORS.textMuted }}>{shortcut}</span>}
      </div>

      {/* Active indicator */}
      {isActive && (
        <motion.div
          layoutId="activeToolIndicator"
          className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-r"
          style={{ backgroundColor: COLORS.primary }}
        />
      )}
    </motion.button>
  )
}

function Divider() {
  return <div className="w-6 h-px my-2" style={{ backgroundColor: COLORS.border }} />
}

export function VerticalToolbar() {
  const {
    toolMode,
    setToolMode,
    isSidebarOpen,
    toggleSidebar,
    isMinimapVisible,
    toggleMinimap,
    zoom,
    zoomToFit,
    addNode,
    viewport,
  } = useIdeaMazeStore()

  const handleAddNode = () => {
    // Add node at center of viewport
    const centerX = -viewport.x / viewport.zoom + 400
    const centerY = -viewport.y / viewport.zoom + 300
    addNode({ x: centerX, y: centerY })
  }

  const tools: { mode: ToolMode; icon: React.ElementType; label: string; shortcut: string }[] = [
    { mode: 'select', icon: MousePointer2, label: 'Select', shortcut: 'V' },
    { mode: 'pan', icon: Hand, label: 'Pan', shortcut: 'H' },
    { mode: 'connect', icon: Link2, label: 'Connect', shortcut: 'C' },
  ]

  return (
    <div
      className="w-12 h-full backdrop-blur-xl flex flex-col items-center py-3 relative z-10"
      style={{
        backgroundColor: `${COLORS.backgroundAlt}cc`,
        borderRight: `1px solid ${COLORS.border}`,
      }}
    >
      {/* Moodboard selector at top */}
      <MoodboardSelector />

      <Divider />

      {/* Tool modes */}
      <div className="flex flex-col items-center gap-1">
        {tools.map((tool) => (
          <ToolButton
            key={tool.mode}
            icon={tool.icon}
            label={tool.label}
            shortcut={tool.shortcut}
            isActive={toolMode === tool.mode}
            onClick={() => setToolMode(tool.mode)}
          />
        ))}
      </div>

      <Divider />

      {/* Add node */}
      <ToolButton
        icon={Plus}
        label="Add Node"
        shortcut="N"
        onClick={handleAddNode}
      />

      {/* TODO: AI Analyze button - Implementation needed
       * Expected behavior:
       * 1. Analyze currently selected nodes (or all nodes if none selected)
       * 2. Generate AI suggestions including:
       *    - Connection suggestions: Find related ideas that should be linked
       *    - Node suggestions: Generate new ideas based on existing content
       *    - Critique suggestions: Identify gaps, contradictions, or areas to explore
       * 3. Add suggestions to aiSuggestions store array
       * 4. Show suggestions in the sidebar Suggestions tab
       *
       * Implementation approach:
       * - Set isAIProcessing to true while analyzing
       * - Call an AI service (e.g., Claude API) with node contents as context
       * - Parse AI response into ConnectionSuggestion, NodeSuggestion, or CritiqueSuggestion
       * - Use addAISuggestion() to populate the suggestions list
       *
       * Considerations:
       * - Add loading state to button (spinner icon)
       * - Handle API errors gracefully
       * - Consider rate limiting to prevent excessive API calls
       * - May need to batch analyze for performance with many nodes
       */}
      <ToolButton
        icon={Sparkles}
        label="AI Analyze (coming soon)"
        shortcut="⌘⇧A"
        onClick={() => {
          // TODO: Trigger AI analysis - see comment above for implementation details
        }}
      />

      <Divider />

      {/* Zoom controls */}
      <ToolButton
        icon={ZoomIn}
        label="Zoom In"
        shortcut="⌘+"
        onClick={() => zoom(0.1)}
      />
      <ToolButton
        icon={ZoomOut}
        label="Zoom Out"
        shortcut="⌘-"
        onClick={() => zoom(-0.1)}
      />
      <ToolButton
        icon={Maximize2}
        label="Zoom to Fit"
        shortcut="⌘0"
        onClick={zoomToFit}
      />

      {/* Spacer */}
      <div className="flex-1" />

      {/* Bottom controls */}
      <div className="flex flex-col items-center gap-1">
        <ToolButton
          icon={Map}
          label="Minimap"
          isActive={isMinimapVisible}
          onClick={toggleMinimap}
        />
        <ToolButton
          icon={isSidebarOpen ? PanelRightClose : PanelRightOpen}
          label={isSidebarOpen ? 'Hide Sidebar' : 'Show Sidebar'}
          onClick={toggleSidebar}
        />
      </div>

      {/* Zoom indicator */}
      <div
        className="mt-3 px-2 py-1 rounded text-[10px] font-mono"
        style={{
          backgroundColor: `${COLORS.surface}80`,
          color: COLORS.textMuted,
        }}
      >
        {Math.round(viewport.zoom * 100)}%
      </div>
    </div>
  )
}
