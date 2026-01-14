import { cn } from '@vibed/ui'

interface PreviewErrorProps {
  error: string
  className?: string
}

export function PreviewError({ error, className }: PreviewErrorProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center h-full p-6 text-center',
        className
      )}
    >
      <div className="w-12 h-12 rounded-full bg-accent-red/10 flex items-center justify-center mb-4">
        <svg
          className="w-6 h-6 text-accent-red"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
      </div>
      <h3 className="text-lg font-semibold text-white mb-2">Preview Error</h3>
      <pre className="text-sm text-accent-red bg-bg-tertiary rounded-lg p-4 max-w-full overflow-x-auto whitespace-pre-wrap">
        {error}
      </pre>
    </div>
  )
}
