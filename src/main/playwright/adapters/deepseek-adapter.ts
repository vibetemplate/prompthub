import { Page } from 'playwright'
import { WebsiteAdapter } from './base-adapter'

export class DeepSeekAdapter extends WebsiteAdapter {
  protected websiteType = 'deepseek'
  protected selectors = {
    inputArea: 'textarea[placeholder*="输入"]',
    sendButton: '[data-testid="send-button"], button[type="submit"]',
    chatContainer: '.chat-container',
    lastMessage: '.message:last-child',
  }

  async executePrompt(page: Page, prompt: string): Promise<void> {
    try {
      console.log('🤖 DeepSeek: Starting prompt execution...')
      
      // 等待页面加载完成
      await page.waitForSelector(this.selectors.inputArea, { timeout: 15000 })
      
      // 清空输入框并输入提示词 - 使用Playwright的更简洁方式
      await page.click(this.selectors.inputArea)
      await page.keyboard.press('Control+KeyA')
      await page.fill(this.selectors.inputArea, prompt)
      
      // 等待一下让内容加载
      await page.waitForTimeout(500)
      
      // 查找并点击发送按钮 - 使用Playwright的locator
      const sendButton = page.locator(this.selectors.sendButton).first()
      if (await sendButton.isVisible()) {
        await sendButton.click()
        console.log('🤖 DeepSeek: Send button clicked')
      } else {
        // 如果找不到发送按钮，尝试回车
        await page.keyboard.press('Enter')
        console.log('🤖 DeepSeek: Used Enter key')
      }
      
      // 等待响应
      await this.waitForResponse(page)
      
    } catch (error) {
      console.error('❌ DeepSeek adapter error:', error)
      throw error
    }
  }

  protected async waitForResponse(page: Page): Promise<void> {
    try {
      console.log('🤖 DeepSeek: Waiting for response...')
      
      // 等待新消息出现 - Playwright的waitForFunction更简洁
      await page.waitForFunction(() => {
        const messages = document.querySelectorAll('.message, [data-testid="message"]')
        return messages.length > 0
      }, { timeout: 30000 })
      
      console.log('🤖 DeepSeek: Message appeared, waiting for completion...')
      
      // 等待响应完成（检查是否有正在打字的指示器）
      await page.waitForFunction(() => {
        const typingIndicator = document.querySelector('[data-testid="typing-indicator"], .typing-indicator')
        return !typingIndicator || typingIndicator.style.display === 'none'
      }, { timeout: 60000 })
      
      console.log('✅ DeepSeek: Response completed')
      
    } catch (error) {
      console.warn('⚠️ DeepSeek: Failed to wait for complete response, continuing:', error)
    }
  }
}