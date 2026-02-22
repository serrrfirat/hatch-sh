import { test, expect } from './fixtures/test-base'

test.describe('Desktop shell critical flow', () => {
  test('loads Build workspace shell and onboarding state', async ({ shell, repositoryOnboarding }) => {
    await expect(shell.buildTab).toBeVisible()
    await expect(shell.designTab).toBeVisible()
    await expect(shell.ideaMazeTab).toBeVisible()
    await expect(shell.skillsTab).toBeVisible()

    await expect(shell.branchInfo).toBeVisible()
    await expect(repositoryOnboarding.addRepoButton).toBeVisible()
    await expect(repositoryOnboarding.openProjectButton).toBeVisible()
  })
})
