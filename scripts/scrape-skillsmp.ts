/**
 * SkillsMP Scraper
 *
 * Uses Playwright to scrape skills from SkillsMP.com
 * Bypasses Cloudflare WAF by using a real browser
 *
 * Run with: npx tsx scripts/scrape-skillsmp.ts
 */

import { chromium, type Page } from 'playwright'
import * as fs from 'fs'
import * as path from 'path'

interface Skill {
  id: string
  name: string
  description: string
  author: string
  categories: string[]
  githubUrl: string
  stars: number
  installCommand: string
  repoPath: string
  trending?: boolean
  featured?: boolean
}

const OUTPUT_FILE = path.join(__dirname, '../services/api/data/skills.json')

async function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function scrapeSkillsFromPage(page: Page): Promise<Skill[]> {
  const skills: Skill[] = []

  // Wait for skills to load
  await page.waitForSelector('[data-testid="skill-card"], .skill-card, article', { timeout: 10000 }).catch(() => {})

  // Extract skills from the page
  const skillElements = await page.$$('[data-testid="skill-card"], .skill-card, article a[href*="/skills/"]')

  for (const element of skillElements) {
    try {
      const href = await element.getAttribute('href')
      if (!href || !href.includes('/skills/')) continue

      // Extract skill ID from URL
      const skillId = href.split('/skills/').pop()?.split('?')[0] || ''
      if (!skillId) continue

      // Get text content
      const text = await element.textContent() || ''

      // Try to get more details
      const name = skillId.split('-').pop() || skillId
      const description = text.substring(0, 200)

      skills.push({
        id: `skillsmp-${skillId}`,
        name,
        description,
        author: 'unknown',
        categories: ['development'],
        githubUrl: '',
        stars: 0,
        installCommand: `claude skill install ${skillId}`,
        repoPath: skillId,
      })
    } catch (e) {
      console.error('Error extracting skill:', e)
    }
  }

  return skills
}

async function scrapeSkillDetails(page: Page, skillUrl: string): Promise<Partial<Skill> | null> {
  try {
    await page.goto(skillUrl, { waitUntil: 'networkidle', timeout: 30000 })
    await delay(1000)

    // Extract details from the skill page
    const details: Partial<Skill> = {}

    // Try to get GitHub URL
    const githubLink = await page.$('a[href*="github.com"]')
    if (githubLink) {
      details.githubUrl = await githubLink.getAttribute('href') || ''

      // Extract repo path from GitHub URL
      const match = details.githubUrl.match(/github\.com\/([^\/]+\/[^\/]+)/)
      if (match) {
        details.repoPath = match[1]
        details.author = match[1].split('/')[0]
      }
    }

    // Try to get description
    const descElement = await page.$('meta[name="description"]')
    if (descElement) {
      details.description = await descElement.getAttribute('content') || ''
    }

    // Try to get stars
    const starsElement = await page.$('[data-testid="stars"], .stars')
    if (starsElement) {
      const starsText = await starsElement.textContent() || '0'
      details.stars = parseInt(starsText.replace(/[^0-9]/g, '')) || 0
    }

    // Try to get categories
    const categoryElements = await page.$$('[data-testid="category"], .category, .tag')
    if (categoryElements.length > 0) {
      details.categories = []
      for (const cat of categoryElements) {
        const catText = await cat.textContent()
        if (catText) {
          details.categories.push(catText.toLowerCase().trim())
        }
      }
    }

    return details
  } catch (e) {
    console.error(`Error scraping ${skillUrl}:`, e)
    return null
  }
}

async function scrapeAllSkills() {
  console.log('Starting SkillsMP scraper...')

  const browser = await chromium.launch({
    headless: false, // Use headed mode to handle Cloudflare challenges
  })

  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  })

  const page = await context.newPage()

  const allSkills: Skill[] = []
  const seenIds = new Set<string>()

  try {
    // Start at the main page
    console.log('Navigating to SkillsMP...')
    await page.goto('https://skillsmp.com/', { waitUntil: 'networkidle', timeout: 60000 })

    // Wait for Cloudflare challenge if present
    await delay(5000)

    // Check if we passed Cloudflare
    const title = await page.title()
    console.log('Page title:', title)

    if (title.includes('Attention Required') || title.includes('Cloudflare')) {
      console.log('Cloudflare challenge detected. Please solve it manually in the browser window.')
      console.log('Waiting 30 seconds for manual intervention...')
      await delay(30000)
    }

    // Get all category links
    console.log('Getting categories...')
    const categoryLinks = await page.$$('a[href*="/categories/"]')
    const categories: string[] = []

    for (const link of categoryLinks) {
      const href = await link.getAttribute('href')
      if (href && !categories.includes(href)) {
        categories.push(href)
      }
    }

    console.log(`Found ${categories.length} categories`)

    // Scrape each category page
    for (const categoryUrl of categories.slice(0, 50)) { // Limit to first 50 categories
      const fullUrl = categoryUrl.startsWith('http') ? categoryUrl : `https://skillsmp.com${categoryUrl}`
      console.log(`Scraping category: ${fullUrl}`)

      try {
        await page.goto(fullUrl, { waitUntil: 'networkidle', timeout: 30000 })
        await delay(2000)

        // Scroll to load more skills
        for (let i = 0; i < 5; i++) {
          await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
          await delay(1000)
        }

        // Get all skill links on this page
        const skillLinks = await page.$$('a[href*="/skills/"]')

        for (const link of skillLinks) {
          const href = await link.getAttribute('href')
          if (!href || !href.includes('/skills/')) continue

          const skillId = href.split('/skills/').pop()?.split('?')[0] || ''
          if (!skillId || seenIds.has(skillId)) continue
          seenIds.add(skillId)

          // Get skill name from link text
          const name = await link.textContent() || skillId

          // Create basic skill entry
          const skill: Skill = {
            id: `skillsmp-${skillId}`,
            name: name.trim().substring(0, 100),
            description: '',
            author: 'unknown',
            categories: [categoryUrl.split('/categories/').pop() || 'development'],
            githubUrl: '',
            stars: 0,
            installCommand: `claude skill install ${skillId}`,
            repoPath: skillId,
          }

          allSkills.push(skill)
        }

        console.log(`Total skills collected: ${allSkills.length}`)

        // Save progress periodically
        if (allSkills.length % 100 === 0) {
          await saveSkills(allSkills)
        }

      } catch (e) {
        console.error(`Error scraping category ${categoryUrl}:`, e)
      }
    }

    // Now scrape details for each skill (optional - takes much longer)
    console.log('\nScraping skill details...')
    for (let i = 0; i < Math.min(allSkills.length, 500); i++) { // Limit to first 500 for details
      const skill = allSkills[i]
      const skillUrl = `https://skillsmp.com/skills/${skill.repoPath}`

      console.log(`[${i + 1}/${Math.min(allSkills.length, 500)}] Getting details for: ${skill.name}`)

      const details = await scrapeSkillDetails(page, skillUrl)
      if (details) {
        Object.assign(skill, details)
      }

      // Rate limiting
      await delay(500)

      // Save progress
      if (i % 50 === 0) {
        await saveSkills(allSkills)
      }
    }

  } finally {
    await saveSkills(allSkills)
    await browser.close()
  }

  console.log(`\nScraping complete! Total skills: ${allSkills.length}`)
  console.log(`Saved to: ${OUTPUT_FILE}`)
}

async function saveSkills(skills: Skill[]) {
  // Ensure directory exists
  const dir = path.dirname(OUTPUT_FILE)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }

  // Save to file
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify({
    skills,
    total: skills.length,
    lastUpdated: new Date().toISOString(),
  }, null, 2))

  console.log(`Saved ${skills.length} skills to ${OUTPUT_FILE}`)
}

// Run the scraper
scrapeAllSkills().catch(console.error)
