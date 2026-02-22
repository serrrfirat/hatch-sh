import { test, expect } from './fixtures/test-base'

test.describe('Design mode critical flow', () => {
  test('switches into Design mode without shell regression', async ({ designMode, shell }) => {
    await designMode.open()

    await expect(shell.designTab).toBeVisible()
    await expect(shell.buildTab).toBeVisible()
  })

  test('design container renders after switching to Design tab', async ({ designMode, page }) => {
    await designMode.open()
    // Design page should render its content area
    await expect(page.locator('main').first()).toBeVisible()
  })

  test('nav arrows are active on Design tab', async ({ designMode, page }) => {
    await designMode.open()
    // The back/forward navigation arrows should be interactive on the Design page
    const backButton = page.getByTitle('Go back')
    await expect(backButton).toBeVisible()
  })

  test('tab switching preserves shell state', async ({ designMode, shell }) => {
    await designMode.open()
    await expect(shell.designTab).toBeVisible()

    // Switch to Build and back
    await shell.navigateTo('build')
    await expect(shell.buildTab).toBeVisible()

    await shell.navigateTo('design')
    await expect(shell.designTab).toBeVisible()
  })
})
