import { Page } from 'playwright'
import { WebsiteAdapter, SelectorConfig } from './base-adapter'

export class ClaudeAdapter extends WebsiteAdapter {
  readonly websiteId = 'claude'
  readonly websiteName = 'Claude'
  readonly websiteUrl = 'https://claude.ai/'
  readonly requiresProxy = true

  getSelectors(): SelectorConfig {
    return {
      inputArea: [
        '[data-testid="chat-input"]',
        '[placeholder*="Talk to Claude"]',
        '[placeholder*="与Claude对话"]',
        'div[contenteditable="true"]',
        'textarea[placeholder*="Claude"]',
        '.ProseMirror',
        '[role="textbox"]'
      ],
      sendButton: [
        '[data-testid="send-button"]',
        'button[aria-label="Send Message"]',
        'button[aria-label="发送消息"]',
        'button:has-text("Send")',
        'button:has-text("发送")',
        'button[type="submit"]'
      ],
      chatContainer: [
        '[data-testid="conversation"]',
        '.conversation',
        '.chat-messages'
      ]
    }
  }

  isCurrentWebsite(url: string): boolean {
    return url.includes('claude.ai') || 
           url.includes('anthropic.com/claude')
  }

  protected async waitForResponse(page: Page): Promise<void> {
    try {
      console.log('🎭 Claude: 等待响应...')
      
      // 等待响应开始
      await page.waitForTimeout(2000)
      
      // 等待响应完成 - Claude通常会有停止按钮
      await page.waitForFunction(() => {
        const stopButton = document.querySelector('button[aria-label*="Stop"]')
        return !stopButton
      }, { timeout: 60000 }).catch(() => {})
      
      console.log('✅ Claude: 响应完成')
      
    } catch (error) {
      console.warn('⚠️ Claude: 等待响应失败:', error)
    }
  }
}