
export const REVIEW_PROMPT_TEMPLATE =
  'Review the following code changes. Identify bugs, security issues, style problems, and suggest improvements.\n\n```diff\n{diff}\n```'

/**
 * Build the full review prompt string from a git diff and optional file scope.
 *
 * Returns a "no changes" message when the diff is empty/whitespace.
 */
export function buildReviewPrompt(diff: string, scope?: string): string {
  const trimmedDiff = diff.trim()

  if (!trimmedDiff) {
    const scopeNote = scope ? ` for \`${scope}\`` : ''
    return `No changes found${scopeNote} to review.`
  }

  const scopeLine = scope ? `\nScoped to: \`${scope}\`\n` : ''

  return (
    'Review the following code changes. Identify bugs, security issues, style problems, and suggest improvements.' +
    scopeLine +
    '\n\n```diff\n' +
    diff +
    '\n```'
  )
}
