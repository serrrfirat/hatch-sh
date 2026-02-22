import type { DeployTarget } from '../../hooks/useDeploy'

const TARGET_OPTIONS: { value: DeployTarget; label: string; description: string }[] = [
  { value: 'cloudflare', label: 'Cloudflare Pages', description: 'Production static sites' },
  { value: 'herenow', label: 'here.now', description: 'Quick preview (24h)' },
  { value: 'railway', label: 'Railway', description: 'Full-stack hosting' },
]

interface DeployTargetSelectorProps {
  value: DeployTarget
  onChange: (target: DeployTarget) => void
}

export function DeployTargetSelector({ value, onChange }: DeployTargetSelectorProps) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as DeployTarget)}
      className="appearance-none bg-neutral-800 border border-white/10 rounded-lg px-3 py-1.5 pr-8 text-xs text-white focus:outline-none focus:border-white/20 cursor-pointer"
    >
      {TARGET_OPTIONS.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label} — {opt.description}
        </option>
      ))}
    </select>
  )
}
