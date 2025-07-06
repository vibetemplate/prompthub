import { IWebsiteAdapter } from './base-adapter'
import { DeepSeekAdapter } from './deepseek-adapter'
import { ChatGPTAdapter } from './chatgpt-adapter'
import { ClaudeAdapter } from './claude-adapter'
import { TongyiAdapter } from './tongyi-adapter'
import { KimiAdapter } from './kimi-adapter'
import { GeminiAdapter } from './gemini-adapter'

/**
 * 适配器工厂类
 * 负责创建和管理所有网站适配器
 */
export class AdapterFactory {
  private static instance: AdapterFactory
  private adapters: Map<string, IWebsiteAdapter> = new Map()

  private constructor() {
    this.initializeAdapters()
  }

  /**
   * 获取单例实例
   */
  static getInstance(): AdapterFactory {
    if (!AdapterFactory.instance) {
      AdapterFactory.instance = new AdapterFactory()
    }
    return AdapterFactory.instance
  }

  /**
   * 初始化所有适配器
   */
  private initializeAdapters(): void {
    const adapterInstances = [
      // 国内大模型
      new DeepSeekAdapter(),
      new TongyiAdapter(),
      new KimiAdapter(),
      
      // 国外大模型
      new ChatGPTAdapter(),
      new ClaudeAdapter(),
      new GeminiAdapter(),
    ]

    adapterInstances.forEach(adapter => {
      this.adapters.set(adapter.websiteId, adapter)
    })

    console.log(`✅ 已加载 ${this.adapters.size} 个网站适配器:`, 
      Array.from(this.adapters.keys()))
  }

  /**
   * 根据网站ID获取适配器
   */
  getAdapter(websiteId: string): IWebsiteAdapter | undefined {
    return this.adapters.get(websiteId)
  }

  /**
   * 根据URL自动检测并获取适配器
   */
  getAdapterByUrl(url: string): IWebsiteAdapter | undefined {
    for (const adapter of this.adapters.values()) {
      if (adapter.isCurrentWebsite(url)) {
        console.log(`🔍 检测到网站: ${adapter.websiteName} (${url})`)
        return adapter
      }
    }
    console.log(`⚠️ 未找到匹配的适配器: ${url}`)
    return undefined
  }

  /**
   * 获取所有可用的适配器
   */
  getAllAdapters(): IWebsiteAdapter[] {
    return Array.from(this.adapters.values())
  }

  /**
   * 获取所有网站信息
   */
  getAllWebsites(): Array<{
    id: string
    name: string
    url: string
    requiresProxy: boolean
  }> {
    return Array.from(this.adapters.values()).map(adapter => ({
      id: adapter.websiteId,
      name: adapter.websiteName,
      url: adapter.websiteUrl,
      requiresProxy: adapter.requiresProxy
    }))
  }

  /**
   * 检查网站是否需要代理
   */
  requiresProxy(websiteId: string): boolean {
    const adapter = this.getAdapter(websiteId)
    return adapter?.requiresProxy || false
  }

  /**
   * 检查网站是否支持
   */
  isSupported(url: string): boolean {
    return this.getAdapterByUrl(url) !== undefined
  }

  /**
   * 获取支持的网站数量
   */
  getSupportedCount(): number {
    return this.adapters.size
  }
}