import { Page } from 'playwright'

export abstract class WebsiteAdapter {
  protected abstract websiteType: string
  protected abstract selectors: {
    inputArea: string
    sendButton: string
    chatContainer?: string
    lastMessage?: string
  }

  async executePrompt(page: Page, prompt: string): Promise<void> {
    try {
      console.log(`🚀 Executing prompt on ${this.websiteType}...`)
      
      // 等待页面加载
      await page.waitForSelector(this.selectors.inputArea, { timeout: 10000 })
      
      // 清空输入框 - Playwright的键盘操作更简洁
      await page.click(this.selectors.inputArea)
      await page.keyboard.press('Control+KeyA')
      
      // 输入提示词 - Playwright的fill方法更可靠
      await page.fill(this.selectors.inputArea, prompt)
      
      // 等待一会儿让内容加载
      await page.waitForTimeout(500)
      
      // 点击发送按钮
      await page.click(this.selectors.sendButton)
      
      console.log(`✅ Prompt sent successfully on ${this.websiteType}`)
      
      // 等待发送完成
      await this.waitForResponse(page)
      
    } catch (error) {
      console.error(`❌ Failed to execute prompt on ${this.websiteType}:`, error)
      throw error
    }
  }

  protected async waitForResponse(page: Page): Promise<void> {
    // 基础实现：等待2秒
    await page.waitForTimeout(2000)
  }

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