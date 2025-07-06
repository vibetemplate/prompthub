import { Page } from 'playwright'
import { WebsiteAdapter, SelectorConfig } from './base-adapter'

export class KimiAdapter extends WebsiteAdapter {
  readonly websiteId = 'kimi'
  readonly websiteName = 'Kimi'
  readonly websiteUrl = 'https://kimi.moonshot.cn/'
  readonly requiresProxy = false

  getSelectors(): SelectorConfig {
    return {
      inputArea: [
        'textarea[placeholder*="请输入你的问题"]',
        'textarea[placeholder*="Kimi"]',
        '.chat-input textarea',
        'textarea',
        '[contenteditable="true"]'
      ],
      sendButton: [
        'button[type="submit"]',
        'button:has-text("发送")',
        'button:has-text("Send")',
        '.send-btn',
        'button[aria-label="发送"]'
      ],
      chatContainer: [
        '.chat-container',
        '.conversation',
        '.messages'
      ]
    }
  }

  isCurrentWebsite(url: string): boolean {
    return url.includes('kimi.moonshot.cn') || 
           url.includes('moonshot.cn')
  }
}