import React, { useState } from 'react'
import { Tree, Button, Space, Dropdown, Modal, Input, message } from 'antd'
import { 
  PlusOutlined, 
  FolderOutlined, 
  FileTextOutlined,
  MoreOutlined,
  EditOutlined,
  DeleteOutlined,
  FolderAddOutlined
} from '@ant-design/icons'
import type { DataNode } from 'antd/es/tree'
import { usePromptStore, type PromptNode } from '../stores/prompt-store'

export const PromptTree: React.FC = () => {
  const { prompts, selectedPrompt, selectPrompt, createPrompt, updatePrompt, deletePrompt } = usePromptStore()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [modalType, setModalType] = useState<'folder' | 'prompt'>('prompt')
  const [modalTitle, setModalTitle] = useState('')
  const [editingNode, setEditingNode] = useState<PromptNode | null>(null)
  const [selectedParentId, setSelectedParentId] = useState<string | undefined>()

  const convertToTreeData = (nodes: PromptNode[]): DataNode[] => {
    return nodes.map(node => ({
      key: node.id,
      title: (
        <div className="flex items-center justify-between group">
          <div className="flex items-center">
            {node.type === 'folder' ? <FolderOutlined /> : <FileTextOutlined />}
            <span className="ml-2">{node.title}</span>
          </div>
          <Dropdown
            menu={{
              items: [
                {
                  key: 'edit',
                  label: '编辑',
                  icon: <EditOutlined />,
                  onClick: () => handleEdit(node),
                },
                {
                  key: 'delete',
                  label: '删除',
                  icon: <DeleteOutlined />,
                  onClick: () => handleDelete(node),
                },
                ...(node.type === 'folder' ? [
                  { type: 'divider' as const },
                  {
                    key: 'add-folder',
                    label: '添加文件夹',
                    icon: <FolderAddOutlined />,
                    onClick: () => handleAddFolder(node.id),
                  },
                  {
                    key: 'add-prompt',
                    label: '添加提示词',
                    icon: <PlusOutlined />,
                    onClick: () => handleAddPrompt(node.id),
                  },
                ] : []),
              ],
            }}
            trigger={['click']}
            placement="bottomRight"
          >
            <Button
              type="text"
              size="small"
              icon={<MoreOutlined />}
              className="opacity-0 group-hover:opacity-100"
              onClick={(e) => e.stopPropagation()}
            />
          </Dropdown>
        </div>
      ),
      icon: node.type === 'folder' ? <FolderOutlined /> : <FileTextOutlined />,
      children: node.children ? convertToTreeData(node.children) : undefined,
    }))
  }

  const handleSelect = (selectedKeys: React.Key[]) => {
    if (selectedKeys.length > 0) {
      const nodeId = selectedKeys[0] as string
      const node = findNodeById(prompts, nodeId)
      if (node && node.type === 'prompt') {
        selectPrompt(node)
      }
    } else {
      selectPrompt(null)
    }
  }

  const findNodeById = (nodes: PromptNode[], id: string): PromptNode | null => {
    for (const node of nodes) {
      if (node.id === id) {
        return node
      }
      if (node.children) {
        const found = findNodeById(node.children, id)
        if (found) return found
      }
    }
    return null
  }

  const handleAddFolder = (parentId?: string) => {
    setModalType('folder')
    setModalTitle('')
    setEditingNode(null)
    setSelectedParentId(parentId)
    setIsModalOpen(true)
  }

  const handleAddPrompt = (parentId?: string) => {
    setModalType('prompt')
    setModalTitle('')
    setEditingNode(null)
    setSelectedParentId(parentId)
    setIsModalOpen(true)
  }

  const handleEdit = (node: PromptNode) => {
    setModalType(node.type)
    setModalTitle(node.title)
    setEditingNode(node)
    setIsModalOpen(true)
  }

  const handleDelete = (node: PromptNode) => {
    Modal.confirm({
      title: '确认删除',
      content: `确定要删除 "${node.title}" 吗？${node.type === 'folder' ? '文件夹下的所有内容也会被删除。' : ''}`,
      onOk: async () => {
        try {
          await deletePrompt(node.id)
          message.success('删除成功')
        } catch (error) {
          message.error('删除失败')
        }
      },
    })
  }

  const handleModalOk = async () => {
    if (!modalTitle.trim()) {
      message.error('请输入名称')
      return
    }

    try {
      if (editingNode) {
        await updatePrompt(editingNode.id, { title: modalTitle })
        message.success('更新成功')
      } else {
        await createPrompt({
          title: modalTitle,
          type: modalType,
          parentId: selectedParentId,
          content: modalType === 'prompt' ? '' : undefined,
        })
        message.success('创建成功')
      }
      setIsModalOpen(false)
      setModalTitle('')
      setEditingNode(null)
      setSelectedParentId(undefined)
    } catch (error) {
      message.error(editingNode ? '更新失败' : '创建失败')
    }
  }

  return (
    <div>
      <div className="prompt-tree-header">
        <h3>提示词库</h3>
        <Space>
          <Button
            type="text"
            size="small"
            icon={<FolderAddOutlined />}
            onClick={() => handleAddFolder()}
          />
          <Button
            type="text"
            size="small"
            icon={<PlusOutlined />}
            onClick={() => handleAddPrompt()}
          />
        </Space>
      </div>

      <Tree
        treeData={convertToTreeData(prompts)}
        selectedKeys={selectedPrompt ? [selectedPrompt.id] : []}
        onSelect={handleSelect}
        showIcon
        showLine
        defaultExpandAll
      />

      <Modal
        title={`${editingNode ? '编辑' : '新建'}${modalType === 'folder' ? '文件夹' : '提示词'}`}
        open={isModalOpen}
        onOk={handleModalOk}
        onCancel={() => {
          setIsModalOpen(false)
          setModalTitle('')
          setEditingNode(null)
          setSelectedParentId(undefined)
        }}
      >
        <Input
          placeholder={`请输入${modalType === 'folder' ? '文件夹' : '提示词'}名称`}
          value={modalTitle}
          onChange={(e) => setModalTitle(e.target.value)}
          onPressEnter={handleModalOk}
        />
      </Modal>
    </div>
  )
}