#!/usr/bin/env node
import fs from 'node:fs/promises'
import process from 'node:process'

function globToRegExp(glob) {
  const escaped = glob
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*/g, '::DOUBLE_STAR::')
    .replace(/\*/g, '[^/]*')
    .replace(/::DOUBLE_STAR::/g, '.*')
  return new RegExp(`^${escaped}$`)
}

function matchesAny(path, patterns = []) {
  return patterns.some((p) => globToRegExp(p).test(path))
}

export async function loadPolicy(policyPath = '.github/risk-policy.json') {
  const raw = await fs.readFile(policyPath, 'utf-8')
  return JSON.parse(raw)
}

export function computeRiskTier(changedFiles, policy) {
  const high = policy?.riskTierRules?.high ?? []
  if (changedFiles.some((f) => matchesAny(f, high))) return 'high'
  return 'low'
}

export function computeRequiredChecks(changedFiles, policy) {
  const tier = computeRiskTier(changedFiles, policy)
  const checks = policy?.mergePolicy?.[tier]?.requiredChecks ?? []
  const uiPaths = policy?.browserEvidence?.uiPaths ?? []
  const browserCheck = policy?.browserEvidence?.requiredCheck

  if (browserCheck && changedFiles.some((f) => matchesAny(f, uiPaths)) && !checks.includes(browserCheck)) {
    return [...checks, browserCheck]
  }
  return checks
}

export function assertDocsDriftRules(changedFiles, changedDocs, policy) {
  const controlPlane = policy?.docsDriftRules?.controlPlanePaths ?? []
  const requiredDocs = policy?.docsDriftRules?.requiredDocs ?? []

  const controlPlaneTouched = changedFiles.some((f) => matchesAny(f, controlPlane))
  if (!controlPlaneTouched) return

  const docUpdated = requiredDocs.some((doc) => changedDocs.includes(doc))
  if (!docUpdated) {
    throw new Error(
      `Docs drift detected: control-plane changes require one of ${requiredDocs.join(', ')}`,
    )
  }
}

function parseChangedFiles() {
  const fromEnv = process.env.CHANGED_FILES?.trim()
  if (fromEnv) {
    return fromEnv.split(/\r?\n|,/).map((s) => s.trim()).filter(Boolean)
  }
  return []
}

function changedDocs(files) {
  return files.filter((f) => f.startsWith('docs/'))
}

async function run() {
  const policy = await loadPolicy()
  const files = parseChangedFiles()

  if (files.length === 0) {
    console.log('No CHANGED_FILES provided; defaulting to low risk preflight pass')
    return
  }

  const tier = computeRiskTier(files, policy)
  const checks = computeRequiredChecks(files, policy)
  assertDocsDriftRules(files, changedDocs(files), policy)

  console.log(`risk_tier=${tier}`)
  console.log(`required_checks=${checks.join(',')}`)

  if (process.env.GITHUB_OUTPUT) {
    await fs.appendFile(process.env.GITHUB_OUTPUT, `risk_tier=${tier}\n`)
    await fs.appendFile(process.env.GITHUB_OUTPUT, `required_checks=${checks.join(',')}\n`)
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  run().catch((err) => {
    console.error(err.message)
    process.exit(1)
  })
}
