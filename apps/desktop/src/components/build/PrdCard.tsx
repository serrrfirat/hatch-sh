import { useState } from 'react'
import { motion } from 'framer-motion'
import {
  ChevronDown,
  ChevronRight,
  ClipboardList,
  GitBranch,
  AlertTriangle,
  XCircle,
  CheckSquare,
} from 'lucide-react'
import type { PRDDocument } from '../../lib/context/types'

interface PrdCardProps {
  prd: PRDDocument | null
}

export function PrdCard({ prd }: PrdCardProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  if (!prd) return null

  const { plan, dependencyGraph, contradictions, scopeExclusions, acceptanceCriteria } = prd

  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.03] overflow-hidden">
      {/* Header - always visible */}
      <button
        data-testid="prd-card-header"
        onClick={() => setIsExpanded((prev) => !prev)}
        className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm font-medium text-zinc-200 hover:bg-white/5 transition-colors"
      >
        {isExpanded ? (
          <ChevronDown className="h-3.5 w-3.5 text-zinc-500 flex-shrink-0" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 text-zinc-500 flex-shrink-0" />
        )}
        <span className="flex-shrink-0">📋</span>
        <span>PRD</span>
        <span className="ml-auto text-[10px] text-zinc-600 font-normal">
          v{prd.version}
        </span>
      </button>

      {/* Collapsible body */}
      {isExpanded && (
        <motion.div
          data-testid="prd-card-body"
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          transition={{ duration: 0.2, ease: 'easeInOut' }}
          className="overflow-hidden"
        >
            <div className="px-3 pb-3 space-y-3 border-t border-white/5">
              {/* Summary */}
              <div className="pt-2.5">
                <p className="text-xs text-zinc-400 leading-relaxed">{plan.summary}</p>
              </div>

              {/* Requirements */}
              {plan.requirements.length > 0 && (
                <div data-testid="prd-requirements">
                  <SectionHeader
                    icon={<ClipboardList className="h-3 w-3" />}
                    label="Requirements"
                    count={plan.requirements.length}
                  />
                  <ol className="mt-1.5 space-y-1 pl-4">
                    {plan.requirements.map((req, i) => (
                      <li
                        key={i}
                        className="text-xs text-zinc-400 list-decimal marker:text-zinc-600"
                      >
                        {req}
                      </li>
                    ))}
                  </ol>
                </div>
              )}

              {/* Dependencies */}
              {dependencyGraph.length > 0 && (
                <div data-testid="prd-dependencies">
                  <SectionHeader
                    icon={<GitBranch className="h-3 w-3" />}
                    label="Dependencies"
                    count={dependencyGraph.length}
                  />
                  <ul className="mt-1.5 space-y-1">
                    {dependencyGraph.map((edge, i) => (
                      <li key={i} className="text-xs text-zinc-500 flex items-center gap-1.5">
                        <span className="text-zinc-400">{edge.fromId}</span>
                        <span className="text-zinc-600">→</span>
                        <span className="text-zinc-400">{edge.toId}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Contradictions */}
              {contradictions.length > 0 && (
                <div data-testid="prd-contradictions">
                  <SectionHeader
                    icon={<AlertTriangle className="h-3 w-3 text-amber-500/70" />}
                    label="Contradictions"
                    count={contradictions.length}
                    variant="warning"
                  />
                  <ul className="mt-1.5 space-y-1">
                    {contradictions.map((c, i) => (
                      <li key={i} className="text-xs text-amber-400/70">
                        {c.reasoning || `${c.nodeAId} ↔ ${c.nodeBId}`}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Scope Exclusions */}
              {scopeExclusions.length > 0 && (
                <div data-testid="prd-scope-exclusions">
                  <SectionHeader
                    icon={<XCircle className="h-3 w-3 text-zinc-500" />}
                    label="Excluded"
                    count={scopeExclusions.length}
                  />
                  <ul className="mt-1.5 space-y-1.5">
                    {scopeExclusions.map((ex, i) => (
                      <li key={i} className="flex items-start gap-1.5">
                        <span className="text-xs text-zinc-400">{ex.description}</span>
                        <span className="flex-shrink-0 px-1.5 py-0.5 text-[9px] font-medium rounded bg-white/5 text-zinc-500 uppercase tracking-wider">
                          {ex.reason}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Acceptance Criteria */}
              {acceptanceCriteria.length > 0 && (
                <div data-testid="prd-acceptance-criteria">
                  <SectionHeader
                    icon={<CheckSquare className="h-3 w-3 text-emerald-500/70" />}
                    label="Acceptance Criteria"
                    count={acceptanceCriteria.length}
                  />
                  <ul className="mt-1.5 space-y-1.5">
                    {acceptanceCriteria.map((ac) => (
                      <li key={ac.id} className="flex items-start gap-2 text-xs">
                        <span className="mt-0.5 w-3.5 h-3.5 rounded border border-zinc-700 flex-shrink-0" />
                        <span className="text-zinc-400">{ac.description}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
        </motion.div>
      )}
    </div>
  )
}

function SectionHeader({
  icon,
  label,
  count,
  variant = 'default',
}: {
  icon: React.ReactNode
  label: string
  count: number
  variant?: 'default' | 'warning'
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className={variant === 'warning' ? 'text-amber-500/70' : 'text-zinc-500'}>
        {icon}
      </span>
      <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">
        {label}
      </span>
      <span className="text-[10px] text-zinc-600">({count})</span>
    </div>
  )
}
