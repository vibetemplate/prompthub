import { WebsiteAdapter, SelectorConfig } from './base-adapter'

export class ChatGPTAdapter extends WebsiteAdapter {
  readonly websiteId = 'chatgpt'
  readonly websiteName = 'ChatGPT'
  readonly websiteUrl = 'https://chatgpt.com/'
  readonly requiresProxy = true

  getSelectors(): SelectorConfig {
    return {
      inputArea: [
        '#prompt-textarea',
        'textarea[data-id="root"]',
        '[data-testid="textbox"]',
        '[placeholder*="Message ChatGPT"]',
        '[placeholder*="Send a message"]',
        'textarea[placeholder*="Message ChatGPT"]',
        'textarea[placeholder*="Send a message"]',
        '.ProseMirror',
        '[contenteditable="true"]'
      ],
      sendButton: [
        '[data-testid="send-button"]',
        'button[aria-label="Send prompt"]',
        'button[aria-label="Send message"]',
        'button[aria-label="发送消息"]',
        'button:has-text("Send")',
        'button:has-text("发送")',
        '[data-testid="fruitjuice-send-button"]'
      ],
      chatContainer: [
        '.conversation-content',
        '[data-testid="conversation"]',
        '.chat-messages'
      ],
      lastMessage: [
        '[data-message-author-role="assistant"]:last-child'
      ]
    }
  }

  isCurrentWebsite(url: string): boolean {
    return url.includes('chat.openai.com') || 
           url.includes('chatgpt.com') ||
           url.includes('openai.com/chat')
  }

  /**
   * ChatGPT 特定的响应等待逻辑
   */
  protected async waitForResponse(page: Page): Promise<void> {
    try {
      console.log('💬 ChatGPT: 等待响应...')
      
      // 等待新消息出现
      await page.waitForFunction(() => {
        const messages = document.querySelectorAll('[data-message-author-role="assistant"]')
        return messages.length > 0
      }, { timeout: 30000 })
      
      // 等待响应完成（检查停止按钮是否禁用）
      await page.waitForFunction(() => {
        const stopButton = document.querySelector('[data-testid="stop-button"]')
        return !stopButton || stopButton.getAttribute('disabled') === 'true'
      }, { timeout: 60000 })
      
      console.log('✅ ChatGPT: 响应完成')
      
    } catch (error) {
      console.warn('⚠️ ChatGPT: 等待响应失败:', error)
    }
  }
}