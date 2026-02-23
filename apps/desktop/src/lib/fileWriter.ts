import { invoke } from '@tauri-apps/api/core'

export interface FileWriteBlock {
  filePath: string
  content: string
}

interface WriteProjectFileInput {
  path: string
  content: string
}

interface WriteProjectFileResult {
  path: string
  success: boolean
  size: number
  error: string | null
}

export interface WrittenFileManifest {
  path: string
  size: number
}

export async function writeCodeBlocksToWorkspace(
  blocks: FileWriteBlock[],
  baseDir: string
): Promise<WrittenFileManifest[]> {
  if (!baseDir || blocks.length === 0) {
    return []
  }

  const files: WriteProjectFileInput[] = blocks.map((block) => ({
    path: block.filePath,
    content: block.content,
  }))

  const results = await invoke<WriteProjectFileResult[]>('write_project_files', {
    files,
    baseDir,
  })

  const failed = results.filter((result) => !result.success)
  if (failed.length > 0) {
    const reason = failed
      .map((result) => `${result.path} (${result.error || 'unknown error'})`)
      .join(', ')
    throw new Error(`Failed to write ${failed.length} file(s): ${reason}`)
  }

  return results.map((result) => ({ path: result.path, size: result.size }))
}
