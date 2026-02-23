import { describe, it, expect } from 'vitest'
import { buildReviewPrompt, REVIEW_PROMPT_TEMPLATE } from '../codeReview'

describe('REVIEW_PROMPT_TEMPLATE', () => {
  it('contains key review instructions', () => {
    expect(REVIEW_PROMPT_TEMPLATE).toContain('Review the following code changes')
    expect(REVIEW_PROMPT_TEMPLATE).toContain('bugs')
    expect(REVIEW_PROMPT_TEMPLATE).toContain('security issues')
    expect(REVIEW_PROMPT_TEMPLATE).toContain('style problems')
    expect(REVIEW_PROMPT_TEMPLATE).toContain('suggest improvements')
  })

  it('contains diff placeholder', () => {
    expect(REVIEW_PROMPT_TEMPLATE).toContain('{diff}')
  })
})

describe('buildReviewPrompt', () => {
  it('returns prompt with diff content embedded in code block', () => {
    const diff = '--- a/foo.ts\n+++ b/foo.ts\n@@ -1 +1 @@\n-old\n+new'
    const result = buildReviewPrompt(diff)
    expect(result).toContain('```diff')
    expect(result).toContain(diff)
    expect(result).toContain('```')
    expect(result).toContain('Review the following code changes')
  })

  it('includes scope in prompt when provided', () => {
    const diff = '+added line'
    const result = buildReviewPrompt(diff, 'src/lib/foo.ts')
    expect(result).toContain('src/lib/foo.ts')
    expect(result).toContain(diff)
  })

  it('omits scope line when scope is undefined', () => {
    const diff = '+added line'
    const result = buildReviewPrompt(diff)
    expect(result).not.toContain('Scoped to:')
    expect(result).toContain(diff)
  })

  it('returns no-changes message when diff is empty', () => {
    const result = buildReviewPrompt('')
    expect(result).toContain('No changes')
    expect(result).not.toContain('```diff')
  })

  it('returns no-changes message when diff is whitespace-only', () => {
    const result = buildReviewPrompt('   \n  \n  ')
    expect(result).toContain('No changes')
    expect(result).not.toContain('```diff')
  })

  it('preserves multiline diff content exactly', () => {
    const diff = [
      'diff --git a/file.ts b/file.ts',
      'index abc123..def456 100644',
      '--- a/file.ts',
      '+++ b/file.ts',
      '@@ -1,3 +1,4 @@',
      ' unchanged',
      '-removed',
      '+added',
      '+also added',
    ].join('\n')
    const result = buildReviewPrompt(diff)
    expect(result).toContain(diff)
  })

  it('handles diff with special characters', () => {
    const diff = '+const regex = /[a-z]+/g;'
    const result = buildReviewPrompt(diff)
    expect(result).toContain(diff)
  })

  it('includes scope with empty diff returns no-changes with scope', () => {
    const result = buildReviewPrompt('', 'src/missing.ts')
    expect(result).toContain('No changes')
    expect(result).toContain('src/missing.ts')
  })
})
