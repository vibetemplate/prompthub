import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import http from 'node:http'
import { chromium, BrowserContext, Browser } from 'playwright'
import { app } from 'electron'
import { callOnContextNoTrace } from './utils'
import { CDPRelayServer } from './cdpRelayServer'

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
 * CDP 上下文工厂 - 用于连接到已存在的CDP端点
 */
export class CdpContextFactory implements BrowserContextFactory {
  constructor(private _cdpEndpoint: string) {}

  async createContext(): Promise<{
    browserContext: BrowserContext
    close: () => Promise<void>
    browser?: Browser
  }> {
    console.log(`🚀 连接到CDP端点: ${this._cdpEndpoint}`)
    const browser = await chromium.connectOverCDP(this._cdpEndpoint)
    const browserContext = browser.contexts()[0]
    console.log('✅ CDP连接成功，已获取浏览器上下文')
    return {
      browserContext,
      close: async () => {
        // 在这种模式下，我们不关闭浏览器，只断开连接
        await browser.close()
        console.log('🔌 CDP连接已断开')
      },
      browser
    }
  }
}

/**
 * 扩展上下文工厂 - 启动中继服务器并等待扩展连接
 */
export class ExtensionContextFactory implements BrowserContextFactory {
  private _cdpRelayServer: CDPRelayServer | null = null
  private _httpServer: http.Server | null = null
  private _actualPort: number

  constructor(private _port: number) {
    this._actualPort = _port
  }

  async createContext(): Promise<{
    browserContext: BrowserContext
    close: () => Promise<void>
    browser?: Browser
  }> {
    console.log('🚀 启动扩展中继服务器...')
    const factory = await this._startRelayServer()
    console.log(`✅ 中继服务器已在端口 ${this._actualPort} 上启动`)
    console.log('⏳ 等待Chrome扩展连接...')
    return factory.createContext()
  }

  private async _startRelayServer(): Promise<CdpContextFactory> {
    this._httpServer = http.createServer((req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/plain' })
      res.end('PromptHub CDP Relay Server\n')
    })
    this._cdpRelayServer = new CDPRelayServer(this._httpServer)

    // 首先找到一个可用端口
    const availablePort = await this._findFreePort()
    this._actualPort = availablePort
    
    console.log(`🔍 找到可用端口: ${this._actualPort}`)

    // 使用可用端口启动服务器
    try {
      await new Promise<void>((resolve, reject) => {
        this._httpServer!.once('error', reject)
        this._httpServer!.listen(this._actualPort, '127.0.0.1', () => {
          console.log(`✅ 中继服务器成功启动在端口 ${this._actualPort}`)
          resolve()
        })
      })
    } catch (err) {
      console.error('❌ 启动中继服务器失败:', err)
      throw err
    }

    const cdpEndpoint = `ws://127.0.0.1:${this._actualPort}/cdp`
    return new CdpContextFactory(cdpEndpoint)
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

  public async stopServer(): Promise<void> {
    console.log('🛑 停止中继服务器...')
    this._cdpRelayServer?.stop()
    await new Promise<void>((resolve, reject) => {
      if (this._httpServer) {
        this._httpServer.close((err) => {
          if (err) reject(err)
          else resolve()
        })
      } else {
        resolve()
      }
    })
    console.log('✅ 中继服务器已停止')
  }
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
        const cdpPort = await this._findFreePort()
        
        // 🔥 关键：按照playwright-mcp的结构分离launchOptions和contextOptions
        const launchOptions = {
          // 🔥 关键1：使用Chrome而不是Chromium
          channel: 'chrome',
          
          // 🔥 关键2：基础配置
          headless: false,
          
          // 🔥 关键3：沙盒配置（与playwright-mcp一致）
          chromiumSandbox: true,
          
          // 🔥 关键4：assistantMode是最重要的反检测配置！
          assistantMode: true,
          
          // CDP端口配置
          cdpPort: cdpPort,
          
          // 超时设置
          timeout: 60000,
          
          // 🔥 关键5：简化启动参数，移除不建议的沙盒参数，让Playwright自动管理
          args: [
            // 基础优化（移除沙盒相关参数，使用chromiumSandbox配置）
            '--no-first-run',
            '--disable-default-apps',
            '--no-default-browser-check',
            
            // 窗口配置
            '--start-maximized'
          ],
          
          // 🔥 关键6：添加环境变量配置
          env: (() => {
            const cleanEnv: { [key: string]: string | number | boolean } = {}
            for (const key in process.env) {
              if (process.env[key] !== undefined) {
                cleanEnv[key] = process.env[key]!
              }
            }
            cleanEnv['DISPLAY'] = process.env.DISPLAY || ':99'
            return cleanEnv
          })(),
          
          // 信号处理
          handleSIGINT: false,
          handleSIGTERM: false,
        }
        
        const contextOptions = {
          // 🔥 关键：简化配置，确保JavaScript能正常执行
          viewport: null,
          locale: 'zh-CN',
          timezoneId: 'Asia/Shanghai',
          
          // 🔥 关键：允许JavaScript执行
          javaScriptEnabled: true,
          
          // 🔥 关键：忽略HTTPS错误，确保外部资源能加载
          ignoreHTTPSErrors: true,
        }
        
        // 🔥 关键9：按照playwright-mcp的方式合并配置
        const finalOptions = {
          ...launchOptions,
          ...contextOptions,
        }
        
        console.log('🔧 启动配置:', {
          assistantMode: finalOptions.assistantMode,
          channel: finalOptions.channel,
          chromiumSandbox: finalOptions.chromiumSandbox,
          userDataDir
        })
        
        const browserContext = await chromium.launchPersistentContext(userDataDir, finalOptions)

        // 🔥 关键：移除所有请求拦截，确保JavaScript资源能正常加载
        // 不设置任何 route 拦截，让所有资源正常加载

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

  // 🔥 移除请求拦截方法，确保所有资源都能正常加载

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
    
    const result = path.join(cacheDirectory, 'ms-playwright', 'mcp-chrome-profile')
    await fs.promises.mkdir(result, { recursive: true })
    
    return result
  }
}

export function createBrowserContextFactory(
  options: { extensionMode?: boolean; port?: number; userDataDir?: string } = {}
): BrowserContextFactory {
  if (options.extensionMode) {
    console.log('🚀 使用扩展模式创建浏览器上下文工厂')
    return new ExtensionContextFactory(options.port || 9223)
  }
  console.log('🚀 使用持久化模式创建浏览器上下文工厂')
  return new PersistentContextFactory(options.userDataDir)
}