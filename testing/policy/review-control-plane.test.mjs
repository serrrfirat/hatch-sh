import test from 'node:test'
import assert from 'node:assert/strict'

import {
  computeMissingOrFailingRequiredChecks,
  shouldPostRerunComment,
  selectResolvableBotOnlyThreadIds,
} from '../../scripts/review-control-plane.mjs'

test('computeMissingOrFailingRequiredChecks returns failing checks for current head sha', () => {
  const required = ['Code Review Agent', 'risk-policy-gate']
  const runs = [
    { name: 'Code Review Agent', status: 'completed', conclusion: 'failure' },
    { name: 'risk-policy-gate', status: 'completed', conclusion: 'success' },
  ]

  assert.deepEqual(computeMissingOrFailingRequiredChecks(required, runs), ['Code Review Agent'])
})

test('shouldPostRerunComment dedupes by marker and sha', () => {
  const comments = [
    { body: '<!-- review-agent-auto-rerun -->\nsha:abc123' },
    { body: 'human comment' },
  ]

  assert.equal(shouldPostRerunComment(comments, 'abc123'), false)
  assert.equal(shouldPostRerunComment(comments, 'def456'), true)
})

test('selectResolvableBotOnlyThreadIds chooses unresolved bot-only threads', () => {
  const threads = [
    {
      id: 'T1',
      isResolved: false,
      comments: { nodes: [{ author: { login: 'review-bot' } }, { author: { login: 'review-bot' } }] },
    },
    {
      id: 'T2',
      isResolved: false,
      comments: { nodes: [{ author: { login: 'review-bot' } }, { author: { login: 'firat' } }] },
    },
    {
      id: 'T3',
      isResolved: true,
      comments: { nodes: [{ author: { login: 'review-bot' } }] },
    },
  ]

  assert.deepEqual(selectResolvableBotOnlyThreadIds(threads, ['review-bot']), ['T1'])
})
