#!/usr/bin/env node
import fs from 'node:fs/promises'

export function computeMissingOrFailingRequiredChecks(requiredChecks, checkRuns) {
  const byName = new Map(checkRuns.map((r) => [r.name, r]))
  const failing = []

  for (const name of requiredChecks) {
    const run = byName.get(name)
    if (!run) {
      failing.push(name)
      continue
    }
    const ok = run.status === 'completed' && run.conclusion === 'success'
    if (!ok) failing.push(name)
  }

  return failing
}

export function shouldPostRerunComment(existingComments, headSha, marker = '<!-- review-agent-auto-rerun -->') {
  const trigger = `sha:${headSha}`
  return !existingComments.some((c) => {
    const body = c?.body ?? ''
    return body.includes(marker) && body.includes(trigger)
  })
}

export function selectResolvableBotOnlyThreadIds(threads, botLogins) {
  const bots = new Set(botLogins.map((b) => b.toLowerCase()))
  return threads
    .filter((t) => !t.isResolved)
    .filter((t) => {
      const comments = t?.comments?.nodes ?? []
      if (comments.length === 0) return false
      return comments.every((c) => bots.has((c?.author?.login ?? '').toLowerCase()))
    })
    .map((t) => t.id)
}

async function githubRequest(path, method = 'GET', body) {
  const token = process.env.GITHUB_TOKEN
  const repo = process.env.GITHUB_REPOSITORY
  if (!token || !repo) throw new Error('GITHUB_TOKEN and GITHUB_REPOSITORY are required')

  const res = await fetch(`https://api.github.com/repos/${repo}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  })

  if (!res.ok) {
    const txt = await res.text()
    throw new Error(`GitHub API ${method} ${path} failed: ${res.status} ${txt}`)
  }

  return res.json()
}

async function runHeadShaGate() {
  const pr = process.env.PR_NUMBER
  const headSha = process.env.HEAD_SHA
  const required = (process.env.REQUIRED_REVIEW_CHECKS || 'Code Review Agent')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)

  if (!pr || !headSha) throw new Error('PR_NUMBER and HEAD_SHA are required')

  const checkRuns = await githubRequest(`/commits/${headSha}/check-runs`)
  const failing = computeMissingOrFailingRequiredChecks(required, checkRuns.check_runs || [])

  if (failing.length > 0) {
    console.error(`Missing/failing required review checks on current HEAD (${headSha}): ${failing.join(', ')}`)
    process.exit(1)
  }

  console.log('head-sha-review-gate=pass')
}

async function runRerunComment() {
  const pr = process.env.PR_NUMBER
  const headSha = process.env.HEAD_SHA
  if (!pr || !headSha) throw new Error('PR_NUMBER and HEAD_SHA are required')

  const marker = '<!-- review-agent-auto-rerun -->'
  const comments = await githubRequest(`/issues/${pr}/comments?per_page=100`)

  if (!shouldPostRerunComment(comments, headSha, marker)) {
    console.log('rerun-comment=already-posted')
    return
  }

  const body = `${marker}\n@review-agent please re-review\nsha:${headSha}`
  await githubRequest(`/issues/${pr}/comments`, 'POST', { body })
  console.log('rerun-comment=posted')
}

async function runResolveBotThreads() {
  const repo = process.env.GITHUB_REPOSITORY
  const pr = process.env.PR_NUMBER
  const botLogins = (process.env.REVIEW_BOT_LOGINS || 'review-bot')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)

  if (!repo || !pr) throw new Error('GITHUB_REPOSITORY and PR_NUMBER are required')

  const [owner, name] = repo.split('/')
  const token = process.env.GITHUB_TOKEN
  const query = `
    query($owner:String!, $name:String!, $number:Int!) {
      repository(owner:$owner, name:$name) {
        pullRequest(number:$number) {
          reviewThreads(first:100) {
            nodes {
              id
              isResolved
              comments(first:100) { nodes { author { login } } }
            }
          }
        }
      }
    }
  `

  const graph = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query, variables: { owner, name, number: Number(pr) } }),
  }).then((r) => r.json())

  const threads = graph?.data?.repository?.pullRequest?.reviewThreads?.nodes ?? []
  const ids = selectResolvableBotOnlyThreadIds(threads, botLogins)

  for (const id of ids) {
    const mutation = `mutation($threadId:ID!){ resolveReviewThread(input:{threadId:$threadId}) { thread { id isResolved } } }`
    await fetch('https://api.github.com/graphql', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: mutation, variables: { threadId: id } }),
    })
  }

  console.log(`resolved_threads=${ids.length}`)
}

async function main() {
  const mode = process.argv[2]
  if (mode === 'head-sha-gate') return runHeadShaGate()
  if (mode === 'post-rerun-comment') return runRerunComment()
  if (mode === 'resolve-bot-threads') return runResolveBotThreads()
  throw new Error('Usage: node scripts/review-control-plane.mjs <head-sha-gate|post-rerun-comment|resolve-bot-threads>')
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(err.message)
    process.exit(1)
  })
}
