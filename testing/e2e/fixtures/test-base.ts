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
  // Auto-clear storage before each test, then mark onboarding complete
  // so the app renders the main shell instead of the OnboardingWizard.
  page: async ({ page }, use) => {
    await page.goto('/')
    await page.evaluate(() => {
      localStorage.clear()
      sessionStorage.clear()

      // The Layout component gates on hasCompletedOnboarding from the
      // Zustand "hatch-settings" persisted store OR a standalone
      // localStorage key. We set both to robustly bypass onboarding.
      const persisted = { state: { hasCompletedOnboarding: true }, version: 0 }
      localStorage.setItem('hatch-settings', JSON.stringify(persisted))
      localStorage.setItem('hatch-onboarding-done', '1')
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
