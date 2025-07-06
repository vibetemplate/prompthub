import { Page } from 'playwright'
import { WebsiteAdapter } from './base-adapter'

export class ChatGPTAdapter extends WebsiteAdapter {
  protected websiteType = 'chatgpt'
  protected selectors = {
    inputArea: '#prompt-textarea, textarea[data-id="root"]',
    sendButton: '[data-testid="send-button"], button[aria-label="Send prompt"]',
    chatContainer: '.conversation-content',
    lastMessage: '[data-message-author-role="assistant"]:last-child',
  }

  async executePrompt(page: Page, prompt: string): Promise<void> {
    try {
      console.log('💬 ChatGPT: Starting prompt execution...')
      
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
        console.log('💬 ChatGPT: Send button clicked')
      } else {
        // 如果找不到发送按钮，尝试回车
        await page.keyboard.press('Enter')
        console.log('💬 ChatGPT: Used Enter key')
      }
      
      // 等待响应
      await this.waitForResponse(page)
      
    } catch (error) {
      console.error('❌ ChatGPT adapter error:', error)
      throw error
    }
  }

  protected async waitForResponse(page: Page): Promise<void> {
    try {
      console.log('💬 ChatGPT: Waiting for response...')
      
      // 等待新消息出现 - Playwright的waitForFunction更简洁
      await page.waitForFunction(() => {
        const messages = document.querySelectorAll('[data-message-author-role="assistant"]')
        return messages.length > 0
      }, { timeout: 30000 })
      
      console.log('💬 ChatGPT: Message appeared, waiting for completion...')
      
      // 等待响应完成（检查是否有正在打字的指示器）
      await page.waitForFunction(() => {
        const stopButton = document.querySelector('[data-testid="stop-button"]')
        return !stopButton || stopButton.getAttribute('disabled') === 'true'
      }, { timeout: 60000 })
      
      console.log('✅ ChatGPT: Response completed')
      
    } catch (error) {
      console.warn('⚠️ ChatGPT: Failed to wait for complete response, continuing:', error)
    }
  }
}