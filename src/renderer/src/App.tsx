import React, { useState, useEffect } from 'react'
import { Layout, message } from 'antd'
import { Header } from './components/Header'
import { Sidebar } from './components/Sidebar'
import { Workbench } from './components/Workbench'
import { usePromptStore } from './stores/prompt-store'
import { useBrowserStore } from './stores/browser-store'

const { Content } = Layout

const App: React.FC = () => {
  const [loading, setLoading] = useState(true)
  const { loadPrompts } = usePromptStore()
  const { loadTabs } = useBrowserStore()

  useEffect(() => {
    const initializeApp = async () => {
      try {
        await Promise.all([
          loadPrompts(),
          loadTabs(),
        ])
      } catch (error) {
        console.error('Failed to initialize app:', error)
        message.error('应用初始化失败')
      } finally {
        setLoading(false)
      }
    }

    initializeApp()
  }, [loadPrompts, loadTabs])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-lg">正在加载...</div>
      </div>
    )
  }

  return (
    <Layout className="prompt-hub-layout">
      <Header />
      <Content className="prompt-hub-content">
        <Sidebar />
        <main className="prompt-hub-main">
          <Workbench />
        </main>
      </Content>
    </Layout>
  )
}

export default App