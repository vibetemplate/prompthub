import { Page } from 'playwright'
import { WebsiteAdapter, SelectorConfig } from './base-adapter'

export class GeminiAdapter extends WebsiteAdapter {
  readonly websiteId = 'gemini'
  readonly websiteName = 'Gemini'
  readonly websiteUrl = 'https://gemini.google.com/'
  readonly requiresProxy = true

  getSelectors(): SelectorConfig {
    return {
      inputArea: [
        'textarea[placeholder*="Enter a prompt here"]',
        'textarea[placeholder*="输入提示"]',
        'textarea[data-testid="textbox"]',
        '.ql-editor',
        'textarea',
        '[contenteditable="true"]'
      ],
      sendButton: [
        'button[aria-label*="Send"]',
        'button[aria-label*="发送"]',
        'button[data-testid="send-button"]',
        'button:has-text("Send")',
        'button:has-text("发送")'
      ],
      chatContainer: [
        '.conversation-container',
        '.chat-container',
        '.messages'
      ]
    }
  }

  isCurrentWebsite(url: string): boolean {
    return url.includes('gemini.google.com') || 
           url.includes('bard.google.com')
  }
}