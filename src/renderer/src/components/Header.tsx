import React, { useState } from 'react'
import { Typography, Button, Space, Dropdown, message } from 'antd'
import { 
  PlusOutlined, 
  DownloadOutlined, 
  UploadOutlined, 
  SettingOutlined,
  GlobalOutlined
} from '@ant-design/icons'
import { useBrowserStore } from '../stores/browser-store'
import { usePromptStore } from '../stores/prompt-store'
import { Settings } from './Settings'

const { Title } = Typography

export const Header: React.FC = () => {
  const { openTab } = useBrowserStore()
  const { importPrompts, exportPrompts, prompts } = usePromptStore()
  const [settingsOpen, setSettingsOpen] = useState(false)

  const handleNewTab = async () => {
    try {
      await openTab('https://chat.deepseek.com')
      message.success('已打开 DeepSeek 标签页')
    } catch (error) {
      message.error('打开标签页失败')
    }
  }

  const handleImport = async () => {
    // 这里应该打开文件选择器，暂时用示例路径
    try {
      message.info('导入功能暂未实现')
    } catch (error) {
      message.error('导入失败')
    }
  }

  const handleExport = async () => {
    try {
      message.info('导出功能暂未实现')
    } catch (error) {
      message.error('导出失败')
    }
  }

  const websiteMenuItems = [
    {
      key: 'deepseek',
      label: 'DeepSeek',
      onClick: () => openTab('https://chat.deepseek.com'),
    },
    {
      key: 'chatgpt',
      label: 'ChatGPT',
      onClick: () => openTab('https://chatgpt.com'),
    },
    {
      key: 'claude',
      label: 'Claude',
      onClick: () => openTab('https://claude.ai'),
    },
    {
      key: 'gemini',
      label: 'Gemini',
      onClick: () => openTab('https://gemini.google.com'),
    },
    {
      key: 'kimi',
      label: 'Kimi',
      onClick: () => openTab('https://kimi.moonshot.cn'),
    },
    {
      key: 'tongyi',
      label: '通义千问',
      onClick: () => openTab('https://tongyi.aliyun.com'),
    },
  ]

  return (
    <div className="prompt-hub-header">
      <div className="flex items-center">
        <Title level={4} style={{ margin: 0, color: '#1677ff' }}>
          PromptHub
        </Title>
        <span style={{ marginLeft: 8, color: '#666', fontSize: 12 }}>
          AI工作流自动化中心
        </span>
      </div>
      
      <Space>
        <Dropdown
          menu={{ items: websiteMenuItems }}
          trigger={['click']}
          placement="bottomRight"
        >
          <Button icon={<GlobalOutlined />} type="primary">
            打开网站
          </Button>
        </Dropdown>
        
        <Button icon={<PlusOutlined />} onClick={handleNewTab}>
          新建标签页
        </Button>
        
        <Button icon={<UploadOutlined />} onClick={handleImport}>
          导入
        </Button>
        
        <Button icon={<DownloadOutlined />} onClick={handleExport}>
          导出
        </Button>
        
        <Button icon={<SettingOutlined />} type="text" onClick={() => setSettingsOpen(true)}>
          设置
        </Button>
      </Space>
      
      <Settings 
        open={settingsOpen} 
        onClose={() => setSettingsOpen(false)} 
      />
    </div>
  )
}