import * as fs from 'fs/promises'
import * as path from 'path'
import { app } from 'electron'

export interface Settings {
  proxy?: {
    enabled: boolean
    host: string
    port: number
    username?: string
    password?: string
  }
  browser?: {
    headless: boolean
    userAgent?: string
    viewport?: {
      width: number
      height: number
    }
  }
  general?: {
    autoSave: boolean
    theme: 'light' | 'dark'
    language: 'zh' | 'en'
  }
}

export class SettingsManager {
  private dataPath: string
  private settings: Settings = {}

  constructor() {
    this.dataPath = path.join(app.getPath('userData'), 'settings.json')
    this.loadSettings()
  }

  private async loadSettings(): Promise<void> {
    try {
      const data = await fs.readFile(this.dataPath, 'utf-8')
      this.settings = JSON.parse(data)
    } catch (error) {
      // 文件不存在或格式错误，使用默认设置
      this.settings = this.getDefaultSettings()
      await this.saveSettings()
    }
  }

  private async saveSettings(): Promise<void> {
    await fs.writeFile(this.dataPath, JSON.stringify(this.settings, null, 2))
  }

  private getDefaultSettings(): Settings {
    return {
      proxy: {
        enabled: false,
        host: '127.0.0.1',
        port: 7890,
      },
      browser: {
        headless: false,
        viewport: {
          width: 1280,
          height: 720,
        },
      },
      general: {
        autoSave: true,
        theme: 'light',
        language: 'zh',
      },
    }
  }

  async get(key: keyof Settings): Promise<any> {
    return this.settings[key]
  }

  async set(key: keyof Settings, value: any): Promise<void> {
    this.settings[key] = value
    await this.saveSettings()
  }

  async getAll(): Promise<Settings> {
    return { ...this.settings }
  }

  async reset(): Promise<void> {
    this.settings = this.getDefaultSettings()
    await this.saveSettings()
  }
}