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
        'textarea[placeholder*="请输入你想问的问题"]',
        'textarea[placeholder*="输入问题"]',
        'textarea[placeholder*="通义千问"]',
        '.input-area textarea',
        'textarea',
        '[contenteditable="true"]'
      ],
      sendButton: [
        'button[type="submit"]',
        'button:has-text("发送")',
        'button:has-text("Send")',
        '.send-button',
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
    return url.includes('tongyi.aliyun.com') || 
           url.includes('qianwen.aliyun.com')
  }
}