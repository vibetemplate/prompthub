import { app, BrowserWindow, ipcMain } from 'electron'
import * as path from 'path'
import { setupIpcHandlers } from './ipc/handlers'
import { PlaywrightController } from './playwright/controller'

// 🔥 切换到持久化模式 (扩展模式需要手动安装Chrome扩展)
const USE_EXTENSION_MODE = false

// 检测开发模式
const isDev = process.env.NODE_ENV === 'development'

let mainWindow: BrowserWindow | null = null
let playwrightController: PlaywrightController | null = null

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: !isDev,
    },
  })

  console.log('isDev:', isDev)
  
  if (isDev) {
    console.log('Loading dev URL: http://localhost:8080')
    mainWindow.loadURL('http://localhost:8080')
    mainWindow.webContents.openDevTools()
  } else {
    console.log('Loading file:', path.join(__dirname, '../renderer/index.html'))
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'))
  }

  // 添加加载错误处理
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.error('Failed to load:', errorCode, errorDescription)
  })

  mainWindow.webContents.on('did-finish-load', () => {
    console.log('Window finished loading')
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

app.whenReady().then(() => {
  createWindow()
  
  // 初始化Playwright控制器
  playwrightController = new PlaywrightController({
    extensionMode: USE_EXTENSION_MODE
  })
  
  // 设置IPC处理程序
  setupIpcHandlers(playwrightController)

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', async () => {
  if (playwrightController) {
    await playwrightController.cleanup()
  }
})