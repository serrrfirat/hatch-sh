import { Hono } from 'hono'
import { z } from 'zod'
import { zValidator } from '@hono/zod-validator'

const SKILLSMP_API_URL = 'https://skillsmp.com/api/v1'
// Primary data source - claude-code-templates project
const AITMPL_COMPONENTS_URL = 'https://www.aitmpl.com/components.json'

// aitmpl.com component types
interface AitmplComponent {
  name: string
  path: string
  category: string
  type: string
  content: string
  description?: string
}

// Cached aitmpl data
let aitmplCache: {
  skills: Skill[]
  agents: Skill[]
  commands: Skill[]
  all: Skill[]
  lastFetched: number
} | null = null

const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

// Transform aitmpl component to our Skill format
function normalizeAitmplComponent(component: AitmplComponent, index: number): Skill {
  // Extract description from content frontmatter if not provided
  let description = component.description || ''
  if (!description && component.content) {
    const descMatch = component.content.match(/description:\s*([^\n]+)/)
    if (descMatch) {
      description = descMatch[1].trim()
    }
  }

  // Extract name from frontmatter or use file name
  let name = component.name
  if (component.content) {
    const nameMatch = component.content.match(/name:\s*([^\n]+)/)
    if (nameMatch) {
      name = nameMatch[1].trim()
    }
  }

  // Build install command
  const installPath = component.path.replace('.md', '').replace(/\//g, '/')
  const installCommand = `npx claude-code-templates@latest --${component.type} ${component.category}/${component.name} --yes`

  return {
    id: `aitmpl-${component.type}-${component.name}`,
    name,
    description: description.slice(0, 500),
    author: 'claude-code-templates',
    categories: [component.category, component.type],
    githubUrl: `https://github.com/davila7/claude-code-templates/blob/main/cli-tool/components/${component.path}`,
    stars: 16366, // Main repo stars
    installCommand,
    repoPath: `davila7/claude-code-templates/${component.path}`,
    trending: false,
    featured: component.category === 'development' || component.category === 'security',
  }
}

// Fetch and cache aitmpl components
async function fetchAitmplComponents(): Promise<typeof aitmplCache> {
  // Return cached if fresh
  if (aitmplCache && Date.now() - aitmplCache.lastFetched < CACHE_TTL) {
    return aitmplCache
  }

  try {
    const response = await fetch(AITMPL_COMPONENTS_URL, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'vibed.fun/1.0',
      },
    })

    if (!response.ok) {
      console.error('Failed to fetch aitmpl components:', response.status)
      return aitmplCache
    }

    const data = await response.json()

    // Transform all component types
    const skills = (data.skills || []).map((c: AitmplComponent, i: number) =>
      normalizeAitmplComponent({ ...c, type: 'skill' }, i)
    )
    const agents = (data.agents || []).map((c: AitmplComponent, i: number) =>
      normalizeAitmplComponent({ ...c, type: 'agent' }, i)
    )
    const commands = (data.commands || []).map((c: AitmplComponent, i: number) =>
      normalizeAitmplComponent({ ...c, type: 'command' }, i)
    )

    // Combine all for unified search
    const all = [...skills, ...agents, ...commands]

    aitmplCache = {
      skills,
      agents,
      commands,
      all,
      lastFetched: Date.now(),
    }

    console.log(`Fetched ${all.length} components from aitmpl.com (${skills.length} skills, ${agents.length} agents, ${commands.length} commands)`)
    return aitmplCache
  } catch (error) {
    console.error('Error fetching aitmpl components:', error)
    return aitmplCache
  }
}


// Browser-like headers to help bypass WAF
const BROWSER_HEADERS = {
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9',
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Referer': 'https://skillsmp.com/',
  'Origin': 'https://skillsmp.com',
}

// SkillsMP API response types (based on their API structure)
interface SkillsmpSkill {
  id?: string
  name: string
  description: string
  author?: string
  owner?: string
  repo?: string
  repoPath?: string
  githubUrl?: string
  github_url?: string
  url?: string
  categories?: string[]
  tags?: string[]
  stars?: number
  stargazers_count?: number
  trending?: boolean
  featured?: boolean
}

// GitHub API response types
interface GitHubRepo {
  id: number
  name: string
  full_name: string
  description: string | null
  html_url: string
  stargazers_count: number
  owner: {
    login: string
  }
  topics?: string[]
}

// Our normalized skill type
interface Skill {
  id: string
  name: string
  description: string
  author: string
  categories: string[]
  githubUrl: string
  stars: number
  installCommand: string
  repoPath?: string
  trending?: boolean
  featured?: boolean
}

// Transform SkillsMP skill to our format
function normalizeSkill(skill: SkillsmpSkill, index: number): Skill {
  const author = skill.author || skill.owner || 'unknown'
  const name = skill.name || `skill-${index}`
  const repoPath = skill.repoPath || skill.repo || `${author}/${name}`

  // Build GitHub URL from available data
  let githubUrl = skill.githubUrl || skill.github_url || skill.url || ''
  if (!githubUrl && repoPath) {
    githubUrl = `https://github.com/${repoPath}`
  }

  return {
    id: skill.id || `${author}-${name}-${index}`,
    name,
    description: skill.description || '',
    author,
    categories: skill.categories || skill.tags || [],
    githubUrl,
    stars: skill.stars || skill.stargazers_count || 0,
    installCommand: `claude skill install ${repoPath}`,
    repoPath,
    trending: skill.trending,
    featured: skill.featured,
  }
}

// Transform GitHub repo to our skill format
function normalizeGitHubRepo(repo: GitHubRepo, index: number): Skill {
  // Infer categories from topics and name
  const categories: string[] = repo.topics || []
  if (repo.name.includes('test') || repo.description?.toLowerCase().includes('test')) {
    if (!categories.includes('testing')) categories.push('testing')
  }
  if (repo.name.includes('doc') || repo.description?.toLowerCase().includes('document')) {
    if (!categories.includes('documentation')) categories.push('documentation')
  }
  if (repo.name.includes('git') || repo.description?.toLowerCase().includes('git')) {
    if (!categories.includes('git')) categories.push('git')
  }
  if (repo.name.includes('api') || repo.description?.toLowerCase().includes('api')) {
    if (!categories.includes('api-backend')) categories.push('api-backend')
  }
  if (repo.description?.toLowerCase().includes('security') || repo.description?.toLowerCase().includes('pentest')) {
    if (!categories.includes('security')) categories.push('security')
  }
  if (repo.description?.toLowerCase().includes('ai') || repo.description?.toLowerCase().includes('claude')) {
    if (!categories.includes('ai')) categories.push('ai')
  }
  if (categories.length === 0) categories.push('development')

  return {
    id: `github-${repo.id}`,
    name: repo.name,
    description: repo.description || 'Claude Code skill',
    author: repo.owner.login,
    categories,
    githubUrl: repo.html_url,
    stars: repo.stargazers_count,
    installCommand: `claude skill install ${repo.full_name}`,
    repoPath: repo.full_name,
    trending: repo.stargazers_count > 5000,
    featured: repo.stargazers_count > 10000,
  }
}

// GitHub Code Search result type
interface GitHubCodeSearchResult {
  repository: {
    id: number
    name: string
    full_name: string
    description: string | null
    html_url: string
    stargazers_count: number
    owner: {
      login: string
    }
    topics?: string[]
  }
  path: string
}

// Fetch skills from GitHub using Code Search for SKILL.md files
async function fetchSkillsFromGitHubCodeSearch(page: number = 1, perPage: number = 100): Promise<{ skills: Skill[], total: number, hasMore: boolean }> {
  try {
    // Build headers with optional GitHub token for higher rate limits
    const headers: Record<string, string> = {
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'vibed.fun/1.0',
    }
    if (githubToken) {
      headers['Authorization'] = `Bearer ${githubToken}`
    }

    // Search for SKILL.md files - this finds actual Claude Code skills
    const response = await fetch(
      `https://api.github.com/search/code?q=filename:SKILL.md+path:/&per_page=${perPage}&page=${page}`,
      { headers }
    )

    if (!response.ok) {
      console.error('GitHub Code Search API error:', response.status)
      // Fall back to repository search
      return fetchSkillsFromGitHubRepoSearch('claude skill SKILL.md', page, perPage)
    }

    const data = await response.json()

    // Deduplicate by repo (a repo might have multiple SKILL.md files)
    const seenRepos = new Set<number>()
    const skills: Skill[] = []

    for (const item of (data.items || []) as GitHubCodeSearchResult[]) {
      if (seenRepos.has(item.repository.id)) continue
      seenRepos.add(item.repository.id)

      const repo = item.repository
      const categories: string[] = repo.topics || []

      // Infer categories from name and description
      if (repo.name.includes('test') || repo.description?.toLowerCase().includes('test')) {
        if (!categories.includes('testing')) categories.push('testing')
      }
      if (repo.name.includes('doc') || repo.description?.toLowerCase().includes('document')) {
        if (!categories.includes('documentation')) categories.push('documentation')
      }
      if (repo.name.includes('git') || repo.description?.toLowerCase().includes('git')) {
        if (!categories.includes('git')) categories.push('git')
      }
      if (repo.name.includes('api') || repo.description?.toLowerCase().includes('api')) {
        if (!categories.includes('api-backend')) categories.push('api-backend')
      }
      if (repo.description?.toLowerCase().includes('security')) {
        if (!categories.includes('security')) categories.push('security')
      }
      if (repo.description?.toLowerCase().includes('ai') || repo.description?.toLowerCase().includes('claude')) {
        if (!categories.includes('ai')) categories.push('ai')
      }
      if (categories.length === 0) categories.push('development')

      // Determine the skill path from the SKILL.md location
      const skillPath = item.path.replace('/SKILL.md', '').replace('SKILL.md', '')

      skills.push({
        id: `github-${repo.id}`,
        name: skillPath || repo.name,
        description: repo.description || 'Claude Code skill',
        author: repo.owner.login,
        categories,
        githubUrl: skillPath
          ? `${repo.html_url}/tree/main/${skillPath}`
          : repo.html_url,
        stars: repo.stargazers_count,
        installCommand: `claude skill install ${repo.full_name}${skillPath ? `/${skillPath}` : ''}`,
        repoPath: repo.full_name + (skillPath ? `/${skillPath}` : ''),
        trending: repo.stargazers_count > 100,
        featured: repo.stargazers_count > 500,
      })
    }

    return {
      skills,
      total: data.total_count || skills.length,
      hasMore: (data.items?.length || 0) === perPage && page * perPage < (data.total_count || 0),
    }
  } catch (error) {
    console.error('Failed to fetch from GitHub Code Search:', error)
    return fetchSkillsFromGitHubRepoSearch('claude skill SKILL.md', page, perPage)
  }
}

// Fallback: Fetch skills from GitHub repository search
async function fetchSkillsFromGitHubRepoSearch(query: string, page: number = 1, perPage: number = 100): Promise<{ skills: Skill[], total: number, hasMore: boolean }> {
  try {
    // Build headers with optional GitHub token for higher rate limits
    const headers: Record<string, string> = {
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'vibed.fun/1.0',
    }
    if (githubToken) {
      headers['Authorization'] = `Bearer ${githubToken}`
    }

    const response = await fetch(
      `https://api.github.com/search/repositories?q=${encodeURIComponent(query)}&per_page=${perPage}&page=${page}&sort=stars&order=desc`,
      { headers }
    )

    if (!response.ok) {
      console.error('GitHub API error:', response.status)
      return { skills: [], total: 0, hasMore: false }
    }

    const data = await response.json()
    const skills = (data.items || []).map((repo: GitHubRepo, index: number) => normalizeGitHubRepo(repo, index))

    return {
      skills,
      total: data.total_count || skills.length,
      hasMore: data.items?.length === perPage && page * perPage < (data.total_count || 0),
    }
  } catch (error) {
    console.error('Failed to fetch from GitHub:', error)
    return { skills: [], total: 0, hasMore: false }
  }
}

// Main GitHub fetch function - tries code search first, then falls back to repo search
async function fetchSkillsFromGitHub(query: string, page: number = 1, perPage: number = 100): Promise<{ skills: Skill[], total: number, hasMore: boolean }> {
  // If it's the default query, use code search for SKILL.md files
  if (query === 'claude skill' || !query) {
    return fetchSkillsFromGitHubCodeSearch(page, perPage)
  }
  // For specific queries, use repository search
  return fetchSkillsFromGitHubRepoSearch(query, page, perPage)
}

type Bindings = {
  SKILLSMP_API_KEY?: string
  GITHUB_TOKEN?: string
}

// Store the GitHub token for use in helper functions
let githubToken: string | undefined

const skillsmpRouter = new Hono<{ Bindings: Bindings }>()

// List skills with optional category filter and pagination support
skillsmpRouter.get('/skills', async (c) => {
  const category = c.req.query('category')
  const page = c.req.query('page') || '1'
  const limit = c.req.query('limit') || '100' // Increased default
  const nextPageToken = c.req.query('next_page') // Token-based pagination
  const fetchAll = c.req.query('fetch_all') === 'true' // Fetch all pages
  const forceRefresh = c.req.query('refresh') === 'true' // Force bypass cache

  // Set GitHub token for use in helper functions
  githubToken = c.env.GITHUB_TOKEN

  // Primary source: aitmpl.com components.json
  try {
    const pageNum = parseInt(page)
    const limitNum = parseInt(limit)
    const aitmpl = await fetchAitmplComponents()

    if (aitmpl && aitmpl.all.length > 0) {
      let filtered = aitmpl.all

      // Filter by category if specified
      if (category) {
        const cat = category.toLowerCase()
        filtered = filtered.filter(s =>
          s.categories.some(c => c.toLowerCase().includes(cat))
        )
      }

      // Paginate
      const start = (pageNum - 1) * limitNum
      const end = start + limitNum
      const paginated = filtered.slice(start, end)

      return c.json({
        skills: paginated,
        total: filtered.length,
        page: pageNum,
        limit: limitNum,
        has_more: end < filtered.length,
        source: 'aitmpl',
      })
    }
  } catch (aitmplError) {
    console.error('aitmpl fetch failed:', aitmplError)
  }

  // Fallback to SkillsMP API (usually blocked)
  try {
    // Use browser-like headers to help bypass WAF
    const headers: Record<string, string> = { ...BROWSER_HEADERS }

    // Add API key if available
    if (c.env.SKILLSMP_API_KEY) {
      headers['Authorization'] = `Bearer ${c.env.SKILLSMP_API_KEY}`
    }

    // If fetching all pages, aggregate results
    if (fetchAll) {
      const allSkills: Skill[] = []
      let currentPageToken: string | undefined = nextPageToken || undefined
      let hasMore = true
      let pageCount = 0
      const maxPages = 1000 // Safety limit for 60k+ skills

      while (hasMore && pageCount < maxPages) {
        const params = new URLSearchParams()
        if (category) params.set('category', category)
        params.set('limit', '100') // Max per request
        if (currentPageToken) params.set('next_page', currentPageToken)

        const response = await fetch(`${SKILLSMP_API_URL}/skills?${params}`, { headers })

        if (!response.ok) {
          console.error(`SkillsMP API error on page ${pageCount}:`, response.status)
          break
        }

        const data = await response.json()
        const skills = Array.isArray(data)
          ? data.map(normalizeSkill)
          : (data.skills || data.data || []).map(normalizeSkill)

        allSkills.push(...skills)
        hasMore = data.has_more === true
        currentPageToken = data.next_page
        pageCount++

        // Break if no more data
        if (skills.length === 0) break

        // Small delay to avoid rate limiting
        if (hasMore) {
          await new Promise(resolve => setTimeout(resolve, 100))
        }
      }

      return c.json({
        skills: allSkills,
        total: allSkills.length,
        complete: !hasMore,
        pages_fetched: pageCount,
      })
    }

    // Single page fetch with pagination support
    const params = new URLSearchParams()
    if (category) params.set('category', category)
    params.set('limit', limit)
    if (nextPageToken) {
      params.set('next_page', nextPageToken)
    } else {
      params.set('page', page)
    }

    const response = await fetch(`${SKILLSMP_API_URL}/skills?${params}`, { headers })

    if (!response.ok) {
      // Try without auth if it fails
      const fallbackResponse = await fetch(`${SKILLSMP_API_URL}/skills?${params}`, {
        headers: BROWSER_HEADERS,
      })

      if (!fallbackResponse.ok) {
        // SkillsMP failed, use GitHub as fallback
        console.log('SkillsMP unavailable, falling back to GitHub search')
        const pageNum = parseInt(page)
        const limitNum = parseInt(limit)

        // Search for Claude skill repos on GitHub
        const githubResult = await fetchSkillsFromGitHub(
          'claude skill',
          pageNum,
          limitNum
        )

        return c.json({
          skills: githubResult.skills,
          total: githubResult.total,
          page: pageNum,
          limit: limitNum,
          has_more: githubResult.hasMore,
          source: 'github',
        })
      }

      const data = await fallbackResponse.json()
      const skills = Array.isArray(data)
        ? data.map(normalizeSkill)
        : (data.skills || data.data || []).map(normalizeSkill)

      return c.json({
        skills,
        total: data.total || skills.length,
        has_more: data.has_more || false,
        next_page: data.next_page,
      })
    }

    const data = await response.json()
    const skills = Array.isArray(data)
      ? data.map(normalizeSkill)
      : (data.skills || data.data || []).map(normalizeSkill)

    return c.json({
      skills,
      total: data.total || skills.length,
      page: parseInt(page),
      limit: parseInt(limit),
      has_more: data.has_more || false,
      next_page: data.next_page,
    })
  } catch (error) {
    console.error('Failed to fetch skills from SkillsMP:', error)

    // Final fallback to GitHub
    try {
      console.log('Using GitHub fallback due to error')
      const pageNum = parseInt(page)
      const limitNum = parseInt(limit)
      const githubResult = await fetchSkillsFromGitHub(
        'claude skill',
        pageNum,
        limitNum
      )

      return c.json({
        skills: githubResult.skills,
        total: githubResult.total,
        page: pageNum,
        limit: limitNum,
        has_more: githubResult.hasMore,
        source: 'github',
      })
    } catch {
      return c.json({
        skills: [],
        error: 'Failed to fetch skills'
      }, 200)
    }
  }
})

// Semantic search
skillsmpRouter.get(
  '/skills/search',
  zValidator('query', z.object({
    q: z.string().min(1),
  })),
  async (c) => {
    const { q } = c.req.valid('query')

    // Set GitHub token for use in helper functions
    githubToken = c.env.GITHUB_TOKEN

    // Primary source: aitmpl.com
    try {
      const aitmpl = await fetchAitmplComponents()
      if (aitmpl && aitmpl.all.length > 0) {
        const query = q.toLowerCase()
        const filtered = aitmpl.all.filter(s =>
          s.name.toLowerCase().includes(query) ||
          s.description.toLowerCase().includes(query) ||
          s.categories.some(c => c.toLowerCase().includes(query))
        )

        if (filtered.length > 0) {
          return c.json({
            skills: filtered.slice(0, 50),
            query: q,
            total: filtered.length,
            source: 'aitmpl',
          })
        }
      }
    } catch (aitmplError) {
      console.error('aitmpl search failed:', aitmplError)
    }

    return c.json({
      skills: [],
      query: q,
      error: 'No skills found'
    }, 200)
  }
)

// Get categories
skillsmpRouter.get('/categories', async (c) => {
  // Primary source: aitmpl.com
  try {
    const aitmpl = await fetchAitmplComponents()
    if (aitmpl && aitmpl.all.length > 0) {
      const categoryCounts = new Map<string, number>()

      for (const skill of aitmpl.all) {
        for (const cat of skill.categories) {
          const normalized = cat.toLowerCase().trim()
          categoryCounts.set(normalized, (categoryCounts.get(normalized) || 0) + 1)
        }
      }

      // Sort by count and convert to array
      const categories = Array.from(categoryCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 50)
        .map(([id, count]) => ({
          id,
          label: id.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' '),
          count,
        }))

      return c.json({ categories, source: 'aitmpl' })
    }
  } catch (aitmplError) {
    console.error('aitmpl categories failed:', aitmplError)
  }

  // Fallback: static categories
  try {
    // Use browser-like headers
    const headers: Record<string, string> = { ...BROWSER_HEADERS }

    if (c.env.SKILLSMP_API_KEY) {
      headers['Authorization'] = `Bearer ${c.env.SKILLSMP_API_KEY}`
    }

    const response = await fetch(`${SKILLSMP_API_URL}/categories`, { headers })

    if (!response.ok) {
      // Return common categories as fallback
      return c.json({
        categories: [
          { id: 'documentation', label: 'Documentation', count: 0 },
          { id: 'testing', label: 'Testing', count: 0 },
          { id: 'git', label: 'Git', count: 0 },
          { id: 'api-backend', label: 'API & Backend', count: 0 },
          { id: 'frontend', label: 'Frontend', count: 0 },
          { id: 'database', label: 'Database', count: 0 },
          { id: 'devops', label: 'DevOps', count: 0 },
          { id: 'security', label: 'Security', count: 0 },
          { id: 'ai', label: 'AI', count: 0 },
          { id: 'productivity', label: 'Productivity', count: 0 },
        ],
      })
    }

    const data = await response.json()
    return c.json({ categories: data.categories || data })
  } catch (error) {
    console.error('Failed to fetch categories:', error)
    return c.json({
      categories: [],
      error: 'Failed to fetch categories',
    }, 200)
  }
})

// Get single skill details
skillsmpRouter.get('/skills/:id', async (c) => {
  const id = c.req.param('id')

  // Primary source: aitmpl.com
  try {
    const aitmpl = await fetchAitmplComponents()
    if (aitmpl) {
      const skill = aitmpl.all.find(s =>
        s.id === id ||
        s.name.toLowerCase() === id.toLowerCase() ||
        s.repoPath?.includes(id)
      )
      if (skill) {
        return c.json({ skill, source: 'aitmpl' })
      }
    }
  } catch (aitmplError) {
    console.error('aitmpl skill lookup failed:', aitmplError)
  }

  // Fallback to SkillsMP (usually blocked)
  try {
    // Use browser-like headers
    const headers: Record<string, string> = { ...BROWSER_HEADERS }

    if (c.env.SKILLSMP_API_KEY) {
      headers['Authorization'] = `Bearer ${c.env.SKILLSMP_API_KEY}`
    }

    const response = await fetch(`${SKILLSMP_API_URL}/skills/${id}`, { headers })

    if (!response.ok) {
      return c.json({ error: 'Skill not found' }, 404)
    }

    const data = await response.json()
    const skill = normalizeSkill(data, 0)

    return c.json({ skill })
  } catch (error) {
    console.error('Failed to fetch skill:', error)
    return c.json({ error: 'Failed to fetch skill' }, 500)
  }
})

// Fetch skill content from GitHub (for installation)
skillsmpRouter.get('/skills/:owner/:repo/content', async (c) => {
  const owner = c.req.param('owner')
  const repo = c.req.param('repo')
  const path = c.req.query('path') || ''

  try {
    // Fetch from GitHub raw content
    const branch = 'main'
    const basePath = path || ''

    // First try to get the directory listing via GitHub API
    const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${basePath}?ref=${branch}`

    const response = await fetch(apiUrl, {
      headers: {
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'vibed.fun/1.0',
      },
    })

    if (!response.ok) {
      // Try master branch
      const masterResponse = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/contents/${basePath}?ref=master`,
        {
          headers: {
            'Accept': 'application/vnd.github.v3+json',
            'User-Agent': 'vibed.fun/1.0',
          },
        }
      )

      if (!masterResponse.ok) {
        return c.json({ error: 'Repository not found or inaccessible' }, 404)
      }

      const data = await masterResponse.json()
      return c.json({ files: data, branch: 'master' })
    }

    const data = await response.json()
    return c.json({ files: data, branch: 'main' })
  } catch (error) {
    console.error('Failed to fetch skill content:', error)
    return c.json({ error: 'Failed to fetch skill content' }, 500)
  }
})

// Get cache status
skillsmpRouter.get('/cache/status', async (c) => {
  const cached = aitmplCache

  if (!cached) {
    return c.json({
      hasCache: false,
      message: 'No cached data. Will fetch from aitmpl.com on first request.',
    })
  }

  // Calculate category distribution
  const categoryCounts = new Map<string, number>()
  for (const skill of cached.all) {
    for (const cat of skill.categories) {
      categoryCounts.set(cat, (categoryCounts.get(cat) || 0) + 1)
    }
  }

  const topCategories = Array.from(categoryCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([name, count]) => ({ name, count }))

  return c.json({
    hasCache: true,
    total: cached.all.length,
    skills: cached.skills.length,
    agents: cached.agents.length,
    commands: cached.commands.length,
    lastFetched: new Date(cached.lastFetched).toISOString(),
    topCategories,
    source: 'aitmpl.com',
  })
})

// Clear cache (force reload on next request)
skillsmpRouter.post('/cache/clear', async (c) => {
  aitmplCache = null
  return c.json({ message: 'Cache cleared. Will reload from aitmpl.com on next request.' })
})

export { skillsmpRouter }
