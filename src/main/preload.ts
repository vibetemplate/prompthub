import { contextBridge, ipcRenderer } from 'electron'

export interface ElectronAPI {
  // 提示词管理
  prompts: {
    getAll: () => Promise<any[]>
    create: (prompt: any) => Promise<any>
    update: (id: string, prompt: any) => Promise<any>
    delete: (id: string) => Promise<void>
    import: (filePath: string) => Promise<any[]>
    export: (filePath: string, prompts: any[]) => Promise<void>
  }
  
  // 浏览器自动化
  browser: {
    openTab: (url: string) => Promise<string>
    closeTab: (tabId: string) => Promise<void>
    executePrompt: (tabId: string, websiteType: string, prompt: string) => Promise<void>
    getPageContent: (tabId: string) => Promise<string>
    getTabs: () => Promise<any[]>
  }
  
  // 设置管理
  settings: {
    get: (key: string) => Promise<any>
    set: (key: string, value: any) => Promise<void>
    getAll: () => Promise<any>
  }
}

const electronAPI: ElectronAPI = {
  prompts: {
    getAll: () => ipcRenderer.invoke('prompts:getAll'),
    create: (prompt) => ipcRenderer.invoke('prompts:create', prompt),
    update: (id, prompt) => ipcRenderer.invoke('prompts:update', id, prompt),
    delete: (id) => ipcRenderer.invoke('prompts:delete', id),
    import: (filePath) => ipcRenderer.invoke('prompts:import', filePath),
    export: (filePath, prompts) => ipcRenderer.invoke('prompts:export', filePath, prompts),
  },
  
  browser: {
    openTab: (url) => ipcRenderer.invoke('browser:openTab', url),
    closeTab: (tabId) => ipcRenderer.invoke('browser:closeTab', tabId),
    executePrompt: (tabId, websiteType, prompt) => ipcRenderer.invoke('browser:executePrompt', tabId, websiteType, prompt),
    getPageContent: (tabId) => ipcRenderer.invoke('browser:getPageContent', tabId),
    getTabs: () => ipcRenderer.invoke('browser:getTabs'),
  },
  
  settings: {
    get: (key) => ipcRenderer.invoke('settings:get', key),
    set: (key, value) => ipcRenderer.invoke('settings:set', key, value),
    getAll: () => ipcRenderer.invoke('settings:getAll'),
  },
}

contextBridge.exposeInMainWorld('electronAPI', electronAPI)