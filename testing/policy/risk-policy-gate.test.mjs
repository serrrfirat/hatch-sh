import test from 'node:test'
import assert from 'node:assert/strict'

import {
  assertDocsDriftRules,
  computeRiskTier,
  computeRequiredChecks,
  loadPolicy,
} from '../../scripts/risk-policy-gate.mjs'

const policyPath = '.github/risk-policy.json'

test('classifies high risk files', async () => {
  const policy = await loadPolicy(policyPath)
  const tier = computeRiskTier(['apps/desktop/src-tauri/src/main.rs'], policy)
  assert.equal(tier, 'high')
})

test('returns required checks for low risk changes', async () => {
  const policy = await loadPolicy(policyPath)
  const checks = computeRequiredChecks(['docs/readme.md'], policy)
  assert.deepEqual(checks, ['risk-policy-gate', 'CI Pipeline'])
})

test('requires docs update for control-plane changes', async () => {
  const policy = await loadPolicy(policyPath)
  assert.throws(
    () => assertDocsDriftRules(['.github/workflows/ci-pr.yml'], ['README.md'], policy),
    /docs drift/i,
  )
})
