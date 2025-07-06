import React from 'react'
import { Divider } from 'antd'
import { PromptTree } from './PromptTree'
import { PromptEditor } from './PromptEditor'

export const Sidebar: React.FC = () => {
  return (
    <div className="prompt-hub-sidebar">
      <div className="prompt-tree">
        <PromptTree />
      </div>
      
      <Divider style={{ margin: 0 }} />
      
      <div style={{ padding: '16px' }}>
        <PromptEditor />
      </div>
    </div>
  )
}