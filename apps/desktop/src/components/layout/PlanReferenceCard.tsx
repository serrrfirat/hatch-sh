import { useState } from 'react'
import { ChevronDown, ChevronRight, FileText } from 'lucide-react'
import type { PlanContent } from '../../lib/ideaMaze/types'

interface PlanReferenceCardProps {
  plan: PlanContent
}

export function PlanReferenceCard({ plan }: PlanReferenceCardProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  return (
    <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-3">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex w-full items-center gap-2 text-left text-sm font-medium text-blue-400"
      >
        {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        <FileText className="h-4 w-4" />
        <span>Source Plan</span>
      </button>

      {isExpanded && (
        <div className="mt-2 space-y-2 pl-6 text-sm text-zinc-300">
          <p>{plan.summary}</p>

          {plan.requirements.length > 0 && (
            <div>
              <p className="font-medium text-zinc-400">Requirements:</p>
              <ul className="list-inside list-disc space-y-1 text-zinc-400">
                {plan.requirements.map((req, i) => (
                  <li key={i}>{req}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
