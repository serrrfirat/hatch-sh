import { useCallback, useEffect, useState } from 'react'
import { Archive, RotateCcw, Save, Trash2 } from 'lucide-react'
import { deleteSnapshot, listSnapshots, saveSnapshot } from '../../lib/ideaMaze/snapshots'
import type { Snapshot } from '../../lib/ideaMaze/snapshots'
import { useIdeaMazeStore } from '../../stores/ideaMazeStore'

export function SnapshotPanel() {
  const { currentMoodboard, restoreSnapshot } = useIdeaMazeStore()
  const [snapshotName, setSnapshotName] = useState('')
  const [snapshots, setSnapshots] = useState<Snapshot[]>([])
  const [isSaving, setIsSaving] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  const refreshSnapshots = useCallback(async () => {
    if (!currentMoodboard) {
      setSnapshots([])
      return
    }

    setIsLoading(true)
    setError(null)
    try {
      const items = await listSnapshots(currentMoodboard.id)
      setSnapshots(items)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load snapshots')
    } finally {
      setIsLoading(false)
    }
  }, [currentMoodboard])

  useEffect(() => {
    void refreshSnapshots()
  }, [refreshSnapshots])

  const handleSaveSnapshot = async () => {
    if (!currentMoodboard || !snapshotName.trim() || isSaving) return

    setIsSaving(true)
    setError(null)
    try {
      await saveSnapshot(currentMoodboard, snapshotName.trim())
      setSnapshotName('')
      await refreshSnapshots()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Failed to save snapshot')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDeleteSnapshot = async (snapshotId: string) => {
    if (!currentMoodboard) return
    if (confirmDeleteId !== snapshotId) {
      setConfirmDeleteId(snapshotId)
      return
    }

    setError(null)
    try {
      await deleteSnapshot(currentMoodboard.id, snapshotId)
      setConfirmDeleteId(null)
      await refreshSnapshots()
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Failed to delete snapshot')
    }
  }

  return (
    <div className="mt-4 rounded-lg border border-zinc-800 bg-zinc-900/70 p-3">
      <div className="mb-3 flex items-center gap-2">
        <Archive size={14} className="text-zinc-300" />
        <h4 className="text-xs font-semibold uppercase tracking-wide text-zinc-300">Snapshots</h4>
      </div>

      <div className="mb-3 flex gap-2">
        <input
          type="text"
          value={snapshotName}
          onChange={(e) => setSnapshotName(e.target.value)}
          placeholder="Snapshot name"
          className="min-w-0 flex-1 rounded border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-xs text-zinc-200 placeholder:text-zinc-500 focus:border-zinc-500 focus:outline-none"
        />
        <button
          onClick={handleSaveSnapshot}
          disabled={!currentMoodboard || !snapshotName.trim() || isSaving}
          className="inline-flex items-center gap-1 rounded border border-zinc-700 bg-zinc-800 px-2 py-1.5 text-xs text-zinc-200 transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Save size={12} />
          Save
        </button>
      </div>

      {error && <p className="mb-2 text-xs text-red-400">{error}</p>}
      {isLoading && <p className="mb-2 text-xs text-zinc-500">Loading snapshots...</p>}

      {!isLoading && snapshots.length === 0 && (
        <p className="text-xs text-zinc-500">No snapshots yet</p>
      )}

      <div className="space-y-2">
        {snapshots.map((snapshot) => (
          <div key={snapshot.id} className="rounded border border-zinc-800 bg-zinc-900 px-2 py-2">
            <p className="truncate text-xs font-medium text-zinc-200">{snapshot.name}</p>
            <p className="mt-0.5 text-[11px] text-zinc-500">
              {snapshot.createdAt.toLocaleString()} · {snapshot.nodes.length} nodes
            </p>
            <div className="mt-2 flex gap-2">
              <button
                onClick={() => restoreSnapshot(snapshot)}
                className="inline-flex items-center gap-1 rounded border border-zinc-700 px-2 py-1 text-[11px] text-zinc-200 transition hover:bg-zinc-800"
              >
                <RotateCcw size={11} />
                Restore
              </button>
              <button
                onClick={() => void handleDeleteSnapshot(snapshot.id)}
                className="inline-flex items-center gap-1 rounded border border-zinc-700 px-2 py-1 text-[11px] text-zinc-300 transition hover:bg-zinc-800"
              >
                <Trash2 size={11} />
                {confirmDeleteId === snapshot.id ? 'Confirm' : 'Delete'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
