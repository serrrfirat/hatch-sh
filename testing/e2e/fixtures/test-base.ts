import { test as base } from '@playwright/test'
import {
  AppShell,
  IdeaMaze,
  DesignMode,
  SkillsMarketplace,
  SettingsPage,
  RepositoryOnboarding,
} from './page-objects'

/**
 * Extended test fixtures with page objects and automatic storage cleanup.
 */
export const test = base.extend<{
  shell: AppShell
  ideaMaze: IdeaMaze
  designMode: DesignMode
  skillsMarketplace: SkillsMarketplace
  settingsPage: SettingsPage
  repositoryOnboarding: RepositoryOnboarding
}>({
  // Auto-clear storage before each test
  page: async ({ page }, use) => {
    await page.goto('/')
    await page.evaluate(() => {
      localStorage.clear()
      sessionStorage.clear()
    })
    await page.reload()
    await use(page)
  },
  shell: async ({ page }, use) => {
    await use(new AppShell(page))
  },
  ideaMaze: async ({ page }, use) => {
    await use(new IdeaMaze(page))
  },
  designMode: async ({ page }, use) => {
    await use(new DesignMode(page))
  },
  skillsMarketplace: async ({ page }, use) => {
    await use(new SkillsMarketplace(page))
  },
  settingsPage: async ({ page }, use) => {
    await use(new SettingsPage(page))
  },
  repositoryOnboarding: async ({ page }, use) => {
    await use(new RepositoryOnboarding(page))
  },
})

export { expect } from '@playwright/test'
