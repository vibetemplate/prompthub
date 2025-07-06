import { Page, BrowserContext } from 'playwright'
import { v4 as uuidv4 } from 'uuid'
import { WebsiteAdapter } from './adapters/base-adapter'
import { DeepSeekAdapter } from './adapters/deepseek-adapter'
import { ChatGPTAdapter } from './adapters/chatgpt-adapter'
import { createBrowserContextFactory, BrowserContextFactory } from './browserContextFactory'
import { 
  callOnPageNoTrace, 
  simulateHumanBehavior, 
  waitForPageReady, 
  isCloudflareChallenge, 
  handleCloudflareChallenge 
} from './utils'

export interface BrowserTab {
  id: string
  url: string
  title: string
  page: Page
  websiteType?: string
}

export class PlaywrightController {
  private browserContext: BrowserContext | null = null
  private browserContextFactory: BrowserContextFactory
  private closeBrowserContext: (() => Promise<void>) | null = null
  private tabs: Map<string, BrowserTab> = new Map()
  private adapters: Map<string, WebsiteAdapter> = new Map()

  constructor(userDataDir?: string) {
    this.browserContextFactory = createBrowserContextFactory(userDataDir)
    this.initializeAdapters()
  }

  private initializeAdapters(): void {
    this.adapters.set('deepseek', new DeepSeekAdapter())
    this.adapters.set('chatgpt', new ChatGPTAdapter())
  }

  async initialize(): Promise<void> {
    if (this.browserContext) {
      return
    }

    try {
      console.log('🚀 初始化浏览器上下文...')
      
      const { browserContext, close } = await this.browserContextFactory.createContext()
      
      this.browserContext = browserContext
      this.closeBrowserContext = close
      
      console.log('✅ 浏览器上下文初始化成功')
    } catch (error) {
      console.error('❌ 浏览器上下文初始化失败:', error)
      throw new Error('无法启动浏览器。请检查 Chrome 或 Chromium 是否已安装。')
    }
  }

  async openTab(url: string): Promise<string> {
    try {
      console.log(`🌐 打开标签页: ${url}`)
      await this.initialize()
      
      if (!this.browserContext) {
        throw new Error('浏览器上下文未初始化')
      }

      // 创建新页面
      const page = await this.browserContext.newPage()
      const tabId = uuidv4()
      
      // 设置页面超时 - 使用更合理的超时设置
      await callOnPageNoTrace(page, async (page) => {
        page.setDefaultTimeout(60000)
        page.setDefaultNavigationTimeout(60000)
      })
      
      console.log(`🔄 导航到: ${url}`)
      
      // 使用内部API导航，避免被检测
      await callOnPageNoTrace(page, async (page) => {
        await page.goto(url, { 
          waitUntil: 'domcontentloaded',
          timeout: 60000 
        })
      })
      
      // 等待页面完全加载
      await waitForPageReady(page)
      
      // 检查是否遇到Cloudflare挑战
      const isChallenge = await isCloudflareChallenge(page)
      if (isChallenge) {
        console.log('🛡️ 检测到Cloudflare挑战，尝试处理...')
        const handled = await handleCloudflareChallenge(page)
        if (!handled) {
          console.warn('⚠️ Cloudflare挑战处理失败，但继续执行')
        }
      }
      
      // 模拟真实人类行为
      await simulateHumanBehavior(page)
      
      // 获取页面信息 - 使用内部API避免检测
      const title = await callOnPageNoTrace(page, async (page) => {
        return await page.title()
      })
      
      const websiteType = this.detectWebsiteType(url)
      
      console.log(`✅ 标签页打开成功: ${title}`)
      
      const tab: BrowserTab = {
        id: tabId,
        url,
        title,
        page,
        websiteType,
      }
      
      this.tabs.set(tabId, tab)
      return tabId
    } catch (error) {
      console.error(`❌ 打开标签页失败 ${url}:`, error)
      throw error
    }
  }

  async closeTab(tabId: string): Promise<void> {
    const tab = this.tabs.get(tabId)
    if (!tab) {
      throw new Error(`Tab ${tabId} not found`)
    }

    try {
      if (!tab.page.isClosed()) {
        await tab.page.close()
      }
      this.tabs.delete(tabId)
      console.log(`🗑️ Tab ${tabId} closed successfully`)
    } catch (error) {
      console.error(`❌ Failed to close tab ${tabId}:`, error)
      throw error
    }
  }

  async executePrompt(tabId: string, websiteType: string, prompt: string): Promise<void> {
    const tab = this.tabs.get(tabId)
    if (!tab) {
      throw new Error(`Tab ${tabId} not found`)
    }

    const adapter = this.adapters.get(websiteType)
    if (!adapter) {
      throw new Error(`Adapter for ${websiteType} not found`)
    }

    console.log(`🎯 Executing prompt on ${websiteType}: "${prompt.substring(0, 50)}..."`)
    await adapter.executePrompt(tab.page, prompt)
  }

  async getPageContent(tabId: string): Promise<string> {
    const tab = this.tabs.get(tabId)
    if (!tab) {
      throw new Error(`Tab ${tabId} not found`)
    }

    // 使用内部API获取页面内容，避免被检测
    return await callOnPageNoTrace(tab.page, async (page) => {
      return await page.content()
    })
  }

  async getTabs(): Promise<Omit<BrowserTab, 'page'>[]> {
    const tabs = Array.from(this.tabs.values())
    return tabs.map(tab => ({
      id: tab.id,
      url: tab.url,
      title: tab.title,
      websiteType: tab.websiteType,
    }))
  }

  private detectWebsiteType(url: string): string | undefined {
    if (url.includes('deepseek.com')) {
      return 'deepseek'
    }
    if (url.includes('chatgpt.com') || url.includes('chat.openai.com')) {
      return 'chatgpt'
    }
    if (url.includes('claude.ai')) {
      return 'claude'
    }
    if (url.includes('gemini.google.com')) {
      return 'gemini'
    }
    if (url.includes('kimi.moonshot.cn')) {
      return 'kimi'
    }
    if (url.includes('tongyi.aliyun.com')) {
      return 'tongyi'
    }
    return undefined
  }

  async cleanup(): Promise<void> {
    try {
      console.log('🧹 清理Playwright控制器...')
      
      // 先关闭所有页面
      for (const [tabId, tab] of this.tabs) {
        try {
          if (!tab.page.isClosed()) {
            await tab.page.close()
          }
        } catch (error) {
          console.warn(`⚠️ 关闭标签页失败 ${tabId}:`, error)
        }
      }
      
      // 清空标签页映射
      this.tabs.clear()
      
      // 关闭浏览器上下文
      if (this.closeBrowserContext) {
        await this.closeBrowserContext()
        this.closeBrowserContext = null
      }
      
      this.browserContext = null
      console.log('✅ Playwright浏览器已成功关闭')
    } catch (error) {
      console.error('❌ 清理过程中出错:', error)
    }
  }

  // 新增：获取浏览器状态
  isInitialized(): boolean {
    return !!this.browserContext
  }

  // 新增：获取活跃标签页数量
  getActiveTabCount(): number {
    return this.tabs.size
  }

  // 新增：支持多浏览器引擎（未来扩展）
  async switchToBrowser(browserType: 'chromium' | 'firefox' | 'webkit' = 'chromium'): Promise<void> {
    // 预留接口，未来可以支持其他浏览器引擎
    console.log(`🔄 Browser type: ${browserType} (currently only Chromium is supported)`)
  }
}