import { Page } from 'playwright'
import { WebsiteAdapter, SelectorConfig } from './base-adapter'

export class TongyiAdapter extends WebsiteAdapter {
  readonly websiteId = 'tongyi'
  readonly websiteName = '通义千问'
  readonly websiteUrl = 'https://tongyi.aliyun.com/qianwen/'
  readonly requiresProxy = false

  getSelectors(): SelectorConfig {
    return {
      inputArea: [
        // 通义千问最新界面选择器
        'div[contenteditable="true"]',
        'textarea[placeholder*="请输入你想问的问题"]',
        'textarea[placeholder*="输入问题"]',
        'textarea[placeholder*="通义千问"]',
        'textarea[placeholder*="和通义千问聊天"]',
        'div[placeholder*="请输入你想问的问题"]',
        'div[placeholder*="输入问题"]',
        '.input-area textarea',
        '.chat-input',
        '.message-input',
        'textarea',
        '[contenteditable="true"]',
        '[role="textbox"]'
      ],
      sendButton: [
        'button[type="submit"]',
        'button:has-text("发送")',
        'button:has-text("Send")',
        '.send-button',
        'button[aria-label="发送"]',
        'button[aria-label="Send"]',
        '.send-btn',
        'button:has(svg)',
        'button:last-child'
      ],
      chatContainer: [
        '.chat-container',
        '.conversation',
        '.messages',
        '.chat-messages',
        '.message-list'
      ]
    }
  }

  isCurrentWebsite(url: string): boolean {
    return url.includes('tongyi.aliyun.com') || 
           url.includes('qianwen.aliyun.com') ||
           url.includes('dashscope.aliyun.com')
  }

  async isPageReady(page: Page): Promise<boolean> {
    try {
      // 等待页面基本加载完成
      await page.waitForLoadState('domcontentloaded', { timeout: 30000 })
      
      // 检查是否有输入框或主要内容
      const hasInput = await page.locator(this.getSelectors().inputArea.join(', ')).first().isVisible({ timeout: 5000 }).catch(() => false)
      const hasContent = await page.locator('body').isVisible({ timeout: 5000 }).catch(() => false)
      
      return hasInput || hasContent
    } catch (error) {
      console.warn('⚠️ 通义千问页面就绪检查失败:', error)
      return true // 如果检查失败，假设页面已就绪
    }
  }
}