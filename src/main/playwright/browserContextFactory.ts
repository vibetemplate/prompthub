import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { chromium, BrowserContext, Browser } from 'playwright'
import { app } from 'electron'
import { callOnContextNoTrace } from './utils'

/**
 * 浏览器上下文工厂接口
 */
export interface BrowserContextFactory {
  createContext(): Promise<{ 
    browserContext: BrowserContext
    close: () => Promise<void>
    browser?: Browser
  }>
}

/**
 * 持久化上下文工厂 - 借鉴playwright-mcp的最佳实践
 */
export class PersistentContextFactory implements BrowserContextFactory {
  private _userDataDirs = new Set<string>()
  private readonly userDataDir?: string

  constructor(userDataDir?: string) {
    this.userDataDir = userDataDir
  }

  async createContext(): Promise<{ 
    browserContext: BrowserContext
    close: () => Promise<void>
    browser?: Browser
  }> {
    console.log('🚀 创建持久化浏览器上下文...')
    
    const userDataDir = this.userDataDir ?? await this._createUserDataDir()
    this._userDataDirs.add(userDataDir)
    
    console.log(`📁 使用用户数据目录: ${userDataDir}`)

    // 重试机制，处理浏览器被占用的情况
    for (let i = 0; i < 5; i++) {
      try {
        const browserContext = await chromium.launchPersistentContext(userDataDir, {
          // 基础配置
          headless: false,
          viewport: null,
          
          // 🔥 关键1：使用Chrome而不是Chromium
          channel: 'chrome',
          
          // 🔥 关键2：添加assistantMode避免检测
          ...{ assistantMode: true },
          
          // 🔥 关键3：添加CDP端口
          ...{ cdpPort: await this._findFreePort() },
          
          // 🔥 关键4：playwright-mcp的完整启动参数
          args: [
            // 沙盒相关
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            
            // 基础配置
            '--no-first-run',
            '--disable-default-apps',
            '--no-default-browser-check',
            '--disable-background-mode',
            
            // 🔥 关键反检测参数
            '--disable-blink-features=AutomationControlled',
            '--disable-features=VizDisplayCompositor',
            '--disable-ipc-flooding-protection',
            '--disable-renderer-backgrounding',
            '--disable-backgrounding-occluded-windows',
            '--disable-background-timer-throttling',
            '--disable-features=TranslateUI',
            '--disable-component-extensions-with-background-pages',
            '--disable-background-networking',
            '--autoplay-policy=user-gesture-required',
            '--disable-web-security',
            '--disable-site-isolation-trials',
            
            // 🔥 特殊功能启用
            '--enable-features=AllowContentInitiatedDataUrlNavigations',
            
            // 窗口配置
            '--start-maximized'
          ],
          
          // 超时设置
          timeout: 60000,
          
          // 🔥 关键5：使用最新的Chrome User-Agent (不包含HeadlessChrome)
          userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
          locale: 'zh-CN',
          timezoneId: 'Asia/Shanghai',
          
          // 权限设置
          permissions: ['geolocation', 'notifications'],
          
          // HTTP头部
          extraHTTPHeaders: {
            'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
            'Accept-Encoding': 'gzip, deflate, br',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
            'Cache-Control': 'max-age=0',
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'none',
            'Sec-Fetch-User': '?1',
            'Upgrade-Insecure-Requests': '1'
          },
          
          // 🔥 关键6：添加环境变量配置
          env: {
            ...process.env,
            // 移除可能暴露自动化的环境变量
            CHROME_NO_SANDBOX: undefined,
            CHROME_DISABLE_GPU: undefined,
            DISPLAY: process.env.DISPLAY || ':99', // Linux环境备用
          },
          
          // 信号处理
          handleSIGINT: false,
          handleSIGTERM: false,
        })

        // 设置网络请求拦截 - 借鉴playwright-mcp的技术
        await this._setupRequestInterception(browserContext)

        // 添加高级初始化脚本以隐藏自动化痕迹
        await browserContext.addInitScript(() => {
          // 隐藏webdriver属性
          Object.defineProperty(navigator, 'webdriver', {
            get: () => undefined,
          })

          // 模拟真实的Chrome插件列表
          Object.defineProperty(navigator, 'plugins', {
            get: () => [1, 2, 3, 4, 5],
          })

          // 模拟真实的语言设置
          Object.defineProperty(navigator, 'languages', {
            get: () => ['zh-CN', 'zh', 'en'],
          })

          // 移除automation相关属性
          delete (window as any).cdc_adoQpoasnfa76pfcZLmcfl_Array
          delete (window as any).cdc_adoQpoasnfa76pfcZLmcfl_Promise
          delete (window as any).cdc_adoQpoasnfa76pfcZLmcfl_Symbol

          // 高级反检测：覆盖一些可能暴露自动化的属性
          Object.defineProperty(navigator, 'permissions', {
            get: () => ({
              query: () => Promise.resolve({ state: 'granted' })
            })
          })

          // 模拟真实的硬件信息
          Object.defineProperty(navigator, 'hardwareConcurrency', {
            get: () => 8
          })

          Object.defineProperty(navigator, 'deviceMemory', {
            get: () => 8
          })

          // 覆盖Chrome运行时检测
          if ('chrome' in window) {
            Object.defineProperty(window, 'chrome', {
              get: () => ({
                runtime: {
                  onConnect: null,
                  onMessage: null
                },
                app: {
                  isInstalled: false
                }
              })
            })
          }

          // 移除phantom相关属性
          delete (window as any).phantom
          delete (window as any).__phantomas
          delete (window as any).callPhantom

          // 移除nightmare相关属性
          delete (window as any).__nightmare

          // 覆盖toString方法避免检测
          const originalToString = Function.prototype.toString
          Function.prototype.toString = function() {
            if (this === navigator.webdriver) {
              return 'function webdriver() { [native code] }'
            }
            return originalToString.call(this)
          }
        })

        const close = () => this._closeBrowserContext(browserContext, userDataDir)
        
        console.log('✅ 持久化浏览器上下文创建成功')
        return { browserContext, close }
        
      } catch (error: any) {
        console.warn(`⚠️ 尝试 ${i + 1}/5 失败:`, error.message)
        
        if (error.message.includes('Executable doesn\'t exist')) {
          throw new Error('浏览器未安装。请安装 Chrome 或 Chromium 浏览器。')
        }
        
        if (error.message.includes('ProcessSingleton') || error.message.includes('Invalid URL')) {
          // 用户数据目录被占用，等待后重试
          await new Promise(resolve => setTimeout(resolve, 1000))
          continue
        }
        
        throw error
      }
    }
    
    throw new Error(`浏览器被占用，无法使用 ${userDataDir}，请考虑关闭其他Chrome实例`)
  }

  private async _setupRequestInterception(browserContext: BrowserContext) {
    // 🔥 关键7：精确的请求拦截 - 修复版本
    await callOnContextNoTrace(browserContext, async (context) => {
      await context.route('**/*', (route) => {
        const url = route.request().url()
        const resourceType = route.request().resourceType()
        
        // ✅ 允许Cloudflare验证相关请求通过
        const cloudflareAllowPatterns = [
          'cdn-cgi/challenge-platform',
          'cdn-cgi/styles',
          'cdn-cgi/scripts',
          'turnstile.pagescdn.com',
          '__cf_bm'
        ]
        
        const isCloudflareValid = cloudflareAllowPatterns.some(pattern => 
          url.includes(pattern)
        )
        
        if (isCloudflareValid) {
          console.log(`✅ 允许Cloudflare验证请求: ${url}`)
          // 直接继续，不修改headers以避免干扰验证
          route.continue()
          return
        }
        
        // 🚫 阻止真正的追踪和分析请求
        const suspiciousPatterns = [
          'google-analytics', 'gtag', 'gtm', 'ga-audiences',
          'facebook.com/tr', 'connect.facebook.net',
          'doubleclick.net', 'googlesyndication.com',
          'hotjar', 'mixpanel', 'segment.com', 'amplitude.com',
          'clarity.ms', 'bing.com/analytics',
          'webdriver', 'automation', 'bot-detection',
          'fingerprint', 'device-fingerprint'
        ]
        
        // 检查URL是否包含真正可疑的模式
        const isSuspicious = suspiciousPatterns.some(pattern => 
          url.toLowerCase().includes(pattern)
        )
        
        if (isSuspicious) {
          console.log(`🚫 阻止追踪请求: ${url}`)
          route.abort('blockedbyclient')
          return
        }
        
        // 阻止某些资源类型以提高性能（但保留必要的）
        if (resourceType === 'media' && !url.includes('avatar') && !url.includes('logo')) {
          route.abort('blockedbyclient')
          return
        }
        
        // 修改User-Agent确保一致性（除了Cloudflare验证请求）
        const headers = route.request().headers()
        headers['User-Agent'] = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
        
        route.continue({ headers })
      })
    })
  }

  private async _closeBrowserContext(browserContext: BrowserContext, userDataDir: string) {
    console.log('🧹 关闭持久化浏览器上下文...')
    
    try {
      await browserContext.close()
      this._userDataDirs.delete(userDataDir)
      console.log('✅ 浏览器上下文已关闭')
    } catch (error) {
      console.warn('⚠️ 关闭浏览器上下文时出错:', error)
    }
  }

  private async _findFreePort(): Promise<number> {
    return new Promise((resolve, reject) => {
      const net = require('net')
      const server = net.createServer()
      server.listen(0, () => {
        const { port } = server.address()
        server.close(() => resolve(port))
      })
      server.on('error', reject)
    })
  }

  private async _createUserDataDir(): Promise<string> {
    let cacheDirectory: string
    
    if (process.platform === 'linux') {
      cacheDirectory = process.env.XDG_CACHE_HOME || path.join(os.homedir(), '.cache')
    } else if (process.platform === 'darwin') {
      cacheDirectory = path.join(os.homedir(), 'Library', 'Caches')
    } else if (process.platform === 'win32') {
      cacheDirectory = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local')
    } else {
      // 兜底：使用Electron的userData目录
      cacheDirectory = app.getPath('userData')
    }
    
    const result = path.join(cacheDirectory, 'prompthub-playwright', 'chrome-profile')
    await fs.promises.mkdir(result, { recursive: true })
    
    return result
  }
}

/**
 * 创建默认的浏览器上下文工厂
 */
export function createBrowserContextFactory(userDataDir?: string): BrowserContextFactory {
  return new PersistentContextFactory(userDataDir)
}