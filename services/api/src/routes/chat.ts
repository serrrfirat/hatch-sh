import { Hono } from 'hono'
import { streamSSE } from 'hono/streaming'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { chatMessages, projects } from '../db/schema'
import { nanoid } from 'nanoid'
import Anthropic from '@anthropic-ai/sdk'
import type { Database } from '../db/client'
import { extractCodeBlocks } from '../lib/codeExtractor'

type Bindings = {
  CLAUDE_API_KEY: string
}

type Variables = {
  db: Database
}

const chatRouter = new Hono<{ Bindings: Bindings; Variables: Variables }>()

const SYSTEM_PROMPT = `You are an expert React/TypeScript developer helping users build web applications.

When generating code:
1. Create complete, working React applications
2. Use TypeScript and modern React patterns (hooks, functional components)
3. Include TailwindCSS for styling (assume it's available)
4. Keep apps self-contained in a single file when possible
5. Always export a default App component
6. Make apps visually appealing with good UX

Output format: When providing code, wrap it in a code block with the language specified.

Be concise but helpful. Focus on building what the user asks for.`

chatRouter.post(
  '/',
  zValidator('json', z.object({
    projectId: z.string(),
    message: z.string().min(1),
  })),
  async (c) => {
    const db = c.get('db')
    const { projectId, message } = c.req.valid('json')

    // Get chat history
    const history = await db
      .select()
      .from(chatMessages)
      .where(eq(chatMessages.projectId, projectId))
      .orderBy(chatMessages.createdAt)
      .all()

    // Save user message
    const userMessageId = nanoid()
    await db.insert(chatMessages).values({
      id: userMessageId,
      projectId,
      role: 'user',
      content: message,
    })

    // Build messages for Claude
    const messages = history.map(msg => ({
      role: msg.role as 'user' | 'assistant',
      content: msg.content,
    }))
    messages.push({ role: 'user', content: message })

    // Stream response
    return streamSSE(c, async (stream) => {
      const client = new Anthropic({ apiKey: c.env.CLAUDE_API_KEY })

      let fullResponse = ''

      const response = await client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        system: SYSTEM_PROMPT,
        messages,
        stream: true,
      })

      for await (const event of response) {
        if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
          const text = event.delta.text
          fullResponse += text
          await stream.writeSSE({ data: JSON.stringify({ text }) })
        }
      }

      // Save assistant response
      const assistantMessageId = nanoid()
      await db.insert(chatMessages).values({
        id: assistantMessageId,
        projectId,
        role: 'assistant',
        content: fullResponse,
      })

      // Extract and save code to project
      const codeBlocks = extractCodeBlocks(fullResponse)
      if (codeBlocks.length > 0) {
        const codeFiles: Record<string, string> = {}
        for (const block of codeBlocks) {
          codeFiles[block.filePath] = block.content
        }
        await db.update(projects)
          .set({ code: JSON.stringify(codeFiles), updatedAt: new Date() })
          .where(eq(projects.id, projectId))
      }

      await stream.writeSSE({ data: JSON.stringify({ done: true }) })
    })
  }
)

// Get chat history
chatRouter.get('/:projectId', async (c) => {
  const db = c.get('db')
  const projectId = c.req.param('projectId')

  const history = await db
    .select()
    .from(chatMessages)
    .where(eq(chatMessages.projectId, projectId))
    .orderBy(chatMessages.createdAt)
    .all()

  return c.json(history)
})

export { chatRouter }
