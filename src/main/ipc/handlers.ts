import { ipcMain } from 'electron'
import { PlaywrightController } from '../playwright/controller'
import { PromptManager } from '../data/prompt-manager'
import { SettingsManager } from '../data/settings-manager'

export function setupIpcHandlers(playwrightController: PlaywrightController): void {
  const promptManager = new PromptManager()
  const settingsManager = new SettingsManager()

  // 提示词管理
  ipcMain.handle('prompts:getAll', async () => {
    return await promptManager.getAll()
  })

  ipcMain.handle('prompts:create', async (event, prompt) => {
    return await promptManager.create(prompt)
  })

  ipcMain.handle('prompts:update', async (event, id, prompt) => {
    return await promptManager.update(id, prompt)
  })

  ipcMain.handle('prompts:delete', async (event, id) => {
    return await promptManager.delete(id)
  })

  ipcMain.handle('prompts:import', async (event, filePath) => {
    return await promptManager.import(filePath)
  })

  ipcMain.handle('prompts:export', async (event, filePath, prompts) => {
    return await promptManager.export(filePath, prompts)
  })

  // 浏览器自动化 - 现已使用Playwright
  ipcMain.handle('browser:openTab', async (event, url) => {
    return await playwrightController.openTab(url)
  })

  ipcMain.handle('browser:closeTab', async (event, tabId) => {
    return await playwrightController.closeTab(tabId)
  })

  ipcMain.handle('browser:executePrompt', async (event, tabId, websiteType, prompt) => {
    return await playwrightController.executePrompt(tabId, websiteType, prompt)
  })

  ipcMain.handle('browser:getPageContent', async (event, tabId) => {
    return await playwrightController.getPageContent(tabId)
  })

  ipcMain.handle('browser:getTabs', async () => {
    return await playwrightController.getTabs()
  })

  ipcMain.handle('browser:getSupportedWebsites', async () => {
    return playwrightController.getAllSupportedWebsites()
  })

  // 设置管理
  ipcMain.handle('settings:get', async (event, key) => {
    return await settingsManager.get(key)
  })

  ipcMain.handle('settings:set', async (event, key, value) => {
    return await settingsManager.set(key, value)
  })

  ipcMain.handle('settings:getAll', async () => {
    return await settingsManager.getAll()
  })
}