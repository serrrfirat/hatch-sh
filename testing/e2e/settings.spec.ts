import { test, expect } from './fixtures/test-base'

test.describe('Settings critical flow', () => {
  test('navigates to Settings and switches tabs', async ({ settingsPage, page }) => {
    await settingsPage.open()

    await expect(settingsPage.heading).toBeVisible()

    await settingsPage.gitTab.click()
    await expect(page.getByText('Branch name prefix')).toBeVisible()
    await expect(page.getByText('GitHub username (serrrfirat)')).toBeVisible()

    await settingsPage.agentsTab.click()
    await expect(page.getByRole('heading', { name: 'Claude Code' })).toBeVisible()
    await expect(page.getByText('Open-source AI coding agent with ACP protocol')).toBeVisible()
  })
})
