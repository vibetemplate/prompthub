import { Page, BrowserContext } from 'playwright'

/**
 * 使用 Playwright 内部 API 执行操作，避免被追踪检测
 * 这是 playwright-mcp 中最关键的反检测技术
 */
export async function callOnPageNoTrace<T>(
  page: Page, 
  callback: (page: Page) => Promise<T>
): Promise<T> {
  return await (page as any)._wrapApiCall(() => callback(page), { internal: true })
}

/**
 * 使用内部 API 执行上下文操作
 */
export async function callOnContextNoTrace<T>(
  context: BrowserContext,
  callback: (context: BrowserContext) => Promise<T>
): Promise<T> {
  return await (context as any)._wrapApiCall(() => callback(context), { internal: true })
}

/**
 * 网络请求等待完成的工具函数
 */
export async function waitForNetworkIdle(page: Page, timeout: number = 5000): Promise<void> {
  return new Promise<void>((resolve) => {
    let timer: NodeJS.Timeout
    const requests = new Set<string>()

    const onRequest = (request: any) => {
      requests.add(request.url())
      clearTimeout(timer)
    }

    const onResponse = (response: any) => {
      requests.delete(response.url())
      if (requests.size === 0) {
        timer = setTimeout(() => {
          page.off('request', onRequest)
          page.off('response', onResponse)
          resolve()
        }, 1000)
      }
    }

    page.on('request', onRequest)
    page.on('response', onResponse)

    // 超时保护
    setTimeout(() => {
      page.off('request', onRequest)
      page.off('response', onResponse)
      resolve()
    }, timeout)

    // 如果当前没有请求，直接resolve
    if (requests.size === 0) {
      timer = setTimeout(() => {
        page.off('request', onRequest)
        page.off('response', onResponse)
        resolve()
      }, 1000)
    }
  })
}

/**
 * 模拟真实的人类行为延迟
 */
export async function humanDelay(min: number = 100, max: number = 300): Promise<void> {
  const delay = Math.random() * (max - min) + min
  await new Promise(resolve => setTimeout(resolve, delay))
}

/**
 * 随机鼠标移动模拟人类行为
 */
export async function simulateHumanBehavior(page: Page): Promise<void> {
  // 随机移动鼠标
  const x = Math.random() * 800 + 100
  const y = Math.random() * 600 + 100
  const steps = Math.floor(Math.random() * 10) + 5
  
  await callOnPageNoTrace(page, async (page) => {
    await page.mouse.move(x, y, { steps })
  })
  
  // 随机延迟
  await humanDelay(500, 1500)
}

/**
 * 高级的页面加载等待策略
 */
export async function waitForPageReady(page: Page, timeout: number = 30000): Promise<void> {
  try {
    // 等待DOM加载
    await callOnPageNoTrace(page, async (page) => {
      await page.waitForLoadState('domcontentloaded', { timeout })
    })
    
    // 等待网络空闲
    await waitForNetworkIdle(page, 5000)
    
    // 等待一些常见的加载指示器消失
    await callOnPageNoTrace(page, async (page) => {
      await page.waitForFunction(() => {
        const loadingElements = document.querySelectorAll('[class*="loading"], [class*="spinner"], [id*="loading"]')
        return loadingElements.length === 0
      }, { timeout: 10000 }).catch(() => {})
    })
    
  } catch (error) {
    console.warn('⚠️ 页面加载等待超时，继续执行:', error)
  }
}

/**
 * 检查页面是否被Cloudflare拦截
 */
export async function isCloudflareChallenge(page: Page): Promise<boolean> {
  try {
    return await callOnPageNoTrace(page, async (page) => {
      const title = await page.title()
      const url = page.url()
      const content = await page.content()
      
      // 多重检查确保准确识别
      const titleCheck = title.includes('Just a moment') || 
                        title.includes('Please wait') ||
                        title.includes('Checking your browser')
      
      const urlCheck = url.includes('challenge-platform') ||
                      url.includes('cf_challenge') ||
                      url.includes('__cf_chl_jschl_tk__')
      
      const contentCheck = content.includes('cf-browser-verification') ||
                          content.includes('checking your browser') ||
                          content.includes('Please stand by') ||
                          content.includes('Ray ID:') ||
                          content.includes('cloudflare')
      
      return titleCheck || urlCheck || contentCheck
    })
  } catch {
    return false
  }
}

/**
 * 尝试处理Cloudflare挑战
 */
export async function handleCloudflareChallenge(page: Page): Promise<boolean> {
  try {
    console.log('🔍 检测到Cloudflare挑战，等待验证完成...')
    
    // 等待挑战完成 - 增加超时时间并添加更多检查条件
    await callOnPageNoTrace(page, async (page) => {
      // 等待最多60秒让Cloudflare验证完成
      await page.waitForFunction(() => {
        const title = document.title
        const bodyText = document.body?.textContent || ''
        const url = window.location.href
        
        // 检查多个条件确保验证完成
        return !title.includes('Just a moment') && 
               !title.includes('Please wait') &&
               !bodyText.includes('Checking your browser') &&
               !bodyText.includes('Please stand by') &&
               !url.includes('challenge-platform')
      }, { timeout: 60000 })
    })
    
    // 验证完成后再等待一下确保页面完全加载
    await humanDelay(2000, 3000)
    
    console.log('✅ Cloudflare挑战验证完成')
    return true
  } catch (error) {
    console.warn('⚠️ Cloudflare挑战等待超时，尝试继续:', error)
    // 不抛出错误，让流程继续
    return false
  }
}