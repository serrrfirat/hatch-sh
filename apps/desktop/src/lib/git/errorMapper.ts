/**
 * Maps Git CLI error messages to user-friendly, actionable error messages
 */

export interface MappedError {
  message: string
  action?: string
  actionLabel?: string
}

/**
 * Maps stderr from Git CLI to a user-friendly error message with optional action
 * @param stderr The error message from Git CLI
 * @returns Object with user-friendly message and optional action hint
 */
export function mapGitError(stderr: string): MappedError {
  const lowerStderr = stderr.toLowerCase()

  // Non-fast-forward push rejection
  if (
    lowerStderr.includes('failed to push') &&
    (lowerStderr.includes('behind') || lowerStderr.includes('non-fast-forward'))
  ) {
    return {
      message: 'Push rejected — pull the latest changes first, then push again',
      action: 'pull-and-retry',
      actionLabel: 'Pull & Retry',
    }
  }

  // Authentication failure (401/403)
  if (
    lowerStderr.includes('authentication failed') ||
    lowerStderr.includes('permission denied') ||
    lowerStderr.includes('could not read username')
  ) {
    // Distinguish between auth and permission issues
    if (
      lowerStderr.includes('could not read username') ||
      lowerStderr.includes('terminal prompts disabled')
    ) {
      return {
        message: 'Permission denied — you may not have write access to this repository',
        action: 'check-permissions',
        actionLabel: 'Check Permissions',
      }
    }

    return {
      message: 'GitHub authentication failed — reconnect your account in Settings',
      action: 'open-settings',
      actionLabel: 'Open Settings',
    }
  }

  // Merge conflict
  if (lowerStderr.includes('conflict') && lowerStderr.includes('merge')) {
    const conflictFiles = extractConflictFiles(stderr)
    const fileList = conflictFiles.length > 0 ? ` in ${conflictFiles.join(', ')}` : ''
    return {
      message: `Merge conflict${fileList} — resolve conflicts before committing`,
      action: 'resolve-conflicts',
      actionLabel: 'Resolve Conflicts',
    }
  }

  // Clone failure (404 - repository not found)
  if (lowerStderr.includes('repository') && lowerStderr.includes('not found')) {
    return {
      message: 'Repository not found — check the URL or your access permissions',
      action: 'check-url',
      actionLabel: 'Check URL',
    }
  }

  // Network error
  if (
    lowerStderr.includes('unable to access') ||
    lowerStderr.includes('could not resolve host') ||
    lowerStderr.includes('network') ||
    lowerStderr.includes('connection refused') ||
    lowerStderr.includes('connection timed out')
  ) {
    return {
      message: 'Network error — check your internet connection and try again',
      action: 'retry',
      actionLabel: 'Retry',
    }
  }

  // Generic fallback
  return {
    message: 'Git operation failed — please check your connection and try again',
    action: 'retry',
    actionLabel: 'Retry',
  }
}

/**
 * Extract conflicting file paths from merge conflict error message
 */
function extractConflictFiles(stderr: string): string[] {
  const files: string[] = []
  const conflictPattern = /CONFLICT\s*\([^)]+\):\s*Merge conflict in\s+([^\n]+)/gi

  let match
  while ((match = conflictPattern.exec(stderr)) !== null) {
    const file = match[1]?.trim()
    if (file && !files.includes(file)) {
      files.push(file)
    }
  }

  return files
}
