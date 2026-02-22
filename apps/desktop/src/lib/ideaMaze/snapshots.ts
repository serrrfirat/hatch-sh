import { appDataDir, join } from '@tauri-apps/api/path'
import { exists, mkdir, readDir, readTextFile, remove, writeTextFile } from '@tauri-apps/plugin-fs'
import type { IdeaConnection, IdeaNode, Moodboard } from './types'

const IDEA_MAZE_DIR = 'idea-maze'
const SNAPSHOTS_DIR = 'snapshots'
const SNAPSHOT_EXT = '.json'

export interface Snapshot {
  id: string
  name: string
  moodboardId: string
  createdAt: Date
  nodes: IdeaNode[]
  connections: IdeaConnection[]
}

interface StoredSnapshot extends Omit<Snapshot, 'createdAt'> {
  createdAt: string
}

async function getSnapshotsRootPath(): Promise<string> {
  const appData = await appDataDir()
  return join(appData, IDEA_MAZE_DIR, SNAPSHOTS_DIR)
}

async function getMoodboardSnapshotsPath(moodboardId: string): Promise<string> {
  const snapshotsRootPath = await getSnapshotsRootPath()
  return join(snapshotsRootPath, moodboardId)
}

function toSnapshot(stored: StoredSnapshot): Snapshot {
  return {
    ...stored,
    createdAt: new Date(stored.createdAt),
  }
}

export async function saveSnapshot(moodboard: Moodboard, name: string): Promise<Snapshot> {
  const moodboardSnapshotsPath = await getMoodboardSnapshotsPath(moodboard.id)
  if (!(await exists(moodboardSnapshotsPath))) {
    await mkdir(moodboardSnapshotsPath, { recursive: true })
  }

  const snapshot: Snapshot = {
    id: crypto.randomUUID(),
    name,
    moodboardId: moodboard.id,
    createdAt: new Date(),
    nodes: structuredClone(moodboard.nodes),
    connections: structuredClone(moodboard.connections),
  }

  const storedSnapshot: StoredSnapshot = {
    ...snapshot,
    createdAt: snapshot.createdAt.toISOString(),
  }

  const snapshotFilePath = await join(moodboardSnapshotsPath, `${snapshot.id}${SNAPSHOT_EXT}`)
  await writeTextFile(snapshotFilePath, JSON.stringify(storedSnapshot, null, 2))
  return snapshot
}

export async function listSnapshots(moodboardId: string): Promise<Snapshot[]> {
  const moodboardSnapshotsPath = await getMoodboardSnapshotsPath(moodboardId)
  if (!(await exists(moodboardSnapshotsPath))) {
    return []
  }

  const entries = await readDir(moodboardSnapshotsPath)
  const snapshots: Snapshot[] = []

  for (const entry of entries) {
    if (!entry.name || !entry.name.endsWith(SNAPSHOT_EXT)) {
      continue
    }

    const snapshotFilePath = await join(moodboardSnapshotsPath, entry.name)
    const stored = JSON.parse(await readTextFile(snapshotFilePath)) as StoredSnapshot
    snapshots.push(toSnapshot(stored))
  }

  snapshots.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
  return snapshots
}

export async function loadSnapshot(moodboardId: string, snapshotId: string): Promise<Snapshot> {
  const moodboardSnapshotsPath = await getMoodboardSnapshotsPath(moodboardId)
  const snapshotFilePath = await join(moodboardSnapshotsPath, `${snapshotId}${SNAPSHOT_EXT}`)

  if (!(await exists(snapshotFilePath))) {
    throw new Error(`Snapshot not found: ${snapshotId}`)
  }

  const stored = JSON.parse(await readTextFile(snapshotFilePath)) as StoredSnapshot
  return toSnapshot(stored)
}

export async function deleteSnapshot(moodboardId: string, snapshotId: string): Promise<void> {
  const moodboardSnapshotsPath = await getMoodboardSnapshotsPath(moodboardId)
  const snapshotFilePath = await join(moodboardSnapshotsPath, `${snapshotId}${SNAPSHOT_EXT}`)

  if (await exists(snapshotFilePath)) {
    await remove(snapshotFilePath)
  }
}
