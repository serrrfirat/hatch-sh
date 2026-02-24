import { writeTextFile, readTextFile, mkdir, BaseDirectory } from '@tauri-apps/plugin-fs'
import { invoke } from '@tauri-apps/api/core'
import type { PRDDocument } from './types'

const PRD_DIR = 'idea-maze/prd'

// ── Phase 1: AppLocalData (plugin-fs) ──────────────────────────

export async function savePRDToAppData(moodboardId: string, prd: PRDDocument): Promise<void> {
  await mkdir(PRD_DIR, { baseDir: BaseDirectory.AppLocalData, recursive: true })
  await writeTextFile(`${PRD_DIR}/${moodboardId}.json`, JSON.stringify(prd, null, 2), {
    baseDir: BaseDirectory.AppLocalData,
  })
}

export async function loadPRDFromAppData(moodboardId: string): Promise<PRDDocument | null> {
  try {
    const raw = await readTextFile(`${PRD_DIR}/${moodboardId}.json`, {
      baseDir: BaseDirectory.AppLocalData,
    })
    try {
      return JSON.parse(raw) as PRDDocument
    } catch {
      console.warn(`Failed to parse PRD for moodboard ${moodboardId}: corrupted JSON`)
      return null
    }
  } catch {
    return null
  }
}

// ── Phase 2: Workspace (Tauri invoke IPC) ──────────────────────

interface FileContent {
  content: string
}

export async function copyPRDToWorkspace(prd: PRDDocument, workspacePath: string): Promise<void> {
  await invoke('write_project_files', {
    baseDir: workspacePath,
    files: [{ path: '.hatch/context/prd.json', content: JSON.stringify(prd, null, 2) }],
  })
}

export async function loadPRDFromWorkspace(workspacePath: string): Promise<PRDDocument | null> {
  try {
    const result = await invoke<FileContent>('read_file', {
      filePath: `${workspacePath}/.hatch/context/prd.json`,
    })
    return JSON.parse(result.content) as PRDDocument
  } catch {
    return null
  }
}
