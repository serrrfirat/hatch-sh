import { Button, Badge, Panel, PanelHeader, PanelContent } from '@vibed/ui'
import { usePreview } from '../../hooks/usePreview'
import { useProjectStore } from '../../stores/projectStore'
import { PreviewFrame } from './PreviewFrame'
import { PreviewError } from './PreviewError'
import { PreviewLoading } from './PreviewLoading'

export function PreviewPanel() {
  const { currentProject } = useProjectStore()
  const { url, error, isLoading, refresh } = usePreview(currentProject?.code)

  const handleOpenInNewTab = () => {
    if (url) {
      window.open(url, '_blank')
    }
  }

  return (
    <Panel className="h-full border-l border-border">
      <PanelHeader className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-gray-400">Preview</h3>
          {isLoading && (
            <Badge variant="info" size="sm">
              Building...
            </Badge>
          )}
          {url && !isLoading && !error && (
            <Badge variant="success" size="sm">
              Live
            </Badge>
          )}
          {error && (
            <Badge variant="danger" size="sm">
              Error
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={refresh}
            disabled={isLoading || !currentProject?.code}
          >
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleOpenInNewTab}
            disabled={!url}
          >
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
              />
            </svg>
          </Button>
        </div>
      </PanelHeader>

      <PanelContent className="bg-bg-primary">
        {!currentProject?.code ? (
          <div className="flex items-center justify-center h-full text-gray-600 text-sm">
            Generate some code to see the preview
          </div>
        ) : isLoading ? (
          <PreviewLoading />
        ) : error ? (
          <PreviewError error={error} />
        ) : url ? (
          <PreviewFrame url={url} />
        ) : (
          <div className="flex items-center justify-center h-full text-gray-600 text-sm">
            No preview available
          </div>
        )}
      </PanelContent>
    </Panel>
  )
}
