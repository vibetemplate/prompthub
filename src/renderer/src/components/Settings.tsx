import React, { useState, useEffect } from 'react'
import { 
  Modal, 
  Form, 
  Input, 
  Switch, 
  Select, 
  InputNumber, 
  Button, 
  Space, 
  Tabs,
  message 
} from 'antd'
import { useSettings } from '../hooks/useSettings'

interface SettingsProps {
  open: boolean
  onClose: () => void
}

export const Settings: React.FC<SettingsProps> = ({ open, onClose }) => {
  const { settings, updateSettings, loading } = useSettings()
  const [form] = Form.useForm()

  useEffect(() => {
    if (open && settings) {
      form.setFieldsValue(settings)
    }
  }, [open, settings, form])

  const handleSave = async () => {
    try {
      const values = await form.validateFields()
      await updateSettings(values)
      message.success('设置保存成功')
      onClose()
    } catch (error) {
      message.error('设置保存失败')
    }
  }

  const tabItems = [
    {
      key: 'proxy',
      label: '网络代理',
      children: (
        <Space direction="vertical" style={{ width: '100%' }}>
          <Form.Item
            name={['proxy', 'enabled']}
            label="启用代理"
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>
          
          <Form.Item
            name={['proxy', 'host']}
            label="代理主机"
            rules={[{ required: true, message: '请输入代理主机' }]}
          >
            <Input placeholder="127.0.0.1" />
          </Form.Item>
          
          <Form.Item
            name={['proxy', 'port']}
            label="代理端口"
            rules={[{ required: true, message: '请输入代理端口' }]}
          >
            <InputNumber min={1} max={65535} placeholder="7890" style={{ width: '100%' }} />
          </Form.Item>
          
          <Form.Item
            name={['proxy', 'username']}
            label="用户名（可选）"
          >
            <Input placeholder="代理用户名" />
          </Form.Item>
          
          <Form.Item
            name={['proxy', 'password']}
            label="密码（可选）"
          >
            <Input.Password placeholder="代理密码" />
          </Form.Item>
        </Space>
      ),
    },
    {
      key: 'browser',
      label: '浏览器设置',
      children: (
        <Space direction="vertical" style={{ width: '100%' }}>
          <Form.Item
            name={['browser', 'headless']}
            label="无头模式"
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>
          
          <Form.Item
            name={['browser', 'userAgent']}
            label="用户代理"
          >
            <Input placeholder="自定义User-Agent（可选）" />
          </Form.Item>
          
          <Form.Item label="视窗尺寸">
            <Input.Group compact>
              <Form.Item
                name={['browser', 'viewport', 'width']}
                style={{ width: '50%' }}
                rules={[{ required: true, message: '请输入宽度' }]}
              >
                <InputNumber min={800} max={3840} placeholder="宽度" style={{ width: '100%' }} />
              </Form.Item>
              <Form.Item
                name={['browser', 'viewport', 'height']}
                style={{ width: '50%' }}
                rules={[{ required: true, message: '请输入高度' }]}
              >
                <InputNumber min={600} max={2160} placeholder="高度" style={{ width: '100%' }} />
              </Form.Item>
            </Input.Group>
          </Form.Item>
        </Space>
      ),
    },
    {
      key: 'general',
      label: '通用设置',
      children: (
        <Space direction="vertical" style={{ width: '100%' }}>
          <Form.Item
            name={['general', 'autoSave']}
            label="自动保存"
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>
          
          <Form.Item
            name={['general', 'theme']}
            label="主题"
            rules={[{ required: true, message: '请选择主题' }]}
          >
            <Select>
              <Select.Option value="light">浅色主题</Select.Option>
              <Select.Option value="dark">深色主题</Select.Option>
            </Select>
          </Form.Item>
          
          <Form.Item
            name={['general', 'language']}
            label="语言"
            rules={[{ required: true, message: '请选择语言' }]}
          >
            <Select>
              <Select.Option value="zh">中文</Select.Option>
              <Select.Option value="en">English</Select.Option>
            </Select>
          </Form.Item>
        </Space>
      ),
    },
  ]

  return (
    <Modal
      title="设置"
      open={open}
      onCancel={onClose}
      width={600}
      footer={
        <Space>
          <Button onClick={onClose}>取消</Button>
          <Button type="primary" loading={loading} onClick={handleSave}>
            保存
          </Button>
        </Space>
      }
    >
      <Form
        form={form}
        layout="vertical"
        initialValues={settings}
      >
        <Tabs items={tabItems} />
      </Form>
    </Modal>
  )
}