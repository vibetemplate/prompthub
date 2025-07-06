import { Page } from 'playwright'
import { WebsiteAdapter, SelectorConfig } from './base-adapter'

export class DeepSeekAdapter extends WebsiteAdapter {
  readonly websiteId = 'deepseek'
  readonly websiteName = 'DeepSeek'
  readonly websiteUrl = 'https://chat.deepseek.com/'
  readonly requiresProxy = false

  getSelectors(): SelectorConfig {
    return {
      inputArea: [
        'textarea[placeholder="给 DeepSeek 发送消息"]',
        'textarea.chat-input',
        'textarea[placeholder*="DeepSeek"]',
        'textarea[placeholder*="输入"]',
        '.input-area textarea',
        'div[role="textbox"]'
      ],
      sendButton: [
        'button:has(img):not([disabled])',
        'button:not([disabled]):has(img)',
        'button.send-button',
        'button[data-testid="send-button"]',
        'button:has(svg)'
      ],
      chatContainer: [
        '.chat-container',
        '.message-container'
      ],
      lastMessage: [
        '.message:last-child',
        'img + div'
      ]
    }
  }

  isCurrentWebsite(url: string): boolean {
    return url.includes('chat.deepseek.com') || 
           url.includes('deepseek.com/chat')
  }

  /**
   * DeepSeek 特定的响应等待逻辑
   */

  protected async waitForResponse(page: Page): Promise<void> {
    try {
      console.log('🤖 DeepSeek: 等待响应...')
      
      // 等待URL变化，表示已进入对话页面
      if (!page.url().includes('/chat/s/')) {
        await page.waitForURL(url => url.toString().includes('/chat/s/'), { timeout: 10000 })
          .catch(() => console.log('🤖 DeepSeek: URL变化等待超时'))
      }
      
      // 等待响应出现
      await page.waitForSelector('img + div', { timeout: 15000 })
        .catch(() => console.log('🤖 DeepSeek: 等待响应超时'))
      
      // 等待响应完成
      await page.waitForTimeout(3000)
      
      console.log('✅ DeepSeek: 响应完成')
      
    } catch (error) {
      console.warn('⚠️ DeepSeek: 等待响应失败:', error)
    }
  }

  // 重载：DeepSeek专属"人类化输入+防风控"逻辑
  async executePrompt(page: Page, prompt: string): Promise<void> {
    try {
      console.log('🤖 DeepSeek: 开始人类化输入...')

      // 1. 等待页面加载和网络空闲
      await page.waitForLoadState('domcontentloaded', { timeout: 10000 }).catch(() => {})
      await page.waitForTimeout(1200 + Math.random() * 800)

      // 2. 多选择器兜底查找输入框
      const selectors = this.getSelectors().inputArea
      let inputSelector: string | null = null
      for (const sel of selectors) {
        if (await page.$(sel)) {
          inputSelector = sel
          break
        }
      }
      if (!inputSelector) throw new Error('未找到DeepSeek输入框')

      // 3. 鼠标悬停、点击、聚焦
      await page.hover(inputSelector)
      await page.waitForTimeout(300 + Math.random() * 300)
      try {
        await page.click(inputSelector, { delay: 80 + Math.random() * 60 })
      } catch {
        await page.focus(inputSelector)
      }
      await page.waitForTimeout(300 + Math.random() * 300)

      // 4. 清空输入框
      await page.keyboard.press('Control+KeyA')
      await page.waitForTimeout(100 + Math.random() * 100)
      await page.keyboard.press('Delete')
      await page.waitForTimeout(200 + Math.random() * 200)

      // 5. 分批/逐字输入
      await this.typeHumanLike(page, inputSelector, prompt)

      // 6. 等待"思考"时间
      await page.waitForTimeout(800 + Math.random() * 800)

      // 7. 查找发送按钮
      const sendSelectors = this.getSelectors().sendButton
      let sendSelector: string | null = null
      for (const sel of sendSelectors) {
        if (await page.$(sel)) {
          sendSelector = sel
          break
        }
      }

      if (sendSelector) {
        await page.hover(sendSelector)
        await page.waitForTimeout(200 + Math.random() * 200)
        await page.click(sendSelector, { delay: 80 + Math.random() * 60 })
        console.log('🤖 DeepSeek: 发送按钮已点击')
      } else {
        await page.keyboard.press('Enter')
        console.log('🤖 DeepSeek: 未找到发送按钮，已回车')
      }

      // 8. 等待响应
      await this.waitForResponse(page)
    } catch (error) {
      console.error('❌ DeepSeek adapter error:', error)
      throw error
    }
  }

  // 辅助：人类化输入
  private async typeHumanLike(page: Page, selector: string, text: string): Promise<void> {
    await page.fill(selector, '')
    let pos = 0
    while (pos < text.length) {
      const chunk = text.slice(pos, pos + Math.floor(Math.random() * 3) + 1)
      await page.type(selector, chunk, { delay: 40 + Math.random() * 80 })
      pos += chunk.length
      if (Math.random() < 0.2) await page.waitForTimeout(80 + Math.random() * 200)
    }
  }
}