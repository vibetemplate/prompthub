import React, { useState, useEffect } from 'react'
import { 
  Card, 
  Input, 
  Button, 
  Select, 
  Space, 
  Tag, 
  message,
  Divider,
  Typography 
} from 'antd'
import { 
  SaveOutlined, 
  SendOutlined, 
  PlusOutlined,
  DeleteOutlined
} from '@ant-design/icons'
import { usePromptStore } from '../stores/prompt-store'
import { useBrowserStore } from '../stores/browser-store'

const { TextArea } = Input
const { Text } = Typography

export const PromptEditor: React.FC = () => {
  const { selectedPrompt, updatePrompt } = usePromptStore()
  const { activeTabId, executePrompt } = useBrowserStore()
  
  const [content, setContent] = useState('')
  const [websiteType, setWebsiteType] = useState<string>('deepseek')
  const [tags, setTags] = useState<string[]>([])
  const [newTag, setNewTag] = useState('')
  const [isExecuting, setIsExecuting] = useState(false)

  useEffect(() => {
    if (selectedPrompt) {
      setContent(selectedPrompt.content || '')
      setWebsiteType(selectedPrompt.websiteType || 'deepseek')
      setTags(selectedPrompt.tags || [])
    } else {
      setContent('')
      setWebsiteType('deepseek')
      setTags([])
    }
  }, [selectedPrompt])

  const handleSave = async () => {
    if (!selectedPrompt) {
      message.error('请先选择一个提示词')
      return
    }

    try {
      await updatePrompt(selectedPrompt.id, {
        content,
        websiteType: websiteType as any,
        tags,
      })
      message.success('保存成功')
    } catch (error) {
      message.error('保存失败')
    }
  }

  const handleExecute = async () => {
    if (!selectedPrompt || !content.trim()) {
      message.error('请先选择提示词并输入内容')
      return
    }

    if (!activeTabId) {
      message.error('请先打开一个浏览器标签页')
      return
    }

    setIsExecuting(true)
    try {
      await executePrompt(activeTabId, websiteType, content)
      message.success('提示词执行成功')
    } catch (error) {
      message.error('提示词执行失败')
    } finally {
      setIsExecuting(false)
    }
  }

  const handleAddTag = () => {
    if (newTag.trim() && !tags.includes(newTag.trim())) {
      setTags([...tags, newTag.trim()])
      setNewTag('')
    }
  }

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter(tag => tag !== tagToRemove))
  }

  const websiteOptions = [
    { value: 'deepseek', label: 'DeepSeek' },
    { value: 'chatgpt', label: 'ChatGPT' },
    { value: 'claude', label: 'Claude' },
    { value: 'gemini', label: 'Gemini' },
    { value: 'kimi', label: 'Kimi' },
    { value: 'tongyi', label: '通义千问' },
  ]

  if (!selectedPrompt) {
    return (
      <Card size="small" style={{ height: '100%' }}>
        <div className="flex items-center justify-center h-full text-gray-500">
          请选择一个提示词进行编辑
        </div>
      </Card>
    )
  }

  return (
    <Card
      size="small"
      title={
        <div className="flex items-center justify-between">
          <Text strong>{selectedPrompt.title}</Text>
          <div className="status-indicator" />
        </div>
      }
      extra={
        <Space>
          <Button
            type="primary"
            icon={<SaveOutlined />}
            size="small"
            onClick={handleSave}
          >
            保存
          </Button>
          <Button
            type="primary"
            icon={<SendOutlined />}
            size="small"
            loading={isExecuting}
            onClick={handleExecute}
          >
            执行
          </Button>
        </Space>
      }
    >
      <Space direction="vertical" style={{ width: '100%' }} size="middle">
        <div>
          <Text type="secondary">目标网站</Text>
          <Select
            value={websiteType}
            onChange={setWebsiteType}
            options={websiteOptions}
            style={{ width: '100%', marginTop: 4 }}
            size="small"
          />
        </div>

        <div>
          <Text type="secondary">提示词内容</Text>
          <TextArea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="请输入提示词内容..."
            rows={8}
            style={{ marginTop: 4 }}
          />
        </div>

        <div>
          <Text type="secondary">标签</Text>
          <div style={{ marginTop: 4 }}>
            {tags.map(tag => (
              <Tag
                key={tag}
                closable
                onClose={() => handleRemoveTag(tag)}
                style={{ marginBottom: 4 }}
              >
                {tag}
              </Tag>
            ))}
            <div style={{ marginTop: 4, display: 'flex', gap: 4 }}>
              <Input
                size="small"
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                onPressEnter={handleAddTag}
                placeholder="添加标签"
                style={{ flex: 1 }}
              />
              <Button
                size="small"
                icon={<PlusOutlined />}
                onClick={handleAddTag}
              />
            </div>
          </div>
        </div>

        <Divider style={{ margin: '8px 0' }} />

        <div className="prompt-execution-controls">
          <Text type="secondary" style={{ fontSize: 12 }}>
            {activeTabId ? '已连接浏览器' : '未连接浏览器'}
          </Text>
        </div>
      </Space>
    </Card>
  )
}