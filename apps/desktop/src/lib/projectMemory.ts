import { invoke } from '@tauri-apps/api/core'

interface FileContent {
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

export async function readProjectMemory(workspacePath: string): Promise<string | null> {
  try {
    const result = await invoke<FileContent>('read_file', {
      filePath: `${workspacePath}/.hatch/context.md`,
    })
    return result.content
  } catch {
    return null
  }
}

export async function writeProjectMemory(workspacePath: string, content: string): Promise<void> {
  const files: WriteProjectFileInput[] = [
    {
      path: '.hatch/context.md',
      content,
    },
  ]

  const results = await invoke<WriteProjectFileResult[]>('write_project_files', {
    files,
    baseDir: workspacePath,
  })

  const failed = results.filter((result) => !result.success)
  if (failed.length > 0) {
    const reason = failed
      .map((result) => `${result.path} (${result.error || 'unknown error'})`)
      .join(', ')
    throw new Error(`Failed to write project memory: ${reason}`)
  }
}
