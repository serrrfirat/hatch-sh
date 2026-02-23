import { Component, type ReactNode, type ErrorInfo } from 'react'
import { AlertCircle, ChevronDown, ChevronUp, RefreshCw } from 'lucide-react'

interface ErrorBoundaryProps {
  children: ReactNode
  sectionName?: string
  onError?: (error: Error, errorInfo: ErrorInfo) => void
  fallback?: ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
  showStack: boolean
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, error: null, showStack: false }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.props.onError?.(error, errorInfo)
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, showStack: false })
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      const { error, showStack } = this.state
      const sectionLabel = this.props.sectionName || 'This section'

      return (
        <div className="flex-1 flex items-center justify-center bg-neutral-950 p-8">
          <div className="max-w-md w-full bg-neutral-900 border border-white/10 rounded-xl p-6 shadow-2xl">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center">
                <AlertCircle size={20} className="text-red-400" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-semibold text-white mb-1">
                  {sectionLabel} crashed
                </h3>
                <p className="text-sm text-neutral-400 mb-4">
                  {error?.message || 'An unexpected error occurred'}
                </p>
              </div>
            </div>

            {error?.stack && (
              <div className="mt-2">
                <button
                  onClick={() => this.setState({ showStack: !showStack })}
                  className="flex items-center gap-1 text-xs text-neutral-500 hover:text-neutral-300 transition-colors"
                >
                  {showStack ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                  {showStack ? 'Hide' : 'Show'} details
                </button>
                {showStack && (
                  <pre className="mt-2 p-3 bg-neutral-950 rounded-lg text-xs text-neutral-500 overflow-auto max-h-40 border border-white/5">
                    {error.stack}
                  </pre>
                )}
              </div>
            )}

            <div className="mt-6 flex justify-end">
              <button
                onClick={this.handleReset}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-neutral-800 text-white text-sm font-medium hover:bg-neutral-700 transition-colors"
              >
                <RefreshCw size={14} />
                Try Again
              </button>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
