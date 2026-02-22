import type { Page, Locator } from '@playwright/test'

/**
 * Base page object with shared navigation and tab interactions.
 */
export class AppShell {
  readonly page: Page
  readonly buildTab: Locator
  readonly designTab: Locator
  readonly ideaMazeTab: Locator
  readonly skillsTab: Locator
  readonly settingsButton: Locator
  readonly branchInfo: Locator

  constructor(page: Page) {
    this.page = page
    this.buildTab = page.getByRole('button', { name: 'Build', exact: true })
    this.designTab = page.getByRole('button', { name: 'Design', exact: true })
    this.ideaMazeTab = page.getByRole('button', { name: 'Idea Maze', exact: true })
    this.skillsTab = page.getByRole('button', { name: 'Skills', exact: true })
    this.settingsButton = page.getByRole('banner').locator('button').last()
    this.branchInfo = page.getByText('No workspace selected').first()
  }

  async navigateTo(tab: 'build' | 'design' | 'idea-maze' | 'skills' | 'settings') {
    const tabs = {
      build: this.buildTab,
      design: this.designTab,
      'idea-maze': this.ideaMazeTab,
      skills: this.skillsTab,
      settings: this.settingsButton,
    }
    await tabs[tab].click()
  }
}

export class IdeaMaze {
  readonly page: Page
  readonly shell: AppShell
  readonly failedHeading: Locator
  readonly retryButton: Locator

  constructor(page: Page) {
    this.page = page
    this.shell = new AppShell(page)
    this.failedHeading = page.getByRole('heading', { name: 'Failed to Load' })
    this.retryButton = page.getByRole('button', { name: 'Retry' })
  }

  async open() {
    await this.shell.navigateTo('idea-maze')
  }
}

export class DesignMode {
  readonly page: Page
  readonly shell: AppShell

  constructor(page: Page) {
    this.page = page
    this.shell = new AppShell(page)
  }

  async open() {
    await this.shell.navigateTo('design')
  }
}

export class SkillsMarketplace {
  readonly page: Page
  readonly shell: AppShell
  readonly searchInput: Locator

  constructor(page: Page) {
    this.page = page
    this.shell = new AppShell(page)
    this.searchInput = page.getByPlaceholder('Search skills...')
  }

  async open() {
    await this.shell.navigateTo('skills')
  }
}

export class SettingsPage {
  readonly page: Page
  readonly shell: AppShell
  readonly heading: Locator
  readonly gitTab: Locator
  readonly agentsTab: Locator

  constructor(page: Page) {
    this.page = page
    this.shell = new AppShell(page)
    this.heading = page.getByRole('heading', { name: 'Settings' })
    this.gitTab = page.getByRole('button', { name: 'Git' })
    this.agentsTab = page.getByRole('button', { name: 'Agents' })
  }

  async open() {
    await this.shell.navigateTo('settings')
  }
}

export class RepositoryOnboarding {
  readonly page: Page
  readonly shell: AppShell
  readonly addRepoButton: Locator
  readonly openProjectButton: Locator
  readonly cloneButton: Locator
  readonly quickStartButton: Locator

  constructor(page: Page) {
    this.page = page
    this.shell = new AppShell(page)
    this.addRepoButton = page.getByRole('button', { name: 'Add repository' }).first()
    this.openProjectButton = page.getByRole('button', { name: 'Open project Open an existing local Git repository' })
    this.cloneButton = page.getByRole('button', { name: 'Clone from URL Clone a repository from GitHub' })
    this.quickStartButton = page.getByRole('button', { name: 'Quick start Create a new blank repository' })
  }
}
