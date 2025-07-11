import React, { useState, useEffect } from 'react'
import { Tabs, Button, Space, Empty, Typography, Row, Col } from 'antd'
import { PlusOutlined, CloseOutlined, GlobalOutlined } from '@ant-design/icons'
import { useBrowserStore } from '../stores/browser-store'

const { Text } = Typography

interface SupportedWebsite {
  id: string
  name: string
  url: string
  requiresProxy: boolean
}

export const Workbench: React.FC = () => {
  const { tabs, activeTabId, setActiveTab, closeTab, openTab } = useBrowserStore()
  const [supportedWebsites, setSupportedWebsites] = useState<SupportedWebsite[]>([])

  useEffect(() => {
    const loadSupportedWebsites = async () => {
      try {
        const websites = await window.electronAPI.browser.getSupportedWebsites()
        setSupportedWebsites(websites)
      } catch (error) {
        console.error('Failed to load supported websites:', error)
      }
    }
    
    loadSupportedWebsites()
  }, [])

  const handleTabChange = (key: string) => {
    setActiveTab(key)
  }

  const handleTabEdit = (targetKey: React.MouseEvent | React.KeyboardEvent | string, action: 'add' | 'remove') => {
    if (action === 'add') {
      // 默认打开第一个支持的网站
      const firstWebsite = supportedWebsites[0]
      if (firstWebsite) {
        openTab(firstWebsite.url)
      }
    } else {
      closeTab(targetKey as string)
    }
  }

  const renderTabPane = (tab: any) => {
    const isActive = tab.id === activeTabId
    
    return (
      <div key={tab.id} className={`browser-content ${isActive ? 'active' : 'hidden'}`}>
        <div style={{ 
          width: '100%', 
          height: '100%', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          background: '#f5f5f5' 
        }}>
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <GlobalOutlined style={{ fontSize: '48px', color: '#1677ff', marginBottom: '16px' }} />
            <div>
              <Text strong>{tab.title}</Text>
              <br />
              <Text type="secondary">{tab.url}</Text>
            </div>
            <div style={{ marginTop: '16px' }}>
              <Text type="secondary">
                浏览器标签页正在后台运行
              </Text>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const tabItems = tabs.map(tab => ({
    key: tab.id,
    label: (
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span>{tab.title}</span>
        <Button
          type="text"
          size="small"
          icon={<CloseOutlined />}
          onClick={(e) => {
            e.stopPropagation()
            closeTab(tab.id)
          }}
          style={{ 
            fontSize: '12px', 
            width: '16px', 
            height: '16px',
            minWidth: 'auto' 
          }}
        />
      </div>
    ),
    children: renderTabPane(tab),
  }))

  if (tabs.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="暂无打开的标签页"
          style={{ marginBottom: '40px' }}
        >
          <div style={{ maxWidth: '600px' }}>
            <Text type="secondary" style={{ marginBottom: '16px', display: 'block' }}>
              选择要打开的 AI 网站：
            </Text>
            <Row gutter={[12, 12]}>
              {supportedWebsites.map((website, index) => (
                <Col key={website.id} span={12} md={8} lg={6}>
                  <Button
                    type={index === 0 ? "primary" : "default"}
                    icon={<PlusOutlined />}
                    onClick={() => openTab(website.url)}
                    style={{ width: '100%' }}
                    size="small"
                  >
                    {website.name}
                    {website.requiresProxy && (
                      <span style={{ fontSize: '10px', opacity: 0.7 }}> (需代理)</span>
                    )}
                  </Button>
                </Col>
              ))}
            </Row>
            {supportedWebsites.length === 0 && (
              <Text type="secondary">正在加载支持的网站...</Text>
            )}
          </div>
        </Empty>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      <div className="browser-tabs">
        <Tabs
          type="editable-card"
          activeKey={activeTabId || undefined}
          onChange={handleTabChange}
          onEdit={handleTabEdit}
          items={tabItems}
          size="small"
          style={{ minHeight: 'auto' }}
          tabBarStyle={{ margin: 0 }}
        />
      </div>
      
      <div className="browser-content flex-1">
        {tabs.map(tab => (
          <div
            key={tab.id}
            className={`h-full ${tab.id === activeTabId ? 'block' : 'hidden'}`}
          >
            {renderTabPane(tab)}
          </div>
        ))}
      </div>
    </div>
  )
}