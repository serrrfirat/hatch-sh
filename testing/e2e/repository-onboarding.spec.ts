import { test, expect } from './fixtures/test-base'

test.describe('Repository onboarding critical flow', () => {
  test('opens clone onboarding modal', async ({ repositoryOnboarding, page }) => {
    await repositoryOnboarding.cloneButton.click()
    await expect(page.getByPlaceholder('https://github.com/owner/repo')).toBeVisible()
  })

  test('opens quick-start onboarding modal', async ({ repositoryOnboarding, page }) => {
    await repositoryOnboarding.quickStartButton.click()
    await expect(page.getByRole('heading', { name: 'Create new repository' })).toBeVisible()
    await expect(page.getByPlaceholder('my-awesome-project')).toBeVisible()
  })

  test('open project button is visible and safe to click', async ({ repositoryOnboarding }) => {
    await expect(repositoryOnboarding.openProjectButton).toBeVisible()
    // Clicking should not crash (it opens a native dialog in Tauri, which is a no-op in browser)
    await repositoryOnboarding.openProjectButton.click()
  })
})
