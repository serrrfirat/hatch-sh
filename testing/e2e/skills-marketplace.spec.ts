import { test, expect } from './fixtures/test-base'

test.describe('Skills marketplace critical flow', () => {
  test('opens Skills page and shows search surface', async ({ skillsMarketplace }) => {
    await skillsMarketplace.open()
    await expect(skillsMarketplace.searchInput).toBeVisible()
  })
})
