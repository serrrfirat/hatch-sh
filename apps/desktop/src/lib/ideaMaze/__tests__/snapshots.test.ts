import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createMoodboard, createNode } from '../types'

vi.mock('@tauri-apps/plugin-fs', () => ({
  exists: vi.fn(),
  mkdir: vi.fn(),
  readDir: vi.fn(),
  readTextFile: vi.fn(),
  writeTextFile: vi.fn(),
  remove: vi.fn(),
}))

vi.mock('@tauri-apps/api/path', () => ({
  appDataDir: vi.fn(async () => '/app/data'),
  join: vi.fn(async (...parts: string[]) => parts.join('/')),
}))

import { deleteSnapshot, listSnapshots, loadSnapshot, saveSnapshot } from '../snapshots'
import { exists, mkdir, readDir, readTextFile, remove, writeTextFile } from '@tauri-apps/plugin-fs'

describe('idea maze snapshots', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('saves a named snapshot under moodboard snapshot directory', async () => {
    const moodboard = createMoodboard('Snapshot Board')
    const node = createNode({ x: 10, y: 20 })
    moodboard.nodes = [node]

    vi.mocked(exists).mockResolvedValue(false)

    const snapshot = await saveSnapshot(moodboard, 'Milestone A')

    expect(snapshot.name).toBe('Milestone A')
    expect(snapshot.moodboardId).toBe(moodboard.id)
    expect(snapshot.nodes).toHaveLength(1)
    expect(vi.mocked(mkdir)).toHaveBeenCalledTimes(1)
    expect(vi.mocked(writeTextFile)).toHaveBeenCalledTimes(1)

    const [filePath, json] = vi.mocked(writeTextFile).mock.calls[0]
    const pathString = String(filePath)
    expect(pathString).toContain(`/idea-maze/snapshots/${moodboard.id}/`)
    expect(pathString.endsWith('.json')).toBe(true)
    expect(JSON.parse(json)).toMatchObject({
      name: 'Milestone A',
      moodboardId: moodboard.id,
    })
  })

  it('lists snapshots for a moodboard', async () => {
    const moodboardId = 'board-1'
    vi.mocked(exists).mockResolvedValue(true)
    vi.mocked(readDir).mockResolvedValue([
      { name: 'snapshot-1.json', isDirectory: false, isFile: true, isSymlink: false },
      { name: 'snapshot-2.json', isDirectory: false, isFile: true, isSymlink: false },
    ])

    vi.mocked(readTextFile)
      .mockResolvedValueOnce(
        JSON.stringify({
          id: 'snapshot-1',
          name: 'First',
          moodboardId,
          createdAt: '2025-01-01T00:00:00.000Z',
          nodes: [],
          connections: [],
        })
      )
      .mockResolvedValueOnce(
        JSON.stringify({
          id: 'snapshot-2',
          name: 'Second',
          moodboardId,
          createdAt: '2025-01-02T00:00:00.000Z',
          nodes: [],
          connections: [],
        })
      )

    const snapshots = await listSnapshots(moodboardId)

    expect(snapshots).toHaveLength(2)
    expect(snapshots[0].id).toBe('snapshot-2')
    expect(snapshots[1].id).toBe('snapshot-1')
  })

  it('loads and deletes a snapshot by id', async () => {
    const moodboardId = 'board-2'
    const snapshotId = 'snapshot-a'

    vi.mocked(exists).mockResolvedValue(true)
    vi.mocked(readTextFile).mockResolvedValue(
      JSON.stringify({
        id: snapshotId,
        name: 'Checkpoint',
        moodboardId,
        createdAt: '2025-01-03T00:00:00.000Z',
        nodes: [],
        connections: [],
      })
    )

    const snapshot = await loadSnapshot(moodboardId, snapshotId)
    expect(snapshot.id).toBe(snapshotId)

    await deleteSnapshot(moodboardId, snapshotId)
    expect(vi.mocked(remove)).toHaveBeenCalledTimes(1)
    expect(vi.mocked(remove).mock.calls[0][0]).toContain(
      `/idea-maze/snapshots/${moodboardId}/${snapshotId}.json`
    )
  })
})
