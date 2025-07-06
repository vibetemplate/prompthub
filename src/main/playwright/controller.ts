import { Page, BrowserContext } from 'playwright'
import { v4 as uuidv4 } from 'uuid'
import { IWebsiteAdapter } from './adapters/base-adapter'
import { AdapterFactory } from './adapters/adapter-factory'
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
  private adapterFactory: AdapterFactory
  private currentTab: BrowserTab | null = null

  constructor(options: { extensionMode?: boolean; userDataDir?: string } = {}) {
    this.browserContextFactory = createBrowserContextFactory(options)
    this.adapterFactory = AdapterFactory.getInstance()
  }

  private initializationPromise: Promise<void> | null = null

  async initialize(): Promise<void> {
    if (this.browserContext) {
      return
    }

    // 防止重复初始化
    if (this.initializationPromise) {
      return this.initializationPromise
    }

    this.initializationPromise = this._doInitialize()
    return this.initializationPromise
  }

  private async _doInitialize(): Promise<void> {
    try {
      console.log('🚀 初始化浏览器上下文...')
      
      const { browserContext, close } = await this.browserContextFactory.createContext()
      
      this.browserContext = browserContext
      this.closeBrowserContext = close
      
      console.log('✅ 浏览器上下文初始化成功')
    } catch (error) {
      console.error('❌ 浏览器上下文初始化失败:', error)
      this.initializationPromise = null // 重置以允许重试
      throw new Error('无法启动浏览器。请检查 Chrome 或 Chromium 是否已安装。')
    }
  }

  private async ensureTab(): Promise<BrowserTab> {
    await this.initialize()
    
    if (!this.browserContext) {
      throw new Error('浏览器上下文未初始化')
    }

    // 验证浏览器上下文是否仍然有效
    try {
      // 检查上下文是否被关闭
      const pages = this.browserContext.pages()
      // 如果能正常获取页面列表，说明上下文有效
    } catch (error) {
      console.warn('⚠️ 浏览器上下文无效，重新初始化:', error)
      this.browserContext = null
      this.initializationPromise = null
      this.tabs.clear()
      this.currentTab = null
      await this.initialize()
      
      if (!this.browserContext) {
        throw new Error('浏览器上下文重新初始化失败')
      }
    }

    // 检查当前标签页是否有效
    if (this.currentTab) {
      try {
        if (!this.currentTab.page.isClosed()) {
          return this.currentTab
        }
      } catch (error) {
        console.warn('⚠️ 检查当前标签页状态失败:', error)
      }
    }

    // 清理无效的当前标签页
    if (this.currentTab) {
      try {
        if (this.currentTab.page.isClosed()) {
          console.log('🧹 清理已关闭的当前标签页')
          this.tabs.delete(this.currentTab.id)
          this.currentTab = null
        }
      } catch (error) {
        console.warn('⚠️ 清理当前标签页失败:', error)
        this.currentTab = null
      }
    }

    // 检查是否有其他有效的标签页
    const tabsToDelete: string[] = []
    for (const [tabId, tab] of this.tabs) {
      try {
        if (!tab.page.isClosed()) {
          this.currentTab = tab
          console.log(`🔄 复用现有有效标签页: ${tab.title}`)
          return this.currentTab
        } else {
          // 标记需要清理的标签页
          tabsToDelete.push(tabId)
        }
      } catch (error) {
        console.warn(`⚠️ 检查标签页 ${tabId} 状态失败:`, error)
        tabsToDelete.push(tabId)
      }
    }

    // 清理已关闭的标签页
    for (const tabId of tabsToDelete) {
      console.log(`🧹 清理已关闭的标签页: ${tabId}`)
      this.tabs.delete(tabId)
    }

    // 检查浏览器上下文中的页面
    try {
      const existingPages = this.browserContext.pages()
      for (const page of existingPages) {
        try {
          if (!page.isClosed()) {
            const tabId = uuidv4()
            let title = ''
            let url = 'about:blank'
            
            try {
              url = page.url()
              title = await page.title()
            } catch (error) {
              console.warn('⚠️ 获取页面信息失败:', error)
            }
            
            const tab: BrowserTab = {
              id: tabId,
              url,
              title,
              page,
              websiteType: this.detectWebsiteType(url),
            }
            
            this.tabs.set(tabId, tab)
            this.currentTab = tab
            console.log(`🔄 复用浏览器中的页面: ${tab.title}`)
            return this.currentTab
          }
        } catch (error) {
          console.warn('⚠️ 检查现有页面失败:', error)
        }
      }
    } catch (error) {
      console.warn('⚠️ 检查浏览器上下文中的页面时出错:', error)
    }

    // 创建新页面
    try {
      console.log('🆕 创建新标签页...')
      const page = await this.browserContext.newPage()
      const tabId = uuidv4()
      
      const tab: BrowserTab = {
        id: tabId,
        url: 'about:blank',
        title: '',
        page,
        websiteType: undefined,
      }
      
      this.tabs.set(tabId, tab)
      this.currentTab = tab
      console.log(`✅ 新标签页创建成功: ${tabId}`)
      return this.currentTab
    } catch (error) {
      console.error('❌ 创建新标签页失败:', error)
      
      // 如果是上下文关闭错误，尝试重新初始化
      if (error.message && error.message.includes('Target page, context or browser has been closed')) {
        console.log('🔄 浏览器上下文被关闭，尝试重新初始化...')
        this.browserContext = null
        this.initializationPromise = null
        this.tabs.clear()
        this.currentTab = null
        
        // 递归重试一次
        try {
          return await this.ensureTab()
        } catch (retryError) {
          console.error('❌ 重新初始化后仍然失败:', retryError)
          throw new Error('无法创建新标签页，浏览器上下文重新初始化失败')
        }
      }
      
      throw new Error('无法创建新标签页，浏览器上下文可能已关闭')
    }
  }

  async openTab(url: string): Promise<string> {
    try {
      console.log(`🌐 打开标签页: ${url}`)
      
      // 确保有可用的标签页
      let tab = await this.ensureTab()
      
      // 验证标签页是否仍然有效
      if (tab.page.isClosed()) {
        console.log('⚠️ 标签页已关闭，重新创建...')
        tab = await this.ensureTab()
      }
      
      // 检查浏览器上下文是否仍然有效
      if (!this.browserContext || this.browserContext.pages().length === 0) {
        console.log('⚠️ 浏览器上下文无效，重新初始化...')
        this.browserContext = null
        this.initializationPromise = null
        tab = await this.ensureTab()
      }
      
      // 设置页面超时 - 使用更合理的超时设置
      try {
        await callOnPageNoTrace(tab.page, async (page) => {
          page.setDefaultTimeout(60000)
          page.setDefaultNavigationTimeout(60000)
        })
      } catch (error) {
        console.warn('⚠️ 设置页面超时失败，页面可能已关闭:', error)
        // 重新获取标签页
        tab = await this.ensureTab()
        await callOnPageNoTrace(tab.page, async (page) => {
          page.setDefaultTimeout(60000)
          page.setDefaultNavigationTimeout(60000)
        })
      }
      
      console.log(`🔄 导航到: ${url}`)
      
      // 使用内部API导航，避免被检测 - 增加重试机制
      let navigationSuccess = false
      let retryCount = 0
      const maxRetries = 2
      
      while (!navigationSuccess && retryCount < maxRetries) {
        try {
          await callOnPageNoTrace(tab.page, async (page) => {
            await page.goto(url, { 
              waitUntil: 'domcontentloaded',
              timeout: 60000 
            })
          })
          navigationSuccess = true
        } catch (error) {
          retryCount++
          console.warn(`⚠️ 导航失败 (尝试 ${retryCount}/${maxRetries}):`, error)
          
          if (retryCount < maxRetries) {
            // 如果是页面关闭错误，重新创建标签页
            if (error.message && error.message.includes('Target page, context or browser has been closed')) {
              console.log('🔄 页面已关闭，重新创建标签页...')
              this.tabs.delete(tab.id)
              this.currentTab = null
              tab = await this.ensureTab()
            } else {
              // 其他错误，等待1秒后重试
              await new Promise(resolve => setTimeout(resolve, 1000))
            }
          } else {
            throw error
          }
        }
      }
      
      // 等待页面完全加载，让assistantMode自然处理任何挑战
      try {
        await waitForPageReady(tab.page)
      } catch (error) {
        console.warn('⚠️ 等待页面就绪失败:', error)
        // 继续执行，不抛出错误
      }
      
      // 简单的人类行为模拟
      try {
        await simulateHumanBehavior(tab.page)
      } catch (error) {
        console.warn('⚠️ 人类行为模拟失败:', error)
        // 继续执行，不抛出错误
      }
      
      // 获取页面信息 - 使用内部API避免检测
      let title = ''
      try {
        title = await callOnPageNoTrace(tab.page, async (page) => {
          return await page.title()
        })
      } catch (error) {
        console.warn('⚠️ 获取页面标题失败:', error)
        title = url // 使用URL作为标题
      }
      
      const websiteType = this.detectWebsiteType(url)
      
      console.log(`✅ 标签页打开成功: ${title}`)
      
      // 更新标签页信息
      tab.url = url
      tab.title = title
      tab.websiteType = websiteType
      
      return tab.id
    } catch (error) {
      console.error(`❌ 打开标签页失败 ${url}:`, error)
      
      // 如果是浏览器上下文关闭错误，尝试重新初始化一次
      if (error.message && error.message.includes('Target page, context or browser has been closed')) {
        console.log('🔄 检测到浏览器上下文关闭，尝试重新初始化...')
        this.browserContext = null
        this.initializationPromise = null
        this.tabs.clear()
        this.currentTab = null
        
        try {
          const tab = await this.ensureTab()
          return await this.openTab(url) // 递归重试一次
        } catch (retryError) {
          console.error('❌ 重新初始化后仍然失败:', retryError)
          throw new Error(`无法打开标签页: ${url}`)
        }
      }
      
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
      
      // 如果关闭的是当前标签页，清除当前标签页引用
      if (this.currentTab === tab) {
        this.currentTab = null
      }
      
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

    // 检查页面是否仍然有效
    if (tab.page.isClosed()) {
      throw new Error(`Tab ${tabId} has been closed`)
    }

    // 尝试根据网站类型获取适配器
    let adapter = this.adapterFactory.getAdapter(websiteType)
    
    // 如果没找到，尝试根据URL自动检测
    if (!adapter) {
      adapter = this.adapterFactory.getAdapterByUrl(tab.url)
    }
    
    if (!adapter) {
      throw new Error(`Adapter for ${websiteType} not found. Supported websites: ${this.adapterFactory.getAllWebsites().map(w => w.name).join(', ')}`)
    }

    console.log(`🎯 执行提示词于 ${adapter.websiteName}: "${prompt.substring(0, 50)}..."`)
    
    try {
      await adapter.executePrompt(tab.page, prompt)
    } catch (error) {
      // 如果是页面关闭错误，清理标签页
      if (error.message && error.message.includes('Target page, context or browser has been closed')) {
        console.log(`🧹 页面已关闭，清理标签页: ${tabId}`)
        this.tabs.delete(tabId)
        if (this.currentTab === tab) {
          this.currentTab = null
        }
      }
      throw error
    }
  }

  async getPageContent(tabId: string): Promise<string> {
    const tab = this.tabs.get(tabId)
    if (!tab) {
      throw new Error(`Tab ${tabId} not found`)
    }

    // 检查页面是否仍然有效
    if (tab.page.isClosed()) {
      throw new Error(`Tab ${tabId} has been closed`)
    }

    try {
      // 使用内部API获取页面内容，避免被检测
      return await callOnPageNoTrace(tab.page, async (page) => {
        return await page.content()
      })
    } catch (error) {
      // 如果是页面关闭错误，清理标签页
      if (error.message && error.message.includes('Target page, context or browser has been closed')) {
        console.log(`🧹 页面已关闭，清理标签页: ${tabId}`)
        this.tabs.delete(tabId)
        if (this.currentTab === tab) {
          this.currentTab = null
        }
      }
      throw error
    }
  }

  async getTabs(): Promise<Omit<BrowserTab, 'page'>[]> {
    // 清理已关闭的标签页
    const tabsToDelete: string[] = []
    for (const [tabId, tab] of this.tabs) {
      try {
        if (tab.page.isClosed()) {
          tabsToDelete.push(tabId)
        }
      } catch (error) {
        console.warn(`⚠️ 检查标签页 ${tabId} 状态失败:`, error)
        tabsToDelete.push(tabId)
      }
    }
    
    // 删除已关闭的标签页
    for (const tabId of tabsToDelete) {
      console.log(`🧹 清理已关闭的标签页: ${tabId}`)
      this.tabs.delete(tabId)
      if (this.currentTab && this.currentTab.id === tabId) {
        this.currentTab = null
      }
    }
    
    const tabs = Array.from(this.tabs.values())
    return tabs.map(tab => ({
      id: tab.id,
      url: tab.url,
      title: tab.title,
      websiteType: tab.websiteType,
    }))
  }

  private detectWebsiteType(url: string): string | undefined {
    // 使用适配器工厂自动检测网站类型
    const adapter = this.adapterFactory.getAdapterByUrl(url)
    return adapter?.websiteId
  }

  // 新增：获取所有支持的网站列表
  getAllSupportedWebsites(): Array<{
    id: string
    name: string
    url: string
    requiresProxy: boolean
  }> {
    return this.adapterFactory.getAllWebsites()
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
      
      // 清除当前标签页引用
      this.currentTab = null
      
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