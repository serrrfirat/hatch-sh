/**
 * Skills Service
 *
 * Handles fetching skills from GitHub and installing them via Tauri
 */

import type { Skill } from '../stores/marketplaceStore'

// Types for Tauri interop
interface SkillFile {
  name: string
  content: string
}

interface SkillInstallResult {
  success: boolean
  message: string
  path: string | null
}

// Check if we're running in Tauri
export function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI__' in window
}

// Dynamic import for Tauri - only loads when needed
async function getTauriInvoke() {
  if (!isTauri()) {
    throw new Error('Not running in Tauri environment')
  }
  const { invoke } = await import('@tauri-apps/api/core')
  return invoke
}

/**
 * Parse a GitHub URL to extract owner and repo
 */
export function parseGitHubUrl(
  url: string
): { owner: string; repo: string; path?: string } | null {
  // Handle various GitHub URL formats:
  // https://github.com/owner/repo
  // https://github.com/owner/repo/tree/main/path/to/skill
  // github.com/owner/repo
  // owner/repo

  const patterns = [
    // Full URL with path
    /github\.com\/([^\/]+)\/([^\/]+)(?:\/tree\/[^\/]+\/(.+))?/,
    // Full URL without path
    /github\.com\/([^\/]+)\/([^\/]+)/,
    // Short form (owner/repo)
    /^([^\/]+)\/([^\/]+)$/,
  ]

  for (const pattern of patterns) {
    const match = url.match(pattern)
    if (match) {
      return {
        owner: match[1],
        repo: match[2].replace(/\.git$/, ''),
        path: match[3],
      }
    }
  }

  return null
}

/**
 * Fetch raw file content from GitHub
 */
async function fetchGitHubFile(
  owner: string,
  repo: string,
  path: string,
  branch = 'main'
): Promise<string> {
  // Try raw.githubusercontent.com first
  const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${path}`

  const response = await fetch(rawUrl)
  if (!response.ok) {
    // Try 'master' branch as fallback
    if (branch === 'main') {
      return fetchGitHubFile(owner, repo, path, 'master')
    }
    throw new Error(`Failed to fetch ${path}: ${response.status}`)
  }

  return response.text()
}

/**
 * List files in a GitHub directory using the API
 */
async function listGitHubDirectory(
  owner: string,
  repo: string,
  path = '',
  branch = 'main'
): Promise<Array<{ name: string; path: string; type: 'file' | 'dir' }>> {
  const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${branch}`

  const response = await fetch(apiUrl, {
    headers: {
      Accept: 'application/vnd.github.v3+json',
    },
  })

  if (!response.ok) {
    if (branch === 'main') {
      return listGitHubDirectory(owner, repo, path, 'master')
    }
    throw new Error(`Failed to list directory: ${response.status}`)
  }

  const data = await response.json()

  if (!Array.isArray(data)) {
    // Single file, not a directory
    return [{ name: data.name, path: data.path, type: 'file' }]
  }

  return data.map((item: { name: string; path: string; type: string }) => ({
    name: item.name,
    path: item.path,
    type: item.type === 'dir' ? 'dir' : 'file',
  }))
}

/**
 * Recursively fetch all files from a GitHub directory
 */
async function fetchAllFilesFromGitHub(
  owner: string,
  repo: string,
  basePath = '',
  branch = 'main'
): Promise<SkillFile[]> {
  const files: SkillFile[] = []

  const items = await listGitHubDirectory(owner, repo, basePath, branch)

  for (const item of items) {
    if (item.type === 'file') {
      try {
        const content = await fetchGitHubFile(owner, repo, item.path, branch)
        // Use relative path from basePath
        const relativePath = basePath
          ? item.path.replace(basePath + '/', '')
          : item.path
        files.push({ name: relativePath, content })
      } catch (error) {
        console.warn(`Failed to fetch ${item.path}:`, error)
      }
    } else if (item.type === 'dir') {
      // Recursively fetch directory contents
      const subFiles = await fetchAllFilesFromGitHub(
        owner,
        repo,
        item.path,
        branch
      )
      files.push(...subFiles)
    }
  }

  return files
}

/**
 * Fetch skill content from GitHub
 */
export async function fetchSkillFromGitHub(skill: Skill): Promise<SkillFile[]> {
  const parsed = parseGitHubUrl(skill.githubUrl)
  if (!parsed) {
    throw new Error(`Invalid GitHub URL: ${skill.githubUrl}`)
  }

  const { owner, repo, path } = parsed

  // If there's a specific path, fetch from there
  // Otherwise, try to find SKILL.md in the repo root or common locations
  const searchPaths = path
    ? [path]
    : ['', 'skill', 'skills', `.claude/skills/${skill.name}`]

  for (const searchPath of searchPaths) {
    try {
      // First check if SKILL.md exists at this location
      const skillMdPath = searchPath ? `${searchPath}/SKILL.md` : 'SKILL.md'
      await fetchGitHubFile(owner, repo, skillMdPath)

      // If we found SKILL.md, fetch all files from that directory
      return fetchAllFilesFromGitHub(owner, repo, searchPath)
    } catch {
      // Try next path
      continue
    }
  }

  // If no SKILL.md found, try to fetch the entire repo as a skill
  // This handles repos that are themselves a single skill
  try {
    const files = await fetchAllFilesFromGitHub(owner, repo)
    if (files.some((f) => f.name === 'SKILL.md')) {
      return files
    }
  } catch {
    // Ignore
  }

  throw new Error(
    `Could not find SKILL.md in repository ${owner}/${repo}. Make sure the repository contains a valid skill.`
  )
}

/**
 * Install a skill using Tauri backend
 */
export async function installSkillViaTauri(
  skillName: string,
  files: SkillFile[],
  isGlobal: boolean,
  workingDirectory?: string
): Promise<SkillInstallResult> {
  const invoke = await getTauriInvoke()

  return invoke<SkillInstallResult>('install_skill', {
    skillName,
    files,
    isGlobal,
    workingDirectory,
  })
}

/**
 * Uninstall a skill using Tauri backend
 */
export async function uninstallSkillViaTauri(
  skillName: string,
  isGlobal: boolean,
  workingDirectory?: string
): Promise<SkillInstallResult> {
  const invoke = await getTauriInvoke()

  return invoke<SkillInstallResult>('uninstall_skill', {
    skillName,
    isGlobal,
    workingDirectory,
  })
}

/**
 * List installed skills using Tauri backend
 */
export async function listInstalledSkillsViaTauri(
  isGlobal: boolean,
  workingDirectory?: string
): Promise<string[]> {
  const invoke = await getTauriInvoke()

  return invoke<string[]>('list_installed_skills', {
    isGlobal,
    workingDirectory,
  })
}

/**
 * Check if a skill is installed using Tauri backend
 */
export async function isSkillInstalledViaTauri(
  skillName: string,
  isGlobal: boolean,
  workingDirectory?: string
): Promise<boolean> {
  const invoke = await getTauriInvoke()

  return invoke<boolean>('is_skill_installed', {
    skillName,
    isGlobal,
    workingDirectory,
  })
}

/**
 * Get the path where a skill would be installed
 */
export async function getSkillInstallPathViaTauri(
  skillName: string,
  isGlobal: boolean,
  workingDirectory?: string
): Promise<string> {
  const invoke = await getTauriInvoke()

  return invoke<string>('get_skill_install_path', {
    skillName,
    isGlobal,
    workingDirectory,
  })
}

/**
 * High-level function to install a skill
 * Fetches from GitHub and installs via Tauri
 */
export async function installSkill(
  skill: Skill,
  isGlobal: boolean,
  workingDirectory?: string
): Promise<{ success: boolean; message: string; path?: string }> {
  // Check if we're in Tauri
  if (!isTauri()) {
    return {
      success: false,
      message:
        'Skill installation is only available in the desktop app. Please use the desktop version to install skills.',
    }
  }

  try {
    // Fetch skill files from GitHub
    const files = await fetchSkillFromGitHub(skill)

    if (files.length === 0) {
      return {
        success: false,
        message: 'No files found in the skill repository',
      }
    }

    // Install via Tauri
    const result = await installSkillViaTauri(
      skill.name,
      files,
      isGlobal,
      workingDirectory
    )

    return {
      success: result.success,
      message: result.message,
      path: result.path || undefined,
    }
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error'
    return {
      success: false,
      message: `Failed to install skill: ${errorMessage}`,
    }
  }
}

/**
 * Get installed skills (both local and global)
 */
export async function getInstalledSkills(workingDirectory?: string): Promise<{
  local: string[]
  global: string[]
}> {
  if (!isTauri()) {
    return { local: [], global: [] }
  }

  try {
    const [local, global] = await Promise.all([
      listInstalledSkillsViaTauri(false, workingDirectory),
      listInstalledSkillsViaTauri(true, workingDirectory),
    ])

    return { local, global }
  } catch {
    return { local: [], global: [] }
  }
}
