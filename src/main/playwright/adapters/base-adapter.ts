import { Page } from 'playwright'

/**
 * 网站适配器接口
 */
export interface IWebsiteAdapter {
  /**
   * 网站标识
   */
  readonly websiteId: string
  
  /**
   * 网站名称
   */
  readonly websiteName: string
  
  /**
   * 网站URL
   */
  readonly websiteUrl: string
  
  /**
   * 是否需要代理访问
   */
  readonly requiresProxy: boolean
  
  /**
   * 检测当前页面是否为该网站
   */
  isCurrentWebsite(url: string): boolean
  
  /**
   * 执行提示词
   */
  executePrompt(page: Page, prompt: string): Promise<void>
  
  /**
   * 获取选择器配置
   */
  getSelectors(): SelectorConfig
  
  /**
   * 验证页面是否已加载完成
   */
  isPageReady(page: Page): Promise<boolean>
}

/**
 * 选择器配置接口
 */
export interface SelectorConfig {
  inputArea: string[]
  sendButton: string[]
  chatContainer?: string[]
  lastMessage?: string[]
}

export abstract class WebsiteAdapter implements IWebsiteAdapter {
  abstract readonly websiteId: string
  abstract readonly websiteName: string
  abstract readonly websiteUrl: string
  abstract readonly requiresProxy: boolean

  /**
   * 通用选择器，作为备选方案
   */
  protected readonly commonSelectors = {
    inputArea: [
      'textarea[placeholder*="输入"]',
      'textarea[placeholder*="请输入"]', 
      'textarea[placeholder*="Message"]',
      'textarea[placeholder*="Enter"]',
      'textarea[placeholder*="输入消息"]',
      'textarea[placeholder*="请输入消息"]',
      '[contenteditable="true"]',
      'input[type="text"]',
      'textarea',
      '[role="textbox"]'
    ],
    sendButton: [
      'button[type="submit"]',
      'button:has-text("发送")',
      'button:has-text("Send")',
      'button:has-text("提交")',
      '[data-testid*="send"]',
      '[aria-label*="发送"]',
      '[aria-label*="Send"]',
      'button[disabled="false"]'
    ]
  }

  /**
   * 检测当前页面是否为该网站
   */
  isCurrentWebsite(url: string): boolean {
    try {
      const urlObj = new URL(url)
      const websiteUrlObj = new URL(this.websiteUrl)
      return urlObj.hostname.includes(websiteUrlObj.hostname)
    } catch {
      return false
    }
  }

  /**
   * 获取选择器配置（子类需要实现）
   */
  abstract getSelectors(): SelectorConfig

  /**
   * 验证页面是否已加载完成
   */
  async isPageReady(page: Page): Promise<boolean> {
    try {
      const selectors = this.getSelectors()
      const result = await page.evaluate((firstSelector) => {
        return document.readyState === 'complete' && 
               document.querySelector(firstSelector) !== null
      }, selectors.inputArea[0])
      return result as boolean
    } catch {
      return false
    }
  }

  /**
   * 执行提示词注入
   */
  async executePrompt(page: Page, prompt: string): Promise<void> {
    try {
      console.log(`🚀 ${this.websiteName} 开始注入提示词...`)
      
      // 等待页面准备完成
      await this.waitForPageReady(page)
      
      // 查找输入框
      const inputElement = await this.findInputElement(page)
      if (!inputElement) {
        throw new Error(`未找到 ${this.websiteName} 的输入框`)
      }
      
      // 清空并输入提示词
      await this.clearAndFillInput(page, inputElement, prompt)
      
      // 查找并点击发送按钮
      const sendButton = await this.findSendButton(page)
      if (sendButton) {
        await page.click(sendButton)
        console.log(`✅ ${this.websiteName} 提示词发送成功`)
      } else {
        // 尝试回车发送
        await page.keyboard.press('Enter')
        console.log(`✅ ${this.websiteName} 通过回车发送提示词`)
      }
      
      // 等待发送完成
      await this.waitForResponse(page)
      
    } catch (error) {
      console.error(`❌ ${this.websiteName} 提示词注入失败:`, error)
      throw error
    }
  }

  /**
   * 等待页面准备完成
   */
  protected async waitForPageReady(page: Page, timeout = 10000): Promise<void> {
    const selectors = this.getSelectors()
    
    // 等待第一个输入框选择器出现
    for (const selector of selectors.inputArea) {
      try {
        await page.waitForSelector(selector, { timeout: timeout / selectors.inputArea.length })
        return
      } catch {
        continue
      }
    }
    
    throw new Error(`页面加载超时，未找到输入框`)
  }

  /**
   * 查找输入框元素
   */
  protected async findInputElement(page: Page): Promise<string | null> {
    const selectors = this.getSelectors()
    const allSelectors = [...selectors.inputArea, ...this.commonSelectors.inputArea]
    
    for (const selector of allSelectors) {
      try {
        const isVisible = await page.isVisible(selector)
        const isEnabled = await page.isEnabled(selector)
        
        if (isVisible && isEnabled) {
          console.log(`✅ 找到输入框: ${selector}`)
          return selector
        }
      } catch {
        continue
      }
    }
    
    return null
  }

  /**
   * 查找发送按钮
   */
  protected async findSendButton(page: Page): Promise<string | null> {
    const selectors = this.getSelectors()
    const allSelectors = [...selectors.sendButton, ...this.commonSelectors.sendButton]
    
    for (const selector of allSelectors) {
      try {
        const isVisible = await page.isVisible(selector)
        const isEnabled = await page.isEnabled(selector)
        
        if (isVisible && isEnabled) {
          console.log(`✅ 找到发送按钮: ${selector}`)
          return selector
        }
      } catch {
        continue
      }
    }
    
    return null
  }

  /**
   * 清空并填充输入框
   */
  protected async clearAndFillInput(page: Page, selector: string, text: string): Promise<void> {
    // 点击输入框获得焦点
    await page.click(selector)
    
    // 全选并清空
    await page.keyboard.press('Control+KeyA')
    await page.keyboard.press('Delete')
    
    // 等待一下确保清空完成
    await page.waitForTimeout(100)
    
    // 输入新文本
    await page.fill(selector, text)
    
    // 等待输入完成
    await page.waitForTimeout(300)
  }

  /**
   * 等待响应（子类可覆盖以实现特定的等待逻辑）
   */
  protected async waitForResponse(page: Page): Promise<void> {
    // 基础实现：等待2秒
    await page.waitForTimeout(2000)
  }

  // === 辅助方法 ===

  protected async waitForSelector(page: Page, selector: string, timeout = 10000): Promise<void> {
    await page.waitForSelector(selector, { timeout })
  }

  protected async safeClick(page: Page, selector: string): Promise<void> {
    await page.waitForSelector(selector, { state: 'visible' })
    await page.click(selector)
  }

  protected async safeType(page: Page, selector: string, text: string): Promise<void> {
    await page.waitForSelector(selector, { state: 'visible' })
    await page.fill(selector, text)
  }

  protected async safeFill(page: Page, selector: string, text: string): Promise<void> {
    await page.waitForSelector(selector, { state: 'visible' })
    await page.fill(selector, text)
  }

  protected async waitForElementState(page: Page, selector: string, state: 'visible' | 'hidden' | 'attached' | 'detached' = 'visible'): Promise<void> {
    await page.waitForSelector(selector, { state })
  }
}