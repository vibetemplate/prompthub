import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'

export interface BrowserTab {
  id: string
  url: string
  title: string
  websiteType?: string
  isActive?: boolean
}

interface BrowserState {
  tabs: BrowserTab[]
  activeTabId: string | null
  isLoading: boolean
  error: string | null
}

interface BrowserActions {
  loadTabs: () => Promise<void>
  openTab: (url: string) => Promise<void>
  closeTab: (tabId: string) => Promise<void>
  setActiveTab: (tabId: string) => void
  executePrompt: (tabId: string, websiteType: string, prompt: string) => Promise<void>
  getPageContent: (tabId: string) => Promise<string>
  setError: (error: string | null) => void
  setLoading: (loading: boolean) => void
}

export const useBrowserStore = create<BrowserState & BrowserActions>()(
  immer((set, get) => ({
    tabs: [],
    activeTabId: null,
    isLoading: false,
    error: null,

    loadTabs: async () => {
      try {
        set((state) => {
          state.isLoading = true
          state.error = null
        })
        
        const tabs = await window.electronAPI.browser.getTabs()
        
        set((state) => {
          state.tabs = tabs
          state.isLoading = false
          
          // 如果有标签但没有活动标签，设置第一个为活动标签
          if (tabs.length > 0 && !state.activeTabId) {
            state.activeTabId = tabs[0].id
          }
        })
      } catch (error) {
        console.error('Failed to load tabs:', error)
        set((state) => {
          state.error = error instanceof Error ? error.message : 'Failed to load tabs'
          state.isLoading = false
        })
      }
    },

    openTab: async (url: string) => {
      try {
        set((state) => {
          state.isLoading = true
          state.error = null
        })
        
        const tabId = await window.electronAPI.browser.openTab(url)
        
        // 重新加载标签列表
        await get().loadTabs()
        
        set((state) => {
          state.activeTabId = tabId
          state.isLoading = false
        })
      } catch (error) {
        console.error('Failed to open tab:', error)
        set((state) => {
          state.error = error instanceof Error ? error.message : 'Failed to open tab'
          state.isLoading = false
        })
      }
    },

    closeTab: async (tabId: string) => {
      try {
        set((state) => {
          state.isLoading = true
          state.error = null
        })
        
        await window.electronAPI.browser.closeTab(tabId)
        
        set((state) => {
          // 从本地状态中移除标签
          const tabIndex = state.tabs.findIndex(tab => tab.id === tabId)
          if (tabIndex > -1) {
            state.tabs.splice(tabIndex, 1)
          }
          
          // 如果关闭的是活动标签，切换到其他标签
          if (state.activeTabId === tabId) {
            if (state.tabs.length > 0) {
              state.activeTabId = state.tabs[0].id
            } else {
              state.activeTabId = null
            }
          }
          
          state.isLoading = false
        })
      } catch (error) {
        console.error('Failed to close tab:', error)
        set((state) => {
          state.error = error instanceof Error ? error.message : 'Failed to close tab'
          state.isLoading = false
        })
      }
    },

    setActiveTab: (tabId: string) => {
      set((state) => {
        state.activeTabId = tabId
      })
    },

    executePrompt: async (tabId: string, websiteType: string, prompt: string) => {
      try {
        set((state) => {
          state.isLoading = true
          state.error = null
        })
        
        await window.electronAPI.browser.executePrompt(tabId, websiteType, prompt)
        
        set((state) => {
          state.isLoading = false
        })
      } catch (error) {
        console.error('Failed to execute prompt:', error)
        set((state) => {
          state.error = error instanceof Error ? error.message : 'Failed to execute prompt'
          state.isLoading = false
        })
        throw error
      }
    },

    getPageContent: async (tabId: string) => {
      try {
        return await window.electronAPI.browser.getPageContent(tabId)
      } catch (error) {
        console.error('Failed to get page content:', error)
        set((state) => {
          state.error = error instanceof Error ? error.message : 'Failed to get page content'
        })
        throw error
      }
    },

    setError: (error: string | null) => {
      set((state) => {
        state.error = error
      })
    },

    setLoading: (loading: boolean) => {
      set((state) => {
        state.isLoading = loading
      })
    },
  }))
)