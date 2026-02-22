import { test, expect } from './fixtures/test-base'

test.describe('Idea Maze critical flow', () => {
  test('opens Idea Maze and handles non-Tauri runtime failure path', async ({ ideaMaze }) => {
    await ideaMaze.open()

    await expect(ideaMaze.failedHeading).toBeVisible()
    await expect(ideaMaze.retryButton).toBeVisible()
  })

  test('canvas container renders after navigating to Idea Maze', async ({ ideaMaze, page }) => {
    await ideaMaze.open()
    // The page should have rendered the Idea Maze section (even if in error state outside Tauri)
    await expect(page.locator('[data-testid="idea-maze-container"]').or(ideaMaze.failedHeading)).toBeVisible()
  })

  test('retry button is clickable and does not crash', async ({ ideaMaze }) => {
    await ideaMaze.open()
    await expect(ideaMaze.retryButton).toBeVisible()
    await ideaMaze.retryButton.click()
    // Should still show error state (not Tauri) but not crash
    await expect(ideaMaze.failedHeading).toBeVisible()
  })
})
